// Alpicut — v1.5 keyframe şeridi (videonun hemen altında)
// ◀ ◆ ▶ ile keyframe koy/kaldır ve aralarında gez; şeritte öğenin keyframe'leri ve oynatıcı görünür.
// "OTO" açıkken önizlemede sürükleme / iki parmakla yakınlaştırma her zaman keyframe yazar.
import { app, $, h, selected, toast } from './state.js';
import { I } from './icons.js';
import { allKeyTimes, keyAt, setKey, delKey, propAt, hasKeys } from './kf.js';
import { layoutClips } from './engine.js';
import { lsGet, lsSet } from './storage.js';

app.autoKey = lsGet('alpicut.autoKey', '0') === '1';

const EPS = 1 / 60;

function span(o) {
  const s = app.sel;
  if (!s || !o) return null;
  if (s.type === 'clip') { const L = layoutClips(app.P.clips).find((x) => x.clip === o); return L ? { start: L.start, len: L.len } : null; }
  if (s.type === 'layer') return { start: o.start, len: o.end - o.start };
  if (s.type === 'audio') return { start: o.start, len: o.out - o.in };
  return null;
}

function group(o) {
  const s = app.sel;
  if (!s || !o) return [];
  if (s.type === 'clip') return ['zoom', 'panX', 'panY'];
  if (s.type === 'audio') return ['vol'];
  if (s.type === 'layer') return (o.kind === 'fx' || o.kind === 'adjust') ? [] : ['x', 'y', 's', 'rot', 'opacity'];
  return [];
}

const valueOf = (o, p, lt) => (p === 'vol' && !hasKeys(o, 'vol') ? 1 : propAt(o, p, lt));

let els = null;

function seekLocal(sp, lt) {
  const t = Math.max(0, Math.min(app.engine.duration(), sp.start + Math.max(0, Math.min(sp.len - 0.001, lt))));
  app.pause();
  app.engine.seek(t);
  app.updateTime();
  app.syncScroll();
}

