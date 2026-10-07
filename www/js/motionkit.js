// Alpicut v1.8 — motion şablonları için ortak çizim araçları (yumuşatma eğrileri, yazı, ışıma, piksel yazı tipi)
import { roundRect, clamp } from './render.js';

export { roundRect, clamp };
export const UI = 'Bricolage Grotesque';
export const SERIF = 'Source Serif 4';
export const DISPLAY = 'Playfair Display';
export const MONO = 'Roboto Mono';
export const COND = 'Bebas Neue';
export const F = (w, s, fam = UI, it = false) => `${it ? 'italic ' : ''}${w} ${s}px "${fam}", "Barlow", sans-serif`;

export const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const easeOut5 = (x) => 1 - Math.pow(1 - clamp(x), 5);
export const easeIn = (x) => Math.pow(clamp(x), 3);
export const easeIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const back = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const spring = (x) => { x = Math.max(0, x); return 1 - Math.exp(-6.5 * x) * Math.cos(10 * x); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const seg = (lt, a, b) => clamp((lt - a) / Math.max(0.0001, b - a));
export const hexA = (hx, a) => { const n = parseInt(String(hx || '#000').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
export const mixHex = (a, b, t) => {
  const p = (hx) => { const n = parseInt(String(hx).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`;
};
export const lines = (s) => String(s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
export const pairs = (s) => lines(s).map((l) => { const [a, ...b] = l.split('|'); return [a.trim(), (b.join('|') || '').trim()]; });
export const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
export const fmtN = (n) => Math.round(n).toLocaleString('tr-TR');
export const fmtK = (n) => { n = Math.round(n); if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} Mn`; if (n >= 1e4) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.', ',')} B`; return n.toLocaleString('tr-TR'); };

// harf aralıklı yazı (canvas letterSpacing her tarayıcıda yok)
export function spaced(ctx, text, x, y, sp, align = 'center') {
  const s = String(text ?? '');
  const ws = [...s].map((ch) => ctx.measureText(ch).width);
  const tw = ws.reduce((a, b) => a + b, 0) + sp * Math.max(0, s.length - 1);
  let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  const prev = ctx.textAlign; ctx.textAlign = 'left';
  [...s].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += ws[i] + sp; });
  ctx.textAlign = prev;
  return tw;
}
export function measureSpaced(ctx, text, sp) { const s = String(text ?? ''); return [...s].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + sp * Math.max(0, s.length - 1); }

export function wrap(ctx, text, maxW) {
  const out = [];
  String(text ?? '').split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).forEach((w) => { if (!w) return; const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
export function fitFont(ctx, text, maxW, size, mk) { let s = size; ctx.font = mk(s); while (s > 12 && ctx.measureText(String(text ?? '')).width > maxW) { s -= 2; ctx.font = mk(s); } return s; }

// yumuşak ışıma: aynı çizimi bulanık gölgeyle iki kez çiz
export function glow(ctx, color, blur, S, fn) {
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur * S; fn(); ctx.shadowBlur = blur * 0.4 * S; fn(); ctx.restore(); fn();
}
export function softShadow(ctx, S, blur = 40, y = 14, a = 0.35) { ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur * S; ctx.shadowOffsetY = y * S; }
export function card(ctx, x, y, w, h, r, fill, S, blur = 40) { ctx.save(); softShadow(ctx, S, blur); roundRect(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }

// film greni (deterministik)
export function grain(ctx, w, h, lt, amt = 0.08, step = 6) {
  const f = Math.floor(lt * 24);
  ctx.save();
  for (let y = -h / 2; y < h / 2; y += step) for (let x = -w / 2; x < w / 2; x += step) {
    const r = hash(x * 0.37 + y * 1.91 + f * 13.7);
    if (r > 0.82) { ctx.fillStyle = `rgba(255,255,255,${(r - 0.82) * amt * 5})`; ctx.fillRect(x, y, step * 0.6, step * 0.6); } else if (r < 0.1) { ctx.fillStyle = `rgba(0,0,0,${(0.1 - r) * amt * 8})`; ctx.fillRect(x, y, step * 0.6, step * 0.6); }
  }
  ctx.restore();
}
// tarama çizgileri
export function scanlines(ctx, w, h, a = 0.18, gap = 6) { ctx.save(); ctx.fillStyle = `rgba(0,0,0,${a})`; for (let y = -h / 2; y < h / 2; y += gap) ctx.fillRect(-w / 2, y, w, gap / 2); ctx.restore(); }
// parıltı yıldızı (4 kollu)
export function twinkle(ctx, x, y, r, color, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); ctx.restore();
}
// kısmi çizilen yol (stroke reveal) — noktalar dizisi üstünde
export function strokeReveal(ctx, pts, p) {
  if (p <= 0 || pts.length < 2) return;
  let total = 0; const L = [0];
  for (let i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(total); }
  const lim = total * clamp(p);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    if (L[i] <= lim) ctx.lineTo(pts[i][0], pts[i][1]);
    else { const f = (lim - L[i - 1]) / (L[i] - L[i - 1]); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); break; }
  }
  ctx.stroke();
}
export function circlePts(cx, cy, r, a0 = -Math.PI / 2, n = 90) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }

// ---------- 5x7 piksel yazı tipi (VHS ekran yazısı, arcade) ----------
const G = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31], M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17], Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  ':': [0, 12, 12, 0, 12, 12, 0], '.': [0, 0, 0, 0, 0, 12, 12], '-': [0, 0, 0, 31, 0, 0, 0], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4],
  '/': [1, 1, 2, 4, 8, 16, 16], '+': [0, 4, 4, 31, 4, 4, 0], '%': [24, 25, 2, 4, 8, 19, 3], '>': [16, 24, 28, 30, 28, 24, 16], '<': [1, 3, 7, 15, 7, 3, 1], ' ': [0, 0, 0, 0, 0, 0, 0],
  '#': [10, 10, 31, 10, 31, 10, 10], "'": [4, 4, 8, 0, 0, 0, 0], ',': [0, 0, 0, 0, 12, 4, 8], '&': [12, 18, 20, 8, 21, 18, 13],
};
const TR = { 'Ç': ['C', 'ced'], 'Ş': ['S', 'ced'], 'Ğ': ['G', 'brv'], 'İ': ['I', 'dot'], 'Ö': ['O', 'uml'], 'Ü': ['U', 'uml'] };
export function pixelText(ctx, text, x, y, px, color, align = 'center', gap = 1) {
  const s = String(text ?? '').toLocaleUpperCase('tr-TR');
  const cw = 5 * px + gap * px;
  const tw = s.length * cw - gap * px;
  let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  ctx.fillStyle = color;
  for (const ch of s) {
    const tr = TR[ch];
    const g = G[tr ? tr[0] : ch] || G['?'];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r] & (16 >> c)) ctx.fillRect(cx + c * px, y - 7 * px + r * px, px, px);
    if (tr) {
      if (tr[1] === 'ced') ctx.fillRect(cx + 2 * px, y + px * 0.4, px, px);
      if (tr[1] === 'dot') ctx.fillRect(cx + 2 * px, y - 9 * px, px, px);
      if (tr[1] === 'uml') { ctx.fillRect(cx + px, y - 9 * px, px, px); ctx.fillRect(cx + 3 * px, y - 9 * px, px, px); }
      if (tr[1] === 'brv') { ctx.fillRect(cx + px, y - 9.5 * px, px, px); ctx.fillRect(cx + 3 * px, y - 9.5 * px, px, px); ctx.fillRect(cx + 2 * px, y - 8.8 * px, px, px); }
    }
    cx += cw;
  }
  return tw;
}
export const pixelWidth = (text, px, gap = 1) => String(text ?? '').length * (5 * px + gap * px) - gap * px;

