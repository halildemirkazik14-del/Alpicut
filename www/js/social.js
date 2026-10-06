// Alpicut — sosyal medya şablonları (platformdan bağımsız, marka logosu içermez; tüm alanlar düzenlenebilir)
import { SOCIAL_TEMPLATES3, SOCIAL_FIELDS3, FIELD_META3 } from './social3.js';
import { roundRect, clamp, iconPath, hexA } from './render.js';
import { drawSocial2, SOCIAL_TEMPLATES2, SOCIAL_FIELDS2 } from './social2.js';

const F = (w, s, fam = 'Barlow') => `${w} ${s}px "${fam}", "Barlow", sans-serif`;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

export function fmtCount(n) {
  n = Math.round(+n || 0);
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',').replace(',0', '')} Mn`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',').replace(',0', '')}B`;
  return String(n);
}

function wrap(ctx, text, maxW) {
  const out = [];
  String(text || '').split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).forEach((w) => {
      const tst = line ? `${line} ${w}` : w;
      if (ctx.measureText(tst).width > maxW && line) { out.push(line); line = w; } else line = tst;
    });
    out.push(line);
  });
  return out;
}

function icon(ctx, name, x, y, size, color) {
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24); ctx.fillStyle = color; ctx.fill(iconPath(name)); ctx.restore();
}

function avatar(ctx, L, x, y, r, env) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath();
  const img = L.avatar && env.img ? env.img(L.avatar) : null;
  if (img && (img.naturalWidth || img.width)) {
    ctx.clip();
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = Math.max((2 * r) / iw, (2 * r) / ih);
    ctx.drawImage(img, x - (iw * k) / 2, y - (ih * k) / 2, iw * k, ih * k);
  } else {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, L.accent || '#8B5CF6'); g.addColorStop(1, '#EC4899');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = F(800, r * 1.05); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((L.name || '?').trim().charAt(0).toLocaleUpperCase('tr-TR'), x, y + r * 0.06);
  }
  ctx.restore();
}

function verified(ctx, x, y, s, color) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 16; i++) { const rr = i % 2 ? s * 0.42 : s * 0.5, a = (i / 16) * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.18, y); ctx.lineTo(x - s * 0.04, y + s * 0.14); ctx.lineTo(x + s * 0.2, y - s * 0.12); ctx.stroke();
  ctx.restore();
}

const theme = (L) => (L.dark ? { bg: '#16131f', fg: '#ffffff', sub: '#a8a3b8', line: '#2c2640' } : { bg: '#ffffff', fg: '#111111', sub: '#6b6b76', line: '#e6e6ea' });

function card(ctx, w, h, r, bg, S) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30 * S; ctx.shadowOffsetY = 8 * S;
  roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
}

// ---------- şablon tanımları ----------
const base = { kind: 'social', x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, scale: 1, dark: false, accent: '#8B5CF6' };
const A = (inn = 'pop', out = 'fade', loop = 'none', inDur = 0.45) => ({ in: inn, out, loop, inDur, outDur: 0.35 });

