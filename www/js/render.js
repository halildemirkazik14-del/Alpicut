// Alpicut — çizim fonksiyonları (klip, katman, yazı, CTA, skor, altyazı, efektler)
import { scrubFrame } from './scrubcache.js';
import { filterString } from './presets.js';
import { layerAt, clipAt } from './kf.js';
import { gradeParams, gradeSource } from './gl.js';
import { drawSticker } from './fxlib.js';
import { drawSocial } from './social.js';

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x) => x * x * x;
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeOutBounce = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

export function hexA(color, a) {
  if (a >= 1 || !color || color[0] !== '#') return color;
  let c = color.slice(1);
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  if (Array.isArray(r)) {
    // v1.6: köşe başına yarıçap [sol üst, sağ üst, sağ alt, sol alt]
    const m = Math.max(0, Math.min(w / 2, h / 2));
    const [a, b2, c, d] = [0, 1, 2, 3].map((i) => Math.max(0, Math.min(r[i] ?? r[0] ?? 0, m)));
    ctx.beginPath();
    ctx.moveTo(x + a, y);
    ctx.arcTo(x + w, y, x + w, y + h, b2);
    ctx.arcTo(x + w, y + h, x, y + h, c);
    ctx.arcTo(x, y + h, x, y, d);
    ctx.arcTo(x, y, x + w, y, a);
    ctx.closePath();
    return;
  }
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Animasyon durumu ----------
export function animState(L, t, W, H) {
  const s = { alpha: 1, tx: 0, ty: 0, sc: 1, rot: 0, blur: 0, reveal: 1, glow: 0, out: 0, lt: Math.max(0, t - L.start), sx: 1, sy: 1 };
  const a = L.anim || {};
  const dur = Math.max(0.05, L.end - L.start);
  const local = t - L.start;
  const inD = Math.min(a.inDur ?? 0.45, dur * 0.7);
  const outD = Math.min(a.outDur ?? 0.35, dur * 0.4);
  const pin = inD > 0 ? clamp(local / inD) : 1;
  const pout = outD > 0 ? clamp((L.end - t) / outD) : 1;
  const e = easeOutCubic(pin);
  switch (a.in) {
    case 'fade': s.alpha *= e; break;
    case 'pop': s.sc *= Math.max(0, easeOutBack(pin)); s.alpha *= clamp(pin * 3); break;
    case 'slideUp': s.ty += (1 - e) * H * 0.15; s.alpha *= e; break;
    case 'slideDown': s.ty -= (1 - e) * H * 0.15; s.alpha *= e; break;
    case 'slideLeft': s.tx += (1 - e) * W * 0.7; s.alpha *= clamp(pin * 2); break;
    case 'slideRight': s.tx -= (1 - e) * W * 0.7; s.alpha *= clamp(pin * 2); break;
    case 'zoomIn': s.sc *= 0.3 + 0.7 * e; s.alpha *= e; break;
    case 'zoomOut': s.sc *= 2 - e; s.alpha *= e; break;
    case 'spin': s.rot -= (1 - e) * Math.PI; s.sc *= e; break;
    case 'bounce': s.ty -= (1 - easeOutBounce(pin)) * H * 0.3; s.alpha *= clamp(pin * 4); break;
    case 'blur': s.blur += (1 - e) * 30; s.alpha *= e; break;
    case 'typewriter': case 'words': s.reveal = pin; break;
    case 'stamp': s.sc *= 1 + (1 - e) * 1.6; s.alpha *= clamp(pin * 3); if (pin >= 1 && local - inD < 0.18) { s.tx += Math.sin(local * 90) * 6; } break;
    case 'elastic': { const p = pin; const el = p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI) / 3) + 1; s.sc *= el; break; }
    case 'swingIn': s.rot -= (1 - easeOutBack(pin)) * 0.9; s.alpha *= e; break;
    case 'flipX': s.sy = Math.max(0.001, e); s.alpha *= clamp(pin * 2); break;
    case 'flipY': s.sx = Math.max(0.001, e); s.alpha *= clamp(pin * 2); break;
    case 'zoomBlur': s.sc *= 1.6 - 0.6 * e; s.blur += (1 - e) * 24; s.alpha *= e; break;
    case 'rollIn': s.tx -= (1 - e) * W * 0.6; s.rot -= (1 - e) * Math.PI * 1.5; s.alpha *= e; break;
    case 'glitchWhole': s.alpha *= pin < 1 ? (Math.sin(local * 80) > -0.2 ? 1 : 0.2) : 1; s.tx += pin < 1 ? Math.sin(local * 120) * 18 * (1 - pin) : 0; break;
    case 'slideUpMask': s.ty += (1 - e) * L.size * 1.2; s.alpha *= clamp(pin * 1.5); break;
    default: if (LETTER_IN.has(a.in)) s.reveal = pin;
  }
  const q = easeInCubic(1 - pout);
  switch (a.out) {
    case 'fade': s.alpha *= 1 - q; break;
    case 'pop': s.sc *= Math.max(0, 1 - q); break;
    case 'slideDown': s.ty += q * H * 0.15; s.alpha *= 1 - q; break;
    case 'slideUp': s.ty -= q * H * 0.15; s.alpha *= 1 - q; break;
    case 'slideLeft': s.tx -= q * W * 0.7; break;
    case 'slideRight': s.tx += q * W * 0.7; break;
    case 'zoomOut': s.sc *= 1 - q * 0.7; s.alpha *= 1 - q; break;
    case 'zoomIn': s.sc *= 1 + q * 0.8; s.alpha *= 1 - q; break;
    case 'blur': s.blur += q * 30; s.alpha *= 1 - q; break;
    case 'flipX': s.sy *= Math.max(0.001, 1 - q); break;
    case 'spinOut': s.rot += q * Math.PI; s.sc *= 1 - q; break;
    case 'zoomBlur': s.sc *= 1 + q * 0.6; s.blur += q * 24; s.alpha *= 1 - q; break;
    default: if (LETTER_OUT.has(a.out)) s.out = 1 - pout;
  }
  const lt = Math.max(0, local);
  switch (a.loop) {
    case 'pulse': s.sc *= 1 + 0.06 * Math.sin(lt * Math.PI * 3); break;
    case 'float': s.ty += Math.sin(lt * Math.PI) * 14; break;
    case 'shake': s.tx += Math.sin(lt * 61) * 6; s.rot += Math.sin(lt * 47) * 0.012; break;
    case 'wiggle': s.rot += Math.sin(lt * Math.PI * 2.4) * 0.07; break;
    case 'glow': s.glow = 0.5 + 0.5 * Math.sin(lt * Math.PI * 2); break;
    case 'heartbeat': { const ph = (lt * 1.2) % 1; s.sc *= 1 + 0.08 * (Math.exp(-ph * 14) + 0.6 * Math.exp(-Math.abs(ph - 0.22) * 14)); break; }
    case 'jelly': s.sx *= 1 + Math.sin(lt * 7) * 0.06; s.sy *= 1 - Math.sin(lt * 7) * 0.06; break;
    case 'flickerLoop': s.alpha *= Math.sin(lt * 37) > 0.85 ? 0.35 : 1; break;
    case 'spin': s.rot += lt * Math.PI; break;
    case 'swingLoop': s.rot += Math.sin(lt * 3) * 0.12; break;
  }
  return s;
}

// ---------- Medya çizimi ----------
export function mediaSize(el) {
  if (!el) return [0, 0];
  if (el.tagName === 'CANVAS') return [el.width, el.height];
  if (el.videoWidth) return [el.videoWidth, el.videoHeight];
  return [el.naturalWidth || el.width || 0, el.naturalHeight || el.height || 0];
}
export function isReady(el) {
  if (!el) return false;
  if (el.tagName === 'CANVAS') return el.width > 0;
  if (el.tagName === 'VIDEO') return el.readyState >= 2 && el.videoWidth > 0;
  return el.complete !== false && (el.naturalWidth || el.width) > 0;
}

// cover/contain ile kutuya çiz
export function drawFit(ctx, el, x, y, w, h, fit = 'cover', zoom = 1, panX = 0, panY = 0) {
  const [sw, sh] = mediaSize(el);
  if (!sw || !sh) return;
  const sr = sw / sh, dr = w / h;
  let dw, dh;
  if ((fit === 'cover') === (sr > dr)) { dh = h; dw = h * sr; } else { dw = w; dh = w / sr; }
  dw *= zoom; dh *= zoom;
  const dx = x + (w - dw) / 2 + panX * Math.max(0, (dw - w) / 2) * (fit === 'cover' ? 1 : 0) + (fit === 'contain' ? panX * w * 0.5 : 0);
  const dy = y + (h - dh) / 2 + panY * Math.max(0, (dh - h) / 2) * (fit === 'cover' ? 1 : 0) + (fit === 'contain' ? panY * h * 0.5 : 0);
  ctx.drawImage(el, dx, dy, dw, dh);
}

