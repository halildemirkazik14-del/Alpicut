// Alpicut — uygulama içinde sentezlenen ses efektleri (lisans gerektirmez)
// v1.5: eski kimlikler yeni ses fabrikası kütüphanesine yönlenir (Alpi-co / otomatik kurgu uyumu)
export const SFX_MAP = { whoosh: 'whoosh_air', riser: 'riser_noise2', pop: 'pop', boom: 'impact_boom', ding: 'ding', click: 'click', notif: 'notify', glitch: 'glitch_short', shutter: 'camera', whistle: 'whistle', crowd: 'crowd_cheer', swipe: 'swipe', vineboom: 'impact_meme', bigimpact: 'impact_cine', whooshhit: 'whoosh_hit', bassdrop: 'subdrop', cashreg: 'cash', coins: 'coin', airhorn: 'airhorn', scratch: 'glitch_scratch', boing: 'boing', sadtrombone: 'sad_trombone', dundun: 'dundun', drumroll: 'drumroll', rimshot: 'rimshot', correct: 'correct', wrong: 'wrong', suspense: 'tension_suspense', heartbeat: 'heartbeat', tick: 'tension_clock', typing: 'keyboard', laser: 'laser', magic: 'sparkle', swooshup: 'whoosh_up', swooshdown: 'whoosh_down', bubble: 'bubble', beeps: 'countdown', dingdong: 'dingdong', bell: 'subscribe_bell', slowmo: 'slowmo', stutter: 'glitch_mid', goalhorn: 'goal_horn' };

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
  // Viral / YouTuber tarzı (tamamen uygulamada sentezlenir — telifsiz)
  ['vineboom', 'Meme boom (derin vuruş)', 1.6, 'Viral & YouTuber'],
  ['bigimpact', 'Büyük darbe (geçiş)', 2.2, 'Viral & YouTuber'],
  ['whooshhit', 'Whoosh + darbe', 1.4, 'Viral & YouTuber'],
  ['bassdrop', 'Bas düşüşü', 1.8, 'Viral & YouTuber'],
  ['cashreg', 'Kasa (ça-çing)', 1.2, 'Viral & YouTuber'],
  ['coins', 'Para sesi', 1.0, 'Viral & YouTuber'],
  ['airhorn', 'Korna (air horn)', 1.6, 'Viral & YouTuber'],
  ['scratch', 'Plak cızırtısı', 0.7, 'Viral & YouTuber'],
  ['boing', 'Boing (çizgi film)', 0.8, 'Viral & YouTuber'],
  ['sadtrombone', 'Hüzünlü trombon', 2.4, 'Viral & YouTuber'],
  ['dundun', 'Dun dun dunnn (dramatik)', 2.6, 'Viral & YouTuber'],
  ['drumroll', 'Davul çalışı + zil', 3.0, 'Viral & YouTuber'],
  ['rimshot', 'Ba-dum-tss', 1.2, 'Viral & YouTuber'],
  ['correct', 'Doğru cevap', 0.7, 'Viral & YouTuber'],
  ['wrong', 'Yanlış cevap (buzzer)', 0.8, 'Viral & YouTuber'],
  ['suspense', 'Gerilim', 3.0, 'Viral & YouTuber'],
  ['heartbeat', 'Kalp atışı', 1.6, 'Viral & YouTuber'],
  ['tick', 'Saat tik-tak', 4.0, 'Viral & YouTuber'],
  ['typing', 'Klavye yazma', 1.8, 'Viral & YouTuber'],
  ['laser', 'Lazer / zap', 0.5, 'Viral & YouTuber'],
  ['magic', 'Sihir parıltısı', 1.4, 'Viral & YouTuber'],
  ['swooshup', 'Hızlı yukarı swoosh', 0.45, 'Viral & YouTuber'],
  ['swooshdown', 'Hızlı aşağı swoosh', 0.45, 'Viral & YouTuber'],
  ['bubble', 'Baloncuk pop', 0.25, 'Viral & YouTuber'],
  ['beeps', 'Geri sayım bip', 3.4, 'Viral & YouTuber'],
  ['dingdong', 'Ding-dong', 1.4, 'Viral & YouTuber'],
  ['bell', 'Abone zili', 1.6, 'Viral & YouTuber'],
  ['slowmo', 'Ağır çekim', 1.4, 'Viral & YouTuber'],
  ['stutter', 'Dijital takılma', 0.8, 'Viral & YouTuber'],
  ['goalhorn', 'Gol sireni', 2.5, 'Viral & YouTuber'],
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

