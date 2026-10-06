// Alpicut — proje şablonları ("Şablondan başla")
import { clone, uid } from './state.js';
import { SOCIAL_TEMPLATES3 } from './social3.js';
import { TEXT_BASE, TEXT_TEMPLATES, CTA_BASE, CTA_PRESETS, SCORE_BASE, SUB_BASE, FX_BASE, SHAPE_BASE, SHAPE_PRESETS, anim } from './presets.js';

const T = (id, start, end, extra = {}) => ({ ...clone(TEXT_BASE), ...clone(TEXT_TEMPLATES.find((x) => x.id === id).p), ...extra, id: uid(), kind: 'text', start, end, sc: 1, kf: {} });
const C = (id, start, end, extra = {}) => ({ ...clone(CTA_BASE), ...clone(CTA_PRESETS.find((x) => x.id === id).p), ...extra, id: uid(), kind: 'cta', start, end, sc: 1, kf: {} });
const SH = (id, start, end, extra = {}) => ({ ...clone(SHAPE_BASE), ...clone(SHAPE_PRESETS.find((x) => x.id === id).p), ...extra, id: uid(), kind: 'shape', start, end, sc: 1, kf: {} });

// v1.6: Motion stüdyosu katmanı
const M = (id, start, end, extra = {}) => { const tp = SOCIAL_TEMPLATES3.find((x) => x.id === id); return { kind: 'social', x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, scale: 1, dark: false, accent: '#9D8CF2', ...clone(tp.p), ...extra, id: uid(), start, end, kf: {} }; };

