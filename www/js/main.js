// Alpicut — ana uygulama
import { app, $, h, uid, clone, fmt, toast, busy, selected } from './state.js';
import { I, LOGO } from './icons.js';
import { Engine, layoutClips } from './engine.js';
import { RATIOS, DEFAULT_FILTERS, SUB_BASE, FX_BASE, TEXT_BASE, anim } from './presets.js';
import { renderTimeline, bindTimeline, syncScroll, setZoom } from './timeline.js';
import { layerAt, hasKeys, setKey, writeProp, splitKeys } from './kf.js';
import { renderSfx } from './sfx.js';
import {
  openSheet, closeSheet, refreshSheet, isSheetOpen, openInspector, openTemplates, openCTAs,
  openScoreMenu, openSubsMenu, openFx, openRatio, openExport, openShapes, openSfx,
} from './sheets.js';
import { store, lsGet, lsSet, isNative } from './storage.js';
import { parseSRT } from './srt.js';

// ---------- başlat ----------
function init() {
  $('brandLogo').innerHTML = LOGO;
  document.querySelector('.np-plus').innerHTML = I.plus;
  $('btnBack').innerHTML = I.back;
  $('btnUndo').innerHTML = I.undo;
  $('btnRedo').innerHTML = I.redo;
  $('btnZoomIn').innerHTML = I.zoomIn;
  $('btnFirst').innerHTML = I.first;
  $('btnPrevF').innerHTML = I.prevF;
  $('btnNextF').innerHTML = I.nextF;
  const step = (d) => { app.pause(); app.engine.seek(Math.round((app.engine.t + d) * 30) / 30); updateTime(); syncScroll(app.engine.t, true); };
  $('btnFirst').addEventListener('click', () => step(-1e9));
  $('btnPrevF').addEventListener('click', () => step(-1 / 30));
  $('btnNextF').addEventListener('click', () => step(1 / 30));
  $('btnZoomOut').innerHTML = I.zoomOut;
  $('sheetClose').innerHTML = I.check;

  app.newRatio = lsGet('alpicut.ratio', '9:16');
  renderRatioPick();

  app.engine = new Engine($('preview'));
  app.engine.onTime = (t) => {
    updateTime();
    syncScroll(t);
    if (app.stopAt != null && t >= app.stopAt) app.pause();
  };
  app.engine.onEnd = () => updateTime();

  buildToolbar();
  bindTimeline();
  bindPreview();

  $('newProject').addEventListener('click', () => newProject());
  $('btnBack').addEventListener('click', () => { if (isSheetOpen()) closeSheet(); goHome(); });
  $('btnPlay').addEventListener('click', () => (app.engine.playing ? app.pause() : app.play()));
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnZoomIn').addEventListener('click', () => setZoom(app.pps * 1.5));
  $('btnZoomOut').addEventListener('click', () => setZoom(app.pps / 1.5));
  $('btnExport').addEventListener('click', () => { if (isSheetOpen()) closeSheet(); openExport(); });
  $('sheetClose').addEventListener('click', () => closeSheet());
  $('projName').addEventListener('change', () => { app.P.name = $('projName').value.trim() || 'Adsız proje'; commit(); });

  window.addEventListener('popstate', () => {
    if (window.__skipPop > 0) { window.__skipPop--; return; }
    if (isSheetOpen()) { closeSheet(true); return; }
    if (!$('exportModal').classList.contains('hidden')) { try { history.pushState({ v: 'editor' }, ''); } catch (_) { /* yoksay */ } return; }
    if (!$('editor').classList.contains('hidden')) goHome(true);
  });
  window.addEventListener('resize', () => { if (app.P) { fitStage(); renderTimeline(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.P) { app.pause(); saveNow(); } });
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => app.engine.requestDraw());
  loadFonts();
  renderHome();
}

