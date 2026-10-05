// Alpicut — zaman çizelgesi
import { app, $, h, fmt, clone } from './state.js';
import { layoutClips } from './engine.js';
import { I } from './icons.js';
import { allKeyTimes } from './kf.js';
import * as WM from './wm.js';

let drag = null;
let touching = false;

const KIND_ICON = { wave: I.beat, group: I.layer, social: I.bubble, text: I.text, media: I.layer, cta: I.cta, score: I.score, shape: I.shape, sticker: I.sticker, fx: I.fx, adjust: I.adjust };
const FX_NAMES = { shake: 'Sarsıntı', zoompulse: 'Zoom nabzı', punch: 'Darbe zoom', wobble: 'Sallanma', beatzoom: 'Ritim zoom', beatflash: 'Ritim flaş', beatshake: 'Ritim sarsıntı', rgb: 'RGB', glitch: 'Glitch', vhs: 'VHS', pixel: 'Piksel', noise: 'Gürültü', flash: 'Flaş', leak: 'Işık sızıntısı', bloom: 'Bloom', fadeblack: 'Karartma', bwpop: 'S/B pop', poster: 'Posterize', invert: 'Negatif', mirror: 'Ayna', film: 'Eski film', cinema: 'Sinema' };

function diamonds(el, o, pps) {
  allKeyTimes(o).forEach((t) => el.append(h('div', { class: 'kf-dia', style: { left: `${t * pps}px` } })));
}

function half() { return $('tlScroll').clientWidth / 2; }

function itemLabel(l) {
  if (l.kind === 'text') return (l.text || '').split('\n')[0].replace(/\*/g, '') || 'Yazı';
  if (l.kind === 'cta') return l.label || 'CTA';
  if (l.kind === 'score') return `${l.teamA} ${l.scoreA}-${l.scoreB} ${l.teamB}`;
  if (l.kind === 'media') return app.engine.media.get(l.mediaId)?.name || 'Katman';
  if (l.kind === 'wave') return 'Ses dalgası';
  if (l.kind === 'group') return `${l.name || 'Grup'}`;
  if (l.kind === 'social') return l.name || l.title || l.text || 'Sosyal';
  if (l.kind === 'fx') return FX_NAMES[l.effect] || 'Efekt';
  if (l.kind === 'adjust') return 'Renk ayarı';
  if (l.kind === 'sticker') return l.sd?.text || l.glyph || (l.badge || '').toUpperCase();
  if (l.kind === 'shape') return { rect: 'Kutu', circle: 'Çember', line: 'Çizgi', arrow: 'Ok', frame: 'Çerçeve' }[l.shape] || 'Şekil';
  return '';
}

