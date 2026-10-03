// Alpicut — modern keyframe arayüzü: eğri seçici (küçük önizlemeli), özel bezier düzenleyici, grafik görünümü
import { h, app } from './state.js';
import { EASES, easeFn, evalTrack } from './kf.js';
import { star } from './favs.js';

const COLORS = ['#A78BFA', '#22D3EE', '#FACC15', '#F472B6', '#34D399', '#FB923C', '#60A5FA', '#F87171'];

function curveThumb(id, bz, w = 56, hh = 40) {
  const c = h('canvas', { width: w * 2, height: hh * 2, class: 'curve-th' });
  const x = c.getContext('2d');
  x.scale(2, 2);
  const pad = 6, W = w - pad * 2, H = hh - pad * 2;
  x.strokeStyle = 'rgba(128,128,128,.35)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(pad, pad + H); x.lineTo(pad + W, pad); x.stroke();
  x.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-2').trim() || '#A78BFA';
  x.lineWidth = 2; x.beginPath();
  for (let i = 0; i <= 40; i++) {
    const p = i / 40;
    let v;
    if (id === 'auto') v = p * p * (3 - 2 * p);
    else v = easeFn(id, p, { bz });
    const X = pad + p * W, Y = pad + H - v * H * 0.8 - H * 0.1;
    if (i) x.lineTo(X, Y); else x.moveTo(X, Y);
  }
  x.stroke();
  return c;
}

// eğri seçici: here = [{k}] bu zamandaki keyframe nesneleri
export function curvePicker(keysHere, onChange) {
  const cur = keysHere[0]?.ease || 'inout';
  const wrap = h('div', { class: 'curve-pick' });
  const grid = h('div', { class: 'curve-grid' });
  EASES.forEach(([id, lbl]) => {
    const b = h('button', { class: `curve-opt${cur === id ? ' on' : ''}` }, curveThumb(id, keysHere[0]?.bz), h('span', {}, lbl));
    b.addEventListener('click', () => {
      keysHere.forEach((k) => { k.ease = id; if (id === 'bez' && !k.bz) k.bz = [0.42, 0, 0.58, 1]; });
      onChange(true);
    });
    grid.append(b);
  });
  wrap.append(grid);
  if (cur === 'bez') wrap.append(bezierEditor(keysHere, onChange));
  return wrap;
}

const BZ_PRESETS = [['Yumuşak', [0.42, 0, 0.58, 1]], ['Hızlı başla', [0.16, 1, 0.3, 1]], ['Yavaş başla', [0.7, 0, 0.84, 0]], ['Sinematik', [0.83, 0, 0.17, 1]], ['Esnek', [0.34, 1.56, 0.64, 1]], ['Vuruş', [0.9, 0, 0.1, 1]]];

