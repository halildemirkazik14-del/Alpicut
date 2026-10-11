// Alpicut v1.11 — performans göstergesi (Ayarlar → Performans göstergesi)
// Oynatma sırasında: ekran kare hızı, çizim süresi, telefonun düşürdüğü video kareleri ve bellek.
// Amaç: "kasıyor" hissini ölçülebilir yapmak — Halil'in telefonunda ekran görüntüsüyle karşılaştırırız.
import { lsGet, lsSet } from './storage.js';

export const perfOn = () => lsGet('alpicut.perf', '0') === '1';
export const setPerf = (v) => { lsSet('alpicut.perf', v ? '1' : '0'); if (v) startPerf(); else stopPerf(); };

let el = null, raf = 0, engine = null, frames = [], draws = [], last = 0;
export function attachPerf(eng) {
  engine = eng;
  const orig = eng.draw.bind(eng);
  eng.draw = function (...a) { const t0 = performance.now(); const r = orig(...a); draws.push(performance.now() - t0); if (draws.length > 120) draws.shift(); return r; };
  if (perfOn()) startPerf();
}
function dropped() {
  let d = 0, tot = 0;
  for (const v of engine?.els?.values?.() || []) { try { const q = v.getVideoPlaybackQuality?.(); if (q) { d += q.droppedVideoFrames; tot += q.totalVideoFrames; } } catch (_) { /* yoksay */ } }
  return { d, tot };
}
function tick(now) {
  raf = requestAnimationFrame(tick);
  if (last) frames.push(now - last); last = now;
  if (frames.length > 120) frames.shift();
  if (!el || (tick.n = (tick.n || 0) + 1) % 15) return;
  const avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
  const worst = Math.max(0, ...frames);
  const dr = draws.length ? draws.reduce((a, b) => a + b, 0) / draws.length : 0;
  const drMax = draws.length ? Math.max(...draws) : 0;
  const q = dropped();
  const mem = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)}/${Math.round(performance.memory.jsHeapSizeLimit / 1048576)} MB` : '—';
  const fps = avg ? 1000 / avg : 0;
  el.innerHTML = `<b style="color:${fps >= 50 ? '#4ADE80' : fps >= 28 ? '#FACC15' : '#F87171'}">${fps.toFixed(0)} fps</b> · en kötü ${worst.toFixed(0)} ms<br>çizim ${dr.toFixed(1)} / ${drMax.toFixed(0)} ms<br>düşen kare ${q.d}/${q.tot}<br>bellek ${mem}${engine?.playing ? ' · ▶' : ''}`;
}
export function startPerf() {
  if (el) return;
  el = document.createElement('div');
  el.id = 'perfHud';
  el.style.cssText = 'position:fixed;left:8px;top:calc(env(safe-area-inset-top,0px) + 56px);z-index:9999;background:rgba(0,0,0,.72);color:#fff;font:600 11px/1.35 ui-monospace,monospace;padding:6px 8px;border-radius:8px;pointer-events:none';
  document.body.appendChild(el);
  frames = []; last = 0; raf = requestAnimationFrame(tick);
}
export function stopPerf() { cancelAnimationFrame(raf); el?.remove(); el = null; }
