// Alpicut — filtre kütüphanesi: 160+ hazır görünüm (CSS filtre + renk düzenleme + LUT birleşimi), canlı küçük önizleme, favoriler
import { app, h, toast, uid } from './state.js';
import { DEFAULT_FILTERS, filterString, anim } from './presets.js';
import { COLOR_BASE, BUILTIN_LUTS } from './gl.js';
import { star, favIds, registerFav } from './favs.js';

// [id, ad, kategori, css filtre, renk (gl), lut]
const C = (o) => o; // okunabilirlik
export const FILTERS = [
  ['none', 'Orijinal', 'Temel', {}, {}],
  // Sinematik
  ['tealorange', 'Teal & Orange', 'Sinematik', { contrast: 1.08 }, C({ temp: 0.1, shadows: -0.05 }), 'b:tealorange'],
  ['blockbuster', 'Gişe filmi', 'Sinematik', { contrast: 1.18, saturate: 0.9 }, C({ temp: 0.15, tint: -0.05, highlights: -0.1 }), 'b:tealorange'],
  ['noir', 'Kara film', 'Sinematik', { grayscale: 1, contrast: 1.45, brightness: 0.92 }, {}],
  ['moody', 'Karamsar', 'Sinematik', { contrast: 1.12, saturate: 0.7, brightness: 0.9 }, C({ temp: -0.15, shadows: -0.1 })],
  ['bleach', 'Bleach bypass', 'Sinematik', {}, {}, 'b:bleach'],
  ['matte', 'Mat film', 'Sinematik', { contrast: 0.88, saturate: 0.85, brightness: 1.04 }, C({ shadows: 0.15 })],
  ['dune', 'Çöl', 'Sinematik', { sepia: 0.25, contrast: 1.1, saturate: 1.05 }, C({ temp: 0.35 })],
  ['matrix', 'Matrix yeşili', 'Sinematik', { contrast: 1.15, saturate: 0.8 }, C({ tint: -0.45, temp: -0.1 })],
  ['scifi', 'Bilim kurgu', 'Sinematik', { contrast: 1.12, saturate: 0.85 }, C({ temp: -0.4, tint: 0.1 })],
  ['epic', 'Epik', 'Sinematik', { contrast: 1.25, saturate: 1.1, brightness: 0.95 }, C({ vib: 0.2, highlights: -0.15 })],
  // Spor
  ['stadium', 'Stadyum canlı', 'Spor', { contrast: 1.08 }, C({ vib: 0.3 }), 'b:stadium'],
  ['pitch', 'Yeşil saha', 'Spor', { saturate: 1.25, contrast: 1.08 }, C({ tint: -0.12, vib: 0.25 })],
  ['nightmatch', 'Gece maçı', 'Spor', { contrast: 1.18, brightness: 1.03 }, C({ temp: -0.12, highlights: 0.1, vib: 0.2 })],
  ['broadcast', 'TV yayını', 'Spor', { contrast: 1.06, saturate: 1.15 }, C({ sharp: 0.3 })],
  ['highlight', 'Özet anı', 'Spor', { contrast: 1.3, saturate: 1.3, brightness: 0.95 }, C({ vib: 0.2 })],
  ['champion', 'Şampiyon (altın)', 'Spor', { saturate: 1.15, contrast: 1.12 }, C({ temp: 0.4, highlights: 0.08 })],
  // Canlı
  ['vivid', 'Canlı', 'Canlı', { contrast: 1.1, saturate: 1.45 }, {}],
  ['pop', 'Pop', 'Canlı', { contrast: 1.15, saturate: 1.7, brightness: 1.03 }, {}],
  ['punchy', 'Sert', 'Canlı', { contrast: 1.35, saturate: 1.25 }, {}],
  ['summer', 'Yaz', 'Canlı', { saturate: 1.3, brightness: 1.06 }, C({ temp: 0.25 })],
  ['tropic', 'Tropik', 'Canlı', { saturate: 1.4, hue: -8 }, C({ temp: 0.1, tint: -0.1 })],
  ['candy', 'Şeker', 'Canlı', { saturate: 1.35, brightness: 1.08, contrast: 0.95 }, C({ tint: 0.2 })],
  ['cyber', 'Cyberpunk', 'Canlı', { contrast: 1.2, saturate: 1.4, hue: 20 }, C({ tint: 0.3, temp: -0.2 })],
  ['neonnight', 'Neon gece', 'Canlı', { contrast: 1.25, saturate: 1.5, brightness: 0.92 }, C({ temp: -0.3, tint: 0.25 })],
  // Sıcak / soğuk
  ['warm', 'Sıcak', 'Sıcak & soğuk', { sepia: 0.2, saturate: 1.15, brightness: 1.03 }, C({ temp: 0.2 })],
  ['golden', 'Altın saat', 'Sıcak & soğuk', { saturate: 1.2, brightness: 1.05 }, C({ temp: 0.45, highlights: 0.05 })],
  ['sunset', 'Gün batımı', 'Sıcak & soğuk', { saturate: 1.3, contrast: 1.08 }, C({ temp: 0.5, tint: 0.15 })],
  ['autumn', 'Sonbahar', 'Sıcak & soğuk', { sepia: 0.2, saturate: 1.1, contrast: 1.05 }, C({ temp: 0.3, tint: 0.05 })],
  ['cold', 'Soğuk', 'Sıcak & soğuk', { saturate: 0.9, contrast: 1.05 }, C({ temp: -0.35 })],
  ['winter', 'Kış', 'Sıcak & soğuk', { saturate: 0.75, brightness: 1.08 }, C({ temp: -0.45, highlights: 0.1 })],
  ['arctic', 'Kutup', 'Sıcak & soğuk', { saturate: 0.6, brightness: 1.1, contrast: 1.05 }, C({ temp: -0.6 })],
  ['ocean', 'Okyanus', 'Sıcak & soğuk', { saturate: 1.15 }, C({ temp: -0.3, tint: -0.1 })],
  // Retro
  ['retro', 'Retro', 'Retro', { sepia: 0.45, contrast: 1.1, saturate: 0.9 }, {}],
  ['vintage', 'Vintage', 'Retro', { sepia: 0.35, contrast: 0.9, brightness: 1.05, saturate: 0.8 }, C({ shadows: 0.12 })],
  ['film70', '70\'ler', 'Retro', { sepia: 0.3, saturate: 1.1, contrast: 0.95 }, C({ temp: 0.3, tint: 0.1, shadows: 0.1 })],
  ['film90', '90\'lar kamera', 'Retro', { saturate: 1.2, contrast: 1.1 }, C({ temp: 0.1, tint: -0.08 })],
  ['polaroid', 'Polaroid', 'Retro', { contrast: 0.9, brightness: 1.1, saturate: 0.9 }, C({ temp: 0.15, tint: 0.1, shadows: 0.15 })],
  ['kodak', 'Kodak tarzı', 'Retro', { contrast: 1.08, saturate: 1.12 }, C({ temp: 0.22, highlights: -0.05 }), 'b:warmfilm'],
  ['fuji', 'Fuji tarzı', 'Retro', { contrast: 1.05, saturate: 1.05 }, C({ temp: -0.08, tint: -0.12 })],
  ['sepia', 'Sepya', 'Retro', { sepia: 0.85, contrast: 1.05 }, {}],
  ['faded', 'Solgun', 'Retro', { contrast: 0.8, brightness: 1.1, saturate: 0.7 }, C({ shadows: 0.2 })],
  // Siyah beyaz
  ['bw', 'Siyah-beyaz', 'Siyah-beyaz', { grayscale: 1, contrast: 1.2 }, {}],
  ['bwsoft', 'Yumuşak S/B', 'Siyah-beyaz', { grayscale: 1, contrast: 0.95, brightness: 1.05 }, {}],
  ['bwhard', 'Sert S/B', 'Siyah-beyaz', { grayscale: 1, contrast: 1.6 }, {}],
  ['mono', 'Kontrast mono', 'Siyah-beyaz', {}, {}, 'b:mono'],
  ['silver', 'Gümüş', 'Siyah-beyaz', { grayscale: 0.85, contrast: 1.15, brightness: 1.05 }, C({ temp: -0.15 })],
  ['selenium', 'Selenyum', 'Siyah-beyaz', { grayscale: 1, sepia: 0.25, contrast: 1.2 }, C({ tint: 0.15 })],
  // Portre / yaşam
  ['portrait', 'Portre', 'Portre', { contrast: 1.02, brightness: 1.04, saturate: 1.05 }, C({ temp: 0.1, smooth: 0.25 })],
  ['beauty', 'Güzellik', 'Portre', { brightness: 1.07, contrast: 0.97 }, C({ smooth: 0.5, temp: 0.08 })],
  ['soft', 'Yumuşak', 'Portre', { contrast: 0.9, brightness: 1.06, saturate: 0.95 }, C({ highlights: 0.08 })],
  ['clean', 'Temiz', 'Portre', { contrast: 1.05, brightness: 1.05 }, C({ sharp: 0.2 })],
  ['food', 'Yemek', 'Portre', { saturate: 1.35, contrast: 1.08, brightness: 1.04 }, C({ temp: 0.15 })],
  ['nature', 'Doğa', 'Portre', { saturate: 1.25, contrast: 1.05 }, C({ vib: 0.3, tint: -0.05 })],
  ['city', 'Şehir', 'Portre', { contrast: 1.15, saturate: 0.85 }, C({ temp: -0.1, sharp: 0.2 })],
  // Renkli / sanatsal
  ['purple', 'Mor rüya', 'Sanatsal', {}, C({ tint: 0.2 }), 'b:purple'],
  ['pinkdream', 'Pembe rüya', 'Sanatsal', { saturate: 1.1, brightness: 1.06 }, C({ tint: 0.4, temp: 0.1 })],
  ['lavender', 'Lavanta', 'Sanatsal', { saturate: 0.9, brightness: 1.05 }, C({ tint: 0.3, temp: -0.15 })],
  ['mint', 'Nane', 'Sanatsal', { saturate: 0.95, brightness: 1.05 }, C({ tint: -0.3, temp: -0.1 })],
  ['infrared', 'Kızılötesi', 'Sanatsal', { hue: 180, saturate: 1.3 }, {}],
  ['invertish', 'Ters ton', 'Sanatsal', { hue: 90, saturate: 1.2 }, {}],
  ['horror', 'Korku', 'Sanatsal', { saturate: 0.5, contrast: 1.3, brightness: 0.85 }, C({ tint: -0.25, temp: -0.2 })],
  ['dreamy', 'Rüya', 'Sanatsal', { brightness: 1.1, contrast: 0.88, saturate: 1.1, blur: 0.6 }, C({ highlights: 0.15 })],
];
// v1.7: +100 görünüm — belgesel, late night, açık hava, film stokları, vlog, gece, ürün, moda, düğün, anime, lüks, Latte saha, teknoloji
const X = (id, n, cat, css, col, lut) => [id, n, cat, css, col, lut];
FILTERS.push(
  // Belgesel
  X('doc_nat', 'Doğa belgeseli', 'Belgesel', { contrast: 1.06, saturate: 1.12 }, { vib: 0.25, highlights: -0.1, sharp: 0.2 }),
  X('doc_hist', 'Tarih belgeseli', 'Belgesel', { sepia: 0.25, contrast: 1.1, saturate: 0.75 }, { temp: 0.15, shadows: 0.05 }),
  X('doc_war', 'Savaş arşivi', 'Belgesel', { grayscale: 0.7, contrast: 1.25, brightness: 0.95 }, { temp: 0.1 }),
  X('doc_urban', 'Şehir belgeseli', 'Belgesel', { contrast: 1.12, saturate: 0.85 }, { temp: -0.1, sharp: 0.25 }),
  X('doc_ocean', 'Okyanus belgeseli', 'Belgesel', { saturate: 1.2, contrast: 1.05 }, { temp: -0.25, tint: -0.08, vib: 0.2 }),
  X('doc_desert', 'Çöl belgeseli', 'Belgesel', { contrast: 1.1, saturate: 1.05 }, { temp: 0.4, highlights: -0.1 }),
  X('doc_true', 'Gerçek suç', 'Belgesel', { contrast: 1.15, saturate: 0.65, brightness: 0.92 }, { temp: -0.2, tint: -0.1 }),
  X('doc_interview', 'Röportaj', 'Belgesel', { contrast: 1.04, saturate: 0.95 }, { temp: 0.08, smooth: 0.15 }),
  X('doc_arch', 'Arşiv film', 'Belgesel', { sepia: 0.5, contrast: 0.95, brightness: 1.03 }, { shadows: 0.12 }),
  // Late night / TV
  X('ln_show', 'Late night show', 'Late night & TV', { contrast: 1.12, saturate: 1.15 }, { temp: 0.12, highlights: -0.05, vib: 0.15 }),
  X('ln_studio', 'TV stüdyosu', 'Late night & TV', { contrast: 1.08, saturate: 1.1, brightness: 1.03 }, { sharp: 0.25 }),
  X('ln_talk', 'Talk show sıcak', 'Late night & TV', { contrast: 1.06, saturate: 1.12 }, { temp: 0.22, smooth: 0.15 }),
  X('ln_news', 'Haber bülteni', 'Late night & TV', { contrast: 1.1, saturate: 1.05 }, { temp: -0.05, sharp: 0.3 }),
  X('ln_sitcom', 'Sitcom', 'Late night & TV', { brightness: 1.08, saturate: 1.2, contrast: 1.02 }, { temp: 0.15 }),
  X('ln_reality', 'Reality show', 'Late night & TV', { contrast: 1.15, saturate: 1.3 }, { vib: 0.2 }),
  X('ln_retro_tv', '80\'ler TV', 'Late night & TV', { saturate: 1.3, contrast: 0.95, blur: 0.3 }, { temp: 0.1, tint: 0.1 }),
  X('ln_concert', 'Konser sahnesi', 'Late night & TV', { contrast: 1.3, saturate: 1.35, brightness: 0.92 }, { tint: 0.25, temp: -0.15 }),
  X('ln_podcast', 'Podcast stüdyosu', 'Late night & TV', { contrast: 1.1, saturate: 0.95 }, { temp: 0.18, shadows: -0.05 }),
  // Açık hava
  X('out_sunny', 'Güneşli gün', 'Açık hava', { saturate: 1.25, brightness: 1.05, contrast: 1.06 }, { temp: 0.12, vib: 0.2 }),
  X('out_cloudy', 'Bulutlu gün kurtarıcı', 'Açık hava', { contrast: 1.18, saturate: 1.2, brightness: 1.03 }, { temp: 0.1, highlights: -0.15 }),
  X('out_forest', 'Orman', 'Açık hava', { saturate: 1.15, contrast: 1.08 }, { tint: -0.15, shadows: 0.05 }),
  X('out_mountain', 'Dağ', 'Açık hava', { contrast: 1.15, saturate: 1.05 }, { temp: -0.12, highlights: -0.12, sharp: 0.2 }),
  X('out_beach', 'Plaj', 'Açık hava', { saturate: 1.3, brightness: 1.07 }, { temp: 0.05, tint: -0.08, vib: 0.25 }),
  X('out_snow', 'Kar', 'Açık hava', { brightness: 1.06, contrast: 1.05, saturate: 0.9 }, { temp: -0.3, highlights: -0.15 }),
  X('out_sunrise', 'Gün doğumu', 'Açık hava', { saturate: 1.2, contrast: 1.05 }, { temp: 0.35, tint: 0.12 }),
  X('out_mist', 'Sisli sabah', 'Açık hava', { contrast: 0.85, brightness: 1.08, saturate: 0.8 }, { temp: -0.1, shadows: 0.15 }),
  X('out_drone', 'Drone çekimi', 'Açık hava', { contrast: 1.12, saturate: 1.2 }, { vib: 0.3, highlights: -0.15, sharp: 0.25 }),
  X('out_hike', 'Doğa yürüyüşü', 'Açık hava', { contrast: 1.06, saturate: 1.1 }, { temp: 0.15, tint: -0.05 }),
  X('out_rain', 'Yağmurlu', 'Açık hava', { contrast: 1.08, saturate: 0.8, brightness: 0.95 }, { temp: -0.25 }),
  // Film stokları
  X('fs_portra', 'Portra 400 tarzı', 'Film stokları', { contrast: 0.96, saturate: 0.95 }, { temp: 0.18, tint: 0.05, shadows: 0.06 }, 'b:warmfilm'),
  X('fs_ektar', 'Ektar 100 tarzı', 'Film stokları', { contrast: 1.12, saturate: 1.35 }, { temp: 0.08 }),
  X('fs_velvia', 'Velvia tarzı', 'Film stokları', { contrast: 1.18, saturate: 1.5 }, { tint: -0.05 }),
  X('fs_cinestill', 'Cinestill 800T tarzı', 'Film stokları', { contrast: 1.1, saturate: 1.1 }, { temp: -0.3, tint: 0.08, highlights: 0.08 }),
  X('fs_tri', 'Tri-X S/B', 'Film stokları', { grayscale: 1, contrast: 1.35, brightness: 0.97 }, {}),
  X('fs_hp5', 'HP5 S/B', 'Film stokları', { grayscale: 1, contrast: 1.15, brightness: 1.02 }, { shadows: 0.08 }),
  X('fs_superia', 'Superia tarzı', 'Film stokları', { contrast: 1.05, saturate: 1.15 }, { tint: -0.12, temp: 0.05 }),
  X('fs_gold', 'Gold 200 tarzı', 'Film stokları', { contrast: 1.03, saturate: 1.12 }, { temp: 0.3, highlights: 0.05 }),
  X('fs_slide', 'Diya filmi', 'Film stokları', { contrast: 1.25, saturate: 1.3, brightness: 0.95 }, { temp: -0.05 }),
  X('fs_expired', 'Tarihi geçmiş film', 'Film stokları', { contrast: 0.9, saturate: 1.15 }, { tint: 0.25, temp: 0.2, shadows: 0.15 }),
  // Vlog
  X('vl_clean', 'Temiz vlog', 'Vlog', { contrast: 1.05, brightness: 1.05, saturate: 1.08 }, { temp: 0.06, sharp: 0.15 }),
  X('vl_warm', 'Sıcak vlog', 'Vlog', { saturate: 1.12, brightness: 1.04 }, { temp: 0.22, smooth: 0.1 }),
  X('vl_pastel', 'Pastel vlog', 'Vlog', { contrast: 0.88, brightness: 1.1, saturate: 0.85 }, { tint: 0.12, shadows: 0.15 }),
  X('vl_cafe', 'Kafe', 'Vlog', { contrast: 1.04, saturate: 0.95 }, { temp: 0.28, shadows: 0.06 }),
  X('vl_home', 'Ev hali', 'Vlog', { brightness: 1.06, saturate: 1.05 }, { temp: 0.15, smooth: 0.15 }),
  X('vl_gym', 'Spor salonu', 'Vlog', { contrast: 1.25, saturate: 1.05 }, { temp: -0.08, sharp: 0.3 }),
  X('vl_morning', 'Sabah rutini', 'Vlog', { brightness: 1.1, contrast: 0.95, saturate: 1.05 }, { temp: 0.12, highlights: 0.1 }),
  X('vl_travel', 'Seyahat vlog', 'Vlog', { saturate: 1.25, contrast: 1.08 }, { vib: 0.25, temp: 0.08 }),
  X('vl_moody', 'Duygusal vlog', 'Vlog', { contrast: 1.08, saturate: 0.8, brightness: 0.95 }, { temp: -0.12, shadows: 0.08 }),
  // Gece
  X('nt_city', 'Gece şehri', 'Gece', { contrast: 1.2, saturate: 1.25, brightness: 0.95 }, { temp: -0.2, tint: 0.12 }),
  X('nt_neon', 'Neon sokak', 'Gece', { contrast: 1.25, saturate: 1.5 }, { tint: 0.35, temp: -0.25 }, 'b:purple'),
  X('nt_car', 'Gece sürüşü', 'Gece', { contrast: 1.15, saturate: 1.1, brightness: 0.92 }, { temp: -0.3 }, 'b:coldnight'),
  X('nt_party', 'Parti', 'Gece', { contrast: 1.2, saturate: 1.5 }, { tint: 0.3, vib: 0.2 }),
  X('nt_moon', 'Ay ışığı', 'Gece', { saturate: 0.65, contrast: 1.1, brightness: 0.95 }, { temp: -0.5 }),
  X('nt_lowlight', 'Az ışık kurtarıcı', 'Gece', { brightness: 1.18, contrast: 1.05, saturate: 1.05 }, { shadows: 0.25 }),
  X('nt_fire', 'Kamp ateşi', 'Gece', { contrast: 1.1, saturate: 1.2 }, { temp: 0.55, tint: 0.08 }),
  // Yemek & ürün
  X('fd_fresh', 'Taze', 'Yemek & ürün', { saturate: 1.3, brightness: 1.06, contrast: 1.05 }, { temp: 0.05, sharp: 0.25 }),
  X('fd_bakery', 'Fırın', 'Yemek & ürün', { saturate: 1.15, contrast: 1.05 }, { temp: 0.3 }),
  X('fd_dark', 'Koyu yemek', 'Yemek & ürün', { contrast: 1.2, brightness: 0.9, saturate: 1.1 }, { temp: 0.15, shadows: -0.1 }),
  X('fd_coffee', 'Kahve', 'Yemek & ürün', { contrast: 1.08, saturate: 0.95 }, { temp: 0.32, shadows: 0.05 }),
  X('pr_white', 'Beyaz zemin ürün', 'Yemek & ürün', { brightness: 1.1, contrast: 1.08, saturate: 1.05 }, { temp: -0.05, highlights: 0.1, sharp: 0.3 }),
  X('pr_tech', 'Teknoloji ürünü', 'Yemek & ürün', { contrast: 1.15, saturate: 0.9 }, { temp: -0.15, sharp: 0.35 }),
  X('pr_beauty', 'Kozmetik', 'Yemek & ürün', { brightness: 1.07, saturate: 1.05, contrast: 0.98 }, { tint: 0.1, smooth: 0.3 }),
  X('pr_shoe', 'Sneaker', 'Yemek & ürün', { contrast: 1.2, saturate: 1.25 }, { vib: 0.2, sharp: 0.3 }),
  // Moda
  X('fa_editorial', 'Editoryal', 'Moda', { contrast: 1.15, saturate: 0.85 }, { temp: -0.05, smooth: 0.2 }),
  X('fa_vogue', 'Dergi kapağı', 'Moda', { contrast: 1.12, brightness: 1.04, saturate: 1.05 }, { smooth: 0.35, sharp: 0.15 }),
  X('fa_street', 'Sokak modası', 'Moda', { contrast: 1.2, saturate: 0.9 }, { temp: 0.05, tint: -0.05 }),
  X('fa_runway', 'Podyum', 'Moda', { contrast: 1.25, saturate: 0.95, brightness: 0.96 }, { highlights: -0.1 }),
  X('fa_y2k', 'Y2K', 'Moda', { saturate: 1.35, brightness: 1.08 }, { tint: 0.3, temp: -0.1 }),
  X('fa_mono', 'Monokrom moda', 'Moda', { grayscale: 1, contrast: 1.3, brightness: 1.03 }, {}),
  // Düğün
  X('wd_classic', 'Klasik düğün', 'Düğün & nişan', { brightness: 1.06, contrast: 0.97, saturate: 0.95 }, { temp: 0.1, smooth: 0.25 }),
  X('wd_romance', 'Romantik', 'Düğün & nişan', { brightness: 1.08, saturate: 1.05 }, { tint: 0.15, temp: 0.12, smooth: 0.3 }),
  X('wd_film', 'Düğün filmi', 'Düğün & nişan', { contrast: 1.05, saturate: 0.9 }, { temp: 0.18, shadows: 0.08 }, 'b:warmfilm'),
  X('wd_white', 'Beyaz gelinlik', 'Düğün & nişan', { brightness: 1.1, contrast: 1.02, saturate: 0.9 }, { temp: -0.05, highlights: -0.1 }),
  X('wd_bw', 'Düğün S/B', 'Düğün & nişan', { grayscale: 1, contrast: 1.05, brightness: 1.06 }, {}),
  X('wd_golden', 'Altın tören', 'Düğün & nişan', { saturate: 1.1, contrast: 1.04 }, { temp: 0.38, smooth: 0.2 }),
  // Anime / renkli
  X('an_vivid', 'Anime canlı', 'Anime & renkli', { saturate: 1.6, contrast: 1.1, brightness: 1.05 }, { vib: 0.3 }),
  X('an_sky', 'Anime gökyüzü', 'Anime & renkli', { saturate: 1.45, brightness: 1.08 }, { temp: -0.2, tint: -0.05 }),
  X('an_sunset', 'Anime gün batımı', 'Anime & renkli', { saturate: 1.5, contrast: 1.05 }, { temp: 0.45, tint: 0.2 }),
  X('an_lofi', 'Lo-fi', 'Anime & renkli', { contrast: 0.88, saturate: 0.9, brightness: 1.05 }, { tint: 0.15, temp: 0.1, shadows: 0.18 }),
  X('an_comic', 'Çizgi roman', 'Anime & renkli', { contrast: 1.5, saturate: 1.5 }, { sharp: 0.5 }),
  X('an_candy', 'Pamuk şeker', 'Anime & renkli', { saturate: 1.3, brightness: 1.1, contrast: 0.92 }, { tint: 0.35 }),
  X('an_vapor', 'Vaporwave', 'Anime & renkli', { saturate: 1.4, contrast: 1.05, hue: -20 }, { tint: 0.4, temp: -0.25 }),
  // Lüks / otel
  X('lx_hotel', 'Otel lobisi', 'Lüks & otel', { contrast: 1.08, saturate: 1.02 }, { temp: 0.25, highlights: -0.08, smooth: 0.1 }),
  X('lx_villa', 'Villa', 'Lüks & otel', { saturate: 1.15, brightness: 1.05 }, { temp: 0.12, vib: 0.2 }),
  X('lx_spa', 'Spa', 'Lüks & otel', { brightness: 1.08, contrast: 0.92, saturate: 0.9 }, { temp: 0.08, shadows: 0.12 }),
  X('lx_gold', 'Altın lüks', 'Lüks & otel', { contrast: 1.12, saturate: 1.05 }, { temp: 0.4, highlights: -0.05 }),
  X('lx_dinner', 'Akşam yemeği', 'Lüks & otel', { contrast: 1.15, brightness: 0.95, saturate: 1.05 }, { temp: 0.3, shadows: -0.05 }),
  X('lx_pool', 'Havuz başı', 'Lüks & otel', { saturate: 1.3, brightness: 1.06 }, { tint: -0.12, temp: -0.05, vib: 0.2 }),
  X('lx_marble', 'Mermer', 'Lüks & otel', { contrast: 1.1, saturate: 0.85, brightness: 1.05 }, { temp: -0.05, sharp: 0.2 }),
  // Latte saha (marka paleti)
  X('lt_latte', 'Latte', 'Latte saha', { contrast: 0.95, saturate: 0.85, brightness: 1.04 }, { temp: 0.3, shadows: 0.12 }),
  X('lt_mocha', 'Mocha', 'Latte saha', { contrast: 1.08, saturate: 0.85 }, { temp: 0.38, shadows: -0.04 }),
  X('lt_caramel', 'Karamel', 'Latte saha', { saturate: 1.05, brightness: 1.03 }, { temp: 0.42, tint: 0.05 }),
  X('lt_espresso', 'Espresso', 'Latte saha', { contrast: 1.2, saturate: 0.8, brightness: 0.92 }, { temp: 0.3 }),
  X('lt_cinnamon', 'Tarçın', 'Latte saha', { saturate: 1.12, contrast: 1.05 }, { temp: 0.45, tint: 0.12 }),
  X('lt_cream', 'Krema', 'Latte saha', { contrast: 0.88, brightness: 1.1, saturate: 0.8 }, { temp: 0.22, shadows: 0.18 }),
  // Teknoloji
  X('tc_ai', 'Yapay zekâ moru', 'Teknoloji', { contrast: 1.12, saturate: 1.1 }, { tint: 0.22, temp: -0.2 }, 'b:purple'),
  X('tc_hacker', 'Hacker yeşili', 'Teknoloji', { contrast: 1.2, saturate: 0.8 }, { tint: -0.5, temp: -0.15 }),
  X('tc_blue', 'Teknoloji mavisi', 'Teknoloji', { contrast: 1.1, saturate: 1.05 }, { temp: -0.4 }),
  X('tc_screen', 'Ekran kaydı netleştir', 'Teknoloji', { contrast: 1.08, brightness: 1.03 }, { sharp: 0.5 }),
  X('tc_holo', 'Hologram', 'Teknoloji', { saturate: 1.3, contrast: 1.05, hue: 25 }, { temp: -0.3, tint: 0.2 }),
  X('tc_mono', 'Sade teknoloji', 'Teknoloji', { saturate: 0.6, contrast: 1.12 }, { temp: -0.15, sharp: 0.3 }),
);
// v1.9: Sinema — kült filmlerin renk dilinden esinlenen görünümler (isimler özgün; film adı ve görüntüsü kullanılmaz)
FILTERS.splice(1, 0,
  X('cn_atomic', 'Atom Çağı · renk', 'Sinema · modern', { contrast: 1.05 }, { temp: 0.06 }, 'b:cn_atomic'),
  X('cn_atomicbw', 'Atom Çağı · S/B', 'Sinema · modern', { contrast: 1.05 }, { sharp: 0.15 }, 'b:cn_atomicbw'),
  X('cn_dune', 'Çöl Gezegeni', 'Sinema · modern', {}, { temp: 0.1 }, 'b:cn_dune'),
  X('cn_neondys', 'Neon Distopya', 'Sinema · modern', {}, {}, 'b:cn_neondys'),
  X('cn_gotham', 'Karanlık Şehir', 'Sinema · modern', { brightness: 0.96 }, {}, 'b:cn_gotham'),
  X('cn_sim', 'Simülasyon Yeşili', 'Sinema · modern', {}, { sharp: 0.1 }, 'b:cn_sim'),
  X('cn_pastel', 'Pastel Otel', 'Sinema · modern', {}, {}, 'b:cn_pastel'),
  X('cn_lalight', 'Gece Dansı', 'Sinema · modern', {}, {}, 'b:cn_lalight'),
  X('cn_paris', 'Paris Rüyası', 'Sinema · modern', {}, {}, 'b:cn_paris'),
  X('cn_stairs', 'Merdiven', 'Sinema · modern', {}, {}, 'b:cn_stairs'),
  X('cn_fury', 'Kızgın Çöl', 'Sinema · modern', {}, {}, 'b:cn_fury'),
  X('cn_landing', 'Çıkarma Günü', 'Sinema · modern', {}, { sharp: 0.2 }, 'b:cn_landing'),
  X('cn_redonly', 'Kırmızı Seçici', 'Sinema · modern', {}, {}, 'b:cn_redonly'),
  X('cn_drive', 'Gece Sürücüsü', 'Sinema · modern', {}, {}, 'b:cn_drive'),
  X('cn_moon', 'Ay Işığı', 'Sinema · modern', {}, {}, 'b:cn_moon'),
  X('cn_her', 'Sıcak Yalnızlık', 'Sinema · modern', {}, { smooth: 0.1 }, 'b:cn_her'),
  X('cn_space', 'Yıldızlararası', 'Sinema · modern', {}, {}, 'b:cn_space'),
  X('cn_under', 'Yeraltı Kulübü', 'Sinema · modern', {}, {}, 'b:cn_under'),
  X('cl_silent', "Sessiz Film · 1920'ler", 'Sinema · klasik', { contrast: 1.05 }, {}, 'b:cl_silent'),
  X('cl_noir', "Kara Film · 1940'lar", 'Sinema · klasik', {}, {}, 'b:cl_noir'),
  X('cl_techni', "Technicolor · 1950'ler", 'Sinema · klasik', {}, {}, 'b:cl_techni'),
  X('cl_koda', "Kodachrome · 1960'lar", 'Sinema · klasik', {}, {}, 'b:cl_koda'),
  X('cl_70s', "70'ler Film", 'Sinema · klasik', {}, {}, 'b:cl_70s'),
  X('cl_vhs', "VHS · 1980'ler", 'Sinema · klasik', { blur: 0.3 }, {}, 'b:cl_vhs'),
  X('cl_polaroid', 'Polaroid', 'Sinema · klasik', {}, {}, 'b:cl_polaroid'),
  X('cl_western', 'Spagetti Western', 'Sinema · klasik', {}, {}, 'b:cl_western'),
  X('cl_super8', 'Super 8', 'Sinema · klasik', {}, {}, 'b:cl_super8'),
);
export const FILTER_CATS = [...new Set(FILTERS.map((f) => f[2]))];

