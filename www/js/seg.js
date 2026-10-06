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

const cache = new WeakMap(); // kaynak eleman -> { key, canvas, prev (önceki maske, titreme önleme), pt (nesne takibi) }
const SZ = 256;
let small = null;

// Maske (alfa kanalında) olan tuval döndürür. opt.target: person | object; opt.quality: fast | hq; opt.point: {x,y} 0..1
export function personMask(el, sw, sh, opt = {}) {
  const tgt = opt.target === 'object' ? 'object' : 'person';
  const model = tgt === 'object' ? objSeg : (opt.quality === 'hq' && hqSeg ? hqSeg : segmenter);
  if (!model) return null;
  // kare kimliği: video zamanı ya da çağıranın verdiği yerel zaman (renk ayarlı / dışa aktarma tuvallerinde şart)
  const tk = opt._t != null ? opt._t.toFixed(3) : (el.currentTime ?? 0);
  const key = `${tk}|${sw}x${sh}|${opt.threshold}|${opt.edge}|${tgt}|${opt.quality}|${opt.point?.x},${opt.point?.y}`;
  let c = cache.get(el);
  if (c && c.key === key) return c.canvas;
  if (!small) { small = document.createElement('canvas'); small.width = SZ; small.height = SZ; }
  const sx = small.getContext('2d', { willReadFrequently: true });
  const k = Math.min(SZ / sw, SZ / sh);
  const dw = Math.round(sw * k), dh = Math.round(sh * k), ox = (SZ - dw) >> 1, oy = (SZ - dh) >> 1;
  sx.clearRect(0, 0, SZ, SZ);
  sx.drawImage(el, ox, oy, dw, dh);
  if (!c) { c = { canvas: document.createElement('canvas'), key: '', prev: null, pt: null, lastT: null }; cache.set(el, c); }
  // ardışık kare mi? (zaman sıçradıysa takip ve yumuşatma sıfırlanır)
  const tnum = +tk;
  const cont = c.lastT != null && Math.abs(tnum - c.lastT) < 0.25;
  if (!cont) { c.prev = null; c.pt = null; }
  let res;
  try {
    if (tgt === 'object') {
      const p0 = (cont && c.pt) || opt.point || { x: 0.5, y: 0.5 };
      res = model.segment(small, { keypoint: { x: (ox + p0.x * dw) / SZ, y: (oy + p0.y * dh) / SZ } });
    } else res = model.segment(small);
  } catch (e) { console.warn(e); return null; }
  const masks = res?.confidenceMasks;
  if (!masks?.length) { res?.close?.(); return null; }
  const mw = masks[0].width, mh = masks[0].height;
  let f = masks[0].getAsFloat32Array();
  if (model === hqSeg) { const inv = new Float32Array(f.length); for (let i = 0; i < f.length; i++) inv[i] = 1 - f[i]; f = inv; } // 0. sınıf = arka plan
  else if (tgt === 'object' && masks.length > 1) {
    // magic touch: seçilen bölge hangi maskedeyse onu kullan
    const p0 = (cont && c.pt) || opt.point || { x: 0.5, y: 0.5 };
    const ix = Math.min(mw - 1, Math.floor(((ox + p0.x * dw) / SZ) * mw)), iy = Math.min(mh - 1, Math.floor(((oy + p0.y * dh) / SZ) * mh));
    if (f[iy * mw + ix] < 0.5) f = masks[1].getAsFloat32Array();
  }
  // titreme önleme: önceki maskeyle zamansal yumuşatma
  if (c.prev && c.prev.length === f.length) { const out = new Float32Array(f.length); const a = opt.smooth ?? 0.35; for (let i = 0; i < f.length; i++) out[i] = f[i] * (1 - a) + c.prev[i] * a; f = out; }
  c.prev = f; c.lastT = tnum;
  const mc = c.canvas;
  mc.width = dw; mc.height = dh;
  const mx = mc.getContext('2d');
  const img = mx.createImageData(dw, dh);
  const th = opt.threshold ?? 0.5, soft = Math.max(0.02, opt.edge ?? 0.15);
  let sxp = 0, syp = 0, sn = 0;
  for (let y = 0; y < dh; y++) {
    const my = Math.min(mh - 1, Math.floor(((y + oy) / SZ) * mh));
    for (let x = 0; x < dw; x++) {
      const mxi = Math.min(mw - 1, Math.floor(((x + ox) / SZ) * mw));
      const v = f[my * mw + mxi];
      let a = (v - (th - soft)) / (2 * soft);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      const i = (y * dw + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
      if (a > 0.6) { sxp += x; syp += y; sn++; }
    }
  }
  // nesne takibi: bir sonraki kare için seçim noktası maskenin ağırlık merkezine kayar
  if (tgt === 'object' && sn > 20) c.pt = { x: sxp / sn / dw, y: syp / sn / dh };
  mx.putImageData(img, 0, 0);
  res.close?.();
  c.key = key;
  return mc;
}

// Kaynağı kişiye/nesneye göre kırp: arka planı saydam yapılmış tuval
const outCache = new WeakMap();
export function removeBackground(el, sw, sh, opt = {}, maxSide = 1280) {
  const m = personMask(el, sw, sh, opt);
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
