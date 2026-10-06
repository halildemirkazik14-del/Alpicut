// Derleme sırasında (CI) çalışır: fontlar, yapay zekâ kütüphaneleri, ses efektleri ve müzik kataloğunu hazırlar.
// Kullanım: node scripts/fetch-assets.mjs   (gerekli: node 22, ffmpeg, unzip, npm paketleri kurulu)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const W = 'www';
const UA = { 'User-Agent': 'AlpicutBuild/1.0 (https://github.com/halildemirkazik14-del/Alpicut)' };
const log = (...a) => console.log('[assets]', ...a);
const mk = (p) => fs.mkdirSync(p, { recursive: true });
const get = async (u, tries = 3, extra = {}) => {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(u, { headers: { ...UA, ...extra }, redirect: 'follow' }); if (r.ok) return r; log('HTTP', r.status, u); report.errors.push(`HTTP ${r.status} ${u.slice(0, 120)}`); } catch (e) { log('fetch hata', u, e.message); }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
};
const download = async (u, to, ref) => { const r = await get(u, 3, ref ? { Referer: ref } : {}); if (!r) return false; fs.writeFileSync(to, Buffer.from(await r.arrayBuffer())); return true; };
const nm = (p) => path.join('node_modules', p);
const report = { fonts: 0, sfx: 0, music: 0, errors: [], sfxSources: {} };

// ---------- 1) Paketli fontlar (@fontsource) ----------
const FONT_PKGS = ['barlow', 'barlow-condensed', 'barlow-semi-condensed', 'anton', 'bebas-neue', 'montserrat', 'poppins', 'oswald', 'roboto', 'inter', 'archivo-black', 'russo-one', 'teko', 'righteous', 'bangers', 'lobster', 'pacifico', 'permanent-marker', 'caveat', 'playfair-display', 'merriweather', 'roboto-mono'];
{
  mk(`${W}/fonts/files`);
  let css = '';
  for (const p of FONT_PKGS) {
    const dir = nm(`@fontsource/${p}/files`);
    if (!fs.existsSync(dir)) { report.errors.push(`font yok: ${p}`); continue; }
    const fam = JSON.parse(fs.readFileSync(nm(`@fontsource/${p}/package.json`))).name;
    let family = p.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
    // gerçek aile adı css'ten
    const any = fs.readdirSync(nm(`@fontsource/${p}`)).find((f) => /^\d{3}\.css$/.test(f) || f === 'index.css');
    if (any) { const m = fs.readFileSync(nm(`@fontsource/${p}/${any}`), 'utf8').match(/font-family:\s*'([^']+)'/); if (m) family = m[1]; }
    void fam;
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(.+)-(latin|latin-ext)-(\d{3})-(normal|italic)\.woff2$/);
      if (!m) continue;
      fs.copyFileSync(path.join(dir, f), `${W}/fonts/files/${f}`);
      const range = m[2] === 'latin'
        ? 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
        : 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
      css += `@font-face{font-family:'${family}';font-style:${m[4]};font-display:swap;font-weight:${m[3]};src:url(files/${f}) format('woff2');unicode-range:${range};}\n`;
      report.fonts++;
    }
  }
  fs.writeFileSync(`${W}/fonts/fonts.css`, css);
  log('fontlar', report.fonts);
}

// ---------- 2) Google Fonts kataloğu ----------
{
  mk(`${W}/data`);
  const r = await get('https://fonts.google.com/metadata/fonts');
  if (r) {
    const j = JSON.parse((await r.text()).replace(/^\)\]\}'\n?/, ''));
    const cat = { 'Sans Serif': 'sans-serif', Serif: 'serif', Display: 'display', Handwriting: 'handwriting', Monospace: 'monospace' };
    const list = (j.familyMetadataList || [])
      .filter((f) => !f.isNoto || /^Noto (Sans|Serif)$/.test(f.family))
      .map((f) => ({ f: f.family, c: cat[f.category] || 'sans-serif', w: [...new Set(Object.keys(f.fonts || {}).filter((k) => /^\d{3}$/.test(k)).map(Number))].sort((a, b) => a - b), p: f.popularity || 9999, s: (f.subsets || []).includes('latin-ext') ? 1 : 0 }))
      .sort((a, b) => a.p - b.p)
      .map(({ f, c, w, s }) => ({ f, c, w: w.length ? w : [400], s }));
    fs.writeFileSync(`${W}/data/gfonts.json`, JSON.stringify(list));
    log('google fonts', list.length);
    report.gfonts = list.length;
  } else report.errors.push('gfonts alınamadı');
}

