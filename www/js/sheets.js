// Alpicut — alt paneller: denetçi, ekleme menüleri, dışa aktarma
import { app, $, h, getPath, setPath, clone, fmt, toast, selected, uid } from './state.js';
import { I } from './icons.js';
import {
  FONTS, WEIGHTS, ANIM_IN, ANIM_OUT, ANIM_LOOP, TRANSITIONS, FILTER_PRESETS, DEFAULT_FILTERS,
  TEXT_BASE, TEXT_TEMPLATES, CTA_BASE, CTA_PRESETS, SCORE_BASE, SUB_PRESETS, SUB_BASE, RATIOS, SHAPE_BASE, SHAPE_PRESETS,
} from './presets.js';
import { drawText, drawCTA, drawScore, drawShape, ICON_NAMES, BLENDS, SHAPES, CROPS } from './render.js';
import { Engine } from './engine.js';
import { saveVideo, isNative } from './storage.js';
import { parseSRT, toSRT, toVTT } from './srt.js';
import { LAYER_PROPS, CLIP_PROPS, EASES, propAt, hasKeys, keyAt, setKey, delKey, writeProp, allKeyTimes } from './kf.js';
import { SFX, renderSfx } from './sfx.js';
import { layoutClips } from './engine.js';

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
    if (f.kf) writeProp(obj, f.kf, localT(obj), v);
    else setPath(obj, f.path, v);
    if (f.post) f.post(obj, v);
    app.change(final);
    if (final && (f.rerender || opts.rerender)) refreshSheet();
  };
  list.forEach((f) => {
    if (!f || f.hide) return;
    if (f.type === 'el') { frag.append(f.el); return; }
    if (f.type === 'hint') { frag.append(h('p', { class: 'hint', html: f.html })); return; }
    const v = f.kf ? propAt(obj, f.kf, localT(obj)) : getPath(obj, f.path);
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
    const lbl = h('label', {}, f.label, f.kf && hasKeys(obj, f.kf) ? h('span', { class: 'kf-mark', title: 'Keyframe var' }, ' ◆') : null);
    const row = h('div', { class: `field${full ? ' full' : ''}` }, lbl, ctl, valEl || (full ? null : h('span')));
    frag.append(row);
  });
  return frag;
}

