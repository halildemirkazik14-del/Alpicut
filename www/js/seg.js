// Alpicut — yapay zekâ ile arka plan silme ve yüz algılama (MediaPipe Tasks Vision, cihaz üzerinde)
let visionP = null, segmenter = null, faceDet = null, loading = null;

async function vision() {
  if (!visionP) visionP = import('../vendor/mediapipe/vision.js');
  return visionP;
}

async function fileset(V) {
  return V.FilesetResolver.forVisionTasks(new URL('../vendor/mediapipe/wasm', import.meta.url).href);
}

export function segReady() { return !!segmenter; }

// v1.7: üç model — kişi (hızlı), kişi HQ (saç/kıyafet ayrımlı çok sınıflı), nesne (dokunarak seçilen; magic touch)
let hqSeg = null, objSeg = null;
const loads = {};
function loadModel(kind) {
  if (loads[kind]) return loads[kind];
  loads[kind] = (async () => {
    const V = await vision();
    const fs = await fileset(V);
    const file = { person: 'selfie_segmenter.tflite', hq: 'selfie_multiclass_256x256.tflite', object: 'magic_touch.tflite' }[kind];
    const base = { baseOptions: { modelAssetPath: new URL(`../models/${file}`, import.meta.url).href, delegate: 'CPU' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false };
    if (kind === 'object') objSeg = await V.InteractiveSegmenter.createFromOptions(fs, base);
    else if (kind === 'hq') hqSeg = await V.ImageSegmenter.createFromOptions(fs, base);
    else segmenter = await V.ImageSegmenter.createFromOptions(fs, base);
    return true;
  })();
  loads[kind].catch(() => { delete loads[kind]; });
  return loads[kind];
}

export function initSegmenter(kind = 'person') {
  return loadModel(kind === 'hq' || kind === 'object' ? kind : 'person').catch((e) => { console.warn('segmenter', e); throw new Error('Arka plan silme modeli yüklenemedi'); });
}

const cache = new WeakMap(); // kaynak eleman -> durum (önceki maske, takip kutusu, nesne noktası)
const SZ = 256;
const WMAX = 448; // iyileştirme çözünürlüğü (uzun kenar) — dışa aktarma; önizlemede 320
let small = null, guideC = null;

// ---------- v1.8 maske iyileştirme yardımcıları (saf fonksiyonlar, test edilebilir) ----------
// kutu bulanıklığı: kayan toplamla, kenarlarda gerçek piksel sayısına böler
export function boxBlur(src, w, h, r, out = new Float32Array(w * h), tmp = new Float32Array(w * h)) {
  for (let y = 0; y < h; y++) {
    const o = y * w; let sum = 0;
    for (let x = 0; x < Math.min(r, w); x++) sum += src[o + x];
    for (let x = 0; x < w; x++) {
      const a = x + r, b = x - r - 1;
      if (a < w) sum += src[o + a];
      if (b >= 0) sum -= src[o + b];
      tmp[o + x] = sum / (Math.min(w - 1, x + r) - Math.max(0, x - r) + 1);
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < Math.min(r, h); y++) sum += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const a = y + r, b = y - r - 1;
      if (a < h) sum += tmp[a * w + x];
      if (b >= 0) sum -= tmp[b * w + x];
      out[y * w + x] = sum / (Math.min(h - 1, y + r) - Math.max(0, y - r) + 1);
    }
  }
  return out;
}
// kılavuzlu filtre (He vd.): maskeyi görüntünün gerçek kenarlarına (saç, omuz) oturtur. Tamponlar yeniden kullanılır.
const GP = { n: 0 };
function gbuf(n) {
  if (GP.n !== n) { GP.n = n; ['tmp', 'II', 'Ip', 'mI', 'mp', 'mII', 'mIp', 'A', 'B', 'mA', 'mB'].forEach((k) => { GP[k] = new Float32Array(n); }); }
  return GP;
}
export function guidedFilter(I, p, w, h, r, eps, out) {
  const n = w * h, G = gbuf(n);
  const { tmp, II, Ip, A, B } = G;
  for (let i = 0; i < n; i++) { const v = I[i]; II[i] = v * v; Ip[i] = v * p[i]; }
  const mI = boxBlur(I, w, h, r, G.mI, tmp), mp = boxBlur(p, w, h, r, G.mp, tmp);
  const mII = boxBlur(II, w, h, r, G.mII, tmp), mIp = boxBlur(Ip, w, h, r, G.mIp, tmp);
  for (let i = 0; i < n; i++) { const m = mI[i], v = mII[i] - m * m, c = mIp[i] - m * mp[i], a = c / (v + eps); A[i] = a; B[i] = mp[i] - a * m; }
  const mA = boxBlur(A, w, h, r, G.mA, tmp), mB = boxBlur(B, w, h, r, G.mB, tmp);
  const q = out && out.length === n ? out : new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = mA[i] * I[i] + mB[i]; q[i] = v < 0 ? 0 : v > 1 ? 1 : v; }
  return q;
}
// hareket uyarlamalı zamansal yumuşatma: küçük oynamalar (titreme) bastırılır, gerçek hareket gecikmeden geçer
export function temporalBlend(f, prev, strength) {
  if (!prev || prev.length !== f.length || strength <= 0) return f;
  const out = new Float32Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const d = Math.abs(f[i] - prev[i]);
    const motion = d <= 0.08 ? 0 : d >= 0.4 ? 1 : (d - 0.08) / 0.32;
    const k = strength * (1 - motion);
    out[i] = f[i] * (1 - k) + prev[i] * k;
  }
  return out;
}
// model maskesini (ROI kare uzayında) çalışma çözünürlüğüne çift doğrusal örnekleme ile taşır
export function resampleMask(f, mw, mh, roi, sw, sh, ww, wh) {
  const out = new Float32Array(ww * wh);
  for (let y = 0; y < wh; y++) {
    const sy = ((y + 0.5) / wh) * sh;
    const v = ((sy - roi.y) / roi.s) * mh - 0.5;
    if (v < -0.5 || v > mh - 0.5) continue;
    const y0 = Math.max(0, Math.min(mh - 1, Math.floor(v))), y1 = Math.min(mh - 1, y0 + 1), fy = Math.max(0, Math.min(1, v - y0));
    for (let x = 0; x < ww; x++) {
      const sx = ((x + 0.5) / ww) * sw;
      const u = ((sx - roi.x) / roi.s) * mw - 0.5;
      if (u < -0.5 || u > mw - 0.5) continue;
      const x0 = Math.max(0, Math.min(mw - 1, Math.floor(u))), x1 = Math.min(mw - 1, x0 + 1), fx = Math.max(0, Math.min(1, u - x0));
      const a = f[y0 * mw + x0] * (1 - fx) + f[y0 * mw + x1] * fx, b = f[y1 * mw + x0] * (1 - fx) + f[y1 * mw + x1] * fx;
      out[y * ww + x] = a * (1 - fy) + b * fy;
    }
  }
  return out;
}
// bir sonraki kare için ilgi bölgesi: kişinin kutusu + pay; kişi büyükse ya da yoksa tüm kare
export function nextRoi(bbox, sw, sh, frame, prevRoi) {
  const full = { x: (sw - Math.max(sw, sh)) / 2, y: (sh - Math.max(sw, sh)) / 2, s: Math.max(sw, sh) };
  if (!bbox || frame % 24 === 0) return full;
  // kişi önceki bölgenin kenarına dayandıysa (hızlı hareket) tüm kareye dön
  if (prevRoi && prevRoi.s < full.s) { const m = prevRoi.s * 0.03; if (bbox.x0 * sw < prevRoi.x + m || bbox.x1 * sw > prevRoi.x + prevRoi.s - m || bbox.y0 * sh < prevRoi.y + m || bbox.y1 * sh > prevRoi.y + prevRoi.s - m) return full; }
  const bw = (bbox.x1 - bbox.x0) * sw, bh = (bbox.y1 - bbox.y0) * sh;
  if (bw * bh < sw * sh * 0.004) return full;
  let s = Math.max(bw, bh) * 1.45 + Math.max(sw, sh) * 0.04;
  s = Math.max(s, Math.max(sw, sh) * 0.4);
  if (s >= Math.max(sw, sh) * 0.92) return full;
  const cx = ((bbox.x0 + bbox.x1) / 2) * sw, cy = ((bbox.y0 + bbox.y1) / 2) * sh;
  return { x: cx - s / 2, y: cy - s / 2, s };
}

