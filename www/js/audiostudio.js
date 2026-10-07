// Alpicut v1.7 — Ses stüdyosu: gürültü giderme ve ses ayırma tek ekranda
// Temizle: hazır ayarlar + güç, uğultu (50/60 Hz), rüzgâr, önce/sonra dinleme
// Ayır: konuşmayı arka plandan ayırma (cihaz üzerinde RNNoise maskesi) → iki ayrı iz; stereo şarkıda vokal azaltma (karaoke)
import { app, h, toast, busy, uid } from './state.js';
import { I } from './icons.js';
import { openSheet, refreshSheet, closeSheet, fields } from './sheets.js';
import { processVoice, STUDIO_PRESETS, decode, toWav } from './studio.js';
import { layoutClips } from './engine.js';

const SR = 48000;
const st = { tab: 'Temizle', preset: 'podcast', power: 1, hum: 0, wind: false, sep: 'both', keepOrig: false };
let ab = null; // önce/sonra çalıcı

function stopAB() { try { ab?.src.stop(); ab?.ctx.close(); } catch (_) { /* yoksay */ } ab = null; }

function presetFor() {
  const p = { ...STUDIO_PRESETS[st.preset] };
  p.nr = Math.round((p.nr || 0) * st.power);
  p.denoise = Math.min(1, (p.denoise || 0) * st.power);
  if (st.hum) p.hum = st.hum;
  if (st.wind) { p.hp = true; p.hpFreq = Math.max(p.hpFreq || 80, 150); }
  return p;
}

// seçili öğenin medyası ve zaman bilgisi
function target(o) {
  const m = app.engine.media.get(o.mediaId);
  const isClip = app.P.clips.includes(o);
  const L = isClip ? layoutClips(app.P.clips).find((x) => x.clip === o) : null;
  return { m, isClip, start: isClip ? L.start : o.start, inn: o.in || 0, out: o.out ?? m?.duration };
}

async function playAB(o, which) {
  stopAB();
  const { m, inn } = target(o);
  if (!m) return;
  const b = busy('Önizleme hazırlanıyor…');
  try {
    const all = await decode(m.blob);
    const a = Math.floor(inn * SR), seg = all.subarray(a, Math.min(all.length, a + SR * 8));
    const x = which === 'after' ? await processVoice(new Float32Array(seg), presetFor(), () => {}, { raw: true }) : seg;
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, x.length, SR); buf.copyToChannel(x, 0);
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
    ab = { ctx, src };
    src.onended = () => { if (ab?.src === src) stopAB(); };
  } catch (e) { toast(`Önizlenemedi: ${e.message || e}`); } finally { b.close(); }
}

// işlenmiş sesi yeni iz olarak ekle, orijinali sustur
async function placeTrack(o, x, name, role, mute = true) {
  const t = target(o);
  const file = new File([toWav(x)], `${(t.m.name || 'ses').replace(/\.\w+$/, '')}_${name}.wav`, { type: 'audio/wav' });
  const recs = await app.importFiles([file], true);
  if (!recs[0]) throw new Error('Kaydedilemedi');
  app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: t.start, in: t.inn, out: t.out, volume: o.volume ?? 1, fadeIn: 0, fadeOut: 0, role, linked: o.id });
  if (mute) o.mute = true;
}

async function applyClean(o) {
  const t = target(o);
  if (!t.m) return;
  closeSheet(); stopAB();
  const b = busy('Ses temizleniyor…');
  try {
    const x = await processVoice(t.m.blob, presetFor(), (p, tx) => b.set(`${tx} %${Math.round(p * 100)}`), { raw: true });
    if (t.isClip || app.P.audio.includes(o)) await placeTrack(o, x, 'temiz', 'voice');
    app.commit();
    toast('Ses temizlendi — orijinal susturuldu, geri al ile dönebilirsin');
  } catch (e) { toast(e.message || 'İşlenemedi', 4000); } finally { b.close(); }
}

