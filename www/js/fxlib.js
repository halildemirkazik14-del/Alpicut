// Alpicut — efekt kataloğu, ayarlama katmanı ve çıkartmalar
import { getGrader, gradeParams, FX_SHADER } from './gl.js';
import { roundRect, animState, clamp } from './render.js';
import { GL_FX, PARTICLE_FX, applyGLFx, drawParticleFx } from './fxgl.js';

// [id, ad, kategori, tür]
export const FX_LIST = [
  ['shake', 'Kamera sarsıntısı', 'Hareket', 'motion'],
  ['zoompulse', 'Zoom nabzı', 'Hareket', 'motion'],
  ['punch', 'Darbe zoom', 'Hareket', 'motion'],
  ['wobble', 'Sallanma', 'Hareket', 'motion'],
  ['beatzoom', 'Ritim zoom', 'Ritim', 'motion'],
  ['beatflash', 'Ritim flaş', 'Ritim', '2d'],
  ['beatshake', 'Ritim sarsıntı', 'Ritim', 'motion'],
  ['rgb', 'RGB kayması', 'Bozulma', 'shader'],
  ['glitch', 'Glitch', 'Bozulma', 'shader'],
  ['vhs', 'VHS', 'Bozulma', 'shader'],
  ['pixel', 'Piksel', 'Bozulma', 'shader'],
  ['noise', 'Dijital gürültü', 'Bozulma', 'shader'],
  ['flash', 'Beyaz flaş', 'Işık', '2d'],
  ['leak', 'Işık sızıntısı', 'Işık', '2d'],
  ['bloom', 'Parlama (bloom)', 'Işık', '2d'],
  ['fadeblack', 'Karararak bitir', 'Işık', '2d'],
  ['bwpop', 'Siyah-beyaz pop', 'Stil', 'shader'],
  ['poster', 'Posterize', 'Stil', 'shader'],
  ['invert', 'Negatif', 'Stil', 'shader'],
  ['mirror', 'Ayna', 'Stil', 'shader'],
  ['film', 'Eski film', 'Stil', '2d'],
  ['cinema', 'Sinema şeridi', 'Stil', '2d'],
];
const GL_CAT = { chroma: 'Bozulma', blockglitch: 'Bozulma', sliceglitch: 'Bozulma', oldtv: 'Retro', crt: 'Retro', sepia: 'Retro', dither: 'Retro', halftone: 'Sanat', sketch: 'Sanat', cartoon: 'Sanat', emboss: 'Sanat', neonedge: 'Sanat', duotone: 'Sanat', thermal: 'Kamera', nightvision: 'Kamera', fisheye: 'Kamera', tiltshift: 'Bulanıklık', zoomblur: 'Bulanıklık', motionblur: 'Bulanıklık', dream: 'Işık', swirl: 'Bozulma', kaleido: 'Ekran', quad: 'Ekran', split3: 'Ekran', ripple: 'Bozulma', heatwave: 'Bozulma', vigpulse: 'Işık', rainbow: 'Işık', strobe: 'Işık', dolly: 'Hareket' };
const P_CAT = { snow: 'Parçacık', rain: 'Parçacık', confetti: 'Parçacık', sparkle: 'Parçacık', hearts: 'Parçacık', bubbles: 'Parçacık', embers: 'Parçacık', glitter: 'Parçacık', money: 'Parçacık', ballrain: 'Parçacık', firerain: 'Parçacık', stars: 'Parçacık', rays: 'Işık', flare: 'Işık', bokeh: 'Işık', lightning: 'Işık', dust: 'Retro', grain: 'Retro', scanlines: 'Retro', shutter: 'Kamera', rec: 'Kamera', letterbox: 'Çerçeve', spotlight: 'Çerçeve', vignette: 'Çerçeve', frame: 'Çerçeve', redpulse: 'Işık', speedlines: 'Hareket', zoomlines: 'Hareket' };
Object.entries(GL_FX).forEach(([id, [, n]]) => FX_LIST.push([id, n, GL_CAT[id] || 'Stil', 'gl2']));
Object.entries(PARTICLE_FX).forEach(([id, n]) => FX_LIST.push([id, n, P_CAT[id] || 'Parçacık', 'p2']));
export const FX_CATS = ['Hareket', 'Ritim', 'Parçacık', 'Işık', 'Bozulma', 'Retro', 'Sanat', 'Kamera', 'Ekran', 'Bulanıklık', 'Çerçeve', 'Stil'];

function lastBeat(markers, t) {
  let b = null;
  if (!markers) return null;
  for (const m of markers) { if (m.kind === 'beat' && m.t <= t + 1e-3) b = m.t; }
  return b;
}

