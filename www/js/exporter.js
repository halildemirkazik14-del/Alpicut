// Alpicut — v1.5 kare kare dışa aktarma (FilmCraft yaklaşımı)
// Eski yöntem videoyu oynatıp ekranı kaydediyordu: telefon bir an yavaşlarsa kare atlıyor, ses kayıyordu.
// Yeni yöntem her kareyi tek tek, gerçek zamandan bağımsız üretir:
//   • Kaynak videolar WebCodecs ile sırayla çözülür (doğru kare, arama yok)
//   • Her kare tuvale çizilir ve donanım kodlayıcıya verilir (H.264/HEVC, olmazsa VP9/AV1)
//   • Ses ayrıca, kayıpsız ve senkron karıştırılır (mixdown.js) → AAC (olmazsa Opus)
//   • Sonuç her cihazda aynı, kare atlamasız MP4
import * as MB from './lib/mediabunny.js';
import { layoutClips, curvePts, curveSrc, flatLayers, projectDuration } from './engine.js';
import { mixdown, fakeAnalyser } from './mixdown.js';

export function offlineSupported() {
  return typeof window.VideoEncoder === 'function' && typeof window.VideoDecoder === 'function' && typeof window.AudioEncoder === 'function' && typeof window.VideoFrame === 'function';
}

// her video öğesi için: hangi kareden hangi kareye etkin, her karede kaynak zamanı
function videoItems(engine, P, fps, N) {
  const items = [];
  const mdur = (id) => engine.media.get(id)?.duration || 1e9;
  layoutClips(P.clips).forEach((L) => {
    const c = L.clip;
    const m = engine.media.get(c.mediaId);
    if (!m || m.kind !== 'video' || c.type === 'image') return;
    const f0 = Math.max(0, Math.ceil(L.start * fps - 1e-6)), f1 = Math.min(N - 1, Math.ceil(L.end * fps - 1e-6) - 1);
    if (f1 < f0) return;
    const at = (t) => {
      const local = t - L.start;
      if (c.freeze) return c.freezeAt;
      if (curvePts(c)) return curveSrc(c, local, L.len);
      return c.in + local * (c.speed || 1);
    };
    items.push({ item: c, m, f0, f1, at, max: mdur(c.mediaId) });
  });
  flatLayers(P).forEach((l) => {
    if (l.kind !== 'media' || l.hidden) return;
    const m = engine.media.get(l.mediaId);
    if (!m || m.kind !== 'video') return;
    const f0 = Math.max(0, Math.ceil(l.start * fps - 1e-6)), f1 = Math.min(N - 1, Math.ceil(l.end * fps - 1e-6) - 1);
    if (f1 < f0) return;
    const srcLen = Math.max(0.1, (l.out ?? m.duration ?? 1) - (l.in || 0));
    const at = (t) => { const local = t - l.start; return (l.in || 0) + (l.loop ? local % srcLen : Math.min(local, srcLen - 0.05)); };
    items.push({ item: l, m, f0, f1, at, max: mdur(l.mediaId) });
  });
  return items;
}

// Kaynak video kare sağlayıcısı: önce WebCodecs (mediabunny), olmazsa <video> ile ara-bekle
class FrameFeed {
  constructor(v, fps) { this.v = v; this.fps = fps; this.canvas = null; this.it = null; this.input = null; this.el = null; this.mode = null; }

  async open() {
    const { v } = this;
    try {
      this.input = new MB.Input({ source: new MB.BlobSource(v.m.blob), formats: MB.ALL_FORMATS });
      const vt = await this.input.getPrimaryVideoTrack();
      if (!vt || !(await vt.canDecode())) throw new Error('çözülemiyor');
      const first = await vt.getFirstTimestamp().catch(() => 0) || 0;
      const dw = vt.displayWidth, dh = vt.displayHeight;
      const k = Math.min(1, 1920 / Math.max(dw, dh));
      const sink = new MB.CanvasSink(vt, { width: Math.round(dw * k / 2) * 2, height: Math.round(dh * k / 2) * 2, fit: 'fill', poolSize: 2 });
      const ts = [];
      for (let f = v.f0; f <= v.f1; f++) ts.push(Math.max(0, Math.min(v.max - 0.001, v.at(f / this.fps))) + first);
      this.it = sink.canvasesAtTimestamps(ts);
      this.mode = 'codec';
      return;
    } catch (_) {
      try { this.input?.dispose(); } catch (__) { /* yoksay */ }
      this.input = null; this.it = null;
    }
    // yedek: video öğesiyle ara-bekle
    const el = document.createElement('video');
    el.muted = true; el.playsInline = true; el.preload = 'auto'; el.src = v.m.url;
    await new Promise((res) => { el.onloadeddata = res; el.onerror = res; setTimeout(res, 8000); });
    this.el = el; this.mode = 'seek';
    this.canvas = document.createElement('canvas');
  }

  async frame(f) {
    if (this.mode === 'codec') {
      const r = await this.it.next();
      if (r.value && r.value.canvas) this.canvas = r.value.canvas;
      return this.canvas;
    }
    const el = this.el;
    if (!el || !el.videoWidth) return null;
    const t = Math.max(0, Math.min((el.duration || 1e9) - 0.01, this.v.at(f / this.fps)));
    if (Math.abs(el.currentTime - t) > 0.002 || el.readyState < 2) {
      await new Promise((res) => {
        let done = false;
        const fin = () => { if (done) return; done = true; res(); };
        el.addEventListener('seeked', () => { if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(() => fin()); else fin(); setTimeout(fin, 120); }, { once: true });
        el.currentTime = t;
        setTimeout(fin, 3000);
      });
    }
    const c = this.canvas;
    const k = Math.min(1, 1920 / Math.max(el.videoWidth, el.videoHeight));
    const w = Math.round(el.videoWidth * k), h = Math.round(el.videoHeight * k);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.getContext('2d').drawImage(el, 0, 0, w, h);
    return c;
  }

