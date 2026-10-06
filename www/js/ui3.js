// Alpicut — Teslimat 3 arayüzü: renk, chroma, ses araçları, mikser, kayıt, efekt kataloğu, çıkartmalar,
// ayarlama katmanı, marka kiti, kapak editörü
import { app, h, clone, fmt, toast, busy, uid, selected } from './state.js';
import { I } from './icons.js';
import { fields, openSheet, closeSheet, refreshSheet, itemStart, itemLen } from './sheets.js';
import { COLOR_BASE, BUILTIN_LUTS, lutStore, parseCube, curveSamples, CURVE_IDENTITY, getGrader } from './gl.js';
import { FX_LIST, FX_CATS, STICKER_EMOJI, STICKER_BADGES, STICKER_SETS, applyLayerFx, drawSticker } from './fxlib.js';
import { decodeMono, findSilences, detectBeats, loudness, startMic } from './audiotools.js';
import { layoutClips } from './engine.js';
import { anim, RATIOS, FONTS, TEXT_BASE, TEXT_TEMPLATES } from './presets.js';
import { store, lsGet, lsSet, saveVideo } from './storage.js';
import { drawText } from './render.js';
import { processVoice, STUDIO_PRESETS } from './studio.js';
import { star, favIds, registerFav } from './favs.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const sgn = (x) => `${x > 0 ? '+' : ''}${(+x).toFixed(2)}`;
const db = (x) => `${x > 0 ? '+' : ''}${Math.round(x)} dB`;

// ================= RENK =================
let colorClip = null;

export function colorTab(body, o) {
  if (!o.color) o.color = { ...COLOR_BASE };
  if (!getGrader()) body.append(h('p', { class: 'hint', html: '<b>Uyarı:</b> Bu cihazda WebGL yok; renk ayarları uygulanamıyor.' }));
  body.append(h('div', { class: 'btn-row three' },
    h('button', { class: 'btn', onclick: () => { colorClip = clone({ color: o.color, curves: o.curves, lut: o.lut }); toast('Renk ayarı kopyalandı'); } }, 'Kopyala'),
    h('button', { class: 'btn', disabled: !colorClip, onclick: () => { Object.assign(o, clone(colorClip)); app.change(true); refreshSheet(); toast('Yapıştırıldı'); } }, 'Yapıştır'),
    h('button', { class: 'btn', onclick: () => { o.color = { ...COLOR_BASE }; delete o.curves; delete o.lut; app.change(true); refreshSheet(); } }, 'Sıfırla')));
  body.append(scopes());
  body.append(fields(o, [
    { label: 'Pozlama', path: 'color.exposure', type: 'range', min: -2, max: 2, fmt: sgn },
    { label: 'Kontrast', path: 'color.contrast', type: 'range', min: 0.5, max: 1.8, fmt: pct },
    { label: 'Doygunluk', path: 'color.sat', type: 'range', min: 0, max: 2, fmt: pct },
    { label: 'Canlılık', path: 'color.vib', type: 'range', min: -1, max: 1, fmt: sgn },
    { label: 'Sıcaklık', path: 'color.temp', type: 'range', min: -1, max: 1, fmt: sgn },
    { label: 'Ton (yeşil↔mor)', path: 'color.tint', type: 'range', min: -1, max: 1, fmt: sgn },
    { label: 'Gölgeler', path: 'color.shadows', type: 'range', min: -1, max: 1, fmt: sgn },
    { label: 'Parlak alanlar', path: 'color.highlights', type: 'range', min: -1, max: 1, fmt: sgn },
    { label: 'Cilt yumuşatma (güzellik)', path: 'color.smooth', type: 'range', min: 0, max: 1, fmt: pct, def: 0 },
    { label: 'Keskinleştir', path: 'color.sharp', type: 'range', min: 0, max: 1, fmt: pct, def: 0 },
  ]));
  body.append(curveEditor(o));
  body.append(lutPicker(o));
}

// Histogram + luma dalga formu (önizleme karesinden)
function scopes() {
  const cv = h('canvas', { width: 600, height: 150, class: 'scope' });
  const draw = () => {
    const src = app.engine.canvas;
    const w = 120, hh = Math.round((src.height / src.width) * 120);
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = hh;
    const tc = tmp.getContext('2d');
    tc.drawImage(src, 0, 0, w, hh);
    let d;
    try { d = tc.getImageData(0, 0, w, hh).data; } catch (_) { return; }
    const hr = new Float32Array(64), hg = new Float32Array(64), hb = new Float32Array(64);
    const wave = new Float32Array(w * 50);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      hr[d[i] >> 2]++; hg[d[i + 1] >> 2]++; hb[d[i + 2] >> 2]++;
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      wave[x * 50 + Math.min(49, Math.floor(l * 49.99))]++;
    }
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 600, 150);
    c.fillStyle = '#0b0814'; c.fillRect(0, 0, 600, 150);
    // histogram (sol)
    const mx = Math.max(...hr, ...hg, ...hb) || 1;
    c.globalCompositeOperation = 'screen';
    [[hr, '#ef4444'], [hg, '#22c55e'], [hb, '#3b82f6']].forEach(([arr, col]) => {
      c.fillStyle = col; c.globalAlpha = 0.75;
      for (let i = 0; i < 64; i++) { const v = (arr[i] / mx) * 140; c.fillRect(6 + i * 4.4, 146 - v, 4, v); }
    });
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // dalga formu (sağ)
    const ox = 300, ww = 294;
    const wm = Math.max(...wave) || 1;
    for (let x = 0; x < w; x++) for (let k = 0; k < 50; k++) {
      const v = wave[x * 50 + k];
      if (!v) continue;
      c.fillStyle = `rgba(196,181,253,${Math.min(1, 0.15 + (v / wm) * 2)})`;
      c.fillRect(ox + (x / w) * ww, 146 - (k / 49) * 140, ww / w + 0.5, 3);
    }
    c.fillStyle = '#6b5a96'; c.font = '20px Barlow, sans-serif';
    c.fillText('Histogram', 10, 22); c.fillText('Dalga formu', ox + 8, 22);
  };
  setTimeout(draw, 60);
  return h('div', { class: 'field full' }, cv, h('button', { class: 'btn', style: { marginTop: '4px' }, onclick: draw }, 'Ölçümü yenile'));
}