// Öğenin kendi başlangıcına göre oynatıcı zamanı
export function itemStart(o) {
  if (o.start != null && o.end != null) return o.start;
  if (o.start != null && o.out != null && o.mediaId && !o.type) return o.start; // ses
  const L = layoutClips(app.P.clips).find((x) => x.clip === o);
  return L ? L.start : 0;
}
export function itemLen(o) {
  if (o.end != null) return o.end - o.start;
  const L = layoutClips(app.P.clips).find((x) => x.clip === o);
  return L ? L.len : 0;
}
export function localT(o) { return app.engine.t - itemStart(o); }

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
    title: c.freeze ? 'Donmuş kare' : isV ? 'Video klip' : 'Fotoğraf',
    tabs: ['Düzen', 'Keyframe', 'Geçiş', 'Filtre'],
    actions: [
      { icon: I.left, label: 'Sola taşı', onClick: () => app.moveClip(-1) },
      { icon: I.right, label: 'Sağa taşı', onClick: () => app.moveClip(1) },
      ...(isV && !c.freeze ? [{ icon: I.freeze, label: 'Kareyi dondur', onClick: () => app.freezeFrame() }] : []),
      ...commonActions('clip'),
    ],
    render: (body, tab) => {
      if (tab === 'Düzen') {
        body.append(fields(c, [
          { label: 'Yerleşim', path: 'fit', type: 'chips', options: [['cover', 'Ekranı doldur'], ['contain', 'Sığdır']], rerender: true },
          { label: 'Arka plan', path: 'bgMode', type: 'chips', options: [['blur', 'Bulanık'], ['black', 'Siyah'], ['color', 'Renk']], hide: c.fit !== 'contain', rerender: true },
          { label: 'Arka plan rengi', path: 'bgColor', type: 'color', hide: !(c.fit === 'contain' && c.bgMode === 'color') },
          { label: 'Yakınlaştır', path: 'zoom', kf: 'zoom', type: 'range', min: 0.5, max: 3, fmt: pct },
          { label: 'Yatay konum', path: 'panX', kf: 'panX', type: 'range', min: -1, max: 1 },
          { label: 'Dikey konum', path: 'panY', kf: 'panY', type: 'range', min: -1, max: 1 },
          { label: 'Ken Burns zoom', path: 'kenburns', type: 'toggle' },
          { type: 'hint', html: c.freeze ? `Bu klip videonun <b>${(+c.freezeAt).toFixed(2)}s</b> anındaki dondurulmuş karesi. Ses içermez.` : '', hide: !c.freeze },
          { label: 'Süre', path: 'dur', type: 'range', min: 0.5, max: 30, step: 0.1, fmt: sec, hide: isV && !c.freeze, post: () => app.refreshTimeline() },
          { label: 'Hız', path: 'speed', type: 'range', min: 0.25, max: 3, step: 0.05, fmt: (x) => `${(+x).toFixed(2)}x`, hide: !isV || c.freeze, post: () => app.refreshTimeline() },
          { type: 'hint', html: 'Hız değişince ses perdesi korunur. Ters oynatma bu sürümde yok.', hide: !isV || c.freeze },
          { label: 'Ses seviyesi', path: 'volume', type: 'range', min: 0, max: 2, fmt: pct, hide: !isV || c.freeze },
          { label: 'Sessiz', path: 'mute', type: 'toggle', hide: !isV || c.freeze },
          { label: 'Kırp: başlangıç', path: 'in', type: 'range', min: 0, max: mdur, step: 0.05, fmt: sec, hide: !isV || c.freeze, post: (o) => { o.in = Math.min(o.in, o.out - 0.2); app.refreshTimeline(); } },
          { label: 'Kırp: bitiş', path: 'out', type: 'range', min: 0, max: mdur, step: 0.05, fmt: sec, hide: !isV || c.freeze, post: (o) => { o.out = Math.max(o.out, o.in + 0.2); app.refreshTimeline(); } },
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
      else if (tab === 'Keyframe') kfTab(body, c, CLIP_PROPS, true);
    },
  };
}

// ---------- Bölünmüş ekran / resim içinde resim ----------
function layoutButtons(L) {
  const set = (o) => { Object.assign(L, o); if (L.kf) { delete L.kf.x; delete L.kf.y; delete L.kf.s; } L.sc = 1; L.rot = 0; app.change(true); refreshSheet(); };
  const grid = h('div', { class: 'grid-3', style: { marginBottom: '6px' } },
    h('button', { class: 'opt', onclick: () => set({ crop: 'half', w: 1, x: 0.5, y: 0.25, radius: 0, borderW: 0, shadowOn: false }) }, 'Üst yarı'),
    h('button', { class: 'opt', onclick: () => set({ crop: 'half', w: 1, x: 0.5, y: 0.75, radius: 0, borderW: 0, shadowOn: false }) }, 'Alt yarı'),
    h('button', { class: 'opt', onclick: () => set({ crop: 'portrait', w: 0.36, x: 0.75, y: 0.2, radius: 28, borderW: 6, borderColor: '#FFFFFF', shadowOn: true }) }, 'Resim içinde resim'),
    h('button', { class: 'opt', onclick: () => set({ crop: 'circle', w: 0.34, x: 0.76, y: 0.78, borderW: 8, borderColor: '#A855F7', borderGlow: 30, shadowOn: true }) }, 'Yuvarlak kamera'),
    h('button', { class: 'opt', onclick: () => set({ crop: 'wide', w: 1, x: 0.5, y: 0.5, radius: 0, borderW: 0, shadowOn: false }) }, 'Ortada yatay'),
    h('button', { class: 'opt', onclick: () => set({ crop: 'none', w: 1, x: 0.5, y: 0.5, radius: 0, borderW: 0, shadowOn: false }) }, 'Tam genişlik'));
  return h('div', { class: 'field full' }, h('label', {}, 'Hızlı yerleşim'), grid);
}

// ---------- Keyframe sekmesi ----------
function kfTab(body, o, props, isClip = false) {
  const lt = localT(o);
  const len = itemLen(o);
  const inside = lt >= -0.001 && lt <= len + 0.001;
  const st = itemStart(o);
  body.append(h('p', { class: 'hint', html: 'Oynatıcıyı bir zamana getir, <b>◆</b> ile keyframe koy. Sonra başka bir zamana git ve değeri değiştir — hareket kendiliğinden oluşur. Önizlemede sürükleyerek de keyframe yazabilirsin.' }));
  if (!inside) { body.append(h('p', { class: 'hint', html: '<b>Oynatıcı bu öğenin dışında.</b> Keyframe eklemek için oynatıcıyı öğenin üzerine getir.' })); }
  const times = allKeyTimes(o);
  const go = (t) => { app.engine.seek(st + t + 0.0001); app.updateTime(); app.syncScroll(); refreshSheet(); };
  const prev = [...times].reverse().find((t) => t < lt - 1 / 60);
  const next = times.find((t) => t > lt + 1 / 60);
  body.append(h('div', { class: 'btn-row three' },
    h('button', { class: 'btn', disabled: prev == null, html: `${I.prevF} Önceki`, onclick: () => go(prev) }),
    h('button', { class: 'btn', disabled: next == null, html: `Sonraki ${I.nextF}`, onclick: () => go(next) }),
    h('button', { class: 'btn primary', disabled: !inside, html: `${I.diamond} Tümü`, onclick: () => {
      props.forEach(([p]) => setKey(o, p, lt, propAt(o, p, lt))); app.change(true); refreshSheet();
    } })));
  props.forEach(([p, label, min, max, step]) => {
    const v = propAt(o, p, lt);
    const on = !!keyAt(o, p, lt);
    const fmtv = p === 'rot' ? deg : (p === 'x' || p === 'y' || p === 'opacity' || p === 's' || p === 'zoom') ? pct : (x) => (+x).toFixed(2);
    const val = h('span', { class: 'val' }, fmtv(v));
    const inp = h('input', { type: 'range', min, max, step, value: v });
    setRangeFill(inp);
    inp.addEventListener('input', () => { const x = parseFloat(inp.value); val.textContent = fmtv(x); setRangeFill(inp); writeProp(o, p, lt, x); app.change(false); });
    inp.addEventListener('change', () => { app.change(true); refreshSheet(); });
    const dia = h('button', { class: `kf-btn${on ? ' on' : ''}${hasKeys(o, p) ? ' has' : ''}`, disabled: !inside, html: I.diamond, 'aria-label': `${label} keyframe` });
    dia.addEventListener('click', () => { if (on) delKey(o, p, lt); else setKey(o, p, lt, propAt(o, p, lt)); app.change(true); refreshSheet(); });
    body.append(h('div', { class: 'kf-row' }, h('label', {}, label), inp, val, dia));
  });
  const here = props.filter(([p]) => keyAt(o, p, lt));
  if (here.length) {
    const cur = keyAt(o, here[0][0], lt).ease || 'inout';
    const chips = h('div', { class: 'chips' });
    EASES.forEach(([id, lbl]) => {
      chips.append(h('button', { class: cur === id ? 'on' : '', onclick: () => { here.forEach(([p]) => { keyAt(o, p, lt).ease = id; }); app.change(true); refreshSheet(); } }, lbl));
    });
    body.append(h('div', { class: 'field full' }, h('label', {}, 'Bu keyframe\'den sonraki geçiş'), chips));
  }
  // hazır hareketler
  const presets = isClip ? [
    ['Yavaş yakınlaş', () => { o.kf = { ...(o.kf || {}), zoom: [{ t: 0, v: 1, ease: 'inout' }, { t: len, v: 1.18, ease: 'inout' }] }; }],
    ['Punch-in zoom', () => { const t0 = Math.max(0, Math.min(lt, len - 0.3)); o.kf = { ...(o.kf || {}), zoom: [{ t: t0, v: 1, ease: 'out' }, { t: t0 + 0.18, v: 1.35, ease: 'inout' }] }; }],
    ['Sola → sağa pan', () => { o.zoom = Math.max(o.zoom || 1, 1.25); o.kf = { ...(o.kf || {}), panX: [{ t: 0, v: -1, ease: 'inout' }, { t: len, v: 1, ease: 'inout' }] }; }],
    ['Yakından uzağa', () => { o.kf = { ...(o.kf || {}), zoom: [{ t: 0, v: 1.25, ease: 'inout' }, { t: len, v: 1, ease: 'inout' }] }; }],
  ] : [
    ['Soldan kayarak gel', () => { o.kf = { ...(o.kf || {}), x: [{ t: 0, v: -0.3, ease: 'out' }, { t: Math.min(0.5, len / 2), v: o.x, ease: 'inout' }] }; }],
    ['Yavaşça büyü', () => { o.kf = { ...(o.kf || {}), s: [{ t: 0, v: 0.85, ease: 'inout' }, { t: len, v: 1.15, ease: 'inout' }] }; }],
    ['Yavaşça belir', () => { o.kf = { ...(o.kf || {}), opacity: [{ t: 0, v: 0, ease: 'inout' }, { t: Math.min(1, len / 2), v: 1, ease: 'inout' }] }; }],
    ['Bir tur dön', () => { o.kf = { ...(o.kf || {}), rot: [{ t: 0, v: 0, ease: 'inout' }, { t: len, v: 360, ease: 'inout' }] }; }],
  ];
  const pc = h('div', { class: 'chips' });
  presets.forEach(([lbl, fn]) => pc.append(h('button', { onclick: () => { fn(); app.change(true); refreshSheet(); toast(`${lbl} uygulandı`); } }, lbl)));
  body.append(h('div', { class: 'field full' }, h('label', {}, 'Hazır hareketler'), pc));
  if (times.length) {
    body.append(h('button', { class: 'btn block danger', style: { marginTop: '6px' }, html: `${I.trash} Tüm keyframe'leri sil`, onclick: () => {
      props.forEach(([p]) => { if (hasKeys(o, p)) { const v = propAt(o, p, lt); o[p === 's' ? 'sc' : p] = v; } });
      o.kf = {}; app.change(true); refreshSheet();
    } }));
  }
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
    { label: 'Yatay', path: 'x', kf: 'x', type: 'range', min: 0, max: 1, step: 0.005, fmt: pct },
    { label: 'Dikey', path: 'y', kf: 'y', type: 'range', min: 0, max: 1, step: 0.005, fmt: pct },
    { label: 'Ölçek', path: 'sc', kf: 's', type: 'range', min: 0.05, max: 4, fmt: pct },
    { label: 'Döndür', path: 'rot', kf: 'rot', type: 'range', min: -180, max: 180, step: 1, fmt: deg },
    { label: 'Opaklık', path: 'opacity', kf: 'opacity', type: 'range', min: 0, max: 1, fmt: pct },
    { label: 'Karışım modu', path: 'blend', type: 'chips', options: BLENDS },
    { label: 'Başlangıç', path: 'start', type: 'range', min: 0, max: dmax, step: 0.05, fmt: sec, post: (o) => { o.start = Math.min(o.start, o.end - 0.2); app.refreshTimeline(); } },
    { label: 'Bitiş', path: 'end', type: 'range', min: 0, max: dmax, step: 0.05, fmt: sec, post: (o) => { o.end = Math.max(o.end, o.start + 0.2); app.refreshTimeline(); } },
  ]));
  const row = h('div', { class: 'btn-row' },
    h('button', { class: 'btn', onclick: () => { writeProp(L, 'x', localT(L), 0.5); app.change(true); refreshSheet(); } }, 'Yatay ortala'),
    h('button', { class: 'btn', onclick: () => { L.start = app.engine.t; if (L.end <= L.start + 0.2) L.end = L.start + 3; app.change(true); app.refreshTimeline(); refreshSheet(); } }, 'Burada başlat'),
    h('button', { class: 'btn', html: `${I.front} Öne getir`, onclick: () => app.layerOrder(1) }),
    h('button', { class: 'btn', html: `${I.backL} Arkaya gönder`, onclick: () => app.layerOrder(-1) }),
  );
  body.append(row);
}

