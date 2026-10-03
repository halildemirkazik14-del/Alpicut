// Alpicut — çizim fonksiyonları (klip, katman, yazı, CTA, skor, altyazı, efektler)
import { filterString } from './presets.js';

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
  const s = { alpha: 1, tx: 0, ty: 0, sc: 1, rot: 0, blur: 0, reveal: 1, glow: 0 };
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
  }
  const lt = Math.max(0, local);
  switch (a.loop) {
    case 'pulse': s.sc *= 1 + 0.06 * Math.sin(lt * Math.PI * 3); break;
    case 'float': s.ty += Math.sin(lt * Math.PI) * 14; break;
    case 'shake': s.tx += Math.sin(lt * 61) * 6; s.rot += Math.sin(lt * 47) * 0.012; break;
    case 'wiggle': s.rot += Math.sin(lt * Math.PI * 2.4) * 0.07; break;
    case 'glow': s.glow = 0.5 + 0.5 * Math.sin(lt * Math.PI * 2); break;
  }
  return s;
}

// ---------- Medya çizimi ----------
export function mediaSize(el) {
  if (!el) return [0, 0];
  if (el.videoWidth) return [el.videoWidth, el.videoHeight];
  return [el.naturalWidth || el.width || 0, el.naturalHeight || el.height || 0];
}
export function isReady(el) {
  if (!el) return false;
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

export function drawClip(ctx, clip, el, localT, len, env) {
  const { W, H, S } = env;
  if (!isReady(el)) return;
  const fit = clip.fit || 'cover';
  let zoom = clip.zoom || 1;
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
  drawFit(ctx, el, 0, 0, W, H, fit, zoom, clip.panX || 0, clip.panY || 0);
  ctx.restore();
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
  const tw = L.anim?.in === 'typewriter' ? st.reveal * totalChars : Infinity;
  const ww = L.anim?.in === 'words' ? st.reveal * totalWords : Infinity;
  let charCount = 0, wordIdx = 0;
  const glow = st.glow || 0;

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
      charCount += wd.t.length; wordIdx++;
      if (txt && a > 0) {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(x + wd.w / 2, y + dy);
        ctx.scale(sc, sc);
        ctx.translate(-wd.w / 2, 0);
        ctx.font = fontStr(L, L.size);
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
        ctx.fillStyle = wd.accent ? (L.accent || L.color) : L.color;
        ctx.fillText(txt, 0, 0);
        ctx.restore();
      }
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
};
const pathCache = {};
export function iconPath(name) {
  if (!pathCache[name]) pathCache[name] = new Path2D(ICON_PATHS[name] || ICON_PATHS.play);
  return pathCache[name];
}
export const ICON_NAMES = [
  ['bell', 'Zil'], ['thumb', 'Beğeni'], ['heart', 'Kalp'], ['userPlus', 'Takip'], ['bubble', 'Yorum'],
  ['share', 'Paylaş'], ['bookmark', 'Kaydet'], ['play', 'Oynat'], ['at', '@'], ['link', 'Link'], ['check', 'Onay'],
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
  ctx.font = `800 54px "Barlow Condensed", "Barlow", sans-serif`;
  try { ctx.letterSpacing = '1px'; } catch (_) { /* yoksay */ }
  const tw = label ? ctx.measureText(label).width : 0;
  const round = L.style === 'round' || !label;
  const w = round ? h : tw + isz + 104;
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
  } else {
    roundRect(ctx, -w / 2, -h / 2, w, h, round ? h / 2 : h / 2);
    ctx.fillStyle = bg; ctx.fill();
  }
  ctx.restore();
  const fg = L.style === 'outline' ? L.color : (L.style === 'glass' ? (L.color || '#fff') : L.textColor);
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
export function drawLayer(ctx, L, t, env, el, still = false) {
  const { W, H, S } = env;
  // still: düzenlerken seçili katman animasyonsuz, tam haliyle görünür
  const st = still ? { alpha: 1, tx: 0, ty: 0, sc: 1, rot: 0, blur: 0, reveal: 1, glow: 0 } : animState(L, t, W, H);
  if (st.alpha <= 0.001 || st.sc <= 0.001) return null;
  ctx.save();
  ctx.globalAlpha = clamp((L.opacity ?? 1) * st.alpha);
  ctx.translate(L.x * W + st.tx, L.y * H + st.ty);
  ctx.rotate(((L.rot || 0) * Math.PI) / 180 + st.rot);
  ctx.scale(st.sc, st.sc);
  if (st.blur > 0.5) ctx.filter = `blur(${st.blur * S}px)`;
  let box = null;
  if (L.kind === 'text') box = drawText(ctx, L, st, env);
  else if (L.kind === 'cta') box = drawCTA(ctx, L, t, env);
  else if (L.kind === 'score') box = drawScore(ctx, L, t, env);
  else if (L.kind === 'media') box = drawMediaLayer(ctx, L, t, env, el, st);
  ctx.restore();
  return box;
}

function drawMediaLayer(ctx, L, t, env, el, st) {
  const { W, S } = env;
  if (!isReady(el)) return { w: L.w * W, h: L.w * W };
  const [sw, sh] = mediaSize(el);
  const w = (L.w || 0.6) * W;
  const h = L.crop === 'square' ? w : L.crop === 'circle' ? w : w * (sh / sw);
  let zoom = 1;
  if (L.kenburns) zoom = 1 + 0.15 * clamp((t - L.start) / Math.max(0.1, L.end - L.start));
  const r = L.crop === 'circle' ? w / 2 : (L.radius || 0);
  if (L.shadowOn) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 10 * S;
    roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = '#000'; ctx.fill();
    ctx.restore();
  }
  ctx.save();
  roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip();
  const fs = filterString(L.filters, S);
  const blur = st.blur > 0.5 ? ` blur(${st.blur * S}px)` : '';
  ctx.filter = (fs === 'none' ? '' : fs) + blur || 'none';
  drawFit(ctx, el, -w / 2, -h / 2, w, h, 'cover', zoom);
  ctx.restore();
  if (L.borderW > 0) {
    ctx.save();
    roundRect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.lineWidth = L.borderW; ctx.strokeStyle = L.borderColor || '#fff'; ctx.stroke();
    ctx.restore();
  }
  return { w, h };
}

