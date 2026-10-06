// Alpicut — sosyal medya şablonları 2: kanal kartviziti, telefon sohbetleri (iPhone / WhatsApp tarzı), X ve
// Instagram tarzı profil kartları, yarım ekran yazı, bitiş ekranı, alt bant, haber bandı, oyuncu kartı, VS kartı.
// Hepsi özelleştirilebilir; marka logosu kullanılmaz (benzer görünüm, özgün çizim).
import { roundRect, clamp } from './render.js';
import { wrap, avatar, icon, verified, card, F, fmtCount } from './social.js';
import { drawSocial3 } from './social3.js';

const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const back = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

// mesaj satırlarını çöz: "> metin" veya "Ben: metin" = giden; "< metin" veya "Ad: metin" = gelen
export function parseMsgs(src) {
  return String(src || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    if (l.startsWith('>')) return { me: true, text: l.slice(1).trim() };
    if (l.startsWith('<')) return { me: false, text: l.slice(1).trim() };
    const m = l.match(/^(ben|me|ich)\s*:\s*(.*)$/i);
    if (m) return { me: true, text: m[2] };
    const n = l.match(/^([^:]{1,18}):\s*(.*)$/);
    return n ? { me: false, text: n[2], who: n[1] } : { me: false, text: l };
  });
}

function bubbleLayout(ctx, msgs, maxW, font, padX, padY, lh) {
  ctx.font = font;
  return msgs.map((m) => {
    const lines = wrap(ctx, m.text, maxW - padX * 2);
    const tw = Math.max(...lines.map((ln) => ctx.measureText(ln).width), 40);
    return { ...m, lines, w: Math.min(maxW, tw + padX * 2), h: lines.length * lh + padY * 2 };
  });
}

function typingDots(ctx, x, y, color, lt) {
  for (let i = 0; i < 3; i++) {
    const a = 0.35 + 0.65 * Math.max(0, Math.sin(lt * 7 - i * 0.9));
    ctx.fillStyle = color; ctx.globalAlpha *= 1; ctx.beginPath(); ctx.arc(x + i * 26, y - a * 6, 9, 0, 7); ctx.fill();
  }
}

