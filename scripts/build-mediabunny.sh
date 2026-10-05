#!/usr/bin/env bash
# www/js/lib/mediabunny.mjs dosyasını yeniden üretir (MPL-2.0, https://github.com/Vanilagy/mediabunny).
# Kaynak değiştirilmeden paketlenir; yalnızca tarayıcıda kullanılmayan node.ts boş bir modülle değiştirilir.
set -euo pipefail
TMP=$(mktemp -d)
git clone --depth 1 https://github.com/Vanilagy/mediabunny "$TMP/mb"
echo "export const fs: any = null;" > "$TMP/mb/src/node.ts"
npx esbuild "$TMP/mb/src/index.ts" --bundle --format=esm --platform=browser --minify --target=es2020 --outfile=www/js/lib/mediabunny.mjs
cp "$TMP/mb/LICENSE" www/licenses/mediabunny-LICENSE-MPL-2.0.txt
echo "mediabunny $(git -C "$TMP/mb" rev-parse --short HEAD)" > www/licenses/mediabunny-VERSION.txt
