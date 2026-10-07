// Alpicut v1.7 — anlık kaydırma önizlemesi
// Zaman çizelgesini parmakla kaydırırken ya da geri alırken telefonun asıl videoda kareyi araması zaman alır.
// Bu modül her videodan küçük önizleme kareleri (saniyede 1–5 kare, ~160 px) çıkarır; arama sürerken
// en yakın kare anında gösterilir, asıl kare gelince net görüntüye geçilir.
import { waitIdle } from './bgwork.js';
import { proxyPending } from './proxy.js';
const caches = new Map(); // mediaId -> { step, frames: ImageBitmap[]|canvas[] }
const queue = [];
let busy = false;
const MAX_FRAMES = 240;

export function scrubFrame(mediaId, t) {
  const c = caches.get(mediaId);
  if (!c || !c.frames.length) return null;
  const i = Math.max(0, Math.min(c.frames.length - 1, Math.round(t / c.step)));
  // henüz çıkarılmamış kare: en yakın dolu kareye bak
  for (let d = 0; d < 6; d++) { const a = c.frames[i - d] || c.frames[i + d]; if (a) return a; }
  return null;
}

export function queueScrub(m) {
  if (!m || m.kind !== 'video' || caches.has(m.id) || queue.includes(m)) return;
  queue.push(m);
  if (!busy) setTimeout(pump, 2500);
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const m = queue.shift();
    try { await build(m); } catch (e) { console.warn('kaydırma önizlemesi oluşturulamadı', e); }
  }
  busy = false;
}

async function build(m) {
  if (typeof VideoDecoder === 'undefined') return;
  // v1.10: hafif kopya üretiliyorsa onu bekle — ağır orijinali ikinci kez çözmeyelim
  for (let i = 0; i < 1200 && proxyPending(m.id); i++) await new Promise((r) => setTimeout(r, 500));
  await waitIdle();
  const MB = await import('./lib/mediabunny.js');
  const blob = m.proxyBlob || m.blob;
  const input = new MB.Input({ source: new MB.BlobSource(blob), formats: MB.ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt || !(await vt.canDecode())) return;
    const dur = (await vt.computeDuration().catch(() => m.duration)) || m.duration || 10;
    const first = (await vt.getFirstTimestamp().catch(() => 0)) || 0;
    const step = Math.max(0.2, dur / MAX_FRAMES, dur <= 60 ? 0.2 : dur <= 180 ? 0.5 : 1);
    const n = Math.min(MAX_FRAMES, Math.ceil(dur / step) + 1);
    const w = vt.displayWidth, h = vt.displayHeight;
    const k = 160 / Math.min(w, h);
    const sink = new MB.CanvasSink(vt, { width: Math.round(w * k / 2) * 2, height: Math.round(h * k / 2) * 2, fit: 'fill', poolSize: 2 });
    const entry = { step, frames: new Array(n) };
    caches.set(m.id, entry);
    const ts = []; for (let i = 0; i < n; i++) ts.push(first + Math.min(dur - 0.01, i * step));
    let i = 0;
    for await (const r of sink.canvasesAtTimestamps(ts)) {
      if (r?.canvas) {
        const c = document.createElement('canvas'); c.width = r.canvas.width; c.height = r.canvas.height;
        c.getContext('2d').drawImage(r.canvas, 0, 0);
        entry.frames[i] = c;
      }
      i++;
      if (i % 10 === 0) { await new Promise((res) => setTimeout(res, 0)); await waitIdle(); } // arayüzü kilitleme, oynatmaya öncelik
    }
  } finally { try { input.dispose(); } catch (_) { /* yoksay */ } }
}

export function dropScrub(mediaId) { caches.delete(mediaId); }
