// Alpicut — oynatma ve dışa aktarma motoru
import { RATIOS } from './presets.js';
import { drawClip, drawTransition, drawLayer, drawSubtitles, drawFx, clamp } from './render.js';
import { applyLayerFx } from './fxlib.js';
import { transGL } from './gltrans.js';
import { hasKeys, propAt } from './kf.js';

// Hız eğrileri (CapCut tarzı): 0..1 arası 7 kontrol noktasında hız çarpanı
export const SPEED_CURVES = {
  montage: ['Montaj', [1.8, 1.8, 0.35, 0.35, 1.8, 1.8, 1.8]],
  hero: ['Kahraman anı', [1.6, 1.6, 0.25, 0.25, 0.25, 1.6, 1.6]],
  bullet: ['Mermi', [2.2, 0.3, 0.2, 0.2, 0.3, 2.2, 2.2]],
  jump: ['Zıplama', [0.6, 2.4, 0.6, 2.4, 0.6, 2.4, 0.6]],
  flashIn: ['Hızlı giriş', [3, 2.4, 1.6, 1, 1, 1, 1]],
  flashOut: ['Hızlı çıkış', [1, 1, 1, 1, 1.6, 2.4, 3]],
  slowEnd: ['Sonda yavaşla', [1.5, 1.5, 1.4, 1.2, 0.8, 0.4, 0.3]],
  ramp: ['Yavaştan hızlıya', [0.4, 0.6, 0.9, 1.2, 1.6, 2, 2.4]],
};
export function curvePts(c) { return Array.isArray(c.curve) ? c.curve : SPEED_CURVES[c.curve]?.[1]; }
export function curveSpeed(c, u) {
  const p = curvePts(c); if (!p) return c.speed || 1;
  const x = Math.max(0, Math.min(1, u)) * (p.length - 1), i = Math.min(p.length - 2, Math.floor(x)), f = x - i;
  return Math.max(0.1, p[i] + (p[i + 1] - p[i]) * f);
}
const curveCache = new Map();
function curveTable(c) {
  const p = curvePts(c); const key = p.join(',');
  if (curveCache.has(key)) return curveCache.get(key);
  const N = 200, cum = new Float32Array(N + 1);
  for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + (curveSpeed(c, (i - 0.5) / N)) / N;
  const tb = { cum, mean: cum[N] };
  curveCache.set(key, tb); return tb;
}
// klip içi zaman -> kaynak zamanı
export function curveSrc(c, local, len) {
  const tb = curveTable(c); const N = tb.cum.length - 1;
  const u = Math.max(0, Math.min(1, local / len)) * N, i = Math.min(N - 1, Math.floor(u)), f = u - i;
  const I = tb.cum[i] + (tb.cum[i + 1] - tb.cum[i]) * f;
  return c.in + (c.out - c.in) * (I / tb.mean);
}

