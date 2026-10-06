// Alpicut v1.8 — Sosyal medya çağrıları: abone ol, takip et, beğen, yorum yaz, paylaş, kaydet, bildirim zili, bio linki,
// yukarı kaydır, bölüm etiketi, bitiş ekranı, takipçi sayacı, anket, soru kutusu, canlı rozeti, sesi aç, sonuna kadar izle,
// kullanıcı adı, yan eylem çubuğu, yeni video bildirimi. Platform renklerinde ama logo/marka kopyalanmadan (genel ikonlar).
import {
  F, UI, MONO, clamp, roundRect, easeOut, easeOut5, easeIO, back, spring, lerp, hash, seg, hexA, mixHex,
  spaced, wrap, glow, twinkle, fitFont, icon, tapRing, cursorTap, fmtK, num,
} from './motionkit.js';

export const SM_FULL = [];
const STYLES = {
  red: { name: 'Kırmızı (video kanalı)', bg: '#FFFFFF', fg: '#0F0F0F', sub: '#606060', btn: ['#FF0033'], btnFg: '#FFFFFF', done: '#E5E5E5', doneFg: '#0F0F0F', acc: '#FF0033', acc2: '#FF0033' },
  grad: { name: 'Gradyan (fotoğraf uygulaması)', bg: '#FFFFFF', fg: '#111111', sub: '#737373', btn: ['#F58529', '#DD2A7B', '#8134AF'], btnFg: '#FFFFFF', done: '#EFEFEF', doneFg: '#111111', acc: '#DD2A7B', acc2: '#F58529' },
  neon: { name: 'Neon (kısa video)', bg: '#121212', fg: '#FFFFFF', sub: '#A1A1A1', btn: ['#FE2C55'], btnFg: '#FFFFFF', done: '#2F2F2F', doneFg: '#FFFFFF', acc: '#FE2C55', acc2: '#25F4EE', dual: true },
  light: { name: 'Minimal açık', bg: '#FFFFFF', fg: '#111111', sub: '#6B7280', btn: ['#111111'], btnFg: '#FFFFFF', done: '#F3F4F6', doneFg: '#111111', acc: '#111111', acc2: '#6B7280' },
  dark: { name: 'Minimal koyu', bg: '#141416', fg: '#FAFAFA', sub: '#9CA3AF', btn: ['#FAFAFA'], btnFg: '#111111', done: '#27272A', doneFg: '#FAFAFA', acc: '#FAFAFA', acc2: '#9CA3AF' },
  glass: { name: 'Cam', bg: 'rgba(255,255,255,.16)', fg: '#FFFFFF', sub: 'rgba(255,255,255,.75)', btn: ['rgba(255,255,255,.95)'], btnFg: '#111111', done: 'rgba(255,255,255,.22)', doneFg: '#FFFFFF', acc: '#FFFFFF', acc2: '#FFFFFF', glass: true },
  latte: { name: 'Latte', bg: '#EFE4D6', fg: '#2B1E17', sub: '#7A6352', btn: ['#8B5E3C'], btnFg: '#FFF8F0', done: '#E2D2BE', doneFg: '#2B1E17', acc: '#C2603D', acc2: '#C9A27E' },
  purple: { name: 'Mor', bg: '#17131F', fg: '#F5F3FF', sub: '#A7A0B8', btn: ['#7C5CFF', '#B794FF'], btnFg: '#FFFFFF', done: '#2A2438', doneFg: '#F5F3FF', acc: '#9D8CF2', acc2: '#E9C7A1' },
};
const st = (L) => {
  const s = { ...(STYLES[L.style] || STYLES.red) };
  if (L.accent) { s.btn = [L.accent]; s.acc = L.accent; }
  if (L.dark != null && !STYLES[L.style]?.glass) { if (L.dark) Object.assign(s, { bg: '#141416', fg: '#FAFAFA', sub: '#9CA3AF', done: '#27272A', doneFg: '#FAFAFA' }); }
  return s;
};
const fillBtn = (ctx, s, x, y, w, h) => { if (s.btn.length > 1) { const g = ctx.createLinearGradient(x, y, x + w, y + h); s.btn.forEach((c, i) => g.addColorStop(i / (s.btn.length - 1), c)); return g; } return s.btn[0]; };
const panel = (ctx, s, x, y, w, h, r, S) => {
  ctx.save(); ctx.shadowColor = s.glass ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.32)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 14 * S;
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = s.bg; ctx.fill(); ctx.restore();
  if (s.glass) { ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
};
const avatar = (ctx, L, x, y, r, s, env) => {
  const img = L.avatar && env.img ? env.img(L.avatar) : null;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  if (img) { const iw = img.width || img.videoWidth || 1, ih = img.height || img.videoHeight || 1, k = Math.max((r * 2) / iw, (r * 2) / ih); ctx.drawImage(img, x - iw * k / 2, y - ih * k / 2, iw * k, ih * k); }
  else { const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, s.acc2 || s.acc); g.addColorStop(1, s.acc); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.fillStyle = '#FFFFFF'; ctx.font = F(800, r * 0.95); ctx.textAlign = 'center'; ctx.fillText(String(L.name || 'K').trim()[0]?.toLocaleUpperCase('tr-TR') || 'K', x, y + r * 0.34); ctx.textAlign = 'left'; }
  ctx.restore();
};
const intro = (ctx, lt, d = 0.45) => { const p = easeOut5(seg(lt, 0, d)); ctx.translate(0, (1 - p) * 60); ctx.globalAlpha *= p; return p; };
const outro = (ctx, lt, life) => { const p = seg(lt, life - 0.35, life); ctx.globalAlpha *= 1 - p; };