// Videonun son hazır karesi: arama sırasında boş (siyah) kare çizilmesin
const lastFrames = new WeakMap();
function stableSource(el) {
  if (!el || el.tagName !== 'VIDEO') return el;
  const ready = el.readyState >= 2 && el.videoWidth > 0 && !el.seeking;
  let c = lastFrames.get(el);
  if (ready) {
    if (!c) { c = document.createElement('canvas'); lastFrames.set(el, c); }
    const k = Math.min(1, 1280 / Math.max(el.videoWidth, el.videoHeight));
    const w = Math.round(el.videoWidth * k), h = Math.round(el.videoHeight * k);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c._t = el.currentTime;
    c._dirty = true;
    return el;
  }
  return c && c._ok ? c : el;
}
function rememberFrame(el) {
  const c = el && el.tagName === 'VIDEO' ? lastFrames.get(el) : null;
  if (c && c._dirty) { try { c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); c._ok = true; } catch (_) { /* yoksay */ } c._dirty = false; }
}

export function drawClip(ctx, clip, el, localT, len, env) {
  const { W, H, S } = env;
  let orig = el;
  // v1.7: kaydırırken asıl kare gelene kadar küçük önizleme karesi anında gösterilir
  if (orig && orig.tagName === 'VIDEO' && !env.exporting && orig._tgt != null && (orig.seeking || orig.readyState < 2 || Math.abs(orig.currentTime - orig._tgt) > 0.06)) {
    const fr = scrubFrame(orig._mid, orig._tgt);
    if (fr) { el = fr; orig = null; }
  }
  if (orig) el = stableSource(el);
  // v1.5: duraklatılmışken de son hazır kare saklanır — zaman çizelgesinde kaydırırken önizleme kararmaz
  if (el !== orig) { /* son kare kullanılıyor */ } else if (!isReady(el)) return; else rememberFrame(el);
  const raw = el;
  const gp = gradeParams(clip);
  if (gp) { const [sw, sh] = mediaSize(el); el = gradeSource(el, sw, sh, gp, env.exporting ? 1920 : 1280); }
  if ((clip.bgr?.on && env.seg) || (clip.mask && clip.mask.type && clip.mask.type !== 'none')) {
    return drawClipComposite(ctx, clip, el, raw, localT, len, env);
  }
  const fit = clip.fit || 'cover';
  const kv = clipAt(clip, localT);
  let zoom = kv.zoom || 1;
  if (clip.kenburns) zoom *= 1 + 0.15 * clamp(localT / Math.max(0.1, len));
  if (fit === 'contain' && clip.bgMode === 'blur') {
    ctx.save();
    ctx.filter = `blur(${40 * S}px) brightness(0.7)`;
    drawFit(ctx, el, -40, -40, W + 80, H + 80, 'cover');
    ctx.restore();
  } else if (fit === 'contain' && clip.bgMode === 'color') {
    ctx.fillStyle = clip.bgColor || '#000';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save();
  const fs = filterString(clip.filters, S);
  if (fs !== 'none') ctx.filter = fs;
  drawFit(ctx, el, 0, 0, W, H, fit, zoom, kv.panX || 0, kv.panY || 0);
  ctx.restore();
}

// Arka plan silme / maske uygulanmış klip: ekran dışı tuvalde birleştir
let clipOff = null;
function drawClipComposite(ctx, clip, el, raw, localT, len, env) {
  const { W, H, S } = env;
  const cw = Math.max(2, Math.round(W * S)), ch = Math.max(2, Math.round(H * S));
  if (!clipOff) clipOff = document.createElement('canvas');
  if (clipOff.width !== cw || clipOff.height !== ch) { clipOff.width = cw; clipOff.height = ch; }
  const o = clipOff.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.filter = 'none'; o.globalAlpha = 1;
  o.clearRect(0, 0, cw, ch);
  o.setTransform(S, 0, 0, S, 0, 0);
  const kv = clipAt(clip, localT);
  let zoom = kv.zoom || 1;
  if (clip.kenburns) zoom *= 1 + 0.15 * clamp(localT / Math.max(0.1, len));
  const fit = clip.fit || 'cover';
  let src = el;
  const b = clip.bgr;
  if (b?.on && env.seg) {
    const [sw, sh] = mediaSize(el);
    const cut = env.seg.removeBackground(el, sw, sh, { ...b, _t: localT }, env.exporting ? 1920 : 960);
    if (cut) {
      if (b.mode === 'blur') { o.save(); o.filter = `blur(${(b.blur || 30) * S}px)`; drawFit(o, raw, -40, -40, W + 80, H + 80, 'cover'); o.restore(); }
      else if (b.mode === 'color') { o.fillStyle = b.color || '#00B140'; o.fillRect(0, 0, W, H); }
      src = cut;
    }
  } else if (fit === 'contain' && clip.bgMode === 'blur') {
    o.save(); o.filter = `blur(${40 * S}px) brightness(0.7)`; drawFit(o, el, -40, -40, W + 80, H + 80, 'cover'); o.restore();
  }
  o.save();
  const fs = filterString(clip.filters, S);
  if (fs !== 'none') o.filter = fs;
  drawFit(o, src, 0, 0, W, H, fit, zoom, kv.panX || 0, kv.panY || 0);
  o.restore();
  const m = clip.mask;
  if (m && m.type && m.type !== 'none') applyMask(o, m, cw, ch, S);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(clipOff, 0, 0); ctx.restore();
}

// ---------- Geçişler ----------
// drawA / drawB: (ctx) => void
export function drawTransition(ctx, type, p, drawA, drawB, env) {
  const { W, H, S } = env;
  const e = easeOutCubic(p);
  const withAlpha = (a, fn) => { ctx.save(); ctx.globalAlpha *= a; fn(); ctx.restore(); };
  switch (type) {
    case 'fade': drawA(); withAlpha(p, drawB); break;
    case 'black':
      if (p < 0.5) { drawA(); ctx.fillStyle = `rgba(0,0,0,${p * 2})`; ctx.fillRect(0, 0, W, H); }
      else { drawB(); ctx.fillStyle = `rgba(0,0,0,${(1 - p) * 2})`; ctx.fillRect(0, 0, W, H); }
      break;
    case 'flash':
      (p < 0.5 ? drawA : drawB)();
      ctx.fillStyle = `rgba(255,255,255,${1 - Math.abs(p - 0.5) * 2})`; ctx.fillRect(0, 0, W, H);
      break;
    case 'slideLeft':
      ctx.save(); ctx.translate(-e * W, 0); drawA(); ctx.restore();
      ctx.save(); ctx.translate((1 - e) * W, 0); drawB(); ctx.restore();
      break;
    case 'slideUp':
      ctx.save(); ctx.translate(0, -e * H); drawA(); ctx.restore();
      ctx.save(); ctx.translate(0, (1 - e) * H); drawB(); ctx.restore();
      break;
    case 'zoom':
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1.25 - 0.25 * e, 1.25 - 0.25 * e); ctx.translate(-W / 2, -H / 2); drawB(); ctx.restore();
      ctx.save(); ctx.globalAlpha *= 1 - e; ctx.translate(W / 2, H / 2); ctx.scale(1 + e * 0.8, 1 + e * 0.8); ctx.translate(-W / 2, -H / 2); drawA(); ctx.restore();
      break;
    case 'wipe':
      drawA();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * e, H); ctx.clip(); drawB(); ctx.restore();
      ctx.fillStyle = '#A855F7'; ctx.fillRect(W * e - 6, 0, 12, H);
      break;
    case 'blur':
      ctx.save(); ctx.filter = `blur(${p * 24 * S}px)`; drawA(); ctx.restore();
      ctx.save(); ctx.globalAlpha *= p; ctx.filter = `blur(${(1 - p) * 24 * S}px)`; drawB(); ctx.restore();
      break;
    case 'spin':
      drawB();
      ctx.save(); ctx.globalAlpha *= 1 - e; ctx.translate(W / 2, H / 2); ctx.rotate(e * Math.PI * 0.6); ctx.scale(1 - e * 0.6, 1 - e * 0.6); ctx.translate(-W / 2, -H / 2); drawA(); ctx.restore();
      break;
    case 'glitch': {
      (p < 0.5 ? drawA : drawB)();
      const k = 1 - Math.abs(p - 0.5) * 2;
      const c = ctx.canvas;
      const sx = c.width / W, sy = c.height / H;
      for (let i = 0; i < 9; i++) {
        const y = Math.random() * H, h = (10 + Math.random() * 90) * k + 4;
        const off = (Math.random() - 0.5) * 160 * k;
        try { ctx.drawImage(c, 0, y * sy, c.width, h * sy, off, y, W, h); } catch (_) { /* yoksay */ }
      }
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(168,85,247,${0.25 * k})`; ctx.fillRect(0, 0, W, H); ctx.restore();
      break;
    }
    default: (p < 0.5 ? drawA : drawB)();
  }
}

// ---------- Harf animasyonları ----------
const LETTER_IN = new Set(['letters', 'wave', 'drop', 'scatter', 'flip', 'swing', 'glitchin', 'flicker', 'rise', 'typezoom', 'spinletters']);
const LETTER_OUT = new Set(['lettersOut', 'scatterOut', 'flipOut', 'dropOut']);
const LETTER_LOOP = new Set(['wavey', 'rainbow', 'jitter']);
const rnd = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

function charAnim(inn, out, loop, gi, N, st, size, lt) {
  const r = { a: 1, dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, color: null };
  if (inn) {
    const span = 0.55;
    const lp = clamp((st.reveal - (gi / Math.max(1, N)) * (1 - span)) / span);
    const e = easeOutCubic(lp);
    switch (inn) {
      case 'letters': r.a = lp; r.dy = (1 - e) * size * 0.45; break;
      case 'wave': r.a = clamp(lp * 2); r.dy = (1 - easeOutBack(lp)) * size * 0.7; break;
      case 'drop': r.a = clamp(lp * 3); r.dy = -(1 - easeOutBounce(lp)) * size * 1.6; break;
      case 'scatter': r.a = e; r.dx = (rnd(gi) - 0.5) * size * 8 * (1 - e); r.dy = (rnd(gi + 7) - 0.5) * size * 5 * (1 - e); r.rot = (rnd(gi + 3) - 0.5) * 3 * (1 - e); break;
      case 'flip': r.a = clamp(lp * 2); r.sy = Math.max(0.001, e); break;
      case 'swing': r.a = e; r.rot = -(1 - easeOutBack(lp)) * 1.2; break;
      case 'glitchin': r.a = lp < 1 ? (rnd(gi + Math.floor(lt * 30)) > 0.35 ? 1 : 0.15) : 1; r.dx = lp < 1 ? (rnd(gi * 3 + Math.floor(lt * 30)) - 0.5) * size * 0.6 : 0; r.color = lp < 1 && rnd(gi + Math.floor(lt * 20)) > 0.7 ? '#22d3ee' : null; break;
      case 'flicker': r.a = lp < 1 ? (rnd(gi * 5 + Math.floor(lt * 25)) > 0.5 ? 1 : 0.1) : 1; break;
      case 'rise': r.a = e; r.dy = (1 - e) * size; r.sx = r.sy = 0.85 + 0.15 * e; break;
      case 'typezoom': r.a = clamp(lp * 4); r.sx = r.sy = 1 + (1 - easeOutBack(lp)) * 1.8; break;
      case 'spinletters': r.a = e; r.rot = (1 - e) * Math.PI * 2; r.sx = r.sy = Math.max(0.01, e); break;
    }
  }
  if (out && st.out > 0) {
    const span = 0.55;
    const op = clamp((st.out - (gi / Math.max(1, N)) * (1 - span)) / span);
    const q = op * op;
    switch (out) {
      case 'lettersOut': r.a *= 1 - op; r.dy -= q * size * 0.45; break;
      case 'scatterOut': r.a *= 1 - op; r.dx += (rnd(gi + 11) - 0.5) * size * 8 * q; r.dy += (rnd(gi + 17) - 0.5) * size * 5 * q; r.rot += (rnd(gi + 5) - 0.5) * 3 * q; break;
      case 'flipOut': r.sy *= Math.max(0.001, 1 - op); break;
      case 'dropOut': r.a *= 1 - op; r.dy += q * size * 2; r.rot += q * (rnd(gi) - 0.5); break;
    }
  }
  switch (loop) {
    case 'wavey': r.dy += Math.sin(lt * 5 + gi * 0.55) * size * 0.08; break;
    case 'rainbow': r.color = `hsl(${(lt * 140 + gi * 22) % 360}, 95%, 62%)`; break;
    case 'jitter': r.dx += (rnd(gi + Math.floor(lt * 18)) - 0.5) * size * 0.05; r.dy += (rnd(gi * 2 + Math.floor(lt * 18)) - 0.5) * size * 0.05; break;
  }
  return r;
}

// ---------- Yazı ----------
function parseRich(text, upper) {
  let s = text || '';
  if (upper) s = s.toLocaleUpperCase('tr-TR');
  const lines = s.split('\n');
  let accent = false;
  return lines.map((line) => {
    const words = [];
    line.split(/ +/).forEach((raw) => {
      if (raw === '') return;
      let w = raw;
      // *...* işaretleri vurgu rengini açar/kapatır
      const open = w.match(/^([^\p{L}\p{N}\s*]*)\*/u);
      if (open) { w = open[1] + w.slice(open[0].length); accent = true; }
      const acc = accent;
      const close = w.match(/\*([^\p{L}\p{N}\s]*)$/u); // kapanış yıldızı (ardından noktalama olabilir)
      if (close) { w = w.slice(0, close.index) + close[1]; accent = false; }
      if (w.length) words.push({ t: w, accent: acc });
    });
    return words;
  });
}

export function fontStr(L, size) {
  return `${L.italic ? 'italic ' : ''}${L.weight || 700} ${size}px "${L.font || 'Barlow Condensed'}", "Barlow", sans-serif`;
}

export function layoutText(ctx, L, W) {
  ctx.font = fontStr(L, L.size);
  const sp = L.spacing || 0;
  try { ctx.letterSpacing = `${sp}px`; } catch (_) { /* eski motor */ }
  const maxW = (L.maxW || 0.9) * W;
  const spaceW = ctx.measureText(' ').width + sp;
  const out = [];
  parseRich(L.text, L.upper).forEach((words) => {
    let line = { words: [], width: 0 };
    if (!words.length) { out.push(line); return; }
    words.forEach((wd) => {
      const w = ctx.measureText(wd.t).width;
      const add = (line.words.length ? spaceW : 0) + w;
      if (line.words.length && line.width + add > maxW) { out.push(line); line = { words: [], width: 0 }; }
      line.words.push({ ...wd, w });
      line.width += (line.words.length > 1 ? spaceW : 0) + w;
    });
    out.push(line);
  });
  const lh = L.size * (L.lineH || 1.1);
  const totalW = Math.max(1, ...out.map((l) => l.width));
  return { lines: out, lh, spaceW, totalW, totalH: lh * out.length };
}

export function drawText(ctx, L, st, env) {
  const { W, S } = env;
  const lay = layoutText(ctx, L, W);
  const { lines, lh, spaceW, totalW, totalH } = lay;
  const pad = L.bgPad || 0;
  const align = L.align || 'center';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  // arka plan
  if (L.bgOn) {
    ctx.save();
    ctx.fillStyle = hexA(L.bgColor, L.bgOpacity ?? 1);
    if (L.bgMode === 'line') {
      lines.forEach((ln, i) => {
        if (!ln.words.length) return;
        const x0 = align === 'center' ? -ln.width / 2 : align === 'left' ? -totalW / 2 : totalW / 2 - ln.width;
        const y0 = -totalH / 2 + i * lh;
        roundRect(ctx, x0 - pad, y0 - pad * 0.35, ln.width + pad * 2, lh + pad * 0.7, L.bgRadius || 0);
        ctx.fill();
      });
    } else {
      roundRect(ctx, -totalW / 2 - pad, -totalH / 2 - pad * 0.7, totalW + pad * 2, totalH + pad * 1.4, L.bgRadius || 0);
      ctx.fill();
    }
    ctx.restore();
  }

  const totalChars = lines.reduce((a, l) => a + l.words.reduce((b, w) => b + w.t.length, 0), 0);
  const totalWords = lines.reduce((a, l) => a + l.words.length, 0);
  const ain = L.anim?.in, aout = L.anim?.out, aloop = L.anim?.loop;
  const tw = ain === 'typewriter' ? st.reveal * totalChars : Infinity;
  const ww = ain === 'words' ? st.reveal * totalWords : Infinity;
  const letterIn = LETTER_IN.has(ain) ? ain : null;
  const letterOut = LETTER_OUT.has(aout) ? aout : null;
  const charMode = !!(letterIn || letterOut || LETTER_LOOP.has(aloop));
  let charCount = 0, wordIdx = 0;
  const glow = st.glow || 0;
  const lt = st.lt || 0;

  const paint = (txt, fill) => {
    if (L.shadowOn) {
      ctx.shadowColor = L.shadowColor || 'rgba(0,0,0,.6)';
      ctx.shadowBlur = ((L.shadowBlur || 0) + glow * 40) * S;
      ctx.shadowOffsetY = L.shadowColor && L.shadowColor.startsWith('#') ? 0 : 4 * S;
    }
    if (L.strokeW > 0) {
      ctx.strokeStyle = L.strokeColor || '#000';
      ctx.lineWidth = L.strokeW;
      ctx.strokeText(txt, 0, 0);
      ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = fill;
    ctx.fillText(txt, 0, 0);
  };

  lines.forEach((ln, i) => {
    let x = align === 'center' ? -ln.width / 2 : align === 'left' ? -totalW / 2 : totalW / 2 - ln.width;
    const y = -totalH / 2 + i * lh + lh / 2;
    ln.words.forEach((wd) => {
      let txt = wd.t;
      let a = 1, dy = 0, sc = 1;
      if (tw !== Infinity) {
        const remain = tw - charCount;
        if (remain <= 0) txt = '';
        else if (remain < txt.length) txt = txt.slice(0, Math.ceil(remain));
      }
      if (ww !== Infinity) {
        const wp = clamp(ww - wordIdx);
        a = wp; dy = (1 - easeOutCubic(wp)) * L.size * 0.5; sc = 0.6 + 0.4 * easeOutBack(wp);
      }
      const fill = wd.accent ? (L.accent || L.color) : L.color;
      ctx.font = fontStr(L, L.size);
      if (charMode && txt) {
        // harf harf animasyon
        const chars = [...txt];
        let pre = '';
        chars.forEach((ch, ci) => {
          const gi = charCount + ci;
          const cx = ctx.measureText(pre).width;
          const cw = ctx.measureText(ch).width;
          pre += ch;
          const c = charAnim(letterIn, letterOut, aloop, gi, totalChars, st, L.size, lt);
          if (c.a <= 0.003) return;
          ctx.save();
          ctx.globalAlpha *= c.a * a;
          ctx.translate(x + cx + cw / 2 + c.dx, y + dy + c.dy);
          ctx.rotate(c.rot);
          ctx.scale(sc * c.sx, sc * c.sy);
          ctx.translate(-cw / 2, 0);
          paint(ch, c.color || fill);
          ctx.restore();
        });
      } else if (txt && a > 0) {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(x + wd.w / 2, y + dy);
        ctx.scale(sc, sc);
        ctx.translate(-wd.w / 2, 0);
        paint(txt, fill);
        ctx.restore();
      }
      charCount += wd.t.length; wordIdx++;
      x += wd.w + spaceW;
    });
  });
  return { w: totalW + pad * 2 + (L.strokeW || 0), h: totalH + pad * 1.4 + (L.strokeW || 0) };
}

// ---------- CTA ikonları ----------
const ICON_PATHS = {
  bell: 'M12 2a1.6 1.6 0 0 0-1.6 1.6v.6A6.2 6.2 0 0 0 5.8 10.3V15l-2 2.2V18.4h16.4v-1.2L18.2 15v-4.7a6.2 6.2 0 0 0-4.6-6.1v-.6A1.6 1.6 0 0 0 12 2zM9.6 19.6a2.4 2.4 0 0 0 4.8 0z',
  heart: 'M12 21s-7.6-4.7-9.6-9.3C1.1 8.5 3.3 4.8 6.9 4.8c2.1 0 3.4 1.1 5.1 3 1.7-1.9 3-3 5.1-3 3.6 0 5.8 3.7 4.5 6.9C19.6 16.3 12 21 12 21z',
  thumb: 'M2 10h4v11H2zM8 21h9.4a2.2 2.2 0 0 0 2.1-1.7l1.5-7a2.1 2.1 0 0 0-2.1-2.6h-5.4l.8-3.9A2.1 2.1 0 0 0 10.6 4L8 9.6z',
  bubble: 'M4 3.5h16A2.5 2.5 0 0 1 22.5 6v10a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 4v-4H4A2.5 2.5 0 0 1 1.5 16V6A2.5 2.5 0 0 1 4 3.5z',
  share: 'M13.5 3.5l8 7.5-8 7.5v-4.3C8.6 14.2 5 15.8 2.5 20.5c.9-5.6 4-10.5 11-11.6z',
  userPlus: 'M9 11.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zM1.5 21c0-4.2 3.3-7.5 7.5-7.5s7.5 3.3 7.5 7.5zM18.5 6.5v3h3v2.2h-3v3h-2.2v-3h-3V9.5h3v-3z',
  bookmark: 'M6 2.5h12a1.5 1.5 0 0 1 1.5 1.5v17.5L12 16.8l-7.5 4.7V4A1.5 1.5 0 0 1 6 2.5z',
  play: 'M7 4.5v15l12.5-7.5z',
  at: 'M12 2.5a9.5 9.5 0 1 0 5.2 17.4l-1.1-1.7A7.5 7.5 0 1 1 19.5 12v1.2c0 1-.7 1.8-1.6 1.8s-1.6-.8-1.6-1.8V7.6h-2v.9A4.6 4.6 0 1 0 15 15.4a3.6 3.6 0 0 0 2.9 1.6c2 0 3.6-1.7 3.6-3.8V12A9.5 9.5 0 0 0 12 2.5zm0 12.1a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z',
  link: 'M10.6 13.4a1 1 0 0 0 1.4 1.4l4.9-4.9a3.5 3.5 0 0 0-4.9-4.9l-2.1 2.1 1.4 1.4 2.1-2.1a1.5 1.5 0 0 1 2.1 2.1zM13.4 10.6a1 1 0 0 0-1.4-1.4l-4.9 4.9a3.5 3.5 0 0 0 4.9 4.9l2.1-2.1-1.4-1.4-2.1 2.1a1.5 1.5 0 0 1-2.1-2.1z',
  check: 'M9.5 16.2 5.3 12l-1.6 1.6 5.8 5.8L21 7.9l-1.6-1.6z',
  // v1.7: yeni ikonlar
  cart: 'M3 3h2.6l2.3 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21.5 7H6.3M9.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  download: 'M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM4 18h16v3H4z',
  calendar: 'M7 2h2v2h6V2h2v2h2.5A1.5 1.5 0 0 1 21 5.5v14a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-14A1.5 1.5 0 0 1 4.5 4H7zm-2 7v10h14V9z',
  phone: 'M6.6 2.5 9.4 5.3a1.5 1.5 0 0 1 .1 2L8 9.1a12 12 0 0 0 6.9 6.9l1.8-1.5a1.5 1.5 0 0 1 2-.1l2.8 2.8a1.5 1.5 0 0 1 0 2.1l-1.5 1.5c-1.2 1.2-3 1.5-4.6.9A19.5 19.5 0 0 1 2.3 8.6c-.6-1.6-.3-3.4.9-4.6l1.5-1.5a1.5 1.5 0 0 1 1.9 0z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
  ticket: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V9a3 3 0 0 0 0 6v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V15a3 3 0 0 0 0-6zM14 7v2h1.5V7zm0 4v2h1.5v-2zm0 4v2h1.5v-2z',
  gift: 'M3 8h18v4H3zM4.5 12h6.5v9H4.5zM13 12h6.5v9H13zM11 8V21h2V8zM12 8c-1.5-3-5.5-4.5-6.5-2.2C4.7 7.6 8 8 12 8zm0 0c1.5-3 5.5-4.5 6.5-2.2.8 1.8-2.5 2.2-6.5 2.2z',
  star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z',
  fire: 'M13.5 2c.6 3.3-1.4 5-2.8 6.6-1.5 1.7-2.7 3.2-2.2 5.6-1.6-.8-2.5-2.4-2.5-4.2C3.7 12 3 14 3 15.8 3 19.8 7 22 12 22s9-2.4 9-6.7C21 9.9 16.9 6.6 13.5 2zm-1 18c-2.2 0-3.6-1.3-3.6-3 0-2.4 2.7-3.6 3.2-6 1.9 1.4 4 3.6 4 6 0 1.7-1.4 3-3.6 3z',
  bolt: 'M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z',
  mail: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.8 2 7.2 5.6L19.2 7z',
  dm: 'M2.5 11.3 21.5 3l-6.6 18.5-3.4-7.4z',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3a15.7 15.7 0 0 0-1.4-6.1A8 8 0 0 1 18.9 11zM12 4.1c.9 1 2 3.3 2.2 6.9H9.8C10 7.4 11.1 5.1 12 4.1zM9.5 4.9A15.7 15.7 0 0 0 8.1 11h-3a8 8 0 0 1 4.4-6.1zM5.1 13h3a15.7 15.7 0 0 0 1.4 6.1A8 8 0 0 1 5.1 13zm6.9 6.9c-.9-1-2-3.3-2.2-6.9h4.4c-.2 3.6-1.3 5.9-2.2 6.9zm2.5-.8a15.7 15.7 0 0 0 1.4-6.1h3a8 8 0 0 1-4.4 6.1z',
  tag: 'M2.5 12.6V4.5a2 2 0 0 1 2-2h8.1l9 9a2 2 0 0 1 0 2.8l-8.1 8.1a2 2 0 0 1-2.8 0zM7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  music: 'M9 17.5V5.5l11-2.5v12.5M9 17.5a3 3 0 1 1-3-3 3 3 0 0 1 3 3zm11-2.5a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  camera: 'M8.5 4h7l1.6 2.5H20a1.5 1.5 0 0 1 1.5 1.5v10.5A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 4 6.5h2.9zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  eye: 'M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z',
  arrow: 'M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z',
  live: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM7.1 7.1l-1.4-1.4a9 9 0 0 0 0 12.6l1.4-1.4a7 7 0 0 1 0-9.8zm9.8 0a7 7 0 0 1 0 9.8l1.4 1.4a9 9 0 0 0 0-12.6z',
  money: 'M2 6h20v12H2zm10 9.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM4 8v2a2 2 0 0 0 2-2zm14 0a2 2 0 0 0 2 2V8zM4 14v2h2a2 2 0 0 0-2-2zm16 0a2 2 0 0 0-2 2h2z',
  coffee: 'M3 8h14v6a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6zm14 2h1.5a2.5 2.5 0 0 1 0 5H17v-2h1.5a.5.5 0 0 0 0-1H17zM6 2.5h2v3.5H6zm4 0h2v3.5h-2z',
  home: 'M12 3 2.5 11h2.7v9.5h5.3v-6h3v6h5.3V11h2.7z',
}
const pathCache = {};
export function iconPath(name) {
  if (!pathCache[name]) pathCache[name] = new Path2D(ICON_PATHS[name] || ICON_PATHS.play);
  return pathCache[name];
}
export const ICON_NAMES = [
  ['bell', 'Zil'], ['thumb', 'Beğeni'], ['heart', 'Kalp'], ['userPlus', 'Takip'], ['bubble', 'Yorum'],
  ['share', 'Paylaş'], ['bookmark', 'Kaydet'], ['play', 'Oynat'], ['at', '@'], ['link', 'Link'], ['check', 'Onay'],
  ['cart', 'Sepet'], ['download', 'İndir'], ['calendar', 'Takvim'], ['phone', 'Telefon'], ['pin', 'Konum'], ['ticket', 'Bilet'],
  ['gift', 'Hediye'], ['star', 'Yıldız'], ['fire', 'Ateş'], ['bolt', 'Şimşek'], ['mail', 'E-posta'], ['dm', 'Mesaj'], ['globe', 'Web'],
  ['tag', 'Etiket'], ['music', 'Müzik'], ['camera', 'Kamera'], ['eye', 'İzle'], ['arrow', 'Ok'], ['live', 'Canlı'], ['money', 'Para'], ['coffee', 'Kahve'], ['home', 'Ev'],
];

function drawIcon(ctx, name, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(iconPath(name));
  ctx.restore();
}

export function drawCTA(ctx, L, t, env) {
  const { S } = env;
  const sc = L.scale || 1;
  ctx.scale(sc, sc);
  const local = t - L.start;
  const dur = L.end - L.start;
  const tapAt = Math.min(dur * 0.45, 1.4);
  const tapped = L.tap && local >= tapAt;
  const label = tapped && L.doneLabel ? L.doneLabel : L.label;
  const icon = tapped && L.doneLabel ? 'check' : L.icon;
  const bg = tapped && L.doneLabel ? '#3F3A4D' : L.color;
  const h = 112, isz = 58;
  ctx.font = L.font ? `800 ${L.font === 'Bricolage Grotesque' ? 46 : 54}px "${L.font}", "Barlow", sans-serif` : `800 54px "Barlow Condensed", "Barlow", sans-serif`;
  try { ctx.letterSpacing = '1px'; } catch (_) { /* yoksay */ }
  const tw = label ? ctx.measureText(label).width : 0;
  const round = L.style === 'round' || !label;
  const w = round ? h : tw + isz + 104;
  const rr = L.style === 'square' || L.style === 'stack' || L.style === 'sticker' ? 26 : h / 2;
  // tıklama bastırma
  if (L.tap) {
    const d = local - tapAt;
    if (d > -0.15 && d < 0.25) { const k = 1 - Math.abs(d - 0.05) / 0.2; ctx.scale(1 - 0.08 * clamp(k), 1 - 0.08 * clamp(k)); }
  }
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 24 * S; ctx.shadowOffsetY = 6 * S;
  if (L.style === 'outline') {
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(10,6,20,.55)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 6; ctx.strokeStyle = L.color; ctx.stroke();
  } else if (L.style === 'glass') {
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
  } else if (L.style === 'neon') {
    roundRect(ctx, -w / 2, -h / 2, w, h, rr);
    ctx.fillStyle = 'rgba(8,6,14,.7)'; ctx.fill();
    ctx.shadowColor = L.color; ctx.shadowBlur = 34 * S; ctx.shadowOffsetY = 0;
    ctx.lineWidth = 6; ctx.strokeStyle = L.color; ctx.stroke(); ctx.stroke();
  } else if (L.style === 'gradient') {
    roundRect(ctx, -w / 2, -h / 2, w, h, rr);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, bg); g.addColorStop(1, tapped && L.doneLabel ? bg : (L.color2 || '#22D3EE'));
    ctx.fillStyle = g; ctx.fill();
  } else if (L.style === 'sticker') {
    ctx.rotate(-0.05);
    roundRect(ctx, -w / 2 - 8, -h / 2 - 8, w + 16, h + 16, rr + 8); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.shadowColor = 'transparent';
    roundRect(ctx, -w / 2, -h / 2, w, h, rr); ctx.fillStyle = bg; ctx.fill();
  } else if (L.style === 'minimal') {
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 16 * S;
    ctx.fillStyle = bg; ctx.fillRect(-w / 2 + 40, h / 2 - 14, (w - 80) * (tapped ? 1 : 0.999), 8);
  } else if (L.style === 'stack') {
    roundRect(ctx, -w / 2, -h / 2, w, h, rr); ctx.fillStyle = 'rgba(14,13,17,.86)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    roundRect(ctx, -w / 2 + 10, -h / 2 + 10, isz + 40, h - 20, 18); ctx.fillStyle = bg; ctx.fill();
  } else {
    roundRect(ctx, -w / 2, -h / 2, w, h, round ? h / 2 : rr);
    ctx.fillStyle = bg; ctx.fill();
  }
  ctx.restore();
  if (L.style === 'sticker') ctx.rotate(-0.05);
  const fg = L.style === 'outline' || L.style === 'neon' ? L.color : (L.style === 'glass' ? (L.color || '#fff') : L.style === 'minimal' || L.style === 'stack' ? '#FFFFFF' : L.textColor);
  if (round) {
    drawIcon(ctx, icon, 0, 0, isz, fg);
  } else {
    const x0 = -w / 2 + 44;
    drawIcon(ctx, icon, x0 + isz / 2, 0, isz, fg);
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(label, x0 + isz + 22, 3);
  }
  // dokunma dalgası + el imleci
  if (L.tap) {
    const d = local - tapAt;
    if (d > -0.6 && d < 0.7) {
      const fx = round ? h * 0.15 : w * 0.18, fy = h * 0.3;
      if (d > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - d / 0.7)})`;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(fx, fy - 10, 20 + d * 160, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const move = d < 0 ? (-d / 0.6) : 0;
      ctx.save();
      ctx.translate(fx + move * 120, fy + move * 140);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  return { w: w * sc, h: h * sc };
}

// ---------- Skor kartı ----------
export function drawScore(ctx, L, t, env) {
  const { S } = env;
  const sc = L.scale || 1;
  ctx.scale(sc, sc);
  const w = 900, h = 200, r = 28;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30 * S; ctx.shadowOffsetY = 8 * S;
  roundRect(ctx, -w / 2, -h / 2, w, h, r);
  ctx.fillStyle = L.cardColor; ctx.fill();
  ctx.restore();
  // takım renk şeritleri
  ctx.save();
  roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip();
  ctx.fillStyle = L.colorA; ctx.fillRect(-w / 2, -h / 2, 16, h);
  ctx.fillStyle = L.colorB; ctx.fillRect(w / 2 - 16, -h / 2, 16, h);
  // skor kutusu
  const g = ctx.createLinearGradient(-110, 0, 110, 0);
  g.addColorStop(0, L.accent); g.addColorStop(1, '#C026D3');
  ctx.fillStyle = g; roundRect(ctx, -115, -h / 2 + 30, 230, 104, 18); ctx.fill();
  ctx.restore();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = `900 76px "Barlow Condensed", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${L.scoreA}  -  ${L.scoreB}`, 0, -h / 2 + 84);
  ctx.font = `800 54px "Barlow Condensed", sans-serif`;
  const fitText = (txt, maxW) => { let s = 54; ctx.font = `800 ${s}px "Barlow Condensed", sans-serif`; while (ctx.measureText(txt).width > maxW && s > 24) { s -= 2; ctx.font = `800 ${s}px "Barlow Condensed", sans-serif`; } };
  const A = (L.teamA || '').toLocaleUpperCase('tr-TR'), B = (L.teamB || '').toLocaleUpperCase('tr-TR');
  fitText(A, 260); ctx.textAlign = 'right'; ctx.fillText(A, -140, -h / 2 + 84);
  fitText(B, 260); ctx.textAlign = 'left'; ctx.fillText(B, 140, -h / 2 + 84);
  if (L.info) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#C4B5FD';
    ctx.font = `600 34px "Barlow Semi Condensed", sans-serif`;
    ctx.fillText(L.info, 0, h / 2 - 32);
  }
  return { w: w * sc, h: h * sc };
}

