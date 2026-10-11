// Alpicut v1.11 — büyük dosyaları belleğe değil diske yaz (Origin Private File System)
// 1 saatlik video: dışa aktarma ~3–4 GB, hafif kopya ~0,7 GB. Bunlar RAM'de biriktirilirse uygulama kapanır.
// Burada mediabunny çıktısı parça parça uygulamanın özel diskine yazılır; sonuç disk tabanlı bir File olur.
const DIR = 'alpicut-tmp';

export function hasOPFS() {
  return !!(navigator.storage && navigator.storage.getDirectory && window.FileSystemFileHandle && 'createWritable' in FileSystemFileHandle.prototype);
}

async function dir(name = DIR) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(name, { create: true });
}

// mediabunny StreamTarget'ı + bitince File döndüren yardımcı. Desteklenmiyorsa null.
export async function diskTarget(MB, filename, { folder = DIR } = {}) {
  if (!hasOPFS()) return null;
  try {
    const d = await dir(folder);
    const fh = await d.getFileHandle(filename, { create: true });
    const w = await fh.createWritable({ keepExistingData: false });
    const stream = new WritableStream({
      async write(ch) { await w.write({ type: 'write', position: ch.position, data: ch.data }); },
      async close() { await w.close(); },
      async abort() { try { await w.abort(); } catch (_) { /* yoksay */ } },
    });
    return {
      target: new MB.StreamTarget(stream, { chunked: true, chunkSize: 8 * 1024 * 1024 }),
      file: () => fh.getFile(),
      remove: () => d.removeEntry(filename).catch(() => {}),
      name: filename, folder,
    };
  } catch (e) { console.warn('OPFS kullanılamadı', e); return null; }
}

// Sıralı yazıcı (WAV gibi baştan sona yazılan dosyalar için). Desteklenmiyorsa bellekte parça listesi tutar.
export async function seqWriter(filename, type = 'application/octet-stream', { folder = DIR } = {}) {
  if (hasOPFS()) {
    try {
      const d = await dir(folder);
      const fh = await d.getFileHandle(filename, { create: true });
      const w = await fh.createWritable({ keepExistingData: false });
      let pos = 0;
      return {
        async write(buf) { await w.write({ type: 'write', position: pos, data: buf }); pos += buf.byteLength; },
        async writeAt(position, buf) { await w.write({ type: 'write', position, data: buf }); },
        async close() { await w.close(); const f = await fh.getFile(); return new File([f], filename, { type }); },
        get size() { return pos; },
      };
    } catch (e) { console.warn('OPFS yazıcı kullanılamadı', e); }
  }
  const parts = []; let pos = 0; const patches = [];
  return {
    async write(buf) { parts.push(new Uint8Array(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf)); pos += buf.byteLength; },
    async writeAt(position, buf) { patches.push([position, new Uint8Array(buf)]); },
    async close() {
      let b = new Blob(parts, { type });
      for (const [p, data] of patches) b = new Blob([b.slice(0, p), data, b.slice(p + data.byteLength)], { type });
      return new File([b], filename, { type });
    },
    get size() { return pos; },
  };
}

// Kalıcı (proje) dosyaları: hafif kopyalar burada kalır, IndexedDB'de yalnızca adı tutulur
export async function persistFile(name) {
  if (!hasOPFS()) return null;
  try { const d = await dir('alpicut-media'); const fh = await d.getFileHandle(name); return await fh.getFile(); } catch (_) { return null; }
}
export async function removePersist(name) { try { const d = await dir('alpicut-media'); await d.removeEntry(name); } catch (_) { /* yoksay */ } }
export async function cleanTmp() { try { const root = await navigator.storage.getDirectory(); await root.removeEntry(DIR, { recursive: true }); } catch (_) { /* yoksay */ } }

// Akışlı WAV (16 bit PCM) yazıcı: başlık sonda düzeltilir
export async function wavWriter(filename, { sr = 48000, ch = 1, folder } = {}) {
  const w = await seqWriter(filename, 'audio/wav', folder ? { folder } : undefined);
  await w.write(new Uint8Array(44));
  let frames = 0;
  return {
    async add(...chans) { // Float32Array'ler (kanal başına)
      const n = chans[0].length, out = new Int16Array(n * ch);
      for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, (chans[c] || chans[0])[i])); out[i * ch + c] = v < 0 ? v * 0x8000 : v * 0x7fff; }
      await w.write(new Uint8Array(out.buffer)); frames += n;
    },
    async close() {
      const bytes = frames * ch * 2, h = new DataView(new ArrayBuffer(44));
      const s = (o, t) => { for (let i = 0; i < t.length; i++) h.setUint8(o + i, t.charCodeAt(i)); };
      s(0, 'RIFF'); h.setUint32(4, 36 + bytes, true); s(8, 'WAVE'); s(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, ch, true);
      h.setUint32(24, sr, true); h.setUint32(28, sr * ch * 2, true); h.setUint16(32, ch * 2, true); h.setUint16(34, 16, true); s(36, 'data'); h.setUint32(40, bytes, true);
      await w.writeAt(0, new Uint8Array(h.buffer));
      return w.close();
    },
    get frames() { return frames; },
  };
}