// ---------- 3) Yapay zekâ kütüphaneleri ----------
{
  const cp = (from, to) => { if (fs.existsSync(from)) { mk(path.dirname(to)); fs.copyFileSync(from, to); return true; } report.errors.push(`yok: ${from}`); return false; };
  // MediaPipe
  cp(nm('@mediapipe/tasks-vision/vision_bundle.mjs'), `${W}/vendor/mediapipe/vision.js`);
  for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) cp(nm(`@mediapipe/tasks-vision/wasm/${f}`), `${W}/vendor/mediapipe/wasm/${f}`);
  mk(`${W}/models`);
  await download('https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', `${W}/models/selfie_segmenter.tflite`) || report.errors.push('segmenter modeli');
  await download('https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite', `${W}/models/selfie_multiclass_256x256.tflite`) || report.errors.push('çok sınıflı segmenter');
  await download('https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/latest/magic_touch.tflite', `${W}/models/magic_touch.tflite`) || report.errors.push('nesne segmenter (magic touch)');
  await download('https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite', `${W}/models/blaze_face_short_range.tflite`) || report.errors.push('yüz modeli');
  // transformers.js (Whisper) — tek dosyaya paketlenir; ONNX wasm dosyaları ilk kullanımda CDN'den gelir
  const esb = (entry, out) => { try { mk(path.dirname(out)); execSync(`npx esbuild "${entry}" --bundle --format=esm --platform=browser --minify --log-level=warning --outfile="${out}" --external:fs --external:path --external:url --external:sharp --external:onnxruntime-node`, { stdio: 'inherit' }); return true; } catch (e) { report.errors.push(`esbuild: ${entry}: ${e.message}`); return false; } };
  esb(nm('@huggingface/transformers/dist/transformers.web.js'), `${W}/vendor/transformers/transformers.js`);
  // RNNoise
  cp(nm('@shiguredo/rnnoise-wasm/dist/rnnoise.js'), `${W}/vendor/rnnoise/rnnoise.js`);
  // Piper TTS (onnxruntime-web 1.18 ile birlikte paketlenir)
  esb(nm('@mintplex-labs/piper-tts-web/dist/piper-tts-web.js'), `${W}/vendor/piper/piper-tts-web.js`);
  log('kütüphaneler hazır');
}

// ---------- 4) Ses efektleri — Alpicut Ses Fabrikası (v1.5) ----------
// Eski Kenney/OpenGameArt/Wikimedia paketleri kaldırıldı. Tüm efektler scripts/sfx-forge.mjs ile sıfırdan sentezlenir.
{
  try {
    execSync(`node scripts/sfx-forge.mjs ${W}/sfx`, { stdio: 'inherit' });
    const idx = JSON.parse(fs.readFileSync(`${W}/sfx/index.json`, 'utf8'));
    report.sfx = idx.length;
    mk(`${W}/licenses`);
    fs.writeFileSync(`${W}/licenses/sfx.txt`, `Alpicut ses efektleri (${idx.length} adet) — Alpicut Ses Fabrikası tarafından sıfırdan sentezlenmiştir.\nHiçbir üçüncü taraf kayıt içermez. Ticari kullanım dahil serbesttir, atıf gerekmez.\n`);
  } catch (e) { report.errors.push(`sfx-forge: ${e.message}`); }
}

// ---------- 5) Kamu malı klasik müzik kataloğu (Wikimedia Commons) ----------
{
  const composers = { Vivaldi: 'Antonio Vivaldi', Mozart: 'W. A. Mozart', Beethoven: 'L. van Beethoven', Bach: 'J. S. Bach', Chopin: 'Frédéric Chopin', Tchaikovsky: 'P. I. Çaykovski', Debussy: 'Claude Debussy', Grieg: 'Edvard Grieg', Handel: 'G. F. Händel', Satie: 'Erik Satie', Strauss: 'Johann Strauss', Brahms: 'Johannes Brahms', Schubert: 'Franz Schubert', Rossini: 'G. Rossini', Pachelbel: 'J. Pachelbel', Mussorgsky: 'M. Mussorgsky', Dvorak: 'A. Dvořák', Haydn: 'Joseph Haydn', Mendelssohn: 'F. Mendelssohn', Bizet: 'Georges Bizet', Offenbach: 'J. Offenbach', Holst: 'Gustav Holst', Joplin: 'Scott Joplin', Liszt: 'Franz Liszt', Ravel: 'Maurice Ravel', 'Saint-Saens': 'C. Saint-Saëns', Verdi: 'G. Verdi', Wagner: 'R. Wagner', Elgar: 'Edward Elgar', Sousa: 'J. P. Sousa' };
  const OK = /^(public domain|pdm|pdm-owner|cc0)/i;
  const out = []; const seen = new Set();
  for (const [q, name] of Object.entries(composers)) {
    for (const term of [`${q} musopen`, `${q} filetype:audio`]) {
      const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=${encodeURIComponent(term)}&prop=imageinfo&iiprop=url|size|mime|extmetadata|metadata`;
      const r = await get(u); if (!r) continue;
      const j = await r.json();
      for (const p of Object.values(j.query?.pages || {})) {
        const ii = p.imageinfo?.[0]; if (!ii || !/ogg|opus|mpeg|flac|wav/.test(ii.mime)) continue;
        if (seen.has(ii.url)) continue;
        const em = ii.extmetadata || {};
        const license = (em.LicenseShortName?.value || '').trim();
        if (!OK.test(license)) continue;
        const len = +((ii.metadata || []).find((m) => m.name === 'length')?.value || 0);
        if (len < 40 || len > 1200 || ii.size > 30 * 1048576) continue;
        if (!new RegExp(q.replace('-', '.?'), 'i').test(p.title)) continue;
        seen.add(ii.url);
        const title = p.title.replace(/^File:/, '').replace(/\.(ogg|oga|opus|mp3|flac|wav)$/i, '').replace(/[_]+/g, ' ').replace(/\s*-\s*/g, ' – ').replace(/\s+/g, ' ').trim();
        const artist = (em.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
        out.push({ t: title, c: name, u: ii.url, d: Math.round(len), z: ii.size, l: license, a: artist, p: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}` });
      }
    }
  }
  out.sort((a, b) => a.c.localeCompare(b.c) || a.t.localeCompare(b.t));
  fs.writeFileSync(`${W}/data/music.json`, JSON.stringify(out));
  report.music = out.length;
  log('müzik', out.length);
}

fs.writeFileSync(`${W}/data/assets-report.json`, JSON.stringify(report, null, 1));
log('RAPOR', JSON.stringify(report));