export function applyFilter(o, f) {
  o.filterPreset = f[0];
  o.filters = { ...DEFAULT_FILTERS, ...f[3] };
  o.color = { ...COLOR_BASE, ...(o.color ? { smooth: o.color.smooth, sharp: o.color.sharp } : {}), ...f[4] };
  o.lut = f[5] ? { id: f[5], mix: /^b:c[nl]_/.test(f[5]) ? 1 : 0.85 } : null;
}

// küçük önizleme: o anki karenin üzerine CSS filtreyle (yaklaşık)
function thumb(src, f) {
  const c = h('canvas', { width: 96, height: Math.round(96 * (src.height / src.width)) || 170, class: 'flt-th' });
  const x = c.getContext('2d');
  const col = f[4] || {};
  let fs = filterString({ ...DEFAULT_FILTERS, ...f[3] });
  const extra = [];
  if (col.temp) extra.push(`sepia(${Math.max(0, col.temp) * 0.5})`, col.temp < 0 ? `hue-rotate(${col.temp * 30}deg)` : '');
  if (col.tint) extra.push(`hue-rotate(${col.tint * 25}deg)`);
  if (col.vib) extra.push(`saturate(${1 + col.vib})`);
  if (f[5] === 'b:tealorange') extra.push('saturate(1.1) contrast(1.05)');
  if (f[5] === 'b:mono') extra.push('grayscale(1) contrast(1.4)');
  if (f[5] === 'b:bleach') extra.push('saturate(.45) contrast(1.3)');
  if (f[5] === 'b:purple') extra.push('hue-rotate(15deg)');
  const all = [fs === 'none' ? '' : fs, ...extra].filter(Boolean).join(' ');
  x.filter = all || 'none';
  x.drawImage(src, 0, 0, c.width, c.height);
  // v1.9: dahili LUT'lu görünümlerde küçük resim gerçek LUT ile boyanır (sinema filtreleri doğru görünsün)
  const def = f[5] && f[5].startsWith('b:') && BUILTIN_LUTS.find((d) => d[0] === f[5].slice(2));
  if (def && /^c[nl]_/.test(def[0])) {
    x.filter = 'none';
    try {
      const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
      for (let i = 0; i < d.length; i += 4) { const v = def[2](d[i] / 255, d[i + 1] / 255, d[i + 2] / 255); d[i] = v[0] * 255; d[i + 1] = v[1] * 255; d[i + 2] = v[2] * 255; }
      x.putImageData(im, 0, 0);
    } catch (_) { /* yoksay */ }
  }
  return c;
}

