// Alpicut — v1.5 çevrimdışı ses karışımı (dışa aktarma için)
// Önizlemedeki ses grafiğinin aynısını (seviye, geçiş çapraz geçişi, keyframe, fade, EQ, kompresör,
// ses efektleri, konuşma/müzik/SFX grupları, ducking, master limiter) OfflineAudioContext'te,
// gerçek zamandan bağımsız ve kayıpsız olarak üretir. Hızlandırılmış kliplerde ses perdesi korunur (WSOLA).
import { layoutClips, curvePts, curveSpeed, flatLayers, setLimiter } from './engine.js';
import { hasKeys, propAt } from './kf.js';
import * as MB from './lib/mediabunny.js';

const OAC = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const CR = 100; // kazanç eğrisi çözünürlüğü (Hz)

// ---------- kaynaktan aralık çöz ----------
const wholeCache = new Map(); // mediaId -> Promise<AudioBuffer|null> (yedek yol)
async function decodeWhole(m, sr) {
  if (!wholeCache.has(m.id)) {
    wholeCache.set(m.id, (async () => {
      // v1.11: büyük dosyayı tümüyle belleğe okuma (uygulamayı kapatır)
      if (m.blob && m.blob.size > 250 * 1048576) return null;
      try { const ab = await m.blob.arrayBuffer(); return await new (OAC())(2, 1, sr).decodeAudioData(ab); } catch (_) { return null; }
    })());
  }
  return wholeCache.get(m.id);
}

async function resampleTo(buf, sr) {
  if (!buf || buf.sampleRate === sr) return buf;
  const len = Math.max(1, Math.round((buf.length * sr) / buf.sampleRate));
  const ctx = new (OAC())(buf.numberOfChannels, len, sr);
  const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start(0);
  return ctx.startRendering();
}

// [a, b) saniye aralığını stereo Float32Array çiftine çözer
export async function decodeRange(m, a, b, sr) {
  a = Math.max(0, a); b = Math.max(a + 0.01, b);
  // 1) mediabunny (WebCodecs AudioDecoder) — yalnızca gereken bölüm okunur
  try {
    const input = new MB.Input({ source: new MB.BlobSource(m.blob), formats: MB.ALL_FORMATS });
    try {
      const at = await input.getPrimaryAudioTrack();
      if (at && await at.canDecode()) {
        const first = await at.getFirstTimestamp().catch(() => 0) || 0;
        const sink = new MB.AudioBufferSink(at);
        let srcRate = 0, L = null, R = null;
        for await (const { buffer, timestamp } of sink.buffers(a + first, b + first)) {
          if (!srcRate) { srcRate = buffer.sampleRate; const n = Math.ceil((b - a) * srcRate) + 8; L = new Float32Array(n); R = new Float32Array(n); }
          const off = Math.round((timestamp - first - a) * srcRate);
          const l = buffer.getChannelData(0), r = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : l;
          for (let i = 0; i < buffer.length; i++) { const j = off + i; if (j >= 0 && j < L.length) { L[j] = l[i]; R[j] = r[i]; } }
        }
        if (L) {
          if (srcRate === sr) return [L, R];
          const tmp = new AudioBuffer({ length: L.length, numberOfChannels: 2, sampleRate: srcRate });
          tmp.copyToChannel(L, 0); tmp.copyToChannel(R, 1);
          const rs = await resampleTo(tmp, sr);
          return [rs.getChannelData(0), rs.getChannelData(1)];
        }
        return null; // ses izi var ama bu aralıkta veri yok
      }
    } finally { try { input.dispose(); } catch (_) { /* yoksay */ } }
  } catch (_) { /* yedek yola geç */ }
  // 2) yedek: tüm dosyayı decodeAudioData ile çöz
  const whole = await decodeWhole(m, sr);
  if (!whole) return null;
  const i0 = Math.floor(a * whole.sampleRate), i1 = Math.min(whole.length, Math.ceil(b * whole.sampleRate));
  if (i1 <= i0) return null;
  const l = whole.getChannelData(0).slice(i0, i1), r = (whole.numberOfChannels > 1 ? whole.getChannelData(1) : whole.getChannelData(0)).slice(i0, i1);
  if (whole.sampleRate === sr) return [l, r];
  const tmp = new AudioBuffer({ length: l.length, numberOfChannels: 2, sampleRate: whole.sampleRate });
  tmp.copyToChannel(l, 0); tmp.copyToChannel(r, 1);
  const rs = await resampleTo(tmp, sr);
  return [rs.getChannelData(0), rs.getChannelData(1)];
}

