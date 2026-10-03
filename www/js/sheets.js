// Alpicut — alt paneller: denetçi, ekleme menüleri, dışa aktarma
import { app, $, h, getPath, setPath, clone, fmt, toast, selected, uid } from './state.js';
import { I } from './icons.js';
import {
  FONTS, WEIGHTS, ANIM_IN, ANIM_OUT, ANIM_LOOP, TRANSITIONS, FILTER_PRESETS, DEFAULT_FILTERS,
  TEXT_BASE, TEXT_TEMPLATES, CTA_BASE, CTA_PRESETS, SCORE_BASE, SUB_PRESETS, SUB_BASE, RATIOS,
} from './presets.js';
import { drawText, drawCTA, drawScore, ICON_NAMES } from './render.js';
import { Engine } from './engine.js';
import { saveVideo, isNative } from './storage.js';
import { parseSRT, toSRT } from './srt.js';

// ---------- panel altyapısı ----------
let cur = null;

export function isSheetOpen() { return !!cur; }

export function openSheet(cfg) {
  const wasOpen = !!cur;
  cur = { tab: cfg.tab || (cfg.tabs && cfg.tabs[0]) || null, ...cfg };
  $('sheetTitle').textContent = cfg.title || '';
  const sh = $('sheet');
  sh.classList.toggle('tall', !!cfg.tall);
  sh.classList.add('open');
  sh.setAttribute('aria-hidden', 'false');
  renderActions();
  renderTabs();
  renderBody();
  if (!wasOpen) { try { history.pushState({ v: 'sheet' }, ''); } catch (_) { /* yoksay */ } }
}

export function closeSheet(fromPop = false) {
  if (!cur) return;
  const onClose = cur.onClose;
  cur = null;
  const sh = $('sheet');
  sh.classList.remove('open');
  sh.setAttribute('aria-hidden', 'true');
  if (onClose) onClose();
  if (!fromPop && history.state?.v === 'sheet') { window.__skipPop = (window.__skipPop || 0) + 1; try { history.back(); } catch (_) { window.__skipPop--; } }
}

export function refreshSheet() {
  if (!cur) return;
  if (cur.refresh) { const r = cur.refresh(); if (r === false) { closeSheet(); return; } }
  renderActions();
  renderTabs();
  renderBody();
}

function renderActions() {
  const box = $('sheetActions');
  box.textContent = '';
  (cur.actions || []).forEach((a) => {
    box.append(h('button', { class: `icon-btn${a.danger ? ' danger' : ''}`, html: a.icon, 'aria-label': a.label, title: a.label, onclick: a.onClick }));
  });
}

function renderTabs() {
  const box = $('sheetTabs');
  box.textContent = '';
  (cur.tabs || []).forEach((t) => {
    box.append(h('button', { class: t === cur.tab ? 'on' : '', onclick: () => { cur.tab = t; renderTabs(); renderBody(); } }, t));
  });
}

function renderBody() {
  const body = $('sheetBody');
  const st = body.scrollTop;
  body.textContent = '';
  cur.render(body, cur.tab);
  body.scrollTop = st;
}

// ---------- alan oluşturucu ----------
const SWATCHES = ['#FFFFFF', '#000000', '#FACC15', '#C084FC', '#8B5CF6', '#E879F9', '#F43F5E', '#22C55E', '#3B82F6', '#F97316'];

function toHex(c) {
  if (!c) return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map((x) => x + x).join('');
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
  return '#000000';
}

function setRangeFill(inp) {
  const p = ((inp.value - inp.min) / (inp.max - inp.min)) * 100;
  inp.style.setProperty('--p', `${p}%`);
}

export function fields(obj, list, opts = {}) {
  const frag = document.createDocumentFragment();
  const change = (f, v, final) => {
    setPath(obj, f.path, v);
    if (f.post) f.post(obj, v);
    app.change(final);
    if (final && (f.rerender || opts.rerender)) refreshSheet();
  };
  list.forEach((f) => {
    if (!f || f.hide) return;
    if (f.type === 'el') { frag.append(f.el); return; }
    if (f.type === 'hint') { frag.append(h('p', { class: 'hint', html: f.html })); return; }
    const v = getPath(obj, f.path);
    let ctl, valEl = null;
    const full = ['chips', 'textarea', 'text', 'color'].includes(f.type) || f.full;
    switch (f.type) {
      case 'range': {
        const fmtv = f.fmt || ((x) => (Math.round(x * 100) / 100).toString());
        valEl = h('span', { class: 'val' }, fmtv(v ?? f.min));
        ctl = h('input', { type: 'range', min: f.min, max: f.max, step: f.step || 0.01, value: v ?? f.min });
        setRangeFill(ctl);
        ctl.addEventListener('input', () => { const x = parseFloat(ctl.value); valEl.textContent = fmtv(x); setRangeFill(ctl); change(f, x, false); });
        ctl.addEventListener('change', () => change(f, parseFloat(ctl.value), true));
        break;
      }
      case 'color': {
        ctl = h('div', { class: 'swatches' });
        const inp = h('input', { type: 'color', value: toHex(v) });
        (f.swatches || SWATCHES).forEach((c) => {
          ctl.append(h('button', { class: toHex(v).toLowerCase() === c.toLowerCase() ? 'on' : '', style: { background: c }, 'aria-label': c, onclick: () => { change(f, c, true); refreshSheet(); } }));
        });
        inp.addEventListener('input', () => change(f, inp.value, false));
        inp.addEventListener('change', () => change(f, inp.value, true));
        ctl.append(inp);
        break;
      }
      case 'chips': {
        ctl = h('div', { class: 'chips' });
        f.options.forEach(([val, lbl]) => {
          const b = h('button', { class: String(v) === String(val) ? 'on' : '' }, lbl);
          b.addEventListener('click', () => {
            ctl.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
            b.classList.add('on');
            change(f, val, true);
          });
          ctl.append(b);
        });
        break;
      }
      case 'toggle': {
        ctl = h('button', { class: `toggle${v ? ' on' : ''}`, 'aria-pressed': v ? 'true' : 'false' });
        ctl.addEventListener('click', () => { const nv = !getPath(obj, f.path); ctl.classList.toggle('on', nv); change(f, nv, true); });
        break;
      }
      case 'text':
      case 'textarea': {
        ctl = h(f.type === 'text' ? 'input' : 'textarea', { type: f.type === 'text' ? 'text' : null, spellcheck: 'false' });
        ctl.value = v ?? '';
        ctl.addEventListener('input', () => change(f, ctl.value, false));
        ctl.addEventListener('change', () => change(f, ctl.value, true));
        break;
      }
    }
    const row = h('div', { class: `field${full ? ' full' : ''}` }, h('label', {}, f.label), ctl, valEl || (full ? null : h('span')));
    frag.append(row);
  });
  return frag;
}