export async function openFilters(target) {
  const { openSheet, refreshSheet } = await import('./sheets.js');
  const snap = document.createElement('canvas');
  snap.width = app.engine.canvas.width; snap.height = app.engine.canvas.height;
  snap.getContext('2d').drawImage(app.engine.canvas, 0, 0);
  const st = { cat: FILTER_CATS[1], all: !target };
  openSheet({
    id: 'filters', title: `Filtreler · ${FILTERS.length - 1}`, tabs: ['★', ...FILTER_CATS], tab: st.cat,
    render: (body, tab) => {
      const tgt = target ? (app.P.clips.find((c) => c.id === target.id) || app.P.layers.find((l) => l.id === target.id) || null) : null;
      body.append(h('p', { class: 'hint', html: tgt ? 'Filtre <b>seçili klibe</b> uygulanır. Renk sekmesinden ince ayar yapabilirsin.' : 'Filtre <b>tüm kliplere</b> uygulanır. Tek bir klip için klibe dokunup Filtre\'yi aç.' }));
      const list = tab === '★' ? FILTERS.filter((f) => favIds('filter').includes(f[0])) : FILTERS.filter((f) => f[2] === tab);
      if (!list.length) { body.append(h('p', { class: 'hint' }, 'Henüz favori filtre yok. ☆ ile ekle.')); return; }
      const grid = h('div', { class: 'flt-grid' });
      const curId = tgt ? tgt.filterPreset : app.P.clips[0]?.filterPreset;
      list.forEach((f) => {
        const card = h('div', { class: `flt-card${curId === f[0] ? ' on' : ''}`, role: 'button' }, thumb(snap, f), h('span', {}, f[1]), star('filter', f[0], { name: f[1] }));
        card.addEventListener('click', () => {
          const targets = tgt ? [tgt] : app.P.clips;
          if (!targets.length) { toast('Önce video ekle'); return; }
          targets.forEach((o) => applyFilter(o, f));
          app.commit();
          refreshSheet();
          toast(`${f[1]} uygulandı`, 1500);
        });
        grid.append(card);
      });
      body.append(grid);
    },
  });
}

registerFav('filter', (id) => {
  const f = FILTERS.find((x) => x[0] === id);
  if (!f || !app.P) return;
  app.P.clips.forEach((o) => applyFilter(o, f));
  app.commit();
  toast(`${f[1]} tüm kliplere uygulandı`);
});
void uid; void anim;
