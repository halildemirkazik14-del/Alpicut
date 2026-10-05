// Alpicut — ses efekti fabrikası (v1.5)
// Tüm ses efektleri burada, sıfırdan sentezlenir: whoosh, riser, gerilim, glitch, darbe, braam, UI, komik…
// Hiçbir dış kaynak kullanılmaz → telifsiz, lisans derdi yok, her derlemede aynı sonuç (sabit tohum).
// Kullanım: node scripts/sfx-forge.mjs [çıktı klasörü=www/sfx]   (gerekli: ffmpeg)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SR = 48000;
const OUT = process.argv[2] || 'www/sfx';
const TMP = fs.mkdtempSync('/tmp/sfxforge-');
const ONLY = process.env.SFX_ONLY ? new RegExp(process.env.SFX_ONLY) : null;

// ---------------- temel araçlar ----------------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const N = (sec) => Math.max(1, Math.round(sec * SR));
const buf = (sec) => new Float32Array(N(sec));
const st = (sec) => [buf(sec), buf(sec)];
const expo = (a, b, t) => a * Math.pow(b / a, clamp(t, 0, 1)); // üstel geçiş

// gürültüler
function white(n, r) { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = r() * 2 - 1; return o; }
function pink(n, r) { const o = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < n; i++) { const w = r() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; } return o; }
function brown(n, r) { const o = new Float32Array(n); let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (r() * 2 - 1)) / 1.02; o[i] = l * 3.5; } return o; }

// osilatörler (frekans fonksiyonu f(t) Hz), polyBLEP ile yumuşatılmış testere/kare
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
function osc(n, type, freq, ph0 = 0) {
  const o = new Float32Array(n); let ph = ph0;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === 'function' ? freq(i / SR, i) : freq; const dt = f / SR;
    let v;
    switch (type) {
      case 'sine': v = Math.sin(TAU * ph); break;
      case 'tri': v = 1 - 4 * Math.abs(((ph + 0.25) % 1) - 0.5); break;
      case 'saw': v = 2 * ph - 1 - blep(ph, dt); break;
      case 'square': v = (ph < 0.5 ? 1 : -1) + blep(ph, dt) - blep((ph + 0.5) % 1, dt); break;
      default: v = Math.sin(TAU * ph);
    }
    o[i] = v; ph += dt; ph -= Math.floor(ph);
  }
  return o;
}

// durum-değişkenli filtre (TPT/SVF), kesim ve rezonans her örnekte değişebilir
function svf(x, mode, cut, q = 0.7) {
  const o = new Float32Array(x.length); let ic1 = 0, ic2 = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = clamp(typeof cut === 'function' ? cut(i / SR, i) : cut, 15, SR * 0.45);
    const Q = typeof q === 'function' ? q(i / SR) : q;
    const g = Math.tan(Math.PI * fc / SR), k = 1 / Math.max(0.05, Q);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    o[i] = mode === 'lp' ? v2 : mode === 'hp' ? x[i] - k * v1 - v2 : mode === 'bp' ? v1 : mode === 'notch' ? x[i] - k * v1 : v2;
  }
  return o;
}
const lp = (x, c, q) => svf(x, 'lp', c, q), hp = (x, c, q) => svf(x, 'hp', c, q), bp = (x, c, q) => svf(x, 'bp', c, q);

// zarf: noktalar [[t, değer], ...] (üstel eğimli), ya da fonksiyon
function env(x, pts, curve = 1) {
  const o = new Float32Array(x.length);
  if (typeof pts === 'function') { for (let i = 0; i < x.length; i++) o[i] = x[i] * pts(i / SR); return o; }
  let k = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    while (k < pts.length - 2 && t > pts[k + 1][0]) k++;
    const [t0, v0] = pts[k], [t1, v1] = pts[Math.min(k + 1, pts.length - 1)];
    let u = t1 > t0 ? clamp((t - t0) / (t1 - t0), 0, 1) : 1;
    if (curve !== 1) u = v1 < v0 ? 1 - Math.pow(1 - u, curve) : Math.pow(u, curve);
    o[i] = x[i] * (t > pts[pts.length - 1][0] ? pts[pts.length - 1][1] : lerp(v0, v1, u));
  }
  return o;
}
const ad = (x, a, d, c = 3) => env(x, (t) => (t < a ? t / Math.max(1e-4, a) : Math.pow(Math.max(0, 1 - (t - a) / Math.max(1e-4, d)), c)));
const decay = (x, d) => env(x, (t) => Math.exp(-t / d));

function mix(...xs) { const n = Math.max(...xs.map((x) => x.length)); const o = new Float32Array(n); xs.forEach((x) => { for (let i = 0; i < x.length; i++) o[i] += x[i]; }); return o; }
function gain(x, g) { const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x[i] * (typeof g === 'function' ? g(i / SR) : g); return o; }
function offset(x, sec, total) { const o = new Float32Array(N(total)); const k = N(sec); for (let i = 0; i < x.length && i + k < o.length; i++) if (i + k >= 0) o[i + k] = x[i]; return o; }
function sat(x, drive = 2) { const o = new Float32Array(x.length); const n = Math.tanh(drive); for (let i = 0; i < x.length; i++) o[i] = Math.tanh(x[i] * drive) / n; return o; }
function crush(x, bits, down = 1) { const o = new Float32Array(x.length); const q = Math.pow(2, bits - 1); let h = 0; for (let i = 0; i < x.length; i++) { if (i % down === 0) h = Math.round(x[i] * q) / q; o[i] = h; } return o; }
function rev(x) { return Float32Array.from(x).reverse(); }
function fadeEdges(x, a = 0.003, b = 0.01) { const o = Float32Array.from(x); const na = N(a), nb = N(b); for (let i = 0; i < na && i < o.length; i++) o[i] *= i / na; for (let i = 0; i < nb && i < o.length; i++) o[o.length - 1 - i] *= i / nb; return o; }
function ring(x, f) { const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x[i] * Math.sin(TAU * (typeof f === 'function' ? f(i / SR) : f) * i / SR); return o; }
function am(x, rate, depth = 1) { return env(x, (t) => 1 - depth * 0.5 * (1 + Math.sin(TAU * (typeof rate === 'function' ? rate(t) : rate) * t))); }
function resonator(x, freqs, decays) { // modal (metal/çan) rezonatör
  let out = new Float32Array(x.length);
  freqs.forEach((f, k) => { const r = Math.exp(-1 / (decays[k] * SR)), w = TAU * f / SR, a1 = 2 * r * Math.cos(w), a2 = -r * r; let y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const y = x[i] * (1 - r) + a1 * y1 + a2 * y2; y2 = y1; y1 = y; out[i] += y; } });
  return out;
}
function delayFx(x, sec, fb, wet, total) { const o = new Float32Array(Math.max(x.length, N(total || x.length / SR))); const d = N(sec); for (let i = 0; i < o.length; i++) { const dry = i < x.length ? x[i] : 0; o[i] = dry + (i >= d ? o[i - d] * fb : 0) * 1; } return mixWet(x, o, wet); }
function mixWet(dry, w, wet) { const n = Math.max(dry.length, w.length); const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = (dry[i] || 0) * (1 - wet * 0.5) + (w[i] || 0) * wet; return o; }

// Freeverb tarzı stereo yankı
function reverb([L0, R0], { size = 0.82, damp = 0.35, wet = 0.3, tail = 1.5, width = 1, pre = 0.01 } = {}) {
  let L = L0, R = R0;
  const n = L.length + N(tail);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round(d * SR / 44100));
  const aps = [556, 441, 341, 225].map((d) => Math.round(d * SR / 44100));
  const run = (inp, spread) => {
    const out = new Float32Array(n);
    const p = N(pre);
    combs.forEach((d0) => { const d = d0 + spread; const b = new Float32Array(d); let idx = 0, f = 0; for (let i = 0; i < n; i++) { const xin = (i - p >= 0 && i - p < inp.length ? inp[i - p] : 0) * 0.015; const y = b[idx]; f = y * (1 - damp) + f * damp; b[idx] = xin + f * size; out[i] += y; idx = (idx + 1) % d; } });
    aps.forEach((d0) => { const d = d0 + spread; const b = new Float32Array(d); let idx = 0; for (let i = 0; i < n; i++) { const y = b[idx]; const v = out[i]; b[idx] = v + y * 0.5; out[i] = y - v; idx = (idx + 1) % d; } });
    return out;
  };
  // girişin sonunu yumuşat: kuru sinyal aniden kesilip tık sesi yapmasın
  { const f = Math.min(L.length, N(0.04)); L = Float32Array.from(L); R = Float32Array.from(R); for (let i = 0; i < f; i++) { const g = i / f; L[L.length - 1 - i] *= g; R[R.length - 1 - i] *= g; } }
  const m = new Float32Array(L.length); for (let i = 0; i < L.length; i++) m[i] = (L[i] + R[i]) * 0.5;
  const wl = run(m, 0), wr = run(m, 23);
  const oL = new Float32Array(n), oR = new Float32Array(n);
  const w1 = wet * (width / 2 + 0.5), w2 = wet * ((1 - width) / 2);
  for (let i = 0; i < n; i++) { const dl = i < L.length ? L[i] : 0, dr = i < R.length ? R[i] : 0; oL[i] = dl + wl[i] * w1 + wr[i] * w2; oR[i] = dr + wr[i] * w1 + wl[i] * w2; }
  return [oL, oR];
}

// mono -> stereo, pan fonksiyonu (-1..1) ve genişlik (Haas)
function pan(x, p = 0, haas = 0) {
  const L = new Float32Array(x.length), R = new Float32Array(x.length); const hd = N(haas);
  for (let i = 0; i < x.length; i++) { const pv = typeof p === 'function' ? p(i / SR) : p; const a = (clamp(pv, -1, 1) + 1) * Math.PI / 4; L[i] = x[i] * Math.cos(a); R[i] = (i >= hd ? x[i - hd] : 0) * Math.sin(a); }
  return [L, R];
}
const both = (x) => [x, Float32Array.from(x)];
function stmix(...ss) { const n = Math.max(...ss.map((s) => s[0].length)); const L = new Float32Array(n), R = new Float32Array(n); ss.forEach(([a, b]) => { for (let i = 0; i < a.length; i++) { L[i] += a[i]; R[i] += b[i]; } }); return [L, R]; }
const stgain = ([a, b], g) => [gain(a, g), gain(b, g)];
const stoff = ([a, b], sec, total) => [offset(a, sec, total), offset(b, sec, total)];

