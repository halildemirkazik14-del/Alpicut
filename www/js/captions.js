// Alpicut — v1.5 altyazı şablonları
// Otomatik (veya SRT) altyazıya tek dokunuşla hazır görünüm: kelime vurgulu, kutulu, neon, sinema, podcast…
// Her şablon yalnızca stil değiştirir; metin ve zamanlama korunur.
import { app, h, clone, toast } from './state.js';
import { I } from './icons.js';
import { openSheet, refreshSheet } from './sheets.js';
import { drawSubtitles } from './render.js';
import { SUB_BASE } from './presets.js';
import { star, favIds, registerFav } from './favs.js';
import { ensureProjectFonts, ensureFont, isBundled } from './fonts.js';

// s: stil (render.js capStyle alanları)
export const CAPTION_TEMPLATES = [
  // --- Popüler (v1.6: Bricolage önde, Barlow ailesi hemen ardından) ---
  { id: 'c_bricolage', name: 'Bricolage vurgulu', cat: 'Popüler', s: { font: 'Bricolage Grotesque', weight: 800, size: 84, color: '#FFFFFF', accent: '#B9ACF7', strokeW: 9, mode: 'line', hl: 'color', anim: 'fade', upper: false } },
  { id: 'c_bricolage_pop', name: 'Bricolage pop', cat: 'Popüler', s: { font: 'Bricolage Grotesque', weight: 800, size: 92, color: '#FFFFFF', accent: '#FDE68A', strokeW: 11, mode: 'group', group: 3, hl: 'color', anim: 'pop', upper: true } },
  { id: 'c_bricolage_box', name: 'Bricolage kutu', cat: 'Popüler', s: { font: 'Bricolage Grotesque', weight: 700, size: 78, color: '#FFFFFF', accent: '#7E6AE0', hlText: '#FFFFFF', strokeW: 0, shadow: 0.7, mode: 'group', group: 3, hl: 'box', anim: 'pop', upper: false } },
  { id: 'c_serif_doc', name: 'Belgesel serif', cat: 'Popüler', s: { font: 'Source Serif 4', weight: 600, size: 66, italic: true, color: '#F5F1EA', accent: '#FFFFFF', strokeW: 0, shadow: 0.85, mode: 'line', hl: 'none', anim: 'fade', upper: false } },
  { id: 'c_barlow', name: 'Barlow vurgulu', cat: 'Popüler', s: { font: 'Barlow Condensed', weight: 800, size: 88, color: '#FFFFFF', accent: '#FACC15', strokeW: 10, mode: 'line', hl: 'color', anim: 'fade', upper: true } },
  { id: 'c_barlow_pop', name: 'Barlow pop', cat: 'Popüler', s: { font: 'Barlow Condensed', weight: 900, size: 96, color: '#FFFFFF', accent: '#A78BFA', strokeW: 12, mode: 'group', group: 3, hl: 'color', anim: 'pop', upper: true } },
  { id: 'c_barlow_box', name: 'Barlow kutu vurgu', cat: 'Popüler', s: { font: 'Barlow Condensed', weight: 800, size: 86, color: '#FFFFFF', accent: '#8467F4', hlText: '#FFFFFF', strokeW: 8, mode: 'group', group: 3, hl: 'box', anim: 'pop', upper: true } },
  { id: 'c_semi', name: 'Barlow Semi sade', cat: 'Popüler', s: { font: 'Barlow Semi Condensed', weight: 700, size: 70, color: '#FFFFFF', accent: '#C4B5FD', strokeW: 0, shadow: 0.9, mode: 'line', hl: 'color', anim: 'fade', upper: false } },
  { id: 'c_hormozi', name: 'Büyük vurgulu (Hormozi)', cat: 'Popüler', s: { font: 'Anton', weight: 400, size: 104, color: '#FFFFFF', accent: '#FACC15', strokeW: 14, mode: 'group', group: 2, hl: 'scale', anim: 'pop', upper: true, maxLines: 1 } },
  { id: 'c_beast', name: 'YouTube kanalı', cat: 'Popüler', s: { font: 'Bangers', weight: 400, size: 110, color: '#FFFFFF', accent: '#22C55E', strokeW: 14, mode: 'group', group: 2, hl: 'color', anim: 'pop', upper: true, rot: -2, maxLines: 1, spacing: 2 } },
  { id: 'c_single', name: 'Tek kelime', cat: 'Popüler', s: { font: 'Barlow Condensed', weight: 900, size: 92, scale: 1.6, color: '#FFFFFF', accent: '#FFFFFF', strokeW: 14, mode: 'single', hl: 'none', anim: 'pop', upper: true } },
  { id: 'c_karaoke', name: 'Karaoke dolum', cat: 'Popüler', s: { font: 'Montserrat', weight: 900, size: 72, color: '#FFFFFF', accent: '#22D3EE', strokeW: 9, mode: 'line', hl: 'karaoke', anim: 'fade', upper: true } },
  // --- Kutulu ---
  { id: 'c_reels', name: 'Reels beyaz kutu', cat: 'Kutulu', s: { font: 'Poppins', weight: 700, size: 60, color: '#111111', accent: '#7C3AED', strokeW: 0, shadow: 0, box: 'line', boxColor: '#FFFFFF', boxOpacity: 1, boxRadius: 12, boxPad: 16, mode: 'line', hl: 'color', anim: 'fade', upper: false } },
  { id: 'c_blackbox', name: 'Siyah yarı saydam', cat: 'Kutulu', s: { font: 'Inter', weight: 700, size: 58, color: '#FFFFFF', accent: '#FACC15', strokeW: 0, shadow: 0, box: 'line', boxColor: '#000000', boxOpacity: 0.62, boxRadius: 10, boxPad: 16, mode: 'line', hl: 'color', anim: 'fade', upper: false } },
  { id: 'c_marker', name: 'Fosforlu kalem', cat: 'Kutulu', s: { font: 'Barlow Condensed', weight: 800, size: 82, color: '#FFFFFF', accent: '#FDE047', hlText: '#111111', strokeW: 8, mode: 'line', hl: 'box', anim: 'fade', upper: true } },
  { id: 'c_redbox', name: 'Kırmızı vurgu kutusu', cat: 'Kutulu', s: { font: 'Anton', weight: 400, size: 88, color: '#FFFFFF', accent: '#E11D48', hlText: '#FFFFFF', strokeW: 10, mode: 'group', group: 3, hl: 'box', anim: 'pop', upper: true } },
  { id: 'c_block', name: 'Blok kart', cat: 'Kutulu', s: { font: 'Montserrat', weight: 800, size: 60, color: '#FFFFFF', accent: '#A78BFA', strokeW: 0, shadow: 0, box: 'block', boxColor: '#15141B', boxOpacity: 0.92, boxRadius: 22, boxPad: 26, mode: 'line', hl: 'color', anim: 'slide', upper: false } },
  { id: 'c_news', name: 'Haber bandı', cat: 'Kutulu', s: { font: 'Oswald', weight: 700, size: 58, color: '#FFFFFF', accent: '#FACC15', strokeW: 0, shadow: 0, box: 'line', boxColor: '#B91C1C', boxOpacity: 1, boxRadius: 0, boxPad: 20, mode: 'line', hl: 'color', anim: 'slide', upper: true, y: 0.82 } },
  // --- Sade / sinema ---
  { id: 'c_netflix', name: 'Sinema altyazısı', cat: 'Sade', s: { font: 'Inter', weight: 600, size: 52, color: '#FFFFFF', accent: '#FFFFFF', strokeW: 0, shadow: 1, mode: 'line', hl: 'none', anim: 'fade', upper: false, y: 0.86, maxW: 0.9 } },
  { id: 'c_clean', name: 'Temiz modern', cat: 'Sade', s: { font: 'Inter', weight: 800, size: 64, color: '#FFFFFF', accent: '#93C5FD', strokeW: 0, shadow: 0.9, mode: 'line', hl: 'color', anim: 'fade', upper: false } },
  { id: 'c_podcast', name: 'Podcast', cat: 'Sade', s: { font: 'Barlow Semi Condensed', weight: 700, size: 72, color: '#E5E7EB', accent: '#FFFFFF', pastColor: '#FFFFFF', strokeW: 6, mode: 'line', hl: 'scale', anim: 'words', upper: false } },
  { id: 'c_typewriter', name: 'Daktilo', cat: 'Sade', s: { font: 'Roboto Mono', weight: 700, size: 52, color: '#F3F4F6', accent: '#4ADE80', strokeW: 0, box: 'line', boxColor: '#000000', boxOpacity: 0.7, boxRadius: 8, boxPad: 14, shadow: 0, mode: 'line', hl: 'color', anim: 'typewriter', upper: false } },
  { id: 'c_serif', name: 'Zarif serif', cat: 'Sade', s: { font: 'Playfair Display', weight: 700, italic: true, size: 66, color: '#FFFFFF', accent: '#FDE68A', strokeW: 0, shadow: 0.9, mode: 'line', hl: 'color', anim: 'fade', upper: false } },
  { id: 'c_minimal', name: 'Minimal küçük harf', cat: 'Sade', s: { font: 'Inter', weight: 500, size: 56, color: '#FFFFFF', accent: '#FFFFFF', strokeW: 0, shadow: 0.7, mode: 'group', group: 4, hl: 'none', anim: 'fade', upper: false, noPunct: true } },
  // --- Enerjik ---
  { id: 'c_neon', name: 'Neon mor', cat: 'Enerjik', s: { font: 'Righteous', weight: 400, size: 82, color: '#F5D0FE', accent: '#FFFFFF', strokeW: 0, glow: 26, glowColor: '#D946EF', mode: 'group', group: 3, hl: 'scale', anim: 'pop', upper: true } },
  { id: 'c_neon_blue', name: 'Neon mavi', cat: 'Enerjik', s: { font: 'Russo One', weight: 400, size: 76, color: '#E0F2FE', accent: '#FFFFFF', strokeW: 0, glow: 24, glowColor: '#38BDF8', mode: 'line', hl: 'glow', anim: 'fade', upper: true } },
  { id: 'c_gaming', name: 'Oyun', cat: 'Enerjik', s: { font: 'Russo One', weight: 400, size: 80, color: '#FFFFFF', accent: '#22C55E', strokeColor: '#052E16', strokeW: 10, mode: 'group', group: 2, hl: 'scale', anim: 'pop', upper: true, rot: -3 } },
  { id: 'c_comic', name: 'Çizgi roman', cat: 'Enerjik', s: { font: 'Bangers', weight: 400, size: 100, color: '#FACC15', accent: '#FFFFFF', strokeColor: '#111111', strokeW: 14, mode: 'group', group: 2, hl: 'color', anim: 'pop', upper: true, spacing: 3 } },
  { id: 'c_sport', name: 'Spor yorum', cat: 'Enerjik', s: { font: 'Barlow Condensed', weight: 900, size: 98, italic: true, color: '#FFFFFF', accent: '#F97316', strokeW: 12, mode: 'group', group: 3, hl: 'color', anim: 'pop', upper: true } },
  { id: 'c_retro', name: '80\'ler retro', cat: 'Enerjik', s: { font: 'Righteous', weight: 400, size: 84, color: '#FDE68A', accent: '#F472B6', strokeColor: '#7C3AED', strokeW: 8, glow: 14, glowColor: '#EC4899', mode: 'line', hl: 'color', anim: 'slide', upper: true } },
  { id: 'c_underline', name: 'Alt çizgili', cat: 'Enerjik', s: { font: 'Montserrat', weight: 900, size: 74, color: '#FFFFFF', accent: '#F43F5E', strokeW: 8, mode: 'line', hl: 'underline', anim: 'fade', upper: true } },
  { id: 'c_bounce', name: 'Zıplayan kelimeler', cat: 'Enerjik', s: { font: 'Poppins', weight: 800, size: 78, color: '#FFFFFF', accent: '#38BDF8', strokeW: 10, mode: 'group', group: 3, hl: 'scale', anim: 'words', upper: false } },
  // --- Lüks ---
  { id: 'c_gold', name: 'Altın', cat: 'Lüks', s: { font: 'Playfair Display', weight: 700, size: 70, color: '#F3DFA2', accent: '#FFFFFF', strokeW: 0, glow: 14, glowColor: '#B8860B', mode: 'line', hl: 'color', anim: 'fade', upper: false, spacing: 1 } },
  { id: 'c_silver', name: 'Gümüş ince', cat: 'Lüks', s: { font: 'Barlow', weight: 600, size: 58, color: '#E5E7EB', accent: '#FFFFFF', strokeW: 0, shadow: 0.8, mode: 'line', hl: 'scale', anim: 'fade', upper: true, spacing: 6 } },
];