async function loadFonts() {
  if (!document.fonts) return;
  if (!isNative()) {
    // tarayıcıda denerken Google Fonts yedeği
    document.head.append(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,800;1,900&family=Barlow+Semi+Condensed:ital,wght@0,500;0,600;0,700;1,600&display=swap' }));
  }
  const specs = [
    '400 20px "Barlow"', '600 20px "Barlow"', '700 20px "Barlow"',
    '500 20px "Barlow Semi Condensed"', '600 20px "Barlow Semi Condensed"', '700 20px "Barlow Semi Condensed"', 'italic 600 20px "Barlow Semi Condensed"',
    '600 20px "Barlow Condensed"', '700 20px "Barlow Condensed"', '800 20px "Barlow Condensed"', '900 20px "Barlow Condensed"',
    'italic 800 20px "Barlow Condensed"', 'italic 900 20px "Barlow Condensed"',
  ];
  try { await Promise.all(specs.map((s) => document.fonts.load(s, 'AĞŞİığşçöü'))); } catch (_) { /* yoksay */ }
  app.engine.requestDraw();
}

// ---------- araç çubuğu ----------
function buildToolbar() {
  const tools = [
    ['media', 'Medya', () => addMedia('clip'), true],
    ['layer', 'Katman', () => addMedia('layer')],
    ['text', 'Yazı', () => addLayer(clone(TEXT_BASE))],
    ['template', 'Şablon', openTemplates],
    ['subtitle', 'Altyazı', openSubsMenu],
    ['audio', 'Ses', () => addMedia('audio')],
    ['cta', 'Çağrı', openCTAs],
    ['score', 'Skor', openScoreMenu],
    ['shape', 'Şekil', openShapes],
    ['sfx', 'SFX', openSfx],
    ['fx', 'Efekt', openFx],
    ['ratio', 'Oran', openRatio],
  ];
  const bar = $('toolbar');
  tools.forEach(([ic, label, fn, primary]) => {
    bar.append(h('button', { class: `tool${primary ? ' primary' : ''}`, onclick: () => { app.pause(); fn(); } },
      h('span', { class: 'ti', html: I[ic] }), label));
  });
}

// ---------- ana ekran ----------
function renderRatioPick() {
  const box = $('ratioPick');
  box.textContent = '';
  Object.keys(RATIOS).forEach((r) => {
    box.append(h('button', { class: app.newRatio === r ? 'on' : '', onclick: () => { app.newRatio = r; lsSet('alpicut.ratio', r); renderRatioPick(); } }, r));
  });
}

async function renderHome() {
  const list = $('projectList');
  let projects = [];
  try { projects = await store.allProjects(); } catch (e) { console.warn(e); }
  projects.sort((a, b) => b.updated - a.updated);
  list.textContent = '';
  if (!projects.length) {
    list.append(h('div', { class: 'empty-projects' }, 'Henüz proje yok. İlk videonu oluşturmak için “Yeni Proje”ye dokun.'));
    return;
  }
  projects.forEach((p) => {
    const d = new Date(p.updated);
    const card = h('div', { class: 'pcard' },
      h('button', { class: 'thumb', style: { backgroundImage: p.thumb ? `url(${p.thumb})` : '', width: '100%' }, onclick: () => openProject(p.id), html: p.thumb ? '' : I.media }),
      h('span', { class: 'dur' }, fmt(p.duration || 0, false)),
      h('button', { class: 'pmenu', html: I.more, onclick: () => projectMenu(p) }),
      h('button', { class: 'meta', style: { width: '100%', textAlign: 'left' }, onclick: () => openProject(p.id) },
        h('b', {}, p.name || 'Adsız proje'),
        h('small', {}, `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`)));
    list.append(card);
  });
}

function projectMenu(p) {
  openSheet({
    title: p.name || 'Proje',
    render: (body) => {
      body.append(h('button', { class: 'btn block', style: { marginBottom: '8px' }, html: `${I.edit} Yeniden adlandır`, onclick: async () => {
        const n = prompt('Proje adı', p.name || '');
        if (n == null) return;
        const rec = await store.getProject(p.id);
        rec.name = n.trim() || rec.name; rec.data.name = rec.name;
        await store.putProject(rec); closeSheet(); renderHome();
      } }));
      body.append(h('button', { class: 'btn block', style: { marginBottom: '8px' }, html: `${I.copy} Kopyasını oluştur`, onclick: async () => {
        const rec = await store.getProject(p.id);
        const n = clone(rec); n.id = uid(); n.name = `${rec.name} (kopya)`; n.data.id = n.id; n.data.name = n.name; n.updated = Date.now();
        await store.putProject(n); closeSheet(); renderHome();
      } }));
      body.append(h('button', { class: 'btn block danger', html: `${I.trash} Projeyi sil`, onclick: async () => {
        if (!confirm(`"${p.name}" silinsin mi? Bu işlem geri alınamaz.`)) return;
        await deleteProject(p.id); closeSheet(); renderHome();
      } }));
    },
  });
}

function mediaIds(P) {
  const s = new Set();
  P.clips.forEach((c) => s.add(c.mediaId));
  P.layers.forEach((l) => { if (l.mediaId) s.add(l.mediaId); });
  P.audio.forEach((a) => s.add(a.mediaId));
  return s;
}

async function deleteProject(id) {
  const all = await store.allProjects();
  const target = all.find((p) => p.id === id);
  if (!target) return;
  const keep = new Set();
  all.filter((p) => p.id !== id).forEach((p) => mediaIds(p.data).forEach((m) => keep.add(m)));
  for (const m of mediaIds(target.data)) if (!keep.has(m)) { try { await store.delMedia(m); } catch (_) { /* yoksay */ } }
  await store.delProject(id);
}

function newProject() {
  const n = (Number(lsGet('alpicut.count', '0')) || 0) + 1;
  lsSet('alpicut.count', String(n));
  const P = {
    id: uid(), name: `Proje ${n}`, ratio: app.newRatio, clips: [], layers: [], audio: [],
    subs: clone(SUB_BASE), fx: clone(FX_BASE), created: Date.now(), v: PROJECT_VERSION,
  };
  showEditor(P);
  saveNow();
}

async function openProject(id) {
  const b = busy('Proje açılıyor…');
  try {
    const rec = await store.getProject(id);
    if (!rec) throw new Error('Proje bulunamadı');
    const P = rec.data;
    migrate(P);
    P.subs = P.subs || clone(SUB_BASE);
    P.fx = { ...clone(FX_BASE), ...(P.fx || {}) };
    let missing = 0;
    for (const mid of mediaIds(P)) {
      if (app.engine.media.has(mid)) continue;
      const m = await store.getMedia(mid);
      if (m) registerMedia(m); else missing++;
    }
    if (missing) toast(`${missing} medya dosyası bulunamadı`);
    showEditor(P);
  } catch (e) {
    toast(`Açılamadı: ${e.message || e}`);
  } finally { b.close(); }
}

function showEditor(P) {
  app.P = P;
  app.sel = null;
  app.undo = []; app.redo = [];
  app.snap = JSON.stringify(P);
  $('home').classList.add('hidden');
  $('editor').classList.remove('hidden');
  $('projName').value = P.name;
  try { history.pushState({ v: 'editor' }, ''); } catch (_) { /* yoksay */ }
  app.engine.selectedId = null;
  app.engine.setProject(P);
  requestAnimationFrame(() => {
    fitStage();
    app.engine.seek(0);
    renderTimeline();
    updateTime();
    updateUndo();
  });
}

function goHome(fromPop = false) {
  if (!app.P) return;
  app.pause();
  saveNow();
  $('exportModal').classList.add('hidden');
  $('editor').classList.add('hidden');
  $('home').classList.remove('hidden');
  app.P = null;
  app.sel = null;
  if (!fromPop && history.state?.v === 'editor') { try { history.back(); } catch (_) { /* yoksay */ } }
  setTimeout(renderHome, 200);
}

// ---------- kaydetme / geçmiş ----------
function scheduleSave() {
  clearTimeout(app.saveTimer);
  app.saveTimer = setTimeout(saveNow, 1200);
}

async function saveNow() {
  clearTimeout(app.saveTimer);
  const P = app.P;
  if (!P) return;
  const first = P.clips[0];
  const thumb = first ? app.engine.media.get(first.mediaId)?.thumb : null;
  try {
    await store.putProject({ id: P.id, name: P.name, updated: Date.now(), thumb, duration: app.engine.duration(), data: clone(P) });
  } catch (e) { console.warn('kaydedilemedi', e); }
}

function commit() {
  const P = app.P;
  if (!P) return;
  const snap = JSON.stringify(P);
  if (snap !== app.snap) {
    app.undo.push(app.snap);
    if (app.undo.length > 80) app.undo.shift();
    app.snap = snap;
    app.redo = [];
    scheduleSave();
  }
  app.engine.sync(app.engine.t);
  app.engine.requestDraw();
  renderTimeline();
  updateTime();
  updateUndo();
}

function restore(snap) {
  const P = JSON.parse(snap);
  app.P = P;
  app.snap = snap;
  app.engine.setProject(P);
  $('projName').value = P.name;
  if (app.sel && !selected()) deselect();
  app.engine.selectedId = app.sel?.type === 'layer' ? app.sel.id : null;
  fitStage();
  app.engine.seek(Math.min(app.engine.t, app.engine.duration()));
  renderTimeline();
  updateTime();
  updateUndo();
  refreshSheet();
  scheduleSave();
}

function undo() { if (!app.undo.length) return; app.redo.push(app.snap); restore(app.undo.pop()); }
function redo() { if (!app.redo.length) return; app.undo.push(app.snap); restore(app.redo.pop()); }
function updateUndo() { $('btnUndo').disabled = !app.undo.length; $('btnRedo').disabled = !app.redo.length; }

// ---------- önizleme ----------
function fitStage() {
  if (!app.P) return;
  const wrap = $('previewWrap').getBoundingClientRect();
  const [W, H] = RATIOS[app.P.ratio];
  const aw = Math.max(50, wrap.width - 16), ah = Math.max(50, wrap.height - 16);
  const cw = Math.min(aw, (ah * W) / H);
  const ch = (cw * H) / W;
  const cv = $('preview');
  cv.style.width = `${cw}px`;
  cv.style.height = `${ch}px`;
  const dpr = window.devicePixelRatio || 1;
  if (!app.engine.exporting) app.engine.resize(Math.max(0.3, Math.min(0.6, (cw * dpr) / W)));
}

function updateTime() {
  const E = app.engine;
  if (!app.P) return;
  $('timeCode').textContent = `${fmt(E.t)} / ${fmt(E.duration())}`;
  $('btnPlay').innerHTML = E.playing ? I.pause : I.play;
  $('emptyHint').classList.toggle('hidden', !!(app.P.clips.length || app.P.layers.length));
}

function bindPreview() {
  const stage = $('stage');
  const cv = $('preview');
  const ptrs = new Map();
  let g = null;
  const norm = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const sizeKey = (L) => (L.kind === 'media' ? 'w' : L.kind === 'text' ? 'size' : 'scale');

  stage.addEventListener('pointerdown', (e) => {
    if (!app.P) return;
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ }
    ptrs.set(e.pointerId, norm(e));
    if (ptrs.size === 1) {
      if (app.engine.playing) app.pause();
      const p = norm(e);
      const hit = app.engine.hitTest(p.x, p.y);
      const kv = hit ? layerAt(hit, app.engine.t) : null;
      g = { L: hit, p0: p, x0: kv?.x, y0: kv?.y, moved: false, wasSel: hit && app.sel?.id === hit.id };
      if (hit && !g.wasSel) { app.sel = { type: 'layer', id: hit.id }; app.engine.selectedId = hit.id; app.engine.requestDraw(); }
    } else if (ptrs.size === 2 && g?.L) {
      const [a, b] = [...ptrs.values()];
      const ar = RATIOS[app.P.ratio][1] / RATIOS[app.P.ratio][0];
      const kv = layerAt(g.L, app.engine.t);
      g.pinch = { d: Math.hypot(a.x - b.x, (a.y - b.y) * ar), ang: Math.atan2((b.y - a.y) * ar, b.x - a.x), size: hasKeys(g.L, 's') ? kv.s : (g.L[sizeKey(g.L)] ?? 1), rot: kv.rot };
      g.moved = true;
    }
  });

  stage.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId) || !g) return;
    ptrs.set(e.pointerId, norm(e));
    const L = g.L;
    if (!L) return;
    if (ptrs.size === 1 && !g.pinch) {
      const p = norm(e);
      const dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      if (!g.moved && Math.hypot(dx, dy) < 0.012) return;
      g.moved = true;
      let nx = g.x0 + dx, ny = g.y0 + dy;
      const gx = Math.abs(nx - 0.5) < 0.015, gy = Math.abs(ny - 0.5) < 0.012;
      if (gx) nx = 0.5;
      if (gy) ny = 0.5;
      const lt = app.engine.t - L.start;
      writeProp(L, 'x', lt, nx); writeProp(L, 'y', lt, ny);
      app.engine.guides = { x: gx, y: gy };
      app.engine.requestDraw();
    } else if (ptrs.size === 2 && g.pinch) {
      const [a, b] = [...ptrs.values()];
      const ar = RATIOS[app.P.ratio][1] / RATIOS[app.P.ratio][0];
      const d = Math.hypot(a.x - b.x, (a.y - b.y) * ar);
      const ang = Math.atan2((b.y - a.y) * ar, b.x - a.x);
      const k = sizeKey(L);
      const v = g.pinch.size * (d / Math.max(0.01, g.pinch.d));
      const lt = app.engine.t - L.start;
      if (hasKeys(L, 's')) setKey(L, 's', lt, Math.max(0.05, Math.min(4, v)));
      else L[k] = k === 'size' ? Math.round(Math.max(16, Math.min(400, v))) : Math.max(0.05, Math.min(4, v));
      let rot = g.pinch.rot + ((ang - g.pinch.ang) * 180) / Math.PI;
      if (Math.abs(rot) < 4) rot = 0;
      writeProp(L, 'rot', lt, Math.round(rot));
      app.engine.requestDraw();
    }
  });

  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size > 0) return;
    app.engine.guides = null;
    const G = g; g = null;
    if (!G) return;
    if (G.moved) { commit(); refreshSheet(); return; }
    if (G.L) select({ type: 'layer', id: G.L.id });
    else { deselect(); if (isSheetOpen()) closeSheet(); }
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
}

