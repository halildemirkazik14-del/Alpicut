// Alpicut — dokunmatik dostu sayı kontrolü (v1.5 güvenli kaydırıcı)
// • Değer YALNIZCA bilinçli hareketle değişir:
//   – yuvarlak tutamacın üstünden başlayıp yatay kaydırırsan, ya da
//   – çubuğun başka bir yerine ~0.4 sn basılı tutup ("hazır" titreşimi) kaydırırsan.
//   Panelde aşağı-yukarı kaydırırken, yanlışlıkla dokunurken değer değişmez.
// • Göreli sürükleme: parmağı koyduğun yerde değer zıplamaz, sadece kaydırdığın kadar değişir
// • Tutamacı basılı tutup bekletirsen "hassas mod" (4 kat yavaş)
// • Her değişiklikten sonra birkaç saniye "↶" düğmesi çıkar: dokun, önceki değere dön
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
const buzz = (ms = 6) => { try { navigator.vibrate?.(ms); } catch (_) { /* yoksay */ } };
const UNDO_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';

export function rangeControl({ min, max, step = 0.01, value, fmt, def, label, onInput, onChange }) {
  min = +min; max = +max; step = +step;
  const span = max - min || 1;
  const f = fmt || ((x) => (+x).toFixed(decimals(step)));
  let v = +(value ?? min);
  const fill = h('i', { class: 'sld-fill' });
  const thumb = h('b', { class: 'sld-thumb' });
  const bubble = h('span', { class: 'sld-bubble' });
  const hint = h('span', { class: 'sld-hint' }, 'kaydır');
  const defMark = def != null && def > min && def < max ? h('em', { class: 'sld-def', style: { left: `${((def - min) / span) * 100}%` } }) : null;
  const track = h('div', { class: 'sld', role: 'slider', 'aria-label': label || '', 'aria-valuemin': min, 'aria-valuemax': max, tabindex: '0' }, h('span', { class: 'sld-rail' }, fill, defMark), thumb, bubble, hint);
  const valBtn = h('button', { class: 'rng-val', title: 'Dokun: değer yaz · Çift dokun: sıfırla' }, f(v));
  const undoBtn = h('button', { class: 'rng-undo', html: UNDO_ICON, 'aria-label': 'Önceki değere dön', title: 'Önceki değere dön' });
  const valWrap = h('span', { class: 'rng-vw' }, undoBtn, valBtn);
  const paint = () => {
    const p = Math.max(0, Math.min(1, (v - min) / span));
    const z = def != null ? Math.max(0, Math.min(1, (def - min) / span)) : 0;
    // varsayılan değerden başlayan dolgu (ör. -1…+1 aralığında ortadan)
    const a = def != null && def > min && def < max ? Math.min(p, z) : 0, b = def != null && def > min && def < max ? Math.max(p, z) : p;
    fill.style.left = `${a * 100}%`; fill.style.width = `${(b - a) * 100}%`;
    thumb.style.left = `${p * 100}%`;
    bubble.style.left = `${p * 100}%`;
    hint.style.left = `${p * 100}%`;
    bubble.textContent = f(v);
    track.setAttribute('aria-valuenow', v);
  };
  const quant = (x) => { x = Math.max(min, Math.min(max, Math.round((x - min) / step) * step + min)); return +x.toFixed(Math.max(decimals(step), 2)); };
  const set = (x, final) => {
    v = quant(x); valBtn.textContent = f(v); paint();
    if (onInput) onInput(v);
    if (final && onChange) onChange(v);
  };
  paint();

  // --- geri al çipi ---
  let undoV = null, undoT = null;
  const offerUndo = (prev) => {
    if (prev == null || Math.abs(prev - v) < step / 2) return;
    undoV = prev;
    valWrap.classList.add('can-undo');
    clearTimeout(undoT);
    undoT = setTimeout(() => { valWrap.classList.remove('can-undo'); undoV = null; }, 6000);
  };
  undoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (undoV == null) return;
    const back = undoV; undoV = null;
    valWrap.classList.remove('can-undo'); clearTimeout(undoT);
    set(back, true); buzz(10);
  });

  // --- sürükleme ---
  let g = null;
  const thumbX = () => { const r = track.getBoundingClientRect(); return r.left + ((v - min) / span) * r.width; };
  track.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const near = Math.abs(e.clientX - thumbX()) <= 30;
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v0: v, w: track.getBoundingClientRect().width || 200, active: false, armed: near, fine: false, lastX: e.clientX, acc: v, snapped: def != null && Math.abs(v - def) < step / 2 };
    if (e.pointerType === 'mouse') g.armed = true; // fareyle doğrudan
    g.holdT = setTimeout(() => {
      if (!g || g.active) return;
      if (!g.armed) { g.armed = true; track.classList.add('armed'); buzz(14); } // uzakta basılı tut → hazır
      else { g.fine = true; track.classList.add('fine'); buzz(); } // tutamaçta basılı tut → hassas
    }, near ? 480 : 380);
  });
  track.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.active) {
      // dikey hareket: panel kaydırma — kaydırıcı devre dışı
      if (Math.abs(dy) > 6 && Math.abs(dy) * 1.2 > Math.abs(dx)) { cancel(); return; }
      if (Math.abs(dx) < 7) return;
      if (!g.armed) { cancel(); return; } // tutamaçtan başlamadı ve basılı tutulmadı: yok say
      g.active = true; clearTimeout(g.holdT); g.lastX = e.clientX;
      try { track.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ }
      track.classList.add('drag'); track.classList.remove('armed');
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
  const cancel = () => { if (!g) return; clearTimeout(g.holdT); g = null; track.classList.remove('fine', 'armed', 'drag'); };
  const end = (e) => {
    if (!g || (e && e.pointerId !== g.id)) return;
    clearTimeout(g.holdT);
    const was = g.active, v0 = g.v0;
    g = null;
    track.classList.remove('drag', 'fine', 'armed');
    if (was) { if (onChange) onChange(v); offerUndo(v0); }
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  // tutamaçtaki örtük yakalama piste devredilirken gelen 'lost' olayını yok say
  track.addEventListener('lostpointercapture', (e) => { if (e.target === track) end(e); });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { set(v + step, true); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { set(v - step, true); e.preventDefault(); }
  });

  // --- –/+ ---
  const stepper = (dir) => {
    const b = h('button', { class: 'rng-step', 'aria-label': dir > 0 ? 'Artır' : 'Azalt' }, dir > 0 ? '+' : '–');
    let timer = null, n = 0, v0 = null;
    const tick = () => { n++; const mult = n > 20 ? 10 : n > 8 ? 4 : 1; set(v + dir * step * mult, false); timer = setTimeout(tick, n === 1 ? 380 : 70); };
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; if (onChange) onChange(v); offerUndo(v0); } n = 0; };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); v0 = v; tick(); });
    b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    return b;
  };

  // --- değeri yaz / sıfırla ---
  let lastTap = 0, tapT = null;
  valBtn.addEventListener('click', () => {
    const now = performance.now();
    if (now - lastTap < 320) { lastTap = 0; clearTimeout(tapT); if (def != null) { const p0 = v; set(def, true); offerUndo(p0); buzz(); } return; }
    lastTap = now;
    tapT = setTimeout(() => {
      lastTap = 0;
      const isPct = String(f(1)).includes('%') && span <= 10;
      const inp = h('input', { class: 'rng-edit', type: 'text', inputmode: 'decimal', value: isPct ? String(Math.round(v * 100)) : String(+v.toFixed(3)) });
      valBtn.replaceWith(inp);
      inp.focus(); inp.select();
      const p0 = v;
      const done = (ok) => {
        if (!inp.isConnected) return;
        if (ok) {
          let n = parseFloat(String(inp.value).replace(',', '.').replace(/[^\d.+-]/g, ''));
          if (isPct) n /= 100;
          if (!Number.isNaN(n)) { set(n, true); offerUndo(p0); }
        }
        inp.replaceWith(valBtn);
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    }, 330);
  });

  const row = h('div', { class: 'rng' }, stepper(-1), track, stepper(1));
  return { row, val: valWrap, set, input: track };
}