function curveEditor(o) {
  const wrap = h('div', { class: 'field full' });
  let ch = 'm';
  const cv = h('canvas', { width: 560, height: 360, class: 'curve-cv' });
  const ensure = () => { if (!o.curves) o.curves = { m: clone(CURVE_IDENTITY), r: clone(CURVE_IDENTITY), g: clone(CURVE_IDENTITY), b: clone(CURVE_IDENTITY) }; };
  const colors = { m: '#ffffff', r: '#ef4444', g: '#22c55e', b: '#3b82f6' };
  const draw = () => {
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.fillStyle = '#0b0814'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#2a2044'; c.lineWidth = 1;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo((W * i) / 4, 0); c.lineTo((W * i) / 4, H); c.moveTo(0, (H * i) / 4); c.lineTo(W, (H * i) / 4); c.stroke(); }
    c.strokeStyle = '#3a2c5c'; c.beginPath(); c.moveTo(0, H); c.lineTo(W, 0); c.stroke();
    ['m', 'r', 'g', 'b'].forEach((k) => {
      const pts = o.curves?.[k] || CURVE_IDENTITY;
      const smp = curveSamples(pts);
      c.strokeStyle = colors[k]; c.globalAlpha = k === ch ? 1 : 0.3; c.lineWidth = k === ch ? 3 : 1.5;
      c.beginPath();
      for (let i = 0; i < 256; i++) { const x = (i / 255) * W, y = H - Math.max(0, Math.min(1, smp[i])) * H; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      if (k === ch) pts.forEach(([x, y]) => { c.fillStyle = colors[k]; c.beginPath(); c.arc(x * W, H - y * H, 11, 0, Math.PI * 2); c.fill(); });
    });
    c.globalAlpha = 1;
  };
  let drag = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height))]; };
  cv.addEventListener('pointerdown', (e) => {
    ensure();
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    const pts = o.curves[ch];
    let i = pts.findIndex(([px, py]) => Math.hypot(px - x, (py - y) * 0.6) < 0.06);
    if (i < 0) { pts.push([x, y]); pts.sort((a, b) => a[0] - b[0]); i = pts.findIndex((p) => p[0] === x && p[1] === y); }
    drag = { i, t0: performance.now(), x, y };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const pts = o.curves[ch];
    let [x, y] = pos(e);
    const i = drag.i;
    if (i === 0) x = 0; else if (i === pts.length - 1) x = 1;
    else x = Math.max(pts[i - 1][0] + 0.02, Math.min(pts[i + 1][0] - 0.02, x));
    pts[i] = [x, y];
    draw(); app.change(false);
  });
  const up = () => {
    if (!drag) return;
    const pts = o.curves[ch];
    // kısa dokunuşla aynı noktaya ikinci kez dokunulursa (uçlar hariç) noktayı sil
    if (performance.now() - drag.t0 < 250 && drag.i > 0 && drag.i < pts.length - 1 && drag.again) pts.splice(drag.i, 1);
    drag = null; draw(); app.change(true);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('dblclick', (e) => {
    ensure();
    const [x, y] = pos(e); const pts = o.curves[ch];
    const i = pts.findIndex(([px, py]) => Math.hypot(px - x, (py - y) * 0.6) < 0.06);
    if (i > 0 && i < pts.length - 1) { pts.splice(i, 1); draw(); app.change(true); }
  });
  const chips = h('div', { class: 'chips' });
  [['m', 'Ana'], ['r', 'Kırmızı'], ['g', 'Yeşil'], ['b', 'Mavi']].forEach(([k, l]) => {
    const b = h('button', { class: k === ch ? 'on' : '' }, l);
    b.addEventListener('click', () => { ch = k; chips.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); draw(); });
    chips.append(b);
  });
  wrap.append(h('label', {}, 'Eğriler'), chips, cv,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => { ensure(); o.curves[ch] = [[0, 0], [0.25, 0.2], [0.75, 0.82], [1, 1]]; draw(); app.change(true); } }, 'S eğrisi (kontrast)'),
      h('button', { class: 'btn', onclick: () => { if (o.curves) o.curves[ch] = clone(CURVE_IDENTITY); draw(); app.change(true); } }, 'Kanalı sıfırla')),
    h('p', { class: 'hint' }, 'Eğriye dokunarak nokta ekle, sürükleyerek ayarla; noktaya çift dokununca silinir.'));
  setTimeout(draw, 0);
  return wrap;
}

function lutPicker(o) {
  const wrap = h('div', { class: 'field full' });
  const chips = h('div', { class: 'chips' });
  const cur = o.lut?.id || '';
  const set = (id) => { o.lut = id ? { id, mix: o.lut?.mix ?? 1 } : null; app.change(true); refreshSheet(); };
  chips.append(h('button', { class: !cur ? 'on' : '', onclick: () => set('') }, 'Yok'));
  BUILTIN_LUTS.forEach(([id, name]) => chips.append(h('button', { class: cur === `b:${id}` ? 'on' : '', onclick: () => set(`b:${id}`) }, name)));
  for (const [id, L] of lutStore) chips.append(h('button', { class: cur === id ? 'on' : '', onclick: () => set(id) }, L.name));
  chips.append(h('button', { html: `${I.upload} .cube yükle`, onclick: async () => {
    const files = await app.pickFiles('', false);
    if (!files.length) return;
    try {
      const lut = parseCube(await files[0].text());
      const id = `lut-${uid()}`;
      const rec = { id, kind: 'lut', name: files[0].name.replace(/\.cube$/i, ''), size: lut.size, data: lut.data, blob: new Blob([]) };
      try { await store.putMedia(rec); } catch (_) { /* yoksay */ }
      lutStore.set(id, rec);
      set(id);
      toast(`LUT yüklendi (${lut.size}³)`);
    } catch (e) { toast(e.message || 'LUT okunamadı'); }
  } }));
  wrap.append(h('label', {}, 'LUT (renk görünümü)'), chips);
  if (o.lut) wrap.append(fields(o, [{ label: 'LUT yoğunluğu', path: 'lut.mix', type: 'range', min: 0, max: 1, fmt: pct }]));
  return wrap;
}

// ================= CHROMA KEY =================
export function chromaTab(body, o) {
  if (!o.key) o.key = { on: false, color: '#00FF00', tol: 0.1, soft: 0.08, spill: 0.6 };
  body.append(h('p', { class: 'hint', html: 'Yeşil/mavi perde önünde çekilmiş bir videoyu katman olarak ekle; seçtiğin renk saydam olur ve altındaki görüntü görünür.' }));
  body.append(fields(o, [
    { label: 'Chroma key', path: 'key.on', type: 'toggle', rerender: true },
    { label: 'Anahtar renk', path: 'key.color', type: 'color', swatches: ['#00FF00', '#00B140', '#0047BB', '#0000FF', '#FFFFFF', '#000000'], hide: !o.key.on },
  ]));
  if (o.key.on) {
    body.append(h('button', { class: 'btn block', html: `${I.color} Önizlemeden renk seç`, onclick: () => {
      toast('Önizlemede saydam yapmak istediğin renge dokun', 3000);
      app.pickColor(o, (hex) => { o.key.color = hex; app.change(true); refreshSheet(); toast(`Renk: ${hex}`); });
    } }));
    body.append(fields(o, [
      { label: 'Tolerans', path: 'key.tol', type: 'range', min: 0, max: 0.5, step: 0.005, fmt: pct },
      { label: 'Kenar yumuşaklığı', path: 'key.soft', type: 'range', min: 0, max: 0.3, step: 0.005, fmt: pct },
      { label: 'Renk taşması azalt', path: 'key.spill', type: 'range', min: 0, max: 1, fmt: pct },
    ]));
    body.append(h('p', { class: 'hint', html: 'Not: MP4 saydamlık taşımaz; chroma key sonucu her zaman alttaki görüntüyle birleştirilmiş olarak çıkar.' }));
  }
}

// ================= SES =================
export function audioFxTab(body, o, defRole) {
  if (!o.afx) o.afx = { hp: false, low: 0, mid: 0, high: 0, comp: false };
  body.append(fields(o, [
    { label: 'Ses grubu', path: 'role', type: 'chips', options: [['voice', 'Konuşma'], ['music', 'Müzik'], ['sfx', 'SFX']] },
  ]));
  if (!o.role) { const r = body.querySelector('.chips button:nth-child(' + ({ voice: 1, music: 2, sfx: 3 }[defRole]) + ')'); if (r) r.classList.add('on'); }
  const presets = h('div', { class: 'chips' });
  [
    ['Ses netliği', { hp: true, low: -2, mid: 4, high: 2, comp: true }],
    ['Radyo sesi', { hp: true, low: -8, mid: 6, high: -6, comp: true }],
    ['Sıcak ses', { hp: true, low: 3, mid: 0, high: -1, comp: true }],
    ['Uğultu giderme', { hp: true, low: -3, mid: 0, high: 0, comp: false }],
    ['Müzik arka plan', { hp: false, low: 0, mid: -4, high: 0, comp: false }],
    ['Düz', { hp: false, low: 0, mid: 0, high: 0, comp: false }],
  ].forEach(([n, v]) => presets.append(h('button', { onclick: () => { o.afx = { ...v }; app.change(true); refreshSheet(); } }, n)));
  body.append(h('div', { class: 'field full' }, h('label', {}, 'Hazır ses ayarları'), presets));
  body.append(fields(o, [
    { label: 'Ses efekti', path: 'afx.vfx', type: 'chips', options: [['none', 'Yok'], ['echo', 'Eko'], ['room', 'Oda'], ['hall', 'Salon'], ['stadium', 'Stadyum'], ['phone', 'Telefon'], ['radio', 'Radyo'], ['megaphone', 'Megafon'], ['robot', 'Robot'], ['underwater', 'Su altı']] },
    { label: 'Uğultu filtresi (90 Hz)', path: 'afx.hp', type: 'toggle' },
    { label: 'Bas (160 Hz)', path: 'afx.low', type: 'range', min: -12, max: 12, step: 0.5, fmt: db },
    { label: 'Orta (2.5 kHz)', path: 'afx.mid', type: 'range', min: -12, max: 12, step: 0.5, fmt: db },
    { label: 'Tiz (8 kHz)', path: 'afx.high', type: 'range', min: -12, max: 12, step: 0.5, fmt: db },
    { label: 'Kompresör (ses dengele)', path: 'afx.comp', type: 'toggle' },
  ]));
  body.append(h('p', { class: 'hint', html: 'Değişiklikleri oynatırken duyarsın. Tam gürültü giderme (yapay zekâ ile) bu sürümde yok; uğultu filtresi ve EQ düşük frekans gürültüsünü azaltır.' }));
}

