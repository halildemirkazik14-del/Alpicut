// Barlow fontlarını node_modules'tan www/fonts içine kopyalar (APK çevrimdışı çalışsın diye)
import fs from 'node:fs';
import path from 'node:path';

const pkgs = ['barlow', 'barlow-condensed', 'barlow-semi-condensed'];
for (const p of pkgs) {
  const src = path.join('node_modules', '@fontsource', p);
  const dst = path.join('www', 'fonts', p);
  fs.mkdirSync(path.join(dst, 'files'), { recursive: true });
  let css = 0, files = 0;
  for (const f of fs.readdirSync(src)) {
    if (/^\d{3}(-italic)?\.css$/.test(f)) { fs.copyFileSync(path.join(src, f), path.join(dst, f)); css++; }
  }
  for (const f of fs.readdirSync(path.join(src, 'files'))) {
    if (/-(latin|latin-ext)-\d{3}-(normal|italic)\.woff2?$/.test(f)) { fs.copyFileSync(path.join(src, 'files', f), path.join(dst, 'files', f)); files++; }
  }
  console.log(`${p}: ${css} css, ${files} font dosyası`);
}