// Maske (alfa kanalında) olan tuval döndürür. opt.target: person | object; opt.quality: fast | hq; opt.point: {x,y} 0..1
// v1.8: kişiyi takip eden ilgi bölgesi (daha yüksek çözünürlük), çift doğrusal büyütme, kılavuzlu filtreyle kenar
// oturtma ve hareket uyarlamalı titreme önleme — hareketli videoda bozulma ve kenar oynaması büyük ölçüde azalır.
export function personMask(el, sw, sh, opt = {}) {
  const tgt = opt.target === 'object' ? 'object' : 'person';
  // v1.10: oynatma sırasında (live) hızlı kişi modeli kullanılır — HQ model telefonda kare başına ~0,6 sn sürüyordu
  if (opt.live && tgt === 'person' && !segmenter) loadModel('person').catch(() => {});
  const model = tgt === 'object' ? objSeg : (opt.quality === 'hq' && hqSeg && !(opt.live && segmenter) ? hqSeg : (segmenter || hqSeg));
  if (!model) return null;
  const tk = opt._t != null ? opt._t.toFixed(3) : (el.currentTime ?? 0);
  const key = `${tk}|${sw}x${sh}|${opt.threshold}|${opt.edge}|${tgt}|${opt.quality}|${opt.point?.x},${opt.point?.y}|${opt.smooth}`;
  let c = cache.get(el);
  if (c && c.key === key) return c.canvas;
  // v1.10: oynatırken maske her karede hesaplanmaz; hesaplama süresine göre seyreltilir ve arada son maske
  // yeni kareye uygulanır. Böylece video akıcı oynar, maske kısa süre geriden gelir. Dışa aktarmada her kare hesaplanır.
  if (opt.live && c && c.at && c.canvas.width > 1) {
    const since = performance.now() - c.at;
    if (since < Math.min(450, Math.max(33, (c.cost || 0) * 2.2))) return c.canvas;
  }
  const t0 = performance.now();
  if (!c) { c = { canvas: document.createElement('canvas'), key: '', prev: null, pt: null, lastT: null, bbox: null, frame: 0 }; cache.set(el, c); }
  const tnum = +tk;
  const cont = c.lastT != null && Math.abs(tnum - c.lastT) < 0.25 && tnum >= c.lastT - 0.001;
  if (!cont) { c.prev = null; c.pt = null; c.bbox = null; c.frame = 0; }
  // çalışma çözünürlüğü (kaynağın en-boy oranında)
  const kw = Math.min(1, (opt._work || 320) / Math.max(sw, sh));
  const ww = Math.max(16, Math.round(sw * kw)), wh = Math.max(16, Math.round(sh * kw));
  // ilgi bölgesi: nesne modunda tüm kare, kişi modunda takip kutusu
  const roi = tgt === 'object' ? nextRoi(null, sw, sh, 0) : nextRoi(cont ? c.bbox : null, sw, sh, c.frame, cont ? c.roi : null);
  c.roi = roi;
  if (!small) { small = document.createElement('canvas'); small.width = SZ; small.height = SZ; }
  const sx = small.getContext('2d', { willReadFrequently: true });
  sx.fillStyle = '#000'; sx.fillRect(0, 0, SZ, SZ);
  const ix0 = Math.max(0, roi.x), iy0 = Math.max(0, roi.y), ix1 = Math.min(sw, roi.x + roi.s), iy1 = Math.min(sh, roi.y + roi.s);
  const ks = SZ / roi.s;
  try { sx.drawImage(el, ix0, iy0, ix1 - ix0, iy1 - iy0, (ix0 - roi.x) * ks, (iy0 - roi.y) * ks, (ix1 - ix0) * ks, (iy1 - iy0) * ks); } catch (e) { return null; }
  let res;
  const toRoi = (p) => ({ x: ((p.x * sw) - roi.x) / roi.s, y: ((p.y * sh) - roi.y) / roi.s });
  try {
    if (tgt === 'object') { const p0 = (cont && c.pt) || opt.point || { x: 0.5, y: 0.5 }; res = model.segment(small, { keypoint: toRoi(p0) }); }
    else res = model.segment(small);
  } catch (e) { console.warn(e); return null; }
  const masks = res?.confidenceMasks;
  if (!masks?.length) { res?.close?.(); return null; }
  const mw = masks[0].width, mh = masks[0].height;
  let f = masks[0].getAsFloat32Array();
  if (model === hqSeg) { const inv = new Float32Array(f.length); for (let i = 0; i < f.length; i++) inv[i] = 1 - f[i]; f = inv; } // 0. sınıf = arka plan
  else if (tgt === 'object' && masks.length > 1) {
    const p0 = toRoi((cont && c.pt) || opt.point || { x: 0.5, y: 0.5 });
    const ix = Math.min(mw - 1, Math.max(0, Math.floor(p0.x * mw))), iy = Math.min(mh - 1, Math.max(0, Math.floor(p0.y * mh)));
    if (f[iy * mw + ix] < 0.5) f = masks[1].getAsFloat32Array();
  }
  f = Float32Array.from(f);
  res.close?.();
  // 1) çalışma çözünürlüğüne yumuşak büyütme
  let p = resampleMask(f, mw, mh, roi, sw, sh, ww, wh);
  // 2) hareket uyarlamalı titreme önleme
  const strength = Math.min(0.88, Math.max(0, (opt.smooth ?? 0.35)) * 1.8);
  if (cont && c.prev && c.prev.length === p.length) p = temporalBlend(p, c.prev, strength);
  c.prev = p;
  // 3) kılavuzlu filtre: kılavuz = karenin parlaklığı
  if (!guideC) guideC = document.createElement('canvas');
  if (guideC.width !== ww || guideC.height !== wh) { guideC.width = ww; guideC.height = wh; }
  const gx = guideC.getContext('2d', { willReadFrequently: true });
  let q = p;
  // oynatırken hesap pahalıysa kenar iyileştirmeyi (kılavuzlu filtre + piksel okuma) atla
  if (!(opt.live && (c.cost || 0) > 60)) try {
    gx.drawImage(el, 0, 0, ww, wh);
    const gd = gx.getImageData(0, 0, ww, wh).data;
    const I = new Float32Array(ww * wh);
    for (let i = 0, j = 0; i < I.length; i++, j += 4) I[i] = (gd[j] * 0.299 + gd[j + 1] * 0.587 + gd[j + 2] * 0.114) / 255;
    const r = Math.max(2, Math.round(Math.max(ww, wh) / 110));
    q = guidedFilter(I, p, ww, wh, r, 0.0025);
  } catch (_) { /* çapraz köken vb.: filtresiz devam */ }
  // 4) eşik + yumuşak kenar → alfa; 5) takip kutusu ve nesne noktası
  const mc = c.canvas;
  if (mc.width !== ww || mc.height !== wh) { mc.width = ww; mc.height = wh; }
  const mx = mc.getContext('2d');
  const img = mx.createImageData(ww, wh);
  const th = opt.threshold ?? 0.5, soft = Math.max(0.02, (opt.edge ?? 0.15) * 0.8);
  let x0 = ww, y0 = wh, x1 = -1, y1 = -1, sxp = 0, syp = 0, sn = 0;
  for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
    const i = y * ww + x;
    let a = (q[i] - (th - soft)) / (2 * soft); a = a < 0 ? 0 : a > 1 ? 1 : a * a * (3 - 2 * a);
    const o = i * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = a * 255;
    if (a > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; sxp += x; syp += y; sn++; }
  }
  mx.putImageData(img, 0, 0);
  c.bbox = sn > 30 ? { x0: x0 / ww, y0: y0 / wh, x1: (x1 + 1) / ww, y1: (y1 + 1) / wh } : null;
  if (tgt === 'object' && sn > 20) c.pt = { x: sxp / sn / ww, y: syp / sn / wh };
  c.lastT = tnum; c.frame++; c.key = key;
  const dt = performance.now() - t0;
  c.cost = c.cost ? c.cost * 0.7 + dt * 0.3 : dt; c.at = performance.now();
  return mc;
}

