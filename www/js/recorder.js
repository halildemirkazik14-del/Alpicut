// Alpicut — Kayıt stüdyosu: sıkıştırmasız (PCM/WAV) kayıt, giriş kazancı, canlı seviye + ortam gürültüsü ölçümü,
// geri sayımda gürültü profili öğrenme, kayıttan sonra ham/işlenmiş karşılaştırma ve stüdyo zinciri
import { app, h, toast, busy, uid, fmt } from './state.js';
import { I } from './icons.js';
import { openSheet, closeSheet, refreshSheet, fields } from './sheets.js';
import { processVoice, STUDIO_PRESETS, toWav } from './studio.js';
import { lsGet, lsSet } from './storage.js';

const WORKLET = `class Cap extends AudioWorkletProcessor{process(i){const c=i[0];if(c&&c[0])this.port.postMessage(c[0].slice(0));return true}}registerProcessor('alpicut-cap',Cap);`;

export async function startRecorder({ mode = 'natural', gainDb = 0 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu cihaz mikrofon kaydını desteklemiyor');
  const natural = mode === 'natural';
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: !natural, noiseSuppression: !natural, autoGainControl: !natural, channelCount: 1, sampleRate: 48000 },
  });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC({ sampleRate: 48000, latencyHint: 'interactive' });
  if (ac.state === 'suspended') await ac.resume();
  const src = ac.createMediaStreamSource(stream);
  const gain = ac.createGain();
  gain.gain.value = Math.pow(10, gainDb / 20);
  const an = ac.createAnalyser(); an.fftSize = 2048;
  src.connect(gain); gain.connect(an);
  const chunks = [];
  let recording = false, total = 0, node = null;
  const push = (d) => { chunks.push(d); total += d.length; };
  try {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
    await ac.audioWorklet.addModule(url);
    node = new AudioWorkletNode(ac, 'alpicut-cap');
    node.port.onmessage = (e) => { if (recording) push(e.data); };
    gain.connect(node);
    const sink = ac.createGain(); sink.gain.value = 0; node.connect(sink); sink.connect(ac.destination);
  } catch (_) {
    node = ac.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => { if (recording) push(new Float32Array(e.inputBuffer.getChannelData(0))); };
    gain.connect(node);
    const sink = ac.createGain(); sink.gain.value = 0; node.connect(sink); sink.connect(ac.destination);
  }
  const buf = new Float32Array(2048);
  let peakHold = -90, peakT = 0, floor = -90;
  const level = () => {
    an.getFloatTimeDomainData(buf);
    let p = 0, q = 0;
    for (const v of buf) { const a = Math.abs(v); if (a > p) p = a; q += v * v; }
    const pk = 20 * Math.log10(p + 1e-9), rms = 10 * Math.log10(q / buf.length + 1e-12);
    const now = performance.now();
    if (pk > peakHold || now - peakT > 1200) { peakHold = pk; peakT = now; }
    // ortam gürültüsü: yavaşça en düşük RMS'i izle
    floor = rms < floor ? rms : floor + 0.02;
    if (floor < -90) floor = rms;
    return { pk, rms, hold: peakHold, floor };
  };
  let t0 = 0, markAt = 0;
  const merge = () => { const out = new Float32Array(total); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out; };
  const cleanup = () => { try { node.disconnect(); } catch (_) { /* yoksay */ } stream.getTracks().forEach((t) => t.stop()); ac.close().catch(() => {}); };
  return {
    sr: ac.sampleRate,
    level,
    setGain: (db) => { gain.gain.value = Math.pow(10, db / 20); },
    begin: () => { recording = true; t0 = performance.now(); },
    mark: () => { markAt = total; }, // gürültü profili sonu = konuşma başlangıcı
    elapsed: () => (t0 ? (performance.now() - t0) / 1000 : 0),
    stop: () => { recording = false; const all = merge(); cleanup(); return { noise: all.subarray(0, markAt), voice: all.subarray(markAt), sr: ac.sampleRate }; },
    cancel: () => { recording = false; cleanup(); },
  };
}

function meterEl() {
  const fill = h('i'), hold = h('b'), led = h('span', { class: 'clip-led' }, 'CLIP');
  const el = h('div', { class: 'meter-row' }, h('div', { class: 'meter vu' }, fill, hold), led);
  const set = (L) => {
    const pct = (d) => `${Math.max(0, Math.min(100, ((d + 60) / 60) * 100))}%`;
    fill.style.width = pct(L.pk);
    fill.style.background = L.pk > -3 ? 'var(--danger)' : L.pk > -12 ? '#FACC15' : 'var(--grad)';
    hold.style.left = pct(L.hold);
    led.classList.toggle('on', L.hold > -1);
  };
  return { el, set };
}

