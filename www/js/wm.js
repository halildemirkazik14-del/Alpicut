// Alpicut — pencere yöneticisi: aynı anda en çok 3 yüzen panel, X ile kapatma, taşıma, boyutlandırma,
// küçültme (üstte pencere çubuğuna), zaman çizelgesine dokununca otomatik gizlenme.
import { $, h } from './state.js';
import { I } from './icons.js';
import { lsGet, lsSet } from './storage.js';

const MAX = 5;
const panels = []; // açılış sırasına göre
let current = null; // olay/çizim sırasında etkin panel
let zTop = 30;
let dock = null, layer = null;

const vw = () => window.innerWidth;
const vh = () => window.innerHeight;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function rects() {
  const r = (id) => { const el = $(id); return el && el.offsetParent !== null ? el.getBoundingClientRect() : null; };
  const top = r('topbarMain') || { bottom: 52 };
  const tr = r('transportBar');
  const tl = r('timeline');
  return { top: top.bottom, trTop: tr ? tr.top : vh() * 0.5, tlTop: tl ? tl.top : vh() * 0.55 };
}

function slotGeom(slot) {
  const R = rects();
  const W = vw(), H = vh();
  if (slot === 'top') return { x: 0, y: R.top, w: W, h: Math.max(180, R.trTop - R.top) };
  if (slot === 'float') return { x: Math.round(W * 0.05), y: Math.round(H * 0.2), w: Math.round(W * 0.9), h: Math.round(H * 0.5) };
  // alt: zaman çizelgesi + araç çubuğu alanı (önizleme ve oynat düğmesi görünür kalır)
  const y = Math.min(R.tlTop, H - 240);
  return { x: 0, y, w: W, h: H - y };
}

function saveGeom(p) {
  if (!p.key) return;
  try {
    const all = JSON.parse(lsGet('alpicut.wm', '{}'));
    all[p.key] = { x: p.g.x / vw(), y: p.g.y / vh(), w: p.g.w / vw(), h: p.g.h / vh(), slot: p.slot };
    lsSet('alpicut.wm', JSON.stringify(all));
  } catch (_) { /* yoksay */ }
}
function loadGeom(key) {
  try { const g = JSON.parse(lsGet('alpicut.wm', '{}'))[key]; if (g) return { x: g.x * vw(), y: g.y * vh(), w: g.w * vw(), h: g.h * vh(), slot: g.slot }; } catch (_) { /* yoksay */ }
  return null;
}

function fit(g) {
  const W = vw(), H = vh();
  const w = clamp(g.w, 200, W), hh = clamp(g.h, 120, H - 40);
  return { w, h: hh, x: clamp(g.x, 0, W - Math.min(w, W)), y: clamp(g.y, 24, H - 60) };
}

function apply(p) {
  p.g = fit(p.g);
  const s = p.el.style;
  s.left = `${p.g.x}px`; s.top = `${p.g.y}px`; s.width = `${p.g.w}px`; s.height = `${Math.min(p.g.h, vh() - p.g.y)}px`;
  p.el.classList.toggle('docked-b', Math.abs(p.g.y + p.g.h - vh()) < 2 && p.g.w >= vw() - 2);
  p.el.classList.toggle('full-w', p.g.w >= vw() - 2);
}

function ensureRoot() {
  if (layer) return;
  layer = h('div', { id: 'panelLayer', class: 'panel-layer' });
  dock = h('div', { id: 'panelDock', class: 'panel-dock hidden' });
  document.body.append(layer);
  const pw = $('previewWrap');
  (pw || document.body).append(dock);
  // panel dışındaki dokunuşlar "etkin panel"i sıfırlar (closeSheet yanlış paneli kapatmasın)
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest || !e.target.closest('.panel')) current = null; }, true);
  window.addEventListener('resize', () => panels.forEach((p) => { if (p.rel) p.g = { x: p.rel.x * vw(), y: p.rel.y * vh(), w: p.rel.w * vw(), h: p.rel.h * vh() }; apply(p); }));
}