function layerInspector(L) {
  const title = { text: 'Yazı', media: 'Katman', cta: 'Sosyal medya çağrısı', score: 'Skor kartı', shape: 'Şekil' }[L.kind];
  const tabs = {
    text: ['Metin', 'Stil', 'Animasyon', 'Keyframe', 'Konum'],
    media: ['Düzen', 'Maske', 'Animasyon', 'Keyframe', 'Filtre', 'Konum'],
    cta: ['Buton', 'Animasyon', 'Keyframe', 'Konum'],
    score: ['Skor', 'Animasyon', 'Keyframe', 'Konum'],
    shape: ['Şekil', 'Animasyon', 'Keyframe', 'Konum'],
  }[L.kind];
  const actions = commonActions('layer');
  if (L.kind === 'text') actions.unshift({ icon: I.save, label: 'Stili kaydet', onClick: () => app.saveStyle('text', L) });
  return {
    title, tabs, actions,
    render: (body, tab) => {
      if (tab === 'Keyframe') return kfTab(body, L, LAYER_PROPS);
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
          { type: 'el', el: layoutButtons(L) },
          { label: 'Kesim', path: 'crop', type: 'chips', options: CROPS },
          { label: 'Boyut', path: 'w', type: 'range', min: 0.1, max: 1.6, fmt: pct },
          { label: 'İçerik zoom', path: 'zoom', type: 'range', min: 1, max: 3, fmt: pct },
          { label: 'İçerik yatay', path: 'panX', type: 'range', min: -1, max: 1 },
          { label: 'İçerik dikey', path: 'panY', type: 'range', min: -1, max: 1 },
          { label: 'Köşe yuvarlama', path: 'radius', type: 'range', min: 0, max: 300, step: 1 },
          { label: 'Çerçeve', path: 'borderW', type: 'range', min: 0, max: 30, step: 1 },
          { label: 'Çerçeve rengi', path: 'borderColor', type: 'color' },
          { label: 'Neon parlama', path: 'borderGlow', type: 'range', min: 0, max: 80, step: 1 },
          { label: 'Gölge', path: 'shadowOn', type: 'toggle' },
          { label: 'Ken Burns zoom', path: 'kenburns', type: 'toggle' },
          { label: 'Ses seviyesi', path: 'volume', type: 'range', min: 0, max: 2, fmt: pct, hide: !isV },
          { label: 'Döngü', path: 'loop', type: 'toggle', hide: !isV },
        ]));
      } else if (L.kind === 'media' && tab === 'Maske') {
        if (!L.mask) L.mask = { type: 'none', x: 0.5, y: 0.5, w: 0.8, h: 0.8, feather: 0, invert: false, radius: 0 };
        body.append(h('p', { class: 'hint', html: 'Maske, katmanın sadece seçtiğin bölgesini gösterir. Maske açıkken kenar çerçevesi ve gölge kapanır.' }));
        body.append(fields(L, [
          { label: 'Maske', path: 'mask.type', type: 'chips', options: [['none', 'Yok'], ['rect', 'Dikdörtgen'], ['ellipse', 'Elips']], rerender: true },
          { label: 'Merkez yatay', path: 'mask.x', type: 'range', min: 0, max: 1, fmt: pct, hide: L.mask.type === 'none' },
          { label: 'Merkez dikey', path: 'mask.y', type: 'range', min: 0, max: 1, fmt: pct, hide: L.mask.type === 'none' },
          { label: 'Genişlik', path: 'mask.w', type: 'range', min: 0.05, max: 1.5, fmt: pct, hide: L.mask.type === 'none' },
          { label: 'Yükseklik', path: 'mask.h', type: 'range', min: 0.05, max: 1.5, fmt: pct, hide: L.mask.type === 'none' },
          { label: 'Köşe', path: 'mask.radius', type: 'range', min: 0, max: 300, step: 1, hide: L.mask.type !== 'rect' },
          { label: 'Kenar yumuşatma', path: 'mask.feather', type: 'range', min: 0, max: 120, step: 1, hide: L.mask.type === 'none' },
          { label: 'Ters çevir', path: 'mask.invert', type: 'toggle', hide: L.mask.type === 'none' },
        ]));
      } else if (L.kind === 'shape' && tab === 'Şekil') {
        const lineLike = L.shape === 'line' || L.shape === 'arrow';
        body.append(fields(L, [
          { label: 'Şekil', path: 'shape', type: 'chips', options: SHAPES, rerender: true },
          { label: 'Genişlik', path: 'w', type: 'range', min: 0.03, max: 1.2, fmt: pct, hide: L.shape === 'frame' },
          { label: 'Yükseklik', path: 'h', type: 'range', min: 0.03, max: 2, fmt: pct, hide: lineLike || L.shape === 'frame' },
          { label: 'Kenar boşluğu', path: 'inset', type: 'range', min: 0, max: 0.2, step: 0.005, fmt: pct, hide: L.shape !== 'frame' },
          { label: 'Renk', path: 'color', type: 'color', swatches: ['#FFFFFF', '#FACC15', '#38BDF8', '#A855F7', '#E879F9', '#F43F5E', '#22C55E', '#000000'] },
          { label: 'Çizgi kalınlığı', path: 'strokeW', type: 'range', min: 0, max: 40, step: 1 },
          { label: 'Neon parlama', path: 'glow', type: 'range', min: 0, max: 100, step: 1 },
          { label: 'Köşe yuvarlama', path: 'radius', type: 'range', min: 0, max: 200, step: 1, hide: L.shape !== 'rect' && L.shape !== 'frame' },
          { label: 'Dolgu', path: 'fillOn', type: 'toggle', rerender: true, hide: lineLike },
          { label: 'Dolgu rengi', path: 'fillColor', type: 'color', hide: lineLike || !L.fillOn },
          { label: 'Dolgu opaklığı', path: 'fillOpacity', type: 'range', min: 0, max: 1, fmt: pct, hide: lineLike || !L.fillOn },
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
        const saved = app.getStyles('subs');
        if (saved.length) {
          const ch = h('div', { class: 'chips' });
          saved.forEach((st) => ch.append(h('button', { onclick: () => { S.style = { ...S.style, ...clone(st.data) }; app.change(true); refreshSheet(); } }, st.name)));
          body.append(h('div', { class: 'field full' }, h('label', {}, 'Kayıtlı stillerim'), ch));
        }
        body.append(h('button', { class: 'btn block', style: { marginBottom: '6px' }, html: `${I.save} Bu stili kaydet`, onclick: () => app.saveStyle('subs', S.style) }));
        body.append(h('p', { class: 'hint', html: 'Not: SRT/VTT dosyaları cümle zamanı içerir. Kelime vurgusu, kelimeler satır süresine <b>yaklaşık</b> dağıtılarak yapılır; gerekirse satırı bölerek zamanlamayı düzelt.' }));
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
              h('button', { title: 'Oynatıcı konumundan ikiye böl', onclick: () => {
                const tt = app.engine.t - (S.offset || 0);
                if (tt <= c.start + 0.1 || tt >= c.end - 0.1) { toast('Bölmek için oynatıcıyı bu satırın içine getir'); return; }
                const words = c.text.split(/\s+/).filter(Boolean);
                const k = Math.max(1, Math.min(words.length - 1, Math.round(words.length * (tt - c.start) / (c.end - c.start))));
                const n = { start: tt, end: c.end, text: words.slice(k).join(' ') || '…' };
                c.end = tt; c.text = words.slice(0, k).join(' ') || '…';
                S.cues.splice(i + 1, 0, n); app.change(true); app.refreshTimeline(); refreshSheet();
              } }, 'Böl'),
              i < S.cues.length - 1 ? h('button', { title: 'Sonraki satırla birleştir', onclick: () => {
                const n = S.cues[i + 1]; c.end = n.end; c.text = `${c.text} ${n.text}`; S.cues.splice(i + 1, 1); app.change(true); app.refreshTimeline(); refreshSheet();
              } }, '+Birleş') : null,
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
          h('button', { class: 'btn', html: `${I.upload} SRT / VTT yükle`, onclick: () => app.importSRT() }),
          h('button', { class: 'btn', html: `${I.export} SRT kaydet`, onclick: async () => {
            const blob = new Blob([toSRT(S.cues)], { type: 'text/plain' });
            const r = await saveVideo(blob, `${app.P.name || 'alpicut'}.srt`, { share: true });
            toast(r.where ? `${r.where} klasörüne kaydedildi` : 'Kaydedildi');
          } }),
        ));
        body.append(h('button', { class: 'btn block', html: `${I.export} VTT kaydet`, onclick: async () => {
          const blob = new Blob([toVTT(S.cues)], { type: 'text/vtt' });
          const r = await saveVideo(blob, `${app.P.name || 'alpicut'}.vtt`, { share: true });
          toast(r.where ? `${r.where} klasörüne kaydedildi` : 'Kaydedildi');
        } }));
        body.append(fields(S, [{ label: 'Videoya göm', path: 'burn', type: 'toggle' }]));
        body.append(h('p', { class: 'hint', html: '<b>Videoya göm</b> kapalıysa altyazı dışa aktarılan videoda görünmez; SRT/VTT dosyasını ayrıca platforma yükleyebilirsin.' }));
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
      const mine = app.getStyles('text');
      if (mine.length) {
        body.append(h('h4', { class: 'sub-title' }, 'Benim stillerim'));
        const g2 = h('div', { class: 'grid-tpl', style: { marginBottom: '14px' } });
        mine.forEach((st) => {
          const L = { ...clone(TEXT_BASE), ...clone(st.data) };
          const cv = previewCanvas((ctx, env) => drawText(ctx, L, ST, env));
          g2.append(h('div', { class: 'tpl' },
            h('button', { style: { display: 'block', width: '100%' }, onclick: () => app.addLayer({ ...clone(L) }) }, cv),
            h('span', { class: 'tpl-row' }, st.name, h('button', { class: 'tpl-del', html: I.trash, 'aria-label': 'Sil', onclick: () => { app.deleteStyle(st.id); refreshSheet(); } }))));
        });
        body.append(g2);
        body.append(h('div', { class: 'btn-row' },
          h('button', { class: 'btn', html: `${I.export} Stilleri dışa aktar`, onclick: () => app.exportStyles() }),
          h('button', { class: 'btn', html: `${I.upload} Stil dosyası yükle`, onclick: () => app.importStyles() })));
        body.append(h('h4', { class: 'sub-title' }, 'Hazır şablonlar'));
      } else {
        body.append(h('p', { class: 'hint', html: 'Bir yazıyı beğendiğin hale getirince denetçideki <b>kaydet</b> simgesiyle kendi stilin olarak saklayabilirsin.' }));
        body.append(h('button', { class: 'btn block', style: { marginBottom: '10px' }, html: `${I.upload} Stil dosyası yükle`, onclick: () => app.importStyles() }));
      }
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

export function openShapes() {
  openSheet({
    title: 'Şekiller ve çerçeveler', tall: true,
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Oyuncuyu göstermek için ok veya çember ekle, sonra <b>Keyframe</b> sekmesiyle oyuncuyu takip ettir.' }));
      const grid = h('div', { class: 'grid-tpl' });
      SHAPE_PRESETS.forEach((p) => {
        const L = { ...clone(SHAPE_BASE), ...clone(p.p) };
        const cv = previewCanvas((ctx, env) => {
          if (L.shape === 'frame') { const fl = { ...L, shape: 'rect', w: 0.9, h: 0.5 }; return drawShape(ctx, fl, 0, env); }
          ctx.save(); ctx.rotate((L.rot || 0) * Math.PI / 180); const b = drawShape(ctx, L, 0, env); ctx.restore(); return b;
        });
        grid.append(h('button', { class: 'tpl', onclick: () => app.addLayer({ ...L }, 3) }, cv, h('span', {}, p.name)));
      });
      body.append(grid);
    },
  });
}

let sfxCtx = null;
export function openSfx() {
  openSheet({
    title: 'Ses efektleri', tall: true,
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Efektler uygulamanın içinde üretilir, telif sorunu yoktur. ▶ ile dinle, <b>Ekle</b> ile oynatıcı konumuna yerleştir. Kendi ses dosyan için alttaki <b>Ses</b> aracını kullan.' }));
      SFX.forEach(([id, name, dur]) => {
        body.append(h('div', { class: 'sfx-row' },
          h('button', { class: 'icon-btn', html: I.play, 'aria-label': `${name} dinle`, onclick: async () => {
            const r = await renderSfx(id);
            try {
              sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)();
              const src = sfxCtx.createBufferSource(); src.buffer = r.buffer; src.connect(sfxCtx.destination); src.start();
            } catch (_) { /* yoksay */ }
          } }),
          h('span', { class: 'sfx-name' }, name, h('small', {}, ` ${dur.toFixed(1)} sn`)),
          h('button', { class: 'btn', onclick: () => app.addSfx(id, name) }, 'Ekle')));
      });
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
  const opt = { q: 1080, fps: 30, limit: 0 };
  const mime = Engine.pickMime();
  const fmtName = mime == null ? 'Desteklenmiyor' : (mime.includes('mp4') ? 'MP4' : 'WebM');
  const dur = app.engine.duration();
  let cancel = false;

  const close = () => { modal.classList.add('hidden'); };
  const chips = (list, key) => {
    const c = h('div', { class: 'chips' });
    list.forEach(([v, l]) => c.append(h('button', { class: opt[key] === v ? 'on' : '', onclick: () => { opt[key] = v; renderOpts(); } }, l)));
    return c;
  };
  const renderOpts = () => {
    card.textContent = '';
    card.append(h('h3', {}, 'Dışa Aktar'));
    card.append(h('p', { class: 'hint', html: `Süre <b>${fmt(dur)}</b> · Format <b>${fmtName}</b> · Oran <b>${app.P.ratio}</b>` }));
    card.append(h('div', { class: 'field full' }, h('label', {}, 'Çözünürlük'), chips([[1080, '1080p'], [720, '720p'], [540, '540p (hızlı)']], 'q')));
    card.append(h('div', { class: 'field full' }, h('label', {}, 'Kare hızı'), chips([[30, '30 fps'], [60, '60 fps']], 'fps')));
    card.append(h('div', { class: 'field full' }, h('label', {}, 'Dosya boyutu sınırı'), chips([[0, 'Yok'], [10, '10 MB'], [30, '30 MB'], [50, '50 MB'], [100, '100 MB']], 'limit')));
    if (opt.limit) {
      const vb = targetBitrate(opt.limit, dur);
      const low = vb < 1.2e6;
      card.append(h('p', { class: 'hint', html: `Hedef video bitrate ≈ <b>${(vb / 1e6).toFixed(1)} Mbps</b>. Sonuç ölçülür; sınır aşılırsa daha düşük kalitede otomatik yeniden oluşturulur (en fazla 2 kez).${low ? '<br><b>Uyarı:</b> Bu süre için sınır dar, görüntü kalitesi düşebilir. 720p seçmek daha temiz sonuç verir.' : ''}` }));
    }
    card.append(h('p', { class: 'hint', html: 'Video gerçek zamanlı oluşturulur (30 sn video ≈ 30 sn). Bu sırada ekranı kapatma ve uygulamadan çıkma.' }));
    if (fmtName === 'WebM') card.append(h('p', { class: 'hint', html: 'Not: Bu cihaz MP4 kaydını desteklemiyor, video <b>WebM</b> olarak çıkacak. YouTube kabul eder.' }));
    card.append(h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: close }, 'Vazgeç'),
      h('button', { class: 'btn primary', html: `${I.export} Oluştur`, onclick: start, disabled: mime == null })));
    card.append(h('button', { class: 'btn block', style: { marginTop: '4px' }, html: `${I.media} Bu kareyi PNG kaydet`, onclick: saveFrame }));
  };

  const saveFrame = async () => {
    const E = app.engine;
    const old = E.scale;
    E.exporting = true; E.resize(opt.q / short); E.draw();
    const blob = await new Promise((r) => E.canvas.toBlob(r, 'image/png'));
    E.exporting = false; E.resize(old); E.requestDraw(); app.fitStage();
    const r = await saveVideo(blob, `Alpicut_kare_${fmt(E.t).replace(/[:.]/g, '-')}.png`, { share: true });
    toast(r.where ? `${r.where} klasörüne kaydedildi` : 'Kare kaydedildi');
  };

  const start = async () => {
    cancel = false;
    let wake = null;
    try { wake = await navigator.wakeLock?.request('screen'); } catch (_) { /* yoksay */ }
    const res = opt.q / short;
    const qbr = ({ 1080: 12e6, 720: 7e6, 540: 4e6 }[opt.q]) * (opt.fps === 60 ? 1.5 : 1);
    let br = opt.limit ? Math.min(qbr, targetBitrate(opt.limit, dur)) : qbr;
    const abr = opt.limit ? 128000 : 192000;
    let out = null, attempt = 0, note = '';
    const limitB = opt.limit * 1048576;
    while (true) {
      attempt++;
      card.textContent = '';
      const bar = h('i');
      const pctEl = h('div', { class: 'big-pct' }, '0%');
      card.append(h('h3', {}, attempt > 1 ? `Yeniden oluşturuluyor (${attempt}/3)…` : 'Video oluşturuluyor…'), pctEl, h('div', { class: 'progress' }, bar),
        h('p', { class: 'hint', html: attempt > 1 ? `Önceki deneme sınırı aştı (${note}). Bitrate düşürüldü: <b>${(br / 1e6).toFixed(2)} Mbps</b>.` : 'Ekranı açık tut. Önizlemede ilerlemeyi görebilirsin.' }),
        h('button', { class: 'btn block', onclick: () => { cancel = true; } }, 'İptal'));
      out = null;
      try {
        out = await app.engine.export({ res, fps: opt.fps, bitrate: br, abr, onProgress: (p) => { bar.style.width = `${p * 100}%`; pctEl.textContent = `${Math.round(p * 100)}%`; }, shouldCancel: () => cancel });
      } catch (e) {
        console.error(e);
        toast(`Hata: ${e.message || e}`, 4000);
      }
      if (!out || !opt.limit || out.blob.size <= limitB || attempt >= 3) break;
      note = `${(out.blob.size / 1048576).toFixed(1)} MB`;
      br = Math.max(250000, br * (limitB / out.blob.size) * 0.88);
    }
    try { wake && wake.release(); } catch (_) { /* yoksay */ }
    app.fitStage();
    if (!out) { close(); if (cancel) toast('İptal edildi'); return; }
    const d = new Date();
    const name = `Alpicut_${(app.P.name || 'video').replace(/[^\wğüşıöçĞÜŞİÖÇ-]+/g, '_')}_${d.getHours()}${String(d.getMinutes()).padStart(2, '0')}.${out.ext}`;
    const sizeMB = out.blob.size / 1048576;
    const verdict = opt.limit ? (out.blob.size <= limitB
      ? `<br>✅ Doğrulandı: <b>${sizeMB.toFixed(1)} MB ≤ ${opt.limit} MB</b>`
      : `<br>⚠️ 3 denemeye rağmen <b>${sizeMB.toFixed(1)} MB</b> (sınır ${opt.limit} MB). Daha düşük çözünürlük seç.`) : '';
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
      card.append(h('h3', {}, 'Hazır! 🎉'),
        h('p', { class: 'hint', html: `${name} · ${sizeMB.toFixed(1)} MB${verdict}${r.where ? `<br>Kaydedildi: <b>${r.where}</b>` : ''}` }),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: close }, 'Kapat'),
          h('button', { class: 'btn primary', html: `${I.export} ${isNative() ? 'Paylaş / Kaydet' : 'Tekrar indir'}`, onclick: () => doSave(true) })));
    };
    doSave(true);
  };
  renderOpts();
}

// Hedef boyut için video bitrate (ses payı ve kapsayıcı yükü düşülür)
function targetBitrate(mb, dur) {
  const bits = mb * 1048576 * 8 * 0.92;
  return Math.max(250000, bits / Math.max(1, dur) - 128000);
}

export { uid };
