// Alpicut — stüdyo ses işleme: yapay zekâ gürültü giderme (RNNoise), uğultu filtresi, EQ, de-esser,
// kompresör ve seviye eşitleme. Kayıttan sonra veya herhangi bir sese çevrimdışı uygulanır.
const SR = 48000;

let rnP = null;
async function rnnoise() {
  if (!rnP) rnP = import('../vendor/rnnoise/rnnoise.js').then((m) => (m.Rnnoise || m.default?.Rnnoise || m.default).load());
  return rnP;
}

export async function decode(blob) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, SR, SR);
  const ab = await ctx.decodeAudioData(await blob.arrayBuffer());
  const n = ab.length;
  const out = new Float32Array(n);
  for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ab.numberOfChannels; }
  return out;
}

function denoiseRN(x, state, amount, onP) {
  const F = 480;
  const out = new Float32Array(x.length);
  const fr = new Float32Array(F);
  for (let i = 0; i < x.length; i += F) {
    for (let k = 0; k < F; k++) fr[k] = (x[i + k] || 0) * 32768;
    state.processFrame(fr);
    for (let k = 0; k < F && i + k < x.length; k++) out[i + k] = (fr[k] / 32768) * amount + x[i + k] * (1 - amount);
    if (onP && (i / F) % 400 === 0) onP(i / x.length);
  }
  return out;
}

// Spektral kapı yerine basit gürültü kapısı (RNNoise yoksa)
function gate(x, thrDb = -50) {
  const w = 480, thr = Math.pow(10, thrDb / 20);
  const out = new Float32Array(x.length);
  let g = 1;
  for (let i = 0; i < x.length; i += w) {
    let s = 0; for (let k = 0; k < w && i + k < x.length; k++) s += x[i + k] * x[i + k];
    const rms = Math.sqrt(s / w);
    const tgt = rms > thr ? 1 : 0.15;
    for (let k = 0; k < w && i + k < x.length; k++) { g += (tgt - g) * (tgt > g ? 0.02 : 0.002); out[i + k] = x[i + k] * g; }
  }
  return out;
}

// ---------- FFT (radix-2, yerinde) ----------
function fft(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI) / len * (inv ? 1 : -1);
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

// Spektral gürültü azaltma (sabit hışırtı, uğultu, fan sesi). Gürültü profili verilmezse en sessiz
// karelerden otomatik öğrenilir. reductionDb: en fazla ne kadar bastırılacağı.
export function spectralDenoise(x, { reductionDb = 18, profile = null, sensitivity = 1.6, onP } = {}) {
  const N = 1024, hop = 256, B = N / 2 + 1;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const frames = Math.max(1, Math.ceil((x.length + N) / hop));
  const pad = new Float32Array(frames * hop + N * 2);
  pad.set(x, N);
  const re = new Float32Array(N), im = new Float32Array(N);
  // 1) gürültü profili
  let noise = null;
  if (profile && profile.length > N * 4) {
    noise = new Float32Array(B);
    let c = 0;
    for (let s = 0; s + N <= profile.length; s += hop) {
      for (let i = 0; i < N; i++) { re[i] = profile[s + i] * win[i]; im[i] = 0; }
      fft(re, im, false);
      for (let k = 0; k < B; k++) noise[k] += Math.hypot(re[k], im[k]);
      c++;
    }
    for (let k = 0; k < B; k++) noise[k] /= Math.max(1, c);
  } else {
    // en sessiz %10'luk karelerin ortalaması (minimum istatistiği)
    const step = Math.max(1, Math.floor(frames / 400));
    const mags = [];
    const energies = [];
    for (let f = 0; f < frames; f += step) {
      const s = f * hop;
      for (let i = 0; i < N; i++) { re[i] = pad[s + i] * win[i]; im[i] = 0; }
      fft(re, im, false);
      const m = new Float32Array(B); let e = 0;
      for (let k = 0; k < B; k++) { m[k] = Math.hypot(re[k], im[k]); e += m[k]; }
      mags.push(m); energies.push(e);
    }
    const ord = energies.map((e, i) => [e, i]).sort((a, b) => a[0] - b[0]);
    const take = ord.slice(0, Math.max(3, Math.floor(ord.length * 0.1)));
    noise = new Float32Array(B);
    take.forEach(([, i]) => { for (let k = 0; k < B; k++) noise[k] += mags[i][k]; });
    for (let k = 0; k < B; k++) noise[k] /= take.length;
  }
  // 2) kazanç maskesi + üst üste ekleme
  const floor = Math.pow(10, -reductionDb / 20);
  const out = new Float32Array(pad.length);
  const prevG = new Float32Array(B).fill(1);
  const g = new Float32Array(B);
  for (let f = 0; f < frames; f++) {
    const s = f * hop;
    for (let i = 0; i < N; i++) { re[i] = pad[s + i] * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < B; k++) {
      const m = Math.hypot(re[k], im[k]) + 1e-9;
      const snr = m / (noise[k] * sensitivity + 1e-9);
      // yumuşak geçiş: gürültü seviyesinde floor, 3x üstünde 1
      let gk = snr <= 1 ? floor : snr >= 3 ? 1 : floor + (1 - floor) * ((snr - 1) / 2);
      // zaman yumuşatma: hızlı açıl, yavaş kapan (müzikal gürültüyü azaltır)
      gk = gk > prevG[k] ? prevG[k] + (gk - prevG[k]) * 0.7 : prevG[k] + (gk - prevG[k]) * 0.25;
      g[k] = gk;
    }
    for (let k = 0; k < B; k++) prevG[k] = g[k];
    // frekans yumuşatma
    for (let k = 1; k < B - 1; k++) { const v = (g[k - 1] + 2 * g[k] + g[k + 1]) / 4; re[k] *= v; im[k] *= v; if (k > 0 && k < N / 2) { re[N - k] *= v; im[N - k] *= v; } }
    re[0] *= g[0]; im[0] *= g[0]; re[N / 2] *= g[B - 1]; im[N / 2] *= g[B - 1];
    fft(re, im, true);
    for (let i = 0; i < N; i++) out[s + i] += re[i] * win[i];
    if (onP && f % 500 === 0) onP(f / frames);
  }
  // Hann² toplamı (hop=N/4) = 1.5
  const res = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) res[i] = out[i + N] / 1.5;
  return res;
}