// ---------- seçim ----------
function select(sel, tab, extra) {
  app.sel = sel;
  app.engine.selectedId = sel.type === 'layer' ? sel.id : null;
  app.engine.requestDraw();
  renderTimeline();
  openInspector(tab, extra);
}

function deselect() {
  app.sel = null;
  app.engine.selectedId = null;
  app.engine.requestDraw();
  renderTimeline();
}

// ---------- medya ekleme ----------
function pickFiles(accept, multiple = true) {
  return new Promise((resolve) => {
    const inp = $('fileInput');
    inp.value = '';
    if (accept) inp.setAttribute('accept', accept); else inp.removeAttribute('accept');
    inp.multiple = multiple;
    inp.onchange = () => resolve([...inp.files]);
    inp.click();
  });
}

function kindOf(f) {
  const t = f.type || '';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) return 'video';
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'bmp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'].includes(ext)) return 'audio';
  return 'video';
}

function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), ms))]); }

async function probe(blob, kind) {
  const url = URL.createObjectURL(blob);
  try {
    if (kind === 'image') {
      const img = new Image();
      await withTimeout(new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('resim açılamadı')); img.src = url; }), 15000);
      return { w: img.naturalWidth, h: img.naturalHeight, duration: 0, thumb: thumbOf(img, img.naturalWidth, img.naturalHeight) };
    }
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
    el.preload = 'auto'; el.muted = true; el.playsInline = true; el.src = url;
    await withTimeout(new Promise((res, rej) => { el.onloadedmetadata = res; el.onerror = () => rej(new Error('dosya açılamadı')); }), 20000);
    let duration = el.duration;
    if (!isFinite(duration)) {
      el.currentTime = 1e7;
      await withTimeout(new Promise((res) => { el.ontimeupdate = () => { el.ontimeupdate = null; res(); }; }), 8000).catch(() => {});
      duration = isFinite(el.duration) ? el.duration : 10;
    }
    if (kind === 'audio') return { duration, w: 0, h: 0, thumb: null };
    el.currentTime = Math.min(0.6, duration / 3);
    await withTimeout(new Promise((res) => { el.onseeked = res; }), 8000).catch(() => {});
    let thumb = null;
    try { thumb = thumbOf(el, el.videoWidth, el.videoHeight); } catch (_) { /* yoksay */ }
    return { duration, w: el.videoWidth, h: el.videoHeight, thumb };
  } finally { URL.revokeObjectURL(url); }
}