const pct = (x) => `${Math.round(x * 100)}%`;
const sec = (x) => `${(+x).toFixed(1)}s`;
const deg = (x) => `${Math.round(x)}°`;

// ---------- Denetçi ----------
export function openInspector(tab, extra = {}) {
  const s = app.sel;
  if (!s) return;
  const o = selected();
  if (!o) return;
  let cfg;
  if (s.type === 'clip') cfg = clipInspector(o);
  else if (s.type === 'layer') cfg = layerInspector(o);
  else if (s.type === 'audio') cfg = audioInspector(o);
  else if (s.type === 'subs') cfg = subsInspector(extra);
  if (!cfg) return;
  cfg.refresh = () => {
    const ob = selected();
    if (!ob) return false;
    const n = s.type === 'clip' ? clipInspector(ob) : s.type === 'layer' ? layerInspector(ob) : s.type === 'audio' ? audioInspector(ob) : subsInspector({});
    cur.render = n.render; cur.title = n.title; cur.actions = n.actions;
    $('sheetTitle').textContent = n.title;
    return true;
  };
  if (tab && cfg.tabs?.includes(tab)) cfg.tab = tab;
  cfg.onClose = () => {};
  openSheet(cfg);
}

function commonActions(kind) {
  const a = [];
  if (kind !== 'subs') a.push({ icon: I.split, label: 'Böl', onClick: () => app.splitSel() });
  if (kind !== 'subs') a.push({ icon: I.copy, label: 'Kopyala', onClick: () => app.dupSel() });
  a.push({ icon: I.trash, label: 'Sil', danger: true, onClick: () => app.delSel() });
  return a;
}

function filterTab(body, obj) {
  if (!obj.filters) obj.filters = { ...DEFAULT_FILTERS };
  const chips = h('div', { class: 'chips', style: { marginBottom: '8px' } });
  FILTER_PRESETS.forEach(([id, lbl, f]) => {
    chips.append(h('button', { class: obj.filterPreset === id ? 'on' : '', onclick: () => {
      obj.filterPreset = id; obj.filters = { ...DEFAULT_FILTERS, ...f }; app.change(true); refreshSheet();
    } }, lbl));
  });
  body.append(chips);
  const mark = () => { obj.filterPreset = 'custom'; };
  body.append(fields(obj, [
    { label: 'Parlaklık', path: 'filters.brightness', type: 'range', min: 0.3, max: 2, fmt: pct, post: mark },
    { label: 'Kontrast', path: 'filters.contrast', type: 'range', min: 0.3, max: 2, fmt: pct, post: mark },
    { label: 'Doygunluk', path: 'filters.saturate', type: 'range', min: 0, max: 3, fmt: pct, post: mark },
    { label: 'Ton', path: 'filters.hue', type: 'range', min: -180, max: 180, step: 1, fmt: deg, post: mark },
    { label: 'Siyah-beyaz', path: 'filters.grayscale', type: 'range', min: 0, max: 1, fmt: pct, post: mark },
    { label: 'Sepya', path: 'filters.sepia', type: 'range', min: 0, max: 1, fmt: pct, post: mark },
    { label: 'Bulanıklık', path: 'filters.blur', type: 'range', min: 0, max: 20, step: 0.5, post: mark },
  ]));
}

