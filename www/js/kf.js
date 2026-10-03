// Alpicut — keyframe sistemi
// Her iz: [{t (katman/klip başına göre sn), v, ease}] — ease bir sonraki keyframe'e kadar geçerlidir

export const EASES = [['linear', 'Doğrusal'], ['inout', 'Yumuşak'], ['in', 'Hızlanarak'], ['out', 'Yavaşlayarak'], ['hold', 'Sabit (atla)']];

export const LAYER_PROPS = [
  ['x', 'Yatay', 0, 1, 0.005],
  ['y', 'Dikey', 0, 1, 0.005],
  ['s', 'Ölçek', 0.05, 4, 0.01],
  ['rot', 'Dönüş', -360, 360, 1],
  ['opacity', 'Saydamlık', 0, 1, 0.01],
];

export const CLIP_PROPS = [
  ['zoom', 'Yakınlaştırma', 0.5, 3, 0.01],
  ['panX', 'Yatay kaydır', -1, 1, 0.01],
  ['panY', 'Dikey kaydır', -1, 1, 0.01],
];

const ease = (e, p) => {
  switch (e) {
    case 'in': return p * p * p;
    case 'out': return 1 - Math.pow(1 - p, 3);
    case 'inout': return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case 'hold': return 0;
    default: return p;
  }
};

export function evalTrack(keys, lt) {
  if (!keys || !keys.length) return undefined;
  if (lt <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (lt >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (lt >= a.t && lt <= b.t) {
      const p = (lt - a.t) / Math.max(1e-6, b.t - a.t);
      return a.v + (b.v - a.v) * ease(a.ease || 'inout', p);
    }
  }
  return last.v;
}

const BASE = { x: (o) => o.x, y: (o) => o.y, s: (o) => o.sc ?? 1, rot: (o) => o.rot || 0, opacity: (o) => o.opacity ?? 1, zoom: (o) => o.zoom ?? 1, panX: (o) => o.panX || 0, panY: (o) => o.panY || 0 };
const BASE_KEY = { s: 'sc' };

export function hasKeys(o, p) { return !!(o.kf && o.kf[p] && o.kf[p].length); }

export function propAt(o, p, lt) {
  if (hasKeys(o, p)) return evalTrack(o.kf[p], lt);
  return BASE[p] ? BASE[p](o) : o[p];
}

export function layerAt(L, t) {
  const lt = t - L.start;
  return { x: propAt(L, 'x', lt), y: propAt(L, 'y', lt), s: propAt(L, 's', lt), rot: propAt(L, 'rot', lt), opacity: propAt(L, 'opacity', lt) };
}

export function clipAt(c, lt) {
  return { zoom: propAt(c, 'zoom', lt), panX: propAt(c, 'panX', lt), panY: propAt(c, 'panY', lt) };
}

const EPS = 1 / 60;

export function keyAt(o, p, lt) {
  return (o.kf?.[p] || []).find((k) => Math.abs(k.t - lt) < EPS) || null;
}

export function setKey(o, p, lt, v, easeName) {
  if (!o.kf) o.kf = {};
  if (!o.kf[p]) o.kf[p] = [];
  const k = keyAt(o, p, lt);
  if (k) { k.v = v; if (easeName) k.ease = easeName; }
  else { o.kf[p].push({ t: Math.max(0, lt), v, ease: easeName || 'inout' }); o.kf[p].sort((a, b) => a.t - b.t); }
}

export function delKey(o, p, lt) {
  if (!o.kf?.[p]) return;
  const k = keyAt(o, p, lt);
  if (!k) return;
  o.kf[p].splice(o.kf[p].indexOf(k), 1);
  if (!o.kf[p].length) {
    // son keyframe silinince değer sabit kalsın
    const bk = BASE_KEY[p] || p;
    o[bk] = k.v;
    delete o.kf[p];
  }
}

// Değer değişince: iz varsa keyframe yaz, yoksa temel değeri değiştir
export function writeProp(o, p, lt, v) {
  if (hasKeys(o, p)) setKey(o, p, lt, v);
  else o[BASE_KEY[p] || p] = v;
}

export function allKeyTimes(o) {
  const s = new Set();
  Object.values(o.kf || {}).forEach((arr) => arr.forEach((k) => s.add(Math.round(k.t * 1000) / 1000)));
  return [...s].sort((a, b) => a - b);
}

// Klip/katman bölününce keyframe'leri ikiye ayır
export function splitKeys(a, b, cut, propsList) {
  if (!a.kf) return;
  const ak = {}, bk = {};
  for (const [p, arr] of Object.entries(a.kf)) {
    const vCut = evalTrack(arr, cut);
    const left = arr.filter((k) => k.t < cut - EPS);
    const right = arr.filter((k) => k.t > cut + EPS).map((k) => ({ ...k, t: k.t - cut }));
    if (left.length) ak[p] = [...left, { t: cut, v: vCut, ease: 'inout' }];
    if (right.length) bk[p] = [{ t: 0, v: vCut, ease: 'inout' }, ...right];
    if (!left.length) a[BASE_KEY[p] || p] = vCut;
    if (!right.length) b[BASE_KEY[p] || p] = vCut;
  }
  a.kf = ak; b.kf = bk;
  void propsList;
}

// Klip/katman süresi değişince keyframe'leri orantılı yeniden zamanla
export function rescaleKeys(o, oldLen, newLen) {
  if (!o.kf || oldLen <= 0 || newLen <= 0) return;
  const k = newLen / oldLen;
  Object.values(o.kf).forEach((arr) => arr.forEach((x) => { x.t *= k; }));
}
