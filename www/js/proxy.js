// Alpicut v1.10 — proxy (hafif önizleme kopyası)
// Telefon kamerası çekimleri (1080p/4K, 60 fps, HEVC, HDR) önizlemede ağırdır. Her ağır video için
// kısa kenarı 540 px, 30 fps, H.264 ve 0,5 sn'de bir anahtar kareli hafif bir kopya üretilir.
// Önizleme ve zaman çizelgesinde bu kopya oynar; dışa aktarmada her zaman ORİJİNAL dosya kullanılır.
// İki yol var:
//   1) WebCodecs dönüştürme (hızlı, gerçek zamandan hızlı)
//   2) Yedek: telefonun kendi oynatıcısıyla oynatıp kareleri yeniden kodlama (HEVC/HDR gibi
//      WebCodecs'in çözemediği kamera formatlarında da çalışır, yaklaşık video süresi kadar sürer)
// Kullanıcı oynatırken üretim bekler (bgwork.waitIdle), önizlemeyle yarışmaz.
import { lsGet, lsSet, store } from './storage.js';
import { waitIdle, isPlaying } from './bgwork.js';

export const proxyMode = () => lsGet('alpicut.proxy', 'auto'); // auto | always | off
export const setProxyMode = (v) => lsSet('alpicut.proxy', v);

const SHORT = 540, FPS = 30;

// Bu video proxy gerektiriyor mu? (telefon çekimlerinin neredeyse tamamı: 1080p ve üstü ya da yüksek bit hızı)
export function needsProxy(m) {
  if (!m || m.kind !== 'video' || !m.blob) return false;
  const mode = proxyMode();
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  // not: medya kaydında boyut alanları w/h (eski sürüm width/height okuyordu → hep 0, telefon çekimleri atlanıyordu)
  const W = m.w || m.width || 0, H = m.h || m.height || 0;
  const long = Math.max(W, H), short = Math.min(W, H);
  const mbps = m.duration ? (m.blob.size * 8) / m.duration / 1e6 : 0;
  if (!long) return m.blob.size > 15e6; // boyut okunamadıysa: büyük dosya ise
  return short > 760 || long > 1300 || mbps > 6 || (m.duration || 0) > 90;
}

const queue = [];
let running = false;
const listeners = new Set();
export const onProxyChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const proxyState = new Map(); // mediaId -> {p: 0..1, done, err}
export const proxyPending = (id) => { const s = proxyState.get(id); return !!s && !s.done && !s.err; };
const emit = (m, p) => listeners.forEach((f) => { try { f(m, p); } catch (_) { /* yoksay */ } });

export function queueProxy(m) {
  if (!needsProxy(m) || m.proxyBlob || proxyPending(m.id)) return;
  proxyState.set(m.id, { p: 0 });
  queue.push(m);
  emit(m, 0);
  if (!running) pump();
}

async function pump() {
  running = true;
  while (queue.length) {
    const m = queue.shift();
    const prog = (p) => { proxyState.set(m.id, { p }); emit(m, p); };
    let blob = null;
    try { blob = await makeProxy(m, prog); } catch (e) { console.warn('proxy (WebCodecs) üretilemedi, yedek yola geçiliyor', e); }
    if (!blob) {
      try { blob = await makeProxyViaElement(m, prog); } catch (e) { console.warn('proxy (yedek) üretilemedi', e); }
    }
    if (blob) {
      m.proxyBlob = blob;
      m.purl = URL.createObjectURL(blob);
      proxyState.set(m.id, { p: 1, done: true });
      // kalıcı: proje yeniden açılınca tekrar üretilmesin
      try { const rec = await store.getMedia(m.id); if (rec) { rec.proxyBlob = blob; await store.putMedia(rec); } } catch (_) { /* yoksay */ }
    } else proxyState.set(m.id, { err: 'desteklenmiyor' });
    emit(m, 1);
  }
  running = false;
}

// H.264 tercih edilir (her telefonda akıcı oynar); desteklenmezse VP9
async function pickCodec(MB, W, H) {
  for (const c of ['avc', 'vp9']) { try { if (await MB.canEncodeVideo(c, { width: W, height: H, bitrate: 1.5e6 })) return c; } catch (_) { /* sıradaki */ } }
  return null;
}
const even = (v) => Math.max(2, Math.round(v / 2) * 2);
const fitSize = (w, h) => { const k = Math.min(w, h) > SHORT ? SHORT / Math.min(w, h) : 1; return [even(w * k), even(h * k)]; };

// 1) WebCodecs ile hızlı dönüştürme
export async function makeProxy(m, onProgress) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return null;
  const MB = await import('./lib/mediabunny.js');
  const input = new MB.Input({ source: new MB.BlobSource(m.blob), formats: MB.ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt || !(await vt.canDecode())) return null;
    const [W, H] = fitSize(await vt.getDisplayWidth(), await vt.getDisplayHeight());
    const codec = await pickCodec(MB, W, H);
    if (!codec) return null;
    const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
    const conv = await MB.Conversion.init({
      input, output,
      video: {
        codec, width: W, height: H, fit: 'fill', frameRate: FPS, keyFrameInterval: 0.5,
        bitrate: MB.QUALITY_MEDIUM, forceTranscode: true,
        // oynatma sürerken bekle: önizlemenin çözücüsüyle yarışma
        process: async (s) => { if (isPlaying()) await waitIdle(); return s; },
      },
      audio: { forceTranscode: false },
    });
    // video izi atıldıysa (çözülemedi/kodlanamadı) sessiz bir ses dosyası üretme
    if (!conv.isValid || !conv.utilizedTracks.some((t) => t.isVideoTrack?.() || t.type === 'video')) return null;
    conv.onProgress = (p) => onProgress?.(p * 0.98);
    await conv.execute();
    const buf = output.target.buffer;
    return buf && buf.byteLength > 1000 ? new Blob([buf], { type: 'video/mp4' }) : null;
  } finally { try { input.dispose(); } catch (_) { /* yoksay */ } }
}

