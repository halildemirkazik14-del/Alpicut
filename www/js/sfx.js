// Alpicut — uygulama içinde sentezlenen ses efektleri (lisans gerektirmez)
export const SFX = [
  ['whoosh', 'Whoosh', 0.7],
  ['riser', 'Yükselen', 1.6],
  ['pop', 'Pop', 0.18],
  ['boom', 'Bas vuruş', 1.1],
  ['ding', 'Ding', 1.3],
  ['click', 'Tık', 0.06],
  ['notif', 'Bildirim', 0.4],
  ['glitch', 'Glitch', 0.45],
  ['shutter', 'Deklanşör', 0.25],
  ['whistle', 'Hakem düdüğü', 0.9],
  ['crowd', 'Tribün', 3.0],
  ['swipe', 'Kaydırma', 0.35],
];

const SR = 44100;

function noiseBuffer(ctx, dur) {
  const b = ctx.createBuffer(1, Math.ceil(SR * dur), SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function env(g, t0, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(end, t0 + a + d);
}

function build(ctx, id, dur) {
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const noise = (len = dur) => { const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, len); return s; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  switch (id) {
    case 'whoosh': {
      const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, 0); bp.frequency.exponentialRampToValueAtTime(3200, dur * 0.55); bp.frequency.exponentialRampToValueAtTime(500, dur);
      const g = ctx.createGain(); env(g, 0, dur * 0.5, 0.9, dur * 0.5);
      const pan = ctx.createStereoPanner(); pan.pan.setValueAtTime(-0.8, 0); pan.pan.linearRampToValueAtTime(0.8, dur);
      n.connect(bp); bp.connect(g); g.connect(pan); pan.connect(out); n.start(0); break;
    }
    case 'riser': {
      const n = noise(); const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 2;
      hp.frequency.setValueAtTime(200, 0); hp.frequency.exponentialRampToValueAtTime(7000, dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.9, dur * 0.95); g.gain.linearRampToValueAtTime(0, dur);
      const o = osc('sawtooth', 110); o.frequency.exponentialRampToValueAtTime(880, dur);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, 0); og.gain.exponentialRampToValueAtTime(0.12, dur * 0.95); og.gain.linearRampToValueAtTime(0, dur);
      n.connect(hp); hp.connect(g); g.connect(out); o.connect(og); og.connect(out); n.start(0); o.start(0); o.stop(dur); break;
    }
    case 'pop': {
      const o = osc('sine', 700); o.frequency.exponentialRampToValueAtTime(180, dur);
      const g = ctx.createGain(); env(g, 0, 0.005, 0.9, dur - 0.01);
      o.connect(g); g.connect(out); o.start(0); o.stop(dur); break;
    }
    case 'boom': {
      const o = osc('sine', 140); o.frequency.exponentialRampToValueAtTime(38, dur * 0.8);
      const g = ctx.createGain(); env(g, 0, 0.01, 1, dur - 0.02);
      const n = noise(0.3); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const ng = ctx.createGain(); env(ng, 0, 0.003, 0.7, 0.25);
      o.connect(g); g.connect(out); n.connect(lp); lp.connect(ng); ng.connect(out); o.start(0); o.stop(dur); n.start(0); break;
    }
    case 'ding': {
      [[1318.5, 0.5], [2637, 0.18], [3955, 0.06]].forEach(([f, a]) => {
        const o = osc('sine', f); const g = ctx.createGain(); env(g, 0, 0.004, a, dur - 0.01);
        o.connect(g); g.connect(out); o.start(0); o.stop(dur);
      });
      break;
    }
    case 'click': {
      const n = noise(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const g = ctx.createGain(); env(g, 0, 0.001, 0.8, dur - 0.002);
      n.connect(hp); hp.connect(g); g.connect(out); n.start(0); break;
    }
    case 'notif': {
      [[880, 0], [1318.5, 0.14]].forEach(([f, t0]) => {
        const o = osc('triangle', f); const g = ctx.createGain(); env(g, t0, 0.005, 0.5, 0.22);
        o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.25);
      });
      break;
    }
    case 'glitch': {
      const o = osc('square', 200); const g = ctx.createGain(); g.gain.value = 0.18;
      for (let t = 0; t < dur; t += 0.03) o.frequency.setValueAtTime(80 + Math.random() * 1800, t);
      const lg = ctx.createGain(); env(lg, 0, 0.005, 1, dur - 0.01);
      o.connect(g); g.connect(lg); lg.connect(out); o.start(0); o.stop(dur); break;
    }
    case 'shutter': {
      [0, 0.09].forEach((t0) => {
        const n = noise(0.08); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 0.8;
        const g = ctx.createGain(); env(g, t0, 0.002, 0.9, 0.06);
        n.connect(bp); bp.connect(g); g.connect(out); n.start(t0);
      });
      break;
    }
    case 'whistle': {
      const o = osc('sine', 2900);
      const lfo = osc('square', 38); const lg = ctx.createGain(); lg.gain.value = 120;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.45, 0.03); g.gain.setValueAtTime(0.45, dur - 0.08); g.gain.exponentialRampToValueAtTime(0.0001, dur);
      const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2900; bp.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = 0.15;
      o.connect(g); n.connect(bp); bp.connect(ng); ng.connect(g); g.connect(out);
      o.start(0); lfo.start(0); o.stop(dur); lfo.stop(dur); n.start(0); break;
    }
    case 'crowd': {
      for (let i = 0; i < 2; i++) {
        const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + i * 600; bp.Q.value = 0.7;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.5, 0.6); g.gain.setValueAtTime(0.5, dur - 0.8); g.gain.exponentialRampToValueAtTime(0.0001, dur);
        const am = osc('sine', 3 + i * 1.7); const amg = ctx.createGain(); amg.gain.value = 0.15;
        am.connect(amg); amg.connect(g.gain);
        const pan = ctx.createStereoPanner(); pan.pan.value = i ? 0.5 : -0.5;
        n.connect(bp); bp.connect(g); g.connect(pan); pan.connect(out); n.start(0); am.start(0); am.stop(dur);
      }
      break;
    }
    case 'swipe': {
      const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
      bp.frequency.setValueAtTime(1500, 0); bp.frequency.exponentialRampToValueAtTime(5000, dur);
      const g = ctx.createGain(); env(g, 0, 0.04, 0.6, dur - 0.05);
      n.connect(bp); bp.connect(g); g.connect(out); n.start(0); break;
    }
  }
}

function toWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([data], { type: 'audio/wav' });
}

export async function renderSfx(id) {
  const item = SFX.find((x) => x[0] === id);
  const dur = item[2];
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
  build(ctx, id, dur);
  const buf = await ctx.startRendering();
  return { blob: toWav(buf), duration: dur, buffer: buf };
}
