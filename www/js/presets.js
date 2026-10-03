// Alpicut — hazır ayarlar: fontlar, animasyonlar, geçişler, filtreler, şablonlar

export const RATIOS = {
  '9:16': [1080, 1920],
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '16:9': [1920, 1080],
};

export const FONTS = [
  ['Barlow Condensed', 'Barlow Condensed'],
  ['Barlow Semi Condensed', 'Barlow Semi Condensed'],
  ['Barlow', 'Barlow'],
];

export const WEIGHTS = [
  [400, 'Normal'], [500, 'Orta'], [600, 'Yarı kalın'], [700, 'Kalın'], [800, 'Ekstra kalın'], [900, 'Siyah'],
];

export const ANIM_IN = [
  ['none', 'Yok'], ['fade', 'Belir'], ['pop', 'Pop'], ['slideUp', 'Aşağıdan gel'], ['slideDown', 'Yukarıdan gel'],
  ['slideLeft', 'Sağdan gel'], ['slideRight', 'Soldan gel'], ['zoomIn', 'Büyüyerek'], ['zoomOut', 'Küçülerek'],
  ['spin', 'Dönerek'], ['bounce', 'Zıplayarak'], ['blur', 'Bulanıktan'], ['typewriter', 'Daktilo'], ['words', 'Kelime kelime'],
];

export const ANIM_OUT = [
  ['none', 'Yok'], ['fade', 'Kaybol'], ['pop', 'Pop'], ['slideDown', 'Aşağı kay'], ['slideUp', 'Yukarı kay'],
  ['slideLeft', 'Sola kay'], ['slideRight', 'Sağa kay'], ['zoomOut', 'Küçül'], ['zoomIn', 'Büyü'], ['blur', 'Bulanıklaş'],
];

export const ANIM_LOOP = [
  ['none', 'Yok'], ['pulse', 'Nabız'], ['float', 'Süzül'], ['shake', 'Titre'], ['wiggle', 'Salla'], ['glow', 'Parla'],
];

export const TRANSITIONS = [
  ['none', 'Yok'], ['fade', 'Çapraz geçiş'], ['black', 'Siyaha geçiş'], ['flash', 'Beyaz flaş'],
  ['slideLeft', 'Sola kaydır'], ['slideUp', 'Yukarı kaydır'], ['zoom', 'Zoom'], ['wipe', 'Silme'],
  ['blur', 'Bulanık'], ['spin', 'Döndür'], ['glitch', 'Glitch'],
];

export const DEFAULT_FILTERS = { brightness: 1, contrast: 1, saturate: 1, grayscale: 0, sepia: 0, hue: 0, blur: 0 };

export const FILTER_PRESETS = [
  ['none', 'Orijinal', {}],
  ['cinema', 'Sinematik', { contrast: 1.15, saturate: 0.82, brightness: 0.95 }],
  ['vivid', 'Canlı', { contrast: 1.1, saturate: 1.45 }],
  ['drama', 'Dramatik', { contrast: 1.35, saturate: 1.1, brightness: 0.9 }],
  ['warm', 'Sıcak', { sepia: 0.25, saturate: 1.2, brightness: 1.03 }],
  ['cold', 'Soğuk', { hue: -14, saturate: 0.9, contrast: 1.05 }],
  ['fade', 'Soluk', { contrast: 0.85, brightness: 1.08, saturate: 0.75 }],
  ['retro', 'Retro', { sepia: 0.45, contrast: 1.1, saturate: 0.9 }],
  ['bw', 'Siyah-Beyaz', { grayscale: 1, contrast: 1.2 }],
  ['purple', 'Mor Gece', { hue: 18, saturate: 1.2, contrast: 1.12, brightness: 0.95 }],
];

