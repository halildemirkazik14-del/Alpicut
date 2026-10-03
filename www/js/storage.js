// Alpicut — IndexedDB ile proje ve medya saklama + dosya kaydetme
const DB_NAME = 'alpicut';
let dbp = null;

function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const store = {
  putMedia: (rec) => tx('media', 'readwrite', (s) => s.put(rec)),
  getMedia: (id) => tx('media', 'readonly', (s) => s.get(id)),
  delMedia: (id) => tx('media', 'readwrite', (s) => s.delete(id)),
  putProject: (p) => tx('projects', 'readwrite', (s) => s.put(p)),
  getProject: (id) => tx('projects', 'readonly', (s) => s.get(id)),
  delProject: (id) => tx('projects', 'readwrite', (s) => s.delete(id)),
  allProjects: () => tx('projects', 'readonly', (s) => s.getAll()),
};

export function lsGet(k, def = null) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (_) { return def; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* yoksay */ } }

// ---------- Dosya kaydetme (Android: Capacitor, tarayıcı: indirme) ----------
function plugin(name) {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
  return (C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null);
}

export const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function writeChunked(FS, path, directory, blob, onProgress) {
  const CH = 3 * 1024 * 1024; // 3 MB (base64 için 3'ün katı)
  for (let off = 0, i = 0; off < blob.size; off += CH, i++) {
    const data = await blobToBase64(blob.slice(off, off + CH));
    if (i === 0) await FS.writeFile({ path, data, directory, recursive: true });
    else await FS.appendFile({ path, data, directory });
    if (onProgress) onProgress(Math.min(1, (off + CH) / blob.size));
  }
  const { uri } = await FS.getUri({ path, directory });
  return uri;
}

// Videoyu kaydet: Android'de Belgeler/Alpicut klasörüne yazar, sonra paylaşım menüsünü açar
export async function saveVideo(blob, filename, { share = true, onProgress } = {}) {
  const FS = plugin('Filesystem');
  if (FS) {
    let uri = null, where = '';
    try {
      uri = await writeChunked(FS, `Alpicut/${filename}`, 'DOCUMENTS', blob, onProgress);
      where = 'Belgeler/Alpicut';
    } catch (e) {
      uri = await writeChunked(FS, filename, 'CACHE', blob, onProgress);
      where = '';
    }
    if (share) {
      const SH = plugin('Share');
      if (SH) {
        try { await SH.share({ title: filename, files: [uri], dialogTitle: 'Videoyu paylaş / kaydet' }); } catch (_) { /* kullanıcı kapattı */ }
      }
    }
    return { where, uri };
  }
  // tarayıcı
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { where: 'İndirilenler', uri: url };
}

export async function shareFile(uri, title) {
  const SH = plugin('Share');
  if (SH) await SH.share({ title, files: [uri], dialogTitle: 'Paylaş' });
}
