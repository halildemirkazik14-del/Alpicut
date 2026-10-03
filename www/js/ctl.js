// Alpicut — dokunmatik dostu sayı kontrolü: büyük kaydırıcı, –/+ (basılı tutunca hızlanır),
// değere dokunup elle yazma, çift dokunuşla varsayılana dönme
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

export function rangeControl({ min, max, step = 0.01, value, fmt, def, label, onInput, onChange }) {
  min = +min; max = +max; step = +step;
  const f = fmt || ((x) => (+x).toFixed(decimals(step)));
  let v = +(value ?? min);
  const inp = h('input', { type: 'range', min, max, step, value: v, 'aria-label': label || '' });
  const val = h('button', { class: 'rng-val', title: 'Dokun: değer yaz · Çift dokun: sıfırla' }, f(v));
  const fill = () => inp.style.setProperty('--p', `${((v - min) / (max - min || 1)) * 100}%`);
  const set = (x, final) => {
    x = Math.max(min, Math.min(max, Math.round(x / step) * step));
    x = +x.toFixed(Math.max(decimals(step), 2));
    v = x; inp.value = x; val.textContent = f(x); fill();
    if (onInput) onInput(x);
    if (final && onChange) onChange(x);
  };
  fill();
  inp.addEventListener('input', () => { v = parseFloat(inp.value); val.textContent = f(v); fill(); if (onInput) onInput(v); });
  inp.addEventListener('change', () => { if (onChange) onChange(parseFloat(inp.value)); });
  // –/+ : bir adım; basılı tutunca hızlanarak devam
  const stepper = (dir) => {
    const b = h('button', { class: 'rng-step', 'aria-label': dir > 0 ? 'Artır' : 'Azalt' }, dir > 0 ? '+' : '–');
    let timer = null, n = 0;
    const tick = () => { n++; const mult = n > 20 ? 10 : n > 8 ? 4 : 1; set(v + dir * step * mult, false); timer = setTimeout(tick, n === 1 ? 380 : 70); };
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; if (onChange) onChange(v); } n = 0; };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); tick(); });
    b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    return b;
  };
  let lastTap = 0;
  val.addEventListener('click', () => {
    const now = performance.now();
    if (now - lastTap < 320) { lastTap = 0; if (def != null) set(def, true); return; }
    lastTap = now;
    setTimeout(() => {
      if (!lastTap || performance.now() - lastTap < 300) return;
      lastTap = 0;
      const isPct = String(f(1)).includes('%');
      const r = prompt(`${label || 'Değer'} (${f(min)} … ${f(max)})${isPct ? ' — yüzde olarak yaz' : ''}`, isPct ? String(Math.round(v * 100)) : String(+v.toFixed(3)));
      if (r == null) return;
      let n = parseFloat(String(r).replace(',', '.').replace(/[^\d.+-]/g, ''));
      if (isPct) n /= 100;
      if (!Number.isNaN(n)) set(n, true);
    }, 330);
  });
  const row = h('div', { class: 'rng' }, stepper(-1), inp, stepper(1));
  return { row, val, set, input: inp };
}
