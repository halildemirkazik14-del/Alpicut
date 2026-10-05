// Yerel hızlı arayüz testi (internetsiz): paneller, araç çubuğu, temalar, kaydırıcı, keyframe, sosyal şablonlar
// Kullanım: node lab/smoke.mjs [çıktı klasörü]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (_) { pw = require('/opt/npm-tools/node_modules/playwright-core'); }
const { chromium } = pw;

const OUT = process.argv[2] || 'lab/out/smoke';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.mjs': 'text/javascript', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join('www', u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8091);

const errs = [];
const R = {};
const b = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => errs.push(`PAGEERROR ${e.message}`));
pg.on('console', (m) => { if (m.type() === 'error') errs.push(`console ${m.text()}`.slice(0, 300)); });
const step = async (n, fn) => { try { R[n] = (await fn()) ?? 'ok'; } catch (e) { R[n] = `HATA: ${e.message}`.slice(0, 400); } console.log(n, JSON.stringify(R[n]).slice(0, 300)); };
const shot = (n) => pg.screenshot({ path: `${OUT}/${n}.png` });
await pg.goto('http://localhost:8091/index.html');
await pg.waitForTimeout(800);
await shot('01-home');

await step('newProject', async () => { await pg.click('#newProject'); await pg.waitForTimeout(500); });
await step('media', () => pg.evaluate(async () => {
  const app = window.__alpicut;
  const files = [];
  if (window.__testVideo) files.push(window.__testVideo);
  const urls = ['labmedia/test.mp4', 'labmedia/wide.mp4'];
  for (const u of urls) { try { const r = await fetch(u); if (r.ok) files.push(new File([await r.blob()], u.split('/').pop(), { type: 'video/mp4' })); } catch (_) { /* yok */ } }
  if (!files.length) {
    for (const [i, col] of [['#7C3AED', '#22D3EE'], ['#F97316', '#E11D48']].entries()) {
      const c = document.createElement('canvas'); c.width = 720; c.height = 1280; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 720, 1280); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); x.fillStyle = g; x.fillRect(0, 0, 720, 1280);
      x.fillStyle = '#fff'; x.font = '900 200px sans-serif'; x.textAlign = 'center'; x.fillText(String(i + 1), 360, 700);
      files.push(new File([await new Promise((r) => c.toBlob(r, 'image/png'))], `img${i}.png`, { type: 'image/png' }));
    }
  }
  const recs = await app.importFiles(files);
  recs.forEach((m) => app.P.clips.push({ id: Math.random().toString(36).slice(2), mediaId: m.id, type: m.kind === 'image' ? 'image' : 'video', in: 0, out: m.duration || 3, dur: 3, speed: 1, volume: 1, mute: false, fit: 'cover', bgMode: 'blur', bgColor: '#000', zoom: 1, panX: 0, panY: 0, filters: {}, filterPreset: 'none', trans: { type: 'none', dur: 0.5 }, kf: {} }));
  app.commit();
  return { n: recs.length, dur: app.engine.duration() };
}));
await shot('02-editor');

// araç kategorileri
await step('toolCats', async () => {
  const names = await pg.$$eval('#toolbar .tool', (b) => b.map((x) => x.textContent.trim()));
  const res = {};
  for (const n of names) {
    if (n === 'Medya') continue;
    await pg.evaluate(() => { window.__alpicut.deselect(); window.__alpicut.tbCat = null; window.__alpicut.renderToolbar(); });
    const before = errs.length;
    await pg.evaluate((nm) => [...document.querySelectorAll('#toolbar .tool')].find((x) => x.textContent.trim() === nm)?.click(), n);
    await pg.waitForTimeout(400);
    const sub = await pg.$$eval('#toolbar .tool', (b) => b.map((x) => x.textContent.trim()));
    const panels = await pg.$$eval('.panel', (p) => p.map((x) => x.querySelector('.p-title').textContent));
    res[n] = { sub: sub.length, panels, err: errs.length - before };
    // alt araçları tek tek aç
    if (sub[0] === 'Geri') {
      for (const s of sub.slice(1)) {
        if (/Medya|Katman ekle|Ses dosyası|Yazı ekle|Çoklu|İşaret|Ses dalgası|Renk katmanı|Jumpcut|Akıllı/.test(s)) continue;
        const b2 = errs.length;
        await pg.evaluate(() => { if (window.__alpicut.sel) { window.__alpicut.deselect(); } });
        await pg.evaluate((cat) => { if (!document.querySelector('#toolbar .tool.back')) { window.__alpicut.tbCat = cat; window.__alpicut.renderToolbar(); } }, { 'Yapay zekâ': 'ai', Metin: 'text', Ses: 'audio', Efekt: 'fx', Sosyal: 'social', Düzen: 'edit' }[n]);
        await pg.evaluate((nm) => [...document.querySelectorAll('#toolbar .tool')].find((x) => x.textContent.trim() === nm)?.click(), s);
        await pg.waitForTimeout(700);
        const pn = await pg.$$eval('.panel:not(.min)', (p) => p.map((x) => x.querySelector('.p-title').textContent));
        res[`${n}/${s}`] = { panels: pn, err: errs.length - b2 };
        await shot(`tool-${n}-${s}`.replace(/[^\w-]+/g, '_'));
        await pg.evaluate(() => document.querySelectorAll('.panel .p-btn.close').forEach((x) => x.click()));
        await pg.waitForTimeout(250);
      }
      await pg.evaluate(() => [...document.querySelectorAll('#toolbar .tool')].find((x) => x.textContent.trim() === 'Geri')?.click());
    } else {
      await shot(`tool-${n}`.replace(/[^\w-]+/g, '_'));
      await pg.evaluate(() => document.querySelectorAll('.panel .p-btn.close').forEach((x) => x.click()));
    }
    await pg.waitForTimeout(250);
  }
  return res;
});