export const SOCIAL_TEMPLATES = [
  { id: 'comment', name: 'Yorum kartı', cat: 'Yorum', p: { type: 'comment', name: 'Ayşe Yılmaz', handle: '@ayseyilmaz', time: '2 sa', text: 'Bu açıklama tam olarak aklımdaki soruydu, teşekkürler! 🔥', likes: 1240, y: 0.72, anim: A('slideUp') } },
  { id: 'commentDark', name: 'Yorum (koyu)', cat: 'Yorum', p: { type: 'comment', dark: true, name: 'Mert K.', handle: '@mertk', time: '5 dk', text: 'Golden önceki paslaşma inanılmazdı 👏', likes: 856, y: 0.72, anim: A('slideUp') } },
  { id: 'reply', name: 'Yoruma yanıt', cat: 'Yorum', p: { type: 'reply', name: 'kanalim', text: 'Sizce bu pozisyon penaltı mı? Yorumlarda tartışalım!', y: 0.3, anim: A('pop') } },
  { id: 'pinned', name: 'Sabitlenmiş yorum', cat: 'Yorum', p: { type: 'comment', pinned: true, name: 'Kanal Adı', handle: '@kanaladi', time: '1 g', text: 'Videonun devamı için abone olmayı unutmayın! 📌', likes: 5400, y: 0.7, anim: A('slideUp') } },
  { id: 'livechat', name: 'Canlı sohbet akışı', cat: 'Yorum', p: { type: 'livechat', lines: 'Ali: Harika yayın!\nZeynep: Selamlar 👋\nCan: Efsane geliyor 🔥\nElif: Ses çok iyi\nBurak: Abone oldum ✅', y: 0.66, anim: A('fade') } },
  { id: 'chatL', name: 'Mesaj balonu (gelen)', cat: 'Sohbet', p: { type: 'chat', side: 'left', text: 'Yeni videoyu izledin mi? 😱', color: '#E9E9EE', textColor: '#111', y: 0.4, anim: A('pop') } },
  { id: 'chatR', name: 'Mesaj balonu (giden)', cat: 'Sohbet', p: { type: 'chat', side: 'right', text: 'İzledim, sonu efsaneydi!', color: '#7C3AED', textColor: '#fff', y: 0.5, anim: A('pop') } },
  { id: 'typing', name: 'Yazıyor…', cat: 'Sohbet', p: { type: 'typing', color: '#E9E9EE', y: 0.6, anim: A('pop', 'fade', 'none') } },
  { id: 'notif', name: 'Bildirim', cat: 'Bildirim', p: { type: 'notif', app: 'Kanalım', title: 'Yeni video yayında! 🎬', text: 'Haftanın en çok konuşulan konusunu inceledik.', time: 'şimdi', y: 0.12, anim: A('slideDown', 'slideUp') } },
  { id: 'dm', name: 'Mesaj bildirimi', cat: 'Bildirim', p: { type: 'notif', app: 'Mesajlar', title: 'Zeynep', text: 'Bu videoyu görmen lazım 😂', time: '1 dk', y: 0.12, anim: A('slideDown', 'slideUp') } },
  { id: 'newvideo', name: 'Yeni video rozeti', cat: 'Bildirim', p: { type: 'newvideo', text: 'YENİ VİDEO', y: 0.15, accent: '#EF4444', anim: A('pop', 'pop', 'pulse') } },
  { id: 'likes', name: 'Beğeni sayacı', cat: 'Sayaç', p: { type: 'counter', icon: 'heart', from: 0, to: 25800, label: 'beğeni', color: '#EF4444', y: 0.8, anim: A('pop') } },
  { id: 'subs', name: 'Abone sayacı', cat: 'Sayaç', p: { type: 'counter', icon: 'userPlus', from: 9800, to: 10000, label: 'abone', color: '#7C3AED', y: 0.8, anim: A('pop') } },
  { id: 'views', name: 'İzlenme sayacı', cat: 'Sayaç', p: { type: 'counter', icon: 'play', from: 0, to: 1250000, label: 'izlenme', color: '#0EA5E9', y: 0.8, anim: A('pop') } },
  { id: 'viewers', name: 'Canlı izleyici', cat: 'Sayaç', p: { type: 'live', count: 12400, y: 0.08, anim: A('pop', 'fade', 'pulse') } },
  { id: 'hearts', name: 'Kalp yağmuru', cat: 'Tepki', p: { type: 'hearts', color: '#EC4899', count: 14, y: 0.75, x: 0.85, anim: A('fade') } },
  { id: 'stars', name: 'Yıldız puanı', cat: 'Tepki', p: { type: 'rating', value: 5, text: 'Harika video!', y: 0.75, anim: A('pop') } },
  { id: 'poll', name: 'Anket', cat: 'Etkileşim', p: { type: 'poll', text: 'Sezonun en iyi oyuncusu kim?', options: 'Oyuncu A|62\nOyuncu B|28\nOyuncu C|10', y: 0.5, anim: A('pop') } },
  { id: 'question', name: 'Soru kutusu', cat: 'Etkileşim', p: { type: 'question', title: 'Bana bir soru sor', text: 'Bu sezon şampiyon kim olur?', y: 0.45, anim: A('pop') } },
  { id: 'post', name: 'Gönderi kartı', cat: 'Gönderi', p: { type: 'post', name: 'Gündem', handle: '@gundem', verified: true, text: 'SON DAKİKA: Yeni özellik bugün herkese açıldı. Detaylar videoda 👇', replies: 320, shares: 1800, likes: 12400, y: 0.42, anim: A('pop') } },
  { id: 'postDark', name: 'Gönderi (koyu)', cat: 'Gönderi', p: { type: 'post', dark: true, name: 'Teknoloji Notları', handle: '@teknonotlar', verified: true, text: 'Bu takımın pres yoğunluğu ligin en yükseği. Rakamlar şaşırtıcı 👇', replies: 98, shares: 410, likes: 3900, y: 0.42, anim: A('pop') } },
  { id: 'profile', name: 'Profil kartı', cat: 'Profil', p: { type: 'profile', name: 'Kanal Adı', handle: '@kanaladi', followers: 128000, text: 'Yaratıcı içerik • Her gün yeni video', btn: 'Takip et', y: 0.5, anim: A('pop') } },
  { id: 'subscribeBar', name: 'Abone ol alt bandı', cat: 'Profil', p: { type: 'subbar', name: 'Kanal Adı', text: '128B abone', btn: 'ABONE OL', accent: '#EF4444', y: 0.84, anim: A('slideUp') } },
  { id: 'mention', name: 'Etiket (@kişi)', cat: 'Profil', p: { type: 'mention', text: '@oyuncu_adi', y: 0.45, anim: A('pop', 'fade', 'float') } },
  { id: 'link', name: 'Link kartı', cat: 'Bağlantı', p: { type: 'linkcard', title: 'Tam video', text: 'Link profilde / açıklamada', y: 0.8, anim: A('slideUp', 'fade', 'pulse') } },
  { id: 'swipe', name: 'Yukarı kaydır', cat: 'Bağlantı', p: { type: 'swipe', text: 'Devamı için kaydır', y: 0.86, anim: A('fade') } },
  { id: 'hashtags', name: 'Hashtag', cat: 'Bağlantı', p: { type: 'hashtags', text: '#keşfet #viral #shorts #reels', y: 0.9, anim: A('slideUp') } },
  { id: 'location', name: 'Konum etiketi', cat: 'Bağlantı', p: { type: 'location', text: 'Antalya, Türkiye', y: 0.1, anim: A('pop') } },
  { id: 'nowplaying', name: 'Şimdi çalıyor', cat: 'Müzik', p: { type: 'music', title: 'Dört Mevsim — İlkbahar', text: 'A. Vivaldi', y: 0.12, anim: A('slideDown', 'slideUp') } },
  { id: 'search', name: 'Arama çubuğu', cat: 'Etkileşim', p: { type: 'search', text: 'en iyi kurgu ipuçları 2026', y: 0.3, anim: A('pop') } },
  { id: 'countdown', name: 'Geri sayım', cat: 'Sayaç', p: { type: 'countdown', from: 3, y: 0.45, accent: '#FACC15', anim: A('none', 'fade') } },
  { id: 'episode', name: 'Bölüm etiketi', cat: 'Bağlantı', p: { type: 'episode', text: 'BÖLÜM 1/3', y: 0.08, anim: A('slideDown') } },
];

