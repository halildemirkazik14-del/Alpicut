// Ses kararlılık testi: önizleme sesini kaydedip kopma / tık (süreksizlik) sayar.
// Kullanım: node lab/audio.mjs   (önce www/labmedia/test.mp4 ve music.mp3 olmalı)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright-core'); }
const { chromium } = pw;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.ogg': 'audio/ogg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join('www', u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8093);
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const pg = await (await b.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true })).newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await pg.goto('http://localhost:8093/index.html');
await pg.waitForTimeout(800);
await pg.click('#newProject').catch(() => {});
await pg.waitForTimeout(500);
const setup = await pg.evaluate(async () => {
  const app = window.__alpicut;
  const get = async (u, t) => new File([await (await fetch(u)).blob()], u.split('/').pop(), { type: t });
  const [v] = await app.importFiles([await get('labmedia/test.webm', 'video/webm')]);
  const [a] = await app.importFiles([await get('labmedia/music.ogg', 'audio/ogg')], true);
  const id = () => Math.random().toString(36).slice(2);
  app.P.clips.push({ id: id(), mediaId: v.id, type: 'video', in: 0, out: 8, dur: 8, speed: 1, volume: 0.6, mute: false, fit: 'cover', zoom: 1, panX: 0, panY: 0, filters: {}, trans: { type: 'none', dur: 0.5 }, kf: {} });
  app.P.audio.push({ id: id(), mediaId: a.id, start: 0, in: 0, out: 8, volume: 0.5, fadeIn: 0, fadeOut: 0 });
  app.commit();
  return { dur: app.engine.duration() };
});
console.log('setup', setup);

async function measure(label, live) {
  const r = await pg.evaluate(async (live) => {
    const app = window.__alpicut, E = app.engine;
    E.ensureAudio();
    if (live) { E._pmix.buf = null; E._pmix.sig = '__off'; E._pmix.busy = true; }
    else {
      E._pmix.busy = false; E._pmix.sig = null;
      const t0 = performance.now();
      while (!(E._pmix.buf && E._pmix.sig === E._audioSig()) && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 200));
      if (!E._pmix.buf) return { err: 'önizleme sesi hazırlanmadı' };
    }
    E.seek(0.5);
    const rec = new MediaRecorder(E.recDest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
    const ch = []; rec.ondataavailable = (e) => ch.push(e.data);
    const stop = new Promise((r) => { rec.onstop = r; });
    rec.start();
    app.play();
    const mode = E.bufMode;
    // oynatırken ortada bir atlama (kullanıcı kaydırıyor gibi) ve videoyu zorla kaydırma
    await new Promise((r) => setTimeout(r, 1500));
    for (const el of E.els.values()) { try { el.currentTime += 0.4; } catch (_) { /* */ } }
    await new Promise((r) => setTimeout(r, 2500));
    app.pause();
    await new Promise((r) => setTimeout(r, 300));
    rec.stop(); await stop;
    const buf = await new AudioContext().decodeAudioData(await new Blob(ch).arrayBuffer());
    const x = buf.getChannelData(0), sr = buf.sampleRate;
    // süreksizlik: 2. fark, yerel seviyeye göre
    let clicks = 0, last = -1e9, drops = 0, peak = 0;
    const s0 = Math.floor(sr * 0.3), s1 = x.length - Math.floor(sr * 0.5);
    for (let i = s0; i < s1; i++) {
      const d2 = Math.abs(x[i + 1] - 2 * x[i] + x[i - 1]);
      peak = Math.max(peak, Math.abs(x[i]));
      if (d2 > 0.06 && i - last > sr * 0.01) { clicks++; last = i; }
    }
    // 5 ms'lik pencerelerde sessizliğe düşüş
    const w = Math.floor(sr * 0.005);
    for (let i = s0; i + w < s1; i += w) { let q = 0; for (let k = 0; k < w; k++) q += x[i + k] * x[i + k]; if (Math.sqrt(q / w) < 0.01) drops++; }
    return { mode: mode ? 'tampon' : 'canlı', sec: +(x.length / sr).toFixed(2), clicks, drops, peak: +peak.toFixed(3), t: +E.t.toFixed(2) };
  }, live);
  console.log(label, JSON.stringify(r));
  return r;
}
const live = await measure('CANLI YOL ', true);
const buf = await measure('TAMPON YOLU', false);
console.log('hatalar', errs.slice(0, 8));
await b.close(); srv.close();
fs.mkdirSync('lab/out', { recursive: true });
fs.writeFileSync('lab/out/audio.json', JSON.stringify({ live, buf, errs }, null, 1));
