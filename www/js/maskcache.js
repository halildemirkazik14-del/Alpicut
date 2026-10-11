// Alpicut v1.11 — arka plan silme önbelleği (CapCut yaklaşımı)
// Arka plan silme açılınca klip BİR KEZ baştan sona işlenir: her karenin kişi/nesne olasılık maskesi
// küçük, gri tonlu bir videoya yazılır (uygulamanın özel diskine). Oynatma sırasında yapay zekâ modeli
// hiç çalışmaz; yalnızca hazır maske karesi okunup videoya uygulanır → donmasız önizleme.
// Eşik / kenar yumuşaklığı oynatmada uygulanır (yeniden işlemeye gerek yok).
import { app } from './state.js';
import { waitIdle } from './bgwork.js';
import { diskTarget, persistFile } from './opfs.js';
import { store } from './storage.js';

const FPS = 15, LONG = 512, WORK = 320;
export const maskState = new Map(); // key -> {p, done, err}
const files = new Map();            // key -> File
const players = new Map();          // key -> {el, url, cv, ctx, lastT, lastKey}
const listeners = new Set();
export const onMask = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (k, p) => listeners.forEach((f) => { try { f(k, p); } catch (_) { /* yoksay */ } });
const queue = [];
let running = false;

const r3 = (x) => (x == null ? '' : (+x).toFixed(3));
export function maskKey(o, m) {
  const b = o.bgr || {};
  const a = o.in || 0, z = o.out ?? m?.duration ?? 0;
  return [m?.id, r3(a), r3(z), b.target || 'person', b.quality || 'hq', r3(b.smooth ?? 0.35), r3(b.point?.x), r3(b.point?.y)].join('|');
}
const fname = (key) => `mask-${Array.from(key).reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7).toString(36).replace('-', 'n')}.mp4`;

// projede açık olan tüm arka plan silmeleri için önbelleği hazırla / yükle
export async function ensureMasks() {
  const P = app.P; if (!P) return;
  const objs = [...P.clips, ...P.layers].filter((o) => o.bgr?.on && o.mediaId);
  for (const o of objs) {
    const m = app.engine.media.get(o.mediaId);
    if (!m || m.kind !== 'video') continue;
    const key = maskKey(o, m);
    if (files.has(key) || maskState.get(key)?.p != null) continue;
    // daha önce üretilmiş mi?
    const nm = m.masks?.[key];
    if (nm) { const f = await persistFile(nm); if (f) { files.set(key, f); maskState.set(key, { p: 1, done: true }); emit(key, 1); continue; } }
    maskState.set(key, { p: 0 });
    queue.push({ o, m, key });
    emit(key, 0);
  }
  if (!running && queue.length) pump();
}

async function pump() {
  running = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      const f = await build(job);
      if (f) {
        files.set(job.key, f);
        maskState.set(job.key, { p: 1, done: true });
        job.m.masks = { ...(job.m.masks || {}), [job.key]: fname(job.key) };
        try { const rec = await store.getMedia(job.m.id); if (rec) { rec.masks = job.m.masks; await store.putMedia(rec); } } catch (_) { /* yoksay */ }
        app.engine.requestDraw();
      } else maskState.set(job.key, { err: 'olmadı' });
    } catch (e) { console.warn('maske önbelleği üretilemedi', e); maskState.set(job.key, { err: e.message || String(e) }); }
    emit(job.key, 1);
  }
  running = false;
}

async function pickCodec(MB, W, H) {
  for (const c of ['avc', 'vp9']) { try { if (await MB.canEncodeVideo(c, { width: W, height: H, bitrate: 6e5 })) return c; } catch (_) { /* sıradaki */ } }
  return null;
}