// konuşma = RNNoise ile maskelenmiş ses; arka plan = orijinal − konuşma (gecikme ve kazanç hizalı)
async function applySeparate(o) {
  const t = target(o);
  if (!t.m) return;
  closeSheet(); stopAB();
  const b = busy('Ses ayrılıyor…');
  try {
    b.set('Ses çözülüyor…');
    const orig = await decode(t.m.blob);
    if (st.sep === 'karaoke') {
      b.set('Vokal azaltılıyor…');
      const kar = await karaoke(t.m.blob);
      if (!kar) throw new Error('Bu ses mono; vokal azaltma için stereo şarkı gerekir. “Konuşma / arka plan” seçeneğini dene.');
      await placeTrack(o, kar, 'karaoke', 'music');
    } else {
      const voice = await processVoice(new Float32Array(orig), { nr: 8, denoise: 1, hp: true, hpFreq: 70, low: 0, mud: 0, presence: 0, air: 0, deess: 0, expand: false, comp: false, target: null }, (p, tx) => b.set(`Konuşma ayrılıyor… %${Math.round(p * 100)}`), { raw: true });
      b.set('Arka plan çıkarılıyor…');
      const bg = subtractAligned(orig, voice);
      if (st.sep !== 'bg') await placeTrack(o, voice, 'konusma', 'voice');
      if (st.sep !== 'voice') await placeTrack(o, bg, 'arkaplan', 'music');
    }
    app.commit();
    toast(st.sep === 'both' ? 'Konuşma ve arka plan iki ayrı ize ayrıldı' : 'Ayrılan ses yeni ize eklendi');
  } catch (e) { toast(e.message || 'Ayrılamadı', 4500); } finally { b.close(); }
}

function subtractAligned(x, v) {
  // en iyi gecikme (0..30 ms) ve kazanç: enerjinin yüksek olduğu 4 sn'lik pencerede
  const n = Math.min(x.length, v.length);
  let best = 0, bestC = -Infinity;
  const W = Math.min(n - 1500, SR * 4);
  let s0 = 0, eMax = 0;
  for (let i = 0; i + W < n; i += SR) { let e = 0; for (let k = 0; k < W; k += 16) e += v[i + k] * v[i + k]; if (e > eMax) { eMax = e; s0 = i; } }
  for (let lag = 0; lag <= 1440; lag += 8) {
    let c = 0; for (let k = 0; k < W; k += 4) c += x[s0 + k] * (v[s0 + k + lag] || 0);
    if (c > bestC) { bestC = c; best = lag; }
  }
  let num = 0, den = 1e-9;
  for (let k = 0; k < W; k += 2) { const a = v[s0 + k + best] || 0; num += x[s0 + k] * a; den += a * a; }
  const g = Math.max(0.3, Math.min(1.4, num / den));
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] - g * (v[i + best] || 0);
  return out;
}

