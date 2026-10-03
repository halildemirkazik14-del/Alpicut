// Alpicut — geçiş kütüphanesi: 11 temel + 122 sinematik (gl-transitions) geçiş, kategoriler, canlı küçük önizleme, favoriler
import { app, h, toast, clone, uid } from './state.js';
import { I } from './icons.js';
import { TRANSITIONS } from './presets.js';
import { GL_LIST, transGL } from './gltrans.js';
import { drawFit } from './render.js';
import { star, favIds, registerFav } from './favs.js';
import { layoutClips } from './engine.js';

const CAT_RULES = [
  ['Glitch & bozulma', /glitch|static|noise|doom|pixel|burn|exposure|perlin|wind|crosshatch|fly|ripple|water|butterfly|undulat|tv|melt|colourdistance/i],
  ['Zoom', /zoom|scale|lens|crosszoom/i],
  ['Kaydırma & silme', /wipe|direction|slide|swap|topbottom|slice|blind|door|squeeze|book|curl|coord/i],
  ['Dönme & 3D', /cube|rotat|roll|pinwheel|angular|gridflip|box|bounce|swirl|stereo|morph/i],
  ['Şekil', /circle|heart|hexag|polka|bowtie|radial|square|mosaic|kaleido|shard|polar|dissolve/i],
  ['Yumuşak', /.*/],
];
export const trCat = (raw) => CAT_RULES.find(([, re]) => re.test(raw))[0];
export const TR_CATS = ['Temel', ...CAT_RULES.map((c) => c[0])];

function thumbOf(L) {
  const cv = document.createElement('canvas'); cv.width = 72; cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#222'; x.fillRect(0, 0, 72, 128);
  try { const el = L && app.engine.elFor(L.clip); if (el) drawFit(x, el, 0, 0, 72, 128, 'cover'); } catch (_) { /* yoksay */ }
  if (!L) { const g = x.createLinearGradient(0, 0, 72, 128); g.addColorStop(0, '#7C3AED'); g.addColorStop(1, '#EC4899'); x.fillStyle = g; x.fillRect(0, 0, 72, 128); }
  return cv;
}
function sample(id) {
  const c = document.createElement('canvas'); c.width = 72; c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 72, 128);
  if (id) { g.addColorStop(0, '#0EA5E9'); g.addColorStop(1, '#22C55E'); } else { g.addColorStop(0, '#F97316'); g.addColorStop(1, '#E11D48'); }
  x.fillStyle = g; x.fillRect(0, 0, 72, 128);
  x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '900 40px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.fillText(id ? 'B' : 'A', 36, 78);
  return c;
}

