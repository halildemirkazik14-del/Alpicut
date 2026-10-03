#!/bin/bash
cd /tmp/pk
O=$GITHUB_WORKSPACE/lab/out/docs.txt
for f in node_modules/@mintplex-labs/piper-tts-web/README.md node_modules/@mintplex-labs/piper-tts-web/dist/inference.d.ts node_modules/@mintplex-labs/piper-tts-web/dist/types.d.ts node_modules/@mintplex-labs/piper-tts-web/dist/index.d.ts node_modules/@mintplex-labs/piper-tts-web/dist/voices.d.ts node_modules/@mintplex-labs/piper-tts-web/dist/storage.d.ts node_modules/@shiguredo/rnnoise-wasm/README.md node_modules/@shiguredo/rnnoise-wasm/dist/rnnoise.d.ts node_modules/@jitsi/rnnoise-wasm/package.json; do echo "=================== $f"; cat $f; done > $O 2>&1
echo "=================== piper js head" >> $O; head -c 6000 node_modules/@mintplex-labs/piper-tts-web/dist/piper-tts-web.js >> $O
echo; echo "=================== piper urls" >> $O; grep -o 'https://[^"'"'"'` ]*' node_modules/@mintplex-labs/piper-tts-web/dist/*.js | sort -u | head -40 >> $O
echo "=================== transformers web env" >> $O; grep -o 'wasmPaths[^;]\{0,200\}' node_modules/@huggingface/transformers/dist/transformers.web.js | head -10 >> $O
grep -o 'cdn.jsdelivr.net[^"'"'"'` ]*' node_modules/@huggingface/transformers/dist/transformers.web.js | sort -u | head >> $O
node -p "require('/tmp/pk/node_modules/@huggingface/transformers/package.json').version" >> $O 2>&1
node -p "require('/tmp/pk/node_modules/@mediapipe/tasks-vision/package.json').version" >> $O 2>&1
# Kenney indirme bağlantıları
for k in impact-sounds interface-sounds digital-audio; do echo "=================== kenney $k" >> $O; curl -sL "https://kenney.nl/assets/$k" | grep -io '[^"]*download[^"]*\|[^"]*\.zip[^"]*' | head -10 >> $O; done