// Doppler: değişken gecikme ile perde kayması (geçen nesne)
function doppler(x, amount = 0.004, center = 0.5) {
  const o = new Float32Array(x.length); const T = x.length / SR;
  for (let i = 0; i < x.length; i++) { const t = i / SR; const d = amount * Math.tanh((t - center * T) * 8 / T) * SR; const j = i - (amount * SR) - d; const k = Math.floor(j), f = j - k; o[i] = (k >= 0 && k + 1 < x.length) ? x[k] * (1 - f) + x[k + 1] * f : 0; }
  return o;
}

// stutter / glitch: parçaları tekrar et, ters çevir, bit indir
function stutter(x, r, { slices = 8, repeatP = 0.5, revP = 0.2, crushP = 0.25 } = {}) {
  const n = x.length; const o = new Float32Array(n); const s = Math.floor(n / slices); let w = 0;
  let src = 0;
  while (w < n) {
    let len = Math.max(64, Math.floor(s * (0.25 + r() * 1.2)));
    let seg = x.subarray(src, Math.min(n, src + len));
    if (r() < revP) seg = rev(seg);
    if (r() < crushP) seg = crush(seg, 3 + Math.floor(r() * 4), 1 + Math.floor(r() * 6));
    const reps = r() < repeatP ? 1 + Math.floor(r() * 4) : 1;
    for (let k = 0; k < reps && w < n; k++) { for (let i = 0; i < seg.length && w < n; i++, w++) o[w] = seg[i] * (i < 48 ? i / 48 : i > seg.length - 48 ? (seg.length - i) / 48 : 1); }
    src = (src + len) % Math.max(1, n - len);
  }
  return o;
}

function normalize([L, R], peakDb = -1) {
  let p = 1e-9; for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  const g = Math.pow(10, peakDb / 20) / p;
  return [gain(L, g), gain(R, g)];
}
function trimTail([L, R], thrDb = -70) {
  const thr = Math.pow(10, thrDb / 20); let e = L.length - 1;
  while (e > 0 && Math.abs(L[e]) < thr && Math.abs(R[e]) < thr) e--;
  e = Math.min(L.length, e + N(0.02));
  return [fadeEdges(L.subarray(0, e), 0.001, 0.015), fadeEdges(R.subarray(0, e), 0.001, 0.015)];
}

function writeWav(file, [L, R]) {
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32767), 46 + i * 4); }
  fs.writeFileSync(file, b);
}

// ---------------- ses tarifleri ----------------
// Her tarif: (r, v) => stereo [L, R]; r: tohumlu rastgele, v: varyant parametreleri
const LIB = [];
const add = (cat, id, name, fn, tags = '') => LIB.push({ cat, id, name, fn, tags });

// ===== WHOOSH =====
function whoosh(r, { dur = 0.8, f0 = 300, f1 = 3000, f2 = 600, q = 1.2, peak = 0.45, color = 'pink', body = 0, panSweep = 0.9, tail = 0, metal = 0, low = 0 }) {
  const n = N(dur);
  let src = color === 'white' ? white(n, r) : color === 'brown' ? brown(n, r) : pink(n, r);
  const cut = (t) => { const u = t / dur; return u < peak ? expo(f0, f1, u / peak) : expo(f1, f2, (u - peak) / (1 - peak)); };
  let s = bp(src, cut, q);
  s = mix(s, gain(lp(src, (t) => cut(t) * 0.5, 0.7), 0.6));
  if (body) s = mix(s, gain(lp(brown(n, r), (t) => cut(t) * 0.25, 1.5), body));
  if (low) s = mix(s, gain(env(osc(n, 'sine', (t) => lerp(70, 45, t / dur)), (t) => Math.exp(-Math.pow((t / dur - peak) * 5, 2))), low));
  if (metal) s = mix(s, gain(resonator(gain(s, 0.4), [1830, 2440, 3310, 4150].map((f) => f * (0.8 + r() * 0.4)), [0.25, 0.2, 0.15, 0.12]), metal));
  s = env(s, (t) => { const u = t / dur; return u < peak ? Math.pow(u / peak, 2.2) : Math.pow(1 - (u - peak) / (1 - peak), 1.6); });
  s = doppler(s, 0.003, peak);
  let o = pan(s, (t) => panSweep * Math.tanh(((t / dur) - peak) * 4), 0.006);
  if (tail) o = reverb(o, { wet: tail, tail: 1.2, size: 0.8 });
  return o;
}
[
  ['whoosh_air', 'Whoosh · hava (orta)', { dur: 0.75 }],
  ['whoosh_fast', 'Whoosh · hızlı', { dur: 0.35, f1: 4200, peak: 0.5 }],
  ['whoosh_swish', 'Swish · çok kısa', { dur: 0.22, f0: 900, f1: 6500, f2: 2000, peak: 0.45, color: 'white', q: 1.6 }],
  ['whoosh_long', 'Whoosh · uzun', { dur: 1.6, f1: 2400, peak: 0.6 }],
  ['whoosh_deep', 'Whoosh · derin', { dur: 1.0, f0: 120, f1: 900, f2: 200, body: 0.8, color: 'brown', low: 0.5 }],
  ['whoosh_bright', 'Whoosh · parlak', { dur: 0.6, f0: 1500, f1: 9000, f2: 3000, color: 'white', q: 1.8 }],
  ['whoosh_cine', 'Whoosh · sinematik', { dur: 1.2, f0: 200, f1: 2200, f2: 300, body: 0.6, tail: 0.35, low: 0.6 }],
  ['whoosh_metal', 'Whoosh · metalik', { dur: 0.9, metal: 0.6, f1: 3500 }],
  ['whoosh_soft', 'Whoosh · yumuşak', { dur: 0.9, f0: 250, f1: 1400, f2: 300, q: 0.9 }],
  ['whoosh_tail', 'Whoosh · yankılı', { dur: 0.7, tail: 0.5 }],
  ['whoosh_wind', 'Whoosh · rüzgâr', { dur: 1.8, f0: 400, f1: 1800, f2: 500, q: 3.5, peak: 0.5 }],
  ['whoosh_up', 'Whoosh · yukarı', { dur: 0.5, f0: 300, f1: 7000, f2: 6000, peak: 0.85 }],
  ['whoosh_down', 'Whoosh · aşağı', { dur: 0.5, f0: 6000, f1: 6500, f2: 250, peak: 0.12 }],
  ['whoosh_pass', 'Geçip giden', { dur: 1.1, panSweep: 1, f1: 3000, peak: 0.5, body: 0.3 }],
  ['whoosh_sword', 'Kılıç savurma', { dur: 0.32, f0: 1800, f1: 7000, f2: 2500, q: 4, color: 'white', metal: 0.25 }],
  ['whoosh_heavy', 'Whoosh · ağır', { dur: 1.3, f0: 90, f1: 1400, f2: 150, body: 1, low: 1, color: 'brown' }],
].forEach(([id, n, p], k) => add('Whoosh', id, n, (r) => whoosh(r, p), 'whoosh swoosh geçiş transition'));
// çift ve üçlü whoosh
add('Whoosh', 'whoosh_double', 'Çift whoosh', (r) => stmix(whoosh(r, { dur: 0.4 }), stoff(whoosh(r, { dur: 0.45, f1: 4000 }), 0.22, 0.8)), 'whoosh');
add('Whoosh', 'whoosh_triple', 'Üçlü whoosh', (r) => stmix(whoosh(r, { dur: 0.3 }), stoff(whoosh(r, { dur: 0.3, f1: 3800 }), 0.17, 0.9), stoff(whoosh(r, { dur: 0.4, f1: 5200 }), 0.36, 0.9)), 'whoosh');
add('Whoosh', 'whoosh_hit', 'Whoosh + darbe', (r) => stmix(whoosh(r, { dur: 0.55, peak: 0.85 }), stoff(impact(r, { sub: 1, len: 1.2 }), 0.47, 1.9)), 'whoosh darbe impact');
add('Whoosh', 'whoosh_rev', 'Ters whoosh (emme)', (r) => { const [a, b] = whoosh(r, { dur: 0.9, peak: 0.25 }); return [rev(a), rev(b)]; }, 'reverse suck');
for (let k = 0; k < 6; k++) add('Whoosh', `whoosh_var${k + 1}`, `Whoosh · varyasyon ${k + 1}`, (r) => whoosh(r, { dur: 0.4 + r() * 0.9, f0: 150 + r() * 500, f1: 1500 + r() * 5000, f2: 200 + r() * 1200, q: 0.8 + r() * 2, peak: 0.35 + r() * 0.35, color: ['pink', 'white', 'brown'][Math.floor(r() * 3)], body: r() * 0.5, tail: r() * 0.3 }), 'whoosh');