// v1.10: Sesi videodan ayır — klibin sesi (aynı bölüm, aynı hız) ayrı bir ses izine çıkarılır, video susturulur.
// Ses ayrıca kesilebilir, kaydırılabilir, temizlenebilir. Geri al ile tek adımda eski hâline döner.
export async function detachAudio(o) {
  const t = target(o);
  if (!t.m || t.m.kind !== 'video') { toast('Önce zaman çizelgesinden bir video klibi seç'); return; }
  if (o.mute && app.P.audio.some((a) => a.linked === o.id && a.detached)) { toast('Bu klibin sesi zaten ayrılmış'); return; }
  const b = busy('Ses videodan ayrılıyor…');
  try {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let ab2;
    try { ab2 = await new OAC(2, SR, SR).decodeAudioData(await t.m.blob.arrayBuffer()); } catch (_) { throw new Error('Bu videonun sesi okunamadı'); }
    const speed = o.speed || 1;
    const a0 = Math.max(0, t.inn), a1 = Math.min(ab2.duration, t.out ?? ab2.duration);
    if (a1 - a0 < 0.05) throw new Error('Bu klipte ses yok');
    const outLen = Math.max(1, Math.round(((a1 - a0) / speed) * SR));
    const ctx = new OAC(Math.min(2, ab2.numberOfChannels), outLen, SR);
    const src = ctx.createBufferSource(); src.buffer = ab2; src.playbackRate.value = speed;
    src.connect(ctx.destination); src.start(0, a0, a1 - a0);
    const r = await ctx.startRendering();
    // mono karışım (konuşma için yeterli, dosya yarı boyut)
    const x = new Float32Array(r.length);
    for (let c = 0; c < r.numberOfChannels; c++) { const d = r.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] += d[i] / r.numberOfChannels; }
    let peak = 0; for (let i = 0; i < x.length; i += 32) peak = Math.max(peak, Math.abs(x[i]));
    if (peak < 1e-4) throw new Error('Bu klipte duyulur bir ses yok');
    const file = new File([toWav(x)], `${(t.m.name || 'video').replace(/\.\w+$/, '')}_ses.wav`, { type: 'audio/wav' });
    const recs = await app.importFiles([file], true);
    if (!recs[0]) throw new Error('Kaydedilemedi');
    app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: t.start, in: 0, out: x.length / SR, volume: o.volume ?? 1, fadeIn: 0, fadeOut: 0, role: 'voice', linked: o.id, detached: true });
    o.mute = true;
    app.commit();
    toast(speed !== 1 ? 'Ses ayrıldı (klip hızı sese de uygulandı)' : 'Ses ayrıldı — artık ayrı bir iz: kes, kaydır, temizle');
  } catch (e) { toast(e.message || 'Ses ayrılamadı', 4000); } finally { b.close(); }
}

async function karaoke(blob) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ab2 = await new OAC(2, SR, SR).decodeAudioData(await blob.arrayBuffer());
  if (ab2.numberOfChannels < 2) return null;
  const L = ab2.getChannelData(0), R = ab2.getChannelData(1);
  let diff = 0, sum = 0; for (let i = 0; i < L.length; i += 64) { diff += Math.abs(L[i] - R[i]); sum += Math.abs(L[i] + R[i]); }
  if (diff < sum * 0.02) return null; // pratikte mono
  // yan kanal (L−R) + bas için orta kanalın alçak geçirilmiş kısmı → vokal büyük ölçüde gider, bas kalır
  const ctx = new OAC(1, L.length, ab2.sampleRate);
  const side = ctx.createBuffer(1, L.length, ab2.sampleRate), mid = ctx.createBuffer(1, L.length, ab2.sampleRate);
  const s = side.getChannelData(0), m = mid.getChannelData(0);
  for (let i = 0; i < L.length; i++) { s[i] = (L[i] - R[i]) * 0.9; m[i] = (L[i] + R[i]) * 0.5; }
  const a = ctx.createBufferSource(); a.buffer = side; a.connect(ctx.destination); a.start();
  const b = ctx.createBufferSource(); b.buffer = mid; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; b.connect(lp); lp.connect(ctx.destination); b.start();
  const r = await ctx.startRendering();
  const out = r.getChannelData(0);
  if (ab2.sampleRate === SR) return out;
  const c2 = new OAC(1, Math.round(out.length * SR / ab2.sampleRate), SR); const bb = c2.createBuffer(1, out.length, ab2.sampleRate); bb.copyToChannel(out, 0);
  const sc = c2.createBufferSource(); sc.buffer = bb; sc.connect(c2.destination); sc.start();
  return (await c2.startRendering()).getChannelData(0);
}