export function renderKfBar() {
  const bar = $('kfBar');
  if (!bar) return;
  bar.textContent = '';
  els = null;
  const o = selected();
  const sp = span(o);
  const G = group(o);
  const auto = h('button', { class: `kfb-auto${app.autoKey ? ' on' : ''}`, title: 'Oto keyframe: önizlemede yaptığın her hareket keyframe olur', 'aria-pressed': app.autoKey ? 'true' : 'false' }, h('i'), 'OTO');
  auto.addEventListener('click', () => {
    app.autoKey = !app.autoKey; lsSet('alpicut.autoKey', app.autoKey ? '1' : '0');
    auto.classList.toggle('on', app.autoKey);
    toast(app.autoKey ? 'Oto keyframe açık — önizlemede sürükle/yakınlaştır, keyframe yazılır' : 'Oto keyframe kapalı', 2600);
  });
  if (!sp || !G.length || o.locked) {
    const msg = !app.P ? '' : !o ? 'Keyframe · zaman çizelgesinden bir öğe seç' : o.locked ? 'Öğe kilitli' : app.sel?.type === 'subs' ? 'Altyazı seçili · keyframe yok' : 'Bu öğede keyframe yok';
    bar.append(h('span', { class: 'kfb-ic', html: I.diamond }), h('span', { class: 'kfb-empty' }, msg), auto);
    bar.classList.add('empty');
    return;
  }
  bar.classList.remove('empty');
  const prev = h('button', { class: 'kfb-btn', html: I.left, 'aria-label': 'Önceki keyframe' });
  const tog = h('button', { class: 'kfb-btn kfb-tog', html: I.diamond, 'aria-label': 'Keyframe koy / kaldır' });
  const next = h('button', { class: 'kfb-btn', html: I.right, 'aria-label': 'Sonraki keyframe' });
  const lane = h('div', { class: 'kfb-lane' });
  const fill = h('i', { class: 'kfb-span' });
  const head = h('b', { class: 'kfb-head' });
  const dias = h('div', { class: 'kfb-dias' });
  lane.append(fill, dias, head);
  const info = h('span', { class: 'kfb-info' });
  const more = h('button', { class: 'kfb-btn', html: I.curve, 'aria-label': 'Keyframe ayrıntıları ve eğriler' });
  bar.append(prev, tog, next, lane, info, auto, more);
  els = { o, sp, G, tog, prev, next, lane, dias, head, info };

  tog.addEventListener('click', () => {
    const lt = app.engine.t - sp.start;
    if (lt < -0.001 || lt > sp.len + 0.001) { toast('Oynatıcıyı bu öğenin üzerine getir'); return; }
    const has = G.some((p) => keyAt(o, p, lt));
    if (has) { G.forEach((p) => delKey(o, p, lt)); app.commit(); toast('Keyframe kaldırıldı'); }
    else {
      G.forEach((p) => setKey(o, p, lt, valueOf(o, p, lt)));
      app.commit();
      toast('Keyframe eklendi — şimdi başka bir ana git ve önizlemede değiştir', 3200);
    }
  });
  const jump = (dir) => {
    const lt = app.engine.t - sp.start;
    const ts = allKeyTimes(o);
    const k = dir > 0 ? ts.find((t) => t > lt + EPS) : [...ts].reverse().find((t) => t < lt - EPS);
    if (k == null) { toast(dir > 0 ? 'Sonrasında keyframe yok' : 'Öncesinde keyframe yok'); return; }
    seekLocal(sp, k);
  };
  prev.addEventListener('click', () => jump(-1));
  next.addEventListener('click', () => jump(1));
  more.addEventListener('click', () => app.openInspector('Keyframe'));
  // şeride dokun/sürükle: öğe içinde ileri-geri git; keyframe'e yakınsa üstüne yapış
  let drag = false;
  const at = (e) => {
    const r = lane.getBoundingClientRect();
    let lt = ((e.clientX - r.left) / Math.max(1, r.width)) * sp.len;
    const px = (t) => (t / sp.len) * r.width;
    const near = allKeyTimes(o).find((t) => Math.abs(px(t) - (e.clientX - r.left)) < 12);
    if (near != null) lt = near;
    seekLocal(sp, lt);
  };
  lane.addEventListener('pointerdown', (e) => { drag = true; try { lane.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ } at(e); });
  lane.addEventListener('pointermove', (e) => { if (drag) at(e); });
  const end = () => { drag = false; };
  lane.addEventListener('pointerup', end); lane.addEventListener('pointercancel', end);
  drawDias();
  updateKfBar();
}

function drawDias() {
  if (!els) return;
  const { o, sp, dias } = els;
  dias.textContent = '';
  allKeyTimes(o).forEach((t) => dias.append(h('i', { class: 'kfb-dia', style: { left: `${Math.max(0, Math.min(100, (t / Math.max(0.001, sp.len)) * 100))}%` } })));
}

export function updateKfBar() {
  if (!els) return;
  const { o, sp, G, tog, prev, next, head, info } = els;
  if (o !== selected()) { renderKfBar(); return; }
  const lt = app.engine.t - sp.start;
  const inside = lt >= -0.001 && lt <= sp.len + 0.001;
  head.style.left = `${Math.max(0, Math.min(100, (lt / Math.max(0.001, sp.len)) * 100))}%`;
  head.classList.toggle('out', !inside);
  const on = inside && G.some((p) => keyAt(o, p, lt));
  tog.classList.toggle('on', on);
  tog.disabled = !inside;
  const ts = allKeyTimes(o);
  prev.disabled = !ts.some((t) => t < lt - EPS);
  next.disabled = !ts.some((t) => t > lt + EPS);
  const n = ts.length;
  const txt = `${n ? `${n} ◆ · ` : ''}${Math.max(0, Math.min(sp.len, lt)).toFixed(1)}s`;
  if (info.textContent !== txt) info.textContent = txt;
  if (els.n !== n) { els.n = n; drawDias(); }
}