export function audioToolsTab(body, a) {
  body.append(h('div', { class: 'grid-3' },
    h('button', { class: 'opt', html: `${I.silence}<span>Sessizlikleri kes</span>`, onclick: () => openSilence(a, 'audio') }),
    h('button', { class: 'opt', html: `${I.beat}<span>Ritimleri bul</span>`, onclick: () => findBeats(a) }),
    h('button', { class: 'opt', html: `${I.mixer}<span>Seviyeyi eşitle</span>`, onclick: () => normalizeItem(a) })));
  body.append(h('p', { class: 'hint', html: '<b>Ritimleri bul</b> müzikteki vuruşları zaman çizelgesine sarı işaret olarak koyar; <b>Ritim zoom/flaş</b> efektleri ve “Ritimlerde böl” bu işaretleri kullanır.' }));
}

export async function findBeats(a) {
  const m = app.engine.media.get(a.mediaId);
  const b = busy('Ritimler aranıyor…');
  try {
    const d = await decodeMono(m);
    const beats = detectBeats(d, { from: a.in, to: a.out });
    const P = app.P;
    P.markers = (P.markers || []).filter((x) => !(x.kind === 'beat' && x.t >= a.start - 0.01 && x.t <= a.start + (a.out - a.in) + 0.01));
    beats.forEach((t) => P.markers.push({ id: uid(), t: a.start + (t - a.in), kind: 'beat' }));
    P.markers.sort((x, y) => x.t - y.t);
    app.change(true);
    toast(beats.length ? `${beats.length} ritim işareti eklendi` : 'Belirgin ritim bulunamadı');
  } catch (e) { toast(e.message || 'Analiz edilemedi'); } finally { b.close(); }
}

async function normalizeItem(o, isClip = false) {
  const m = app.engine.media.get(o.mediaId);
  const b = busy('Ses seviyesi ölçülüyor…');
  try {
    const d = await decodeMono(m);
    const L = loudness(d, o.in || 0, o.out ?? d.dur);
    if (L < -70) { toast('Ses bulunamadı'); return; }
    const target = (o.role || (isClip ? 'voice' : 'music')) === 'music' ? -24 : -18;
    const gain = Math.max(0.1, Math.min(4, Math.pow(10, (target - L) / 20)));
    o.volume = +gain.toFixed(2);
    app.change(true); refreshSheet();
    toast(`Ölçülen ${L.toFixed(1)} dB → hedef ${target} dB (seviye ${Math.round(gain * 100)}%)`, 3500);
  } catch (e) { toast(e.message || 'Ölçülemedi'); } finally { b.close(); }
}
export { normalizeItem };

// ---------- Sessizlik tespiti ve kesme ----------
export function openSilence(o, type) {
  const st = { threshold: -40, minDur: 0.6, pad: 0.12, ripple: true, res: null, sel: [] };
  const isClip = type === 'clip';
  openSheet({
    title: 'Sessizlikleri kes', tall: true,
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Konuşmadaki uzun duraklamaları bulur. Önerileri dinleyip seç, sonra <b>Kesimleri uygula</b>. Kelimeleri yememek için kenarlarda pay bırakılır.' }));
      body.append(fields(st, [
        { label: 'Sessizlik eşiği', path: 'threshold', type: 'range', min: -60, max: -20, step: 1, fmt: db },
        { label: 'En kısa süre', path: 'minDur', type: 'range', min: 0.2, max: 3, step: 0.05, fmt: (x) => `${(+x).toFixed(2)} sn` },
        { label: 'Kenar payı', path: 'pad', type: 'range', min: 0, max: 0.4, step: 0.01, fmt: (x) => `${(+x).toFixed(2)} sn` },
        { label: 'Diğer öğeleri kaydır', path: 'ripple', type: 'toggle', hide: !isClip },
      ]));
      body.append(h('button', { class: 'btn block primary', html: `${I.silence} Analiz et`, onclick: async () => {
        const b = busy('Ses analiz ediliyor…');
        try {
          const d = await decodeMono(app.engine.media.get(o.mediaId));
          st.res = findSilences(d, { from: o.in || 0, to: o.out ?? d.dur, threshold: st.threshold, minDur: st.minDur, pad: st.pad });
          st.sel = st.res.map(() => true);
        } catch (e) { toast(e.message || 'Analiz edilemedi'); } finally { b.close(); }
        refreshSheet();
      } }));
      if (st.res) {
        const total = st.res.reduce((acc, r, i) => acc + (st.sel[i] ? r.e - r.s : 0), 0) / (o.speed || 1);
        body.append(h('p', { class: 'hint', html: `<b>${st.res.length}</b> sessiz bölüm bulundu · kazanılacak süre <b>${total.toFixed(1)} sn</b>` }));
        const startT = itemStart(o);
        st.res.forEach((r, i) => {
          const tl = startT + (r.s - (o.in || 0)) / (o.speed || 1);
          const cb = h('button', { class: `toggle${st.sel[i] ? ' on' : ''}` });
          cb.addEventListener('click', () => { st.sel[i] = !st.sel[i]; refreshSheet(); });
          body.append(h('div', { class: 'sil-row' }, cb,
            h('span', {}, `${fmt(tl)} · ${(r.e - r.s).toFixed(2)} sn`),
            h('button', { class: 'btn', onclick: () => { app.previewRange(Math.max(0, tl - 0.6), tl + (r.e - r.s) / (o.speed || 1) + 0.6); } }, '▶ Dinle')));
        });
        if (st.res.length) {
          body.append(h('div', { class: 'btn-row' },
            h('button', { class: 'btn', onclick: () => { st.sel = st.sel.map((x) => !x); refreshSheet(); } }, 'Seçimi ters çevir'),
            h('button', { class: 'btn primary', onclick: () => {
              const ranges = st.res.filter((_, i) => st.sel[i]);
              if (!ranges.length) { toast('Seçili bölüm yok'); return; }
              closeSheet();
              app.cutSourceRanges(o, type, ranges, isClip ? st.ripple : false);
            } }, 'Kesimleri uygula')));
        }
      }
    },
  });
}

// ---------- Slip ----------
export function slipControl(c, mdur) {
  const lo = -c.in, hi = mdur - c.out;
  const wrap = h('div', { class: 'field' });
  const val = h('span', { class: 'val' }, '0.0s');
  const inp = h('input', { type: 'range', min: lo.toFixed(2), max: hi.toFixed(2), step: 0.02, value: 0 });
  const base = { in: c.in, out: c.out };
  inp.style.setProperty('--p', `${(-lo / Math.max(0.01, hi - lo)) * 100}%`);
  inp.addEventListener('input', () => {
    const d = parseFloat(inp.value);
    c.in = base.in + d; c.out = base.out + d;
    val.textContent = `${d > 0 ? '+' : ''}${d.toFixed(1)}s`;
    app.change(false);
  });
  inp.addEventListener('change', () => { app.change(true); refreshSheet(); });
  wrap.append(h('label', {}, 'Slip (içeriği kaydır)'), inp, val);
  return h('div', {}, wrap, h('p', { class: 'hint', html: 'Slip: klibin süresi ve yeri aynı kalır, videonun hangi kısmının görüneceği değişir.' }));
}

