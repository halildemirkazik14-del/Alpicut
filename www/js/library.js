// Alpicut — ses efekti ve müzik kütüphaneleri
import { app, h, toast, busy, uid, fmt } from './state.js';
import { I } from './icons.js';
import { openSheet, refreshSheet } from './sheets.js';
import { SFX, renderSfx } from './sfx.js';
import { store, lsGet, lsSet } from './storage.js';
import { star as favStar, favIds, registerFav } from './favs.js';

let sfxIndex = null, musicIndex = null;
async function loadJSON(u, fb) { try { const r = await fetch(u); if (!r.ok) throw 0; return await r.json(); } catch (_) { return fb; } }

let player = null;
function preview(url, btn) {
  if (player) { player.pause(); if (player._btn) player._btn.innerHTML = I.play; if (player._url === url) { player = null; return; } }
  player = new Audio(url); player._url = url; player._btn = btn;
  btn.innerHTML = I.pause;
  player.onended = () => { btn.innerHTML = I.play; player = null; };
  player.play().catch(() => { toast('Çalınamadı'); btn.innerHTML = I.play; });
}
function stopPreview() { if (player) { player.pause(); if (player._btn) player._btn.innerHTML = I.play; player = null; } }

const favKey = 'alpicut.favsfx';
const favs = () => favIds('sfx');

async function addAudioBlob(id, name, blobOrUrl, opts = {}) {
  let rec = app.engine.media.get(id) ? null : await store.getMedia(id).catch(() => null);
  if (!app.engine.media.has(id)) {
    if (!rec) {
      const blob = typeof blobOrUrl === 'string' ? await (await fetch(blobOrUrl)).blob() : blobOrUrl;
      const dur = await new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 2); a.onerror = () => res(2); a.src = URL.createObjectURL(blob); });
      rec = { id, kind: 'audio', name, blob, duration: dur, w: 0, h: 0, thumb: null, credit: opts.credit };
      try { await store.putMedia(rec); } catch (_) { /* yoksay */ }
    }
    app.registerMedia(rec);
  }
  const m = app.engine.media.get(id);
  const a = { id: uid(), mediaId: id, start: app.engine.t, in: 0, out: m.duration || 2, volume: opts.volume ?? 1, fadeIn: opts.fadeIn || 0, fadeOut: opts.fadeOut || 0, sfx: !!opts.sfx, role: opts.role };
  app.P.audio.push(a);
  app.commit();
  return a;
}