// Kaynağı kişiye/nesneye göre kırp: arka planı saydam yapılmış tuval
const outCache = new WeakMap();
export function removeBackground(el, sw, sh, opt = {}, maxSide = 1280) {
  const m = personMask(el, sw, sh, { ...opt, _work: maxSide > 1280 ? WMAX : (opt.live ? 256 : 320) });
  if (!m) return null;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(2, Math.round(sw * k)), h = Math.max(2, Math.round(sh * k));
  let o = outCache.get(el);
  if (!o) { o = document.createElement('canvas'); outCache.set(el, o); }
  if (o.width !== w || o.height !== h) { o.width = w; o.height = h; }
  const x = o.getContext('2d');
  x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  x.clearRect(0, 0, w, h);
  x.drawImage(el, 0, 0, w, h);
  x.globalCompositeOperation = 'destination-in';
  x.imageSmoothingQuality = 'high';
  x.filter = opt.feather > 0 ? `blur(${opt.feather * k}px)` : 'none';
  x.drawImage(m, 0, 0, w, h);
  // kenar sarkmasını (halo) azalt: maskeyi bir kez daha sıkılaştır
  if (opt.choke) { x.filter = 'none'; x.drawImage(m, 0, 0, w, h); }
  x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  return o;
}

// ---------- yüz algılama (akıllı kadraj / takip) ----------
export async function initFaces() {
  if (faceDet) return true;
  const V = await vision();
  const fs = await fileset(V);
  faceDet = await V.FaceDetector.createFromOptions(fs, {
    baseOptions: { modelAssetPath: new URL('../models/blaze_face_short_range.tflite', import.meta.url).href, delegate: 'CPU' },
    runningMode: 'IMAGE', minDetectionConfidence: 0.45,
  });
  return true;
}

// Görüntüdeki yüzler: [{ x, y, w, h, score }] (0..1, görüntüye göre)
export function detectFaces(el, sw, sh) {
  if (!faceDet) return [];
  const c = document.createElement('canvas');
  const k = Math.min(1, 640 / Math.max(sw, sh));
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
  const r = faceDet.detect(c);
  return (r.detections || []).map((d) => ({
    x: (d.boundingBox.originX + d.boundingBox.width / 2) / c.width,
    y: (d.boundingBox.originY + d.boundingBox.height / 2) / c.height,
    w: d.boundingBox.width / c.width, h: d.boundingBox.height / c.height,
    score: d.categories?.[0]?.score ?? 0,
  }));
}
