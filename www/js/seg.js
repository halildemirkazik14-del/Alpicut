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

export function initSegmenter() {
  if (segmenter) return Promise.resolve(true);
  if (loading) return loading;
  loading = (async () => {
    const V = await vision();
    const fs = await fileset(V);
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: new URL('../models/selfie_segmenter.tflite', import.meta.url).href, delegate },
      runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
    });
    try { segmenter = await V.ImageSegmenter.createFromOptions(fs, opts('CPU')); }
    catch (e) { console.warn('segmenter', e); throw new Error('Arka plan silme modeli yüklenemedi'); }
    return true;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

const cache = new WeakMap(); // kaynak eleman -> { key, canvas }
const SZ = 256;
let small = null;

// Kişi maskesi (alfa kanalında) olan tuval döndürür
export function personMask(el, sw, sh, opt = {}) {
  if (!segmenter) return null;
  const key = `${el.currentTime ?? 0}|${sw}x${sh}|${opt.threshold}|${opt.edge}`;
  let c = cache.get(el);
  if (c && c.key === key) return c.canvas;
  if (!small) { small = document.createElement('canvas'); small.width = SZ; small.height = SZ; }
  // kare girdi (oranı koruyarak ortala)
  const sx = small.getContext('2d', { willReadFrequently: true });
  const k = Math.min(SZ / sw, SZ / sh);
  const dw = Math.round(sw * k), dh = Math.round(sh * k), ox = (SZ - dw) >> 1, oy = (SZ - dh) >> 1;
  sx.clearRect(0, 0, SZ, SZ);
  sx.drawImage(el, ox, oy, dw, dh);
  let res;
  try { res = segmenter.segment(small); } catch (e) { console.warn(e); return null; }
  const mask = res?.confidenceMasks?.[0];
  if (!mask) { res?.close?.(); return null; }
  const f = mask.getAsFloat32Array();
  const mw = mask.width, mh = mask.height;
  if (!c) { c = { canvas: document.createElement('canvas'), key: '' }; cache.set(el, c); }
  const mc = c.canvas;
  mc.width = dw; mc.height = dh;
  const mx = mc.getContext('2d');
  const img = mx.createImageData(dw, dh);
  const th = opt.threshold ?? 0.5, soft = Math.max(0.02, opt.edge ?? 0.15);
  for (let y = 0; y < dh; y++) {
    const my = Math.min(mh - 1, Math.floor(((y + oy) / SZ) * mh));
    for (let x = 0; x < dw; x++) {
      const mxi = Math.min(mw - 1, Math.floor(((x + ox) / SZ) * mw));
      const v = f[my * mw + mxi];
      let a = (v - (th - soft)) / (2 * soft);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      const i = (y * dw + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
    }
  }
  mx.putImageData(img, 0, 0);
  res.close?.();
  c.key = key;
  return mc;
}

// Kaynağı kişiye göre kırp: arka planı saydam yapılmış tuval
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
  x.filter = opt.feather > 0 ? `blur(${opt.feather * k}px)` : 'none';
  x.drawImage(m, 0, 0, w, h);
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
