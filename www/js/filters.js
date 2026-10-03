// Alpicut — filtre kütüphanesi: 64 hazır görünüm (CSS filtre + renk düzenleme + LUT birleşimi), canlı küçük önizleme, favoriler
import { app, h, toast, uid } from './state.js';
import { DEFAULT_FILTERS, filterString, anim } from './presets.js';
import { COLOR_BASE } from './gl.js';
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
export const FILTER_CATS = [...new Set(FILTERS.map((f) => f[2]))];

export function applyFilter(o, f) {
  o.filterPreset = f[0];
  o.filters = { ...DEFAULT_FILTERS, ...f[3] };
  o.color = { ...COLOR_BASE, ...(o.color ? { smooth: o.color.smooth, sharp: o.color.sharp } : {}), ...f[4] };
  o.lut = f[5] ? { id: f[5], mix: 0.85 } : null;
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
      const tgt = target || null;
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