// telefon sohbeti (iMessage / WhatsApp tarzı)
function phoneChat(ctx, L, lt, env, kind) {
  const S = env.S;
  const dark = !!L.dark;
  const wa = kind === 'whatsapp';
  const W = 900, Hh = Math.max(900, Math.min(1500, L.height || 1300));
  const C = wa
    ? (dark ? { bg: '#0B141A', head: '#1F2C34', headFg: '#E9EDEF', sub: '#8696A0', me: '#005C4B', meFg: '#E9EDEF', them: '#202C33', themFg: '#E9EDEF', time: '#8696A0', tick: '#53BDEB' }
      : { bg: '#EFE7DD', head: '#075E54', headFg: '#FFFFFF', sub: '#D9FDD3', me: '#D9FDD3', meFg: '#111B21', them: '#FFFFFF', themFg: '#111B21', time: '#667781', tick: '#53BDEB' })
    : (dark ? { bg: '#000000', head: '#1C1C1E', headFg: '#FFFFFF', sub: '#8E8E93', me: '#0A84FF', meFg: '#FFFFFF', them: '#262629', themFg: '#FFFFFF', time: '#8E8E93' }
      : { bg: '#FFFFFF', head: '#F6F6F8', headFg: '#000000', sub: '#8E8E93', me: '#0A84FF', meFg: '#FFFFFF', them: '#E9E9EB', themFg: '#000000', time: '#8E8E93' });
  // gövde
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 12 * S;
  roundRect(ctx, -W / 2, -Hh / 2, W, Hh, 64); ctx.fillStyle = C.bg; ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, -W / 2, -Hh / 2, W, Hh, 64); ctx.clip();
  // WhatsApp duvar kâğıdı deseni
  if (wa) {
    ctx.globalAlpha = dark ? 0.05 : 0.07; ctx.fillStyle = dark ? '#ffffff' : '#7a6a55';
    for (let y = -Hh / 2 + 200; y < Hh / 2; y += 90) for (let x = -W / 2 + ((y / 90) % 2) * 45; x < W / 2; x += 90) { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // üst çubuk
  const headH = 190;
  ctx.fillStyle = C.head; ctx.fillRect(-W / 2, -Hh / 2, W, headH);
  ctx.fillStyle = C.headFg; ctx.font = F(700, 30); ctx.textAlign = 'left'; ctx.fillText(L.clock || '9:41', -W / 2 + 70, -Hh / 2 + 56);
  ctx.textAlign = 'right'; ctx.fillText('▮▮▮  ◔', W / 2 - 70, -Hh / 2 + 56);
  if (wa) {
    ctx.textAlign = 'left';
    ctx.font = F(400, 54); ctx.fillText('‹', -W / 2 + 30, -Hh / 2 + 142);
    avatar(ctx, L, -W / 2 + 120, -Hh / 2 + 128, 40, env);
    ctx.fillStyle = C.headFg; ctx.font = F(700, 38); ctx.fillText(L.name || 'Kişi', -W / 2 + 180, -Hh / 2 + 122);
    ctx.fillStyle = dark ? C.sub : 'rgba(255,255,255,.8)'; ctx.font = F(500, 28); ctx.fillText(L.status || 'çevrimiçi', -W / 2 + 180, -Hh / 2 + 160);
  } else {
    avatar(ctx, L, 0, -Hh / 2 + 110, 40, env);
    ctx.textAlign = 'center'; ctx.fillStyle = C.headFg; ctx.font = F(600, 28); ctx.fillText(`${L.name || 'Kişi'} ›`, 0, -Hh / 2 + 176);
    ctx.textAlign = 'left'; ctx.fillStyle = '#0A84FF'; ctx.font = F(400, 60); ctx.fillText('‹', -W / 2 + 34, -Hh / 2 + 130);
  }
  ctx.fillStyle = 'rgba(128,128,128,.25)'; ctx.fillRect(-W / 2, -Hh / 2 + headH, W, 2);
  // mesajlar
  const msgs = parseMsgs(L.msgs);
  const every = Math.max(0.3, L.every || 1.1);
  const t0 = 0.35;
  const shown = Math.max(0, Math.min(msgs.length, Math.floor((lt - t0) / every) + 1));
  const next = msgs[shown];
  const typing = next && !next.me && (lt - t0) - (shown * every - every) > every - 0.75 && shown < msgs.length;
  const font = F(500, 40);
  const lay = bubbleLayout(ctx, msgs.slice(0, shown), W * 0.72, font, 30, 20, 50);
  const gap = 14, bottomPad = wa ? 130 : 120;
  const areaTop = -Hh / 2 + headH + 30, areaBot = Hh / 2 - bottomPad;
  let total = lay.reduce((a, b) => a + b.h + gap, 0) + (typing ? 90 : 0);
  let y = Math.min(areaTop, areaBot - total);
  lay.forEach((b, i) => {
    const age = lt - t0 - i * every;
    const k = back(age / 0.32);
    const x = b.me ? W / 2 - 34 - b.w : -W / 2 + 34;
    ctx.save();
    ctx.translate(x + (b.me ? b.w : 0), y + b.h);
    ctx.scale(k, k);
    ctx.translate(-(x + (b.me ? b.w : 0)), -(y + b.h));
    roundRect(ctx, x, y, b.w, b.h, wa ? 18 : 36);
    ctx.fillStyle = b.me ? C.me : C.them; ctx.fill();
    if (wa && dark === false && !b.me) { ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = b.me ? C.meFg : C.themFg; ctx.font = font; ctx.textAlign = 'left';
    b.lines.forEach((ln, j) => ctx.fillText(ln, x + 30, y + 20 + 38 + j * 50));
    if (wa) {
      ctx.font = F(500, 24); ctx.fillStyle = C.time; ctx.textAlign = 'right';
      const tm = L.time || '21:3' + (i % 10);
      ctx.fillText(b.me ? `${tm}  ✓✓` : tm, x + b.w - 18, y + b.h - 12);
      if (b.me) { ctx.fillStyle = C.tick; ctx.fillText('✓✓', x + b.w - 18, y + b.h - 12); }
    }
    ctx.restore();
    y += b.h + gap;
  });
  if (typing) {
    const x = -W / 2 + 34;
    roundRect(ctx, x, y, 140, 76, 38); ctx.fillStyle = C.them; ctx.fill();
    typingDots(ctx, x + 44, y + 44, C.time, lt);
    y += 90;
  }
  if (!wa && shown && lay[lay.length - 1]?.me) { ctx.font = F(500, 24); ctx.fillStyle = C.time; ctx.textAlign = 'right'; ctx.fillText(L.read ? 'Okundu' : 'Teslim edildi', W / 2 - 40, Math.min(areaBot + 4, y + 10)); }
  // alt giriş çubuğu
  const iy = Hh / 2 - 92;
  ctx.fillStyle = wa ? (dark ? '#1F2C34' : '#F0F2F5') : C.bg; ctx.fillRect(-W / 2, iy - 18, W, 110);
  roundRect(ctx, -W / 2 + 40, iy, W - (wa ? 180 : 120), 64, 32);
  ctx.fillStyle = wa ? (dark ? '#2A3942' : '#FFFFFF') : 'transparent'; ctx.fill();
  if (!wa) { ctx.strokeStyle = 'rgba(128,128,128,.45)'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = C.time; ctx.font = F(500, 30); ctx.textAlign = 'left'; ctx.fillText(wa ? 'Mesaj' : 'iMessage', -W / 2 + 76, iy + 42);
  if (wa) { ctx.fillStyle = '#00A884'; ctx.beginPath(); ctx.arc(W / 2 - 80, iy + 32, 40, 0, 7); ctx.fill(); icon(ctx, 'mic', W / 2 - 80, iy + 32, 40, '#fff'); }
  ctx.restore();
  return { w: W, h: Hh };
}

export function drawSocial2(ctx, L, lt, env, T) {
  const S = env.S;
  ctx.textBaseline = 'alphabetic';
  switch (L.type) {
    case 'imessage': return phoneChat(ctx, L, lt, env, 'imessage');
    case 'whatsapp': return phoneChat(ctx, L, lt, env, 'whatsapp');
    case 'ytcard': {
      const w = 900, hh = 640;
      card(ctx, w, hh, 44, T.bg, S);
      ctx.save(); roundRect(ctx, -w / 2, -hh / 2, w, hh, 44); ctx.clip();
      const g = ctx.createLinearGradient(-w / 2, -hh / 2, w / 2, -hh / 2 + 220);
      g.addColorStop(0, L.accent || '#EF4444'); g.addColorStop(1, L.accent2 || '#7C3AED');
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -hh / 2, w, 220);
      const bimg = L.banner && env.img ? env.img(L.banner) : null;
      if (bimg && (bimg.naturalWidth || bimg.width)) { const iw = bimg.naturalWidth || bimg.width, ih = bimg.naturalHeight || bimg.height, k = Math.max(w / iw, 220 / ih); ctx.drawImage(bimg, -iw * k / 2, -hh / 2 + 110 - ih * k / 2, iw * k, ih * k); }
      ctx.restore();
      ctx.fillStyle = T.bg; ctx.beginPath(); ctx.arc(-w / 2 + 150, -hh / 2 + 220, 98, 0, 7); ctx.fill();
      avatar(ctx, L, -w / 2 + 150, -hh / 2 + 220, 88, env);
      ctx.textAlign = 'left'; ctx.fillStyle = T.fg; ctx.font = F(800, 52);
      ctx.fillText(L.name || 'Kanal Adı', -w / 2 + 270, -hh / 2 + 290);
      if (L.verified !== false) verified(ctx, -w / 2 + 290 + ctx.measureText(L.name || 'Kanal Adı').width, -hh / 2 + 274, 34, T.sub);
      ctx.fillStyle = T.sub; ctx.font = F(500, 32);
      ctx.fillText(`${L.handle || '@kanal'} · ${fmtCount(L.subs ?? 128000)} abone · ${L.videos ?? 340} video`, -w / 2 + 270, -hh / 2 + 340);
      ctx.fillStyle = T.fg; ctx.font = F(500, 34);
      wrap(ctx, L.text || 'Yaratıcı içerikler • Her hafta yeni video', w - 100).slice(0, 2).forEach((ln, i) => ctx.fillText(ln, -w / 2 + 50, -hh / 2 + 420 + i * 44));
      // abone ol butonu: tıklanıp "abone olundu"ya döner
      const tap = L.tapAt ?? 1.3;
      const done = lt > tap;
      const press = Math.exp(-Math.pow((lt - tap) / 0.12, 2));
      const bw = done ? 420 : 340, bh = 100, bx = -w / 2 + 50, by = hh / 2 - 140;
      ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(1 - press * 0.08, 1 - press * 0.08);
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 50);
      ctx.fillStyle = done ? (L.dark ? '#2C2C30' : '#ECECEC') : (L.dark ? '#FFFFFF' : '#0F0F0F'); ctx.fill();
      ctx.fillStyle = done ? T.fg : (L.dark ? '#0F0F0F' : '#FFFFFF'); ctx.font = F(700, 38); ctx.textAlign = 'center';
      ctx.fillText(done ? `🔔 ${L.doneBtn || 'Abone olundu'}` : (L.btn || 'Abone ol'), 0, 13);
      ctx.restore();
      // el imleci
      const ca = clamp((lt - (tap - 0.7)) / 0.6), cx = bx + bw * 0.62 + (1 - easeOut(ca)) * 260, cy = by + bh * 0.7 + (1 - easeOut(ca)) * 200;
      if (lt > tap - 0.7 && lt < tap + 0.9) { ctx.save(); ctx.globalAlpha *= lt > tap + 0.6 ? clamp((tap + 0.9 - lt) / 0.3) : 1; ctx.font = F(400, 84); ctx.textAlign = 'center'; ctx.fillText('👆', cx, cy + 60); ctx.restore(); }
      return { w, h: hh };
    }
    case 'xprofile':
    case 'igprofile': {
      const ig = L.type === 'igprofile';
      const w = 900, hh = ig ? 600 : 660;
      card(ctx, w, hh, 40, T.bg, S);
      ctx.textAlign = 'left';
      if (!ig) {
        ctx.save(); roundRect(ctx, -w / 2, -hh / 2, w, hh, 40); ctx.clip();
        ctx.fillStyle = L.accent || '#1D9BF0'; ctx.fillRect(-w / 2, -hh / 2, w, 200); ctx.restore();
        ctx.fillStyle = T.bg; ctx.beginPath(); ctx.arc(-w / 2 + 130, -hh / 2 + 200, 92, 0, 7); ctx.fill();
        avatar(ctx, L, -w / 2 + 130, -hh / 2 + 200, 84, env);
        const btnW = 230;
        roundRect(ctx, w / 2 - btnW - 40, -hh / 2 + 230, btnW, 80, 40); ctx.fillStyle = L.dark ? '#EFF3F4' : '#0F1419'; ctx.fill();
        ctx.fillStyle = L.dark ? '#0F1419' : '#FFFFFF'; ctx.font = F(700, 34); ctx.textAlign = 'center'; ctx.fillText(L.btn || 'Takip et', w / 2 - btnW / 2 - 40, -hh / 2 + 282);
        ctx.textAlign = 'left'; ctx.fillStyle = T.fg; ctx.font = F(800, 46); ctx.fillText(L.name || 'İsim', -w / 2 + 50, -hh / 2 + 360);
        if (L.verified) verified(ctx, -w / 2 + 70 + ctx.measureText(L.name || 'İsim').width, -hh / 2 + 345, 34, L.accent || '#1D9BF0');
        ctx.fillStyle = T.sub; ctx.font = F(500, 32); ctx.fillText(L.handle || '@kullanici', -w / 2 + 50, -hh / 2 + 404);
        ctx.fillStyle = T.fg; ctx.font = F(500, 34);
        wrap(ctx, L.text || '', w - 100).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, -w / 2 + 50, -hh / 2 + 466 + i * 44));
        ctx.font = F(700, 32); ctx.fillStyle = T.fg;
        const fl = `${fmtCount(L.following ?? 412)}`; ctx.fillText(fl, -w / 2 + 50, hh / 2 - 46);
        let x = -w / 2 + 60 + ctx.measureText(fl).width; ctx.fillStyle = T.sub; ctx.font = F(500, 32); ctx.fillText('Takip edilen', x, hh / 2 - 46);
        x += ctx.measureText('Takip edilen').width + 34; ctx.fillStyle = T.fg; ctx.font = F(700, 32);
        const n = Math.round((L.followers ?? 128000) * easeOut(lt / 1.4)); const fs = fmtCount(n); ctx.fillText(fs, x, hh / 2 - 46);
        ctx.fillStyle = T.sub; ctx.font = F(500, 32); ctx.fillText('Takipçi', x + 10 + ctx.measureText(fs).width, hh / 2 - 46);
      } else {
        // gradyan halkalı avatar
        const ax = -w / 2 + 150, ay = -hh / 2 + 160;
        const rg = ctx.createLinearGradient(ax - 90, ay + 90, ax + 90, ay - 90);
        rg.addColorStop(0, '#FEDA75'); rg.addColorStop(0.35, '#FA7E1E'); rg.addColorStop(0.65, '#D62976'); rg.addColorStop(1, '#962FBF');
        ctx.strokeStyle = rg; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(ax, ay, 92, 0, 7); ctx.stroke();
        avatar(ctx, L, ax, ay, 80, env);
        const stats = [[L.posts ?? 248, 'gönderi'], [Math.round((L.followers ?? 52000) * easeOut(lt / 1.4)), 'takipçi'], [L.following ?? 310, 'takip']];
        stats.forEach(([v, l], i) => { const x = -w / 2 + 380 + i * 170; ctx.textAlign = 'center'; ctx.fillStyle = T.fg; ctx.font = F(800, 42); ctx.fillText(fmtCount(v), x, ay); ctx.fillStyle = T.sub; ctx.font = F(500, 28); ctx.fillText(l, x, ay + 40); });
        ctx.textAlign = 'left'; ctx.fillStyle = T.fg; ctx.font = F(700, 38); ctx.fillText(L.name || 'İsim', -w / 2 + 50, -hh / 2 + 320);
        ctx.fillStyle = T.fg; ctx.font = F(500, 32);
        wrap(ctx, L.text || '', w - 100).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, -w / 2 + 50, -hh / 2 + 368 + i * 42));
        const btnY = hh / 2 - 110;
        roundRect(ctx, -w / 2 + 50, btnY, (w - 120) / 2, 76, 18); ctx.fillStyle = '#0095F6'; ctx.fill();
        roundRect(ctx, 10, btnY, (w - 120) / 2, 76, 18); ctx.fillStyle = L.dark ? '#363636' : '#EFEFEF'; ctx.fill();
        ctx.textAlign = 'center'; ctx.font = F(700, 32); ctx.fillStyle = '#fff'; ctx.fillText(L.btn || 'Takip et', -w / 2 + 50 + (w - 120) / 4, btnY + 50);
        ctx.fillStyle = T.fg; ctx.fillText('Mesaj', 10 + (w - 120) / 4, btnY + 50);
      }
      return { w, h: hh };
    }
    case 'halftext': {
      const W = env.W || 1080, H = env.H || 1920;
      const w = W, hh = H * (L.portion || 0.5);
      const k = easeOut(lt / 0.45);
      ctx.save();
      ctx.translate(0, (1 - k) * (L.side === 'bottom' ? hh : -hh) * 0.3);
      ctx.globalAlpha *= k;
      ctx.fillStyle = L.bg || '#FFFFFF'; ctx.fillRect(-w / 2, -hh / 2, w, hh);
      if (L.accent) { ctx.fillStyle = L.accent; ctx.fillRect(-w / 2, L.side === 'bottom' ? -hh / 2 : hh / 2 - 14, w, 14); }
      ctx.textAlign = 'center'; ctx.fillStyle = L.fg || '#111111';
      const fam = L.font || 'Barlow Condensed';
      let size = L.size || 110;
      ctx.font = F(900, size, fam);
      let lines = wrap(ctx, L.title || 'BAŞLIK', w - 140);
      while (lines.length * size * 1.05 > hh * 0.62 && size > 40) { size -= 6; ctx.font = F(900, size, fam); lines = wrap(ctx, L.title || '', w - 140); }
      const sub = L.text ? wrap((ctx.font = F(600, size * 0.38, 'Barlow'), ctx), L.text, w - 160) : [];
      const tot = lines.length * size * 1.05 + (sub.length ? 30 + sub.length * size * 0.48 : 0);
      let y = -tot / 2 + size * 0.85;
      ctx.font = F(900, size, fam);
      lines.forEach((ln) => {
        const parts = ln.split(/(\*[^*]+\*)/);
        let x = -ctx.measureText(ln.replace(/\*/g, '')).width / 2;
        ctx.textAlign = 'left';
        parts.forEach((p) => { const hl = /^\*.*\*$/.test(p); const s = p.replace(/\*/g, ''); ctx.fillStyle = hl ? (L.accent || '#E11D48') : (L.fg || '#111'); ctx.fillText(s, x, y); x += ctx.measureText(s).width; });
        y += size * 1.05;
      });
      if (sub.length) { y += 10; ctx.textAlign = 'center'; ctx.font = F(600, size * 0.38, 'Barlow'); ctx.fillStyle = L.fg2 || '#555'; sub.forEach((ln) => { ctx.fillText(ln, 0, y); y += size * 0.48; }); }
      ctx.restore();
      return { w, h: hh };
    }
    case 'ytend': {
      const w = 980, hh = 760;
      ctx.textAlign = 'center';
      avatar(ctx, L, 0, -hh / 2 + 140, 120, env);
      const tap = L.tapAt ?? 1.2;
      const done = lt > tap;
      roundRect(ctx, -170, -hh / 2 + 290, 340, 92, 46); ctx.fillStyle = done ? '#3A3A3D' : (L.accent || '#EF4444'); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = F(800, 36); ctx.fillText(done ? '✓ ABONE OLUNDU' : (L.btn || 'ABONE OL'), 0, -hh / 2 + 348);
      const vw = 440, vh = 250;
      [-1, 1].forEach((s, i) => {
        const x = s * (vw / 2 + 20), y = hh / 2 - vh / 2 - 40;
        const k = back((lt - 0.3 - i * 0.15) / 0.4);
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        roundRect(ctx, -vw / 2, -vh / 2, vw, vh, 24);
        const img = L[`v${i + 1}`] && env.img ? env.img(L[`v${i + 1}`]) : null;
        if (img && (img.naturalWidth || img.width)) { ctx.save(); ctx.clip(); const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, kk = Math.max(vw / iw, vh / ih); ctx.drawImage(img, -iw * kk / 2, -ih * kk / 2, iw * kk, ih * kk); ctx.restore(); }
        else { ctx.fillStyle = 'rgba(20,20,24,.85)'; ctx.fill(); }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
        icon(ctx, 'play', 0, -10, 80, 'rgba(255,255,255,.9)');
        ctx.fillStyle = '#fff'; ctx.font = F(700, 30); ctx.fillText(i ? (L.label2 || 'Önerilen video') : (L.label1 || 'Sonraki video'), 0, vh / 2 - 26);
        ctx.restore();
      });
      return { w, h: hh };
    }
    case 'lowerthird': {
      const k = easeOut(lt / 0.5);
      ctx.font = F(800, 64, 'Barlow Condensed');
      const nw = ctx.measureText(L.name || 'İSİM SOYİSİM').width;
      ctx.font = F(600, 36);
      const tw = ctx.measureText(L.title || 'Unvan').width;
      const w = Math.max(nw, tw) + 120, hh = 170;
      ctx.save();
      ctx.beginPath(); ctx.rect(-w / 2, -hh / 2, w * k, hh); ctx.clip();
      ctx.fillStyle = L.accent || '#E11D48'; ctx.fillRect(-w / 2, -hh / 2, 16, hh);
      ctx.fillStyle = L.dark === false ? 'rgba(255,255,255,.95)' : 'rgba(10,10,14,.86)'; ctx.fillRect(-w / 2 + 16, -hh / 2, w - 16, 100);
      ctx.fillStyle = L.accent || '#E11D48'; ctx.fillRect(-w / 2 + 16, -hh / 2 + 100, tw + 70, 64);
      ctx.textAlign = 'left';
      ctx.fillStyle = L.dark === false ? '#111' : '#fff'; ctx.font = F(800, 64, 'Barlow Condensed'); ctx.fillText(L.name || 'İSİM SOYİSİM', -w / 2 + 50, -hh / 2 + 74);
      ctx.fillStyle = '#fff'; ctx.font = F(600, 36); ctx.fillText(L.title || 'Unvan', -w / 2 + 50, -hh / 2 + 145);
      ctx.restore();
      return { w, h: hh };
    }
    case 'ticker': {
      const W = env.W || 1080, w = W, hh = 96;
      ctx.fillStyle = L.bg || '#B91C1C'; ctx.fillRect(-w / 2, -hh / 2, w, hh);
      ctx.fillStyle = L.accent || '#FACC15'; ctx.fillRect(-w / 2, -hh / 2, 280, hh);
      ctx.fillStyle = '#111'; ctx.font = F(900, 46, 'Barlow Condensed'); ctx.textAlign = 'center'; ctx.fillText(L.title || 'SON DAKİKA', -w / 2 + 140, 16);
      ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + 280, -hh / 2, w - 280, hh); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.font = F(700, 44); ctx.textAlign = 'left';
      const txt = `${L.text || 'Haber metni buraya'}   •   `;
      const tw = ctx.measureText(txt).width;
      const off = ((lt * (L.speed || 220)) % tw);
      for (let x = -w / 2 + 300 - off; x < w / 2; x += tw) ctx.fillText(txt, x, 15);
      ctx.restore();
      return { w, h: hh };
    }
    case 'playercard': {
      const w = 760, hh = 980;
      card(ctx, w, hh, 40, L.dark === false ? '#ffffff' : '#0E0E14', S);
      ctx.save(); roundRect(ctx, -w / 2, -hh / 2, w, hh, 40); ctx.clip();
      const g = ctx.createLinearGradient(0, -hh / 2, 0, 80);
      g.addColorStop(0, L.accent || '#10B981'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -hh / 2, w, 560);
      ctx.restore();
      const fg = L.dark === false ? '#111' : '#fff';
      ctx.textAlign = 'left'; ctx.fillStyle = fg; ctx.font = F(900, 150, 'Barlow Condensed'); ctx.fillText(String(L.number ?? 10), -w / 2 + 50, -hh / 2 + 170);
      ctx.font = F(700, 34); ctx.fillText(L.pos || 'FORVET', -w / 2 + 56, -hh / 2 + 220);
      avatar(ctx, { ...L, name: L.name }, 120, -hh / 2 + 220, 150, env);
      ctx.textAlign = 'center'; ctx.font = F(900, 74, 'Barlow Condensed'); ctx.fillStyle = fg; ctx.fillText((L.name || 'OYUNCU ADI').toLocaleUpperCase('tr-TR'), 0, -hh / 2 + 480);
      ctx.fillStyle = L.accent || '#10B981'; ctx.fillRect(-60, -hh / 2 + 510, 120, 8);
      const rows = String(L.stats || 'Video|128\nAbone|45B\nİzlenme|2.1M\nYıl|4').split('\n').map((r) => r.split('|'));
      rows.slice(0, 5).forEach(([k, v], i) => {
        const y = -hh / 2 + 600 + i * 80;
        const a = clamp((lt - 0.3 - i * 0.12) / 0.35);
        ctx.globalAlpha *= 1;
        ctx.textAlign = 'left'; ctx.fillStyle = L.dark === false ? '#555' : '#A3A3B5'; ctx.font = F(600, 38); ctx.fillText(k, -w / 2 + 70, y);
        ctx.textAlign = 'right'; ctx.fillStyle = fg; ctx.font = F(800, 46, 'Barlow Condensed');
        const n = parseFloat(v); ctx.fillText(Number.isFinite(n) && String(n) === v.trim() ? String(Math.round(n * easeOut(a))) : v, w / 2 - 70, y);
      });
      return { w, h: hh };
    }
    case 'versus': {
      const w = 1000, hh = 420;
      const k = easeOut(lt / 0.5);
      ctx.save();
      [[-1, L.teamA || 'TAKIM A', L.colorA || '#E11D48'], [1, L.teamB || 'TAKIM B', L.colorB || '#2563EB']].forEach(([s, name, col]) => {
        ctx.save();
        ctx.translate(s * (1 - k) * 600, 0);
        ctx.beginPath();
        if (s < 0) { ctx.moveTo(-w / 2, -hh / 2); ctx.lineTo(30, -hh / 2); ctx.lineTo(-30, hh / 2); ctx.lineTo(-w / 2, hh / 2); }
        else { ctx.moveTo(30, -hh / 2); ctx.lineTo(w / 2, -hh / 2); ctx.lineTo(w / 2, hh / 2); ctx.lineTo(-30, hh / 2); }
        ctx.closePath(); ctx.fillStyle = col; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        let fsz = 80; ctx.font = F(900, fsz, 'Barlow Condensed');
        let lines = wrap(ctx, name, 330);
        while ((lines.length > 2 || Math.max(...lines.map((l) => ctx.measureText(l).width)) > 330) && fsz > 34) { fsz -= 4; ctx.font = F(900, fsz, 'Barlow Condensed'); lines = wrap(ctx, name, 330); }
        lines.slice(0, 2).forEach((ln, i, arr) => ctx.fillText(ln, s * 270, fsz * 0.35 - (arr.length - 1) * fsz * 0.5 + i * fsz));
        ctx.restore();
      });
      const p = back((lt - 0.35) / 0.4);
      ctx.save(); ctx.scale(p, p);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 90, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.stroke();
      ctx.fillStyle = L.accent || '#FACC15'; ctx.font = F(900, 86, 'Barlow Condensed'); ctx.textAlign = 'center'; ctx.fillText('VS', 0, 30);
      ctx.restore();
      if (L.text) { ctx.fillStyle = '#fff'; ctx.font = F(700, 40); ctx.textAlign = 'center'; ctx.fillText(L.text, 0, hh / 2 + 60); }
      ctx.restore();
      return { w, h: hh + (L.text ? 80 : 0) };
    }
    default: return drawSocial3(ctx, L, lt, env) || { w: 600, h: 200 };
  }
}

