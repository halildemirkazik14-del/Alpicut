// Alpicut v1.8 — Düğün & nişan: zarif isim açılışları, monogram, tarihi kaydedin, davetiye, yemin, yüzükler,
// büyük güne kalan gün, kına gecesi, aile alt bantları, gül yaprakları, bölüm başlıkları, kapanış.
import {
  F, UI, SERIF, DISPLAY, clamp, roundRect, easeOut, easeOut5, easeIO, back, lerp, hash, seg, hexA, mixHex,
  spaced, measureSpaced, wrap, glow, twinkle, strokeReveal, circlePts, fitFont,
} from './motionkit.js';

const MONT = 'Montserrat';
export const WD_FULL = ['wd_petals'];
export const WD_FIELDS = {
  wd_names: ['n1', 'n2', 'date', 'place', 'bg', 'accent', 'color'],
  wd_monogram: ['n1', 'n2', 'date', 'bg', 'accent', 'color'],
  wd_save: ['title', 'date', 'day', 'month', 'bg', 'accent', 'color'],
  wd_invite: ['title', 'n1', 'n2', 'date', 'place', 'bg', 'accent', 'color'],
  wd_vows: ['text', 'name', 'bg', 'accent', 'color'],
  wd_rings: ['title', 'date', 'accent', 'color'],
  wd_days: ['from', 'title', 'n1', 'n2', 'bg', 'accent', 'color'],
  wd_kina: ['title', 'n1', 'date', 'accent', 'bg'],
  wd_lower: ['name', 'title', 'accent', 'color'],
  wd_petals: ['count', 'accent', 'accent2'],
  wd_end: ['title', 'n1', 'n2', 'date', 'accent', 'color'],
  wd_chapter: ['num', 'title', 'sub', 'accent', 'color'],
};
export const WD_META = {
  n1: { label: '1. isim', type: 'text' }, n2: { label: '2. isim', type: 'text' },
  date: { label: 'Tarih', type: 'text' }, place: { label: 'Yer / saat', type: 'text' },
  day: { label: 'Gün (takvimde işaretlenen)', type: 'number' }, month: { label: 'Ay ve yıl', type: 'text' },
  num: { label: 'Bölüm numarası', type: 'text' },
};

// ince yaprak dalı (çizgi sanatı) — bir yay boyunca yapraklar
function laurel(ctx, R, a0, a1, side, p, color, S) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const pts = []; const n = 60;
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
  strokeReveal(ctx, pts, p);
  const leaves = 9;
  for (let i = 1; i < leaves; i++) {
    const f = i / leaves; if (f > p) break;
    const a = lerp(a0, a1, f), x = Math.cos(a) * R, y = Math.sin(a) * R;
    const tang = a + (a1 > a0 ? Math.PI / 2 : -Math.PI / 2);
    [-1, 1].forEach((s) => {
      const la = tang + s * 0.7 * side; const lp = easeOut(seg(p, f, f + 0.12));
      ctx.save(); ctx.translate(x, y); ctx.rotate(la); ctx.scale(lp, lp);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -14, 0, -34); ctx.quadraticCurveTo(-10, -14, 0, 0); ctx.globalAlpha *= 0.9; ctx.fill(); ctx.restore();
    });
  }
  void S;
}
function sparkles(ctx, lt, n, w, h, color, seed = 1) {
  for (let i = 0; i < n; i++) {
    const ph = (lt * (0.3 + hash(i + seed) * 0.5) + hash(i * 3 + seed)) % 1;
    const x = (hash(i * 7 + seed) - 0.5) * w, y = (hash(i * 11 + seed) - 0.5) * h - ph * 40;
    twinkle(ctx, x, y, 6 + 10 * hash(i + 5), color, Math.sin(ph * Math.PI) * 0.9);
  }
}
const bgCard = (ctx, L, W, H, S, r = 8) => {
  if (!L.bg) return;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 50 * S; ctx.shadowOffsetY = 18 * S; roundRect(ctx, -W / 2, -H / 2, W, H, r); ctx.fillStyle = L.bg; ctx.fill(); ctx.restore();
};

