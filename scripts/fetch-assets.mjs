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

// ---------- 4) Ses efektleri (CC0) ----------
const TR = { impact: 'Darbe', interface: 'Arayüz', digital: 'Dijital', scifi: 'Bilim kurgu', rpg: 'Oyun / RPG', casino: 'Kumarhane', ui: 'Tıklama', jingle: 'Jingle', voice: 'Seslendirme', retro: 'Retro 8-bit', swish: 'Whoosh', creature: 'Yaratık', bang: 'Patlama', water: 'Su', misc: 'Çeşitli', crowd: 'Kalabalık', ambience: 'Ortam' };
const SOURCES = [
  { k: 'kenney', slug: 'impact-sounds', cat: 'impact' }, { k: 'kenney', slug: 'interface-sounds', cat: 'interface' },
  { k: 'kenney', slug: 'digital-audio', cat: 'digital' }, { k: 'kenney', slug: 'sci-fi-sounds', cat: 'scifi' },
  { k: 'kenney', slug: 'rpg-audio', cat: 'rpg' }, { k: 'kenney', slug: 'casino-audio', cat: 'casino' },
  { k: 'kenney', slug: 'ui-audio', cat: 'ui' }, { k: 'kenney', slug: 'music-jingles', cat: 'jingle' },
  { k: 'kenney', slug: 'voiceover-pack', cat: 'voice' }, { k: 'kenney', slug: 'voiceover-pack-fighter', cat: 'voice' },
  { k: 'oga', slug: '512-sound-effects-8-bit-style', cat: 'retro' }, { k: 'oga', slug: '100-cc0-sfx', cat: 'misc' },
  { k: 'oga', slug: '100-cc0-sfx-2', cat: 'misc' }, { k: 'oga', slug: '80-cc0-creature-sfx', cat: 'creature' },
  { k: 'oga', slug: '50-cc0-retro-synth-sfx', cat: 'retro' }, { k: 'oga', slug: 'swishes-sound-pack', cat: 'swish' },
  { k: 'oga', slug: 'rpg-sound-pack', cat: 'rpg' }, { k: 'oga', slug: '25-cc0-bang-firework-sfx', cat: 'bang' },
  { k: 'oga', slug: '40-cc0-water-splash-slime-sfx', cat: 'water' }, { k: 'oga', slug: '50-cc0-sci-fi-sfx', cat: 'scifi' },
];
const KEYCAT = [[/whoosh|swish|swoosh|woosh/i, 'swish'], [/explos|bang|boom|blast|firework/i, 'bang'], [/crowd|cheer|applause|clap/i, 'crowd'], [/water|splash|drip|bubble/i, 'water'], [/click|tap|switch|toggle/i, 'ui'], [/coin|chip|card|dice/i, 'casino'], [/laser|zap|phaser|sci/i, 'scifi'], [/punch|hit|impact|thud|knock/i, 'impact'], [/jingle|win|lose|level|fanfare/i, 'jingle']];
function niceName(f) {
  return path.basename(f).replace(/\.(ogg|wav|mp3|flac)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 48);
}
{
  const TMP = '/tmp/sfx'; mk(TMP); mk(`${W}/sfx`);
  const manifest = [];
  const lic = [];
  let n = 0;
  for (const src of SOURCES) {
    try {
      const page = await get(src.k === 'kenney' ? `https://kenney.nl/assets/${src.slug}` : `https://opengameart.org/content/${src.slug}`);
      if (!page) { report.errors.push(`sfx sayfa: ${src.slug}`); continue; }
      const html = await page.text();
      let zips = [];
      if (src.k === 'kenney') {
        if (!/CC0/i.test(html)) { report.errors.push(`kenney lisans doğrulanamadı: ${src.slug}`); continue; }
        zips = [...html.matchAll(/href=['"]([^'"]+\.zip)['"]/g)].map((m) => m[1]).filter((u) => u.includes(src.slug));
      } else {
        const licBlock = (html.match(/field-name-field-art-licenses[\s\S]{0,1500}?<\/div>\s*<\/div>\s*<\/div>/) || [''])[0];
        if (!/publicdomain\/zero|CC0/i.test(licBlock)) { report.errors.push(`oga lisans CC0 değil/doğrulanamadı: ${src.slug}`); continue; }
        zips = [...new Set([...html.matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+\.(?:zip|ogg|wav))"/gi)].map((m) => m[1]))];
      }
      if (!zips.length) { report.errors.push(`zip yok: ${src.slug}`); continue; }
      const dir = path.join(TMP, src.slug); mk(dir);
      for (const z of zips.slice(0, 3)) {
        const fn = path.join(dir, decodeURIComponent(z.split('/').pop()).replace(/[^\w.-]+/g, '_'));
        if (!(await download(z, fn, src.k === 'kenney' ? `https://kenney.nl/assets/${src.slug}` : `https://opengameart.org/content/${src.slug}`))) { report.errors.push(`indirilemedi: ${z.slice(0, 120)}`); continue; }
        report.sfxSources[src.slug] = `${(fs.statSync(fn).size / 1048576).toFixed(1)} MB`;
        if (fn.endsWith('.zip')) { try { execSync(`unzip -qo "${fn}" -d "${dir}/x"`); } catch (_) { report.errors.push(`unzip: ${fn}`); } }
        else { mk(`${dir}/x`); fs.renameSync(fn, `${dir}/x/${path.basename(fn)}`); }
      }
      const files = execSync(`find "${dir}/x" -type f \\( -iname '*.ogg' -o -iname '*.wav' -o -iname '*.mp3' -o -iname '*.flac' \\) 2>/dev/null || true`).toString().split('\n').filter((f) => f && !f.includes('__MACOSX') && !path.basename(f).startsWith('._'));
      report.sfxSources[src.slug] = `${report.sfxSources[src.slug] || '?'} · ${files.length} dosya`;
      // aynı adın farklı biçimlerinden yalnız birini al
      const seen = new Set();
      for (const f of files.sort()) {
        const base = path.basename(f).replace(/\.\w+$/, '').toLowerCase();
        if (seen.has(base)) continue; seen.add(base);
        const id = `${src.slug.replace(/[^a-z0-9]/g, '')}_${(++n).toString(36)}`;
        const out = `${W}/sfx/${id}.ogg`;
        try {
          execSync(`ffmpeg -loglevel error -y -i "${f}" -t 20 -ac 1 -ar 48000 -c:a libopus -b:a 56k "${out}"`);
          const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${out}"`).toString()) || 0;
          if (dur < 0.03) { fs.unlinkSync(out); continue; }
          let cat = src.cat;
          if (src.cat === 'misc' || src.cat === 'rpg') for (const [re, c] of KEYCAT) if (re.test(f)) { cat = c; break; }
          manifest.push({ id, n: niceName(f), c: TR[cat] || cat, d: +dur.toFixed(2), s: src.k === 'kenney' ? `Kenney · ${src.slug}` : `OpenGameArt · ${src.slug}` });
        } catch (e) { if (!report.ffmpegErr) report.ffmpegErr = String(e.stderr || e.message).slice(0, 300); }
      }
      lic.push(`${src.k === 'kenney' ? 'Kenney (kenney.nl)' : 'OpenGameArt.org'} — ${src.slug} — CC0 1.0 Public Domain`);
      log('sfx', src.slug, manifest.length);
    } catch (e) { report.errors.push(`sfx ${src.slug}: ${e.message}`); }
  }
  fs.writeFileSync(`${W}/sfx/index.json`, JSON.stringify(manifest));
  mk(`${W}/licenses`);
  fs.writeFileSync(`${W}/licenses/sfx.txt`, `Alpicut ses efektleri — tamamı CC0 (kamu malı) kaynaklardan:\n\n${lic.join('\n')}\n`);
  report.sfx = manifest.length;
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