export const PROJECT_TEMPLATES = [
  { id: 'aitool', name: 'Yapay zekâ aracı tanıtımı', desc: 'Komut yazılıyor, Alpi-co sohbet ekranı, görsel üretimi, abone çağrısı', ratio: '9:16', icon: '✨',
    build: () => ({ dur: 24, layers: [
      M('m_kinetic', 0, 3, { text: 'BU YAPAY ZEKÂ *ÇILDIRTTI*', y: 0.3 }),
      M('m_aiprompt', 3, 8, { y: 0.45 }),
      M('m_aiimage', 8, 14, { y: 0.45 }),
      M('m_aichat', 14, 22, { y: 0.48 }),
      C('subscribe', 21, 24),
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), y: 0.86 } }, fx: clone(FX_BASE) }) },
  { id: 'devlog', name: 'Kod / geliştirici videosu', desc: 'Kod yazılıyor, terminal, diff, repo kartı, commit akışı', ratio: '9:16', icon: '💻',
    build: () => ({ dur: 26, layers: [
      M('m_scramble', 0, 3, { text: 'BUNU KODLADIM', y: 0.3 }),
      M('m_code', 3, 10, { y: 0.42 }),
      M('m_term', 10, 16, { y: 0.42 }),
      M('m_diff', 16, 20, { y: 0.42 }),
      M('m_repo', 20, 26, { y: 0.42 }),
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), y: 0.84 } }, fx: { ...clone(FX_BASE), bg: '#0E0D11' } }) },
  { id: 'aicompare', name: 'Yapay zekâ karşılaştırma', desc: 'İki model yan yana, cevap sıralaması, sonuç kartı', ratio: '9:16', icon: '⚖️',
    build: () => ({ dur: 20, layers: [
      M('m_kinetic', 0, 3, { text: 'HANGİSİ *DAHA ZEKİ?*', y: 0.3 }),
      M('m_aicompare', 3, 11, { y: 0.45 }),
      M('m_airank', 11, 17, { y: 0.45 }),
      M('m_success', 17, 20, { text: 'Kazanan belli!', y: 0.45 }),
    ], subs: clone(SUB_BASE), fx: clone(FX_BASE) }) },
  { id: 'paperstory', name: 'Kağıt stop-motion hikâye', desc: 'Kesik kağıt başlık, yapışkan not, damga, kağıt efekti', ratio: '9:16', icon: '✂️',
    build: () => ({ dur: 16, layers: [
      { id: uid(), kind: 'fx', effect: 'paper', start: 0, end: 16, amount: 1, speed: 1, fps: 8, x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, kf: {}, anim: anim('none', 'none') },
      M('m_paper', 0.2, 4, { y: 0.3 }),
      M('m_sticky', 5, 10, { y: 0.45 }),
      M('m_stamp', 11, 15, { y: 0.45 }),
    ], subs: clone(SUB_BASE), fx: clone(FX_BASE) }) },
  { id: 'football', name: 'Futbol yorum Shorts', desc: 'Hook başlık, skor kartı, neon çerçeve, kelime vurgulu altyazı, abone çağrısı', ratio: '9:16', icon: '⚽',
    build: () => ({ dur: 30, layers: [
      SH('neonFrame', 0, 30),
      { ...clone(SCORE_BASE), id: uid(), start: 0.3, end: 6, sc: 1, kf: {} },
      T('hook', 0, 3, { text: 'BU POZİSYON\n*PENALTI MI?*' }),
      T('playerName', 6, 10),
      C('subscribe', 25, 29),
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), mode: 'line', hl: 'color', accent: '#FACC15' } }, fx: { ...clone(FX_BASE), progress: true } }) },
  { id: 'news', name: 'Son dakika haberi', desc: 'Son dakika bandı, haber alt bandı, takip çağrısı', ratio: '9:16', icon: '📰',
    build: () => ({ dur: 20, layers: [
      T('breaking', 0, 20),
      T('lowerNews', 1, 20, { text: 'CANLI · *GELİŞME*' }),
      T('cleanCaption', 0.5, 5, { text: 'Detaylar videoda', y: 0.3 }),
      C('follow', 16, 20),
    ], subs: clone(SUB_BASE), fx: clone(FX_BASE) }) },
  { id: 'podcast', name: 'Yüzsüz podcast', desc: 'Kapak görseli için alan, hareketli ses dalgası, bölüm başlığı, altyazı', ratio: '9:16', icon: '🎙️',
    build: () => ({ dur: 60, layers: [
      { id: uid(), kind: 'shape', ...clone(SHAPE_BASE), shape: 'rect', w: 0.8, h: 0.8, radius: 40, strokeW: 0, fillOn: true, fillColor: '#1E1B4B', fillOpacity: 0.9, y: 0.36, start: 0, end: 60, sc: 1, kf: {}, anim: anim('fade', 'fade') },
      T('chapter', 0, 6, { text: 'BÖLÜM 1\n*Konu başlığı*', y: 0.36 }),
      { id: uid(), kind: 'wave', style: 'mirror', bars: 36, w: 0.8, h: 0.16, color: '#A855F7', color2: '#22D3EE', glow: true, x: 0.5, y: 0.62, rot: 0, sc: 1, opacity: 1, start: 0, end: 60, kf: {}, anim: anim('fade', 'fade') },
      C('handle', 0, 60, { y: 0.93, scale: 0.7 }),
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), mode: 'group', group: 3, anim: 'pop', y: 0.8 } }, fx: { ...clone(FX_BASE), bg: '#0E0A17' } }) },
  { id: 'ai', name: 'Yapay zekâ videosu', desc: 'Sinematik başlık, sinema şeritleri, “yapay zekâ ile üretildi” etiketi', ratio: '9:16', icon: '🤖',
    build: () => ({ dur: 15, layers: [
      T('bebas', 0.3, 4, { text: 'GELECEK ŞİMDİ' }),
      T('aiTag', 0, 15),
      C('like', 11, 15),
    ], subs: clone(SUB_BASE), fx: { ...clone(FX_BASE), letterbox: 0.18, vignette: 0.45, grain: 0.25 } }) },
  { id: 'vlog', name: 'Vlog / günlük', desc: 'Temiz başlık, konum etiketi, takip et çağrısı', ratio: '9:16', icon: '🎬',
    build: () => ({ dur: 20, layers: [
      T('cleanCaption', 0, 4, { text: 'Bugün neler yaptık?' }),
      C('follow', 16, 20),
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), mode: 'line', hl: 'none', box: 'line', upper: false, font: 'Poppins', weight: 600 } }, fx: clone(FX_BASE) }) },
  { id: 'youtube', name: 'YouTube yatay video', desc: '16:9 başlık, abone bandı, bölüm etiketleri', ratio: '16:9', icon: '▶️',
    build: () => ({ dur: 60, layers: [
      T('mrbeast', 0, 4, { size: 120, y: 0.2 }),
      T('chapter', 4, 9, { y: 0.5 }),
      C('subscribe', 50, 58, { y: 0.85 }),
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), size: 64, y: 0.86 } }, fx: clone(FX_BASE) }) },
];

