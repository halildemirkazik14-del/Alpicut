// Alpicut — alt paneller: denetçi, ekleme menüleri, dışa aktarma
import { app, $, h, getPath, setPath, clone, fmt, toast, selected, uid } from './state.js';
import { I } from './icons.js';
import {
  FONTS, WEIGHTS, ANIM_IN, ANIM_OUT, ANIM_LOOP, TRANSITIONS, FILTER_PRESETS, DEFAULT_FILTERS,
  TEXT_BASE, TEXT_TEMPLATES, CTA_BASE, CTA_PRESETS, SCORE_BASE, SUB_PRESETS, SUB_BASE, RATIOS, SHAPE_BASE, SHAPE_PRESETS,
} from './presets.js';
import { drawText, drawCTA, drawScore, drawShape, drawFit, ICON_NAMES, BLENDS, SHAPES, CROPS, MASK_SHAPES, capStyle } from './render.js';
import { bgRemoveTab } from './ai.js';
import { Engine } from './engine.js';
import { saveVideo, isNative } from './storage.js';
import { parseSRT, toSRT, toVTT } from './srt.js';
import { LAYER_PROPS, CLIP_PROPS, EASES, propAt, hasKeys, keyAt, setKey, delKey, writeProp, allKeyTimes, rescaleKeys } from './kf.js';
import { layoutClips, SPEED_CURVES, curvePts, curveSpeed } from './engine.js';
import { rangeControl, guessDefault } from './ctl.js';
import { curvePicker, graphView } from './kfui.js';
import { star, favIds, registerFav } from './favs.js';
import { transBody, TR_CATS } from './transitions.js';
import { GL_LIST, transGL } from './gltrans.js';
import { SOCIAL_TEMPLATES, drawSocial, SOCIAL_FIELDS } from './social.js';
import { fontPickerBody, isBundled, fontWeights, ensureProjectFonts } from './fonts.js';
import { colorTab, chromaTab, audioFxTab, audioToolsTab, slipControl, fxLayerInspector, openStickers } from './ui3.js';

// ---------- panel altyapısı (yüzen pencereler: wm.js) ----------
import * as WM from './wm.js';

export function isSheetOpen() { return WM.isOpen(); }
export function openSheet(cfg) { return WM.open(cfg); }
export function closeSheet(fromPop = false) { WM.close(undefined, fromPop === true); }
export function closeAllSheets() { WM.closeAll(); }
export function refreshSheet() { WM.refresh(); }
export function refreshLive() { WM.refreshLive(); }

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

