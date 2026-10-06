// Sürüm kapısı: testler başarısızsa APK üretilmez.
// Kullanım: node lab/gate.mjs <e2e.json> <smoke.txt>
// - Uçtan uca testlerde ok:false olan adım varsa (yalnızca dış siteye bağlı olanlar hariç) → başarısız
// - Tarayıcıda içerik güvenlik politikası (CSP) ihlali görüldüyse → başarısız
// - Hızlı arayüz testinde (smoke) hata sayısı 0 değilse → başarısız
import fs from 'node:fs';

const [e2ePath = 'lab/out/e2e.json', smokePath = 'smoke.txt'] = process.argv.slice(2);
// Dış sitelere bağlı, internet dalgalanmasından düşebilen adımlar: uyarı verir, sürümü durdurmaz
const SOFT = new Set(['googleFont', 'musicHead']);
const bad = [];
const warn = [];

if (!fs.existsSync(e2ePath)) bad.push(`uçtan uca test sonucu yok (${e2ePath})`);
else {
  const R = JSON.parse(fs.readFileSync(e2ePath, 'utf8'));
  for (const [k, v] of Object.entries(R)) {
    if (!v || typeof v !== 'object' || v.ok !== false) continue;
    (SOFT.has(k) ? warn : bad).push(`e2e ${k}: ${String(v.error || '').slice(0, 160)}`);
  }
  for (const l of R.logs || []) if (/Content Security Policy|Refused to (load|execute|connect|apply|create)/i.test(l)) bad.push(`CSP: ${l.slice(0, 200)}`);
}

if (!fs.existsSync(smokePath)) bad.push(`arayüz testi sonucu yok (${smokePath})`);
else {
  const txt = fs.readFileSync(smokePath, 'utf8');
  const m = txt.match(/HATALAR (\d+)/);
  if (!m) bad.push('arayüz testi bitmedi');
  else if (+m[1] > 0) bad.push(`arayüz testinde ${m[1]} hata:\n${txt.slice(txt.indexOf('HATALAR')).slice(0, 1500)}`);
}

warn.forEach((w) => console.log(`::warning::${w}`));
if (bad.length) {
  bad.forEach((b) => console.log(`::error::${b.replace(/\n/g, ' | ')}`));
  console.log(`\nSÜRÜM KAPISI: KAPALI (${bad.length} sorun)`);
  process.exit(1);
}
console.log('SÜRÜM KAPISI: AÇIK — tüm testler geçti');
