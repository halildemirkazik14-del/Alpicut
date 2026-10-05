// Alpicut — v1.5 güvenlik ağı (FilmCraft'tan uyarlandı)
// • Kurtarma kaydı: her değişiklikten kısa süre sonra proje anlık görüntüsü eşzamanlı olarak saklanır;
//   uygulama çökse, telefon kapansa bile bir sonraki açılışta son hâli geri gelir.
// • Hata yakalayıcı: beklenmeyen hatalar günlüğe yazılır; donmuş ekran yerine kısa bir uyarı ve "Yeniden yükle" çıkar.
const KEY = 'alpicut.recovery';
const LOG = 'alpicut.errlog';
let tmr = null, pendingP = null;

function ls() { try { return window.localStorage; } catch (_) { return null; } }

// Projenin anlık görüntüsünü yaz (gecikmeli, birleşik)
export function journal(P) {
  pendingP = P;
  clearTimeout(tmr);
  tmr = setTimeout(flushJournal, 500);
}
export function flushJournal() {
  clearTimeout(tmr);
  const P = pendingP; pendingP = null;
  const s = ls();
  if (!P || !s) return;
  try { s.setItem(KEY, JSON.stringify({ id: P.id, at: Date.now(), json: JSON.stringify(P) })); }
  catch (_) { try { s.removeItem(KEY); } catch (__) { /* yoksay */ } }
}
// Kayıt (IndexedDB) başarıyla bittiğinde: bu projenin kurtarma kaydı artık gereksiz
export function journalSaved(id, at) {
  const s = ls(); if (!s) return;
  try { const r = JSON.parse(s.getItem(KEY) || 'null'); if (r && r.id === id && r.at <= at && !pendingP) s.removeItem(KEY); } catch (_) { /* yoksay */ }
}
// Açılışta: bu proje için kayıttan daha yeni bir kurtarma görüntüsü var mı?
export function recoveryFor(id, savedAt) {
  const s = ls(); if (!s) return null;
  try {
    const r = JSON.parse(s.getItem(KEY) || 'null');
    if (r && r.id === id && r.at > (savedAt || 0) + 200) return JSON.parse(r.json);
  } catch (_) { /* yoksay */ }
  return null;
}
export function recoveryAny() {
  const s = ls(); if (!s) return null;
  try { return JSON.parse(s.getItem(KEY) || 'null'); } catch (_) { return null; }
}
export function clearRecovery() { const s = ls(); try { s?.removeItem(KEY); } catch (_) { /* yoksay */ } }

window.addEventListener('pagehide', flushJournal);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushJournal(); });

// ---------- hata günlüğü + uyarı ----------
export function logError(where, err) {
  const s = ls();
  const line = `${new Date().toISOString()} [${where}] ${(err && (err.stack || err.message)) || err}`.slice(0, 1200);
  try { const a = JSON.parse(s?.getItem(LOG) || '[]'); a.push(line); s?.setItem(LOG, JSON.stringify(a.slice(-30))); } catch (_) { /* yoksay */ }
  console.error(where, err);
}
export function errorLog() { try { return JSON.parse(ls()?.getItem(LOG) || '[]'); } catch (_) { return []; } }

let lastBanner = 0;
export function showCrash(msg, onSave) {
  const now = Date.now();
  if (now - lastBanner < 15000) return;
  lastBanner = now;
  try { onSave?.(); } catch (_) { /* yoksay */ }
  let el = document.getElementById('crashBar');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'crashBar';
  el.className = 'crash-bar';
  el.innerHTML = '<div class="cb-t"><b>Beklenmeyen bir hata oldu</b><small>Çalışman kaydedildi. Sorun devam ederse yeniden yükle.</small></div>';
  const rel = document.createElement('button'); rel.className = 'cb-btn'; rel.textContent = 'Yeniden yükle'; rel.onclick = () => { flushJournal(); location.reload(); };
  const cp = document.createElement('button'); cp.className = 'cb-btn ghost'; cp.textContent = 'Raporu kopyala';
  cp.onclick = () => { navigator.clipboard?.writeText(`${msg}\n\n${errorLog().join('\n')}`).then(() => { cp.textContent = 'Kopyalandı'; }).catch(() => {}); };
  const x = document.createElement('button'); x.className = 'cb-x'; x.textContent = '×'; x.onclick = () => el.remove();
  el.append(rel, cp, x);
  document.body.append(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 12000);
}

let saveHook = null;
export function setSaveHook(fn) { saveHook = fn; }
const IGNORE = /ResizeObserver|AbortError|play\(\) request was interrupted|The play\(\) request|NotAllowedError|Load failed|Failed to fetch/i;
window.addEventListener('error', (e) => {
  if (!e.error && !e.message) return; // kaynak yükleme hataları
  const m = e.message || String(e.error);
  if (IGNORE.test(m)) return;
  logError('error', e.error || m);
  showCrash(m, saveHook);
});
window.addEventListener('unhandledrejection', (e) => {
  const m = String(e.reason?.message || e.reason || '');
  if (IGNORE.test(m)) return;
  logError('promise', e.reason);
});