// ===== RISER =====
function riser(r, { dur = 3, kind = 'noise', top = 9000, bottom = 200, tonal = 0, f0 = 110, f1 = 880, shepard = 0, wobble = 0, end = 'cut' }) {
  const n = N(dur);
  const u = (t) => clamp(t / dur, 0, 1);
  let s = new Float32Array(n);
  if (kind === 'noise' || kind === 'mix') {
    const nz = white(n, r);
    s = mix(s, gain(bp(nz, (t) => expo(bottom, top, Math.pow(u(t), 1.4)), (t) => 0.8 + u(t) * 3), 1.2), gain(hp(nz, (t) => expo(bottom * 2, top, u(t))), 0.25));
  }
  if (tonal || kind === 'tone') {
    const det = [-0.12, -0.05, 0, 0.06, 0.13];
    let tn = new Float32Array(n);
    det.forEach((d) => { tn = mix(tn, osc(n, 'saw', (t) => expo(f0, f1, Math.pow(u(t), 1.6)) * Math.pow(2, d / 12) * (1 + wobble * 0.02 * Math.sin(TAU * lerp(3, 14, u(t)) * t)), r())); });
    tn = lp(tn, (t) => expo(400, 9000, u(t)), 1.2);
    s = mix(s, gain(tn, (tonal || 1) * 0.25));
  }
  if (shepard) {
    // Shepard tonu: oktavlar boyunca sonsuz yükselme hissi
    let sh = new Float32Array(n);
    for (let o = 0; o < 6; o++) {
      const ph = { v: 0 };
      const w = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / SR; const pos = ((o + (t / dur) * 2) % 6) / 6; const f = 55 * Math.pow(2, pos * 6); const a = Math.sin(Math.PI * pos) ** 2; ph.v += f / SR; w[i] = Math.sin(TAU * ph.v) * a; }
      sh = mix(sh, w);
    }
    s = mix(s, gain(sh, shepard * 0.35));
  }
  s = env(s, (t) => Math.pow(u(t), 1.8) * (end === 'cut' ? (t > dur - 0.01 ? (dur - t) / 0.01 : 1) : 1));
  let o = pan(s, (t) => 0.3 * Math.sin(TAU * lerp(0.3, 4, u(t)) * t), 0.008);
  o = reverb(o, { wet: 0.22, tail: 0.6 });
  return o;
}
[
  ['riser_noise2', 'Riser · gürültü 2 sn', { dur: 2 }],
  ['riser_noise4', 'Riser · gürültü 4 sn', { dur: 4 }],
  ['riser_noise8', 'Riser · gürültü 8 sn', { dur: 8, top: 12000 }],
  ['riser_tone2', 'Riser · tonal 2 sn', { dur: 2, kind: 'mix', tonal: 1, f0: 98, f1: 784 }],
  ['riser_tone4', 'Riser · tonal 4 sn', { dur: 4, kind: 'mix', tonal: 1, f0: 82, f1: 1046 }],
  ['riser_epic', 'Riser · epik', { dur: 5, kind: 'mix', tonal: 1.4, f0: 55, f1: 880, wobble: 1, shepard: 0.6 }],
  ['riser_shepard', 'Riser · Shepard (sonsuz)', { dur: 6, kind: 'none', shepard: 1.2 }],
  ['riser_short', 'Riser · kısa 1 sn', { dur: 1, top: 11000 }],
  ['riser_tension', 'Riser · gerilimli', { dur: 4, kind: 'mix', tonal: 1, f0: 110, f1: 932, wobble: 2 }],
  ['riser_wobble', 'Riser · dalgalı', { dur: 3, kind: 'mix', tonal: 1.2, wobble: 4, f0: 70, f1: 600 }],
  ['riser_air', 'Riser · havalı', { dur: 3, bottom: 600, top: 14000 }],
  ['riser_dark', 'Riser · karanlık', { dur: 4, top: 3500, bottom: 80, kind: 'mix', tonal: 0.8, f0: 41, f1: 220 }],
].forEach(([id, n, p]) => add('Riser', id, n, (r) => riser(r, p), 'riser build up yükselen gerilim'));
add('Riser', 'riser_rcymbal', 'Ters zil (reverse cymbal)', (r) => { const n = N(2.5); let x = hp(white(n, r), 3500); x = mix(x, gain(resonator(gain(x, 0.1), [5200, 6900, 8400, 10300], [0.5, 0.4, 0.4, 0.3]), 0.5)); x = decay(x, 0.7); const o = reverb(pan(x, 0, 0.01), { wet: 0.35, tail: 0.6 }); return [rev(o[0]), rev(o[1])]; }, 'reverse cymbal riser');
add('Riser', 'riser_hit', 'Riser + darbe', (r) => stmix(riser(r, { dur: 2.2, kind: 'mix', tonal: 1 }), stoff(impact(r, { sub: 1.2, len: 1.8 }), 2.18, 4.2)), 'riser impact drop');
add('Riser', 'riser_suck', 'Emme (reverse)', (r) => { const o = impact(r, { sub: 0.6, len: 1.4, tail: 0.5 }); return [rev(o[0]), rev(o[1])]; }, 'reverse suck');

// ===== DOWNLIFTER / DROP =====
function down(r, { dur = 2, top = 9000, bottom = 120, tonal = 0, f0 = 880, f1 = 55 }) {
  const n = N(dur); const u = (t) => t / dur;
  let s = bp(white(n, r), (t) => expo(top, bottom, Math.pow(u(t), 0.7)), 1.2);
  if (tonal) s = mix(s, gain(lp(osc(n, 'saw', (t) => expo(f0, f1, u(t))), 2500), tonal * 0.3));
  s = env(s, (t) => Math.pow(1 - u(t), 1.5) * Math.min(1, t / 0.01));
  return reverb(pan(s, (t) => -0.4 * Math.sin(TAU * t), 0.008), { wet: 0.25, tail: 0.8 });
}
add('Düşüş', 'down_noise', 'Downlifter · gürültü', (r) => down(r, {}), 'downlifter düşüş');
add('Düşüş', 'down_tone', 'Downlifter · tonal', (r) => down(r, { tonal: 1 }), 'downlifter');
add('Düşüş', 'down_long', 'Downlifter · uzun', (r) => down(r, { dur: 4, tonal: 0.6 }), 'downlifter');
function subdrop(r, { dur = 2, f0 = 140, f1 = 28, dist = 1.4 }) { const n = N(dur); let s = osc(n, 'sine', (t) => expo(f0, f1, Math.pow(t / dur, 0.6))); s = sat(s, dist); s = env(s, (t) => Math.min(1, t / 0.005) * Math.pow(1 - t / dur, 1.2)); return both(s); }
add('Düşüş', 'subdrop', 'Sub drop (bas düşüşü)', (r) => subdrop(r, {}), 'sub drop bass');
add('Düşüş', 'subdrop_long', 'Sub drop · uzun', (r) => subdrop(r, { dur: 3.5, f0: 110, f1: 25 }), 'sub drop');
add('Düşüş', 'subdrop_dirty', 'Sub drop · kirli', (r) => subdrop(r, { dist: 4 }), 'sub drop distortion');
add('Düşüş', 'tape_stop', 'Kaset durması', (r) => { const n = N(1.4); let s = mix(osc(n, 'saw', (t) => expo(220, 18, Math.pow(t / 1.4, 0.5))), gain(osc(n, 'saw', (t) => expo(330, 27, Math.pow(t / 1.4, 0.5))), 0.6)); s = lp(s, (t) => expo(5000, 200, t / 1.4)); s = env(s, (t) => 1 - t / 1.4); return both(s); }, 'tape stop');
add('Düşüş', 'power_down', 'Güç kesilmesi', (r) => { const n = N(1.6); let s = mix(osc(n, 'square', (t) => expo(600, 30, t / 1.6)), gain(white(n, r), 0.15)); s = lp(s, (t) => expo(6000, 150, t / 1.6)); s = env(s, (t) => 1 - t / 1.6); return reverb(both(s), { wet: 0.2 }); }, 'power down');
add('Düşüş', 'power_up', 'Güç gelmesi', (r) => { const n = N(1.4); let s = mix(osc(n, 'square', (t) => expo(40, 900, t / 1.4)), gain(white(n, r), 0.1)); s = lp(s, (t) => expo(200, 7000, t / 1.4)); s = env(s, (t) => Math.min(1, t / 0.05) * (t > 1.35 ? (1.4 - t) / 0.05 : 1)); return reverb(both(s), { wet: 0.2 }); }, 'power up');

// ===== DARBE / IMPACT =====
function impact(r, { sub = 1, len = 2, click = 1, body = 1, metal = 0, tail = 0.4, f0 = 110, f1 = 32, dist = 1.6, crack = 0.6 }) {
  const n = N(len);
  let s = new Float32Array(n);
  if (sub) s = mix(s, gain(env(osc(n, 'sine', (t) => f1 + (f0 - f1) * Math.exp(-t / 0.06)), (t) => Math.exp(-t / (len * 0.35))), sub));
  if (body) s = mix(s, gain(env(lp(brown(n, r), (t) => 200 + 2500 * Math.exp(-t / 0.05)), (t) => Math.exp(-t / 0.25)), body * 0.9));
  if (click) s = mix(s, gain(env(hp(white(n, r), 1500), (t) => Math.exp(-t / 0.008)), click * 0.6));
  if (crack) s = mix(s, gain(env(bp(white(n, r), 3200, 0.8), (t) => Math.exp(-t / 0.03)), crack * 0.5));
  if (metal) s = mix(s, gain(resonator(env(white(n, r), (t) => Math.exp(-t / 0.004)), [233, 411, 589, 787, 1190, 1612].map((f) => f * (0.9 + r() * 0.2)), [1.2, 0.9, 0.8, 0.6, 0.4, 0.3]), metal * 6));
  s = sat(s, dist);
  s = env(s, (t) => { const u = t / len; return u < 0.7 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (u - 0.7) / 0.3); });
  let o = pan(s, 0, 0.004);
  if (tail) o = reverb(o, { wet: tail, tail: 2, size: 0.86, damp: 0.5 });
  return o;
}
[
  ['impact_cine', 'Darbe · sinematik', { metal: 0.3, tail: 0.5 }],
  ['impact_boom', 'Boom · derin bas', { sub: 1.4, click: 0.5, body: 0.6, tail: 0.35, f0: 90, f1: 28, len: 2.5 }],
  ['impact_meme', 'Meme boom (vurgu)', { sub: 1.6, click: 0.9, body: 0.9, crack: 0.2, tail: 0.25, f0: 160, f1: 45, len: 1.6, dist: 2.4 }],
  ['impact_trailer', 'Fragman vuruşu', { sub: 1.3, metal: 0.6, tail: 0.6, len: 3.5 }],
  ['impact_punch', 'Yumruk', { sub: 0.7, click: 1, body: 1.3, metal: 0, tail: 0.1, len: 0.5, f0: 180, f1: 60, crack: 0.9 }],
  ['impact_thud', 'Tok vuruş', { sub: 0.9, click: 0.3, body: 1.2, tail: 0.1, len: 0.8, crack: 0.1 }],
  ['impact_metal', 'Metal darbe', { sub: 0.5, metal: 1.2, tail: 0.45, len: 3 }],
  ['impact_slam', 'Kapı çarpması / slam', { sub: 1, body: 1.4, crack: 1, tail: 0.5, len: 2 }],
  ['impact_light', 'Hafif vurgu', { sub: 0.5, click: 0.8, body: 0.4, tail: 0.2, len: 0.7, crack: 0.3 }],
  ['impact_huge', 'Dev darbe', { sub: 1.6, metal: 0.8, body: 1.2, tail: 0.7, len: 5, dist: 2.2 }],
  ['impact_dry', 'Kuru darbe', { sub: 1, tail: 0, len: 1 }],
  ['impact_glass', 'Cam kırılması (sentetik)', { sub: 0.2, body: 0.2, crack: 1.4, metal: 0.4, tail: 0.3, len: 1.5 }],
].forEach(([id, n, p]) => add('Darbe', id, n, (r) => impact(r, p), 'impact boom hit darbe vuruş'));
for (let k = 0; k < 8; k++) add('Darbe', `impact_var${k + 1}`, `Darbe · varyasyon ${k + 1}`, (r) => impact(r, { sub: 0.6 + r() * 1, metal: r() * 0.9, body: 0.5 + r(), tail: r() * 0.6, len: 1 + r() * 3, f0: 70 + r() * 150, f1: 25 + r() * 30, crack: r(), dist: 1.2 + r() * 2 }), 'impact');