export function renderTimeline() {
  const { P, pps, engine } = app;
  if (!P) return;
  const scroll = $('tlScroll'), inner = $('tlInner');
  const H = half();
  const dur = engine.duration();
  // genişlik tam olarak süre kadar: en sağa kaydırınca oynatıcı tam videonun sonunda durur (kayma yok)
  const width = H * 2 + Math.max(dur, 0.01) * pps;
  inner.style.width = `${width}px`;
  inner.textContent = '';
  const sel = app.sel;

  // cetvel
  const ruler = h('div', { class: 'ruler' });
  const step = pps >= 120 ? 0.5 : pps >= 50 ? 1 : pps >= 25 ? 2 : 5;
  const lblEvery = pps >= 120 ? 1 : pps >= 50 ? 2 : pps >= 25 ? 4 : 10;
  for (let t = 0; t <= dur + 1; t += step) {
    const major = Math.abs(t / lblEvery - Math.round(t / lblEvery)) < 1e-6;
    ruler.append(h('div', { class: `tick${major ? ' major' : ''}`, style: { left: `${H + t * pps}px` } }));
    if (major) ruler.append(h('div', { class: 'lbl', style: { left: `${H + t * pps}px` } }, fmt(t, false)));
  }
  (P.markers || []).forEach((m) => {
    ruler.append(h('div', { class: `mk ${m.kind === 'beat' ? 'beat' : 'user'}`, style: { left: `${H + m.t * pps}px` } }));
  });
  inner.append(ruler);

  // ana video izi
  const vrow = h('div', { class: 'row video' });
  const lay = layoutClips(P.clips);
  lay.forEach((L, i) => {
    const c = L.clip;
    const m = engine.media.get(c.mediaId);
    const isSel = sel?.type === 'clip' && sel.id === c.id;
    const it = h('div', {
      class: `item clip${isSel ? ' sel' : ''}${c.freeze ? ' frz' : ''}`,
      'data-type': 'clip', 'data-id': c.id,
      style: { left: `${H + L.start * pps}px`, width: `${Math.max(8, L.len * pps - 2)}px`, backgroundImage: m?.thumb ? `url(${m.thumb})` : '' },
    },
    h('span', { class: 'nm' }, `${c.type === 'image' ? '🖼 ' : ''}${L.len.toFixed(1)}s`),
    h('div', { class: 'h l', 'data-h': 'l' }), h('div', { class: 'h r', 'data-h': 'r' }));
    vrow.append(it);
    if (isSel) { const dw = h('div', { style: { position: 'absolute', left: `${H + L.start * pps}px`, top: 0, bottom: 0, width: '0' } }); diamonds(dw, c, pps); vrow.append(dw); }
    if (i > 0) {
      const on = c.trans && c.trans.type !== 'none';
      vrow.append(h('button', {
        class: `trans-dot${on ? ' on' : ''}`, 'data-trans': c.id,
        style: { left: `${H + (L.start + L.td / 2) * pps}px` }, html: on ? I.split : I.plus, 'aria-label': 'Geçiş',
      }));
    }
  });
  const lastEnd = lay.length ? lay[lay.length - 1].end : 0;
  vrow.append(h('button', { class: 'add-clip', 'data-add': 'clip', style: { left: `${H + lastEnd * pps + 8}px` }, html: I.plus, 'aria-label': 'Medya ekle' }));
  inner.append(vrow);

  // katmanlar (üstteki önce)
  [...P.layers].reverse().forEach((l) => {
    const row = h('div', { class: 'row' });
    const isSel = sel?.type === 'layer' && sel.id === l.id;
    const m = l.kind === 'media' ? engine.media.get(l.mediaId) : null;
    row.append(h('div', {
      class: `item k-${l.kind}${isSel ? ' sel' : ''}${app.multi?.has(l.id) ? ' msel' : ''}${l.hidden ? ' off' : ''}${l.locked ? ' locked' : ''}`, 'data-type': 'layer', 'data-id': l.id,
      style: { left: `${H + l.start * pps}px`, width: `${Math.max(8, (l.end - l.start) * pps - 2)}px`, backgroundImage: m?.thumb ? `url(${m.thumb})` : '' },
    }, h('span', { class: 'nm', html: `${l.locked ? I.lock : l.hidden ? I.eyeOff : KIND_ICON[l.kind] || ''}` }, itemLabel(l)),
    h('div', { class: 'h l', 'data-h': 'l' }), h('div', { class: 'h r', 'data-h': 'r' })));
    if (isSel) { const dw = h('div', { style: { position: 'absolute', left: `${H + l.start * pps}px`, top: 0, bottom: 0, width: '0' } }); diamonds(dw, l, pps); row.append(dw); }
    inner.append(row);
  });

  // altyazı
  if (P.subs?.cues?.length) {
    const row = h('div', { class: 'row' });
    const off = P.subs.offset || 0;
    P.subs.cues.forEach((c, i) => {
      row.append(h('div', {
        class: `item k-sub${sel?.type === 'subs' ? ' selsub' : ''}`, 'data-type': 'subs', 'data-cue': i,
        style: { left: `${H + (c.start + off) * pps}px`, width: `${Math.max(4, (c.end - c.start) * pps - 1)}px` },
      }, h('span', { class: 'nm' }, c.text.replace(/\n/g, ' '))));
    });
    inner.append(row);
  }

  // ses izleri
  P.audio.forEach((a) => {
    const row = h('div', { class: 'row' });
    const isSel = sel?.type === 'audio' && sel.id === a.id;
    row.append(h('div', {
      class: `item ${a.sfx ? 'k-sfx' : a.role === 'voice' ? 'k-voice' : 'k-audio'}${isSel ? ' sel' : ''}${a.mute ? ' off' : ''}${a.locked ? ' locked' : ''}`, 'data-type': 'audio', 'data-id': a.id,
      style: { left: `${H + a.start * pps}px`, width: `${Math.max(8, (a.out - a.in) * pps - 2)}px` },
    }, h('div', { class: 'wave' }), h('span', { class: 'nm', html: a.locked ? I.lock : a.mute ? I.mute : I.audio }, engine.media.get(a.mediaId)?.name || 'Ses'),
    h('div', { class: 'h l', 'data-h': 'l' }), h('div', { class: 'h r', 'data-h': 'r' })));
    inner.append(row);
  });

  // boşluk kalmasın: zaman çizelgesi yüksekliği içeriğe göre (önizleme büyür)
  const tl = $('timeline');
  const last = inner.lastElementChild;
  const content = last ? last.offsetTop + last.offsetHeight : 0;
  const want = Math.round(Math.max(150, Math.min(window.innerHeight * 0.38, content + 30)));
  if (Math.abs(tl.offsetHeight - want) > 3) { tl.style.height = `${want}px`; requestAnimationFrame(() => app.fitStage && app.fitStage()); }
  syncScroll(engine.t, true);
}