export const SOCIAL_FIELDS_BASE = {
  comment: ['name', 'handle', 'time', 'text', 'likes', 'pinned', 'dark', 'avatar'],
  reply: ['name', 'text', 'dark', 'avatar'],
  livechat: ['lines', 'dark'],
  chat: ['text', 'side', 'color', 'textColor'],
  typing: ['color'],
  notif: ['app', 'title', 'text', 'time', 'dark', 'avatar'],
  newvideo: ['text', 'accent'],
  counter: ['icon', 'from', 'to', 'label', 'color', 'dur'],
  live: ['count'],
  hearts: ['color', 'count'],
  rating: ['value', 'text', 'dark'],
  poll: ['text', 'options', 'accent', 'dark'],
  question: ['title', 'text', 'accent'],
  post: ['name', 'handle', 'verified', 'text', 'replies', 'shares', 'likes', 'dark', 'avatar', 'accent'],
  profile: ['name', 'handle', 'followers', 'text', 'btn', 'verified', 'dark', 'avatar', 'accent'],
  subbar: ['name', 'text', 'btn', 'accent', 'avatar'],
  mention: ['text', 'dark'],
  linkcard: ['title', 'text', 'accent', 'dark'],
  swipe: ['text'],
  hashtags: ['text', 'accent'],
  location: ['text', 'accent'],
  music: ['title', 'text', 'dark', 'avatar'],
  search: ['text', 'dark'],
  countdown: ['from', 'accent'],
  episode: ['text', 'accent'],
};