// v1.10: Şiir & Edebiyat — şiir, edebiyat, alıntı ve sesli kitap kanalları için yavaş, zarif kinetik tipografi.
// Google fontları ilk seçimde indirilir; internet yoksa "fallback" paketli fonta düşer.
const PS = { strokeW: 0, mode: 'line', maxLines: 3, maxW: 0.86, upper: false, lineH: 1.3 };
CAPTION_TEMPLATES.push(
  { id: 'p_blur', name: 'Bulanıktan netleşen', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Cormorant Garamond', fallback: 'Playfair Display', weight: 600, italic: true, size: 80, color: '#F5EFE6', accent: '#E8C27A', shadow: 0.7, hl: 'none', anim: 'blurin' } },
  { id: 'p_ink', name: 'Mürekkep el yazısı', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Caveat', weight: 700, size: 92, color: '#FFFFFF', accent: '#F3DFA2', shadow: 0.6, hl: 'none', anim: 'ink' } },
  { id: 'p_script', name: 'Zarif el yazısı', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Dancing Script', fallback: 'Caveat', weight: 600, size: 86, color: '#FDF6E3', accent: '#F3DFA2', glow: 10, glowColor: '#8A6A2A', hl: 'none', anim: 'ink' } },
  { id: 'p_gold', name: 'Altın tozu', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Playfair Display', weight: 600, italic: true, size: 72, color: '#F3DFA2', accent: '#FFF7D6', glow: 10, glowColor: '#B8860B', hl: 'none', anim: 'letters', spacing: 0.5 } },
  { id: 'p_type', name: 'İmleçli daktilo', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Courier Prime', fallback: 'Roboto Mono', weight: 700, size: 58, color: '#EDE6D6', accent: '#EDE6D6', shadow: 0.6, hl: 'none', anim: 'typecursor' } },
  { id: 'p_breathe', name: 'Nefes alan dize', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'EB Garamond', fallback: 'Playfair Display', weight: 500, size: 74, color: '#FFFFFF', accent: '#FFFFFF', shadow: 0.7, hl: 'soft', anim: 'breathe' } },
  { id: 'p_paper', name: 'Eski defter', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Lora', fallback: 'Merriweather', weight: 600, size: 58, color: '#2B1E17', accent: '#8B5E3C', shadow: 0, box: 'paper', boxColor: '#F3EAD8', boxOpacity: 0.96, boxPad: 26, boxRadius: 6, hl: 'italic', anim: 'rise' } },
  { id: 'p_latte', name: 'Latte dize', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Cormorant Garamond', fallback: 'Playfair Display', weight: 700, size: 78, color: '#EFE4D6', accent: '#C2603D', shadow: 0.8, hl: 'italic', anim: 'rise' } },
  { id: 'p_night', name: 'Gece mavisi', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Cormorant Garamond', fallback: 'Playfair Display', weight: 500, italic: true, size: 80, color: '#DCE6F5', accent: '#FFFFFF', glow: 18, glowColor: '#5B7DB8', hl: 'none', anim: 'blurin' } },
  { id: 'p_sign', name: 'Dize + şair imzası', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Playfair Display', weight: 700, italic: true, size: 70, color: '#FFFFFF', accent: '#E8C27A', shadow: 0.8, hl: 'soft', anim: 'breathe', sign: 'Şair adı' } },
  { id: 'p_minimal', name: 'Minimal edebiyat', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Lora', fallback: 'Merriweather', weight: 400, size: 56, color: '#FFFFFF', accent: '#FFFFFF', shadow: 0.6, spacing: 1, hl: 'soft', anim: 'rise' } },
  { id: 'p_divan', name: 'Divan altını', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'EB Garamond', fallback: 'Playfair Display', weight: 600, size: 76, color: '#F7EBD0', accent: '#E3B341', glowColor: '#E3B341', shadow: 0.7, hl: 'italic', anim: 'letters' } },
  { id: 'p_letter', name: 'Sepya mektup', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Merriweather', weight: 400, italic: true, size: 56, color: '#E9D8B4', accent: '#FFF3D6', shadow: 0.8, hl: 'soft', anim: 'ink' } },
  { id: 'p_whisper', name: 'Fısıltı', cat: 'Şiir & Edebiyat', s: { ...PS, font: 'Source Serif 4', weight: 300, italic: true, size: 54, color: '#F1EDE6', accent: '#FFFFFF', shadow: 0.7, spacing: 2, hl: 'none', anim: 'blurin' } },
);

export const CAP_CATS = ['Popüler', 'Şiir & Edebiyat', 'Kutulu', 'Sade', 'Enerjik', 'Lüks'];

const SAMPLE = { start: 0, end: 3, text: 'Bu an her şeyi değiştirdi', words: [
  { t: 'Bu', s: 0, e: 0.4 }, { t: 'an', s: 0.4, e: 0.8 }, { t: 'her', s: 0.8, e: 1.1 }, { t: 'şeyi', s: 1.1, e: 1.7 }, { t: 'değiştirdi', s: 1.7, e: 2.6 },
] };
// şiir şablonlarının önizlemesi için özgün bir dize
const VERSE = { start: 0, end: 3, text: 'Gece uzun, kalbim yine sende kaldı', words: [
  { t: 'Gece', s: 0, e: 0.4 }, { t: 'uzun,', s: 0.4, e: 0.9 }, { t: 'kalbim', s: 0.9, e: 1.4 }, { t: 'yine', s: 1.4, e: 1.7 }, { t: 'sende', s: 1.7, e: 2.1 }, { t: 'kaldı', s: 2.1, e: 2.7 },
] };

function preview(tpl, w = 300) {
  const ratio = 0.56;
  const cv = h('canvas', { width: w * 2, height: Math.round(w * ratio * 2), class: 'cap-cv' });
  const x = cv.getContext('2d');
  const W = 1080, H = Math.round(1080 * ratio), S = cv.width / W;
  const draw = () => {
    x.setTransform(1, 0, 0, 1, 0, 0);
    const g = x.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, '#2A2638'); g.addColorStop(1, '#0E0D12');
    x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height);
    x.setTransform(S, 0, 0, S, 0, 0);
    // önizlemede tüm grup görünsün (kelime kelime belirme animasyonu durağan karede boş görünür)
    const style = { ...clone(SUB_BASE.style), ...tpl.s, y: 0.5, maxW: 0.92, anim: 'none' };
    const poem = tpl.cat === 'Şiir & Edebiyat';
    if (poem) { style.maxLines = 2; style.size = Math.min(style.size, 66); }
    drawSubtitles(x, { cues: [poem ? VERSE : SAMPLE], style, offset: 0 }, poem ? 1.2 : 1.0, { W, H, S, exporting: true });
  };
  draw();
  const it = tpl.s.italic || tpl.s.hl === 'italic';
  if (!isBundled(tpl.s.font)) ensureFont(tpl.s.font, null, it).then(draw).catch(() => {});
  else if (document.fonts) document.fonts.load(`${it ? 'italic ' : ''}${tpl.s.weight || 700} 40px "${tpl.s.font}"`).then(draw).catch(() => {});
  return cv;
}

export function miniPreview(tpl) { return preview(tpl, 150); }

export function applyCaptionTemplate(tpl) {
  const P = app.P;
  if (!P) return;
  if (!P.subs) P.subs = clone(SUB_BASE);
  const keepY = P.subs.style?._yUser ? P.subs.style.y : null;
  P.subs.style = { ...clone(SUB_BASE.style), ...clone(tpl.s), tpl: tpl.id };
  delete P.subs.style.preset;
  if (keepY != null && tpl.s.y == null) { P.subs.style.y = keepY; P.subs.style._yUser = true; }
  ensureProjectFonts(P).then(() => app.engine.requestDraw());
  app.commit();
  toast(`“${tpl.name}” uygulandı`);
}

export function openCaptionStyles() {
  const st = openCaptionStyles.st || (openCaptionStyles.st = { cat: 'Popüler' });
  openSheet({
    id: 'capstyles', title: 'Altyazı şablonları',
    render: (body) => {
      const has = !!app.P?.subs?.cues?.length;
      if (!has) {
        body.append(h('div', { class: 'acc-empty' }, h('span', { html: I.subtitle }), h('b', {}, 'Önce altyazı oluştur'),
          h('p', { class: 'hint' }, 'Şablon seçersen stil kaydedilir; altyazı oluşturunca bu görünümle gelir.'),
          h('button', { class: 'btn primary block', html: `${I.ai} Otomatik altyazı`, onclick: () => import('./ai.js').then((m) => m.openAutoCaptions()) })));
      }
      const chips = h('div', { class: 'chips scroll', style: { margin: '6px 0 10px' } });
      ['★', ...CAP_CATS].forEach((c) => chips.append(h('button', { class: st.cat === c ? 'on' : '', onclick: () => { st.cat = c; refreshSheet(); } }, c === '★' ? '★ Favoriler' : c)));
      body.append(chips);
      const fv = favIds('captpl');
      const list = st.cat === '★' ? CAPTION_TEMPLATES.filter((t) => fv.includes(t.id)) : CAPTION_TEMPLATES.filter((t) => t.cat === st.cat);
      if (!list.length) body.append(h('p', { class: 'hint' }, 'Henüz favori şablon yok. Şablonun köşesindeki ☆ ile ekle.'));
      const cur = app.P?.subs?.style?.tpl;
      const grid = h('div', { class: 'cap-grid' });
      list.forEach((tpl) => {
        const card = h('button', { class: `cap-card${cur === tpl.id ? ' on' : ''}`, onclick: () => { applyCaptionTemplate(tpl); refreshSheet(); } }, preview(tpl), h('span', {}, tpl.name), star('captpl', tpl.id, { name: tpl.name }));
        grid.append(card);
      });
      body.append(grid);
      if (has) body.append(h('button', { class: 'btn block', style: { marginTop: '10px' }, html: `${I.edit} Ayrıntılı stil ayarları`, onclick: () => app.select({ type: 'subs', id: 'subs' }, 'Stil') }));
    },
  });
}

registerFav('captpl', (id) => { const t = CAPTION_TEMPLATES.find((x) => x.id === id); if (t) applyCaptionTemplate(t); });
