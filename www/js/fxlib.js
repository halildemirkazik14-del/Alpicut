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
const GL_CAT = { paper: 'Kağıt & stop-motion', cutout: 'Kağıt & stop-motion', chroma: 'Bozulma', blockglitch: 'Bozulma', sliceglitch: 'Bozulma', oldtv: 'Retro', crt: 'Retro', sepia: 'Retro', dither: 'Retro', halftone: 'Sanat', sketch: 'Sanat', cartoon: 'Sanat', emboss: 'Sanat', neonedge: 'Sanat', duotone: 'Sanat', thermal: 'Kamera', nightvision: 'Kamera', fisheye: 'Kamera', tiltshift: 'Bulanıklık', zoomblur: 'Bulanıklık', motionblur: 'Bulanıklık', dream: 'Işık', swirl: 'Bozulma', kaleido: 'Ekran', quad: 'Ekran', split3: 'Ekran', ripple: 'Bozulma', heatwave: 'Bozulma', vigpulse: 'Işık', rainbow: 'Işık', strobe: 'Işık', dolly: 'Hareket' };
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
export const STICKER_EMOJI = ['⚽', '🔥', '😱', '👀', '💯', '🏆', '👏', '😂', '😡', '🤯', '❤️', '✅', '❌', '⭐', '🎯', '🚀', '💪', '🙏', '📢', '⚡', '🥅', '🧤', '👑', '🤔',
  '😍', '🥰', '😎', '🤩', '🥳', '😭', '😅', '🙈', '🤫', '😴', '🤑', '🫶', '👍', '👎', '👉', '👇', '☝️', '✌️', '🤝', '💥', '✨', '🌟', '💫', '🎉',
  '🎁', '🛍️', '💸', '💰', '📈', '📉', '🏠', '🔑', '✈️', '🌍', '🏖️', '🏔️', '📍', '🍕', '🍔', '🍰', '☕', '🍷', '🥗', '🍳', '🎵', '🎧', '🎬', '📸',
  '🎮', '🕹️', '💻', '📱', '🤖', '🧠', '📚', '✏️', '💡', '⏰', '⚠️', '🚫', '🆕', '🔔', '❗', '❓', '💬', '👑', '💎', '🌹', '💍', '🎂', '🐶', '🐱'];