// Kelime aralarındaki kalan hışırtıyı bastıran aşağı yönlü genişletici
export function expander(x, { rangeDb = 30, ratio = 2.5 } = {}) {
  const w = Math.round(SR * 0.01);
  const env = [];
  for (let i = 0; i < x.length; i += w) { let s = 0; for (let k = 0; k < w && i + k < x.length; k++) s += x[i + k] * x[i + k]; env.push(10 * Math.log10(s / w + 1e-12)); }
  const sorted = env.filter((v) => v > -70).sort((a, b) => a - b);
  if (sorted.length < 10) return x;
  const speech = sorted[Math.floor(sorted.length * 0.75)];
  const thr = speech - rangeDb;
  const out = new Float32Array(x.length);
  let gdb = 0;
  for (let j = 0; j < env.length; j++) {
    const below = Math.max(0, thr - env[j]);
    const target = -Math.min(36, below * (ratio - 1));
    gdb += (target - gdb) * (target > gdb ? 0.5 : 0.08); // hızlı açılma, yavaş kapanma
    const gl = Math.pow(10, gdb / 20);
    for (let k = 0; k < w && j * w + k < x.length; k++) out[j * w + k] = x[j * w + k] * gl;
  }
  return out;
}

function dcRemove(x) {
  const out = new Float32Array(x.length);
  let px = 0, py = 0;
  for (let i = 0; i < x.length; i++) { const y = x[i] - px + 0.995 * py; px = x[i]; py = y; out[i] = y; }
  return out;
}

async function renderChain(x, o) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, x.length, SR);
  const b = ctx.createBuffer(1, x.length, SR); b.copyToChannel(x, 0);
  const src = ctx.createBufferSource(); src.buffer = b;
  let node = src;
  const chain = (n) => { node.connect(n); node = n; };
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hpFreq || 80; f.Q.value = 0.7; chain(f); }
  // v1.7: elektrik uğultusu (50/60 Hz ve harmonikleri)
  if (o.hum) [1, 2, 3, 4].forEach((k) => { const f = ctx.createBiquadFilter(); f.type = 'notch'; f.frequency.value = o.hum * k; f.Q.value = 14; chain(f); });
  const eq = [['lowshelf', 120, o.low || 0], ['peaking', 300, o.mud || 0, 1], ['peaking', 3000, o.presence || 0, 0.9], ['highshelf', 10000, o.air || 0]];
  eq.forEach(([type, f, gdb, q]) => { if (!gdb) return; const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.gain.value = gdb; if (q) n.Q.value = q; chain(n); });
  if (o.comp) { const c = ctx.createDynamicsCompressor(); c.threshold.value = o.compThr ?? -22; c.ratio.value = o.compRatio ?? 3.5; c.knee.value = 8; c.attack.value = 0.006; c.release.value = 0.16; chain(c); }
  node.connect(ctx.destination);
  src.start();
  const r = await ctx.startRendering();
  return r.getChannelData(0).slice();
}

async function highBand(x, f0) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, x.length, SR);
  const b = ctx.createBuffer(1, x.length, SR); b.copyToChannel(x, 0);
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = f0; f.Q.value = 0.8;
  s.connect(f); f.connect(ctx.destination); s.start();
  return (await ctx.startRendering()).getChannelData(0).slice();
}

// De-esser: 5.5 kHz üstü bandı, enerjisi eşiği geçince bastır
async function deEss(x, amount) {
  const hb = await highBand(x, 5500);
  const out = new Float32Array(x.length);
  let env = 0;
  const a = Math.exp(-1 / (0.002 * SR)), r = Math.exp(-1 / (0.06 * SR));
  const thr = 0.035;
  for (let i = 0; i < x.length; i++) {
    const v = Math.abs(hb[i]);
    env = v > env ? a * env + (1 - a) * v : r * env + (1 - r) * v;
    const red = env > thr ? Math.min(0.85, ((env - thr) / thr) * 0.5) * amount : 0;
    out[i] = x[i] - hb[i] * red;
  }
  return out;
}