function clipInspector(c) {
  const isV = c.type !== 'image';
  const m = app.engine.media.get(c.mediaId);
  const mdur = m?.duration || 60;
  const idx = app.P.clips.indexOf(c);
  return {
    title: isV ? 'Video klip' : 'Fotoğraf',
    tabs: ['Düzen', 'Geçiş', 'Filtre'],
    actions: [
      { icon: I.left, label: 'Sola taşı', onClick: () => app.moveClip(-1) },
      { icon: I.right, label: 'Sağa taşı', onClick: () => app.moveClip(1) },
      ...commonActions('clip'),
    ],
    render: (body, tab) => {
      if (tab === 'Düzen') {
        body.append(fields(c, [
          { label: 'Yerleşim', path: 'fit', type: 'chips', options: [['cover', 'Ekranı doldur'], ['contain', 'Sığdır']], rerender: true },
          { label: 'Arka plan', path: 'bgMode', type: 'chips', options: [['blur', 'Bulanık'], ['black', 'Siyah'], ['color', 'Renk']], hide: c.fit !== 'contain', rerender: true },
          { label: 'Arka plan rengi', path: 'bgColor', type: 'color', hide: !(c.fit === 'contain' && c.bgMode === 'color') },
          { label: 'Yakınlaştır', path: 'zoom', type: 'range', min: 0.5, max: 3, fmt: pct },
          { label: 'Yatay konum', path: 'panX', type: 'range', min: -1, max: 1 },
          { label: 'Dikey konum', path: 'panY', type: 'range', min: -1, max: 1 },
          { label: 'Ken Burns zoom', path: 'kenburns', type: 'toggle' },
          { label: 'Süre', path: 'dur', type: 'range', min: 0.5, max: 30, step: 0.1, fmt: sec, hide: isV, post: () => app.refreshTimeline() },
          { label: 'Hız', path: 'speed', type: 'range', min: 0.25, max: 3, step: 0.05, fmt: (x) => `${(+x).toFixed(2)}x`, hide: !isV, post: () => app.refreshTimeline() },
          { label: 'Ses seviyesi', path: 'volume', type: 'range', min: 0, max: 2, fmt: pct, hide: !isV },
          { label: 'Sessiz', path: 'mute', type: 'toggle', hide: !isV },
          { label: 'Kırp: başlangıç', path: 'in', type: 'range', min: 0, max: mdur, step: 0.05, fmt: sec, hide: !isV, post: (o) => { o.in = Math.min(o.in, o.out - 0.2); app.refreshTimeline(); } },
          { label: 'Kırp: bitiş', path: 'out', type: 'range', min: 0, max: mdur, step: 0.05, fmt: sec, hide: !isV, post: (o) => { o.out = Math.max(o.out, o.in + 0.2); app.refreshTimeline(); } },
        ]));
      } else if (tab === 'Geçiş') {
        if (idx === 0) { body.append(h('p', { class: 'hint', html: 'İlk klibe geçiş eklenemez. Geçiş, <b>bu klipten önceki</b> klip ile bu klip arasında uygulanır.' })); return; }
        if (!c.trans) c.trans = { type: 'none', dur: 0.5 };
        body.append(h('p', { class: 'hint', html: 'Önceki klipten bu klibe geçiş efekti:' }));
        const grid = h('div', { class: 'grid-3' });
        TRANSITIONS.forEach(([id, lbl]) => {
          grid.append(h('button', { class: `opt${c.trans.type === id ? ' on' : ''}`, onclick: () => {
            c.trans.type = id; app.change(true); app.refreshTimeline(); refreshSheet();
            const L = app.layout().find((x) => x.clip === c);
            if (L && id !== 'none') { app.engine.seek(Math.max(0, L.start - 0.4)); app.updateTime(); app.play(); setTimeout(() => app.pause(), (L.td + 0.9) * 1000); }
          } }, lbl));
        });
        body.append(grid);
        body.append(fields(c, [{ label: 'Geçiş süresi', path: 'trans.dur', type: 'range', min: 0.2, max: 1.5, step: 0.05, fmt: sec, post: () => app.refreshTimeline() }]));
        body.append(h('button', { class: 'btn block', style: { marginTop: '8px' }, onclick: () => {
          app.P.clips.forEach((x, i) => { if (i > 0) x.trans = clone(c.trans); }); app.change(true); app.refreshTimeline(); toast('Geçiş tüm kliplere uygulandı');
        } }, 'Tüm kliplere uygula'));
      } else if (tab === 'Filtre') filterTab(body, c);
    },
  };
}

function animTab(body, L) {
  body.append(fields(L, [
    { label: 'Giriş', path: 'anim.in', type: 'chips', options: ANIM_IN },
    { label: 'Giriş süresi', path: 'anim.inDur', type: 'range', min: 0.1, max: 3, step: 0.05, fmt: sec },
    { label: 'Çıkış', path: 'anim.out', type: 'chips', options: ANIM_OUT },
    { label: 'Çıkış süresi', path: 'anim.outDur', type: 'range', min: 0.1, max: 2, step: 0.05, fmt: sec },
    { label: 'Sürekli hareket', path: 'anim.loop', type: 'chips', options: ANIM_LOOP },
  ]));
  body.append(h('button', { class: 'btn block primary', style: { marginTop: '10px' }, html: `${I.play} Animasyonu önizle`, onclick: () => app.previewRange(L.start, L.end) }));
}