// ---------- Katman ----------
export const BLENDS = [
  ['source-over', 'Normal'], ['multiply', 'Çarp'], ['screen', 'Ekran'], ['overlay', 'Bindirme'],
  ['lighten', 'Aydınlat'], ['darken', 'Karart'], ['color-dodge', 'Renk soldurma'], ['difference', 'Fark'],
];

export function drawLayer(ctx, L, t, env, el, still = false) {
  const { W, H, S } = env;
  if (L.kind === 'group') return drawGroup(ctx, L, t, env, still);
  // still: düzenlerken seçili katman giriş/çıkış animasyonsuz, tam haliyle görünür (keyframe'ler uygulanır)
  const st = still ? { alpha: 1, tx: 0, ty: 0, sc: 1, rot: 0, blur: 0, reveal: 1, glow: 0 } : animState(L, t, W, H);
  if (st.alpha <= 0.001 || st.sc <= 0.001) return null;
  const kv = layerAt(L, t);
  ctx.save();
  ctx.globalAlpha = clamp(kv.opacity * st.alpha);
  if (L.blend && L.blend !== 'source-over') ctx.globalCompositeOperation = L.blend;
  const cx = kv.x * W + st.tx, cy = kv.y * H + st.ty;
  const rot = (kv.rot * Math.PI) / 180 + st.rot;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(st.sc * kv.s * (st.sx || 1), st.sc * kv.s * (st.sy || 1));
  if (st.blur > 0.5) ctx.filter = `blur(${st.blur * S}px)`;
  let box = null;
  if (L.kind === 'text') box = drawText(ctx, L, st, env);
  else if (L.kind === 'cta') box = drawCTA(ctx, L, t, env);
  else if (L.kind === 'score') box = drawScore(ctx, L, t, env);
  else if (L.kind === 'shape') box = drawShape(ctx, L, t, env);
  else if (L.kind === 'sticker') box = drawSticker(ctx, L, t, env);
  else if (L.kind === 'social') box = drawSocial(ctx, L, t, env);
  else if (L.kind === 'wave') box = drawWave(ctx, L, t, env);
  else if (L.kind === 'media') box = drawMediaLayer(ctx, L, t, env, el, st);
  ctx.restore();
  if (!box) return null;
  return { w: box.w * kv.s, h: box.h * kv.s, x: kv.x * W, y: kv.y * H, rot: kv.rot };
}