function focus(p) {
  current = p;
  p.focusAt = performance.now();
  p.el.style.zIndex = String(++zTop);
  panels.forEach((q) => q.el.classList.toggle('focused', q === p));
}

function renderDock() {
  if (!dock) return;
  const mins = panels.filter((p) => p.min);
  dock.textContent = '';
  dock.classList.toggle('hidden', !mins.length);
  if (!mins.length) return;
  if (mins.length > 1) dock.append(h('button', { class: 'dock-chip all', onclick: (e) => { e.stopPropagation(); mins.forEach((p) => restore(p)); } }, h('span', { html: I.layer }), 'Tümü'));
  mins.forEach((p) => {
    const x = h('button', { class: 'dock-x', html: I.close, 'aria-label': 'Kapat' });
    x.addEventListener('click', (e) => { e.stopPropagation(); close(p); });
    const chip = h('div', { class: `dock-chip${p.justMin ? ' arrive' : ''}`, role: 'button', 'data-key': p.key }, h('i', { class: 'dock-dot' }), h('span', { class: 'dock-t' }, p.cfg.title || 'Panel'), x);
    p.justMin = false;
    chip.addEventListener('click', (e) => { e.stopPropagation(); restore(p); });
    chip.addEventListener('pointerdown', (e) => e.stopPropagation());
    dock.append(chip);
  });
}

// v1.5: küçültme / geri açma hareketi (panel, üstteki çubuktaki yerine uçar)
function chipRect(p) {
  const c = dock && [...dock.querySelectorAll('.dock-chip')].find((x) => x.dataset.key === p.key);
  return c ? c.getBoundingClientRect() : null;
}
function flyTo(p, from, to, reverse, done) {
  const el = p.el;
  if (!from || !to || matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return; }
  const sx = Math.max(0.05, to.width / from.width), sy = Math.max(0.03, to.height / from.height);
  const tx = to.left - from.left, ty = to.top - from.top;
  const shrunk = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
  el.classList.add('flying');
  el.style.transformOrigin = '0 0';
  el.style.transition = 'none';
  el.style.transform = reverse ? shrunk : 'none';
  el.style.opacity = reverse ? '0.2' : '1';
  void el.offsetWidth;
  el.style.transition = 'transform .34s cubic-bezier(.2,.8,.2,1), opacity .34s ease, border-radius .34s ease';
  el.style.transform = reverse ? 'none' : shrunk;
  el.style.opacity = reverse ? '1' : '0.15';
  let fin = false;
  const end = () => { if (fin) return; fin = true; el.classList.remove('flying'); el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = ''; done(); };
  el.addEventListener('transitionend', end, { once: true });
  setTimeout(end, 420);
}

function renderHead(p) {
  p.titleEl.textContent = p.cfg.title || '';
  p.acts.textContent = '';
  if (p.cfg.onCancel) {
    p.acts.append(h('button', { class: 'p-btn warn', html: I.undo, 'aria-label': 'Değişiklikleri geri al', title: 'Değişiklikleri geri al', onclick: () => { const f = p.cfg.onCancel; p.cfg.onClose = null; f(); close(p); } }));
  }
  (p.cfg.actions || []).forEach((a) => p.acts.append(h('button', { class: `p-btn${a.danger ? ' danger' : ''}${a.on ? ' on' : ''}`, html: a.icon, 'aria-label': a.label, title: a.label, onclick: () => { current = p; a.onClick(); } })));
}

