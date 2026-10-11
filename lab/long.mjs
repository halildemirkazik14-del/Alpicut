// v1.11 — uzun video dayanıklılık testi: 60 dakikalık video ile bellek ölçümü
// Kullanım: node lab/long.mjs <video> [çıktı klasörü]
// Ölçülenler: içe aktarma, ses analizi (akışlı), sesi ayırma (akışlı WAV), pencereli ses karışımı (tüm saat),
// orta bölümden 20 sn dışa aktarma (diske akış). Her adımdan sonra JS yığın belleği.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright-core'); }
const { chromium } = pw;

const VIDEO = process.argv[2];
const OUT = process.argv[3] || 'lab/out/long';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__long') { res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': fs.statSync(VIDEO).size }); fs.createReadStream(VIDEO).pipe(res); return; }
  const f = path.join('www', u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8093);

const R = {}; const errs = [];
const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined, args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const pg = await (await b.newContext({ viewport: { width: 400, height: 860 } })).newPage();
pg.on('pageerror', (e) => errs.push(`PAGEERROR ${e.message}`));
pg.on('crash', () => errs.push('SAYFA ÇÖKTÜ'));
const mem = () => pg.evaluate(() => { try { window.gc?.(); } catch (_) { /* yoksay */ } return Math.round(performance.memory.usedJSHeapSize / 1048576); });
const step = async (n, fn, limitMs = 30 * 60e3) => {
  const t0 = Date.now();
  try { const r = await Promise.race([fn(), new Promise((_, j) => setTimeout(() => j(new Error('zaman aşımı')), limitMs))]); R[n] = { ...(typeof r === 'object' ? r : { r }), s: Math.round((Date.now() - t0) / 1000), heapMB: await mem() }; } catch (e) { R[n] = { hata: e.message.slice(0, 300), s: Math.round((Date.now() - t0) / 1000) }; errs.push(`ADIM ${n}: ${e.message}`.slice(0, 300)); }
  console.log(n, JSON.stringify(R[n]));
};
await pg.goto('http://localhost:8093/index.html');
await pg.waitForTimeout(800);
await pg.evaluate(() => { localStorage.setItem('alpicut.proxy', 'off'); });
await step('baslangic', async () => ({}));
await pg.click('#newProject'); await pg.waitForTimeout(500);
await step('iceAktar', () => pg.evaluate(async () => {
  const app = window.__alpicut;
  const blob = await (await fetch('/__long')).blob();
  const recs = await app.importFiles([new File([blob], 'uzun.webm', { type: 'video/webm' })]);
  const m = recs[0];
  app.P.clips.push({ id: 'c1', mediaId: m.id, type: 'video', in: 0, out: m.duration, dur: 3, speed: 1, volume: 1, mute: false, fit: 'cover', bgMode: 'blur', bgColor: '#000', zoom: 1, panX: 0, panY: 0, filters: {}, filterPreset: 'none', trans: { type: 'none', dur: 0.5 }, kf: {} });
  app.commit();
  window.__m = m;
  return { dur: Math.round(m.duration), mb: Math.round(blob.size / 1048576) };
}));
await step('kaydirma', () => pg.evaluate(async () => {
  const app = window.__alpicut; let worst = 0;
  for (let i = 0; i < 12; i++) { const t0 = performance.now(); app.engine.seek ? app.engine.seek(i * 300) : (app.engine.t = i * 300); app.engine.draw(i * 300); worst = Math.max(worst, performance.now() - t0); await new Promise((r) => setTimeout(r, 150)); }
  return { worstDrawMs: Math.round(worst) };
}));
await step('sesAnalizi', () => pg.evaluate(async () => {
  const { decodeMono, findSilences } = await import('./js/audiotools.js');
  const a = await decodeMono(window.__m);
  const s = findSilences(a, {});
  return { dur: Math.round(a.dur), silences: s.length };
}));
await step('sesiAyir', () => pg.evaluate(async () => {
  const app = window.__alpicut;
  const { detachAudio } = await import('./js/audiostudio.js');
  await detachAudio(app.P.clips[0]);
  const a = app.P.audio.find((x) => x.detached);
  return { audioLen: a ? Math.round(a.out - a.in) : null, toast: document.getElementById('toast')?.textContent };
}));
await step('karisimTumSaat', () => pg.evaluate(async () => {
  const app = window.__alpicut;
  const { mixdownStream } = await import('./js/mixdown.js');
  const d = app.engine.duration();
  const mx = mixdownStream(app.engine, app.P, d, { win: 10 });
  let peak = 0, n = 0, maxHeap = 0;
  for (let w = 0; w < d; w += 10) {
    const buf = await mx.mix(w, Math.min(d, w + 10));
    const L = buf.getChannelData(0); for (let i = 0; i < L.length; i += 97) peak = Math.max(peak, Math.abs(L[i]));
    n++; if (n % 30 === 0) maxHeap = Math.max(maxHeap, Math.round(performance.memory.usedJSHeapSize / 1048576));
  }
  return { windows: n, peak: +peak.toFixed(3), maxHeapMB: maxHeap };
}));
await step('disaAktar20sn', () => pg.evaluate(async () => {
  const app = window.__alpicut;
  const d = app.engine.duration();
  const o = await app.engine.export({ res: 0.3, fps: 24, bitrate: 1e6, range: [d / 2, d / 2 + 20] });
  let aDur = null, vDur = null;
  try { const MB = await import('./js/lib/mediabunny.js'); const inp = new MB.Input({ source: new MB.BlobSource(o.blob), formats: MB.ALL_FORMATS }); const at = await inp.getPrimaryAudioTrack(); const vt = await inp.getPrimaryVideoTrack(); aDur = at ? +(await at.computeDuration()).toFixed(2) : 0; vDur = vt ? +(await vt.computeDuration()).toFixed(2) : 0; } catch (e) { aDur = 'HATA ' + e.message; }
  if (!(aDur > 19)) throw new Error(`dışa aktarmada ses eksik: ${aDur}`);
  return { frames: o?.frames, mb: o ? +(o.blob.size / 1048576).toFixed(1) : null, onDisk: !!o?.onDisk, aDur, vDur };
}));
R.errors = errs;
fs.writeFileSync(`${OUT}/long.json`, JSON.stringify(R, null, 1));
console.log('HATALAR', errs.length, errs.join('\n'));
await Promise.race([b.close(), new Promise((r) => setTimeout(r, 15000))]); srv.close(); process.exit(0);