function thumbOf(src, w, h) {
  if (!w || !h) return null;
  const th = 112, tw = Math.round((th * w) / h);
  const c = document.createElement('canvas');
  c.width = Math.min(tw, 220); c.height = th;
  const ctx = c.getContext('2d');
  const k = Math.max(c.width / w, c.height / h);
  ctx.drawImage(src, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k);
  return c.toDataURL('image/jpeg', 0.6);
}

function registerMedia(rec) {
  const url = URL.createObjectURL(rec.blob);
  app.engine.media.set(rec.id, { ...rec, url });
  return app.engine.media.get(rec.id);
}

async function importFiles(files, forceAudio = false) {
  const out = [];
  const b = busy('Medya ekleniyor…');
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      b.set(`Medya ekleniyor… (${i + 1}/${files.length})`);
      const kind = forceAudio && kindOf(f) === 'video' ? 'video' : kindOf(f);
      try {
        const meta = await probe(f, kind);
        const rec = { id: uid(), kind, name: f.name, blob: f, ...meta };
        try { await store.putMedia(rec); } catch (e) { console.warn(e); toast('Uyarı: medya cihaza kaydedilemedi, proje kapanınca kaybolabilir'); }
        out.push(registerMedia(rec));
      } catch (e) { toast(`${f.name}: ${e.message || 'açılamadı'}`); }
    }
  } finally { b.close(); }
  return out;
}