// ---------- perdeyi koruyarak hız değiştirme (WSOLA) ----------
export function stretch(chs, rate, sr = 48000) {
  if (Math.abs(rate - 1) < 0.005) return chs;
  const N = Math.max(256, Math.round((sr * 0.0213) / 2) * 2), Hs = N / 2, tol = Math.round(N * 0.375);
  const inLen = chs[0].length;
  const outLen = Math.max(1, Math.floor(inLen / rate));
  const out = chs.map(() => new Float32Array(outLen + N));
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const mono = new Float32Array(inLen);
  for (let i = 0; i < inLen; i++) { let s = 0; for (const c of chs) s += c[i]; mono[i] = s / chs.length; }
  const L = Math.min(512, Hs);
  const corr = (p, q, step) => { let s = 0; for (let i = 0; i < L; i += step) s += mono[p + i] * mono[q + i]; return s; };
  let prev = -1;
  for (let op = 0; op < outLen; op += Hs) {
    const nominal = Math.round(op * rate);
    let pos = Math.min(Math.max(0, nominal), Math.max(0, inLen - N));
    if (prev >= 0) {
      const nat = prev + Hs;
      if (nat + L < inLen) {
        let best = pos, bv = -Infinity;
        const lo = Math.max(0, nominal - tol), hi = Math.min(inLen - N, nominal + tol);
        for (let d = lo; d <= hi; d += 4) { const v = corr(nat, d, 4); if (v > bv) { bv = v; best = d; } }
        const c0 = best;
        for (let d = Math.max(lo, c0 - 3); d <= Math.min(hi, c0 + 3); d++) { const v = corr(nat, d, 1); if (v > bv) { bv = v; best = d; } }
        if (hi >= lo) pos = best;
      }
    }
    for (let ci = 0; ci < chs.length; ci++) {
      const src = chs[ci], dst = out[ci];
      for (let i = 0; i < N && pos + i < inLen; i++) dst[op + i] += src[pos + i] * win[i];
    }
    prev = pos;
  }
  return out.map((c) => c.subarray(0, outLen));
}

// ---------- ses zinciri (önizlemedeki ile aynı) ----------
function chain(ctx, o, input, output) {
  const a = o.afx || {};
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = a.hp ? 90 : 10;
  const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 160; lo.gain.value = a.low || 0;
  const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 2500; mid.Q.value = 0.9; mid.gain.value = a.mid || 0;
  const hi = ctx.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 8000; hi.gain.value = a.high || 0;
  const comp = ctx.createDynamicsCompressor();
  if (a.comp) { comp.threshold.value = -24; comp.ratio.value = 4; comp.knee.value = 6; comp.attack.value = 0.005; comp.release.value = 0.15; }
  else { comp.threshold.value = 0; comp.ratio.value = 1; }
  input.connect(hp); hp.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(comp);
  voiceFx(ctx, a.vfx || 'none', comp, output);
}