// ---------- çizim ----------
export function drawSocial(ctx, L, t, env) {
  const S = env.S;
  const lt = Math.max(0, t - L.start);
  const sc = L.scale || 1;
  ctx.scale(sc, sc);
  const T = theme(L);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let w = 860, h = 200;
  switch (L.type) {
    case 'comment': {
      w = 880;
      ctx.font = F(500, 40);
      const lines = wrap(ctx, L.text, w - 200);
      h = 150 + lines.length * 50 + (L.pinned ? 44 : 0);
      card(ctx, w, h, 36, T.bg, S);
      let y0 = -h / 2 + 40;
      if (L.pinned) { ctx.fillStyle = T.sub; ctx.font = F(600, 30); ctx.fillText('📌 Sabitlendi', -w / 2 + 140, y0 + 20); y0 += 44; }
      avatar(ctx, L, -w / 2 + 80, y0 + 34, 42, env);
      ctx.fillStyle = T.fg; ctx.font = F(700, 38); ctx.fillText(L.name || '', -w / 2 + 140, y0 + 34);
      const nw = ctx.measureText(L.name || '').width;
      ctx.fillStyle = T.sub; ctx.font = F(500, 32); ctx.fillText(`${L.handle || ''} · ${L.time || ''}`, -w / 2 + 156 + nw, y0 + 34);
      ctx.fillStyle = T.fg; ctx.font = F(500, 40);
      lines.forEach((ln, i) => ctx.fillText(ln, -w / 2 + 140, y0 + 92 + i * 50));
      const yb = h / 2 - 34;
      icon(ctx, 'heart', -w / 2 + 158, yb - 10, 34, '#EF4444');
      ctx.fillStyle = T.sub; ctx.font = F(600, 32); ctx.fillText(fmtCount(L.likes), -w / 2 + 186, yb);
      ctx.fillText('Yanıtla', -w / 2 + 320, yb);
      break;
    }
    case 'reply': {
      w = 760;
      ctx.font = F(700, 46);
      const lines = wrap(ctx, L.text, w - 80);
      h = 120 + lines.length * 58;
      card(ctx, w, h, 30, L.dark ? '#16131f' : '#ffffff', S);
      ctx.save(); ctx.beginPath(); ctx.moveTo(-w / 2 + 60, h / 2 - 2); ctx.lineTo(-w / 2 + 100, h / 2 + 34); ctx.lineTo(-w / 2 + 120, h / 2 - 2); ctx.fillStyle = L.dark ? '#16131f' : '#ffffff'; ctx.fill(); ctx.restore();
      avatar(ctx, L, -w / 2 + 52, -h / 2 + 50, 24, env);
      ctx.fillStyle = T.sub; ctx.font = F(500, 30); ctx.fillText(`@${(L.name || '').replace(/^@/, '')} adlı kullanıcının yorumuna yanıt`, -w / 2 + 88, -h / 2 + 60);
      ctx.fillStyle = T.fg; ctx.font = F(700, 46);
      lines.forEach((ln, i) => ctx.fillText(ln, -w / 2 + 40, -h / 2 + 128 + i * 58));
      break;
    }
    case 'livechat': {
      w = 760;
      const items = String(L.lines || '').split('\n').filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ['', l]; });
      const shown = Math.min(items.length, Math.floor(lt / 0.9) + 1);
      const rows = items.slice(Math.max(0, shown - 5), shown);
      h = rows.length * 76 + 24;
      rows.forEach(([n, m], i) => {
        const age = clamp((lt - (shown - rows.length + i) * 0.9) / 0.3);
        const y = h / 2 - (rows.length - i) * 76 + 30;
        ctx.save(); ctx.globalAlpha *= age; ctx.translate(0, (1 - easeOut(age)) * 30);
        ctx.font = F(700, 36);
        const nw = ctx.measureText(n).width;
        ctx.font = F(500, 36);
        const mw = Math.min(w - nw - 120, ctx.measureText(m).width);
        roundRect(ctx, -w / 2, y - 30, nw + mw + 90, 62, 31); ctx.fillStyle = L.dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.4)'; ctx.fill();
        ctx.beginPath(); ctx.arc(-w / 2 + 31, y + 1, 20, 0, Math.PI * 2); ctx.fillStyle = `hsl(${(n.charCodeAt(0) || 0) * 37 % 360},70%,55%)`; ctx.fill();
        ctx.fillStyle = '#FDE68A'; ctx.font = F(700, 36); ctx.fillText(n, -w / 2 + 62, y + 13);
        ctx.fillStyle = '#fff'; ctx.font = F(500, 36); ctx.fillText(m, -w / 2 + 74 + nw, y + 13, mw);
        ctx.restore();
      });
      break;
    }
    case 'chat': {
      ctx.font = F(500, 44);
      const lines = wrap(ctx, L.text, 640);
      w = Math.min(720, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 80);
      h = lines.length * 56 + 50;
      const left = L.side !== 'right';
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 16 * S;
      roundRect(ctx, -w / 2, -h / 2, w, h, 40); ctx.fillStyle = L.color; ctx.fill();
      ctx.beginPath();
      if (left) { ctx.moveTo(-w / 2 + 6, h / 2 - 30); ctx.quadraticCurveTo(-w / 2 - 10, h / 2 + 4, -w / 2 - 22, h / 2 + 6); ctx.quadraticCurveTo(-w / 2 + 22, h / 2 + 4, -w / 2 + 40, h / 2 - 10); }
      else { ctx.moveTo(w / 2 - 6, h / 2 - 30); ctx.quadraticCurveTo(w / 2 + 10, h / 2 + 4, w / 2 + 22, h / 2 + 6); ctx.quadraticCurveTo(w / 2 - 22, h / 2 + 4, w / 2 - 40, h / 2 - 10); }
      ctx.fill(); ctx.restore();
      ctx.fillStyle = L.textColor; ctx.font = F(500, 44);
      lines.forEach((ln, i) => ctx.fillText(ln, -w / 2 + 40, -h / 2 + 64 + i * 56));
      break;
    }
    case 'typing': {
      w = 200; h = 110;
      roundRect(ctx, -w / 2, -h / 2, w, h, 55); ctx.fillStyle = L.color; ctx.fill();
      for (let i = 0; i < 3; i++) {
        const b = Math.sin(lt * 7 - i * 0.9) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(-50 + i * 50, -8 * b, 15, 0, Math.PI * 2); ctx.fillStyle = `rgba(80,80,90,${0.45 + 0.5 * b})`; ctx.fill();
      }
      break;
    }
    case 'notif': {
      w = 960; ctx.font = F(500, 38);
      const lines = wrap(ctx, L.text, w - 200).slice(0, 3);
      h = 150 + lines.length * 46;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 30 * S;
      roundRect(ctx, -w / 2, -h / 2, w, h, 44); ctx.fillStyle = L.dark ? 'rgba(30,26,40,.92)' : 'rgba(250,250,252,.94)'; ctx.fill(); ctx.restore();
      roundRect(ctx, -w / 2 + 36, -h / 2 + 36, 84, 84, 20);
      const g = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 + 120); g.addColorStop(0, L.accent || '#8B5CF6'); g.addColorStop(1, '#EC4899');
      ctx.fillStyle = g; ctx.fill();
      if (L.avatar) avatar(ctx, L, -w / 2 + 78, -h / 2 + 78, 42, env); else icon(ctx, 'bell', -w / 2 + 78, -h / 2 + 78, 50, '#fff');
      ctx.fillStyle = T.sub; ctx.font = F(600, 30); ctx.fillText((L.app || '').toLocaleUpperCase('tr-TR'), -w / 2 + 144, -h / 2 + 62);
      ctx.textAlign = 'right'; ctx.fillText(L.time || '', w / 2 - 40, -h / 2 + 62); ctx.textAlign = 'left';
      ctx.fillStyle = T.fg; ctx.font = F(700, 40); ctx.fillText(L.title || '', -w / 2 + 144, -h / 2 + 110);
      ctx.fillStyle = T.fg; ctx.font = F(500, 38);
      lines.forEach((ln, i) => ctx.fillText(ln, -w / 2 + 144, -h / 2 + 158 + i * 46));
      break;
    }
    case 'newvideo': {
      ctx.font = F(800, 58, 'Barlow Condensed');
      const tw = ctx.measureText(L.text || '').width;
      w = tw + 170; h = 104;
      roundRect(ctx, -w / 2, -h / 2, w, h, 52); ctx.fillStyle = L.accent; ctx.fill();
      icon(ctx, 'bell', -w / 2 + 62, 0, 50, '#fff');
      ctx.fillStyle = '#fff'; ctx.fillText(L.text || '', -w / 2 + 110, 20);
      break;
    }
    case 'counter': {
      const dur = L.dur || 1.6;
      const p = easeOut(clamp(lt / dur));
      const v = (+L.from || 0) + ((+L.to || 0) - (+L.from || 0)) * p;
      ctx.font = F(800, 92, 'Barlow Condensed');
      const txt = fmtCount(v);
      const tw = ctx.measureText(txt).width;
      ctx.font = F(600, 40);
      const lw = ctx.measureText(L.label || '').width;
      w = tw + lw + 200; h = 150;
      card(ctx, w, h, 75, 'rgba(15,12,24,.82)', S);
      const pulse = lt < dur ? 1 + 0.08 * Math.sin(lt * 20) : 1;
      ctx.save(); ctx.translate(-w / 2 + 80, 0); ctx.scale(pulse, pulse); icon(ctx, L.icon || 'heart', 0, 0, 70, L.color); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = F(800, 92, 'Barlow Condensed'); ctx.fillText(txt, -w / 2 + 140, 32);
      ctx.fillStyle = '#c9c3dc'; ctx.font = F(600, 40); ctx.fillText(L.label || '', -w / 2 + 156 + tw, 28);
      break;
    }
    case 'live': {
      ctx.font = F(800, 46, 'Barlow Condensed');
      const tw2 = ctx.measureText('CANLI').width;
      ctx.font = F(600, 40);
      const cnt = `👁 ${fmtCount(L.count)}`;
      const cw = ctx.measureText(cnt).width;
      w = tw2 + cw + 120; h = 80;
      roundRect(ctx, -w / 2, -h / 2, tw2 + 48, h, 14); ctx.fillStyle = '#EF4444'; ctx.fill();
      roundRect(ctx, -w / 2 + tw2 + 56, -h / 2, cw + 48, h, 14); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = F(800, 46, 'Barlow Condensed'); ctx.fillText('CANLI', -w / 2 + 24, 16);
      ctx.font = F(600, 40); ctx.fillText(cnt, -w / 2 + tw2 + 80, 14);
      break;
    }
    case 'hearts': {
      w = 260; h = 700;
      const n = L.count || 12;
      for (let i = 0; i < n; i++) {
        const seed = Math.sin(i * 91.7) * 1000 % 1;
        const life = 2.4, off = (i / n) * life;
        const age = ((lt + off) % life) / life;
        const x = Math.sin(age * 6 + i) * 60 + (seed - 0.5) * 80;
        const y = h / 2 - age * h;
        ctx.save(); ctx.globalAlpha *= (1 - age) * Math.min(1, age * 6);
        const s = 50 + 30 * Math.abs(seed);
        icon(ctx, 'heart', x, y, s * (0.7 + 0.3 * age), i % 3 === 0 ? '#F472B6' : L.color);
        ctx.restore();
      }
      break;
    }
    case 'rating': {
      w = 700; h = L.text ? 220 : 150;
      card(ctx, w, h, 36, T.bg, S);
      const v = clamp(lt / 1.2) * (L.value || 5);
      for (let i = 0; i < 5; i++) {
        const x = -w / 2 + 110 + i * 120, y = -h / 2 + 76;
        ctx.save(); ctx.translate(x, y);
        ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 22 : 50, a = (k / 10) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath();
        ctx.fillStyle = T.line; ctx.fill();
        const f = clamp(v - i);
        if (f > 0) { ctx.save(); ctx.clip(); ctx.fillStyle = '#FACC15'; ctx.fillRect(-50, -50, 100 * f, 100); ctx.restore(); }
        ctx.restore();
      }
      if (L.text) { ctx.fillStyle = T.fg; ctx.font = F(700, 44); ctx.textAlign = 'center'; ctx.fillText(L.text, 0, h / 2 - 40); }
      break;
    }
    case 'poll': {
      const opts = String(L.options || '').split('\n').filter(Boolean).map((o) => { const [n, p] = o.split('|'); return [n.trim(), +p || 0]; });
      w = 860; ctx.font = F(700, 48);
      const q = wrap(ctx, L.text, w - 100);
      h = 90 + q.length * 58 + opts.length * 110 + 20;
      card(ctx, w, h, 40, T.bg, S);
      ctx.fillStyle = T.fg; q.forEach((ln, i) => ctx.fillText(ln, -w / 2 + 50, -h / 2 + 80 + i * 58));
      const tot = opts.reduce((a, o) => a + o[1], 0) || 1;
      const prog = easeOut(clamp((lt - 0.4) / 1.2));
      opts.forEach(([n, p], i) => {
        const y = -h / 2 + 60 + q.length * 58 + 40 + i * 110;
        roundRect(ctx, -w / 2 + 50, y, w - 100, 86, 24); ctx.fillStyle = T.line; ctx.fill();
        const fw = (w - 100) * (p / tot) * prog;
        if (fw > 2) { roundRect(ctx, -w / 2 + 50, y, Math.max(48, fw), 86, 24); ctx.fillStyle = hexA(L.accent || '#8B5CF6', 0.85); ctx.fill(); }
        ctx.fillStyle = T.fg; ctx.font = F(700, 40); ctx.fillText(n, -w / 2 + 84, y + 56);
        ctx.textAlign = 'right'; ctx.fillText(`%${Math.round((p / tot) * 100 * prog)}`, w / 2 - 84, y + 56); ctx.textAlign = 'left';
      });
      break;
    }
    case 'question': {
      w = 820; ctx.font = F(600, 46);
      const lines = wrap(ctx, L.text, w - 120);
      h = 170 + lines.length * 58 + 40;
      card(ctx, w, h, 44, '#ffffff', S);
      ctx.save(); roundRect(ctx, -w / 2, -h / 2, w, 150, 44); ctx.clip();
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, L.accent || '#8B5CF6'); g.addColorStop(1, '#EC4899');
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, 150); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = F(700, 50); ctx.textAlign = 'center'; ctx.fillText(L.title || '', 0, -h / 2 + 92);
      ctx.fillStyle = '#111'; ctx.font = F(600, 46);
      lines.forEach((ln, i) => ctx.fillText(ln, 0, -h / 2 + 220 + i * 58));
      break;
    }
    case 'post': {
      w = 920; ctx.font = F(500, 42);
      const lines = wrap(ctx, L.text, w - 100);
      h = 190 + lines.length * 54 + 90;
      card(ctx, w, h, 36, T.bg, S);
      avatar(ctx, L, -w / 2 + 92, -h / 2 + 92, 50, env);
      ctx.fillStyle = T.fg; ctx.font = F(700, 42); ctx.fillText(L.name || '', -w / 2 + 164, -h / 2 + 84);
      const nw = ctx.measureText(L.name || '').width;
      if (L.verified) verified(ctx, -w / 2 + 196 + nw, -h / 2 + 70, 38, L.accent || '#3B82F6');
      ctx.fillStyle = T.sub; ctx.font = F(500, 34); ctx.fillText(L.handle || '', -w / 2 + 164, -h / 2 + 126);
      ctx.fillStyle = T.fg; ctx.font = F(500, 42);
      lines.forEach((ln, i) => ctx.fillText(ln, -w / 2 + 50, -h / 2 + 200 + i * 54));
      const yb = h / 2 - 46;
      ctx.strokeStyle = T.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + 40, yb - 46); ctx.lineTo(w / 2 - 40, yb - 46); ctx.stroke();
      ctx.font = F(600, 34);
      [['bubble', L.replies], ['share', L.shares], ['heart', L.likes]].forEach(([ic, n], i) => {
        const x = -w / 2 + 80 + i * 260;
        icon(ctx, ic, x, yb - 10, 36, ic === 'heart' ? '#EF4444' : T.sub);
        ctx.fillStyle = T.sub; ctx.fillText(fmtCount(n), x + 32, yb);
      });
      break;
    }
    case 'profile': {
      w = 760; h = 560;
      card(ctx, w, h, 44, T.bg, S);
      avatar(ctx, L, 0, -h / 2 + 130, 86, env);
      ctx.textAlign = 'center';
      ctx.fillStyle = T.fg; ctx.font = F(800, 52); ctx.fillText(L.name || '', 0, -h / 2 + 285);
      if (L.verified) verified(ctx, ctx.measureText(L.name || '').width / 2 + 34, -h / 2 + 268, 40, L.accent);
      ctx.fillStyle = T.sub; ctx.font = F(500, 36); ctx.fillText(`${L.handle || ''} · ${fmtCount(L.followers)} takipçi`, 0, -h / 2 + 336);
      ctx.fillStyle = T.fg; ctx.font = F(500, 36); ctx.fillText(L.text || '', 0, -h / 2 + 390, w - 80);
      const followed = lt > 1.4;
      roundRect(ctx, -170, h / 2 - 130, 340, 92, 46); ctx.fillStyle = followed ? T.line : (L.accent || '#8B5CF6'); ctx.fill();
      ctx.fillStyle = followed ? T.fg : '#fff'; ctx.font = F(700, 40); ctx.fillText(followed ? 'Takip ediliyor ✓' : (L.btn || 'Takip et'), 0, h / 2 - 70);
      break;
    }
    case 'subbar': {
      w = 960; h = 160;
      card(ctx, w, h, 80, 'rgba(15,12,24,.88)', S);
      avatar(ctx, L, -w / 2 + 82, 0, 56, env);
      ctx.fillStyle = '#fff'; ctx.font = F(700, 46); ctx.fillText(L.name || '', -w / 2 + 162, -6);
      ctx.fillStyle = '#c9c3dc'; ctx.font = F(500, 34); ctx.fillText(L.text || '', -w / 2 + 162, 42);
      const done = lt > 1.5;
      ctx.font = F(800, 42, 'Barlow Condensed');
      const bw = ctx.measureText(done ? 'ABONE OLUNDU' : (L.btn || 'ABONE OL')).width + 70;
      roundRect(ctx, w / 2 - bw - 30, -46, bw, 92, 46); ctx.fillStyle = done ? '#3F3A4D' : (L.accent || '#EF4444'); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(done ? 'ABONE OLUNDU' : (L.btn || 'ABONE OL'), w / 2 - 30 - bw / 2, 15);
      break;
    }
    case 'mention': {
      ctx.font = F(700, 48);
      const tw = ctx.measureText(L.text || '').width;
      w = tw + 70; h = 90;
      ctx.save(); ctx.beginPath(); ctx.moveTo(-18, -h / 2 - 2); ctx.lineTo(0, -h / 2 - 24); ctx.lineTo(18, -h / 2 - 2); ctx.fillStyle = L.dark ? 'rgba(0,0,0,.75)' : 'rgba(255,255,255,.95)'; ctx.fill(); ctx.restore();
      roundRect(ctx, -w / 2, -h / 2, w, h, 14); ctx.fillStyle = L.dark ? 'rgba(0,0,0,.75)' : 'rgba(255,255,255,.95)'; ctx.fill();
      ctx.fillStyle = L.dark ? '#fff' : '#111'; ctx.textAlign = 'center'; ctx.fillText(L.text || '', 0, 16);
      break;
    }
    case 'linkcard': {
      w = 860; h = 170;
      card(ctx, w, h, 30, T.bg, S);
      roundRect(ctx, -w / 2 + 30, -h / 2 + 30, 110, 110, 22); ctx.fillStyle = hexA(L.accent || '#8B5CF6', 0.18); ctx.fill();
      icon(ctx, 'link', -w / 2 + 85, 0, 64, L.accent || '#8B5CF6');
      ctx.fillStyle = T.fg; ctx.font = F(700, 46); ctx.fillText(L.title || '', -w / 2 + 170, -8);
      ctx.fillStyle = T.sub; ctx.font = F(500, 36); ctx.fillText(L.text || '', -w / 2 + 170, 42, w - 210);
      break;
    }
    case 'swipe': {
      w = 600; h = 220;
      const b = Math.sin(lt * 5) * 0.5 + 0.5;
      ctx.save(); ctx.translate(0, -40 - b * 26);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10 * S;
      ctx.beginPath(); ctx.moveTo(-46, 24); ctx.lineTo(0, -22); ctx.lineTo(46, 24); ctx.stroke();
      ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.moveTo(-46, 64); ctx.lineTo(0, 18); ctx.lineTo(46, 64); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = F(700, 44); ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10 * S;
      ctx.fillText(L.text || '', 0, 84);
      break;
    }
    case 'hashtags': {
      const tags = String(L.text || '').split(/\s+/).filter(Boolean);
      ctx.font = F(700, 40);
      const ws = tags.map((tg) => ctx.measureText(tg).width + 48);
      w = Math.min(980, ws.reduce((a, b) => a + b + 14, 0)); h = 80;
      let x = -w / 2;
      tags.forEach((tg, i) => {
        const a = clamp((lt - i * 0.12) / 0.3);
        if (x + ws[i] > w / 2 + 1) return;
        ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 20);
        roundRect(ctx, x, -h / 2, ws[i], h, 40); ctx.fillStyle = hexA(L.accent || '#8B5CF6', 0.9); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(tg, x + 24, 14);
        ctx.restore();
        x += ws[i] + 14;
      });
      break;
    }
    case 'location': {
      ctx.font = F(700, 44);
      const tw = ctx.measureText(L.text || '').width;
      w = tw + 130; h = 92;
      roundRect(ctx, -w / 2, -h / 2, w, h, 46); ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
      ctx.save(); ctx.translate(-w / 2 + 52, 0);
      ctx.beginPath(); ctx.arc(0, -8, 20, Math.PI, 0); ctx.lineTo(0, 28); ctx.closePath(); ctx.fillStyle = L.accent || '#EF4444'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, -8, 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      ctx.fillStyle = '#111'; ctx.fillText(L.text || '', -w / 2 + 92, 15);
      break;
    }
    case 'music': {
      w = 860; h = 170;
      card(ctx, w, h, 30, L.dark ? 'rgba(20,16,30,.9)' : 'rgba(255,255,255,.95)', S);
      roundRect(ctx, -w / 2 + 25, -h / 2 + 25, 120, 120, 16);
      const g = ctx.createLinearGradient(-w / 2, -h / 2, -w / 2 + 140, h / 2); g.addColorStop(0, '#8B5CF6'); g.addColorStop(1, '#F59E0B');
      ctx.fillStyle = g; ctx.fill();
      icon(ctx, 'play', -w / 2 + 85, 0, 56, '#fff');
      ctx.fillStyle = T.fg; ctx.font = F(700, 42); ctx.fillText(L.title || '', -w / 2 + 175, -14, w - 220);
      ctx.fillStyle = T.sub; ctx.font = F(500, 34); ctx.fillText(L.text || '', -w / 2 + 175, 30, w - 220);
      const p = ((lt * 0.08) % 1);
      roundRect(ctx, -w / 2 + 175, 50, w - 230, 8, 4); ctx.fillStyle = T.line; ctx.fill();
      roundRect(ctx, -w / 2 + 175, 50, (w - 230) * p, 8, 4); ctx.fillStyle = '#8B5CF6'; ctx.fill();
      break;
    }
    case 'search': {
      w = 880; h = 120;
      card(ctx, w, h, 60, L.dark ? '#1f1a2c' : '#ffffff', S);
      ctx.strokeStyle = T.sub; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(-w / 2 + 70, -6, 20, 0, Math.PI * 2); ctx.moveTo(-w / 2 + 84, 8); ctx.lineTo(-w / 2 + 100, 24); ctx.stroke();
      const full = L.text || '';
      const n = Math.min(full.length, Math.floor(clamp((lt - 0.3) / 1.6) * full.length));
      ctx.fillStyle = T.fg; ctx.font = F(500, 44);
      const shown = full.slice(0, n);
      ctx.fillText(shown, -w / 2 + 126, 15);
      if (Math.floor(lt * 2.5) % 2 === 0) { const cx = -w / 2 + 130 + ctx.measureText(shown).width; ctx.fillRect(cx, -24, 4, 52); }
      break;
    }
    case 'countdown': {
      const from = Math.max(1, Math.round(L.from || 3));
      const dur = Math.max(0.1, L.end - L.start);
      const step = dur / from;
      const k = Math.min(from - 1, Math.floor(lt / step));
      const ph = (lt - k * step) / step;
      w = h = 360;
      ctx.save();
      ctx.lineWidth = 18; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(0, 0, 160, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = L.accent || '#FACC15'; ctx.beginPath(); ctx.arc(0, 0, 160, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ph)); ctx.stroke();
      const s = 1 + 0.35 * Math.exp(-ph * 8);
      ctx.scale(s, s);
      ctx.fillStyle = '#fff'; ctx.font = F(900, 200, 'Barlow Condensed'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20 * S;
      ctx.fillText(String(from - k), 0, 10);
      ctx.restore();
      break;
    }
    case 'episode': {
      ctx.font = F(800, 50, 'Barlow Condensed');
      const tw = ctx.measureText(L.text || '').width;
      w = tw + 80; h = 86;
      roundRect(ctx, -w / 2, -h / 2, w, h, 12); ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fill();
      ctx.fillStyle = L.accent || '#FACC15'; ctx.fillRect(-w / 2, -h / 2, 10, h);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(L.text || '', 5, 18);
      break;
    }
    default: { const r = drawSocial2(ctx, L, lt, env, T); w = r.w; h = r.h; }
  }
  return { w: w * sc, h: h * sc };
}

export { wrap, avatar, icon, verified, card, F, theme };
SOCIAL_TEMPLATES.push(...SOCIAL_TEMPLATES2);
export const SOCIAL_FIELDS = { ...SOCIAL_FIELDS_BASE, ...SOCIAL_FIELDS2, ...SOCIAL_FIELDS3 };
export { SOCIAL_TEMPLATES3, FIELD_META3 };