// ---------- Grup (bileşik katman) ----------
function drawGroup(ctx, G, t, env, still) {
  const { W, H } = env;
  const st = still ? { alpha: 1, tx: 0, ty: 0, sc: 1, rot: 0, sx: 1, sy: 1 } : animState(G, t, W, H);
  if (st.alpha <= 0.001) return null;
  const kv = layerAt(G, t);
  ctx.save();
  ctx.globalAlpha = clamp(kv.opacity * st.alpha);
  ctx.translate(kv.x * W + st.tx, kv.y * H + st.ty);
  ctx.rotate((kv.rot * Math.PI) / 180 + st.rot);
  ctx.scale(st.sc * kv.s * (st.sx || 1), st.sc * kv.s * (st.sy || 1));
  ctx.translate(-W / 2, -H / 2);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  (G.children || []).forEach((c) => {
    if (t < c.start || t >= c.end || c.hidden) return;
    const b = drawLayer(ctx, c, t, env, c.kind === 'media' && env.elFor ? env.elFor(c) : null, false);
    if (b) { x0 = Math.min(x0, b.x - b.w / 2); x1 = Math.max(x1, b.x + b.w / 2); y0 = Math.min(y0, b.y - b.h / 2); y1 = Math.max(y1, b.y + b.h / 2); }
  });
  ctx.restore();
  if (x0 === Infinity) return { w: 200, h: 200, x: kv.x * W, y: kv.y * H, rot: kv.rot };
  const cx = (x0 + x1) / 2 - W / 2, cy = (y0 + y1) / 2 - H / 2;
  return { w: (x1 - x0) * kv.s, h: (y1 - y0) * kv.s, x: kv.x * W + cx * kv.s, y: kv.y * H + cy * kv.s, rot: kv.rot };
}