// ================= MİKSER =================
export function openMixer() {
  const P = app.P;
  if (!P.mix) P.mix = { voice: 1, music: 1, sfx: 1, master: 1, limiter: true, duck: { on: false, amount: 12, threshold: -38, attack: 0.08, release: 0.45 } };
  if (!P.mix.duck) P.mix.duck = { on: false, amount: 12, threshold: -38, attack: 0.08, release: 0.45 };
  let raf = null;
  openSheet({
    title: 'Ses mikseri', tall: true,
    onClose: () => cancelAnimationFrame(raf),
    render: (body) => {
      cancelAnimationFrame(raf);
      const bar = h('i'), peak = h('span', { class: 'val' }, '-∞ dB'), clip = h('span', { class: 'clip-led' }, 'CLIP'), duckEl = h('span', { class: 'val' }, '');
      body.append(h('div', { class: 'meter-row' }, h('div', { class: 'meter' }, bar), peak, clip));
      body.append(h('p', { class: 'hint', html: 'Göstergeyi görmek için oynat. Kırmızı <b>CLIP</b> yanarsa master ya da grup seviyelerini düşür; limiter sesi 0 dB altında tutar.' }));
      const mixChange = () => app.engine.applyMix();
      body.append(fields(P.mix, [
        { label: 'Konuşma', path: 'voice', type: 'range', min: 0, max: 2, fmt: pct, post: mixChange },
        { label: 'Müzik', path: 'music', type: 'range', min: 0, max: 2, fmt: pct, post: mixChange },
        { label: 'SFX', path: 'sfx', type: 'range', min: 0, max: 2, fmt: pct, post: mixChange },
        { label: 'Master', path: 'master', type: 'range', min: 0, max: 2, fmt: pct, post: mixChange },
        { label: 'Master limiter', path: 'limiter', type: 'toggle', post: mixChange },
      ]));
      body.append(h('h4', { class: 'sub-title' }, 'Otomatik ducking'));
      body.append(h('p', { class: 'hint', html: 'Konuşma grubunda ses olduğunda müzik grubunu otomatik kısar. Ses dosyalarının grubunu her öğenin <b>Efekt</b> sekmesinden seçebilirsin.' }));
      body.append(fields(P.mix, [
        { label: 'Ducking', path: 'duck.on', type: 'toggle', post: mixChange, rerender: true },
        { label: 'Azaltma', path: 'duck.amount', type: 'range', min: 3, max: 30, step: 1, fmt: (x) => `-${x} dB`, hide: !P.mix.duck.on },
        { label: 'Eşik', path: 'duck.threshold', type: 'range', min: -60, max: -15, step: 1, fmt: db, hide: !P.mix.duck.on },
        { label: 'Atak', path: 'duck.attack', type: 'range', min: 0.01, max: 0.5, step: 0.01, fmt: (x) => `${Math.round(x * 1000)} ms`, hide: !P.mix.duck.on },
        { label: 'Bırakma', path: 'duck.release', type: 'range', min: 0.1, max: 2, step: 0.05, fmt: (x) => `${Math.round(x * 1000)} ms`, hide: !P.mix.duck.on },
      ]));
      if (P.mix.duck.on) body.append(h('div', { class: 'field' }, h('label', {}, 'Anlık müzik azaltma'), duckEl, h('span')));
      body.append(h('button', { class: 'btn block', html: `${I.play} Oynat / durdur`, onclick: () => (app.engine.playing ? app.pause() : app.play()) }));
      const tick = () => {
        const m = app.engine.meter;
        if (m) {
          const p = Math.max(-60, m.peak);
          bar.style.width = `${((p + 60) / 60) * 100}%`;
          bar.style.background = p > -3 ? '#f43f5e' : p > -12 ? '#facc15' : 'var(--grad)';
          peak.textContent = m.peak < -80 ? '-∞ dB' : `${m.peak.toFixed(1)} dB`;
          clip.classList.toggle('on', performance.now() < m.clipUntil);
          duckEl.textContent = `${m.duckDb.toFixed(1)} dB`;
        }
        raf = requestAnimationFrame(tick);
      };
      app.engine.ensureAudio();
      raf = requestAnimationFrame(tick);
    },
  });
}

// ================= MİKROFON =================
export function openMic() {
  let rec = null, raf = null, startT = 0;
  const st = { playVideo: true, studio: lsGet('alpicut.micStudio', 'podcast') };
  openSheet({
    title: 'Seslendirme kaydı',
    onClose: () => { cancelAnimationFrame(raf); if (rec) { rec.cancel(); rec = null; app.engine.master && (app.engine.out.gain.value = 1); app.pause(); } },
    render: (body) => {
      const lvl = h('i'), time = h('div', { class: 'big-pct' }, '00:00.0');
      const btn = h('button', { class: 'rec-btn', 'aria-label': 'Kaydet' });
      body.append(h('p', { class: 'hint', html: 'Kayıt oynatıcının bulunduğu yerden başlar. Video sessiz oynar, böylece görüntüye bakarak konuşabilirsin. En iyi sonuç için kulaklık kullan.' }));
      body.append(fields(st, [
        { label: 'Kayıtta videoyu oynat', path: 'playVideo', type: 'toggle' },
        { label: 'Stüdyo işleme (kayıttan sonra)', path: 'studio', type: 'chips', options: [['none', 'Ham kayıt'], ...Object.entries(STUDIO_PRESETS).map(([k, v]) => [k, v.label])], post: (o) => lsSet('alpicut.micStudio', o.studio) },
      ]));
      body.append(h('div', { class: 'rec-wrap' }, time, h('div', { class: 'meter' }, lvl), btn));
      const tick = () => {
        if (rec) {
          const l = Math.max(-60, rec.level());
          lvl.style.width = `${((l + 60) / 60) * 100}%`;
          lvl.style.background = l > -3 ? '#f43f5e' : 'var(--grad)';
          time.textContent = fmt(rec.elapsed());
        }
        raf = requestAnimationFrame(tick);
      };
      btn.addEventListener('click', async () => {
        if (!rec) {
          try {
            startT = app.engine.t;
            for (let i = 3; i > 0; i--) { time.textContent = String(i); await new Promise((r) => setTimeout(r, 650)); }
            rec = await startMic();
            btn.classList.add('on');
            if (st.playVideo) { app.engine.ensureAudio(); if (app.engine.out) app.engine.out.gain.value = 0; app.play(); }
            raf = requestAnimationFrame(tick);
          } catch (e) {
            time.textContent = '00:00.0';
            toast(e.name === 'NotAllowedError' ? 'Mikrofon izni verilmedi' : (e.message || 'Mikrofon açılamadı'), 3500);
          }
        } else {
          cancelAnimationFrame(raf);
          const r = rec; rec = null;
          btn.classList.remove('on');
          app.pause();
          if (app.engine.out) app.engine.out.gain.value = 1;
          let blob = await r.stop();
          if (st.studio && st.studio !== 'none') {
            const pb = busy('Stüdyo işleme…');
            try { blob = await processVoice(blob, STUDIO_PRESETS[st.studio], (p, t) => pb.set(`${t} %${Math.round(p * 100)}`)); } catch (e) { toast('Stüdyo işleme yapılamadı, ham kayıt eklendi', 3500); } finally { pb.close(); }
          }
          const d = new Date();
          const file = new File([blob], `Seslendirme_${d.getHours()}${String(d.getMinutes()).padStart(2, '0')}.${blob.type.includes('wav') ? 'wav' : blob.type.includes('mp4') ? 'm4a' : 'webm'}`, { type: blob.type });
          const recs = await app.importFiles([file], true);
          if (recs[0]) {
            const a = { id: uid(), mediaId: recs[0].id, start: startT, in: 0, out: recs[0].duration || r.elapsed(), volume: 1, fadeIn: 0, fadeOut: 0, role: 'voice', afx: st.studio && st.studio !== 'none' ? { hp: false, low: 0, mid: 0, high: 0, comp: false } : { hp: true, low: -2, mid: 3, high: 1, comp: true } };
            app.P.audio.push(a);
            app.commit();
            toast('Seslendirme eklendi');
          }
          closeSheet();
        }
      });
    },
  });
}

// ================= EFEKT KATALOĞU =================
const favs = () => { try { return JSON.parse(lsGet('alpicut.favfx', '[]')); } catch (_) { return []; } };
const recents = () => { try { return JSON.parse(lsGet('alpicut.recentfx', '[]')); } catch (_) { return []; } };

function fxPreview(id, snap) {
  const c = h('canvas', { width: 108, height: Math.round(108 * snap.height / snap.width) });
  const ctx = c.getContext('2d');
  const [W, H] = [app.engine.W, app.engine.H];
  ctx.drawImage(snap, 0, 0, c.width, c.height);
  const S = c.width / W;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  const L = { kind: 'fx', effect: id, start: -0.15, end: 5, amount: 1, speed: 1, anim: anim('none', 'none') };
  try { applyLayerFx(ctx, L, 0, { W, H, S }, [{ t: -0.05, kind: 'beat' }]); } catch (_) { /* yoksay */ }
  return c;
}

