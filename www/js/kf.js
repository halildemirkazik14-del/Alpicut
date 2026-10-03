// Alpicut — keyframe sistemi
// Her iz: [{t (katman/klip başına göre sn), v, ease}] — ease bir sonraki keyframe'e kadar geçerlidir

export const EASES = [
  ['auto', 'Otomatik yumuşak'], ['inout', 'Yumuşak'], ['linear', 'Doğrusal'], ['in', 'Hızlanarak'], ['out', 'Yavaşlayarak'],
  ['sine', 'Sinüs'], ['expo', 'Sert hızlan-yavaşla'], ['back', 'Geri esneme'], ['elastic', 'Elastik'], ['bounce', 'Zıplama'], ['bez', 'Özel eğri'], ['hold', 'Sabit (atla)'],
];

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

// cubic-bezier(x1,y1,x2,y2) zamanlama eğrisi (CSS ile aynı)
function bezier(x1, y1, x2, y2, x) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 8; i++) { const xt = ((ax * t + bx) * t + cx) * t - x; const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(xt) < 1e-5 || Math.abs(d) < 1e-6) break; t -= xt / d; }
  t = Math.max(0, Math.min(1, t));
  return ((ay * t + by) * t + cy) * t;
}
export function easeFn(e, p, k) {
  switch (e) {
    case 'in': return p * p * p;
    case 'out': return 1 - Math.pow(1 - p, 3);
    case 'inout': return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    case 'sine': return -(Math.cos(Math.PI * p) - 1) / 2;
    case 'expo': return p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2;
    case 'back': { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
    case 'elastic': return p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    case 'bounce': { const n = 7.5625, d = 2.75; let x = p; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; }
    case 'bez': { const b = (k && k.bz) || [0.25, 0.1, 0.25, 1]; return bezier(b[0], b[1], b[2], b[3], p); }
    case 'hold': return 0;
    case 'linear': return p;
    default: return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }
}
const ease = (e, p, k) => easeFn(e, p, k);

// "Otomatik yumuşak": komşu keyframe'lere göre eğim (monoton kübik Hermite — taşma yapmaz)
function autoTangent(keys, i) {
  const a = keys[i - 1], b = keys[i], c = keys[i + 1];
  if (!a || !c) return 0;
  const d0 = (b.v - a.v) / Math.max(1e-6, b.t - a.t), d1 = (c.v - b.v) / Math.max(1e-6, c.t - b.t);
  if (d0 * d1 <= 0) return 0;
  return (2 * d0 * d1) / (d0 + d1);
}

export function evalTrack(keys, lt) {
  if (!keys || !keys.length) return undefined;
  if (lt <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (lt >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (lt >= a.t && lt <= b.t) {
      const dt = Math.max(1e-6, b.t - a.t);
      const p = (lt - a.t) / dt;
      if ((a.ease || 'inout') === 'auto') {
        const m0 = autoTangent(keys, i) * dt, m1 = autoTangent(keys, i + 1) * dt;
        const p2 = p * p, p3 = p2 * p;
        return (2 * p3 - 3 * p2 + 1) * a.v + (p3 - 2 * p2 + p) * m0 + (-2 * p3 + 3 * p2) * b.v + (p3 - p2) * m1;
      }
      return a.v + (b.v - a.v) * ease(a.ease || 'inout', p, a);
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