// ---------- Ses dalgası (podcast görselleştirici) ----------
const waveBuf = { f: null, last: null };
export function drawWave(ctx, L, t, env) {
  const { W, S } = env;
  const w = (L.w || 0.8) * W, h = (L.h || 0.18) * W;
  const n = Math.max(8, Math.min(96, L.bars || 40));
  const an = env.analyser;
  let vals = new Float32Array(n);
  if (an) {
    if (!waveBuf.f || waveBuf.f.length !== an.frequencyBinCount) waveBuf.f = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(waveBuf.f);
    const maxBin = Math.floor(waveBuf.f.length * 0.55);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.pow(i / n, 1.6) * maxBin), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.6) * maxBin));
      let m = 0; for (let k = a; k < b; k++) m = Math.max(m, waveBuf.f[k]);
      vals[i] = m / 255;
    }
  }
  const quiet = vals.every((v) => v < 0.02);
  if (quiet) for (let i = 0; i < n; i++) vals[i] = 0.12 + 0.1 * Math.abs(Math.sin(i * 0.7 + t * 2.2));
  if (waveBuf.last && waveBuf.last.length === n) for (let i = 0; i < n; i++) vals[i] = Math.max(vals[i], waveBuf.last[i] * 0.82);
  waveBuf.last = vals;
  ctx.save();
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, L.color || '#A855F7'); g.addColorStop(1, L.color2 || '#22D3EE');
  ctx.fillStyle = g;
  if (L.glow) { ctx.shadowColor = L.color || '#A855F7'; ctx.shadowBlur = 24 * S; }
  const style = L.style || 'bars';
  if (style === 'line') {
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(4, h * 0.05); ctx.lineJoin = 'round'; ctx.beginPath();
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i / (n - 1)) * w; const y = (i % 2 ? -1 : 1) * vals[i] * h / 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  } else if (style === 'circle') {
    const r = Math.min(w, h * 2.2) * 0.28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, l = r * 0.2 + vals[i] * r * 0.9;
      ctx.save(); ctx.rotate(a); roundRect(ctx, -w * 0.006, r, w * 0.012, l, w * 0.006); ctx.fill(); ctx.restore();
    }
  } else {
    const bw = w / n;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(bw * 0.6, vals[i] * h);
      roundRect(ctx, -w / 2 + i * bw + bw * 0.18, style === 'mirror' ? -bh / 2 : h / 2 - bh, bw * 0.64, bh, bw * 0.32);
      ctx.fill();
    }
  }
  ctx.restore();
  return { w, h: style === 'circle' ? w * 0.7 : h };
}