async function addMedia(target) {
  const accept = target === 'audio' ? 'audio/*,video/*' : 'video/*,image/*';
  const files = await pickFiles(accept, target !== 'audio');
  if (!files.length) return;
  const recs = await importFiles(files, target === 'audio');
  if (!recs.length) return;
  const P = app.P;
  const t = app.engine.t;
  const [W, H] = RATIOS[P.ratio];
  let last = null;
  recs.forEach((m) => {
    if (target === 'clip') {
      if (m.kind === 'audio') { P.audio.push(newAudio(m, t)); return; }
      const wide = m.w && m.h && (m.w / m.h) > (W / H) * 1.3;
      const c = {
        id: uid(), mediaId: m.id, type: m.kind === 'image' ? 'image' : 'video',
        in: 0, out: m.duration || 3, dur: 3, speed: 1, volume: 1, mute: false,
        fit: wide ? 'contain' : 'cover', bgMode: 'blur', bgColor: '#000000', zoom: 1, panX: 0, panY: 0,
        kenburns: m.kind === 'image', filters: { ...DEFAULT_FILTERS }, filterPreset: 'none', trans: { type: 'none', dur: 0.5 },
      };
      P.clips.push(c); last = { type: 'clip', id: c.id };
    } else if (target === 'layer') {
      if (m.kind === 'audio') { P.audio.push(newAudio(m, t)); return; }
      const dur = m.kind === 'image' ? 4 : Math.min(m.duration || 4, 15);
      const l = {
        id: uid(), kind: 'media', mediaId: m.id, start: t, end: t + dur, in: 0, out: m.duration || dur,
        x: 0.5, y: 0.42, w: 0.72, rot: 0, opacity: 1, crop: 'none', radius: 28, borderW: 0, borderColor: '#FFFFFF',
        shadowOn: true, kenburns: false, volume: 0, loop: false, filters: { ...DEFAULT_FILTERS }, filterPreset: 'none',
        anim: anim('pop', 'fade'),
      };
      P.layers.push(l); last = { type: 'layer', id: l.id };
    } else {
      const a = newAudio(m, t); P.audio.push(a); last = { type: 'audio', id: a.id };
    }
  });
  commit();
  if (target !== 'clip' && last) select(last);
  else if (P.clips.length === recs.length) { app.engine.seek(0); syncScroll(0, true); }
}