// üç panel aynı anda + küçültme + önizlemeye dokunma
await step('threePanels', async () => {
  await pg.evaluate(async () => { const s = await import('./js/sheets.js'); s.openSocial(); const f = await import('./js/filters.js'); await f.openFilters(null); const a = await import('./js/alpico.js'); a.openAlpico(); });
  await pg.waitForTimeout(800);
  await shot('03-three-panels');
  const r1 = await pg.$$eval('.panel', (p) => p.length);
  const box = await pg.$eval('#previewWrap', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; });
  await pg.touchscreen.tap(box.x, box.y);
  await pg.waitForTimeout(300);
  const r2 = await pg.$$eval('.panel', (p) => p.length);
  // timeline'a dokun -> üstteki paneller küçülsün
  await pg.evaluate(() => { const sc = document.getElementById('tlScroll'); sc.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [] })); });
  await pg.waitForTimeout(300);
  await shot('04-minimized');
  const mins = await pg.$$eval('.panel.min', (p) => p.length);
  const dock = await pg.$$eval('.dock-chip', (p) => p.map((x) => x.textContent));
  await pg.evaluate(() => document.querySelector('.dock-chip.all')?.click());
  await pg.waitForTimeout(300);
  const vis = await pg.$$eval('.panel:not(.min)', (p) => p.length);
  await pg.evaluate(() => document.querySelectorAll('.panel .p-btn.close').forEach((x) => x.click()));
  return { open: r1, afterPreviewTap: r2, minimizedAfterTimeline: mins, dock, restored: vis };
});

// keyframe + eğri
await step('keyframes', async () => {
  const r = await pg.evaluate(async () => {
    const app = window.__alpicut;
    const c = app.P.clips[0];
    app.select({ type: 'clip', id: c.id }, 'Keyframe');
    await new Promise((q) => setTimeout(q, 300));
    c.kf = { zoom: [{ t: 0, v: 1, ease: 'inout' }, { t: 1, v: 1.4, ease: 'inout' }, { t: 2, v: 1.1, ease: 'inout' }] };
    app.engine.seek(0.0); app.commit();
    app.openInspector('Keyframe');
    await new Promise((q) => setTimeout(q, 300));
    return { curves: document.querySelectorAll('.curve-opt').length };
  });
  await pg.evaluate(() => [...document.querySelectorAll('.panel .btn')].find((b) => /Grafik/.test(b.textContent))?.click());
  await pg.waitForTimeout(300);
  await pg.evaluate(() => [...document.querySelectorAll('.curve-opt')].find((b) => /Özel/.test(b.textContent))?.click());
  await pg.waitForTimeout(300);
  await shot('05-keyframes');
  return r;
});

// kaydırıcı: göreli sürükleme
await step('slider', async () => {
  await pg.evaluate(() => window.__alpicut.openInspector('Düzen'));
  await pg.waitForTimeout(300);
  const s = await pg.$('.panel .sld');
  if (!s) return 'kaydırıcı yok';
  const bb = await s.boundingBox();
  const before = await pg.$eval('.panel .rng-val', (e) => e.textContent);
  await pg.mouse.move(bb.x + 10, bb.y + bb.height / 2); await pg.mouse.down(); await pg.mouse.move(bb.x + 60, bb.y + bb.height / 2, { steps: 6 }); await pg.mouse.up();
  const after = await pg.$eval('.panel .rng-val', (e) => e.textContent);
  return { before, after };
});

