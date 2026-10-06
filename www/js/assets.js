// Alpicut v1.7 — Assets: tüm projelerde ortak medya kütüphanesi
// Eklediğin her video, foto, ses ve B-roll burada kalır; klasörlere ayırabilir, istediğin projeye tek dokunuşla ekleyebilirsin.
// Pencere küçültülüp (simge durumu) üst çubukta bekletilebilir.
import { app, h, toast, uid, fmt, busy } from './state.js';
import { I } from './icons.js';
import { openSheet, refreshSheet } from './sheets.js';
import { openPop } from './popover.js';
import { store, lsGet, lsSet } from './storage.js';

const KEY = 'alpicut.assets';
function meta() {
  try { const m = JSON.parse(lsGet(KEY, '') || '{}'); return { folders: m.folders || [{ id: 'broll', name: 'B-roll' }, { id: 'sounds', name: 'Seslerim' }], items: m.items || {} }; } catch (_) { return { folders: [], items: {} }; }
}
function save(m) { lsSet(KEY, JSON.stringify(m)); }

// içe aktarılan her medya kütüphaneye girer
export function addToAssets(rec, folder = null) {
  if (!rec?.id || rec.kind === 'lut') return;
  const m = meta();
  if (!m.items[rec.id]) { m.items[rec.id] = { folder: folder ?? (rec.kind === 'audio' ? 'sounds' : null), at: Date.now() }; save(m); }
}
export const inAssets = (id) => !!meta().items[id];

const KINDS = [['all', 'Tümü'], ['video', 'Videolar'], ['image', 'Fotoğraflar'], ['audio', 'Sesler']];
const st = { kind: 'all', folder: '', recs: null };

async function loadRecs() {
  const m = meta();
  const ids = Object.keys(m.items);
  const out = [];
  for (const id of ids) {
    try {
      const r = app.engine.media.get(id) || await store.getMedia(id);
      if (r) out.push(r); else { delete m.items[id]; }
    } catch (_) { /* yoksay */ }
  }
  save(m);
  out.sort((a, b) => (m.items[b.id]?.at || 0) - (m.items[a.id]?.at || 0));
  return out;
}

// pick: Vibe editing gibi yerlerden seçim modu
export function openAssets(opts = {}) {
  st.recs = null;
  const picked = new Set();
  openSheet({
    id: 'assets', title: 'Assets', tall: true,
    tabs: KINDS.map((k) => k[1]), tab: KINDS.find((k) => k[0] === st.kind)?.[1] || 'Tümü',
    render: (body, tb) => {
      st.kind = (KINDS.find((k) => k[1] === tb) || KINDS[0])[0];
      const m = meta();
      // klasör çubuğu
      const fr = h('div', { class: 'chips scroll asset-folders' });
      fr.append(h('button', { class: st.folder === '' ? 'on' : '', onclick: () => { st.folder = ''; refreshSheet(); } }, 'Hepsi'));
      m.folders.forEach((f) => fr.append(h('button', { class: st.folder === f.id ? 'on' : '', html: `${I.folder} ${esc(f.name)}`, onclick: () => { st.folder = f.id; refreshSheet(); } })));
      fr.append(h('button', { class: 'add', html: `${I.plus} Klasör`, onclick: () => { const n = prompt('Klasör adı', ''); if (!n?.trim()) return; const mm = meta(); const id = uid(); mm.folders.push({ id, name: n.trim().slice(0, 30) }); save(mm); st.folder = id; refreshSheet(); } }));
      body.append(fr);
      body.append(h('div', { class: 'btn-row' },
        h('button', { class: 'btn', html: `${I.upload} İçe aktar`, onclick: async () => {
          const files = await app.pickFiles('video/*,image/*,audio/*', true);
          if (!files.length) return;
          const recs = await app.importFiles(files);
          recs.forEach((r) => addToAssets(r, st.folder || null));
          const mm = meta(); if (st.folder) { recs.forEach((r) => { mm.items[r.id].folder = st.folder; }); save(mm); }
          st.recs = null; refreshSheet(); toast(`${recs.length} dosya Assets'e eklendi`);
        } }),
        opts.pick ? h('button', { class: 'btn primary', onclick: async () => { const sel = (st.recs || []).filter((r) => picked.has(r.id)); if (!sel.length) { toast('Önce dosyalara dokunarak seç'); return; } opts.pick(sel); } }, 'Seçilenleri kullan') : h('span')));
      const grid = h('div', { class: 'asset-grid' });
      body.append(grid);
      const draw = (recs) => {
        const list = recs.filter((r) => (st.kind === 'all' || r.kind === st.kind) && (!st.folder || m.items[r.id]?.folder === st.folder));
        grid.textContent = '';
        if (!list.length) { grid.append(h('p', { class: 'hint', style: { gridColumn: '1 / -1' } }, st.folder ? 'Bu klasör boş. Dosyalara uzun bas → klasöre taşı ya da “İçe aktar”.' : 'Henüz dosya yok. “İçe aktar” ile ekle; projelere eklediğin her şey de burada birikir.')); return; }
        list.forEach((r, i) => {
          const card = h('button', { class: `asset${picked.has(r.id) ? ' on' : ''}`, style: { '--i': String(Math.min(i, 16)), backgroundImage: r.thumb ? `url(${r.thumb})` : '' } },
            r.thumb ? null : h('span', { class: 'a-ic', html: r.kind === 'audio' ? I.audio : I.media }),
            r.duration ? h('em', {}, fmt(r.duration, false)) : null,
            h('small', {}, (r.name || '').replace(/\.[a-z0-9]+$/i, '')));
          card.addEventListener('click', (e) => {
            if (opts.pick) { if (picked.has(r.id)) picked.delete(r.id); else picked.add(r.id); card.classList.toggle('on'); return; }
            assetMenu(r, card, e);
          });
          grid.append(card);
        });
      };
      if (st.recs) draw(st.recs);
      else { grid.append(h('div', { class: 'spinner' })); loadRecs().then((r) => { st.recs = r; draw(r); }); }
    },
  });
}

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

