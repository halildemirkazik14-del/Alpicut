// Alpicut v1.8 — Geri sayım stüdyosu: yapay zekâ, sci-fi, film başlangıcı, 80'ler, minimal, flip saat, neon, tarihi, eski TV
import {
  F, UI, SERIF, DISPLAY, MONO, COND, clamp, roundRect, easeOut, easeOut5, easeIO, back, spring, lerp, hash, seg, hexA, mixHex,
  spaced, glow, grain, scanlines, pixelText, twinkle, strokeReveal, circlePts,
} from './motionkit.js';

// sayaç durumu: hangi rakam, rakamın içindeki ilerleme, bitiş yazısı aşaması
function cd(L, lt) {
  const from = Math.max(1, Math.round(+L.from || 3)), ev = Math.max(0.3, +L.every || 1);
  const i = Math.floor(lt / ev);
  if (i >= from) return { done: true, p: 0, n: 0, fp: seg(lt, from * ev, from * ev + 0.6), t: lt - from * ev, from, ev };
  return { done: false, n: from - i, p: (lt - i * ev) / ev, from, ev, idx: i };
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

export const CD_FIELDS = {
  cd_ai: ['from', 'every', 'text', 'sub', 'accent', 'accent2'],
  cd_scifi: ['from', 'every', 'text', 'sub', 'accent'],
  cd_film: ['from', 'every', 'text', 'accent'],
  cd_synth: ['from', 'every', 'text', 'accent', 'accent2'],
  cd_minimal: ['from', 'every', 'text', 'sub', 'color', 'accent'],
  cd_flip: ['from', 'every', 'text', 'accent', 'color'],
  cd_neon: ['from', 'every', 'text', 'accent'],
  cd_roman: ['from', 'every', 'text', 'sub', 'accent'],
  cd_crt: ['from', 'every', 'text', 'accent'],
  cd_slam: ['from', 'every', 'text', 'accent', 'color'],
  cd_ring: ['from', 'every', 'text', 'sub', 'accent', 'color'],
  cd_arcade: ['from', 'every', 'text', 'accent'],
};
export const CD_META = {
  every: { label: 'Her sayı (sn)', type: 'range', min: 0.3, max: 3, step: 0.05 },
  from: { label: 'Kaçtan başlasın', type: 'number' },
  text: { label: 'Bitiş yazısı', type: 'text' },
};

export const CD_DRAW = {
  // ---------- Yapay zekâ: nöral halka, akan veri, "başlatılıyor" ----------
  cd_ai(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#8B5CF6', b = L.accent2 || '#22D3EE', c = cd(L, lt), R = 300;
    // nöral düğümler (arka)
    ctx.save();
    const nodes = 26;
    for (let i = 0; i < nodes; i++) {
      const ang = hash(i) * Math.PI * 2 + lt * (0.1 + hash(i + 7) * 0.2), rr = R * (1.25 + hash(i + 3) * 0.6);
      const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr * 0.92;
      for (let j = i + 1; j < Math.min(nodes, i + 4); j++) {
        const ang2 = hash(j) * Math.PI * 2 + lt * (0.1 + hash(j + 7) * 0.2), rr2 = R * (1.25 + hash(j + 3) * 0.6);
        const x2 = Math.cos(ang2) * rr2, y2 = Math.sin(ang2) * rr2 * 0.92;
        const pulse = 0.5 + 0.5 * Math.sin(lt * 4 + i + j);
        ctx.strokeStyle = hexA(j % 2 ? a : b, 0.08 + 0.18 * pulse); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.fillStyle = hexA(i % 2 ? a : b, 0.6); ctx.beginPath(); ctx.arc(x, y, 5 + 3 * hash(i + 11), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // halka
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexA('#FFFFFF', 0.08); ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 60; k++) { const an = (k / 60) * Math.PI * 2; ctx.strokeStyle = hexA('#FFFFFF', k % 5 ? 0.12 : 0.3); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(Math.cos(an) * (R + 26), Math.sin(an) * (R + 26)); ctx.lineTo(Math.cos(an) * (R + (k % 5 ? 36 : 46)), Math.sin(an) * (R + (k % 5 ? 36 : 46))); ctx.stroke(); }
    const prog = c.done ? 1 : 1 - c.p;
    const g = ctx.createLinearGradient(-R, -R, R, R); g.addColorStop(0, a); g.addColorStop(1, b);
    glow(ctx, a, 30, S, () => { ctx.strokeStyle = g; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke(); });
    // dönen yay
    ctx.strokeStyle = hexA(b, 0.7); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R - 40, lt * 2.2, lt * 2.2 + 1.1); ctx.stroke();
    ctx.strokeStyle = hexA(a, 0.5); ctx.beginPath(); ctx.arc(0, 0, R - 40, -lt * 1.6 + 3, -lt * 1.6 + 3.7); ctx.stroke();
    ctx.textAlign = 'center';
    if (!c.done) {
      const ip = easeOut5(c.p / 0.35), sc = 1.25 - 0.25 * ip;
      ctx.save(); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(ip * 1.4) * (1 - seg(c.p, 0.85, 1));
      ctx.font = F(300, 300, MONO);
      glow(ctx, b, 40, S, () => { ctx.fillStyle = '#FFFFFF'; ctx.fillText(String(c.n), 0, 105); });
      ctx.restore();
    } else {
      const p = easeOut(c.fp);
      ctx.save(); ctx.globalAlpha *= p; ctx.font = F(700, 96, UI);
      glow(ctx, a, 36, S, () => { ctx.fillStyle = '#FFFFFF'; spaced(ctx, L.text || 'BAŞLA', 0, 34, 10 * p); });
      ctx.restore();
    }
    ctx.font = F(500, 30, MONO); ctx.fillStyle = hexA('#FFFFFF', 0.65);
    const dots = '.'.repeat(1 + (Math.floor(lt * 3) % 3));
    spaced(ctx, `${L.sub || 'SİSTEM BAŞLATILIYOR'}${c.done ? '' : dots}`, 0, R + 120, 6);
    const pct = c.done ? 100 : Math.round(((c.idx + c.p) / c.from) * 100);
    ctx.fillStyle = hexA(b, 0.9); ctx.font = F(600, 28, MONO); ctx.fillText(`${pct}%`, 0, R + 170);
    ctx.textAlign = 'left';
    return { w: 1000, h: 1000 };
  },

  // ---------- Sci-fi HUD: altıgen çerçeve, dönen halkalar, tarama ----------
  cd_scifi(ctx, L, lt, env) {
    const S = env.S, a = L.accent || '#38BDF8', c = cd(L, lt), R = 260;
    ctx.lineCap = 'butt';
    const hex = (r, rot) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = rot + i * Math.PI / 3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); };
    const intro = easeOut5(seg(lt, 0, 0.5));
    ctx.save(); ctx.scale(lerp(0.85, 1, intro), lerp(0.85, 1, intro)); ctx.globalAlpha *= intro;
    glow(ctx, a, 26, S, () => { ctx.strokeStyle = hexA(a, 0.9); ctx.lineWidth = 5; hex(R + 60, Math.PI / 6); ctx.stroke(); });
    ctx.setLineDash([18, 12]); ctx.strokeStyle = hexA(a, 0.45); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R + 10, lt * 0.8, lt * 0.8 + Math.PI * 1.7); ctx.stroke();
    ctx.setLineDash([4, 10]); ctx.beginPath(); ctx.arc(0, 0, R - 30, -lt * 1.3, -lt * 1.3 + Math.PI * 1.3); ctx.stroke(); ctx.setLineDash([]);
    // köşe parantezleri
    ctx.strokeStyle = a; ctx.lineWidth = 6;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { const X = sx * (R + 150), Y = sy * (R + 120); ctx.beginPath(); ctx.moveTo(X, Y - sy * 60); ctx.lineTo(X, Y); ctx.lineTo(X - sx * 60, Y); ctx.stroke(); });
    // tarama
    const sy = Math.sin(lt * 2.2) * R;
    const gr = ctx.createLinearGradient(0, sy - 40, 0, sy + 4); gr.addColorStop(0, hexA(a, 0)); gr.addColorStop(1, hexA(a, 0.35));
    ctx.save(); hex(R + 56, Math.PI / 6); ctx.clip(); ctx.fillStyle = gr; ctx.fillRect(-R - 80, sy - 40, R * 2 + 160, 44); ctx.fillStyle = hexA(a, 0.8); ctx.fillRect(-R - 80, sy, R * 2 + 160, 2); ctx.restore();
    ctx.restore();
    ctx.textAlign = 'center';
    if (!c.done) {
      const flick = c.p < 0.12 ? (hash(Math.floor(lt * 40)) > 0.4 ? 1 : 0.2) : 1;
      ctx.save(); ctx.globalAlpha *= flick; ctx.font = F(400, 330, COND);
      const off = c.p < 0.15 ? (hash(lt * 99) - 0.5) * 30 : 0;
      ctx.fillStyle = hexA('#FF3B6B', 0.6); ctx.fillText(String(c.n).padStart(2, '0'), off - 6, 118);
      ctx.fillStyle = hexA('#3BF0FF', 0.6); ctx.fillText(String(c.n).padStart(2, '0'), -off + 6, 118);
      glow(ctx, a, 30, S, () => { ctx.fillStyle = '#EFFFFF'; ctx.fillText(String(c.n).padStart(2, '0'), off * 0.3, 118); });
      ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha *= easeOut(c.fp); ctx.font = F(400, 150, COND);
      glow(ctx, a, 30, S, () => { ctx.fillStyle = '#EFFFFF'; spaced(ctx, L.text || 'HAZIR', 0, 52, 14); });
      ctx.restore();
    }
    ctx.font = F(500, 26, MONO); ctx.fillStyle = hexA(a, 0.85);
    ctx.textAlign = 'left'; ctx.fillText(`T-${String(c.done ? 0 : c.n).padStart(2, '0')}:${String(Math.floor((c.done ? 0 : 1 - c.p) * 99)).padStart(2, '0')}`, -R - 140, -R - 70);
    ctx.textAlign = 'right'; ctx.fillText(L.sub || 'FIRLATMA SIRASI', R + 140, -R - 70);
    ctx.textAlign = 'left';
    return { w: 1000, h: 900 };
  },

  // ---------- Film başlangıcı (Academy leader): dönen ibre, nişangah, gren ----------
  cd_film(ctx, L, lt, env) {
    const c = cd(L, lt), W = 960, H = 720, a = L.accent || '#D9D2C3';
    const jit = (hash(Math.floor(lt * 18)) - 0.5) * 6;
    ctx.save(); ctx.translate(jit, jit * 0.5);
    ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); ctx.clip();
    ctx.fillStyle = '#1A1714'; ctx.fillRect(-W / 2, -H / 2, W, H);
    if (!c.done) {
      // taranan dilim
      ctx.fillStyle = '#3A342D'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 900, -Math.PI / 2, -Math.PI / 2 + c.p * Math.PI * 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#0D0B09'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); const an = -Math.PI / 2 + c.p * Math.PI * 2; ctx.lineTo(Math.cos(an) * 900, Math.sin(an) * 900); ctx.stroke();
    } else { ctx.fillStyle = '#0D0B09'; ctx.fillRect(-W / 2, -H / 2, W, H); }
    ctx.strokeStyle = a; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-W / 2, 0); ctx.lineTo(W / 2, 0); ctx.moveTo(0, -H / 2); ctx.lineTo(0, H / 2); ctx.stroke();
    ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 250, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 300, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center';
    if (!c.done) { ctx.fillStyle = '#F4EFE4'; ctx.font = F(700, 340, SERIF); ctx.fillText(String(c.n), 0, 120); } else {
      ctx.globalAlpha *= easeOut(c.fp); ctx.fillStyle = '#F4EFE4'; ctx.font = F(600, 110, SERIF, true); ctx.fillText(L.text || 'Başlıyoruz', 0, 38);
    }
    ctx.textAlign = 'left';
    grain(ctx, W, H, lt, 0.12, 5);
    // çizik ve toz
    const f = Math.floor(lt * 24);
    if (hash(f) > 0.55) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-W / 2 + hash(f + 1) * W, -H / 2, 2, H); }
    for (let i = 0; i < 6; i++) if (hash(f * 3 + i) > 0.7) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(-W / 2 + hash(f + i * 5) * W, -H / 2 + hash(f + i * 9) * H, 2 + hash(i + f) * 5, 0, Math.PI * 2); ctx.fill(); }
    // vinyet
    const vg = ctx.createRadialGradient(0, 0, H * 0.3, 0, 0, W * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)');
    ctx.fillStyle = vg; ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.restore();
    return { w: W, h: H };
  },

  // ---------- 80'ler synthwave: ızgara, güneş, krom rakam ----------
  cd_synth(ctx, L, lt, env) {
    const S = env.S, c = cd(L, lt), W = 980, H = 820, a = L.accent || '#FF2E97', b = L.accent2 || '#2DE2E6';
    ctx.save(); roundRect(ctx, -W / 2, -H / 2, W, H, 28); ctx.clip();
    const sky = ctx.createLinearGradient(0, -H / 2, 0, 60); sky.addColorStop(0, '#0B0420'); sky.addColorStop(0.6, '#2A0B4E'); sky.addColorStop(1, '#5B1468');
    ctx.fillStyle = sky; ctx.fillRect(-W / 2, -H / 2, W, H);
    // güneş
    const sg = ctx.createLinearGradient(0, -200, 0, 60); sg.addColorStop(0, '#FFE259'); sg.addColorStop(0.5, '#FF7E5F'); sg.addColorStop(1, a);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 40, 230, Math.PI, 0); ctx.closePath(); ctx.clip();
    ctx.fillStyle = sg; ctx.fillRect(-240, -200, 480, 260);
    ctx.fillStyle = '#2A0B4E'; for (let i = 0; i < 7; i++) { const y = -20 + i * 13 + ((lt * 30) % 13); ctx.fillRect(-240, y, 480, 3 + i * 1.3); }
    ctx.restore();
    // zemin ızgarası
    ctx.fillStyle = '#0B0420'; ctx.fillRect(-W / 2, 40, W, H / 2);
    ctx.strokeStyle = hexA(b, 0.85); ctx.lineWidth = 2.5;
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(i * 30, 40); ctx.lineTo(i * 160, H / 2); ctx.stroke(); }
    for (let k = 0; k < 10; k++) { const z = ((k + (lt * 1.6) % 1) / 10); const y = 40 + Math.pow(z, 2.2) * (H / 2 - 40); ctx.globalAlpha = 0.25 + z * 0.75; ctx.beginPath(); ctx.moveTo(-W / 2, y); ctx.lineTo(W / 2, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.textAlign = 'center';
    const chrome = (y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.45, '#9AD8FF'); g.addColorStop(0.5, '#2B1B5A'); g.addColorStop(0.62, '#FF9AE0'); g.addColorStop(1, '#FFFFFF'); return g; };
    if (!c.done) {
      const p = back(seg(c.p, 0, 0.3)); ctx.save(); ctx.translate(0, -60); ctx.scale(p, p); ctx.font = F(400, 330, COND);
      ctx.fillStyle = a; ctx.fillText(String(c.n), 8, 110 + 8);
      glow(ctx, a, 24, S, () => { ctx.fillStyle = chrome(-150, 110); ctx.fillText(String(c.n), 0, 110); });
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(0, -60); ctx.globalAlpha *= easeOut(c.fp); ctx.font = F(400, 170, COND); ctx.fillStyle = a; ctx.fillText(L.text || 'GO!', 6, 66);
      glow(ctx, b, 24, S, () => { ctx.fillStyle = chrome(-70, 66); ctx.fillText(L.text || 'GO!', 0, 60); }); ctx.restore();
    }
    ctx.textAlign = 'left';
    return { w: W, h: H };
  },

  // ---------- Minimal: ince rakam, çizgi azalan halka ----------
  cd_minimal(ctx, L, lt, env) {
    const c = cd(L, lt), col = L.color || '#FFFFFF', a = L.accent || '#C9A27E', R = 230;
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexA(col, 0.18); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    if (!c.done) { ctx.strokeStyle = a; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + (1 - easeIO(c.p)) * Math.PI * 2); ctx.stroke(); }
    ctx.textAlign = 'center';
    if (!c.done) {
      const ip = easeOut5(seg(c.p, 0, 0.4)), op = 1 - seg(c.p, 0.8, 1);
      ctx.save(); ctx.globalAlpha *= ip * op; ctx.translate(0, (1 - ip) * 40); ctx.fillStyle = col; ctx.font = F(200, 240, UI); ctx.fillText(String(c.n), 0, 84); ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha *= easeOut(c.fp); ctx.fillStyle = col; ctx.font = F(300, 70, UI); spaced(ctx, String(L.text || 'BAŞLIYOR').toLocaleUpperCase('tr-TR'), 0, 24, 18); ctx.restore();
    }
    if (L.sub) { ctx.fillStyle = hexA(col, 0.6); ctx.font = F(400, 30, UI); spaced(ctx, String(L.sub).toLocaleUpperCase('tr-TR'), 0, R + 90, 10); }
    ctx.textAlign = 'left';
    return { w: 700, h: 700 };
  },

  // ---------- Flip saat ----------
  cd_flip(ctx, L, lt, env) {
    const S = env.S, c = cd(L, lt), card = L.accent || '#1C1B22', col = L.color || '#F5F3EE';
    const w = 360, h = 460, r = 30;
    const shown = c.done ? (L.text || 'GO') : String(c.n);
    const prev = c.done ? '1' : String(c.n + 1 > c.from ? c.n : c.n + 1);
    const fp = c.done ? seg(c.t, 0, 0.35) : seg(c.p, 0, 0.35);
    const fs = c.done ? (String(shown).length > 2 ? 120 : 220) : 300;
    const half = (txt, top, sy = 1) => {
      ctx.save(); ctx.beginPath(); top ? ctx.rect(-w / 2, -h / 2, w, h / 2) : ctx.rect(-w / 2, 0, w, h / 2); ctx.clip();
      ctx.scale(1, sy);
      roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = card; ctx.fill();
      ctx.fillStyle = col; ctx.font = F(700, fs, UI); ctx.textAlign = 'center'; ctx.fillText(txt, 0, fs * 0.36); ctx.restore();
    };
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 50 * S; ctx.shadowOffsetY = 20 * S; roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = card; ctx.fill(); ctx.restore();
    half(shown, true); half(fp < 0.5 ? prev : shown, false);
    if (fp < 0.5) half(prev, true, Math.max(0.001, 1 - fp * 2)); else if (fp < 1) half(shown, false, Math.max(0.001, (fp - 0.5) * 2));
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-w / 2, -3, w, 6);
    ctx.fillStyle = hexA('#FFFFFF', 0.06); roundRect(ctx, -w / 2, -h / 2, w, h / 2, [r, r, 0, 0]); ctx.fill();
    [-1, 1].forEach((s) => { ctx.fillStyle = '#0A0A0D'; roundRect(ctx, s * (w / 2) - 8, -22, 16, 44, 6); ctx.fill(); });
    return { w: w + 80, h: h + 80 };
  },

  // ---------- Neon tabela ----------
  cd_neon(ctx, L, lt, env) {
    const S = env.S, c = cd(L, lt), a = L.accent || '#FF4FD8';
    const on = (k) => (seg(c.done ? c.t : c.p * (c.ev), 0, 0.25) < 1 ? (hash(Math.floor(lt * 30) + k) > 0.35 ? 1 : 0.15) : 1);
    ctx.save(); roundRect(ctx, -380, -330, 760, 660, 40); ctx.fillStyle = '#0D0A12'; ctx.fill();
    ctx.strokeStyle = hexA(a, 0.25); ctx.lineWidth = 3; roundRect(ctx, -350, -300, 700, 600, 30); ctx.stroke(); ctx.restore();
    ctx.textAlign = 'center';
    const txt = c.done ? (L.text || 'ŞİMDİ') : String(c.n);
    ctx.font = c.done ? F(700, 150, UI, true) : F(800, 380, UI, true);
    const fl = on(1);
    ctx.save(); ctx.globalAlpha *= fl;
    ctx.lineWidth = c.done ? 6 : 10; ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = a; ctx.shadowBlur = 60 * S; ctx.strokeText(txt, 0, c.done ? 52 : 130); ctx.shadowBlur = 20 * S; ctx.strokeStyle = mixHex(a, '#FFFFFF', 0.6); ctx.strokeText(txt, 0, c.done ? 52 : 130);
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= 0.18 * fl; const rg = ctx.createRadialGradient(0, 0, 10, 0, 0, 380); rg.addColorStop(0, a); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(-380, -330, 760, 660); ctx.restore();
    ctx.textAlign = 'left';
    return { w: 800, h: 700 };
  },

  // ---------- Tarihi: parşömen + Roma rakamı + mühür ----------
  cd_roman(ctx, L, lt, env) {
    const S = env.S, c = cd(L, lt), W = 820, H = 940, ink = '#3B2A1A', a = L.accent || '#8E1B1B';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 50 * S; ctx.shadowOffsetY = 20 * S;
    const pg = ctx.createRadialGradient(0, 0, 100, 0, 0, 700); pg.addColorStop(0, '#F1E3C4'); pg.addColorStop(1, '#C9AE7B');
    ctx.beginPath(); for (let i = 0; i <= 40; i++) { const x = -W / 2 + (i / 40) * W; ctx.lineTo(x, -H / 2 + (hash(i) - 0.5) * 16); } for (let i = 0; i <= 40; i++) { const y = -H / 2 + (i / 40) * H; ctx.lineTo(W / 2 + (hash(i + 50) - 0.5) * 16, y); }
    for (let i = 40; i >= 0; i--) { const x = -W / 2 + (i / 40) * W; ctx.lineTo(x, H / 2 + (hash(i + 90) - 0.5) * 16); } for (let i = 40; i >= 0; i--) { const y = -H / 2 + (i / 40) * H; ctx.lineTo(-W / 2 + (hash(i + 130) - 0.5) * 16, y); }
    ctx.closePath(); ctx.fillStyle = pg; ctx.fill(); ctx.restore();
    ctx.strokeStyle = hexA(ink, 0.5); ctx.lineWidth = 3; ctx.strokeRect(-W / 2 + 50, -H / 2 + 50, W - 100, H - 100); ctx.lineWidth = 1.5; ctx.strokeRect(-W / 2 + 64, -H / 2 + 64, W - 128, H - 128);
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA(ink, 0.75); ctx.font = F(600, 34, SERIF); spaced(ctx, (L.sub || 'ANNO DOMINI').toLocaleUpperCase('tr-TR'), 0, -H / 2 + 140, 12);
    if (!c.done) {
      const rv = easeOut(seg(c.p, 0, 0.45));
      ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -260, W * rv + 1, 420); ctx.clip();
      ctx.fillStyle = ink; ctx.font = F(700, 300, DISPLAY); ctx.fillText(ROMAN[c.n] || String(c.n), 0, 110); ctx.restore();
    } else {
      ctx.globalAlpha *= easeOut(c.fp); ctx.fillStyle = ink; ctx.font = F(700, 110, DISPLAY, true); ctx.fillText(L.text || 'Başla', 0, 40); ctx.globalAlpha = 1;
    }
    // mühür
    const sp = c.done ? back(seg(c.t, 0.15, 0.5)) : 0;
    if (sp > 0) {
      ctx.save(); ctx.translate(230, 320); ctx.scale(sp, sp); ctx.rotate(-0.2);
      ctx.fillStyle = a; ctx.beginPath(); for (let i = 0; i < 24; i++) { const rr = 92 + (i % 2 ? 6 : -4) + hash(i) * 6, an = (i / 24) * Math.PI * 2; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hexA('#000', 0.3); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = hexA('#FFE7C2', 0.85); ctx.font = F(700, 56, DISPLAY); ctx.fillText('A', 0, 20); ctx.restore();
    }
    ctx.textAlign = 'left';
    return { w: W + 40, h: H + 40 };
  },

  // ---------- Eski tüplü TV: açılış çizgisi, parazit, tarama ----------
  cd_crt(ctx, L, lt, env) {
    const S = env.S, c = cd(L, lt), W = 900, H = 700, a = L.accent || '#7CFFB2';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 50 * S; roundRect(ctx, -W / 2 - 40, -H / 2 - 40, W + 80, H + 80, 60); ctx.fillStyle = '#2B2622'; ctx.fill(); ctx.restore();
    ctx.save(); roundRect(ctx, -W / 2, -H / 2, W, H, 70); ctx.clip();
    ctx.fillStyle = '#060807'; ctx.fillRect(-W / 2, -H / 2, W, H);
    const on = easeOut(seg(lt, 0, 0.35));
    ctx.save(); ctx.scale(1, Math.max(0.006, on));
    const f = Math.floor(lt * 30);
    for (let i = 0; i < 1400; i++) { const r = hash(i * 7.1 + f); if (r > 0.6) { ctx.fillStyle = `rgba(200,255,220,${(r - 0.6) * 0.35})`; ctx.fillRect(-W / 2 + hash(i + f * 3) * W, -H / 2 + hash(i * 3 + f) * H, 4, 2); } }
    ctx.textAlign = 'center';
    const txt = c.done ? (L.text || 'YAYINDA') : String(c.n);
    ctx.font = c.done ? F(800, 130, MONO) : F(700, 360, MONO);
    const y = c.done ? 46 : 126;
    ctx.fillStyle = hexA('#FF3355', 0.55); ctx.fillText(txt, -5, y); ctx.fillStyle = hexA('#33AAFF', 0.55); ctx.fillText(txt, 5, y);
    glow(ctx, a, 30, S, () => { ctx.fillStyle = mixHex(a, '#FFFFFF', 0.5); ctx.fillText(txt, 0, y); });
    ctx.restore();
    scanlines(ctx, W, H, 0.3, 5);
    const roll = ((lt * 0.35) % 1) * H - H / 2; ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(-W / 2, roll, W, 60);
    const vg = ctx.createRadialGradient(0, 0, H * 0.25, 0, 0, W * 0.65); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)'); ctx.fillStyle = vg; ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.restore();
    ctx.textAlign = 'left';
    return { w: W + 100, h: H + 100 };
  },

  // ---------- Sert vuruş: rakam çarpar, sarsılır, parçacık ----------
  cd_slam(ctx, L, lt, env) {
    const S = env.S, c = cd(L, lt), a = L.accent || '#F43F5E', col = L.color || '#FFFFFF';
    const p = c.done ? seg(c.t, 0, 0.4) : seg(c.p, 0, 0.25);
    const shake = (1 - p) * 18 * (p > 0 ? 1 : 0);
    ctx.save(); ctx.translate((hash(lt * 50) - 0.5) * shake, (hash(lt * 70) - 0.5) * shake);
    // şok halkası
    const rp = easeOut(p);
    ctx.strokeStyle = hexA(a, 1 - rp); ctx.lineWidth = 20 * (1 - rp) + 2; ctx.beginPath(); ctx.arc(0, 0, 120 + rp * 360, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 14; i++) { const an = (i / 14) * Math.PI * 2 + 0.3, r0 = 180 + rp * 200, r1 = r0 + 80 * (1 - rp); ctx.strokeStyle = hexA(i % 2 ? a : col, 1 - rp); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke(); }
    const sc = lerp(2.4, 1, easeOut5(p));
    ctx.scale(sc, sc); ctx.textAlign = 'center';
    const txt = c.done ? (L.text || 'HADİ!') : String(c.n);
    ctx.font = c.done ? F(400, 220, COND) : F(400, 420, COND);
    const y = c.done ? 78 : 148;
    ctx.fillStyle = a; ctx.fillText(txt, 10, y + 10);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30 * S; ctx.fillStyle = col; ctx.fillText(txt, 0, y); ctx.restore();
    ctx.restore(); ctx.textAlign = 'left';
    return { w: 900, h: 900 };
  },

  // ---------- Halka + kalan saniye yazısı (sade, kurumsal) ----------
  cd_ring(ctx, L, lt, env) {
    const S = env.S, c = cd(L, lt), a = L.accent || '#8B5E3C', col = L.color || '#2B1E17', R = 210;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 14 * S; ctx.beginPath(); ctx.arc(0, 0, R + 60, 0, Math.PI * 2); ctx.fillStyle = '#FBF8F3'; ctx.fill(); ctx.restore();
    ctx.lineCap = 'round'; ctx.strokeStyle = hexA(a, 0.15); ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    const total = c.from * c.ev, el = Math.min(total, lt), pr = 1 - el / total;
    ctx.strokeStyle = a; ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.max(0.0001, pr) * Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = col;
    if (!c.done) { const ip = easeOut5(seg(c.p, 0, 0.3)); ctx.save(); ctx.globalAlpha *= ip; ctx.font = F(700, 200, UI); ctx.fillText(String(c.n), 0, 70); ctx.restore(); }
    else { ctx.save(); ctx.globalAlpha *= easeOut(c.fp); ctx.font = F(700, 64, UI); ctx.fillText(L.text || 'Hazır!', 0, 22); ctx.restore(); }
    ctx.fillStyle = hexA(col, 0.55); ctx.font = F(600, 26, UI); spaced(ctx, (L.sub || 'SANİYE').toLocaleUpperCase('tr-TR'), 0, c.done ? 70 : 128, 8);
    ctx.textAlign = 'left';
    return { w: 620, h: 620 };
  },

  // ---------- Arcade: 8-bit piksel rakam, "PRESS START" ----------
  cd_arcade(ctx, L, lt, env) {
    const S = env.S, c = cd(L, lt), a = L.accent || '#FFD23F', W = 900, H = 760;
    ctx.save(); roundRect(ctx, -W / 2, -H / 2, W, H, 20); ctx.fillStyle = '#0A0A1F'; ctx.fill(); ctx.clip();
    for (let i = 0; i < 60; i++) { const tw = 0.5 + 0.5 * Math.sin(lt * 3 + i); ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.5 * tw * hash(i)})`; ctx.fillRect(-W / 2 + hash(i) * W, -H / 2 + hash(i + 40) * H, 4, 4); }
    pixelText(ctx, 'PLAYER 1', -W / 2 + 40, -H / 2 + 70, 5, '#FF4D6D', 'left');
    pixelText(ctx, `HI ${String(Math.floor(lt * 1234) % 99999).padStart(5, '0')}`, W / 2 - 40, -H / 2 + 70, 5, '#FFFFFF', 'right');
    const txt = c.done ? (L.text || 'GO!') : String(c.n);
    const px = c.done ? 22 : 40;
    const bounce = c.done ? 0 : Math.abs(Math.sin(c.p * Math.PI)) * -20 * (1 - c.p);
    ctx.save(); ctx.translate(0, bounce);
    pixelText(ctx, txt, 10, px * 4.2 + 10, px, '#7A3E00');
    glow(ctx, a, 20, S, () => pixelText(ctx, txt, 0, px * 4.2, px, a));
    ctx.restore();
    if (Math.floor(lt * 2.5) % 2 === 0) pixelText(ctx, c.done ? 'GOOD LUCK' : 'GET READY', 0, H / 2 - 70, 7, '#FFFFFF');
    scanlines(ctx, W, H, 0.22, 6);
    ctx.restore();
    return { w: W, h: H };
  },
};

// ---------- hazır şablonlar ----------
const A = (i = 'none', o = 'fade') => ({ in: i, out: o, inDur: 0.4, outDur: 0.4 });
const T = [];
const add = (id, name, type, p, dur) => T.push({ id, name, cat: 'Geri sayım', p: { type, y: 0.5, anim: A(), ...p }, dur });
const durOf = (from, ev = 1) => from * ev + 1.4;
[
  ['ai', 'Yapay zekâ', 'cd_ai', [['', {}], ['Turuncu', { accent: '#F97316', accent2: '#FACC15', sub: 'MODEL YÜKLENİYOR' }], ['Yeşil', { accent: '#10B981', accent2: '#A3E635', sub: 'VERİ İŞLENİYOR' }], ['Buz', { accent: '#60A5FA', accent2: '#E0F2FE', sub: 'NÖRAL AĞ HAZIRLANIYOR' }]]],
  ['scifi', 'Sci-fi HUD', 'cd_scifi', [['', {}], ['Kırmızı alarm', { accent: '#F43F5E', sub: 'İMHA SIRASI', text: 'ATEŞ' }], ['Yeşil', { accent: '#4ADE80', sub: 'KALKIŞ', text: 'KALKIŞ' }], ['Amber', { accent: '#F59E0B', sub: 'SİSTEM KONTROLÜ' }]]],
  ['film', 'Film başlangıcı', 'cd_film', [['', {}], ['Sıcak', { accent: '#E8C79A', text: 'Perde' }]]],
  ['synth', '80\'ler synthwave', 'cd_synth', [['', {}], ['Mor-turuncu', { accent: '#FF6B35', accent2: '#B967FF' }], ['Gece mavisi', { accent: '#3D5AFE', accent2: '#00F5D4' }]]],
  ['minimal', 'Minimal', 'cd_minimal', [['', {}], ['Altın', { accent: '#D4AF37', sub: 'Hazır mısın?' }], ['Siyah', { color: '#111111', accent: '#111111' }], ['Latte', { color: '#2B1E17', accent: '#8B5E3C', sub: 'Az kaldı' }]]],
  ['flip', 'Flip saat', 'cd_flip', [['', {}], ['Krem', { accent: '#F1EADF', color: '#2B1E17' }], ['Kırmızı', { accent: '#B91C1C', color: '#FFFFFF' }]]],
  ['neon', 'Neon tabela', 'cd_neon', [['', {}], ['Mavi neon', { accent: '#22D3EE' }], ['Yeşil neon', { accent: '#4ADE80' }], ['Turuncu neon', { accent: '#FB923C' }]]],
  ['roman', 'Tarihi (Roma)', 'cd_roman', [['', {}], ['Lacivert mühür', { accent: '#1E3A8A', sub: 'FERMAN' }]]],
  ['crt', 'Eski tüplü TV', 'cd_crt', [['', {}], ['Amber', { accent: '#FFB000' }], ['Beyaz', { accent: '#E5E7EB' }]]],
  ['slam', 'Sert vuruş', 'cd_slam', [['', {}], ['Sarı', { accent: '#FACC15', color: '#111111' }], ['Mor', { accent: '#8B5CF6' }]]],
  ['ring', 'Kurumsal halka', 'cd_ring', [['', {}], ['Lacivert', { accent: '#1E3A8A', color: '#0F172A' }], ['Yeşil', { accent: '#047857', color: '#052E16' }]]],
  ['arcade', 'Arcade 8-bit', 'cd_arcade', [['', {}], ['Pembe', { accent: '#FF5DA2' }], ['Yeşil', { accent: '#5CFF5C' }]]],
].forEach(([key, name, type, vars]) => {
  vars.forEach(([vn, over], vi) => {
    [3, 5, 10].forEach((from) => {
      if (vi > 0 && from === 10) return; // varyasyonlarda 10'dan sayım yalnızca ana stilde
      const ev = from === 10 ? 0.8 : 1;
      add(`cd_${key}${vi ? `_${vi}` : ''}_${from}`, `${name}${vn ? ` · ${vn}` : ''} · ${from}`, type, { from, every: ev, ...over }, durOf(from, ev));
    });
  });
});
export const CD_TEMPLATES = T;
