// Alpicut — stüdyo ses işleme: yapay zekâ gürültü giderme (RNNoise), uğultu filtresi, EQ, de-esser,
// kompresör ve seviye eşitleme. Kayıttan sonra veya herhangi bir sese çevrimdışı uygulanır.
const SR = 48000;

let rnP = null;
async function rnnoise() {
  if (!rnP) rnP = import('../vendor/rnnoise/rnnoise.js').then((m) => (m.Rnnoise || m.default?.Rnnoise || m.default).load());
  return rnP;
}

async function decode(blob) {
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

async function renderChain(x, o) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, x.length, SR);
  const b = ctx.createBuffer(1, x.length, SR); b.copyToChannel(x, 0);
  const src = ctx.createBufferSource(); src.buffer = b;
  let node = src;
  const chain = (n) => { node.connect(n); node = n; };
  if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hpFreq || 80; f.Q.value = 0.7; chain(f); }
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

function normalize(x, targetDb) {
  // konuşma bölümlerinin RMS'ine göre (sessizlikler hariç)
  const w = 2400; const vals = [];
  for (let i = 0; i < x.length; i += w) { let s = 0; for (let k = 0; k < w && i + k < x.length; k++) s += x[i + k] * x[i + k]; const db = 10 * Math.log10(s / w + 1e-12); if (db > -45) vals.push(db); }
  if (!vals.length) return x;
  vals.sort((p, q) => p - q);
  const level = vals[Math.floor(vals.length * 0.7)];
  let g = Math.pow(10, (targetDb - level) / 20);
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
  podcast: { label: 'Podcast / konuşma', denoise: 1, hp: true, hpFreq: 80, low: 1, mud: -3, presence: 3, air: 2, deess: 0.7, comp: true, compThr: -24, compRatio: 3.5, target: -16 },
  voiceover: { label: 'Seslendirme (parlak)', denoise: 1, hp: true, hpFreq: 90, low: 0, mud: -4, presence: 4, air: 3, deess: 0.8, comp: true, compThr: -26, compRatio: 4, target: -15 },
  outdoor: { label: 'Dış mekân / rüzgâr', denoise: 1, hp: true, hpFreq: 140, low: -2, mud: -2, presence: 4, air: 0, deess: 0.5, comp: true, compThr: -22, compRatio: 3, target: -16 },
  warm: { label: 'Sıcak radyo', denoise: 0.8, hp: true, hpFreq: 70, low: 3, mud: -1, presence: 2, air: -1, deess: 0.6, comp: true, compThr: -20, compRatio: 3, target: -16 },
  light: { label: 'Sadece gürültü temizle', denoise: 1, hp: true, hpFreq: 70, low: 0, mud: 0, presence: 0, air: 0, deess: 0, comp: false, target: null },
};

// blob -> işlenmiş WAV blob
export async function processVoice(blob, o, onP = () => {}) {
  onP(0.02, 'Ses çözülüyor…');
  let x = await decode(blob);
  if (o.denoise > 0) {
    onP(0.08, 'Yapay zekâ gürültü temizliği…');
    try {
      const rn = await rnnoise();
      const st = rn.createDenoiseState();
      x = denoiseRN(x, st, o.denoise, (p) => onP(0.08 + p * 0.6, 'Yapay zekâ gürültü temizliği…'));
      st.destroy?.();
    } catch (e) {
      console.warn('RNNoise yok, gürültü kapısı kullanılıyor', e);
      x = gate(x);
    }
  }
  onP(0.72, 'EQ ve kompresör…');
  x = await renderChain(x, o);
  if (o.deess > 0) { onP(0.85, 'De-esser…'); x = await deEss(x, o.deess); }
  if (o.target != null) { onP(0.93, 'Seviye eşitleniyor…'); x = normalize(x, o.target); }
  onP(1, 'Bitti');
  return toWav(x);
}