function renderTabs(p) {
  p.tabs.textContent = '';
  const tabs = p.cfg.tabs || [];
  p.tabs.classList.toggle('hidden', !tabs.length);
  tabs.forEach((t) => p.tabs.append(h('button', { class: t === p.tab ? 'on' : '', onclick: () => { p.tab = t; current = p; renderTabs(p); renderBody(p); } }, t)));
  const on = p.tabs.querySelector('.on');
  if (on) requestAnimationFrame(() => { try { on.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (_) { /* yoksay */ } });
}

function renderBody(p) {
  const prev = current;
  current = p;
  const st = p.body.scrollTop;
  p.body.textContent = '';
  try { p.cfg.render(p.body, p.tab, p); } catch (e) { console.error(e); p.body.append(h('p', { class: 'hint' }, `Hata: ${e.message || e}`)); }
  p.body.scrollTop = st;
  current = prev && panels.includes(prev) ? prev : p;
}

function bindGestures(p) {
  const head = p.head;
  let d = null, lastTap = 0;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    focus(p);
    d = { x0: e.clientX, y0: e.clientY, g0: { ...p.g }, t0: performance.now(), moved: false, anchored: Math.abs(p.g.y + p.g.h - vh()) < 4 };
    try { head.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ }
  });
  head.addEventListener('pointermove', (e) => {
    if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    p.el.classList.add('dragging');
    if (d.anchored && d.g0.w >= vw() - 2 && !d.float) {
      // v1.7: alta yapışık panel sürüklenince serbest pencereye dönüşür — ekranın istediğin yerine taşı, bırak
      const fh = Math.min(d.g0.h, Math.round(vh() * 0.55));
      d.float = true;
      d.g0 = { x: 8, y: clamp(e.clientY - 24, 40, vh() - 140), w: vw() - 16, h: fh };
      d.x0 = e.clientX; d.y0 = e.clientY;
      p.el.classList.add('floating');
    }
    // ekran dışına taşmasın
    const nx = clamp(d.g0.x + (e.clientX - d.x0), -p.g.w + 90, vw() - 90);
    const ny = clamp(d.g0.y + (e.clientY - d.y0), 30, vh() - 60);
    p.g = { ...d.g0, x: nx, y: ny };
    apply(p);
    // alt kenara yaklaşınca yerleşme ipucu
    p.el.classList.toggle('dock-hint', ny + p.g.h > vh() - 24);
  });
  const up = (e) => {
    if (!d) return;
    const D = d; d = null;
    p.el.classList.remove('dragging');
    if (!D.moved) {
      const now = performance.now();
      if (now - lastTap < 320) { lastTap = 0; toggleMax(p); } else lastTap = now;
      return;
    }
    const dy = e.clientY - D.y0, dt = performance.now() - D.t0;
    p.el.classList.remove('dock-hint');
    if (dy > 90 && dt < 260 && !D.float) { p.g = D.g0; apply(p); minimize(p); return; }
    // alt kenara bırakılırsa yeniden alta yapışır
    if (p.g.y + p.g.h > vh() - 24) { const hh = Math.min(p.g.h, Math.round(vh() * 0.6)); p.g = { x: 0, y: vh() - hh, w: vw(), h: hh }; p.el.classList.remove('floating'); apply(p); }
    p.rel = { x: p.g.x / vw(), y: p.g.y / vh(), w: p.g.w / vw(), h: p.g.h / vh() };
    p.slot = 'custom';
    saveGeom(p);
  };
  head.addEventListener('pointerup', up);
  head.addEventListener('pointercancel', up);

  // köşeden boyutlandırma
  let r = null;
  p.grip.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); focus(p);
    r = { x0: e.clientX, y0: e.clientY, g0: { ...p.g } };
    try { p.grip.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ }
  });
  p.grip.addEventListener('pointermove', (e) => {
    if (!r) return;
    const w = clamp(r.g0.w + (e.clientX - r.x0), 220, vw() - r.g0.x);
    const hh = clamp(r.g0.h + (e.clientY - r.y0), 140, vh() - r.g0.y);
    p.g = { ...r.g0, w, h: hh };
    apply(p);
  });
  const rup = () => { if (!r) return; r = null; p.rel = { x: p.g.x / vw(), y: p.g.y / vh(), w: p.g.w / vw(), h: p.g.h / vh() }; p.slot = 'custom'; saveGeom(p); };
  p.grip.addEventListener('pointerup', rup);
  p.grip.addEventListener('pointercancel', rup);

  // panelin içindeki her dokunuş onu etkin yapar
  p.el.addEventListener('pointerdown', () => { if (current !== p || p.el.style.zIndex !== String(zTop)) focus(p); }, true);
}

