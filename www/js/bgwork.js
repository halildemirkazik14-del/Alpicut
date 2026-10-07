// Alpicut v1.10 — arka plan işleri için "oynatma önceliği"
// Hafif kopya ve kaydırma kareleri üretimi telefonun video çözücüsünü kullanır. Kullanıcı oynatırken
// bu işler bekler; böylece önizleme ile yarışmazlar.
let probe = () => false;
export const setPlayingProbe = (fn) => { probe = fn; };
export const isPlaying = () => { try { return !!probe(); } catch (_) { return false; } };
export async function waitIdle() {
  while (isPlaying()) await new Promise((r) => setTimeout(r, 250));
}