export function filterString(f, blurScale = 1) {
  if (!f) return 'none';
  const p = [];
  if (f.brightness != null && f.brightness !== 1) p.push(`brightness(${f.brightness})`);
  if (f.contrast != null && f.contrast !== 1) p.push(`contrast(${f.contrast})`);
  if (f.saturate != null && f.saturate !== 1) p.push(`saturate(${f.saturate})`);
  if (f.grayscale) p.push(`grayscale(${f.grayscale})`);
  if (f.sepia) p.push(`sepia(${f.sepia})`);
  if (f.hue) p.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur) p.push(`blur(${(f.blur * blurScale).toFixed(1)}px)`);
  return p.length ? p.join(' ') : 'none';
}

// Ortak animasyon varsayılanı
export const anim = (inn = 'fade', out = 'fade', loop = 'none', inDur = 0.45, outDur = 0.35) => ({ in: inn, out, loop, inDur, outDur });

export const TEXT_BASE = {
  kind: 'text', text: 'Yazınızı girin', font: 'Barlow Condensed', weight: 800, size: 96, italic: false,
  color: '#FFFFFF', accent: '#C084FC', upper: true, align: 'center', maxW: 0.86, spacing: 0, lineH: 1.08,
  strokeColor: '#000000', strokeW: 0, shadowOn: true, shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: 18,
  bgOn: false, bgMode: 'block', bgColor: '#7C3AED', bgOpacity: 1, bgPad: 24, bgRadius: 18,
  x: 0.5, y: 0.5, rot: 0, opacity: 1, anim: anim('pop', 'fade'),
};

// *yıldız* arasındaki kelimeler vurgu rengini alır
export const TEXT_TEMPLATES = [
  { id: 'hook', name: 'Hook Başlık', p: { text: 'BUNU KİMSE\n*BEKLEMİYORDU*', weight: 900, size: 124, accent: '#FACC15', strokeW: 12, y: 0.27, anim: anim('pop', 'fade', 'none', 0.5) } },
  { id: 'kinetic', name: 'Kinetik', p: { text: 'MAÇIN *KIRILMA* ANI', weight: 900, size: 110, accent: '#C084FC', strokeW: 10, y: 0.3, anim: anim('words', 'fade', 'none', 0.9) } },
  { id: 'breaking', name: 'Son Dakika', p: { text: 'SON DAKİKA', weight: 800, size: 78, bgOn: true, bgColor: '#E11D48', bgRadius: 10, bgPad: 20, shadowOn: false, y: 0.16, anim: anim('slideLeft', 'slideLeft', 'pulse', 0.4) } },
  { id: 'lower', name: 'Alt Bant', p: { text: 'İSİM SOYİSİM\n*Spor Yorumcusu*', font: 'Barlow Semi Condensed', weight: 700, size: 60, upper: false, accent: '#E9D5FF', bgOn: true, bgColor: '#6D28D9', bgOpacity: 0.92, bgRadius: 14, bgPad: 26, shadowOn: false, y: 0.8, anim: anim('slideRight', 'slideLeft') } },
  { id: 'stat', name: 'İstatistik', p: { text: '*%87*\nTOPA SAHİP OLMA', weight: 900, size: 92, accent: '#A78BFA', lineH: 1.0, strokeW: 8, y: 0.4, anim: anim('zoomIn', 'fade', 'none', 0.5) } },
  { id: 'label', name: 'Etiket', p: { text: 'TRANSFER', font: 'Barlow Condensed', weight: 800, size: 56, spacing: 4, bgOn: true, bgColor: '#FACC15', color: '#111111', bgRadius: 40, bgPad: 18, shadowOn: false, y: 0.12, anim: anim('pop', 'pop', 'float') } },
  { id: 'quote', name: 'Alıntı', p: { text: '“Futbol bir\n*hata oyunudur*”', font: 'Barlow Semi Condensed', weight: 600, italic: true, upper: false, size: 82, accent: '#C4B5FD', y: 0.45, anim: anim('blur', 'fade', 'none', 0.7) } },
  { id: 'typewriter', name: 'Daktilo', p: { text: 'Peki sonra ne oldu?', font: 'Barlow', weight: 600, upper: false, size: 72, bgOn: true, bgColor: '#000000', bgOpacity: 0.7, bgRadius: 12, shadowOn: false, y: 0.7, anim: anim('typewriter', 'fade', 'none', 1.2) } },
  { id: 'neon', name: 'Neon', p: { text: 'GOOOL!', weight: 900, size: 160, color: '#F5D0FE', shadowColor: '#D946EF', shadowBlur: 40, italic: true, y: 0.35, anim: anim('zoomOut', 'fade', 'glow', 0.4) } },
  { id: 'outline', name: 'Çerçeve', p: { text: 'VAR KARARI', weight: 900, size: 130, color: 'rgba(0,0,0,0)', strokeColor: '#FFFFFF', strokeW: 6, shadowOn: false, y: 0.3, anim: anim('slideUp', 'slideDown') } },
  { id: 'question', name: 'Soru', p: { text: 'SİZCE *PENALTI MI?*', weight: 800, size: 88, accent: '#FACC15', bgOn: true, bgMode: 'line', bgColor: '#000000', bgOpacity: 0.75, bgRadius: 10, bgPad: 16, shadowOn: false, y: 0.75, anim: anim('bounce', 'fade', 'none', 0.6) } },
  { id: 'player', name: 'Oyuncu Etiketi', p: { text: '*10* OYUNCU ADI', font: 'Barlow Condensed', weight: 800, size: 64, accent: '#FACC15', bgOn: true, bgColor: '#111111', bgOpacity: 0.85, bgRadius: 12, bgPad: 18, shadowOn: false, y: 0.45, anim: anim('pop', 'fade', 'none', 0.35) } },
  { id: 'yellowWhite', name: 'Sarı-Beyaz Vurgu', p: { text: 'BU *POZİSYON* GOL MÜ?', weight: 900, size: 100, accent: '#FACC15', strokeW: 10, y: 0.3, anim: anim('words', 'fade', 'none', 0.8) } },
  { id: 'number', name: 'Sayaç', p: { text: '#3', weight: 900, size: 220, color: '#FFFFFF', accent: '#C084FC', strokeColor: '#7C3AED', strokeW: 14, y: 0.3, anim: anim('spin', 'zoomIn', 'none', 0.5) } },
];

