// Alpicut v1.8 — Nostalji: 70'ler, 80'ler, 90'lar. VHS, kamera kaydı, Super 8, synthwave, disko, polaroid, kaset,
// tüplü TV, arcade, sessiz film ara yazısı, gazete manşeti, eski işletim sistemi penceresi, teletekst, motel neonu.
// Hepsi özgün çizim; marka/logo kopyalanmaz.
import {
  F, UI, SERIF, DISPLAY, MONO, COND, clamp, roundRect, easeOut, easeOut5, easeIO, back, spring, lerp, hash, seg, hexA, mixHex,
  spaced, wrap, glow, grain, scanlines, pixelText, pixelWidth, twinkle, fitFont,
} from './motionkit.js';

const AY = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
const tc = (s) => { s = Math.max(0, s); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(Math.floor(s) % 60).padStart(2, '0')}`; };
const SCRIPT = 'Pacifico';
const HAND = 'Caveat';

export const NO_FULL = ['no_vhs', 'no_camcorder', 'no_super8', 'no_datestamp'];
export const NO_FIELDS = {
  no_vhs: ['title', 'text', 'year'],
  no_camcorder: ['text', 'year', 'accent'],
  no_super8: ['accent'],
  no_datestamp: ['text', 'accent'],
  no_synthtitle: ['text', 'sub', 'accent', 'accent2'],
  no_groovy: ['text', 'accent', 'accent2', 'color'],
  no_disco: ['text', 'sub', 'accent'],
  no_polaroid: ['text', 'v1', 'accent'],
  no_cassette: ['text', 'sub', 'accent', 'accent2'],
  no_crttitle: ['text', 'sub', 'accent'],
  no_arcade: ['text', 'sub', 'accent'],
  no_intertitle: ['text', 'accent'],
  no_newspaper: ['title', 'text', 'sub', 'year'],
  no_oldos: ['title', 'text', 'btn', 'accent'],
  no_teletext: ['title', 'lines', 'accent'],
  no_motel: ['text', 'sub', 'accent', 'accent2'],
};
export const NO_META = {
  year: { label: 'Yıl', type: 'text' },
};

function osdShadow(ctx, fn) { ctx.save(); ctx.translate(4, 4); ctx.globalAlpha *= 0.6; fn('#000'); ctx.restore(); fn(null); }

export const NO_DRAW = {
  // ---------- VHS ekran yazısı (tam kare kaplama) ----------
  no_vhs(ctx, L, lt, env) {
    const W = env.W, H = env.H, px = Math.round(W / 150);
    const yr = String(L.year || '1989'), d = new Date();
    // iz kayması bandı ve parazit
    const band = (((lt * 0.18) % 1) * 1.3 - 0.15) * H - H / 2;
    ctx.save();
    for (let i = 0; i < 40; i++) { const y = band + i * 3; ctx.fillStyle = `rgba(255,255,255,${0.05 * hash(i + Math.floor(lt * 30))})`; ctx.fillRect(-W / 2 + hash(i * 3 + lt) * 40, y, W, 2); }
    const nb = H / 2 - 50 - (Math.sin(lt * 2) * 10);
    for (let i = 0; i < 160; i++) { const r = hash(i * 9.1 + Math.floor(lt * 24)); ctx.fillStyle = `rgba(255,255,255,${r * 0.35})`; ctx.fillRect(-W / 2 + hash(i + Math.floor(lt * 24) * 7) * W, nb + hash(i * 5) * 40, 10 + r * 50, 2); }
    // renk taşması kenarları
    ctx.fillStyle = 'rgba(255,0,80,.035)'; ctx.fillRect(-W / 2, -H / 2, W, H);
    scanlines(ctx, W, H, 0.12, 4);
    ctx.restore();
    const blink = Math.floor(lt * 1.6) % 2 === 0;
    const X0 = -W / 2 + px * 14, Y0 = -H / 2 + px * 22;
    osdShadow(ctx, (c) => {
      pixelText(ctx, L.title || 'PLAY', X0, Y0, px, c || '#FFFFFF', 'left');
      if (blink || c) { const tw = pixelWidth(L.title || 'PLAY', px); ctx.fillStyle = c || '#FFFFFF'; ctx.beginPath(); ctx.moveTo(X0 + tw + px * 3, Y0 - px * 7); ctx.lineTo(X0 + tw + px * 9, Y0 - px * 3.5); ctx.lineTo(X0 + tw + px * 3, Y0); ctx.fill(); }
      pixelText(ctx, 'SP', W / 2 - px * 14, Y0, px, c || '#FFFFFF', 'right');
      pixelText(ctx, tc(lt + 754), X0, H / 2 - px * 20, px, c || '#FFFFFF', 'left');
      pixelText(ctx, `${AY[d.getMonth()]}. ${String(d.getDate()).padStart(2, '0')} ${yr}`, W / 2 - px * 14, H / 2 - px * 20, px, c || '#FFFFFF', 'right');
      if (L.text) pixelText(ctx, L.text, W / 2 - px * 14, H / 2 - px * 31, px, c || '#FFFFFF', 'right');
    });
    return { w: W, h: H };
  },

  // ---------- 90'lar el kamerası (tam kare) ----------
  no_camcorder(ctx, L, lt, env) {
    const W = env.W, H = env.H, px = Math.round(W / 160), a = L.accent || '#FF8A1F';
    const m = px * 14;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = px * 0.9;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { const X = sx * (W / 2 - m), Y = sy * (H / 2 - m); ctx.beginPath(); ctx.moveTo(X, Y - sy * px * 14); ctx.lineTo(X, Y); ctx.lineTo(X - sx * px * 14, Y); ctx.stroke(); });
    // merkez artısı
    ctx.beginPath(); ctx.moveTo(-px * 6, 0); ctx.lineTo(px * 6, 0); ctx.moveTo(0, -px * 6); ctx.lineTo(0, px * 6); ctx.stroke();
    const blink = Math.floor(lt * 1.4) % 2 === 0;
    const X0 = -W / 2 + m + px * 8, Y0 = -H / 2 + m + px * 16;
    osdShadow(ctx, (c) => {
      if (blink || c) { ctx.fillStyle = c || '#FF2B2B'; ctx.beginPath(); ctx.arc(X0 + px * 3.5, Y0 - px * 3.5, px * 3.5, 0, Math.PI * 2); ctx.fill(); }
      pixelText(ctx, 'REC', X0 + px * 10, Y0, px, c || '#FFFFFF', 'left');
      // pil
      const bx = W / 2 - m - px * 30, by = Y0 - px * 7;
      ctx.strokeStyle = c || '#FFFFFF'; ctx.lineWidth = px * 0.8; ctx.strokeRect(bx, by, px * 20, px * 7); ctx.fillStyle = c || '#FFFFFF'; ctx.fillRect(bx + px * 20, by + px * 2, px * 2, px * 3);
      const lvl = 3 - (Math.floor(lt * 0.5) % 2); for (let i = 0; i < lvl; i++) ctx.fillRect(bx + px * (1.4 + i * 6.2), by + px * 1.4, px * 5, px * 4.2);
      // zoom çubuğu
      const zy = H / 2 - m - px * 30; pixelText(ctx, 'W', X0, zy, px, c || '#FFFFFF', 'left'); ctx.fillStyle = c || '#FFFFFF'; ctx.fillRect(X0 + px * 8, zy - px * 4, px * 50, px * 1);
      const zp = 0.3 + 0.25 * Math.sin(lt * 0.8); ctx.fillRect(X0 + px * 8 + zp * px * 50, zy - px * 7, px * 2, px * 7); pixelText(ctx, 'T', X0 + px * 62, zy, px, c || '#FFFFFF', 'left');
      const d = new Date(); const yr = String(L.year || '1997');
      pixelText(ctx, `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${yr}`, W / 2 - m - px * 8, H / 2 - m - px * 18, px, c || a, 'right');
      pixelText(ctx, `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(Math.floor(lt) % 60).padStart(2, '0')}`, W / 2 - m - px * 8, H / 2 - m - px * 6, px, c || a, 'right');
      if (L.text) pixelText(ctx, L.text, X0, H / 2 - m - px * 6, px, c || '#FFFFFF', 'left');
    });
    return { w: W, h: H };
  },

  // ---------- Super 8 film kaplaması (tam kare) ----------
  no_super8(ctx, L, lt, env) {
    const W = env.W, H = env.H, a = L.accent || '#FFB36B';
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = mixHex(a, '#FFFFFF', 0.55); ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const fl = 0.04 + 0.05 * hash(Math.floor(lt * 18)); ctx.fillStyle = `rgba(255,240,210,${fl})`; ctx.fillRect(-W / 2, -H / 2, W, H);
    // kare kapısı: yuvarlak kenarlı kara çerçeve
    { const gp = new Path2D(); gp.rect(-W / 2 - 10, -H / 2 - 10, W + 20, H + 20); const ix = -W / 2 + W * 0.05, iy = -H / 2 + H * 0.035, iw = W * 0.9, ih = H * 0.93, r = W * 0.06;
      gp.moveTo(ix + r, iy); gp.arcTo(ix + iw, iy, ix + iw, iy + ih, r); gp.arcTo(ix + iw, iy + ih, ix, iy + ih, r); gp.arcTo(ix, iy + ih, ix, iy, r); gp.arcTo(ix, iy, ix + iw, iy, r); gp.closePath();
      ctx.fillStyle = '#000'; ctx.fill(gp, 'evenodd'); }
    // delikler
    for (let i = 0; i < 6; i++) { const y = -H / 2 + ((i + (lt * 2.5) % 1) / 6) * H; ctx.fillStyle = 'rgba(255,250,235,.85)'; roundRect(ctx, -W / 2 + W * 0.008, y, W * 0.028, H * 0.035, 8); ctx.fill(); }
    grain(ctx, W, H, lt, 0.1, 7);
    const f = Math.floor(lt * 24);
    if (hash(f + 3) > 0.6) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-W / 2 + hash(f) * W, -H / 2, 3, H); }
    if (hash(f + 9) > 0.85) { ctx.fillStyle = 'rgba(30,20,10,.5)'; ctx.beginPath(); ctx.arc(-W / 2 + hash(f + 1) * W, -H / 2 + hash(f + 2) * H, 6 + hash(f) * 12, 0, Math.PI * 2); ctx.fill(); }
    const vg = ctx.createRadialGradient(0, 0, H * 0.25, 0, 0, H * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,20,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.restore();
    return { w: W, h: H };
  },

  // ---------- Tek kullanımlık kamera tarih damgası (tam kare) ----------
  no_datestamp(ctx, L, lt, env) {
    const S = env.S, W = env.W, H = env.H, a = L.accent || '#FF8C2B';
    ctx.textAlign = 'right'; ctx.font = F(700, Math.round(W / 22), MONO);
    const d = new Date();
    const txt = L.text || `'${String(d.getFullYear() % 100).padStart(2, '0')}  ${String(d.getMonth() + 1).padStart(2, '0')}  ${String(d.getDate()).padStart(2, '0')}`;
    glow(ctx, a, 18, S, () => { ctx.fillStyle = mixHex(a, '#FFF3C4', 0.25); ctx.fillText(txt, W / 2 - W * 0.07, H / 2 - H * 0.06); });
    ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- 80'ler başlık: synthwave güneşi + krom yazı + neon el yazısı ----------
  no_synthtitle(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#FF2E97', b = L.accent2 || '#2DE2E6', W = 980, H = 700;
    const ip = easeOut5(seg(lt, 0, 0.8));
    ctx.save(); roundRect(ctx, -W / 2, -H / 2, W, H, 26); ctx.clip();
    const sky = ctx.createLinearGradient(0, -H / 2, 0, 80); sky.addColorStop(0, '#07021A'); sky.addColorStop(1, '#3B0A58'); ctx.fillStyle = sky; ctx.fillRect(-W / 2, -H / 2, W, H);
    for (let i = 0; i < 50; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.6 * hash(i) * (0.5 + 0.5 * Math.sin(lt * 2 + i))})`; ctx.fillRect(-W / 2 + hash(i) * W, -H / 2 + hash(i + 9) * 260, 3, 3); }
    const sg = ctx.createLinearGradient(0, -170, 0, 80); sg.addColorStop(0, '#FFE259'); sg.addColorStop(1, a);
    ctx.save(); ctx.translate(0, (1 - ip) * 120); ctx.beginPath(); ctx.arc(0, 80, 220, Math.PI, 0); ctx.clip(); ctx.fillStyle = sg; ctx.fillRect(-230, -150, 460, 240);
    ctx.fillStyle = '#3B0A58'; for (let i = 0; i < 6; i++) ctx.fillRect(-230, 10 + i * 13, 460, 2 + i * 1.6); ctx.restore();
    ctx.fillStyle = '#07021A'; ctx.fillRect(-W / 2, 80, W, H);
    ctx.strokeStyle = hexA(b, 0.9); ctx.lineWidth = 2.5;
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(i * 30, 80); ctx.lineTo(i * 150, H / 2); ctx.stroke(); }
    for (let k = 0; k < 8; k++) { const z = (k + (lt * 1.2) % 1) / 8, y = 80 + Math.pow(z, 2.2) * (H / 2 - 80); ctx.globalAlpha = 0.2 + z * 0.8; ctx.beginPath(); ctx.moveTo(-W / 2, y); ctx.lineTo(W / 2, y); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.restore();
    ctx.textAlign = 'center';
    const txt = String(L.text || 'RETRO').toLocaleUpperCase('tr-TR');
    const fs = fitFont(ctx, txt, W * 0.85, 190, (s) => F(400, s, COND, true));
    ctx.save(); ctx.translate(0, -20 + (1 - ip) * 40); ctx.globalAlpha *= ip;
    const g = ctx.createLinearGradient(0, -fs * 0.7, 0, 10); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.48, '#8ED6FF'); g.addColorStop(0.5, '#1E1240'); g.addColorStop(0.62, '#FF8BD8'); g.addColorStop(1, '#FFF6FF');
    ctx.fillStyle = a; ctx.fillText(txt, 6, 6); glow(ctx, b, 20, S, () => { ctx.fillStyle = g; ctx.fillText(txt, 0, 0); });
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.strokeText(txt, 0, 0);
    ctx.restore();
    if (L.sub) {
      const sp = easeOut(seg(lt, 0.5, 1.1));
      ctx.save(); ctx.globalAlpha *= sp; ctx.rotate(-0.08); ctx.font = F(400, 84, SCRIPT);
      const fl = hash(Math.floor(lt * 20)) > 0.08 ? 1 : 0.3;
      ctx.globalAlpha *= fl; glow(ctx, a, 30, S, () => { ctx.fillStyle = '#FFE1F5'; ctx.fillText(L.sub, 40, 90); }); ctx.restore();
    }
    ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- 70'ler groovy: katmanlı renk şeritli dalgalı yazı ----------
  no_groovy(ctx, L, lt, env) {
    const S = env.S, cols = [L.color || '#FFF1D6', L.accent || '#F2A541', L.accent2 || '#E4572E', '#7A3B1D'];
    const txt = String(L.text || 'GROOVY').toLocaleUpperCase('tr-TR');
    ctx.textAlign = 'center';
    const fs = fitFont(ctx, txt, 880, 200, (s) => F(400, s, 'Righteous'));
    const ip = back(seg(lt, 0, 0.7));
    const chars = [...txt]; const ws = chars.map((c) => ctx.measureText(c).width); const tw = ws.reduce((x, y) => x + y, 0);
    ctx.save(); ctx.scale(ip, ip);
    for (let layer = 3; layer >= 0; layer--) {
      let x = -tw / 2;
      chars.forEach((ch, i) => {
        const wv = Math.sin(lt * 3 + i * 0.6) * 14;
        ctx.fillStyle = cols[layer]; ctx.fillText(ch, x + ws[i] / 2 + layer * 9, wv + layer * 11 + fs * 0.35);
        x += ws[i];
      });
    }
    ctx.restore();
    // çiçek
    const fp = back(seg(lt, 0.4, 0.9));
    const flower = (x, y, r, c) => { ctx.save(); ctx.translate(x, y); ctx.rotate(lt * 0.8); ctx.scale(fp, fp); ctx.fillStyle = c; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(Math.cos(i * 1.047) * r, Math.sin(i * 1.047) * r, r * 0.75, r * 0.45, i * 1.047, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#FFF1D6'; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
    flower(-tw / 2 - 40, -fs * 0.45, 34, cols[2]); flower(tw / 2 + 30, fs * 0.55, 28, cols[1]);
    ctx.textAlign = 'left'; void S;
    return { w: tw + 220, h: fs * 1.6 };
  },

  // ---------- Disko: dönen ayna küre + altın başlık ----------
  no_disco(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#F5C76B', R = 170;
    const drop = easeOut5(seg(lt, 0, 0.9));
    ctx.save(); ctx.translate(0, -230 - (1 - drop) * 300);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -R); ctx.lineTo(0, -R - 400); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#2A2A33'; ctx.fillRect(-R, -R, R * 2, R * 2);
    const rows = 12, rot = lt * 0.9;
    for (let r = 0; r < rows; r++) {
      const lat = -Math.PI / 2 + (r + 0.5) / rows * Math.PI, y = Math.sin(lat) * R, rr = Math.cos(lat) * R, cols = Math.max(4, Math.round(rr / 14));
      for (let c = 0; c < cols * 2; c++) {
        const lon = (c / (cols * 2)) * Math.PI * 2 + rot; const z = Math.cos(lon); if (z < 0) continue;
        const x = Math.sin(lon) * rr; const br = 0.25 + 0.75 * hash(r * 31 + c + Math.floor(lt * 6)) * z;
        ctx.fillStyle = `rgba(${Math.round(180 + 75 * br)},${Math.round(180 + 70 * br)},${Math.round(200 + 55 * br)},${0.5 + 0.5 * br})`;
        ctx.fillRect(x - 6 * z, y - 6, 12 * z, 12);
      }
    }
    const sh = ctx.createRadialGradient(-R * 0.4, -R * 0.4, 10, 0, 0, R); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = sh; ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
    for (let i = 0; i < 7; i++) { const tw = 0.5 + 0.5 * Math.sin(lt * 5 + i * 2); twinkle(ctx, Math.cos(i * 0.9 + 1) * R * 0.8, Math.sin(i * 1.7) * R * 0.8, 22 * tw, '#FFFFFF', tw); }
    ctx.restore();
    // ışık hüzmeleri
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const an = Math.PI / 2 + Math.sin(lt * 0.7 + i) * 0.9; ctx.fillStyle = hexA(i % 2 ? a : '#FF6EC7', 0.06); ctx.beginPath(); ctx.moveTo(0, -230); ctx.lineTo(Math.cos(an - 0.05) * 900, -230 + Math.sin(an - 0.05) * 900); ctx.lineTo(Math.cos(an + 0.05) * 900, -230 + Math.sin(an + 0.05) * 900); ctx.fill(); }
    ctx.restore();
    const tp = easeOut(seg(lt, 0.6, 1.3));
    ctx.save(); ctx.globalAlpha *= tp; ctx.textAlign = 'center'; ctx.font = F(400, 130, SCRIPT);
    const gg = ctx.createLinearGradient(0, 80, 0, 220); gg.addColorStop(0, '#FFF4C9'); gg.addColorStop(0.5, a); gg.addColorStop(1, '#9C6B1E');
    glow(ctx, a, 26, S, () => { ctx.fillStyle = gg; ctx.fillText(L.text || 'Disko Gecesi', 0, 190); });
    if (L.sub) { ctx.font = F(600, 36, UI); ctx.fillStyle = '#FFFFFF'; spaced(ctx, String(L.sub).toLocaleUpperCase('tr-TR'), 0, 270, 12); }
    ctx.restore();
    return { w: 920, h: 920 };
  },

  // ---------- Polaroid: düşüp dönerek oturur, fotoğraf banyo olur ----------
  no_polaroid(ctx, L, lt, env) {
    const S = env.S, W = 560, H = 680, pad = 36, ph = 480;
    const p = easeOut5(seg(lt, 0, 0.8)); const rot = lerp(-0.5, -0.06, p);
    ctx.save(); ctx.translate((1 - p) * -200, (1 - p) * -400); ctx.rotate(rot);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 18 * S; ctx.fillStyle = '#F7F4EE'; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
    const img = L.v1 && env.img ? env.img(L.v1) : null;
    const dev = easeIO(seg(lt, 0.6, 2.4));
    ctx.save(); ctx.beginPath(); ctx.rect(-W / 2 + pad, -H / 2 + pad, W - pad * 2, ph); ctx.clip();
    if (img) { const iw = img.width || img.videoWidth || 1, ih = img.height || img.videoHeight || 1, k = Math.max((W - pad * 2) / iw, ph / ih); ctx.drawImage(img, -iw * k / 2, -H / 2 + pad + ph / 2 - ih * k / 2, iw * k, ih * k); }
    else { const g = ctx.createLinearGradient(0, -H / 2, 0, -H / 2 + ph); g.addColorStop(0, '#F6B98C'); g.addColorStop(0.55, '#E97F6B'); g.addColorStop(0.56, '#4E6A85'); g.addColorStop(1, '#22344A'); ctx.fillStyle = g; ctx.fillRect(-W / 2, -H / 2, W, ph + pad); ctx.fillStyle = 'rgba(255,240,200,.9)'; ctx.beginPath(); ctx.arc(60, -H / 2 + pad + 250, 60, Math.PI, 0); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(40,30,25,${1 - dev})`; ctx.fillRect(-W / 2, -H / 2, W, ph + pad * 2);
    ctx.fillStyle = 'rgba(255,200,140,.12)'; ctx.fillRect(-W / 2, -H / 2, W, ph + pad * 2);
    ctx.restore();
    ctx.fillStyle = L.accent || '#2B2B33'; ctx.font = F(600, 58, HAND); ctx.textAlign = 'center';
    const cp = seg(lt, 1.2, 2.2); const cap = String(L.text || 'Yaz 1998 ☀'); ctx.fillText(cap.slice(0, Math.ceil(cap.length * cp)), 0, H / 2 - 62);
    ctx.textAlign = 'left'; ctx.restore();
    return { w: W + 120, h: H + 120 };
  },

  // ---------- Kaset ----------
  no_cassette(ctx, L, lt, env) {
    const S = env.S, W = 860, H = 540, a = L.accent || '#E9573F', b = L.accent2 || '#F6C453';
    const p = easeOut5(seg(lt, 0, 0.7));
    ctx.save(); ctx.translate(0, (1 - p) * 120); ctx.globalAlpha *= p;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 16 * S; roundRect(ctx, -W / 2, -H / 2, W, H, 28); ctx.fillStyle = '#26232B'; ctx.fill(); ctx.restore();
    roundRect(ctx, -W / 2 + 40, -H / 2 + 36, W - 80, 300, 18); ctx.fillStyle = '#F4EBDD'; ctx.fill();
    ctx.fillStyle = a; ctx.fillRect(-W / 2 + 40, -H / 2 + 292, W - 80, 24); ctx.fillStyle = b; ctx.fillRect(-W / 2 + 40, -H / 2 + 316, W - 80, 20);
    ctx.fillStyle = '#2B1E17'; ctx.font = F(400, 64, HAND); ctx.fillText(L.text || 'Karışık 1987', -W / 2 + 80, -H / 2 + 120);
    ctx.strokeStyle = 'rgba(43,30,23,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-W / 2 + 80, -H / 2 + 142); ctx.lineTo(W / 2 - 80, -H / 2 + 142); ctx.stroke();
    ctx.fillStyle = '#5A4A3F'; ctx.font = F(500, 34, HAND); ctx.fillText(L.sub || 'A yüzü · 45 dk', -W / 2 + 80, -H / 2 + 178);
    // pencere ve makaralar
    roundRect(ctx, -210, -H / 2 + 196, 420, 90, 45); ctx.fillStyle = '#17151B'; ctx.fill();
    const reel = (x, r) => { ctx.save(); ctx.translate(x, -H / 2 + 241); ctx.fillStyle = '#3A2A20'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.rotate(lt * 4); ctx.fillStyle = '#EEE'; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#17151B'; for (let i = 0; i < 6; i++) { ctx.save(); ctx.rotate(i * 1.047); ctx.fillRect(-4, 8, 8, 16); ctx.restore(); } ctx.restore(); };
    const prog = (lt * 0.05) % 1; reel(-130, 28 + 12 * (1 - prog)); reel(130, 28 + 12 * prog);
    roundRect(ctx, -W / 2 + 160, H / 2 - 120, W - 320, 90, 14); ctx.fillStyle = '#1C1A20'; ctx.fill();
    [-1, 1].forEach((s) => { ctx.fillStyle = '#0F0E12'; ctx.beginPath(); ctx.arc(s * 120, H / 2 - 75, 18, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    return { w: W + 60, h: H + 60 };
  },

  // ---------- Tüplü TV başlığı ----------
  no_crttitle(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#7CFFB2', W = 960, H = 620;
    const on = easeOut(seg(lt, 0, 0.4));
    ctx.save(); roundRect(ctx, -W / 2, -H / 2, W, H, 60); ctx.fillStyle = '#050706'; ctx.fill(); ctx.clip();
    ctx.save(); ctx.scale(Math.max(0.02, on), Math.max(0.004, seg(lt, 0.15, 0.45)));
    ctx.textAlign = 'center';
    const txt = String(L.text || 'KANAL 7').toLocaleUpperCase('tr-TR');
    fitFont(ctx, txt, W * 0.8, 150, (s) => F(800, s, MONO));
    ctx.fillStyle = hexA('#FF3355', 0.55); ctx.fillText(txt, -5, 30); ctx.fillStyle = hexA('#33AAFF', 0.55); ctx.fillText(txt, 5, 30);
    glow(ctx, a, 30, S, () => { ctx.fillStyle = mixHex(a, '#FFFFFF', 0.5); ctx.fillText(txt, 0, 30); });
    if (L.sub) { ctx.font = F(500, 44, MONO); ctx.fillStyle = hexA(a, 0.85); ctx.fillText(L.sub, 0, 120); }
    ctx.restore();
    scanlines(ctx, W, H, 0.3, 5);
    const vg = ctx.createRadialGradient(0, 0, H * 0.25, 0, 0, W * 0.65); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.8)'); ctx.fillStyle = vg; ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- Arcade yazısı ----------
  no_arcade(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#FFD23F';
    const txt = String(L.text || 'PRESS START');
    const px = Math.max(8, Math.min(26, Math.floor(860 / Math.max(1, txt.length * 6))));
    const ip = seg(lt, 0, 0.6);
    const shown = txt.slice(0, Math.ceil(txt.length * ip));
    glow(ctx, a, 26, S, () => { pixelText(ctx, shown, 6, px * 3.5 + 6, px, '#7A3E00'); pixelText(ctx, shown, 0, px * 3.5, px, a); });
    if (L.sub && Math.floor(lt * 2.4) % 2 === 0) pixelText(ctx, L.sub, 0, px * 3.5 + px * 14, Math.max(6, px * 0.45), '#FFFFFF');
    return { w: Math.max(400, pixelWidth(txt, px) + 80), h: px * 22 };
  },

  // ---------- Sessiz film ara yazısı ----------
  no_intertitle(ctx, L, lt, env) {
    const W = 960, H = 640, a = L.accent || '#EDE6D6';
    const fl = 0.9 + 0.1 * hash(Math.floor(lt * 16));
    ctx.save(); ctx.globalAlpha *= easeOut(seg(lt, 0, 0.5)) * fl;
    ctx.fillStyle = '#0B0A09'; ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.strokeStyle = a; ctx.lineWidth = 4; ctx.strokeRect(-W / 2 + 40, -H / 2 + 40, W - 80, H - 80); ctx.lineWidth = 1.5; ctx.strokeRect(-W / 2 + 54, -H / 2 + 54, W - 108, H - 108);
    // köşe süsleri
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { ctx.save(); ctx.translate(sx * (W / 2 - 54), sy * (H / 2 - 54)); ctx.scale(sx, sy); ctx.beginPath(); ctx.moveTo(0, 40); ctx.quadraticCurveTo(0, 0, 40, 0); ctx.moveTo(10, 60); ctx.quadraticCurveTo(10, 10, 60, 10); ctx.stroke(); ctx.beginPath(); ctx.arc(22, 22, 6, 0, Math.PI * 2); ctx.fillStyle = a; ctx.fill(); ctx.restore(); });
    ctx.fillStyle = a; ctx.textAlign = 'center'; ctx.font = F(500, 58, DISPLAY, true);
    const ls = wrap(ctx, L.text || 'Ve o gün,\nher şey değişti…', W - 220);
    ls.forEach((l, i) => ctx.fillText(l, 0, -((ls.length - 1) * 74) / 2 + i * 74 + 20));
    grain(ctx, W, H, lt, 0.12, 5);
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- Gazete manşeti (dönerek gelir) ----------
  no_newspaper(ctx, L, lt, env) {
    const S = env.S, W = 820, H = 1000, ink = '#1E1B18';
    const p = easeOut5(seg(lt, 0, 1.0));
    ctx.save(); ctx.rotate((1 - p) * Math.PI * 6); ctx.scale(lerp(0.05, 1, p), lerp(0.05, 1, p));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 16 * S; ctx.fillStyle = '#EFE8D8'; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
    ctx.fillStyle = ink; ctx.textAlign = 'center';
    ctx.font = F(900, 76, DISPLAY); ctx.fillText(L.title || 'Günün Postası', 0, -H / 2 + 110);
    ctx.fillRect(-W / 2 + 40, -H / 2 + 136, W - 80, 4); ctx.fillRect(-W / 2 + 40, -H / 2 + 180, W - 80, 2);
    ctx.font = F(500, 22, SERIF); ctx.fillText(`${L.sub || 'SAYI 1.024'}  ·  ${L.year || '1974'}  ·  FİYATI 50 KURUŞ`, 0, -H / 2 + 168);
    ctx.font = F(900, 92, DISPLAY);
    const hl = wrap(ctx, String(L.text || 'BÜYÜK HABER!').toLocaleUpperCase('tr-TR'), W - 100);
    hl.slice(0, 3).forEach((l, i) => ctx.fillText(l, 0, -H / 2 + 300 + i * 96));
    const y0 = -H / 2 + 300 + Math.min(3, hl.length) * 96;
    ctx.fillStyle = '#B9B1A0'; ctx.fillRect(-W / 2 + 40, y0, W / 2 - 60, 240);
    ctx.fillStyle = 'rgba(30,27,24,.55)';
    for (let c = 0; c < 2; c++) for (let r = 0; r < 14; r++) { const x = c === 0 ? 30 : -W / 2 + 40, w0 = c === 0 ? W / 2 - 70 : W / 2 - 60; if (c === 1 && r < 7) continue; ctx.fillRect(x, y0 + r * 22 + (c === 1 ? 0 : 0), w0 * (0.75 + 0.25 * hash(r + c * 20)), 9); }
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W + 60, h: H + 60 };
  },

  // ---------- Eski işletim sistemi penceresi (genel, markasız) ----------
  no_oldos(ctx, L, lt, env) {
    const S = env.S, W = 860, H = 420, a = L.accent || '#1F3B8C';
    const p = seg(lt, 0, 0.12) > 0 ? 1 : 0;
    if (!p) return { w: W, h: H };
    const bev = (x, y, w, h, inset) => { ctx.fillStyle = '#C3C3C3'; ctx.fillRect(x, y, w, h); ctx.fillStyle = inset ? '#7B7B7B' : '#FFFFFF'; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillStyle = inset ? '#FFFFFF' : '#404040'; ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x + w - 4, y, 4, h); };
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 14 * S; ctx.shadowOffsetY = 14 * S; ctx.fillStyle = '#000'; ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
    bev(-W / 2, -H / 2, W, H, false);
    const tg = ctx.createLinearGradient(-W / 2, 0, W / 2, 0); tg.addColorStop(0, a); tg.addColorStop(1, mixHex(a, '#7FA3E8', 0.8));
    ctx.fillStyle = tg; ctx.fillRect(-W / 2 + 10, -H / 2 + 10, W - 20, 56);
    ctx.fillStyle = '#FFFFFF'; ctx.font = F(700, 32, UI); ctx.fillText(L.title || 'Sistem Uyarısı', -W / 2 + 28, -H / 2 + 48);
    bev(W / 2 - 62, -H / 2 + 18, 42, 40, false); ctx.fillStyle = '#000'; ctx.font = F(800, 30, UI); ctx.fillText('×', W / 2 - 51, -H / 2 + 48);
    // ikon
    ctx.fillStyle = '#F2C200'; ctx.beginPath(); ctx.moveTo(-W / 2 + 90, -H / 2 + 110); ctx.lineTo(-W / 2 + 150, -H / 2 + 210); ctx.lineTo(-W / 2 + 30, -H / 2 + 210); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#000'; ctx.font = F(900, 60, UI); ctx.textAlign = 'center'; ctx.fillText('!', -W / 2 + 90, -H / 2 + 200); ctx.textAlign = 'left';
    ctx.font = F(500, 36, UI); wrap(ctx, typedSafe(L.text || 'Bu video fazla nostalji içeriyor. Devam edilsin mi?', lt, 40, 0.3), W - 260).forEach((l, i) => ctx.fillText(l, -W / 2 + 190, -H / 2 + 140 + i * 48));
    const press = seg(lt, 2.2, 2.35) * (1 - seg(lt, 2.35, 2.5));
    bev(-90, H / 2 - 100, 180, 66, press > 0.3); ctx.fillStyle = '#000'; ctx.font = F(600, 32, UI); ctx.textAlign = 'center'; ctx.fillText(L.btn || 'Tamam', 0, H / 2 - 56); ctx.textAlign = 'left';
    ctx.strokeStyle = '#000'; ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeRect(-76, H / 2 - 88, 152, 42); ctx.setLineDash([]);
    return { w: W, h: H };
  },

  // ---------- Teletekst sayfası ----------
  no_teletext(ctx, L, lt, env) {
    const W = 960, H = 760, px = 6, a = L.accent || '#FFE600';
    ctx.fillStyle = '#000'; ctx.fillRect(-W / 2, -H / 2, W, H);
    const d = new Date();
    pixelText(ctx, `P100  ${String(L.title || 'ALPICUT').slice(0, 10)}  ${String(d.getDate()).padStart(2, '0')} ${AY[d.getMonth()]}  ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(Math.floor(lt) % 60).padStart(2, '0')}`, -W / 2 + 24, -H / 2 + 60, px - 1, '#FFFFFF', 'left');
    const bars = ['#0000FF', '#FF0000', '#00FF00', a];
    bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-W / 2 + 24 + i * 228, -H / 2 + 90, 220, 70); });
    pixelText(ctx, 'HABER', -W / 2 + 60, -H / 2 + 150, px + 1, '#FFFFFF', 'left');
    const rows = (L.lines || 'GÜNÜN ÖZETİ\nHAVA DURUMU\nSPOR SONUÇLARI\nTV REHBERİ\nBORSA').split('\n').filter(Boolean).slice(0, 6);
    rows.forEach((r, i) => {
      if (seg(lt, 0.2 + i * 0.25, 0.3 + i * 0.25) <= 0) return;
      pixelText(ctx, r, -W / 2 + 40, -H / 2 + 260 + i * 80, px, i % 2 ? '#00FFFF' : a, 'left');
      pixelText(ctx, String(101 + i * 10), W / 2 - 40, -H / 2 + 260 + i * 80, px, '#FFFFFF', 'right');
    });
    ctx.fillStyle = '#FF0000'; ctx.fillRect(-W / 2 + 24, H / 2 - 70, 220, 46); ctx.fillStyle = '#00FF00'; ctx.fillRect(-W / 2 + 252, H / 2 - 70, 220, 46); ctx.fillStyle = a; ctx.fillRect(-W / 2 + 480, H / 2 - 70, 220, 46); ctx.fillStyle = '#00FFFF'; ctx.fillRect(-W / 2 + 708, H / 2 - 70, 228, 46);
    return { w: W, h: H };
  },

  // ---------- Motel neon tabelası ----------
  no_motel(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#FF4D6D', b = L.accent2 || '#FFD166';
    const W = 860, H = 460;
    ctx.save(); roundRect(ctx, -W / 2, -H / 2, W, H, 40); ctx.fillStyle = '#121019'; ctx.fill(); ctx.restore();
    // ampullü ok
    const n = 22;
    for (let i = 0; i < n; i++) { const x = -W / 2 + 40 + (i / (n - 1)) * (W - 80), on = (i + Math.floor(lt * 8)) % 3 === 0; ctx.fillStyle = on ? b : hexA(b, 0.2); if (on) { ctx.save(); ctx.shadowColor = b; ctx.shadowBlur = 20 * S; } ctx.beginPath(); ctx.arc(x, -H / 2 + 34, 8, 0, Math.PI * 2); ctx.fill(); if (on) ctx.restore(); }
    for (let i = 0; i < n; i++) { const x = -W / 2 + 40 + (i / (n - 1)) * (W - 80), on = (i + Math.floor(lt * 8) + 1) % 3 === 0; ctx.fillStyle = on ? b : hexA(b, 0.2); ctx.beginPath(); ctx.arc(x, H / 2 - 34, 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.textAlign = 'center';
    const txt = String(L.text || 'AÇIK').toLocaleUpperCase('tr-TR');
    fitFont(ctx, txt, W - 140, 170, (s) => F(400, s, SCRIPT));
    const fl = hash(Math.floor(lt * 14)) > 0.1 ? 1 : 0.25;
    ctx.save(); ctx.globalAlpha *= fl; ctx.lineWidth = 7; ctx.strokeStyle = mixHex(a, '#FFFFFF', 0.55); ctx.shadowColor = a; ctx.shadowBlur = 50 * S; ctx.strokeText(txt, 0, 50); ctx.shadowBlur = 16 * S; ctx.strokeText(txt, 0, 50); ctx.restore();
    if (L.sub) { ctx.font = F(700, 40, UI); ctx.fillStyle = b; ctx.save(); ctx.shadowColor = b; ctx.shadowBlur = 20 * S; spaced(ctx, String(L.sub).toLocaleUpperCase('tr-TR'), 0, 150, 14); ctx.restore(); }
    ctx.textAlign = 'left';
    return { w: W, h: H };
  },
};

function typedSafe(s, lt, cps, t0) { return String(s || '').slice(0, Math.max(0, Math.floor((lt - t0) * cps))); }

// ---------- hazır şablonlar ----------
const A = (i = 'none', o = 'fade') => ({ in: i, out: o, inDur: 0.4, outDur: 0.4 });
const T = [];
const add = (id, name, type, p, dur = 4) => T.push({ id, name, cat: 'Nostalji', p: { type, y: 0.5, anim: A(), ...p }, dur });
add('no_vhs', 'VHS oynatma ekranı', 'no_vhs', { title: 'PLAY', year: '1989' }, 6);
add('no_vhs_rew', 'VHS geri sarma', 'no_vhs', { title: 'REW', year: '1991' }, 4);
add('no_vhs_pause', 'VHS duraklat', 'no_vhs', { title: 'PAUSE', year: '1993', text: 'CH 03' }, 4);
add('no_cam', '90\'lar el kamerası', 'no_camcorder', { year: '1997' }, 6);
add('no_cam2', 'El kamerası · yeşil damga', 'no_camcorder', { year: '1999', accent: '#9BFF6B', text: 'TATİL' }, 6);
add('no_cam3', 'El kamerası · beyaz damga', 'no_camcorder', { year: '1995', accent: '#FFFFFF' }, 6);
add('no_s8', 'Super 8 film', 'no_super8', {}, 6);
add('no_s8b', 'Super 8 · soğuk ton', 'no_super8', { accent: '#9CC5FF' }, 6);
add('no_s8c', 'Super 8 · solgun', 'no_super8', { accent: '#E8D8B0' }, 6);
add('no_date', 'Tarih damgası (turuncu)', 'no_datestamp', {}, 5);
add('no_date2', 'Tarih damgası (sarı)', 'no_datestamp', { accent: '#FFD23F' }, 5);
add('no_date3', 'Tarih damgası · özel', 'no_datestamp', { text: "'98 07 14" }, 5);
[['RETRO', 'Gece Sürüşü', {}], ['1984', 'neon rüyalar', { accent: '#FF6B35', accent2: '#B967FF' }], ['SYNTHWAVE', 'gece yarısı', { accent: '#3D5AFE', accent2: '#00F5D4' }], ['ARCADE', 'oyun salonu', { accent: '#FFD23F', accent2: '#FF2E97' }], ['MIAMI', 'yaz gecesi', { accent: '#FF7AC6', accent2: '#5EF2FF' }]]
  .forEach(([t, s, o], i) => add(`no_synth${i}`, `80'ler başlık · ${t}`, 'no_synthtitle', { text: t, sub: s, ...o }, 4.5));
[['GROOVY', {}], ['70\'LER', { accent: '#E8B04B', accent2: '#C0392B', color: '#FBEBC8' }], ['FUNKY', { accent: '#F28C28', accent2: '#8E44AD', color: '#FFF4D6' }], ['HİPPİ', { accent: '#6AB187', accent2: '#E07A5F', color: '#F4F1DE' }], ['DİSKO', { accent: '#F1C40F', accent2: '#D35400', color: '#FFF8E1' }]]
  .forEach(([t, o], i) => add(`no_groovy${i}`, `70'ler yazı · ${t}`, 'no_groovy', { text: t, ...o }, 4));
[['Disko Gecesi', 'CUMARTESİ 21:00', {}], ['Saturday Night', '1978', { accent: '#E5B8F4' }], ['Dans Pisti', 'DJ SETİ', { accent: '#7DD3FC' }]]
  .forEach(([t, s, o], i) => add(`no_disco${i}`, `Disko · ${t}`, 'no_disco', { text: t, sub: s, ...o }, 5));
[['Yaz 1998 ☀', {}], ['Babaannemle 🧡', { accent: '#7A2E1F' }], ['İlk bisikletim', { accent: '#1E3A8A' }], ['Mezuniyet \'03', { accent: '#14532D' }]]
  .forEach(([t, o], i) => add(`no_pola${i}`, `Polaroid · ${t}`, 'no_polaroid', { text: t, ...o }, 4));
[['Karışık 1987', 'A yüzü · 45 dk', {}], ['Yol şarkıları', 'B yüzü · 60 dk', { accent: '#2F80ED', accent2: '#F2C94C' }], ['Aşk şarkıları', 'C60 · Krom', { accent: '#E84A8B', accent2: '#FFD1DC' }]]
  .forEach(([t, s, o], i) => add(`no_tape${i}`, `Kaset · ${t}`, 'no_cassette', { text: t, sub: s, ...o }, 5));
[['KANAL 7', 'YAYIN AKIŞI', {}], ['ŞİMDİ', 'canlı yayın', { accent: '#FFB000' }], ['HABERLER', '20:00', { accent: '#E5E7EB' }]]
  .forEach(([t, s, o], i) => add(`no_crt${i}`, `Tüplü TV başlık · ${t}`, 'no_crttitle', { text: t, sub: s, ...o }, 4));
[['PRESS START', 'INSERT COIN', {}], ['GAME OVER', 'CONTINUE?', { accent: '#FF4D6D' }], ['LEVEL UP!', '+1000', { accent: '#5CFF5C' }], ['YOU WIN', 'HIGH SCORE', { accent: '#5EF2FF' }], ['OYUN BİTTİ', 'TEKRAR?', { accent: '#FF9F1C' }]]
  .forEach(([t, s, o], i) => add(`no_arc${i}`, `Arcade · ${t}`, 'no_arcade', { text: t, sub: s, ...o }, 4));
[['Ve o gün,\nher şey değişti…', {}], ['Bir süre sonra…', {}], ['SON', { accent: '#F5F0E1' }], ['Yıl 1923.\nBir şehir uyanıyor.', {}]]
  .forEach(([t, o], i) => add(`no_inter${i}`, `Sessiz film yazısı · ${t.split('\n')[0]}`, 'no_intertitle', { text: t, ...o }, 4));
[['BÜYÜK HABER!', 'Günün Postası', '1974'], ['KANAL 1 MİLYONA ULAŞTI', 'Akşam Gazetesi', '1986'], ['İNANILMAZ KEŞİF', 'Sabah Haberleri', '1962']]
  .forEach(([t, ti, y], i) => add(`no_news${i}`, `Gazete manşeti · ${t}`, 'no_newspaper', { text: t, title: ti, year: y }, 4));
[['Sistem Uyarısı', 'Bu video fazla nostalji içeriyor. Devam edilsin mi?', 'Tamam', {}], ['Hata', 'Uyku bulunamadı. Kahve yüklensin mi?', 'Evet', { accent: '#7A1F1F' }], ['Kurulum', 'Yeni video yükleniyor… Lütfen bekleyin.', 'İleri', { accent: '#14532D' }]]
  .forEach(([ti, t, btn, o], i) => add(`no_os${i}`, `Eski bilgisayar penceresi · ${ti}`, 'no_oldos', { title: ti, text: t, btn, ...o }, 4));
add('no_tt0', 'Teletekst sayfası', 'no_teletext', { title: 'ALPICUT' }, 5);
add('no_tt1', 'Teletekst · menü', 'no_teletext', { title: 'KANALIM', lines: 'YENİ VİDEO\nCANLI YAYIN\nSORU-CEVAP\nKAMERA ARKASI', accent: '#00FFFF' }, 5);
[['AÇIK', '7/24', {}], ['MOTEL', 'BOŞ ODA VAR', { accent: '#4DD8FF', accent2: '#FF9F1C' }], ['Dans', 'GECE KULÜBÜ', { accent: '#B967FF', accent2: '#FFE66D' }]]
  .forEach(([t, s, o], i) => add(`no_motel${i}`, `Motel neonu · ${t}`, 'no_motel', { text: t, sub: s, ...o }, 4));
export const NO_TEMPLATES = T;