  async close() {
    try { await this.it?.return(); } catch (_) { /* yoksay */ }
    try { this.input?.dispose(); } catch (_) { /* yoksay */ }
    if (this.el) { try { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); } catch (_) { /* yoksay */ } }
    this.it = null; this.input = null; this.el = null;
  }
}

async function pickVideoCodec(w, h, bitrate) {
  const list = ['avc', 'hevc', 'vp9', 'av1'];
  try { const c = await MB.getFirstEncodableVideoCodec(list, { width: w, height: h, bitrate }); if (c) return c; } catch (_) { /* yoksay */ }
  return null;
}
async function pickAudioCodec(br) {
  try { const c = await MB.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000, bitrate: br }); if (c) return c; } catch (_) { /* yoksay */ }
  return null;
}

// Ön kontrol: bu cihaz bu çözünürlükte kare kare dışa aktarabilir mi?
export async function canOffline(w, h, bitrate) {
  if (!offlineSupported()) return false;
  return !!(await pickVideoCodec(w, h, bitrate));
}

export async function exportOffline(engine, { res = 1, fps = 30, bitrate = 10e6, abr = 192000, onProgress, onStage, shouldCancel } = {}) {
  const P = engine.P;
  const dur = projectDuration(P);
  const N = Math.max(1, Math.round(dur * fps));
  const oldScale = engine.scale;
  const W = Math.round((engine.W * res) / 2) * 2, H = Math.round((engine.H * res) / 2) * 2;
  const vcodec = await pickVideoCodec(W, H, bitrate);
  if (!vcodec) throw new Error('NO_VIDEO_CODEC');
  const acodec = await pickAudioCodec(abr);
  let output = null;
  const feeds = new Map();
  const imgs = [];
  const stage = (s) => onStage?.(s);
  engine.playing = false;
  engine.offline = true;
  engine.exporting = true;
  try {
    // görseller tam yüklensin
    for (const [, m] of engine.media) {
      if (m.kind !== 'image') continue;
      const img = engine.imgForMedia(m.id);
      if (img) imgs.push(img.decode ? img.decode().catch(() => {}) : Promise.resolve());
    }
    await Promise.all(imgs);

    // 1) ses
    stage('Ses karıştırılıyor…');
    let mix = null;
    try { mix = await mixdown(engine, P, dur, { sampleRate: 48000, shouldCancel, onProgress: (p) => onProgress?.(p * 0.12) }); } catch (e) { console.warn('ses karışımı başarısız', e); }
    if (shouldCancel?.()) return null;

    // 2) çıktı
    engine.resize(res);
    const canvas = engine.canvas;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
    const vsrc = new MB.CanvasSource(canvas, { codec: vcodec, quality: new MB.Quality({ bitrate }), keyFrameInterval: 2, latencyMode: 'quality' });
    output.addVideoTrack(vsrc, { frameRate: fps });
    let asrc = null;
    if (acodec && mix) { asrc = new MB.AudioBufferSource({ codec: acodec, quality: new MB.Quality({ bitrate: abr }) }); output.addAudioTrack(asrc); }
    await output.start();

    if (asrc && mix) {
      stage('Ses kodlanıyor…');
      const step = 48000 * 2; // 2 sn'lik parçalar
      for (let o = 0; o < mix.length; o += step) {
        const n = Math.min(step, mix.length - o);
        const b = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: 48000 });
        b.copyToChannel(mix.getChannelData(0).subarray(o, o + n), 0);
        b.copyToChannel((mix.numberOfChannels > 1 ? mix.getChannelData(1) : mix.getChannelData(0)).subarray(o, o + n), 1);
        await asrc.add(b);
        if (shouldCancel?.()) { await output.cancel(); return null; }
      }
      asrc.close();
    }
    engine.offAnalyser = mix ? fakeAnalyser(mix) : null;

    // 3) kareler
    stage('Kareler oluşturuluyor…');
    const items = videoItems(engine, P, fps, N);
    const cur = new Map(); // öğe id -> tuval
    engine.frameFor = (it) => cur.get(it.id) || null;
    for (let f = 0; f < N; f++) {
      if (shouldCancel?.()) { await output.cancel(); return null; }
      const t = f / fps;
      for (const v of items) {
        if (f < v.f0 || f > v.f1) continue;
        let feed = feeds.get(v);
        if (!feed) { feed = new FrameFeed(v, fps); await feed.open(); feeds.set(v, feed); }
        const c = await feed.frame(f);
        if (c) cur.set(v.item.id, c);
        if (f === v.f1) { await feed.close(); feeds.delete(v); }
      }
      engine.offAnalyser?.setTime(t);
      if (f === 0) engine._smK = null;
      if (!engine.holdSkip(t)) engine.draw(t);
      await vsrc.add(t, 1 / fps);
      onProgress?.(0.12 + 0.86 * ((f + 1) / N));
    }
    vsrc.close();
    stage('Dosya tamamlanıyor…');
    await output.finalize();
    onProgress?.(1);
    const buf = output.target.buffer;
    return { blob: new Blob([buf], { type: 'video/mp4' }), ext: 'mp4', codec: vcodec, audio: acodec, frames: N };
  } catch (e) {
    try { if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel(); } catch (_) { /* yoksay */ }
    throw e;
  } finally {
    for (const f of feeds.values()) await f.close();
    engine.frameFor = null;
    engine.offAnalyser = null;
    engine.offline = false;
    engine.exporting = false;
    engine.resize(oldScale);
    engine.requestDraw();
  }
}