export const CTA_BASE = {
  kind: 'cta', icon: 'bell', label: 'ABONE OL', doneLabel: 'ABONE OLUNDU', style: 'pill', color: '#E53935',
  textColor: '#FFFFFF', scale: 1, tap: true, x: 0.5, y: 0.82, rot: 0, opacity: 1, anim: anim('pop', 'pop', 'none', 0.45),
};

export const CTA_PRESETS = [
  { id: 'subscribe', name: 'Abone Ol', p: { icon: 'bell', label: 'ABONE OL', doneLabel: 'ABONE OLUNDU', color: '#E53935' } },
  { id: 'like', name: 'Beğen', p: { icon: 'thumb', label: 'BEĞEN', doneLabel: 'BEĞENİLDİ', color: '#2563EB' } },
  { id: 'follow', name: 'Takip Et', p: { icon: 'userPlus', label: 'TAKİP ET', doneLabel: 'TAKİPTESİN', color: '#8B5CF6' } },
  { id: 'comment', name: 'Yorum Yap', p: { icon: 'bubble', label: 'YORUMLARA YAZ', doneLabel: '', color: '#059669', tap: false, anim: anim('slideUp', 'fade', 'float') } },
  { id: 'share', name: 'Paylaş', p: { icon: 'share', label: 'PAYLAŞ', doneLabel: 'PAYLAŞILDI', color: '#F59E0B', textColor: '#111111' } },
  { id: 'save', name: 'Kaydet', p: { icon: 'bookmark', label: 'KAYDET', doneLabel: 'KAYDEDİLDİ', color: '#0EA5E9' } },
  { id: 'heart', name: 'Kalp', p: { icon: 'heart', label: '', doneLabel: '', style: 'round', color: '#EC4899', anim: anim('pop', 'pop', 'pulse') } },
  { id: 'bellRound', name: 'Zil', p: { icon: 'bell', label: '', doneLabel: '', style: 'round', color: '#7C3AED', anim: anim('pop', 'pop', 'wiggle') } },
  { id: 'handle', name: 'Kullanıcı Adı', p: { icon: 'at', label: '@kullaniciadi', doneLabel: '', style: 'glass', color: '#FFFFFF', tap: false, anim: anim('slideUp', 'fade') } },
  { id: 'link', name: 'Link Açıklamada', p: { icon: 'link', label: 'LİNK AÇIKLAMADA', doneLabel: '', style: 'outline', color: '#C084FC', tap: false, anim: anim('fade', 'fade', 'pulse') } },
  { id: 'watch', name: 'Videoyu İzle', p: { icon: 'play', label: 'TAMAMINI İZLE', doneLabel: '', color: '#7C3AED', tap: true } },
];