// ===== BRAAM / SİNEMATİK =====
function braam(r, { dur = 3, root = 55, chord = [0, 7, 12, 15], bright = 2200, dist = 2.2, tail = 0.5 }) {
  const n = N(dur);
  let s = new Float32Array(n);
  chord.forEach((semi) => [-0.15, 0, 0.15].forEach((d) => { s = mix(s, osc(n, 'saw', root * Math.pow(2, (semi + d) / 12), r())); }));
  s = lp(s, (t) => 180 + bright * Math.exp(-t / 0.45) + 300 * Math.exp(-t / 2), 1.6);
  s = sat(s, dist);
  s = env(s, (t) => Math.min(1, t / 0.04) * Math.exp(-t / (dur * 0.45)));
  return reverb(pan(s, 0, 0.012), { wet: tail, tail: 2.4, size: 0.88 });
}
add('Sinematik', 'braam', 'Braam (fragman)', (r) => braam(r, {}), 'braam inception sinematik');
add('Sinematik', 'braam_dark', 'Braam · karanlık', (r) => braam(r, { root: 41, chord: [0, 7, 12, 13], bright: 1400 }), 'braam');
add('Sinematik', 'braam_long', 'Braam · uzun', (r) => braam(r, { dur: 6, root: 49 }), 'braam');
add('Sinematik', 'braam_hit', 'Braam + darbe', (r) => stmix(braam(r, { dur: 4 }), impact(r, { sub: 1.2, tail: 0.3, len: 3 })), 'braam impact');
add('Sinematik', 'dundun', 'Dun dun dunnn (dramatik)', (r) => { const a = braam(r, { dur: 0.6, root: 55, chord: [0, 7, 12], tail: 0.2 }), b = braam(r, { dur: 0.6, root: 52, chord: [0, 7, 12], tail: 0.2 }), c = braam(r, { dur: 2.8, root: 46, chord: [0, 7, 12, 15], tail: 0.5 }); return stmix(a, stoff(b, 0.55, 4.5), stoff(c, 1.1, 4.5)); }, 'dramatic dun');
add('Sinematik', 'stinger_horror', 'Korku vurgusu (stinger)', (r) => { const n = N(2.5); let s = new Float32Array(n); [0, 1, 6, 11, 13].forEach((k) => { s = mix(s, osc(n, 'saw', (t) => 220 * Math.pow(2, k / 12) * (1 + 0.004 * Math.sin(TAU * (5 + k) * t)), r())); }); s = bp(s, 1800, 0.7); s = env(s, (t) => Math.min(1, t / 0.01) * Math.exp(-t / 1)); return stmix(reverb(pan(s, 0, 0.01), { wet: 0.5, tail: 2 }), impact(r, { sub: 0.8, len: 2, tail: 0.3 })); }, 'horror korku stinger');
add('Sinematik', 'boom_rumble', 'Uzak gümbürtü', (r) => { const n = N(4); let s = lp(brown(n, r), (t) => 120 + 200 * Math.exp(-t / 0.5), 1); s = env(s, (t) => Math.min(1, t / 0.08) * Math.exp(-t / 1.4)); return reverb(pan(gain(s, 2), 0, 0.02), { wet: 0.4, tail: 2 }); }, 'rumble thunder');
add('Sinematik', 'heartbeat', 'Kalp atışı', (r) => { const one = (o) => stoff(both(env(osc(N(0.35), 'sine', (t) => 50 + 40 * Math.exp(-t / 0.04)), (t) => Math.exp(-t / 0.09))), o, 2.4); return stmix(one(0), stgain(one(0.24), 0.7), one(1.2), stgain(one(1.44), 0.7)); }, 'heartbeat kalp');
add('Sinematik', 'slowmo', 'Ağır çekime geçiş', (r) => { const n = N(2); let s = lp(mix(pink(n, r), gain(osc(n, 'saw', (t) => expo(300, 40, t / 2)), 0.4)), (t) => expo(6000, 300, t / 2)); s = env(s, (t) => Math.min(1, t / 0.02) * (1 - t / 2)); return reverb(both(s), { wet: 0.5, tail: 1.5 }); }, 'slow motion');
add('Sinematik', 'time_freeze', 'Zaman donması', (r) => { const n = N(2.4); let s = mix(gain(hp(white(n, r), 6000), 0.4), gain(osc(n, 'sine', (t) => expo(2600, 3200, t / 2.4)), 0.25), gain(osc(n, 'sine', 3910), 0.15)); s = env(s, (t) => Math.min(1, t / 0.005) * Math.exp(-t / 0.9)); return reverb(pan(s, 0, 0.01), { wet: 0.6, tail: 2.2 }); }, 'freeze shimmer');

// ===== GERİLİM / DRONE =====
function drone(r, { dur = 8, root = 55, notes = [0, 0.18, 7, 12.1], mod = 0.12, dark = 900, pulse = 0, noise = 0.15 }) {
  const n = N(dur);
  let s = new Float32Array(n);
  notes.forEach((k, i) => { s = mix(s, gain(osc(n, i % 2 ? 'saw' : 'tri', (t) => root * Math.pow(2, k / 12) * (1 + 0.003 * Math.sin(TAU * (0.1 + i * 0.07) * t)), r()), 1 / notes.length)); });
  s = lp(s, (t) => dark * (1 + mod * Math.sin(TAU * 0.13 * t)), 2);
  if (noise) s = mix(s, gain(lp(pink(n, r), 600), noise));
  if (pulse) s = am(s, pulse, 0.7);
  s = env(s, (t) => Math.min(1, t / 1.2) * Math.min(1, (dur - t) / 1.5));
  return reverb(pan(s, (t) => 0.25 * Math.sin(TAU * 0.07 * t), 0.015), { wet: 0.35, tail: 2.5 });
}
[
  ['tension_drone', 'Gerilim · alçak drone', {}],
  ['tension_dark', 'Gerilim · karanlık', { root: 41, notes: [0, 1, 7, 13], dark: 600 }],
  ['tension_pulse', 'Gerilim · nabız', { pulse: 2, dark: 1300 }],
  ['tension_fast', 'Gerilim · hızlanan nabız', { pulse: (t) => lerp(1.5, 7, t / 8), dark: 1500 }],
  ['tension_suspense', 'Gerilim · bekleyiş', { root: 65, notes: [0, 6, 11, 13], dark: 1100, noise: 0.25 }],
  ['tension_mystery', 'Gizem', { root: 73, notes: [0, 3, 7, 10, 14], dark: 1600, mod: 0.4 }],
  ['tension_horror', 'Korku atmosferi', { root: 46, notes: [0, 1, 6, 12.3], dark: 700, noise: 0.35, mod: 0.6 }],
  ['tension_space', 'Uzay boşluğu', { root: 82, notes: [0, 7, 12, 19], dark: 2400, mod: 0.5, noise: 0.05 }],
].forEach(([id, n, p]) => add('Gerilim', id, n, (r) => drone(r, p), 'tension gerilim suspense drone'));
add('Gerilim', 'tension_clock', 'Gerilim · saat tik-tak', (r) => { const total = 6; let o = drone(r, { dur: total, dark: 700 }); for (let k = 0; k < 12; k++) { const tk = env(hp(white(N(0.05), r), 2500), (t) => Math.exp(-t / 0.006)); o = stmix(o, stoff(both(gain(bp(tk, k % 2 ? 2200 : 3000, 2), 2.2)), k * 0.5, total + 2.5)); } return o; }, 'clock tick tension');
add('Gerilim', 'tension_strings', 'Gerilim · titreyen yaylı', (r) => { const n = N(6); let s = new Float32Array(n); [0, 1, 6].forEach((k) => { s = mix(s, osc(n, 'saw', (t) => 220 * Math.pow(2, k / 12) * (1 + 0.006 * Math.sin(TAU * 6.2 * t + k)), r())); }); s = am(s, 11, 0.6); s = bp(s, 1600, 0.6); s = env(s, (t) => Math.min(1, t / 0.8) * Math.min(1, (6 - t) / 1)); return reverb(pan(s, 0, 0.012), { wet: 0.45, tail: 2 }); }, 'tremolo strings tension');
add('Gerilim', 'tension_heart', 'Gerilim · kalp + drone', (r) => { let o = drone(r, { dur: 6, dark: 650 }); for (let k = 0; k < 6; k++) { o = stmix(o, stoff(both(env(osc(N(0.3), 'sine', (t) => 48 + 35 * Math.exp(-t / 0.04)), (t) => Math.exp(-t / 0.08))), k * 0.95, 8.5), stoff(both(gain(env(osc(N(0.3), 'sine', (t) => 45 + 30 * Math.exp(-t / 0.04)), (t) => Math.exp(-t / 0.08)), 0.7)), k * 0.95 + 0.22, 8.5)); } return o; }, 'heartbeat tension');

