// Alpicut — v1.5 açılır menüler (popover)
// • Zaman çizelgesinde/önizlemede bir öğeye dokununca önce küçük bir "ne yapmak istiyorsun?" menüsü çıkar
// • Araç çubuğu kategorileri içeriğini açıklamalı kartlarla gösterir
// Tek seferde bir menü açık olur; dışarı dokunmak, geri tuşu veya bir seçim menüyü kapatır.
import { h } from './state.js';
import { I } from './icons.js';

let cur = null;

export function isPopOpen() { return !!cur; }

export function closePop(instant = false) {
  if (!cur) return;
  const p = cur; cur = null;
  document.removeEventListener('pointerdown', p.outside, true);
  window.removeEventListener('resize', p.onResize);
  if (instant) p.el.remove();
  else { p.el.classList.remove('open'); p.el.classList.add('closing'); setTimeout(() => p.el.remove(), 170); }
  try { p.onClose?.(); } catch (_) { /* yoksay */ }
}

// cfg: { anchor: {x, y, w?, h?} | DOMRect, place: 'above'|'below', title, sub, items: [{icon, label, desc, fn, cls, on}], variant: 'grid'|'cards', cols, wide, onClose, key }
export function openPop(cfg) {
  if (cur && cfg.key && cur.key === cfg.key) { closePop(); return null; }
  closePop(true);
  const variant = cfg.variant || 'grid';
  const el = h('div', { class: `pop pop-${variant}${cfg.wide ? ' wide' : ''}`, role: 'menu' });
  if (cfg.title) {
    el.append(h('div', { class: 'pop-head' },
      cfg.icon ? h('span', { class: 'pop-hic', html: I[cfg.icon] || cfg.icon }) : null,
      h('div', { class: 'pop-ht' }, h('b', {}, cfg.title), cfg.sub ? h('small', {}, cfg.sub) : null),
      h('button', { class: 'pop-x', html: I.close, 'aria-label': 'Kapat', onclick: () => closePop() })));
  }
  const grid = h('div', { class: 'pop-body' });
  grid.style.setProperty('--cols', String(cfg.cols || (variant === 'cards' ? 2 : 4)));
  (cfg.items || []).filter(Boolean).forEach((it) => {
    if (it.sep) { grid.append(h('div', { class: 'pop-sep' }, it.sep)); return; }
    const b = h('button', { class: `pop-it${it.cls ? ` ${it.cls}` : ''}${it.on ? ' on' : ''}`, role: 'menuitem', disabled: it.disabled || null },
      h('span', { class: 'pop-ic', html: I[it.icon] || it.icon || I.edit }),
      h('span', { class: 'pop-tx' }, h('b', {}, it.label), variant === 'cards' && it.desc ? h('small', {}, it.desc) : null));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!it.keep) closePop();
      try { it.fn?.(); } catch (err) { console.error(err); }
    });
    grid.append(b);
  });
  el.append(grid);
  if (cfg.footer) el.append(cfg.footer);
  const arrow = h('i', { class: 'pop-arrow' });
  el.append(arrow);
  document.body.append(el);
  const p = { el, key: cfg.key, onClose: cfg.onClose };
  const place = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const a = cfg.anchor || { x: vw / 2, y: vh / 2 };
    const ax = a.left != null ? a.left + (a.width || 0) / 2 : a.x;
    const ay = a.top != null ? (cfg.place === 'below' ? a.bottom : a.top) : a.y;
    const r = el.getBoundingClientRect();
    const w = r.width, hh = r.height;
    const left = Math.max(8, Math.min(vw - w - 8, ax - w / 2));
    let top = cfg.place === 'below' ? ay + 10 : ay - hh - 10;
    let flipped = false;
    if (top < 8) { top = Math.min(vh - hh - 8, ay + 10); flipped = cfg.place !== 'below'; }
    if (top + hh > vh - 8) { top = Math.max(8, ay - hh - 10); flipped = cfg.place === 'below'; }
    el.style.left = `${left}px`; el.style.top = `${top}px`;
    const down = (cfg.place === 'below') !== flipped; // ok aşağıdan mı yukarı mı
    el.classList.toggle('arrow-up', down);
    arrow.style.left = `${Math.max(16, Math.min(w - 16, ax - left))}px`;
    el.style.transformOrigin = `${ax - left}px ${down ? '0' : '100%'}`;
  };
  place();
  requestAnimationFrame(() => el.classList.add('open'));
  p.outside = (e) => { if (!el.contains(e.target) && !(cfg.ignore && cfg.ignore(e.target))) closePop(); };
  p.onResize = () => closePop(true);
  setTimeout(() => { if (cur === p) document.addEventListener('pointerdown', p.outside, true); }, 0);
  window.addEventListener('resize', p.onResize);
  cur = p;
  return p;
}
