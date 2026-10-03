// Alpicut — dokunmatik dostu sayı kontrolü (v1.4)
// • Göreli sürükleme: parmağı koyduğun yerde değer ZIPLAMAZ, sadece kaydırdığın kadar değişir
// • Dikey kaydırma paneli kaydırır, yatay kaydırma değeri değiştirir (yanlışlıkla değişmez)
// • Parmağı yarım saniye bekletip kaydırırsan "hassas mod" (4 kat yavaş)
// • Varsayılan değerde hafif titreşimle yapışır • –/+ basılı tutunca hızlanır
// • Değere dokun: klavyeyle yaz • Çift dokun: varsayılana dön
import { h } from './state.js';

const ONE = /(contrast|sat|saturate|brightness|zoom|speed|volume|opacity|scale|\.s$|^s$|sc$|amount|mix|lineH|w$)/;

export function guessDefault(path, min, max) {
  if (path && ONE.test(path) && min <= 1 && max >= 1) return 1;
  if (min <= 0 && max >= 0) return 0;
  return min;
}

function decimals(step) {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
}
const buzz = () => { try { navigator.vibrate?.(6); } catch (_) { /* yoksay */ } };

export function rangeControl({ min, max, step = 0.01, value, fmt, def, label, onInput, onChange }) {
  min = +min; max = +max; step = +step;
  const span = max - min || 1;
  const f = fmt || ((x) => (+x).toFixed(decimals(step)));
  let v = +(value ?? min);
  const fill = h('i', { class: 'sld-fill' });
  const thumb = h('b', { class: 'sld-thumb' });
  const bubble = h('span', { class: 'sld-bubble' });
  const defMark = def != null && def > min && def < max ? h('em', { class: 'sld-def', style: { left: `${((def - min) / span) * 100}%` } }) : null;
  const track = h('div', { class: 'sld', role: 'slider', 'aria-label': label || '', 'aria-valuemin': min, 'aria-valuemax': max, tabindex: '0' }, h('span', { class: 'sld-rail' }, fill, defMark), thumb, bubble);
  const val = h('button', { class: 'rng-val', title: 'Dokun: değer yaz · Çift dokun: sıfırla' }, f(v));
  const paint = () => {
    const p = Math.max(0, Math.min(1, (v - min) / span));
    const z = def != null ? Math.max(0, Math.min(1, (def - min) / span)) : 0;
    // varsayılan değerden başlayan dolgu (ör. -1…+1 aralığında ortadan)
    const a = def != null && def > min && def < max ? Math.min(p, z) : 0, b = def != null && def > min && def < max ? Math.max(p, z) : p;
    fill.style.left = `${a * 100}%`; fill.style.width = `${(b - a) * 100}%`;
    thumb.style.left = `${p * 100}%`;
    bubble.style.left = `${p * 100}%`;
    bubble.textContent = f(v);
    track.setAttribute('aria-valuenow', v);
  };
  const quant = (x) => { x = Math.max(min, Math.min(max, Math.round((x - min) / step) * step + min)); return +x.toFixed(Math.max(decimals(step), 2)); };
  const set = (x, final) => {
    v = quant(x); val.textContent = f(v); paint();
    if (onInput) onInput(v);
    if (final && onChange) onChange(v);
  };
  paint();

  // --- sürükleme ---
  let g = null;
  track.addEventListener('pointerdown', (e) => {
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v0: v, w: track.getBoundingClientRect().width || 200, t0: performance.now(), active: false, fine: false, lastX: e.clientX, acc: v, snapped: def != null && Math.abs(v - def) < step / 2 };
    g.holdT = setTimeout(() => { if (g && !g.active) { g.fine = true; track.classList.add('fine'); buzz(); } }, 480);
  });
  track.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.active) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(g.holdT); g = null; track.classList.remove('fine'); return; } // panel kaydırma
      if (Math.abs(dx) < 6) return;
      g.active = true; clearTimeout(g.holdT); g.lastX = e.clientX;
      try { track.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ }
      track.classList.add('drag');
    }
    e.preventDefault();
    const k = g.fine ? 0.25 : 1;
    g.acc += ((e.clientX - g.lastX) / g.w) * span * k;
    g.lastX = e.clientX;
    let nv = g.acc;
    // varsayılana yapış
    if (def != null && Math.abs(nv - def) < span * 0.02) {
      if (!g.snapped) { buzz(); g.snapped = true; }
      nv = def;
    } else g.snapped = false;
    set(nv, false);
  });
  const end = (e) => {
    if (!g || (e && e.pointerId !== g.id)) return;
    clearTimeout(g.holdT);
    const was = g.active;
    g = null;
    track.classList.remove('drag', 'fine');
    if (was && onChange) onChange(v);
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('lostpointercapture', end);
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { set(v + step, true); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { set(v - step, true); e.preventDefault(); }
  });

  // --- –/+ ---
  const stepper = (dir) => {
    const b = h('button', { class: 'rng-step', 'aria-label': dir > 0 ? 'Artır' : 'Azalt' }, dir > 0 ? '+' : '–');
    let timer = null, n = 0;
    const tick = () => { n++; const mult = n > 20 ? 10 : n > 8 ? 4 : 1; set(v + dir * step * mult, false); timer = setTimeout(tick, n === 1 ? 380 : 70); };
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; if (onChange) onChange(v); } n = 0; };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); tick(); });
    b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    return b;
  };

  // --- değeri yaz / sıfırla ---
  let lastTap = 0, tapT = null;
  val.addEventListener('click', () => {
    const now = performance.now();
    if (now - lastTap < 320) { lastTap = 0; clearTimeout(tapT); if (def != null) { set(def, true); buzz(); } return; }
    lastTap = now;
    tapT = setTimeout(() => {
      lastTap = 0;
      const isPct = String(f(1)).includes('%') && span <= 10;
      const inp = h('input', { class: 'rng-edit', type: 'text', inputmode: 'decimal', value: isPct ? String(Math.round(v * 100)) : String(+v.toFixed(3)) });
      val.replaceWith(inp);
      inp.focus(); inp.select();
      const done = (ok) => {
        if (!inp.isConnected) return;
        if (ok) {
          let n = parseFloat(String(inp.value).replace(',', '.').replace(/[^\d.+-]/g, ''));
          if (isPct) n /= 100;
          if (!Number.isNaN(n)) set(n, true);
        }
        inp.replaceWith(val);
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    }, 330);
  });

  const row = h('div', { class: 'rng' }, stepper(-1), track, stepper(1));
  return { row, val, set, input: track };
}