// 2) Yedek: telefonun oynatıcısıyla çöz, tuvale çiz, H.264 olarak kodla; ses paketleri olduğu gibi kopyalanır
export async function makeProxyViaElement(m, onProgress) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  const MB = await import('./lib/mediabunny.js');
  const url = URL.createObjectURL(m.blob);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', '');
  v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.appendChild(v);
  let input = null;
  try {
    v.src = url;
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('zaman aşımı')), 20000); v.onloadedmetadata = () => { clearTimeout(t); res(); }; v.onerror = () => { clearTimeout(t); rej(new Error('açılamadı')); }; });
    if (!v.videoWidth || !v.videoHeight) return null;
    const dur = isFinite(v.duration) ? v.duration : (m.duration || 0);
    if (!dur) return null;
    const [W, H] = fitSize(v.videoWidth, v.videoHeight);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
    const codec = await pickCodec(MB, W, H);
    if (!codec) return null;
    const vsrc = new MB.VideoSampleSource({ codec, bitrate: MB.QUALITY_MEDIUM, keyFrameInterval: 0.5 });
    output.addVideoTrack(vsrc, { frameRate: FPS });

    // ses: orijinal paketleri kopyala (yeniden kodlama yok)
    let atrack = null, asrc = null;
    try {
      input = new MB.Input({ source: new MB.BlobSource(m.blob), formats: MB.ALL_FORMATS });
      atrack = await input.getPrimaryAudioTrack();
      const codec = atrack ? await atrack.getCodec() : null;
      if (codec && ['aac', 'opus', 'mp3'].includes(codec)) { asrc = new MB.EncodedAudioPacketSource(codec); output.addAudioTrack(asrc); } else atrack = null;
    } catch (_) { atrack = null; asrc = null; }

    await output.start();
    if (asrc) {
      const cfg = await atrack.getDecoderConfig();
      const sink = new MB.EncodedPacketSink(atrack);
      let first = true;
      for await (const p of sink.packets()) { await asrc.add(p, first ? { decoderConfig: cfg } : undefined); first = false; }
      asrc.close();
    }

    // video: gerçek zamanlı oynat, her yeni karede yakala (en fazla 30 fps)
    let chain = Promise.resolve(), pending = 0, last = -1, failed = null, count = 0;
    const grab = (t) => {
      if (t < last + 1 / (FPS + 1) || pending > 12) return;
      last = t;
      ctx.drawImage(v, 0, 0, W, H);
      const frame = new VideoFrame(cv, { timestamp: Math.round(t * 1e6) });
      const sample = new MB.VideoSample(frame);
      pending++; count++;
      chain = chain.then(() => vsrc.add(sample)).catch((e) => { failed = failed || e; }).finally(() => { sample.close(); pending--; });
      onProgress?.(Math.min(0.97, t / dur));
    };
    const hasRVFC = typeof v.requestVideoFrameCallback === 'function';
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      v.onended = finish;
      v.onerror = finish;
      if (hasRVFC) {
        const onFrame = (_now, meta) => { if (done) return; grab(meta.mediaTime); v.requestVideoFrameCallback(onFrame); };
        v.requestVideoFrameCallback(onFrame);
      } else {
        const tick = () => { if (done) return; if (!v.paused) grab(v.currentTime); setTimeout(tick, 1000 / FPS); };
        tick();
      }
      // oynatma önceliği + takılma koruması
      let lastT = -1, still = 0;
      const guard = setInterval(async () => {
        if (done) { clearInterval(guard); return; }
        if (isPlaying()) { v.pause(); await waitIdle(); if (!done) v.play().catch(() => {}); return; }
        if (Math.abs(v.currentTime - lastT) < 0.01) { if (++still > 40) finish(); } else still = 0; // 10 sn ilerlemezse bitir
        lastT = v.currentTime;
      }, 250);
      v.play().catch(finish);
    });
    v.pause();
    await chain;
    if (failed || count < 2 || last < dur * 0.8) { if (failed) console.warn('proxy kodlama hatası', failed); try { await output.cancel(); } catch (_) { /* yoksay */ } return null; }
    vsrc.close();
    await output.finalize();
    const buf = output.target.buffer;
    return buf && buf.byteLength > 1000 ? new Blob([buf], { type: 'video/mp4' }) : null;
  } finally {
    try { input?.dispose(); } catch (_) { /* yoksay */ }
    v.pause(); v.removeAttribute('src'); try { v.load(); } catch (_) { /* yoksay */ }
    v.remove(); URL.revokeObjectURL(url);
  }
}