// gövde: c = geçişin uygulandığı (sonraki) klip
export function transBody(body, c, cat, refresh) {
  const lay = layoutClips(app.P.clips);
  const Li = lay.findIndex((x) => x.clip === c);
  if (!c.trans) c.trans = { type: 'none', dur: 0.5 };
  const pick = (id) => {
    c.trans.type = id;
    if (id !== 'none' && (!c.trans.dur || c.trans.dur < 0.2)) c.trans.dur = 0.5;
    app.change(true); app.refreshTimeline(); refresh();
    const L = layoutClips(app.P.clips).find((x) => x.clip === c);
    if (L && id !== 'none') { app.engine.seek(Math.max(0, L.start - 0.4)); app.updateTime(); app.syncScroll(); app.play(); setTimeout(() => app.pause(), (L.td + 1) * 1000); }
  };
  const curG = GL_LIST.find((g) => g.id === c.trans.type);
  body.append(h('div', { class: 'tr-cur' }, h('span', {}, 'Seçili:'), h('b', {}, curG ? curG.name : (TRANSITIONS.find((x) => x[0] === c.trans.type)?.[1] || 'Yok')),
    h('button', { class: 'btn', onclick: () => pick('none') }, 'Kaldır')));
  const { fields } = app.__sheets;
  body.append(fields(c, [{ label: 'Geçiş süresi', path: 'trans.dur', type: 'range', min: 0.2, max: 2, step: 0.05, fmt: (x) => `${(+x).toFixed(2)} sn`, def: 0.5, post: () => app.refreshTimeline() }]));
  if (cat === 'Temel') {
    const grid = h('div', { class: 'grid-3' });
    TRANSITIONS.filter((t) => t[0] !== 'none').forEach(([id, lbl]) => grid.append(h('div', { class: `opt${c.trans.type === id ? ' on' : ''}`, role: 'button', onclick: () => pick(id) }, lbl, star('trans', id, { name: lbl }))));
    body.append(grid);
  } else {
    const fv = favIds('trans');
    const items = cat === '★' ? GL_LIST.filter((t) => fv.includes(t.id)) : GL_LIST.filter((t) => trCat(t.raw) === cat);
    if (cat === '★') TRANSITIONS.filter((t) => fv.includes(t[0])).forEach(([id, lbl]) => items.unshift({ id, raw: null, name: lbl }));
    if (!items.length) body.append(h('p', { class: 'hint' }, 'Henüz favori geçiş yok. ☆ ile ekle.'));
    const A = Li > 0 ? thumbOf(lay[Li - 1]) : sample(0), B = Li >= 0 ? thumbOf(lay[Li]) : sample(1);
    const g2 = h('div', { class: 'tr-grid' });
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (!en.isIntersecting) return;
      const cv = en.target;
      const T = transGL(); const id = cv.dataset.raw;
      if (!T || !id) return;
      // küçük animasyon: görünürken döngü
      let p = 0.15;
      const tick = () => { if (!cv.isConnected) return; p = (p + 0.025) % 1; const out = T.render(id, A, B, 0.15 + p * 0.7, 72, 128); if (out) cv.getContext('2d').drawImage(out, 0, 0); cv._raf = setTimeout(tick, 60); };
      if (cv.dataset.anim) { if (cv._raf) return; tick(); } else { const out = T.render(id, A, B, 0.5, 72, 128); if (out) cv.getContext('2d').drawImage(out, 0, 0); }
    }), { root: null });
    items.forEach((t) => {
      const cv = h('canvas', { width: 72, height: 128 });
      if (t.raw) { cv.dataset.raw = t.raw; } else { const x = cv.getContext('2d'); x.drawImage(A, 0, 0); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, 72, 128); }
      const card = h('div', { class: `tr-card${c.trans.type === t.id ? ' on' : ''}`, role: 'button' }, cv, h('span', {}, t.name), star('trans', t.id, { name: t.name }));
      card.addEventListener('click', () => pick(t.id));
      card.addEventListener('pointerdown', () => { if (t.raw && !cv.dataset.anim) { cv.dataset.anim = '1'; io.unobserve(cv); io.observe(cv); } });
      g2.append(card);
      if (t.raw) io.observe(cv);
    });
    body.append(g2);
  }
  body.append(h('div', { class: 'btn-row' },
    h('button', { class: 'btn', html: `${I.play} Önizle`, onclick: () => { const L = layoutClips(app.P.clips).find((x) => x.clip === c); if (L) app.previewRange(Math.max(0, L.start - 0.6), L.start + L.td + 0.8); } }),
    h('button', { class: 'btn primary', onclick: () => { let n = 0; app.P.clips.forEach((x, i) => { if (i > 0) { x.trans = clone(c.trans); n++; } }); app.change(true); app.refreshTimeline(); toast(`Geçiş ${n} kesime uygulandı`); } }, 'Tüm kesimlere uygula')));
}

export async function openTransitions() {
  const { openSheet, refreshSheet } = await import('./sheets.js');
  openSheet({
    id: 'transitions', title: `Geçişler · ${GL_LIST.length + TRANSITIONS.length - 1}`, tabs: ['★', ...TR_CATS], tab: 'Temel',
    render: (body, tab) => {
      const P = app.P;
      if (!P) return;
      if (P.clips.length < 2) {
        body.append(h('div', { class: 'acc-empty' }, h('span', { html: I.trans }), h('b', {}, 'Geçiş için en az 2 klip gerekli'),
          h('p', { class: 'hint' }, 'Geçiş iki klip arasındaki kesime uygulanır. İkinci bir video ekle veya mevcut klibi oynatıcının olduğu yerden böl.'),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn', html: `${I.media} Medya ekle`, onclick: () => app.addMedia('clip') }),
            h('button', { class: 'btn primary', html: `${I.split} Burada böl`, onclick: () => { const L = layoutClips(P.clips).find((x) => app.engine.t > x.start + 0.1 && app.engine.t < x.end - 0.1); if (!L) { toast('Oynatıcıyı klibin ortasına getir'); return; } app.select({ type: 'clip', id: L.clip.id }, false); app.splitSel(); refreshSheet(); } }))));
        return;
      }
      // hedef kesim: seçili klip (ilk değilse) yoksa oynatıcıya en yakın kesim
      const lay = layoutClips(P.clips);
      let c = app.sel?.type === 'clip' ? P.clips.find((x) => x.id === app.sel.id) : null;
      if (!c || P.clips.indexOf(c) === 0) {
        const t = app.engine.t;
        const best = lay.slice(1).sort((a, b) => Math.abs(a.start - t) - Math.abs(b.start - t))[0];
        c = best.clip;
      }
      const idx = P.clips.indexOf(c);
      body.append(h('p', { class: 'hint', html: `<b>${idx}. ve ${idx + 1}. klip</b> arasındaki kesim. Başka bir kesim için zaman çizelgesindeki <b>+</b> noktasına dokun.` }));
      transBody(body, c, tab, () => refreshSheet());
    },
  });
}

registerFav('trans', (id) => {
  if (!app.P || app.P.clips.length < 2) { toast('Geçiş için en az 2 klip gerekli'); return; }
  app.P.clips.forEach((x, i) => { if (i > 0) x.trans = { type: id, dur: x.trans?.dur || 0.5 }; });
  app.commit(); toast('Geçiş tüm kesimlere uygulandı');
});
void uid;