export function clipLen(c) {
  if (c.type === 'image' || c.freeze) return Math.max(0.2, c.dur || 3);
  if (curvePts(c)) return Math.max(0.1, (c.out - c.in) / curveTable(c).mean);
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

// grup katmanlarının çocuklarıyla birlikte düz liste
export function flatLayers(P) {
  const out = [];
  (P.layers || []).forEach((l) => { out.push(l); if (l.kind === 'group') (l.children || []).forEach((c) => out.push(c)); });
  return out;
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
    const ids = new Set([...P.clips.map((c) => c.id), ...flatLayers(P).map((l) => l.id), ...P.audio.map((a) => a.id)]);
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
  // Grafik: öğe -> kazanç -> yüksek geçiren -> 3 bant EQ -> kompresör -> grup (konuşma/müzik/SFX) -> master -> limiter -> çıkış
  ensureAudio() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = this.ac = new AC();
      this.master = ac.createGain();
      this.preMeter = ac.createAnalyser(); this.preMeter.fftSize = 1024;
      this.limiter = ac.createDynamicsCompressor();
      this.out = ac.createGain();
      this.postMeter = ac.createAnalyser(); this.postMeter.fftSize = 1024;
      this.master.connect(this.preMeter);
      this.master.connect(this.limiter);
      this.limiter.connect(this.out);
      this.out.connect(this.postMeter);
      this.out.connect(ac.destination);
      this.recDest = ac.createMediaStreamDestination();
      this.out.connect(this.recDest);
      this.buses = {};
      ['voice', 'music', 'sfx'].forEach((r) => { const g = ac.createGain(); this.buses[r] = g; });
      this.duck = ac.createGain();
      this.buses.voice.connect(this.master);
      this.buses.sfx.connect(this.master);
      this.buses.music.connect(this.duck); this.duck.connect(this.master);
      this.voiceMeter = ac.createAnalyser(); this.voiceMeter.fftSize = 1024;
      this.buses.voice.connect(this.voiceMeter);
      this.duckLevel = 1;
      this.meter = { peak: -90, clipUntil: 0, duckDb: 0 };
      this._buf = new Float32Array(1024);
      this.applyMix();
      for (const [el, id] of this._elIds()) this._connect(el, id);
    } catch (e) { console.warn('AudioContext yok', e); }
  }

  *_elIds() { for (const [id, el] of this.els) yield [el, id]; }

  mix() {
    const M = this.P?.mix || {};
    return {
      voice: M.voice ?? 1, music: M.music ?? 1, sfx: M.sfx ?? 1, master: M.master ?? 1, limiter: M.limiter !== false,
      duck: { on: !!M.duck?.on, amount: M.duck?.amount ?? 12, threshold: M.duck?.threshold ?? -38, attack: M.duck?.attack ?? 0.08, release: M.duck?.release ?? 0.45 },
    };
  }

  applyMix() {
    if (!this.ac) return;
    const m = this.mix();
    this.buses.voice.gain.value = m.voice; this.buses.music.gain.value = m.music; this.buses.sfx.gain.value = m.sfx;
    this.master.gain.value = m.master;
    const L = this.limiter;
    if (m.limiter) { L.threshold.value = -1.5; L.knee.value = 0; L.ratio.value = 20; L.attack.value = 0.002; L.release.value = 0.12; }
    else { L.threshold.value = 0; L.knee.value = 0; L.ratio.value = 1; }
    if (!m.duck.on) { this.duckLevel = 1; this.duck.gain.value = 1; }
  }

  _rms(an) {
    an.getFloatTimeDomainData(this._buf);
    let s = 0, pk = 0;
    for (let i = 0; i < this._buf.length; i++) { const v = this._buf[i]; s += v * v; const a = Math.abs(v); if (a > pk) pk = a; }
    return { rms: 20 * Math.log10(Math.sqrt(s / this._buf.length) + 1e-9), peak: 20 * Math.log10(pk + 1e-9) };
  }

  // Her karede: ducking ve seviye ölçerleri
  _audioTick(dt) {
    if (!this.ac || !this.buses) return;
    const m = this.mix();
    if (m.duck.on) {
      const v = this._rms(this.voiceMeter).rms;
      const target = v > m.duck.threshold ? Math.pow(10, -m.duck.amount / 20) : 1;
      const tau = target < this.duckLevel ? m.duck.attack : m.duck.release;
      this.duckLevel += (target - this.duckLevel) * (1 - Math.exp(-dt / Math.max(0.01, tau)));
      this.duck.gain.value = this.duckLevel;
      this.meter.duckDb = 20 * Math.log10(this.duckLevel);
    }
    const pre = this._rms(this.preMeter), post = this._rms(this.postMeter);
    this.meter.peak = post.peak;
    if (pre.peak > -0.1) this.meter.clipUntil = performance.now() + 1200;
  }

  _connect(el, itemId) {
    if (!this.ac || this.nodes.has(el) || el.tagName === 'IMG') return;
    try {
      const ac = this.ac;
      const src = ac.createMediaElementSource(el);
      const gain = ac.createGain();
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 10;
      const lo = ac.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 160;
      const mid = ac.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 2500; mid.Q.value = 0.9;
      const hi = ac.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 8000;
      const comp = ac.createDynamicsCompressor(); comp.ratio.value = 1; comp.threshold.value = 0;
      src.connect(gain); gain.connect(hp); hp.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(comp);
      const dry = ac.createGain(), out = ac.createGain();
      comp.connect(dry); dry.connect(out);
      const node = { gain, hp, lo, mid, hi, comp, dry, out, wet: [], role: null, sig: '', vfx: 'none' };
      this.nodes.set(el, node);
      this._route(node, 'voice');
    } catch (e) { console.warn('ses bağlanamadı', e); }
    void itemId;
  }

  _route(node, role) {
    if (node.role === role) return;
    try { node.out.disconnect(); } catch (_) { /* yoksay */ }
    node.out.connect(this.buses[role] || this.buses.voice);
    node.role = role;
  }

  // ses öğesinin zincir ayarlarını uygula
  setChain(el, vol, o, defRole) {
    const n = this.nodes.get(el);
    vol = Math.max(0, vol);
    if (!n) { el.volume = clamp(vol); return; }
    el.volume = 1;
    n.gain.gain.value = vol;
    this._route(n, o.role || defRole);
    const a = o.afx || {};
    if ((a.vfx || 'none') !== n.vfx) this._voiceFx(n, a.vfx || 'none');
    const sig = `${a.hp ? 1 : 0}|${a.low || 0}|${a.mid || 0}|${a.high || 0}|${a.comp ? 1 : 0}`;
    if (sig === n.sig) return;
    n.sig = sig;
    n.hp.frequency.value = a.hp ? 90 : 10;
    n.lo.gain.value = a.low || 0; n.mid.gain.value = a.mid || 0; n.hi.gain.value = a.high || 0;
    if (a.comp) { n.comp.threshold.value = -24; n.comp.ratio.value = 4; n.comp.knee.value = 6; n.comp.attack.value = 0.005; n.comp.release.value = 0.15; }
    else { n.comp.threshold.value = 0; n.comp.ratio.value = 1; }
  }

  setVol(el, v) { this.setChain(el, v, {}, 'voice'); }

  // Ses efektleri (gerçek zamanlı): eko, salon, telefon, megafon, robot, su altı, radyo
  _voiceFx(n, type) {
    const ac = this.ac;
    n.wet.forEach((x) => { try { x.disconnect(); } catch (_) { /* yoksay */ } if (x.stop) try { x.stop(); } catch (_) { /* yoksay */ } });
    n.wet = [];
    try { n.comp.disconnect(); } catch (_) { /* yoksay */ }
    n.comp.connect(n.dry);
    n.dry.gain.value = 1;
    n.vfx = type;
    if (type === 'none') return;
    const W = (x) => { n.wet.push(x); return x; };
    const wetOut = W(ac.createGain());
    wetOut.connect(n.out);
    const bp = (f, q) => { const b = W(ac.createBiquadFilter()); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; };
    const shaper = (k) => { const ws = W(ac.createWaveShaper()); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); } ws.curve = c; return ws; };
    const impulse = (sec, decay) => { const len = Math.floor(ac.sampleRate * sec); const b = ac.createBuffer(2, len, ac.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; };
    switch (type) {
      case 'echo': {
        const d = W(ac.createDelay(1)); d.delayTime.value = 0.28;
        const fb = W(ac.createGain()); fb.gain.value = 0.42;
        n.comp.connect(d); d.connect(fb); fb.connect(d); d.connect(wetOut); wetOut.gain.value = 0.6; break;
      }
      case 'hall': case 'room': {
        const cv = W(ac.createConvolver()); cv.buffer = impulse(type === 'hall' ? 2.8 : 0.9, type === 'hall' ? 2.2 : 3);
        n.comp.connect(cv); cv.connect(wetOut); wetOut.gain.value = type === 'hall' ? 0.55 : 0.4; break;
      }
      case 'phone': { const f = bp(1700, 1.1); const s2 = shaper(6); n.comp.connect(f); f.connect(s2); s2.connect(wetOut); n.dry.gain.value = 0; wetOut.gain.value = 1.6; break; }
      case 'megaphone': { const f = bp(1300, 0.8); const s2 = shaper(30); n.comp.connect(f); f.connect(s2); s2.connect(wetOut); n.dry.gain.value = 0; wetOut.gain.value = 0.9; break; }
      case 'radio': { const f = bp(1500, 0.7); const s2 = shaper(12); n.comp.connect(f); f.connect(s2); s2.connect(wetOut); n.dry.gain.value = 0.15; wetOut.gain.value = 1.2; break; }
      case 'robot': {
        const osc = W(ac.createOscillator()); osc.frequency.value = 55; osc.type = 'square';
        const ring = W(ac.createGain()); ring.gain.value = 0;
        osc.connect(ring.gain); osc.start();
        n.comp.connect(ring); ring.connect(wetOut); n.dry.gain.value = 0.2; wetOut.gain.value = 1.4; break;
      }
      case 'underwater': { const lp = W(ac.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 6; n.comp.connect(lp); lp.connect(wetOut); n.dry.gain.value = 0; wetOut.gain.value = 1.3; break; }
      case 'stadium': {
        const cv = W(ac.createConvolver()); cv.buffer = impulse(3.6, 1.6);
        const d = W(ac.createDelay(1)); d.delayTime.value = 0.12;
        n.comp.connect(d); d.connect(cv); cv.connect(wetOut); wetOut.gain.value = 0.7; break;
      }
    }
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
  _syncEl(el, active, srcT, rate, vol, o = {}, defRole = 'voice') {
    if (!el || el.tagName === 'IMG') return;
    if (!active) {
      if (!el.paused) el.pause();
      return;
    }
    this.setChain(el, vol, o, defRole);
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
      if (hasKeys(c, 'vol')) vol *= propAt(c, 'vol', local);
      if (c.mute) vol = 0;
      if (c.freeze) {
        // donmuş kare: oynatma yok, ses yok
        if (el && !el.paused) el.pause();
        if (el && active && Math.abs(el.currentTime - c.freezeAt) > 0.03 && !el.seeking) el.currentTime = c.freezeAt;
        if (el && !active && t < L.start && L.start - t < 1.5) this._prepare(el, c.freezeAt);
        return;
      }
      if (curvePts(c)) {
        const sT = curveSrc(c, local, L.len);
        this._syncEl(el, active, sT, Math.max(0.0625, Math.min(16, curveSpeed(c, local / L.len))), vol, c, 'voice');
      } else this._syncEl(el, active, c.in + local * (c.speed || 1), c.speed || 1, vol, c, 'voice');
      if (!active && t < L.start && L.start - t < 1.5) this._prepare(el, c.in);
    });
    flatLayers(P).forEach((l) => {
      if (l.kind !== 'media') return;
      const el = this.elFor(l);
      if (!el || el.tagName === 'IMG') return;
      const active = t >= l.start && t < l.end;
      const local = t - l.start;
      const srcLen = Math.max(0.1, (l.out ?? el.duration ?? 1) - (l.in || 0));
      const srcT = (l.in || 0) + (l.loop ? local % srcLen : Math.min(local, srcLen - 0.05));
      this._syncEl(el, active, srcT, 1, (l.mute || l.hidden) ? 0 : (l.volume ?? 0), l, 'voice');
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
      if (hasKeys(a, 'vol')) vol *= propAt(a, 'vol', local);
      if (a.mute) vol = 0;
      this._syncEl(el, active, a.in + local, 1, vol, a, a.sfx ? 'sfx' : 'music');
      if (!active && t < a.start && a.start - t < 1.5) this._prepare(el, a.in);
    });
  }

  // ---------- çizim ----------
  env() { return { W: this.W, H: this.H, S: this.scale, exporting: this.exporting, img: (id) => this.imgForMedia(id), seg: this.seg, elFor: (it) => this.elFor(it), analyser: this.preMeter, playing: this.playing }; }

  imgForMedia(id) {
    const m = this.media.get(id);
    if (!m || m.kind !== 'image') return null;
    let img = this.imgs.get(id);
    if (!img) { img = new Image(); img.onload = () => this.requestDraw(); img.src = m.url; this.imgs.set(id, img); }
    return img;
  }

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
      const type = b.clip.trans.type;
      let done = false;
      if (type.startsWith('gl:')) done = this._glTransition(type.slice(3), a, b, p, t, env);
      if (!done) drawTransition(ctx, type.startsWith('gl:') ? 'fade' : type, p, dc(a), dc(b), env);
    } else if (act.length === 1) dc(act[0])();

    this.boxes.clear();
    P.layers.forEach((l) => {
      if (t < l.start || t >= l.end || l.hidden) return;
      if (l.kind === 'adjust' || l.kind === 'fx') { applyLayerFx(ctx, l, t, env, P.markers); return; }
      const still = !this.playing && !this.exporting && l.id === this.selectedId;
      const box = drawLayer(ctx, l, t, env, l.kind === 'media' ? this.elFor(l) : null, still);
      if (box) this.boxes.set(l.id, box);
    });
    if (!this.exporting || P.subs?.burn !== false) drawSubtitles(ctx, P.subs, t, env);
    drawFx(ctx, P.fx, t, this.duration(), env);

    if (!this.exporting) this._drawSelection(ctx, t);
  }

  // gl-transitions: iki klibi ayrı tuvallere çiz, shader ile birleştir
  _glTransition(raw, a, b, p, t, env) {
    const T = transGL();
    if (!T) return false;
    const cw = this.canvas.width, ch = this.canvas.height;
    const off = (i) => {
      this._offs = this._offs || [];
      let c = this._offs[i];
      if (!c) { c = document.createElement('canvas'); this._offs[i] = c; }
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      const x = c.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none'; x.globalCompositeOperation = 'source-over';
      x.fillStyle = this.P.fx?.bg || '#000'; x.fillRect(0, 0, cw, ch);
      x.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      return x;
    };
    const A = off(0), B = off(1);
    drawClip(A, a.clip, this.elFor(a.clip), t - a.start, a.len, env);
    drawClip(B, b.clip, this.elFor(b.clip), t - b.start, b.len, env);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const out = T.render(raw, A.canvas, B.canvas, e, cw, ch);
    if (!out) return false;
    const ctx = this.ctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(out, 0, 0); ctx.restore();
    return true;
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
    const list = this.P.layers.filter((l) => this.t >= l.start && this.t < l.end && !l.hidden && l.kind !== 'adjust' && l.kind !== 'fx').reverse();
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
      this._audioTick(1 / 60);
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