// v1.5: veriyle tanımlı genel çıkartmalar (metni ve renkleri sonradan değiştirilebilir)
// shape: pill | tag | burst | circle | ribbon | outline | bubble | arrow | box | stamp
const SD = (id, text, bg, fg, shape = 'pill', extra = {}) => ({ id, text, bg, fg, shape, ...extra });
export const STICKER_SETS = {
  'Satış': [SD('s_sale', '%50 İNDİRİM', '#DC2626', '#fff', 'burst'), SD('s_new', 'YENİ', '#7C3AED', '#fff', 'pill'), SD('s_hot', '🔥 HOT', '#EA580C', '#fff', 'pill'), SD('s_free', 'ÜCRETSİZ', '#16A34A', '#fff', 'stamp'), SD('s_limited', 'SINIRLI SÜRE', '#111', '#FACC15', 'tag'), SD('s_last', 'SON 3 ÜRÜN', '#B91C1C', '#fff', 'ribbon'), SD('s_price', '₺199', '#FACC15', '#111', 'circle'), SD('s_order', 'SİPARİŞ VER', '#2563EB', '#fff', 'pill'), SD('s_ship', '🚚 ÜCRETSİZ KARGO', '#0EA5E9', '#fff', 'pill'), SD('s_best', 'ÇOK SATAN', '#F59E0B', '#111', 'ribbon'), SD('s_sold', 'TÜKENDİ', '#6B7280', '#fff', 'stamp'), SD('s_gift', '🎁 HEDİYE', '#DB2777', '#fff', 'pill')],
  'Sosyal medya': [SD('m_link', 'LİNK BİYODA', '#fff', '#111', 'pill'), SD('m_dm', '📩 DM AT', '#8B5CF6', '#fff', 'pill'), SD('m_save', 'KAYDET 🔖', '#111', '#fff', 'pill'), SD('m_share', 'PAYLAŞ ↗', '#0EA5E9', '#fff', 'pill'), SD('m_part2', 'PART 2 👉', '#111', '#FACC15', 'tag'), SD('m_comment', 'YORUMA YAZ 💬', '#16A34A', '#fff', 'bubble'), SD('m_follow', '+ TAKİP', '#E11D48', '#fff', 'pill'), SD('m_viral', 'VİRAL', '#F43F5E', '#fff', 'burst'), SD('m_pov', 'POV', '#000', '#fff', 'box'), SD('m_wait', 'SONUNU BEKLE', '#FACC15', '#111', 'tag'), SD('m_stitch', 'STITCH', '#25F4EE', '#111', 'pill'), SD('m_live', '● CANLI', '#DC2626', '#fff', 'pill')],
  'Bilgi & ipucu': [SD('i_tip', '💡 İPUCU', '#FACC15', '#111', 'pill'), SD('i_note', 'NOT', '#fff', '#111', 'tag'), SD('i_warn', '⚠️ DİKKAT', '#F59E0B', '#111', 'box'), SD('i_fact', 'GERÇEK', '#2563EB', '#fff', 'stamp'), SD('i_myth', 'EFSANE', '#9333EA', '#fff', 'stamp'), SD('i_yes', '✅ DOĞRU', '#16A34A', '#fff', 'pill'), SD('i_no', '❌ YANLIŞ', '#DC2626', '#fff', 'pill'), SD('i_step1', 'ADIM 1', '#111', '#fff', 'circle'), SD('i_here', 'BURADA', '#E11D48', '#fff', 'arrow'), SD('i_look', 'BAK 👀', '#fff', '#111', 'arrow'), SD('i_before', 'ÖNCE', '#374151', '#fff', 'tag'), SD('i_after', 'SONRA', '#16A34A', '#fff', 'tag')],
  'Tepki': [SD('r_wow', 'WOW!', '#FACC15', '#111', 'burst'), SD('r_omg', 'OMG', '#EC4899', '#fff', 'burst'), SD('r_lol', 'LOL 😂', '#fff', '#111', 'bubble'), SD('r_yes', 'EVET!', '#16A34A', '#fff', 'bubble'), SD('r_no', 'HAYIR!', '#DC2626', '#fff', 'bubble'), SD('r_what', 'NE?!', '#7C3AED', '#fff', 'bubble'), SD('r_boom', 'BOOM', '#F97316', '#fff', 'burst'), SD('r_love', 'BAYILDIM ❤️', '#E11D48', '#fff', 'pill'), SD('r_fire', 'EFSANE 🔥', '#111', '#FB923C', 'pill'), SD('r_cringe', 'CRINGE', '#A3A3A3', '#111', 'stamp'), SD('r_win', 'KAZANDIK', '#FACC15', '#111', 'ribbon'), SD('r_fail', 'FAIL', '#991B1B', '#fff', 'stamp')],
  'Seyahat & mekan': [SD('t_loc', '📍 KONUM', '#fff', '#111', 'pill'), SD('t_visit', 'MUTLAKA GİT', '#0EA5E9', '#fff', 'ribbon'), SD('t_hidden', 'GİZLİ CENNET', '#059669', '#fff', 'tag'), SD('t_5star', '★★★★★', '#111', '#FACC15', 'pill'), SD('t_open', 'AÇIK', '#16A34A', '#fff', 'box'), SD('t_book', 'REZERVASYON', '#D4AF37', '#111', 'pill'), SD('t_view', 'MANZARA ✨', '#1E3A8A', '#fff', 'pill'), SD('t_lux', 'LUXURY', '#0B0B0B', '#F3DFA2', 'outline')],
  'Yemek': [SD('f_yum', 'NEFİS 😋', '#F97316', '#fff', 'bubble'), SD('f_recipe', 'TARİF', '#16A34A', '#fff', 'tag'), SD('f_vegan', '🌱 VEGAN', '#22C55E', '#fff', 'pill'), SD('f_spicy', '🌶️ ACI', '#DC2626', '#fff', 'pill'), SD('f_min', '15 DK', '#FACC15', '#111', 'circle'), SD('f_chef', 'ŞEFİN SEÇİMİ', '#111', '#F3DFA2', 'ribbon')],
  'Etkinlik': [SD('e_save', 'TARİHİ KAYDET', '#DB2777', '#fff', 'ribbon'), SD('e_soon', 'ÇOK YAKINDA', '#111', '#fff', 'outline'), SD('e_today', 'BUGÜN', '#E11D48', '#fff', 'stamp'), SD('e_ticket', '🎟️ BİLET', '#7C3AED', '#fff', 'tag'), SD('e_party', 'PARTİ 🎉', '#F59E0B', '#111', 'burst'), SD('e_vip', 'VIP', '#0B0B0B', '#D4AF37', 'outline')],
};

