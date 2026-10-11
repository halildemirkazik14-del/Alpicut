// Alpicut v1.12 — Fırçayla düzelt: arka plan silme ve chroma key sonucunu elle temizleme
// Sil fırçası: kalan arka plan parçalarını siler. Geri getir fırçası: yanlışlıkla silinen yerleri (el, saç) geri getirir.
// Renk seç: dokunulan rengi chroma key'e ekler (en fazla 4 renk). Çizgiler kaynağa göre (0..1) saklanır → her karede geçerli.
import { app, h, toast } from './state.js';

const cache = new WeakMap(); // brush -> { sig, w, h, er, kp, out, tmp }
const sigOf = (b) => `${b.s.length}:${b.v || 0}`;

function drawStrokes(cv, strokes, mode, w, h) {
  const x = cv.getContext('2d');
  x.clearRect(0, 0, w, h);
  x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#fff'; x.fillStyle = '#fff';
  const D = Math.max(w, h);
  let any = false;
  for (const s of strokes) {
    if (s.m !== mode || !s.p.length) continue;
    any = true;
    const lw = Math.max(1, s.r * D);
    if (s.p.length === 2) { x.beginPath(); x.arc(s.p[0] * w, s.p[1] * h, lw / 2, 0, Math.PI * 2); x.fill(); continue; }
    x.lineWidth = lw; x.beginPath(); x.moveTo(s.p[0] * w, s.p[1] * h);
    for (let i = 2; i < s.p.length; i += 2) x.lineTo(s.p[i] * w, s.p[i + 1] * h);
    x.stroke();
  }
  return any;
}

// img: saydamlığı olan sonuç (kesilmiş görüntü) — srcEl: orijinal kare (geri getir için)
export function applyBrush(img, srcEl, b) {
  if (!b || !b.s?.length) return img;
  const w = img.width || img.videoWidth, h = img.height || img.videoHeight;
  if (!w || !h) return img;
  let c = cache.get(b);
  if (!c) { c = { er: document.createElement('canvas'), kp: document.createElement('canvas'), out: document.createElement('canvas'), tmp: document.createElement('canvas') }; cache.set(b, c); }
  if (c.sig !== sigOf(b) || c.w !== w || c.h !== h) {
    [c.er, c.kp, c.out, c.tmp].forEach((k) => { k.width = w; k.height = h; });
    c.hasE = drawStrokes(c.er, b.s, 'e', w, h); c.hasK = drawStrokes(c.kp, b.s, 'k', w, h);
    c.sig = sigOf(b); c.w = w; c.h = h;
  }
  const o = c.out.getContext('2d');
  o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, w, h); o.drawImage(img, 0, 0, w, h);
  if (c.hasE) { o.globalCompositeOperation = 'destination-out'; o.drawImage(c.er, 0, 0); }
  if (c.hasK && srcEl) {
    const t = c.tmp.getContext('2d');
    t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, w, h); t.drawImage(srcEl, 0, 0, w, h);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(c.kp, 0, 0);
    o.globalCompositeOperation = 'source-over'; o.drawImage(c.tmp, 0, 0);
  }
  o.globalCompositeOperation = 'source-over';
  return c.out;
}