let o_maxGain = 18;
function normalize(x, targetDb) {
  // konuşma bölümlerinin RMS'ine göre (sessizlikler hariç)
  const w = 2400; const vals = [];
  for (let i = 0; i < x.length; i += w) { let s = 0; for (let k = 0; k < w && i + k < x.length; k++) s += x[i + k] * x[i + k]; const db = 10 * Math.log10(s / w + 1e-12); if (db > -45) vals.push(db); }
  if (!vals.length) return x;
  vals.sort((p, q) => p - q);
  const level = vals[Math.floor(vals.length * 0.7)];
  let g = Math.min(Math.pow(10, (targetDb - level) / 20), Math.pow(10, (o_maxGain || 18) / 20));
  let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
  if (pk * g > 0.97) g = 0.97 / pk; // tepe sınırı
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * g;
  return out;
}

export function toWav(x, sr = SR) {
  const dv = new DataView(new ArrayBuffer(44 + x.length * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + x.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, x.length * 2, true);
  for (let i = 0, o = 44; i < x.length; i++, o += 2) { const v = Math.max(-1, Math.min(1, x[i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Blob([dv], { type: 'audio/wav' });
}

export const STUDIO_PRESETS = {
  podcast: { label: 'Podcast / konuşma', nr: 16, denoise: 0.8, hp: true, hpFreq: 80, low: 1, mud: -3, presence: 2.5, air: 0, deess: 0.6, expand: true, comp: true, compThr: -24, compRatio: 3, target: -16 },
  voiceover: { label: 'Seslendirme (net)', nr: 18, denoise: 0.9, hp: true, hpFreq: 90, low: 0, mud: -3.5, presence: 3, air: 1, deess: 0.7, expand: true, comp: true, compThr: -26, compRatio: 3.5, target: -15 },
  hiss: { label: 'Hışırtı giderici (güçlü)', nr: 26, nrSens: 2, denoise: 1, hp: true, hpFreq: 90, low: 0, mud: -2, presence: 1.5, air: -3, deess: 0.5, expand: true, comp: true, compThr: -24, compRatio: 2.5, target: -16 },
  outdoor: { label: 'Dış mekân / rüzgâr', nr: 20, denoise: 1, hp: true, hpFreq: 140, low: -2, mud: -2, presence: 3, air: -1, deess: 0.5, expand: true, comp: true, compThr: -22, compRatio: 3, target: -16 },
  warm: { label: 'Sıcak radyo', nr: 14, denoise: 0.7, hp: true, hpFreq: 70, low: 3, mud: -1, presence: 1.5, air: -2, deess: 0.6, expand: true, comp: true, compThr: -20, compRatio: 3, target: -16 },
  light: { label: 'Sadece gürültü temizle', nr: 14, denoise: 0.6, hp: true, hpFreq: 70, low: 0, mud: 0, presence: 0, air: 0, deess: 0, expand: false, comp: false, target: null },
};

// blob -> işlenmiş WAV blob
export async function processVoice(blob, o, onP = () => {}, extra = {}) {
  onP(0.02, 'Ses çözülüyor…');
  let x = blob instanceof Float32Array ? blob : await decode(blob);
  x = dcRemove(x);
  if (o.nr) {
    onP(0.06, 'Hışırtı ve sabit gürültü temizleniyor…');
    x = spectralDenoise(x, { reductionDb: o.nr, profile: extra.noise || null, sensitivity: o.nrSens || 1.6, onP: (p) => onP(0.06 + p * 0.3, 'Hışırtı ve sabit gürültü temizleniyor…') });
  }
  if (o.denoise > 0) {
    onP(0.4, 'Yapay zekâ gürültü temizliği (RNNoise)…');
    try {
      const rn = await rnnoise();
      const st = rn.createDenoiseState();
      x = denoiseRN(x, st, o.denoise, (p) => onP(0.4 + p * 0.3, 'Yapay zekâ gürültü temizliği (RNNoise)…'));
      st.destroy?.();
    } catch (e) {
      console.warn('RNNoise yok', e);
    }
  }
  onP(0.72, 'EQ ve kompresör…');
  x = await renderChain(x, o);
  if (o.deess > 0) { onP(0.82, 'De-esser…'); x = await deEss(x, o.deess); }
  if (o.expand) { onP(0.88, 'Kelime arası sessizleştirme…'); x = expander(x, { rangeDb: 28, ratio: 2.5 }); }
  if (o.target != null) { onP(0.93, 'Seviye eşitleniyor…'); o_maxGain = o.maxGain || 18; x = normalize(x, o.target); }
  onP(1, 'Bitti');
  return extra.raw ? x : toWav(x);
}
