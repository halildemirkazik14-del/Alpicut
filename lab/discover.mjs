// CI'da çalışır: varlık kaynaklarını keşfeder, sonuçları lab/out/discover.json'a yazar
import fs from 'node:fs';
const out = {};
const get = async (u, o = {}) => { const r = await fetch(u, { headers: { 'User-Agent': 'AlpicutBuild/1.0 (github.com/halildemirkazik14-del/Alpicut)' }, ...o }); return r; };

// Kenney ses paketleri (CC0)
const kenney = ['interface-sounds', 'impact-sounds', 'digital-audio', 'sci-fi-sounds', 'rpg-audio', 'casino-audio', 'ui-audio', 'music-jingles', 'voiceover-pack', 'voiceover-pack-fighter', 'foley-sounds', 'ui-pack-sounds'];
out.kenney = {};
for (const k of kenney) {
  try {
    const r = await get(`https://kenney.nl/assets/${k}`);
    const t = await r.text();
    const zips = [...t.matchAll(/href="([^"]+\.zip)"/g)].map((m) => m[1]);
    const lic = /Creative Commons CC0|CC0/i.test(t);
    out.kenney[k] = { status: r.status, zips, cc0: lic };
  } catch (e) { out.kenney[k] = { error: String(e) }; }
}

// OpenGameArt CC0 SFX paketleri
const oga = ['512-sound-effects-8-bit-style', '100-cc0-sfx', '100-cc0-sfx-2', '80-cc0-creature-sfx', '50-cc0-retro-synth-sfx', 'cc0-sound-effects', 'whoosh-sounds', 'swishes-sound-pack', 'bubbles-pack', 'cc0-sfx-pack-1', 'rpg-sound-pack', '25-cc0-bang-firework-sfx', '40-cc0-water-splash-slime-sfx', '35-wooden-crackssplintersbreakage', '50-cc0-sci-fi-sfx'];
out.oga = {};
for (const k of oga) {
  try {
    const r = await get(`https://opengameart.org/content/${k}`);
    const t = await r.text();
    const files = [...new Set([...t.matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+)"/g)].map((m) => m[1]))];
    const lic = [...new Set([...t.matchAll(/licenses\/([a-z0-9-]+)\//gi)].map((m) => m[1]))];
    const cc0 = /publicdomain\/zero|CC0/i.test(t);
    out.oga[k] = { status: r.status, files, lic, cc0, title: (t.match(/<title>([^<]+)/) || [])[1] };
  } catch (e) { out.oga[k] = { error: String(e) }; }
}

// Wikimedia Commons: kamu malı klasik müzik kayıtları
const composers = ['Vivaldi', 'Mozart', 'Beethoven', 'Bach', 'Chopin', 'Tchaikovsky', 'Debussy', 'Grieg', 'Handel', 'Satie', 'Strauss', 'Brahms', 'Schubert', 'Rossini', 'Pachelbel', 'Mussorgsky', 'Dvorak', 'Haydn', 'Mendelssohn', 'Bizet', 'Offenbach', 'Holst', 'Joplin', 'Liszt', 'Ravel', 'Saint-Saens', 'Verdi', 'Wagner', 'Elgar', 'Sousa'];
out.commons = [];
for (const c of composers) {
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=${encodeURIComponent(`${c} musopen`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata|metadata`;
    const r = await get(u);
    const j = await r.json();
    for (const p of Object.values(j.query?.pages || {})) {
      const ii = p.imageinfo?.[0];
      if (!ii || !/audio|ogg/.test(ii.mime)) continue;
      const em = ii.extmetadata || {};
      const len = (ii.metadata || []).find((m) => m.name === 'length')?.value;
      out.commons.push({ composer: c, title: p.title, url: ii.url, size: ii.size, mime: ii.mime, len, license: em.LicenseShortName?.value, artist: (em.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 120), usage: em.UsageTerms?.value });
    }
  } catch (e) { out.commons.push({ composer: c, error: String(e) }); }
}

// Commons ses efektleri (CC0 / kamu malı)
out.commonsSfx = [];
for (const q of ['sound effect whoosh', 'sound effect applause', 'sound effect crowd', 'sound effect whistle', 'sound effect explosion', 'sound effect door', 'sound effect camera shutter', 'sound effect cash register', 'sound effect drum roll', 'sound effect laugh', 'sound effect bell', 'sound effect rain', 'sound effect thunder', 'sound effect car', 'sound effect phone']) {
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(q + ' filetype:audio')}&prop=imageinfo&iiprop=url|size|mime|extmetadata|metadata`;
    const j = await (await get(u)).json();
    for (const p of Object.values(j.query?.pages || {})) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const em = ii.extmetadata || {};
      const len = (ii.metadata || []).find((m) => m.name === 'length')?.value;
      out.commonsSfx.push({ q, title: p.title, url: ii.url, size: ii.size, len, license: em.LicenseShortName?.value });
    }
  } catch (e) { out.commonsSfx.push({ q, error: String(e) }); }
}

// Google Fonts meta verisi
try {
  const t = await (await get('https://fonts.google.com/metadata/fonts')).text();
  const j = JSON.parse(t.replace(/^\)\]\}'\n?/, ''));
  out.gfonts = { count: (j.familyMetadataList || []).length, sample: (j.familyMetadataList || []).slice(0, 2) };
} catch (e) { out.gfonts = { error: String(e) }; }

// MediaPipe model adresleri
for (const u of ['https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite', 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite']) {
  const r = await get(u, { method: 'HEAD' }); (out.mp ||= []).push([u, r.status, r.headers.get('content-length')]);
}
// Piper Türkçe sesleri
try {
  const j = await (await get('https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json')).json();
  out.piperTr = Object.keys(j).filter((k) => k.startsWith('tr_'));
  out.piperCount = Object.keys(j).length;
} catch (e) { out.piperTr = String(e); }

fs.mkdirSync('lab/out', { recursive: true });
fs.writeFileSync('lab/out/discover.json', JSON.stringify(out, null, 1));
console.log('kenney', Object.entries(out.kenney).map(([k, v]) => `${k}:${v.zips?.length}`).join(' '));
console.log('commons music', out.commons.length, 'sfx', out.commonsSfx.length, 'gfonts', out.gfonts.count);
