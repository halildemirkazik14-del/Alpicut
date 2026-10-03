// Alpicut — her özellik için ortak favori sistemi (efekt, filtre, geçiş, şablon, ses, müzik, font, araç…)
import { h, toast } from './state.js';
import { I } from './icons.js';
import { lsGet, lsSet } from './storage.js';

const KEY = 'alpicut.favs2';
const KINDS = {
  tool: 'Araçlar', fx: 'Efektler', filter: 'Filtreler', trans: 'Geçişler', text: 'Metin şablonları', social: 'Sosyal şablonlar',
  sfx: 'Ses efektleri', music: 'Müzik', font: 'Fontlar', sticker: 'Çıkartmalar', anim: 'Animasyonlar', voice: 'Sesler', curve: 'Eğriler',
};
const appliers = {}; // kind -> (id, meta) => void

function load() {
  let d;
  try { d = JSON.parse(lsGet(KEY, 'null')); } catch (_) { d = null; }
  if (!d) {
    d = {};
    // eski favorileri taşı
    const old = (k) => { try { return JSON.parse(lsGet(k, '[]')); } catch (_) { return []; } };
    d.fx = old('alpicut.favfx').map((id) => ({ id, name: id }));
    d.font = old('alpicut.favfonts').map((id) => ({ id, name: id }));
    d.sfx = old('alpicut.favsfx').map((id) => ({ id, name: id }));
    lsSet(KEY, JSON.stringify(d));
  }
  return d;
}
let data = load();
const save = () => lsSet(KEY, JSON.stringify(data));

export function isFav(kind, id) { return !!(data[kind] || []).some((x) => x.id === id); }
export function favIds(kind) { return (data[kind] || []).map((x) => x.id); }
export function favList(kind) { return (data[kind] || []).slice(); }
export function toggleFav(kind, id, meta = {}) {
  const arr = data[kind] || (data[kind] = []);
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1); else arr.unshift({ id, name: meta.name || id, ...meta, at: Date.now() });
  save();
  const on = i < 0;
  toast(on ? `★ Favorilere eklendi: ${meta.name || id}` : 'Favorilerden çıkarıldı', 1600);
  window.dispatchEvent(new CustomEvent('alpicut-favs', { detail: { kind, id, on } }));
  return on;
}
export function registerFav(kind, apply) { appliers[kind] = apply; }

// küçük yıldız düğmesi
export function star(kind, id, meta, onChange) {
  const b = h('button', { class: `fav-star${isFav(kind, id) ? ' on' : ''}`, html: I.star, 'aria-label': 'Favori', title: 'Favorilere ekle' });
  b.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); const on = toggleFav(kind, id, meta); b.classList.toggle('on', on); if (onChange) onChange(on); });
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  return b;
}

export async function openFavorites() {
  const { openSheet, refreshSheet } = await import('./sheets.js');
  openSheet({
    id: 'favs', title: 'Favorilerim',
    render: (body) => {
      data = load();
      const kinds = Object.keys(KINDS).filter((k) => (data[k] || []).length);
      if (!kinds.length) {
        body.append(h('p', { class: 'hint', html: 'Henüz favorin yok. Efekt, filtre, geçiş, şablon, ses, müzik, font ve araçların yanındaki <b>☆ yıldıza</b> dokunarak buraya ekleyebilirsin. Böylece tekrar tekrar aramazsın.' }));
        return;
      }
      kinds.forEach((k) => {
        body.append(h('div', { class: 'sub-title' }, `${KINDS[k]} · ${data[k].length}`));
        const wrap = h('div', { class: 'fav-wrap' });
        data[k].forEach((x) => {
          const del = h('button', { class: 'fav-del', html: I.close, 'aria-label': 'Çıkar' });
          del.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(k, x.id, x); refreshSheet(); });
          const chip = h('div', { class: 'fav-chip', role: 'button' }, h('span', { html: I.star, class: 'fav-ic' }), h('span', { class: 'fav-n' }, x.name || x.id), del);
          chip.addEventListener('click', () => {
            const f = appliers[k];
            if (f) { try { f(x.id, x); } catch (e) { toast(e.message || 'Uygulanamadı'); } } else toast('Bu favori ilgili panelden kullanılabilir');
          });
          wrap.append(chip);
        });
        body.append(wrap);
      });
      body.append(h('p', { class: 'hint' }, 'Dokun: uygula / ekle · ✕: favorilerden çıkar'));
    },
  });
}
