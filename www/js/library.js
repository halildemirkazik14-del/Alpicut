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

const SFX_ORDER = ['Whoosh', 'Darbe & boom', 'Arayüz & tık', 'Bildirim & zil', 'Komik & meme', 'Kalabalık & alkış', 'Müzik vuruşları', 'İnsan sesleri', 'Doğa', 'Hayvanlar', 'Ev & günlük', 'Ulaşım', 'Teknoloji', 'Para & kasa', 'Spor', 'Bilim kurgu', 'Oyun & retro', 'Ortam', 'Seslendirme'];
// v1.7: Türkçe arama → kayıtların İngilizce adları
const SYN = { alkış: 'applause clap', kapı: 'door', yağmur: 'rain', köpek: 'dog bark', kedi: 'cat meow', zil: 'bell ring chime', patlama: 'explosion bang boom', araba: 'car engine horn', ayak: 'footstep', klavye: 'keyboard typing', para: 'coin cash', kahkaha: 'laugh', gülme: 'laugh', kalp: 'heart', düdük: 'whistle', korna: 'horn', kuş: 'bird', deniz: 'ocean wave', dalga: 'wave', ateş: 'fire', gök: 'thunder', şimşek: 'thunder', rüzgar: 'wind', rüzgâr: 'wind', su: 'water splash', telefon: 'phone', kamera: 'camera shutter', saat: 'clock tick', davul: 'drum', tren: 'train', uçak: 'airplane', siren: 'siren', bebek: 'baby', çocuk: 'child', kalabalık: 'crowd', tribün: 'stadium crowd', at: 'horse', inek: 'cow', horoz: 'rooster', daktilo: 'typewriter', kağıt: 'paper', cam: 'glass', yumruk: 'punch', vuruş: 'hit impact', tık: 'click', bildirim: 'notification ding', geçiş: 'whoosh swish', hışırtı: 'rustle' };
const expandQ = (k) => [k, ...Object.entries(SYN).filter(([tr]) => k.includes(tr)).map(([, en]) => en)].join(' ').split(/\s+/).filter(Boolean);
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
      if (!cats.includes(st.cat)) st.cat = cats[2] || 'Tümü';
      const q = h('input', { type: 'text', class: 'search', placeholder: `${all.length} ses efektinde ara (whoosh, riser, boom…)`, value: st.q });
      const chips = h('div', { class: 'chips scroll', style: { marginBottom: '8px' } });
      cats.forEach((c) => chips.append(h('button', { class: st.cat === c ? 'on' : '', onclick: () => { st.cat = c; st.limit = 80; refreshSheet(); } }, c === '★' ? '★ Favoriler' : counts[c] ? `${c} · ${counts[c]}` : c)));
      body.append(q, chips);
      const fv = favs();
      const k = st.q.trim().toLocaleLowerCase('tr-TR');
      let list = k ? all : st.cat === '★' ? all.filter((x) => fv.includes(x.id)) : st.cat === 'Tümü' ? all : all.filter((x) => x.c === st.cat);
      if (k) { const ws = expandQ(k); list = list.filter((x) => { const hay = `${x.n} ${x.c} ${x.t || ''} ${x.q || ''} ${x.id}`.toLocaleLowerCase('tr-TR'); return hay.includes(k) || ws.some((w) => w.length > 2 && hay.includes(w)); }); }
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
          h('span', { class: 'sfx-name' }, x.n, h('small', {}, ` ${(+x.d).toFixed(1)} sn${st.cat === 'Tümü' || k ? ` · ${x.c}` : ''}${x.s ? ` · ${x.s.split(' · ')[0]}` : ''}`)), star,
          h('button', { class: 'btn', onclick: async () => {
            stopPreview();
            try { await app.addSfx(x.id.startsWith('syn:') ? x.id.slice(4) : x.id, x.n); } catch (e) { toast('Eklenemedi'); }
          } }, 'Ekle')));
      });
      if (list.length > st.limit) box.append(h('button', { class: 'btn block', onclick: () => { st.limit += 100; refreshSheet(); } }, `Daha fazla (${list.length - st.limit})`));
      body.append(box);
      body.append(h('p', { class: 'hint', html: 'Gerçek kayıtlar: <b>Kenney, OpenGameArt ve Wikimedia Commons</b> — tamamı CC0 / kamu malı: telif yok, atıf gerekmez, ticari kullanım serbest. Türkçe arayabilirsin (alkış, kapı, yağmur…). ▶ dinle · <b>Ekle</b> oynatıcının olduğu yere koyar.' }));
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

