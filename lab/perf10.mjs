// Akıcılık testi: 60 sn ana video + 10 katman (3 video, 4 yazı, 1 görsel, altyazı, efekt)
// Kullanım: node lab/perf10.mjs [cpuYavaşlatma=4]   (lab/media/{main,ov1,ov2,ov3}.webm gerekir)
// Ortam: PROXY=always (proxy ile) · PROF=1 (CPU profili) · COUNT=1 (drawImage sayımı) · EXPORT4K=1 (3 sn 4K dışa aktarma)
// Çıktı: oynatmada ekran kare hızı, çizim süresi, katman başına çizim maliyeti.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright-core'); }
const { chromium } = pw;
const THROTTLE = Number(process.argv[2] || 4);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webm': 'video/webm', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/__media/') ? path.join('lab/media', u.slice(9)) : path.join('www', u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Content-Length': fs.statSync(f).size });
  fs.createReadStream(f).pipe(res);
}).listen(8095);

const exe = ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
const pg = await (await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true })).newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('http://localhost:8095/index.html');
await pg.waitForTimeout(800);
await pg.evaluate((process_PROXY) => { try { localStorage.setItem('alpicut.proxy', process_PROXY); } catch (_) { /* yok */ } }, process.env.PROXY || 'off');
await pg.click('#newProject'); await pg.waitForTimeout(500);

const info = await pg.evaluate(async () => {
  const app = window.__alpicut;
  const files = [];
  for (const n of ['main', 'ov1', 'ov2', 'ov3']) files.push(new File([await (await fetch(`/__media/${n}.webm`)).blob()], `${n}.webm`, { type: 'video/webm' }));
  const [m, a, b2, c] = await app.importFiles(files);
  const { TEXT_BASE, TEXT_TEMPLATES } = await import('./js/presets.js');
  const uid = () => Math.random().toString(36).slice(2);
  const P = app.P;
  P.clips.push({ id: 'main', mediaId: m.id, type: 'video', in: 0, out: m.duration, dur: 3, speed: 1, volume: 1, mute: false, fit: 'cover', bgMode: 'blur', bgColor: '#000', zoom: 1, panX: 0, panY: 0, filters: {}, filterPreset: 'none', trans: { type: 'none', dur: 0.5 }, kf: {} });
  const vid = (mm, x, y, w) => ({ id: uid(), kind: 'media', mediaId: mm.id, start: 0, end: 20, in: 0, out: 20, x, y, w, rot: 0, sc: 1, opacity: 1, crop: 'none', radius: 28, borderW: 0, borderColor: '#FFFFFF', shadowOn: true, kenburns: false, volume: 0, loop: false, filters: {}, filterPreset: 'none', anim: { in: 'pop', out: 'fade', loop: 'none', inDur: 0.45, outDur: 0.35 }, kf: {} });
  P.layers.push(vid(a, 0.3, 0.3, 0.45), vid(b2, 0.7, 0.5, 0.4), vid(c, 0.5, 0.75, 0.6));
  for (const [id, y] of [['hook', 0.15], ['kinetic', 0.35], ['breaking', 0.55], ['neon', 0.85], ['lower', 0.92], ['question', 0.68]]) {
    const t = TEXT_TEMPLATES.find((x) => x.id === id);
    P.layers.push({ ...structuredClone(TEXT_BASE), ...structuredClone(t.p), id: uid(), kind: 'text', start: 0, end: 60, y, sc: 1, kf: {} });
  }
  // görsel çıkartma
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const x = cv.getContext('2d'); x.fillStyle = '#C2603D'; x.beginPath(); x.arc(256, 256, 240, 0, 7); x.fill();
  const [img] = await app.importFiles([new File([await new Promise((r) => cv.toBlob(r, 'image/png'))], 'st.png', { type: 'image/png' })]);
  P.layers.push({ ...vid(img, 0.85, 0.1, 0.2), mediaId: img.id, end: 60, out: 60, kind: 'media' });
  // altyazı: 60 sn boyunca kelime vurgulu
  const cues = []; for (let s = 0; s < 60; s += 2) cues.push({ start: s, end: s + 1.9, text: 'bu bir deneme altyazı satırı', words: 'bu bir deneme altyazı satırı'.split(' ').map((w, i) => ({ t: w, s: s + i * 0.35, e: s + i * 0.35 + 0.33 })) });
  P.subs = { ...(P.subs || {}), cues, burn: true };
  P.layers.push({ id: uid(), kind: 'fx', effect: 'grain', start: 0, end: 60, amount: 0.5 });
  app.commit();
  return { layers: P.layers.length, dur: app.engine.duration(), canvas: [app.engine.canvas.width, app.engine.canvas.height], scale: app.engine.scale };
});
console.log('proje', JSON.stringify(info));
await pg.waitForTimeout(2500);
if (process.env.PROXY) { const t0 = Date.now(); console.log('proxy', await pg.evaluate(async () => { const { proxyPending } = await import('./js/proxy.js'); const ms = [...window.__alpicut.engine.media.values()]; for (let i = 0; i < 600 && ms.some((m) => proxyPending(m.id)); i++) await new Promise((r) => setTimeout(r, 1000)); return ms.map((m) => !!m.proxyBlob || !!m.proxyUrl); }), Math.round((Date.now() - t0) / 1000) + ' sn'); await pg.waitForTimeout(1500); }

