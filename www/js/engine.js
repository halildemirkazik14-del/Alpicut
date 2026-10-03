// Alpicut — oynatma ve dışa aktarma motoru
import { RATIOS } from './presets.js';
import { drawClip, drawTransition, drawLayer, drawSubtitles, drawFx, clamp } from './render.js';

export function clipLen(c) {
  if (c.type === 'image' || c.freeze) return Math.max(0.2, c.dur || 3);
  return Math.max(0.1, (c.out - c.in) / (c.speed || 1));
}

// Ana iz yerleşimi: geçişler üst üste biner
export function layoutClips(clips) {
  const out = [];
  let cursor = 0;
  clips.forEach((c, i) => {
    const len = clipLen(c);
    let td = 0;
    if (i > 0 && c.trans && c.trans.type !== 'none') {
      td = Math.min(c.trans.dur || 0.5, out[i - 1].len / 2, len / 2);
    }
    const start = Math.max(0, cursor - td);
    out.push({ clip: c, start, len, td, end: start + len });
    cursor = start + len;
  });
  return out;
}

export function projectDuration(P) {
  const lay = layoutClips(P.clips);
  let d = lay.length ? lay[lay.length - 1].end : 0;
  P.layers.forEach((l) => { d = Math.max(d, l.end); });
  P.audio.forEach((a) => { d = Math.max(d, a.start + (a.out - a.in)); });
  if (P.subs?.cues?.length) d = Math.max(d, P.subs.cues[P.subs.cues.length - 1].end + (P.subs.offset || 0));
  return Math.max(d, 0.1);
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.P = null;
    this.media = new Map(); // mediaId -> {kind,url,...}
    this.els = new Map(); // itemId -> element
    this.imgs = new Map(); // mediaId -> Image
    this.nodes = new Map(); // element -> {gain}
    this.t = 0;
    this.playing = false;
    this.exporting = false;
    this.scale = 0.5;
    this.boxes = new Map();
    this.selectedId = null;
    this.guides = null;
    this.onTime = null;
    this.onEnd = null;
    this._raf = null;
    this._needDraw = true;
    this.hidden = document.createElement('div');
    this.hidden.style.cssText = 'position:fixed;left:-10px;top:-10px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(this.hidden);
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  setProject(P) {
    this.P = P;
    const ids = new Set([...P.clips.map((c) => c.id), ...P.layers.map((l) => l.id), ...P.audio.map((a) => a.id)]);
    for (const [id, el] of this.els) {
      if (!ids.has(id)) { try { el.pause(); } catch (_) { /* yoksay */ } }
    }
    this.resize();
    this.requestDraw();
  }

  get W() { return RATIOS[this.P?.ratio || '9:16'][0]; }
  get H() { return RATIOS[this.P?.ratio || '9:16'][1]; }

  resize(scale) {
    if (scale) this.scale = scale;
    const w = Math.round(this.W * this.scale), h = Math.round(this.H * this.scale);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.requestDraw();
  }

  requestDraw() { this._needDraw = true; }

  duration() { return this.P ? projectDuration(this.P) : 0; }

  // ---------- ses ----------
  ensureAudio() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.connect(this.ac.destination);
      this.recDest = this.ac.createMediaStreamDestination();
      for (const el of this.els.values()) this._connect(el);
    } catch (e) { console.warn('AudioContext yok', e); }
  }

  _connect(el) {
    if (!this.ac || this.nodes.has(el) || el.tagName === 'IMG') return;
    try {
      const src = this.ac.createMediaElementSource(el);
      const gain = this.ac.createGain();
      src.connect(gain); gain.connect(this.master); gain.connect(this.recDest);
      this.nodes.set(el, { gain });
    } catch (e) { console.warn('ses bağlanamadı', e); }
  }

  setVol(el, v) {
    v = Math.max(0, v);
    const n = this.nodes.get(el);
    if (n) { n.gain.gain.value = v; el.volume = 1; } else el.volume = clamp(v);
  }

  // ---------- elemanlar ----------
  elFor(item) {
    const m = this.media.get(item.mediaId);
    if (!m) return null;
    if (m.kind === 'image') {
      let img = this.imgs.get(m.id);
      if (!img) {
        img = new Image();
        img.onload = () => this.requestDraw();
        img.src = m.url;
        this.imgs.set(m.id, img);
      }
      return img;
    }
    let el = this.els.get(item.id);
    if (el && el._mid !== m.id) { el.pause(); el = null; }
    if (!el) {
      el = document.createElement(m.kind === 'audio' ? 'audio' : 'video');
      el._mid = m.id;
      el.preload = 'auto';
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.src = m.url;
      el.addEventListener('seeked', () => this.requestDraw());
      el.addEventListener('loadeddata', () => this.requestDraw());
      this.hidden.appendChild(el);
      this.els.set(item.id, el);
      this._connect(el);
    }
    return el;
  }

  // Bir eleman için hedef zamanı uygula
  _syncEl(el, active, srcT, rate, vol) {
    if (!el || el.tagName === 'IMG') return;
    if (!active) {
      if (!el.paused) el.pause();
      return;
    }
    this.setVol(el, vol);
    if (Math.abs(el.playbackRate - rate) > 0.01) el.playbackRate = rate;
    if (this.playing) {
      if (Math.abs(el.currentTime - srcT) > 0.3) el.currentTime = srcT;
      if (el.paused) { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - srcT) > 0.04) el.currentTime = srcT;
    }
  }

  _prepare(el, srcT) {
    if (!el || el.tagName === 'IMG' || !el.paused) return;
    if (Math.abs(el.currentTime - srcT) > 0.05 && !el.seeking) el.currentTime = srcT;
  }

  sync(t) {
    const P = this.P;
    const lay = layoutClips(P.clips);
    lay.forEach((L, i) => {
      const c = L.clip;
      const el = this.elFor(c);
      if (c.type === 'image') return;
      const active = t >= L.start && t < L.end;
      const local = t - L.start;
      let vol = c.volume ?? 1;
      // geçişte ses çapraz geçişi
      if (active && L.td > 0 && local < L.td) vol *= local / L.td;
      const next = lay[i + 1];
      if (active && next && next.td > 0 && t > next.start) vol *= 1 - (t - next.start) / next.td;
      if (c.mute) vol = 0;
      if (c.freeze) {
        // donmuş kare: oynatma yok, ses yok
        if (el && !el.paused) el.pause();
        if (el && active && Math.abs(el.currentTime - c.freezeAt) > 0.03 && !el.seeking) el.currentTime = c.freezeAt;
        if (el && !active && t < L.start && L.start - t < 1.5) this._prepare(el, c.freezeAt);
        return;
      }
      this._syncEl(el, active, c.in + local * (c.speed || 1), c.speed || 1, vol);
      if (!active && t < L.start && L.start - t < 1.5) this._prepare(el, c.in);
    });
    P.layers.forEach((l) => {
      if (l.kind !== 'media') return;
      const el = this.elFor(l);
      if (!el || el.tagName === 'IMG') return;
      const active = t >= l.start && t < l.end;
      const local = t - l.start;
      const srcLen = Math.max(0.1, (l.out ?? el.duration ?? 1) - (l.in || 0));
      const srcT = (l.in || 0) + (l.loop ? local % srcLen : Math.min(local, srcLen - 0.05));
      this._syncEl(el, active, srcT, 1, l.mute ? 0 : (l.volume ?? 0));
      if (!active && t < l.start && l.start - t < 1.5) this._prepare(el, l.in || 0);
    });
    P.audio.forEach((a) => {
      const el = this.elFor(a);
      const len = a.out - a.in;
      const active = t >= a.start && t < a.start + len;
      const local = t - a.start;
      let vol = a.volume ?? 1;
      if (a.fadeIn > 0) vol *= clamp(local / a.fadeIn);
      if (a.fadeOut > 0) vol *= clamp((len - local) / a.fadeOut);
      this._syncEl(el, active, a.in + local, 1, vol);
      if (!active && t < a.start && a.start - t < 1.5) this._prepare(el, a.in);
    });
  }

  // ---------- çizim ----------
  env() { return { W: this.W, H: this.H, S: this.scale }; }

  draw(t = this.t) {
    const P = this.P;
    if (!P) return;
    const ctx = this.ctx;
    const env = this.env();
    const { W, H } = env;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = P.fx?.bg || '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    const lay = layoutClips(P.clips);
    const act = lay.filter((L) => t >= L.start && t < L.end);
    const dc = (L) => () => drawClip(ctx, L.clip, this.elFor(L.clip), t - L.start, L.len, env);
    if (act.length >= 2) {
      const a = act[act.length - 2], b = act[act.length - 1];
      const p = clamp((t - b.start) / Math.max(0.01, b.td));
      drawTransition(ctx, b.clip.trans.type, p, dc(a), dc(b), env);
    } else if (act.length === 1) dc(act[0])();

    this.boxes.clear();
    P.layers.forEach((l) => {
      if (t < l.start || t >= l.end) return;
      const still = !this.playing && !this.exporting && l.id === this.selectedId;
      const box = drawLayer(ctx, l, t, env, l.kind === 'media' ? this.elFor(l) : null, still);
      if (box) this.boxes.set(l.id, box);
    });
    if (!this.exporting || P.subs?.burn !== false) drawSubtitles(ctx, P.subs, t, env);
    drawFx(ctx, P.fx, t, this.duration(), env);

    if (!this.exporting) this._drawSelection(ctx, t);
  }

  _drawSelection(ctx, t) {
    const S = this.scale;
    const l = this.P.layers.find((x) => x.id === this.selectedId);
    if (this.guides && this.P.ratio === '9:16') {
      // kısa video güvenli alanı (platform arayüzünün kapattığı bölgeler dışı)
      ctx.save();
      ctx.strokeStyle = 'rgba(250,204,21,.7)'; ctx.lineWidth = 2 / S; ctx.setLineDash([8 / S, 8 / S]);
      ctx.strokeRect(this.W * 0.06, this.H * 0.1, this.W * 0.78, this.H * 0.68);
      ctx.restore();
    }
    if (this.guides) {
      ctx.save();
      ctx.strokeStyle = '#E879F9'; ctx.lineWidth = 2 / S; ctx.setLineDash([12 / S, 10 / S]);
      if (this.guides.x) { ctx.beginPath(); ctx.moveTo(this.W / 2, 0); ctx.lineTo(this.W / 2, this.H); ctx.stroke(); }
      if (this.guides.y) { ctx.beginPath(); ctx.moveTo(0, this.H / 2); ctx.lineTo(this.W, this.H / 2); ctx.stroke(); }
      ctx.restore();
    }
    if (!l || t < l.start || t >= l.end) return;
    const b = this.boxes.get(l.id);
    if (!b) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(((b.rot || 0) * Math.PI) / 180);
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 4 / S;
    ctx.setLineDash([16 / S, 10 / S]);
    ctx.strokeRect(-b.w / 2 - 10, -b.h / 2 - 10, b.w + 20, b.h + 20);
    ctx.restore();
  }

  // Ön izlemede dokunma ile katman bul
  hitTest(nx, ny) {
    const x = nx * this.W, y = ny * this.H;
    const list = this.P.layers.filter((l) => this.t >= l.start && this.t < l.end).reverse();
    for (const l of list) {
      const b = this.boxes.get(l.id);
      if (!b) continue;
      const a = -((b.rot || 0) * Math.PI) / 180;
      const dx = x - b.x, dy = y - b.y;
      const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(rx) <= b.w / 2 + 30 && Math.abs(ry) <= b.h / 2 + 30) return l;
    }
    return null;
  }

  // ---------- oynatma ----------
  play() {
    if (!this.P) return;
    this.ensureAudio();
    const d = this.duration();
    if (this.t >= d - 0.05) this.t = 0;
    this.playing = true;
    this._t0 = this.t;
    this._n0 = performance.now();
  }

  pause() {
    this.playing = false;
    this.sync(this.t);
    this.requestDraw();
  }

  seek(t) {
    this.t = clamp(t, 0, this.duration());
    if (this.playing) { this._t0 = this.t; this._n0 = performance.now(); }
    this.sync(this.t);
    this.requestDraw();
  }

  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    if (!this.P) return;
    if (this.playing) {
      const d = this.duration();
      this.t = this._t0 + (performance.now() - this._n0) / 1000;
      if (this.t >= d) {
        this.t = d;
        this.playing = false;
        this.sync(this.t);
        this.draw(Math.max(0, d - 0.001)); // son kare siyah kalmasın
        if (this.onTime) this.onTime(this.t);
        if (this.onEnd) this.onEnd();
        return;
      }
      this.sync(this.t);
      this.draw();
      if (this.onTime) this.onTime(this.t);
    } else if (this._needDraw) {
      this._needDraw = false;
      const d = this.duration();
      this.draw(this.t >= d ? Math.max(0, d - 0.001) : this.t);
    }
  }

  // ---------- dışa aktarma ----------
  static pickMime() {
    const list = [
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    if (!window.MediaRecorder) return null;
    return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (_) { return false; } }) || '';
  }

  async export({ res = 1, fps = 30, bitrate = 10e6, abr = 192000, onProgress, shouldCancel } = {}) {
    if (!window.MediaRecorder || !this.canvas.captureStream) throw new Error('Bu cihaz video kaydını desteklemiyor.');
    this.playing = false;
    this.ensureAudio();
    const oldScale = this.scale;
    this.exporting = true;
    this.resize(res);
    const mime = Engine.pickMime();
    const stream = this.canvas.captureStream(fps);
    if (this.recDest) this.recDest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: abr } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = resolve; });

    // başa sar ve medyanın hazır olmasını bekle
    this.seek(0);
    await new Promise((r) => setTimeout(r, 600));
    this.draw(0);
    const d = this.duration();
    rec.start(250);
    this.play();
    let cancelled = false;
    await new Promise((resolve) => {
      const check = () => {
        if (shouldCancel && shouldCancel()) { cancelled = true; this.playing = false; resolve(); return; }
        if (onProgress) onProgress(clamp(this.t / d));
        if (!this.playing) { resolve(); return; }
        setTimeout(check, 100);
      };
      check();
    });
    await new Promise((r) => setTimeout(r, 300));
    rec.stop();
    await done;
    stream.getVideoTracks().forEach((tr) => tr.stop());
    this.exporting = false;
    this.resize(oldScale);
    this.pause();
    if (cancelled) return null;
    const type = (mime || 'video/webm').split(';')[0];
    return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' };
  }
}
