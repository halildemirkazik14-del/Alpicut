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
  ['stamp', 'Damga'], ['elastic', 'Elastik'], ['swingIn', 'Sallanarak'], ['flipX', 'Dikey çevir'], ['flipY', 'Yatay çevir'],
  ['zoomBlur', 'Zoom bulanık'], ['rollIn', 'Yuvarlanarak'], ['glitchWhole', 'Glitch'], ['slideUpMask', 'Alttan kay (kısa)'],
  ['letters', 'Harf harf'], ['wave', 'Harf dalga'], ['drop', 'Harf düşme'], ['scatter', 'Harf dağınık'], ['flip', 'Harf çevirme'],
  ['swing', 'Harf sallanma'], ['glitchin', 'Harf glitch'], ['flicker', 'Neon titreme'], ['rise', 'Harf yükselme'], ['typezoom', 'Harf zoom'], ['spinletters', 'Harf dönme'],
];

export const ANIM_OUT = [
  ['none', 'Yok'], ['fade', 'Kaybol'], ['pop', 'Pop'], ['slideDown', 'Aşağı kay'], ['slideUp', 'Yukarı kay'],
  ['slideLeft', 'Sola kay'], ['slideRight', 'Sağa kay'], ['zoomOut', 'Küçül'], ['zoomIn', 'Büyü'], ['blur', 'Bulanıklaş'],
  ['flipX', 'Çevrilerek'], ['spinOut', 'Dönerek'], ['zoomBlur', 'Zoom bulanık'],
  ['lettersOut', 'Harf harf'], ['scatterOut', 'Harf dağıl'], ['flipOut', 'Harf çevir'], ['dropOut', 'Harf düş'],
];

