// Alpicut v1.6 — proxy (hafif önizleme kopyası)
// Ağır videolar (yüksek çözünürlük, uzun, seyrek anahtar kare) için telefonda düşük çözünürlüklü,
// sık anahtar kareli bir kopya üretilir. Önizleme ve zaman çizelgesinde bu kopya oynar (akıcı, hızlı arama),
// dışa aktarmada her zaman ORİJİNAL dosya kullanılır — kalite kaybı yok.
import { lsGet, lsSet, store } from './storage.js';

export const proxyMode = () => lsGet('alpicut.proxy', 'auto'); // auto | always | off
export const setProxyMode = (v) => lsSet('alpicut.proxy', v);

// Bu video proxy gerektiriyor mu?
export function needsProxy(m) {
  if (!m || m.kind !== 'video' || !m.blob) return false;
  const mode = proxyMode();
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  const long = Math.max(m.width || 0, m.height || 0);
  const mbps = m.duration ? (m.blob.size * 8) / m.duration / 1e6 : 0;
  return long > 1300 || mbps > 9 || (m.duration || 0) > 90;
}

const queue = [];
let running = false;
const listeners = new Set();
export const onProxyChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const proxyState = new Map(); // mediaId -> {p: 0..1, done, err}

export function queueProxy(m) {
  if (!needsProxy(m) || m.proxyBlob || proxyState.has(m.id)) return;
  proxyState.set(m.id, { p: 0 });
  queue.push(m);
  if (!running) pump();
}

async function pump() {
  running = true;
  while (queue.length) {
    const m = queue.shift();
    try {
      const blob = await makeProxy(m, (p) => { proxyState.set(m.id, { p }); listeners.forEach((f) => f(m, p)); });
      if (blob) {
        m.proxyBlob = blob;
        m.purl = URL.createObjectURL(blob);
        proxyState.set(m.id, { p: 1, done: true });
        // kalıcı: proje yeniden açılınca tekrar üretilmesin
        try { const rec = await store.getMedia(m.id); if (rec) { rec.proxyBlob = blob; await store.putMedia(rec); } } catch (_) { /* yoksay */ }
      } else proxyState.set(m.id, { err: 'desteklenmiyor' });
    } catch (e) {
      console.warn('proxy üretilemedi', e);
      proxyState.set(m.id, { err: e.message || String(e) });
    }
    listeners.forEach((f) => f(m, 1));
  }
  running = false;
}

// Kısa kenar 540 px, 0,5 sn'de bir anahtar kare (kaydırırken anında kare), orta kalite
export async function makeProxy(m, onProgress) {
  if (typeof VideoEncoder === 'undefined') return null;
  const MB = await import('./lib/mediabunny.js');
  const input = new MB.Input({ source: new MB.BlobSource(m.blob), formats: MB.ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) return null;
    const w = await vt.getDisplayWidth(), h = await vt.getDisplayHeight();
    const short = Math.min(w, h);
    const k = short > 540 ? 540 / short : 1;
    const even = (v) => Math.max(2, Math.round(v / 2) * 2);
    const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
    const conv = await MB.Conversion.init({
      input, output,
      video: { width: even(w * k), height: even(h * k), fit: 'fill', keyFrameInterval: 0.5, bitrate: MB.QUALITY_MEDIUM, forceTranscode: true },
      audio: { forceTranscode: false },
    });
    if (!conv.isValid) return null;
    conv.onProgress = (p) => onProgress?.(p);
    await conv.execute();
    const buf = output.target.buffer;
    return buf ? new Blob([buf], { type: 'video/mp4' }) : null;
  } finally { try { input.dispose(); } catch (_) { /* yoksay */ } }
}