function posTab(body, L) {
  const dmax = Math.max(app.engine.duration() + 5, L.end + 5);
  const sizeField = L.kind === 'media'
    ? { label: 'Boyut', path: 'w', type: 'range', min: 0.1, max: 1.6, fmt: pct }
    : L.kind === 'text' ? { label: 'Yazı boyutu', path: 'size', type: 'range', min: 20, max: 320, step: 1 }
      : { label: 'Boyut', path: 'scale', type: 'range', min: 0.3, max: 2.5, fmt: pct };
  body.append(fields(L, [
    sizeField,
    { label: 'Yatay', path: 'x', type: 'range', min: 0, max: 1, step: 0.005, fmt: pct },
    { label: 'Dikey', path: 'y', type: 'range', min: 0, max: 1, step: 0.005, fmt: pct },
    { label: 'Döndür', path: 'rot', type: 'range', min: -180, max: 180, step: 1, fmt: deg },
    { label: 'Opaklık', path: 'opacity', type: 'range', min: 0, max: 1, fmt: pct },
    { label: 'Başlangıç', path: 'start', type: 'range', min: 0, max: dmax, step: 0.05, fmt: sec, post: (o) => { o.start = Math.min(o.start, o.end - 0.2); app.refreshTimeline(); } },
    { label: 'Bitiş', path: 'end', type: 'range', min: 0, max: dmax, step: 0.05, fmt: sec, post: (o) => { o.end = Math.max(o.end, o.start + 0.2); app.refreshTimeline(); } },
  ]));
  const row = h('div', { class: 'btn-row' },
    h('button', { class: 'btn', onclick: () => { L.x = 0.5; app.change(true); refreshSheet(); } }, 'Yatay ortala'),
    h('button', { class: 'btn', onclick: () => { L.start = app.engine.t; if (L.end <= L.start + 0.2) L.end = L.start + 3; app.change(true); app.refreshTimeline(); refreshSheet(); } }, 'Burada başlat'),
    h('button', { class: 'btn', html: `${I.front} Öne getir`, onclick: () => app.layerOrder(1) }),
    h('button', { class: 'btn', html: `${I.backL} Arkaya gönder`, onclick: () => app.layerOrder(-1) }),
  );
  body.append(row);
}

