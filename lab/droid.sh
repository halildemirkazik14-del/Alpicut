#!/usr/bin/env bash
# Android emülatöründe Alpicut APK'sını çalıştırır, WebView'a CDP ile bağlanıp testleri koşar
set -u
OUT=lab/out
mkdir -p "$OUT"
PKG=com.alpicut.app
adb wait-for-device
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell dumpsys package com.google.android.webview | grep -m1 versionName > "$OUT/webview-version.txt" 2>/dev/null || true
adb shell getprop ro.build.version.release >> "$OUT/webview-version.txt"
adb install -r -g Alpicut.apk > "$OUT/install.txt" 2>&1
adb shell pm grant $PKG android.permission.RECORD_AUDIO 2>/dev/null || true
adb logcat -c
(adb logcat -v time > "$OUT/logcat-full.txt" 2>&1 &)
adb shell am start -W -n $PKG/.MainActivity > "$OUT/start.txt" 2>&1
sleep 12
PID=$(adb shell pidof $PKG | tr -d '\r')
echo "pid=$PID" >> "$OUT/start.txt"
SOCK=$(adb shell grep -a -o "webview_devtools_remote_[0-9]*" /proc/net/unix | head -1 | tr -d '\r')
echo "sock=$SOCK" >> "$OUT/start.txt"
adb forward tcp:9222 localabstract:$SOCK
sleep 1
curl -s http://127.0.0.1:9222/json/list > "$OUT/targets.json" || true
adb exec-out screencap -p > "$OUT/00-launch.png"
timeout 3000 node lab/droid.mjs 2>&1 | tee "$OUT/droid.txt"
adb exec-out screencap -p > "$OUT/99-end.png"
# çökme / hata özetleri
grep -E "FATAL|AndroidRuntime|chromium.*(CONSOLE|ERROR)|Renderer process|crash|OutOfMemory|lowmemorykiller|signal 11|SIGSEGV|Capacitor" "$OUT/logcat-full.txt" | tail -400 > "$OUT/logcat-errors.txt" || true
tail -3000 "$OUT/logcat-full.txt" > "$OUT/logcat-tail.txt"
rm -f "$OUT/logcat-full.txt"
adb shell dumpsys meminfo $PKG > "$OUT/meminfo.txt" 2>&1 || true
exit 0