// ---------- Şekiller ----------
export const SHAPES = [['rect', 'Kutu'], ['circle', 'Çember'], ['line', 'Çizgi'], ['arrow', 'Ok'], ['frame', 'Ekran çerçevesi']];

function mixWhite(hex, k) {
  if (!hex || hex[0] !== '#') return '#ffffff';
  let c = hex.slice(1); if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  const m = (v) => Math.round(v + (255 - v) * k);
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}

export function drawShape(ctx, L, t, env) {
  const { W, H, S } = env;
  let w = (L.w || 0.5) * W, h = (L.h || 0.3) * W;
  if (L.shape === 'frame') { const ins = (L.inset ?? 0.03) * W; w = W - ins * 2; h = H - ins * 2; }
  const sw = L.strokeW || 0;
  const path = () => {
    ctx.beginPath();
    if (L.shape === 'circle') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (L.shape === 'line') { ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); }
    else if (L.shape === 'arrow') {
      const hs = Math.max(sw * 2.6, 34);
      ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2 - hs * 0.8, 0);
    } else roundRect(ctx, -w / 2, -h / 2, w, h, L.radius || 0);
  };
  const arrowHead = () => {
    const hs = Math.max(sw * 2.6, 34);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2 - hs, -hs * 0.62); ctx.lineTo(w / 2 - hs, hs * 0.62); ctx.closePath();
    ctx.fill();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const glow = L.glow || 0;
  const lineLike = L.shape === 'line' || L.shape === 'arrow';
  // dolgu
  if (L.fillOn && !lineLike) {
    ctx.save();
    ctx.fillStyle = hexA(L.fillColor || '#000', L.fillOpacity ?? 0.5);
    path(); ctx.fill();
    ctx.restore();
  }
  if (sw > 0) {
    ctx.save();
    ctx.strokeStyle = L.color; ctx.fillStyle = L.color; ctx.lineWidth = sw;
    if (glow > 0) { ctx.shadowColor = L.color; ctx.shadowBlur = glow * S; }
    path(); ctx.stroke();
    if (L.shape === 'arrow') arrowHead();
    if (glow > 0) {
      // neon: ikinci geçiş + açık renkli çekirdek
      path(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = mixWhite(L.color, 0.65); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(1, sw * 0.38);
      path(); ctx.stroke();
      if (L.shape === 'arrow') { ctx.save(); ctx.scale(0.999, 0.999); ctx.restore(); }
    }
    ctx.restore();
  }
  return { w: w + sw, h: (lineLike ? Math.max(sw * 3, 40) : h) + sw };
}