export const ANIM_LOOP = [
  ['none', 'Yok'], ['pulse', 'Nabız'], ['float', 'Süzül'], ['shake', 'Titre'], ['wiggle', 'Salla'], ['glow', 'Parla'],
  ['heartbeat', 'Kalp atışı'], ['jelly', 'Jöle'], ['flickerLoop', 'Titreşen ışık'], ['spin', 'Sürekli dön'], ['swingLoop', 'Sarkaç'],
  ['wavey', 'Harf dalgası'], ['rainbow', 'Gökkuşağı'], ['jitter', 'Harf titreme'],
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
export const TEXT_TEMPLATES = [ // cat yoksa 'Temel'
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
  // ---- v1.3 ek şablonlar ----
  { id: 'mrbeast', name: 'YouTube Hook', cat: 'Başlık', p: { text: '1 GÜNDE *100 GOL*', font: 'Anton', weight: 400, size: 140, accent: '#FACC15', strokeW: 14, y: 0.25, anim: anim('stamp', 'fade', 'none', 0.4) } },
  { id: 'bebas', name: 'Sinema Başlığı', cat: 'Başlık', p: { text: 'SEZONUN HİKAYESİ', font: 'Bebas Neue', weight: 400, size: 150, spacing: 10, shadowOn: true, shadowBlur: 30, y: 0.45, anim: anim('zoomBlur', 'fade', 'none', 0.9) } },
  { id: 'montBold', name: 'Modern Bold', cat: 'Başlık', p: { text: 'Bunu bilmiyordun', font: 'Montserrat', weight: 800, upper: false, size: 96, y: 0.3, anim: anim('rise', 'fade', 'none', 0.8) } },
  { id: 'popKids', name: 'Çizgi Roman', cat: 'Eğlence', p: { text: 'BOOM!', font: 'Bangers', weight: 400, size: 200, color: '#FACC15', strokeColor: '#111', strokeW: 16, rot: -8, y: 0.35, anim: anim('elastic', 'pop', 'jelly', 0.6) } },
  { id: 'script', name: 'El Yazısı İmza', cat: 'Zarif', p: { text: 'Teşekkürler', font: 'Pacifico', weight: 400, upper: false, size: 120, color: '#ffffff', shadowOn: true, y: 0.5, anim: anim('letters', 'fade', 'none', 1.2) } },
  { id: 'marker', name: 'Keçeli Kalem', cat: 'Eğlence', p: { text: 'BUNA DİKKAT!', font: 'Permanent Marker', weight: 400, size: 100, color: '#ffffff', bgOn: true, bgColor: '#EF4444', bgRadius: 6, bgPad: 24, rot: -3, shadowOn: false, y: 0.2, anim: anim('swingIn', 'fade', 'none', 0.5) } },
  { id: 'elegant', name: 'Zarif Serif', cat: 'Zarif', p: { text: 'Bir efsanenin\n*doğuşu*', font: 'Playfair Display', weight: 700, italic: true, upper: false, size: 96, accent: '#FDE68A', y: 0.45, anim: anim('blur', 'blur', 'none', 1.0) } },
  { id: 'lowerMin', name: 'Minimal Alt Bant', cat: 'Alt bant', p: { text: 'İsim Soyisim\n*Futbol Yorumcusu*', font: 'Montserrat', weight: 700, upper: false, size: 56, align: 'left', accent: '#C4B5FD', bgOn: true, bgMode: 'line', bgColor: '#111111', bgOpacity: 0.8, bgRadius: 4, bgPad: 18, shadowOn: false, x: 0.36, y: 0.82, anim: anim('slideRight', 'slideLeft', 'none', 0.5) } },
  { id: 'lowerNews', name: 'Haber Alt Bant', cat: 'Alt bant', p: { text: 'CANLI · *TRANSFER GÜNDEMİ*', font: 'Oswald', weight: 700, size: 58, accent: '#FACC15', bgOn: true, bgColor: '#B91C1C', bgRadius: 0, bgPad: 22, shadowOn: false, maxW: 1, y: 0.86, anim: anim('slideRight', 'slideLeft', 'none', 0.45) } },
  { id: 'subtitleBox', name: 'Altyazı Kutusu', cat: 'Altyazı', p: { text: 'Konuşmanı buraya yaz', font: 'Poppins', weight: 600, upper: false, size: 62, bgOn: true, bgMode: 'line', bgColor: '#000000', bgOpacity: 0.7, bgRadius: 12, bgPad: 14, shadowOn: false, y: 0.78, anim: anim('fade', 'fade') } },
  { id: 'yellowSub', name: 'Sarı Altyazı', cat: 'Altyazı', p: { text: 'Kelime vurgulu altyazı', font: 'Montserrat', weight: 800, size: 70, color: '#FACC15', strokeW: 9, y: 0.75, anim: anim('wave', 'fade', 'none', 0.6) } },
  { id: 'gradientNeon', name: 'Neon Mavi', cat: 'Neon', p: { text: 'GECE MAÇI', font: 'Righteous', weight: 400, size: 130, color: '#E0F2FE', shadowColor: '#38BDF8', shadowBlur: 45, y: 0.35, anim: anim('flicker', 'fade', 'flickerLoop', 0.9) } },
  { id: 'neonPink', name: 'Neon Pembe', cat: 'Neon', p: { text: 'Open', font: 'Pacifico', weight: 400, upper: false, size: 160, color: '#FCE7F3', shadowColor: '#EC4899', shadowBlur: 50, y: 0.4, anim: anim('flicker', 'fade', 'glow', 1.0) } },
  { id: 'tekoScore', name: 'Dijital Skor', cat: 'Spor', p: { text: '2 - 1', font: 'Teko', weight: 600, size: 240, color: '#ffffff', strokeColor: '#7C3AED', strokeW: 10, y: 0.3, anim: anim('flipX', 'flipX', 'none', 0.4) } },
  { id: 'goalBig', name: 'GOL Patlaması', cat: 'Spor', p: { text: 'GOOOL!', font: 'Anton', weight: 400, size: 230, color: '#FACC15', strokeColor: '#111', strokeW: 18, y: 0.4, anim: anim('stamp', 'zoomBlur', 'heartbeat', 0.35) } },
  { id: 'varCheck', name: 'VAR İnceleme', cat: 'Spor', p: { text: 'VAR İNCELEMESİ', font: 'Russo One', weight: 400, size: 84, bgOn: true, bgColor: '#111827', bgRadius: 10, bgPad: 24, accent: '#60A5FA', shadowOn: false, y: 0.15, anim: anim('glitchWhole', 'fade', 'flickerLoop', 0.6) } },
  { id: 'playerName', name: 'Oyuncu Adı Büyük', cat: 'Spor', p: { text: '*10*\nOYUNCU ADI', font: 'Bebas Neue', weight: 400, size: 150, lineH: 0.9, accent: '#FACC15', strokeW: 0, shadowOn: true, shadowBlur: 25, y: 0.62, anim: anim('rise', 'fade', 'none', 0.7) } },
  { id: 'top5', name: 'İlk 5 Listesi', cat: 'Liste', p: { text: '*5.* EN İYİ FRİKİK GOLLERİ', font: 'Archivo Black', weight: 400, size: 74, accent: '#A78BFA', bgOn: true, bgMode: 'line', bgColor: '#000', bgOpacity: 0.75, bgRadius: 8, bgPad: 16, shadowOn: false, y: 0.14, anim: anim('slideLeft', 'slideLeft', 'none', 0.4) } },
  { id: 'tip', name: 'İpucu Kartı', cat: 'Liste', p: { text: '💡 İPUCU: *Videoyu kaydet*', font: 'Poppins', weight: 700, size: 60, accent: '#FACC15', bgOn: true, bgColor: '#1E1B4B', bgOpacity: 0.92, bgRadius: 24, bgPad: 28, shadowOn: false, y: 0.8, anim: anim('elastic', 'fade', 'float', 0.6) } },
  { id: 'warning', name: 'Uyarı', cat: 'Liste', p: { text: '⚠️ SONUNA KADAR İZLE', font: 'Oswald', weight: 700, size: 70, color: '#111', bgOn: true, bgColor: '#FACC15', bgRadius: 10, bgPad: 20, shadowOn: false, y: 0.12, anim: anim('pop', 'pop', 'pulse', 0.4) } },
  { id: 'quoteCard', name: 'Söz Kartı', cat: 'Zarif', p: { text: '“Başarı tesadüf değildir.”\n*— Pelé*', font: 'Merriweather', weight: 700, upper: false, size: 64, accent: '#C4B5FD', bgOn: true, bgColor: '#0F0B1A', bgOpacity: 0.85, bgRadius: 28, bgPad: 40, shadowOn: false, y: 0.5, anim: anim('blur', 'fade', 'none', 0.8) } },
  { id: 'typingCode', name: 'Terminal', cat: 'Teknoloji', p: { text: '> analiz başlatılıyor...', font: 'Roboto Mono', weight: 700, upper: false, size: 54, color: '#4ADE80', bgOn: true, bgColor: '#000', bgOpacity: 0.85, bgRadius: 10, bgPad: 24, shadowOn: false, align: 'left', y: 0.4, anim: anim('typewriter', 'fade', 'none', 1.6) } },
  { id: 'glitchTitle', name: 'Glitch Başlık', cat: 'Teknoloji', p: { text: 'SİSTEM HATASI', font: 'Russo One', weight: 400, size: 110, color: '#F0ABFC', strokeColor: '#22D3EE', strokeW: 3, y: 0.4, anim: anim('glitchin', 'scatterOut', 'jitter', 0.9) } },
  { id: 'rainbow', name: 'Gökkuşağı', cat: 'Eğlence', p: { text: 'MÜTHİŞ!', font: 'Bangers', weight: 400, size: 180, strokeW: 12, strokeColor: '#111', y: 0.4, anim: anim('drop', 'dropOut', 'rainbow', 0.9) } },
  { id: 'waveText', name: 'Dalgalı', cat: 'Eğlence', p: { text: 'yaz tatili geldi', font: 'Righteous', weight: 400, upper: false, size: 110, color: '#ffffff', strokeColor: '#0EA5E9', strokeW: 8, y: 0.4, anim: anim('wave', 'fade', 'wavey', 0.8) } },
  { id: 'cleanCaption', name: 'Temiz Başlık', cat: 'Başlık', p: { text: 'Hafta sonu özeti', font: 'Inter', weight: 800, upper: false, size: 92, color: '#ffffff', shadowOn: true, shadowBlur: 20, y: 0.15, anim: anim('slideUpMask', 'fade', 'none', 0.5) } },
  { id: 'boxed', name: 'Çerçeveli Başlık', cat: 'Başlık', p: { text: 'MAÇ ÖNÜ', font: 'Oswald', weight: 700, size: 110, color: '#ffffff', bgOn: true, bgColor: 'rgba(0,0,0,0)', bgOpacity: 0, strokeW: 0, spacing: 12, y: 0.3, anim: anim('scatter', 'scatterOut', 'none', 1.0) } },
  { id: 'chapter', name: 'Bölüm Başlığı', cat: 'Liste', p: { text: 'BÖLÜM 2\n*Taktik analiz*', font: 'Bebas Neue', weight: 400, size: 120, accent: '#C4B5FD', lineH: 0.95, y: 0.45, anim: anim('flip', 'flipOut', 'none', 0.9) } },
  { id: 'subscribeText', name: 'Abone Ol Yazısı', cat: 'Sosyal', p: { text: 'ABONE OLMAYI\n*UNUTMA!*', font: 'Anton', weight: 400, size: 110, accent: '#EF4444', strokeW: 10, y: 0.72, anim: anim('elastic', 'pop', 'heartbeat', 0.6) } },
  { id: 'commentAsk', name: 'Yorum Sorusu', cat: 'Sosyal', p: { text: 'SENCE KİM KAZANIR?\n*YORUMLARA YAZ* 👇', font: 'Montserrat', weight: 900, size: 72, accent: '#FACC15', strokeW: 8, y: 0.78, anim: anim('letters', 'fade', 'none', 1.0) } },
  { id: 'followCta', name: 'Takip Et Yazısı', cat: 'Sosyal', p: { text: 'Daha fazlası için\n*takip et* ✨', font: 'Poppins', weight: 800, upper: false, size: 78, accent: '#C084FC', bgOn: true, bgColor: '#000', bgOpacity: 0.55, bgRadius: 30, bgPad: 30, shadowOn: false, y: 0.8, anim: anim('rise', 'fade', 'float', 0.7) } },
  { id: 'aiTag', name: 'Yapay Zekâ Etiketi', cat: 'Teknoloji', p: { text: '🤖 Yapay zekâ ile üretildi', font: 'Inter', weight: 700, upper: false, size: 44, bgOn: true, bgColor: '#000', bgOpacity: 0.55, bgRadius: 40, bgPad: 18, shadowOn: false, y: 0.94, anim: anim('fade', 'fade') } },
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

// ---- v1.4: ek yazı şablonları (toplam 90+) ----
TEXT_TEMPLATES.push(
  { id: 'v_yellowbox', name: 'Sarı Kutu Hook', cat: 'Viral', p: { text: 'BUNU *DENEDİM*', font: 'Anton', weight: 400, size: 120, color: '#111', accent: '#E11D48', bgOn: true, bgColor: '#FACC15', bgRadius: 8, bgPad: 22, shadowOn: false, rot: -2, y: 0.22, anim: anim('stamp', 'fade', 'none', 0.35) } },
  { id: 'v_redbox', name: 'Kırmızı Kutu', cat: 'Viral', p: { text: '$1 VS *$1.000.000*', font: 'Anton', weight: 400, size: 110, color: '#fff', accent: '#FACC15', bgOn: true, bgColor: '#DC2626', bgRadius: 10, bgPad: 22, shadowOn: false, y: 0.2, anim: anim('pop', 'pop', 'none', 0.35) } },
  { id: 'v_whiteout', name: 'Beyaz Kontur', cat: 'Viral', p: { text: 'SON *SANİYEDE*', font: 'Archivo Black', weight: 400, size: 116, color: '#fff', accent: '#22C55E', strokeColor: '#000', strokeW: 16, y: 0.26, anim: anim('zoomBlur', 'fade', 'none', 0.4) } },
  { id: 'v_count', name: 'Gün Sayacı', cat: 'Viral', p: { text: 'GÜN *1*', font: 'Bebas Neue', weight: 400, size: 200, color: '#fff', accent: '#FACC15', strokeColor: '#000', strokeW: 10, y: 0.18, anim: anim('drop', 'fade', 'none', 0.6) } },
  { id: 'v_wait', name: 'Bekle…', cat: 'Viral', p: { text: 'BEKLE… *SONUNU İZLE*', font: 'Montserrat', weight: 900, size: 80, accent: '#FACC15', strokeW: 10, y: 0.8, anim: anim('letters', 'fade', 'pulse', 0.8) } },
  { id: 'v_pov', name: 'POV', cat: 'Viral', p: { text: 'POV: *son dakika golü* geldi', font: 'Poppins', weight: 800, upper: false, size: 74, accent: '#FACC15', bgOn: true, bgMode: 'line', bgColor: '#000', bgOpacity: 0.6, bgRadius: 10, bgPad: 14, shadowOn: false, y: 0.18, anim: anim('typewriter', 'fade', 'none', 1.0) } },
  { id: 'v_emoji', name: 'Emoji Başlık', cat: 'Viral', p: { text: '😱 BUNA İNANAMAYACAKSIN 😱', font: 'Montserrat', weight: 900, size: 70, strokeW: 8, y: 0.2, anim: anim('bounce', 'fade', 'none', 0.5) } },
  { id: 'v_part', name: 'Bölüm 1', cat: 'Viral', p: { text: 'PART *1*', font: 'Anton', weight: 400, size: 110, accent: '#EF4444', bgOn: true, bgColor: '#000', bgOpacity: 0.7, bgRadius: 14, bgPad: 20, shadowOn: false, y: 0.1, anim: anim('slideDown', 'slideUp', 'none', 0.4) } },
  { id: 'p_karaoke', name: 'Karaoke Altyazı', cat: 'Altyazı', p: { text: 'her kelime *ayrı ayrı* parlar', font: 'Montserrat', weight: 900, size: 76, color: '#fff', accent: '#22D3EE', strokeW: 10, y: 0.72, anim: anim('words', 'fade', 'none', 1.0) } },
  { id: 'p_hormozi', name: 'Büyük Vurgulu Altyazı', cat: 'Altyazı', p: { text: 'BU *ÇOK* ÖNEMLİ', font: 'Anton', weight: 400, size: 110, color: '#fff', accent: '#FACC15', strokeColor: '#000', strokeW: 14, y: 0.66, anim: anim('pop', 'fade', 'none', 0.25) } },
  { id: 'p_pill', name: 'Hap Altyazı', cat: 'Altyazı', p: { text: 'Sade ve okunaklı', font: 'Inter', weight: 700, upper: false, size: 58, color: '#111', bgOn: true, bgColor: '#FFFFFF', bgRadius: 40, bgPad: 18, shadowOn: false, y: 0.78, anim: anim('rise', 'fade', 'none', 0.4) } },
  { id: 'p_podcast', name: 'Podcast Altyazı', cat: 'Altyazı', p: { text: 'konuşma *burada* görünür', font: 'Barlow Semi Condensed', weight: 700, upper: false, size: 74, accent: '#A78BFA', strokeW: 6, y: 0.7, anim: anim('letters', 'fade', 'none', 0.6) } },
  { id: 'k_stack', name: 'Üst Üste Kelimeler', cat: 'Kinetik', p: { text: 'HIZLI\n*GÜÇLÜ*\nKESİN', font: 'Anton', weight: 400, size: 150, lineH: 0.88, accent: '#FACC15', strokeW: 0, y: 0.45, anim: anim('rise', 'scatterOut', 'none', 0.9) } },
  { id: 'k_spin', name: 'Dönen Harfler', cat: 'Kinetik', p: { text: 'EFSANE', font: 'Russo One', weight: 400, size: 150, color: '#fff', strokeColor: '#8B5CF6', strokeW: 8, y: 0.4, anim: anim('spinletters', 'flipOut', 'none', 1.0) } },
  { id: 'k_typezoom', name: 'Zoomlu Harf', cat: 'Kinetik', p: { text: 'ŞİMDİ İZLE', font: 'Oswald', weight: 700, size: 130, color: '#fff', accent: '#F43F5E', y: 0.4, anim: anim('typezoom', 'fade', 'none', 0.8) } },
  { id: 'k_swing', name: 'Sallanan', cat: 'Kinetik', p: { text: 'HAYDİ!', font: 'Bangers', weight: 400, size: 190, color: '#FACC15', strokeColor: '#111', strokeW: 14, y: 0.4, anim: anim('swing', 'dropOut', 'swingLoop', 0.8) } },
  { id: 'k_jitter', name: 'Titreyen', cat: 'Kinetik', p: { text: 'KORKUTUCU', font: 'Russo One', weight: 400, size: 120, color: '#fff', strokeColor: '#DC2626', strokeW: 4, y: 0.4, anim: anim('glitchin', 'fade', 'jitter', 0.6) } },
  { id: 's_derby', name: 'Derbi Başlığı', cat: 'Spor', p: { text: 'DERBİ\n*GÜNÜ*', font: 'Bebas Neue', weight: 400, size: 190, lineH: 0.85, accent: '#E11D48', strokeW: 0, shadowBlur: 30, y: 0.4, anim: anim('zoomBlur', 'fade', 'none', 0.6) } },
  { id: 's_transfer', name: 'Transfer Bombası', cat: 'Spor', p: { text: '💣 TRANSFER *BOMBASI*', font: 'Oswald', weight: 700, size: 84, accent: '#FACC15', bgOn: true, bgColor: '#111', bgOpacity: 0.85, bgRadius: 12, bgPad: 20, shadowOn: false, y: 0.15, anim: anim('glitchWhole', 'fade', 'none', 0.5) } },
  { id: 's_redcard', name: 'Kırmızı Kart', cat: 'Spor', p: { text: '🟥 KIRMIZI KART', font: 'Anton', weight: 400, size: 110, color: '#fff', bgOn: true, bgColor: '#B91C1C', bgRadius: 10, bgPad: 22, shadowOn: false, y: 0.2, anim: anim('stamp', 'fade', 'heartbeat', 0.35) } },
  { id: 's_offside', name: 'Ofsayt', cat: 'Spor', p: { text: 'OFSAYT? *HAYIR!*', font: 'Archivo Black', weight: 400, size: 96, accent: '#22C55E', strokeW: 10, y: 0.3, anim: anim('words', 'fade', 'none', 0.8) } },
  { id: 's_minute', name: 'Dakika Etiketi', cat: 'Spor', p: { text: "90+4'", font: 'Teko', weight: 600, size: 150, color: '#fff', bgOn: true, bgColor: '#16A34A', bgRadius: 16, bgPad: 18, shadowOn: false, y: 0.12, anim: anim('flipX', 'flipX', 'none', 0.4) } },
  { id: 's_mvp', name: 'Maçın Adamı', cat: 'Spor', p: { text: 'MAÇIN *ADAMI*', font: 'Bebas Neue', weight: 400, size: 140, accent: '#FACC15', spacing: 6, strokeW: 0, shadowBlur: 30, y: 0.3, anim: anim('rise', 'fade', 'glow', 0.8) } },
  { id: 'a_future', name: 'Gelecek', cat: 'Teknoloji', p: { text: 'GELECEK *BURADA*', font: 'Russo One', weight: 400, size: 104, color: '#E0F2FE', accent: '#22D3EE', shadowColor: '#0EA5E9', shadowBlur: 40, y: 0.35, anim: anim('flicker', 'fade', 'glow', 0.9) } },
  { id: 'a_prompt', name: 'Prompt Kutusu', cat: 'Teknoloji', p: { text: 'prompt: "*sinematik futbol sahnesi*"', font: 'Roboto Mono', weight: 700, upper: false, size: 46, color: '#E5E7EB', accent: '#A78BFA', bgOn: true, bgColor: '#0B0B12', bgOpacity: 0.9, bgRadius: 16, bgPad: 26, shadowOn: false, y: 0.75, anim: anim('typewriter', 'fade', 'none', 1.4) } },
  { id: 'a_made', name: 'AI Rozeti', cat: 'Teknoloji', p: { text: '✦ AI', font: 'Inter', weight: 800, size: 54, color: '#fff', bgOn: true, bgColor: '#7C3AED', bgRadius: 30, bgPad: 16, shadowOn: false, x: 0.86, y: 0.06, anim: anim('pop', 'fade', 'float', 0.4) } },
  { id: 'a_matrix', name: 'Matrix', cat: 'Teknoloji', p: { text: 'SİMÜLASYON', font: 'Roboto Mono', weight: 700, size: 96, color: '#4ADE80', shadowColor: '#22C55E', shadowBlur: 30, y: 0.4, anim: anim('glitchin', 'scatterOut', 'flickerLoop', 1.0) } },
  { id: 'g_gold', name: 'Altın Lüks', cat: 'Lüks', p: { text: 'PREMIUM', font: 'Playfair Display', weight: 700, size: 130, spacing: 10, color: '#F3DFA2', shadowColor: '#B8860B', shadowBlur: 30, y: 0.4, anim: anim('blur', 'blur', 'glow', 1.0) } },
  { id: 'g_gold2', name: 'Altın Çizgi', cat: 'Lüks', p: { text: 'koleksiyon\n*2026*', font: 'Playfair Display', weight: 700, italic: true, upper: false, size: 110, color: '#fff', accent: '#D4AF37', y: 0.45, anim: anim('rise', 'fade', 'none', 1.0) } },
  { id: 'g_minimal', name: 'Minimal Beyaz', cat: 'Minimal', p: { text: 'daha az, daha iyi', font: 'Inter', weight: 300, upper: false, size: 86, spacing: 2, shadowOn: false, y: 0.5, anim: anim('fade', 'fade', 'none', 1.0) } },
  { id: 'g_minimal2', name: 'Minimal Etiket', cat: 'Minimal', p: { text: 'BÖLÜM 01', font: 'Inter', weight: 600, size: 40, spacing: 12, shadowOn: false, y: 0.1, anim: anim('slideUpMask', 'fade', 'none', 0.6) } },
  { id: 'g_thin', name: 'İnce Büyük', cat: 'Minimal', p: { text: 'SESSİZLİK', font: 'Oswald', weight: 300, size: 170, spacing: 14, shadowOn: false, y: 0.45, anim: anim('scatter', 'scatterOut', 'none', 1.2) } },
  { id: 'r_80s', name: '80\'ler', cat: 'Retro', p: { text: 'RETRO *GECE*', font: 'Righteous', weight: 400, size: 120, color: '#FDE68A', accent: '#F472B6', strokeColor: '#7C3AED', strokeW: 6, shadowColor: '#EC4899', shadowBlur: 35, y: 0.35, anim: anim('zoomOut', 'fade', 'rainbow', 0.6) } },
  { id: 'r_vhs', name: 'VHS Tarih', cat: 'Retro', p: { text: 'PLAY ▶ 12.07.1998', font: 'Roboto Mono', weight: 700, size: 52, color: '#fff', shadowColor: '#22D3EE', shadowBlur: 10, align: 'left', x: 0.36, y: 0.08, anim: anim('flicker', 'fade', 'flickerLoop', 0.5) } },
  { id: 'n_ig', name: 'Hikâye Sorusu', cat: 'Sosyal', p: { text: 'BANA BİR\n*SORU SOR*', font: 'Montserrat', weight: 900, size: 84, color: '#111', accent: '#8B5CF6', bgOn: true, bgColor: '#FFFFFF', bgRadius: 30, bgPad: 34, shadowOn: false, y: 0.4, anim: anim('elastic', 'pop', 'none', 0.6) } },
  { id: 'n_like', name: 'Beğen Yazısı', cat: 'Sosyal', p: { text: '❤️ BEĞENMEYİ UNUTMA', font: 'Montserrat', weight: 900, size: 64, color: '#fff', bgOn: true, bgColor: '#E11D48', bgRadius: 40, bgPad: 22, shadowOn: false, y: 0.86, anim: anim('pop', 'pop', 'heartbeat', 0.4) } },
  { id: 'n_link', name: 'Link Açıklamada', cat: 'Sosyal', p: { text: '🔗 LİNK AÇIKLAMADA', font: 'Oswald', weight: 700, size: 64, color: '#111', bgOn: true, bgColor: '#FACC15', bgRadius: 14, bgPad: 20, shadowOn: false, y: 0.88, anim: anim('slideUp', 'slideDown', 'pulse', 0.4) } },
  { id: 'n_save', name: 'Kaydet', cat: 'Sosyal', p: { text: '📌 KAYDET, SONRA LAZIM OLUR', font: 'Montserrat', weight: 900, size: 58, color: '#fff', strokeW: 8, y: 0.88, anim: anim('rise', 'fade', 'float', 0.5) } },
  { id: 'l_num1', name: 'Numara 1', cat: 'Liste', p: { text: '*1.*  En hızlı gol', font: 'Montserrat', weight: 800, upper: false, size: 72, accent: '#FACC15', align: 'left', bgOn: true, bgMode: 'line', bgColor: '#000', bgOpacity: 0.7, bgRadius: 10, bgPad: 16, shadowOn: false, x: 0.42, y: 0.3, anim: anim('slideRight', 'slideLeft', 'none', 0.4) } },
  { id: 'l_check', name: 'Onay Listesi', cat: 'Liste', p: { text: '✅ Hızlı\n✅ Ücretsiz\n✅ Kolay', font: 'Poppins', weight: 700, upper: false, size: 70, align: 'left', lineH: 1.3, x: 0.4, y: 0.5, anim: anim('letters', 'fade', 'none', 1.2) } },
);
