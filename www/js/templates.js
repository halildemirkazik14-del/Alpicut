// Alpicut — proje şablonları ("Şablondan başla")
import { clone, uid } from './state.js';
import { TEXT_BASE, TEXT_TEMPLATES, CTA_BASE, CTA_PRESETS, SCORE_BASE, SUB_BASE, FX_BASE, SHAPE_BASE, SHAPE_PRESETS, anim } from './presets.js';

const T = (id, start, end, extra = {}) => ({ ...clone(TEXT_BASE), ...clone(TEXT_TEMPLATES.find((x) => x.id === id).p), ...extra, id: uid(), kind: 'text', start, end, sc: 1, kf: {} });
const C = (id, start, end, extra = {}) => ({ ...clone(CTA_BASE), ...clone(CTA_PRESETS.find((x) => x.id === id).p), ...extra, id: uid(), kind: 'cta', start, end, sc: 1, kf: {} });
const SH = (id, start, end, extra = {}) => ({ ...clone(SHAPE_BASE), ...clone(SHAPE_PRESETS.find((x) => x.id === id).p), ...extra, id: uid(), kind: 'shape', start, end, sc: 1, kf: {} });

export const PROJECT_TEMPLATES = [
  { id: 'football', name: 'Futbol yorum Shorts', desc: 'Hook başlık, skor kartı, neon çerçeve, kelime vurgulu altyazı, abone çağrısı', ratio: '9:16', icon: '⚽',
    build: () => ({ dur: 30, layers: [
      SH('neonFrame', 0, 30),
      { ...clone(SCORE_BASE), id: uid(), start: 0.3, end: 6, sc: 1, kf: {} },
      T('hook', 0, 3, { text: 'BU POZİSYON\n*PENALTI MI?*' }),
      T('playerName', 6, 10),
      C('subscribe', 25, 29),
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), preset: 'karaoke', accent: '#FACC15' } }, fx: { ...clone(FX_BASE), progress: true } }) },
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
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), preset: 'pop', y: 0.8 } }, fx: { ...clone(FX_BASE), bg: '#0E0A17' } }) },
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
    ], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), preset: 'box', upper: false, font: 'Poppins', weight: 600 } }, fx: clone(FX_BASE) }) },
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
    build: () => ({ dur: 30, layers: [SO('lower', 1, 6), C('subscribe', 25, 29)], subs: { ...clone(SUB_BASE), style: { ...clone(SUB_BASE.style), preset: 'karaoke', accent: '#FACC15' } }, fx: clone(FX_BASE) }) },
);
