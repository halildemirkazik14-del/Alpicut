#!/usr/bin/env bash
# Emülatör testleri için örnek medya: Türkçe konuşmalı dikey video + portre fotoğrafı
set -u
OUT=www/labmedia
mkdir -p "$OUT"
timeout 180 sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq espeak-ng > /dev/null 2>&1 || true
TXT="Merhaba arkadaşlar. Bugün çok güzel bir maç izledik. İkinci yarıda harika bir gol geldi. Videoyu beğenmeyi ve abone olmayı unutmayın."
timeout 30 espeak-ng -v tr -s 150 -w /tmp/speech.wav "$TXT" 2>/dev/null || ffmpeg -loglevel error -f lavfi -i "sine=frequency=220:duration=8" /tmp/speech.wav
# portre
for u in "https://storage.googleapis.com/mediapipe-assets/portrait.jpg" \
         "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Pierre-Person.jpg/480px-Pierre-Person.jpg"; do
  curl -sfL --max-time 20 -A "Mozilla/5.0 alpicut-lab" -o "$OUT/portrait.jpg" "$u" && break
done
[ -s "$OUT/portrait.jpg" ] || ffmpeg -loglevel error -f lavfi -i testsrc=size=720x1280 -frames:v 1 "$OUT/portrait.jpg"
# hafif hareketli dikey video (zoom), konuşma sesiyle, ses ve hafif oda gürültüsü
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/speech.wav | cut -d. -f1); D=$(( ${D:-8} + 2 ))
timeout 300 ffmpeg -loglevel error -y -loop 1 -framerate 30 -t $D -i "$OUT/portrait.jpg" -i /tmp/speech.wav \
  -filter_complex "[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,format=yuv420p[v];[1:a]apad,aresample=48000[a]" \
  -map "[v]" -map "[a]" -t $D -c:v libx264 -preset veryfast -crf 26 -c:a aac -b:a 128k "$OUT/test.mp4"
# ikinci, yatay klip (akıllı kadraj testi)
timeout 120 ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i "sine=frequency=330:duration=4" -t 4 \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac "$OUT/wide.mp4"
# gürültülü konuşma (stüdyo ses testi)
timeout 120 ffmpeg -loglevel error -y -i /tmp/speech.wav -f lavfi -i "anoisesrc=color=white:amplitude=0.03:duration=30" \
  -filter_complex "[0:a]aresample=48000,adelay=2000|2000,apad=pad_dur=2[s];[1:a]aresample=48000[n];[s][n]amix=inputs=2:duration=first:normalize=0" -ac 1 "$OUT/noisy.wav"
ls -la "$OUT"