function reverb(ctx, sec = 1.8, decay = 3) {
  const n = Math.ceil(SR * sec);
  const b = ctx.createBuffer(2, n, SR);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  const cv = ctx.createConvolver(); cv.buffer = b; return cv;
}

function build(ctx, id, dur) {
  const out = ctx.createGain();
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.1;
  out.connect(lim); lim.connect(ctx.destination);
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
    case 'vineboom': case 'bigimpact': case 'bassdrop': {
      const big = id === 'bigimpact', drop = id === 'bassdrop';
      const o = osc('sine', drop ? 160 : 95); o.frequency.exponentialRampToValueAtTime(drop ? 32 : 40, drop ? dur * 0.9 : 0.5);
      const ws = ctx.createWaveShaper(); const cur = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cur[i] = Math.tanh(x * (drop ? 4 : 2.5)); } ws.curve = cur;
      const g = ctx.createGain(); env(g, 0, 0.006, 1, dur * 0.85);
      o.connect(ws); ws.connect(g); g.connect(out); o.start(0); o.stop(dur);
      const n = noise(0.5); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = big ? 2400 : 1200;
      const ng = ctx.createGain(); env(ng, 0, 0.002, big ? 0.9 : 0.6, 0.35);
      const rv = reverb(ctx, big ? 2.2 : 1.4, 2.5); const rg = ctx.createGain(); rg.gain.value = big ? 0.5 : 0.35;
      n.connect(lp); lp.connect(ng); ng.connect(out); ng.connect(rv); g.connect(rv); rv.connect(rg); rg.connect(out); n.start(0);
      if (big) { const n2 = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1; bp.frequency.setValueAtTime(400, 0); bp.frequency.exponentialRampToValueAtTime(5000, 0.35); const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, 0); g2.gain.exponentialRampToValueAtTime(0.5, 0.3); g2.gain.exponentialRampToValueAtTime(0.0001, 0.45); n2.connect(bp); bp.connect(g2); g2.connect(out); n2.start(0); }
      break;
    }
    case 'whooshhit': {
      const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.3;
      bp.frequency.setValueAtTime(250, 0); bp.frequency.exponentialRampToValueAtTime(4500, 0.5);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.9, 0.48); g.gain.exponentialRampToValueAtTime(0.0001, 0.6);
      n.connect(bp); bp.connect(g); g.connect(out); n.start(0);
      const o = osc('sine', 120); o.frequency.setValueAtTime(120, 0.5); o.frequency.exponentialRampToValueAtTime(40, 1.1);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, 0); og.gain.setValueAtTime(0.0001, 0.49); og.gain.exponentialRampToValueAtTime(1, 0.51); og.gain.exponentialRampToValueAtTime(0.0001, dur);
      const rv = reverb(ctx, 1.2); const rg = ctx.createGain(); rg.gain.value = 0.3; og.connect(rv); rv.connect(rg); rg.connect(out);
      o.connect(og); og.connect(out); o.start(0); o.stop(dur); break;
    }
    case 'cashreg': case 'coins': {
      const pings = id === 'coins' ? [0, 0.08, 0.14, 0.22, 0.3, 0.36] : [0.12, 0.2];
      if (id === 'cashreg') { const n = noise(0.1); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; const g = ctx.createGain(); env(g, 0, 0.002, 0.8, 0.08); n.connect(bp); bp.connect(g); g.connect(out); n.start(0); }
      pings.forEach((t0, i) => { [[2093 + i * 120, 0.35], [4186 + i * 200, 0.15], [6272, 0.06]].forEach(([f, a]) => { const o = osc('sine', f); const g = ctx.createGain(); env(g, t0, 0.003, a, id === 'coins' ? 0.35 : 0.9); o.connect(g); g.connect(out); o.start(t0); o.stop(Math.min(dur, t0 + 1)); }); });
      break;
    }
    case 'airhorn': {
      [0, 0.32, 0.64].forEach((t0, k) => {
        const len = k === 2 ? 0.9 : 0.26;
        [466, 587, 698].forEach((f) => {
          const o = osc('sawtooth', f); const vib = osc('sine', 6); const vg = ctx.createGain(); vg.gain.value = 6; vib.connect(vg); vg.connect(o.frequency);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02); g.gain.setValueAtTime(0.16, t0 + len - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
          o.connect(lp); lp.connect(g); g.connect(out); o.start(t0); vib.start(t0); o.stop(t0 + len); vib.stop(t0 + len);
        });
      });
      break;
    }
    case 'scratch': {
      const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
      for (let t = 0; t < dur; t += 0.05) bp.frequency.setValueAtTime(400 + (Math.sin(t * 40) * 0.5 + 0.5) * 2200, t);
      const g = ctx.createGain(); g.gain.value = 0;
      for (let t = 0; t < dur; t += 0.12) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); }
      n.connect(bp); bp.connect(g); g.connect(out); n.start(0); break;
    }
    case 'boing': {
      const o = osc('sine', 320); const lfo = osc('sine', 18); const lg = ctx.createGain(); lg.gain.setValueAtTime(120, 0); lg.gain.exponentialRampToValueAtTime(5, dur);
      lfo.connect(lg); lg.connect(o.frequency); o.frequency.exponentialRampToValueAtTime(180, dur);
      const g = ctx.createGain(); env(g, 0, 0.01, 0.6, dur - 0.02); o.connect(g); g.connect(out); o.start(0); lfo.start(0); o.stop(dur); lfo.stop(dur); break;
    }
    case 'sadtrombone': {
      [[311, 0, 0.45], [293, 0.5, 0.45], [277, 1.0, 0.45], [262, 1.5, 0.9]].forEach(([f, t0, len], i) => {
        const o = osc('sawtooth', f); if (i === 3) { const v = osc('sine', 5); const vg = ctx.createGain(); vg.gain.value = 8; v.connect(vg); vg.connect(o.frequency); v.start(t0); v.stop(t0 + len); }
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t0); lp.frequency.linearRampToValueAtTime(1400, t0 + len * 0.5); lp.frequency.linearRampToValueAtTime(600, t0 + len);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(t0); o.stop(t0 + len);
      });
      break;
    }
    case 'dundun': {
      const rv = reverb(ctx, 2.5, 2); const rg = ctx.createGain(); rg.gain.value = 0.45; rv.connect(rg); rg.connect(out);
      [[0, 0.3], [0.42, 0.3], [0.84, 1.7]].forEach(([t0, len], k) => {
        const base = k === 2 ? 73.4 : 77.8;
        [1, 1.5, 2, 3].forEach((m, j) => {
          const o = osc(j ? 'sawtooth' : 'triangle', base * m); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22 / (j + 1), t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
          o.connect(lp); lp.connect(g); g.connect(out); g.connect(rv); o.start(t0); o.stop(t0 + len);
        });
      });
      break;
    }
    case 'drumroll': case 'rimshot': {
      const snare = (t0, a) => { const n = noise(0.15); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500; const g = ctx.createGain(); env(g, t0, 0.001, a, 0.12); n.connect(hp); hp.connect(g); g.connect(out); n.start(t0); const o = osc('triangle', 190); const og = ctx.createGain(); env(og, t0, 0.001, a * 0.5, 0.08); o.connect(og); og.connect(out); o.start(t0); o.stop(t0 + 0.1); };
      const crash = (t0, len) => { const n = noise(len); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000; const g = ctx.createGain(); env(g, t0, 0.002, 0.6, len - 0.01); n.connect(hp); hp.connect(g); g.connect(out); n.start(t0); };
      const kick = (t0) => { const o = osc('sine', 130); o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.15); const g = ctx.createGain(); env(g, t0, 0.002, 0.9, 0.2); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.25); };
      if (id === 'rimshot') { snare(0, 0.6); kick(0.18); snare(0.18, 0.4); crash(0.36, 0.8); }
      else { for (let t = 0; t < 2.2; t += 0.045) snare(t, 0.15 + (t / 2.2) * 0.45); kick(2.25); crash(2.25, 0.75); }
      break;
    }
    case 'correct': [[880, 0], [1318.5, 0.12]].forEach(([f, t0]) => { const o = osc('sine', f); const o2 = osc('triangle', f * 2); const g = ctx.createGain(); env(g, t0, 0.004, 0.45, 0.5); o.connect(g); o2.connect(g); g.connect(out); o.start(t0); o2.start(t0); o.stop(t0 + 0.55); o2.stop(t0 + 0.55); }); break;
    case 'wrong': { const o = osc('square', 110); const o2 = osc('square', 116); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const g = ctx.createGain(); g.gain.setValueAtTime(0.25, 0); g.gain.setValueAtTime(0.25, dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, dur); o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out); o.start(0); o2.start(0); o.stop(dur); o2.stop(dur); break; }
    case 'suspense': {
      [55, 58.3, 82.4].forEach((f) => { const o = osc('sawtooth', f); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(200, 0); lp.frequency.exponentialRampToValueAtTime(2500, dur * 0.9); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.16, dur * 0.9); g.gain.linearRampToValueAtTime(0, dur); o.connect(lp); lp.connect(g); g.connect(out); o.start(0); o.stop(dur); });
      const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(500, 0); bp.frequency.exponentialRampToValueAtTime(6000, dur); const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, 0); ng.gain.exponentialRampToValueAtTime(0.25, dur * 0.95); ng.gain.linearRampToValueAtTime(0, dur); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(0);
      break;
    }
    case 'heartbeat': [[0, 1], [0.22, 0.7], [0.85, 1], [1.07, 0.7]].forEach(([t0, a]) => { const o = osc('sine', 60); o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.12); const g = ctx.createGain(); env(g, t0, 0.005, a, 0.16); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.2); }); break;
    case 'tick': for (let t = 0, k = 0; t < dur - 0.1; t += 0.5, k++) { const n = noise(0.03); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = k % 2 ? 2600 : 3400; bp.Q.value = 6; const g = ctx.createGain(); env(g, t, 0.001, 0.9, 0.025); n.connect(bp); bp.connect(g); g.connect(out); n.start(t); } break;
    case 'typing': for (let t = 0; t < dur - 0.05; t += 0.07 + Math.random() * 0.09) { const n = noise(0.03); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 2500; bp.Q.value = 3; const g = ctx.createGain(); env(g, t, 0.001, 0.4 + Math.random() * 0.4, 0.025); n.connect(bp); bp.connect(g); g.connect(out); n.start(t); } break;
    case 'laser': { const o = osc('sawtooth', 2400); o.frequency.exponentialRampToValueAtTime(120, dur); const g = ctx.createGain(); env(g, 0, 0.003, 0.35, dur - 0.01); o.connect(g); g.connect(out); o.start(0); o.stop(dur); break; }
    case 'magic': { const rv = reverb(ctx, 1.5); const rg = ctx.createGain(); rg.gain.value = 0.5; rv.connect(rg); rg.connect(out); [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => { const t0 = i * 0.07; const o = osc('sine', f); const g = ctx.createGain(); env(g, t0, 0.003, 0.25, 0.6); o.connect(g); g.connect(out); g.connect(rv); o.start(t0); o.stop(t0 + 0.7); }); break; }
    case 'swooshup': case 'swooshdown': { const n = noise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5; const up = id === 'swooshup'; bp.frequency.setValueAtTime(up ? 500 : 6000, 0); bp.frequency.exponentialRampToValueAtTime(up ? 6000 : 400, dur); const g = ctx.createGain(); env(g, 0, dur * 0.4, 0.9, dur * 0.55); n.connect(bp); bp.connect(g); g.connect(out); n.start(0); break; }
    case 'bubble': { const o = osc('sine', 300); o.frequency.exponentialRampToValueAtTime(1400, dur * 0.7); const g = ctx.createGain(); env(g, 0, 0.005, 0.6, dur - 0.01); o.connect(g); g.connect(out); o.start(0); o.stop(dur); break; }
    case 'beeps': [0, 1, 2].forEach((k) => { const o = osc('sine', 880); const g = ctx.createGain(); env(g, k, 0.005, 0.5, 0.18); o.connect(g); g.connect(out); o.start(k); o.stop(k + 0.2); }); { const o = osc('sine', 1760); const g = ctx.createGain(); env(g, 3, 0.005, 0.5, 0.38); o.connect(g); g.connect(out); o.start(3); o.stop(3.4); } break;
    case 'dingdong': [[1318.5, 0], [1046.5, 0.45]].forEach(([f, t0]) => { [[1, 0.4], [2.76, 0.12], [5.4, 0.05]].forEach(([m, a]) => { const o = osc('sine', f * m); const g = ctx.createGain(); env(g, t0, 0.004, a, 0.9); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.95); }); }); break;
    case 'bell': { const rv = reverb(ctx, 1.4); const rg = ctx.createGain(); rg.gain.value = 0.3; rv.connect(rg); rg.connect(out); [0, 0.18].forEach((t0) => [[1568, 0.35], [3136, 0.15], [4699, 0.08], [6272, 0.04]].forEach(([f, a]) => { const o = osc('sine', f); const g = ctx.createGain(); env(g, t0, 0.003, a, 1.1); o.connect(g); g.connect(out); g.connect(rv); o.start(t0); o.stop(t0 + 1.2); })); break; }
    case 'slowmo': { const n = noise(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, 0); lp.frequency.exponentialRampToValueAtTime(150, dur); const g = ctx.createGain(); env(g, 0, 0.05, 0.8, dur - 0.06); const o = osc('sine', 300); o.frequency.exponentialRampToValueAtTime(50, dur); const og = ctx.createGain(); env(og, 0, 0.05, 0.4, dur - 0.06); n.connect(lp); lp.connect(g); g.connect(out); o.connect(og); og.connect(out); n.start(0); o.start(0); o.stop(dur); break; }
    case 'stutter': { const o = osc('square', 300); const g = ctx.createGain(); g.gain.value = 0; for (let t = 0; t < dur; t += 0.06) { g.gain.setValueAtTime(Math.random() > 0.3 ? 0.2 : 0, t); o.frequency.setValueAtTime([150, 300, 600, 1200][Math.floor(Math.random() * 4)], t); } o.connect(g); g.connect(out); o.start(0); o.stop(dur); break; }
    case 'goalhorn': { [138.6, 174.6, 207.7].forEach((f) => { const o = osc('sawtooth', f); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.2, 0.15); g.gain.setValueAtTime(0.2, dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, dur); o.connect(lp); lp.connect(g); g.connect(out); o.start(0); o.stop(dur); }); break; }

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
  let pk = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; } }
  if (pk > 0.95) { const k = 0.95 / pk; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
  return { blob: toWav(buf), duration: dur, buffer: buf };
}