export function openEffects(tabInit) {
  const snap = document.createElement('canvas');
  snap.width = app.engine.canvas.width; snap.height = app.engine.canvas.height;
  snap.getContext('2d').drawImage(app.engine.canvas, 0, 0);
  openSheet({
    id: 'effects', title: `Efektler · ${FX_LIST.length}`, tabs: ['Son', '★', ...FX_CATS], tab: tabInit || (recents().length ? 'Son' : 'Hareket'),
    render: (body, tab) => {
      const s = app.sel && selected();
      const target = s && app.sel.type === 'clip' ? s : null;
      body.append(h('p', { class: 'hint', html: target ? 'Efekt <b>seçili klibin</b> süresine yerleşir.' : 'Efekt oynatıcı konumuna 2 saniyelik olarak eklenir; süresini zaman çizelgesinden uzatabilirsin. Efekt, altındaki tüm katmanları etkiler.' }));
      let list = FX_LIST;
      if (tab === '★') list = FX_LIST.filter((f) => favIds('fx').includes(f[0]));
      else if (tab === 'Son') list = recents().map((id) => FX_LIST.find((f) => f[0] === id)).filter(Boolean);
      else list = FX_LIST.filter((f) => f[2] === tab);
      if (!list.length) { body.append(h('p', { class: 'hint' }, tab === '★' ? 'Henüz favori yok. Kartlardaki ☆ ile ekle.' : 'Henüz kullanılmış efekt yok.')); return; }
      const grid = h('div', { class: 'fx-grid' });
      list.forEach(([id, name, cat, kind]) => {
        const card = h('div', { class: 'fx-card', role: 'button', tabindex: '0' }, fxPreview(id, snap), star('fx', id, { name }),
          h('span', {}, name), kind === 'motion' || cat === 'Ritim' ? h('small', {}, cat === 'Ritim' ? 'ritim işareti gerekir' : 'hareket') : null);
        card.addEventListener('click', () => addFx(id, target));
        grid.append(card);
      });
      body.append(grid);
    },
  });
}

registerFav('fx', (id) => { const s = app.sel && selected(); addFx(id, s && app.sel.type === 'clip' ? s : null); });
function addFx(id, target) {
  const r = recents().filter((x) => x !== id); r.unshift(id); lsSet('alpicut.recentfx', JSON.stringify(r.slice(0, 12)));
  let start = app.engine.t, end = start + 2;
  if (target) { const L = layoutClips(app.P.clips).find((x) => x.clip === target); if (L) { start = L.start; end = L.end; } }
  if (['beatzoom', 'beatflash', 'beatshake'].includes(id) && !(app.P.markers || []).some((m) => m.kind === 'beat')) {
    toast('Bu efekt için önce bir müziğe dokunup “Ritimleri bul” kullan', 4000);
  }
  const L = { id: uid(), kind: 'fx', effect: id, start, end, amount: 1, speed: 1, x: 0.5, y: 0.5, rot: 0, opacity: 1, anim: anim('none', 'none') };
  app.P.layers.push(L);
  app.commit();
  closeSheet();
  setTimeout(() => app.select({ type: 'layer', id: L.id }), 240);
}

// Efekt / ayarlama katmanı denetçisi
export function fxLayerInspector(L) {
  const isAdj = L.kind === 'adjust';
  return {
    title: isAdj ? 'Ayarlama katmanı' : `Efekt · ${FX_LIST.find((f) => f[0] === L.effect)?.[1] || ''}`,
    tabs: isAdj ? ['Renk', 'Zaman'] : ['Efekt', 'Zaman'],
    actions: [
      { icon: L.hidden ? I.eyeOff : I.eye, label: L.hidden ? 'Aç' : 'Kapat', onClick: () => { L.hidden = !L.hidden; app.change(true); refreshSheet(); } },
      { icon: I.split, label: 'Böl', onClick: () => app.splitSel() },
      { icon: I.copy, label: 'Kopyala', onClick: () => app.dupSel() },
      { icon: I.trash, label: 'Sil', danger: true, onClick: () => app.delSel() },
    ],
    render: (body, tab) => {
      if (tab === 'Renk') {
        body.append(h('p', { class: 'hint', html: 'Ayarlama katmanı, süresi boyunca <b>altındaki her şeye</b> (klipler, katmanlar) aynı renk ayarını uygular.' }));
        return colorTab(body, L);
      }
      if (tab === 'Efekt') {
        const chips = h('div', { class: 'chips' });
        FX_LIST.forEach(([id, name]) => chips.append(h('button', { class: L.effect === id ? 'on' : '', onclick: () => { L.effect = id; app.change(true); refreshSheet(); } }, name)));
        body.append(h('div', { class: 'field full' }, h('label', {}, 'Efekt'), chips));
      }
      const dmax = Math.max(app.engine.duration() + 5, L.end + 5);
      body.append(fields(L, [
        { label: isAdj ? 'Yoğunluk' : 'Şiddet', path: 'amount', type: 'range', min: 0, max: isAdj ? 1 : 2, fmt: pct },
        { label: 'Hız', path: 'speed', type: 'range', min: 0.25, max: 4, step: 0.05, fmt: (x) => `${(+x).toFixed(2)}x`, hide: isAdj },
        { label: 'Yumuşak giriş', path: 'anim.in', type: 'chips', options: [['none', 'Yok'], ['fade', 'Belir']] },
        { label: 'Yumuşak çıkış', path: 'anim.out', type: 'chips', options: [['none', 'Yok'], ['fade', 'Kaybol']] },
        { label: 'Başlangıç', path: 'start', type: 'range', min: 0, max: dmax, step: 0.05, fmt: (x) => `${(+x).toFixed(1)}s`, post: (o) => { o.start = Math.min(o.start, o.end - 0.2); app.refreshTimeline(); } },
        { label: 'Bitiş', path: 'end', type: 'range', min: 0, max: dmax, step: 0.05, fmt: (x) => `${(+x).toFixed(1)}s`, post: (o) => { o.end = Math.max(o.end, o.start + 0.2); app.refreshTimeline(); } },
      ]));
      body.append(h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => { L.start = 0; L.end = Math.max(0.5, app.engine.duration()); app.change(true); refreshSheet(); } }, 'Tüm videoya yay'),
        h('button', { class: 'btn', onclick: () => app.previewRange(Math.max(0, L.start - 0.3), L.end + 0.3) }, '▶ Önizle')));
    },
  };
}

export function addAdjustLayer() {
  const t = app.engine.t;
  const d = app.engine.duration();
  const L = { id: uid(), kind: 'adjust', start: d > 1 ? 0 : t, end: d > 1 ? d : t + 3, amount: 1, color: { ...COLOR_BASE, contrast: 1.08, sat: 1.1 }, x: 0.5, y: 0.5, rot: 0, opacity: 1, anim: anim('none', 'none') };
  app.P.layers.push(L);
  app.commit();
  setTimeout(() => app.select({ type: 'layer', id: L.id }, 'Renk'), 60);
}

// ================= ÇIKARTMALAR =================
function stickerPreview(L) {
  const c = h('canvas', { width: 120, height: 120 });
  const ctx = c.getContext('2d');
  ctx.translate(60, 60); ctx.scale(0.42, 0.42);
  drawSticker(ctx, { ...L, size: 200 }, 0.2, { W: 1080, H: 1920, S: 0.42 });
  return c;
}

export function openStickers(replace) {
  openSheet({
    id: 'stickers', title: 'Çıkartmalar', tall: true, tabs: [...Object.keys(STICKER_SETS), 'Spor', 'Emoji'],
    render: (body, tab) => {
      const grid = h('div', { class: `stk-grid${STICKER_SETS[tab] ? ' wide' : ''}` });
      const items = tab === 'Spor' ? STICKER_BADGES.map(([id, n]) => ({ badge: id, name: n }))
        : tab === 'Emoji' ? STICKER_EMOJI.map((g) => ({ glyph: g, name: g }))
          : (STICKER_SETS[tab] || []).map((d) => ({ sd: d, name: d.text }));
      items.forEach((it) => {
        const L = { kind: 'sticker', badge: it.badge, glyph: it.glyph, sd: it.sd };
        grid.append(h('button', { class: 'stk', title: it.name, onclick: () => {
          if (replace) { replace.badge = it.badge || null; replace.glyph = it.glyph || null; replace.sd = it.sd ? { ...it.sd } : null; app.change(true); closeSheet(); return; }
          app.addLayer({ kind: 'sticker', badge: it.badge || null, glyph: it.glyph || null, sd: it.sd ? { ...it.sd } : null, size: 260, x: 0.5, y: 0.4, rot: 0, sc: 1, opacity: 1, anim: anim('pop', 'pop', 'none', 0.35) }, 2.5);
        } }, stickerPreview(L)));
      });
      body.append(grid);
    },
  });
}

// ================= MARKA KİTİ =================
const kits = () => { try { return JSON.parse(lsGet('alpicut.kits', '[]')); } catch (_) { return []; } };
const putKits = (k) => lsSet('alpicut.kits', JSON.stringify(k));