if (process.env.EXPORT4K) {
  const r = await pg.evaluate(async () => {
    const e = window.__alpicut.engine; const t0 = performance.now();
    const out = await e.export({ res: 2, fps: 30, bitrate: 45e6, range: [10, 13], onStage: () => {} });
    const b = out.blob; const u = URL.createObjectURL(b); const v = document.createElement('video'); v.src = u; v.muted = true;
    await new Promise((r) => { v.onloadedmetadata = r; v.onerror = r; setTimeout(r, 5000); });
    const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x);
    return { sn: +((performance.now() - t0) / 1000).toFixed(1), mb: +(b.size / 1048576).toFixed(1), w: v.videoWidth, h: v.videoHeight, codec: out.codec, frames: out.frames, data: btoa(s) };
  });
  fs.writeFileSync('lab/media/out4k.mp4', Buffer.from(r.data, 'base64')); delete r.data;
  console.log('4K', JSON.stringify(r)); await b.close(); srv.close(); process.exit(0);
}
const cdp = await pg.context().newCDPSession(pg);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

// katman başına maliyet (duraklatılmış, t=5)
const cost = await pg.evaluate(async () => {
  const e = window.__alpicut.engine; const P = e.P;
  const seek = async (t) => { e.t = t; e.draw(t); await new Promise((r) => setTimeout(r, 400)); };
  await seek(5);
  const med = (fn) => { const a = []; for (let i = 0; i < 9; i++) { const t0 = performance.now(); fn(); a.push(performance.now() - t0); } a.sort((x, y) => x - y); return +a[4].toFixed(2); };
  const full = med(() => e.draw(5));
  const out = { tumu: full };
  P.layers.forEach((l, i) => { l.hidden = true; out[`${i}:${l.kind}:${l.text ? l.text.slice(0, 10).replace(/\n/g, ' ') : ''}`] = +(full - med(() => e.draw(5))).toFixed(2); l.hidden = false; });
  const subs = P.subs; P.subs = { ...subs, cues: [] }; out.altyazi = +(full - med(() => e.draw(5))).toFixed(2); P.subs = subs;
  P.layers.forEach((l) => { l.hidden = true; }); out.anaKlip = med(() => e.draw(5)); P.layers.forEach((l) => { l.hidden = false; });
  return out;
});
console.log('maliyet(ms)', JSON.stringify(cost));

if (process.env.PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
if (process.env.COUNT) console.log('drawImage/kare', await pg.evaluate(async () => {
  const e = window.__alpicut.engine; const P0 = CanvasRenderingContext2D.prototype; const od = P0.drawImage; const st = {};
  P0.drawImage = function (src, ...a) { const k = `${src.tagName || src.constructor.name}:${src.videoWidth || src.width}x${src.videoHeight || src.height}->${this.canvas.width}x${this.canvas.height}${this.filter !== 'none' ? ' F:' + this.filter : ''}${this.shadowBlur ? ' SH' + this.shadowBlur : ''}`; const t0 = performance.now(); const r = od.call(this, src, ...a); st[k] = st[k] || [0, 0]; st[k][0]++; st[k][1] += performance.now() - t0; return r; };
  e.t = 5; e.play(); await new Promise((r) => setTimeout(r, 3000)); e.pause(); P0.drawImage = od; window.__dicount = 1;
  return '\n' + Object.entries(st).sort((a, b) => b[1][1] - a[1][1]).slice(0, 15).map(([k, v]) => `${v[1].toFixed(0)}ms x${v[0]} ${k}`).join('\n');
}));
// oynatma 6 sn
const play = await pg.evaluate(async () => {
  const e = window.__alpicut.engine;
  const fr = [], dr = []; const od = e.draw.bind(e);
  e.draw = (...a) => { const t0 = performance.now(); const r = od(...a); dr.push(performance.now() - t0); return r; };
  e.t = 2; e.play();
  let last = 0; let go = true;
  const tick = (n) => { if (last) fr.push(n - last); last = n; if (go) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await new Promise((r) => setTimeout(r, 6000));
  go = false; e.pause(); e.draw = od;
  let d = 0, tot = 0; for (const v of e.els.values()) { const q = v.getVideoPlaybackQuality?.(); if (q) { d += q.droppedVideoFrames; tot += q.totalVideoFrames; } }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] || 0;
  return { fps: +(1000 / avg(fr)).toFixed(1), kotuKare: Math.round(p95(fr)), cizim: +avg(dr).toFixed(1), cizimP95: Math.round(p95(dr)), cizimSayisi: dr.length, dusenKare: `${d}/${tot}`, ilerleme: +(e.t - 2).toFixed(2) };
});
console.log('oynatma', JSON.stringify(play));
if (process.env.PROF) {
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(); const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
  const tot = [...self.values()].reduce((a, b) => a + b, 0);
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(100 * v / tot).toFixed(1)}% ${k}`).join('\n'));
}
if (errs.length) console.log('hatalar', errs.slice(0, 5));
await b.close(); srv.close();