// ---------- Medya katmanı ----------
export const CROPS = [['none', 'Orijinal'], ['square', 'Kare'], ['circle', 'Daire'], ['wide', '16:9'], ['portrait', '4:5'], ['half', 'Yarım ekran']];

function cropH(L, w, sw, sh, env) {
  switch (L.crop) {
    case 'square': case 'circle': return w;
    case 'wide': return w * 9 / 16;
    case 'portrait': return w * 5 / 4;
    case 'half': return w * (env.H / 2) / env.W;
    default: return w * (sh / sw);
  }
}

const maskCanvases = new Map();

export const MASK_SHAPES = [['none', 'Yok'], ['rect', 'Dikdörtgen'], ['ellipse', 'Elips'], ['star', 'Yıldız'], ['heart', 'Kalp'], ['triangle', 'Üçgen'], ['diamond', 'Elmas'], ['hexagon', 'Altıgen'], ['splitV', 'Dikey bölme'], ['splitH', 'Yatay bölme'], ['diagonal', 'Çapraz bölme'], ['film', 'Sinema şeridi']];

// m: {type,x,y,w,h,radius,rot}; cw,ch: tuval boyutu
export function maskPath(o, m, cw, ch, k = 1) {
  const mx = (m.x ?? 0.5) * cw, my = (m.y ?? 0.5) * ch, mw = (m.w ?? 0.8) * cw, mh = (m.h ?? 0.8) * ch;
  o.beginPath();
  o.save();
  o.translate(mx, my);
  if (m.rot) o.rotate((m.rot * Math.PI) / 180);
  switch (m.type) {
    case 'ellipse': o.ellipse(0, 0, mw / 2, mh / 2, 0, 0, Math.PI * 2); break;
    case 'star': for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.4 : 1, a = (i / 10) * Math.PI * 2 - Math.PI / 2; o.lineTo(Math.cos(a) * r * mw / 2, Math.sin(a) * r * mh / 2); } o.closePath(); break;
    case 'heart': {
      const w = mw / 2, hh = mh / 2;
      o.moveTo(0, hh * 0.85);
      o.bezierCurveTo(-w * 1.2, hh * 0.05, -w * 0.9, -hh * 1.05, 0, -hh * 0.45);
      o.bezierCurveTo(w * 0.9, -hh * 1.05, w * 1.2, hh * 0.05, 0, hh * 0.85);
      o.closePath(); break;
    }
    case 'triangle': o.moveTo(0, -mh / 2); o.lineTo(mw / 2, mh / 2); o.lineTo(-mw / 2, mh / 2); o.closePath(); break;
    case 'diamond': o.moveTo(0, -mh / 2); o.lineTo(mw / 2, 0); o.lineTo(0, mh / 2); o.lineTo(-mw / 2, 0); o.closePath(); break;
    case 'hexagon': for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; o.lineTo(Math.cos(a) * mw / 2, Math.sin(a) * mh / 2); } o.closePath(); break;
    case 'splitV': o.rect(-cw * 2, -ch * 2, cw * 2, ch * 4); break;
    case 'splitH': o.rect(-cw * 2, -ch * 2, cw * 4, ch * 2); break;
    case 'diagonal': o.moveTo(-cw * 2, -ch * 2); o.lineTo(cw * 2, -ch * 2); o.lineTo(-cw * 2, ch * 2); o.closePath(); break;
    case 'film': o.rect(-cw * 2, -mh / 2, cw * 4, mh); break;
    default: roundRect(o, -mw / 2, -mh / 2, mw, mh, (m.radius || 0) * k);
  }
  o.restore();
}

// maske uygula: tuvalde önce görüntü olmalı
export function applyMask(o, m, cw, ch, k = 1) {
  o.save();
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = m.invert ? 'destination-out' : 'destination-in';
  o.filter = m.feather > 0 ? `blur(${m.feather * k}px)` : 'none';
  o.fillStyle = '#000';
  maskPath(o, m, cw, ch, k);
  o.fill();
  o.restore();
}

function drawMediaLayer(ctx, L, t, env, el, st) {
  const { W, S } = env;
  const w = (L.w || 0.6) * W;
  { const o0 = el; el = stableSource(el); if (el === o0) { if (!isReady(el)) return { w, h: w }; rememberFrame(el); } }
  const [sw, sh] = mediaSize(el);
  const gp = gradeParams(L);
  if (gp) el = gradeSource(el, sw, sh, gp, env.exporting ? 1920 : 1280);
  if (L.bgr?.on && env.seg) {
    const cut = env.seg.removeBackground(el, sw, sh, { ...L.bgr, _t: t - L.start }, env.exporting ? 1920 : 960);
    if (cut) {
      if (L.bgr.mode === 'color' || L.bgr.mode === 'blur') {
        const bg = document.createElement('canvas'); bg.width = cut.width; bg.height = cut.height;
        const bx = bg.getContext('2d');
        if (L.bgr.mode === 'color') { bx.fillStyle = L.bgr.color || '#00B140'; bx.fillRect(0, 0, bg.width, bg.height); }
        else { bx.filter = `blur(${(L.bgr.blur || 30) * bg.width / 1080}px)`; bx.drawImage(el, 0, 0, bg.width, bg.height); bx.filter = 'none'; }
        bx.drawImage(cut, 0, 0); el = bg;
      } else el = cut;
    }
  }
  const h = cropH(L, w, sw, sh, env);
  let zoom = L.zoom || 1;
  if (L.kenburns) zoom *= 1 + 0.15 * clamp((t - L.start) / Math.max(0.1, L.end - L.start));
  const r = L.crop === 'circle' ? w / 2 : (L.radius || 0);
  const m = L.mask && L.mask.type && L.mask.type !== 'none' ? L.mask : null;
  if (L.shadowOn && !m) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 10 * S;
    roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();
  }
  const fs = filterString(L.filters, S);
  const blur = st.blur > 0.5 ? ` blur(${st.blur * S}px)` : '';
  const filt = ((fs === 'none' ? '' : fs) + blur).trim() || 'none';
  if (m) {
    // maske: ekran dışı tuvalde görüntü + yumuşatılmış maske
    const k = S * (ctx.getTransform ? Math.hypot(ctx.getTransform().a, ctx.getTransform().b) / S : 1);
    const cw = Math.max(2, Math.ceil(w * k)), ch = Math.max(2, Math.ceil(h * k));
    let oc = maskCanvases.get(L.id);
    if (!oc) { oc = document.createElement('canvas'); maskCanvases.set(L.id, oc); }
    if (oc.width !== cw || oc.height !== ch) { oc.width = cw; oc.height = ch; }
    const o = oc.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-over';
    o.filter = 'none';
    o.clearRect(0, 0, cw, ch);
    o.save();
    roundRect(o, 0, 0, cw, ch, r * k); o.clip();
    o.filter = filt;
    drawFit(o, el, 0, 0, cw, ch, 'cover', zoom);
    o.restore();
    applyMask(o, m, cw, ch, k);
    o.globalCompositeOperation = 'source-over';
    o.filter = 'none';
    ctx.drawImage(oc, -w / 2, -h / 2, w, h);
  } else {
    ctx.save();
    roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip();
    ctx.filter = filt;
    drawFit(ctx, el, -w / 2, -h / 2, w, h, 'cover', zoom, L.panX || 0, L.panY || 0);
    ctx.restore();
  }
  if (L.borderW > 0 && !m) {
    ctx.save();
    roundRect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.lineWidth = L.borderW; ctx.strokeStyle = L.borderColor || '#fff';
    if (L.borderGlow > 0) { ctx.shadowColor = L.borderColor; ctx.shadowBlur = L.borderGlow * S; ctx.stroke(); }
    ctx.stroke();
    ctx.restore();
  }
  return { w, h };
}

// ---------- Altyazı ----------
export function wordTimings(cue) {
  // otomatik altyazıdan gelen gerçek kelime zamanları varsa onları kullan
  if (cue.words && cue.words.length) return cue.words.map((w) => ({ t: w.t, s: w.s, e: w.e }));
  const words = cue.text.replace(/\n/g, ' ').split(/ +/).filter(Boolean);
  const weights = words.map((w) => w.length + 2);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = cue.start;
  const d = cue.end - cue.start;
  return words.map((w, i) => { const s = acc; acc += (weights[i] / sum) * d; return { t: w, s, e: acc }; });
}