// ===== GLITCH & DİJİTAL =====
function glitchSrc(r, dur) {
  const n = N(dur);
  const a = osc(n, 'square', (t) => [180, 420, 960, 1320, 2600][Math.floor(t * 23) % 5] * (1 + 0.1 * Math.sin(TAU * 31 * t)), r());
  const b = bp(white(n, r), (t) => 500 + 4000 * ((Math.floor(t * 37) * 7) % 11) / 11, 3);
  const c = ring(osc(n, 'saw', 90), (t) => 300 + 2000 * Math.abs(Math.sin(TAU * 3 * t)));
  return mix(gain(a, 0.35), gain(b, 0.8), gain(c, 0.25));
}
function glitch(r, { dur = 0.6, slices = 10, bits = 6, down = 4, tail = 0.1 }) {
  let s = stutter(glitchSrc(r, dur), r, { slices, repeatP: 0.6, revP: 0.25, crushP: 0.4 });
  s = mix(crush(s, bits, down), gain(s, 0.4));
  s = env(s, (t) => Math.min(1, t / 0.003) * Math.min(1, (dur - t) / 0.02));
  let o = pan(s, (t) => (Math.floor(t * 17) % 3 - 1) * 0.6, 0.004);
  if (tail) o = reverb(o, { wet: tail, tail: 0.5 });
  return o;
}
[
  ['glitch_short', 'Glitch · kısa', { dur: 0.3 }],
  ['glitch_mid', 'Glitch · orta', { dur: 0.7 }],
  ['glitch_long', 'Glitch · uzun', { dur: 1.6, slices: 18 }],
  ['glitch_crunch', 'Glitch · çıtırtılı', { dur: 0.6, bits: 3, down: 8 }],
  ['glitch_soft', 'Glitch · yumuşak', { dur: 0.6, bits: 8, down: 2, tail: 0.3 }],
].forEach(([id, n, p]) => add('Glitch', id, n, (r) => glitch(r, p), 'glitch digital dijital bozulma'));
for (let k = 0; k < 10; k++) add('Glitch', `glitch_var${k + 1}`, `Glitch · varyasyon ${k + 1}`, (r) => glitch(r, { dur: 0.25 + r() * 1.1, slices: 6 + Math.floor(r() * 16), bits: 3 + Math.floor(r() * 6), down: 1 + Math.floor(r() * 9), tail: r() * 0.3 }), 'glitch');
add('Glitch', 'glitch_static', 'Parazit / statik', (r) => { const n = N(1.2); let s = mix(hp(white(n, r), 2000), gain(crush(white(n, r), 2, 30), 0.3)); s = am(s, (t) => 30 + 60 * r(), 0.8); s = env(s, (t) => Math.min(1, t / 0.005) * Math.min(1, (1.2 - t) / 0.05)); return pan(s, 0, 0.003); }, 'static noise tv');
add('Glitch', 'glitch_tv_off', 'Televizyon kapanması', (r) => { const n = N(0.9); let s = mix(gain(hp(white(n, r), 3000), 0.5), osc(n, 'sine', (t) => expo(15000, 60, t / 0.9))); s = env(s, (t) => Math.exp(-t / 0.25)); return both(s); }, 'tv off');
add('Glitch', 'glitch_data', 'Veri akışı', (r) => { const n = N(1.5); let s = new Float32Array(n); for (let i = 0; i < n; i += N(0.03)) { const f = 600 + Math.floor(r() * 12) * 180; const b = env(osc(N(0.025), 'square', f), (t) => Math.exp(-t / 0.01)); for (let j = 0; j < b.length && i + j < n; j++) s[i + j] += b[j] * 0.4; } return pan(s, (t) => Math.sin(TAU * 2 * t) * 0.5, 0); }, 'data computer beep');
add('Glitch', 'glitch_rewind', 'Geri sarma', (r) => { const n = N(1.4); let s = mix(osc(n, 'saw', (t) => 300 + 900 * Math.abs(Math.sin(TAU * 4 * t))), gain(white(n, r), 0.3)); s = bp(s, (t) => 900 + 2500 * Math.abs(Math.sin(TAU * 4 * t)), 1); s = env(s, (t) => Math.min(1, t / 0.05) * Math.min(1, (1.4 - t) / 0.1)); return both(s); }, 'rewind vhs');
add('Glitch', 'glitch_scratch', 'Plak cızırtısı', (r) => { const n = N(0.7); const s = mix(bp(white(n, r), (t) => 1000 + 2500 * Math.abs(Math.sin(TAU * 4.5 * t)), 1.5), gain(osc(n, 'saw', (t) => 120 + 380 * Math.abs(Math.sin(TAU * 4.5 * t))), 0.5)); return both(env(s, (t) => Math.min(1, t / 0.01) * Math.min(1, (0.7 - t) / 0.05))); }, 'record scratch vinyl');
add('Glitch', 'glitch_error', 'Sistem hatası', (r) => { const n = N(0.8); const s = crush(mix(osc(n, 'square', (t) => (Math.floor(t * 8) % 2 ? 180 : 140)), gain(white(n, r), 0.2)), 4, 6); return both(env(s, (t) => Math.min(1, t / 0.005) * Math.min(1, (0.8 - t) / 0.05))); }, 'error system');
add('Glitch', 'glitch_vhs', 'VHS bozulması', (r) => { const n = N(1.3); let s = mix(gain(hp(white(n, r), 4000), 0.4), gain(osc(n, 'sine', (t) => 15734 / 4 * (1 + 0.02 * Math.sin(TAU * 7 * t))), 0.05), gain(lp(pink(n, r), 400), 0.6)); s = am(s, 9, 0.5); s = env(s, (t) => Math.min(1, t / 0.02) * Math.min(1, (1.3 - t) / 0.1)); return pan(s, 0, 0.004); }, 'vhs tape');

// ===== GEÇİŞ / POP / UI =====
function pop(r, { f0 = 900, f1 = 220, d = 0.08, noise = 0.2 }) { const n = N(d * 3); let s = osc(n, 'sine', (t) => f1 + (f0 - f1) * Math.exp(-t / (d * 0.3))); s = mix(s, gain(env(hp(white(n, r), 2000), (t) => Math.exp(-t / 0.003)), noise)); s = env(s, (t) => Math.min(1, t / 0.0015) * Math.exp(-t / d)); return pan(s, 0, 0); }
add('Pop & Tık', 'pop', 'Pop', (r) => pop(r, {}), 'pop');
add('Pop & Tık', 'pop_high', 'Pop · ince', (r) => pop(r, { f0: 1800, f1: 600, d: 0.05 }), 'pop');
add('Pop & Tık', 'pop_low', 'Pop · tok', (r) => pop(r, { f0: 500, f1: 120, d: 0.1 }), 'pop');
add('Pop & Tık', 'bubble', 'Baloncuk', (r) => pop(r, { f0: 300, f1: 1400, d: 0.07, noise: 0 }), 'bubble');
add('Pop & Tık', 'bubbles', 'Baloncuklar', (r) => { let o = both(new Float32Array(N(1))); for (let k = 0; k < 7; k++) o = stmix(o, stoff(pop(r, { f0: 250 + r() * 300, f1: 900 + r() * 1200, d: 0.05, noise: 0 }), k * 0.11 + r() * 0.05, 1.2)); return o; }, 'bubbles');
add('Pop & Tık', 'click', 'Tık', (r) => both(env(bp(white(N(0.04), r), 3500, 2), (t) => Math.exp(-t / 0.004))), 'click');
add('Pop & Tık', 'click_soft', 'Tık · yumuşak', (r) => both(env(lp(osc(N(0.05), 'sine', 1200), 3000), (t) => Math.exp(-t / 0.008))), 'click');
add('Pop & Tık', 'tick', 'Tik', (r) => both(env(hp(white(N(0.03), r), 4000), (t) => Math.exp(-t / 0.003))), 'tick');
add('Pop & Tık', 'swipe', 'Kaydırma (swipe)', (r) => whoosh(r, { dur: 0.25, f0: 1500, f1: 5000, f2: 3000, color: 'white', q: 2, peak: 0.4 }), 'swipe ui');
add('Pop & Tık', 'whip', 'Kamçı / hızlı geçiş', (r) => stmix(whoosh(r, { dur: 0.18, f0: 2000, f1: 9000, f2: 4000, color: 'white', peak: 0.8 }), stoff(both(env(hp(white(N(0.05), r), 3000), (t) => Math.exp(-t / 0.006))), 0.15, 0.3)), 'whip crack');
add('Pop & Tık', 'snap', 'Parmak şıklatma', (r) => both(mix(env(bp(white(N(0.1), r), 2600, 1.4), (t) => Math.exp(-t / 0.012)), gain(env(osc(N(0.1), 'sine', 1800), (t) => Math.exp(-t / 0.01)), 0.3))), 'snap');
add('Pop & Tık', 'clap', 'El çırpma', (r) => { let s = new Float32Array(N(0.4)); [0, 0.011, 0.02, 0.032].forEach((o) => { const b = env(bp(white(N(0.3), r), 1400, 1), (t) => Math.exp(-t / (o > 0.03 ? 0.09 : 0.006))); for (let i = 0; i < b.length; i++) { const j = i + N(o); if (j < s.length) s[j] += b[i]; } }); return reverb(both(s), { wet: 0.2, tail: 0.4 }); }, 'clap');
add('Pop & Tık', 'keyboard', 'Klavye yazma', (r) => { const total = 2; let o = both(new Float32Array(N(total))); let t = 0.02; while (t < total - 0.1) { const k = both(gain(env(mix(bp(white(N(0.05), r), 2200 + r() * 1800, 2), gain(osc(N(0.05), 'sine', 160 + r() * 60), 0.3)), (x) => Math.exp(-x / 0.008)), 0.6 + r() * 0.4)); o = stmix(o, stoff(k, t, total)); t += 0.06 + r() * 0.12; } return o; }, 'typing keyboard');
add('Pop & Tık', 'camera', 'Fotoğraf makinesi', (r) => { const a = env(bp(white(N(0.08), r), 3000, 1.2), (t) => Math.exp(-t / 0.01)); const b = env(bp(white(N(0.12), r), 2200, 1), (t) => Math.exp(-t / 0.02)); return reverb(both(mix(a, offset(b, 0.07, 0.25))), { wet: 0.1, tail: 0.3 }); }, 'camera shutter');
add('Pop & Tık', 'mouse', 'Fare tıklaması', (r) => both(mix(env(bp(white(N(0.03), r), 4500, 2), (t) => Math.exp(-t / 0.002)), offset(gain(env(bp(white(N(0.03), r), 3500, 2), (t) => Math.exp(-t / 0.002)), 0.6), 0.07, 0.12))), 'mouse click');
add('Pop & Tık', 'phone_vibrate', 'Telefon titreşimi', (r) => { const n = N(1.3); let s = mix(osc(n, 'square', 160), gain(osc(n, 'square', 163), 0.7)); s = lp(s, 600); s = env(s, (t) => ((t % 0.65) < 0.4 ? 1 : 0) * Math.min(1, (t % 0.65) / 0.01)); return both(gain(s, 0.6)); }, 'vibrate phone');
add('Pop & Tık', 'laser', 'Lazer / zap', (r) => { const n = N(0.4); return both(env(osc(n, 'square', (t) => expo(3000, 150, t / 0.4)), (t) => Math.exp(-t / 0.12))); }, 'laser zap');
add('Pop & Tık', 'scanner', 'Tarama (scanner)', (r) => { const n = N(1.5); const s = mix(gain(osc(n, 'sine', (t) => 900 + 500 * Math.sin(TAU * 1.3 * t)), 0.4), gain(bp(white(n, r), (t) => 2000 + 1200 * Math.sin(TAU * 1.3 * t), 3), 0.4)); return pan(env(s, (t) => Math.min(1, t / 0.05) * Math.min(1, (1.5 - t) / 0.1)), (t) => Math.sin(TAU * 1.3 * t) * 0.7, 0); }, 'scan sci-fi');