// ---------- Altyazı ----------
export function wordTimings(cue) {
  const words = cue.text.replace(/\n/g, ' ').split(/ +/).filter(Boolean);
  const weights = words.map((w) => w.length + 2);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = cue.start;
  const d = cue.end - cue.start;
  return words.map((w, i) => { const s = acc; acc += (weights[i] / sum) * d; return { t: w, s, e: acc }; });
}

export function drawSubtitles(ctx, subs, t, env) {
  if (!subs || !subs.cues?.length) return;
  const { W, H, S } = env;
  const st = subs.style;
  const tt = t - (subs.offset || 0);
  const cue = subs.cues.find((c) => tt >= c.start && tt < c.end);
  if (!cue) return;
  const words = wordTimings(cue).map((w) => ({ ...w, t: st.upper ? w.t.toLocaleUpperCase('tr-TR') : w.t }));
  let cur = words.findIndex((w) => tt >= w.s && tt < w.e);
  if (cur < 0) cur = words.length - 1;
  let show = words;
  let preset = st.preset;
  if (preset === 'pop') { const g = Math.floor(cur / 3) * 3; show = words.slice(g, g + 3); }
  if (preset === 'single') show = [words[cur]];
  const size = preset === 'single' ? st.size * 1.5 : st.size;
  ctx.save();
  ctx.font = `${st.weight} ${size}px "${st.font}", "Barlow", sans-serif`;
  try { ctx.letterSpacing = '0px'; } catch (_) { /* yoksay */ }
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  const spaceW = ctx.measureText(' ').width;
  const maxW = (st.maxW || 0.84) * W;
  const lines = [];
  let line = { ws: [], w: 0 };
  show.forEach((w) => {
    const ww = ctx.measureText(w.t).width;
    if (line.ws.length && line.w + spaceW + ww > maxW) { lines.push(line); line = { ws: [], w: 0 }; }
    line.w += (line.ws.length ? spaceW : 0) + ww; line.ws.push({ ...w, w: ww });
  });
  lines.push(line);
  const lh = size * 1.15;
  const cy = st.y * H;
  const top = cy - (lines.length * lh) / 2;
  // giriş animasyonu
  const pin = clamp((tt - cue.start) / 0.15);
  ctx.globalAlpha = pin;
  lines.forEach((ln, li) => {
    let x = W / 2 - ln.w / 2;
    const y = top + li * lh + lh / 2;
    if (preset === 'box') {
      ctx.fillStyle = hexA(st.boxColor || '#000', 0.72);
      roundRect(ctx, x - 22, y - lh / 2 - 4, ln.w + 44, lh + 8, 14); ctx.fill();
    }
    ln.ws.forEach((w) => {
      const idx = words.indexOf(words.find((q) => q.s === w.s));
      const active = idx === cur;
      let s = 1;
      if ((preset === 'pop' || preset === 'single')) { const wp = clamp((tt - w.s) / 0.12); s = 0.7 + 0.3 * easeOutBack(wp); if (tt < w.s) s = preset === 'single' ? 1 : 0.85; }
            ctx.save();
      ctx.translate(x + w.w / 2, y); ctx.scale(s, s); ctx.translate(-w.w / 2, 0);
      if (preset === 'pop' && tt < w.s) ctx.globalAlpha *= 0.0;
      if (st.strokeW > 0 && preset !== 'box') { ctx.strokeStyle = st.strokeColor; ctx.lineWidth = st.strokeW; ctx.strokeText(w.t, 0, 0); }
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10 * S;
      ctx.fillStyle = (preset === 'karaoke' || preset === 'pop') && active ? st.accent : (preset === 'single' ? st.accent : st.color);
      if (preset === 'classic' || preset === 'box') ctx.fillStyle = st.color;
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