app.__sheets = { fields: (...a) => fields(...a) };
export function fields(obj, list, opts = {}) {
  const frag = document.createDocumentFragment();
  const change = (f, v, final) => {
    if (f.kf) (app.autoKey ? setKey : writeProp)(obj, f.kf, localT(obj), v);
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
        const rc = rangeControl({
          min: f.min, max: f.max, step: f.step || 0.01, value: v ?? f.min, fmt: fmtv, label: f.label,
          def: f.def ?? guessDefault(f.kf || f.path, f.min, f.max),
          onInput: (x) => change(f, x, false), onChange: (x) => change(f, x, true),
        });
        const lbl2 = h('label', {}, f.label, f.kf && hasKeys(obj, f.kf) ? h('span', { class: 'kf-mark' }, ' ◆') : null);
        frag.append(h('div', { class: 'field rngf' }, h('div', { class: 'rng-top' }, lbl2, rc.val), rc.row));
        return;
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
  if (o.out != null && o.start != null && !o.type) return o.out - o.in;
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
  const build = (ob) => {
    const S = app.sel || s;
    if (ob.locked) return lockedInspector(ob, S.type);
    if (S.type === 'clip') return clipInspector(ob);
    if (S.type === 'layer') return (ob.kind === 'fx' || ob.kind === 'adjust') ? fxLayerInspector(ob) : layerInspector(ob);
    if (S.type === 'audio') return audioInspector(ob);
    return subsInspector(extra);
  };
  const cfg = build(o);
  if (!cfg) return;
  cfg.refresh = (p) => {
    const ob = selected();
    if (!ob) return false;
    const n = build(ob);
    p.cfg.render = n.render; p.cfg.title = n.title; p.cfg.actions = n.actions;
    if (n.tabs && JSON.stringify(n.tabs) !== JSON.stringify(p.cfg.tabs)) { p.cfg.tabs = n.tabs; if (!n.tabs.includes(p.tab)) p.tab = n.tabs[0]; }
    return true;
  };
  cfg.id = 'inspector';
  cfg.live = true;
  if (tab && cfg.tabs?.includes(tab)) cfg.tab = tab;
  openSheet(cfg);
}

function lockedInspector(o, type) {
  return {
    title: 'Kilitli öğe', tabs: [],
    actions: [{ icon: I.unlock, label: 'Kilidi aç', onClick: () => { o.locked = false; app.change(true); refreshSheet(); } }],
    render: (body) => body.append(h('p', { class: 'hint', html: 'Bu öğe <b>kilitli</b>; taşınamaz ve düzenlenemez. Düzenlemek için üstteki kilit simgesiyle kilidi aç.' })),
  };
  void type;
}

function flagActions(o, kind) {
  const a = [];
  if (kind === 'layer') a.push({ icon: o.hidden ? I.eyeOff : I.eye, label: o.hidden ? 'Göster' : 'Gizle', onClick: () => { o.hidden = !o.hidden; app.change(true); refreshSheet(); } });
  if (kind === 'audio') a.push({ icon: o.mute ? I.mute : I.sfx, label: o.mute ? 'Sesi aç' : 'Sessize al', onClick: () => { o.mute = !o.mute; app.change(true); refreshSheet(); } });
  a.push({ icon: I.lock, label: 'Kilitle', onClick: () => { o.locked = true; app.change(true); refreshSheet(); toast('Kilitlendi'); } });
  return a;
}

function commonActions(kind) {
  const a = [];
  // Böl / Kopyala alttaki bağlamsal araç çubuğunda
  void kind;
  a.push({ icon: I.trash, label: 'Sil', danger: true, onClick: () => app.delSel() });
  return a;
}

function filterTab(body, obj) {
  if (!obj.filters) obj.filters = { ...DEFAULT_FILTERS };
  body.append(h('button', { class: 'btn block primary', style: { marginBottom: '10px' }, html: `${I.filter} Filtre kütüphanesi (64 görünüm)`, onclick: async () => { const m = await import('./filters.js'); m.openFilters(obj); } }));
  body.append(h('div', { class: 'sub-title' }, 'Elle ayar'));
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
    tabs: isV && !c.freeze ? ['Düzen', 'Renk', 'Arka plan', 'Chroma', 'Maske', 'Ses', 'Keyframe', 'Geçiş', 'Filtre'] : ['Düzen', 'Renk', 'Arka plan', 'Chroma', 'Maske', 'Keyframe', 'Geçiş', 'Filtre'],
    actions: [
      { icon: I.left, label: 'Sola taşı', onClick: () => app.moveClip(-1) },
      { icon: I.right, label: 'Sağa taşı', onClick: () => app.moveClip(1) },
      ...(isV && !c.freeze ? [{ icon: I.freeze, label: 'Kareyi dondur', onClick: () => app.freezeFrame() }, { icon: I.reverse, label: 'Ters çevir', onClick: () => app.reverseClip(c) }] : []),
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
          { type: 'el', el: speedCurveEl(c), hide: !isV || c.freeze },
          { type: 'hint', html: 'Hız değişince ses perdesi korunur. Ters oynatma için üstteki <b>⟲ Ters çevir</b> simgesini kullan.', hide: !isV || c.freeze },
          { label: 'Ses seviyesi', path: 'volume', type: 'range', min: 0, max: 2, fmt: pct, hide: !isV || c.freeze },
          { label: 'Sessiz', path: 'mute', type: 'toggle', hide: !isV || c.freeze },
          { label: 'Kırp: başlangıç', path: 'in', type: 'range', min: 0, max: mdur, step: 0.05, fmt: sec, hide: !isV || c.freeze, post: (o) => { o.in = Math.min(o.in, o.out - 0.2); app.refreshTimeline(); } },
          { label: 'Kırp: bitiş', path: 'out', type: 'range', min: 0, max: mdur, step: 0.05, fmt: sec, hide: !isV || c.freeze, post: (o) => { o.out = Math.max(o.out, o.in + 0.2); app.refreshTimeline(); } },
        ]));
        if (isV && !c.freeze) body.append(slipControl(c, mdur));
      } else if (tab === 'Geçiş') {
        if (idx === 0) { body.append(h('p', { class: 'hint', html: 'İlk klibe geçiş eklenemez. Geçiş, <b>bu klipten önceki</b> klip ile bu klip arasında uygulanır. Zaman çizelgesinde kesimlerdeki <b>+</b> noktasına dokun.' })); return; }
        const cats = h('div', { class: 'chips scroll', style: { marginBottom: '8px' } });
        ['★', ...TR_CATS].forEach((ct) => cats.append(h('button', { class: TRTAB.v === ct ? 'on' : '', onclick: () => { TRTAB.v = ct; refreshSheet(); } }, ct)));
        body.append(cats);
        transBody(body, c, TRTAB.v, () => refreshSheet());
      } else if (tab === 'Filtre') filterTab(body, c);
      else if (tab === 'Keyframe') kfTab(body, c, isV && !c.freeze ? [...CLIP_PROPS, ['vol', 'Ses seviyesi', 0, 2, 0.01]] : CLIP_PROPS, true);
      else if (tab === 'Renk') colorTab(body, c);
      else if (tab === 'Arka plan') bgRemoveTab(body, c);
      else if (tab === 'Chroma') chromaTab(body, c);
      else if (tab === 'Maske') maskTab(body, c, 'klibin');
      else if (tab === 'Ses') audioFxTab(body, c, 'voice');
    },
  };
}

// ---------- Hız eğrisi ----------
function speedCurveEl(c) {
  const wrap = h('div', { class: 'field full' });
  const chips = h('div', { class: 'chips' });
  const cur = Array.isArray(c.curve) ? 'custom' : (c.curve || 'none');
  const set = (k) => { const L0 = app.layout().find((x) => x.clip === c); const oldLen = L0?.len || 1; c.curve = k === 'none' ? null : k; const L1 = app.layout().find((x) => x.clip === c); if (L1 && c.kf) rescaleKeys(c, oldLen, L1.len); app.change(true); app.refreshTimeline(); refreshSheet(); };
  chips.append(h('button', { class: cur === 'none' ? 'on' : '', onclick: () => set('none') }, 'Sabit'));
  Object.entries(SPEED_CURVES).forEach(([k, [n]]) => chips.append(h('button', { class: cur === k ? 'on' : '', onclick: () => set(k) }, n)));
  wrap.append(h('label', {}, 'Hız eğrisi'), chips);
  if (c.curve) {
    const pts = curvePts(c);
    const cv = h('canvas', { width: 560, height: 140, class: 'curve-cv' });
    const x = cv.getContext('2d');
    x.fillStyle = '#0b0814'; x.fillRect(0, 0, 560, 140);
    x.strokeStyle = '#2a2044'; x.beginPath(); x.moveTo(0, 140 - (1 / 3) * 140); x.lineTo(560, 140 - (1 / 3) * 140); x.stroke();
    x.strokeStyle = '#A78BFA'; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i <= 100; i++) { const u = i / 100; const v = curveSpeed(c, u); const y = 140 - Math.min(1, v / 3) * 130 - 5; i ? x.lineTo(u * 560, y) : x.moveTo(0, y); }
    x.stroke();
    wrap.append(cv, h('p', { class: 'hint' }, `Çizgi hız çarpanını gösterir (orta çizgi = 1x). Klip süresi: ${app.layout().find((L) => L.clip === c)?.len.toFixed(1)} sn`));
    void pts;
  }
  return wrap;
}

