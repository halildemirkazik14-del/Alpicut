// Whisper hata ayıklama (CI): farklı ayarlarla ham çıktılar
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
fs.mkdirSync('lab/out', { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.wav': 'audio/wav' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join('www', u === '/' ? 'index.html' : u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8092);
const b = await chromium.launch();
const pg = await (await b.newContext()).newPage();
pg.setDefaultTimeout(900000);
const logs = []; pg.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`.slice(0, 400)));
await pg.goto('http://localhost:8092/index.html'); await pg.waitForTimeout(1000);
const R = await pg.evaluate(async () => {
  const res = {};
  const dec = async (ab) => { const ctx = new OfflineAudioContext(1, 16000, 16000); const b = await ctx.decodeAudioData(ab); return b.getChannelData(0).slice(); };
  const peak = (x) => { let p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i])); return p; };
  const norm = (x) => { const p = peak(x); const k = p > 0 ? 0.9 / p : 1; const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x[i] * k; return o; };
  const a1 = await dec(await (await fetch('labmedia/test.mp4')).arrayBuffer());
  res.a1 = { len: a1.length / 16000, peak: peak(a1) };
  let a2 = null;
  try { const T = await import('./vendor/piper/piper-tts-web.js'); const w = await T.predict({ text: 'Bugün harika bir maç izledik. İkinci yarıda kaleci inanılmaz bir kurtarış yaptı ve son dakikada gol geldi.', voiceId: 'tr_TR-dfki-medium' }); const x = await dec(await w.arrayBuffer()); a2 = new Float32Array(16000 * 3 + x.length + 16000 * 2); a2.set(x, 16000 * 3); res.a2 = { len: a2.length / 16000 }; } catch (e) { res.piperErr = String(e); }
  const run = (audio, size, opts) => new Promise((resolve) => {
    const w = new Worker('./js/asr-worker.js', { type: 'module' });
    w.onmessage = (e) => { const m = e.data; if (m.type === 'done') { resolve({ text: m.text, seg: m.segment, chunks: (m.chunks || []).map((c) => `${c.text}@${c.timestamp?.[0]}-${c.timestamp?.[1]}`) }); w.terminate(); } else if (m.type === 'error') { resolve({ err: m.message }); w.terminate(); } };
    w.postMessage({ cmd: 'run', audio, size, language: 'turkish', wordLevel: opts.word, opts });
  });
  res.t1_word = await run(norm(a1), 'tiny', { word: true });
  res.t1_seg = await run(norm(a1), 'tiny', { word: false });
  res.t1_word_chunk = await run(norm(a1), 'tiny', { word: true, chunk: true });
  res.b1_word = await run(norm(a1), 'base', { word: true });
  res.b1_seg = await run(norm(a1), 'base', { word: false });
  if (a2) { res.t2_word = await run(norm(a2), 'tiny', { word: true }); res.t2_seg = await run(norm(a2), 'tiny', { word: false }); res.b2_word = await run(norm(a2), 'base', { word: true }); }
  // tam boru hattı (ai.autoCaptions) — parçalı yeni yöntem
  document.getElementById('newProject').click(); await new Promise((r) => setTimeout(r, 600));
  const app = window.__alpicut;
  const recs = await app.importFiles([new File([await (await fetch('labmedia/test.mp4')).blob()], 'test.mp4', { type: 'video/mp4' })]);
  app.P.clips.push({ id: 'c1', mediaId: recs[0].id, type: 'video', in: 0, out: recs[0].duration, dur: 3, speed: 1, volume: 1, mute: false, fit: 'cover', bgMode: 'blur', bgColor: '#000', zoom: 1, panX: 0, panY: 0, filters: {}, filterPreset: 'none', trans: { type: 'none', dur: 0.5 }, kf: {} });
  app.commit();
  const ai = await import('./js/ai.js');
  for (const size of ['tiny', 'base']) { const st = []; try { const n = await ai.autoCaptions({ lang: 'turkish', size, provider: 'local', onStatus: (t) => st.push(t) }); res[`pipe_${size}`] = { n, cues: app.P.subs.cues.map((c) => `${c.start.toFixed(2)}-${c.end.toFixed(2)} ${c.text}`), st: st.slice(-3) }; } catch (e) { res[`pipe_${size}`] = String(e); } }
  return res;
});
fs.writeFileSync('lab/out/whisper.json', JSON.stringify({ R, logs: logs.slice(-60) }, null, 1));
console.log(JSON.stringify(R, null, 1).slice(0, 8000));
await b.close(); srv.close();