export const SCORE_BASE = {
  kind: 'score', teamA: 'TAKIM A', teamB: 'TAKIM B', scoreA: '2', scoreB: '1', info: "90+2' • MAÇ SONU",
  colorA: '#F59E0B', colorB: '#3B82F6', cardColor: '#140E22', accent: '#8B5CF6', scale: 1,
  x: 0.5, y: 0.1, rot: 0, opacity: 1, anim: anim('slideDown', 'slideUp', 'none', 0.5),
};

export const SUB_PRESETS = [
  ['karaoke', 'Kelime vurgulu'],
  ['pop', 'Pop (3 kelime)'],
  ['single', 'Tek kelime'],
  ['classic', 'Klasik'],
  ['box', 'Kutu'],
];

export const SUB_BASE = {
  cues: [], offset: 0, burn: true,
  style: {
    preset: 'karaoke', font: 'Barlow Condensed', weight: 800, size: 84, color: '#FFFFFF', accent: '#C084FC',
    strokeColor: '#000000', strokeW: 10, upper: true, y: 0.72, maxW: 0.84, boxColor: '#000000',
  },
};

export const FX_BASE = { vignette: 0, grain: 0, letterbox: 0, progress: false, progressColor: '#A855F7', bg: '#000000' };

export const SHAPE_BASE = {
  kind: 'shape', shape: 'rect', w: 0.5, h: 0.3, color: '#FFFFFF', strokeW: 10, radius: 20, glow: 0,
  fillOn: false, fillColor: '#000000', fillOpacity: 0.5, inset: 0.03,
  x: 0.5, y: 0.5, rot: 0, opacity: 1, anim: anim('pop', 'fade'),
};

export const SHAPE_PRESETS = [
  { id: 'arrow', name: 'Ok', p: { shape: 'arrow', w: 0.35, color: '#FACC15', strokeW: 14, rot: 30 } },
  { id: 'circle', name: 'Çember', p: { shape: 'circle', w: 0.3, h: 0.3, color: '#FACC15', strokeW: 10 } },
  { id: 'line', name: 'Çizgi', p: { shape: 'line', w: 0.6, color: '#FFFFFF', strokeW: 10 } },
  { id: 'box', name: 'Kutu', p: { shape: 'rect', w: 0.6, h: 0.3, color: '#FFFFFF', strokeW: 8, radius: 24 } },
  { id: 'neonCircle', name: 'Neon çember', p: { shape: 'circle', w: 0.28, h: 0.28, color: '#E879F9', strokeW: 9, glow: 40, anim: anim('pop', 'fade', 'pulse') } },
  { id: 'neonFrame', name: 'Neon mavi çerçeve', p: { shape: 'frame', color: '#38BDF8', strokeW: 12, glow: 45, radius: 40, inset: 0.025, anim: anim('fade', 'fade', 'glow') } },
  { id: 'neonPurple', name: 'Neon mor çerçeve', p: { shape: 'frame', color: '#A855F7', strokeW: 12, glow: 45, radius: 40, inset: 0.025, anim: anim('fade', 'fade', 'glow') } },
  { id: 'spot', name: 'Spot kutu', p: { shape: 'rect', w: 0.5, h: 0.5, color: '#FACC15', strokeW: 6, radius: 16, fillOn: true, fillColor: '#FACC15', fillOpacity: 0.15 } },
];