function assetMenu(r, card) {
  const b = card.getBoundingClientRect();
  const inProj = !!app.P;
  const items = [];
  if (inProj && r.kind !== 'audio') {
    items.push({ icon: 'media', label: 'Ana ize ekle', fn: () => use(r, 'clip') });
    items.push({ icon: 'layer', label: 'B-roll katmanı', fn: () => use(r, 'layer') });
  }
  if (inProj && (r.kind === 'audio' || r.kind === 'video')) items.push({ icon: 'audio', label: 'Ses olarak', fn: () => use(r, 'audio') });
  if (!inProj) items.push({ icon: 'plus', label: 'Yeni projede aç', fn: async () => { app.newProject(null); await use(r, r.kind === 'audio' ? 'audio' : 'clip'); } });
  items.push({ icon: 'folder', label: 'Klasöre taşı', fn: () => moveTo(r, card) });
  items.push({ icon: 'edit', label: 'Yeniden adlandır', fn: async () => { const n = prompt('Ad', r.name || ''); if (!n) return; r.name = n; try { const rec = await store.getMedia(r.id); if (rec) { rec.name = n; await store.putMedia(rec); } } catch (_) { /* yoksay */ } refreshSheet(); } });
  items.push({ icon: 'trash', label: 'Kütüphaneden kaldır', cls: 'danger', fn: () => { const m = meta(); delete m.items[r.id]; save(m); st.recs = (st.recs || []).filter((x) => x.id !== r.id); refreshSheet(); toast('Assets\'ten kaldırıldı (projelerdeki kullanım etkilenmez)'); } });
  openPop({ key: `asset:${r.id}`, anchor: { x: b.left + b.width / 2, y: b.top }, place: 'above', title: r.name || 'Dosya', variant: 'grid', cols: 3, items });
}

function moveTo(r, card) {
  const m = meta();
  const b = card.getBoundingClientRect();
  openPop({ key: `move:${r.id}`, anchor: { x: b.left + b.width / 2, y: b.top }, place: 'above', title: 'Klasöre taşı', variant: 'grid', cols: 3,
    items: [{ icon: 'close', label: 'Klasörsüz', fn: () => set(null) }, ...m.folders.map((f) => ({ icon: 'folder', label: f.name, fn: () => set(f.id) }))] });
  function set(fid) { const mm = meta(); if (mm.items[r.id]) mm.items[r.id].folder = fid; save(mm); refreshSheet(); toast(fid ? 'Taşındı' : 'Klasörden çıkarıldı'); }
}

async function use(r, target) {
  const b = busy('Ekleniyor…');
  try {
    let m = app.engine.media.get(r.id);
    if (!m) { const rec = r.blob ? r : await store.getMedia(r.id); m = app.registerMedia(rec); }
    const P = app.P, t = app.engine.t;
    if (target === 'clip') P.clips.push(app.makeClip(m));
    else if (target === 'audio') P.audio.push(app.newAudio(m, t));
    else {
      const dur = m.kind === 'image' ? 4 : Math.min(m.duration || 4, 15);
      P.layers.push({ id: uid(), kind: 'media', mediaId: m.id, start: t, end: t + dur, in: 0, out: m.duration || dur, x: 0.5, y: 0.42, w: 0.72, rot: 0, opacity: 1, crop: 'none', radius: 28, borderW: 0, borderColor: '#FFFFFF', shadowOn: true, kenburns: false, volume: 0, loop: false, filters: {}, filterPreset: 'none', anim: { in: 'pop', out: 'fade', loop: 'none', inDur: 0.45, outDur: 0.35 } });
    }
    app.commit(); app.renderTimeline?.();
    toast(target === 'clip' ? 'Ana ize eklendi' : target === 'audio' ? 'Ses eklendi' : 'B-roll eklendi');
  } catch (e) { toast(`Eklenemedi: ${e.message || e}`); } finally { b.close(); }
}