const A = (inn = 'pop', out = 'fade', loop = 'none', inDur = 0.45) => ({ in: inn, out, loop, inDur, outDur: 0.35 });
const CHAT1 = '< Yeni videoyu izledin mi?? 😱\n> İzledim! Sonu efsaneydi\n< O geçiş nasıl yapıldı öyle 😂\n> Bence bu sefer viral olur 🚀\n< Linkini at hemen!';
const CHAT2 = '< Yapay zekâ ile video yapmayı öğrettin mi?\n> Evet, kanalda yeni bölüm var\n< Link?\n> Profilde 👆\n< Abone oldum bile 🔥';

export const SOCIAL_TEMPLATES2 = [
  { id: 'imsg', name: 'iPhone sohbet', cat: 'Sohbet', p: { type: 'imessage', name: 'Ahmet', msgs: CHAT1, every: 1.1, y: 0.5, scale: 0.92, anim: A('pop') }, dur: 7 },
  { id: 'imsgDark', name: 'iPhone sohbet (koyu)', cat: 'Sohbet', p: { type: 'imessage', dark: true, name: 'Zeynep', msgs: CHAT2, every: 1.1, y: 0.5, scale: 0.92, anim: A('pop') }, dur: 7 },
  { id: 'wa', name: 'WhatsApp tarzı sohbet', cat: 'Sohbet', p: { type: 'whatsapp', name: 'Ekip 🎬', status: 'Ali, Can, Elif, sen', msgs: 'Ali: Kurgu bitti mi? 🎬\nCan: Son rötuşlar 🔥\nElif: Müziği değiştirelim mi?\nAli: Bence harika olmuş 👏', every: 1.1, y: 0.5, scale: 0.92, anim: A('pop') }, dur: 7 },
  { id: 'waDark', name: 'WhatsApp tarzı (koyu)', cat: 'Sohbet', p: { type: 'whatsapp', dark: true, name: 'Annem ❤️', status: 'çevrimiçi', msgs: '< Yemek hazır, gel\n> 5 dk anne video çekiyorum\n< Hangi video?\n> Bir milyon izlenme olacak 😎\n< 😂😂', every: 1.1, y: 0.5, scale: 0.92, anim: A('pop') }, dur: 7 },
  { id: 'ytcard', name: 'YouTube kanal kartviziti', cat: 'Profil', p: { type: 'ytcard', name: 'Kanal Adı', handle: '@kanaladi', subs: 128000, videos: 340, text: 'Yaratıcı içerikler • Her hafta yeni video', btn: 'Abone ol', doneBtn: 'Abone olundu', accent: '#EF4444', accent2: '#7C3AED', tapAt: 1.4, y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'ytcardDark', name: 'Kanal kartviziti (koyu)', cat: 'Profil', p: { type: 'ytcard', dark: true, name: 'AI Stüdyo', handle: '@aistudyo', subs: 54000, videos: 120, text: 'Yapay zekâ ile video üretimi, araç incelemeleri', btn: 'Abone ol', doneBtn: 'Abone olundu', accent: '#8B5CF6', accent2: '#22D3EE', tapAt: 1.4, y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'xprof', name: 'X tarzı profil kartı', cat: 'Profil', p: { type: 'xprofile', name: 'Gündem', handle: '@gundem', verified: true, text: 'Günlük gündem, analizler ve veriler. 📊', followers: 245000, following: 412, btn: 'Takip et', accent: '#1D9BF0', y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'xprofDark', name: 'X profil (koyu)', cat: 'Profil', p: { type: 'xprofile', dark: true, name: 'Teknoloji Notları', handle: '@teknonotlar', verified: true, text: 'Taktik, veri ve video analiz.', followers: 98000, following: 210, btn: 'Takip et', accent: '#334155', y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'igprof', name: 'Instagram tarzı profil', cat: 'Profil', p: { type: 'igprofile', name: 'Kanal Adı', text: 'Tasarım • Yapay zekâ • Günlük içerik\n👇 Yeni video', posts: 248, followers: 52000, following: 310, btn: 'Takip et', y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'halfTop', name: 'Yarım ekran yazı (üst)', cat: 'Yarım ekran', p: { type: 'halftext', side: 'top', title: 'BU AN *TARİHE* GEÇTİ', text: 'Kimsenin beklemediği o an', bg: '#FFFFFF', fg: '#111111', fg2: '#555555', accent: '#E11D48', x: 0.5, y: 0.25, scale: 1, anim: A('none', 'fade') }, dur: 5 },
  { id: 'halfBottom', name: 'Yarım ekran yazı (alt)', cat: 'Yarım ekran', p: { type: 'halftext', side: 'bottom', title: 'YAPAY ZEKÂ *BUNU* YAPTI', text: 'Sonuna kadar izle', bg: '#0B0B0F', fg: '#FFFFFF', fg2: '#A3A3B5', accent: '#8B5CF6', x: 0.5, y: 0.75, scale: 1, anim: A('none', 'fade') }, dur: 5 },
  { id: 'halfQuote', name: 'Yarım ekran alıntı', cat: 'Yarım ekran', p: { type: 'halftext', side: 'top', portion: 0.4, title: '“TUTKU *HER ŞEYDİR*”', text: '— Bir içerik üreticisi', bg: '#FACC15', fg: '#111111', fg2: '#3F3F46', accent: '#111111', x: 0.5, y: 0.2, scale: 1, anim: A('none', 'fade') }, dur: 5 },
  { id: 'ytend', name: 'Bitiş ekranı', cat: 'Abone & beğen', p: { type: 'ytend', name: 'Kanal', btn: 'ABONE OL', accent: '#EF4444', label1: 'Sonraki video', label2: 'Önerilen video', y: 0.5, anim: A('fade') }, dur: 6 },
  { id: 'lower', name: 'Alt bant (isim/unvan)', cat: 'Haber', p: { type: 'lowerthird', name: 'AHMET YILMAZ', title: 'Spor yorumcusu', accent: '#E11D48', x: 0.42, y: 0.78, anim: A('fade', 'fade') }, dur: 4 },
  { id: 'ticker', name: 'Haber bandı (kayan)', cat: 'Haber', p: { type: 'ticker', title: 'SON DAKİKA', text: 'Yeni özellik yayında • Biletler tükendi • Milli takım kadrosu belli oldu', speed: 220, x: 0.5, y: 0.9, anim: A('slideUp', 'slideDown') }, dur: 8 },
  { id: 'versus', name: 'VS kartı', cat: 'Haber', p: { type: 'versus', teamA: 'EV SAHİBİ', teamB: 'DEPLASMAN', colorA: '#E11D48', colorB: '#2563EB', text: 'Pazar 20:00', y: 0.45, anim: A('fade') }, dur: 4 },
];

export const SOCIAL_FIELDS2 = {
  imessage: ['name', 'msgs', 'every', 'read', 'dark', 'avatar', 'clock'],
  whatsapp: ['name', 'status', 'msgs', 'every', 'time', 'dark', 'avatar'],
  ytcard: ['name', 'handle', 'subs', 'videos', 'text', 'btn', 'doneBtn', 'tapAt', 'verified', 'accent', 'accent2', 'dark', 'avatar', 'banner'],
  xprofile: ['name', 'handle', 'verified', 'text', 'followers', 'following', 'btn', 'accent', 'dark', 'avatar'],
  igprofile: ['name', 'text', 'posts', 'followers', 'following', 'btn', 'dark', 'avatar'],
  halftext: ['title', 'text', 'side', 'portion', 'bg', 'fg', 'fg2', 'accent', 'size'],
  ytend: ['name', 'btn', 'accent', 'label1', 'label2', 'tapAt', 'avatar', 'v1', 'v2'],
  lowerthird: ['name', 'title', 'accent', 'dark'],
  ticker: ['title', 'text', 'speed', 'bg', 'accent'],
  playercard: ['name', 'number', 'pos', 'stats', 'accent', 'dark', 'avatar'],
  versus: ['teamA', 'teamB', 'colorA', 'colorB', 'text', 'accent'],
};