const floorLabel = (f) => (f < -62 ? ['çok sessiz ortam', 'ok'] : f < -52 ? ['iyi', 'ok'] : f < -44 ? ['biraz gürültülü', 'warn'] : ['gürültülü — temizleme önerilir', 'bad']);

export function openMic() {
  const st = {
    mode: lsGet('alpicut.micMode', 'natural'), gain: +lsGet('alpicut.micGain', '0'), playVideo: true, preset: lsGet('alpicut.micStudio', 'podcast'),
    phase: 'idle', take: null, processed: null, startT: 0, count: 0,
  };
  let rec = null, raf = 0, audio = null;
  const stopAudio = () => { if (audio) { audio.pause(); audio = null; } };
  const finish = () => { cancelAnimationFrame(raf); stopAudio(); if (rec) { rec.cancel(); rec = null; } if (app.engine.out) app.engine.out.gain.value = 1; app.pause(); };
  const startMonitor = async () => {
    if (rec) return;
    try { rec = await startRecorder({ mode: st.mode, gainDb: st.gain }); }
    catch (e) { toast(e.name === 'NotAllowedError' ? 'Mikrofon izni verilmedi. Ayarlar > Uygulamalar > Alpicut > İzinler bölümünden mikrofonu aç.' : e.name === 'NotFoundError' ? 'Mikrofon bulunamadı' : e.name === 'NotReadableError' ? 'Mikrofon başka bir uygulama tarafından kullanılıyor' : (e.message || 'Mikrofon açılamadı'), 5000); st.phase = 'error'; }
  };
  openSheet({
    id: 'mic', title: 'Kayıt stüdyosu',
    onClose: finish,
    render: (body) => {
      cancelAnimationFrame(raf);
      if (st.phase === 'review' && st.take) { review(body); return; }
      body.append(h('p', { class: 'hint', html: 'Sıkıştırmasız stüdyo kaydı. <b>Doğal mod</b> telefonun ses işlemesini kapatır (hışırtı ve "su altı" sesi yapmaz). Geri sayımda <b>sessiz kal</b>: ortam gürültüsü ölçülür ve kayıttan sonra temizlenir. Kulaklıkla kayıt en iyisidir.' }));
      body.append(fields(st, [
        { label: 'Mikrofon modu', path: 'mode', type: 'chips', options: [['natural', 'Doğal stüdyo (önerilen)'], ['phone', 'Telefon işlemesi']], post: () => { lsSet('alpicut.micMode', st.mode); if (rec && st.phase === 'idle') { rec.cancel(); rec = null; startMonitor(); } } },
        { label: 'Giriş kazancı (dB)', path: 'gain', type: 'range', min: -12, max: 24, step: 1, def: 0, fmt: (x) => `${x > 0 ? '+' : ''}${x} dB`, post: () => { lsSet('alpicut.micGain', String(st.gain)); rec?.setGain(st.gain); } },
        { label: 'Kayıtta videoyu sessiz oynat', path: 'playVideo', type: 'toggle' },
      ]));
      const m = meterEl();
      const info = h('div', { class: 'mic-info' }, '—');
      const time = h('div', { class: 'big-pct' }, st.phase === 'rec' ? fmt(rec?.elapsed() || 0) : '00:00.0');
      const btn = h('button', { class: `rec-btn${st.phase === 'rec' ? ' on' : ''}`, 'aria-label': 'Kaydet' });
      body.append(h('div', { class: 'rec-wrap' }, m.el, info, time, btn));
      if (!rec) info.textContent = 'Mikrofon kapalı — kayda başlayınca açılır';
      body.append(h('p', { class: 'hint', style: { textAlign: 'center' } }, st.phase === 'rec' ? 'Bitirmek için tekrar dokun' : st.phase === 'count' ? 'Sessiz kal… ortam gürültüsü ölçülüyor' : 'Seviye çubuğu konuşurken sarı bölgeye ulaşmalı, kırmızıya değil.'));
      const loopFn = () => {
        if (rec && body.isConnected) {
          const L = rec.level();
          m.set(L);
          const [lbl, cls] = floorLabel(L.floor);
          info.className = `mic-info ${cls}`;
          info.textContent = `Ortam gürültüsü: ${Math.round(L.floor)} dB · ${lbl}`;
          if (st.phase === 'rec') time.textContent = fmt(rec.elapsed());
        }
        raf = requestAnimationFrame(loopFn);
      };
      raf = requestAnimationFrame(loopFn);
      if (!rec && st.phase === 'idle') {
        const tb = h('button', { class: 'btn block', style: { marginTop: '6px' }, html: `${I.mic} Mikrofonu test et (seviyeyi gör)`, onclick: async () => { await startMonitor(); tb.remove(); } });
        body.append(tb);
      }
      btn.addEventListener('click', async () => {
        if (st.phase === 'idle' || st.phase === 'error') {
          await startMonitor();
          if (!rec) return;
          st.startT = app.engine.t;
          st.phase = 'count';
          rec.begin();
          for (let i = 3; i > 0; i--) { time.textContent = String(i); await new Promise((r) => setTimeout(r, 650)); if (!rec) return; }
          rec.mark();
          st.phase = 'rec';
          btn.classList.add('on');
          if (st.playVideo) { app.engine.ensureAudio(); if (app.engine.out) app.engine.out.gain.value = 0; app.engine.seek(st.startT); app.play(); }
        } else if (st.phase === 'rec') {
          const r = rec; rec = null;
          app.pause();
          if (app.engine.out) app.engine.out.gain.value = 1;
          const take = r.stop();
          if (take.voice.length < take.sr * 0.3) { toast('Kayıt çok kısa'); st.phase = 'idle'; refreshSheet(); return; }
          st.take = take; st.processed = null; st.phase = 'review';
          refreshSheet();
        }
      });
    },
  });

  async function processTake() {
    if (st.preset === 'none') return toWav(st.take.voice, st.take.sr);
    const b = busy('Stüdyo işleme…');
    try {
      return await processVoice(resample(st.take.voice, st.take.sr), STUDIO_PRESETS[st.preset], (p, t) => b.set(`${t} %${Math.round(p * 100)}`), { noise: st.take.noise.length > 4800 ? resample(st.take.noise, st.take.sr) : null });
    } finally { b.close(); }
  }

  function review(body) {
    const tk = st.take;
    const dur = tk.voice.length / tk.sr;
    body.append(h('p', { class: 'hint', html: `Kayıt hazır: <b>${dur.toFixed(1)} sn</b>. Ham ve işlenmiş hâlini dinleyip karşılaştır, sonra ekle.` }));
    body.append(fields(st, [{ label: 'Stüdyo işleme', path: 'preset', type: 'chips', options: [['none', 'Ham kayıt'], ...Object.entries(STUDIO_PRESETS).map(([k, v]) => [k, v.label])], post: () => { lsSet('alpicut.micStudio', st.preset); st.processed = null; } }]));
    const play = (blob, b) => {
      if (audio) { const same = audio._b === b; stopAudio(); b.parentElement.querySelectorAll('.btn').forEach((x) => x.classList.remove('primary')); if (same) return; }
      audio = new Audio(URL.createObjectURL(blob)); audio._b = b; b.classList.add('primary');
      audio.onended = () => { b.classList.remove('primary'); audio = null; };
      audio.play().catch(() => toast('Çalınamadı'));
    };
    const rawB = h('button', { class: 'btn', html: `${I.play} Ham`, onclick: () => play(toWav(tk.voice, tk.sr), rawB) });
    const proB = h('button', { class: 'btn', html: `${I.play} İşlenmiş`, onclick: async () => { if (!st.processed) st.processed = await processTake(); play(st.processed, proB); } });
    body.append(h('div', { class: 'btn-row' }, rawB, proB));
    body.append(h('div', { class: 'btn-row' },
      h('button', { class: 'btn', html: `${I.trash} Tekrar kaydet`, onclick: () => { stopAudio(); st.take = null; st.processed = null; st.phase = 'idle'; refreshSheet(); } }),
      h('button', { class: 'btn primary', html: `${I.check} Projeye ekle`, onclick: async () => {
        stopAudio();
        try {
          const blob = st.processed || await processTake();
          const d = new Date();
          const file = new File([blob], `Kayit_${d.getHours()}${String(d.getMinutes()).padStart(2, '0')}.wav`, { type: 'audio/wav' });
          const recs = await app.importFiles([file], true);
          if (recs[0]) {
            app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: st.startT, in: 0, out: recs[0].duration || dur, volume: 1, fadeIn: 0.02, fadeOut: 0.05, role: 'voice', afx: { hp: false, low: 0, mid: 0, high: 0, comp: false } });
            app.commit();
            toast('Kayıt eklendi');
          }
          st.take = null; st.processed = null; st.phase = 'idle';
          closeSheet();
        } catch (e) { toast(e.message || 'Eklenemedi', 4000); }
      } })));
  }
}

// 48 kHz'e (stüdyo zinciri) — kaynak zaten 48k ise aynen döner
function resample(x, sr) {
  if (sr === 48000) return x;
  const k = sr / 48000, n = Math.floor(x.length / k), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = i * k, j = Math.floor(p), f = p - j; out[i] = (x[j] || 0) * (1 - f) + (x[j + 1] || 0) * f; }
  return out;
}