export const SM_FIELDS = {
  sm_subscribe: ['style', 'name', 'subs', 'btn', 'doneText', 'tapAt', 'avatar', 'accent'],
  sm_follow: ['style', 'name', 'handle', 'btn', 'doneText', 'tapAt', 'avatar', 'accent'],
  sm_like: ['style', 'from', 'text', 'accent'],
  sm_comment: ['style', 'name', 'text', 'avatar', 'accent'],
  sm_share: ['style', 'title', 'doneText', 'accent'],
  sm_save: ['style', 'text', 'accent'],
  sm_bell: ['style', 'text', 'sub', 'accent'],
  sm_linkbio: ['style', 'text', 'accent'],
  sm_swipe: ['style', 'text', 'accent'],
  sm_part: ['style', 'num', 'text', 'accent'],
  sm_endscreen: ['style', 'title', 'v1', 'v2', 'avatar', 'name', 'accent'],
  sm_counter: ['style', 'from', 'to', 'text', 'accent'],
  sm_poll: ['style', 'title', 'optA', 'optB', 'value', 'tapAt', 'accent'],
  sm_question: ['style', 'title', 'text', 'accent'],
  sm_live: ['style', 'text', 'to', 'accent'],
  sm_sound: ['style', 'text', 'accent'],
  sm_watch: ['style', 'text', 'accent'],
  sm_handle: ['style', 'handle', 'text', 'accent'],
  sm_combo: ['style', 'likes', 'comments', 'shares', 'accent'],
  sm_newvideo: ['style', 'name', 'title', 'v1', 'avatar', 'accent'],
};
export const SM_META = {
  style: { label: 'Görünüm', type: 'chips', options: Object.entries(STYLES).map(([k, v]) => [k, v.name]) },
  subs: { label: 'Abone sayısı', type: 'number' },
  handle: { label: 'Kullanıcı adı', type: 'text' },
  optA: { label: '1. seçenek', type: 'text' }, optB: { label: '2. seçenek', type: 'text' },
  likes: { label: 'Beğeni', type: 'number' }, comments: { label: 'Yorum', type: 'number' }, shares: { label: 'Paylaşım', type: 'number' },
  tapAt: { label: 'Dokunma anı (sn)', type: 'range', min: 0.3, max: 6, step: 0.1 },
  num: { label: 'Numara', type: 'text' },
};