// ===== BİLDİRİM / ZİL =====
function bell(r, { f = 880, ratios = [1, 2.76, 5.4, 8.93], dec = 1.2, fm = 0 }) {
  const n = N(dec * 2.5);
  let s = new Float32Array(n);
  ratios.forEach((k, i) => { s = mix(s, gain(env(osc(n, 'sine', (t) => f * k * (1 + fm * 0.002 * Math.sin(TAU * 5 * t))), (t) => Math.exp(-t / (dec / (1 + i * 0.8)))), 1 / (1 + i))); });
  s = env(s, (t) => Math.min(1, t / 0.002));
  return reverb(pan(s, 0, 0.004), { wet: 0.25, tail: 1 });
}
add('Bildirim', 'ding', 'Ding', (r) => bell(r, { f: 1320, dec: 0.8 }), 'ding notification');
add('Bildirim', 'ding_soft', 'Ding · yumuşak', (r) => bell(r, { f: 880, ratios: [1, 2, 3], dec: 1 }), 'ding');
add('Bildirim', 'chime', 'Çan sesi', (r) => bell(r, { f: 660, dec: 2 }), 'chime');
add('Bildirim', 'dingdong', 'Ding-dong', (r) => stmix(bell(r, { f: 784, ratios: [1, 2, 3], dec: 0.9 }), stoff(bell(r, { f: 622, ratios: [1, 2, 3], dec: 1.2 }), 0.35, 3.5)), 'doorbell');
add('Bildirim', 'notify', 'Bildirim (mesaj)', (r) => stmix(bell(r, { f: 1046, ratios: [1, 2], dec: 0.25 }), stoff(bell(r, { f: 1568, ratios: [1, 2], dec: 0.4 }), 0.09, 1.5)), 'message notification');
add('Bildirim', 'success', 'Başarı', (r) => { let o = both(new Float32Array(N(1.6))); [523, 659, 784, 1046].forEach((f, k) => { o = stmix(o, stoff(bell(r, { f, ratios: [1, 2, 3], dec: 0.5 }), k * 0.09, 2)); }); return o; }, 'success win level up');
add('Bildirim', 'correct', 'Doğru cevap', (r) => stmix(bell(r, { f: 880, ratios: [1, 2], dec: 0.3 }), stoff(bell(r, { f: 1318, ratios: [1, 2], dec: 0.5 }), 0.12, 1.5)), 'correct');
add('Bildirim', 'wrong', 'Yanlış cevap (buzzer)', (r) => { const n = N(0.7); let s = mix(osc(n, 'saw', 110), osc(n, 'saw', 116)); s = lp(s, 1400); return both(env(s, (t) => Math.min(1, t / 0.01) * Math.min(1, (0.7 - t) / 0.05))); }, 'wrong buzzer');
add('Bildirim', 'coin', 'Para / jeton', (r) => { const n = N(0.6); const s = env(osc(n, 'square', (t) => (t < 0.07 ? 988 : 1318)), (t) => Math.exp(-t / 0.18)); return both(lp(s, 6000)); }, 'coin');
add('Bildirim', 'cash', 'Kasa (ça-çing)', (r) => stmix(both(env(bp(white(N(0.15), r), 3000, 1), (t) => Math.exp(-t / 0.03))), stoff(bell(r, { f: 2093, ratios: [1, 1.5, 2.76], dec: 0.7 }), 0.08, 1.8)), 'cash register money');
add('Bildirim', 'levelup', 'Seviye atlama', (r) => { let o = both(new Float32Array(N(1.2))); [523, 659, 784, 1046, 1318].forEach((f, k) => { o = stmix(o, stoff(both(env(lp(osc(N(0.2), 'square', f), 5000), (t) => Math.exp(-t / 0.08))), k * 0.07, 1.3)); }); return reverb(o, { wet: 0.2 }); }, 'level up game');
add('Bildirim', 'subscribe_bell', 'Abone zili', (r) => stmix(bell(r, { f: 1760, dec: 0.6 }), stoff(bell(r, { f: 1760, dec: 0.9 }), 0.18, 2.4)), 'bell subscribe');
add('Bildirim', 'sparkle', 'Parıltı (sihir)', (r) => { let o = both(new Float32Array(N(1.6))); for (let k = 0; k < 14; k++) o = stmix(o, stoff(stgain(bell(r, { f: 1800 + r() * 3200, ratios: [1, 2.4], dec: 0.25 }), 0.5), k * 0.06 + r() * 0.03, 2)); return o; }, 'sparkle magic shine');
add('Bildirim', 'countdown', 'Geri sayım bip', (r) => { let o = both(new Float32Array(N(3.6))); [0, 1, 2].forEach((k) => { o = stmix(o, stoff(both(env(osc(N(0.15), 'sine', 880), (t) => Math.min(1, t / 0.005) * (t < 0.12 ? 1 : 0))), k, 3.6)); }); return stmix(o, stoff(both(env(osc(N(0.5), 'sine', 1760), (t) => Math.min(1, t / 0.005) * (t < 0.45 ? 1 : 0))), 3, 3.6)); }, 'countdown beep');