function toggleMax(p) {
  const R = rects();
  if (p.maxPrev) { p.g = p.maxPrev; p.maxPrev = null; }
  else { p.maxPrev = { ...p.g }; p.g = { x: 0, y: R.top, w: vw(), h: vh() - R.top }; }
  p.rel = { x: p.g.x / vw(), y: p.g.y / vh(), w: p.g.w / vw(), h: p.g.h / vh() };
  apply(p);
}

function create(cfg) {
  ensureRoot();
  const p = { cfg, tab: cfg.tab || (cfg.tabs && cfg.tabs[0]) || null, key: cfg.id || cfg.title, min: false };
  p.titleEl = h('h3', { class: 'p-title' });
  p.acts = h('div', { class: 'p-acts' });
  const minB = h('button', { class: 'p-btn', html: I.minimize || '–', 'aria-label': 'Küçült', title: 'Küçült (üst çubuğa)', onclick: () => minimize(p) });
  const closeB = h('button', { class: 'p-btn close', html: I.close, 'aria-label': 'Kapat', title: 'Kapat', onclick: () => close(p) });
  p.head = h('div', { class: 'p-head' }, h('span', { class: 'p-grab' }), p.titleEl, p.acts, minB, closeB);
  p.tabs = h('div', { class: 'p-tabs' });
  p.body = h('div', { class: 'p-body' });
  p.grip = h('div', { class: 'p-grip', 'aria-label': 'Boyutlandır' });
  p.el = h('section', { class: 'panel', role: 'dialog' }, p.head, p.tabs, p.body, p.grip);
  layer.append(p.el);
  bindGestures(p);
  // konum
  const saved = cfg.geom ? null : loadGeom(p.key);
  const used = new Set(panels.filter((q) => !q.min).map((q) => q.slot));
  if (saved && saved.slot === 'custom') { p.g = saved; p.slot = 'custom'; p.rel = { x: saved.x / vw(), y: saved.y / vh(), w: saved.w / vw(), h: saved.h / vh() }; }
  else {
    // v1.5: paneller önizlemenin (videonun) ÜSTÜNE açılmaz. Alt yuva doluysa eski panel üst çubuğa küçülür.
    p.slot = cfg.slot && cfg.slot !== 'top' ? cfg.slot : 'bottom';
    if (p.slot === 'bottom') panels.forEach((q) => { if (!q.min && q.slot === 'bottom') minimize(q); });
    void used;
    p.g = slotGeom(p.slot);
    if (saved && saved.slot === p.slot && p.slot === 'bottom') { p.g.h = clamp(saved.h, 160, vh() - 80); p.g.y = vh() - p.g.h; }
    p.rel = { x: p.g.x / vw(), y: p.g.y / vh(), w: p.g.w / vw(), h: p.g.h / vh() };
  }
  apply(p);
  requestAnimationFrame(() => p.el.classList.add('open'));
  panels.push(p);
  return p;
}

