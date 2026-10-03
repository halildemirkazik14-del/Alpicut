// Alpicut — ses efekti ve müzik kütüphaneleri
import { app, h, toast, busy, uid, fmt } from './state.js';
import { I } from './icons.js';
import { openSheet, refreshSheet } from './sheets.js';
import { SFX, renderSfx } from './sfx.js';
import { store, lsGet, lsSet } from './storage.js';

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
const favs = () => { try { return JSON.parse(lsGet(favKey, '[]')); } catch (_) { return []; } };

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

export function openSfxLibrary() {
  const st = openSfxLibrary.st || (openSfxLibrary.st = { q: '', cat: 'Favoriler', limit: 60 });
  openSheet({
    title: 'Ses efektleri', tall: true,
    onClose: stopPreview,
    render: async (body) => {
      if (!sfxIndex) { body.append(h('div', { class: 'spinner' })); sfxIndex = await loadJSON('sfx/index.json', []); refreshSheet(); return; }
      const all = [
        ...SFX.map(([id, n, d]) => ({ id: `syn:${id}`, n, c: 'Spor & temel', d, s: 'Alpicut (uygulama içinde üretildi)' })),
        ...sfxIndex,
      ];
      const cats = ['Favoriler', 'Tümü', ...new Set(all.map((x) => x.c))];
      if (!cats.includes(st.cat)) st.cat = 'Tümü';
      const q = h('input', { type: 'text', class: 'search', placeholder: `${all.length} ses efektinde ara…`, value: st.q });
      const chips = h('div', { class: 'chips scroll', style: { marginBottom: '8px' } });
      cats.forEach((c) => chips.append(h('button', { class: st.cat === c ? 'on' : '', onclick: () => { st.cat = c; st.limit = 60; refreshSheet(); } }, c)));
      body.append(q, chips);
      const fv = favs();
      const k = st.q.trim().toLocaleLowerCase('tr-TR');
      let list = st.cat === 'Favoriler' ? all.filter((x) => fv.includes(x.id)) : st.cat === 'Tümü' ? all : all.filter((x) => x.c === st.cat);
      if (k) list = list.filter((x) => `${x.n} ${x.c}`.toLocaleLowerCase('tr-TR').includes(k));
      if (st.cat === 'Favoriler' && !list.length && !k) body.append(h('p', { class: 'hint' }, 'Henüz favori yok. Sesin yanındaki ☆ ile ekleyebilirsin. Aşağıda tüm sesler:'));
      if (st.cat === 'Favoriler' && !list.length && !k) list = all;
      const box = h('div');
      list.slice(0, st.limit).forEach((x) => {
        const isF = fv.includes(x.id);
        const pb = h('button', { class: 'icon-btn', html: I.play, 'aria-label': 'Dinle' });
        pb.addEventListener('click', async () => {
          if (x.id.startsWith('syn:')) { const r = await renderSfx(x.id.slice(4)); preview(URL.createObjectURL(r.blob), pb); }
          else preview(`sfx/${x.id}.ogg`, pb);
        });
        const star = h('button', { class: `font-fav${isF ? ' on' : ''}` }, isF ? '★' : '☆');
        star.addEventListener('click', () => { const f = favs(); const i = f.indexOf(x.id); if (i >= 0) f.splice(i, 1); else f.unshift(x.id); lsSet(favKey, JSON.stringify(f)); refreshSheet(); });
        box.append(h('div', { class: 'sfx-row sfx4' }, pb,
          h('span', { class: 'sfx-name' }, x.n, h('small', {}, ` ${x.d.toFixed(1)} sn · ${x.c}`)), star,
          h('button', { class: 'btn', onclick: async () => {
            stopPreview();
            try {
              if (x.id.startsWith('syn:')) await app.addSfx(x.id.slice(4), x.n);
              else { await addAudioBlob(`sfxlib-${x.id}`, `SFX · ${x.n}`, `sfx/${x.id}.ogg`, { sfx: true }); toast(`${x.n} eklendi`); }
            } catch (e) { toast('Eklenemedi'); }
          } }, 'Ekle')));
      });
      if (list.length > st.limit) box.append(h('button', { class: 'btn block', onclick: () => { st.limit += 100; refreshSheet(); } }, `Daha fazla (${list.length - st.limit})`));
      body.append(box);
      body.append(h('p', { class: 'hint', html: 'Tüm efektler CC0 (kamu malı) lisanslıdır: Kenney.nl, OpenGameArt.org ve Alpicut. Ticari kullanım dahil serbesttir, atıf gerekmez.' }));
      let tm = null;
      q.addEventListener('input', () => { st.q = q.value; clearTimeout(tm); tm = setTimeout(() => { st.limit = 60; refreshSheet(); setTimeout(() => { const el = document.querySelector('#sheetBody .search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); }, 250); });
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
    title: 'Müzik kütüphanesi', tall: true,
    onClose: stopPreview,
    render: async (body) => {
      if (!musicIndex) { body.append(h('div', { class: 'spinner' })); musicIndex = await loadJSON('data/music.json', []); refreshSheet(); return; }
      body.append(h('p', { class: 'hint', html: 'Telif süresi dolmuş klasik eserlerin <b>kamu malı</b> kayıtları (Wikimedia Commons, çoğu Musopen). Ticari kullanım serbesttir. Parça ilk eklendiğinde indirilir (internet gerekir), sonra cihazda kalır. Kendi müziğin için <b>Ses</b> aracını kullan.' }));
      if (!musicIndex.length) { body.append(h('p', { class: 'hint' }, 'Katalog bulunamadı.')); return; }
      const comps = ['Tümü', ...new Set(musicIndex.map((m) => m.c))];
      const q = h('input', { type: 'text', class: 'search', placeholder: `${musicIndex.length} eserde ara…`, value: st.q });
      const chips = h('div', { class: 'chips scroll', style: { marginBottom: '8px' } });
      comps.forEach((c) => chips.append(h('button', { class: st.comp === c ? 'on' : '', onclick: () => { st.comp = c; refreshSheet(); } }, c)));
      body.append(q, chips);
      const k = st.q.trim().toLocaleLowerCase('tr-TR');
      const list = musicIndex.filter((m) => (st.comp === 'Tümü' || m.c === st.comp) && (!k || `${m.t} ${m.c}`.toLocaleLowerCase('tr-TR').includes(k)));
      list.slice(0, 120).forEach((m) => {
        const pb = h('button', { class: 'icon-btn', html: I.play, 'aria-label': 'Dinle' });
        pb.addEventListener('click', () => preview(m.u, pb));
        body.append(h('div', { class: 'mus-row' }, pb,
          h('div', { class: 'mus-t' }, h('b', {}, cleanTitle(m)), h('small', {}, `${m.c} · ${fmt(m.d, false)} · ${m.l}${m.a ? ` · ${m.a}` : ''}`)),
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
      q.addEventListener('input', () => { st.q = q.value; clearTimeout(tm); tm = setTimeout(() => { refreshSheet(); setTimeout(() => { const el = document.querySelector('#sheetBody .search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); }, 300); });
    },
  });
}
