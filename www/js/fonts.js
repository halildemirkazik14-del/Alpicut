// Alpicut — font yönetimi: paketli (çevrimdışı) fontlar + Google Fonts kataloğu (isteğe bağlı yükleme)
import { h, toast } from './state.js';

// Uygulamayla birlikte gelen (internetsiz çalışan) fontlar
export const BUNDLED = [
  ['Barlow Condensed', 'sans-serif'], ['Barlow Semi Condensed', 'sans-serif'], ['Barlow', 'sans-serif'],
  ['Anton', 'sans-serif'], ['Bebas Neue', 'display'], ['Montserrat', 'sans-serif'], ['Poppins', 'sans-serif'], ['Oswald', 'sans-serif'],
  ['Roboto', 'sans-serif'], ['Inter', 'sans-serif'], ['Archivo Black', 'sans-serif'], ['Russo One', 'sans-serif'], ['Teko', 'sans-serif'],
  ['Righteous', 'display'], ['Bangers', 'display'], ['Lobster', 'display'], ['Pacifico', 'handwriting'], ['Permanent Marker', 'handwriting'],
  ['Caveat', 'handwriting'], ['Playfair Display', 'serif'], ['Merriweather', 'serif'], ['Roboto Mono', 'monospace'],
];
const bundledSet = new Set(BUNDLED.map((x) => x[0]));

let catalog = null;
export async function getCatalog() {
  if (catalog) return catalog;
  try {
    const r = await fetch('data/gfonts.json');
    if (!r.ok) throw new Error('yok');
    catalog = await r.json();
  } catch (_) {
    catalog = BUNDLED.map(([f, c]) => ({ f, c, w: [400, 700] }));
  }
  // paketli olanlar listede olmayabilir
  BUNDLED.forEach(([f, c]) => { if (!catalog.some((x) => x.f === f)) catalog.unshift({ f, c, w: [400, 700, 900] }); });
  return catalog;
}

const loaded = new Map(); // family -> Promise
export function isBundled(f) { return bundledSet.has(f); }

// Google Fonts'tan aileyi yükle (paketliyse hiçbir şey yapma)
export function ensureFont(family, weights) {
  if (!family || bundledSet.has(family)) return Promise.resolve(true);
  if (loaded.has(family)) return loaded.get(family);
  const meta = catalog?.find((x) => x.f === family);
  const ws = (weights || meta?.w || [400, 700]).filter((w) => w >= 100 && w <= 900);
  const list = [...new Set(ws.length ? ws : [400])].sort((a, b) => a - b);
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${list.join(';')}&display=swap`;
  const p = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = url;
    link.onload = async () => {
      try { await Promise.all(list.map((w) => document.fonts.load(`${w} 40px "${family}"`, 'AğŞİçö'))); } catch (_) { /* yoksay */ }
      resolve(true);
    };
    link.onerror = () => { loaded.delete(family); resolve(false); };
    document.head.appendChild(link);
  });
  loaded.set(family, p);
  return p;
}

// Önizleme için yalnızca adın harflerini içeren küçük alt küme
const previewLoaded = new Set();
function previewFont(family) {
  if (bundledSet.has(family) || previewLoaded.has(family)) return;
  previewLoaded.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&text=${encodeURIComponent(family + 'Aa')}&display=swap`;
  document.head.appendChild(link);
}

export async function ensureProjectFonts(P) {
  const fams = new Set();
  P.layers.forEach((l) => { if (l.font) fams.add(l.font); if (l.title?.font) fams.add(l.title.font); });
  if (P.subs?.style?.font) fams.add(P.subs.style.font);
  if (P.cover?.title?.font) fams.add(P.cover.title.font);
  const res = await Promise.all([...fams].map((f) => ensureFont(f)));
  return res.every(Boolean);
}