async function build({ o, m, key }) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return null;
  const seg = await import('./seg.js');
  const b = o.bgr;
  await seg.initSegmenter(b.target === 'object' ? 'object' : (b.quality === 'hq' ? 'hq' : 'person'));
  const MB = await import('./lib/mediabunny.js');
  const src = m.proxyBlob || m.blob;
  const input = new MB.Input({ source: new MB.BlobSource(src), formats: MB.ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt || !(await vt.canDecode())) return null;
    const dw = await vt.getDisplayWidth(), dh = await vt.getDisplayHeight();
    const k = Math.min(1, LONG / Math.max(dw, dh));
    const W = Math.max(2, Math.round(dw * k / 2) * 2), H = Math.max(2, Math.round(dh * k / 2) * 2);
    const kw = Math.min(1, WORK / Math.max(W, H));
    const ww = Math.max(16, Math.round(W * kw / 2) * 2), wh = Math.max(16, Math.round(H * kw / 2) * 2);
    const codec = await pickCodec(MB, ww, wh);
    if (!codec) return null;
    const first = (await vt.getFirstTimestamp().catch(() => 0)) || 0;
    const a = Math.max(0, o.in || 0), z = Math.min((await vt.computeDuration().catch(() => m.duration)) || m.duration, o.out ?? m.duration);
    const ts = []; for (let t = a; t < z; t += 1 / FPS) ts.push(first + t);
    if (!ts.length) return null;
    const disk = await diskTarget(MB, fname(key), { folder: 'alpicut-media' });
    const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: disk ? false : 'in-memory' }), target: disk ? disk.target : new MB.BufferTarget() });
    const vsrc = new MB.VideoSampleSource({ codec, bitrate: 6e5, keyFrameInterval: 1 });
    output.addVideoTrack(vsrc, { frameRate: FPS });
    await output.start();
    const sink = new MB.CanvasSink(vt, { width: W, height: H, fit: 'fill', poolSize: 2 });
    const enc = document.createElement('canvas'); enc.width = ww; enc.height = wh;
    const ex = enc.getContext('2d');
    const img = ex.createImageData(ww, wh);
    const keyObj = {}; // zamansal yumuşatma bu iş boyunca sürsün
    let i = 0;
    for await (const r of sink.canvasesAtTimestamps(ts)) {
      const t = ts[i] - first;
      if (r?.canvas) {
        seg.personMask(r.canvas, W, H, { ...b, _t: t, _key: keyObj, wantQ: true, _work: Math.max(ww, wh) });
        const q = seg.lastQ(keyObj);
        if (q && q.length === ww * wh) { for (let p = 0, j = 0; p < q.length; p++, j += 4) { const v = q[p] * 255; img.data[j] = img.data[j + 1] = img.data[j + 2] = v; img.data[j + 3] = 255; } }
        else img.data.fill(0);
        ex.putImageData(img, 0, 0);
      }
      const fr = new VideoFrame(enc, { timestamp: Math.round((t - a) * 1e6), duration: Math.round(1e6 / FPS) });
      const smp = new MB.VideoSample(fr);
      try { await vsrc.add(smp); } finally { smp.close(); }
      i++;
      maskState.set(key, { p: i / ts.length }); if (i % 3 === 0) emit(key, i / ts.length);
      if (i % 4 === 0) { await new Promise((res) => setTimeout(res, 0)); await waitIdle(); }
    }
    vsrc.close();
    await output.finalize();
    if (disk) return disk.file();
    return new File([output.target.buffer], fname(key), { type: 'video/mp4' });
  } finally { try { input.dispose(); } catch (_) { /* yoksay */ } }
}

// Oynatma: hazır maskeyi kaynak zamanına (srcT) göre döndür. Hazır değilse null (canlı yola düşülür).
export function cachedMask(o, m, srcT, opt, playing, rate = 1) {
  const key = maskKey(o, m);
  const f = files.get(key);
  if (!f) { if (!maskState.has(key) && !cachedMask._kick) { cachedMask._kick = setTimeout(() => { cachedMask._kick = 0; ensureMasks(); }, 300); } return null; }
  let p = players.get(key);
  if (!p) {
    const el = document.createElement('video');
    el.muted = true; el.playsInline = true; el.preload = 'auto';
    const url = URL.createObjectURL(f); el.src = url;
    el.addEventListener('seeked', () => app.engine.requestDraw());
    el.addEventListener('loadeddata', () => app.engine.requestDraw());
    const cv = document.createElement('canvas');
    p = { el, url, cv, ctx: cv.getContext('2d', { willReadFrequently: true }), out: document.createElement('canvas'), lastKey: '' };
    players.set(key, p);
  }
  const el = p.el, local = srcT - (o.in || 0);
  if (el.readyState >= 1) {
    if (playing) {
      if (Math.abs(el.playbackRate - rate) > 0.01) el.playbackRate = rate;
      if (el.paused) el.play().catch(() => {});
      if (!el.seeking && Math.abs(el.currentTime - local) > 0.25) el.currentTime = Math.max(0, local);
    } else {
      if (!el.paused) el.pause();
      if (!el.seeking && Math.abs(el.currentTime - local) > 0.5 / FPS) el.currentTime = Math.max(0, local);
    }
  }
  if (el.readyState < 2) return p.lastKey ? p.out : null;
  const w = el.videoWidth, h = el.videoHeight;
  if (!w || !h) return null;
  // eşik + kenar → alfa (yalnızca kare ya da ayar değişince)
  const th = opt.threshold ?? 0.5, soft = Math.max(0.02, (opt.edge ?? 0.15) * 0.8);
  const k2 = `${el.currentTime.toFixed(3)}|${th}|${soft}`;
  if (k2 === p.lastKey) return p.out;
  if (p.cv.width !== w || p.cv.height !== h) { p.cv.width = w; p.cv.height = h; p.out.width = w; p.out.height = h; }
  p.ctx.drawImage(el, 0, 0, w, h);
  const d = p.ctx.getImageData(0, 0, w, h);
  const px = d.data, lo = th - soft, inv = 1 / (2 * soft);
  for (let j = 0; j < px.length; j += 4) {
    let a = (px[j] / 255 - lo) * inv; a = a < 0 ? 0 : a > 1 ? 1 : a * a * (3 - 2 * a);
    px[j] = px[j + 1] = px[j + 2] = 255; px[j + 3] = a * 255;
  }
  p.out.getContext('2d').putImageData(d, 0, 0);
  p.lastKey = k2;
  return p.out;
}

export function maskBusy() { return [...maskState.values()].filter((s) => !s.done && !s.err); }
export function dropMasks() { for (const p of players.values()) { try { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); URL.revokeObjectURL(p.url); } catch (_) { /* yoksay */ } } players.clear(); }
