// Alpicut v1.9 — Kutup: Alpi-co'nun simgesi. Parlayan altın küre, hap gözler, başının üstünde dört köşeli yıldız.
// Hafifçe süzülür, arada göz kırpar, yıldızı parıldar (CSS animasyonları app.css'te: .kutup).
let n = 0;
export function kutupSVG({ mood = 'idle', cls = '' } = {}) {
  const id = `kt${++n}`;
  return `<svg class="kutup ${mood} ${cls}" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <radialGradient id="${id}g" cx="38%" cy="32%" r="70%">
      <stop offset="0" stop-color="#FFF6CC"/><stop offset=".38" stop-color="#FFD25A"/><stop offset=".78" stop-color="#E9A21F"/><stop offset="1" stop-color="#B8730F"/>
    </radialGradient>
    <radialGradient id="${id}h" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFD25A" stop-opacity=".55"/><stop offset="1" stop-color="#FFD25A" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="kt-body">
    <circle cx="32" cy="38" r="25" fill="url(#${id}h)"/>
    <circle cx="32" cy="38" r="17" fill="url(#${id}g)"/>
    <ellipse cx="26" cy="31" rx="5" ry="3" fill="#FFFBEA" opacity=".55" transform="rotate(-25 26 31)"/>
    <g class="kt-eyes" fill="#2B1E17"><rect x="25.2" y="34" width="3.6" height="8" rx="1.8"/><rect x="35.2" y="34" width="3.6" height="8" rx="1.8"/></g>
  </g>
  <path class="kt-star" d="M32 4.5c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z" fill="#FFE58A"/>
</svg>`;
}

// Dışa aktarma gibi doğru anlarda Kutup'tan kısa bir ipucu (projeye göre)
export function kutupTip(P, dur) {
  const tips = [];
  const vertical = P.ratio === '9:16';
  const hasSubs = !!P.subs?.cues?.length;
  const hasMusic = (P.audio || []).some((a) => a.role !== 'voice' && !a.sfx);
  if (vertical && dur > 60) tips.push(`Video ${Math.round(dur)} sn. Shorts ve Reels için 60 saniyenin altı daha çok izlenir.`);
  if (!hasSubs) tips.push('Altyazı yok. İzleyenlerin çoğu sesi kapalı izliyor; otomatik altyazı 1 dakikanı alır.');
  if (!hasMusic && dur > 8) tips.push('Arkada müzik yok. Hafif bir müzik izlenme süresini artırır.');
  if (!P.coverThumb) tips.push('Kapak seçmedin. Dikkat çeken bir kapak tıklanmayı ciddi artırır.');
  if (!tips.length) tips.push('Her şey hazır görünüyor. Dışa aktarırken telefonu kilitleme, daha hızlı biter.');
  return tips[0];
}
