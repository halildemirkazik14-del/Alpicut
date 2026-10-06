// Alpicut v1.7 — tam ekran oynatma
// Önizleme tüm ekranı kaplar; dokununca kontroller belirir/kaybolur; yatay videolar için döndürme.
import { app, $, h, fmt } from './state.js';
import { I } from './icons.js';

let ui = null, hideT = null, raf = null;

export const isFull = () => !!ui;

export function enterFull() {
  if (ui || !app.P) return;
  const wrap = $('previewWrap');
  const [W, H] = app.ratioWH();
  app.fsRot = false;
  const bar = h('input', { type: 'range', class: 'fs-bar', min: 0, max: 1000, value: 0 });
  const time = h('span', { class: 'fs-time' }, '');
  const play = h('button', { class: 'fs-play', 'aria-label': 'Oynat / duraklat' });
  const rot = h('button', { class: 'fs-btn', 'aria-label': 'Döndür', html: I.rotate || '⟳' });
  const close = h('button', { class: 'fs-btn', 'aria-label': 'Tam ekrandan çık', html: I.close });
  ui = h('div', { class: 'fs-ui show' },
    h('div', { class: 'fs-top' }, close, h('b', {}, app.P.name || ''), W > H ? rot : h('span')),
    h('div', { class: 'fs-bottom' }, play, time, bar));
  wrap.append(ui);
  document.body.classList.add('fs-on');
  $('editor').classList.add('fs');
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch?.(() => {}); } catch (_) { /* yoksay */ }
  try { history.pushState({ v: 'fs' }, ''); } catch (_) { /* yoksay */ }
  close.addEventListener('click', (e) => { e.stopPropagation(); exitFull(); });
  rot.addEventListener('click', (e) => {
    e.stopPropagation();
    app.fsRot = !app.fsRot;
    wrap.classList.toggle('fs-rot', app.fsRot);
    try { if (app.fsRot) screen.orientation?.lock?.('landscape').catch?.(() => {}); else screen.orientation?.unlock?.(); } catch (_) { /* yoksay */ }
    app.fitStage();
  });
  play.addEventListener('click', (e) => { e.stopPropagation(); if (app.engine.playing) app.pause(); else app.play(); poke(); });
  let dragging = false;
  bar.addEventListener('input', () => { dragging = true; app.pause(); app.engine.seek((bar.value / 1000) * app.engine.duration()); app.updateTime(); poke(); });
  bar.addEventListener('change', () => { dragging = false; });
  ui.addEventListener('click', (e) => { if (e.target === ui) { ui.classList.toggle('show'); if (ui.classList.contains('show')) poke(); } });
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!ui) return;
    const E = app.engine, d = E.duration();
    if (!dragging) bar.value = String(Math.round((E.t / Math.max(0.01, d)) * 1000));
    time.textContent = `${fmt(E.t)} / ${fmt(d)}`;
    const pi = E.playing ? 'pause' : 'play';
    if (play.dataset.i !== pi) { play.innerHTML = I[pi]; play.dataset.i = pi; }
  };
  tick();
  setTimeout(() => { app.fitStage(); if (!app.engine.playing) app.play(); }, 60);
  poke();
}

// kontroller oynatırken 2,5 sn sonra gizlenir
function poke() {
  if (!ui) return;
  ui.classList.add('show');
  clearTimeout(hideT);
  hideT = setTimeout(() => { if (ui && app.engine.playing) ui.classList.remove('show'); }, 2500);
}

export function exitFull(fromPop = false) {
  if (!ui) return;
  cancelAnimationFrame(raf); clearTimeout(hideT);
  ui.remove(); ui = null;
  app.fsRot = false;
  $('previewWrap').classList.remove('fs-rot');
  document.body.classList.remove('fs-on');
  $('editor').classList.remove('fs');
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) { /* yoksay */ }
  try { screen.orientation?.unlock?.(); } catch (_) { /* yoksay */ }
  if (!fromPop && history.state?.v === 'fs') { window.__skipPop = (window.__skipPop || 0) + 1; try { history.back(); } catch (_) { /* yoksay */ } }
  setTimeout(() => app.fitStage(), 60);
}