export function syncScroll(t, force = false) {
  const sc = $('tlScroll');
  if (drag) return;
  if (!force && touching) return;
  const x = Math.round(t * app.pps);
  if (Math.abs(sc.scrollLeft - x) >= 1) sc.scrollLeft = x;
}

function findItem(type, id) {
  const P = app.P;
  if (type === 'clip') return P.clips.find((c) => c.id === id);
  if (type === 'layer') return P.layers.find((c) => c.id === id);
  if (type === 'audio') return P.audio.find((c) => c.id === id);
  return null;
}

function snapT(t) {
  const pt = app.engine.t;
  if (Math.abs(t - pt) * app.pps < 10) return pt;
  for (const m of app.P.markers || []) if (Math.abs(t - m.t) * app.pps < 8) return m.t;
  return t;
}

// zaman çizelgesine dokununca onu örten paneller üstteki pencere çubuğuna küçülür
function hidePanelsOverTimeline() {
  const r = $('timeline').getBoundingClientRect();
  WM.list().forEach((p) => { if (p.min) return; const b = p.el.getBoundingClientRect(); if (b.bottom > r.top + 10 && b.top < r.bottom - 10) WM.minimize(p); });
}

export function bindTimeline() {
  const sc = $('tlScroll'), inner = $('tlInner');

  sc.addEventListener('scroll', () => {
    if (drag) return;
    const t = Math.max(0, Math.min(app.engine.duration(), sc.scrollLeft / app.pps));
    const E = app.engine;
    if (E.playing) {
      if (!touching) return;
      app.pause();
    }
    if (Math.abs(t - E.t) * app.pps < 0.5) return;
    E.seek(t);
    app.updateTime();
  }, { passive: true });

  sc.addEventListener('touchstart', (e) => {
    touching = true;
    hidePanelsOverTimeline();
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), pps: app.pps };
    }
  }, { passive: true });
  let pinch = null;
  sc.addEventListener('touchmove', (e) => {
    if (drag && drag.active) { if (e.cancelable) e.preventDefault(); return; }
    if (e.touches.length === 2 && pinch) {
      e.preventDefault();
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setZoom(pinch.pps * (d / pinch.d));
    }
  }, { passive: false });
  const end = (e) => { if (!e.touches || e.touches.length === 0) { touching = false; pinch = null; } };
  sc.addEventListener('touchend', end, { passive: true });
  sc.addEventListener('touchcancel', end, { passive: true });
  sc.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { touching = true; hidePanelsOverTimeline(); } });
  window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') touching = false; });

  inner.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { app.addMedia('clip'); return; }
    const td = e.target.closest('[data-trans]');
    if (td) { app.select({ type: 'clip', id: td.dataset.trans }, 'Geçiş'); return; }
    const it = e.target.closest('.item');
    if (!it) { if (e.target === inner || e.target.classList.contains('row')) app.deselect(); return; }
    if (it._dragged) { it._dragged = false; return; }
    const rect = it.getBoundingClientRect();
    // menü, dokunulan noktanın üstünde açılsın (öğenin ortasında değil)
    const anchor = { x: Math.max(rect.left + 8, Math.min(rect.right - 8, e.clientX || rect.left + rect.width / 2)), y: Math.max($('timeline').getBoundingClientRect().top, rect.top) };
    if (it.dataset.type === 'subs') {
      const cue = app.P.subs.cues[+it.dataset.cue];
      app.select({ type: 'subs', id: 'subs' }, false);
      if (cue) { app.engine.seek(cue.start + (app.P.subs.offset || 0) + 0.01); app.updateTime(); syncScroll(app.engine.t, true); }
      app.itemMenu(anchor);
      return;
    }
    const s = { type: it.dataset.type, id: it.dataset.id };
    if (app.multi) { if (s.type === 'layer') app.toggleMulti(s.id); else window.__toast?.('Çoklu seçim yalnızca katmanlar içindir'); return; }
    // v1.5: dokununca denetçi açılmaz; önce hızlı işlem menüsü çıkar
    if (!(app.sel?.type === s.type && app.sel?.id === s.id)) app.select(s, false);
    app.itemMenu(anchor);
  });

  inner.addEventListener('pointerdown', (e) => {
    const it = e.target.closest('.item.sel');
    if (!it) return;
    const type = it.dataset.type, id = it.dataset.id;
    const obj = findItem(type, id);
    if (!obj) return;
    if (obj.locked) { return; }
    const hd = e.target.closest('[data-h]');
    const mode = hd ? hd.dataset.h : 'move';
    if (type === 'clip' && mode === 'move') return;
    if (app.engine.playing) app.pause();
    // v1.5 güvenli sürükleme: kenar tutamaçları hemen çalışır; gövdeyi taşımak için ~0.3 sn basılı tut.
    // Böylece zaman çizelgesini kaydırırken öğeler yanlışlıkla kaymaz.
    const d = { it, type, obj, mode, x0: e.clientX, y0: e.clientY, o: clone(obj), moved: false, left0: parseFloat(it.style.left), w0: parseFloat(it.style.width), id: e.pointerId, active: mode !== 'move' };
    if (d.active) { e.preventDefault(); try { it.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ } }
    else {
      d.hold = setTimeout(() => {
        if (drag !== d) return;
        d.active = true;
        it.classList.add('lift');
        try { navigator.vibrate?.(12); } catch (_) { /* yoksay */ }
        try { it.setPointerCapture(d.id); } catch (_) { /* yoksay */ }
      }, 300);
    }
    drag = d;
  });

  inner.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { obj, o, type, mode, it } = drag;
    const dx = e.clientX - drag.x0;
    if (!drag.active) {
      // basılı tutma dolmadan parmak kaydıysa: bu bir kaydırma, sürükleme değil
      if (Math.hypot(dx, e.clientY - drag.y0) > 7) { clearTimeout(drag.hold); drag = null; }
      return;
    }
    if (!drag.moved && Math.abs(dx) < 6) return;
    drag.moved = true;
    const dt = dx / app.pps;
    const pps = app.pps;
    const mdur = (mid) => app.engine.media.get(mid)?.duration || 9999;
    if (type === 'clip') {
      const sp = o.speed || 1;
      if (o.type === 'image') {
        obj.dur = Math.max(0.3, mode === 'l' ? o.dur - dt : o.dur + dt);
      } else if (mode === 'l') {
        obj.in = Math.min(Math.max(0, o.in + dt * sp), o.out - 0.2);
        shiftKeys(obj, o, (obj.in - o.in) / sp);
      } else {
        obj.out = Math.max(Math.min(mdur(o.mediaId), o.out + dt * sp), o.in + 0.2);
      }
      const len = o.type === 'image' ? obj.dur : (obj.out - obj.in) / sp;
      it.style.width = `${Math.max(8, len * pps - 2)}px`;
      if (mode === 'l') it.style.left = `${drag.left0 + drag.w0 - Math.max(8, len * pps - 2)}px`;
    } else if (type === 'layer') {
      const len = o.end - o.start;
      if (mode === 'move') { obj.start = Math.max(0, snapT(o.start + dt)); obj.end = obj.start + len; }
      else if (mode === 'l') { obj.start = Math.min(Math.max(0, snapT(o.start + dt)), o.end - 0.2); shiftKeys(obj, o, obj.start - o.start); }
      else obj.end = Math.max(o.start + 0.2, snapT(o.end + dt));
      it.style.left = `${half() + obj.start * pps}px`;
      it.style.width = `${Math.max(8, (obj.end - obj.start) * pps - 2)}px`;
    } else if (type === 'audio') {
      const len = o.out - o.in;
      if (mode === 'move') obj.start = Math.max(0, snapT(o.start + dt));
      else if (mode === 'l') {
        let d = Math.min(Math.max(dt, -o.in), len - 0.2);
        if (o.start + d < 0) d = -o.start;
        obj.start = o.start + d; obj.in = o.in + d;
      } else obj.out = Math.max(o.in + 0.2, Math.min(mdur(o.mediaId), o.out + dt));
      it.style.left = `${half() + obj.start * pps}px`;
      it.style.width = `${Math.max(8, (obj.out - obj.in) * pps - 2)}px`;
    }
    app.engine.sync(app.engine.t);
    app.engine.requestDraw();
  });

  const up = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    clearTimeout(d.hold);
    d.it.classList.remove('lift');
    if (d.active && !d.moved && d.mode === 'move') { d.it._dragged = true; setTimeout(() => { d.it._dragged = false; }, 50); return; }
    if (d.moved) {
      d.it._dragged = true;
      setTimeout(() => { d.it._dragged = false; }, 50);
      app.commit();
      app.undoToast?.(d.mode === 'move' ? 'Taşındı' : 'Kırpıldı');
    }
  };
  inner.addEventListener('pointerup', up);
  inner.addEventListener('pointercancel', up);
}

// Kural: keyframe zamanları öğenin başına göredir. Sol uçtan kırpınca keyframe'ler içerikle birlikte kayar;
// sağ uçtan kırpmak keyframe'lere dokunmaz.
function shiftKeys(obj, o, d) {
  if (!o.kf) return;
  const k = clone(o.kf);
  Object.values(k).forEach((arr) => arr.forEach((x) => { x.t -= d; }));
  obj.kf = k;
}

export function setZoom(pps) {
  app.pps = Math.max(8, Math.min(400, pps));
  renderTimeline();
}