// ---------- Maske ----------
function maskTab(body, o, who) {
  if (!o.mask) o.mask = { type: 'none', x: 0.5, y: 0.5, w: 0.8, h: 0.8, feather: 0, invert: false, radius: 0, rot: 0 };
  const m = o.mask, off = m.type === 'none';
  body.append(h('p', { class: 'hint', html: `Maske, ${who} sadece seçtiğin şeklin içini gösterir (Ters çevir ile dışını). Bölme maskeleriyle iki videoyu yan yana/üst üste koyabilirsin.` }));
  body.append(fields(o, [
    { label: 'Maske şekli', path: 'mask.type', type: 'chips', options: MASK_SHAPES, rerender: true },
    { label: 'Merkez yatay', path: 'mask.x', type: 'range', min: -0.2, max: 1.2, fmt: pct, def: 0.5, hide: off },
    { label: 'Merkez dikey', path: 'mask.y', type: 'range', min: -0.2, max: 1.2, fmt: pct, def: 0.5, hide: off },
    { label: 'Genişlik', path: 'mask.w', type: 'range', min: 0.05, max: 1.5, fmt: pct, def: 0.8, hide: off || /^split|diagonal/.test(m.type) },
    { label: 'Yükseklik', path: 'mask.h', type: 'range', min: 0.05, max: 1.5, fmt: pct, def: 0.8, hide: off || /^split|diagonal/.test(m.type) },
    { label: 'Döndür', path: 'mask.rot', type: 'range', min: -180, max: 180, step: 1, def: 0, fmt: deg, hide: off },
    { label: 'Köşe', path: 'mask.radius', type: 'range', min: 0, max: 300, step: 1, hide: m.type !== 'rect' },
    { label: 'Kenar yumuşatma', path: 'mask.feather', type: 'range', min: 0, max: 150, step: 1, def: 0, hide: off },
    { label: 'Ters çevir', path: 'mask.invert', type: 'toggle', hide: off },
  ]));
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
const GRAPH = new Set();
const TRTAB = { v: 'Temel' };
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
    const rc = rangeControl({ min, max, step, value: v, fmt: fmtv, label, def: guessDefault(p, min, max),
      onInput: (x) => { writeProp(o, p, lt, x); app.change(false); }, onChange: () => { app.change(true); refreshSheet(); } });
    const dia = h('button', { class: `kf-btn${on ? ' on' : ''}${hasKeys(o, p) ? ' has' : ''}`, disabled: !inside, html: I.diamond, 'aria-label': `${label} keyframe` });
    dia.addEventListener('click', () => { if (on) delKey(o, p, lt); else setKey(o, p, lt, propAt(o, p, lt)); app.change(true); refreshSheet(); });
    body.append(h('div', { class: 'field rngf' }, h('div', { class: 'rng-top' }, h('label', {}, label), h('span', { class: 'kf-top' }, rc.val, dia)), rc.row));
  });
  const here = props.filter(([p]) => keyAt(o, p, lt));
  if (here.length) {
    body.append(h('div', { class: 'sub-title' }, 'Bu keyframe\'den sonraki hareket eğrisi'));
    body.append(curvePicker(here.map(([p]) => keyAt(o, p, lt)), (final) => { app.change(final); if (final) refreshSheet(); }));
  } else if (times.length) {
    body.append(h('p', { class: 'hint', html: 'Eğriyi değiştirmek için <b>Önceki/Sonraki</b> ile bir keyframe\'e git.' }));
  }
  if (times.length) {
    body.append(h('div', { class: 'btn-row' },
      h('button', { class: 'btn', html: `${I.curve} Tümünü otomatik yumuşat`, onclick: () => { Object.values(o.kf || {}).forEach((arr) => arr.forEach((k) => { k.ease = 'auto'; })); app.change(true); refreshSheet(); toast('Tüm hareketler yumuşatıldı'); } }),
      h('button', { class: 'btn', onclick: () => { if (GRAPH.has(o.id)) GRAPH.delete(o.id); else GRAPH.add(o.id); refreshSheet(); } }, GRAPH.has(o.id) ? 'Grafiği gizle' : 'Grafik görünümü')));
    if (GRAPH.has(o.id)) body.append(graphView(o, props, lt, len, { onSeek: (t) => go(t), onChange: (final) => { app.change(final); if (final) refreshSheet(); } }));
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
  const title = { text: 'Yazı', media: 'Katman', cta: 'Sosyal medya çağrısı', score: 'Skor kartı', shape: 'Şekil', sticker: 'Çıkartma', social: 'Sosyal medya', group: 'Grup', wave: 'Ses dalgası' }[L.kind];
  const tabs = {
    text: ['Metin', 'Stil', 'Animasyon', 'Keyframe', 'Konum'],
    media: ['Düzen', 'Arka plan', 'Chroma', 'Maske', 'Renk', 'Animasyon', 'Keyframe', 'Filtre', 'Konum'],
    sticker: ['Çıkartma', 'Animasyon', 'Keyframe', 'Konum'],
    social: ['İçerik', 'Animasyon', 'Keyframe', 'Konum'],
    group: ['Grup', 'Animasyon', 'Keyframe', 'Konum'],
    wave: ['Dalga', 'Animasyon', 'Keyframe', 'Konum'],
    cta: ['Buton', 'Animasyon', 'Keyframe', 'Konum'],
    score: ['Skor', 'Animasyon', 'Keyframe', 'Konum'],
    shape: ['Şekil', 'Animasyon', 'Keyframe', 'Konum'],
  }[L.kind];
  const actions = [...flagActions(L, 'layer'), ...commonActions('layer')];
  if (L.kind === 'text') actions.unshift({ icon: I.save, label: 'Stili kaydet', onClick: () => app.saveStyle('text', L) });
  return {
    title, tabs, actions,
    render: (body, tab) => {
      if (tab === 'Keyframe') return kfTab(body, L, LAYER_PROPS);
      if (tab === 'Renk') return colorTab(body, L);
      if (tab === 'Chroma') return chromaTab(body, L);
      if (tab === 'Arka plan') return bgRemoveTab(body, L);
      if (tab === 'İçerik' && L.kind === 'social') return socialTab(body, L);
      if (tab === 'Dalga') {
        body.append(h('p', { class: 'hint' }, 'Videodaki sesle canlı hareket eder (podcast, müzik videoları). Önizlemede oynatınca görürsün.'));
        return body.append(fields(L, [
          { label: 'Stil', path: 'style', type: 'chips', options: [['bars', 'Çubuk'], ['mirror', 'Ayna'], ['line', 'Çizgi'], ['circle', 'Daire']] },
          { label: 'Çubuk sayısı', path: 'bars', type: 'range', min: 8, max: 96, step: 1, def: 36 },
          { label: 'Genişlik', path: 'w', type: 'range', min: 0.1, max: 1, fmt: pct, def: 0.8 },
          { label: 'Yükseklik', path: 'h', type: 'range', min: 0.03, max: 0.6, fmt: pct, def: 0.16 },
          { label: 'Renk 1', path: 'color', type: 'color' },
          { label: 'Renk 2', path: 'color2', type: 'color' },
          { label: 'Parlama', path: 'glow', type: 'toggle' },
        ]));
      }
      if (tab === 'Grup') {
        body.append(h('p', { class: 'hint', html: `Bu grupta <b>${(L.children || []).length}</b> katman var. Grubu taşı, ölçekle, döndür veya animasyon ver — içindekiler birlikte hareket eder. İçindekileri tek tek düzenlemek için grubu çöz.` }));
        body.append(fields(L, [{ label: 'Grup adı', path: 'name', type: 'text', post: () => app.refreshTimelineSoon() }]));
        (L.children || []).forEach((c) => body.append(h('div', { class: 'kit-row' }, h('b', {}, `${c.kind === 'text' ? (c.text || '').split('\n')[0].replace(/\*/g, '') : c.kind}`), h('button', { class: 'icon-btn sm', html: c.hidden ? I.eyeOff : I.eye, onclick: () => { c.hidden = !c.hidden; app.change(true); refreshSheet(); } }))));
        body.append(h('button', { class: 'btn block', style: { marginTop: '8px' }, onclick: () => app.ungroup(L) }, 'Grubu çöz'));
        return;
      }
      if (tab === 'Çıkartma') {
        return body.append(fields(L, [
          { label: 'Metin', path: 'sd.text', type: 'text', hide: !L.sd },
          { label: 'Zemin rengi', path: 'sd.bg', type: 'color', hide: !L.sd },
          { label: 'Yazı rengi', path: 'sd.fg', type: 'color', hide: !L.sd },
          { label: 'Şekil', path: 'sd.shape', type: 'chips', options: [['pill', 'Hap'], ['tag', 'Etiket'], ['burst', 'Patlama'], ['circle', 'Daire'], ['ribbon', 'Kurdele'], ['outline', 'Çerçeve'], ['bubble', 'Balon'], ['arrow', 'Ok'], ['stamp', 'Damga'], ['box', 'Kutu']], hide: !L.sd },
          { label: 'Boyut', path: 'size', type: 'range', min: 40, max: 900, step: 1 },
          { type: 'el', el: h('button', { class: 'btn block', onclick: () => openStickers(L) }, 'Çıkartmayı değiştir') },
        ]));
      }
      if (tab === 'Animasyon') return animTab(body, L);
      if (tab === 'Konum') return posTab(body, L);
      if (tab === 'Filtre') return filterTab(body, L);
      if (L.kind === 'text' && tab === 'Metin') {
        body.append(fields(L, [
          { label: 'Metin', path: 'text', type: 'textarea', post: () => app.refreshTimelineSoon() },
          { type: 'hint', html: 'İpucu: <b>*kelime*</b> şeklinde yazdığın kelimeler vurgu rengiyle görünür.' },
          { type: 'el', el: fontButton(L, 'font', () => app.openInspector('Metin')) },
          { label: 'Kalınlık', path: 'weight', type: 'chips', options: weightOptions(L.font) },
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
        maskTab(body, L, 'katmanın');
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
    title: a.sfx ? 'SFX' : a.role === 'voice' ? 'Seslendirme' : 'Ses', tabs: ['Ses', 'Efekt', 'Keyframe', 'Araçlar'],
    actions: [...flagActions(a, 'audio'), ...commonActions('audio')],
    render: (body, tab) => {
      if (tab === 'Efekt') return audioFxTab(body, a, a.sfx ? 'sfx' : 'music');
      if (tab === 'Keyframe') return kfTab(body, a, [['vol', 'Ses seviyesi', 0, 2, 0.01]]);
      if (tab === 'Araçlar') return audioToolsTab(body, a);
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
        // v1.5: şablon şeridi
        const strip = h('div', { class: 'cap-strip' });
        body.append(h('div', { class: 'rng-top' }, h('label', { class: 'sub-title', style: { margin: '6px 0' } }, 'Şablonlar'), h('button', { class: 'btn', style: { padding: '6px 12px', fontSize: '13px' }, onclick: () => import('./captions.js').then((m) => m.openCaptionStyles()) }, 'Tümü')), strip);
        import('./captions.js').then((m) => {
          m.CAPTION_TEMPLATES.slice(0, 14).forEach((tpl) => strip.append(h('button', { class: `cap-mini${S.style.tpl === tpl.id ? ' on' : ''}`, onclick: () => { m.applyCaptionTemplate(tpl); refreshSheet(); } }, m.miniPreview(tpl), h('span', {}, tpl.name))));
        });
        const cs = capStyle(S.style);
        // eski "preset" stilini yeni alanlara taşı (bir kez)
        if (!S.style.mode) { Object.assign(S.style, { mode: cs.mode, group: cs.group, hl: cs.hl, anim: cs.anim, box: cs.box }); delete S.style.preset; }
        body.append(h('div', { class: 'sub-title' }, 'Görünüm'));
        body.append(fields(S.style, [
          { label: 'Gösterim', path: 'mode', type: 'chips', options: [['line', 'Tüm satır'], ['group', 'Kelime grubu'], ['single', 'Tek kelime']], rerender: true },
          { label: 'Grupta kelime', path: 'group', type: 'chips', options: [[2, '2'], [3, '3'], [4, '4'], [5, '5']], hide: S.style.mode !== 'group' },
          { label: 'Konuşulan kelime', path: 'hl', type: 'chips', options: [['color', 'Renk'], ['box', 'Kutu'], ['underline', 'Alt çizgi'], ['scale', 'Büyüt'], ['glow', 'Parlama'], ['karaoke', 'Karaoke dolum'], ['none', 'Yok']], rerender: true },
          { label: 'Animasyon', path: 'anim', type: 'chips', options: [['fade', 'Belir'], ['pop', 'Pop'], ['words', 'Kelime kelime'], ['slide', 'Kay'], ['typewriter', 'Daktilo'], ['none', 'Yok']] },
          { label: 'Arka plan', path: 'box', type: 'chips', options: [['none', 'Yok'], ['line', 'Satır kutusu'], ['block', 'Tek kart']], rerender: true },
        ]));
        body.append(h('div', { class: 'sub-title' }, 'Yazı'));
        body.append(fields(S.style, [
          { type: 'el', el: fontButton(S.style, 'font', () => app.openInspector('Stil')) },
          { label: 'Kalınlık', path: 'weight', type: 'chips', options: weightOptions(S.style.font) },
          { label: 'Boyut', path: 'size', type: 'range', min: 30, max: 180, step: 1 },
          { label: 'Renk', path: 'color', type: 'color' },
          { label: 'Vurgu rengi', path: 'accent', type: 'color' },
          { label: 'Kutudaki yazı rengi', path: 'hlText', type: 'color', hide: S.style.hl !== 'box' },
          { label: 'Kontur', path: 'strokeW', type: 'range', min: 0, max: 24, step: 0.5 },
          { label: 'Kontur rengi', path: 'strokeColor', type: 'color', hide: !(S.style.strokeW > 0) },
          { label: 'Gölge', path: 'shadow', type: 'range', min: 0, max: 1, fmt: pct, def: 0.5 },
          { label: 'Parlama', path: 'glow', type: 'range', min: 0, max: 60, step: 1, def: 0 },
          { label: 'Parlama rengi', path: 'glowColor', type: 'color', hide: !(S.style.glow > 0) },
          { label: 'Kutu rengi', path: 'boxColor', type: 'color', hide: (S.style.box || 'none') === 'none' },
          { label: 'Kutu saydamlığı', path: 'boxOpacity', type: 'range', min: 0, max: 1, fmt: pct, def: 0.72, hide: (S.style.box || 'none') === 'none' },
          { label: 'BÜYÜK HARF', path: 'upper', type: 'toggle' },
          { label: 'İtalik', path: 'italic', type: 'toggle' },
          { label: 'Noktalamayı gizle', path: 'noPunct', type: 'toggle' },
          { label: 'Harf aralığı', path: 'spacing', type: 'range', min: -2, max: 12, step: 0.5, def: 0 },
          { label: 'Eğim', path: 'rot', type: 'range', min: -10, max: 10, step: 0.5, def: 0, fmt: deg },
        ]));
        body.append(h('div', { class: 'sub-title' }, 'Yerleşim'));
        body.append(fields(S.style, [
          { label: 'Dikey konum', path: 'y', type: 'range', min: 0.08, max: 0.95, step: 0.005, fmt: pct, post: (o) => { o._yUser = true; } },
          { label: 'Satır genişliği', path: 'maxW', type: 'range', min: 0.4, max: 1, fmt: pct },
          { label: 'En çok satır', path: 'maxLines', type: 'chips', options: [[1, '1'], [2, '2'], [3, '3']] },
        ]));
        body.append(h('p', { class: 'hint', html: 'Not: SRT/VTT dosyaları cümle zamanı içerir; kelime vurgusu kelimeler satır süresine <b>yaklaşık</b> dağıtılarak yapılır.' }));
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
          h('button', { class: 'btn', html: `${I.ai} Yeniden oluştur`, onclick: () => import('./ai.js').then((m) => m.openAutoCaptions()) }),
          h('button', { class: 'btn', html: `${I.edit} Metinden kurgu`, onclick: () => import('./ai.js').then((m) => m.openTranscript()) })));
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

const ST = { alpha: 1, reveal: 1, glow: 0.3, sc: 1, out: 0, lt: 0 };
const SOCIAL_BASE = { kind: 'social', x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, scale: 1, dark: false, accent: '#8B5CF6' };

const tplCats = () => ['Tümü', ...new Set(TEXT_TEMPLATES.map((t) => t.cat || 'Temel'))];
let fontsWarm = false;
async function warmTemplateFonts(list) {
  if (!document.fonts) return;
  const specs = new Set(list.map((L) => `${L.italic ? 'italic ' : ''}${L.weight || 700} 40px "${L.font || 'Barlow Condensed'}"`));
  try { await Promise.all([...specs].map((sp) => document.fonts.load(sp, 'AaĞŞİçö'))); } catch (_) { /* yoksay */ }
}

export function openTemplates(tab) {
  openSheet({
    id: 'templates', title: `Yazı şablonları · ${TEXT_TEMPLATES.length}`, tabs: ['★', 'Benim', ...tplCats()], tab: tab || 'Tümü',
    render: (body, tb) => {
      if (tb === 'Benim') {
        const mine = app.getStyles('text');
        if (!mine.length) body.append(h('p', { class: 'hint', html: 'Bir yazıyı beğendiğin hale getirince denetçideki <b>kaydet</b> simgesiyle kendi stilin olarak saklayabilirsin.' }));
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
        return;
      }
      const fvt = favIds('text');
      const list = TEXT_TEMPLATES.filter((t) => tb === 'Tümü' || (tb === '★' ? fvt.includes(t.id) : (t.cat || 'Temel') === tb)).map((tp) => ({ tp, L: { ...clone(TEXT_BASE), ...clone(tp.p) } }));
      if (tb === '★' && !list.length) body.append(h('p', { class: 'hint' }, 'Henüz favori şablon yok. ☆ ile ekle.'));
      const grid = h('div', { class: 'grid-tpl' });
      const draw = () => {
        grid.textContent = '';
        list.forEach(({ tp, L }) => {
          const cv = previewCanvas((ctx, env) => drawText(ctx, L, ST, env));
          grid.append(h('div', { class: 'tpl', role: 'button', onclick: () => { app.addLayer({ ...clone(L) }); } }, cv, h('span', {}, tp.name), star('text', tp.id, { name: tp.name })));
        });
      };
      draw();
      body.append(grid);
      if (!fontsWarm) warmTemplateFonts(list.map((x) => x.L)).then(() => { fontsWarm = true; draw(); });
    },
  });
}

// ---------- Sosyal medya şablonları ----------
export function openSocial(tab) {
  const cats = ['★', ...new Set(SOCIAL_TEMPLATES.map((t) => t.cat))];
  openSheet({
    id: 'social', title: 'Sosyal medya şablonları', tabs: cats, tab: tab && cats.includes(tab) ? tab : cats[1],
    render: (body, tb) => {
      body.append(h('p', { class: 'hint', html: 'Dokun: ekle. Eklendikten sonra isim, metin, mesajlar, sayılar, renkler ve fotoğraflar düzenlenebilir. ☆ ile favorile.' }));
      const grid = h('div', { class: 'grid-tpl' });
      const fv = favIds('social');
      const list = tb === '★' ? SOCIAL_TEMPLATES.filter((t) => fv.includes(t.id)) : SOCIAL_TEMPLATES.filter((t) => t.cat === tb);
      if (!list.length) body.append(h('p', { class: 'hint' }, 'Henüz favori şablon yok. Şablonlardaki ☆ ile ekle.'));
      list.forEach((tp) => {
        const dur = tp.dur || (tp.p.type === 'countdown' ? 3 : 4);
        const L = { ...clone(SOCIAL_BASE), ...clone(tp.p), start: 0, end: dur };
        const cv = previewCanvas((ctx, env) => drawSocial(ctx, L, Math.min(dur - 0.3, tp.p.type === 'imessage' || tp.p.type === 'whatsapp' ? 5 : 2.2), { ...env, img: (id) => app.engine.imgForMedia(id) }));
        grid.append(h('div', { class: 'tpl', role: 'button', onclick: () => { const x = clone(L); delete x.start; delete x.end; app.addLayer(x, dur); } }, cv, h('span', {}, tp.name), star('social', tp.id, { name: tp.name })));
      });
      body.append(grid);
    },
  });
}

function socialTab(body, L) {
  const keys = SOCIAL_FIELDS[L.type] || [];
  const LBL = { name: 'İsim', handle: 'Kullanıcı adı', time: 'Saat', text: 'Metin', likes: 'Beğeni', pinned: 'Sabitlendi', dark: 'Koyu tema', avatar: 'Profil fotoğrafı', lines: 'Mesajlar (her satır “İsim: mesaj”)', side: 'Konum', color: 'Renk', textColor: 'Yazı rengi', app: 'Uygulama adı', title: 'Başlık', accent: 'Vurgu rengi', accent2: 'İkinci renk', icon: 'İkon', from: 'Başlangıç', to: 'Bitiş', label: 'Etiket', dur: 'Sayma süresi (sn)', count: 'Sayı', value: 'Puan (0–5)', options: 'Seçenekler (her satır “Seçenek|oy”)', verified: 'Onay rozeti', replies: 'Yanıt', shares: 'Paylaşım', followers: 'Takipçi', following: 'Takip edilen', posts: 'Gönderi', btn: 'Buton yazısı', doneBtn: 'Tıklandıktan sonra', subs: 'Abone sayısı', videos: 'Video sayısı', msgs: 'Mesajlar — her satır bir mesaj. “> metin” = sen (sağ), “< metin” veya “Ad: metin” = karşı taraf', every: 'Mesaj aralığı (sn)', read: '“Okundu” göster', clock: 'Saat (üst çubuk)', status: 'Alt yazı (çevrimiçi…)', tapAt: 'Butona tıklama anı (sn)', portion: 'Ekran oranı', bg: 'Arka plan', fg: 'Başlık rengi', fg2: 'Alt metin rengi', size: 'Yazı boyutu', speed: 'Kayma hızı', number: 'Forma no', pos: 'Mevki', stats: 'İstatistikler (her satır “Ad|değer”)', teamA: '1. takım', teamB: '2. takım', colorA: '1. renk', colorB: '2. renk', label1: '1. video yazısı', label2: '2. video yazısı', banner: 'Kapak görseli', v1: '1. video görseli', v2: '2. video görseli' };
  const IMG = ['avatar', 'banner', 'v1', 'v2'];
  const list = [];
  keys.forEach((k) => {
    if (IMG.includes(k)) return;
    const lab = LBL[k] || k;
    if (['text', 'lines', 'options', 'msgs', 'stats'].includes(k)) list.push({ label: lab, path: k, type: 'textarea' });
    else if (['dark', 'pinned', 'verified', 'read'].includes(k)) list.push({ label: lab, path: k, type: 'toggle' });
    else if (['color', 'textColor', 'accent', 'accent2', 'bg', 'fg', 'fg2', 'colorA', 'colorB'].includes(k)) list.push({ label: lab, path: k, type: 'color' });
    else if (k === 'side') list.push({ label: lab, path: k, type: 'chips', options: L.type === 'halftext' ? [['top', 'Üst yarı'], ['bottom', 'Alt yarı']] : [['left', 'Gelen (sol)'], ['right', 'Giden (sağ)']], post: (o) => { if (o.type === 'halftext') o.y = o.side === 'bottom' ? 1 - (o.portion || 0.5) / 2 : (o.portion || 0.5) / 2; } });
    else if (k === 'icon') list.push({ label: lab, path: k, type: 'chips', options: ICON_NAMES });
    else if (k === 'value') list.push({ label: lab, path: k, type: 'range', min: 0, max: 5, step: 0.5 });
    else if (k === 'dur') list.push({ label: lab, path: k, type: 'range', min: 0.3, max: 6, step: 0.1, def: 1.6 });
    else if (k === 'every') list.push({ label: lab, path: k, type: 'range', min: 0.3, max: 3, step: 0.1, def: 1.1, fmt: sec });
    else if (k === 'tapAt') list.push({ label: lab, path: k, type: 'range', min: 0.3, max: 6, step: 0.1, def: 1.4, fmt: sec });
    else if (k === 'portion') list.push({ label: lab, path: k, type: 'range', min: 0.25, max: 0.7, step: 0.01, def: 0.5, fmt: pct, post: (o) => { o.y = o.side === 'bottom' ? 1 - o.portion / 2 : o.portion / 2; } });
    else if (k === 'size') list.push({ label: lab, path: k, type: 'range', min: 50, max: 200, step: 2, def: 110 });
    else if (k === 'speed') list.push({ label: lab, path: k, type: 'range', min: 60, max: 600, step: 10, def: 220 });
    else if (['likes', 'from', 'to', 'count', 'replies', 'shares', 'followers', 'following', 'posts', 'subs', 'videos', 'number'].includes(k)) {
      list.push({ label: lab, path: k, type: 'text', post: (o) => { const n = parseFloat(String(o[k]).replace(/\./g, '').replace(',', '.')); if (!Number.isNaN(n)) o[k] = n; } });
    } else list.push({ label: lab, path: k, type: 'text' });
  });
  body.append(fields(L, list));
  IMG.filter((k) => keys.includes(k)).forEach((k) => {
    const m = L[k] ? app.engine.media.get(L[k]) : null;
    body.append(h('div', { class: 'field' }, h('label', {}, LBL[k]), h('span', { style: { fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m ? m.name : (k === 'avatar' ? 'Baş harf' : 'Yok')),
      h('div', { style: { display: 'flex', gap: '6px' } },
        h('button', { class: 'btn', onclick: async () => {
          const files = await app.pickFiles('image/*', false);
          if (!files.length) return;
          const recs = await app.importFiles(files);
          if (recs[0]) { L[k] = recs[0].id; app.change(true); refreshSheet(); }
        } }, 'Seç'),
        L[k] ? h('button', { class: 'btn', onclick: () => { L[k] = null; app.change(true); refreshSheet(); } }, 'Kaldır') : null)));
  });
  if (L.type !== 'halftext' && L.type !== 'ticker') body.append(fields(L, [{ label: 'Boyut', path: 'scale', type: 'range', min: 0.3, max: 2.5, fmt: pct, def: 1 }]));
}

// ---------- Yazı tipi seçici ----------
export function openFontPicker(obj, path, back) {
  openSheet({
    title: 'Yazı tipi', tall: true,
    render: (body) => fontPickerBody(body, getPath(obj, path), (f, meta) => {
      setPath(obj, path, f);
      const ws = meta?.w || [400, 700];
      const cur = getPath(obj, path.replace(/font$/, 'weight'));
      if (cur && !ws.includes(cur)) setPath(obj, path.replace(/font$/, 'weight'), ws.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a), ws[0]));
      app.change(true);
      if (back) back(); else closeSheet();
    }, () => refreshSheet()),
  });
}

function fontButton(obj, path, back) {
  const f = getPath(obj, path) || 'Barlow Condensed';
  return h('div', { class: 'field full' }, h('label', {}, 'Yazı tipi'),
    h('button', { class: 'font-pick', onclick: () => openFontPicker(obj, path, back) },
      h('span', { style: { fontFamily: `"${f}", sans-serif` } }, f), h('small', {}, isBundled(f) ? 'internetsiz' : 'Google Fonts'), h('b', {}, 'Değiştir ›')));
}

function weightOptions(family) {
  const ws = fontWeights(family);
  return WEIGHTS.filter(([w]) => ws.includes(w)).length ? WEIGHTS.filter(([w]) => ws.includes(w)) : WEIGHTS;
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

export async function openSfx() { const m = await import('./library.js'); m.openSfxLibrary(); }

export function openScoreMenu() {
  app.addLayer(clone(SCORE_BASE), 5);
}

export function openSubsMenu() {
  if (app.P.subs?.cues?.length) { app.select({ type: 'subs', id: 'subs' }); return; }
  openSheet({
    title: 'Altyazı ekle',
    render: (body) => {
      body.append(h('button', { class: 'btn block primary', html: `${I.ai} Otomatik altyazı (yapay zekâ)`, onclick: () => { closeSheet(); setTimeout(() => import('./ai.js').then((m) => m.openAutoCaptions()), 230); } }));
      body.append(h('p', { class: 'hint', html: 'Konuşmayı telefonda yazıya döker; kelime kelime zamanlı, Türkçe dahil. Yazı tipi varsayılan olarak <b>Barlow Condensed</b>.' }));
      body.append(h('button', { class: 'btn block', html: `${I.upload} SRT / VTT dosyası yükle`, onclick: () => { closeSheet(); app.importSRT(); } }));
      body.append(h('button', { class: 'btn block', style: { marginTop: '8px' }, html: `${I.brand} Altyazı şablonu seç`, onclick: () => import('./captions.js').then((m) => m.openCaptionStyles()) }));
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
  const offline = typeof window.VideoEncoder === 'function' && typeof window.AudioEncoder === 'function';
  const fmtName = offline ? 'MP4' : mime == null ? 'Desteklenmiyor' : (mime.includes('mp4') ? 'MP4' : 'WebM');
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
    card.append(h('p', { class: 'hint', html: offline
      ? '<b>Kare kare dışa aktarma:</b> her kare tek tek üretilir — kare atlaması, ses kayması yok. Süre telefonun hızına bağlıdır. Bu sırada uygulamadan çıkma.'
      : 'Video gerçek zamanlı oluşturulur (30 sn video ≈ 30 sn). Bu sırada ekranı kapatma ve uygulamadan çıkma.' }));
    if (fmtName === 'WebM') card.append(h('p', { class: 'hint', html: 'Not: Bu cihaz MP4 kaydını desteklemiyor, video <b>WebM</b> olarak çıkacak. YouTube kabul eder.' }));
    card.append(h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: close }, 'Vazgeç'),
      h('button', { class: 'btn primary', html: `${I.export} Oluştur`, onclick: start, disabled: mime == null && !offline })));
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
    const fontsOk = await ensureProjectFonts(app.P);
    if (!fontsOk) toast('Bazı Google fontları indirilemedi; yedek font kullanılacak', 4000);
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
      const stageEl = h('p', { class: 'hint', style: { textAlign: 'center', margin: '0' } }, '');
      card.append(h('h3', {}, attempt > 1 ? `Yeniden oluşturuluyor (${attempt}/3)…` : 'Video oluşturuluyor…'), pctEl, h('div', { class: 'progress' }, bar), stageEl,
        h('p', { class: 'hint', html: attempt > 1 ? `Önceki deneme sınırı aştı (${note}). Bitrate düşürüldü: <b>${(br / 1e6).toFixed(2)} Mbps</b>.` : 'Ekranı açık tut. Önizlemede ilerlemeyi görebilirsin.' }),
        h('button', { class: 'btn block', onclick: () => { cancel = true; } }, 'İptal'));
      out = null;
      try {
        const t0 = performance.now();
        out = await app.engine.export({ res, fps: opt.fps, bitrate: br, abr, onStage: (s) => { stageEl.textContent = s; },
          onProgress: (p) => {
            bar.style.width = `${p * 100}%`; pctEl.textContent = `${Math.round(p * 100)}%`;
            const el = (performance.now() - t0) / 1000;
            if (p > 0.15 && p < 0.99 && el > 3) { const rem = Math.max(0, (el / p) * (1 - p)); stageEl.dataset.eta = rem > 90 ? `~${Math.round(rem / 60)} dk kaldı` : `~${Math.round(rem)} sn kaldı`; stageEl.textContent = `${(stageEl.textContent || '').split(' · ')[0]} · ${stageEl.dataset.eta}`; }
          }, shouldCancel: () => cancel });
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

registerFav('text', (id) => { const tp = TEXT_TEMPLATES.find((t) => t.id === id); if (tp && app.P) app.addLayer({ ...clone(TEXT_BASE), ...clone(tp.p) }); });
registerFav('social', (id) => { const tp = SOCIAL_TEMPLATES.find((t) => t.id === id); if (!tp || !app.P) return; app.addLayer({ ...clone(SOCIAL_BASE), ...clone(tp.p) }, tp.dur || 4); });
registerFav('tool', (id) => { const k = String(id).replace(/^ai:/, ''); const c = [...document.querySelectorAll('.ai-card')].find((x) => x.querySelector('b')?.textContent === k); if (c) c.click(); else window.__toast?.('Bu aracı Yapay zekâ panelinden aç'); });