function drawShapeSticker(ctx, d, t) {
  const fg = d.fg || '#fff', bg = d.bg || '#111';
  const text = d.text || '';
  const font = (sz) => `900 ${sz}px "Barlow Condensed", "Barlow", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  let size = 64;
  ctx.font = font(size);
  let tw = ctx.measureText(text).width;
  const maxW = d.shape === 'circle' || d.shape === 'burst' ? 170 : 360;
  if (tw > maxW) { size = Math.max(28, size * maxW / tw); ctx.font = font(size); tw = ctx.measureText(text).width; }
  const padX = 34, hh = size * 1.45;
  const label = (y = 0) => { ctx.shadowColor = 'transparent'; ctx.fillStyle = fg; ctx.fillText(text, 0, y + size * 0.05); };
  switch (d.shape) {
    case 'burst': {
      const r = Math.max(110, tw / 2 + 36);
      star(ctx, 14, r, r * 0.8); ctx.fillStyle = bg; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke();
      ctx.rotate(-0.12); label(); return { w: r * 2.1, h: r * 2.1 };
    }
    case 'circle': {
      const r = Math.max(90, tw / 2 + 30);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(0, 0, r - 10, 0, Math.PI * 2); ctx.stroke();
      label(); return { w: r * 2, h: r * 2 };
    }
    case 'tag': {
      const w = tw + padX * 2 + 30;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 30, -hh / 2); ctx.lineTo(w / 2, -hh / 2); ctx.lineTo(w / 2, hh / 2); ctx.lineTo(-w / 2 + 30, hh / 2); ctx.lineTo(-w / 2, 0); ctx.closePath();
      ctx.fillStyle = bg; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.arc(-w / 2 + 34, 0, 8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
      ctx.translate(14, 0); label(); return { w, h: hh };
    }
    case 'ribbon': {
      const w = tw + padX * 2;
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(-w / 2 - 34, -hh / 2 + 14); ctx.lineTo(-w / 2, -hh / 2 + 14); ctx.lineTo(-w / 2, hh / 2 + 14); ctx.lineTo(-w / 2 - 34, hh / 2 + 14); ctx.lineTo(-w / 2 - 18, 14); ctx.closePath(); ctx.globalAlpha = 0.75; ctx.fill();
      ctx.beginPath(); ctx.moveTo(w / 2 + 34, -hh / 2 + 14); ctx.lineTo(w / 2, -hh / 2 + 14); ctx.lineTo(w / 2, hh / 2 + 14); ctx.lineTo(w / 2 + 34, hh / 2 + 14); ctx.lineTo(w / 2 + 18, 14); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillRect(-w / 2, -hh / 2, w, hh); label(); return { w: w + 70, h: hh + 28 };
    }
    case 'outline': {
      const w = tw + padX * 2;
      ctx.fillStyle = bg; roundRect(ctx, -w / 2, -hh / 2, w, hh, 8); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.lineWidth = 4; ctx.strokeStyle = fg; roundRect(ctx, -w / 2 + 9, -hh / 2 + 9, w - 18, hh - 18, 4); ctx.stroke();
      label(); return { w, h: hh };
    }
    case 'bubble': {
      const w = tw + padX * 2;
      roundRect(ctx, -w / 2, -hh / 2, w, hh, hh / 2.4); ctx.fillStyle = bg; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w / 4, hh / 2 - 4); ctx.lineTo(-w / 4 - 26, hh / 2 + 34); ctx.lineTo(-w / 4 + 26, hh / 2 - 4); ctx.closePath(); ctx.fill();
      label(); return { w, h: hh + 40 };
    }
    case 'arrow': {
      const w = tw + padX * 2;
      roundRect(ctx, -w / 2, -hh / 2 - 40, w, hh, 14); ctx.fillStyle = bg; ctx.fill();
      const bob = Math.sin(t * 6) * 10;
      ctx.beginPath(); ctx.moveTo(-30, hh / 2 - 30 + bob); ctx.lineTo(30, hh / 2 - 30 + bob); ctx.lineTo(0, hh / 2 + 22 + bob); ctx.closePath(); ctx.fill();
      ctx.translate(0, -40); label(); return { w, h: hh + 120 };
    }
    case 'stamp': {
      const w = tw + padX * 2;
      ctx.rotate(-0.16); ctx.shadowColor = 'transparent';
      ctx.lineWidth = 9; ctx.strokeStyle = bg; roundRect(ctx, -w / 2, -hh / 2, w, hh, 12); ctx.stroke();
      ctx.lineWidth = 3; roundRect(ctx, -w / 2 + 12, -hh / 2 + 12, w - 24, hh - 24, 6); ctx.stroke();
      ctx.fillStyle = bg; ctx.fillText(text, 0, size * 0.05); return { w: w + 20, h: hh + 40 };
    }
    case 'box': {
      const w = tw + padX * 2;
      ctx.fillStyle = bg; ctx.fillRect(-w / 2, -hh / 2, w, hh); label(); return { w, h: hh };
    }
    default: { // pill
      const w = tw + padX * 2;
      roundRect(ctx, -w / 2, -hh / 2, w, hh, hh / 2); ctx.fillStyle = bg; ctx.fill(); label(); return { w, h: hh };
    }
  }
}
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
  if (L.sd) {
    box = drawShapeSticker(ctx, L.sd, t);
  } else if (L.glyph) {
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
