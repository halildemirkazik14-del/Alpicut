// Alpicut — ses analizi: çözümleme, sessizlik tespiti, ritim tespiti, seviye ölçümü, mikrofon kaydı
const SR = 8000;
const cache = new Map();

// Medyanın sesini tek kanal, düşük örnekleme hızıyla çöz
export async function decodeMono(media) {
  if (cache.has(media.id)) return cache.get(media.id);
  if (media.blob && media.blob.size > 400 * 1048576) throw new Error('Dosya çok büyük (400 MB üstü) — telefonda ses analizi yapılamıyor');
  const buf = await (media.blob || await (await fetch(media.url)).blob()).arrayBuffer();
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, SR, SR);
  let ab;
  try { ab = await ctx.decodeAudioData(buf); } catch (e) { throw new Error('Bu dosyanın sesi çözülemedi (ses kanalı olmayabilir)'); }
  const n = ab.length, ch = ab.numberOfChannels;
  const out = new Float32Array(n);
  for (let c = 0; c < ch; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ch; }
  const res = { data: out, sr: ab.sampleRate, dur: n / ab.sampleRate };
  if (cache.size > 6) cache.delete(cache.keys().next().value);
  cache.set(media.id, res);
  return res;
}

// pencere RMS (dB)
function envelope(a, win) {
  const { data, sr } = a;
  const w = Math.max(1, Math.round(sr * win));
  const n = Math.floor(data.length / w);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * w, e = j + w; j < e; j++) s += data[j] * data[j];
    out[i] = 10 * Math.log10(s / w + 1e-12);
  }
  return out;
}

// Sessiz aralıklar [ {s, e} ] (kaynak saniyesi), kenarlarda pay bırakılır
export function findSilences(a, { from = 0, to = Infinity, threshold = -40, minDur = 0.6, pad = 0.12 } = {}) {
  const win = 0.02;
  const env = envelope(a, win);
  const out = [];
  let st = null;
  const i0 = Math.floor(from / win), i1 = Math.min(env.length, Math.ceil(Math.min(to, a.dur) / win));
  for (let i = i0; i <= i1; i++) {
    const quiet = i < i1 && env[i] < threshold;
    if (quiet && st == null) st = i;
    if (!quiet && st != null) {
      const s = st * win, e = i * win;
      if (e - s >= minDur) {
        const ss = s === from ? s : s + pad, ee = e >= Math.min(to, a.dur) - 1e-3 ? e : e - pad;
        if (ee - ss > 0.15) out.push({ s: ss, e: ee });
      }
      st = null;
    }
  }
  return out;
}

// Basit onset/ritim tespiti: alçak geçirilmiş enerji akışı
export function detectBeats(a, { from = 0, to = Infinity, sensitivity = 1 } = {}) {
  const win = 0.023;
  const { data, sr } = a;
  const w = Math.round(sr * win);
  const n = Math.floor(data.length / w);
  // birinci dereceden alçak geçiren (bas ağırlıklı)
  let lp = 0;
  const k = Math.exp(-2 * Math.PI * 180 / sr);
  const en = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * w, e = j + w; j < e; j++) { lp = lp * k + data[j] * (1 - k); s += lp * lp; }
    en[i] = Math.sqrt(s / w);
  }
  const flux = new Float32Array(n);
  for (let i = 1; i < n; i++) flux[i] = Math.max(0, en[i] - en[i - 1]);
  const beats = [];
  const span = Math.round(0.5 / win);
  const minGap = 0.28;
  let last = -9;
  const i0 = Math.floor(from / win), i1 = Math.min(n - 1, Math.ceil(Math.min(to, a.dur) / win));
  for (let i = Math.max(1, i0); i < i1; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - span); j < Math.min(n, i + span); j++) { s += flux[j]; c++; }
    const avg = s / c;
    const t = i * win;
    if (flux[i] > avg * (1.6 / sensitivity) + 1e-4 && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && t - last >= minGap) {
      beats.push(t); last = t;
    }
  }
  return beats;
}

// Ortalama konuşma seviyesi (sessiz kısımlar hariç) dB
export function loudness(a, from = 0, to = Infinity) {
  const env = envelope(a, 0.05);
  const i0 = Math.floor(from / 0.05), i1 = Math.min(env.length, Math.ceil(Math.min(to, a.dur) / 0.05));
  const vals = [];
  for (let i = i0; i < i1; i++) if (env[i] > -50) vals.push(env[i]);
  if (!vals.length) return -90;
  const e = vals.reduce((x, y) => x + Math.pow(10, y / 10), 0) / vals.length;
  return 10 * Math.log10(e);
}

// ---------- mikrofon kaydı ----------
export async function startMic() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu cihaz mikrofon kaydını desteklemiyor');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
  const mime = types.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  // seviye göstergesi
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  const an = ac.createAnalyser(); an.fftSize = 1024;
  ac.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(1024);
  const level = () => { an.getFloatTimeDomainData(buf); let p = 0; for (const v of buf) p = Math.max(p, Math.abs(v)); return 20 * Math.log10(p + 1e-9); };
  rec.start(250);
  const t0 = performance.now();
  return {
    level,
    elapsed: () => (performance.now() - t0) / 1000,
    stop: () => new Promise((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        ac.close();
        const type = (mime || 'audio/webm').split(';')[0];
        resolve(new Blob(chunks, { type }));
      };
      rec.stop();
    }),
    cancel: () => { try { rec.stop(); } catch (_) { /* yoksay */ } stream.getTracks().forEach((tr) => tr.stop()); ac.close(); },
  };
}