// ===== KOMİK / MEME =====
add('Komik', 'boing', 'Boing (yay)', (r) => { const n = N(0.9); const s = env(osc(n, 'sine', (t) => 180 + 90 * Math.sin(TAU * 11 * t) * Math.exp(-t / 0.3) + 120 * Math.exp(-t / 0.2)), (t) => Math.exp(-t / 0.35)); return both(s); }, 'boing spring cartoon');
add('Komik', 'slide_up', 'Kaydıraklı düdük · yukarı', (r) => { const n = N(0.8); return both(env(osc(n, 'sine', (t) => expo(400, 1800, t / 0.8) * (1 + 0.01 * Math.sin(TAU * 7 * t))), (t) => Math.min(1, t / 0.03) * Math.min(1, (0.8 - t) / 0.05))); }, 'slide whistle');
add('Komik', 'slide_down', 'Kaydıraklı düdük · aşağı', (r) => { const n = N(0.8); return both(env(osc(n, 'sine', (t) => expo(1800, 300, t / 0.8) * (1 + 0.01 * Math.sin(TAU * 7 * t))), (t) => Math.min(1, t / 0.03) * Math.min(1, (0.8 - t) / 0.05))); }, 'slide whistle fall');
add('Komik', 'cartoon_fall', 'Çizgi film düşüşü', (r) => { const n = N(1.5); return stmix(both(env(osc(n, 'sine', (t) => expo(1500, 200, t / 1.3)), (t) => Math.min(1, t / 0.02) * (t < 1.3 ? 1 : 0))), stoff(impact(r, { sub: 0.8, body: 1, tail: 0.1, len: 0.6, crack: 0.3 }), 1.3, 2)); }, 'cartoon fall');
add('Komik', 'sad_trombone', 'Hüzünlü trombon', (r) => { let o = both(new Float32Array(N(2.6))); [[0, 233, 0.45], [0.48, 220, 0.45], [0.96, 208, 0.45], [1.44, 196, 1.1]].forEach(([st0, f, d], k) => { const n = N(d); let s = mix(osc(n, 'saw', (t) => f * (1 + (k === 3 ? 0.012 * Math.sin(TAU * 5.5 * t) : 0))), gain(osc(n, 'square', f / 2), 0.3)); s = lp(s, (t) => 900 + 600 * Math.exp(-t / 0.15), 2); s = env(s, (t) => Math.min(1, t / 0.04) * Math.min(1, (d - t) / 0.08)); o = stmix(o, stoff(both(s), st0, 2.6)); }); return reverb(o, { wet: 0.2 }); }, 'sad trombone fail');
add('Komik', 'airhorn', 'Korna (air horn)', (r) => { const n = N(1.5); let s = new Float32Array(n); [466, 554, 698].forEach((f) => { s = mix(s, osc(n, 'saw', (t) => f * (1 + 0.004 * Math.sin(TAU * 6 * t)), r())); }); s = sat(lp(s, 3500, 1.5), 3); s = env(s, (t) => Math.min(1, t / 0.02) * (((t % 0.5) < 0.38 || t > 1) ? 1 : 0.05) * Math.min(1, (1.5 - t) / 0.06)); return reverb(pan(s, 0, 0.006), { wet: 0.2 }); }, 'air horn mlg');
add('Komik', 'drumroll', 'Davul çalışı + zil', (r) => { const total = 3.2; let s = new Float32Array(N(total)); for (let t = 0; t < 2.4; t += 0.045 + 0.01 * r()) { const b = env(bp(white(N(0.06), r), 1800, 0.9), (x) => Math.exp(-x / 0.02)); for (let i = 0; i < b.length; i++) { const j = i + N(t); if (j < s.length) s[j] += b[i] * (0.4 + t / 4); } } const crash = env(hp(white(N(2), r), 4000), (x) => Math.exp(-x / 0.6)); const kick = env(osc(N(0.4), 'sine', (x) => 50 + 100 * Math.exp(-x / 0.03)), (x) => Math.exp(-x / 0.12)); s = mix(s, offset(gain(crash, 0.8), 2.45, total), offset(kick, 2.45, total)); return reverb(pan(s, 0, 0.005), { wet: 0.25 }); }, 'drum roll');
add('Komik', 'rimshot', 'Ba-dum-tss', (r) => { const total = 1.4; const sn = (o) => offset(env(mix(bp(white(N(0.2), r), 2000, 0.8), gain(osc(N(0.2), 'sine', 190), 0.5)), (x) => Math.exp(-x / 0.05)), o, total); const kick = offset(env(osc(N(0.4), 'sine', (x) => 50 + 110 * Math.exp(-x / 0.03)), (x) => Math.exp(-x / 0.15)), 0.18, total); const hat = offset(env(hp(white(N(1), r), 6000), (x) => Math.exp(-x / 0.25)), 0.36, total); return reverb(both(mix(sn(0), gain(sn(0.12), 0.8), kick, gain(hat, 0.7))), { wet: 0.2 }); }, 'rimshot joke');
add('Komik', 'cricket', 'Cırcır böceği (sessizlik)', (r) => { const total = 3; let s = new Float32Array(N(total)); for (let k = 0; k < 4; k++) { const st0 = 0.2 + k * 0.7; for (let c = 0; c < 3; c++) { const b = env(osc(N(0.05), 'sine', 4300), (x) => Math.sin(Math.PI * x / 0.05)); const j0 = N(st0 + c * 0.065); for (let i = 0; i < b.length && j0 + i < s.length; i++) s[j0 + i] += b[i] * 0.4; } } return reverb(both(s), { wet: 0.25 }); }, 'cricket awkward silence');
add('Komik', 'honk', 'Klakson (komik)', (r) => { const n = N(0.5); let s = mix(osc(n, 'square', 380), osc(n, 'square', 395)); s = bp(s, 900, 1.2); return both(env(s, (t) => Math.min(1, t / 0.01) * Math.min(1, (0.5 - t) / 0.03))); }, 'honk clown');
add('Komik', 'squeak', 'Gıcırtı oyuncak', (r) => { const n = N(0.35); return both(env(osc(n, 'sine', (t) => 1400 + 600 * Math.sin(Math.PI * t / 0.35)), (t) => Math.sin(Math.PI * t / 0.35))); }, 'squeak toy');
add('Komik', 'wah', 'Wah wah', (r) => { const n = N(1.4); let s = osc(n, 'saw', 196); s = bp(s, (t) => 400 + 1400 * Math.abs(Math.sin(TAU * 1.4 * t)), 3); return both(env(s, (t) => Math.min(1, t / 0.02) * Math.min(1, (1.4 - t) / 0.1))); }, 'wah fail');
add('Komik', 'bonk', 'Bonk (kafaya)', (r) => both(mix(env(osc(N(0.4), 'sine', (t) => 600 * Math.exp(-t / 0.3) + 300), (t) => Math.exp(-t / 0.1)), gain(env(bp(white(N(0.1), r), 1800, 3), (t) => Math.exp(-t / 0.01)), 0.6))), 'bonk');

// ===== SPOR =====
add('Spor', 'whistle', 'Hakem düdüğü', (r) => { const n = N(0.9); let s = mix(osc(n, 'sine', (t) => 3150 * (1 + 0.012 * Math.sin(TAU * 32 * t))), gain(bp(white(n, r), 3150, 6), 0.4)); s = env(s, (t) => Math.min(1, t / 0.02) * Math.min(1, (0.9 - t) / 0.04)); return reverb(both(s), { wet: 0.15 }); }, 'whistle referee');
add('Spor', 'whistle_triple', 'Hakem düdüğü · maç sonu', (r) => { let o = both(new Float32Array(N(2.4))); [[0, 0.35], [0.5, 0.35], [1, 1.1]].forEach(([s0, d]) => { const n = N(d); let s = mix(osc(n, 'sine', (t) => 3150 * (1 + 0.012 * Math.sin(TAU * 32 * t))), gain(bp(white(n, r), 3150, 6), 0.4)); s = env(s, (t) => Math.min(1, t / 0.02) * Math.min(1, (d - t) / 0.04)); o = stmix(o, stoff(both(s), s0, 2.4)); }); return reverb(o, { wet: 0.15 }); }, 'whistle full time');
add('Spor', 'crowd_cheer', 'Tribün coşkusu', (r) => { const n = N(5); let s = mix(bp(pink(n, r), 900, 0.5), gain(bp(pink(n, r), 2200, 0.8), 0.6)); s = am(s, 3.3, 0.25); s = env(s, (t) => Math.min(1, t / 0.4) * (0.7 + 0.3 * Math.sin(TAU * 0.4 * t)) * Math.min(1, (5 - t) / 1)); return reverb(pan(s, (t) => 0.3 * Math.sin(TAU * 0.2 * t), 0.02), { wet: 0.4, tail: 1.5 }); }, 'crowd cheer stadium');
add('Spor', 'crowd_goal', 'Gol anı tribün', (r) => { const n = N(6); let s = mix(bp(pink(n, r), 1000, 0.5), gain(bp(pink(n, r), 2500, 0.7), 0.8)); s = env(s, (t) => (t < 0.3 ? 0.3 + t * 2.3 : 1) * Math.min(1, (6 - t) / 1.5)); return reverb(pan(s, 0, 0.02), { wet: 0.45, tail: 2 }); }, 'goal crowd roar');
add('Spor', 'crowd_ooh', 'Tribün "ooo" (kaçan pozisyon)', (r) => { const n = N(2.5); let s = mix(bp(pink(n, r), (t) => 500 + 300 * Math.sin(Math.PI * t / 2.5), 2), gain(bp(pink(n, r), 1200, 1), 0.3)); s = env(s, (t) => Math.sin(Math.PI * Math.min(1, t / 2.5))); return reverb(pan(s, 0, 0.02), { wet: 0.4, tail: 1.5 }); }, 'crowd ooh miss');
add('Spor', 'crowd_boo', 'Yuhalama', (r) => { const n = N(3); let s = bp(pink(n, r), 350, 2); s = mix(s, gain(osc(n, 'saw', (t) => 140 + 5 * Math.sin(TAU * 3 * t)), 0.05)); s = lp(s, 900); s = env(s, (t) => Math.min(1, t / 0.4) * Math.min(1, (3 - t) / 0.8)); return reverb(pan(s, 0, 0.02), { wet: 0.4 }); }, 'boo crowd');
add('Spor', 'goal_horn', 'Gol sireni', (r) => { const n = N(2.6); let s = new Float32Array(n); [233, 277, 349].forEach((f) => { s = mix(s, osc(n, 'saw', f, r())); }); s = sat(lp(s, 2000, 1.2), 2.5); s = env(s, (t) => Math.min(1, t / 0.05) * Math.min(1, (2.6 - t) / 0.3)); return reverb(pan(s, 0, 0.01), { wet: 0.5, tail: 2 }); }, 'goal horn');
add('Spor', 'ball_kick', 'Topa vuruş', (r) => impact(r, { sub: 0.6, body: 1, click: 1.2, crack: 0.8, tail: 0.15, len: 0.6, f0: 220, f1: 90 }), 'kick ball');
add('Spor', 'net_swish', 'Fileye giriş', (r) => whoosh(r, { dur: 0.45, f0: 1200, f1: 5000, f2: 900, color: 'white', q: 1, peak: 0.3 }), 'net swish');
add('Spor', 'stadium_ambience', 'Stadyum atmosferi', (r) => { const n = N(10); let s = mix(bp(pink(n, r), 700, 0.4), gain(bp(pink(n, r), 2000, 0.6), 0.4)); s = am(s, 0.3, 0.2); s = env(s, (t) => Math.min(1, t / 1) * Math.min(1, (10 - t) / 1)); return reverb(pan(s, 0, 0.03), { wet: 0.5, tail: 2 }); }, 'stadium ambience crowd');