function voiceFx(ctx, type, from, out) {
  const dry = ctx.createGain(); from.connect(dry); dry.connect(out);
  if (type === 'none') return;
  const wet = ctx.createGain(); wet.connect(out);
  const bp = (f, q) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; };
  const shaper = (k) => { const ws = ctx.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); } ws.curve = c; return ws; };
  const impulse = (sec, decay) => { const len = Math.floor(ctx.sampleRate * sec); const b = ctx.createBuffer(2, len, ctx.sampleRate); let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; };
  switch (type) {
    case 'echo': { const d = ctx.createDelay(1); d.delayTime.value = 0.28; const fb = ctx.createGain(); fb.gain.value = 0.42; from.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.gain.value = 0.6; break; }
    case 'hall': case 'room': { const cv = ctx.createConvolver(); cv.buffer = impulse(type === 'hall' ? 2.8 : 0.9, type === 'hall' ? 2.2 : 3); from.connect(cv); cv.connect(wet); wet.gain.value = type === 'hall' ? 0.55 : 0.4; break; }
    case 'phone': { const f = bp(1700, 1.1); const s = shaper(6); from.connect(f); f.connect(s); s.connect(wet); dry.gain.value = 0; wet.gain.value = 1.6; break; }
    case 'megaphone': { const f = bp(1300, 0.8); const s = shaper(30); from.connect(f); f.connect(s); s.connect(wet); dry.gain.value = 0; wet.gain.value = 0.9; break; }
    case 'radio': { const f = bp(1500, 0.7); const s = shaper(12); from.connect(f); f.connect(s); s.connect(wet); dry.gain.value = 0.15; wet.gain.value = 1.2; break; }
    case 'robot': { const osc = ctx.createOscillator(); osc.frequency.value = 55; osc.type = 'square'; const ring = ctx.createGain(); ring.gain.value = 0; osc.connect(ring.gain); osc.start(); from.connect(ring); ring.connect(wet); dry.gain.value = 0.2; wet.gain.value = 1.4; break; }
    case 'underwater': { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 6; from.connect(lp); lp.connect(wet); dry.gain.value = 0; wet.gain.value = 1.3; break; }
    case 'stadium': { const cv = ctx.createConvolver(); cv.buffer = impulse(3.6, 1.6); const d = ctx.createDelay(1); d.delayTime.value = 0.12; from.connect(d); d.connect(cv); cv.connect(wet); wet.gain.value = 0.7; break; }
    default: break;
  }
}

// ---------- karışıma girecek kaynakları topla ----------
function collect(engine, P) {
  const out = [];
  const lay = layoutClips(P.clips);
  lay.forEach((L, i) => {
    const c = L.clip;
    if (c.type === 'image' || c.freeze || c.mute) return;
    const next = lay[i + 1];
    out.push({
      o: c, mediaId: c.mediaId, start: L.start, len: L.len, role: c.role || 'voice', curve: curvePts(c) ? c : null, speed: c.speed || 1,
      srcA: c.in, srcB: c.out,
      gain: (lt) => {
        let v = c.volume ?? 1;
        if (L.td > 0 && lt < L.td) v *= lt / L.td;
        const t = L.start + lt;
        if (next && next.td > 0 && t > next.start) v *= 1 - (t - next.start) / next.td;
        if (hasKeys(c, 'vol')) v *= propAt(c, 'vol', lt);
        return Math.max(0, v);
      },
    });
  });
  flatLayers(P).forEach((l) => {
    if (l.kind !== 'media' || l.mute || l.hidden || !((l.volume ?? 0) > 0)) return;
    const m = engine.media.get(l.mediaId);
    if (!m || m.kind !== 'video') return;
    const len = l.end - l.start, a = l.in || 0;
    const srcLen = Math.max(0.1, (l.out ?? m.duration ?? len) - a);
    out.push({ o: l, mediaId: l.mediaId, start: l.start, len, role: l.role || 'voice', speed: 1, srcA: a, srcB: a + (l.loop ? srcLen : Math.min(len, srcLen)), loop: l.loop ? srcLen : 0, gain: () => l.volume ?? 0 });
  });
  P.audio.forEach((a) => {
    if (a.mute) return;
    const len = a.out - a.in;
    out.push({
      o: a, mediaId: a.mediaId, start: a.start, len, role: a.role || (a.sfx ? 'sfx' : 'music'), speed: 1, srcA: a.in, srcB: a.out,
      gain: (lt) => {
        let v = a.volume ?? 1;
        if (a.fadeIn > 0) v *= clamp(lt / a.fadeIn);
        if (a.fadeOut > 0) v *= clamp((len - lt) / a.fadeOut);
        if (hasKeys(a, 'vol')) v *= propAt(a, 'vol', lt);
        return Math.max(0, v);
      },
    });
  });
  return out.filter((s) => s.len > 0.01 && engine.media.get(s.mediaId));
}

