#!/bin/bash
set -x
sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg unzip > /dev/null
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi > /dev/null 2>&1
node scripts/fetch-assets.mjs > lab/out/assets.txt 2>&1
bash lab/make-media.sh
npx playwright install --with-deps chromium > /dev/null 2>&1
timeout 2400 node lab/whisperdbg.mjs > lab/out/whisperdbg.txt 2>&1