function newAudio(m, t) {
  return { id: uid(), mediaId: m.id, start: t, in: 0, out: m.duration || 10, volume: 1, fadeIn: 0, fadeOut: 0 };
}

function addLayer(L, dur = 3) {
  const t = app.engine.t;
  L.id = uid();
  L.start = t;
  L.end = t + dur;
  app.P.layers.push(L);
  commit();
  closeSheet();
  setTimeout(() => select({ type: 'layer', id: L.id }), 240);
}

// ---------- düzenleme işlemleri ----------
function splitSel() {
  const s = app.sel, o = selected();
  const t = app.engine.t;
  const P = app.P;
  if (!s || !o) return;
  if (s.type === 'clip') {
    const L = layoutClips(P.clips).find((x) => x.clip === o);
    const local = t - L.start;
    if (local < 0.1 || local > L.len - 0.1) { toast('Bölmek için oynatıcıyı klibin üzerine getir'); return; }
    const n = clone(o); n.id = uid(); n.trans = { type: 'none', dur: 0.5 };
    if (o.type === 'image' || o.freeze) { n.dur = L.len - local; o.dur = local; } else { const st = o.in + local * (o.speed || 1); o.out = st; n.in = st; }
    splitKeys(o, n, local);
    P.clips.splice(P.clips.indexOf(o) + 1, 0, n);
  } else if (s.type === 'layer') {
    if (t < o.start + 0.1 || t > o.end - 0.1) { toast('Bölmek için oynatıcıyı katmanın üzerine getir'); return; }
    const n = clone(o); n.id = uid();
    if (o.kind === 'media') n.in = (o.in || 0) + (t - o.start);
    splitKeys(o, n, t - o.start);
    o.end = t; n.start = t;
    P.layers.splice(P.layers.indexOf(o) + 1, 0, n);
  } else if (s.type === 'audio') {
    const local = t - o.start;
    if (local < 0.1 || local > o.out - o.in - 0.1) { toast('Bölmek için oynatıcıyı sesin üzerine getir'); return; }
    const n = clone(o); n.id = uid();
    const st = o.in + local; o.out = st; n.in = st; n.start = t;
    P.audio.splice(P.audio.indexOf(o) + 1, 0, n);
  }
  commit();
  refreshSheet();
  toast('Bölündü');
}

