// Alpicut v1.6 — Motion stüdyosu: yapay zekâ, kod, pop-up, 2D/3D motion, kağıt/stop-motion, sci-fi HUD şablonları.
// Fikir ve hareket dili HyperFrames'in (HeyGen, Apache-2.0) blok kataloğundan esinlenmiştir; çizimler Alpicut'ın
// tuval motoru için yeniden yazıldı. Gerçek marka logosu/ekranı kopyalanmaz — hepsi özgün ve özelleştirilebilir.
// Hepsi zamana bağlı ve deterministiktir: önizleme = dışa aktarma.
import { roundRect, clamp } from './render.js';

const UI = 'Bricolage Grotesque';
const SERIF = 'Source Serif 4';
const MONO = 'Roboto Mono';
const F = (w, s, fam = UI, it = false) => `${it ? 'italic ' : ''}${w} ${s}px "${fam}", "Barlow", sans-serif`;

// ---------- yardımcılar ----------
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const spring = (x) => { x = Math.max(0, x); return 1 - Math.exp(-7 * x) * Math.cos(11 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const pairs = (s) => lines(s).map((l) => { const [a, ...b] = l.split('|'); return [a.trim(), (b.join('|') || '').trim()]; });
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
const fmtN = (n) => Math.round(n).toLocaleString('tr-TR');
const hexA = (hx, a) => { const n = parseInt(String(hx || '#000').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

function wrap(ctx, text, maxW) {
  const out = [];
  String(text || '').split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).forEach((w) => {
      if (!w) return;
      const tst = line ? `${line} ${w}` : w;
      if (ctx.measureText(tst).width > maxW && line) { out.push(line); line = w; } else line = tst;
    });
    out.push(line);
  });
  return out;
}
// metni karakter hızına göre yaz
const typed = (s, lt, cps = 28, t0 = 0) => String(s || '').slice(0, Math.max(0, Math.floor((lt - t0) * cps)));
// kelime kelime akış (yapay zekâ cevabı gibi)
function streamWords(s, lt, wps, t0) {
  const ws = String(s || '').split(/(\s+)/);
  const n = Math.max(0, Math.floor((lt - t0) * wps * 2));
  return ws.slice(0, n).join('');
}
function shadowCard(ctx, x, y, w, h, r, bg, S, blur = 34) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = blur * S; ctx.shadowOffsetY = 10 * S;
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
}
function theme(L) {
  return L.dark
    ? { bg: '#17161D', bg2: '#201F28', fg: '#F3F1F5', sub: '#9C97A8', line: '#2E2C38', chip: '#26252F' }
    : { bg: '#FFFFFF', bg2: '#F6F4F1', fg: '#1B1722', sub: '#6E6880', line: '#E7E2EC', chip: '#F1EEF4' };
}
function caret(ctx, x, y, h, lt, color) { if (Math.floor(lt * 2.2) % 2 === 0) { ctx.fillStyle = color; ctx.fillRect(x + 3, y - h * 0.78, 4, h * 0.95); } }
// küçük yıldız (yapay zekâ işareti — genel, markasız)
function spark(ctx, x, y, r, color, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; ctx.quadraticCurveTo(Math.cos(a + Math.PI / 4) * r * 0.18, Math.sin(a + Math.PI / 4) * r * 0.18, Math.cos(a + Math.PI / 2) * r, Math.sin(a + Math.PI / 2) * r); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function spinner(ctx, x, y, r, lt, color) {
  ctx.save(); ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.strokeStyle = hexA(color, 0.2);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, r, lt * 7, lt * 7 + 1.7); ctx.stroke(); ctx.restore();
}
function check(ctx, x, y, r, p, color, stroke = '#fff') {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * easeOut(p * 2), 0, Math.PI * 2); ctx.fill();
  const q = clamp(p * 2 - 0.6);
  if (q > 0) {
    ctx.strokeStyle = stroke; ctx.lineWidth = r * 0.26; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = [[-0.45, 0.02], [-0.12, 0.34], [0.48, -0.32]];
    ctx.beginPath(); ctx.moveTo(x + pts[0][0] * r, y + pts[0][1] * r);
    const seg = q * 2;
    if (seg <= 1) ctx.lineTo(x + lerp(pts[0][0], pts[1][0], seg) * r, y + lerp(pts[0][1], pts[1][1], seg) * r);
    else { ctx.lineTo(x + pts[1][0] * r, y + pts[1][1] * r); ctx.lineTo(x + lerp(pts[1][0], pts[2][0], seg - 1) * r, y + lerp(pts[1][1], pts[2][1], seg - 1) * r); }
    ctx.stroke();
  }
  ctx.restore();
}
function cross(ctx, x, y, r, p, color) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * easeOut(p * 2), 0, Math.PI * 2); ctx.fill();
  const q = clamp(p * 2 - 0.6);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
  const k = r * 0.38;
  if (q > 0) { ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x - k + 2 * k * clamp(q * 2), y - k + 2 * k * clamp(q * 2)); ctx.stroke(); }
  if (q > 0.5) { ctx.beginPath(); ctx.moveTo(x + k, y - k); ctx.lineTo(x + k - 2 * k * clamp(q * 2 - 1), y - k + 2 * k * clamp(q * 2 - 1)); ctx.stroke(); }
  ctx.restore();
}
const STATE = { ok: '#22C55E', err: '#EF4444', warn: '#F59E0B', info: '#9D8CF2' };

// ---------- basit sözdizimi renklendirme ----------
const KW = /^(const|let|var|function|return|if|else|for|while|import|from|export|async|await|class|new|def|print|true|false|null|None|True|False|in|of|=>|self|this|try|catch|lambda|type|interface)$/;
function tokens(line) {
  const out = [];
  const re = /(\/\/.*|#.*)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[1]) out.push([m[1], 'c']);
    else if (m[2]) out.push([m[2], 's']);
    else if (m[3]) out.push([m[3], 'n']);
    else if (m[4]) { const nx = line[re.lastIndex] === '('; out.push([m[4], KW.test(m[4]) ? 'k' : nx ? 'f' : 'i']); } else out.push([m[5] || m[6], 'p']);
  }
  return out;
}
const SYN = { k: '#C4A7FF', s: '#A5E3B5', n: '#F5C27A', c: '#6F6A7D', f: '#7FC8F8', i: '#E9E6EF', p: '#B8B3C4' };

// ---------- şablon tanımları ----------
const A = (inn = 'pop', out = 'fade', loop = 'none', inDur = 0.45) => ({ in: inn, out, loop, inDur, outDur: 0.35 });
const AI_ANS = 'Elbette! Videonun ilk 3 saniyesine güçlü bir soru koy, ardından en çarpıcı görüntüyü göster. Altyazıyı büyük ve kelime kelime vurgulu yap; sonda tek net bir çağrı bırak.';
const CODE1 = 'import { Alpicut } from "alpicut";\n\n// videoyu otomatik kurgula\nconst video = await Alpicut.open("vlog.mp4");\nvideo.cut({ silence: true });\nvideo.captions({ style: "pop" });\nawait video.export("1080p");';
const CODE2 = 'def ozet(metin):\n    # yapay zekâ ile kısa özet\n    cevap = model.sor(metin, uzunluk=3)\n    return cevap.strip()\n\nprint(ozet("Uzun bir makale..."))';

