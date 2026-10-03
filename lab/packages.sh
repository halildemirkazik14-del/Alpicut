#!/bin/bash
# npm paketlerinin içeriğini raporla
set +e
mkdir -p lab/out /tmp/pk && cd /tmp/pk && npm init -y >/dev/null
for p in @huggingface/transformers @mediapipe/tasks-vision @mintplex-labs/piper-tts-web @shiguredo/rnnoise-wasm @jitsi/rnnoise-wasm onnxruntime-web esbuild; do
  npm install --no-audit --no-fund "$p" >/dev/null 2>&1 && echo "== $p $(node -p "require('$p/package.json').version" 2>/dev/null)" || echo "== $p FAILED"
done >> $GITHUB_WORKSPACE/lab/out/packages.txt
for d in @huggingface/transformers/dist @mediapipe/tasks-vision @mediapipe/tasks-vision/wasm @mintplex-labs/piper-tts-web @mintplex-labs/piper-tts-web/dist @shiguredo/rnnoise-wasm @shiguredo/rnnoise-wasm/dist onnxruntime-web/dist; do
  echo "--- $d"; ls -la node_modules/$d 2>&1 | head -60
done >> $GITHUB_WORKSPACE/lab/out/packages.txt
for p in @mintplex-labs/piper-tts-web @shiguredo/rnnoise-wasm @huggingface/transformers @mediapipe/tasks-vision; do
  echo "--- package.json $p"; cat node_modules/$p/package.json | head -80
done >> $GITHUB_WORKSPACE/lab/out/packages.txt
echo "--- piper README"; cat node_modules/@mintplex-labs/piper-tts-web/README.md 2>/dev/null | head -150 >> $GITHUB_WORKSPACE/lab/out/packages.txt
echo "--- rnnoise README"; cat node_modules/@shiguredo/rnnoise-wasm/README.md 2>/dev/null | head -120 >> $GITHUB_WORKSPACE/lab/out/packages.txt
ls node_modules/@fontsource 2>/dev/null >> $GITHUB_WORKSPACE/lab/out/packages.txt