function layerInspector(L) {
  const title = { text: 'Yazı', media: 'Katman', cta: 'Sosyal medya çağrısı', score: 'Skor kartı' }[L.kind];
  const tabs = {
    text: ['Metin', 'Stil', 'Animasyon', 'Konum'],
    media: ['Düzen', 'Animasyon', 'Filtre', 'Konum'],
    cta: ['Buton', 'Animasyon', 'Konum'],
    score: ['Skor', 'Animasyon', 'Konum'],
  }[L.kind];
  return {
    title, tabs, actions: commonActions('layer'),
    render: (body, tab) => {
      if (tab === 'Animasyon') return animTab(body, L);
      if (tab === 'Konum') return posTab(body, L);
      if (tab === 'Filtre') return filterTab(body, L);
      if (L.kind === 'text' && tab === 'Metin') {
        body.append(fields(L, [
          { label: 'Metin', path: 'text', type: 'textarea', post: () => app.refreshTimelineSoon() },
          { type: 'hint', html: 'İpucu: <b>*kelime*</b> şeklinde yazdığın kelimeler vurgu rengiyle görünür.' },
          { label: 'Yazı tipi', path: 'font', type: 'chips', options: FONTS },
          { label: 'Kalınlık', path: 'weight', type: 'chips', options: WEIGHTS },
          { label: 'Boyut', path: 'size', type: 'range', min: 20, max: 320, step: 1 },
          { label: 'Renk', path: 'color', type: 'color' },
          { label: 'Vurgu rengi', path: 'accent', type: 'color' },
          { label: 'BÜYÜK HARF', path: 'upper', type: 'toggle' },
          { label: 'İtalik', path: 'italic', type: 'toggle' },
          { label: 'Hizalama', path: 'align', type: 'chips', options: [['left', 'Sol'], ['center', 'Orta'], ['right', 'Sağ']] },
          { label: 'Satır genişliği', path: 'maxW', type: 'range', min: 0.3, max: 1, fmt: pct },
          { label: 'Harf aralığı', path: 'spacing', type: 'range', min: -6, max: 30, step: 0.5 },
          { label: 'Satır aralığı', path: 'lineH', type: 'range', min: 0.7, max: 1.8 },
        ]));
      } else if (L.kind === 'text' && tab === 'Stil') {
        body.append(fields(L, [
          { label: 'Kontur kalınlığı', path: 'strokeW', type: 'range', min: 0, max: 30, step: 0.5 },
          { label: 'Kontur rengi', path: 'strokeColor', type: 'color' },
          { label: 'Gölge / parlama', path: 'shadowOn', type: 'toggle', rerender: true },
          { label: 'Gölge rengi', path: 'shadowColor', type: 'color', hide: !L.shadowOn },
          { label: 'Gölge yayılımı', path: 'shadowBlur', type: 'range', min: 0, max: 80, step: 1, hide: !L.shadowOn },
          { label: 'Arka plan kutusu', path: 'bgOn', type: 'toggle', rerender: true },
          { label: 'Kutu tipi', path: 'bgMode', type: 'chips', options: [['block', 'Tek blok'], ['line', 'Her satır']], hide: !L.bgOn },
          { label: 'Kutu rengi', path: 'bgColor', type: 'color', hide: !L.bgOn },
          { label: 'Kutu opaklığı', path: 'bgOpacity', type: 'range', min: 0, max: 1, fmt: pct, hide: !L.bgOn },
          { label: 'İç boşluk', path: 'bgPad', type: 'range', min: 0, max: 80, step: 1, hide: !L.bgOn },
          { label: 'Köşe yuvarlama', path: 'bgRadius', type: 'range', min: 0, max: 80, step: 1, hide: !L.bgOn },
        ]));
      } else if (L.kind === 'media' && tab === 'Düzen') {
        const isV = app.engine.media.get(L.mediaId)?.kind === 'video';
        body.append(fields(L, [
          { label: 'Kesim', path: 'crop', type: 'chips', options: [['none', 'Orijinal'], ['square', 'Kare'], ['circle', 'Daire']] },
          { label: 'Boyut', path: 'w', type: 'range', min: 0.1, max: 1.6, fmt: pct },
          { label: 'Köşe yuvarlama', path: 'radius', type: 'range', min: 0, max: 300, step: 1 },
          { label: 'Çerçeve', path: 'borderW', type: 'range', min: 0, max: 30, step: 1 },
          { label: 'Çerçeve rengi', path: 'borderColor', type: 'color' },
          { label: 'Gölge', path: 'shadowOn', type: 'toggle' },
          { label: 'Ken Burns zoom', path: 'kenburns', type: 'toggle' },
          { label: 'Ses seviyesi', path: 'volume', type: 'range', min: 0, max: 2, fmt: pct, hide: !isV },
          { label: 'Döngü', path: 'loop', type: 'toggle', hide: !isV },
        ]));
      } else if (L.kind === 'cta' && tab === 'Buton') {
        const chips = h('div', { class: 'chips', style: { marginBottom: '6px' } });
        CTA_PRESETS.forEach((p) => chips.append(h('button', { onclick: () => { Object.assign(L, clone(p.p)); app.change(true); refreshSheet(); app.refreshTimeline(); } }, p.name)));
        body.append(h('p', { class: 'hint' }, 'Hazır buton seç:'), chips);
        body.append(fields(L, [
          { label: 'Yazı', path: 'label', type: 'text', post: () => app.refreshTimelineSoon() },
          { label: 'Tıklandıktan sonra', path: 'doneLabel', type: 'text' },
          { label: 'İkon', path: 'icon', type: 'chips', options: ICON_NAMES },
          { label: 'Stil', path: 'style', type: 'chips', options: [['pill', 'Dolgu'], ['outline', 'Çerçeve'], ['glass', 'Cam'], ['round', 'Yuvarlak']] },
          { label: 'Renk', path: 'color', type: 'color' },
          { label: 'Yazı rengi', path: 'textColor', type: 'color' },
          { label: 'Tıklama animasyonu', path: 'tap', type: 'toggle' },
          { label: 'Boyut', path: 'scale', type: 'range', min: 0.3, max: 2.5, fmt: pct },
        ]));
      } else if (L.kind === 'score' && tab === 'Skor') {
        body.append(fields(L, [
          { label: 'Ev sahibi', path: 'teamA', type: 'text', post: () => app.refreshTimelineSoon() },
          { label: 'Deplasman', path: 'teamB', type: 'text', post: () => app.refreshTimelineSoon() },
          { label: 'Skor (ev)', path: 'scoreA', type: 'text' },
          { label: 'Skor (dep.)', path: 'scoreB', type: 'text' },
          { label: 'Alt bilgi', path: 'info', type: 'text' },
          { label: 'Ev rengi', path: 'colorA', type: 'color' },
          { label: 'Deplasman rengi', path: 'colorB', type: 'color' },
          { label: 'Kart rengi', path: 'cardColor', type: 'color', swatches: ['#140E22', '#000000', '#1E1B4B', '#111827', '#3B0764', '#FFFFFF'] },
          { label: 'Vurgu', path: 'accent', type: 'color' },
        ]));
      }
    },
  };
}

function audioInspector(a) {
  const mdur = app.engine.media.get(a.mediaId)?.duration || 600;
  return {
    title: 'Ses', tabs: [], actions: commonActions('audio'),
    render: (body) => {
      body.append(fields(a, [
        { label: 'Ses seviyesi', path: 'volume', type: 'range', min: 0, max: 2, fmt: pct },
        { label: 'Yavaşça aç', path: 'fadeIn', type: 'range', min: 0, max: 5, step: 0.1, fmt: sec },
        { label: 'Yavaşça kapat', path: 'fadeOut', type: 'range', min: 0, max: 5, step: 0.1, fmt: sec },
        { label: 'Kırp: başlangıç', path: 'in', type: 'range', min: 0, max: mdur, step: 0.05, fmt: sec, post: (o) => { o.in = Math.min(o.in, o.out - 0.2); app.refreshTimeline(); } },
        { label: 'Kırp: bitiş', path: 'out', type: 'range', min: 0, max: mdur, step: 0.05, fmt: sec, post: (o) => { o.out = Math.max(o.out, o.in + 0.2); app.refreshTimeline(); } },
      ]));
      body.append(h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => { a.start = app.engine.t; app.change(true); app.refreshTimeline(); } }, 'Burada başlat'),
        h('button', { class: 'btn', onclick: () => { a.start = 0; app.change(true); app.refreshTimeline(); } }, 'Başa al'),
      ));
      body.append(h('p', { class: 'hint', html: 'Video kliplerin kendi sesini klibe dokunup <b>Düzen</b> sekmesinden kısabilirsin.' }));
    },
  };
}