// basit ikonlar (marka logosu değil; genel semboller)
export function icon(ctx, name, x, y, s, color, lw = 0.11) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw * 100; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = new Path2D();
  switch (name) {
    case 'heart': P.moveTo(0, 38); P.bezierCurveTo(-60, -4, -42, -52, 0, -22); P.bezierCurveTo(42, -52, 60, -4, 0, 38); ctx.fill(P); break;
    case 'heartO': P.moveTo(0, 38); P.bezierCurveTo(-60, -4, -42, -52, 0, -22); P.bezierCurveTo(42, -52, 60, -4, 0, 38); ctx.stroke(P); break;
    case 'bell': P.moveTo(-34, 22); P.lineTo(-30, -4); P.bezierCurveTo(-28, -34, 28, -34, 30, -4); P.lineTo(34, 22); P.closePath(); ctx.fill(P); ctx.beginPath(); ctx.arc(0, 30, 9, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -36, 6, 0, Math.PI * 2); ctx.fill(); break;
    case 'bellO': P.moveTo(-34, 22); P.lineTo(-30, -4); P.bezierCurveTo(-28, -34, 28, -34, 30, -4); P.lineTo(34, 22); P.closePath(); ctx.stroke(P); ctx.beginPath(); ctx.arc(0, 32, 7, 0, Math.PI * 2); ctx.fill(); break;
    case 'comment': P.moveTo(-40, -28); P.lineTo(40, -28); P.quadraticCurveTo(46, -28, 46, -20); P.lineTo(46, 14); P.quadraticCurveTo(46, 22, 40, 22); P.lineTo(-6, 22); P.lineTo(-24, 38); P.lineTo(-22, 22); P.lineTo(-40, 22); P.quadraticCurveTo(-46, 22, -46, 14); P.lineTo(-46, -20); P.quadraticCurveTo(-46, -28, -40, -28); ctx.stroke(P); break;
    case 'share': P.moveTo(-36, 6); P.lineTo(-36, 34); P.lineTo(36, 34); P.lineTo(36, 6); ctx.stroke(P); ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -36); ctx.moveTo(-20, -16); ctx.lineTo(0, -36); ctx.lineTo(20, -16); ctx.stroke(); break;
    case 'send': P.moveTo(-40, -6); P.lineTo(42, -36); P.lineTo(12, 40); P.lineTo(0, 6); P.closePath(); ctx.stroke(P); break;
    case 'bookmark': P.moveTo(-28, -40); P.lineTo(28, -40); P.lineTo(28, 40); P.lineTo(0, 18); P.lineTo(-28, 40); P.closePath(); ctx.stroke(P); break;
    case 'bookmarkF': P.moveTo(-28, -40); P.lineTo(28, -40); P.lineTo(28, 40); P.lineTo(0, 18); P.lineTo(-28, 40); P.closePath(); ctx.fill(P); break;
    case 'check': ctx.beginPath(); ctx.moveTo(-30, 2); ctx.lineTo(-8, 24); ctx.lineTo(34, -22); ctx.stroke(); break;
    case 'plus': ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.moveTo(0, -28); ctx.lineTo(0, 28); ctx.stroke(); break;
    case 'play': ctx.beginPath(); ctx.moveTo(-22, -32); ctx.lineTo(34, 0); ctx.lineTo(-22, 32); ctx.closePath(); ctx.fill(); break;
    case 'link': ctx.beginPath(); ctx.arc(-14, 10, 18, Math.PI * 0.75, Math.PI * 1.75); ctx.stroke(); ctx.beginPath(); ctx.arc(14, -10, 18, -Math.PI * 0.25, Math.PI * 0.75); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(10, -10); ctx.stroke(); break;
    case 'sound': ctx.beginPath(); ctx.moveTo(-40, -12); ctx.lineTo(-22, -12); ctx.lineTo(0, -32); ctx.lineTo(0, 32); ctx.lineTo(-22, 12); ctx.lineTo(-40, 12); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(4, 0, 22, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(4, 0, 38, -0.8, 0.8); ctx.stroke(); break;
    case 'eye': ctx.beginPath(); ctx.moveTo(-44, 0); ctx.quadraticCurveTo(0, -40, 44, 0); ctx.quadraticCurveTo(0, 40, -44, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); break;
    case 'user': ctx.beginPath(); ctx.arc(0, -14, 18, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, 40, 36, Math.PI, 0); ctx.fill(); break;
    case 'chevup': ctx.beginPath(); ctx.moveTo(-30, 14); ctx.lineTo(0, -16); ctx.lineTo(30, 14); ctx.stroke(); break;
    case 'star': ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 18 : 42, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
    case 'thumb': P.moveTo(-40, -4); P.lineTo(-22, -4); P.lineTo(-22, 38); P.lineTo(-40, 38); P.closePath(); ctx.fill(P); { const Q = new Path2D(); Q.moveTo(-14, -4); Q.lineTo(4, -40); Q.quadraticCurveTo(16, -42, 14, -24); Q.lineTo(10, -8); Q.lineTo(34, -8); Q.quadraticCurveTo(44, -6, 40, 6); Q.lineTo(32, 32); Q.quadraticCurveTo(29, 38, 22, 38); Q.lineTo(-14, 38); Q.closePath(); ctx.fill(Q); } break;
    case 'thumbO': ctx.beginPath(); ctx.moveTo(-40, -4); ctx.lineTo(-22, -4); ctx.lineTo(-22, 38); ctx.lineTo(-40, 38); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(4, -40); ctx.quadraticCurveTo(16, -42, 14, -24); ctx.lineTo(10, -8); ctx.lineTo(34, -8); ctx.quadraticCurveTo(44, -6, 40, 6); ctx.lineTo(32, 32); ctx.quadraticCurveTo(29, 38, 22, 38); ctx.lineTo(-14, 38); ctx.closePath(); ctx.stroke(); break;
    case 'views': ctx.beginPath(); ctx.moveTo(-34, 30); ctx.lineTo(-34, 6); ctx.moveTo(-10, 30); ctx.lineTo(-10, -26); ctx.moveTo(14, 30); ctx.lineTo(14, -6); ctx.moveTo(38, 30); ctx.lineTo(38, -36); ctx.stroke(); break;
    case 'verified': ctx.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 36 : 44, a = i * Math.PI / 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-16, 2); ctx.lineTo(-4, 14); ctx.lineTo(18, -10); ctx.stroke(); break;
    case 'mic': ctx.beginPath(); ctx.moveTo(-12, -14); ctx.arc(0, -14, 12, Math.PI, 0); ctx.lineTo(12, 6); ctx.arc(0, 6, 12, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(0, 4, 26, 0.15, Math.PI - 0.15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 42); ctx.stroke(); break;
    case 'edit': ctx.beginPath(); ctx.moveTo(-30, 30); ctx.lineTo(-24, 8); ctx.lineTo(18, -34); ctx.lineTo(34, -18); ctx.lineTo(-8, 24); ctx.closePath(); ctx.stroke(); break;
    case 'repost': ctx.beginPath(); ctx.moveTo(-34, 6); ctx.lineTo(-34, -16); ctx.lineTo(28, -16); ctx.moveTo(14, -30); ctx.lineTo(28, -16); ctx.lineTo(14, -2); ctx.moveTo(34, -6); ctx.lineTo(34, 16); ctx.lineTo(-28, 16); ctx.moveTo(-14, 30); ctx.lineTo(-28, 16); ctx.lineTo(-14, 2); ctx.stroke(); break;
    case 'cursor': ctx.beginPath(); ctx.moveTo(-18, -34); ctx.lineTo(-18, 26); ctx.lineTo(-4, 12); ctx.lineTo(8, 38); ctx.lineTo(18, 34); ctx.lineTo(6, 8); ctx.lineTo(24, 8); ctx.closePath(); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke(); break;
    case 'live': ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 24, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 24, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke(); break;
    default: break;
  }
  ctx.restore();
}

// parmak dokunuşu: halka + basma (CTA'larda)
export function tapRing(ctx, x, y, p, color = '#fff') {
  if (p <= 0 || p >= 1) return;
  ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha *= 1 - p; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 20 + p * 70, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
export function cursorTap(ctx, x, y, lt, tapAt, S) {
  const inP = easeOut(seg(lt, tapAt - 0.7, tapAt - 0.15));
  if (inP <= 0) return 0;
  const press = seg(lt, tapAt - 0.05, tapAt + 0.12) * (1 - seg(lt, tapAt + 0.12, tapAt + 0.3));
  const out = seg(lt, tapAt + 0.6, tapAt + 1.1);
  ctx.save(); ctx.globalAlpha *= 1 - out;
  const cx = lerp(x + 220, x + 26, inP), cy = lerp(y + 200, y + 34, inP);
  tapRing(ctx, x + 10, y + 10, seg(lt, tapAt, tapAt + 0.55));
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14 * S; icon(ctx, 'cursor', cx, cy, 70 * (1 - press * 0.12), '#fff'); ctx.restore();
  ctx.restore();
  return lt >= tapAt ? 1 : 0;
}