// ===== ORTAM =====
add('Ortam', 'rain', 'Yağmur', (r) => { const n = N(8); let s = mix(gain(hp(white(n, r), 1200), 0.3), gain(lp(pink(n, r), 3000), 0.4)); for (let k = 0; k < 140; k++) { const d = env(bp(white(N(0.02), r), 2000 + r() * 4000, 3), (t) => Math.exp(-t / 0.004)); const j0 = Math.floor(r() * (n - d.length)); for (let i = 0; i < d.length; i++) s[j0 + i] += d[i] * 0.5; } s = env(s, (t) => Math.min(1, t / 1) * Math.min(1, (8 - t) / 1)); return pan(s, 0, 0.02); }, 'rain');
add('Ortam', 'wind', 'Rüzgâr', (r) => { const n = N(8); let s = bp(pink(n, r), (t) => 500 + 400 * Math.sin(TAU * 0.17 * t) + 200 * Math.sin(TAU * 0.41 * t), 3); s = env(s, (t) => Math.min(1, t / 1.5) * (0.6 + 0.4 * Math.sin(TAU * 0.13 * t)) * Math.min(1, (8 - t) / 1.5)); return pan(s, (t) => 0.4 * Math.sin(TAU * 0.09 * t), 0.02); }, 'wind');
add('Ortam', 'room_tone', 'Oda sesi', (r) => { const n = N(10); let s = lp(pink(n, r), 500); s = mix(s, gain(osc(n, 'sine', 50), 0.01)); s = env(s, (t) => Math.min(1, t / 1) * Math.min(1, (10 - t) / 1)); return pan(gain(s, 0.4), 0, 0.02); }, 'room tone');
add('Ortam', 'ocean', 'Dalga sesi', (r) => { const n = N(10); let s = lp(pink(n, r), (t) => 400 + 1800 * Math.pow(Math.sin(Math.PI * ((t / 5) % 1)), 2)); s = env(s, (t) => (0.25 + 0.75 * Math.pow(Math.sin(Math.PI * ((t / 5) % 1)), 2)) * Math.min(1, t / 0.5) * Math.min(1, (10 - t) / 1)); return pan(s, (t) => 0.3 * Math.sin(TAU * 0.1 * t), 0.02); }, 'ocean waves sea');
add('Ortam', 'fire', 'Ateş çıtırtısı', (r) => { const n = N(8); let s = gain(lp(brown(n, r), 600), 0.6); for (let k = 0; k < 220; k++) { const d = env(hp(white(N(0.01), r), 1500 + r() * 3000), (t) => Math.exp(-t / 0.002)); const j0 = Math.floor(r() * (n - d.length)); const g = 0.2 + r() * 0.8; for (let i = 0; i < d.length; i++) s[j0 + i] += d[i] * g; } s = env(s, (t) => Math.min(1, t / 0.5) * Math.min(1, (8 - t) / 1)); return pan(s, 0, 0.01); }, 'fire crackle');
add('Ortam', 'city', 'Şehir uğultusu', (r) => { const n = N(10); let s = mix(lp(pink(n, r), 800), gain(bp(pink(n, r), 1500, 0.5), 0.3)); s = env(s, (t) => Math.min(1, t / 1) * Math.min(1, (10 - t) / 1)); return reverb(pan(s, 0, 0.03), { wet: 0.3 }); }, 'city traffic');

// ===== ek varyasyonlar (kütüphaneyi zenginleştirir) =====
for (let k = 0; k < 8; k++) add('Riser', `riser_var${k + 1}`, `Riser · varyasyon ${k + 1}`, (r) => riser(r, { dur: 1.5 + r() * 5, kind: r() < 0.5 ? 'mix' : 'noise', tonal: r() < 0.6 ? 0.6 + r() : 0, f0: 50 + r() * 120, f1: 500 + r() * 900, wobble: r() * 3, shepard: r() < 0.3 ? 0.8 : 0, top: 5000 + r() * 9000 }), 'riser');
for (let k = 0; k < 4; k++) add('Düşüş', `down_var${k + 1}`, `Downlifter · varyasyon ${k + 1}`, (r) => down(r, { dur: 1 + r() * 3, tonal: r(), top: 6000 + r() * 8000, f0: 500 + r() * 900 }), 'downlifter');
for (let k = 0; k < 4; k++) add('Sinematik', `braam_var${k + 1}`, `Braam · varyasyon ${k + 1}`, (r) => braam(r, { dur: 2.5 + r() * 3, root: 41 + Math.floor(r() * 4) * 4, chord: [[0, 7, 12, 15], [0, 7, 12, 16], [0, 5, 12, 17], [0, 7, 13, 19]][k], bright: 1200 + r() * 2000, dist: 1.6 + r() * 2 }), 'braam');
for (let k = 0; k < 4; k++) add('Gerilim', `tension_var${k + 1}`, `Gerilim · varyasyon ${k + 1}`, (r) => drone(r, { dur: 6 + r() * 4, root: 41 + r() * 40, notes: [0, 1 + Math.floor(r() * 3), 6 + Math.floor(r() * 2), 12 + r() * 0.3], dark: 500 + r() * 1500, pulse: r() < 0.5 ? 1 + r() * 4 : 0, noise: r() * 0.3, mod: r() * 0.6 }), 'tension drone');
for (let k = 0; k < 8; k++) add('Pop & Tık', `pop_var${k + 1}`, `Pop · varyasyon ${k + 1}`, (r) => pop(r, { f0: 300 + r() * 2000, f1: 100 + r() * 900, d: 0.03 + r() * 0.1, noise: r() * 0.4 }), 'pop');
for (let k = 0; k < 6; k++) add('Bildirim', `ding_var${k + 1}`, `Ding · varyasyon ${k + 1}`, (r) => bell(r, { f: [523, 659, 784, 988, 1175, 1568][k], ratios: r() < 0.5 ? [1, 2.76, 5.4] : [1, 2, 3, 4.2], dec: 0.4 + r() * 1.4 }), 'ding bell');
add('Pop & Tık', 'page_turn', 'Sayfa çevirme', (r) => whoosh(r, { dur: 0.35, f0: 1800, f1: 4500, f2: 1500, color: 'white', q: 0.7, peak: 0.6, panSweep: 0.4 }), 'page paper');
add('Pop & Tık', 'zip', 'Fermuar', (r) => { const n = N(0.45); let s = new Float32Array(n); for (let i = 0; i < n; i += N(0.004 + 0.003 * (i / n))) { const b = env(bp(white(N(0.004), r), 3000 + r() * 2000, 2), (t) => Math.exp(-t / 0.001)); for (let j = 0; j < b.length && i + j < n; j++) s[i + j] += b[j]; } return both(s); }, 'zip');
add('Pop & Tık', 'water_drop', 'Su damlası', (r) => both(env(osc(N(0.25), 'sine', (t) => 600 + 1400 * Math.min(1, t / 0.03)), (t) => Math.min(1, t / 0.002) * Math.exp(-t / 0.04))), 'water drop');
add('Pop & Tık', 'flash', 'Flaş patlaması', (r) => stmix(both(env(hp(white(N(0.3), r), 2500), (t) => Math.exp(-t / 0.03))), both(gain(env(osc(N(1.2), 'sine', (t) => expo(5000, 9000, t / 1.2)), (t) => Math.exp(-t / 0.4)), 0.15))), 'camera flash');
add('Whoosh', 'swoosh_pop', 'Swoosh + pop', (r) => stmix(whoosh(r, { dur: 0.3, f1: 5000, peak: 0.85 }), stoff(pop(r, {}), 0.27, 0.6)), 'swoosh pop text');
add('Whoosh', 'text_whoosh', 'Yazı girişi (whoosh)', (r) => stmix(whoosh(r, { dur: 0.28, f0: 800, f1: 6000, f2: 3000, color: 'white', peak: 0.7 }), stoff(both(env(hp(white(N(0.05), r), 3000), (t) => Math.exp(-t / 0.005))), 0.2, 0.4)), 'text title');
add('Darbe', 'impact_bass_hit', 'Bas vuruş (808)', (r) => both(sat(env(osc(N(1.4), 'sine', (t) => 45 + 110 * Math.exp(-t / 0.04)), (t) => Math.min(1, t / 0.002) * Math.exp(-t / 0.45)), 1.8)), '808 bass kick');
add('Darbe', 'impact_kick', 'Davul vuruşu (kick)', (r) => both(mix(env(osc(N(0.5), 'sine', (t) => 50 + 140 * Math.exp(-t / 0.025)), (t) => Math.exp(-t / 0.18)), gain(env(hp(white(N(0.02), r), 2000), (t) => Math.exp(-t / 0.003)), 0.4))), 'kick drum');

// ---------------- üretim ----------------
const DISP = { Whoosh: 'Whoosh', Riser: 'Riser', 'Düşüş': 'Düşüş & drop', Darbe: 'Darbe & boom', Sinematik: 'Sinematik', Gerilim: 'Gerilim', Glitch: 'Glitch', 'Pop & Tık': 'Pop & tık', Bildirim: 'Bildirim & zil', Komik: 'Komik & meme', Spor: 'Spor', Ortam: 'Ortam' };
const LOUD = { Gerilim: -20, Ortam: -22, Spor: -18 };
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
let k = 0;
for (const s of LIB) {
  k++;
  if (ONLY && !ONLY.test(s.id)) continue;
  const r = rng(0xA1C0 + k * 7919);
  let o = s.fn(r);
  o = trimTail(normalize(o, -1));
  const wav = path.join(TMP, `${s.id}.wav`);
  writeWav(wav, o);
  const out = path.join(OUT, `${s.id}.ogg`);
  const I = LOUD[s.cat] ?? -14;
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-af', `loudnorm=I=${I}:TP=-1.0:LRA=11`, '-ar', '48000', '-c:a', 'libopus', '-b:a', '96k', out]);
  } catch (e) { console.error('ffmpeg', s.id, String(e.stderr || e.message).slice(0, 200)); continue; }
  const d = o[0].length / SR;
  manifest.push({ id: s.id, n: s.name, c: DISP[s.cat] || s.cat, d: +d.toFixed(2), t: s.tags, s: 'Alpicut Ses Fabrikası (özgün, telifsiz)' });
  process.stdout.write(`\r[sfx] ${manifest.length}/${LIB.length} ${s.id}            `);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(manifest));
console.log(`\n[sfx] ${manifest.length} ses üretildi → ${OUT}`);
fs.rmSync(TMP, { recursive: true, force: true });