// v1.7: gelişmiş müzik kütüphanesi — türler, besteciler, süre filtresi, arama, favoriler, son kullanılanlar, atıf yönetimi
const GENRE_ORDER = ['Sinematik', 'Lo-fi & chill', 'Elektronik', 'Neşeli & reklam', 'Akustik & folk', 'Piyano', 'Caz & blues', 'Rock', 'Hip-hop & beat', 'Ortam & meditasyon', 'Gerilim & karanlık', 'Dünya müziği', 'Kevin MacLeod', 'Klasik'];
const GENRE_IC = { Sinematik: '🎬', 'Lo-fi & chill': '🌙', Elektronik: '🎛️', 'Neşeli & reklam': '☀️', 'Akustik & folk': '🎸', Piyano: '🎹', 'Caz & blues': '🎷', Rock: '🤘', 'Hip-hop & beat': '🎧', 'Ortam & meditasyon': '🧘', 'Gerilim & karanlık': '🕯️', 'Dünya müziği': '🌍', 'Kevin MacLeod': '🎼', Klasik: '🎻' };
const MSYN = { epik: 'epic cinematic orchestral trailer', sakin: 'calm ambient piano relax meditation', neşeli: 'happy upbeat fun', hüzünlü: 'sad melancholy piano', gerilim: 'suspense dark tension', romantik: 'love romantic piano', enerjik: 'energetic rock electronic upbeat', spor: 'energetic rock epic', düğün: 'wedding piano romantic', yemek: 'happy acoustic jazz', seyahat: 'acoustic folk happy', teknoloji: 'electronic synth corporate', vlog: 'lofi chill acoustic happy' };
const recentKey = 'alpicut.musRecent';
const recent = () => { try { return JSON.parse(lsGet(recentKey, '[]')); } catch (_) { return []; } };