export const SOCIAL_TEMPLATES3 = [
  // --- Yapay zekâ ---
  { id: 'm_aichat', name: 'Yapay zekâ sohbeti', cat: 'Yapay zekâ', p: { type: 'aichat', name: 'Alpi-co', prompt: 'Kısa videom için güçlü bir giriş fikri ver', answer: AI_ANS, speed: 7, accent: '#9D8CF2', dark: true, y: 0.5, scale: 0.95, anim: A('pop') }, dur: 8 },
  { id: 'm_aichatL', name: 'Yapay zekâ sohbeti (açık)', cat: 'Yapay zekâ', p: { type: 'aichat', name: 'Alpi-co', prompt: 'Bu tarifi 3 adımda özetle', answer: '1) Soğanı kavur. 2) Domates ve baharatı ekleyip 10 dk pişir. 3) Yumurtaları kır, kapağı kapat ve 4 dk bekle. Afiyet olsun! 🍳', speed: 7, accent: '#6D5BD8', dark: false, y: 0.5, scale: 0.95, anim: A('pop') }, dur: 8 },
  { id: 'm_aiprompt', name: 'Komut yazılıyor', cat: 'Yapay zekâ', p: { type: 'aiprompt', text: 'Gün batımında sahilde koşan bir golden retriever, sinematik, 35mm', title: 'Ne oluşturmak istersin?', btn: 'Oluştur', speed: 22, accent: '#9D8CF2', dark: true, y: 0.5, anim: A('pop') }, dur: 5 },
  { id: 'm_aithink', name: 'Düşünüyor + adımlar', cat: 'Yapay zekâ', p: { type: 'aithink', title: 'Düşünüyor', lines: 'Videoyu izliyorum\nKonuşmayı yazıya döküyorum\nEn iyi anları seçiyorum\nAltyazı ve müzik ekliyorum', every: 0.9, accent: '#9D8CF2', dark: true, y: 0.5, anim: A('pop') }, dur: 6 },
  { id: 'm_aiimage', name: 'Görsel üretiliyor', cat: 'Yapay zekâ', p: { type: 'aiimage', text: 'neon ışıklı İstanbul sokağı, yağmurlu gece', dur: 3.5, accent: '#9D8CF2', accent2: '#E9C7A1', dark: true, y: 0.5, anim: A('pop') }, dur: 5.5 },
  { id: 'm_airank', name: 'Cevap sıralaması', cat: 'Yapay zekâ', p: { type: 'airank', title: 'Hangisi daha iyi cevap verdi?', stats: 'Model A|92\nModel B|87\nModel C|74\nModel D|61', accent: '#9D8CF2', dark: true, y: 0.5, anim: A('pop') }, dur: 5 },
  { id: 'm_aicompare', name: 'İki model karşılaştırma', cat: 'Yapay zekâ', p: { type: 'aicompare', nameA: 'Model A', nameB: 'Model B', prompt: 'Tek cümlede: kuantum bilgisayar nedir?', textA: 'Bitler yerine aynı anda birden çok durumda olabilen kübitlerle hesap yapan bilgisayar.', textB: 'Süperpozisyon ve dolanıklık sayesinde bazı problemleri klasik bilgisayarlardan çok daha hızlı çözen makine.', speed: 6, accent: '#9D8CF2', accent2: '#E9C7A1', dark: true, y: 0.5, anim: A('pop') }, dur: 7 },
  { id: 'm_aiagent', name: 'Ajan görev listesi', cat: 'Yapay zekâ', p: { type: 'aiagent', title: 'Alpi-co çalışıyor', lines: 'Web araması|3 kaynak bulundu\nDosya okundu|rapor.pdf\nTablo oluşturuldu|12 satır\nÖzet yazıldı|tamam', every: 1, accent: '#9D8CF2', dark: true, y: 0.5, anim: A('pop') }, dur: 6 },
  // --- Kod & geliştirici ---
  { id: 'm_code', name: 'Kod yazılıyor', cat: 'Kod & geliştirici', p: { type: 'code', title: 'kurgu.js', code: CODE1, speed: 30, accent: '#9D8CF2', y: 0.5, scale: 0.95, anim: A('pop') }, dur: 8 },
  { id: 'm_codepy', name: 'Kod (Python)', cat: 'Kod & geliştirici', p: { type: 'code', title: 'ozet.py', code: CODE2, speed: 28, accent: '#E9C7A1', y: 0.5, scale: 0.95, anim: A('pop') }, dur: 7 },
  { id: 'm_term', name: 'Terminal', cat: 'Kod & geliştirici', p: { type: 'terminal', title: 'terminal', lines: '$ npm install alpicut\nadded 128 packages in 4s\n$ alpicut export --4k\n✓ Kurgu hazır\n✓ Altyazı eklendi\n✓ video.mp4 kaydedildi', speed: 24, accent: '#22C55E', y: 0.5, anim: A('pop') }, dur: 7 },
  { id: 'm_diff', name: 'Kod farkı (diff)', cat: 'Kod & geliştirici', p: { type: 'codediff', title: 'ayarlar.js', code: '  const kalite = {\n-   cozunurluk: "720p",\n+   cozunurluk: "4K",\n-   fps: 30,\n+   fps: 60,\n    ses: "stereo",\n  };', every: 0.45, y: 0.5, anim: A('pop') }, dur: 5 },
  { id: 'm_repo', name: 'Proje (repo) kartı', cat: 'Kod & geliştirici', p: { type: 'repo', name: 'halil/alpicut', text: 'Telefondan profesyonel video kurgusu — açık kaynak ❤', stars: 12800, forks: 940, stats: 'JavaScript|64\nCSS|21\nHTML|15', btn: 'Yıldızla', tapAt: 1.6, accent: '#9D8CF2', dark: true, y: 0.5, anim: A('pop') }, dur: 5 },
  { id: 'm_commits', name: 'Commit akışı', cat: 'Kod & geliştirici', p: { type: 'commits', lines: 'feat: otomatik altyazı\nfix: önizleme cızırtısı giderildi\nfeat: yapay zekâ geçişleri\nperf: proxy ile akıcı kurgu\nrelease: v1.6', every: 0.7, accent: '#9D8CF2', dark: true, y: 0.5, anim: A('fade') }, dur: 6 },
  // --- Pop-up ---
  { id: 'm_modal', name: 'Onay penceresi', cat: 'Pop-up', p: { type: 'modal', title: 'Videoyu yayınla?', text: 'Videon 1080p olarak kanalına yüklenecek.', btn: 'Yayınla', btn2: 'Vazgeç', tapAt: 1.8, accent: '#9D8CF2', dark: false, y: 0.5, anim: A('none', 'fade') }, dur: 3.5 },
  { id: 'm_toastok', name: 'Başarılı bildirimi', cat: 'Pop-up', p: { type: 'toast', state: 'ok', title: 'Kaydedildi', text: 'Video galerine eklendi', dark: true, y: 0.86, anim: A('none', 'fade') }, dur: 3.5 },
  { id: 'm_toasterr', name: 'Hata bildirimi', cat: 'Pop-up', p: { type: 'toast', state: 'err', title: 'Bağlantı yok', text: 'İnternetini kontrol et ve tekrar dene', dark: true, y: 0.86, anim: A('none', 'fade') }, dur: 3.5 },
  { id: 'm_stack', name: 'Bildirim yağmuru', cat: 'Pop-up', p: { type: 'notifstack', lines: 'Mesajlar|Ayşe|Videon harika olmuş 😍\nTakipçi|Yeni takipçi|+250 kişi seni takip etti\nYorum|Mert|Devamı ne zaman?\nGelir|Ödeme|₺4.250 hesabına geçti 💸', every: 0.55, accent: '#9D8CF2', dark: false, y: 0.4, anim: A('none', 'fade') }, dur: 5 },
  { id: 'm_success', name: 'Büyük tik (başarı)', cat: 'Pop-up', p: { type: 'success', state: 'ok', text: 'Tamamlandı!', y: 0.45, anim: A('none', 'fade') }, dur: 2.5 },
  { id: 'm_error', name: 'Büyük çarpı (hata)', cat: 'Pop-up', p: { type: 'success', state: 'err', text: 'Yanlış!', y: 0.45, anim: A('none', 'fade') }, dur: 2.5 },
  { id: 'm_permission', name: 'İzin isteği', cat: 'Pop-up', p: { type: 'modal', title: '“Alpicut” kameraya erişmek istiyor', text: 'Video çekmek için izin gerekiyor.', btn: 'İzin ver', btn2: 'İzin verme', tapAt: 1.6, accent: '#0A84FF', dark: true, y: 0.5, anim: A('none', 'fade') }, dur: 3.5 },
  // --- Motion 2D ---
  { id: 'm_kinetic', name: 'Kinetik başlık', cat: 'Motion 2D', p: { type: 'kinetic', text: 'BU VİDEO *HER ŞEYİ* DEĞİŞTİRECEK', every: 0.28, accent: '#9D8CF2', color: '#FFFFFF', y: 0.5, anim: A('none', 'fade') }, dur: 3.5 },
  { id: 'm_count', name: 'Dev sayaç', cat: 'Motion 2D', p: { type: 'bigcount', from: 0, to: 1000000, prefix: '', suffix: '+', label: 'izlenme', dur: 2.2, accent: '#9D8CF2', color: '#FFFFFF', y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'm_bars', name: 'Çubuk grafik', cat: 'Motion 2D', p: { type: 'barchart', title: 'Aylık izlenme (bin)', stats: 'Oca|120\nŞub|180\nMar|260\nNis|410\nMay|690', accent: '#9D8CF2', dark: true, y: 0.5, anim: A('pop') }, dur: 5 },
  { id: 'm_line', name: 'Çizgi grafik', cat: 'Motion 2D', p: { type: 'linechart', title: 'Abone artışı', stats: '1|2\n2|3\n3|3.5\n4|6\n5|9\n6|15', suffix: 'B', accent: '#E9C7A1', dark: true, y: 0.5, anim: A('pop') }, dur: 5 },
  { id: 'm_donut', name: 'Halka yüzde', cat: 'Motion 2D', p: { type: 'donut', value: 87, label: 'izleyici videonun sonuna kadar izledi', accent: '#9D8CF2', dark: true, y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'm_flap', name: 'Havalimanı tabelası', cat: 'Motion 2D', p: { type: 'splitflap', text: 'YENİ BÖLÜM', accent: '#E9C7A1', y: 0.5, anim: A('fade') }, dur: 4 },
  { id: 'm_scramble', name: 'Şifre çözülüyor', cat: 'Motion 2D', p: { type: 'scramble', text: 'ERİŞİM ONAYLANDI', accent: '#22C55E', y: 0.5, anim: A('fade') }, dur: 3.5 },
  { id: 'm_marker', name: 'Fosforlu vurgu', cat: 'Motion 2D', p: { type: 'marker', text: 'Başarının sırrı *her gün* biraz daha iyi olmak', accent: '#FDE68A', color: '#FFFFFF', y: 0.5, anim: A('fade') }, dur: 4 },
  { id: 'm_steps', name: 'Adım adım ilerleme', cat: 'Motion 2D', p: { type: 'steps', lines: 'Çek\nKurgula\nAltyazı\nYayınla', every: 0.8, accent: '#9D8CF2', dark: true, y: 0.5, anim: A('pop') }, dur: 5 },
  { id: 'm_timeline', name: 'Zaman çizelgesi', cat: 'Motion 2D', p: { type: 'timeline', stats: '2019|İlk video\n2021|10 bin abone\n2023|İlk marka işbirliği\n2026|Kendi uygulamam', every: 0.7, accent: '#E9C7A1', dark: true, y: 0.5, anim: A('fade') }, dur: 5.5 },
  { id: 'm_quote', name: 'Alıntı kartı', cat: 'Motion 2D', p: { type: 'quote', text: 'Mükemmel olmasını bekleme. Başla, sonra mükemmelleştir.', name: 'Bir içerik üreticisi', accent: '#9D8CF2', dark: true, y: 0.5, anim: A('fade') }, dur: 5 },
  { id: 'm_sting', name: 'Logo / isim açılışı', cat: 'Motion 2D', p: { type: 'logosting', text: 'ALPICUT', sub: 'studio', accent: '#9D8CF2', color: '#FFFFFF', y: 0.5, anim: A('none', 'fade') }, dur: 3.5 },
  { id: 'm_lt1', name: 'Alt bant (çizgi)', cat: 'Motion 2D', p: { type: 'lower2', style: 'bar', name: 'Halil Demirkazık', title: 'İçerik üreticisi', accent: '#9D8CF2', x: 0.45, y: 0.8, anim: A('none', 'fade') }, dur: 4 },
  { id: 'm_lt2', name: 'Alt bant (hap)', cat: 'Motion 2D', p: { type: 'lower2', style: 'pill', name: 'Ayşe Kaya', title: 'Şef · İstanbul', accent: '#E9C7A1', x: 0.45, y: 0.8, anim: A('none', 'fade') }, dur: 4 },
  { id: 'm_lt3', name: 'Alt bant (neon)', cat: 'Motion 2D', p: { type: 'lower2', style: 'neon', name: 'Can Demir', title: 'Oyun yayıncısı', accent: '#22D3EE', x: 0.45, y: 0.8, anim: A('none', 'fade') }, dur: 4 },
  { id: 'm_lt4', name: 'Alt bant (cam)', cat: 'Motion 2D', p: { type: 'lower2', style: 'glass', name: 'Elif Su', title: 'Seyahat · Kapadokya', accent: '#FFFFFF', x: 0.45, y: 0.8, anim: A('none', 'fade') }, dur: 4 },
  { id: 'm_callout', name: 'El çizimi daire', cat: 'Motion 2D', p: { type: 'callout', shape: 'circle', text: 'tam burası!', accent: '#EF4444', y: 0.5, anim: A('none', 'fade') }, dur: 3 },
  { id: 'm_arrow', name: 'El çizimi ok', cat: 'Motion 2D', p: { type: 'callout', shape: 'arrow', text: 'dikkat', accent: '#FDE68A', y: 0.5, anim: A('none', 'fade') }, dur: 3 },
  { id: 'm_confetti', name: 'Konfeti patlaması', cat: 'Motion 2D', p: { type: 'confetti', count: 90, accent: '#9D8CF2', accent2: '#E9C7A1', y: 0.45, anim: A('none', 'none') }, dur: 3 },
  // --- Motion 3D ---
  { id: 'm_carousel', name: '3D kart karuseli', cat: 'Motion 3D', p: { type: 'carousel3d', lines: 'Kurgu\nAltyazı\nMüzik\nEfekt\nGeçiş\nDışa aktar', speed: 0.35, accent: '#9D8CF2', dark: true, y: 0.5, anim: A('fade') }, dur: 6 },
  { id: 'm_cube', name: '3D dönen küp', cat: 'Motion 3D', p: { type: 'cube3d', lines: 'HIZLI\nKOLAY\nGÜÇLÜ\nÜCRETSİZ', every: 0.9, accent: '#9D8CF2', accent2: '#5B47C9', y: 0.5, anim: A('pop') }, dur: 5 },
  { id: 'm_flip', name: '3D kart çevirme', cat: 'Motion 3D', p: { type: 'flip3d', title: 'ÖNCE', text: 'Saatlerce kurgu', title2: 'SONRA', text2: '5 dakikada hazır', tapAt: 1.5, accent: '#EF4444', accent2: '#22C55E', y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'm_extrude', name: '3D kalın yazı', cat: 'Motion 3D', p: { type: 'extrude', text: 'WOW', depth: 22, color: '#FFFFFF', accent: '#9D8CF2', y: 0.5, anim: A('pop', 'fade', 'float') }, dur: 4 },
  { id: 'm_orbit', name: 'Yörüngede dönen yazı', cat: 'Motion 3D', p: { type: 'orbit', text: 'ABONE OL • BİLDİRİMLERİ AÇ • ', speed: 0.25, accent: '#E9C7A1', color: '#FFFFFF', y: 0.5, anim: A('fade') }, dur: 6 },
  { id: 'm_tunnel', name: 'Işık tüneli (arka plan)', cat: 'Motion 3D', p: { type: 'tunnel', speed: 1, accent: '#9D8CF2', accent2: '#E9C7A1', y: 0.5, anim: A('fade') }, dur: 6 },
  { id: 'm_stars', name: 'Yıldız savrulması (arka plan)', cat: 'Motion 3D', p: { type: 'starfield', speed: 1, count: 260, accent: '#FFFFFF', y: 0.5, anim: A('fade') }, dur: 6 },
  { id: 'm_phone', name: '3D telefon ekranı', cat: 'Motion 3D', p: { type: 'phone3d', title: 'Yeni uygulamam', accent: '#9D8CF2', accent2: '#E9C7A1', speed: 0.4, y: 0.5, anim: A('pop') }, dur: 5 },
  // --- Kağıt & stop-motion ---
  { id: 'm_paper', name: 'Kağıttan kesik başlık', cat: 'Kağıt & stop-motion', p: { type: 'papertitle', text: 'BİR ZAMANLAR', fps: 8, accent: '#E9C7A1', accent2: '#C2603D', y: 0.5, anim: A('none', 'fade') }, dur: 4 },
  { id: 'm_paper2', name: 'Kağıt başlık (renkli)', cat: 'Kağıt & stop-motion', p: { type: 'papertitle', text: 'TARİF ZAMANI', fps: 8, accent: '#FDE68A', accent2: '#9D8CF2', y: 0.5, anim: A('none', 'fade') }, dur: 4 },
  { id: 'm_torn', name: 'Yırtık kağıt bant', cat: 'Kağıt & stop-motion', p: { type: 'torn', text: 'GÜNÜN NOTU', color: '#1B1722', accent: '#F5EFE6', y: 0.5, anim: A('none', 'fade') }, dur: 4 },
  { id: 'm_sticky', name: 'Yapışkan not', cat: 'Kağıt & stop-motion', p: { type: 'sticky', text: 'Unutma:\nher gün 1 video!', accent: '#FDE68A', color: '#1B1722', y: 0.5, anim: A('pop') }, dur: 4 },
  { id: 'm_stamp', name: 'Damga', cat: 'Kağıt & stop-motion', p: { type: 'stamp', text: 'ONAYLANDI', accent: '#C2603D', y: 0.5, anim: A('none', 'fade') }, dur: 3 },
  // --- Sci-fi & HUD ---
  { id: 'm_lockok', name: 'Hedef kilitlendi (yeşil)', cat: 'Sci-fi & HUD', p: { type: 'hud', state: 'ok', text: 'HEDEF ONAYLANDI', y: 0.45, anim: A('none', 'fade') }, dur: 3 },
  { id: 'm_lockerr', name: 'Hedef reddedildi (kırmızı)', cat: 'Sci-fi & HUD', p: { type: 'hud', state: 'err', text: 'HATA TESPİT EDİLDİ', y: 0.45, anim: A('none', 'fade') }, dur: 3 },
  { id: 'm_alert', name: 'Uyarı paneli', cat: 'Sci-fi & HUD', p: { type: 'alert', state: 'err', title: 'UYARI', text: 'Sistem aşırı yüklendi', y: 0.5, anim: A('none', 'fade') }, dur: 3.5 },
  { id: 'm_alertok', name: 'Onay paneli', cat: 'Sci-fi & HUD', p: { type: 'alert', state: 'ok', title: 'BAŞARILI', text: 'Görev tamamlandı', y: 0.5, anim: A('none', 'fade') }, dur: 3.5 },
  { id: 'm_tele', name: 'Telemetri paneli', cat: 'Sci-fi & HUD', p: { type: 'telemetry', title: 'SİSTEM DURUMU', stats: 'İşlemci|72\nBellek|48\nSinyal|91\nEnerji|64', accent: '#22D3EE', y: 0.5, anim: A('fade') }, dur: 5 },
  { id: 'm_radar', name: 'Radar taraması', cat: 'Sci-fi & HUD', p: { type: 'radar', text: '3 HEDEF', accent: '#22C55E', y: 0.5, anim: A('fade') }, dur: 5 },
];

// ---------- v1.7: 200+ — yeni türler ve sektörlere göre hazır varyasyonlar ----------
{
  const T3 = SOCIAL_TEMPLATES3;
  const base = (id) => T3.find((t) => t.id === id);
  // V(kaynak, yeni id, ad, kategori, değişiklikler, süre)
  const V = (src, id, name, cat, over = {}, dur) => { const b = base(src); if (!b) return; T3.push({ id, name, cat: cat || b.cat, p: { ...JSON.parse(JSON.stringify(b.p)), ...over }, dur: dur || b.dur }); };
  const N = (id, name, cat, p, dur = 4) => T3.push({ id, name, cat, p: { y: 0.5, anim: A('none', 'fade'), ...p }, dur });
  // --- yeni türler ---
  N('m_glitch', 'Glitch başlık', 'Başlık & yazı', { type: 'glitchtitle', text: 'SİSTEM ÇÖKTÜ', accent: '#22D3EE', color: '#FFFFFF' }, 3);
  N('m_glitch2', 'Glitch başlık (mor)', 'Başlık & yazı', { type: 'glitchtitle', text: 'YENİ ÇAĞ', accent: '#9D8CF2', color: '#FFFFFF' }, 3);
  N('m_type', 'Daktilo yazısı', 'Başlık & yazı', { type: 'typewriter', text: 'Her şey bir fikirle başladı…', speed: 16, accent: '#E9C7A1', color: '#FFFFFF' }, 4);
  N('m_type_code', 'Daktilo (mono)', 'Başlık & yazı', { type: 'typewriter', mono: true, text: 'merhaba dünya_', speed: 12, accent: '#22C55E', color: '#A5E3B5' }, 3);
  N('m_type_story', 'Hikâye anlatıcı', 'Başlık & yazı', { type: 'typewriter', text: 'O gün her şeyin değişeceğini bilmiyordum.', speed: 14, accent: '#C2603D', color: '#F5EFE6' }, 5);
  N('m_wstack', 'Kelime yığını', 'Başlık & yazı', { type: 'wordstack', text: 'DAHA *HIZLI* DAHA *GÜÇLÜ*', every: 0.3, accent: '#9D8CF2', color: '#FFFFFF' }, 3.5);
  N('m_wstack2', 'Kelime yığını (sıcak)', 'Başlık & yazı', { type: 'wordstack', text: 'BUGÜN *SADECE* SENİN', every: 0.32, accent: '#C2603D', color: '#FFFFFF' }, 3.5);
  N('m_under', 'Altı çizili başlık', 'Başlık & yazı', { type: 'underline', text: 'Önemli Not', sub: 'bunu kaçırma', accent: '#FDE68A', color: '#FFFFFF' }, 3.5);
  N('m_under2', 'Altı çizili (mor)', 'Başlık & yazı', { type: 'underline', text: 'Bölüm 2', sub: 'gerçek hikâye', accent: '#9D8CF2', color: '#FFFFFF' }, 3.5);
  N('m_cd', 'Büyük geri sayım', 'Satış & ürün', { type: 'countdown2', from: 5, text: 'BAŞLA!', accent: '#9D8CF2' }, 6);
  N('m_cd3', 'Geri sayım 3', 'Satış & ürün', { type: 'countdown2', from: 3, text: 'GO!', accent: '#EF4444' }, 4);
  N('m_prog', 'Yükleniyor çubuğu', 'Bilgi & liste', { type: 'progress', title: 'Yükleniyor', text: 'Video hazırlanıyor…', doneText: 'Hazır ✓', dur: 3, accent: '#9D8CF2', accent2: '#E9C7A1' }, 4.5);
  N('m_prog2', 'Hedef ilerlemesi', 'Bilgi & liste', { type: 'progress', title: '10.000 aboneye', text: 'son düzlük!', doneText: 'Başardık 🎉', dur: 3.5, accent: '#22C55E', accent2: '#84CC16' }, 5);
  N('m_price', 'Fiyat etiketi', 'Satış & ürün', { type: 'pricetag', title: 'Bugüne özel', old: '₺1.299', price: '₺799', accent: '#E11D48' }, 4);
  N('m_price2', 'Fiyat etiketi (mor)', 'Satış & ürün', { type: 'pricetag', title: 'Kampanya', old: '₺499', price: '₺249', accent: '#7E6AE0' }, 4);
  N('m_check', 'Yapılacaklar listesi', 'Bilgi & liste', { type: 'checklist', title: 'Bugün', lines: 'Video çek\nKurgula\nAltyazı ekle\nYayınla', every: 0.6, strike: true, accent: '#22C55E', dark: true }, 5);
  N('m_check2', 'Malzeme listesi', 'Bilgi & liste', { type: 'checklist', title: 'Malzemeler', lines: '2 yumurta\n1 domates\n1 biber\nTuz, karabiber', every: 0.5, accent: '#C2603D', dark: false }, 5);
  N('m_check3', 'Valiz listesi', 'Bilgi & liste', { type: 'checklist', title: 'Valizde olmalı', lines: 'Pasaport\nŞarj aleti\nGüneş kremi\nKamera', every: 0.5, accent: '#0EA5E9', dark: true }, 5);
  N('m_map', 'Haritada rota', 'Etkinlik & mekan', { type: 'mappin', text: 'Kapadokya', accent: '#9D8CF2', accent2: '#EF4444', dark: true }, 4.5);
  N('m_map2', 'Konum (açık harita)', 'Etkinlik & mekan', { type: 'mappin', text: 'Kaleiçi, Antalya', accent: '#C2603D', accent2: '#E11D48', dark: false }, 4.5);
  N('m_emoji', 'Emoji yağmuru 🔥', 'Motion 2D', { type: 'emojiburst', text: '🔥🔥💯', count: 30 }, 4);
  N('m_emoji_love', 'Kalp yağmuru', 'Motion 2D', { type: 'emojiburst', text: '❤️💜🤍', count: 34 }, 4);
  N('m_emoji_laugh', 'Kahkaha yağmuru', 'Motion 2D', { type: 'emojiburst', text: '😂🤣', count: 30 }, 4);
  N('m_emoji_party', 'Parti yağmuru', 'Motion 2D', { type: 'emojiburst', text: '🎉🥳✨', count: 34 }, 4);
  N('m_bell', 'Zil çalıyor', 'Abone & etkileşim', { type: 'bellring', text: 'BİLDİRİMLERİ AÇ', accent: '#FACC15', color: '#FFFFFF' }, 4);
  N('m_bell2', 'Zil (mor)', 'Abone & etkileşim', { type: 'bellring', text: 'YENİ VİDEO GELDİ', accent: '#9D8CF2', color: '#FFFFFF' }, 4);
  N('m_date', 'Tarih kartı', 'Etkinlik & mekan', { type: 'datecard', title: 'Ekim', text: '12', sub: 'Cumartesi 20:00', accent: '#E11D48' }, 4);
  N('m_date2', 'Tarih (düğün)', 'Etkinlik & mekan', { type: 'datecard', title: 'Haziran', text: '21', sub: 'Nikâh töreni', accent: '#8B5E3C' }, 4);
  N('m_spot', 'Spot ışığı', 'Motion 2D', { type: 'spotlight', text: 'Şuna bak!', px: 0.5, py: 0.42, accent: '#FDE68A' }, 3.5);
  N('m_tick2', 'Haber bandı (modern)', 'Motion 2D', { type: 'ticker2', title: 'GÜNDEM', text: 'Yeni bölüm yayında • Yorumlarda buluşalım • Abone olmayı unutma', speed: 200, accent: '#E11D48', y: 0.9 }, 8);
  N('m_tick3', 'Bilgi bandı (mor)', 'Motion 2D', { type: 'ticker2', title: 'İPUCU', text: 'Uzun bas → hızlı menü • Çift dokun → tam ekran panel • Kaydır → zaman çizelgesi', speed: 180, accent: '#7E6AE0', y: 0.9 }, 8);
  // --- yapay zekâ varyasyonları ---
  V('m_aichat', 'm_aichat_code', 'Alpi-co: kod yardımı', 'Yapay zekâ', { prompt: 'Bu hatayı nasıl düzeltirim?', answer: 'Değişkeni kullanmadan önce tanımlaman gerekiyor. 3. satıra const ekle ve tekrar dene. 👍' });
  V('m_aichat', 'm_aichat_travel', 'Alpi-co: gezi planı', 'Yapay zekâ', { prompt: 'Antalya\'da 1 günde ne yapayım?', answer: 'Sabah Kaleiçi\'nde kahvaltı, öğlen Düden Şelalesi, gün batımında Konyaaltı sahili. Akşam yemeği için limanı öneririm. 🌅' });
  V('m_aichat', 'm_aichat_fit', 'Alpi-co: antrenman', 'Yapay zekâ', { prompt: '20 dakikalık ev antrenmanı ver', answer: '5 dk ısınma, 3 tur: 15 squat, 10 şınav, 30 sn plank, 20 jumping jack. 3 dk esneme ile bitir. 💪', accent: '#22C55E' });
  V('m_aichat', 'm_aichat_biz', 'Alpi-co: iş fikri', 'Yapay zekâ', { prompt: 'Küçük bir kafe için 3 pazarlama fikri', answer: '1) Haftalık "sanatçı köşesi" etkinliği. 2) Instagram\'da her gün kahve hikâyesi. 3) 5. kahve bizden kartı. ☕', accent: '#C2603D', dark: false });
  V('m_aichat', 'm_aichat_study', 'Alpi-co: ders özeti', 'Yapay zekâ', { prompt: 'Fotosentezi 2 cümlede anlat', answer: 'Bitkiler güneş ışığı, su ve karbondioksiti kullanarak şeker üretir. Bu sırada havaya oksijen bırakırlar. 🌱', accent: '#0EA5E9' });
  V('m_aiprompt', 'm_aiprompt_vid', 'Komut: video üret', 'Yapay zekâ', { text: 'Uzayda süzülen bir astronot kedi, sinematik ışık, 4K', btn: 'Video üret' });
  V('m_aiprompt', 'm_aiprompt_music', 'Komut: müzik üret', 'Yapay zekâ', { text: 'Yağmurlu bir gece için lo-fi hip hop, 80 BPM, piyano', btn: 'Müzik üret', accent: '#E9C7A1' });
  V('m_aiprompt', 'm_aiprompt_logo', 'Komut: logo tasarla', 'Yapay zekâ', { text: 'Minimal bir kahve dükkanı logosu, sıcak tonlar, el çizimi', btn: 'Tasarla', accent: '#C2603D', dark: false });
  V('m_aithink', 'm_aithink_res', 'Araştırıyor', 'Yapay zekâ', { title: 'Araştırıyor', lines: '12 kaynak taranıyor\nVeriler karşılaştırılıyor\nÖzet yazılıyor' });
  V('m_aithink', 'm_aithink_code', 'Kodluyor', 'Yapay zekâ', { title: 'Kodluyor', lines: 'Proje inceleniyor\nHata bulundu\nDüzeltme yazılıyor\nTestler geçti ✓', accent: '#22C55E' });
  V('m_aiimage', 'm_aiimage2', 'Görsel üretiliyor (sıcak)', 'Yapay zekâ', { text: 'Kapadokya üzerinde gün doğumu, balonlar, sıcak ışık', accent: '#C2603D', accent2: '#FDE68A' });
  V('m_airank', 'm_airank_phone', 'Telefon sıralaması', 'Yapay zekâ', { title: 'Kamerası en iyi telefon?', stats: 'Telefon A|94\nTelefon B|91\nTelefon C|85\nTelefon D|78', accent: '#0EA5E9' });
  V('m_aicompare', 'm_aicompare2', 'Model karşılaştırma (kod)', 'Yapay zekâ', { prompt: 'Bir dizi nasıl ters çevrilir?', textA: 'arr.reverse() kullan; orijinal diziyi değiştirir.', textB: '[...arr].reverse() ile kopyasını ters çevir, orijinal bozulmaz.' });
  V('m_aiagent', 'm_aiagent2', 'Ajan: video kurgusu', 'Yapay zekâ', { title: 'Alpi-co kurguluyor', lines: 'Sessizlikler kesildi|14 kesim\nAltyazı eklendi|86 kelime\nMüzik seçildi|lo-fi\nKapak hazır|1080p' });
  // --- kod varyasyonları ---
  V('m_code', 'm_code_html', 'Kod (HTML)', 'Kod & geliştirici', { title: 'index.html', code: '<section class="hero">\n  <h1>Merhaba Alpicut</h1>\n  <p>Telefondan video kurgusu</p>\n  <button>Başla</button>\n</section>' });
  V('m_code', 'm_code_css', 'Kod (CSS)', 'Kod & geliştirici', { title: 'stil.css', code: '.hero {\n  display: grid;\n  place-items: center;\n  background: #9D8CF2;\n  border-radius: 24px;\n}', accent: '#E9C7A1' });
  V('m_code', 'm_code_sql', 'Kod (SQL)', 'Kod & geliştirici', { title: 'sorgu.sql', code: 'SELECT ad, izlenme\nFROM videolar\nWHERE izlenme > 10000\nORDER BY izlenme DESC\nLIMIT 5;' });
  V('m_term', 'm_term_git', 'Terminal (git)', 'Kod & geliştirici', { lines: '$ git add .\n$ git commit -m "yeni özellik"\n[main 4f2a9c1] yeni özellik\n$ git push\n✓ Yayına alındı' });
  V('m_term', 'm_term_err', 'Terminal (hata)', 'Kod & geliştirici', { lines: '$ npm run build\n✗ Hata: modül bulunamadı\n$ npm install\n$ npm run build\n✓ Derleme başarılı', accent: '#F59E0B' });
  V('m_term', 'm_term_ai', 'Terminal (yapay zekâ)', 'Kod & geliştirici', { lines: '$ alpico "bu videoyu kurgula"\nVideo analiz ediliyor...\n✓ 12 kesim yapıldı\n✓ Altyazı eklendi\n✓ Hazır: final.mp4', accent: '#9D8CF2' });
  V('m_repo', 'm_repo2', 'Repo kartı (açık)', 'Kod & geliştirici', { name: 'acik/kaynak', text: 'Herkes için ücretsiz araç', stars: 3400, forks: 210, dark: false, accent: '#7E6AE0' });
  V('m_diff', 'm_diff2', 'Diff (metin)', 'Kod & geliştirici', { title: 'baslik.txt', code: '- Sıkıcı başlık\n+ BU VİDEO HER ŞEYİ DEĞİŞTİRECEK\n  açıklama aynı kaldı' });
  // --- pop-up varyasyonları ---
  V('m_modal', 'm_modal_del', 'Silme onayı', 'Pop-up', { title: 'Bu video silinsin mi?', text: 'Bu işlem geri alınamaz.', btn: 'Sil', btn2: 'Vazgeç', accent: '#EF4444', dark: true });
  V('m_modal', 'm_modal_upd', 'Güncelleme', 'Pop-up', { title: 'Yeni sürüm hazır 🎉', text: 'Alpicut 1.7 ile tam ekran ve Vibe editing geldi.', btn: 'Güncelle', btn2: 'Sonra', accent: '#9D8CF2' });
  V('m_modal', 'm_modal_sub', 'Abonelik penceresi', 'Pop-up', { title: 'Kanala abone ol?', text: 'Her hafta yeni video, hiçbirini kaçırma.', btn: 'Abone ol', btn2: 'Belki', accent: '#E53935' });
  V('m_toastok', 'm_toast_up', 'Yüklendi bildirimi', 'Pop-up', { title: 'Yüklendi', text: 'Videon şimdi yayında 🚀' });
  V('m_toastok', 'm_toast_pay', 'Ödeme alındı', 'Pop-up', { title: 'Ödeme alındı', text: '₺1.250 hesabına geçti' });
  V('m_toasterr', 'm_toast_bat', 'Düşük pil', 'Pop-up', { state: 'warn', title: 'Pil %5', text: 'Şarja takmayı unutma' });
  V('m_stack', 'm_stack_viral', 'Viral bildirimler', 'Pop-up', { lines: 'İzlenme|1 milyon!|Videon viral oldu 🔥\nYorum|Zeynep|Bu efsane olmuş\nTakipçi|Yeni takipçi|+5.200 kişi\nPaylaşım|Mert|Videonu paylaştı' });
  V('m_stack', 'm_stack_shop', 'Sipariş bildirimleri', 'Pop-up', { lines: 'Mağaza|Yeni sipariş|#1042 — 2 ürün\nKargo|Yola çıktı|Yarın kapında\nYorum|★★★★★|Harika ürün, teşekkürler!', accent: '#C2603D', dark: true });
  V('m_success', 'm_success2', 'Doğru cevap', 'Pop-up', { text: 'Doğru!' });
  V('m_error', 'm_error2', 'Bu yanlış', 'Pop-up', { text: 'Bunu yapma!' });
  // --- motion 2D varyasyonları ---
  V('m_kinetic', 'm_kin_food', 'Kinetik: yemek', 'Başlık & yazı', { text: '5 DAKİKADA *EFSANE* TARİF', accent: '#C2603D' });
  V('m_kinetic', 'm_kin_fit', 'Kinetik: spor', 'Başlık & yazı', { text: '30 GÜNDE *DEĞİŞİM*', accent: '#22C55E' });
  V('m_kinetic', 'm_kin_money', 'Kinetik: para', 'Başlık & yazı', { text: 'BU YÖNTEMLE *KAZAN*', accent: '#FACC15' });
  V('m_kinetic', 'm_kin_travel', 'Kinetik: seyahat', 'Başlık & yazı', { text: 'BURAYI *MUTLAKA* GÖR', accent: '#0EA5E9' });
  V('m_kinetic', 'm_kin_tech', 'Kinetik: teknoloji', 'Başlık & yazı', { text: 'YAPAY ZEKÂ *İŞİMİ* ALDI', accent: '#9D8CF2' });
  V('m_kinetic', 'm_kin_story', 'Kinetik: hikâye', 'Başlık & yazı', { text: 'SONUNA KADAR *İZLE*', accent: '#EF4444' });
  V('m_count', 'm_count_subs', 'Sayaç: abone', 'Motion 2D', { from: 0, to: 100000, suffix: '', label: 'abone', accent: '#E53935' });
  V('m_count', 'm_count_money', 'Sayaç: gelir', 'Motion 2D', { from: 0, to: 25000, prefix: '₺', suffix: '', label: 'ilk ayın geliri', accent: '#22C55E' });
  V('m_count', 'm_count_km', 'Sayaç: mesafe', 'Motion 2D', { from: 0, to: 4200, suffix: ' km', label: 'yol yaptık', accent: '#0EA5E9' });
  V('m_count', 'm_count_kcal', 'Sayaç: kalori', 'Motion 2D', { from: 0, to: 650, suffix: ' kcal', label: 'yakıldı', accent: '#F97316' });
  V('m_bars', 'm_bars_sales', 'Grafik: satışlar', 'Bilgi & liste', { title: 'Aylık satış (adet)', stats: 'Oca|40\nŞub|65\nMar|90\nNis|150\nMay|240', accent: '#22C55E' });
  V('m_bars', 'm_bars_cmp', 'Grafik: karşılaştırma', 'Bilgi & liste', { title: 'Hangisi daha hızlı? (sn)', stats: 'A|12\nB|9\nC|7\nD|4', accent: '#E9C7A1' });
  V('m_line', 'm_line_price', 'Grafik: fiyat', 'Bilgi & liste', { title: 'Fiyat değişimi', stats: '1|100\n2|120\n3|115\n4|160\n5|190\n6|240', suffix: ' ₺', accent: '#EF4444' });
  V('m_donut', 'm_donut_battery', 'Halka: pil', 'Bilgi & liste', { value: 92, label: 'pil — tüm gün yetiyor', accent: '#22C55E' });
  V('m_donut', 'm_donut_survey', 'Halka: anket', 'Bilgi & liste', { value: 68, label: 'kişi bu tarifi denedi', accent: '#C2603D', dark: false });
  V('m_flap', 'm_flap_dest', 'Tabela: varış', 'Etkinlik & mekan', { text: 'ANTALYA' });
  V('m_flap', 'm_flap_gate', 'Tabela: kapı', 'Etkinlik & mekan', { text: 'KAPI 12' });
  V('m_scramble', 'm_scr_secret', 'Şifre: gizli', 'Başlık & yazı', { text: 'GİZLİ BİLGİ', accent: '#9D8CF2' });
  V('m_scramble', 'm_scr_win', 'Şifre: kazandın', 'Başlık & yazı', { text: 'TEBRİKLER', accent: '#FACC15' });
  V('m_marker', 'm_marker_tip', 'Vurgu: ipucu', 'Başlık & yazı', { text: 'İşte *kimsenin* söylemediği ipucu', accent: '#9D8CF2' });
  V('m_marker', 'm_marker_food', 'Vurgu: tarif', 'Başlık & yazı', { text: 'Sırrı *tereyağında* saklı', accent: '#F59E0B' });
  V('m_steps', 'm_steps_order', 'Adımlar: sipariş', 'Bilgi & liste', { lines: 'Sipariş\nHazırlık\nKargo\nTeslim', accent: '#C2603D' });
  V('m_steps', 'm_steps_learn', 'Adımlar: öğrenme', 'Bilgi & liste', { lines: 'İzle\nDene\nUygula\nPaylaş', accent: '#0EA5E9' });
  V('m_timeline', 'm_tl_love', 'Zaman çizelgesi: aşk', 'Etkinlik & mekan', { stats: '2019|Tanıştık\n2021|İlk tatil\n2024|Evlilik teklifi\n2026|Düğün 💍', accent: '#EC4899' });
  V('m_timeline', 'm_tl_biz', 'Zaman çizelgesi: şirket', 'Bilgi & liste', { stats: '2020|Fikir\n2022|İlk müşteri\n2024|10 kişilik ekip\n2026|Yurt dışı', accent: '#22C55E' });
  V('m_quote', 'm_quote2', 'Alıntı (açık)', 'Başlık & yazı', { text: 'Küçük adımlar, büyük değişimler getirir.', name: 'Günün sözü', dark: false, accent: '#C2603D' });
  V('m_quote', 'm_quote3', 'Alıntı (spor)', 'Başlık & yazı', { text: 'Ter, başarının parfümüdür.', name: 'Antrenör', accent: '#22C55E' });
  V('m_sting', 'm_sting2', 'İsim açılışı (sıcak)', 'Başlık & yazı', { text: 'LATTE', sub: 'saha', accent: '#C2603D' });
  V('m_sting', 'm_sting3', 'İsim açılışı (kanal)', 'Başlık & yazı', { text: 'KANALIM', sub: 'yeni bölüm', accent: '#22D3EE' });
  V('m_lt1', 'm_lt1b', 'Alt bant (çizgi, kırmızı)', 'Alt bant', { name: 'Mert Kaya', title: 'Şef', accent: '#E11D48' });
  V('m_lt2', 'm_lt2b', 'Alt bant (hap, mor)', 'Alt bant', { name: 'Zeynep Ak', title: 'Yazılımcı', accent: '#9D8CF2' });
  V('m_lt3', 'm_lt3b', 'Alt bant (neon, pembe)', 'Alt bant', { name: 'Gece Yayını', title: 'canlı', accent: '#EC4899' });
  V('m_lt4', 'm_lt4b', 'Alt bant (cam, otel)', 'Alt bant', { name: 'Fashion TV Luxe', title: 'Antalya', accent: '#FFFFFF' });
  V('m_lt1', 'm_lt_doc', 'Alt bant (belgesel)', 'Alt bant', { name: 'Prof. Dr. Ayşe Demir', title: 'Tarihçi', accent: '#E9C7A1' });
  V('m_lt2', 'm_lt_guest', 'Alt bant (konuk)', 'Alt bant', { name: 'Konuk', title: 'Podcast · Bölüm 12', accent: '#F59E0B' });
  V('m_callout', 'm_callout_y', 'El çizimi daire (sarı)', 'Motion 2D', { text: 'bak!', accent: '#FDE68A' });
  V('m_arrow', 'm_arrow_r', 'El çizimi ok (kırmızı)', 'Motion 2D', { text: 'burası', accent: '#EF4444' });
  V('m_callout', 'm_underline_hand', 'El çizimi alt çizgi', 'Motion 2D', { shape: 'underline', text: 'önemli', accent: '#22D3EE' });
  V('m_confetti', 'm_confetti_gold', 'Altın konfeti', 'Motion 2D', { accent: '#FACC15', accent2: '#F59E0B' });
  V('m_confetti', 'm_confetti_latte', 'Latte konfeti', 'Motion 2D', { accent: '#8B5E3C', accent2: '#C9A27E' });
  // --- 3D varyasyonları ---
  V('m_carousel', 'm_carousel_menu', '3D karusel: menü', 'Motion 3D', { lines: 'Kahvaltı\nÖğle\nAkşam\nTatlı\nİçecek', accent: '#C2603D' });
  V('m_carousel', 'm_carousel_feat', '3D karusel: özellikler', 'Motion 3D', { lines: 'Hızlı\nGüvenli\nÜcretsiz\nAçık kaynak', accent: '#22D3EE' });
  V('m_cube', 'm_cube2', '3D küp (sıcak)', 'Motion 3D', { lines: 'TAZE\nLEZZETLİ\nEV YAPIMI', accent: '#C2603D', accent2: '#8B5E3C' });
  V('m_cube', 'm_cube3', '3D küp (neon)', 'Motion 3D', { lines: 'OYNA\nKAZAN\nPAYLAŞ', accent: '#22D3EE', accent2: '#0E7490' });
  V('m_flip', 'm_flip2', '3D çevirme: mit/gerçek', 'Motion 3D', { title: 'MİT', text: 'Kahve susatır', title2: 'GERÇEK', text2: 'Günlük sıvı ihtiyacına katkı sağlar' });
  V('m_flip', 'm_flip3', '3D çevirme: soru/cevap', 'Motion 3D', { title: 'SORU', text: 'En hızlı kara hayvanı?', title2: 'CEVAP', text2: 'Çita — 110 km/s', accent: '#9D8CF2', accent2: '#22C55E' });
  V('m_extrude', 'm_extrude2', '3D yazı: YES', 'Motion 3D', { text: 'YES!', accent: '#22C55E' });
  V('m_extrude', 'm_extrude3', '3D yazı: OMG', 'Motion 3D', { text: 'OMG', accent: '#EC4899' });
  V('m_extrude', 'm_extrude4', '3D yazı: 2026', 'Motion 3D', { text: '2026', accent: '#E9C7A1' });
  V('m_orbit', 'm_orbit2', 'Yörünge: takip et', 'Motion 3D', { text: 'TAKİP ET • YORUM YAP • PAYLAŞ • ', accent: '#9D8CF2' });
  V('m_tunnel', 'm_tunnel2', 'Işık tüneli (sıcak)', 'Motion 3D', { accent: '#C2603D', accent2: '#FDE68A', speed: 1.4 });
  V('m_tunnel', 'm_tunnel3', 'Işık tüneli (neon)', 'Motion 3D', { accent: '#22D3EE', accent2: '#EC4899', speed: 1.8 });
  V('m_stars', 'm_stars2', 'Hiper hız', 'Motion 3D', { speed: 2.2, count: 400, accent: '#B9ACF7' });
  V('m_phone', 'm_phone2', '3D telefon (sıcak)', 'Motion 3D', { title: 'Tarif uygulaması', accent: '#C2603D', accent2: '#FDE68A' });
  // --- kağıt varyasyonları ---
  V('m_paper', 'm_paper3', 'Kağıt başlık: masal', 'Kağıt & stop-motion', { text: 'MASAL ZAMANI', accent: '#9D8CF2', accent2: '#FDE68A' });
  V('m_paper', 'm_paper4', 'Kağıt başlık: okul', 'Kağıt & stop-motion', { text: 'DERS 1', accent: '#0EA5E9', accent2: '#F97316' });
  V('m_paper', 'm_paper5', 'Kağıt başlık: doğum günü', 'Kağıt & stop-motion', { text: 'İYİ Kİ DOĞDUN', accent: '#EC4899', accent2: '#FACC15', fps: 10 });
  V('m_torn', 'm_torn2', 'Yırtık bant (koyu)', 'Kağıt & stop-motion', { text: 'GERÇEK HİKÂYE', color: '#F5EFE6', accent: '#2B1E17' });
  V('m_torn', 'm_torn3', 'Yırtık bant (kırmızı)', 'Kağıt & stop-motion', { text: 'SON DAKİKA', color: '#FFFFFF', accent: '#C2603D' });
  V('m_sticky', 'm_sticky2', 'Yapışkan not (pembe)', 'Kağıt & stop-motion', { text: 'Bugünün hedefi:\n3 video!', accent: '#F9A8D4' });
  V('m_sticky', 'm_sticky3', 'Yapışkan not (mavi)', 'Kağıt & stop-motion', { text: 'Not:\nsu içmeyi unutma 💧', accent: '#93C5FD' });
  V('m_stamp', 'm_stamp2', 'Damga: reddedildi', 'Kağıt & stop-motion', { text: 'REDDEDİLDİ', accent: '#DC2626' });
  V('m_stamp', 'm_stamp3', 'Damga: orijinal', 'Kağıt & stop-motion', { text: 'ORİJİNAL', accent: '#8B5E3C' });
  V('m_stamp', 'm_stamp4', 'Damga: tükendi', 'Kağıt & stop-motion', { text: 'TÜKENDİ', accent: '#7E6AE0' });
  // --- HUD varyasyonları ---
  V('m_lockok', 'm_lock_face', 'Yüz tanındı', 'Sci-fi & HUD', { text: 'YÜZ TANINDI' });
  V('m_lockerr', 'm_lock_denied', 'Erişim reddedildi', 'Sci-fi & HUD', { text: 'ERİŞİM REDDEDİLDİ' });
  V('m_lockok', 'm_lock_target', 'Hedef bulundu', 'Sci-fi & HUD', { state: 'info', text: 'HEDEF BULUNDU' });
  V('m_alert', 'm_alert_warn', 'Dikkat paneli', 'Sci-fi & HUD', { state: 'warn', title: 'DİKKAT', text: 'Bu sahne şok edici olabilir' });
  V('m_alertok', 'm_alert_unlock', 'Kilit açıldı', 'Sci-fi & HUD', { title: 'KİLİT AÇILDI', text: 'Yeni seviye: 2' });
  V('m_tele', 'm_tele_game', 'Oyuncu istatistikleri', 'Sci-fi & HUD', { title: 'OYUNCU', stats: 'Can|86\nZırh|54\nHız|92\nGüç|71', accent: '#22C55E' });
  V('m_tele', 'm_tele_car', 'Araç paneli', 'Sci-fi & HUD', { title: 'ARAÇ DURUMU', stats: 'Yakıt|64\nLastik|88\nMotor|95\nBatarya|72', accent: '#F59E0B' });
  V('m_radar', 'm_radar2', 'Radar (mor)', 'Sci-fi & HUD', { text: 'TARANIYOR…', accent: '#9D8CF2' });
  // --- abone & etkileşim ---
  V('m_kinetic', 'm_kin_sub', 'Kinetik: abone ol', 'Abone & etkileşim', { text: 'ABONE OL *KAÇIRMA*', accent: '#E53935' });
  V('m_stack', 'm_stack_cta', 'Bildirim: yeni abone', 'Abone & etkileşim', { lines: 'Abone|Yeni abone|Ayşe kanala katıldı 🎉\nAbone|Yeni abone|Mert kanala katıldı\nAbone|Yeni abone|+120 kişi bugün', accent: '#E53935' });
  V('m_modal', 'm_modal_notif', 'Bildirim izni', 'Abone & etkileşim', { title: 'Bildirimleri aç?', text: 'Yeni videolardan ilk sen haberdar ol.', btn: 'Aç', btn2: 'Şimdi değil', accent: '#FACC15', dark: true });
  V('m_count', 'm_count_like', 'Sayaç: beğeni', 'Abone & etkileşim', { from: 0, to: 50000, label: 'beğeni hedefi', accent: '#EC4899' });
  V('m_donut', 'm_donut_goal', 'Halka: abone hedefi', 'Abone & etkileşim', { value: 76, label: 'hedefe ulaştık — sen de katıl', accent: '#E53935' });
  V('m_bell', 'm_bell3', 'Zil (kırmızı)', 'Abone & etkileşim', { text: 'ZİLE BAS 🔔', accent: '#E53935' });
  V('m_emoji', 'm_emoji_like', 'Beğeni yağmuru', 'Abone & etkileşim', { text: '👍❤️', count: 36 });
  V('m_glitch', 'm_glitch3', 'Glitch başlık (kırmızı)', 'Başlık & yazı', { text: 'HATA 404', accent: '#EF4444' });
  V('m_wstack', 'm_wstack3', 'Kelime yığını (yeşil)', 'Başlık & yazı', { text: 'SAĞLIKLI *YAŞA* MUTLU *OL*', accent: '#22C55E' });
  V('m_under', 'm_under3', 'Altı çizili (tarif)', 'Başlık & yazı', { text: 'Annemin Tarifi', sub: 'yıllardır değişmedi', accent: '#C2603D' });
  V('m_price', 'm_price3', 'Fiyat etiketi (yeşil)', 'Satış & ürün', { title: 'Sadece bu hafta', old: '₺2.499', price: '₺1.799', accent: '#16A34A' });
  V('m_price', 'm_price4', 'Fiyat etiketi (siyah)', 'Satış & ürün', { title: 'Black Friday', old: '₺3.000', price: '₺1.500', accent: '#111111' });
  V('m_cd', 'm_cd10', 'Geri sayım 10', 'Satış & ürün', { from: 10, text: 'YENİ YIL!', accent: '#FACC15' }, 11);
  V('m_check', 'm_check4', 'Antrenman listesi', 'Bilgi & liste', { title: 'Bugünkü set', lines: '20 squat\n15 şınav\n1 dk plank\n30 burpee', accent: '#F97316' });
  V('m_map', 'm_map3', 'Haritada rota (yeşil)', 'Etkinlik & mekan', { text: 'Likya Yolu', accent: '#16A34A', accent2: '#F59E0B' });
  V('m_date', 'm_date3', 'Tarih kartı (etkinlik)', 'Etkinlik & mekan', { title: 'Kasım', text: '03', sub: 'Lansman günü', accent: '#7E6AE0' });
  V('m_spot', 'm_spot2', 'Spot ışığı (mor)', 'Motion 2D', { text: 'Detaya dikkat', accent: '#9D8CF2' });
  V('m_prog', 'm_prog3', 'İndiriliyor çubuğu', 'Bilgi & liste', { title: 'İndiriliyor', text: 'dosya.zip — 240 MB', doneText: 'İndirildi ✓', accent: '#0EA5E9', accent2: '#22D3EE' });
  V('m_type', 'm_type2', 'Daktilo (soru)', 'Başlık & yazı', { text: 'Peki sen olsan ne yapardın?', accent: '#9D8CF2' });
}

// Denetçide düzenlenebilir alanlar
export const SOCIAL_FIELDS3 = {
  aichat: ['name', 'prompt', 'answer', 'speed', 'accent', 'dark', 'avatar'],
  aiprompt: ['title', 'text', 'btn', 'speed', 'accent', 'dark'],
  aithink: ['title', 'lines', 'every', 'accent', 'dark'],
  aiimage: ['text', 'dur', 'accent', 'accent2', 'dark', 'avatar'],
  airank: ['title', 'stats', 'accent', 'dark'],
  aicompare: ['prompt', 'nameA', 'textA', 'nameB', 'textB', 'speed', 'accent', 'accent2', 'dark'],
  aiagent: ['title', 'lines', 'every', 'accent', 'dark'],
  code: ['title', 'code', 'speed', 'accent'],
  terminal: ['title', 'lines', 'speed', 'accent'],
  codediff: ['title', 'code', 'every'],
  repo: ['name', 'text', 'stars', 'forks', 'stats', 'btn', 'tapAt', 'accent', 'dark'],
  commits: ['lines', 'every', 'accent', 'dark'],
  modal: ['title', 'text', 'btn', 'btn2', 'tapAt', 'accent', 'dark'],
  toast: ['state', 'title', 'text', 'dark'],
  notifstack: ['lines', 'every', 'accent', 'dark'],
  success: ['state', 'text'],
  kinetic: ['text', 'every', 'color', 'accent'],
  bigcount: ['from', 'to', 'prefix', 'suffix', 'label', 'dur', 'color', 'accent'],
  barchart: ['title', 'stats', 'accent', 'dark'],
  linechart: ['title', 'stats', 'suffix', 'accent', 'dark'],
  donut: ['value', 'label', 'accent', 'dark'],
  splitflap: ['text', 'accent'],
  scramble: ['text', 'accent'],
  marker: ['text', 'color', 'accent'],
  steps: ['lines', 'every', 'accent', 'dark'],
  timeline: ['stats', 'every', 'accent', 'dark'],
  quote: ['text', 'name', 'accent', 'dark'],
  logosting: ['text', 'sub', 'color', 'accent'],
  lower2: ['style', 'name', 'title', 'accent'],
  callout: ['shape', 'text', 'accent'],
  confetti: ['count', 'accent', 'accent2'],
  carousel3d: ['lines', 'speed', 'accent', 'dark'],
  cube3d: ['lines', 'every', 'accent', 'accent2'],
  flip3d: ['title', 'text', 'title2', 'text2', 'tapAt', 'accent', 'accent2'],
  extrude: ['text', 'depth', 'color', 'accent'],
  orbit: ['text', 'speed', 'color', 'accent'],
  tunnel: ['speed', 'accent', 'accent2'],
  starfield: ['speed', 'count', 'accent'],
  phone3d: ['title', 'speed', 'accent', 'accent2', 'v1'],
  papertitle: ['text', 'fps', 'accent', 'accent2'],
  torn: ['text', 'color', 'accent'],
  sticky: ['text', 'color', 'accent'],
  stamp: ['text', 'accent'],
  hud: ['state', 'text'],
  alert: ['state', 'title', 'text'],
  telemetry: ['title', 'stats', 'accent'],
  radar: ['text', 'accent'],
  glitchtitle: ['text', 'color', 'accent'],
  typewriter: ['text', 'speed', 'color', 'accent'],
  wordstack: ['text', 'every', 'color', 'accent'],
  countdown2: ['from', 'text', 'accent'],
  progress: ['title', 'text', 'doneText', 'dur', 'accent', 'accent2'],
  pricetag: ['title', 'old', 'price', 'accent'],
  checklist: ['title', 'lines', 'every', 'accent', 'dark'],
  mappin: ['text', 'accent', 'accent2', 'dark'],
  emojiburst: ['text', 'count'],
  bellring: ['text', 'color', 'accent'],
  datecard: ['title', 'text', 'sub', 'accent'],
  spotlight: ['text', 'px', 'py', 'accent'],
  underline: ['text', 'sub', 'color', 'accent'],
  ticker2: ['title', 'text', 'speed', 'accent'],
};

// alan etiketleri ve türleri (sheets.js socialTab bunları kullanır)
export const FIELD_META3 = {
  prompt: { label: 'Kullanıcı mesajı / komut', type: 'textarea' },
  answer: { label: 'Yapay zekâ cevabı', type: 'textarea' },
  code: { label: 'Kod', type: 'textarea' },
  speed: { label: 'Hız', type: 'range', min: 0.05, max: 60, step: 0.05 },
  every: { label: 'Aralık (sn)', type: 'range', min: 0.1, max: 3, step: 0.05 },
  nameA: { label: '1. model adı', type: 'text' }, nameB: { label: '2. model adı', type: 'text' },
  textA: { label: '1. cevap', type: 'textarea' }, textB: { label: '2. cevap', type: 'textarea' },
  stars: { label: 'Yıldız', type: 'number' }, forks: { label: 'Çatallanma', type: 'number' },
  btn2: { label: '2. buton', type: 'text' },
  state: { label: 'Durum', type: 'chips', options: [['ok', 'Başarılı (yeşil)'], ['err', 'Hata (kırmızı)'], ['warn', 'Uyarı (turuncu)'], ['info', 'Bilgi (mor)']] },
  prefix: { label: 'Önek', type: 'text' }, suffix: { label: 'Sonek', type: 'text' },
  sub: { label: 'Alt yazı', type: 'text' },
  style: { label: 'Stil', type: 'chips', options: [['bar', 'Çizgi'], ['pill', 'Hap'], ['neon', 'Neon'], ['glass', 'Cam']] },
  shape: { label: 'Şekil', type: 'chips', options: [['circle', 'Daire'], ['arrow', 'Ok'], ['underline', 'Alt çizgi']] },
  title2: { label: 'Arka yüz başlık', type: 'text' }, text2: { label: 'Arka yüz metin', type: 'textarea' },
  depth: { label: 'Derinlik', type: 'range', min: 4, max: 60, step: 1 },
  fps: { label: 'Stop-motion kare hızı', type: 'range', min: 4, max: 24, step: 1 },
  count: { label: 'Adet', type: 'number' },
  lines: { label: 'Satırlar (her satır bir öğe)', type: 'textarea' },
  stats: { label: 'Veriler (her satır “Ad|değer”)', type: 'textarea' },
  value: { label: 'Değer (%)', type: 'range', min: 0, max: 100, step: 1 },
  dur: { label: 'Süre (sn)', type: 'range', min: 0.5, max: 8, step: 0.1 },
  name: { label: 'İsim', type: 'text' },
  doneText: { label: 'Bitince yazı', type: 'text' },
  old: { label: 'Eski fiyat', type: 'text' }, price: { label: 'Yeni fiyat', type: 'text' },
  px: { label: 'Spot yatay konum', type: 'range', min: 0, max: 1, step: 0.01 }, py: { label: 'Spot dikey konum', type: 'range', min: 0, max: 1, step: 0.01 },
  from: { label: 'Başlangıç', type: 'number' }, to: { label: 'Bitiş', type: 'number' },
};

// ---------- çizim ----------
export function drawSocial3(ctx, L, lt, env) {
  const S = env.S, T = theme(L);
  const acc = L.accent || '#9D8CF2';
  const life = Math.max(0.1, (L.end ?? 1e9) - (L.start ?? 0));
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  switch (L.type) {
    // ================= YAPAY ZEKÂ =================
    case 'aichat': {
      const w = 920, pad = 44;
      ctx.font = F(500, 38);
      const qLines = wrap(ctx, L.prompt, w * 0.62);
      const aFull = wrap(ctx, L.answer, w - pad * 2 - 70);
      const lh = 52;
      const tq = 0.35, tThink = 1.0, tAns = 1.9;
      const shown = streamWords(L.answer, lt, L.speed || 7, tAns);
      const aLines = lt > tAns ? wrap(ctx, shown, w - pad * 2 - 70) : [];
      const qH = qLines.length * lh + 40;
      const aH = Math.max(lh, aFull.length * lh);
      const h = 150 + qH + 50 + aH + 70;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 44, T.bg, S);
      // başlık
      let y = -h / 2;
      ctx.save(); roundRect(ctx, -w / 2, y, w, 110, [44, 44, 0, 0]); ctx.fillStyle = T.bg2; ctx.fill(); ctx.restore();
      ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(-w / 2 + pad + 28, y + 55, 28, 0, Math.PI * 2); ctx.fill();
      spark(ctx, -w / 2 + pad + 28, y + 55, 17, '#fff', lt * 0.6);
      ctx.fillStyle = T.fg; ctx.font = F(700, 38); ctx.fillText(L.name || 'Alpi-co', -w / 2 + pad + 74, y + 52);
      ctx.fillStyle = T.sub; ctx.font = F(400, 26, SERIF, true); ctx.fillText(lt < tAns + 0.2 && lt > tThink ? 'düşünüyor…' : 'yapay zekâ asistanı', -w / 2 + pad + 74, y + 86);
      y += 150;
      // kullanıcı mesajı (sağ)
      const qp = easeOut((lt - tq) / 0.35);
      if (qp > 0) {
        ctx.save(); ctx.globalAlpha *= qp; ctx.translate(0, (1 - qp) * 30);
        ctx.font = F(500, 38);
        const qw = Math.min(w * 0.7, Math.max(...qLines.map((l) => ctx.measureText(l).width)) + 64);
        roundRect(ctx, w / 2 - pad - qw, y, qw, qH, [32, 32, 8, 32]); ctx.fillStyle = acc; ctx.fill();
        ctx.fillStyle = '#fff'; qLines.forEach((l, i) => ctx.fillText(l, w / 2 - pad - qw + 32, y + 56 + i * lh));
        ctx.restore();
      }
      y += qH + 50;
      // cevap (sol) — önce düşünme noktaları, sonra kelime kelime akış
      ctx.fillStyle = hexA(acc, 0.18); ctx.beginPath(); ctx.arc(-w / 2 + pad + 22, y + 18, 22, 0, Math.PI * 2); ctx.fill();
      spark(ctx, -w / 2 + pad + 22, y + 18, 13, acc, lt);
      if (lt > tThink && lt < tAns) {
        for (let i = 0; i < 3; i++) { const b = 0.5 + 0.5 * Math.sin(lt * 9 - i * 0.9); ctx.fillStyle = hexA(T.fg, 0.25 + 0.55 * b); ctx.beginPath(); ctx.arc(-w / 2 + pad + 80 + i * 30, y + 22 - b * 6, 9, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.font = F(500, 38); ctx.fillStyle = T.fg;
      aLines.forEach((l, i) => ctx.fillText(l, -w / 2 + pad + 70, y + 32 + i * lh));
      if (lt > tAns && shown.length < String(L.answer || '').length) {
        const last = aLines[aLines.length - 1] || '';
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(-w / 2 + pad + 70 + ctx.measureText(last).width + 18, y + 20 + (aLines.length - 1) * lh, 9, 0, Math.PI * 2); ctx.fill();
      }
      return { w, h };
    }
    case 'aiprompt': {
      const w = 920, h = 420, pad = 44;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      ctx.save(); ctx.strokeStyle = hexA(acc, 0.35 + 0.25 * Math.sin(lt * 3)); ctx.lineWidth = 4; roundRect(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 38); ctx.stroke(); ctx.restore();
      ctx.fillStyle = T.sub; ctx.font = F(500, 30); ctx.fillText(L.title || '', -w / 2 + pad, -h / 2 + 64);
      ctx.font = F(500, 42);
      const txt = typed(L.text, lt, L.speed || 22, 0.4);
      const ls = wrap(ctx, txt || ' ', w - pad * 2);
      ctx.fillStyle = T.fg;
      ls.slice(-3).forEach((l, i) => ctx.fillText(l, -w / 2 + pad, -h / 2 + 140 + i * 56));
      const lastL = ls.slice(-3);
      caret(ctx, -w / 2 + pad + ctx.measureText(lastL[lastL.length - 1] || '').width, -h / 2 + 140 + (lastL.length - 1) * 56, 46, lt, acc);
      const done = 0.4 + String(L.text || '').length / (L.speed || 22);
      const press = clamp((lt - done - 0.25) / 0.25);
      const bs = 1 - 0.12 * Math.sin(press * Math.PI);
      ctx.save(); ctx.translate(w / 2 - pad - 120, h / 2 - 70); ctx.scale(bs, bs);
      roundRect(ctx, -120, -38, 240, 76, 38); ctx.fillStyle = acc; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = F(700, 32); ctx.textAlign = 'center'; ctx.fillText(L.btn || 'Gönder', -12, 11);
      spark(ctx, 76, 0, 15, '#fff', lt);
      if (press > 0 && press < 1) { ctx.strokeStyle = hexA(acc, 1 - press); ctx.lineWidth = 6; roundRect(ctx, -120 - press * 40, -38 - press * 30, 240 + press * 80, 76 + press * 60, 38 + press * 30); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = T.sub; ctx.font = F(500, 26); ctx.textAlign = 'left'; ctx.fillText('＋  Görsel  ·  Ses  ·  Video', -w / 2 + pad, h / 2 - 60);
      return { w, h };
    }
    case 'aithink':
    case 'aiagent': {
      const items = L.type === 'aiagent' ? pairs(L.lines) : lines(L.lines).map((x) => [x, '']);
      const w = 900, pad = 46, rowH = L.type === 'aiagent' ? 104 : 86;
      const h = 150 + items.length * rowH + 30;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      // parlayan başlık
      const tx = -w / 2 + pad + 60, ty = -h / 2 + 88;
      spark(ctx, -w / 2 + pad + 22, ty - 12, 22, acc, lt * 1.2);
      ctx.font = F(700, 44);
      const tw = ctx.measureText(L.title || '').width;
      const g = ctx.createLinearGradient(tx + ((lt * 0.9) % 2 - 0.6) * tw * 1.6, 0, tx + ((lt * 0.9) % 2 - 0.6) * tw * 1.6 + tw * 0.5, 0);
      g.addColorStop(0, T.fg); g.addColorStop(0.5, acc); g.addColorStop(1, T.fg);
      ctx.fillStyle = g; ctx.fillText(L.title || '', tx, ty);
      const ev = L.every || 0.9;
      items.forEach(([a, b], i) => {
        const t0 = 0.5 + i * ev, p = easeOut((lt - t0) / 0.3);
        if (p <= 0) return;
        const done = lt > t0 + ev * 0.95;
        const y = -h / 2 + 150 + i * rowH;
        ctx.save(); ctx.globalAlpha *= p; ctx.translate((1 - p) * 30, 0);
        if (done) check(ctx, -w / 2 + pad + 22, y + 26, 22, clamp((lt - t0 - ev * 0.95) / 0.4), STATE.ok);
        else spinner(ctx, -w / 2 + pad + 22, y + 26, 18, lt, acc);
        ctx.fillStyle = done ? T.fg : T.sub; ctx.font = F(done ? 600 : 500, 36); ctx.fillText(a, -w / 2 + pad + 70, y + 38);
        if (b) { ctx.fillStyle = T.sub; ctx.font = F(400, 28, SERIF, true); ctx.fillText(done ? b : '…', -w / 2 + pad + 70, y + 78); }
        ctx.restore();
      });
      return { w, h };
    }
    case 'aiimage': {
      const w = 860, h = 1080, pad = 40, iw = w - pad * 2, ih = iw * 1.05;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      const D = Math.max(0.5, L.dur || 3.5), p = clamp((lt - 0.3) / D);
      const ix = -iw / 2, iy = -h / 2 + pad;
      ctx.save(); roundRect(ctx, ix, iy, iw, ih, 28); ctx.clip();
      const img = L.avatar && env.img ? env.img(L.avatar) : null;
      // hedef görsel: seçilen foto ya da üretken degrade
      const drawTarget = () => {
        if (img && img.complete && img.naturalWidth) { const k = Math.max(iw / img.naturalWidth, ih / img.naturalHeight); ctx.drawImage(img, -img.naturalWidth * k / 2, iy + ih / 2 - img.naturalHeight * k / 2, img.naturalWidth * k, img.naturalHeight * k); return; }
        const g = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih); g.addColorStop(0, acc); g.addColorStop(0.55, '#1B1530'); g.addColorStop(1, L.accent2 || '#E9C7A1'); ctx.fillStyle = g; ctx.fillRect(ix, iy, iw, ih);
        for (let i = 0; i < 9; i++) { ctx.fillStyle = hexA(i % 2 ? (L.accent2 || '#E9C7A1') : acc, 0.35); ctx.beginPath(); ctx.arc(ix + hash(i) * iw, iy + hash(i + 9) * ih, 40 + hash(i + 3) * 160, 0, Math.PI * 2); ctx.fill(); }
      };
      drawTarget();
      // bloklar: önce kaba gürültü, sonra netleşme
      const N = 18, cw = iw / N, ch = ih / Math.round(N * 1.05);
      for (let gx = 0; gx < N; gx++) for (let gy = 0; gy < Math.round(N * 1.05); gy++) {
        const r = hash(gx * 31 + gy * 7);
        const local = clamp((p - r * 0.75) / 0.25);
        if (local >= 1) continue;
        const n = hash(gx * 13 + gy * 17 + Math.floor(lt * 12));
        ctx.fillStyle = `rgba(${40 + n * 80},${30 + n * 50},${80 + n * 120},${1 - local})`;
        ctx.fillRect(ix + gx * cw, iy + gy * ch, cw + 1, ch + 1);
      }
      if (p < 1) { const sy = iy + ih * ((lt * 0.7) % 1); const sg = ctx.createLinearGradient(0, sy - 60, 0, sy + 10); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, hexA(acc, 0.55)); ctx.fillStyle = sg; ctx.fillRect(ix, sy - 60, iw, 70); }
      ctx.restore();
      ctx.fillStyle = T.fg; ctx.font = F(600, 32);
      wrap(ctx, `“${L.text || ''}”`, iw).slice(0, 2).forEach((l, i) => ctx.fillText(l, ix, iy + ih + 64 + i * 44));
      // ilerleme çubuğu
      const by = h / 2 - 54;
      roundRect(ctx, ix, by, iw, 14, 7); ctx.fillStyle = T.line; ctx.fill();
      roundRect(ctx, ix, by, Math.max(14, iw * p), 14, 7); ctx.fillStyle = acc; ctx.fill();
      ctx.fillStyle = T.sub; ctx.font = F(600, 26); ctx.textAlign = 'right'; ctx.fillText(p < 1 ? `%${Math.round(p * 100)} oluşturuluyor` : 'Hazır ✓', ix + iw, by - 14);
      ctx.textAlign = 'left';
      return { w, h };
    }
    case 'airank': {
      const items = pairs(L.stats).map(([a, b]) => [a, num(b)]).sort((x, y) => y[1] - x[1]);
      const w = 900, pad = 46, rowH = 110, h = 170 + items.length * rowH + 20;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      ctx.fillStyle = T.fg; ctx.font = F(700, 40);
      wrap(ctx, L.title, w - pad * 2).slice(0, 2).forEach((l, i) => ctx.fillText(l, -w / 2 + pad, -h / 2 + 76 + i * 48));
      const mx = Math.max(1, ...items.map((x) => x[1]));
      items.forEach(([a, v], i) => {
        const y = -h / 2 + 170 + i * rowH, t0 = 0.5 + i * 0.25, p = easeOut((lt - t0) / 0.9);
        ctx.fillStyle = i === 0 ? acc : T.sub; ctx.font = F(800, 34); ctx.fillText(`${i + 1}`, -w / 2 + pad, y + 46);
        ctx.fillStyle = T.fg; ctx.font = F(600, 32); ctx.fillText(a, -w / 2 + pad + 50, y + 30);
        const bw = w - pad * 2 - 160;
        roundRect(ctx, -w / 2 + pad + 50, y + 46, bw, 22, 11); ctx.fillStyle = T.line; ctx.fill();
        roundRect(ctx, -w / 2 + pad + 50, y + 46, Math.max(22, bw * (v / mx) * p), 22, 11); ctx.fillStyle = i === 0 ? acc : hexA(acc, 0.45); ctx.fill();
        ctx.fillStyle = T.fg; ctx.font = F(700, 32); ctx.textAlign = 'right'; ctx.fillText(Math.round(v * p), w / 2 - pad, y + 66); ctx.textAlign = 'left';
        if (i === 0 && p >= 1) { const b = back((lt - t0 - 0.9) / 0.4); ctx.save(); ctx.translate(-w / 2 + pad + 60 + ctx.measureText(a).width + 50, y + 18); ctx.scale(b, b); ctx.font = F(400, 40); ctx.fillText('👑', -20, 14); ctx.restore(); }
      });
      return { w, h };
    }
    case 'aicompare': {
      const w = 980, pad = 36, cw = (w - pad * 3) / 2;
      ctx.font = F(500, 32);
      const la = wrap(ctx, L.textA, cw - 50), lb = wrap(ctx, L.textB, cw - 50);
      const rows = Math.max(la.length, lb.length);
      const h = 230 + rows * 44 + 70;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      ctx.fillStyle = T.sub; ctx.font = F(400, 28, SERIF, true);
      ctx.fillText(wrap(ctx, `“${L.prompt || ''}”`, w - pad * 2)[0] || '', -w / 2 + pad, -h / 2 + 62);
      [[L.nameA, L.textA, acc], [L.nameB, L.textB, L.accent2 || '#E9C7A1']].forEach(([n, tx], k) => {
        const x = -w / 2 + pad + k * (cw + pad), y = -h / 2 + 100;
        roundRect(ctx, x, y, cw, h - 130, 28); ctx.fillStyle = T.bg2; ctx.fill();
        const col = k ? (L.accent2 || '#E9C7A1') : acc;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 40, y + 48, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = T.fg; ctx.font = F(700, 32); ctx.fillText(n || '', x + 72, y + 59);
        ctx.font = F(500, 32);
        const shown = streamWords(tx, lt, (L.speed || 6) * (k ? 0.82 : 1), 0.8 + k * 0.2);
        wrap(ctx, shown, cw - 50).forEach((l, i) => ctx.fillText(l, x + 26, y + 120 + i * 44));
      });
      return { w, h };
    }
    // ================= KOD =================
    case 'code': {
      const src = String(L.code || '').split('\n');
      const w = 980, pad = 36, lh = 46, h = 110 + src.length * lh + 50;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 30, '#15141B', S);
      ctx.fillStyle = '#1D1C25'; roundRect(ctx, -w / 2, -h / 2, w, 80, [30, 30, 0, 0]); ctx.fill();
      ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-w / 2 + 40 + i * 34, -h / 2 + 40, 11, 0, Math.PI * 2); ctx.fill(); });
      roundRect(ctx, -w / 2 + 150, -h / 2 + 16, 260, 64, [16, 16, 0, 0]); ctx.fillStyle = '#15141B'; ctx.fill();
      ctx.fillStyle = '#E9E6EF'; ctx.font = F(500, 26, MONO); ctx.fillText(L.title || 'kod.js', -w / 2 + 176, -h / 2 + 56);
      ctx.fillStyle = L.accent || '#9D8CF2'; ctx.fillRect(-w / 2 + 150, -h / 2 + 76, 260, 4);
      // yazılan karakter sayısı
      const total = Math.floor(Math.max(0, lt - 0.4) * (L.speed || 30));
      let left = total, cx = 0, cy = 0;
      // uzun satırlar kartı taşmasın: yazı boyutu otomatik küçülür
      ctx.font = F(400, 30, MONO);
      const longest = Math.max(1, ...src.map((l) => ctx.measureText(l).width));
      const fsz = Math.max(16, Math.min(30, 30 * (w - pad * 2 - 70) / longest));
      ctx.font = F(400, fsz, MONO);
      src.forEach((line, i) => {
        const y = -h / 2 + 130 + i * lh;
        ctx.fillStyle = '#4C4858'; ctx.textAlign = 'right'; ctx.fillText(String(i + 1), -w / 2 + pad + 34, y); ctx.textAlign = 'left';
        if (left < 0) return;
        let x = -w / 2 + pad + 64;
        const take = Math.min(line.length, left);
        let acc2 = 0;
        tokens(line).forEach(([tx, k]) => {
          if (acc2 >= take) return;
          const part = tx.slice(0, take - acc2); acc2 += tx.length;
          ctx.fillStyle = SYN[k]; ctx.fillText(part, x, y); x += ctx.measureText(part).width;
        });
        if (left <= line.length) { cx = x; cy = y; }
        left -= line.length + 1;
      });
      if (left < 0 || Math.floor(lt * 2) % 2 === 0) { ctx.fillStyle = L.accent || '#9D8CF2'; ctx.fillRect((cx || -w / 2 + pad + 64) + 2, (cy || -h / 2 + 130) - 30, 4, 38); }
      return { w, h };
    }
    case 'terminal': {
      const src = lines(L.lines);
      const w = 960, pad = 34, lh = 50, h = 100 + Math.max(4, src.length) * lh + 40;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 28, '#0E0D12', S);
      ctx.fillStyle = '#1A1920'; roundRect(ctx, -w / 2, -h / 2, w, 70, [28, 28, 0, 0]); ctx.fill();
      ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-w / 2 + 38 + i * 32, -h / 2 + 35, 10, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#8F8A99'; ctx.font = F(500, 24, MONO); ctx.textAlign = 'center'; ctx.fillText(L.title || 'terminal', 0, -h / 2 + 44); ctx.textAlign = 'left';
      ctx.font = F(400, 30, MONO);
      { const lw = Math.max(1, ...src.map((l) => ctx.measureText(l).width + 40)); ctx.font = F(400, Math.max(16, Math.min(30, 30 * (w - pad * 2) / lw)), MONO); }
      // komut satırları yazılır, çıktı satırları anında belirir
      let t = 0.4; const cps = L.speed || 24;
      let lastY = -h / 2 + 120, lastX = -w / 2 + pad;
      for (let i = 0; i < src.length; i++) {
        const s = src[i], cmd = s.startsWith('$');
        const y = -h / 2 + 120 + i * lh;
        if (lt < t) break;
        if (cmd) {
          const body = s.slice(1).trim();
          const sh = typed(body, lt, cps, t);
          ctx.fillStyle = L.accent || '#22C55E'; ctx.fillText('❯', -w / 2 + pad, y);
          ctx.fillStyle = '#F3F1F5'; ctx.fillText(sh, -w / 2 + pad + 40, y);
          lastY = y; lastX = -w / 2 + pad + 40 + ctx.measureText(sh).width;
          t += body.length / cps + 0.35;
        } else {
          const ok = s.startsWith('✓'), bad = s.startsWith('✗');
          ctx.fillStyle = ok ? '#22C55E' : bad ? '#EF4444' : '#A9A4B5'; ctx.fillText(s, -w / 2 + pad, y);
          lastY = y + lh; lastX = -w / 2 + pad + 40;
          t += 0.28;
        }
      }
      if (Math.floor(lt * 2.4) % 2 === 0) { ctx.fillStyle = '#F3F1F5'; ctx.fillRect(lastX + 4, lastY - 28, 16, 34); }
      return { w, h };
    }
    case 'codediff': {
      const src = String(L.code || '').split('\n');
      const w = 980, pad = 30, lh = 52, h = 100 + src.length * lh + 30;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 28, '#15141B', S);
      ctx.fillStyle = '#E9E6EF'; ctx.font = F(600, 28, MONO); ctx.fillText(L.title || 'dosya.js', -w / 2 + pad, -h / 2 + 56);
      ctx.fillStyle = '#22C55E'; ctx.textAlign = 'right'; ctx.fillText(`+${src.filter((l) => l.startsWith('+')).length}`, w / 2 - pad - 70, -h / 2 + 56);
      ctx.fillStyle = '#EF4444'; ctx.fillText(`−${src.filter((l) => l.startsWith('-')).length}`, w / 2 - pad, -h / 2 + 56); ctx.textAlign = 'left';
      ctx.font = F(400, 30, MONO);
      { const lw = Math.max(1, ...src.map((l) => ctx.measureText(l).width)); ctx.font = F(400, Math.max(16, Math.min(30, 30 * (w - pad * 2) / lw)), MONO); }
      src.forEach((l, i) => {
        const p = easeOut((lt - 0.3 - i * (L.every || 0.45)) / 0.3);
        if (p <= 0) return;
        const y = -h / 2 + 96 + i * lh, add = l.startsWith('+'), del = l.startsWith('-');
        ctx.save(); ctx.globalAlpha *= p;
        if (add || del) { ctx.fillStyle = add ? 'rgba(34,197,94,.16)' : 'rgba(239,68,68,.16)'; ctx.fillRect(-w / 2, y, w * p, lh); }
        ctx.fillStyle = add ? '#4ADE80' : del ? '#F87171' : '#B8B3C4';
        ctx.fillText(l, -w / 2 + pad, y + 36);
        if (del && p >= 1) { ctx.strokeStyle = 'rgba(248,113,113,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2 + pad + 30, y + 26); ctx.lineTo(-w / 2 + pad + 30 + (ctx.measureText(l).width - 30) * clamp((lt - 0.6 - i * (L.every || 0.45)) / 0.4), y + 26); ctx.stroke(); }
        ctx.restore();
      });
      return { w, h };
    }
    case 'repo': {
      const w = 920, h = 560, pad = 48;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 36, T.bg, S);
      // genel depo ikonu
      ctx.strokeStyle = T.sub; ctx.lineWidth = 5; roundRect(ctx, -w / 2 + pad, -h / 2 + 50, 46, 56, 8); ctx.stroke();
      ctx.fillStyle = T.sub; ctx.fillRect(-w / 2 + pad + 10, -h / 2 + 64, 26, 5);
      const [own, rep] = String(L.name || 'kullanici/proje').split('/');
      ctx.font = F(500, 40); ctx.fillStyle = acc; ctx.fillText(`${own || ''} / `, -w / 2 + pad + 70, -h / 2 + 92);
      const ow = ctx.measureText(`${own || ''} / `).width;
      ctx.font = F(800, 40); ctx.fillText(rep || '', -w / 2 + pad + 70 + ow, -h / 2 + 92);
      ctx.fillStyle = T.sub; ctx.font = F(400, 32, SERIF);
      wrap(ctx, L.text, w - pad * 2).slice(0, 2).forEach((l, i) => ctx.fillText(l, -w / 2 + pad, -h / 2 + 170 + i * 44));
      // diller çubuğu
      const langs = pairs(L.stats).map(([a, b]) => [a, num(b)]);
      const tot = langs.reduce((s, x) => s + x[1], 0) || 1;
      const COLS = [acc, L.accent2 || '#E9C7A1', '#7FC8F8', '#A5E3B5', '#F5C27A'];
      let bx = -w / 2 + pad; const bw = w - pad * 2, prog = easeOut((lt - 0.5) / 1);
      ctx.save(); roundRect(ctx, bx, -h / 2 + 270, bw, 18, 9); ctx.clip();
      ctx.fillStyle = T.line; ctx.fillRect(bx, -h / 2 + 270, bw, 18);
      langs.forEach(([, v], i) => { const ww = bw * (v / tot) * prog; ctx.fillStyle = COLS[i % COLS.length]; ctx.fillRect(bx, -h / 2 + 270, ww, 18); bx += ww; });
      ctx.restore();
      let lx = -w / 2 + pad; ctx.font = F(500, 26);
      langs.forEach(([a, v], i) => { ctx.fillStyle = COLS[i % COLS.length]; ctx.beginPath(); ctx.arc(lx + 9, -h / 2 + 330, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = T.fg; const s = `${a} ${Math.round((v / tot) * 100)}%`; ctx.fillText(s, lx + 26, -h / 2 + 339); lx += ctx.measureText(s).width + 60; });
      // yıldız butonu + sayaç
      const tap = L.tapAt ?? 1.6, tp = clamp((lt - tap) / 0.3), on = lt >= tap;
      const stars = num(L.stars) + (on ? 1 : 0);
      const btw = 300, btx = -w / 2 + pad, bty = h / 2 - 130;
      const s1 = 1 - 0.1 * Math.sin(tp * Math.PI);
      ctx.save(); ctx.translate(btx + btw / 2, bty + 40); ctx.scale(s1, s1);
      roundRect(ctx, -btw / 2, -40, btw, 80, 20); ctx.fillStyle = on ? hexA(acc, 0.2) : T.chip; ctx.fill(); ctx.strokeStyle = on ? acc : T.line; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = on ? '#FACC15' : T.sub; ctx.font = F(400, 36); ctx.fillText(on ? '★' : '☆', -btw / 2 + 28, 13);
      ctx.fillStyle = T.fg; ctx.font = F(700, 30); ctx.fillText(on ? 'Yıldızlandı' : (L.btn || 'Yıldızla'), -btw / 2 + 78, 11);
      ctx.restore();
      ctx.fillStyle = T.fg; ctx.font = F(700, 34); ctx.fillText(`★ ${fmtN(stars * easeOut(Math.min(1, lt / 1.2)) + (lt > 1.2 ? 0 : 0))}`, btx + btw + 40, bty + 52);
      ctx.fillStyle = T.sub; ctx.font = F(500, 30); ctx.fillText(`⑂ ${fmtN(num(L.forks))}`, btx + btw + 300, bty + 52);
      return { w, h };
    }
    case 'commits': {
      const items = lines(L.lines);
      const w = 880, pad = 50, rowH = 96, h = 70 + items.length * rowH;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 36, T.bg, S);
      const ev = L.every || 0.7;
      const lineP = clamp(lt / (0.4 + items.length * ev));
      ctx.strokeStyle = hexA(acc, 0.35); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-w / 2 + pad + 16, -h / 2 + 60); ctx.lineTo(-w / 2 + pad + 16, -h / 2 + 60 + (items.length - 1) * rowH * lineP); ctx.stroke();
      items.forEach((s, i) => {
        const p = back((lt - 0.4 - i * ev) / 0.35); if (p <= 0) return;
        const y = -h / 2 + 60 + i * rowH;
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(-w / 2 + pad + 16, y, 16 * p, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = T.bg; ctx.beginPath(); ctx.arc(-w / 2 + pad + 16, y, 7 * p, 0, Math.PI * 2); ctx.fill();
        const [k, ...rest] = s.split(':');
        ctx.save(); ctx.globalAlpha *= clamp(p); ctx.translate((1 - clamp(p)) * 40, 0);
        ctx.font = F(700, 30, MONO); ctx.fillStyle = acc; ctx.fillText(rest.length ? `${k}:` : '', -w / 2 + pad + 60, y + 11);
        const kw = rest.length ? ctx.measureText(`${k}: `).width : 0;
        ctx.font = F(500, 32); ctx.fillStyle = T.fg; ctx.fillText(rest.length ? rest.join(':').trim() : s, -w / 2 + pad + 60 + kw, y + 11);
        ctx.fillStyle = T.sub; ctx.font = F(400, 22, MONO); ctx.textAlign = 'right'; ctx.fillText(Math.floor(hash(i + 3) * 0xfffffff).toString(16).slice(0, 7), w / 2 - pad, y + 10); ctx.textAlign = 'left';
        ctx.restore();
      });
      return { w, h };
    }
    // ================= POP-UP =================
    case 'modal': {
      const w = 820, pad = 50;
      ctx.font = F(400, 34, SERIF);
      const tl = wrap(ctx, L.text, w - pad * 2);
      ctx.font = F(700, 44);
      const hl = wrap(ctx, L.title, w - pad * 2);
      const h = 80 + hl.length * 56 + 20 + tl.length * 46 + 70 + 100 + 40;
      const tap = L.tapAt ?? 1.8;
      const inP = spring(lt / 0.6), outP = clamp((lt - tap - 0.35) / 0.3);
      const sc = (0.6 + 0.4 * inP) * (1 - 0.15 * outP);
      ctx.save(); ctx.globalAlpha *= clamp(lt / 0.15) * (1 - outP); ctx.scale(sc, sc);
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S, 60);
      ctx.fillStyle = T.fg; ctx.font = F(700, 44); ctx.textAlign = 'center';
      hl.forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 96 + i * 56));
      ctx.fillStyle = T.sub; ctx.font = F(400, 34, SERIF);
      tl.forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 96 + hl.length * 56 + 20 + i * 46));
      const by = h / 2 - 140, bw = (w - pad * 2 - 24) / 2;
      const press = clamp((lt - tap) / 0.3), ps = 1 - 0.08 * Math.sin(press * Math.PI);
      roundRect(ctx, -w / 2 + pad, by, bw, 96, 26); ctx.fillStyle = T.chip; ctx.fill();
      ctx.fillStyle = T.fg; ctx.font = F(600, 34); ctx.fillText(L.btn2 || 'Vazgeç', -w / 2 + pad + bw / 2, by + 60);
      ctx.save(); ctx.translate(-w / 2 + pad + bw * 1.5 + 24, by + 48); ctx.scale(ps, ps);
      roundRect(ctx, -bw / 2, -48, bw, 96, 26); ctx.fillStyle = acc; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = F(700, 34); ctx.fillText(L.btn || 'Tamam', 0, 12);
      ctx.restore();
      // dokunma göstergesi
      if (lt > tap - 0.4 && lt < tap + 0.5) { const q = clamp((lt - tap + 0.4) / 0.4); ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - clamp((lt - tap) / 0.5))})`; ctx.beginPath(); ctx.arc(-w / 2 + pad + bw * 1.5 + 24 + (1 - q) * 120, by + 60 + (1 - q) * 160, 34, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); ctx.textAlign = 'left';
      return { w, h };
    }
    case 'toast': {
      const col = STATE[L.state] || STATE.ok;
      const w = 900, h = 160;
      const inP = spring(lt / 0.55), out = clamp((lt - life + 0.6) / 0.4);
      ctx.save(); ctx.translate(0, (1 - inP) * 220 + out * 220); ctx.globalAlpha *= clamp(lt / 0.2) * (1 - out);
      shadowCard(ctx, -w / 2, -h / 2, w, h, 36, T.bg, S, 40);
      const ic = L.state === 'err' ? cross : check;
      ic(ctx, -w / 2 + 84, 0, 38, clamp((lt - 0.25) / 0.6), col);
      ctx.fillStyle = T.fg; ctx.font = F(700, 38); ctx.fillText(L.title || '', -w / 2 + 150, -8);
      ctx.fillStyle = T.sub; ctx.font = F(400, 30, SERIF); ctx.fillText(L.text || '', -w / 2 + 150, 38);
      ctx.save(); roundRect(ctx, -w / 2, -h / 2, w, h, 36); ctx.clip();
      ctx.fillStyle = col; ctx.fillRect(-w / 2, h / 2 - 8, w * (1 - clamp(lt / Math.max(0.5, life - 0.6))), 8); ctx.restore();
      ctx.restore();
      return { w, h };
    }
    case 'notifstack': {
      const items = lines(L.lines).map((l) => l.split('|'));
      const w = 900, ch = 170, gap = 22, ev = L.every || 0.55;
      const h = items.length * (ch + gap);
      items.forEach(([app2, title, text], i) => {
        const t0 = 0.2 + i * ev, p = spring((lt - t0) / 0.5);
        if (lt < t0) return;
        const y = -h / 2 + i * (ch + gap);
        ctx.save(); ctx.translate(0, (1 - p) * -160); ctx.globalAlpha *= clamp((lt - t0) / 0.2);
        shadowCard(ctx, -w / 2, y, w, ch, 36, T.dark ? T.bg : 'rgba(255,255,255,.94)', S, 30);
        roundRect(ctx, -w / 2 + 30, y + 30, 64, 64, 16); ctx.fillStyle = i % 2 ? (L.accent2 || '#E9C7A1') : acc; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = F(800, 30); ctx.textAlign = 'center'; ctx.fillText((app2 || '?').trim()[0] || '?', -w / 2 + 62, y + 72); ctx.textAlign = 'left';
        ctx.fillStyle = T.sub; ctx.font = F(600, 24); ctx.fillText((app2 || '').toUpperCase(), -w / 2 + 116, y + 50);
        ctx.textAlign = 'right'; ctx.fillText('şimdi', w / 2 - 30, y + 50); ctx.textAlign = 'left';
        ctx.fillStyle = T.fg; ctx.font = F(700, 32); ctx.fillText(title || '', -w / 2 + 116, y + 94);
        ctx.font = F(400, 30); ctx.fillStyle = T.fg; ctx.fillText(wrap(ctx, text || '', w - 150)[0] || '', -w / 2 + 116, y + 136);
        ctx.restore();
      });
      return { w, h };
    }
    case 'success': {
      const col = STATE[L.state] || STATE.ok, bad = L.state === 'err';
      const p = clamp(lt / 0.9);
      const shake = bad ? Math.sin(lt * 50) * 18 * Math.exp(-Math.max(0, lt - 0.6) * 6) * (lt > 0.6 ? 1 : 0) : 0;
      ctx.save(); ctx.translate(shake, 0);
      for (let i = 0; i < 3; i++) { const q = clamp((lt - 0.2 - i * 0.12) / 0.9); if (q > 0 && q < 1) { ctx.strokeStyle = hexA(col, (1 - q) * 0.6); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 150 + q * 160, 0, Math.PI * 2); ctx.stroke(); } }
      (bad ? cross : check)(ctx, 0, 0, 150, p, col);
      ctx.restore();
      if (L.text) { const q = easeOut((lt - 0.6) / 0.4); ctx.save(); ctx.globalAlpha *= q; ctx.fillStyle = '#fff'; ctx.font = F(800, 72); ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20 * S; ctx.fillText(L.text, 0, 260 + (1 - q) * 30); ctx.restore(); }
      return { w: 500, h: 600 };
    }
    // ================= MOTION 2D =================
    case 'kinetic': {
      const words = String(L.text || '').split(/\s+/).filter(Boolean);
      const ev = L.every || 0.28;
      ctx.font = F(800, 120); ctx.textAlign = 'center';
      const maxW = 940;
      // satırlara böl
      const rows = []; let row = [];
      words.forEach((wd) => { const tst = [...row, wd].join(' ').replace(/\*/g, ''); if (ctx.measureText(tst).width > maxW && row.length) { rows.push(row); row = [wd]; } else row.push(wd); });
      if (row.length) rows.push(row);
      const lh = 132, h = rows.length * lh;
      let k = 0;
      rows.forEach((r, ri) => {
        const full = r.join(' ').replace(/\*/g, '');
        let x = -ctx.measureText(full).width / 2;
        r.forEach((wd) => {
          const hl = /^\*.*\*$/.test(wd) || /\*/.test(wd);
          const clean = wd.replace(/\*/g, '');
          const t0 = 0.1 + k * ev, p = clamp((lt - t0) / 0.32);
          const ww = ctx.measureText(clean).width;
          if (p > 0) {
            const sc = 1 + 0.8 * (1 - easeOut(p));
            ctx.save(); ctx.translate(x + ww / 2, -h / 2 + ri * lh + lh * 0.78); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(p * 2);
            if (hl) { ctx.fillStyle = acc; roundRect(ctx, -ww / 2 - 16, -lh * 0.72, (ww + 32) * clamp(p * 1.5), lh * 0.86, 18); ctx.fill(); }
            ctx.fillStyle = hl ? '#fff' : (L.color || '#fff'); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18 * S; ctx.fillText(clean, 0, 0);
            ctx.restore();
          }
          x += ww + ctx.measureText(' ').width; k++;
        });
      });
      ctx.textAlign = 'left';
      return { w: maxW, h };
    }
    case 'bigcount': {
      const D = Math.max(0.3, L.dur || 2.2), p = easeIO(clamp((lt - 0.2) / D));
      const v = num(L.from) + (num(L.to) - num(L.from)) * p;
      const s = `${L.prefix || ''}${fmtN(v)}${p >= 1 ? (L.suffix || '') : ''}`;
      ctx.textAlign = 'center'; ctx.font = F(800, 200);
      const tw = ctx.measureText(s).width;
      const pop = p >= 1 ? 1 + 0.12 * Math.exp(-(lt - 0.2 - D) * 7) : 1;
      ctx.save(); ctx.scale(pop, pop); ctx.fillStyle = L.color || '#fff'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24 * S; ctx.fillText(s, 0, 60); ctx.restore();
      ctx.fillStyle = acc; roundRect(ctx, -tw / 2 * p, 100, tw * p, 14, 7); ctx.fill();
      ctx.fillStyle = L.color || '#fff'; ctx.font = F(400, 56, SERIF, true); ctx.fillText(L.label || '', 0, 200);
      ctx.textAlign = 'left';
      return { w: Math.max(600, tw), h: 420 };
    }
    case 'barchart': {
      const items = pairs(L.stats).map(([a, b]) => [a, num(b)]);
      const w = 920, h = 860, pad = 60;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      ctx.fillStyle = T.fg; ctx.font = F(700, 40); ctx.fillText(L.title || '', -w / 2 + pad, -h / 2 + 84);
      const mx = Math.max(1, ...items.map((x) => x[1]));
      const ch = h - 280, by = h / 2 - 110, bw = (w - pad * 2) / items.length;
      for (let g = 0; g <= 4; g++) { const y = by - (ch * g) / 4; ctx.strokeStyle = T.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + pad, y); ctx.lineTo(w / 2 - pad, y); ctx.stroke(); }
      items.forEach(([a, v], i) => {
        const p = back((lt - 0.4 - i * 0.18) / 0.7), bh = ch * (v / mx) * Math.max(0, p);
        const x = -w / 2 + pad + i * bw + bw * 0.18, ww = bw * 0.64;
        const g = ctx.createLinearGradient(0, by - bh, 0, by); g.addColorStop(0, acc); g.addColorStop(1, hexA(acc, 0.55));
        roundRect(ctx, x, by - bh, ww, Math.max(0, bh), [14, 14, 0, 0]); ctx.fillStyle = i === items.length - 1 ? acc : g; ctx.fill();
        ctx.fillStyle = T.sub; ctx.font = F(600, 28); ctx.textAlign = 'center'; ctx.fillText(a, x + ww / 2, by + 44);
        if (p > 0.3) { ctx.fillStyle = T.fg; ctx.font = F(700, 30); ctx.fillText(fmtN(v * clamp(p)), x + ww / 2, by - bh - 16); }
        ctx.textAlign = 'left';
      });
      return { w, h };
    }
    case 'linechart': {
      const items = pairs(L.stats).map(([a, b]) => [a, num(b)]);
      const w = 920, h = 760, pad = 60;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      ctx.fillStyle = T.fg; ctx.font = F(700, 40); ctx.fillText(L.title || '', -w / 2 + pad, -h / 2 + 84);
      const mx = Math.max(1, ...items.map((x) => x[1]));
      const x0 = -w / 2 + pad, x1 = w / 2 - pad, y0 = h / 2 - 80, y1 = -h / 2 + 170;
      const pt = (i) => [x0 + ((x1 - x0) * i) / Math.max(1, items.length - 1), y0 - ((y0 - y1) * items[i][1]) / mx];
      const p = easeIO(clamp((lt - 0.4) / 1.6)), segs = (items.length - 1) * p;
      ctx.beginPath(); ctx.moveTo(...pt(0));
      let last = pt(0);
      for (let i = 1; i <= Math.ceil(segs) && i < items.length; i++) { const f = Math.min(1, segs - (i - 1)); const a = pt(i - 1), b = pt(i); last = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; ctx.lineTo(...last); }
      ctx.save(); ctx.lineTo(last[0], y0); ctx.lineTo(x0, y0); ctx.closePath();
      const g = ctx.createLinearGradient(0, y1, 0, y0); g.addColorStop(0, hexA(acc, 0.4)); g.addColorStop(1, hexA(acc, 0)); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.moveTo(...pt(0));
      for (let i = 1; i <= Math.ceil(segs) && i < items.length; i++) { const f = Math.min(1, segs - (i - 1)); const a = pt(i - 1), b = pt(i); ctx.lineTo(lerp(a[0], b[0], f), lerp(a[1], b[1], f)); }
      ctx.strokeStyle = acc; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(last[0], last[1], 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.bg; ctx.beginPath(); ctx.arc(last[0], last[1], 7, 0, Math.PI * 2); ctx.fill();
      const cur = items[Math.min(items.length - 1, Math.round(segs))];
      ctx.fillStyle = T.fg; ctx.font = F(800, 46); ctx.textAlign = 'right'; ctx.fillText(`${cur ? cur[1] : ''}${L.suffix || ''}`, w / 2 - pad, -h / 2 + 86); ctx.textAlign = 'left';
      return { w, h };
    }
    case 'donut': {
      const w = 760, h = 820, v = clamp(num(L.value, 0) / 100);
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      const p = easeIO(clamp((lt - 0.3) / 1.5)), R = 220, cy = -80;
      ctx.lineWidth = 46; ctx.lineCap = 'round';
      ctx.strokeStyle = T.line; ctx.beginPath(); ctx.arc(0, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(0, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v * p); ctx.stroke();
      ctx.fillStyle = T.fg; ctx.font = F(800, 120); ctx.textAlign = 'center'; ctx.fillText(`%${Math.round(v * 100 * p)}`, 0, cy + 42);
      ctx.fillStyle = T.sub; ctx.font = F(400, 36, SERIF);
      wrap(ctx, L.label, w - 120).slice(0, 3).forEach((l, i) => ctx.fillText(l, 0, cy + R + 110 + i * 46));
      ctx.textAlign = 'left';
      return { w, h };
    }
    case 'splitflap': {
      const s = String(L.text || '').toUpperCase();
      const cw = 96, chh = 150, gap = 10, w = s.length * (cw + gap), CH = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789';
      s.split('').forEach((c, i) => {
        const x = -w / 2 + i * (cw + gap);
        const settle = 0.3 + i * 0.09 + 0.6;
        const flips = Math.floor(Math.max(0, lt - 0.3) * 18);
        const shown = lt >= settle || c === ' ' ? c : CH[(flips + i * 7) % CH.length];
        roundRect(ctx, x, -chh / 2, cw, chh, 12); ctx.fillStyle = '#1A1920'; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x, -2, cw, 4);
        ctx.fillStyle = lt >= settle ? (L.accent || '#E9C7A1') : '#F3F1F5'; ctx.font = F(700, 100, MONO); ctx.textAlign = 'center';
        if (c !== ' ') ctx.fillText(shown, x + cw / 2, 36);
      });
      ctx.textAlign = 'left';
      return { w, h: chh };
    }
    case 'scramble': {
      const s = String(L.text || ''), G = '!<>-_\\/[]{}—=+*^?#01ABXYZ';
      ctx.font = F(700, 96, MONO); ctx.textAlign = 'center';
      const out = s.split('').map((c, i) => { const done = lt > 0.3 + i * 0.07 + 0.4; return c === ' ' || done ? c : G[Math.floor(hash(i + Math.floor(lt * 20)) * G.length)]; }).join('');
      ctx.fillStyle = L.accent || '#22C55E'; ctx.shadowColor = L.accent || '#22C55E'; ctx.shadowBlur = 30 * S;
      ctx.fillText(out, 0, 34); ctx.shadowBlur = 0; ctx.textAlign = 'left';
      return { w: ctx.measureText(s).width, h: 140 };
    }
    case 'marker': {
      const words = String(L.text || '').split(/\s+/).filter(Boolean);
      ctx.font = F(700, 84);
      const maxW = 920, lh = 108;
      const rows = []; let row = [];
      words.forEach((wd) => { const tst = [...row, wd].join(' ').replace(/\*/g, ''); if (ctx.measureText(tst).width > maxW && row.length) { rows.push(row); row = [wd]; } else row.push(wd); });
      if (row.length) rows.push(row);
      const h = rows.length * lh; let k = 0;
      rows.forEach((r, ri) => {
        let x = -ctx.measureText(r.join(' ').replace(/\*/g, '')).width / 2;
        const y = -h / 2 + ri * lh + lh * 0.72;
        r.forEach((wd) => {
          const clean = wd.replace(/\*/g, ''), ww = ctx.measureText(clean).width, hl = /\*/.test(wd);
          if (hl) { const p = easeOut((lt - 0.5 - k * 0.05) / 0.5); ctx.save(); ctx.globalAlpha *= 0.9; ctx.fillStyle = L.accent || '#FDE68A'; ctx.beginPath(); ctx.moveTo(x - 10, y - 30); ctx.lineTo(x - 10 + (ww + 20) * p, y - 36); ctx.lineTo(x - 10 + (ww + 20) * p, y + 16); ctx.lineTo(x - 10, y + 20); ctx.closePath(); ctx.fill(); ctx.restore(); }
          ctx.fillStyle = hl ? '#1B1722' : (L.color || '#fff');
          if (!hl) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14 * S; }
          ctx.fillText(clean, x, y); ctx.shadowBlur = 0;
          x += ww + ctx.measureText(' ').width; k++;
        });
      });
      return { w: maxW, h };
    }
    case 'steps': {
      const items = lines(L.lines);
      const w = 960, h = 300, pad = 70, ev = L.every || 0.8;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      const n = items.length, sp = (w - pad * 2) / Math.max(1, n - 1);
      const prog = clamp((lt - 0.4) / (ev * Math.max(1, n - 1)));
      ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(-w / 2 + pad, -20); ctx.lineTo(w / 2 - pad, -20); ctx.stroke();
      ctx.strokeStyle = acc; ctx.beginPath(); ctx.moveTo(-w / 2 + pad, -20); ctx.lineTo(-w / 2 + pad + (w - pad * 2) * prog, -20); ctx.stroke();
      items.forEach((s, i) => {
        const x = -w / 2 + pad + i * sp, on = prog * (n - 1) >= i - 0.01;
        const q = clamp((prog * (n - 1) - i + 0.3) / 0.3);
        if (on) check(ctx, x, -20, 34, q, acc); else { ctx.fillStyle = T.bg; ctx.strokeStyle = T.line; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, -20, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = T.sub; ctx.font = F(700, 28); ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, -10); }
        ctx.fillStyle = on ? T.fg : T.sub; ctx.font = F(on ? 700 : 500, 32); ctx.textAlign = 'center'; ctx.fillText(s, x, 70);
      });
      ctx.textAlign = 'left';
      return { w, h };
    }
    case 'timeline': {
      const items = pairs(L.stats);
      const w = 860, rowH = 150, h = items.length * rowH + 60, ev = L.every || 0.7;
      const lx = -w / 2 + 210;
      const lp = clamp(lt / (0.3 + items.length * ev));
      ctx.strokeStyle = hexA(acc, 0.5); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(lx, -h / 2 + 30); ctx.lineTo(lx, -h / 2 + 30 + (h - 60) * lp); ctx.stroke();
      items.forEach(([a, b], i) => {
        const p = easeOut((lt - 0.3 - i * ev) / 0.4); if (p <= 0) return;
        const y = -h / 2 + 70 + i * rowH;
        ctx.save(); ctx.globalAlpha *= p;
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(lx, y, 18 * back(p), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = L.dark === false ? '#1B1722' : '#fff'; ctx.font = F(800, 52); ctx.textAlign = 'right'; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 12 * S; ctx.fillText(a, lx - 46, y + 18);
        ctx.textAlign = 'left'; ctx.font = F(500, 40); ctx.fillText(b, lx + 46 + (1 - p) * 40, y + 14);
        ctx.restore();
      });
      return { w, h };
    }
    case 'quote': {
      const w = 900, pad = 70;
      ctx.font = F(500, 54, SERIF, true);
      const ls = wrap(ctx, L.text, w - pad * 2);
      const h = 170 + ls.length * 72 + 140;
      shadowCard(ctx, -w / 2, -h / 2, w, h, 40, T.bg, S);
      ctx.fillStyle = acc; ctx.font = F(700, 200, SERIF); ctx.fillText('“', -w / 2 + pad - 10, -h / 2 + 190);
      ctx.font = F(500, 54, SERIF, true);
      ls.forEach((l, i) => { const p = easeOut((lt - 0.4 - i * 0.35) / 0.6); ctx.save(); ctx.globalAlpha *= p; ctx.fillStyle = T.fg; ctx.fillText(l, -w / 2 + pad, -h / 2 + 200 + i * 72 + (1 - p) * 20); ctx.restore(); });
      const p2 = easeOut((lt - 0.6 - ls.length * 0.35) / 0.5);
      ctx.fillStyle = acc; ctx.fillRect(-w / 2 + pad, h / 2 - 104, 60 * p2, 5);
      ctx.save(); ctx.globalAlpha *= p2; ctx.fillStyle = T.sub; ctx.font = F(600, 34); ctx.fillText(L.name || '', -w / 2 + pad + 80, h / 2 - 90); ctx.restore();
      return { w, h };
    }
    case 'logosting': {
      const s = String(L.text || '');
      ctx.font = F(800, 170); ctx.textAlign = 'left';
      const tw = ctx.measureText(s).width;
      let x = -tw / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(-tw, -170, tw * 2, 200); ctx.clip();
      s.split('').forEach((c, i) => {
        const p = easeOut((lt - 0.2 - i * 0.06) / 0.5), cw = ctx.measureText(c).width;
        ctx.fillStyle = L.color || '#fff'; ctx.fillText(c, x, 30 + (1 - p) * 190);
        x += cw;
      });
      ctx.restore();
      const lp = easeIO((lt - 0.5) / 0.7);
      ctx.fillStyle = acc; ctx.fillRect(-tw / 2, 70, tw * lp, 10);
      const sp = easeOut((lt - 1.0) / 0.5);
      ctx.save(); ctx.globalAlpha *= sp; ctx.fillStyle = L.color || '#fff'; ctx.font = F(400, 60, SERIF, true); ctx.textAlign = 'right'; ctx.fillText(L.sub || '', tw / 2, 160); ctx.restore();
      ctx.textAlign = 'left';
      return { w: tw, h: 380 };
    }
    case 'lower2': {
      const st = L.style || 'bar';
      ctx.font = F(800, 64); const nw = ctx.measureText(L.name || '').width;
      ctx.font = F(400, 40, SERIF, true); const tw2 = ctx.measureText(L.title || '').width;
      const w = Math.max(nw, tw2) + 120, h = 190;
      const p = easeOut(lt / 0.6), out = clamp((lt - life + 0.5) / 0.4), q = p * (1 - out);
      ctx.save();
      if (st === 'bar') {
        ctx.fillStyle = acc; ctx.fillRect(-w / 2, -h / 2, 12, h * q);
        ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + 12, -h / 2, w * q, h); ctx.clip();
        ctx.fillStyle = 'rgba(14,13,17,.82)'; ctx.fillRect(-w / 2 + 12, -h / 2, w, h);
        ctx.fillStyle = '#fff'; ctx.font = F(800, 64); ctx.fillText(L.name || '', -w / 2 + 50, -h / 2 + 88);
        ctx.fillStyle = acc; ctx.font = F(400, 40, SERIF, true); ctx.fillText(L.title || '', -w / 2 + 50, -h / 2 + 148);
        ctx.restore();
      } else if (st === 'pill') {
        ctx.globalAlpha *= q; ctx.translate(0, (1 - q) * 40);
        roundRect(ctx, -w / 2, -60, w, 120, 60); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(-w / 2 + 60, 0, 36, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1B1722'; ctx.font = F(800, 50); ctx.fillText(L.name || '', -w / 2 + 120, 2);
        ctx.fillStyle = '#6E6880'; ctx.font = F(400, 32, SERIF, true); ctx.fillText(L.title || '', -w / 2 + 120, 40);
      } else if (st === 'neon') {
        ctx.globalAlpha *= q > 0.1 ? (Math.floor(lt * 20) % 7 === 0 && lt < 0.7 ? 0.3 : 1) : 0;
        ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.shadowColor = acc; ctx.shadowBlur = 30 * S;
        roundRect(ctx, -w / 2, -h / 2, w * q, h, 24); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = F(800, 64); ctx.fillText(L.name || '', -w / 2 + 50, -h / 2 + 88);
        ctx.fillStyle = acc; ctx.font = F(500, 38); ctx.fillText(L.title || '', -w / 2 + 50, -h / 2 + 148);
      } else {
        ctx.globalAlpha *= q; ctx.translate((1 - q) * -60, 0);
        roundRect(ctx, -w / 2, -h / 2, w, h, 32); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = F(800, 64); ctx.fillText(L.name || '', -w / 2 + 50, -h / 2 + 88);
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = F(400, 40, SERIF, true); ctx.fillText(L.title || '', -w / 2 + 50, -h / 2 + 148);
      }
      ctx.restore();
      return { w, h };
    }
    case 'callout': {
      const col = L.accent || '#EF4444', p = easeIO(clamp((lt - 0.15) / 0.7));
      const boil = Math.floor(lt * 10);
      ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if ((L.shape || 'circle') === 'circle') {
        ctx.beginPath();
        const N = 60;
        for (let i = 0; i <= N * p * 1.08; i++) { const a = -0.6 + (i / N) * Math.PI * 2.1; const r = 1 + (hash(i + boil * 3) - 0.5) * 0.03; const x = Math.cos(a) * 300 * r, y = Math.sin(a) * 190 * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      } else if (L.shape === 'arrow') {
        const pts = [[-260, 220], [-120, 80], [40, -40], [160, -120]];
        ctx.beginPath(); ctx.moveTo(...pts[0]);
        const n = (pts.length - 1) * p;
        for (let i = 1; i <= Math.ceil(n); i++) { const f = Math.min(1, n - (i - 1)); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f) + (hash(i + boil) - 0.5) * 4, lerp(pts[i - 1][1], pts[i][1], f)); }
        ctx.stroke();
        if (p >= 1) { ctx.beginPath(); ctx.moveTo(160, -120); ctx.lineTo(80, -110); ctx.moveTo(160, -120); ctx.lineTo(140, -40); ctx.stroke(); }
      } else {
        ctx.beginPath(); ctx.moveTo(-300, 0); ctx.quadraticCurveTo(0, 22 + (hash(boil) - 0.5) * 6, -300 + 600 * p, 0); ctx.stroke();
      }
      if (L.text) { const q = easeOut((lt - 0.7) / 0.3); ctx.save(); ctx.globalAlpha *= q; ctx.fillStyle = col; ctx.font = F(600, 64, 'Caveat'); ctx.textAlign = 'center'; ctx.fillText(L.text, L.shape === 'arrow' ? -260 : 0, L.shape === 'arrow' ? 300 : 280); ctx.restore(); ctx.textAlign = 'left'; }
      return { w: 640, h: 440 };
    }
    case 'confetti': {
      const n = Math.min(300, num(L.count, 90)), cols = [acc, L.accent2 || '#E9C7A1', '#FFFFFF', '#FDE68A', '#7FC8F8'];
      for (let i = 0; i < n; i++) {
        const a = hash(i) * Math.PI * 2, v = 600 + hash(i + 1) * 1100, t = lt;
        const x = Math.cos(a) * v * t * Math.exp(-t * 0.8), y = Math.sin(a) * v * t * Math.exp(-t * 0.8) + 520 * t * t;
        const rot = t * (4 + hash(i + 2) * 8);
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, Math.cos(rot * 1.7));
        ctx.globalAlpha *= clamp(1.4 - t / 2.6); ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(-10, -6, 20, 12); ctx.restore();
      }
      return { w: 800, h: 800 };
    }
    // ================= MOTION 3D =================
    case 'carousel3d': {
      const items = lines(L.lines); const n = Math.max(1, items.length);
      const R = 420, rot = lt * (L.speed ?? 0.35) * Math.PI * 2;
      const order = items.map((s, i) => { const a = (i / n) * Math.PI * 2 + rot; return { s, i, z: Math.cos(a), x: Math.sin(a) }; }).sort((a, b) => a.z - b.z);
      order.forEach(({ s, i, z, x }) => {
        const sc = 0.62 + 0.38 * (z + 1) / 2, cw = 360, chh = 480;
        ctx.save(); ctx.translate(x * R, -z * 40); ctx.scale(sc * Math.max(0.25, Math.abs(Math.cos(Math.asin(clamp(x, -1, 1)) * 0.7))), sc);
        ctx.globalAlpha *= 0.35 + 0.65 * (z + 1) / 2;
        const g = ctx.createLinearGradient(-cw / 2, -chh / 2, cw / 2, chh / 2); g.addColorStop(0, T.bg2); g.addColorStop(1, T.bg);
        shadowCard(ctx, -cw / 2, -chh / 2, cw, chh, 36, T.bg, S, 30);
        roundRect(ctx, -cw / 2, -chh / 2, cw, chh, 36); ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = z > 0.9 ? acc : T.line; ctx.lineWidth = 5; ctx.stroke();
        ctx.fillStyle = i % 2 ? hexA(acc, 0.85) : hexA(acc, 0.5); ctx.beginPath(); ctx.arc(0, -60, 70, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = F(800, 64); ctx.textAlign = 'center'; ctx.fillText(String(i + 1), 0, -38);
        ctx.fillStyle = T.fg; ctx.font = F(700, 46); ctx.fillText(s, 0, 110);
        ctx.restore();
      });
      ctx.textAlign = 'left';
      return { w: R * 2 + 360, h: 560 };
    }
    case 'cube3d': {
      const items = lines(L.lines); const n = Math.max(1, items.length), ev = L.every || 0.9;
      const k = lt / ev, idx = Math.floor(k), f = easeIO(clamp((k - idx - 0.55) / 0.45));
      const S2 = 360, a = f * Math.PI / 2;
      const face = (txt, ang, shade) => {
        const c = Math.cos(ang); if (c <= 0.02) return;
        ctx.save(); ctx.translate(0, Math.sin(ang) * S2 / 2 * -1 + 0); ctx.scale(1, c);
        ctx.fillStyle = shade; ctx.fillRect(-S2 * 1.2, -S2 / 2, S2 * 2.4, S2);
        ctx.fillStyle = '#fff'; ctx.font = F(800, 130); ctx.textAlign = 'center'; ctx.fillText(txt, 0, 46);
        ctx.restore();
      };
      // ön yüz yukarı devrilir, alttaki gelir
      ctx.save(); ctx.translate(0, 0);
      face(items[idx % n], a, L.accent || '#9D8CF2');
      face(items[(idx + 1) % n], a - Math.PI / 2, L.accent2 || '#5B47C9');
      ctx.restore(); ctx.textAlign = 'left';
      return { w: S2 * 2.4, h: S2 };
    }
    case 'flip3d': {
      const tap = L.tapAt ?? 1.5, p = easeIO(clamp((lt - tap) / 0.7)), ang = p * Math.PI;
      const w = 760, h = 900, front = ang < Math.PI / 2;
      const sx = Math.abs(Math.cos(ang));
      ctx.save(); ctx.scale(Math.max(0.02, sx), 1 + 0.06 * Math.sin(ang));
      const col = front ? (L.accent || '#EF4444') : (L.accent2 || '#22C55E');
      shadowCard(ctx, -w / 2, -h / 2, w, h, 48, '#17161D', S);
      ctx.fillStyle = col; roundRect(ctx, -w / 2, -h / 2, w, 260, [48, 48, 0, 0]); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = F(800, 96); ctx.textAlign = 'center'; ctx.fillText(front ? (L.title || '') : (L.title2 || ''), 0, -h / 2 + 165);
      ctx.font = F(500, 56, SERIF);
      wrap(ctx, front ? L.text : L.text2, w - 120).slice(0, 5).forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 400 + i * 72));
      (front ? cross : check)(ctx, 0, h / 2 - 150, 64, 1, col);
      ctx.restore(); ctx.textAlign = 'left';
      return { w, h };
    }
    case 'extrude': {
      const d = Math.max(2, num(L.depth, 22)), s = String(L.text || '');
      ctx.font = F(800, 220); ctx.textAlign = 'center';
      const ang = Math.sin(lt * 1.2) * 0.5;
      const dx = Math.cos(ang) * 0.9, dy = 0.9;
      for (let i = d; i > 0; i--) { ctx.fillStyle = i === d ? 'rgba(0,0,0,.35)' : hexA(L.accent || '#9D8CF2', 0.55 + 0.45 * (1 - i / d) * 0.6); ctx.fillText(s, i * dx * 1.6, i * dy * 1.6 + 70); }
      const g = ctx.createLinearGradient(0, -110, 0, 80); g.addColorStop(0, L.color || '#fff'); g.addColorStop(1, hexA(L.color || '#fff', 0.82));
      ctx.fillStyle = g; ctx.fillText(s, 0, 70);
      ctx.textAlign = 'left';
      return { w: ctx.measureText(s).width + d * 3, h: 300 };
    }
    case 'orbit': {
      const s = String(L.text || '').toUpperCase(), R = 380, tilt = 0.32;
      const rot = lt * (L.speed ?? 0.25) * Math.PI * 2;
      ctx.font = F(800, 64); ctx.textAlign = 'center';
      const chars = s.split(''), n = chars.length;
      const list = chars.map((c, i) => { const a = (i / n) * Math.PI * 2 + rot; return { c, a, z: Math.cos(a) }; }).sort((a, b) => a.z - b.z);
      list.forEach(({ c, a, z }) => {
        ctx.save(); ctx.translate(Math.sin(a) * R, z * R * tilt * 0.4); ctx.scale(0.55 + 0.45 * (z + 1) / 2, 0.55 + 0.45 * (z + 1) / 2);
        ctx.globalAlpha *= 0.3 + 0.7 * (z + 1) / 2; ctx.fillStyle = z > 0 ? (L.color || '#fff') : (L.accent || '#E9C7A1');
        ctx.fillText(c, 0, 22); ctx.restore();
      });
      ctx.textAlign = 'left';
      return { w: R * 2 + 100, h: 300 };
    }
    case 'tunnel': {
      const W = env.W, H = env.H, sp = L.speed ?? 1;
      ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); ctx.clip();
      ctx.fillStyle = '#07060A'; ctx.fillRect(-W / 2, -H / 2, W, H);
      for (let i = 0; i < 28; i++) {
        const z = ((i / 28) - (lt * sp * 0.35) % (1 / 28) * 28 / 28 + 1) % 1;
        const zz = (((i - lt * sp * 8) % 28) + 28) % 28 / 28;
        const r = 40 / Math.max(0.02, 1 - zz) ** 1.4;
        void z;
        ctx.strokeStyle = hexA(i % 2 ? (L.accent2 || '#E9C7A1') : (L.accent || '#9D8CF2'), clamp(zz * 1.3) * 0.9);
        ctx.lineWidth = 2 + zz * 10;
        ctx.save(); ctx.rotate(zz * 0.6 + lt * 0.15); roundRect(ctx, -r * 0.62, -r, r * 1.24, r * 2, r * 0.25); ctx.stroke(); ctx.restore();
      }
      ctx.restore();
      return { w: W, h: H };
    }
    case 'starfield': {
      const W = env.W, H = env.H, n = Math.min(600, num(L.count, 260)), sp = L.speed ?? 1;
      ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); ctx.clip();
      ctx.fillStyle = '#05050A'; ctx.fillRect(-W / 2, -H / 2, W, H);
      ctx.strokeStyle = L.accent || '#fff'; ctx.lineCap = 'round';
      const ga = ctx.globalAlpha;
      for (let i = 0; i < n; i++) {
        const sx = (hash(i) - 0.5) * 2, sy = (hash(i + 0.5) - 0.5) * 2;
        const z = (((hash(i + 1.3) - lt * sp * 0.35) % 1) + 1) % 1;
        const k = 1 / Math.max(0.03, z), k2 = 1 / Math.max(0.03, z + 0.03 * sp);
        const x = sx * W * 0.25 * k, y = sy * H * 0.25 * k, x2 = sx * W * 0.25 * k2, y2 = sy * H * 0.25 * k2;
        ctx.globalAlpha = ga * clamp(1 - z); ctx.lineWidth = 1.5 + (1 - z) * 5;
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
      return { w: W, h: H };
    }
    case 'phone3d': {
      const w = 520, h = 1060, ang = Math.sin(lt * (L.speed ?? 0.4) * Math.PI) * 0.55;
      const sx = Math.cos(ang), sk = Math.sin(ang) * 0.12;
      ctx.save(); ctx.transform(sx, sk, 0, 1, 0, 0);
      // gölge/kalınlık
      ctx.fillStyle = '#0B0A0E'; roundRect(ctx, -w / 2 + (ang > 0 ? -14 : 14), -h / 2 + 6, w, h, 76); ctx.fill();
      ctx.fillStyle = '#1A1920'; roundRect(ctx, -w / 2, -h / 2, w, h, 76); ctx.fill();
      ctx.save(); roundRect(ctx, -w / 2 + 22, -h / 2 + 22, w - 44, h - 44, 58); ctx.clip();
      const img = L.v1 && env.img ? env.img(L.v1) : null;
      if (img && img.complete && img.naturalWidth) { const k = Math.max((w - 44) / img.naturalWidth, (h - 44) / img.naturalHeight); ctx.drawImage(img, -img.naturalWidth * k / 2, -img.naturalHeight * k / 2, img.naturalWidth * k, img.naturalHeight * k); } else {
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, L.accent || '#9D8CF2'); g.addColorStop(1, '#16112B'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = F(800, 60); ctx.textAlign = 'center'; wrap(ctx, L.title, w - 120).forEach((l, i) => ctx.fillText(l, 0, -80 + i * 70));
        for (let i = 0; i < 3; i++) { roundRect(ctx, -w / 2 + 70, 100 + i * 120, w - 140, 90, 22); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); }
      }
      // parlama
      const gl = ctx.createLinearGradient(-w / 2 + ang * 400, -h / 2, w / 2 + ang * 400, h / 2); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,.18)'); gl.addColorStop(0.65, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.fillStyle = '#000'; roundRect(ctx, -70, -h / 2 + 40, 140, 38, 19); ctx.fill();
      ctx.restore(); ctx.textAlign = 'left';
      return { w, h };
    }
    // ================= KAĞIT & STOP-MOTION =================
    case 'papertitle': {
      const fps = Math.max(2, num(L.fps, 8)), q = Math.floor(lt * fps); // stop-motion: kareler tutulur
      const s = String(L.text || '').toUpperCase();
      ctx.font = F(800, 130);
      const cw = s.split('').map((c) => ctx.measureText(c).width + 26);
      const tw0 = cw.reduce((a, b) => a + b, 0);
      const fit = Math.min(1, 980 / tw0); // geniş başlık ekrana sığsın
      ctx.save(); ctx.scale(fit, fit);
      const tw = tw0;
      let x = -tw / 2;
      const cols = [L.accent || '#E9C7A1', L.accent2 || '#C2603D', '#F5EFE6', '#9D8CF2'];
      s.split('').forEach((c, i) => {
        const appear = 0.15 + i * 0.07;
        const ww = cw[i];
        if (c !== ' ' && lt >= appear) {
          const qi = Math.floor((lt - appear) * fps);
          const drop = qi < 3 ? (3 - qi) * 30 : 0; // birkaç karede yerine "düşer"
          const jx = (hash(i * 9 + q) - 0.5) * 6, jy = (hash(i * 5 + q + 1) - 0.5) * 6, jr = (hash(i * 3 + q + 2) - 0.5) * 0.06 + (hash(i) - 0.5) * 0.12;
          ctx.save(); ctx.translate(x + ww / 2 + jx, jy - drop); ctx.rotate(jr);
          const col = cols[i % cols.length];
          // kesik kağıt: düzensiz kenarlı kart
          ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 6 * S;
          ctx.beginPath();
          const bw2 = ww * 0.5 + 6, bh = 92;
          const P = [[-bw2, -bh], [bw2, -bh], [bw2, bh * 0.75], [-bw2, bh * 0.75]];
          P.forEach(([px, py], k) => { const nx = px + (hash(i * 7 + k) - 0.5) * 12, ny = py + (hash(i * 11 + k) - 0.5) * 12; if (!k) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny); });
          ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.shadowColor = 'transparent';
          // kağıt lifi
          for (let k = 0; k < 6; k++) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-bw2 + hash(i + k) * bw2 * 2, -bh + hash(i * 2 + k) * bh * 1.6, 2, 10); }
          ctx.fillStyle = i % cols.length === 2 ? '#1B1722' : '#fff'; ctx.textAlign = 'center'; ctx.fillText(c, 0, 44);
          ctx.restore();
        }
        x += ww;
      });
      ctx.restore();
      ctx.textAlign = 'left';
      return { w: tw * fit, h: 240 * fit };
    }
    case 'torn': {
      const s = String(L.text || '');
      ctx.font = F(800, 90);
      const tw = ctx.measureText(s).width, w = tw + 140, h = 170;
      const p = easeOut(lt / 0.5);
      ctx.save(); ctx.translate((1 - p) * -900, 0); ctx.rotate(-0.03);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16 * S; ctx.shadowOffsetY = 8 * S;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2);
      for (let x = -w / 2; x <= w / 2; x += 18) ctx.lineTo(x, -h / 2 + (hash(x) - 0.5) * 14);
      for (let y = -h / 2; y <= h / 2; y += 16) ctx.lineTo(w / 2 + (hash(y + 3) - 0.5) * 18, y);
      for (let x = w / 2; x >= -w / 2; x -= 18) ctx.lineTo(x, h / 2 + (hash(x + 7) - 0.5) * 14);
      for (let y = h / 2; y >= -h / 2; y -= 16) ctx.lineTo(-w / 2 + (hash(y + 9) - 0.5) * 18, y);
      ctx.closePath(); ctx.fillStyle = L.accent || '#F5EFE6'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = L.color || '#1B1722'; ctx.textAlign = 'center'; ctx.fillText(s, 0, 32);
      ctx.restore(); ctx.textAlign = 'left';
      return { w, h };
    }
    case 'sticky': {
      const w = 560, h = 560, wob = Math.sin(lt * 2.2) * 0.02;
      ctx.save(); ctx.rotate(-0.05 + wob);
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24 * S; ctx.shadowOffsetY = 14 * S;
      ctx.fillStyle = L.accent || '#FDE68A'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2 - 50); ctx.quadraticCurveTo(w / 2 - 20, h / 2 - 10, w / 2 - 60, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.save(); ctx.rotate(0.05); ctx.fillRect(-90, -h / 2 - 26, 180, 56); ctx.restore();
      ctx.fillStyle = L.color || '#1B1722'; ctx.font = F(600, 64, 'Caveat'); ctx.textAlign = 'center';
      const ls = wrap(ctx, typed(L.text, lt, 18, 0.4), w - 80);
      ls.forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 140 + i * 74));
      ctx.restore(); ctx.textAlign = 'left';
      return { w, h };
    }
    case 'stamp': {
      const s = String(L.text || '').toUpperCase(), col = L.accent || '#C2603D';
      const p = clamp((lt - 0.1) / 0.18), sc = 2.6 - 1.6 * easeOut(p);
      ctx.save(); ctx.rotate(-0.14); ctx.scale(sc, sc); ctx.globalAlpha *= p;
      ctx.font = F(800, 96); const tw = ctx.measureText(s).width;
      ctx.strokeStyle = col; ctx.lineWidth = 12; roundRect(ctx, -tw / 2 - 40, -80, tw + 80, 160, 18); ctx.stroke();
      ctx.lineWidth = 4; roundRect(ctx, -tw / 2 - 24, -64, tw + 48, 128, 12); ctx.stroke();
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(s, 0, 34);
      // mürekkep boşlukları
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(0,0,0,${0.3 + hash(i) * 0.6})`; ctx.beginPath(); ctx.arc((hash(i + 1) - 0.5) * (tw + 80), (hash(i + 2) - 0.5) * 160, 2 + hash(i + 3) * 7, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); ctx.textAlign = 'left';
      return { w: 800, h: 300 };
    }
    // ================= SCI-FI & HUD =================
    case 'hud': {
      const col = STATE[L.state] || STATE.ok;
      const p = easeOut(clamp(lt / 0.6)), s = 420 - 140 * p, c = 90;
      ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.shadowColor = col; ctx.shadowBlur = 24 * S;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.moveTo(sx * s, sy * s - sy * c); ctx.lineTo(sx * s, sy * s); ctx.lineTo(sx * s - sx * c, sy * s); ctx.stroke(); });
      const blink = lt > 0.6 && Math.floor(lt * 6) % 2 === 0;
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 40 + (blink ? 6 : 0), 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(-50, 0); ctx.moveTo(50, 0); ctx.lineTo(90, 0); ctx.moveTo(0, -90); ctx.lineTo(0, -50); ctx.moveTo(0, 50); ctx.lineTo(0, 90); ctx.stroke();
      ctx.shadowBlur = 0;
      if (lt > 0.6) {
        ctx.font = F(700, 52, MONO); const tw = ctx.measureText(L.text || '').width;
        roundRect(ctx, -tw / 2 - 30, s + 40, tw + 60, 86, 10); ctx.fillStyle = hexA(col, 0.85); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(typed(L.text, lt, 30, 0.6), 0, s + 100); ctx.textAlign = 'left';
      }
      return { w: 900, h: 1000 };
    }
    case 'alert': {
      const col = STATE[L.state] || STATE.err, w = 860, h = 420;
      const p = clamp(lt / 0.25), fl = lt < 0.8 && Math.floor(lt * 14) % 2 === 0 ? 0.4 : 1;
      ctx.save(); ctx.globalAlpha *= p * fl; ctx.scale(1, easeOut(p));
      ctx.fillStyle = hexA('#07060A', 0.85); ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.shadowColor = col; ctx.shadowBlur = 30 * S; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.shadowBlur = 0;
      // çapraz uyarı şeritleri
      ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, 60); ctx.clip();
      for (let x = -w / 2 - 60 + ((lt * 120) % 60); x < w / 2; x += 60) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x + 30, -h / 2); ctx.lineTo(x + 60, -h / 2 + 60); ctx.lineTo(x + 30, -h / 2 + 60); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = col; ctx.font = F(800, 96, MONO); ctx.textAlign = 'center'; ctx.fillText(L.title || '', 0, 40);
      ctx.fillStyle = '#F3F1F5'; ctx.font = F(500, 40, MONO); ctx.fillText(typed(L.text, lt, 26, 0.4), 0, 130);
      for (let y = -h / 2; y < h / 2; y += 6) { ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(-w / 2, y, w, 2); }
      ctx.restore(); ctx.textAlign = 'left';
      return { w, h };
    }
    case 'telemetry': {
      const items = pairs(L.stats).map(([a, b]) => [a, num(b)]);
      const col = L.accent || '#22D3EE', w = 820, h = 150 + items.length * 110;
      ctx.fillStyle = 'rgba(7,10,14,.78)'; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = hexA(col, 0.8); ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = col; ctx.fillRect(-w / 2, -h / 2, 120 * easeOut(lt / 0.5), 6);
      ctx.font = F(700, 40, MONO); ctx.fillText(typed(L.title, lt, 24, 0.1), -w / 2 + 40, -h / 2 + 78);
      items.forEach(([a, v], i) => {
        const y = -h / 2 + 150 + i * 110, jitter = (hash(i + Math.floor(lt * 8)) - 0.5) * 6;
        const val = clamp((v + jitter) / 100) * easeOut((lt - 0.3 - i * 0.15) / 0.8);
        ctx.fillStyle = '#C9D6DF'; ctx.font = F(500, 32, MONO); ctx.fillText(a.toUpperCase(), -w / 2 + 40, y);
        ctx.textAlign = 'right'; ctx.fillStyle = col; ctx.fillText(`${Math.round(val * 100)}%`, w / 2 - 40, y); ctx.textAlign = 'left';
        const segs = 30, bw = (w - 80) / segs;
        for (let k = 0; k < segs; k++) { ctx.fillStyle = k / segs < val ? hexA(col, 0.4 + 0.6 * (k / segs)) : 'rgba(255,255,255,.08)'; ctx.fillRect(-w / 2 + 40 + k * bw, y + 22, bw - 5, 26); }
      });
      return { w, h };
    }
    case 'radar': {
      const col = L.accent || '#22C55E', R = 380;
      ctx.fillStyle = 'rgba(4,12,8,.8)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hexA(col, 0.35); ctx.lineWidth = 3;
      for (let r = R / 4; r <= R; r += R / 4) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.stroke();
      const a = lt * 2.2;
      for (let k = 0; k < 40; k++) { ctx.fillStyle = hexA(col, 0.25 * (1 - k / 40)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a - (k + 1) * 0.02, a - k * 0.02); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const ba = hash(i + 4) * Math.PI * 2, br = R * (0.3 + hash(i + 7) * 0.6);
        const since = ((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const glow = clamp(1 - since / 3.5);
        ctx.fillStyle = hexA(col, glow); ctx.beginPath(); ctx.arc(Math.cos(ba) * br, Math.sin(ba) * br, 14, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = col; ctx.font = F(700, 48, MONO); ctx.textAlign = 'center'; ctx.fillText(L.text || '', 0, R + 80); ctx.textAlign = 'left';
      return { w: R * 2, h: R * 2 + 120 };
    }
    // ================= v1.7 YENİ TÜRLER =================
    case 'glitchtitle': {
      const s2 = String(L.text || '');
      ctx.font = F(800, 130); ctx.textAlign = 'center';
      const p = clamp(lt / 0.5), burst = lt < 0.6 || (lt % 2.2) < 0.18;
      const off = burst ? (hash(Math.floor(lt * 30)) - 0.5) * 30 : 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= p;
      ctx.fillStyle = '#FF2D55'; ctx.fillText(s2, -6 + off, 44);
      ctx.fillStyle = '#22D3EE'; ctx.fillText(s2, 6 - off, 44);
      ctx.restore();
      ctx.globalAlpha *= p; ctx.fillStyle = L.color || '#fff'; ctx.fillText(s2, 0, 44);
      if (burst) for (let i = 0; i < 6; i++) { const y = -60 + hash(i + Math.floor(lt * 24)) * 140; ctx.fillStyle = hexA(acc, 0.7); ctx.fillRect(-500 + hash(i * 3 + Math.floor(lt * 24)) * 200, y, 300 + hash(i) * 500, 6); }
      ctx.textAlign = 'left';
      return { w: Math.min(1000, ctx.measureText(s2).width), h: 200 };
    }
    case 'typewriter': {
      ctx.font = F(600, 72, L.mono ? MONO : SERIF);
      const ls = wrap(ctx, typed(L.text, lt, L.speed || 16, 0.3), 900);
      const full = wrap(ctx, L.text, 900);
      const h2 = full.length * 92;
      ctx.fillStyle = L.color || '#fff'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14 * S;
      ls.forEach((l, i) => ctx.fillText(l, -450, -h2 / 2 + 70 + i * 92));
      ctx.shadowBlur = 0;
      const last = ls[ls.length - 1] || '';
      caret(ctx, -450 + ctx.measureText(last).width, -h2 / 2 + 70 + (Math.max(1, ls.length) - 1) * 92, 72, lt, acc);
      return { w: 920, h: h2 + 20 };
    }
    case 'wordstack': {
      const ws = String(L.text || '').split(/\s+/).filter(Boolean);
      const ev = L.every || 0.3, lh = 150;
      const h2 = ws.length * lh;
      ws.forEach((w2, i) => {
        const p = back((lt - 0.1 - i * ev) / 0.4); if (p <= 0) return;
        const hl = /\*/.test(w2), cl = w2.replace(/\*/g, '');
        ctx.save(); ctx.translate((1 - Math.min(1, p)) * (i % 2 ? 300 : -300), -h2 / 2 + i * lh + lh * 0.75);
        ctx.font = F(800, i % 2 ? 140 : 120); ctx.textAlign = 'center';
        if (hl) { const tw = ctx.measureText(cl).width; ctx.fillStyle = acc; roundRect(ctx, -tw / 2 - 20, -110, tw + 40, 135, 16); ctx.fill(); }
        ctx.fillStyle = hl ? '#fff' : (L.color || '#fff'); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 16 * S;
        ctx.fillText(cl, 0, 0); ctx.restore();
      });
      ctx.textAlign = 'left';
      return { w: 900, h: h2 };
    }
    case 'countdown2': {
      const from = Math.max(1, num(L.from, 5)), k2 = Math.floor(lt), left = Math.max(0, from - k2), ph = lt - k2;
      const R = 230;
      ctx.lineWidth = 26; ctx.lineCap = 'round';
      if (left > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ph)); ctx.stroke();
      } else { const q = clamp(ph / 0.6); ctx.strokeStyle = hexA(acc, 1 - q); ctx.beginPath(); ctx.arc(0, 0, R + q * 200, 0, Math.PI * 2); ctx.stroke(); }
      const sc = 1 + 0.4 * Math.exp(-ph * 9);
      ctx.save(); ctx.scale(sc, sc); ctx.fillStyle = '#fff'; ctx.font = F(800, 240); ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20 * S;
      ctx.fillText(left > 0 ? String(left) : (L.text || 'BAŞLA!'), 0, 84); ctx.restore();
      ctx.textAlign = 'left';
      return { w: R * 2 + 60, h: R * 2 + 60 };
    }
    case 'progress': {
      const w2 = 900, p = easeIO(clamp((lt - 0.2) / Math.max(0.5, L.dur || 3)));
      ctx.fillStyle = L.dark === false ? '#1B1722' : '#fff'; ctx.font = F(700, 52); ctx.fillText(L.title || '', -w2 / 2, -40);
      ctx.textAlign = 'right'; ctx.font = F(800, 52); ctx.fillText(`%${Math.round(p * 100)}`, w2 / 2, -40); ctx.textAlign = 'left';
      roundRect(ctx, -w2 / 2, 0, w2, 40, 20); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
      ctx.save(); roundRect(ctx, -w2 / 2, 0, Math.max(40, w2 * p), 40, 20); ctx.clip();
      const g = ctx.createLinearGradient(-w2 / 2, 0, w2 / 2, 0); g.addColorStop(0, acc); g.addColorStop(1, L.accent2 || '#E9C7A1'); ctx.fillStyle = g; ctx.fillRect(-w2 / 2, 0, w2, 40);
      for (let x = -w2 / 2 - 80 + ((lt * 160) % 80); x < w2 / 2; x += 80) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 20, 40); ctx.lineTo(x - 20, 40); ctx.fill(); }
      ctx.restore();
      if (L.text) { ctx.fillStyle = L.dark === false ? '#6E6880' : 'rgba(255,255,255,.75)'; ctx.font = F(400, 36, SERIF, true); ctx.fillText(p >= 1 ? (L.doneText || 'Tamamlandı ✓') : L.text, -w2 / 2, 100); }
      return { w: w2, h: 260 };
    }
    case 'pricetag': {
      const p = back((lt - 0.1) / 0.5);
      ctx.save(); ctx.scale(Math.max(0, p), Math.max(0, p)); ctx.rotate(-0.06);
      const w2 = 640, h2 = 360;
      shadowCard(ctx, -w2 / 2, -h2 / 2, w2, h2, 40, acc, S);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-w2 / 2 + 50, -h2 / 2 + 50, 16, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = F(600, 44); ctx.fillText(L.title || '', 0, -h2 / 2 + 90);
      ctx.font = F(700, 60); const old = String(L.old || ''); const ow = ctx.measureText(old).width; ctx.fillText(old, 0, -10);
      const sp = clamp((lt - 0.6) / 0.3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-ow / 2 - 10, -28); ctx.lineTo(-ow / 2 - 10 + (ow + 20) * sp, -28); ctx.stroke();
      const np = back((lt - 0.9) / 0.4); ctx.save(); ctx.translate(0, 110); ctx.scale(Math.max(0, np), Math.max(0, np)); ctx.fillStyle = '#fff'; ctx.font = F(800, 130); ctx.fillText(String(L.price || ''), 0, 0); ctx.restore();
      ctx.restore(); ctx.textAlign = 'left';
      return { w: 700, h: 420 };
    }
    case 'checklist': {
      const items = lines(L.lines);
      const w2 = 880, rowH = 104, h2 = 130 + items.length * rowH;
      shadowCard(ctx, -w2 / 2, -h2 / 2, w2, h2, 40, T.bg, S);
      ctx.fillStyle = T.fg; ctx.font = F(800, 46); ctx.fillText(L.title || '', -w2 / 2 + 48, -h2 / 2 + 82);
      const ev = L.every || 0.6;
      items.forEach((it, i) => {
        const y = -h2 / 2 + 130 + i * rowH, t0 = 0.5 + i * ev, q = clamp((lt - t0) / 0.5);
        ctx.strokeStyle = T.line; ctx.lineWidth = 5; roundRect(ctx, -w2 / 2 + 48, y + 14, 56, 56, 14); ctx.stroke();
        if (q > 0) check(ctx, -w2 / 2 + 76, y + 42, 30, q, acc);
        ctx.fillStyle = q >= 1 ? T.sub : T.fg; ctx.font = F(600, 38); ctx.fillText(it, -w2 / 2 + 130, y + 56);
        if (q >= 1 && L.strike) { const tw = ctx.measureText(it).width; ctx.strokeStyle = T.sub; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-w2 / 2 + 130, y + 44); ctx.lineTo(-w2 / 2 + 130 + tw * clamp((lt - t0 - 0.5) / 0.3), y + 44); ctx.stroke(); }
      });
      return { w: w2, h: h2 };
    }
    case 'mappin': {
      const w2 = 900, h2 = 900;
      ctx.save(); roundRect(ctx, -w2 / 2, -h2 / 2, w2, h2, 48); ctx.clip();
      ctx.fillStyle = L.dark === false ? '#EDE8E0' : '#1A1920'; ctx.fillRect(-w2 / 2, -h2 / 2, w2, h2);
      ctx.strokeStyle = L.dark === false ? '#FFFFFF' : '#2D2B35'; ctx.lineWidth = 22;
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-w2 / 2, -h2 / 2 + hash(i) * h2); ctx.bezierCurveTo(-100, hash(i + 2) * h2 - h2 / 2, 100, hash(i + 4) * h2 - h2 / 2, w2 / 2, -h2 / 2 + hash(i + 6) * h2); ctx.stroke(); }
      const a2 = [-260, 220], b2 = [180, -160], rp = easeIO(clamp((lt - 0.3) / 1.4));
      ctx.setLineDash([24, 18]); ctx.strokeStyle = acc; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(...a2); ctx.quadraticCurveTo(-200, -120, a2[0] + (b2[0] - a2[0]) * rp, a2[1] + (b2[1] - a2[1]) * rp); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(...a2, 18, 0, Math.PI * 2); ctx.fill();
      const dp = back((lt - 1.6) / 0.5);
      if (dp > 0) { ctx.save(); ctx.translate(b2[0], b2[1] - (1 - Math.min(1, dp)) * 200); ctx.scale(dp, dp); ctx.fillStyle = L.accent2 || '#EF4444'; ctx.beginPath(); ctx.arc(0, -70, 48, Math.PI, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -70, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.restore();
      if (lt > 1.9) { ctx.font = F(800, 52); const tw = ctx.measureText(L.text || '').width; shadowCard(ctx, -tw / 2 - 30, h2 / 2 - 150, tw + 60, 96, 48, '#fff', S); ctx.fillStyle = '#1B1722'; ctx.textAlign = 'center'; ctx.fillText(L.text || '', 0, h2 / 2 - 86); ctx.textAlign = 'left'; }
      return { w: w2, h: h2 };
    }
    case 'emojiburst': {
      const em = [...String(L.text || '🔥')].filter((c) => c.trim()), n = Math.min(80, num(L.count, 30));
      ctx.font = F(400, 90); ctx.textAlign = 'center';
      for (let i = 0; i < n; i++) {
        const t0 = hash(i) * 1.2, q = lt - t0; if (q < 0) continue;
        const x = (hash(i + 1) - 0.5) * 900 + Math.sin(q * 3 + i) * 40, y = 700 - q * (500 + hash(i + 2) * 500);
        ctx.save(); ctx.globalAlpha *= clamp(1.5 - q / 2); ctx.translate(x, y); ctx.rotate(Math.sin(q * 2 + i) * 0.4);
        ctx.fillText(em[i % em.length], 0, 0); ctx.restore();
      }
      ctx.textAlign = 'left';
      return { w: 1000, h: 1400 };
    }
    case 'bellring': {
      const sw = Math.sin(lt * 18) * 0.5 * Math.exp(-((lt % 1.6)) * 2.5);
      ctx.save(); ctx.translate(0, -60); ctx.rotate(sw);
      ctx.fillStyle = acc; ctx.translate(-120, -130); ctx.scale(10, 10); ctx.fill(new Path2D('M12 2a1.6 1.6 0 0 0-1.6 1.6v.6A6.2 6.2 0 0 0 5.8 10.3V15l-2 2.2V18.4h16.4v-1.2L18.2 15v-4.7a6.2 6.2 0 0 0-4.6-6.1v-.6A1.6 1.6 0 0 0 12 2zM9.6 19.6a2.4 2.4 0 0 0 4.8 0z'));
      ctx.restore();
      for (let k = 0; k < 2; k++) { const q = ((lt + k * 0.8) % 1.6) / 1.6; ctx.strokeStyle = hexA(acc, 1 - q); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, -60, 150 + q * 120, -2.4, -0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -60, 150 + q * 120, Math.PI - 0.7 + 0.3, Math.PI + 0.7); ctx.stroke(); }
      ctx.fillStyle = L.color || '#fff'; ctx.font = F(800, 70); ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14 * S; ctx.fillText(L.text || '', 0, 210); ctx.textAlign = 'left';
      return { w: 800, h: 560 };
    }
    case 'datecard': {
      const p = back((lt - 0.1) / 0.5), w2 = 420, h2 = 480;
      ctx.save(); ctx.scale(Math.max(0, p), Math.max(0, p));
      shadowCard(ctx, -w2 / 2, -h2 / 2, w2, h2, 40, '#fff', S);
      ctx.save(); roundRect(ctx, -w2 / 2, -h2 / 2, w2, 130, [40, 40, 0, 0]); ctx.fillStyle = acc; ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = F(800, 56); ctx.textAlign = 'center'; ctx.fillText((L.title || '').toLocaleUpperCase('tr-TR'), 0, -h2 / 2 + 88);
      const fl = clamp((lt - 0.4) / 0.35), sy = Math.abs(Math.cos(fl * Math.PI));
      ctx.save(); ctx.translate(0, 70); ctx.scale(1, fl < 0.5 ? sy : sy); ctx.fillStyle = '#1B1722'; ctx.font = F(800, 210); ctx.fillText(fl < 0.5 ? '··' : String(L.text || ''), 0, 70); ctx.restore();
      ctx.fillStyle = '#6E6880'; ctx.font = F(400, 38, SERIF, true); ctx.fillText(L.sub || '', 0, h2 / 2 - 40);
      ctx.restore(); ctx.textAlign = 'left';
      return { w: w2, h: h2 };
    }
    case 'spotlight': {
      const W = env.W, H = env.H, p = easeIO(clamp((lt - 0.1) / 0.9));
      const cx = (num(L.px, 0.5) - 0.5) * W, cy = (num(L.py, 0.45) - 0.5) * H, r = 80 + p * 300;
      ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); ctx.fillStyle = `rgba(0,0,0,${0.72 * p})`; ctx.fill('evenodd'); ctx.restore();
      ctx.strokeStyle = hexA(acc, p); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      if (L.text && p > 0.6) { ctx.globalAlpha *= clamp((p - 0.6) / 0.4); ctx.fillStyle = '#fff'; ctx.font = F(800, 72); ctx.textAlign = 'center'; ctx.fillText(L.text, cx, cy + r + 100); ctx.textAlign = 'left'; }
      return { w: W, h: H };
    }
    case 'underline': {
      ctx.font = F(800, 110); ctx.textAlign = 'center';
      const s2 = String(L.text || ''), tw = ctx.measureText(s2).width;
      const p = easeOut(clamp((lt - 0.1) / 0.5));
      ctx.save(); ctx.beginPath(); ctx.rect(-tw / 2 - 20, -130, tw + 40, 170); ctx.clip();
      ctx.fillStyle = L.color || '#fff'; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 16 * S; ctx.fillText(s2, 0, 30 + (1 - p) * 150); ctx.restore();
      const lp = easeIO(clamp((lt - 0.45) / 0.6));
      ctx.strokeStyle = acc; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-tw / 2, 80); ctx.quadraticCurveTo(0, 110, -tw / 2 + tw * lp, 74); ctx.stroke();
      if (L.sub) { const sp = easeOut(clamp((lt - 0.9) / 0.4)); ctx.globalAlpha *= sp; ctx.fillStyle = L.color || '#fff'; ctx.font = F(400, 56, SERIF, true); ctx.fillText(L.sub, 0, 180); }
      ctx.textAlign = 'left';
      return { w: Math.max(600, tw), h: 360 };
    }
    case 'ticker2': {
      const W = env.W, h2 = 120;
      ctx.fillStyle = acc; ctx.fillRect(-W / 2, -h2 / 2, 300, h2);
      ctx.fillStyle = '#fff'; ctx.font = F(800, 44); ctx.textAlign = 'center'; ctx.fillText(L.title || 'GÜNDEM', -W / 2 + 150, 15); ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(14,13,17,.88)'; ctx.fillRect(-W / 2 + 300, -h2 / 2, W - 300, h2);
      ctx.save(); ctx.beginPath(); ctx.rect(-W / 2 + 300, -h2 / 2, W - 300, h2); ctx.clip();
      ctx.font = F(600, 44); ctx.fillStyle = '#fff';
      const txt = `${L.text || ''}   •   `, tw = ctx.measureText(txt).width;
      let x = -W / 2 + 330 - ((lt * (L.speed || 200)) % tw);
      while (x < W / 2) { ctx.fillText(txt, x, 15); x += tw; }
      ctx.restore();
      return { w: W, h: h2 };
    }
    default: return null;
  }
}
