// Yazı önbelleği görsel doğrulama: aynı kareyi çizip PNG kaydeder. node lab/textdiff.mjs <çıktı.png>
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright-core'); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join('www', u === '/' ? 'index.html' : u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8096);
const exe = ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'].find((p) => fs.existsSync(p));
const b = await pw.chromium.launch({ executablePath: exe });
const pg = await (await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2.5 })).newPage();
await pg.goto('http://localhost:8096/index.html'); await pg.waitForTimeout(800);
await pg.click('#newProject'); await pg.waitForTimeout(500);
const url = await pg.evaluate(async () => {
  const app = window.__alpicut; const { TEXT_BASE, TEXT_TEMPLATES } = await import('./js/presets.js');
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d'); x.fillStyle = '#C2603D'; x.fillRect(0, 0, 400, 300);
  const [img] = await app.importFiles([new File([await new Promise((r) => cv.toBlob(r, 'image/png'))], 'a.png', { type: 'image/png' })]);
  app.P.fx = { ...(app.P.fx || {}), bg: '#2B6B8F' };
  app.P.layers.push({ id: 'im', kind: 'media', mediaId: img.id, start: 0, end: 10, in: 0, out: 10, x: 0.5, y: 0.5, w: 0.6, rot: 4, sc: 1, opacity: 1, crop: 'none', radius: 28, borderW: 0, borderColor: '#fff', shadowOn: true, volume: 0, filters: {}, anim: { in: 'pop', out: 'fade', loop: 'none', inDur: 0.45, outDur: 0.35 }, kf: {} });
  ['hook', 'breaking', 'neon', 'lower', 'question', 'outline', 'quote', 'label'].forEach((id, i) => { const t = TEXT_TEMPLATES.find((q) => q.id === id); app.P.layers.push({ ...structuredClone(TEXT_BASE), ...structuredClone(t.p), id: 't' + i, kind: 'text', start: 0, end: 10, y: 0.08 + i * 0.115, rot: i % 2 ? -3 : 0, sc: 1, kf: {} }); });
  app.commit(); await document.fonts.ready; await new Promise((r) => setTimeout(r, 1200));
  const e = app.engine; e._noSel = true; e.draw(5); e.draw(5); return e.canvas.toDataURL('image/png');
});
fs.writeFileSync(process.argv[2], Buffer.from(url.split(',')[1], 'base64'));
await b.close(); srv.close();