// Kompozisyonun o ana kadarki haline efekt/ayar uygula
export function applyLayerFx(ctx, L, t, env, markers) {
  const { W, H, S } = env;
  const st = animState(L, t, W, H);
  const amt = clamp((L.amount ?? 1) * st.alpha, 0, 2);
  if (amt <= 0.001) return;
  const cv = ctx.canvas;
  const g = getGrader();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (L.kind === 'adjust') {
    const p = gradeParams(L);
    if (p && g) {
      const out = g.process(cv, cv.width, cv.height, p);
      if (out) { ctx.globalAlpha = clamp(amt); ctx.drawImage(out, 0, 0); }
    }
    ctx.restore();
    return;
  }
  const id = L.effect;
  const lt = t - L.start;
  const sp = L.speed ?? 1;
  const lb = lastBeat(markers, t);
  const sinceBeat = lb == null ? 99 : t - lb;
  let shader = null;
  const p = { fx: 0, fxAmt: Math.min(1, amt), time: t, zoom: 1, rot: 0, offX: 0, offY: 0 };
  switch (id) {
    case 'shake': case 'beatshake': {
      const k = id === 'beatshake' ? Math.exp(-sinceBeat * 9) : 1;
      const n = (a, f) => Math.sin(t * f * sp) * 0.6 + Math.sin(t * f * 1.7 * sp + a) * 0.4;
      p.offX = n(1, 31) * 0.012 * amt * k; p.offY = n(2, 27) * 0.012 * amt * k; p.rot = n(3, 19) * 0.012 * amt * k; p.zoom = 1 + 0.04 * amt * k;
      shader = p; break;
    }
    case 'zoompulse': p.zoom = 1 + 0.06 * amt * (0.5 + 0.5 * Math.sin(lt * Math.PI * 2 * sp)); shader = p; break;
    case 'punch': p.zoom = 1 + 0.3 * amt * Math.exp(-lt * 6 * sp); shader = p; break;
    case 'wobble': p.rot = Math.sin(lt * Math.PI * 1.6 * sp) * 0.035 * amt; p.zoom = 1.06; shader = p; break;
    case 'beatzoom': p.zoom = 1 + 0.14 * amt * Math.exp(-sinceBeat * 10); shader = p; break;
    case 'rgb': case 'glitch': case 'vhs': case 'pixel': case 'noise': case 'bwpop': case 'poster': case 'invert': case 'mirror':
      p.fx = FX_SHADER[id]; shader = p; break;
    case 'film': p.fx = FX_SHADER.noise; p.fxAmt = 0.35 * Math.min(1, amt); shader = p; break;
  }
  if (GL_FX[id]) { ctx.restore(); applyGLFx(ctx, id, lt, amt, L); return; }
  if (PARTICLE_FX[id]) { ctx.setTransform(S, 0, 0, S, 0, 0); drawParticleFx(ctx, id, lt, env, Math.min(1.5, amt), L); ctx.restore(); return; }
  if (shader && g) {
    const out = g.process(cv, cv.width, cv.height, shader);
    if (out) { ctx.fillStyle = '#000'; if (shader.zoom < 1 || shader.offX || shader.rot) ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(out, 0, 0); }
  }
  ctx.setTransform(S, 0, 0, S, 0, 0);
  switch (id) {
    case 'flash': { const a = amt * Math.exp(-lt * 5 * sp); ctx.fillStyle = `rgba(255,255,255,${clamp(a)})`; ctx.fillRect(0, 0, W, H); break; }
    case 'beatflash': { const a = 0.7 * amt * Math.exp(-sinceBeat * 12); ctx.fillStyle = `rgba(255,255,255,${clamp(a)})`; ctx.fillRect(0, 0, W, H); break; }
    case 'leak': {
      ctx.globalCompositeOperation = 'screen';
      const x = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(lt * 0.9 * sp))), y = H * (0.3 + 0.2 * Math.sin(lt * 0.6 * sp + 1));
      const gr = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.7);
      gr.addColorStop(0, `rgba(255,170,80,${0.75 * amt})`); gr.addColorStop(0.4, `rgba(255,80,120,${0.35 * amt})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'bloom': {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp(0.55 * amt);
      ctx.filter = `blur(${24 * S}px) brightness(1.2)`;
      ctx.drawImage(cv, 0, 0);
      break;
    }
    case 'fadeblack': { const dur = Math.max(0.1, L.end - L.start); ctx.fillStyle = `rgba(0,0,0,${clamp(lt / dur) * amt})`; ctx.fillRect(0, 0, W, H); break; }
    case 'film': {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(255,225,180,${0.35 * amt})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${0.7 * amt})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      if (Math.random() < 0.08) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(Math.random() * W, 0, 2, H); }
      break;
    }
    case 'cinema': { const bh = H * 0.11 * Math.min(1, amt); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh); break; }
  }
  ctx.restore();
}

// ---------- Çıkartmalar ----------
export const STICKER_EMOJI = ['⚽', '🔥', '😱', '👀', '💯', '🏆', '👏', '😂', '😡', '🤯', '❤️', '✅', '❌', '⭐', '🎯', '🚀', '💪', '🙏', '📢', '⚡', '🥅', '🧤', '👑', '🤔'];
export const STICKER_BADGES = [
  ['gol', 'GOL!'], ['var', 'VAR'], ['ofsayt', 'Ofsayt'], ['kirmizi', 'Kırmızı kart'], ['sari', 'Sarı kart'],
  ['penalti', 'Penaltı'], ['mvp', 'MVP'], ['live', 'Canlı'], ['vs', 'VS'], ['yeni', 'Yeni'], ['trend', 'Trend'], ['transfer', 'Transfer'],
];

function star(ctx, n, r1, r2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

function pill(ctx, text, bg, fg, size = 64, pad = 30) {
  ctx.font = `900 ${size}px "Barlow Condensed", sans-serif`;
  const w = ctx.measureText(text).width + pad * 2, h = size * 1.35;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, size * 0.04);
  return { w, h };
}

export function drawSticker(ctx, L, t, env) {
  const { S } = env;
  const sc = (L.size || 200) / 200;
  ctx.scale(sc, sc);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18 * S; ctx.shadowOffsetY = 6 * S;
  let box = { w: 200, h: 200 };
  if (L.glyph) {
    ctx.font = '170px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(L.glyph, 0, 8);
  } else {
    ctx.lineJoin = 'round';
    switch (L.badge) {
      case 'gol':
        star(ctx, 12, 120, 88); ctx.fillStyle = '#FACC15'; ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.lineWidth = 8; ctx.strokeStyle = '#111'; ctx.stroke();
        ctx.font = 'italic 900 78px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111'; ctx.fillText('GOL!', 0, 4);
        box = { w: 240, h: 240 }; break;
      case 'var':
        roundRect(ctx, -110, -70, 220, 140, 18); ctx.fillStyle = '#111827'; ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
        roundRect(ctx, -86, -50, 172, 100, 8); ctx.strokeStyle = '#60A5FA'; ctx.lineWidth = 4; ctx.stroke();
        ctx.font = '900 70px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('VAR', 0, 4);
        box = { w: 220, h: 140 }; break;
      case 'ofsayt':
        ctx.fillStyle = '#E5E7EB'; ctx.fillRect(-70, -110, 10, 200);
        ctx.fillStyle = '#FACC15'; ctx.fillRect(-60, -110, 70, 50); ctx.fillStyle = '#EF4444'; ctx.fillRect(10, -110, 60, 50);
        ctx.shadowColor = 'transparent';
        ctx.translate(0, 70); pill(ctx, 'OFSAYT', '#111', '#FACC15', 48, 22);
        box = { w: 220, h: 240 }; break;
      case 'kirmizi': case 'sari':
        ctx.rotate(-0.2);
        roundRect(ctx, -62, -90, 124, 180, 14); ctx.fillStyle = L.badge === 'kirmizi' ? '#DC2626' : '#FACC15'; ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
        box = { w: 170, h: 210 }; break;
      case 'penalti':
        ctx.beginPath(); ctx.arc(0, -40, 40, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.translate(0, 50); pill(ctx, 'PENALTI', '#16A34A', '#fff', 54, 26);
        box = { w: 260, h: 220 }; break;
      case 'mvp':
        star(ctx, 8, 105, 92); ctx.fillStyle = '#F59E0B'; ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.beginPath(); ctx.arc(0, 0, 76, 0, Math.PI * 2); ctx.fillStyle = '#FDE68A'; ctx.fill();
        ctx.font = '900 64px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#78350F'; ctx.fillText('MVP', 0, 4);
        box = { w: 220, h: 220 }; break;
      case 'live': {
        const b = pill(ctx, '   CANLI', '#DC2626', '#fff', 60, 30);
        ctx.shadowColor = 'transparent';
        const pulse = 0.6 + 0.4 * Math.sin(t * 6);
        ctx.beginPath(); ctx.arc(-b.w / 2 + 42, 0, 12, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${pulse})`; ctx.fill();
        box = b; break;
      }
      case 'vs':
        ctx.font = 'italic 900 150px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 14; ctx.strokeStyle = '#111'; ctx.strokeText('VS', 0, 6); ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#FACC15'; ctx.fillText('VS', 0, 6);
        box = { w: 240, h: 170 }; break;
      case 'yeni': box = pill(ctx, 'YENİ', '#7C3AED', '#fff', 64, 34); break;
      case 'trend': box = pill(ctx, '🔥 TREND', '#EA580C', '#fff', 60, 30); break;
      case 'transfer': box = pill(ctx, 'TRANSFER', '#FACC15', '#111', 60, 30); break;
    }
  }
  ctx.restore();
  return { w: box.w * sc, h: box.h * sc };
}
