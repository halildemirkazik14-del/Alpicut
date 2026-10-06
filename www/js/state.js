// Ortak durum ve yardımcılar
export const app = {
  P: null, // aktif proje
  engine: null,
  sel: null, // {type:'clip'|'layer'|'audio'|'subs', id}
  pps: 70, // timeline: saniye başına piksel
  undo: [],
  redo: [],
  snap: '',
  saveTimer: null,
  newRatio: '9:16',
};

export const $ = (id) => document.getElementById(id);
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const clone = (o) => JSON.parse(JSON.stringify(o));

export function fmt(t, dec = true) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${dec ? s.toFixed(1).padStart(4, '0') : String(Math.floor(s)).padStart(2, '0')}`;
}

let toastTimer = null;
// action: { label, fn } — örn. "Geri al" düğmesi
export function toast(msg, ms = 2400, action = null) {
  const el = $('toast');
  el.textContent = '';
  el.append(document.createTextNode(msg));
  el.classList.toggle('act', !!action);
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-act';
    b.textContent = action.label;
    b.addEventListener('click', (e) => { e.stopPropagation(); el.classList.remove('show'); clearTimeout(toastTimer); action.fn(); });
    el.append(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function busy(text) {
  const d = document.createElement('div');
  d.className = 'busy';
  d.innerHTML = `<div><div class="spinner"></div><div>${text}</div></div>`;
  document.body.appendChild(d);
  return { set: (t) => { d.querySelector('div > div:last-child').textContent = t; }, close: () => d.remove() };
}

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}

export function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
export function setPath(o, p, v) {
  const ks = p.split('.');
  let a = o;
  for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = {}; a = a[ks[i]]; }
  a[ks[ks.length - 1]] = v;
}

// Seçili öğeyi bul
export function selected() {
  const { P, sel } = app;
  if (!P || !sel) return null;
  if (sel.type === 'clip') return P.clips.find((c) => c.id === sel.id) || null;
  if (sel.type === 'layer') return P.layers.find((c) => c.id === sel.id) || null;
  if (sel.type === 'audio') return P.audio.find((c) => c.id === sel.id) || null;
  if (sel.type === 'subs') return P.subs;
  return null;
}
