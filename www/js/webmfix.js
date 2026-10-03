// MediaRecorder'ın ürettiği WebM dosyalarına süre bilgisi ekler.
// (Süresiz WebM'de galeri/oynatıcılar süreyi göstermez ve ileri-geri sarılamaz.)
function readVint(b, p, keepMarker) {
  const first = b[p];
  if (first === undefined) return null;
  let len = 1, mask = 0x80;
  while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
  if (len > 8) return null;
  let v = keepMarker ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < len; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) allOnes = false; }
  return { v, len, unknown: !keepMarker && allOnes };
}
function sizeVint8(n) { const o = new Uint8Array(8); o[0] = 0x01; for (let i = 7; i >= 1; i--) { o[i] = n % 256; n = Math.floor(n / 256); } return o; }

export async function fixWebmDuration(blob, durationMs) {
  try {
    const headLen = Math.min(blob.size, 256 * 1024);
    const b = new Uint8Array(await blob.slice(0, headLen).arrayBuffer());
    let p = 0;
    // EBML başlığı
    const id0 = readVint(b, p, true); if (!id0 || id0.v !== 0x1a45dfa3) return blob;
    const s0 = readVint(b, p + id0.len); p += id0.len + s0.len + s0.v;
    const idS = readVint(b, p, true); if (!idS || idS.v !== 0x18538067) return blob;
    const sS = readVint(b, p + idS.len); p += idS.len + sS.len;
    while (p < b.length - 8) {
      const id = readVint(b, p, true); const sz = readVint(b, p + id.len);
      if (!id || !sz) return blob;
      const dataStart = p + id.len + sz.len;
      if (id.v === 0x1549a966) { // Info
        const dataEnd = dataStart + sz.v;
        if (dataEnd > b.length) return blob;
        let q = dataStart, scale = 1000000, durPos = -1;
        const kids = [];
        while (q < dataEnd) {
          const cid = readVint(b, q, true); const cs = readVint(b, q + cid.len);
          const ds = q + cid.len + cs.len;
          if (cid.v === 0x2ad7b1) { let v = 0; for (let i = 0; i < cs.v; i++) v = v * 256 + b[ds + i]; scale = v || scale; }
          if (cid.v === 0x4489) durPos = kids.length;
          kids.push([q, ds + cs.v, cid.v]);
          q = ds + cs.v;
        }
        const val = (durationMs * 1e6) / scale;
        const durEl = new Uint8Array(11); durEl[0] = 0x44; durEl[1] = 0x89; durEl[2] = 0x88; new DataView(durEl.buffer).setFloat64(3, val);
        const parts = kids.filter((_, i) => i !== durPos).map(([a, e]) => b.slice(a, e));
        parts.push(durEl);
        const total = parts.reduce((x, y) => x + y.length, 0);
        const info = new Uint8Array(4 + 8 + total);
        info.set([0x15, 0x49, 0xa9, 0x66], 0); info.set(sizeVint8(total), 4);
        let o = 12; parts.forEach((x) => { info.set(x, o); o += x.length; });
        return new Blob([b.slice(0, p), info, b.slice(dataEnd), blob.slice(headLen)], { type: blob.type });
      }
      if (sz.unknown || id.v === 0x1f43b675) return blob; // Cluster'a geldik, Info yok
      p = dataStart + sz.v;
    }
  } catch (e) { console.warn('webm süre', e); }
  return blob;
}