// ---- v1.4 ek proje şablonları ----
import { SOCIAL_TEMPLATES } from './social.js';
const SO = (id, start, end, extra = {}) => ({ kind: 'social', x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, scale: 1, dark: false, accent: '#8B5CF6', ...clone(SOCIAL_TEMPLATES.find((x) => x.id === id).p), ...extra, id: uid(), start, end, kf: {} });
PROJECT_TEMPLATES.push(
  { id: 'chatstory', name: 'Mesajlaşma hikâyesi', desc: 'iPhone tarzı sohbet ekranı, mesajlar tek tek gelir; metinleri değiştir', ratio: '9:16', icon: '💬',
    build: () => ({ dur: 12, layers: [T('v_pov', 0, 3, { text: 'POV: *grup sohbeti* karıştı', y: 0.1 }), SO('imsg', 0.5, 12, { y: 0.55, scale: 0.88 })], subs: clone(SUB_BASE), fx: { ...clone(FX_BASE), bg: '#111' } }) },
  { id: 'whatsapp', name: 'WhatsApp grup komedisi', desc: 'WhatsApp tarzı grup sohbeti + vurgu sesleri için hazır', ratio: '9:16', icon: '🟢',
    build: () => ({ dur: 12, layers: [SO('wa', 0, 12, { y: 0.5, scale: 0.92 })], subs: clone(SUB_BASE), fx: clone(FX_BASE) }) },
  { id: 'channel', name: 'Kanal tanıtımı', desc: 'YouTube kanal kartviziti, abone tıklama animasyonu, bitiş ekranı', ratio: '9:16', icon: '📺',
    build: () => ({ dur: 12, layers: [SO('ytcard', 0.3, 6, { y: 0.45 }), T('v_yellowbox', 0, 3, { text: 'KANALIMA *HOŞ GELDİN*', y: 0.15 }), SO('ytend', 6.5, 12)], subs: clone(SUB_BASE), fx: { ...clone(FX_BASE), bg: '#0B0B10' } }) },
  { id: 'halfsplit', name: 'Yarım ekran yazılı video', desc: 'Üst yarıda büyük başlık, alt yarıda video (Reels tarzı)', ratio: '9:16', icon: '🔳',
    build: () => ({ dur: 15, layers: [SO('halfTop', 0, 15)], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), y: 0.85 } }, fx: clone(FX_BASE) }) },
  { id: 'matchday', name: 'Maç günü / derbi', desc: 'VS kartı, oyuncu kartı, haber bandı, geri sayım', ratio: '9:16', icon: '🏟️',
    build: () => ({ dur: 15, layers: [SO('versus', 0, 4), SO('player', 4, 9), SO('ticker', 0, 15), T('s_derby', 9, 12)], subs: clone(SUB_BASE), fx: { ...clone(FX_BASE), vignette: 0.3 } }) },
  { id: 'interview', name: 'Röportaj / yorumcu', desc: 'Alt bant isim/unvan, kelime vurgulu altyazı, abone bandı', ratio: '9:16', icon: '🎤',
    build: () => ({ dur: 30, layers: [SO('lower', 1, 6), C('subscribe', 25, 29)], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), mode: 'line', hl: 'color', accent: '#FACC15' } }, fx: clone(FX_BASE) }) },
);