export function openBrand() {
  let edit = null;
  openSheet({
    title: 'Marka kitleri', tall: true,
    render: (body) => {
      if (edit) {
        body.append(fields(edit, [
          { label: 'Kit adı', path: 'name', type: 'text' },
          { label: 'Yazı tipi', path: 'font', type: 'chips', options: FONTS },
          { label: 'Yazı rengi', path: 'text', type: 'color' },
          { label: 'Vurgu rengi', path: 'accent', type: 'color' },
          { label: 'Ana renk (buton/kutu)', path: 'primary', type: 'color' },
          { label: 'Kontur rengi', path: 'stroke', type: 'color' },
        ]));
        const logo = edit.logo ? app.engine.media.get(edit.logo) : null;
        body.append(h('div', { class: 'field' }, h('label', {}, 'Logo'), h('span', {}, logo ? logo.name : 'Yok'),
          h('button', { class: 'btn', onclick: async () => {
            const files = await app.pickFiles('image/*', false);
            if (!files.length) return;
            const recs = await app.importFiles(files);
            if (recs[0]) { edit.logo = recs[0].id; refreshSheet(); }
          } }, 'Seç')));
        body.append(h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => { edit = null; refreshSheet(); } }, 'Vazgeç'),
          h('button', { class: 'btn primary', onclick: () => {
            const k = kits(); const i = k.findIndex((x) => x.id === edit.id);
            if (i >= 0) k[i] = edit; else k.unshift(edit);
            putKits(k); edit = null; refreshSheet(); toast('Kit kaydedildi');
          } }, 'Kaydet')));
        return;
      }
      body.append(h('p', { class: 'hint', html: 'Kitte yazı tipi, renkler ve logo saklanır. <b>Uygula</b> tüm yazı, buton, skor kartı ve altyazı stillerini kite göre günceller; içeriklerine dokunmaz.' }));
      body.append(h('button', { class: 'btn block primary', html: `${I.plus} Yeni marka kiti`, onclick: () => { edit = { id: uid(), name: 'Kanalım', font: 'Barlow Condensed', text: '#FFFFFF', accent: '#C084FC', primary: '#7C3AED', stroke: '#000000', logo: null }; refreshSheet(); } }));
      kits().forEach((k) => {
        body.append(h('div', { class: 'kit-row' },
          h('span', { class: 'kit-sw' }, ...[k.primary, k.accent, k.text].map((c) => h('i', { style: { background: c } }))),
          h('b', {}, k.name),
          h('button', { class: 'btn', onclick: () => applyKit(k) }, 'Uygula'),
          h('button', { class: 'icon-btn sm', html: I.edit, 'aria-label': 'Düzenle', onclick: () => { edit = clone(k); refreshSheet(); } }),
          h('button', { class: 'icon-btn sm danger', html: I.trash, 'aria-label': 'Sil', onclick: () => { putKits(kits().filter((x) => x.id !== k.id)); refreshSheet(); } })));
      });
    },
  });
}

function applyKit(k) {
  const P = app.P;
  P.layers.forEach((l) => {
    if (l.kind === 'text') { l.font = k.font; l.color = k.text; l.accent = k.accent; if (l.strokeW > 0) l.strokeColor = k.stroke; if (l.bgOn) l.bgColor = k.primary; }
    if (l.kind === 'cta' && l.style !== 'glass') l.color = k.primary;
    if (l.kind === 'score') l.accent = k.primary;
    if (l.kind === 'shape' && l.glow > 0) l.color = k.accent;
  });
  if (P.subs) { P.subs.style.font = k.font; P.subs.style.color = k.text; P.subs.style.accent = k.accent; P.subs.style.strokeColor = k.stroke; }
  P.brandKit = k.id;
  if (k.logo && app.engine.media.has(k.logo) && !P.layers.some((l) => l.kind === 'media' && l.mediaId === k.logo)) {
    if (confirm('Logo videonun köşesine eklensin mi?')) {
      P.layers.push({ id: uid(), kind: 'media', mediaId: k.logo, start: 0, end: Math.max(1, app.engine.duration()), in: 0, out: 1, x: 0.86, y: 0.07, w: 0.18, rot: 0, sc: 1, opacity: 0.9, crop: 'none', radius: 0, borderW: 0, borderColor: '#fff', shadowOn: false, volume: 0, filters: {}, anim: anim('fade', 'fade') });
    }
  }
  app.commit();
  toast(`“${k.name}” uygulandı`);
}

// ================= KAPAK EDİTÖRÜ =================
// ================= KAPAK (v1.7: hazır şablonlar, fotoğraftan kapak, videonun ilk karesine ekleme) =================
const CT = (id, name, title, o = {}) => ({ id, name, title, ...o });
// başlık stilleri TEXT_BASE üzerine eklenir; grad: alttan renk geçişi, badge: köşe rozeti, frame: kenarlık, glow: vurgu çemberi
export const COVER_TEMPLATES = [
  CT('cv_bold', 'Kalın başlık', { text: 'BUNU *KİMSE* BİLMİYOR', font: 'Bricolage Grotesque', weight: 800, size: 150, color: '#FFFFFF', accent: '#FDE047', strokeW: 14, strokeColor: '#000000', y: 0.72 }, { darken: 0.15, grad: '#000000' }),
  CT('cv_ai', 'Yapay zekâ', { text: 'YAPAY ZEKÂ\n*BUNU YAPTI*', font: 'Bricolage Grotesque', weight: 800, size: 140, color: '#FFFFFF', accent: '#B9ACF7', strokeW: 0, shadowOn: true, y: 0.7 }, { darken: 0.25, grad: '#16112B', badge: { text: '✨ AI', bg: '#9D8CF2', fg: '#16112B' } }),
  CT('cv_part', 'Bölüm / seri', { text: 'İSTANBUL\n*GÜNLÜĞÜ*', font: 'Bricolage Grotesque', weight: 800, size: 140, color: '#FFFFFF', accent: '#E9C7A1', strokeW: 0, shadowOn: true, y: 0.74 }, { darken: 0.2, grad: '#000000', badge: { text: 'BÖLÜM 1', bg: '#FFFFFF', fg: '#111111' } }),
  CT('cv_question', 'Soru sorar', { text: 'BU *DOĞRU* MU?', font: 'Bricolage Grotesque', weight: 800, size: 160, color: '#FFFFFF', accent: '#EF4444', strokeW: 14, strokeColor: '#000000', y: 0.2 }, { darken: 0.1, glow: { x: 0.62, y: 0.52, r: 0.2, color: '#EF4444' } }),
  CT('cv_recipe', 'Tarif', { text: '10 DAKİKADA\n*MENEMEN*', font: 'Bricolage Grotesque', weight: 800, size: 130, color: '#2B1E17', accent: '#C2603D', strokeW: 0, bgOn: true, bgColor: '#EFE4D6', bgOpacity: 0.95, bgRadius: 26, bgPad: 30, y: 0.78 }, { darken: 0 }),
  CT('cv_minimal', 'Sade serif', { text: 'Sessiz bir sabah', font: 'Source Serif 4', weight: 600, italic: true, size: 120, color: '#FFFFFF', accent: '#FFFFFF', strokeW: 0, shadowOn: true, y: 0.5 }, { darken: 0.35 }),
  CT('cv_news', 'Son dakika', { text: 'SON DAKİKA\n*BÜYÜK GELİŞME*', font: 'Bricolage Grotesque', weight: 800, size: 120, color: '#FFFFFF', accent: '#FFFFFF', strokeW: 0, bgOn: true, bgColor: '#DC2626', bgOpacity: 1, bgRadius: 8, bgPad: 26, y: 0.8 }, { darken: 0.1, frame: '#DC2626' }),
  CT('cv_vs', 'Karşılaştırma', { text: 'A *VS* B', font: 'Bricolage Grotesque', weight: 800, size: 200, color: '#FFFFFF', accent: '#FACC15', strokeW: 16, strokeColor: '#000000', y: 0.5 }, { darken: 0.3, split: true }),
  CT('cv_money', 'Para / iş', { text: '₺0 → *₺100.000*', font: 'Bricolage Grotesque', weight: 800, size: 130, color: '#FFFFFF', accent: '#22C55E', strokeW: 12, strokeColor: '#000000', y: 0.22 }, { darken: 0.15, grad: '#052E16' }),
  CT('cv_travel', 'Seyahat', { text: 'KAPADOKYA', font: 'Bricolage Grotesque', weight: 800, size: 190, spacing: 10, color: '#FFFFFF', accent: '#FFFFFF', strokeW: 0, shadowOn: true, y: 0.42 }, { darken: 0.2, badge: { text: '📍 Türkiye', bg: 'rgba(255,255,255,.9)', fg: '#111' } }),
  CT('cv_top5', 'İlk 5', { text: 'EN İYİ\n*5 UYGULAMA*', font: 'Bricolage Grotesque', weight: 800, size: 140, color: '#FFFFFF', accent: '#FDE047', strokeW: 12, strokeColor: '#000000', y: 0.24 }, { darken: 0.15, badge: { text: 'TOP 5', bg: '#FDE047', fg: '#111' } }),
  CT('cv_latte', 'Latte saha', { text: 'MAÇIN\n*KIRILMA ANI*', font: 'Bricolage Grotesque', weight: 800, size: 140, color: '#EFE4D6', accent: '#C2603D', strokeW: 0, shadowOn: true, y: 0.74 }, { darken: 0.15, grad: '#2B1E17', frame: '#8B5E3C' }),
  CT('cv_neon', 'Neon', { text: 'GECE *MODU*', font: 'Bricolage Grotesque', weight: 800, size: 160, color: '#FFFFFF', accent: '#22D3EE', strokeW: 0, glowOn: true, y: 0.5 }, { darken: 0.45, frame: '#22D3EE' }),
  CT('cv_wedding', 'Düğün / nişan', { text: 'Ayşe & Mert', font: 'Source Serif 4', weight: 600, italic: true, size: 130, color: '#FFFFFF', accent: '#FFFFFF', strokeW: 0, shadowOn: true, y: 0.78 }, { darken: 0.2, grad: '#3B2A20', badge: { text: '12.10.2026', bg: 'rgba(255,255,255,.88)', fg: '#3B2A20' } }),
  CT('cv_code', 'Kod / teknoloji', { text: 'BUNU\n*KODLADIM*', font: 'Roboto Mono', weight: 700, size: 120, color: '#E9E6EF', accent: '#A5E3B5', strokeW: 0, bgOn: true, bgColor: '#15141B', bgOpacity: 0.92, bgRadius: 20, bgPad: 30, y: 0.72 }, { darken: 0.2, badge: { text: '</>', bg: '#9D8CF2', fg: '#16112B' } }),
  CT('cv_reaction', 'Tepki', { text: '😱 İNANILMAZ', font: 'Bricolage Grotesque', weight: 800, size: 140, color: '#FFFFFF', accent: '#FFFFFF', strokeW: 14, strokeColor: '#000000', y: 0.82 }, { darken: 0.05, glow: { x: 0.5, y: 0.42, r: 0.26, color: '#FDE047' } }),
];