export const SM_DRAW = {
  // ---------- Abone ol: dokun → abone olundu → zil çalar ----------
  sm_subscribe(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 900, H = 200, tapAt = +L.tapAt || 1.3, life = (L.end ?? 9) - (L.start ?? 0);
    ctx.save(); intro(ctx, lt); outro(ctx, lt, life);
    panel(ctx, s, -W / 2, -H / 2, W, H, 100, S);
    avatar(ctx, L, -W / 2 + 100, 0, 64, s, env);
    ctx.fillStyle = s.fg; ctx.font = F(700, 44); ctx.fillText(L.name || 'Kanal Adı', -W / 2 + 190, -10);
    const subs = num(L.subs, 128000) + (lt > tapAt ? 1 : 0);
    ctx.fillStyle = s.sub; ctx.font = F(500, 30); ctx.fillText(`${fmtK(subs)} abone`, -W / 2 + 190, 34);
    const done = lt >= tapAt, bp = seg(lt, tapAt, tapAt + 0.25);
    const bw = done ? 330 : 260, bx = W / 2 - 40 - bw, by = -42;
    const press = seg(lt, tapAt - 0.05, tapAt + 0.08) * (1 - seg(lt, tapAt + 0.08, tapAt + 0.25));
    ctx.save(); ctx.translate(bx + bw / 2, 0); ctx.scale(1 - press * 0.06, 1 - press * 0.06); ctx.translate(-(bx + bw / 2), 0);
    roundRect(ctx, bx, by, bw, 84, 42); ctx.fillStyle = done ? s.done : fillBtn(ctx, s, bx, by, bw, 84); ctx.fill();
    ctx.fillStyle = done ? s.doneFg : s.btnFg; ctx.font = F(700, 32); ctx.textAlign = 'center';
    if (done) { const sw = Math.sin(lt * 18) * (1 - seg(lt, tapAt + 0.3, tapAt + 1.4)) * 0.45; ctx.save(); ctx.translate(bx + 52, -16); ctx.rotate(sw); icon(ctx, 'bellO', 0, 16, 40, s.doneFg); ctx.restore(); ctx.fillText(L.doneText || 'Abone olundu', bx + bw / 2 + 34, 12); }
    else ctx.fillText(String(L.btn || 'Abone ol').toLocaleUpperCase('tr-TR'), bx + bw / 2, 12);
    ctx.textAlign = 'left'; ctx.restore();
    if (bp > 0 && bp < 1) for (let i = 0; i < 10; i++) { const an = (i / 10) * Math.PI * 2; const r = 60 + bp * 90; ctx.fillStyle = hexA(s.acc, 1 - bp); ctx.beginPath(); ctx.arc(bx + bw / 2 + Math.cos(an) * r * 1.6, Math.sin(an) * r * 0.6, 7, 0, Math.PI * 2); ctx.fill(); }
    cursorTap(ctx, bx + bw / 2 - 10, -10, lt, tapAt, S);
    ctx.restore();
    return { w: W, h: H + 120 };
  },

  // ---------- Takip et ----------
  sm_follow(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 760, H = 150, tapAt = +L.tapAt || 1.2, life = (L.end ?? 9) - (L.start ?? 0);
    ctx.save(); intro(ctx, lt); outro(ctx, lt, life);
    panel(ctx, s, -W / 2, -H / 2, W, H, 75, S);
    avatar(ctx, L, -W / 2 + 76, 0, 50, s, env);
    if (s.btn.length > 1) { ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = fillBtn(ctx, s, -W / 2 + 20, -60, 120, 120); ctx.beginPath(); ctx.arc(-W / 2 + 76, 0, 58, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = s.fg; ctx.font = F(700, 38); ctx.fillText(L.name || 'Kanal Adı', -W / 2 + 150, -6);
    ctx.fillStyle = s.sub; ctx.font = F(500, 28); ctx.fillText(L.handle || '@kanaladi', -W / 2 + 150, 34);
    const done = lt >= tapAt, bw = 230, bx = W / 2 - 30 - bw;
    const press = seg(lt, tapAt - 0.05, tapAt + 0.08) * (1 - seg(lt, tapAt + 0.08, tapAt + 0.25));
    ctx.save(); ctx.translate(bx + bw / 2, 0); ctx.scale(1 - press * 0.07, 1 - press * 0.07); ctx.translate(-(bx + bw / 2), 0);
    roundRect(ctx, bx, -36, bw, 72, 20); ctx.fillStyle = done ? s.done : fillBtn(ctx, s, bx, -36, bw, 72); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = done ? s.doneFg : s.btnFg; ctx.font = F(700, 30);
    if (done) { icon(ctx, 'check', bx + 40, 0, 34, s.doneFg, 0.14); ctx.fillText(L.doneText || 'Takiptesin', bx + bw / 2 + 16, 10); } else ctx.fillText(L.btn || 'Takip et', bx + bw / 2, 10);
    ctx.textAlign = 'left'; ctx.restore();
    cursorTap(ctx, bx + bw / 2 - 10, -10, lt, tapAt, S);
    ctx.restore();
    return { w: W, h: H + 120 };
  },

  // ---------- Beğeni patlaması ----------
  sm_like(ctx, L, lt, env) {
    const S = env.S, s = st(L), c = s.dual ? '#FE2C55' : (L.accent || (L.style === 'grad' ? '#FF3040' : s.acc === '#111111' || s.acc === '#FAFAFA' ? '#FF3B5C' : s.acc));
    const p = spring(seg(lt, 0.15, 1.1)), bp = seg(lt, 0.15, 0.8);
    ctx.save(); ctx.scale(p, p);
    glow(ctx, hexA(c, 0.6), 40, S, () => icon(ctx, 'heart', 0, -40, 300, c));
    ctx.restore();
    if (bp > 0 && bp < 1) for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; const r = 150 + easeOut(bp) * 160; ctx.fillStyle = hexA(i % 3 ? c : '#FFD166', 1 - bp); ctx.beginPath(); ctx.arc(Math.cos(an) * r, -40 + Math.sin(an) * r, 12 * (1 - bp) + 3, 0, Math.PI * 2); ctx.fill(); }
    const cp = easeOut(seg(lt, 0.6, 1.4));
    ctx.save(); ctx.globalAlpha *= cp; ctx.textAlign = 'center'; ctx.font = F(800, 72); ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14 * S;
    const from = num(L.from, 12400); ctx.fillText(fmtK(lerp(from, from + 1, cp)), 0, 200); if (L.text) { ctx.font = F(600, 40); ctx.fillText(L.text, 0, 260); }
    ctx.restore(); ctx.textAlign = 'left';
    return { w: 700, h: 640 };
  },

  // ---------- Yorum yaz → gönder → yorum görünür ----------
  sm_comment(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 900, life = (L.end ?? 9) - (L.start ?? 0);
    ctx.save(); intro(ctx, lt); outro(ctx, lt, life);
    const txt = String(L.text || 'Bu video harika olmuş! 🔥');
    const typedN = Math.floor(clamp((lt - 0.5) * 22, 0, txt.length)); const tdone = 0.5 + txt.length / 22;
    const sent = lt > tdone + 0.4;
    // gönderilen yorum kartı
    if (sent) {
      const p = easeOut5(seg(lt, tdone + 0.4, tdone + 0.9));
      ctx.save(); ctx.globalAlpha *= p; ctx.translate(0, (1 - p) * 60);
      ctx.font = F(500, 36); const ls = wrap(ctx, txt, W - 220); const ch = 120 + ls.length * 46;
      panel(ctx, s, -W / 2, -ch - 30, W, ch, 34, S);
      avatar(ctx, L, -W / 2 + 70, -ch + 26, 38, s, env);
      ctx.fillStyle = s.fg; ctx.font = F(700, 32); ctx.fillText(L.name || 'Sen', -W / 2 + 130, -ch + 22); const nw = ctx.measureText(L.name || 'Sen').width;
      ctx.fillStyle = s.sub; ctx.font = F(500, 26); ctx.fillText('· şimdi', -W / 2 + 142 + nw, -ch + 22);
      ctx.fillStyle = s.fg; ctx.font = F(500, 36); ls.forEach((l, i) => ctx.fillText(l, -W / 2 + 130, -ch + 72 + i * 46));
      const lk = seg(lt, tdone + 1.2, tdone + 1.5); icon(ctx, lk > 0 ? 'heart' : 'heartO', W / 2 - 60, -ch + 30, 34, lk > 0 ? '#FF3B5C' : s.sub, 0.12);
      ctx.restore();
    }
    // giriş kutusu
    panel(ctx, s, -W / 2, 0, W, 110, 55, S);
    avatar(ctx, L, -W / 2 + 60, 55, 32, s, env);
    ctx.save(); ctx.beginPath(); ctx.rect(-W / 2 + 110, 0, W - 230, 110); ctx.clip();
    ctx.font = F(500, 34);
    if (sent || typedN === 0) { ctx.fillStyle = s.sub; ctx.fillText('Yorum ekle…', -W / 2 + 116, 67); }
    else { ctx.fillStyle = s.fg; const shown = txt.slice(0, typedN); const tw = ctx.measureText(shown).width; const off = Math.max(0, tw - (W - 260)); ctx.fillText(shown, -W / 2 + 116 - off, 67); if (Math.floor(lt * 2.4) % 2 === 0) { ctx.fillStyle = s.acc; ctx.fillRect(-W / 2 + 120 + tw - off, 36, 4, 42); } }
    ctx.restore();
    const ready = typedN > 0 && !sent; const pulse = ready ? 1 + 0.06 * Math.sin(lt * 10) : 1;
    ctx.save(); ctx.translate(W / 2 - 62, 55); ctx.scale(pulse, pulse); ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fillStyle = ready ? fillBtn(ctx, s, -36, -36, 72, 72) : s.done; ctx.fill(); icon(ctx, 'send', 0, 0, 34, ready ? s.btnFg : s.sub, 0.12); ctx.restore();
    tapRing(ctx, W / 2 - 62, 55, seg(lt, tdone + 0.25, tdone + 0.8), s.acc);
    ctx.restore();
    return { w: W, h: 560 };
  },

  // ---------- Paylaş menüsü ----------
  sm_share(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 900, H = 420, life = (L.end ?? 9) - (L.start ?? 0);
    ctx.save(); const p = easeOut5(seg(lt, 0, 0.5)); ctx.translate(0, (1 - p) * 300); outro(ctx, lt, life);
    panel(ctx, s, -W / 2, -H / 2, W, H, 44, S);
    ctx.fillStyle = s.sub; roundRect(ctx, -40, -H / 2 + 18, 80, 8, 4); ctx.fill();
    ctx.fillStyle = s.fg; ctx.font = F(700, 38); ctx.textAlign = 'center'; ctx.fillText(L.title || 'Paylaş', 0, -H / 2 + 90);
    const items = [['link', 'Bağlantı'], ['send', 'Mesaj'], ['repost', 'Yeniden'], ['comment', 'Sohbet'], ['bookmark', 'Kaydet']];
    const cols = ['#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899'];
    items.forEach(([ic, lb], i) => {
      const x = -W / 2 + 110 + i * 170, y = 20, ip = back(seg(lt, 0.25 + i * 0.07, 0.6 + i * 0.07));
      ctx.save(); ctx.translate(x, y); ctx.scale(ip, ip); ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fillStyle = s.glass ? 'rgba(255,255,255,.2)' : cols[i]; ctx.fill(); icon(ctx, ic, 0, 0, 52, '#FFFFFF', 0.11); ctx.restore();
      ctx.fillStyle = s.sub; ctx.font = F(500, 26); ctx.fillText(lb, x, y + 100);
    });
    const tapAt = 1.5;
    cursorTap(ctx, -W / 2 + 110 - 10, 10, lt, tapAt, S);
    ctx.textAlign = 'left';
    const tp = easeOut5(seg(lt, tapAt + 0.2, tapAt + 0.5)) * (1 - seg(lt, tapAt + 2.2, tapAt + 2.5));
    if (tp > 0) { ctx.save(); ctx.globalAlpha *= tp; ctx.translate(0, -H / 2 - 90 + (1 - tp) * 30); roundRect(ctx, -260, -40, 520, 80, 40); ctx.fillStyle = 'rgba(20,20,22,.92)'; ctx.fill(); icon(ctx, 'check', -200, 0, 32, '#4ADE80', 0.14); ctx.fillStyle = '#FFFFFF'; ctx.font = F(600, 30); ctx.fillText(L.doneText || 'Bağlantı kopyalandı', -170, 11); ctx.restore(); }
    ctx.restore();
    return { w: W, h: H + 240 };
  },

  // ---------- Kaydet ----------
  sm_save(ctx, L, lt, env) {
    const S = env.S, s = st(L), tapAt = 0.9, done = lt >= tapAt;
    ctx.save(); intro(ctx, lt);
    const p = done ? spring(seg(lt, tapAt, tapAt + 0.9)) : 1;
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI * 2); ctx.fillStyle = s.bg; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 40 * S; ctx.fill(); ctx.restore();
    ctx.save(); ctx.scale(p, p); icon(ctx, done ? 'bookmarkF' : 'bookmark', 0, 0, 120, done ? (s.dual ? '#FFC93C' : s.acc) : s.fg, 0.1); ctx.restore();
    cursorTap(ctx, -10, -10, lt, tapAt, S);
    const tp = easeOut(seg(lt, tapAt + 0.2, tapAt + 0.6));
    ctx.save(); ctx.globalAlpha *= tp; ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.font = F(800, 56); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14 * S; ctx.fillText(L.text || 'Sonra izlemek için kaydet', 0, 220); ctx.restore();
    ctx.restore(); ctx.textAlign = 'left';
    return { w: 900, h: 560 };
  },

  // ---------- Bildirim zili ----------
  sm_bell(ctx, L, lt, env) {
    const S = env.S, s = st(L);
    ctx.save(); intro(ctx, lt);
    const ring = Math.sin(lt * 16) * 0.35 * Math.max(0, Math.sin(lt * 1.6));
    const W = 760, H = 170;
    panel(ctx, s, -W / 2, -H / 2, W, H, 85, S);
    ctx.save(); ctx.translate(-W / 2 + 90, -6); ctx.rotate(ring); ctx.beginPath(); ctx.arc(0, 6, 58, 0, Math.PI * 2); ctx.fillStyle = fillBtn(ctx, s, -58, -52, 116, 116); ctx.fill(); icon(ctx, 'bell', 0, 6, 62, s.btnFg); ctx.restore();
    const wv = seg(lt, 0.2, 1) * (0.5 + 0.5 * Math.sin(lt * 6));
    ctx.strokeStyle = hexA(s.acc, 0.5 * wv); ctx.lineWidth = 4; [1, 2].forEach((k) => { ctx.beginPath(); ctx.arc(-W / 2 + 90, 0, 70 + k * 16, -0.6, 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(-W / 2 + 90, 0, 70 + k * 16, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke(); });
    ctx.fillStyle = s.fg; ctx.font = F(800, 44); ctx.fillText(L.text || 'Bildirimleri aç', -W / 2 + 190, -6);
    ctx.fillStyle = s.sub; ctx.font = F(500, 28); ctx.fillText(L.sub || 'Yeni videoyu ilk sen izle', -W / 2 + 190, 36);
    ctx.restore();
    return { w: W, h: H + 80 };
  },

  // ---------- Link bio'da ----------
  sm_linkbio(ctx, L, lt, env) {
    const S = env.S, s = st(L);
    ctx.save(); intro(ctx, lt);
    const b = Math.abs(Math.sin(lt * 3.2)) * 26;
    ctx.save(); ctx.translate(0, -150 - b); icon(ctx, 'chevup', 0, 0, 70, '#FFFFFF', 0.12); ctx.translate(0, 34); ctx.globalAlpha *= 0.6; icon(ctx, 'chevup', 0, 0, 70, '#FFFFFF', 0.12); ctx.restore();
    ctx.font = F(800, 50); const txt = L.text || "Link bio'da"; const tw = ctx.measureText(txt).width; const W = tw + 170;
    const pulse = 1 + 0.03 * Math.sin(lt * 6);
    ctx.save(); ctx.scale(pulse, pulse);
    ctx.save(); ctx.shadowColor = hexA(s.acc, 0.6); ctx.shadowBlur = 36 * S; roundRect(ctx, -W / 2, -50, W, 100, 50); ctx.fillStyle = fillBtn(ctx, s, -W / 2, -50, W, 100); ctx.fill(); ctx.restore();
    icon(ctx, 'link', -W / 2 + 60, 0, 44, s.btnFg, 0.12); ctx.fillStyle = s.btnFg; ctx.fillText(txt, -W / 2 + 106, 18); ctx.restore();
    ctx.restore();
    return { w: W + 60, h: 420 };
  },

  // ---------- Yukarı kaydır ----------
  sm_swipe(ctx, L, lt, env) {
    const S = env.S, s = st(L);
    ctx.save(); intro(ctx, lt);
    for (let i = 0; i < 3; i++) { const ph = (lt * 1.4 + i / 3) % 1; ctx.save(); ctx.globalAlpha *= Math.sin(ph * Math.PI); ctx.translate(0, 40 - ph * 140); icon(ctx, 'chevup', 0, -60, 90, '#FFFFFF', 0.11); ctx.restore(); }
    ctx.textAlign = 'center'; ctx.font = F(800, 56); ctx.fillStyle = '#FFFFFF'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18 * S; ctx.fillText(L.text || 'Devamı için kaydır', 0, 110); ctx.restore();
    ctx.fillStyle = s.acc; roundRect(ctx, -60, 140, 120, 8, 4); ctx.fill();
    ctx.restore(); ctx.textAlign = 'left';
    return { w: 900, h: 420 };
  },

  // ---------- Bölüm etiketi (Part 2) ----------
  sm_part(ctx, L, lt, env) {
    const S = env.S, s = st(L), life = (L.end ?? 9) - (L.start ?? 0);
    ctx.save(); outro(ctx, lt, life);
    const p = easeOut5(seg(lt, 0, 0.6));
    ctx.font = F(900, 150); const n = String(L.num || '2'); const nw = ctx.measureText(n).width;
    const W = 330 + nw, H = 190;
    ctx.save(); ctx.translate((1 - p) * -900, 0); ctx.transform(1, 0, -0.18, 1, 0, 0);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 30 * S; ctx.fillStyle = fillBtn(ctx, s, -W / 2, -H / 2, W, H); ctx.fillRect(-W / 2, -H / 2, W, H); ctx.restore();
    if (s.dual) { ctx.fillStyle = '#25F4EE'; ctx.fillRect(-W / 2 - 12, -H / 2 + 12, 12, H); }
    ctx.fillStyle = hexA('#FFFFFF', 0.12); for (let i = 0; i < 8; i++) ctx.fillRect(-W / 2 + i * 60 + ((lt * 120) % 60), -H / 2, 20, H);
    ctx.restore();
    ctx.save(); ctx.translate((1 - easeOut5(seg(lt, 0.15, 0.75))) * -900, 0);
    ctx.fillStyle = s.btnFg; ctx.font = F(800, 52); ctx.fillText(String(L.text || 'BÖLÜM').toLocaleUpperCase('tr-TR'), -W / 2 + 40, 20);
    ctx.font = F(900, 150); ctx.fillText(n, W / 2 - 40 - nw, 54);
    ctx.restore();
    ctx.restore();
    return { w: W + 120, h: H + 60 };
  },

  // ---------- Bitiş ekranı: iki video kutusu + abone dairesi ----------
  sm_endscreen(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 1000, H = 760;
    ctx.textAlign = 'center';
    const tp = easeOut(seg(lt, 0, 0.5));
    ctx.save(); ctx.globalAlpha *= tp; ctx.fillStyle = '#FFFFFF'; ctx.font = F(800, 64); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14 * S; ctx.fillText(L.title || 'Sıradaki video 👇', 0, -H / 2 + 60); ctx.restore();
    const box = (x, y, w, h, key, t0, label) => {
      const p = easeOut5(seg(lt, t0, t0 + 0.6)); ctx.save(); ctx.globalAlpha *= p; ctx.translate(x, y + (1 - p) * 60);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 30 * S; roundRect(ctx, -w / 2, -h / 2, w, h, 22); ctx.fillStyle = '#1F1F23'; ctx.fill(); ctx.restore();
      const img = L[key] && env.img ? env.img(L[key]) : null;
      ctx.save(); roundRect(ctx, -w / 2, -h / 2, w, h, 22); ctx.clip();
      if (img) { const iw = img.width || img.videoWidth || 1, ih = img.height || img.videoHeight || 1, k = Math.max(w / iw, h / ih); ctx.drawImage(img, -iw * k / 2, -ih * k / 2, iw * k, ih * k); }
      else { const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, mixHex(s.acc, '#000000', 0.3)); g.addColorStop(1, '#111114'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h); }
      ctx.restore();
      ctx.strokeStyle = hexA('#FFFFFF', 0.25 + 0.35 * Math.max(0, Math.sin(lt * 3 + t0 * 3))); ctx.lineWidth = 4; roundRect(ctx, -w / 2, -h / 2, w, h, 22); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill(); icon(ctx, 'play', 4, 0, 50, '#FFFFFF');
      ctx.fillStyle = '#FFFFFF'; ctx.font = F(700, 28); ctx.fillText(label, 0, h / 2 + 46); ctx.restore();
    };
    box(-240, -60, 440, 250, 'v1', 0.3, 'Önerilen'); box(240, -60, 440, 250, 'v2', 0.45, 'Son yüklenen');
    const ap = back(seg(lt, 0.7, 1.2));
    ctx.save(); ctx.translate(0, 240); ctx.scale(ap, ap);
    ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill(); avatar(ctx, L, 0, 0, 92, s, env);
    const tapAt = 1.8, done = lt >= tapAt;
    roundRect(ctx, -110, 110, 220, 64, 32); ctx.fillStyle = done ? s.done : fillBtn(ctx, s, -110, 110, 220, 64); ctx.fill();
    ctx.fillStyle = done ? s.doneFg : s.btnFg; ctx.font = F(800, 28); ctx.fillText(done ? 'Abonesin ✓' : 'ABONE OL', 0, 152);
    ctx.restore();
    cursorTap(ctx, -10, 240 + 130, lt, tapAt, S);
    ctx.textAlign = 'left';
    return { w: W, h: H + 120 };
  },

  // ---------- Takipçi sayacı (dönen rakamlar + hedef) ----------
  sm_counter(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 860, H = 360;
    const from = num(L.from, 9800), to = num(L.to, 10000), cp = easeIO(seg(lt, 0.4, 2.6));
    ctx.save(); intro(ctx, lt);
    panel(ctx, s, -W / 2, -H / 2, W, H, 48, S);
    ctx.textAlign = 'center'; ctx.fillStyle = s.sub; ctx.font = F(600, 32); spaced(ctx, String(L.text || 'TAKİPÇİ').toLocaleUpperCase('tr-TR'), 0, -H / 2 + 80, 8);
    const val = Math.round(lerp(from, to, cp)); const str = val.toLocaleString('tr-TR');
    ctx.font = F(800, 150, MONO);
    const cw = ctx.measureText('0').width; const sw = ctx.measureText('.').width;
    const total = [...str].reduce((a, c) => a + (/\d/.test(c) ? cw : sw), 0); let x = -total / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -60, W, 180); ctx.clip();
    [...str].forEach((ch, i) => {
      const w = /\d/.test(ch) ? cw : sw;
      if (/\d/.test(ch)) { const place = [...str].slice(i + 1).filter((c) => /\d/.test(c)).length; const fv = lerp(from, to, cp) / Math.pow(10, place); const frac = fv - Math.floor(fv); const d = Math.floor(fv) % 10; const off = place === 0 ? 0 : easeIO(clamp((frac - 0.85) / 0.15)); ctx.fillStyle = s.fg; ctx.textAlign = 'left'; ctx.fillText(String(d), x, 100 - off * 150); if (off > 0) ctx.fillText(String((d + 1) % 10), x, 250 - off * 150); }
      else { ctx.fillStyle = s.fg; ctx.textAlign = 'left'; ctx.fillText(ch, x, 100); }
      x += w;
    });
    ctx.restore();
    const hit = cp >= 1;
    if (hit) { const hp = seg(lt, 2.6, 3.4); for (let i = 0; i < 30; i++) { const an = hash(i) * Math.PI * 2, r = easeOut(hp) * (300 + hash(i + 3) * 300); ctx.fillStyle = hexA(i % 3 ? s.acc : s.acc2 || '#FFD166', 1 - hp); ctx.save(); ctx.translate(Math.cos(an) * r, Math.sin(an) * r * 0.6 - 20 + hp * hp * 200); ctx.rotate(i + hp * 6); ctx.fillRect(-8, -4, 16, 8); ctx.restore(); } }
    ctx.fillStyle = hit ? s.acc : s.sub; ctx.font = F(700, 30); ctx.textAlign = 'center'; ctx.fillText(hit ? '🎉 Hedefe ulaşıldı!' : `Hedef: ${to.toLocaleString('tr-TR')}`, 0, H / 2 - 40);
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W, h: H + 80 };
  },

  // ---------- Anket ----------
  sm_poll(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 800, tapAt = +L.tapAt || 1.4, pa = clamp(num(L.value, 68) / 100);
    ctx.save(); intro(ctx, lt);
    ctx.font = F(800, 46); const q = wrap(ctx, L.title || 'Bir sonraki videoda ne olsun?', W - 100); const H = 150 + q.length * 56 + 220;
    panel(ctx, s, -W / 2, -H / 2, W, H, 40, S);
    ctx.fillStyle = s.fg; ctx.textAlign = 'center'; q.forEach((l, i) => ctx.fillText(l, 0, -H / 2 + 90 + i * 56));
    const done = lt >= tapAt, fp = easeOut5(seg(lt, tapAt, tapAt + 0.9));
    [[L.optA || 'Kamera arkası', pa], [L.optB || 'Soru-cevap', 1 - pa]].forEach(([lb, v], i) => {
      const y = -H / 2 + 130 + q.length * 56 + i * 104, x = -W / 2 + 50, w = W - 100;
      roundRect(ctx, x, y, w, 84, 42); ctx.fillStyle = s.done; ctx.fill();
      if (done) { ctx.save(); roundRect(ctx, x, y, w, 84, 42); ctx.clip(); ctx.fillStyle = i === 0 ? fillBtn(ctx, s, x, y, w, 84) : hexA(s.fg, 0.15); ctx.fillRect(x, y, w * v * fp, 84); ctx.restore(); }
      ctx.fillStyle = done && i === 0 ? s.btnFg : s.fg; ctx.textAlign = 'left'; ctx.font = F(700, 34); ctx.fillText(lb, x + 34, y + 54);
      if (done) { ctx.textAlign = 'right'; ctx.fillStyle = s.fg; ctx.fillText(`%${Math.round(v * 100 * fp)}`, x + w - 34, y + 54); }
    });
    cursorTap(ctx, -W / 2 + 200, -H / 2 + 160 + q.length * 56, lt, tapAt, S);
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W, h: H + 100 };
  },

  // ---------- Soru kutusu ----------
  sm_question(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 800;
    ctx.save(); intro(ctx, lt);
    const H = 360;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 14 * S; roundRect(ctx, -W / 2, -H / 2, W, H, 40); ctx.fillStyle = fillBtn(ctx, s, -W / 2, -H / 2, W, H); ctx.fill(); ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = s.btnFg; ctx.font = F(800, 46); ctx.fillText(L.title || 'Bana bir şey sor', 0, -H / 2 + 90);
    roundRect(ctx, -W / 2 + 40, -H / 2 + 130, W - 80, 190, 28); ctx.fillStyle = s.glass ? 'rgba(255,255,255,.2)' : '#FFFFFF'; ctx.fill();
    const txt = String(L.text || 'Videolarını hangi uygulamayla kurguluyorsun?'); const n = Math.floor(clamp((lt - 0.6) * 22, 0, txt.length));
    ctx.font = F(600, 36); ctx.fillStyle = n ? '#111111' : '#9CA3AF';
    const ls = wrap(ctx, n ? txt.slice(0, n) : 'Buraya yaz…', W - 140); ls.slice(0, 3).forEach((l, i) => ctx.fillText(l, 0, -H / 2 + 200 + i * 46));
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W, h: H + 80 };
  },

  // ---------- Canlı rozeti + izleyici ----------
  sm_live(ctx, L, lt, env) {
    const S = env.S, s = st(L), c = L.accent || (s.dual ? '#FE2C55' : s.acc === '#111111' || s.acc === '#FAFAFA' ? '#EF4444' : s.acc);
    ctx.save(); intro(ctx, lt);
    const pulse = 0.5 + 0.5 * Math.sin(lt * 5);
    ctx.save(); ctx.shadowColor = hexA(c, 0.7); ctx.shadowBlur = (20 + 20 * pulse) * S; roundRect(ctx, -250, -50, 230, 100, 18); ctx.fillStyle = c; ctx.fill(); ctx.restore();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(-210, 0, 12, 0, Math.PI * 2); ctx.globalAlpha *= 0.6 + 0.4 * pulse; ctx.fill(); ctx.globalAlpha = 1;
    ctx.font = F(900, 46); ctx.fillText(L.text || 'CANLI', -185, 16);
    roundRect(ctx, -6, -50, 260, 100, 18); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
    icon(ctx, 'eye', 46, 0, 50, '#FFFFFF', 0.1);
    const v = Math.round(num(L.to, 1250) * (0.97 + 0.03 * Math.sin(lt * 0.8)) + Math.floor(lt * 3));
    ctx.fillStyle = '#FFFFFF'; ctx.font = F(800, 42); ctx.fillText(fmtK(v), 84, 15);
    ctx.restore();
    return { w: 600, h: 220 };
  },

  // ---------- Sesi aç ----------
  sm_sound(ctx, L, lt, env) {
    const S = env.S, s = st(L);
    ctx.save(); intro(ctx, lt);
    ctx.font = F(800, 46); const txt = L.text || 'Sesi aç'; const tw = ctx.measureText(txt).width; const W = tw + 230;
    panel(ctx, s, -W / 2, -60, W, 120, 60, S);
    ctx.save(); ctx.translate(-W / 2 + 70, 0); icon(ctx, 'sound', 0, 0, 56, s.acc === '#FAFAFA' ? s.fg : s.acc, 0.1);
    for (let i = 0; i < 3; i++) { const ph = (lt * 1.5 + i / 3) % 1; ctx.strokeStyle = hexA(s.acc === '#FAFAFA' ? s.fg : s.acc, 1 - ph); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(4, 0, 30 + ph * 40, -0.7, 0.7); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = s.fg; ctx.fillText(txt, -W / 2 + 180, 16);
    ctx.restore();
    return { w: W + 60, h: 200 };
  },

  // ---------- Sonuna kadar izle ----------
  sm_watch(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 820, life = (L.end ?? 6) - (L.start ?? 0);
    ctx.save(); intro(ctx, lt);
    panel(ctx, s, -W / 2, -80, W, 160, 40, S);
    ctx.fillStyle = s.fg; ctx.font = F(800, 44); ctx.textAlign = 'center'; ctx.fillText(L.text || 'Sonuna kadar izle 👀', 0, -6);
    roundRect(ctx, -W / 2 + 50, 30, W - 100, 14, 7); ctx.fillStyle = s.done; ctx.fill();
    const p = clamp(lt / Math.max(1, life)); roundRect(ctx, -W / 2 + 50, 30, (W - 100) * p, 14, 7); ctx.fillStyle = fillBtn(ctx, s, -W / 2, 30, W, 14); ctx.fill();
    ctx.beginPath(); ctx.arc(-W / 2 + 50 + (W - 100) * p, 37, 14, 0, Math.PI * 2); ctx.fillStyle = s.btn[s.btn.length - 1]; ctx.fill();
    ctx.restore(); ctx.textAlign = 'left';
    return { w: W, h: 240 };
  },

  // ---------- Kullanıcı adı ----------
  sm_handle(ctx, L, lt, env) {
    const S = env.S, s = st(L);
    const p = easeOut5(seg(lt, 0, 0.6));
    ctx.font = F(800, 50); const h = String(L.handle || '@kanaladi'); const tw = ctx.measureText(h).width;
    ctx.font = F(500, 30); const sub = L.text || 'beni takip et'; const sw = ctx.measureText(sub).width;
    const W = Math.max(tw, sw) + 190;
    ctx.save(); ctx.beginPath(); ctx.rect(-W / 2 - 20, -90, (W + 40) * p, 180); ctx.clip();
    panel(ctx, s, -W / 2, -70, W, 140, 70, S);
    ctx.beginPath(); ctx.arc(-W / 2 + 70, 0, 46, 0, Math.PI * 2); ctx.fillStyle = fillBtn(ctx, s, -W / 2 + 24, -46, 92, 92); ctx.fill(); icon(ctx, 'user', -W / 2 + 70, 2, 54, s.btnFg);
    ctx.fillStyle = s.fg; ctx.font = F(800, 50); ctx.fillText(h, -W / 2 + 134, 4);
    ctx.fillStyle = s.sub; ctx.font = F(500, 30); ctx.fillText(sub, -W / 2 + 136, 44);
    ctx.restore();
    return { w: W + 60, h: 220 };
  },

  // ---------- Yan eylem çubuğu (beğen, yorum, paylaş) ----------
  sm_combo(ctx, L, lt, env) {
    const S = env.S, s = st(L);
    const items = [['heart', num(L.likes, 24800), '#FF3B5C'], ['comment', num(L.comments, 1320), '#FFFFFF'], ['bookmark', 3120, '#FFC93C'], ['share', num(L.shares, 860), '#FFFFFF']];
    items.forEach(([ic, n, c], i) => {
      const y = -330 + i * 210, tapAt = 0.7 + i * 0.7, done = lt >= tapAt;
      const ip = back(seg(lt, i * 0.1, 0.4 + i * 0.1));
      ctx.save(); ctx.translate(0, y); ctx.scale(ip, ip);
      const pp = done ? spring(seg(lt, tapAt, tapAt + 0.8)) : 1;
      ctx.save(); ctx.scale(pp, pp); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14 * S;
      if (ic === 'heart') icon(ctx, done ? 'heart' : 'heartO', 0, 0, 100, done ? c : '#FFFFFF', 0.1);
      else if (ic === 'bookmark') icon(ctx, done ? 'bookmarkF' : 'bookmark', 0, 0, 84, done ? c : '#FFFFFF', 0.1);
      else icon(ctx, ic, 0, 0, 90, '#FFFFFF', 0.1);
      ctx.restore();
      tapRing(ctx, 0, 0, seg(lt, tapAt, tapAt + 0.5), done && ic === 'heart' ? c : '#FFFFFF');
      ctx.fillStyle = '#FFFFFF'; ctx.font = F(700, 34); ctx.textAlign = 'center'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10 * S; ctx.fillText(fmtK(n + (done ? 1 : 0)), 0, 90); ctx.restore(); ctx.textAlign = 'left';
      ctx.restore();
    });
    void s;
    return { w: 240, h: 900 };
  },

  // ---------- Yeni video bildirimi ----------
  sm_newvideo(ctx, L, lt, env) {
    const S = env.S, s = st(L), W = 920, H = 220, life = (L.end ?? 9) - (L.start ?? 0);
    ctx.save(); const p = easeOut5(seg(lt, 0, 0.5)); ctx.translate(0, (1 - p) * -260); ctx.globalAlpha *= p; outro(ctx, lt, life);
    panel(ctx, s, -W / 2, -H / 2, W, H, 38, S);
    avatar(ctx, L, -W / 2 + 76, -30, 40, s, env);
    ctx.fillStyle = s.fg; ctx.font = F(700, 32); ctx.fillText(L.name || 'Kanal Adı', -W / 2 + 132, -38);
    ctx.fillStyle = s.sub; ctx.font = F(500, 26); ctx.fillText('yeni bir video yükledi · şimdi', -W / 2 + 132, -2);
    ctx.fillStyle = s.fg; ctx.font = F(600, 32); wrap(ctx, L.title || 'Telefondan profesyonel kurgu: 5 gizli ipucu', W - 400).slice(0, 2).forEach((l, i) => ctx.fillText(l, -W / 2 + 40, 52 + i * 40));
    const tw = 230, th = 150, tx = W / 2 - 30 - tw, ty = -th / 2;
    const img = L.v1 && env.img ? env.img(L.v1) : null;
    ctx.save(); roundRect(ctx, tx, ty, tw, th, 18); ctx.clip();
    if (img) { const iw = img.width || img.videoWidth || 1, ih = img.height || img.videoHeight || 1, k = Math.max(tw / iw, th / ih); ctx.drawImage(img, tx + tw / 2 - iw * k / 2, -ih * k / 2, iw * k, ih * k); }
    else { const g = ctx.createLinearGradient(tx, ty, tx + tw, ty + th); g.addColorStop(0, s.acc); g.addColorStop(1, mixHex(s.acc, '#000000', 0.6)); ctx.fillStyle = g; ctx.fillRect(tx, ty, tw, th); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(tx + tw / 2, 0, 30, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill(); icon(ctx, 'play', tx + tw / 2 + 3, 0, 32, '#FFFFFF');
    ctx.restore();
    return { w: W, h: H + 120 };
  },
};

// ---------- hazır şablonlar: her tasarım platform renklerinde ----------
const A = (i = 'none', o = 'fade') => ({ in: i, out: o, inDur: 0.3, outDur: 0.3 });
const T = [];
const ST_ALL = ['red', 'grad', 'neon', 'light', 'dark', 'glass', 'latte', 'purple'];
const ST_MAIN = ['red', 'grad', 'neon', 'light', 'dark', 'glass'];
const SN = (k) => STYLES[k].name.split(' (')[0];
const add = (sub, id, name, p, dur = 5) => T.push({ id, name, cat: `Sosyal · ${sub}`, p: { y: 0.5, anim: A(), ...p }, dur });
ST_ALL.forEach((k) => add('Abone & takip', `sm_sub_${k}`, `Abone ol · ${SN(k)}`, { type: 'sm_subscribe', style: k, name: 'Kanal Adı', subs: 128000, tapAt: 1.3, y: 0.78 }, 5));
['red', 'neon', 'dark', 'latte'].forEach((k) => add('Abone & takip', `sm_sub2_${k}`, `Abone ol (büyük kanal) · ${SN(k)}`, { type: 'sm_subscribe', style: k, name: 'Teknoloji Notları', subs: 2400000, tapAt: 1.6, y: 0.5 }, 5));
ST_ALL.forEach((k) => add('Abone & takip', `sm_fol_${k}`, `Takip et · ${SN(k)}`, { type: 'sm_follow', style: k, name: 'Kanal Adı', handle: '@kanaladi', tapAt: 1.2, y: 0.8 }, 4.5));
ST_MAIN.forEach((k) => add('Abone & takip', `sm_bell_${k}`, `Bildirimleri aç · ${SN(k)}`, { type: 'sm_bell', style: k, y: 0.8 }, 4));
ST_ALL.forEach((k) => add('Abone & takip', `sm_handle_${k}`, `Kullanıcı adı · ${SN(k)}`, { type: 'sm_handle', style: k, handle: '@kanaladi', text: 'beni takip et', y: 0.85 }, 4));
['red', 'grad', 'neon', 'purple'].forEach((k) => add('Abone & takip', `sm_cnt_${k}`, `Takipçi sayacı · ${SN(k)}`, { type: 'sm_counter', style: k, from: 9800, to: 10000, text: 'Takipçi' }, 4.5));
['light', 'dark'].forEach((k) => add('Abone & takip', `sm_cnt2_${k}`, `Abone sayacı (1 Mn) · ${SN(k)}`, { type: 'sm_counter', style: k, from: 998500, to: 1000000, text: 'Abone' }, 4.5));
ST_MAIN.forEach((k) => add('Beğeni & yorum', `sm_like_${k}`, `Beğeni patlaması · ${SN(k)}`, { type: 'sm_like', style: k, from: 12400 }, 3));
ST_ALL.forEach((k) => add('Beğeni & yorum', `sm_com_${k}`, `Yorum yaz · ${SN(k)}`, { type: 'sm_comment', style: k, name: 'Sen', text: 'Bu video harika olmuş! 🔥' }, 5));
['light', 'dark', 'grad'].forEach((k) => add('Beğeni & yorum', `sm_com2_${k}`, `Yorum yaz (soru) · ${SN(k)}`, { type: 'sm_comment', style: k, name: 'Sen', text: 'Hangi uygulamayı kullanıyorsun? 🤔' }, 5));
['neon', 'dark', 'glass'].forEach((k) => add('Beğeni & yorum', `sm_combo_${k}`, `Yan eylem çubuğu · ${SN(k)}`, { type: 'sm_combo', style: k, x: 0.9, y: 0.6 }, 4));
ST_MAIN.forEach((k) => add('Beğeni & yorum', `sm_poll_${k}`, `Anket · ${SN(k)}`, { type: 'sm_poll', style: k, value: 68 }, 4.5));
['grad', 'neon', 'purple', 'latte'].forEach((k) => add('Beğeni & yorum', `sm_q_${k}`, `Soru kutusu · ${SN(k)}`, { type: 'sm_question', style: k }, 4.5));
ST_MAIN.forEach((k) => add('Paylaş & kaydet', `sm_share_${k}`, `Paylaş menüsü · ${SN(k)}`, { type: 'sm_share', style: k, y: 0.75 }, 5));
ST_MAIN.forEach((k) => add('Paylaş & kaydet', `sm_save_${k}`, `Kaydet · ${SN(k)}`, { type: 'sm_save', style: k }, 3.5));
ST_ALL.forEach((k) => add('Link & kaydırma', `sm_link_${k}`, `Link bio'da · ${SN(k)}`, { type: 'sm_linkbio', style: k, y: 0.75 }, 4));
['red', 'grad', 'neon', 'light'].forEach((k) => add('Link & kaydırma', `sm_swipe_${k}`, `Yukarı kaydır · ${SN(k)}`, { type: 'sm_swipe', style: k, y: 0.8 }, 4));
ST_MAIN.forEach((k) => add('Link & kaydırma', `sm_sound_${k}`, `Sesi aç · ${SN(k)}`, { type: 'sm_sound', style: k, y: 0.2 }, 3.5));
ST_MAIN.forEach((k) => add('Link & kaydırma', `sm_watch_${k}`, `Sonuna kadar izle · ${SN(k)}`, { type: 'sm_watch', style: k, y: 0.15 }, 6));
ST_ALL.forEach((k) => add('Bölüm & bitiş', `sm_part_${k}`, `Bölüm 2 · ${SN(k)}`, { type: 'sm_part', style: k, num: '2', text: 'Bölüm' }, 3));
['red', 'neon', 'grad'].forEach((k) => add('Bölüm & bitiş', `sm_part3_${k}`, `Bölüm 3 · ${SN(k)}`, { type: 'sm_part', style: k, num: '3', text: 'Bölüm' }, 3));
['red', 'grad', 'neon', 'dark', 'purple', 'latte'].forEach((k) => add('Bölüm & bitiş', `sm_end_${k}`, `Bitiş ekranı · ${SN(k)}`, { type: 'sm_endscreen', style: k, name: 'Kanal Adı' }, 8));
ST_MAIN.forEach((k) => add('Bölüm & bitiş', `sm_new_${k}`, `Yeni video bildirimi · ${SN(k)}`, { type: 'sm_newvideo', style: k, y: 0.15 }, 5));
['red', 'grad', 'neon', 'dark'].forEach((k) => add('Canlı & duyuru', `sm_live_${k}`, `Canlı rozeti · ${SN(k)}`, { type: 'sm_live', style: k, to: 1250, x: 0.3, y: 0.1 }, 6));
export const SM_TEMPLATES = T;