export function bezierEditor(keysHere, onChange) {
  const k0 = keysHere[0];
  const bz = (k0.bz || [0.42, 0, 0.58, 1]).slice();
  const S = 220;
  const cv = h('canvas', { width: S * 2, height: S * 2, class: 'bz-cv' });
  const x = cv.getContext('2d');
  const pad = 30, W = S - pad * 2;
  const toXY = (px, py) => [pad + px * W, pad + (1 - py) * W];
  const draw = () => {
    x.setTransform(2, 0, 0, 2, 0, 0);
    x.clearRect(0, 0, S, S);
    const css = getComputedStyle(document.documentElement);
    x.fillStyle = css.getPropertyValue('--surface-2').trim(); x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(128,128,128,.25)'; x.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const g = pad + (W * i) / 4; x.beginPath(); x.moveTo(g, pad); x.lineTo(g, pad + W); x.moveTo(pad, g); x.lineTo(pad + W, g); x.stroke(); }
    const [ax, ay] = toXY(0, 0), [bx, by] = toXY(1, 1), [c1x, c1y] = toXY(bz[0], bz[1]), [c2x, c2y] = toXY(bz[2], bz[3]);
    x.strokeStyle = css.getPropertyValue('--muted').trim(); x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(ax, ay); x.lineTo(c1x, c1y); x.moveTo(bx, by); x.lineTo(c2x, c2y); x.stroke();
    x.strokeStyle = css.getPropertyValue('--primary-2').trim(); x.lineWidth = 3;
    x.beginPath(); x.moveTo(ax, ay); x.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by); x.stroke();
    [[c1x, c1y], [c2x, c2y]].forEach(([px, py]) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); x.fillStyle = css.getPropertyValue('--primary').trim(); x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); });
  };
  draw();
  let drag = -1;
  const pos = (e) => { const r = cv.getBoundingClientRect(); const sx = S / r.width; return [((e.clientX - r.left) * sx - pad) / W, 1 - ((e.clientY - r.top) * sx - pad) / W]; };
  cv.addEventListener('pointerdown', (e) => {
    const [px, py] = pos(e);
    const d1 = Math.hypot(px - bz[0], py - bz[1]), d2 = Math.hypot(px - bz[2], py - bz[3]);
    drag = d1 < d2 ? 0 : 1;
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => {
    if (drag < 0) return;
    const [px, py] = pos(e);
    bz[drag * 2] = Math.max(0, Math.min(1, +px.toFixed(3)));
    bz[drag * 2 + 1] = Math.max(-0.6, Math.min(1.6, +py.toFixed(3)));
    keysHere.forEach((k) => { k.bz = bz.slice(); });
    draw();
    onChange(false);
  });
  const up = () => { if (drag >= 0) { drag = -1; onChange(true); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const pre = h('div', { class: 'chips scroll' });
  BZ_PRESETS.forEach(([n, b]) => pre.append(h('button', { onclick: () => { keysHere.forEach((k) => { k.bz = b.slice(); }); onChange(true); } }, n)));
  const id = `bz:${bz.join(',')}`;
  return h('div', { class: 'bz-wrap' }, h('div', { class: 'bz-top' }, h('span', { class: 'hint', style: { margin: 0 } }, 'Tutamaçları sürükle'), star('curve', id, { name: `Eğri ${bz.map((v) => v.toFixed(2)).join(' ')}`, bz: bz.slice() })), cv, pre);
}

// grafik görünümü: tüm izlerin değer eğrileri, keyframe noktaları sürüklenebilir
export function graphView(o, props, lt, len, { onSeek, onChange }) {
  const tracks = props.filter(([p]) => o.kf?.[p]?.length);
  const wrap = h('div', { class: 'graph-wrap' });
  if (!tracks.length) { wrap.append(h('p', { class: 'hint' }, 'Grafik için önce en az bir keyframe ekle.')); return wrap; }
  const W = 600, H = 220, pad = 14;
  const cv = h('canvas', { width: W, height: H, class: 'graph-cv' });
  const x = cv.getContext('2d');
  const span = Math.max(len, ...tracks.flatMap(([p]) => o.kf[p].map((k) => k.t)), 0.5);
  const tx = (t) => pad + (t / span) * (W - pad * 2);
  const ty = (v, mn, mx) => H - pad - ((v - mn) / Math.max(1e-6, mx - mn)) * (H - pad * 2);
  const range = (p, mn, mx) => { const vs = o.kf[p].map((k) => k.v); let a = Math.min(...vs), b = Math.max(...vs); if (b - a < (mx - mn) * 0.05) { const m = (a + b) / 2; a = m - (mx - mn) * 0.1; b = m + (mx - mn) * 0.1; } const e = (b - a) * 0.15; return [a - e, b + e]; };
  let sel = null; // {p, i}
  const draw = () => {
    const css = getComputedStyle(document.documentElement);
    x.clearRect(0, 0, W, H);
    x.fillStyle = css.getPropertyValue('--surface-2').trim(); x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(128,128,128,.18)'; x.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const yy = (H * i) / 4; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
    tracks.forEach(([p, , mn, mx], ti) => {
      const [a, b] = range(p, mn, mx);
      x.strokeStyle = COLORS[ti % COLORS.length]; x.lineWidth = 2.5;
      x.beginPath();
      for (let i = 0; i <= 120; i++) { const t = (span * i) / 120; const v = evalTrack(o.kf[p], t); const X = tx(t), Y = ty(v, a, b); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); }
      x.stroke();
      o.kf[p].forEach((k, i) => {
        const X = tx(k.t), Y = ty(k.v, a, b);
        x.save(); x.translate(X, Y); x.rotate(Math.PI / 4);
        x.fillStyle = sel && sel.p === p && sel.i === i ? '#fff' : COLORS[ti % COLORS.length];
        x.fillRect(-6, -6, 12, 12); x.strokeStyle = '#000'; x.lineWidth = 1.5; x.strokeRect(-6, -6, 12, 12);
        x.restore();
      });
    });
    x.strokeStyle = css.getPropertyValue('--text').trim(); x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(tx(lt), 0); x.lineTo(tx(lt), H); x.stroke();
  };
  draw();
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)]; };
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    const [X, Y] = pt(e);
    let best = null;
    tracks.forEach(([p, , mn, mx]) => { const [a, b] = range(p, mn, mx); o.kf[p].forEach((k, i) => { const d = Math.hypot(tx(k.t) - X, ty(k.v, a, b) - Y); if (d < 26 && (!best || d < best.d)) best = { p, i, d, a, b, mn, mx }; }); });
    if (best) { sel = best; drag = { ...best, X0: X, Y0: Y, t0: o.kf[best.p][best.i].t, v0: o.kf[best.p][best.i].v, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ } e.preventDefault(); draw(); }
    else { const t = Math.max(0, Math.min(span, ((X - pad) / (W - pad * 2)) * span)); onSeek(t); }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [X, Y] = pt(e);
    if (!drag.moved && Math.hypot(X - drag.X0, Y - drag.Y0) < 5) return;
    drag.moved = true;
    const arr = o.kf[drag.p];
    const k = arr[drag.i];
    const lo = drag.i > 0 ? arr[drag.i - 1].t + 1 / 30 : 0, hi = drag.i < arr.length - 1 ? arr[drag.i + 1].t - 1 / 30 : span;
    k.t = Math.max(lo, Math.min(hi, drag.t0 + ((X - drag.X0) / (W - pad * 2)) * span));
    k.v = Math.max(drag.mn, Math.min(drag.mx, drag.v0 - ((Y - drag.Y0) / (H - pad * 2)) * (drag.b - drag.a)));
    draw();
    onChange(false);
  });
  const up = () => { if (drag) { const m = drag.moved; drag = null; if (m) onChange(true); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const legend = h('div', { class: 'graph-leg' });
  tracks.forEach(([p, label], ti) => legend.append(h('span', {}, h('i', { style: { background: COLORS[ti % COLORS.length] } }), label)));
  wrap.append(cv, legend, h('p', { class: 'hint' }, 'Noktayı yukarı/aşağı sürükle: değer · sağa/sola: zaman · boş yere dokun: o ana git'));
  void app;
  return wrap;
}