// v1.5 altyazı stili: eski "preset" alanı yeni ayrıntılı seçeneklere eşlenir
const LEGACY = {
  karaoke: { mode: 'line', hl: 'color', anim: 'fade' },
  pop: { mode: 'group', group: 3, hl: 'color', anim: 'pop' },
  single: { mode: 'single', hl: 'color', anim: 'pop', scale: 1.5 },
  classic: { mode: 'line', hl: 'none', anim: 'fade' },
  box: { mode: 'line', hl: 'none', anim: 'fade', box: 'line' },
};
export function capStyle(st0 = {}) {
  const lg = st0.mode ? {} : (LEGACY[st0.preset] || LEGACY.karaoke);
  return {
    font: 'Barlow Condensed', weight: 800, size: 84, color: '#FFFFFF', accent: '#C084FC', strokeColor: '#000000', strokeW: 10,
    upper: true, y: 0.72, x: 0.5, maxW: 0.84, maxLines: 2, boxColor: '#000000', boxOpacity: 0.72, boxRadius: 14, boxPad: 18,
    mode: 'line', group: 3, hl: 'color', hlText: '#111111', anim: 'fade', box: 'none', shadow: 0.5, glow: 0, glowColor: '', italic: false,
    spacing: 0, scale: 1, rot: 0, noPunct: false, pastColor: '', lineH: 1.15,
    ...lg, ...st0,
  };
}

export function drawSubtitles(ctx, subs, t, env) {
  if (!subs || !subs.cues?.length) return;
  const { W, H, S } = env;
  const st = capStyle(subs.style);
  const tt = t - (subs.offset || 0);
  const cue = subs.cues.find((c) => tt >= c.start && tt < c.end);
  if (!cue) return;
  let words = wordTimings(cue).map((w) => {
    let x = st.upper ? w.t.toLocaleUpperCase('tr-TR') : w.t;
    if (st.noPunct) x = x.replace(/[.,;:!?…"“”]+$/g, '').replace(/^["“”]+/, '');
    return { ...w, t: x };
  }).filter((w) => w.t);
  if (!words.length) return;
  let cur = words.findIndex((w) => tt >= w.s && tt < w.e);
  if (cur < 0) { cur = -1; for (let i = 0; i < words.length; i++) if (tt >= words[i].s) cur = i; if (cur < 0) cur = 0; }
  let show = words;
  if (st.mode === 'group') { const g = Math.max(1, st.group | 0) ; const k = Math.floor(cur / g) * g; show = words.slice(k, k + g); }
  if (st.mode === 'single') show = [words[cur]];
  let size = st.size * (st.mode === 'single' ? (st.scale || 1.5) : (st.scale || 1));
  ctx.save();
  const font = (sz) => `${st.italic ? 'italic ' : ''}${st.weight} ${sz}px "${st.font}", "Barlow", sans-serif`;
  try { ctx.letterSpacing = `${st.spacing || 0}px`; } catch (_) { /* yoksay */ }
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  const maxW = (st.maxW || 0.84) * W;
  let lines = [];
  // satıra sığmazsa ve satır sayısı sınırı aşılırsa yazıyı küçült
  for (let attempt = 0; attempt < 4; attempt++) {
    ctx.font = font(size);
    const spaceW = ctx.measureText(' ').width;
    lines = [];
    let line = { ws: [], w: 0 };
    show.forEach((w) => {
      const ww = ctx.measureText(w.t).width;
      if (line.ws.length && line.w + spaceW + ww > maxW) { lines.push(line); line = { ws: [], w: 0 }; }
      line.w += (line.ws.length ? spaceW : 0) + ww; line.ws.push({ ...w, w: ww });
    });
    lines.push(line);
    lines.spaceW = spaceW;
    const widest = Math.max(...lines.map((l) => l.w));
    if (lines.length <= (st.maxLines || 2) && widest <= maxW * 1.02) break;
    size *= 0.88;
  }
  const spaceW = lines.spaceW;
  const lh = size * (st.lineH || 1.15);
  const cx = (st.x ?? 0.5) * W, cy = st.y * H;
  const top = cy - (lines.length * lh) / 2;
  // satır girişi
  const age = tt - cue.start;
  const pin = clamp(age / 0.16);
  ctx.translate(cx, cy);
  if (st.rot) ctx.rotate((st.rot * Math.PI) / 180);
  if (st.anim === 'pop') { const k = 0.82 + 0.18 * easeOutBack(clamp(age / 0.2)); ctx.scale(k, k); }
  if (st.anim === 'slide') ctx.translate(0, (1 - easeOutCubic(pin)) * size * 0.5);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = st.anim === 'none' ? 1 : pin;
  const pad = (st.boxPad ?? 18);
  if (st.box === 'block') {
    const bw = Math.max(...lines.map((l) => l.w)) + pad * 2;
    ctx.fillStyle = hexA(st.boxColor || '#000', st.boxOpacity ?? 0.72);
    roundRect(ctx, cx - bw / 2, top - pad * 0.5, bw, lines.length * lh + pad, st.boxRadius ?? 14); ctx.fill();
  }
  const reveal = st.anim === 'typewriter' || st.anim === 'pop' || st.anim === 'words';
  lines.forEach((ln, li) => {
    let x = cx - ln.w / 2;
    const y = top + li * lh + lh / 2;
    if (st.box === 'line') {
      ctx.fillStyle = hexA(st.boxColor || '#000', st.boxOpacity ?? 0.72);
      roundRect(ctx, x - pad, y - lh / 2 - 2, ln.w + pad * 2, lh + 4, st.boxRadius ?? 14); ctx.fill();
    }
    ln.ws.forEach((w) => {
      const idx = words.indexOf(words.find((q) => q.s === w.s && q.t === w.t));
      const active = idx === cur, past = idx < cur;
      const spoken = tt >= w.s - 0.02;
      if (reveal && !spoken && st.mode !== 'single') { x += w.w + spaceW; return; }
      let sc = 1;
      if (st.anim === 'pop' || st.anim === 'words') { const wp = clamp((tt - w.s) / 0.12); sc = 0.65 + 0.35 * easeOutBack(wp); }
      if (active && st.hl === 'scale') sc *= 1.16;
      ctx.save();
      ctx.translate(x + w.w / 2, y); ctx.scale(sc, sc); ctx.translate(-w.w / 2, 0);
      // etkin kelime vurgusu (kutu / alt çizgi)
      if (active && st.hl === 'box') {
        ctx.fillStyle = st.accent;
        roundRect(ctx, -size * 0.14, -size * 0.58, w.w + size * 0.28, size * 1.12, size * 0.2); ctx.fill();
      }
      if (active && st.hl === 'underline') { ctx.fillStyle = st.accent; roundRect(ctx, 0, size * 0.46, w.w, size * 0.11, size * 0.05); ctx.fill(); }
      let fill = st.color;
      if (st.hl === 'karaoke' && (active || past)) fill = st.accent;
      else if (active && (st.hl === 'color' || st.hl === 'scale' || st.hl === 'glow')) fill = st.accent;
      else if (active && st.hl === 'box') fill = st.hlText || '#111';
      else if (past && st.pastColor) fill = st.pastColor;
      if (st.strokeW > 0 && !(active && st.hl === 'box')) { ctx.strokeStyle = st.strokeColor; ctx.lineWidth = st.strokeW; ctx.strokeText(w.t, 0, 0); }
      if (st.glow > 0 || (active && st.hl === 'glow')) { ctx.shadowColor = st.glowColor || st.accent; ctx.shadowBlur = (st.glow > 0 ? st.glow : 30) * S * 1.4; }
      else if (st.shadow > 0) { ctx.shadowColor = `rgba(0,0,0,${0.35 + st.shadow * 0.4})`; ctx.shadowBlur = 14 * st.shadow * S; ctx.shadowOffsetY = 3 * st.shadow * S; }
      ctx.fillStyle = fill;
      ctx.fillText(w.t, 0, 0);
      ctx.restore();
      x += w.w + spaceW;
    });
  });
  ctx.restore();
}

// ---------- Genel efektler ----------
let grainCanvas = null;
function getGrain() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 256;
  const g = grainCanvas.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grainCanvas;
}

export function drawFx(ctx, fx, t, total, env) {
  const { W, H } = env;
  if (!fx) return;
  if (fx.vignette > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${fx.vignette})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (fx.grain > 0) {
    ctx.save();
    ctx.globalAlpha = fx.grain * 0.35;
    ctx.globalCompositeOperation = 'overlay';
    const gc = getGrain();
    const ox = Math.random() * 256, oy = Math.random() * 256;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(gc, 'repeat');
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  }
  if (fx.letterbox > 0) {
    const bh = H * fx.letterbox * 0.5;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
  }
  if (fx.progress && total > 0) {
    const p = clamp(t / total);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, H - 14, W, 14);
    ctx.fillStyle = fx.progressColor || '#A855F7'; ctx.fillRect(0, H - 14, W * p, 14);
  }
}