// ---- v1.5: her sektöre proje şablonları ----
const ST = (sd, start, end, extra = {}) => ({ kind: 'sticker', sd: { ...sd }, badge: null, glyph: null, size: 240, x: 0.5, y: 0.4, rot: 0, sc: 1, opacity: 1, anim: anim('pop', 'pop', 'none', 0.35), ...extra, id: uid(), start, end, kf: {} });
const SUBX = (style) => ({ ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), ...style } });
PROJECT_TEMPLATES.push(
  { id: 'product', name: 'Ürün tanıtımı', desc: 'İndirim çıkartması, fiyat etiketi, ücretsiz kargo, sipariş çağrısı', ratio: '9:16', icon: '🛍️',
    build: () => ({ dur: 15, layers: [T('ec_new', 0, 3), ST({ text: '%30 İNDİRİM', bg: '#DC2626', fg: '#fff', shape: 'burst' }, 3, 8, { x: 0.78, y: 0.2, size: 220 }), T('ec_price', 3, 9), T('ec_free', 6, 12), T('ec_order', 10, 15)], subs: SUBX({ tpl: 'c_reels', font: 'Poppins', weight: 700, size: 60, color: '#111111', accent: '#7C3AED', strokeW: 0, shadow: 0, box: 'line', boxColor: '#FFFFFF', boxOpacity: 1, upper: false }), fx: clone(FX_BASE) }) },
  { id: 'recipe', name: 'Yemek tarifi', desc: 'Tarif başlığı, malzeme etiketleri, adım adım yazılar, afiyet olsun', ratio: '9:16', icon: '🍝',
    build: () => ({ dur: 30, layers: [T('fd_recipe', 0, 3.5), T('fd_ing', 3.5, 7), T('fd_step', 7, 12), T('fd_step', 12, 17, { text: '*2* sosu hazırla' }), T('fd_step', 17, 22, { text: '*3* birleştir ve servis et' }), T('fd_cal', 22, 27), T('fd_yum', 26, 30)], subs: SUBX({ tpl: 'c_clean', font: 'Inter', weight: 800, size: 64, strokeW: 0, shadow: 0.9, upper: false }), fx: { ...clone(FX_BASE), vignette: 0.2 } }) },
  { id: 'travel', name: 'Seyahat videosu', desc: 'Büyük destinasyon başlığı, konum etiketi, bütçe, gezi ipucu', ratio: '9:16', icon: '✈️',
    build: () => ({ dur: 25, layers: [T('tr_dest', 0, 3.5), T('vl_loc', 0.5, 25), T('tr_budget', 4, 8), T('tr_tip', 15, 20), C('follow', 21, 25)], subs: SUBX({ tpl: 'c_semi', font: 'Barlow Semi Condensed', weight: 700, size: 70, strokeW: 0, shadow: 0.9, upper: false }), fx: { ...clone(FX_BASE), grain: 0.12 } }) },
  { id: 'hotel', name: 'Otel / mekan tanıtımı', desc: 'Lüks başlık, oda tanıtımı, menü, rezervasyon çağrısı (altın tonlar)', ratio: '9:16', icon: '🏨',
    build: () => ({ dur: 30, layers: [T('ht_welcome', 0, 4), T('ht_room', 5, 12), T('ht_lux', 12, 16), T('ht_menu', 17, 23), ST({ text: '★★★★★', bg: '#111', fg: '#FACC15', shape: 'pill' }, 23, 27, { y: 0.2 }), T('ht_book', 24, 30)], subs: SUBX({ tpl: 'c_gold', font: 'Playfair Display', weight: 700, size: 66, color: '#F3DFA2', accent: '#FFFFFF', strokeW: 0, glow: 14, glowColor: '#B8860B', upper: false }), fx: { ...clone(FX_BASE), letterbox: 0.08, vignette: 0.35, grain: 0.08 } }) },
  { id: 'realestate', name: 'Emlak ilanı', desc: 'Satılık başlığı, özellikler, fiyat, iletişim', ratio: '9:16', icon: '🏠',
    build: () => ({ dur: 25, layers: [T('re_title', 0, 5), T('re_feat', 5, 15), T('re_price', 15, 20), T('ec_order', 20, 25, { text: 'BİLGİ İÇİN *ARA* 📞' })], subs: SUBX({ tpl: 'c_blackbox', font: 'Inter', weight: 700, size: 58, strokeW: 0, shadow: 0, box: 'line', boxColor: '#000000', boxOpacity: 0.62, upper: false }), fx: clone(FX_BASE) }) },
  { id: 'fitness', name: 'Antrenman', desc: 'Gün başlığı, set/tekrar, süre sayacı, motivasyon', ratio: '9:16', icon: '💪',
    build: () => ({ dur: 30, layers: [T('ft_day', 0, 3.5), T('ft_rep', 4, 10), T('ft_timer', 10, 16), T('ft_rep', 16, 22, { text: '3 SET × *15*' }), T('ft_mot', 25, 30)], subs: SUBX({ tpl: 'c_sport', font: 'Barlow Condensed', weight: 900, size: 98, italic: true, accent: '#F97316', strokeW: 12, mode: 'group', group: 3, anim: 'pop' }), fx: { ...clone(FX_BASE), vignette: 0.3 } }) },
  { id: 'edu', name: 'Eğitim / bilgi', desc: 'Bunu biliyor muydun, adım kartları, tanım, doğru/yanlış', ratio: '9:16', icon: '🎓',
    build: () => ({ dur: 30, layers: [T('ed_fact', 0, 4), T('ed_step', 4, 12), T('ed_def', 12, 20), T('ed_myth', 20, 25), C('follow', 26, 30)], subs: SUBX({ tpl: 'c_karaoke', font: 'Montserrat', weight: 900, size: 72, accent: '#22D3EE', strokeW: 9, hl: 'karaoke' }), fx: clone(FX_BASE) }) },
  { id: 'business', name: 'İş / finans ipucu', desc: 'İpucu numarası, büyüme rakamı, kurumsal alt bant, söz', ratio: '9:16', icon: '📈',
    build: () => ({ dur: 30, layers: [T('bz_tip', 0, 30), T('bz_name', 1, 6), T('bz_stat', 8, 13), T('bz_quote', 22, 28)], subs: SUBX({ tpl: 'c_block', font: 'Montserrat', weight: 800, size: 60, strokeW: 0, shadow: 0, box: 'block', boxColor: '#15141B', boxOpacity: 0.92, upper: false, anim: 'slide' }), fx: clone(FX_BASE) }) },
  { id: 'wedding', name: 'Düğün / nişan', desc: 'İsimler, tarih, zarif yazılar, yumuşak geçişler', ratio: '9:16', icon: '💍',
    build: () => ({ dur: 30, layers: [T('wd_names', 0, 6), T('wd_date', 1, 6), T('ev_invite', 20, 26), T('mo_soft', 26, 30, { text: 'sonsuza *dek*' })], subs: SUBX({ tpl: 'c_serif', font: 'Playfair Display', weight: 700, italic: true, size: 66, strokeW: 0, shadow: 0.9, upper: false }), fx: { ...clone(FX_BASE), vignette: 0.35, grain: 0.1 } }) },
  { id: 'event', name: 'Etkinlik duyurusu', desc: 'Davet, geri sayım, bilet çıkartması, tarih', ratio: '9:16', icon: '🎉',
    build: () => ({ dur: 15, layers: [T('ev_invite', 0, 4), T('ev_count', 4, 9), ST({ text: '🎟️ BİLET', bg: '#7C3AED', fg: '#fff', shape: 'tag' }, 9, 15, { y: 0.65 }), T('wd_date', 9, 15, { text: 'CUMARTESİ · 21:00', y: 0.4 })], subs: clone(SUB_BASE), fx: clone(FX_BASE) }) },
  { id: 'motivation', name: 'Motivasyon sözü', desc: 'Günün sözü etiketi, büyük söz, sinema şeritleri, hafif gren', ratio: '9:16', icon: '🔥',
    build: () => ({ dur: 12, layers: [T('mo_day', 0, 12), T('mo_quote', 0.5, 12)], subs: clone(SUB_BASE), fx: { ...clone(FX_BASE), letterbox: 0.1, grain: 0.18, vignette: 0.4 } }) },
  { id: 'gaming', name: 'Oyun highlight', desc: 'Seri öldürme, seviye atlama, zafer ekranı, neon altyazı', ratio: '9:16', icon: '🎮',
    build: () => ({ dur: 20, layers: [T('gm_kill', 3, 6), T('gm_lvl', 9, 12), T('gm_win', 16, 20)], subs: SUBX({ tpl: 'c_gaming', font: 'Russo One', weight: 400, size: 80, accent: '#22C55E', strokeColor: '#052E16', strokeW: 10, mode: 'group', group: 2, hl: 'scale', anim: 'pop', rot: -3 }), fx: { ...clone(FX_BASE), vignette: 0.25 } }) },
  { id: 'beforeafter', name: 'Önce / sonra', desc: 'Önce-sonra etiketleri, dönüşüm vurgusu', ratio: '9:16', icon: '✨',
    build: () => ({ dur: 10, layers: [ST({ text: 'ÖNCE', bg: '#374151', fg: '#fff', shape: 'tag' }, 0, 5, { x: 0.25, y: 0.12, size: 200 }), ST({ text: 'SONRA', bg: '#16A34A', fg: '#fff', shape: 'tag' }, 5, 10, { x: 0.25, y: 0.12, size: 200 }), T('fs_glow', 5, 10, { y: 0.8 })], subs: clone(SUB_BASE), fx: clone(FX_BASE) }) },
  { id: 'top5', name: 'İlk 5 listesi', desc: 'Liste başlığı ve 5 sıra numarası, her biri 5 sn', ratio: '9:16', icon: '🔢',
    build: () => ({ dur: 27, layers: [T('top5', 0, 27, { text: 'EN İYİ *5* …' }), ...[5, 4, 3, 2, 1].map((n, i) => T('number', 2 + i * 5, 6 + i * 5, { text: `#${n}`, y: 0.3 }))], subs: clone(SUB_BASE), fx: { ...clone(FX_BASE), progress: true } }) },
  { id: 'music', name: 'Müzik / şarkı', desc: 'Şimdi çalıyor bandı, ses dalgası, kelime kelime söz', ratio: '9:16', icon: '🎵',
    build: () => ({ dur: 20, layers: [{ id: uid(), kind: 'wave', style: 'mirror', bars: 40, w: 0.84, h: 0.16, color: '#A855F7', color2: '#F472B6', glow: true, x: 0.5, y: 0.62, rot: 0, sc: 1, opacity: 1, start: 0, end: 20, kf: {}, anim: anim('fade', 'fade') }, T('mu_now', 0, 20)], subs: SUBX({ tpl: 'c_neon', font: 'Righteous', weight: 400, size: 82, color: '#F5D0FE', accent: '#FFFFFF', strokeW: 0, glow: 26, glowColor: '#D946EF', mode: 'group', group: 3, hl: 'scale', anim: 'pop' }), fx: { ...clone(FX_BASE), bg: '#0B0710' } }) },
);

// v1.6: herkese hitap — spor şablonları listenin sonuna
['football', 'matchday'].forEach((id) => { const i = PROJECT_TEMPLATES.findIndex((t) => t.id === id); if (i >= 0) PROJECT_TEMPLATES.push(...PROJECT_TEMPLATES.splice(i, 1)); });
