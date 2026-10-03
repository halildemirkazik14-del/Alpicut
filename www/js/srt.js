// SRT ayrıştırma ve üretme
function toSec(s) {
  const x = s.trim().split(/\s+/)[0].replace(',', '.');
  let m = x.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]);
  m = x.match(/^(\d+):(\d+(?:\.\d+)?)$/); // VTT: dd:ss.mmm
  if (m) return +m[1] * 60 + parseFloat(m[2]);
  return 0;
}

// SRT ve WebVTT dosyalarını okur
export function parseSRT(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, '').replace(/^﻿/, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim() !== '');
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, z] = lines[ti].split('-->');
    const txt = lines.slice(ti + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (!txt) continue;
    cues.push({ start: toSec(a), end: toSec(z), text: txt });
  }
  return cues.sort((x, y) => x.start - y.start);
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
function fmt(t) {
  const ms = Math.round(t * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export function toSRT(cues) {
  return cues.map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n');
}

export function toVTT(cues) {
  return 'WEBVTT\n\n' + cues.map((c) => `${fmt(c.start).replace(',', '.')} --> ${fmt(c.end).replace(',', '.')}\n${c.text}\n`).join('\n');
}