const CATS = [['all', 'Tümü'], ['offline', 'İnternetsiz'], ['sans-serif', 'Sans'], ['serif', 'Serif'], ['display', 'Gösterişli'], ['handwriting', 'El yazısı'], ['monospace', 'Mono']];
const favs = () => { try { return JSON.parse(localStorage.getItem('alpicut.favfonts') || '[]'); } catch (_) { return []; } };
const setFavs = (f) => { try { localStorage.setItem('alpicut.favfonts', JSON.stringify(f)); } catch (_) { /* yoksay */ } };

// Font seçici paneli (sheets.openSheet ile açılır)
export function fontPickerBody(body, current, onPick, refresh) {
  const st = fontPickerBody.st || (fontPickerBody.st = { q: '', cat: 'all', limit: 80 });
  const q = h('input', { type: 'text', placeholder: 'Font ara (1500+ Google Fonts)…', class: 'search', value: st.q });
  const chips = h('div', { class: 'chips scroll', style: { marginBottom: '8px' } });
  [['fav', '★ Favoriler'], ...CATS].forEach(([id, l]) => {
    chips.append(h('button', { class: st.cat === id ? 'on' : '', onclick: () => { st.cat = id; st.limit = 80; refresh(); } }, l));
  });
  const list = h('div', { class: 'font-list' });
  body.append(q, chips, list);
  body.append(h('p', { class: 'hint', html: '“İnternetsiz” fontlar uygulamanın içinde gelir. Diğerleri ilk seçildiğinde Google Fonts\'tan indirilir (internet gerekir) ve sonra önbellekte kalır.' }));
  const render = async () => {
    const cat = await getCatalog();
    const k = st.q.trim().toLocaleLowerCase('tr-TR');
    const fv = favs();
    let items = cat;
    if (st.cat === 'offline') items = cat.filter((x) => bundledSet.has(x.f));
    else if (st.cat === 'fav') items = cat.filter((x) => fv.includes(x.f));
    else if (st.cat !== 'all') items = cat.filter((x) => x.c === st.cat);
    if (k) items = items.filter((x) => x.f.toLocaleLowerCase('tr-TR').includes(k));
    list.textContent = '';
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); previewFont(en.target.dataset.f); } }));
    items.slice(0, st.limit).forEach((x) => {
      const isFav = fv.includes(x.f);
      const star = h('button', { class: `font-fav${isFav ? ' on' : ''}`, 'aria-label': 'Favori' }, isFav ? '★' : '☆');
      star.addEventListener('click', (e) => { e.stopPropagation(); const f = favs(); const i = f.indexOf(x.f); if (i >= 0) f.splice(i, 1); else f.unshift(x.f); setFavs(f); render(); });
      const row = h('button', { class: `font-row${x.f === current ? ' on' : ''}`, 'data-f': x.f },
        h('span', { class: 'font-name', style: { fontFamily: `"${x.f}", sans-serif` } }, x.f),
        h('small', {}, bundledSet.has(x.f) ? 'internetsiz' : x.c),
        star);
      row.addEventListener('click', async () => {
        if (!bundledSet.has(x.f)) toast(`${x.f} yükleniyor…`, 1500);
        const ok = await ensureFont(x.f, x.w);
        if (!ok) { toast('Font indirilemedi — internet bağlantısını kontrol et', 3500); return; }
        onPick(x.f, x);
      });
      list.append(row);
      io.observe(row);
    });
    if (items.length > st.limit) {
      list.append(h('button', { class: 'btn block', onclick: () => { st.limit += 120; render(); } }, `Daha fazla göster (${items.length - st.limit})`));
    }
    if (!items.length) list.append(h('p', { class: 'hint' }, 'Sonuç yok.'));
  };
  let tm = null;
  q.addEventListener('input', () => { st.q = q.value; clearTimeout(tm); tm = setTimeout(() => { st.limit = 80; render(); }, 200); });
  render();
}

export function fontWeights(family) {
  const meta = catalog?.find((x) => x.f === family);
  return meta?.w?.length ? meta.w : [400, 500, 600, 700, 800, 900];
}