export function open(cfg) {
  const key = cfg.id || cfg.title;
  let p = panels.find((q) => q.key === key);
  if (p) {
    if (p.cfg.onClose && p.cfg !== cfg) { const f = p.cfg.onClose; p.cfg.onClose = null; f(); }
    p.cfg = cfg;
    p.tab = cfg.tab || (cfg.tabs && cfg.tabs.includes(p.tab) ? p.tab : (cfg.tabs && cfg.tabs[0])) || null;
    if (p.min) { p.min = false; p.el.classList.remove('min'); renderDock(); }
  } else {
    const vis = panels.filter((q) => !q.min);
    if (panels.length >= MAX) {
      // en eski (en uzun süredir dokunulmayan) paneli kapat
      const old = [...panels].sort((a, b) => (a.focusAt || 0) - (b.focusAt || 0))[0];
      close(old, true);
    }
    void vis;
    p = create(cfg);
    if (!panels.some((q) => q !== p)) { try { history.pushState({ v: 'sheet' }, ''); } catch (_) { /* yoksay */ } }
  }
  focus(p);
  renderHead(p); renderTabs(p); renderBody(p);
  return p;
}

export function close(p = current, fromPop = false) {
  if (!p || !panels.includes(p)) { if (!fromPop) return; p = top(); }
  if (!p) return;
  const onClose = p.cfg.onClose;
  p.cfg.onClose = null;
  panels.splice(panels.indexOf(p), 1);
  p.el.classList.remove('open');
  p.el.classList.add('closing');
  setTimeout(() => p.el.remove(), 180);
  if (current === p) current = top();
  renderDock();
  if (onClose) { try { onClose(); } catch (e) { console.error(e); } }
  // altta kalan panel güncel veriyi göstersin
  const t = top();
  if (t && !t.min) { focus(t); refresh(t); }
  if (!panels.length && !fromPop && history.state?.v === 'sheet') { window.__skipPop = (window.__skipPop || 0) + 1; try { history.back(); } catch (_) { window.__skipPop--; } }
}

export function closeAll() { [...panels].forEach((p) => close(p, true)); current = null; if (history.state?.v === 'sheet') { window.__skipPop = (window.__skipPop || 0) + 1; try { history.back(); } catch (_) { window.__skipPop--; } } }

export function refresh(p = current) {
  if (!p || !panels.includes(p)) { refreshLive(); return; }
  if (p.cfg.refresh) { const r = p.cfg.refresh(p); if (r === false) { close(p); return; } }
  renderHead(p); renderTabs(p); renderBody(p);
}

// canlı paneller (denetçi vb.) — geri al/yinele ve seçim değişince
export function refreshLive() { panels.forEach((p) => { if (p.cfg.live) refresh(p); }); }

export function minimize(p = current, animate = true) {
  if (!p || p.min) return;
  const from = p.el.getBoundingClientRect();
  p.min = true;
  p.justMin = true;
  if (current === p) current = top();
  renderDock();
  const to = animate ? chipRect(p) : null;
  if (!to) { p.el.classList.add('min'); return; }
  p.el.classList.add('minimizing');
  flyTo(p, from, to, false, () => { p.el.classList.remove('minimizing'); if (p.min) p.el.classList.add('min'); });
}

export function restore(p) {
  const from = chipRect(p);
  // aynı yuvadaki görünür paneli yer açmak için küçült
  panels.forEach((q) => { if (q !== p && !q.min && q.slot === p.slot && p.slot === 'bottom') minimize(q); });
  p.min = false;
  p.el.classList.remove('min');
  apply(p);
  focus(p);
  renderDock();
  refresh(p);
  if (from) flyTo(p, p.el.getBoundingClientRect(), from, true, () => {});
}

export function minimizeAll() { panels.forEach((p) => { if (!p.min) minimize(p); }); renderDock(); }
export function anyVisible() { return panels.some((p) => !p.min); }
export function isOpen() { return panels.length > 0; }
export function top() {
  const vis = panels.filter((p) => !p.min);
  const list = (vis.length ? vis : panels).slice();
  return list.sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0))[list.length - 1] || null;
}
export function cur() { return current; }
export function find(key) { return panels.find((p) => p.key === key) || null; }
export function list() { return panels.slice(); }
export function setTitle(p, t) { if (p) { p.cfg.title = t; p.titleEl.textContent = t; renderDock(); } }