// kaynağın zaman çizelgesi uzunluğunda (hız uygulanmış) stereo verisi
async function prepare(engine, s, sr) {
  const m = engine.media.get(s.mediaId);
  const raw = await decodeRange(m, s.srcA, s.srcB, sr);
  if (!raw) return null;
  let chs = raw;
  if (s.curve) {
    // hız eğrisi: 24 parçada sabit hızla esnet
    const K = 24, parts = [[], []];
    const total = raw[0].length;
    let acc = 0;
    for (let k = 0; k < K; k++) {
      const u0 = k / K, u1 = (k + 1) / K;
      const sp = curveSpeed(s.curve, (u0 + u1) / 2);
      // kaynak payı: hız ile orantılı (curveTable ortalaması)
      parts[0].push(sp); acc += sp;
    }
    const outL = [], outR = [];
    let p0 = 0;
    for (let k = 0; k < K; k++) {
      const n = Math.round((parts[0][k] / acc) * total);
      const seg = [raw[0].subarray(p0, p0 + n), raw[1].subarray(p0, p0 + n)];
      p0 += n;
      const st = stretch(seg, parts[0][k], sr);
      outL.push(st[0]); outR.push(st[1]);
    }
    const cat = (arr) => { const n = arr.reduce((x, y) => x + y.length, 0); const o = new Float32Array(n); let q = 0; arr.forEach((a) => { o.set(a, q); q += a.length; }); return o; };
    chs = [cat(outL), cat(outR)];
  } else if (Math.abs(s.speed - 1) > 0.005) chs = stretch(raw, s.speed, sr);
  if (s.loop) {
    // döngülü katman: süre boyunca tekrarla
    const need = Math.ceil(s.len * sr), one = chs[0].length;
    if (one > 0 && one < need) { chs = chs.map((c) => { const o = new Float32Array(need); for (let q = 0; q < need; q += one) o.set(c.subarray(0, Math.min(one, need - q)), q); return o; }); }
  }
  const n = Math.min(chs[0].length, Math.ceil(s.len * sr));
  return [chs[0].subarray(0, n), chs[1].subarray(0, n)];
}

function gainCurve(s) {
  const n = Math.max(2, Math.ceil(s.len * CR) + 1);
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = s.gain(Math.min(s.len, i / CR));
  return c;
}