// ---------- Altyazı ----------
function subsInspector(extra = {}) {
  const S = app.P.subs;
  return {
    title: 'Altyazı', tabs: ['Stil', 'Satırlar', 'Ayarlar'], tab: extra.cue != null ? 'Satırlar' : 'Stil', tall: true,
    actions: [],
    render: (body, tab) => {
      if (tab === 'Stil') {
        body.append(fields(S.style, [
          { label: 'Görünüm', path: 'preset', type: 'chips', options: SUB_PRESETS, rerender: true },
          { label: 'Yazı tipi', path: 'font', type: 'chips', options: FONTS },
          { label: 'Kalınlık', path: 'weight', type: 'chips', options: WEIGHTS },
          { label: 'Boyut', path: 'size', type: 'range', min: 30, max: 180, step: 1 },
          { label: 'Renk', path: 'color', type: 'color' },
          { label: 'Vurgu rengi', path: 'accent', type: 'color' },
          { label: 'Kontur', path: 'strokeW', type: 'range', min: 0, max: 24, step: 0.5 },
          { label: 'Kontur rengi', path: 'strokeColor', type: 'color' },
          { label: 'Kutu rengi', path: 'boxColor', type: 'color', hide: S.style.preset !== 'box' },
          { label: 'BÜYÜK HARF', path: 'upper', type: 'toggle' },
          { label: 'Dikey konum', path: 'y', type: 'range', min: 0.08, max: 0.95, step: 0.005, fmt: pct },
          { label: 'Satır genişliği', path: 'maxW', type: 'range', min: 0.4, max: 1, fmt: pct },
        ]));
      } else if (tab === 'Satırlar') {
        body.append(h('button', { class: 'btn block primary', style: { marginBottom: '10px' }, html: `${I.plus} Oynatıcı konumuna satır ekle`, onclick: () => {
          const t = app.engine.t - (S.offset || 0);
          S.cues.push({ start: Math.max(0, t), end: t + 2, text: 'Yeni altyazı' });
          S.cues.sort((x, y) => x.start - y.start);
          app.change(true); app.refreshTimeline(); refreshSheet();
        } }));
        const now = app.engine.t - (S.offset || 0);
        S.cues.forEach((c, i) => {
          const ta = h('textarea', { spellcheck: 'false' });
          ta.value = c.text;
          ta.addEventListener('input', () => { c.text = ta.value; app.change(false); });
          ta.addEventListener('change', () => { app.change(true); app.refreshTimeline(); });
          const card = h('div', { class: `cue${now >= c.start && now < c.end ? ' now' : ''}`, id: `cue-${i}` },
            h('div', { class: 'cue-top' },
              h('span', {}, `${fmt(c.start)} → ${fmt(c.end)}`), h('span', { class: 'sp' }),
              h('button', { onclick: () => { app.engine.seek(c.start + (S.offset || 0) + 0.01); app.updateTime(); app.syncScroll(); } }, '▶'),
              h('button', { onclick: () => { c.start = Math.min(app.engine.t - (S.offset || 0), c.end - 0.1); app.change(true); app.refreshTimeline(); refreshSheet(); } }, 'Başı'),
              h('button', { onclick: () => { c.end = Math.max(app.engine.t - (S.offset || 0), c.start + 0.1); app.change(true); app.refreshTimeline(); refreshSheet(); } }, 'Sonu'),
              h('button', { onclick: () => { S.cues.splice(i, 1); app.change(true); app.refreshTimeline(); refreshSheet(); } }, 'Sil')),
            ta);
          body.append(card);
        });
        if (extra.cue != null) setTimeout(() => { const el = document.getElementById(`cue-${extra.cue}`); if (el) el.scrollIntoView({ block: 'center' }); }, 30);
      } else if (tab === 'Ayarlar') {
        body.append(fields(S, [
          { label: 'Zaman kaydırma', path: 'offset', type: 'range', min: -5, max: 5, step: 0.05, fmt: (x) => `${x > 0 ? '+' : ''}${(+x).toFixed(2)}s`, post: () => app.refreshTimelineSoon() },
        ]));
        body.append(h('p', { class: 'hint', html: 'Altyazı sesle senkron değilse <b>zaman kaydırma</b> ile hepsini birlikte ileri-geri al.' }));
        body.append(h('div', { class: 'btn-row' },
          h('button', { class: 'btn', html: `${I.upload} SRT yükle`, onclick: () => app.importSRT() }),
          h('button', { class: 'btn', html: `${I.export} SRT kaydet`, onclick: async () => {
            const blob = new Blob([toSRT(S.cues)], { type: 'text/plain' });
            const r = await saveVideo(blob, `${app.P.name || 'alpicut'}.srt`, { share: true });
            toast(r.where ? `${r.where} klasörüne kaydedildi` : 'Kaydedildi');
          } }),
        ));
        body.append(h('button', { class: 'btn block danger', style: { marginTop: '6px' }, html: `${I.trash} Tüm altyazıları sil`, onclick: () => {
          if (!confirm('Tüm altyazılar silinsin mi?')) return;
          S.cues = []; app.change(true); app.deselect(); closeSheet(); app.refreshTimeline();
        } }));
      }
    },
  };
}