// ---------- düzenleyici ----------
export async function openBrushEditor(o) {
  const E = app.engine;
  const el = E.elFor(o);
  const sw = el?.videoWidth || el?.naturalWidth || el?.width, sh = el?.videoHeight || el?.naturalHeight || el?.height;
  if (!el || !sw) { toast('Önce oynatıcıyı bu öğenin üstüne getir'); return; }
  E.pause?.(); app.pause?.();
  if (!o.brush) o.brush = { s: [], v: 0 };
  const B = o.brush;
  const st = { mode: 'e', size: 0.04, cur: null };
  const k = Math.min(1, 1100 / Math.max(sw, sh));
  const W = Math.round(sw * k), H = Math.round(sh * k);
  const cv = h('canvas', { class: 'br-cv', width: W, height: H });
  const ctx = cv.getContext('2d');
  const frame = document.createElement('canvas'); frame.width = W; frame.height = H; frame.getContext('2d').drawImage(el, 0, 0, W, H);
  const { gradeParams, gradeSource } = await import('./gl.js');
  let seg = null; try { if (o.bgr?.on) { seg = await import('./seg.js'); await seg.initSegmenter(o.bgr.target === 'object' ? 'object' : o.bgr.quality === 'hq' ? 'hq' : 'person'); } } catch (_) { seg = null; }
  const checker = (() => { const p = document.createElement('canvas'); p.width = p.height = 24; const x = p.getContext('2d'); x.fillStyle = '#2a2a33'; x.fillRect(0, 0, 24, 24); x.fillStyle = '#3a3a46'; x.fillRect(0, 0, 12, 12); x.fillRect(12, 12, 12, 12); return ctx.createPattern(p, 'repeat'); })();
  let base = null;
  const computeBase = () => {
    let img = frame;
    const gp = gradeParams(o);
    if (gp) { const g = gradeSource(frame, W, H, gp, Math.max(W, H)); if (g && g !== frame) { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; c2.getContext('2d').drawImage(g, 0, 0, W, H); img = c2; } }
    if (o.bgr?.on && seg) {
      const mk = E.maskFor ? E.maskFor(o, el.currentTime, o.bgr, 1) : null;
      const cut = seg.removeBackground(img, W, H, { ...o.bgr, _t: el.currentTime, _mask: mk }, Math.max(W, H));
      if (cut) { const c3 = document.createElement('canvas'); c3.width = W; c3.height = H; c3.getContext('2d').drawImage(cut, 0, 0, W, H); img = c3; }
    }
    base = img;
  };
  const paint = () => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = checker; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(applyBrush(base, frame, B), 0, 0, W, H);
    if (st.cur) { ctx.strokeStyle = st.mode === 'e' ? 'rgba(255,80,80,.9)' : 'rgba(80,255,140,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(st.cur[0] * W, st.cur[1] * H, st.size * Math.max(W, H) / 2, 0, Math.PI * 2); ctx.stroke(); }
  };
  computeBase(); paint();
  let raf = 0; const repaint = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
  // dokunma
  let drawing = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const p = pos(e); st.cur = p;
    if (st.mode === 'c') {
      const d = frame.getContext('2d').getImageData(Math.floor(p[0] * (W - 1)), Math.floor(p[1] * (H - 1)), 1, 1).data;
      const hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      if (!o.key) o.key = { on: true, color: hex, tol: 0.12, soft: 0.08, spill: 0.5, colors: [] };
      else if (!o.key.on) { o.key.on = true; o.key.color = hex; o.key.colors = []; }
      else { o.key.colors = [...(o.key.colors || []), hex].slice(-3); }
      toast(`Renk eklendi: ${hex}`); computeBase(); repaint(); return;
    }
    drawing = { m: st.mode, r: st.size, p: [p[0], p[1]] };
    B.s.push(drawing); B.v = (B.v || 0) + 1; repaint();
  });
  cv.addEventListener('pointermove', (e) => {
    const p = pos(e); st.cur = p;
    if (drawing) { const q = drawing.p; const lx = q[q.length - 2], ly = q[q.length - 1]; if (Math.hypot(p[0] - lx, p[1] - ly) > 0.004) { q.push(p[0], p[1]); B.v++; } }
    repaint();
  });
  const end = () => { drawing = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const modeBtn = (m, label) => h('button', { class: `chip${st.mode === m ? ' on' : ''}`, 'data-m': m, onclick: (e) => { st.mode = m; e.currentTarget.parentElement.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x.dataset.m === m)); } }, label);
  const size = h('input', { type: 'range', min: '0.01', max: '0.15', step: '0.005', value: String(st.size) });
  size.addEventListener('input', () => { st.size = +size.value; repaint(); });
  const ov = h('div', { class: 'br-ov' },
    h('div', { class: 'br-top' }, h('b', {}, 'Fırçayla düzelt'), h('small', {}, 'Parmağınla boya: kalan arka planı sil, yanlış silinen yeri geri getir')),
    h('div', { class: 'br-stage' }, cv),
    h('div', { class: 'br-tools' },
      h('div', { class: 'chips' }, modeBtn('e', '🧽 Sil'), modeBtn('k', '🖌️ Geri getir'), modeBtn('c', '🎯 Renk seç')),
      h('label', { class: 'br-size' }, 'Fırça', size),
      h('div', { class: 'ec-row' },
        h('button', { class: 'btn', onclick: () => { B.s.pop(); B.v++; repaint(); } }, '↶ Geri'),
        h('button', { class: 'btn', onclick: () => { B.s.length = 0; B.v++; repaint(); } }, 'Temizle'),
        h('button', { class: 'btn primary', onclick: () => { ov.remove(); app.change(true); import('./sheets.js').then((m) => m.refreshSheet()).catch(() => {}); E.requestDraw(); toast('Düzeltme uygulandı — tüm karelerde geçerli'); } }, 'Bitti'))));
  document.body.append(ov);
}