// ---------- ana fonksiyon ----------
export async function mixdown(engine, P, dur, { sampleRate = 48000, onProgress, shouldCancel } = {}) {
  const sr = sampleRate;
  const total = Math.max(1, Math.ceil(dur * sr));
  const M = engine.mix();
  const srcs = collect(engine, P);
  const ready = [];
  for (let i = 0; i < srcs.length; i++) {
    if (shouldCancel?.()) return null;
    const s = srcs[i];
    try { const d = await prepare(engine, s, sr); if (d) ready.push({ ...s, data: d, curveG: gainCurve(s) }); } catch (e) { console.warn('ses kaynağı atlandı', e); }
    onProgress?.((i + 1) / Math.max(1, srcs.length) * 0.7);
  }
  const build = (ctx, roles, duckCurve) => {
    const master = ctx.createGain(); master.gain.value = M.master;
    const limiter = ctx.createDynamicsCompressor();
    setLimiter(limiter, M.limiter);
    master.connect(limiter); limiter.connect(ctx.destination);
    const buses = {};
    ['voice', 'music', 'sfx'].forEach((r) => { const g = ctx.createGain(); g.gain.value = M[r]; buses[r] = g; });
    buses.voice.connect(master); buses.sfx.connect(master);
    const duck = ctx.createGain(); buses.music.connect(duck); duck.connect(master);
    if (duckCurve) duck.gain.setValueCurveAtTime(duckCurve, 0, Math.max(0.02, (duckCurve.length - 1) / CR));
    ready.forEach((s) => {
      const role = buses[s.role] ? s.role : 'voice';
      if (roles && !roles.includes(role)) return;
      const b = ctx.createBuffer(2, s.data[0].length, sr);
      b.copyToChannel(s.data[0], 0); b.copyToChannel(s.data[1], 1);
      const bs = ctx.createBufferSource(); bs.buffer = b;
      const g = ctx.createGain();
      const allSame = s.curveG.every((v) => Math.abs(v - s.curveG[0]) < 1e-6);
      if (allSame) g.gain.value = s.curveG[0];
      else { g.gain.value = s.curveG[0]; g.gain.setValueCurveAtTime(s.curveG, Math.max(0, s.start), Math.max(0.02, s.len)); }
      bs.connect(g);
      chain(ctx, s.o, g, buses[role]);
      bs.start(Math.max(0, s.start));
    });
  };
  let duckCurve = null;
  if (M.duck.on && ready.some((s) => s.role === 'music') && ready.some((s) => s.role === 'voice')) {
    // 1. geçiş: yalnızca konuşma → seviye zarfı → müzik kısma eğrisi (önizlemedeki ile aynı atak/bırakma)
    const c1 = new (OAC())(2, total, sr);
    build(c1, ['voice'], null);
    const vb = await c1.startRendering();
    const L = vb.getChannelData(0), R = vb.getChannelData(1);
    const hop = Math.round(sr / CR), n = Math.ceil(total / hop) + 1;
    duckCurve = new Float32Array(n);
    let lvl = 1;
    const dt = 1 / CR;
    const win = Math.round(sr * 0.023);
    for (let k = 0; k < n; k++) {
      const c = k * hop; let q = 0, m = 0;
      for (let i = Math.max(0, c - win); i < Math.min(total, c + win); i++) { const v = (L[i] + R[i]) / 2; q += v * v; m++; }
      const db = 20 * Math.log10(Math.sqrt(q / Math.max(1, m)) + 1e-9);
      const target = db > M.duck.threshold ? Math.pow(10, -M.duck.amount / 20) : 1;
      const tau = target < lvl ? M.duck.attack : M.duck.release;
      lvl += (target - lvl) * (1 - Math.exp(-dt / Math.max(0.01, tau)));
      duckCurve[k] = lvl;
    }
    onProgress?.(0.8);
  }
  if (shouldCancel?.()) return null;
  const ctx = new (OAC())(2, total, sr);
  build(ctx, null, duckCurve);
  const out = await ctx.startRendering();
  onProgress?.(1);
  return out;
}