// sosyal şablonlar render
await step('socialRender', () => pg.evaluate(async () => {
  const S = await import('./js/social.js');
  const out = {};
  for (const t of S.SOCIAL_TEMPLATES) {
    const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'); x.scale(0.5, 0.5); x.translate(540, 960);
    try { const r = S.drawSocial(x, { kind: 'social', x: 0.5, y: 0.5, start: 0, end: 6, scale: 1, ...t.p }, 3, { W: 1080, H: 1920, S: 0.5, img: () => null }); out[t.id] = r ? `${Math.round(r.w)}x${Math.round(r.h)}` : 'yok'; } catch (e) { out[t.id] = `HATA ${e.message}`; }
  }
  return { n: Object.keys(out).length, bad: Object.entries(out).filter(([, v]) => /HATA|yok/.test(v)) };
}));
await step('socialShots', async () => {
  for (const id of ['imsg', 'wa', 'ytcard', 'xprof', 'igprof', 'halfTop', 'player', 'versus']) {
    await pg.evaluate(async (tid) => {
      const app = window.__alpicut; const S = await import('./js/social.js');
      const t = S.SOCIAL_TEMPLATES.find((x) => x.id === tid);
      app.P.layers = app.P.layers.filter((l) => l.kind !== 'social');
      app.addLayer({ kind: 'social', x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, scale: 1, ...JSON.parse(JSON.stringify(t.p)) }, 6);
      await new Promise((q) => setTimeout(q, 300));
      app.engine.seek(app.engine.t + 4.5); app.engine.draw();
    }, id);
    await pg.waitForTimeout(400);
    await pg.evaluate(() => document.querySelectorAll('.panel .p-btn.close').forEach((x) => x.click()));
    await pg.waitForTimeout(200);
    await shot(`06-social-${id}`);
  }
});

// efektler: hepsi hatasız çizilsin
await step('effects', () => pg.evaluate(async () => {
  const F = await import('./js/fxlib.js');
  const c = document.createElement('canvas'); c.width = 270; c.height = 480; const x = c.getContext('2d');
  x.fillStyle = '#446'; x.fillRect(0, 0, 270, 480);
  const bad = [];
  for (const [id] of F.FX_LIST) { try { x.setTransform(0.25, 0, 0, 0.25, 0, 0); F.applyLayerFx(x, { kind: 'fx', effect: id, start: 0, end: 3, amount: 1, speed: 1, anim: { in: 'none', out: 'none', loop: 'none', inDur: 0.3, outDur: 0.3 } }, 1, { W: 1080, H: 1920, S: 0.25 }, []); } catch (e) { bad.push(`${id}: ${e.message}`); } }
  const G = (await import('./js/fxgl.js')).fxgl();
  return { n: F.FX_LIST.length, bad, glBroken: G ? [...G.broken] : 'webgl yok', glProgs: G ? G.progs.size : 0 };
}));

// sfx: hepsi oluşsun
await step('sfx', () => pg.evaluate(async () => {
  const S = await import('./js/sfx.js'); const bad = [];
  for (const [id] of S.SFX) { try { const r = await S.renderSfx(id); let pk = 0; const d = r.buffer.getChannelData(0); for (const v of d) pk = Math.max(pk, Math.abs(v)); if (pk < 0.01) bad.push(`${id}: sessiz`); if (pk > 1.001) bad.push(`${id}: clip ${pk.toFixed(2)}`); } catch (e) { bad.push(`${id}: ${e.message}`); } }
  return { n: S.SFX.length, bad };
}));

// temalar
await step('themes', async () => {
  for (const id of ['gold', 'silver', 'white', 'night', 'obsidian']) {
    await pg.evaluate(async (t) => { const m = await import('./js/theme.js'); m.setTheme(t, ''); }, id);
    await pg.waitForTimeout(150);
    await shot(`07-theme-${id}`);
  }
});

// doktor + alpi-co yerel komutları
await step('alpico', async () => {
  const r = await pg.evaluate(async () => {
    const a = await import('./js/alpico.js');
    a.openAlpico();
    const issues = a.doctorIssues().map((x) => x.text);
    const z = await a.runCommand('zoom', { type: 'punch', at: 1 }, { quiet: true });
    const t = await a.runCommand('add_text', { text: 'TEST *HOOK*', start: 0, position: 'top' }, { quiet: true });
    const tr = await a.runCommand('add_transitions', { type: 'flash' }, { quiet: true });
    return { issues, z: z?.summary, t: t?.summary, tr: tr?.summary };
  });
  await pg.fill('.chat-in', 'kesimlere glitch geçiş ekle');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(800);
  await shot('08-alpico');
  return r;
});

await step('timelineEnd', () => pg.evaluate(async () => {
  const app = window.__alpicut; const sc = document.getElementById('tlScroll');
  sc.scrollLeft = 1e7; await new Promise((r) => setTimeout(r, 300));
  return { dur: +app.engine.duration().toFixed(2), t: +app.engine.t.toFixed(2), maxScroll: sc.scrollWidth - sc.clientWidth, expected: Math.round(app.engine.duration() * app.pps) };
}));

await step('export', () => pg.evaluate(async () => {
  const app = window.__alpicut;
  app.P.layers = app.P.layers.filter((l) => l.end <= 8);
  app.commit();
  const t0 = performance.now();
  const r = await app.engine.export({ res: 0.4, fps: 30, bitrate: 3e6 });
  return { size: r?.blob.size, ext: r?.ext, ms: Math.round(performance.now() - t0), dur: app.engine.duration() };
}));

R.errors = errs.slice(0, 50);
fs.writeFileSync(`${OUT}/smoke.json`, JSON.stringify(R, null, 1));
console.log('HATALAR', errs.length, errs.slice(0, 15).join('\n'));
await b.close(); srv.close();