export const WD_DRAW = {
  // ---------- İsimler: ince çizgiler açılır, isimler harf harf yükselir ----------
  wd_names(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#B8945A', col = L.color || '#FFFFFF', W = 940, H = 720;
    bgCard(ctx, L, W, H, S);
    ctx.textAlign = 'center';
    const lp = easeIO(seg(lt, 0.1, 1.1));
    ctx.strokeStyle = a; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-lp * 320, -215); ctx.lineTo(lp * 320, -215); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-lp * 320, 215); ctx.lineTo(lp * 320, 215); ctx.stroke();
    [[-1], [1]].forEach(([s]) => { ctx.fillStyle = a; ctx.save(); ctx.translate(s * lp * 330, -215); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); ctx.save(); ctx.translate(s * lp * 330, 215); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); });
    const name = (txt, y, t0) => {
      const s = String(txt || ''); fitFont(ctx, s, 820, 120, (z) => F(400, z, DISPLAY, true));
      const chars = [...s]; const ws = chars.map((c) => ctx.measureText(c).width); let x = -ws.reduce((p, q) => p + q, 0) / 2;
      chars.forEach((ch, i) => { const p = easeOut5(seg(lt, t0 + i * 0.04, t0 + i * 0.04 + 0.7)); ctx.save(); ctx.globalAlpha *= p; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(ch, x, y + (1 - p) * 30); ctx.restore(); x += ws[i]; });
    };
    name(L.n1 || 'Ayşe', -85, 0.5);
    const ap = easeOut(seg(lt, 1.1, 1.8));
    ctx.save(); ctx.globalAlpha *= ap; ctx.font = F(400, 86, DISPLAY, true); glow(ctx, hexA(a, 0.6), 18, S, () => { ctx.fillStyle = a; ctx.fillText('&', 0, 28); }); ctx.restore();
    name(L.n2 || 'Mehmet', 160, 1.3);
    const dp = easeOut(seg(lt, 2.0, 2.8));
    ctx.save(); ctx.globalAlpha *= dp; ctx.fillStyle = col; ctx.font = F(400, 30, MONT); spaced(ctx, String(L.date || '14 . 09 . 2026').toLocaleUpperCase('tr-TR'), 0, 285, 12 * (0.6 + 0.4 * dp));
    if (L.place) { ctx.fillStyle = hexA(col, 0.75); ctx.font = F(400, 26, MONT); spaced(ctx, String(L.place).toLocaleUpperCase('tr-TR'), 0, 330, 8); }
    ctx.restore();
    sparkles(ctx, lt, 14, 800, 500, mixHex(a, '#FFFFFF', 0.4));
    ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- Monogram: halka + defne dalı + baş harfler ----------
  wd_monogram(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#B8945A', col = L.color || '#3A3029', R = 230;
    if (L.bg) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 50 * S; ctx.shadowOffsetY = 18 * S; ctx.beginPath(); ctx.arc(0, 0, 390, 0, Math.PI * 2); ctx.fillStyle = L.bg; ctx.fill(); ctx.restore(); }
    ctx.lineWidth = 2.5; ctx.strokeStyle = a;
    strokeReveal(ctx, circlePts(0, -20, R, -Math.PI / 2, 120), easeIO(seg(lt, 0, 1.4)));
    strokeReveal(ctx, circlePts(0, -20, R - 16, Math.PI / 2, 120), easeIO(seg(lt, 0.2, 1.6)));
    ctx.save(); ctx.translate(0, -20);
    laurel(ctx, R + 40, Math.PI * 0.62, Math.PI * 1.18, 1, easeOut(seg(lt, 0.6, 2.2)), a, S);
    laurel(ctx, R + 40, Math.PI * 0.38, -Math.PI * 0.18, -1, easeOut(seg(lt, 0.6, 2.2)), a, S);
    ctx.restore();
    const i1 = String(L.n1 || 'A').trim()[0] || 'A', i2 = String(L.n2 || 'M').trim()[0] || 'M';
    const p = easeOut5(seg(lt, 1.0, 1.9));
    ctx.textAlign = 'center';
    ctx.save(); ctx.globalAlpha *= p; ctx.fillStyle = col; ctx.font = F(400, 190, DISPLAY);
    ctx.fillText(i1.toLocaleUpperCase('tr-TR'), -95 - (1 - p) * 40, 40); ctx.fillText(i2.toLocaleUpperCase('tr-TR'), 95 + (1 - p) * 40, 40);
    ctx.strokeStyle = a; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(0, 70); ctx.stroke();
    ctx.restore();
    const dp = easeOut(seg(lt, 1.8, 2.6));
    ctx.save(); ctx.globalAlpha *= dp; ctx.fillStyle = col; ctx.font = F(500, 30, MONT); spaced(ctx, String(L.date || '14.09.2026'), 0, R + 130, 10); ctx.restore();
    ctx.textAlign = 'left';
    return { w: 800, h: 860 };
  },

  // ---------- Tarihi kaydedin: takvim, gün elle çizilmiş kalple işaretlenir ----------
  wd_save(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#B76E79', col = L.color || '#4A3036', bg = L.bg || '#FBF4F1', W = 820, H = 940;
    const ip = easeOut5(seg(lt, 0, 0.7));
    ctx.save(); ctx.translate(0, (1 - ip) * 80); ctx.globalAlpha *= ip;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 50 * S; ctx.shadowOffsetY = 18 * S; roundRect(ctx, -W / 2, -H / 2, W, H, 18); ctx.fillStyle = bg; ctx.fill(); ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = col;
    ctx.font = F(400, 96, DISPLAY, true); ctx.fillText(L.title || 'Tarihi Kaydedin', 0, -H / 2 + 150);
    ctx.font = F(500, 34, MONT); spaced(ctx, String(L.month || 'EYLÜL 2026').toLocaleUpperCase('tr-TR'), 0, -H / 2 + 230, 14);
    const days = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P']; const cw = 96, x0 = -cw * 3, y0 = -H / 2 + 320;
    ctx.font = F(600, 26, MONT); ctx.fillStyle = hexA(col, 0.6); days.forEach((d, i) => ctx.fillText(d, x0 + i * cw, y0));
    const day = Math.max(1, Math.min(31, Math.round(+L.day || 14))); const start = 1;
    ctx.font = F(400, 36, MONT);
    for (let dnum = 1; dnum <= 30; dnum++) {
      const k = dnum - 1 + start, r = Math.floor(k / 7), c = k % 7, x = x0 + c * cw, y = y0 + 80 + r * 92;
      const ap = easeOut(seg(lt, 0.4 + dnum * 0.02, 0.7 + dnum * 0.02));
      ctx.fillStyle = hexA(col, dnum === day ? 1 : 0.75 * ap); ctx.font = dnum === day ? F(700, 40, MONT) : F(400, 36, MONT); ctx.fillText(String(dnum), x, y);
      if (dnum === day) {
        const hp = easeIO(seg(lt, 1.4, 2.4));
        const hpts = []; for (let i = 0; i <= 80; i++) { const t = (i / 80) * Math.PI * 2; hpts.push([x + 2.6 * 16 * Math.pow(Math.sin(t), 3), y - 12 - 2.6 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
        ctx.strokeStyle = a; ctx.lineWidth = 5; ctx.lineCap = 'round'; strokeReveal(ctx, hpts, hp);
      }
    }
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- Davetiye kartı: süslü çerçeve + bilgiler sırayla ----------
  wd_invite(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#B8945A', col = L.color || '#3A3029', bg = L.bg || '#FBF7EF', W = 820, H = 1060;
    const ip = easeOut5(seg(lt, 0, 0.8));
    ctx.save(); ctx.scale(lerp(0.94, 1, ip), lerp(0.94, 1, ip)); ctx.globalAlpha *= ip;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 50 * S; ctx.shadowOffsetY = 18 * S; ctx.fillStyle = bg; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
    ctx.strokeStyle = a; ctx.lineWidth = 2;
    const fp = easeIO(seg(lt, 0.2, 1.4));
    strokeReveal(ctx, [[-W / 2 + 40, -H / 2 + 40], [W / 2 - 40, -H / 2 + 40], [W / 2 - 40, H / 2 - 40], [-W / 2 + 40, H / 2 - 40], [-W / 2 + 40, -H / 2 + 40]], fp);
    ctx.lineWidth = 1; strokeReveal(ctx, [[W / 2 - 54, H / 2 - 54], [-W / 2 + 54, H / 2 - 54], [-W / 2 + 54, -H / 2 + 54], [W / 2 - 54, -H / 2 + 54], [W / 2 - 54, H / 2 - 54]], fp);
    // üst süs
    const op = easeOut(seg(lt, 0.8, 1.6));
    ctx.save(); ctx.translate(0, -H / 2 + 140); ctx.globalAlpha *= op; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-120, 0); ctx.bezierCurveTo(-60, -40, -20, 30, 0, 0); ctx.bezierCurveTo(20, 30, 60, -40, 120, 0); ctx.stroke();
    ctx.fillStyle = a; ctx.save(); ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.restore(); ctx.restore();
    ctx.textAlign = 'center';
    const row = (t0, fn) => { const p = easeOut(seg(lt, t0, t0 + 0.7)); ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 16); fn(); ctx.restore(); };
    row(1.0, () => { ctx.fillStyle = hexA(col, 0.75); ctx.font = F(500, 26, MONT); spaced(ctx, String(L.title || 'DÜĞÜNÜMÜZE DAVETLİSİNİZ').toLocaleUpperCase('tr-TR'), 0, -H / 2 + 250, 8); });
    row(1.3, () => { ctx.fillStyle = col; fitFont(ctx, L.n1 || 'Ayşe', 680, 110, (z) => F(400, z, DISPLAY, true)); ctx.fillText(L.n1 || 'Ayşe', 0, -H / 2 + 400); });
    row(1.5, () => { ctx.fillStyle = a; ctx.font = F(400, 70, DISPLAY, true); ctx.fillText('&', 0, -H / 2 + 490); });
    row(1.7, () => { ctx.fillStyle = col; fitFont(ctx, L.n2 || 'Mehmet', 680, 110, (z) => F(400, z, DISPLAY, true)); ctx.fillText(L.n2 || 'Mehmet', 0, -H / 2 + 600); });
    row(2.1, () => { ctx.fillStyle = a; ctx.fillRect(-60, -H / 2 + 650, 120, 2); ctx.fillStyle = col; ctx.font = F(600, 34, MONT); spaced(ctx, String(L.date || '14 EYLÜL 2026 · 19.00').toLocaleUpperCase('tr-TR'), 0, -H / 2 + 720, 6); });
    row(2.4, () => { ctx.fillStyle = hexA(col, 0.75); ctx.font = F(400, 30, SERIF, true); wrap(ctx, L.place || 'Çırağan Bahçesi, İstanbul', 640).forEach((l, i) => ctx.fillText(l, 0, -H / 2 + 790 + i * 42)); });
    ctx.restore(); ctx.textAlign = 'left';
    sparkles(ctx, lt, 10, W, H, mixHex(a, '#FFFFFF', 0.4), 3);
    return { w: W + 40, h: H + 40 };
  },

  // ---------- Yemin / söz: satır satır italik ----------
  wd_vows(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#B8945A', col = L.color || '#FFFFFF', W = 900;
    ctx.font = F(400, 58, DISPLAY, true); ctx.textAlign = 'center';
    const ls = wrap(ctx, L.text || 'Seninle her gün,\nyeniden başlamak\nen güzel hikâye.', W - 120);
    const H = ls.length * 84 + 220;
    bgCard(ctx, L, W, H, S, 20);
    ctx.fillStyle = a; ctx.font = F(400, 140, DISPLAY); ctx.globalAlpha *= 0.35 * easeOut(seg(lt, 0, 0.6)); ctx.fillText('“', 0, -H / 2 + 130); ctx.globalAlpha = 1;
    ctx.font = F(400, 58, DISPLAY, true);
    ls.forEach((l, i) => { const p = easeOut(seg(lt, 0.3 + i * 0.6, 1.1 + i * 0.6)); ctx.save(); ctx.globalAlpha *= p; ctx.fillStyle = col; ctx.fillText(l, 0, -H / 2 + 160 + i * 84 + (1 - p) * 20); ctx.restore(); });
    if (L.name) { const p = easeOut(seg(lt, 0.6 + ls.length * 0.6, 1.3 + ls.length * 0.6)); ctx.save(); ctx.globalAlpha *= p; ctx.fillStyle = a; ctx.fillRect(-40, H / 2 - 82, 80, 2); ctx.font = F(500, 26, MONT); spaced(ctx, String(L.name).toLocaleUpperCase('tr-TR'), 0, H / 2 - 40, 8); ctx.restore(); }
    ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- Yüzükler: iç içe iki halka çizilir, parıltı ----------
  wd_rings(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#D4AF37', col = L.color || '#FFFFFF', R = 120;
    const g = ctx.createLinearGradient(-R * 2, -R, R * 2, R); g.addColorStop(0, mixHex(a, '#FFFFFF', 0.5)); g.addColorStop(0.5, a); g.addColorStop(1, mixHex(a, '#5A3E10', 0.5));
    ctx.strokeStyle = g; ctx.lineWidth = 16; ctx.lineCap = 'round';
    glow(ctx, hexA(a, 0.6), 22, S, () => {
      strokeReveal(ctx, circlePts(-70, -60, R, -Math.PI * 0.9, 120), easeIO(seg(lt, 0.1, 1.3)));
      strokeReveal(ctx, circlePts(70, -60, R, -Math.PI * 0.1, 120), easeIO(seg(lt, 0.4, 1.6)));
    });
    // taş
    const dp = back(seg(lt, 1.5, 2.0));
    ctx.save(); ctx.translate(-70, -60 - R - 10); ctx.scale(dp, dp); ctx.fillStyle = '#EAF6FF'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(24, -6); ctx.lineTo(0, 24); ctx.lineTo(-24, -6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#9CC9E8'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    twinkle(ctx, -50, -60 - R - 30, 26 * Math.max(0, Math.sin(lt * 3)) * dp, '#FFFFFF');
    ctx.textAlign = 'center';
    const tp = easeOut(seg(lt, 1.4, 2.2));
    ctx.save(); ctx.globalAlpha *= tp; ctx.fillStyle = col; ctx.font = F(400, 92, DISPLAY, true); ctx.fillText(L.title || 'Evet dedik', 0, 180);
    if (L.date) { ctx.font = F(500, 30, MONT); ctx.fillStyle = hexA(col, 0.8); spaced(ctx, String(L.date).toLocaleUpperCase('tr-TR'), 0, 240, 10); }
    ctx.restore(); ctx.textAlign = 'left';
    return { w: 760, h: 640 };
  },

  // ---------- Büyük güne kalan gün ----------
  wd_days(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#7D8F69', col = L.color || '#2F3A2A', W = 760, H = 820;
    if (L.bg) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 50 * S; ctx.shadowOffsetY = 18 * S; ctx.beginPath(); ctx.arc(0, 0, 390, 0, Math.PI * 2); ctx.fillStyle = L.bg; ctx.fill(); ctx.restore(); }
    const n = Math.max(0, Math.round(+L.from || 30));
    const cp = easeOut5(seg(lt, 0.2, 1.8));
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA(col, 0.7); ctx.font = F(500, 28, MONT); spaced(ctx, String(L.title || 'BÜYÜK GÜNE').toLocaleUpperCase('tr-TR'), 0, -190, 12);
    ctx.fillStyle = col; ctx.font = F(400, 260, DISPLAY); ctx.fillText(String(Math.round(lerp(n + 60, n, cp))), 0, 90);
    ctx.font = F(400, 70, DISPLAY, true); ctx.fillStyle = a; ctx.fillText('gün', 0, 180);
    laurel(ctx, 300, Math.PI * 0.62, Math.PI * 0.95, 1, easeOut(seg(lt, 0.4, 2.0)), a, S);
    laurel(ctx, 300, Math.PI * 0.38, Math.PI * 0.05, -1, easeOut(seg(lt, 0.4, 2.0)), a, S);
    if (L.n1 || L.n2) { const p = easeOut(seg(lt, 1.6, 2.3)); ctx.save(); ctx.globalAlpha *= p; ctx.fillStyle = col; ctx.font = F(400, 40, DISPLAY, true); ctx.fillText(`${L.n1 || ''} & ${L.n2 || ''}`, 0, 290); ctx.restore(); }
    ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- Kına gecesi: kırmızı-altın geometrik desen ----------
  wd_kina(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#E0C27A', bg = L.bg || '#7A0F1A', W = 860, H = 1000;
    const ip = easeOut5(seg(lt, 0, 0.8));
    ctx.save(); ctx.globalAlpha *= ip;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 50 * S; roundRect(ctx, -W / 2, -H / 2, W, H, 24); ctx.fillStyle = bg; ctx.fill(); ctx.restore();
    ctx.save(); roundRect(ctx, -W / 2, -H / 2, W, H, 24); ctx.clip();
    // sekiz köşeli yıldız deseni
    const star8 = (x, y, r) => { ctx.beginPath(); for (let i = 0; i < 16; i++) { const rr = i % 2 ? r * 0.55 : r, an = (i / 16) * Math.PI * 2 + Math.PI / 8; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } ctx.closePath(); };
    ctx.strokeStyle = hexA(a, 0.22); ctx.lineWidth = 2;
    for (let y = -H / 2; y <= H / 2 + 100; y += 100) for (let x = -W / 2; x <= W / 2 + 100; x += 100) { const p = easeOut(seg(lt, 0.2 + hash(x + y * 3) * 0.8, 0.6 + hash(x + y * 3) * 0.8)); if (p > 0) { ctx.save(); ctx.globalAlpha *= p; star8(x + ((y / 100) % 2 ? 50 : 0), y, 34); ctx.stroke(); ctx.restore(); } }
    const vg = ctx.createRadialGradient(0, 0, 100, 0, 0, 600); vg.addColorStop(0, hexA(bg, 0.96)); vg.addColorStop(0.6, hexA(bg, 0.85)); vg.addColorStop(1, hexA(bg, 0)); ctx.fillStyle = vg; ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.restore();
    ctx.strokeStyle = a; ctx.lineWidth = 3; roundRect(ctx, -W / 2 + 34, -H / 2 + 34, W - 68, H - 68, 16); ctx.stroke();
    ctx.textAlign = 'center';
    const tp = easeOut(seg(lt, 0.6, 1.4));
    ctx.save(); ctx.globalAlpha *= tp;
    const gg = ctx.createLinearGradient(0, -150, 0, 40); gg.addColorStop(0, '#FFF2C9'); gg.addColorStop(0.5, a); gg.addColorStop(1, '#9C7322');
    ctx.font = F(400, 140, DISPLAY, true); glow(ctx, hexA(a, 0.5), 20, S, () => { ctx.fillStyle = gg; ctx.fillText(L.title || 'Kına Gecesi', 0, -20); });
    ctx.restore();
    const np = easeOut(seg(lt, 1.2, 1.9));
    ctx.save(); ctx.globalAlpha *= np; ctx.fillStyle = '#FFF6E5'; ctx.font = F(400, 64, DISPLAY); ctx.fillText(L.n1 || 'Ayşe', 0, 110);
    ctx.fillStyle = a; ctx.font = F(500, 30, MONT); spaced(ctx, String(L.date || '12 EYLÜL 2026').toLocaleUpperCase('tr-TR'), 0, 190, 10); ctx.restore();
    // asılı fener
    const sw = Math.sin(lt * 1.6) * 0.08;
    [-1, 1].forEach((s) => { ctx.save(); ctx.translate(s * 290, -H / 2 + 34); ctx.rotate(sw * s); ctx.strokeStyle = a; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 120); ctx.stroke(); ctx.fillStyle = hexA(a, 0.9); ctx.beginPath(); ctx.ellipse(0, 160, 28, 42, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,220,140,.6)'; ctx.save(); ctx.shadowColor = '#FFC14D'; ctx.shadowBlur = 40 * S; ctx.beginPath(); ctx.arc(0, 160, 12, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.restore(); });
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- Zarif alt bant (aile, tanık, konuşmacı) ----------
  wd_lower(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#D4AF37', col = L.color || '#FFFFFF';
    const lp = easeIO(seg(lt, 0, 0.8));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 20 * S;
    ctx.fillStyle = a; ctx.fillRect(-380, -10, 760 * lp, 2);
    const np = easeOut5(seg(lt, 0.4, 1.1));
    ctx.save(); ctx.beginPath(); ctx.rect(-400, -130, 900, 120); ctx.clip(); ctx.fillStyle = col; ctx.font = F(400, 84, DISPLAY, true); ctx.fillText(L.name || 'Zeynep & Ali Kaya', -380, -30 + (1 - np) * 100); ctx.restore();
    const tp = easeOut(seg(lt, 0.8, 1.4));
    ctx.globalAlpha *= tp; ctx.fillStyle = hexA(col, 0.85); ctx.font = F(500, 28, MONT); spaced(ctx, String(L.title || 'GELİNİN AİLESİ').toLocaleUpperCase('tr-TR'), -380, 42, 10, 'left');
    ctx.restore();
    return { w: 820, h: 260 };
  },

  // ---------- Gül yaprakları (tam kare kaplama) ----------
  wd_petals(ctx, L, lt, env) {
    const W = env.W, H = env.H, n = Math.max(6, Math.min(80, +L.count || 28)), a = L.accent || '#F4B6C2', b = L.accent2 || '#FFFFFF';
    for (let i = 0; i < n; i++) {
      const sp = 0.06 + hash(i) * 0.08, ph = (lt * sp + hash(i + 3)) % 1;
      const x = (hash(i * 5) - 0.5) * W + Math.sin(lt * (0.6 + hash(i)) + i) * 80, y = -H / 2 - 60 + ph * (H + 120);
      ctx.save(); ctx.translate(x, y); ctx.rotate(lt * (0.6 + hash(i + 2)) + i); ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(lt * 1.5 + i)));
      const s = 14 + hash(i + 9) * 18;
      ctx.fillStyle = i % 4 === 0 ? b : a; ctx.globalAlpha *= 0.85;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s, -s * 0.8, s * 0.8, s * 0.6, 0, s); ctx.bezierCurveTo(-s * 0.8, s * 0.6, -s, -s * 0.8, 0, -s); ctx.fill();
      ctx.restore();
    }
    return { w: W, h: H };
  },

  // ---------- Kapanış: "sonsuza dek" ----------
  wd_end(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#D4AF37', col = L.color || '#FFFFFF';
    ctx.textAlign = 'center';
    const p = easeOut(seg(lt, 0.2, 1.6));
    ctx.save(); ctx.globalAlpha *= p; ctx.fillStyle = col; ctx.font = F(400, 120, DISPLAY, true);
    glow(ctx, hexA(a, 0.45), 30, S, () => ctx.fillText(L.title || 'Sonsuza dek', 0, 0)); ctx.restore();
    const lp = easeIO(seg(lt, 1.0, 2.0)); ctx.fillStyle = a; ctx.fillRect(-160 * lp, 50, 320 * lp, 2);
    const np = easeOut(seg(lt, 1.5, 2.3));
    ctx.save(); ctx.globalAlpha *= np; ctx.fillStyle = col; ctx.font = F(500, 34, MONT); spaced(ctx, `${L.n1 || 'AYŞE'} & ${L.n2 || 'MEHMET'}`.toLocaleUpperCase('tr-TR'), 0, 120, 12);
    if (L.date) { ctx.fillStyle = hexA(col, 0.7); ctx.font = F(400, 26, MONT); spaced(ctx, String(L.date).toLocaleUpperCase('tr-TR'), 0, 170, 8); }
    ctx.restore();
    sparkles(ctx, lt, 16, 900, 400, mixHex(a, '#FFFFFF', 0.5), 7);
    ctx.textAlign = 'left';
    return { w: 960, h: 480 };
  },

  // ---------- Düğün filmi bölüm başlığı ----------
  wd_chapter(ctx, L, lt, env) {
    const a = L.accent || '#C9A27E', col = L.color || '#FFFFFF';
    ctx.textAlign = 'center';
    const p1 = easeOut(seg(lt, 0, 0.8)), p2 = easeOut5(seg(lt, 0.4, 1.3)), p3 = easeOut(seg(lt, 1.0, 1.7));
    ctx.save(); ctx.globalAlpha *= p1; ctx.fillStyle = a; ctx.font = F(500, 30, MONT); spaced(ctx, `BÖLÜM ${String(L.num || 'I')}`.toLocaleUpperCase('tr-TR'), 0, -110, 16); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-500, -90, 1000, 140); ctx.clip(); ctx.fillStyle = col; fitFont(ctx, L.title || 'Hazırlık', 900, 120, (z) => F(400, z, DISPLAY, true)); ctx.fillText(L.title || 'Hazırlık', 0, 20 + (1 - p2) * 130); ctx.restore();
    ctx.save(); ctx.globalAlpha *= p3; ctx.fillStyle = hexA(col, 0.75); ctx.font = F(400, 34, SERIF, true); ctx.fillText(L.sub || 'sabahın ilk ışıkları', 0, 100); ctx.restore();
    ctx.textAlign = 'left';
    return { w: 960, h: 360 };
  },
};

// ---------- hazır şablonlar: her tasarım birkaç zarif renk paletinde ----------
const A = (i = 'none', o = 'fade') => ({ in: i, out: o, inDur: 0.5, outDur: 0.6 });
const PAL = [
  ['Altın · fildişi', { bg: '#FBF7EF', accent: '#B8945A', color: '#3A3029' }],
  ['Gül kurusu', { bg: '#F7ECE9', accent: '#B76E79', color: '#4A3036' }],
  ['Adaçayı', { bg: '#EEF1EA', accent: '#7D8F69', color: '#2F3A2A' }],
  ['Lacivert · altın', { bg: '#14213D', accent: '#D4AF37', color: '#F5EFE0' }],
  ['Bordo · altın', { bg: '#3B0D11', accent: '#E0C27A', color: '#F7EBDD' }],
  ['Siyah · beyaz', { bg: '#FFFFFF', accent: '#111111', color: '#111111' }],
];
const OVER = [['Video üstü · altın', { accent: '#D4AF37', color: '#FFFFFF' }], ['Video üstü · beyaz', { accent: '#FFFFFF', color: '#FFFFFF' }], ['Video üstü · pembe altın', { accent: '#E8B4A0', color: '#FFFFFF' }]];
const T = [];
const add = (id, name, type, p, dur = 5) => T.push({ id, name, cat: 'Düğün & nişan', p: { type, y: 0.5, anim: A(), ...p }, dur });
PAL.forEach(([n, c], i) => add(`wd_names_${i}`, `İsimler · ${n}`, 'wd_names', { n1: 'Ayşe', n2: 'Mehmet', date: '14 . 09 . 2026', place: 'İstanbul', ...c }, 5));
OVER.forEach(([n, c], i) => add(`wd_namesv_${i}`, `İsimler · ${n}`, 'wd_names', { n1: 'Elif', n2: 'Can', date: '21 . 06 . 2026', ...c }, 5));
PAL.forEach(([n, c], i) => add(`wd_mono_${i}`, `Monogram · ${n}`, 'wd_monogram', { n1: 'Ayşe', n2: 'Mehmet', date: '14.09.2026', ...c }, 5));
PAL.slice(0, 4).forEach(([n, c], i) => add(`wd_save_${i}`, `Tarihi kaydedin · ${n}`, 'wd_save', { day: 14, month: 'Eylül 2026', ...c, accent: i === 3 ? '#D4AF37' : c.accent }, 5));
PAL.forEach(([n, c], i) => add(`wd_inv_${i}`, `Davetiye · ${n}`, 'wd_invite', { n1: 'Ayşe', n2: 'Mehmet', date: '14 Eylül 2026 · 19.00', place: 'Çırağan Bahçesi, İstanbul', ...c }, 6));
add('wd_inv_nisan', 'Nişan davetiyesi', 'wd_invite', { title: 'NİŞANIMIZA DAVETLİSİNİZ', n1: 'Zeynep', n2: 'Burak', date: '3 Mayıs 2026 · 18.00', place: 'Bahçe Restoran, Antalya', ...PAL[1][1] }, 6);
add('wd_inv_soz', 'Söz davetiyesi', 'wd_invite', { title: 'SÖZÜMÜZE DAVETLİSİNİZ', n1: 'Merve', n2: 'Emre', date: '18 Nisan 2026 · 17.00', place: 'Aile evi, Bursa', ...PAL[2][1] }, 6);
[['Seninle her gün,\nyeniden başlamak\nen güzel hikâye.', 'Mehmet'], ['Elini tuttuğum an\nevim oldun.', 'Ayşe'], ['Bütün yollar\nsana çıkıyormuş.', '']].forEach(([t, nm], i) => {
  add(`wd_vow_${i}`, `Söz / yemin ${i + 1} · video üstü`, 'wd_vows', { text: t, name: nm, accent: '#D4AF37', color: '#FFFFFF' }, 6);
  add(`wd_vowc_${i}`, `Söz / yemin ${i + 1} · kart`, 'wd_vows', { text: t, name: nm, ...PAL[i][1] }, 6);
});
[['Evet dedik', '14.09.2026', {}], ['Nişanlandık', '03.05.2026', { accent: '#E8B4A0' }], ['Söz kesildi', '18.04.2026', { accent: '#C0C0C0' }], ['Mutlu yıllar', '10. YIL', { accent: '#D4AF37' }]]
  .forEach(([t, d, o], i) => add(`wd_ring_${i}`, `Yüzükler · ${t}`, 'wd_rings', { title: t, date: d, ...o }, 4.5));
PAL.slice(0, 4).forEach(([n, c], i) => add(`wd_days_${i}`, `Büyük güne kalan · ${n}`, 'wd_days', { from: 30, n1: 'Ayşe', n2: 'Mehmet', ...c }, 4));
[['Kına Gecesi', {}], ['Kına Gecesi · lacivert', { bg: '#14213D', accent: '#E0C27A' }], ['Kına Gecesi · mor', { bg: '#3B1748', accent: '#E8C77A' }], ['Hoş geldiniz', { title: 'Hoş Geldiniz' }]]
  .forEach(([n, o], i) => add(`wd_kina_${i}`, n, 'wd_kina', { title: 'Kına Gecesi', n1: 'Ayşe', date: '12 Eylül 2026', ...o }, 5));
[['Gelinin ailesi', 'Zeynep & Ali Kaya'], ['Damadın ailesi', 'Fatma & Hasan Demir'], ['Nikâh şahidi', 'Selin Aydın'], ['Gelin', 'Ayşe Kaya'], ['Damat', 'Mehmet Demir']]
  .forEach(([t, nm], i) => OVER.slice(0, 2).forEach(([pn, c], j) => add(`wd_low_${i}_${j}`, `Alt bant · ${t}${j ? ' · beyaz' : ''}`, 'wd_lower', { title: t, name: nm, x: 0.5, y: 0.82, ...c }, 4)));
add('wd_pet_0', 'Gül yaprakları (pembe)', 'wd_petals', { count: 28 }, 8);
add('wd_pet_1', 'Gül yaprakları (beyaz)', 'wd_petals', { count: 30, accent: '#FFFFFF', accent2: '#F7E7CE' }, 8);
add('wd_pet_2', 'Gül yaprakları (kırmızı)', 'wd_petals', { count: 24, accent: '#C81D3A', accent2: '#F4B6C2' }, 8);
[['Sonsuza dek', {}], ['Ve mutlu sona…', { accent: '#E8B4A0' }], ['Teşekkürler', { accent: '#FFFFFF' }]]
  .forEach(([t, o], i) => add(`wd_end_${i}`, `Kapanış · ${t}`, 'wd_end', { title: t, n1: 'Ayşe', n2: 'Mehmet', date: '14.09.2026', ...o }, 5));
[['I', 'Hazırlık', 'sabahın ilk ışıkları'], ['II', 'İlk Bakış', 'kalbin durduğu an'], ['III', 'Tören', 'evet dediğimiz yer'], ['IV', 'Kutlama', 'gece boyunca dans'], ['V', 'Yeni Başlangıç', 'birlikte, her gün']]
  .forEach(([n, t, s], i) => add(`wd_ch_${i}`, `Bölüm başlığı · ${t}`, 'wd_chapter', { num: n, title: t, sub: s }, 4));
export const WD_TEMPLATES = T;