function dupSel() {
  const s = app.sel, o = selected();
  const P = app.P;
  if (!s || !o) return;
  const n = clone(o); n.id = uid();
  if (s.type === 'clip') P.clips.splice(P.clips.indexOf(o) + 1, 0, n);
  else if (s.type === 'layer') { const len = o.end - o.start; n.start = o.end; n.end = o.end + len; P.layers.push(n); }
  else if (s.type === 'audio') { n.start = o.start + (o.out - o.in); P.audio.push(n); }
  commit();
  select({ type: s.type, id: n.id });
  toast('Kopyalandı');
}

function delSel() {
  const s = app.sel, o = selected();
  const P = app.P;
  if (!s || !o) return;
  if (s.type === 'clip') P.clips.splice(P.clips.indexOf(o), 1);
  else if (s.type === 'layer') P.layers.splice(P.layers.indexOf(o), 1);
  else if (s.type === 'audio') P.audio.splice(P.audio.indexOf(o), 1);
  else if (s.type === 'subs') P.subs.cues = [];
  closeSheet();
  deselect();
  app.engine.seek(Math.min(app.engine.t, app.engine.duration()));
  commit();
}

function moveClip(dir) {
  const P = app.P, o = selected();
  const i = P.clips.indexOf(o), j = i + dir;
  if (i < 0 || j < 0 || j >= P.clips.length) return;
  [P.clips[i], P.clips[j]] = [P.clips[j], P.clips[i]];
  commit();
  refreshSheet();
}

function layerOrder(dir) {
  const P = app.P, o = selected();
  const i = P.layers.indexOf(o), j = i + dir;
  if (i < 0 || j < 0 || j >= P.layers.length) { toast(dir > 0 ? 'Zaten en önde' : 'Zaten en arkada'); return; }
  [P.layers[i], P.layers[j]] = [P.layers[j], P.layers[i]];
  commit();
  toast(dir > 0 ? 'Öne getirildi' : 'Arkaya gönderildi');
}

const PROJECT_VERSION = 2;
function migrate(P) {
  // eski projeleri yeni sürüme taşı
  P.v = P.v || 1;
  P.layers.forEach((l) => { if (l.sc == null) l.sc = 1; if (!l.kf) l.kf = {}; });
  P.clips.forEach((c) => { if (!c.kf) c.kf = {}; });
  if (P.subs && P.subs.burn == null) P.subs.burn = true;
  P.v = PROJECT_VERSION;
}

function freezeFrame() {
  const o = selected();
  const P = app.P;
  if (!o || o.type !== 'video' || o.freeze) return;
  const L = layoutClips(P.clips).find((x) => x.clip === o);
  const local = app.engine.t - L.start;
  if (local < 0 || local > L.len) { toast('Dondurmak için oynatıcıyı klibin üzerine getir'); return; }
  const at = Math.min(o.out - 0.04, o.in + local * (o.speed || 1));
  const fr = { ...clone(o), id: uid(), freeze: true, freezeAt: at, dur: 2, trans: { type: 'none', dur: 0.5 }, kf: {} };
  const i = P.clips.indexOf(o);
  if (local > 0.1 && local < L.len - 0.1) {
    const rest = clone(o); rest.id = uid(); rest.trans = { type: 'none', dur: 0.5 };
    o.out = at; rest.in = at;
    splitKeys(o, rest, local);
    P.clips.splice(i + 1, 0, fr, rest);
  } else if (local <= 0.1) P.clips.splice(i, 0, fr);
  else P.clips.splice(i + 1, 0, fr);
  commit();
  select({ type: 'clip', id: fr.id });
  toast('Kare donduruldu (2 sn)');
}