// ---------- v1.11: pencereli (akışlı) karışım — 1 saatlik projede bellek sabit kalır ----------
// Tüm zaman çizelgesini tek OfflineAudioContext'te üretmek (1 saat ≈ 1,4 GB) telefonda uygulamayı kapatıyordu.
// Burada [w0, w1) pencereleri sırayla üretilir; her kaynak yalnızca o pencere için çözülür.
async function prepWin(engine, s, sr, a0, a1, cache) {
  const a = Math.max(a0, s.start), b = Math.min(a1, s.start + s.len);
  if (b - a < 1 / sr) return null;
  const lt0 = a - s.start;
  if (s.curve || s.loop) { // hız eğrisi / döngü: kaynak bir kez hazırlanır, dilimlenir
    let full = cache.get(s);
    if (full === undefined) { full = await prepare(engine, s, sr); cache.set(s, full); }
    if (!full) return null;
    const i0 = Math.round(lt0 * sr), i1 = Math.min(full[0].length, Math.round((b - s.start) * sr));
    if (i1 <= i0) return null;
    return { off: a - a0, lt0, data: [full[0].subarray(i0, i1), full[1].subarray(i0, i1)] };
  }
  const sp = s.speed || 1;
  const sa = s.srcA + lt0 * sp, sb = s.srcA + (b - s.start) * sp;
  const raw = await decodeRange(engine.media.get(s.mediaId), sa, Math.min(s.srcB ?? Infinity, sb + 0.05 * sp), sr);
  if (!raw) return null;
  const chs = Math.abs(sp - 1) > 0.005 ? stretch(raw, sp, sr) : raw;
  const n = Math.min(chs[0].length, Math.round((b - a) * sr));
  return { off: a - a0, lt0, data: [chs[0].subarray(0, n), chs[1].subarray(0, n)] };
}

export function mixdownStream(engine, P, dur, { sampleRate = 48000, win = 10, pre = 0.5 } = {}) {
  const sr = sampleRate;
  const M = engine.mix();
  const srcs = collect(engine, P);
  const cache = new Map();
  const duckOn = M.duck.on && srcs.some((s) => s.role === 'music') && srcs.some((s) => s.role === 'voice');
  let lvl = 1;
  const render = async (A, B, roles, duckCurve, parts) => {
    const len = Math.max(1, Math.round((B - A) * sr));
    const ctx = new (OAC())(2, len, sr);
    const master = ctx.createGain(); master.gain.value = M.master;
    const limiter = ctx.createDynamicsCompressor(); setLimiter(limiter, M.limiter);
    master.connect(limiter); limiter.connect(ctx.destination);
    const buses = {};
    ['voice', 'music', 'sfx'].forEach((r) => { const g = ctx.createGain(); g.gain.value = M[r]; buses[r] = g; });
    buses.voice.connect(master); buses.sfx.connect(master);
    const duck = ctx.createGain(); buses.music.connect(duck); duck.connect(master);
    if (duckCurve) duck.gain.setValueCurveAtTime(duckCurve, 0, Math.max(0.02, (duckCurve.length - 1) / CR));
    parts.forEach(({ s, d }) => {
      const role = buses[s.role] ? s.role : 'voice';
      if (roles && !roles.includes(role)) return;
      const L = d.data[0].length; if (!L) return;
      const bb = ctx.createBuffer(2, L, sr); bb.copyToChannel(d.data[0], 0); bb.copyToChannel(d.data[1], 1);
      const bs = ctx.createBufferSource(); bs.buffer = bb;
      const g = ctx.createGain();
      const n = Math.max(2, Math.ceil((L / sr) * CR) + 1), cv = new Float32Array(n);
      for (let i = 0; i < n; i++) cv[i] = s.gain(Math.min(s.len, d.lt0 + i / CR));
      g.gain.value = cv[0];
      if (!cv.every((v) => Math.abs(v - cv[0]) < 1e-6)) g.gain.setValueCurveAtTime(cv, d.off, Math.max(0.02, L / sr));
      bs.connect(g); chain(ctx, s.o, g, buses[role]); bs.start(d.off);
    });
    return ctx.startRendering();
  };
  return {
    sr, win,
    windows: Math.ceil(dur / win),
    // [w0, w1) penceresinin karışımı (AudioBuffer). Önceki pencerelerden bağımsız; ducking durumu taşınır.
    async mix(w0, w1) {
      const A = Math.max(0, w0 - pre), B = w1;
      const parts = [];
      for (const s of srcs) {
        try { const d = await prepWin(engine, s, sr, A, B, cache); if (d) parts.push({ s, d }); } catch (e) { console.warn('ses kaynağı atlandı', e); }
      }
      let duckCurve = null;
      if (duckOn && parts.some((p) => p.s.role === 'voice') && parts.some((p) => p.s.role === 'music')) {
        const vb = await render(A, B, ['voice'], null, parts);
        const L = vb.getChannelData(0), R = vb.getChannelData(1), total = L.length;
        const hop = Math.round(sr / CR), n = Math.ceil(total / hop) + 1, win2 = Math.round(sr * 0.023), dt = 1 / CR;
        duckCurve = new Float32Array(n);
        let l2 = lvl;
        for (let k = 0; k < n; k++) {
          const c = k * hop; let q = 0, m = 0;
          for (let i = Math.max(0, c - win2); i < Math.min(total, c + win2); i++) { const v = (L[i] + R[i]) / 2; q += v * v; m++; }
          const db = 20 * Math.log10(Math.sqrt(q / Math.max(1, m)) + 1e-9);
          const target = db > M.duck.threshold ? Math.pow(10, -M.duck.amount / 20) : 1;
          const tau = target < l2 ? M.duck.attack : M.duck.release;
          l2 += (target - l2) * (1 - Math.exp(-dt / Math.max(0.01, tau)));
          duckCurve[k] = l2;
          if (c / sr <= (w1 - A)) lvl = l2;
        }
      }
      const out = await render(A, B, null, duckCurve, parts);
      const skip = Math.round((w0 - A) * sr), n = Math.max(1, Math.round((w1 - w0) * sr));
      const res = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr });
      res.copyToChannel(out.getChannelData(0).subarray(skip, skip + n), 0);
      res.copyToChannel(out.getChannelData(1).subarray(skip, skip + n), 1);
      return res;
    },
  };
}