// ---------- Ekleme menüleri ----------
function previewCanvas(draw) {
  const c = h('canvas', { width: 360, height: 200 });
  const ctx = c.getContext('2d');
  const env = { W: 1080, H: 1920, S: 0.3 };
  // önce ölç
  const m = document.createElement('canvas').getContext('2d');
  const box = draw(m, env) || { w: 600, h: 200 };
  const k = Math.min(0.42, 320 / box.w, 170 / box.h);
  ctx.translate(180, 100);
  ctx.scale(k, k);
  draw(ctx, { ...env, S: k });
  return c;
}

const ST = { alpha: 1, reveal: 1, glow: 0.3, sc: 1 };

export function openTemplates() {
  openSheet({
    title: 'Yazı şablonları', tall: true,
    render: (body) => {
      const grid = h('div', { class: 'grid-tpl' });
      TEXT_TEMPLATES.forEach((tp) => {
        const L = { ...clone(TEXT_BASE), ...clone(tp.p) };
        const cv = previewCanvas((ctx, env) => drawText(ctx, L, ST, env));
        grid.append(h('button', { class: 'tpl', onclick: () => { app.addLayer({ ...L }); } }, cv, h('span', {}, tp.name)));
      });
      body.append(grid);
    },
  });
}

export function openCTAs() {
  openSheet({
    title: 'Sosyal medya çağrıları', tall: true,
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Butonların hepsi düzenlenebilir: yazı, ikon, renk, stil ve tıklama animasyonu.' }));
      const grid = h('div', { class: 'grid-tpl' });
      CTA_PRESETS.forEach((p) => {
        const L = { ...clone(CTA_BASE), ...clone(p.p), start: 0, end: 4 };
        const cv = previewCanvas((ctx, env) => drawCTA(ctx, { ...L, tap: false }, 0.5, env));
        grid.append(h('button', { class: 'tpl', onclick: () => { const x = { ...L }; delete x.start; delete x.end; app.addLayer(x, 4); } }, cv, h('span', {}, p.name)));
      });
      body.append(grid);
    },
  });
}

export function openScoreMenu() {
  app.addLayer(clone(SCORE_BASE), 5);
}

export function openSubsMenu() {
  if (app.P.subs?.cues?.length) { app.select({ type: 'subs', id: 'subs' }); return; }
  openSheet({
    title: 'Altyazı ekle',
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'SRT dosyanı yükle; kelime vurgulu, pop veya klasik görünümle videoya yerleşsin. Yazı tipi varsayılan olarak <b>Barlow Condensed</b>.' }));
      body.append(h('button', { class: 'btn block primary', html: `${I.upload} SRT dosyası yükle`, onclick: () => { closeSheet(); app.importSRT(); } }));
      body.append(h('button', { class: 'btn block', style: { marginTop: '8px' }, html: `${I.edit} Elle yaz`, onclick: () => {
        if (!app.P.subs) app.P.subs = clone(SUB_BASE);
        const t = app.engine.t;
        app.P.subs.cues.push({ start: t, end: t + 2, text: 'Altyazı metni' });
        app.change(true); app.refreshTimeline(); closeSheet();
        setTimeout(() => app.select({ type: 'subs', id: 'subs' }, 'Satırlar', { cue: app.P.subs.cues.length - 1 }), 260);
      } }));
    },
  });
}

export function openFx() {
  const fx = app.P.fx;
  openSheet({
    title: 'Genel efektler',
    render: (body) => {
      body.append(h('p', { class: 'hint' }, 'Tüm videoya uygulanır.'));
      body.append(fields(fx, [
        { label: 'Vinyet', path: 'vignette', type: 'range', min: 0, max: 1, fmt: pct },
        { label: 'Film greni', path: 'grain', type: 'range', min: 0, max: 1, fmt: pct },
        { label: 'Sinema şeritleri', path: 'letterbox', type: 'range', min: 0, max: 0.4, fmt: pct },
        { label: 'İlerleme çubuğu', path: 'progress', type: 'toggle' },
        { label: 'Çubuk rengi', path: 'progressColor', type: 'color' },
        { label: 'Zemin rengi', path: 'bg', type: 'color', swatches: ['#000000', '#FFFFFF', '#140E22', '#3B0764', '#7C3AED', '#111827'] },
      ]));
    },
  });
}

export function openRatio() {
  openSheet({
    title: 'Video oranı',
    render: (body) => {
      const grid = h('div', { class: 'grid-3' });
      const desc = { '9:16': 'Shorts / Reels / TikTok', '4:5': 'Instagram gönderi', '1:1': 'Kare', '16:9': 'YouTube yatay' };
      Object.keys(RATIOS).forEach((r) => {
        grid.append(h('button', { class: `opt${app.P.ratio === r ? ' on' : ''}`, onclick: () => { app.P.ratio = r; app.change(true); app.fitStage(); refreshSheet(); } },
          h('b', {}, r), h('small', { style: { color: 'var(--muted)', fontWeight: 500 } }, desc[r])));
      });
      body.append(grid);
    },
  });
}