export function openMusicLibrary() {
  const st = openMusicLibrary.st || (openMusicLibrary.st = { q: '', g: '', comp: 'Tümü', len: 'all', limit: 60 });
  openSheet({
    id: 'music', title: 'Müzik kütüphanesi', tall: true,
    onClose: stopPreview,
    render: async (body) => {
      if (!musicIndex) { body.append(h('div', { class: 'spinner' })); musicIndex = await loadJSON('data/music.json', []); refreshSheet(); return; }
      if (!musicIndex.length) { body.append(h('p', { class: 'hint' }, 'Katalog bulunamadı.')); return; }
      musicIndex.forEach((m) => { if (!m.g) m.g = 'Klasik'; });
      const counts = {}; musicIndex.forEach((m) => { counts[m.g] = (counts[m.g] || 0) + 1; });
      const genres = [...GENRE_ORDER.filter((g) => counts[g]), ...Object.keys(counts).filter((g) => !GENRE_ORDER.includes(g))];
      const q = h('input', { type: 'text', class: 'search', placeholder: `${musicIndex.length} parçada ara (epik, sakin, lo-fi, piyano…)`, value: st.q });
      body.append(q);
      const gg = h('div', { class: 'mus-genres' });
      [['', '✨', 'Tümü', musicIndex.length], ['★', '★', 'Favoriler', favIds('music').length], ['↺', '↺', 'Son kullanılan', recent().length], ...genres.map((g) => [g, GENRE_IC[g] || '🎵', g, counts[g]])].forEach(([id, ic, n, c], i) => {
        gg.append(h('button', { class: `mus-g${st.g === id ? ' on' : ''}`, style: { '--i': String(i) }, onclick: () => { st.g = id; st.comp = 'Tümü'; st.limit = 60; refreshSheet(); } }, h('span', {}, ic), h('b', {}, n), h('small', {}, String(c))));
      });
      body.append(gg);
      const lc = h('div', { class: 'chips scroll', style: { margin: '8px 0' } });
      [['all', 'Her süre'], ['short', '< 1 dk'], ['mid', '1–3 dk'], ['long', '3 dk +']].forEach(([id, n]) => lc.append(h('button', { class: st.len === id ? 'on' : '', onclick: () => { st.len = id; refreshSheet(); } }, n)));
      body.append(lc);
      if (st.g === 'Klasik') {
        const cc = h('div', { class: 'chips scroll', style: { marginBottom: '8px' } });
        ['Tümü', ...new Set(musicIndex.filter((m) => m.g === 'Klasik').map((m) => m.c))].forEach((c) => cc.append(h('button', { class: st.comp === c ? 'on' : '', onclick: () => { st.comp = c; refreshSheet(); } }, c)));
        body.append(cc);
      }
      const k = st.q.trim().toLocaleLowerCase('tr-TR');
      const ws = k ? [k, ...Object.entries(MSYN).filter(([tr]) => k.includes(tr)).map(([, en]) => en)].join(' ').split(/\s+/).filter((w) => w.length > 2) : [];
      const fvm = favIds('music'), rc = recent();
      const list = musicIndex.filter((m) => {
        if (st.g === '★' && !fvm.includes(m.u)) return false;
        if (st.g === '↺' && !rc.includes(m.u)) return false;
        if (st.g && !['★', '↺'].includes(st.g) && m.g !== st.g) return false;
        if (st.g === 'Klasik' && st.comp !== 'Tümü' && m.c !== st.comp) return false;
        if (st.len === 'short' && m.d >= 60) return false;
        if (st.len === 'mid' && (m.d < 60 || m.d > 180)) return false;
        if (st.len === 'long' && m.d <= 180) return false;
        if (k) { const hay = `${m.t} ${m.c} ${m.g} ${m.a || ''}`.toLocaleLowerCase('tr-TR'); if (!hay.includes(k) && !ws.some((w) => hay.includes(w))) return false; }
        return true;
      });
      if (st.g === '↺') list.sort((a, b) => rc.indexOf(a.u) - rc.indexOf(b.u));
      body.append(h('p', { class: 'hint' }, `${list.length} parça · ▶ dinle, Ekle: oynatıcının olduğu yerden başlar (seviye %35, yumuşak giriş/çıkış)`));
      const box = h('div', { class: 'mus-list' });
      list.slice(0, st.limit).forEach((m, i) => {
        const pb = h('button', { class: 'icon-btn mus-play', html: I.play, 'aria-label': 'Dinle' });
        pb.addEventListener('click', () => preview(m.u, pb));
        box.append(h('div', { class: 'mus-row mus4', style: { '--i': String(Math.min(i, 14)) } }, pb,
          h('div', { class: 'mus-t' }, h('b', {}, m.g === 'Klasik' ? cleanTitle(m) : m.t), h('small', {}, `${GENRE_IC[m.g] || ''} ${m.g === 'Klasik' ? m.c : (m.a || m.c)} · ${fmt(m.d, false)}`, m.by ? h('em', { class: 'mus-by' }, 'atıf') : h('em', { class: 'mus-free' }, 'serbest'))),
          favStar('music', m.u, { name: `${m.c} – ${m.t}` }),
          h('button', { class: 'btn', onclick: async () => {
            stopPreview();
            const b = busy(`İndiriliyor… (${(m.z / 1048576).toFixed(1)} MB)`);
            try {
              const id = `mus-${m.u.split('/').pop().replace(/[^\w.-]/g, '').slice(-60)}`;
              const credit = `${m.t} — ${m.a || m.c} — ${m.l} — ${m.p}`;
              await addAudioBlob(id, `${m.c} – ${m.t}`.slice(0, 80), m.u, { role: 'music', volume: 0.35, fadeIn: 1, fadeOut: 2, credit });
              lsSet(recentKey, JSON.stringify([m.u, ...recent().filter((x) => x !== m.u)].slice(0, 30)));
              if (m.by) { try { await navigator.clipboard.writeText(`Müzik: ${credit}`); } catch (_) { /* yoksay */ } toast('Müzik eklendi. Bu parça atıf istiyor — atıf metni panoya kopyalandı, video açıklamasına yapıştır.', 5000); }
              else toast('Müzik eklendi (kamu malı / CC0 — atıf gerekmez)', 3000);
            } catch (e) { toast('İndirilemedi — internet bağlantısını kontrol et', 4000); } finally { b.close(); }
          } }, 'Ekle')));
      });
      if (list.length > st.limit) box.append(h('button', { class: 'btn block', onclick: () => { st.limit += 60; refreshSheet(); } }, `Daha fazla (${list.length - st.limit})`));
      body.append(box);
      body.append(h('p', { class: 'hint', html: 'Kaynak: Wikimedia Commons. <b>Serbest</b> = kamu malı / CC0, ticari kullanım dahil atıfsız. <b>Atıf</b> = CC BY: kullanırsan video açıklamasına sanatçı adını yaz (Ekle deyince metin panoya kopyalanır).' }));
      let tm = null;
      q.addEventListener('input', () => { st.q = q.value; clearTimeout(tm); tm = setTimeout(() => { st.limit = 60; refreshSheet(); setTimeout(() => { const el = document.querySelector('.panel.focused .search'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 30); }, 350); });
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