export function openAudioStudio(o) {
  if (!o || !o.mediaId) { toast('Önce zaman çizelgesinden bir video ya da ses seç'); return; }
  openSheet({
    id: 'audiostudio', title: 'Ses stüdyosu', tall: true, tabs: ['Temizle', 'Konuşma / müzik'], tab: st.tab,
    onClose: stopAB,
    render: (body, tb) => {
      st.tab = tb === 'Konuşma / müzik' ? 'Konuşma / müzik' : tb;
      const name = app.engine.media.get(o.mediaId)?.name || 'ses';
      body.append(h('div', { class: 'as-head' }, h('span', { class: 'as-ic', html: I.mic }), h('span', {}, h('b', {}, name), h('small', {}, 'Orijinal dosya korunur; sonuç yeni bir iz olarak eklenir ve geri alınabilir.'))));
      if (tb === 'Temizle') {
        const ch = h('div', { class: 'as-presets' });
        Object.entries(STUDIO_PRESETS).forEach(([k, v], i) => ch.append(h('button', { class: `as-pre${st.preset === k ? ' on' : ''}`, style: { '--i': String(i) }, onclick: () => { st.preset = k; refreshSheet(); } }, h('b', {}, v.label))));
        body.append(h('div', { class: 'sub-title' }, 'Ön ayar'), ch);
        body.append(fields(st, [
          { label: 'Temizlik gücü', path: 'power', type: 'range', min: 0.3, max: 1.6, step: 0.05, fmt: (x) => `${Math.round(x * 100)}%` },
          { label: 'Elektrik uğultusu', path: 'hum', type: 'chips', options: [[0, 'Yok'], [50, '50 Hz (Türkiye)'], [60, '60 Hz']] },
          { label: 'Rüzgâr / gümbürtü kes', path: 'wind', type: 'toggle' },
        ]));
        body.append(h('div', { class: 'btn-row' },
          h('button', { class: 'btn', html: `${I.play} Önce`, onclick: () => playAB(o, 'before') }),
          h('button', { class: 'btn', html: `${I.play} Sonra`, onclick: () => playAB(o, 'after') }),
          h('button', { class: 'btn', html: I.pause || '■', onclick: stopAB })));
        body.append(h('button', { class: 'btn block primary', html: `${I.mic} Temizle ve uygula`, onclick: () => applyClean(o) }));
      } else {
        if (app.P.clips.includes(o)) body.append(h('div', { class: 'as-detach' },
          h('p', { class: 'hint', style: { margin: '0 0 8px' } }, 'Sesi videodan ayırıp ayrı bir izde düzenlemek istiyorsan bunu kullan (ses aynen korunur):'),
          h('button', { class: 'btn block primary', html: `${I.audio || I.mic} Sesi videodan ayır`, onclick: () => { closeSheet(); detachAudio(o); } }),
          h('div', { class: 'sub-title', style: { marginTop: '14px' } }, 'Konuşmayı müzikten/ortamdan ayır (deneysel)')));
        const opts = [['both', 'Konuşma + arka plan', 'İki ayrı iz: sesini ve müziği/ortamı ayrı ayrı ayarla'], ['voice', 'Sadece konuşma', 'Müziği, kalabalığı, gürültüyü at'], ['bg', 'Sadece arka plan', 'Konuşmayı çıkar, ortam/müzik kalsın'], ['karaoke', 'Vokali azalt (şarkı)', 'Stereo şarkılarda karaoke']];
        const g = h('div', { class: 'as-sep' });
        opts.forEach(([id, n, d], i) => g.append(h('button', { class: `as-opt${st.sep === id ? ' on' : ''}`, style: { '--i': String(i) }, onclick: () => { st.sep = id; refreshSheet(); } }, h('b', {}, n), h('small', {}, d))));
        body.append(g);
        body.append(h('p', { class: 'hint' }, 'Deneysel: telefonda, internetsiz yapılır. Arka planda konuşma izleri kalabilir; temiz bir konuşma için “Sadece konuşma” ya da Temizle sekmesi daha iyi sonuç verir.'));
        body.append(h('button', { class: 'btn block primary', html: `${I.split || I.scissors} Ayır`, onclick: () => applySeparate(o) }));
      }
    },
  });
}