function coverDefaults(P) {
  return { t: app.engine.t, ratio: P.ratio, darken: 0.25, src: 'frame', img: null, inVideo: false, grad: null, badge: null, frame: null, glow: null, split: false, title: { ...clone(TEXT_BASE), ...clone(TEXT_TEMPLATES[0].p), y: 0.5 } };
}

// kapak tuvalini çiz (full=true: tam çözünürlük)
export async function renderCover(cv, full = false) {
  const P = app.P, C = P.cover;
  const E = app.engine;
  const [W, H] = RATIOS[C.ratio];
  const k = full ? 1 : 300 / W;
  cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  const img = C.src === 'photo' && C.img ? E.imgForMedia(C.img) : null;
  if (img) {
    if (!img.complete) await new Promise((r) => { img.onload = r; img.onerror = r; setTimeout(r, 3000); });
    const s = Math.max(cv.width / img.naturalWidth, cv.height / img.naturalHeight);
    ctx.drawImage(img, (cv.width - img.naturalWidth * s) / 2, (cv.height - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  } else if (P.clips.length || P.layers.length) {
    const old = E.scale, oldT = E.t;
    E._noSel = true; E.resize(full ? 1 : 0.5);
    E.seek(C.t);
    await new Promise((r) => setTimeout(r, 300));
    E.draw(C.t);
    const src = E.canvas;
    const sr = src.width / src.height, dr = cv.width / cv.height;
    let sw = src.width, sh = src.height;
    if (sr > dr) sw = sh * dr; else sh = sw / dr;
    ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
    E._noSel = false; E.resize(old); E.seek(oldT); app.fitStage();
  }
  if (C.split) { ctx.fillStyle = 'rgba(239,68,68,.35)'; ctx.fillRect(0, 0, cv.width / 2, cv.height); ctx.fillStyle = 'rgba(37,99,235,.35)'; ctx.fillRect(cv.width / 2, 0, cv.width / 2, cv.height); }
  ctx.fillStyle = `rgba(0,0,0,${C.darken})`; ctx.fillRect(0, 0, cv.width, cv.height);
  if (C.grad) {
    const g = ctx.createLinearGradient(0, cv.height * 0.35, 0, cv.height);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, C.grad);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  ctx.save(); ctx.scale(k, k);
  if (C.glow) {
    ctx.strokeStyle = C.glow.color; ctx.lineWidth = 18; ctx.shadowColor = C.glow.color; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(C.glow.x * W, C.glow.y * H, C.glow.r * W, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
  }
  if (C.frame) { ctx.strokeStyle = C.frame; ctx.lineWidth = 28; ctx.strokeRect(14, 14, W - 28, H - 28); }
  if (C.badge?.text) {
    ctx.font = '800 54px "Bricolage Grotesque", sans-serif';
    const bw = ctx.measureText(C.badge.text).width + 60;
    ctx.fillStyle = C.badge.bg || '#fff';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(60, 90, bw, 96, 48) : ctx.rect(60, 90, bw, 96); ctx.fill();
    ctx.fillStyle = C.badge.fg || '#111'; ctx.textBaseline = 'middle'; ctx.fillText(C.badge.text, 90, 140); ctx.textBaseline = 'alphabetic';
  }
  ctx.translate(C.title.x * W, C.title.y * H);
  drawText(ctx, C.title, { alpha: 1, reveal: 1, glow: 0, sc: 1 }, { W, H, S: k });
  ctx.restore();
  return cv;
}

// proje kartındaki küçük kapak
async function updateCoverThumb() {
  try { const c = document.createElement('canvas'); await renderCover(c, false); app.P.coverThumb = c.toDataURL('image/jpeg', 0.86); app.renderTimeline?.(); } catch (_) { /* yoksay */ }
}

export function openCover(tab) {
  const P = app.P;
  if (!P.cover) P.cover = coverDefaults(P);
  const C = P.cover;
  let chain = Promise.resolve();
  const render = (cv, full = false) => (chain = chain.then(() => renderCover(cv, full)).then(() => { if (!full) updateCoverThumb(); }).catch(() => {}));
  openSheet({
    id: 'cover', title: 'Kapak', tall: true, tabs: ['Şablonlar', 'Kapak', 'Yazı'], tab: tab || 'Şablonlar',
    render: (body, tb) => {
      const cv = h('canvas', { class: 'cover-cv' });
      body.append(cv);
      if (tb === 'Şablonlar') {
        body.append(h('p', { class: 'hint' }, 'Bir şablona dokun; yazıyı ve renkleri sonra değiştirebilirsin.'));
        const g = h('div', { class: 'cover-grid' });
        COVER_TEMPLATES.forEach((tp) => {
          g.append(h('button', { class: `cover-tpl${C.tpl === tp.id ? ' on' : ''}`, onclick: () => {
            C.tpl = tp.id;
            C.title = { ...clone(TEXT_BASE), ...clone(tp.title), x: 0.5 };
            ['darken', 'grad', 'badge', 'frame', 'glow', 'split'].forEach((key) => { C[key] = key in tp ? clone(tp[key]) : (key === 'darken' ? 0.2 : key === 'split' ? false : null); });
            app.change(true); refreshSheet();
          } }, h('span', { class: 'ct-prev', style: { background: tp.grad ? `linear-gradient(transparent, ${tp.grad})` : '#2A2833' } }, h('i', { style: { color: tp.title.color, fontFamily: `"${tp.title.font}"`, fontStyle: tp.title.italic ? 'italic' : 'normal' } }, (tp.title.text || '').replace(/\*/g, '').split('\n')[0].slice(0, 12))), h('b', {}, tp.name)));
        });
        body.append(g);
      } else if (tb === 'Kapak') {
        body.append(fields(C, [
          { label: 'Arka plan', path: 'src', type: 'chips', options: [['frame', 'Videodan kare'], ['photo', 'Fotoğraf']], post: () => refreshSheet() },
          { label: 'Oran', path: 'ratio', type: 'chips', options: Object.keys(RATIOS).map((r) => [r, r]), post: () => render(cv) },
          { label: 'Karartma', path: 'darken', type: 'range', min: 0, max: 0.8, fmt: pct, post: () => render(cv) },
          { label: 'Videonun ilk karesine ekle', path: 'inVideo', type: 'toggle' },
        ]));
        if (C.src === 'photo') {
          body.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn', html: `${I.media} Fotoğraf seç`, onclick: async () => {
            const files = await app.pickFiles('image/*', false);
            if (!files.length) return;
            const recs = await app.importFiles(files);
            if (recs[0]) { C.img = recs[0].id; app.change(true); refreshSheet(); }
          } }, C.img ? 'Fotoğrafı değiştir' : 'Fotoğraf seç')));
        } else {
          body.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => { C.t = app.engine.t; render(cv); app.change(true); } }, 'Oynatıcıdaki kareyi kullan')));
          body.append(h('p', { class: 'hint' }, `Kare: ${fmt(C.t)}. Zaman çizelgesini kaydırıp istediğin kareye gel, sonra dokun.`));
        }
        body.append(h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', html: `${I.export} Kapağı PNG kaydet`, onclick: async () => {
            const b = busy('Kapak hazırlanıyor…');
            try {
              const big = document.createElement('canvas');
              await render(big, true);
              const blob = await new Promise((r) => big.toBlob(r, 'image/png'));
              const r = await saveVideo(blob, `Alpicut_kapak_${C.ratio.replace(':', 'x')}.png`, { share: true });
              toast(r.where ? `${r.where} klasörüne kaydedildi` : 'Kapak kaydedildi');
            } finally { b.close(); }
          } }),
          h('button', { class: 'btn danger', onclick: () => { delete P.cover; delete P.coverThumb; app.change(true); closeSheet(); app.renderTimeline?.(); toast('Kapak kaldırıldı'); } }, 'Kaldır')));
      } else {
        const tc = h('div', { class: 'chips scroll' });
        TEXT_TEMPLATES.slice(0, 40).forEach((tp) => tc.append(h('button', { onclick: () => { const keepText = C.title.text; C.title = { ...clone(TEXT_BASE), ...clone(tp.p), text: keepText, y: C.title.y, x: 0.5 }; app.change(true); refreshSheet(); } }, tp.name)));
        body.append(h('div', { class: 'field full' }, h('label', {}, 'Yazı stili'), tc));
        body.append(fields(C.title, [
          { label: 'Başlık (*kelime* = vurgu)', path: 'text', type: 'textarea', post: () => render(cv) },
          { label: 'Boyut', path: 'size', type: 'range', min: 40, max: 300, step: 1, post: () => render(cv) },
          { label: 'Dikey konum', path: 'y', type: 'range', min: 0.05, max: 0.95, fmt: pct, post: () => render(cv) },
          { label: 'Renk', path: 'color', type: 'color', post: () => render(cv) },
          { label: 'Vurgu rengi', path: 'accent', type: 'color', post: () => render(cv) },
        ]));
      }
      render(cv);
    },
  });
}

