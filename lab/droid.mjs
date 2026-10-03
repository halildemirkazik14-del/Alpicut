// Gerçek Android WebView (emülatör) içinde Alpicut testleri — bağımlılıksız CDP istemcisi
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const OUT = 'lab/out';
fs.mkdirSync(OUT, { recursive: true });
const R = { steps: {}, errors: [], logs: [] };
const T0 = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => { try { execSync(`adb exec-out screencap -p > ${OUT}/${name}.png`); } catch (_) { /* yoksay */ } };

let ws, seq = 0;
const pending = new Map();
async function connect() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
      const t = list.find((x) => x.type === 'page' && /localhost/.test(x.url)) || list.find((x) => x.type === 'page');
      if (t) {
        ws = new WebSocket(t.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        ws.onmessage = (m) => {
          const d = JSON.parse(m.data);
          if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); return; }
          if (d.method === 'Runtime.exceptionThrown') R.errors.push(`EXC ${(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').slice(0, 400)}`);
          if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(d.params.type)) R.logs.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
          if (d.method === 'Log.entryAdded' && ['error', 'warning'].includes(d.params.entry.level)) R.logs.push(`log-${d.params.entry.level}: ${(d.params.entry.text || '').slice(0, 300)} ${d.params.entry.url || ''}`);
        };
        ws.onclose = () => { R.errors.push('CDP bağlantısı kapandı (sayfa çökmüş/yeniden yüklenmiş olabilir)'); };
        return t;
      }
    } catch (_) { /* tekrar dene */ }
    await sleep(2000);
  }
  throw new Error('WebView bulunamadı');
}
function cdp(method, params = {}, timeout = 60000) {
  const id = ++seq;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`${method} zaman aşımı`)); } }, timeout);
  });
}
async function ev(fn, arg, timeout = 120000) {
  const r = await cdp('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(arg ?? null)})`, awaitPromise: true, returnByValue: true, userGesture: true }, timeout);
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'hata').slice(0, 600));
  return r.result.value;
}
async function step(name, fn) {
  const t = Date.now();
  try { R.steps[name] = { ok: true, ...(await fn()) }; } catch (e) { R.steps[name] = { ok: false, error: String(e?.message || e).slice(0, 700) }; }
  R.steps[name].ms = Date.now() - t;
  console.log(name, JSON.stringify(R.steps[name]).slice(0, 600));
  fs.writeFileSync(`${OUT}/droid.json`, JSON.stringify(R, null, 1));
}
async function tapEl(sel) {
  const r = await ev((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
  if (!r) throw new Error(`öğe yok: ${sel}`);
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
  await sleep(60);
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
  return r;
}
async function tapXY(x, y) {
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(60);
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
}

const extra = fs.existsSync('lab/droid-extra.mjs') ? await import('../lab/droid-extra.mjs') : null;

await connect();
await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.enable').catch(() => {});

await step('env', () => ev(async () => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const mr = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm', 'audio/webm;codecs=opus', 'audio/mp4'].filter((m) => window.MediaRecorder?.isTypeSupported(m));
  return { ua: navigator.userAgent, webgl: !!gl, webgl2: !!c.getContext('webgl2'), gpu: !!navigator.gpu, sab: typeof SharedArrayBuffer, coi: self.crossOriginIsolated, mem: navigator.deviceMemory, cores: navigator.hardwareConcurrency, mr, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, native: !!window.Capacitor?.isNativePlatform?.(), plugins: Object.keys(window.Capacitor?.Plugins || {}), caches: typeof caches, worker: typeof Worker };
}));
shot('01-home');

if (extra?.run) {
  await extra.run({ ev, step, cdp, tapEl, tapXY, shot, sleep, R });
} else {
  await step('newProject', async () => { await tapEl('#newProject'); await sleep(800); shot('02-editor'); return ev(() => ({ editor: !document.getElementById('editor').classList.contains('hidden') })); });

  await step('import', () => ev(async () => {
    const app = window.__alpicut;
    const get = async (u, n, t) => new File([await (await fetch(u)).blob()], n, { type: t });
    const files = [await get('labmedia/test.mp4', 'test.mp4', 'video/mp4'), await get('labmedia/wide.mp4', 'wide.mp4', 'video/mp4')];
    const recs = await app.importFiles(files);
    recs.forEach((m) => app.P.clips.push({ id: Math.random().toString(36).slice(2), mediaId: m.id, type: 'video', in: 0, out: m.duration, dur: 3, speed: 1, volume: 1, mute: false, fit: 'cover', bgMode: 'blur', bgColor: '#000', zoom: 1, panX: 0, panY: 0, filters: {}, filterPreset: 'none', trans: { type: 'none', dur: 0.5 }, kf: {} }));
    app.commit();
    return { n: recs.length, durs: recs.map((r) => r.duration), dims: recs.map((r) => `${r.w}x${r.h}`), total: app.engine.duration() };
  }, null, 120000));
  shot('03-imported');

  const health = () => ev(async () => {
    const app = window.__alpicut; const E = app.engine;
    E.seek(0.5); await new Promise((r) => setTimeout(r, 400));
    const t0 = E.t; app.play(); await new Promise((r) => setTimeout(r, 2500)); const t1 = E.t; app.pause();
    await new Promise((r) => setTimeout(r, 300));
    E.draw();
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = c.getContext('2d'); x.drawImage(E.canvas, 0, 0, 32, 32);
    const d = x.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    return { advanced: +(t1 - t0).toFixed(2), brightness: +(s / (32 * 32 * 3)).toFixed(1), canvas: `${E.canvas.width}x${E.canvas.height}` };
  });
  await step('playback', health);

  await step('timelineEdges', () => ev(async () => {
    const app = window.__alpicut; const sc = document.getElementById('tlScroll');
    const dur = app.engine.duration();
    sc.scrollLeft = 1e7; await new Promise((r) => setTimeout(r, 500));
    const endT = app.engine.t, maxScroll = sc.scrollWidth - sc.clientWidth, expected = dur * app.pps;
    sc.scrollLeft = 0; await new Promise((r) => setTimeout(r, 500));
    return { dur, endT, maxScroll, expected, overshootPx: maxScroll - expected, startT: app.engine.t };
  }));

  await step('toolSweep', async () => {
    const names = await ev(() => [...document.querySelectorAll('#toolbar .tool')].map((b) => b.textContent.trim()));
    const res = {};
    for (let i = 0; i < names.length; i++) {
      const before = R.errors.length + R.logs.length;
      try {
        await ev((k) => { document.querySelectorAll('#toolbar .tool')[k]?.click(); }, i, 15000);
        await sleep(900);
        const st = await ev(() => ({ sheet: document.getElementById('sheet')?.classList.contains('open'), title: document.getElementById('sheetTitle')?.textContent, fileDialog: false }));
        if (i % 4 === 0) shot(`tool-${i}`);
        res[names[i]] = { ...st, newErr: R.errors.length + R.logs.length - before };
        await ev(() => { try { window.__alpicut && document.getElementById('sheetClose')?.click(); } catch (_) {} }, null, 10000);
        await sleep(300);
      } catch (e) { res[names[i]] = { err: String(e.message).slice(0, 200) }; }
    }
    return { res };
  });

  await step('tapPreviewWithSheet', async () => {
    await ev(() => { document.querySelector('#toolbar .tool.ai')?.click(); }); await sleep(700);
    const r = await ev(() => { const b = document.getElementById('previewWrap').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.3 }; });
    await tapXY(r.x, r.y);
    return ev(() => ({ sheetStillOpen: document.getElementById('sheet').classList.contains('open') }));
  });

  await step('bgRemoval', () => ev(async () => {
    const app = window.__alpicut;
    const c = app.P.clips[0];
    c.bgr = { on: true, threshold: 0.5, edge: 0.15, feather: 2, mode: 'color', color: '#00FF00', blur: 30 };
    const t0 = performance.now();
    const S = await import('./js/seg.js'); await S.initSegmenter(); app.engine.seg = S;
    const tInit = performance.now() - t0;
    app.engine.seek(1); await new Promise((r) => setTimeout(r, 500)); app.engine.draw();
    const t1 = performance.now(); for (let i = 0; i < 5; i++) app.engine.draw(1 + i / 30); const perFrame = (performance.now() - t1) / 5;
    const E = app.engine; const x = document.createElement('canvas'); x.width = 16; x.height = 16; const g = x.getContext('2d'); g.drawImage(E.canvas, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data; let green = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 200 && d[i] < 80 && d[i + 2] < 80) green++;
    app.commit();
    return { tInit: Math.round(tInit), perFrameMs: Math.round(perFrame), greenPct: +(green / 256).toFixed(2) };
  }, null, 300000));
  shot('04-bgremoval');

  await step('studioNoise', () => ev(async () => {
    const S = await import('./js/studio.js');
    const blob = await (await fetch('labmedia/noisy.wav')).blob();
    const measure = async (b) => {
      const ac = new OfflineAudioContext(1, 48000, 48000); const a = await ac.decodeAudioData(await b.arrayBuffer()); const x = a.getChannelData(0);
      const rms = (s, e) => { let q = 0; const i0 = Math.floor(s * 48000), i1 = Math.min(x.length, Math.floor(e * 48000)); for (let i = i0; i < i1; i++) q += x[i] * x[i]; return 10 * Math.log10(q / Math.max(1, i1 - i0) + 1e-12); };
      return { speech: +rms(1, 4).toFixed(1), tail: +rms(a.duration - 1.2, a.duration - 0.2).toFixed(1), dur: +a.duration.toFixed(2) };
    };
    const before = await measure(blob);
    const out = {};
    for (const k of Object.keys(S.STUDIO_PRESETS)) { try { out[k] = await measure(await S.processVoice(blob, S.STUDIO_PRESETS[k])); } catch (e) { out[k] = String(e.message || e); } }
    return { before, out };
  }, null, 400000));

  await step('mic', () => ev(async () => {
    const A = await import('./js/audiotools.js');
    try {
      const r = await A.startMic(); await new Promise((q) => setTimeout(q, 2500)); const b = await r.stop();
      const ac = new OfflineAudioContext(1, 48000, 48000); const a = await ac.decodeAudioData(await b.arrayBuffer()); const x = a.getChannelData(0);
      let q = 0; for (const v of x) q += v * v;
      return { type: b.type, size: b.size, dur: a.duration, rmsDb: +(10 * Math.log10(q / x.length + 1e-12)).toFixed(1) };
    } catch (e) { return { err: `${e.name}: ${e.message}` }; }
  }, null, 60000));

  await step('tts', () => ev(async () => {
    const t0 = performance.now();
    const T = await import('./vendor/piper/piper-tts-web.js');
    const wav = await T.predict({ text: 'Merhaba, bu bir deneme.', voiceId: 'tr_TR-dfki-medium' });
    return { size: wav.size, ms: Math.round(performance.now() - t0) };
  }, null, 600000));

  await step('captions', async () => {
    await ev(() => { localStorage.setItem('alpicut.asrSize', 'tiny'); localStorage.setItem('alpicut.asrLang', 'turkish'); });
    await ev(async () => { const m = await import('./js/ai.js'); m.openAutoCaptions(); });
    await sleep(800);
    shot('05-captions-sheet');
    await ev(() => { [...document.querySelectorAll('#sheetBody .btn.primary')].pop()?.click(); });
    let res = null;
    for (let i = 0; i < 180; i++) {
      await sleep(5000);
      res = await ev(() => ({ cues: window.__alpicut.P.subs?.cues?.length || 0, sheet: document.getElementById('sheetBody')?.innerText.slice(0, 160), open: document.getElementById('sheet').classList.contains('open') })).catch((e) => ({ dead: String(e.message) }));
      if (res.dead || res.cues || (!res.open)) break;
      if (i === 6) shot('06-captions-progress');
    }
    shot('07-captions-done');
    const sample = await ev(() => (window.__alpicut.P.subs?.cues || []).slice(0, 4).map((c) => `${c.start.toFixed(2)}-${c.end.toFixed(2)} ${c.text}`)).catch(() => null);
    return { res, sample };
  });

  await step('playbackAfterCaptions', health);

  await step('export', () => ev(async () => {
    const app = window.__alpicut; const t0 = performance.now();
    const r = await app.engine.export({ res: 0.5, fps: 30, bitrate: 4e6 });
    return { size: r?.blob.size, ext: r?.ext, ms: Math.round(performance.now() - t0), dur: app.engine.duration() };
  }, null, 300000));
}

R.totalMs = Date.now() - T0;
fs.writeFileSync(`${OUT}/droid.json`, JSON.stringify(R, null, 1));
console.log('BİTTİ', Object.entries(R.steps).filter(([, v]) => !v.ok).map(([k]) => k).join(', ') || 'tümü başarılı');
process.exit(0);