// ---------- Dışa aktarma ----------
export function openExport() {
  if (!app.P.clips.length && !app.P.layers.length) { toast('Önce medya ekle'); return; }
  app.pause();
  const modal = $('exportModal'), card = $('exportCard');
  modal.classList.remove('hidden');
  const [W, H] = RATIOS[app.P.ratio];
  const short = Math.min(W, H);
  const opt = { q: 1080, fps: 30 };
  const mime = Engine.pickMime();
  const fmtName = mime == null ? 'Desteklenmiyor' : (mime.includes('mp4') ? 'MP4' : 'WebM');
  let cancel = false;

  const close = () => { modal.classList.add('hidden'); };
  const renderOpts = () => {
    card.textContent = '';
    card.append(h('h3', {}, 'Dışa Aktar'));
    card.append(h('p', { class: 'hint', html: `Süre <b>${fmt(app.engine.duration())}</b> · Format <b>${fmtName}</b> · Oran <b>${app.P.ratio}</b>` }));
    const q = h('div', { class: 'chips' });
    [[1080, '1080p'], [720, '720p'], [540, '540p (hızlı)']].forEach(([v, l]) => q.append(h('button', { class: opt.q === v ? 'on' : '', onclick: () => { opt.q = v; renderOpts(); } }, l)));
    const f = h('div', { class: 'chips' });
    [[30, '30 fps'], [60, '60 fps']].forEach(([v, l]) => f.append(h('button', { class: opt.fps === v ? 'on' : '', onclick: () => { opt.fps = v; renderOpts(); } }, l)));
    card.append(h('div', { class: 'field full' }, h('label', {}, 'Çözünürlük'), q));
    card.append(h('div', { class: 'field full' }, h('label', {}, 'Kare hızı'), f));
    card.append(h('p', { class: 'hint', html: 'Video gerçek zamanlı oluşturulur (30 sn video ≈ 30 sn). Bu sırada ekranı kapatma ve uygulamadan çıkma.' }));
    if (fmtName === 'WebM') card.append(h('p', { class: 'hint', html: 'Not: Bu cihaz MP4 kaydını desteklemiyor, video <b>WebM</b> olarak çıkacak. YouTube kabul eder.' }));
    card.append(h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: close }, 'Vazgeç'),
      h('button', { class: 'btn primary', html: `${I.export} Oluştur`, onclick: start, disabled: mime == null })));
  };

  const start = async () => {
    cancel = false;
    let wake = null;
    try { wake = await navigator.wakeLock?.request('screen'); } catch (_) { /* yoksay */ }
    card.textContent = '';
    const bar = h('i');
    const pctEl = h('div', { class: 'big-pct' }, '0%');
    card.append(h('h3', {}, 'Video oluşturuluyor…'), pctEl, h('div', { class: 'progress' }, bar),
      h('p', { class: 'hint' }, 'Ekranı açık tut. Önizlemede ilerlemeyi görebilirsin.'),
      h('button', { class: 'btn block', onclick: () => { cancel = true; } }, 'İptal'));
    const res = opt.q / short;
    const br = ({ 1080: 12e6, 720: 7e6, 540: 4e6 }[opt.q]) * (opt.fps === 60 ? 1.5 : 1);
    let out = null;
    try {
      out = await app.engine.export({ res, fps: opt.fps, bitrate: br, onProgress: (p) => { bar.style.width = `${p * 100}%`; pctEl.textContent = `${Math.round(p * 100)}%`; }, shouldCancel: () => cancel });
    } catch (e) {
      console.error(e);
      toast(`Hata: ${e.message || e}`, 4000);
    }
    try { wake && wake.release(); } catch (_) { /* yoksay */ }
    app.fitStage();
    if (!out) { close(); if (cancel) toast('İptal edildi'); return; }
    const d = new Date();
    const name = `Alpicut_${(app.P.name || 'video').replace(/[^\wğüşıöçĞÜŞİÖÇ-]+/g, '_')}_${d.getHours()}${String(d.getMinutes()).padStart(2, '0')}.${out.ext}`;
    const doSave = async (share) => {
      card.textContent = '';
      const sb = h('i');
      card.append(h('h3', {}, 'Kaydediliyor…'), h('div', { class: 'progress' }, sb));
      try {
        const r = await saveVideo(out.blob, name, { share, onProgress: (p) => { sb.style.width = `${p * 100}%`; } });
        showDone(r);
      } catch (e) { toast(`Kaydedilemedi: ${e.message || e}`, 4000); showDone({}); }
    };
    const showDone = (r) => {
      card.textContent = '';
      const mb = (out.blob.size / 1048576).toFixed(1);
      card.append(h('h3', {}, 'Hazır! 🎉'),
        h('p', { class: 'hint', html: `${name} · ${mb} MB${r.where ? `<br>Kaydedildi: <b>${r.where}</b>` : ''}` }),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: close }, 'Kapat'),
          h('button', { class: 'btn primary', html: `${I.export} ${isNative() ? 'Paylaş / Kaydet' : 'Tekrar indir'}`, onclick: () => doSave(true) })));
    };
    doSave(true);
  };
  renderOpts();
}

export { uid };