// Pencereli analizör: dışa aktarmada ses dalgası katmanları için, yalnızca güncel pencereyi tutar
export function rollingAnalyser() {
  const none = { sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(0) };
  let a = fakeAnalyser(none, 0), t = 0;
  return {
    set(buf, offsetSec) { a = fakeAnalyser(buf || none, Math.round(offsetSec * ((buf || none).sampleRate))); a.setTime(t); },
    get frequencyBinCount() { return a.frequencyBinCount; },
    get fftSize() { return a.fftSize; },
    setTime(x) { t = x; a.setTime(x); },
    getByteFrequencyData(arr) { a.getByteFrequencyData(arr); },
    getFloatTimeDomainData(arr) { a.getFloatTimeDomainData(arr); },
  };
}

// ---------- dalga katmanı için sahte analizör (dışa aktarmada sesle senkron) ----------
export function fakeAnalyser(buf, off = 0) {
  const N = 1024, bins = N / 2;
  const re = new Float32Array(N), im = new Float32Array(N), smooth = new Float32Array(bins);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / N) + 0.08 * Math.cos((4 * Math.PI * i) / N);
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  let t = 0;
  const fft = () => {
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= N; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k], ai = im[i + k], br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ar + br; im[i + k] = ai + bi; re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  };
  return {
    frequencyBinCount: bins,
    fftSize: N,
    setTime(tt) { t = tt; },
    getByteFrequencyData(arr) {
      const end = Math.floor(t * buf.sampleRate) - off, st = end - N;
      for (let i = 0; i < N; i++) { const j = st + i; const v = j >= 0 && j < L.length ? (L[j] + R[j]) / 2 : 0; re[i] = v * win[i]; im[i] = 0; }
      fft();
      for (let k = 0; k < bins && k < arr.length; k++) {
        const mag = Math.hypot(re[k], im[k]) / N;
        smooth[k] = 0.8 * smooth[k] + 0.2 * mag;
        const db = 20 * Math.log10(smooth[k] + 1e-12);
        arr[k] = Math.max(0, Math.min(255, Math.round(((db + 100) / 70) * 255)));
      }
    },
    getFloatTimeDomainData(arr) { const end = Math.floor(t * buf.sampleRate) - off; for (let i = 0; i < arr.length; i++) { const j = end - arr.length + i; arr[i] = j >= 0 && j < L.length ? L[j] : 0; } },
  };
}