const SFX_ORDER = ['Whoosh', 'Riser', 'Darbe & boom', 'Sinematik', 'Gerilim', 'Glitch', 'Düşüş & drop', 'Pop & tık', 'Bildirim & zil', 'Komik & meme', 'Spor', 'Ortam'];
export function openSfxLibrary() {
  const st = openSfxLibrary.st || (openSfxLibrary.st = { q: '', cat: 'Whoosh', limit: 80 });
  openSheet({
    id: 'sfx', title: 'Ses efektleri',
    onClose: stopPreview,
    render: async (body) => {
      if (!sfxIndex) { body.append(h('div', { class: 'spinner' })); sfxIndex = await loadJSON('sfx/index.json', []); refreshSheet(); return; }
      // kütüphane yoksa (geliştirme ortamı) eski uygulama içi sentez listesi
      const all = sfxIndex.length ? sfxIndex : SFX.map(([id, n, d, c]) => ({ id: `syn:${id}`, n, c: c || 'Temel', d, t: '' }));
      const counts = {};
      all.forEach((x) => { counts[x.c] = (counts[x.c] || 0) + 1; });
      const cats = ['★', 'Tümü', ...SFX_ORDER.filter((c) => counts[c]), ...Object.keys(counts).filter((c) => !SFX_ORDER.includes(c))];
      if (!cats.includes(st.cat)) st.cat = 'Whoosh';
      const q = h('input', { type: 'text', class: 'search', placeholder: `${all.length} ses efektinde ara (whoosh, riser, boom…)`, value: st.q });
      const chips = h('div', { class: 'chips scroll', style: { marginBottom: '8px' } });
      cats.forEach((c) => chips.append(h('button', { class: st.cat === c ? 'on' : '', onclick: () => { st.cat = c; st.limit = 80; refreshSheet(); } }, c === '★' ? '★ Favoriler' : counts[c] ? `${c} · ${counts[c]}` : c)));
      body.append(q, chips);
      const fv = favs();
      const k = st.q.trim().toLocaleLowerCase('tr-TR');
      let list = k ? all : st.cat === '★' ? all.filter((x) => fv.includes(x.id)) : st.cat === 'Tümü' ? all : all.filter((x) => x.c === st.cat);
      if (k) list = list.filter((x) => `${x.n} ${x.c} ${x.t || ''} ${x.id}`.toLocaleLowerCase('tr-TR').includes(k));
      if (st.cat === '★' && !list.length && !k) body.append(h('p', { class: 'hint' }, 'Henüz favori yok. Sesin yanındaki ☆ ile ekleyebilirsin.'));
      const box = h('div');
      list.slice(0, st.limit).forEach((x) => {
        const pb = h('button', { class: 'icon-btn', html: I.play, 'aria-label': 'Dinle' });
        pb.addEventListener('click', async () => {
          if (x.id.startsWith('syn:')) { const r = await renderSfx(x.id.slice(4)); preview(URL.createObjectURL(r.blob), pb); }
          else preview(`sfx/${x.id}.ogg`, pb);
        });
        const star = favStar('sfx', x.id, { name: x.n });
        box.append(h('div', { class: 'sfx-row sfx4' }, pb,
          h('span', { class: 'sfx-name' }, x.n, h('small', {}, ` ${(+x.d).toFixed(1)} sn${st.cat === 'Tümü' || k ? ` · ${x.c}` : ''}`)), star,
          h('button', { class: 'btn', onclick: async () => {
            stopPreview();
            try { await app.addSfx(x.id.startsWith('syn:') ? x.id.slice(4) : x.id, x.n); } catch (e) { toast('Eklenemedi'); }
          } }, 'Ekle')));
      });
      if (list.length > st.limit) box.append(h('button', { class: 'btn block', onclick: () => { st.limit += 100; refreshSheet(); } }, `Daha fazla (${list.length - st.limit})`));
      body.append(box);
      body.append(h('p', { class: 'hint', html: 'Tüm efektler <b>Alpicut Ses Fabrikası</b>nda sıfırdan üretilmiştir: telif yok, atıf gerekmez, ticari kullanım serbest. ▶ dinle · <b>Ekle</b> oynatıcının olduğu yere koyar.' }));
      let tm = null;
      q.addEventListener('input', () => { st.q = q.value; clearTimeout(tm); tm = setTimeout(() => { st.limit = 80; refreshSheet(); setTimeout(() => { const el = document.querySelector('.panel.focused .search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); }, 250); });
    },
  });
}

function cleanTitle(m) {
  const sur = m.c.split(' ').pop().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const parts = m.t.split(' – ');
  if (parts.length > 1 && parts[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(sur.slice(0, 5))) parts.shift();
  const t = parts.join(' – ');
  return t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
}

export function openMusicLibrary() {
  const st = openMusicLibrary.st || (openMusicLibrary.st = { q: '', comp: 'Tümü' });
  openSheet({
    id: 'music', title: 'Müzik kütüphanesi',
    onClose: stopPreview,
    render: async (body) => {
      if (!musicIndex) { body.append(h('div', { class: 'spinner' })); musicIndex = await loadJSON('data/music.json', []); refreshSheet(); return; }
      body.append(h('p', { class: 'hint', html: 'Telif süresi dolmuş klasik eserlerin <b>kamu malı</b> kayıtları (Wikimedia Commons, çoğu Musopen). Ticari kullanım serbesttir. Parça ilk eklendiğinde indirilir (internet gerekir), sonra cihazda kalır. Kendi müziğin için <b>Ses</b> aracını kullan.' }));
      if (!musicIndex.length) { body.append(h('p', { class: 'hint' }, 'Katalog bulunamadı.')); return; }
      const comps = ['★ Favoriler', 'Tümü', ...new Set(musicIndex.map((m) => m.c))];
      const q = h('input', { type: 'text', class: 'search', placeholder: `${musicIndex.length} eserde ara…`, value: st.q });
      const chips = h('div', { class: 'chips scroll', style: { marginBottom: '8px' } });
      comps.forEach((c) => chips.append(h('button', { class: st.comp === c ? 'on' : '', onclick: () => { st.comp = c; refreshSheet(); } }, c)));
      body.append(q, chips);
      const k = st.q.trim().toLocaleLowerCase('tr-TR');
      const fvm = favIds('music');
      const list = musicIndex.filter((m) => (st.comp === 'Tümü' || m.c === st.comp || (st.comp === '★ Favoriler' && fvm.includes(m.u))) && (!k || `${m.t} ${m.c}`.toLocaleLowerCase('tr-TR').includes(k)));
      list.slice(0, 120).forEach((m) => {
        const pb = h('button', { class: 'icon-btn', html: I.play, 'aria-label': 'Dinle' });
        pb.addEventListener('click', () => preview(m.u, pb));
        body.append(h('div', { class: 'mus-row mus4' }, pb,
          h('div', { class: 'mus-t' }, h('b', {}, cleanTitle(m)), h('small', {}, `${m.c} · ${fmt(m.d, false)} · ${m.l}${m.a ? ` · ${m.a}` : ''}`)), favStar('music', m.u, { name: `${m.c} – ${cleanTitle(m)}` }),
          h('button', { class: 'btn', onclick: async () => {
            stopPreview();
            const b = busy(`İndiriliyor… (${(m.z / 1048576).toFixed(1)} MB)`);
            try {
              const id = `mus-${m.u.split('/').pop().replace(/[^\w.-]/g, '').slice(-60)}`;
              await addAudioBlob(id, `${m.c} – ${m.t}`.slice(0, 80), m.u, { role: 'music', volume: 0.35, fadeIn: 1, fadeOut: 2, credit: `${m.t} — ${m.c}; ${m.a || 'Wikimedia Commons'}; ${m.l}; ${m.p}` });
              toast('Müzik eklendi (seviye %35, yumuşak giriş/çıkış)', 3000);
            } catch (e) { toast('İndirilemedi — internet bağlantısını kontrol et', 4000); } finally { b.close(); }
          } }, 'Ekle')));
      });
      let tm = null;
      q.addEventListener('input', () => { st.q = q.value; clearTimeout(tm); tm = setTimeout(() => { refreshSheet(); setTimeout(() => { const el = document.querySelector('.panel.focused .search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); }, 300); });
    },
  });
}

registerFav('sfx', async (id, x) => {
  if (!app.P) return;
  await app.addSfx(id.startsWith('syn:') ? id.slice(4) : id, x.name);
});
registerFav('music', async (u, x) => {
  if (!app.P) return;
  const b = busy('İndiriliyor…');
  try { const id = `mus-${u.split('/').pop().replace(/[^\w.-]/g, '').slice(-60)}`; await addAudioBlob(id, x.name.slice(0, 80), u, { role: 'music', volume: 0.35, fadeIn: 1, fadeOut: 2 }); toast('Müzik eklendi'); }
  catch (e) { toast('İndirilemedi'); } finally { b.close(); }
});