// ================= SÜRÜMLER / YEDEK / YENİDEN BAĞLAMA =================
export async function openVersions(projectId, onRestore) {
  const rec = await store.getProject(projectId);
  const vs = rec?.versions || [];
  openSheet({
    title: 'Proje sürümleri',
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Alpicut, düzenlerken birkaç dakikada bir otomatik sürüm saklar (son 15). Geri yüklemek mevcut hali de yeni bir sürüm olarak korur.' }));
      if (!vs.length) { body.append(h('p', { class: 'hint' }, 'Henüz kayıtlı sürüm yok.')); return; }
      [...vs].reverse().forEach((v) => {
        const d = new Date(v.at);
        body.append(h('div', { class: 'kit-row' },
          h('b', {}, `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`),
          h('span', { class: 'muted' }, v.note || ''),
          h('button', { class: 'btn', onclick: async () => {
            if (!confirm('Bu sürüm geri yüklensin mi?')) return;
            rec.versions = [...(rec.versions || []), { at: Date.now(), json: JSON.stringify(rec.data), note: 'geri yükleme öncesi' }].slice(-15);
            rec.data = JSON.parse(v.json); rec.data.id = rec.id; rec.updated = Date.now();
            await store.putProject(rec);
            closeSheet();
            onRestore && onRestore(rec.id);
            toast('Sürüm geri yüklendi');
          } }, 'Geri yükle')));
      });
    },
  });
}

// .alpicut yedek paketi: "ALPICUT1" + 4 bayt başlık uzunluğu + JSON başlık + medya dosyaları art arda
export async function exportPackage(projectId) {
  const rec = await store.getProject(projectId);
  if (!rec) return;
  const P = rec.data;
  const ids = new Set();
  P.clips.forEach((c) => ids.add(c.mediaId)); P.layers.forEach((l) => l.mediaId && ids.add(l.mediaId)); P.audio.forEach((a) => ids.add(a.mediaId));
  const media = [];
  const blobs = [];
  for (const id of ids) {
    const m = await store.getMedia(id);
    if (!m) continue;
    media.push({ id: m.id, kind: m.kind, name: m.name, duration: m.duration, w: m.w, h: m.h, thumb: m.thumb, size: m.blob.size, type: m.blob.type });
    blobs.push(m.blob);
  }
  const head = new TextEncoder().encode(JSON.stringify({ v: 1, project: rec, media }));
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, head.length);
  const pkg = new Blob([new TextEncoder().encode('ALPICUT1'), len, head, ...blobs], { type: 'application/octet-stream' });
  const b = busy('Yedek dosyası yazılıyor…');
  try {
    const r = await saveVideo(pkg, `${(rec.name || 'proje').replace(/[^\wğüşıöçĞÜŞİÖÇ-]+/g, '_')}.alpicut`, { share: true, onProgress: (p) => b.set(`Yedek dosyası yazılıyor… %${Math.round(p * 100)}`) });
    toast(r.where ? `${r.where} klasörüne kaydedildi (${(pkg.size / 1048576).toFixed(1)} MB)` : 'Yedek kaydedildi', 3500);
  } finally { b.close(); }
}

export async function importPackage(file) {
  const magic = new TextDecoder().decode(await file.slice(0, 8).arrayBuffer());
  if (magic !== 'ALPICUT1') throw new Error('Bu bir Alpicut yedek dosyası değil');
  const n = new DataView(await file.slice(8, 12).arrayBuffer()).getUint32(0);
  const head = JSON.parse(new TextDecoder().decode(await file.slice(12, 12 + n).arrayBuffer()));
  let off = 12 + n;
  for (const m of head.media) {
    const blob = file.slice(off, off + m.size, m.type);
    off += m.size;
    const exists = await store.getMedia(m.id).catch(() => null);
    if (!exists) await store.putMedia({ ...m, blob: new Blob([await blob.arrayBuffer()], { type: m.type }) });
  }
  const rec = head.project;
  const all = await store.allProjects();
  if (all.some((p) => p.id === rec.id)) { rec.id = uid(); rec.data.id = rec.id; rec.name = `${rec.name} (yedekten)`; rec.data.name = rec.name; }
  rec.updated = Date.now();
  await store.putProject(rec);
  return rec;
}

export function openRelink(missing, onDone) {
  openSheet({
    title: 'Eksik medya',
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Bu projede kullanılan bazı dosyalar cihazda bulunamadı. Aynı dosyayı yeniden seçerek bağlayabilirsin; kurgu aynen korunur.' }));
      missing.forEach((m) => {
        body.append(h('div', { class: 'kit-row' }, h('b', {}, m.name || m.id), h('span', { class: 'muted' }, m.done ? '✅ bağlandı' : 'bulunamadı'),
          m.done ? null : h('button', { class: 'btn', onclick: async () => {
            const files = await app.pickFiles('', false);
            if (!files.length) return;
            await app.relinkMedia(m.id, files[0]);
            m.done = true; refreshSheet();
            if (missing.every((x) => x.done)) { closeSheet(); onDone && onDone(); toast('Tüm medya bağlandı'); }
          } }, 'Dosya seç')));
      });
    },
  });
}

void itemLen;