async function addSfx(id, name) {
  const mid = `sfx-${id}`;
  try {
    if (!app.engine.media.has(mid)) {
      let rec = await store.getMedia(mid).catch(() => null);
      if (!rec) {
        const r = await renderSfx(id);
        rec = { id: mid, kind: 'audio', name: `SFX · ${name}`, blob: r.blob, duration: r.duration, w: 0, h: 0, thumb: null };
        try { await store.putMedia(rec); } catch (_) { /* yoksay */ }
      }
      registerMedia(rec);
    }
    const m = app.engine.media.get(mid);
    const a = { ...newAudio(m, app.engine.t), sfx: true };
    app.P.audio.push(a);
    commit();
    toast(`${name} eklendi`);
  } catch (e) { toast(`Eklenemedi: ${e.message || e}`); }
}

// ---------- kişisel stiller ----------
function getStyles(kind) {
  try { return JSON.parse(lsGet('alpicut.styles', '[]')).filter((x) => !kind || x.kind === kind); } catch (_) { return []; }
}
function putStyles(list) { lsSet('alpicut.styles', JSON.stringify(list)); }
function saveStyle(kind, obj) {
  const name = prompt('Stil adı', kind === 'text' ? ((obj.text || '').split('\n')[0].replace(/\*/g, '').slice(0, 24) || 'Yazı stilim') : 'Altyazı stilim');
  if (name == null) return;
  const data = clone(obj);
  ['id', 'start', 'end', 'kf', 'mediaId'].forEach((k) => delete data[k]);
  const list = getStyles();
  list.unshift({ id: uid(), kind, name: name.trim() || 'Stilim', data });
  putStyles(list);
  toast('Stil kaydedildi');
}
function deleteStyle(id) { putStyles(getStyles().filter((x) => x.id !== id)); }
async function exportStyles() {
  const blob = new Blob([JSON.stringify({ app: 'alpicut', type: 'styles', v: 1, styles: getStyles() }, null, 1)], { type: 'application/json' });
  const { saveVideo } = await import('./storage.js');
  const r = await saveVideo(blob, 'alpicut-stillerim.json', { share: true });
  toast(r.where ? `${r.where} klasörüne kaydedildi` : 'Kaydedildi');
}
async function importStyles() {
  const files = await pickFiles('', false);
  if (!files.length) return;
  try {
    const d = JSON.parse(await files[0].text());
    if (d.app !== 'alpicut' || !Array.isArray(d.styles)) throw new Error('Alpicut stil dosyası değil');
    const list = getStyles();
    const ids = new Set(list.map((x) => x.id));
    let n = 0;
    d.styles.forEach((st) => { if (st && st.kind && st.data && !ids.has(st.id)) { list.push(st); n++; } });
    putStyles(list);
    toast(`${n} stil eklendi`);
    refreshSheet();
  } catch (e) { toast(`Yüklenemedi: ${e.message || e}`); }
}

async function importSRT() {
  const files = await pickFiles('', false);
  if (!files.length) return;
  try {
    const text = await files[0].text();
    const cues = parseSRT(text);
    if (!cues.length) { toast('Bu dosyada altyazı bulunamadı'); return; }
    const P = app.P;
    if (!P.subs) P.subs = clone(SUB_BASE);
    P.subs.cues = cues;
    P.subs.offset = 0;
    commit();
    toast(`${cues.length} altyazı satırı eklendi`);
    select({ type: 'subs', id: 'subs' }, 'Stil');
  } catch (e) { toast(`SRT okunamadı: ${e.message || e}`); }
}

// ---------- uygulama arayüzü (diğer modüller için) ----------
let tlSoon = null;
Object.assign(app, {
  change(final) {
    app.engine.sync(app.engine.t);
    app.engine.requestDraw();
    if (final) commit();
  },
  commit,
  refreshTimeline: () => renderTimeline(),
  refreshTimelineSoon: () => { clearTimeout(tlSoon); tlSoon = setTimeout(renderTimeline, 400); },
  updateTime,
  syncScroll: () => syncScroll(app.engine.t, true),
  play() { app.stopAt = null; app.engine.play(); updateTime(); },
  pause() { app.stopAt = null; app.engine.pause(); updateTime(); },
  previewRange(a, b) {
    app.engine.seek(Math.max(0, a));
    app.engine.play();
    app.stopAt = b;
    updateTime();
  },
  select, deselect,
  openInspector: (tab) => openInspector(tab),
  addMedia, addLayer, splitSel, dupSel, delSel, moveClip, layerOrder, importSRT, freezeFrame, addSfx,
  getStyles, saveStyle, deleteStyle, exportStyles, importStyles,
  layout: () => layoutClips(app.P.clips),
  fitStage,
});

init();
window.__alpicut = app; // hata ayıklama için
