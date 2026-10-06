// CI uçtan uca test: gerçek Chromium + internet ile yapay zekâ araçlarını ve dışa aktarmayı doğrular.
// Sonuçlar lab/out/e2e.json ve ekran görüntüleri lab/out/*.png
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT = 'lab/out';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.tflite': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.data': 'application/octet-stream' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join('www', u === '/' ? 'index.html' : u);
  if (!f.startsWith('www') || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy': 'same-origin' });
  fs.createReadStream(f).pipe(res);
}).listen(8090);

const R = {};
const T0 = Date.now();
const step = async (name, fn) => {
  const t = Date.now();
  try { R[name] = { ok: true, ...(await fn()) }; } catch (e) { R[name] = { ok: false, error: String(e?.message || e).slice(0, 600) }; }
  R[name].ms = Date.now() - t;
  console.log(name, JSON.stringify(R[name]).slice(0, 400));
};

const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, permissions: ['microphone'] });
const pg = await ctx.newPage();
const logs = [];
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
pg.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}`.slice(0, 300)));
pg.setDefaultTimeout(600000);
await pg.goto('http://localhost:8090/index.html');
await pg.waitForTimeout(1500);

await step('assets', async () => pg.evaluate(async () => {
  const j = async (u) => { try { return await (await fetch(u)).json(); } catch (_) { return null; } };
  const sfx = await j('sfx/index.json'), mus = await j('data/music.json'), gf = await j('data/gfonts.json');
  const cats = {}; (sfx || []).forEach((x) => { cats[x.c] = (cats[x.c] || 0) + 1; });
  return { sfx: sfx?.length, sfxCats: cats, music: mus?.length, musicSample: (mus || []).slice(0, 3).map((m) => `${m.c}: ${m.t} [${m.l}]`), gfonts: gf?.length, fontsOk: document.fonts.check('900 40px "Anton"') || 'lazy' };
}));

await step('fontsBundled', async () => pg.evaluate(async () => {
  const fams = ['Barlow Condensed', 'Anton', 'Bebas Neue', 'Montserrat', 'Pacifico', 'Bangers'];
  const res = {};
  for (const f of fams) { await document.fonts.load(`700 40px "${f}"`); res[f] = document.fonts.check(`700 40px "${f}"`); }
  return res;
}));

await step('googleFont', async () => pg.evaluate(async () => {
  const m = await import('./js/fonts.js');
  await m.getCatalog();
  const ok = await m.ensureFont('Lobster Two');
  return { ok, check: document.fonts.check('400 40px "Lobster Two"') };
}));

await step('tts', async () => pg.evaluate(async () => {
  const T = await import('./vendor/piper/piper-tts-web.js');
  const wav = await T.predict({ text: 'Merhaba, bu bir altyazı testidir. Gol çok güzeldi.', voiceId: 'tr_TR-dfki-medium' });
  window.__wav = wav;
  const a = new Audio(URL.createObjectURL(wav));
  const dur = await new Promise((r) => { a.onloadedmetadata = () => r(a.duration); a.onerror = () => r(-1); });
  return { size: wav.size, dur };
}));

await step('whisper', async () => pg.evaluate(async () => {
  // İngilizce örnek (JFK) ve varsa Türkçe TTS sesi
  const src = window.__wav || await (await fetch('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav')).blob();
  const lang = window.__wav ? 'turkish' : 'english';
  const ab = await src.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 16000, 16000);
  const buf = await ctx.decodeAudioData(ab);
  const audio = buf.getChannelData(0);
  const w = new Worker('./js/asr-worker.js', { type: 'module' });
  const msgs = [];
  const res = await new Promise((resolve, reject) => {
    w.onmessage = (e) => { const m = e.data; if (m.type === 'done') resolve(m); else if (m.type === 'error') reject(new Error(m.message)); else if (m.type === 'status') msgs.push(m.text); };
    w.onerror = (e) => reject(new Error(e.message || 'worker'));
    w.postMessage({ cmd: 'run', audio, size: 'tiny', language: lang, wordLevel: true });
  });
  return { lang, text: res.text, words: (res.chunks || []).slice(0, 12).map((c) => `${c.text}@${c.timestamp?.[0]?.toFixed?.(2)}`), segment: res.segment, msgs };
}));

await step('studio', async () => pg.evaluate(async () => {
  const S = await import('./js/studio.js');
  // sentetik "ses + gürültü" örneği
  const sr = 48000, n = sr * 3, x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / sr; x[i] = 0.3 * Math.sin(2 * Math.PI * 220 * t) * (Math.sin(2 * Math.PI * 3 * t) > 0 ? 1 : 0.05) + (Math.random() - 0.5) * 0.08; }
  const src = window.__wav || S.toWav(x, sr);
  const out = await S.processVoice(src, S.STUDIO_PRESETS.podcast);
  let rn = 'n/a';
  try { const m = await import('./vendor/rnnoise/rnnoise.js'); const r = await (m.Rnnoise || m.default?.Rnnoise).load(); const st = r.createDenoiseState(); const v = st.processFrame(new Float32Array(480).map(() => (Math.random() - 0.5) * 3000)); st.destroy(); rn = `ok vad=${v.toFixed(3)} frame=${r.frameSize}`; } catch (e) { rn = String(e); }
  return { outSize: out.size, rnnoise: rn };
}));

await step('segmenter', async () => pg.evaluate(async () => {
  const S = await import('./js/seg.js');
  await S.initSegmenter();
  await S.initFaces();
  const img = new Image(); img.crossOrigin = 'anonymous';
  const urls = ['https://storage.googleapis.com/mediapipe-assets/portrait.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Pierre-Person.jpg/480px-Pierre-Person.jpg'];
  let ok = false;
  for (const u of urls) { try { await new Promise((r, j) => { img.onload = r; img.onerror = j; fetch(u).then((x) => { if (!x.ok) throw new Error(x.status); return x.blob(); }).then((b) => { img.src = URL.createObjectURL(b); }).catch(j); }); ok = true; break; } catch (_) { /* sonraki */ } }
  if (!ok) throw new Error('örnek fotoğraf yüklenemedi');
  const m = S.personMask(img, img.naturalWidth, img.naturalHeight, { threshold: 0.5, edge: 0.15 });
  const d = m.getContext('2d').getImageData(0, 0, m.width, m.height).data;
  let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i];
  const faces = S.detectFaces(img, img.naturalWidth, img.naturalHeight);
  // görsel kanıt
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.fillStyle = '#7C3AED'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(S.removeBackground(img, img.naturalWidth, img.naturalHeight, { threshold: 0.5, edge: 0.15, feather: 2 }), 0, 0, c.width, c.height);
  window.__segPng = c.toDataURL('image/png');
  return { personCoverage: +(s / (d.length / 4) / 255).toFixed(3), faces: faces.length, face0: faces[0] };
}));
try { const png = await pg.evaluate(() => window.__segPng); if (png) fs.writeFileSync(`${OUT}/seg.png`, Buffer.from(png.split(',')[1], 'base64')); } catch (_) { /* yoksay */ }

await step('sfxDecode', async () => pg.evaluate(async () => {
  const idx = await (await fetch('sfx/index.json')).json();
  const pick = idx.filter((_, i) => i % Math.max(1, Math.floor(idx.length / 8)) === 0).slice(0, 8);
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const res = [];
  for (const x of pick) { try { const b = await ctx.decodeAudioData(await (await fetch(`sfx/${x.id}.ogg`)).arrayBuffer()); res.push(`${x.n}:${b.duration.toFixed(2)}`); } catch (e) { res.push(`${x.n}:HATA`); } }
  return { res };
}));

await step('musicHead', async () => pg.evaluate(async () => {
  const m = await (await fetch('data/music.json')).json();
  const r = await fetch(m[0].u, { method: 'GET', headers: { Range: 'bytes=0-1000' } });
  return { status: r.status, cors: r.headers.get('access-control-allow-origin'), first: m[0].t };
}));

// uçtan uca: projeye video ekle -> otomatik altyazı (telefondaki yöntem) -> jumpcut -> stüdyo ses
await step('pipeline', () => pg.evaluate(async () => {
  document.getElementById('newProject').click();
  await new Promise((r) => setTimeout(r, 600));
  const app = window.__alpicut;
  const r = await fetch('labmedia/test.mp4');
  if (!r.ok) return { skipped: 'test videosu yok' };
  const recs = await app.importFiles([new File([await r.blob()], 'test.mp4', { type: 'video/mp4' })]);
  const m = recs[0];
  app.P.clips.push({ id: 'c1', mediaId: m.id, type: 'video', in: 0, out: m.duration, dur: 3, speed: 1, volume: 1, mute: false, fit: 'cover', bgMode: 'blur', bgColor: '#000', zoom: 1, panX: 0, panY: 0, filters: {}, filterPreset: 'none', trans: { type: 'none', dur: 0.5 }, kf: {} });
  app.commit();
  const ai = await import('./js/ai.js');
  const t0 = performance.now();
  const n = await ai.autoCaptions({ lang: 'turkish', size: 'base', provider: 'local', onStatus: () => {} });
  const tCap = performance.now() - t0;
  const cues = app.P.subs.cues.slice(0, 5).map((c) => `${c.start.toFixed(2)} ${c.text}`);
  const before = app.engine.duration();
  const a = await import('./js/alpico.js');
  const j = await a.runCommand('jumpcut', {}, { quiet: true });
  const d = await a.runCommand('denoise', { preset: 'hiss' }, { quiet: true });
  return { n, tCap: Math.round(tCap), cues, before: +before.toFixed(2), after: +app.engine.duration().toFixed(2), jumpcut: j?.summary || j?.error, denoise: d?.summary || d?.error, issues: a.doctorIssues().map((x) => x.text) };
}));

// arayüz: şablon ve geçiş ekranları
await step('ui', async () => {
  // v1.8: alt sayfalar artık panel (wm.js) — kapatmak için closeAll; eksik araç adı testi düşürmez, ekran görüntüsü atlanır
  const closeAll = () => pg.evaluate(async () => { try { (await import('./js/wm.js')).closeAll(); } catch (_) { /* yok */ } });
  const shot = async (label, file, wait) => {
    try { await pg.click(`#toolbar .tool:has-text("${label}")`, { timeout: 8000 }); } catch (_) { return false; }
    await pg.waitForTimeout(wait); await pg.screenshot({ path: `${OUT}/${file}` }); await closeAll(); await pg.waitForTimeout(300); return true;
  };
  if (await pg.isVisible('#newProject')) { await pg.click('#newProject'); await pg.waitForTimeout(500); }
  const shots = {};
  for (const [label, file, wait] of [['Yapay zekâ', 'ui_ai.png', 500], ['Ses efekti', 'ui_sfx.png', 1200], ['Müzik', 'ui_music.png', 1500], ['Şablon', 'ui_tpl.png', 2500]]) shots[label] = await shot(label, file, wait);
  return { shots };
});

R.logs = logs.slice(0, 40);
R.totalMs = Date.now() - T0;
fs.writeFileSync(`${OUT}/e2e.json`, JSON.stringify(R, null, 1));
await b.close();
srv.close();
console.log('E2E BİTTİ', Object.entries(R).filter(([, v]) => v && v.ok === false).map(([k]) => k).join(', ') || 'tümü başarılı');
