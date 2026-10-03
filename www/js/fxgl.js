// Alpicut — ek görsel efektler: WebGL ekran efektleri (30) + prosedürel parçacık/kaplama efektleri (28)
// Hepsi zamana bağlı ve deterministiktir: önizleme ile dışa aktarma aynı görünür.

const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const HEAD = `precision mediump float;
varying vec2 v;uniform sampler2D t;uniform float amt,time,ar;uniform vec2 res;uniform vec3 c1,c2;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 tex(vec2 u){return texture2D(t,clamp(u,0.,1.)).rgb;}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 hsv(vec3 c){vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}
`;
const PRE = `void main(){
 vec2 u=vec2(v.x,1.-v.y);vec3 o=tex(u);vec2 c=u-.5;float r=length(c*vec2(ar,1.));
`;
const BODIES = {
  1: `{vec2 d=c*.02*amt;o=vec3(tex(u+d).r,tex(u).g,tex(u-d).b);}`,
  2: `{vec3 a=vec3(0.);for(int i=0;i<16;i++){float k=1.-float(i)*.012*amt;a+=tex(.5+c*k);}o=a/16.;}`,
  3: `{float an=amt*2.5*smoothstep(.6,0.,r);float s=sin(an),co=cos(an);o=tex(.5+mat2(co,-s,s,co)*c);}`,
  4: `{float a=atan(c.y,c.x),l=length(c);float n=6.;a=mod(a,6.2832/n);a=abs(a-3.1416/n);o=tex(.5+l*vec2(cos(a+time*.2),sin(a+time*.2)));}`,
  5: `{vec2 q=fract(u*2.);o=tex(vec2(q.x,q.y));}`,
  6: `{vec2 q=vec2(u.x,fract(u.y*3.));o=tex(vec2(q.x,.333+q.y*.333));}`,
  7: `{float s=res.x/(90.-amt*40.);vec2 g=fract(u*vec2(s,s/ar))-.5;float l=lum(tex(u));float d=length(g);o=mix(vec3(1.),vec3(.05),step(d,(1.-l)*.62));}`,
  8: `{float l=lum(o);o=mix(c1,c2,smoothstep(.1,.9,l));}`,
  9: `{float l=lum(o);o=l<.5?mix(vec3(0.,0.,.5),vec3(0.,1.,0.),l*2.):mix(vec3(1.,1.,0.),vec3(1.,0.,0.),(l-.5)*2.);}`,
  10: `{float l=lum(o)*1.6;float n=hash(u*res+time)*.25;o=vec3(.1,1.,.2)*(l+n)*(1.-r*r*.9);o*=.85+.15*sin(u.y*res.y*1.4);}`,
  11: `{vec2 q=c*(1.+.18*amt*dot(c,c));vec2 uu=q+.5;o=tex(uu);o*=.82+.18*sin(uu.y*res.y*1.5);o*=step(0.,uu.x)*step(uu.x,1.)*step(0.,uu.y)*step(uu.y,1.);o*=1.-r*.5;}`,
  12: `{vec2 e=1./res;float gx=lum(tex(u+vec2(e.x,0.)))-lum(tex(u-vec2(e.x,0.)));float gy=lum(tex(u+vec2(0.,e.y)))-lum(tex(u-vec2(0.,e.y)));float g=clamp(length(vec2(gx,gy))*6.,0.,1.);o=mix(o*.25,hsv(vec3(fract(time*.1+u.y*.3),.8,1.)),g);}`,
  13: `{vec2 e=1.5/res;float gx=lum(tex(u+vec2(e.x,0.)))-lum(tex(u-vec2(e.x,0.)));float gy=lum(tex(u+vec2(0.,e.y)))-lum(tex(u-vec2(0.,e.y)));float g=1.-clamp(length(vec2(gx,gy))*5.,0.,1.);o=vec3(g*(.9+.1*hash(u*res)));}`,
  14: `{vec3 p=floor(o*5.)/5.;vec2 e=1.5/res;float gx=lum(tex(u+vec2(e.x,0.)))-lum(tex(u-vec2(e.x,0.)));float gy=lum(tex(u+vec2(0.,e.y)))-lum(tex(u-vec2(0.,e.y)));o=p*(1.-step(.12,length(vec2(gx,gy))));}`,
  15: `{vec2 d=c/(r+.001)*sin(r*40.-time*6.)*.008*amt;o=tex(u+d);}`,
  16: `{o=tex(u+vec2(sin(u.y*30.+time*4.)*.006*amt,0.));}`,
  17: `{vec2 q=c*(1.-.5*amt*(.25-dot(c,c)));o=tex(.5+q);}`,
  18: `{float b=smoothstep(.12,.4,abs(u.y-.5))*amt*.012;vec3 a=vec3(0.);for(int i=-4;i<=4;i++)for(int j=-2;j<=2;j++)a+=tex(u+vec2(float(i),float(j))*b);o=a/45.;o=mix(o,o*1.15,0.);}`,
  19: `{float p=.5+.5*sin(time*6.);o*=1.-smoothstep(.3,.9,r)*(.5+.5*p)*amt;}`,
  20: `{vec3 h=hsv(vec3(fract(time*.25+u.x*.2),.9,1.));o=mix(o,o*h*1.5,.45*amt);}`,
  21: `{float s=step(.5,fract(time*8.));o=mix(o,vec3(1.)-o*.2,s*amt*.8);}`,
  22: `{vec2 b=floor(u*vec2(18.,32.));float n=hash(b+floor(time*12.));vec2 off=n>.82?vec2((hash(b+1.)-.5)*.12*amt,0.):vec2(0.);o=tex(u+off);if(n>.95)o=o.bgr;}`,
  23: `{float s=floor(u.y*24.);float n=hash(vec2(s,floor(time*15.)));float off=n>.7?(n-.85)*.25*amt:0.;o=vec3(tex(u+vec2(off+.006,0.)).r,tex(u+vec2(off,0.)).g,tex(u+vec2(off-.006,0.)).b);}`,
  24: `{vec2 q=u+vec2(0.,fract(time*.3)*.04*amt);o=tex(q);float n=hash(u*res*.5+time);o=mix(o,vec3(lum(o)),.6)+n*.18*amt;o*=.9+.1*sin(u.y*res.y*1.3+time*30.);}`,
  25: `{float l=lum(o);o=mix(o,vec3(l)*vec3(1.07,.74,.43)*1.15,amt);}`,
  26: `{vec2 e=1./res;vec3 a=tex(u-e)-tex(u+e);o=vec3(.5+lum(a)*2.);}`,
  27: `{vec3 a=vec3(0.);for(int i=0;i<12;i++)a+=tex(u+vec2((float(i)-6.)*.004*amt,0.));o=a/12.;}`,
  28: `{float z=1.+amt*.25*(.5+.5*sin(time*3.));o=tex(.5+c/z);}`,
  29: `{vec3 b=vec3(0.);for(int i=-3;i<=3;i++)for(int j=-3;j<=3;j++)b+=tex(u+vec2(float(i),float(j))*.006);b/=49.;o=mix(o,max(o,b)*1.1,.6*amt);}`,
  30: `{float l=lum(o);o=vec3(step(.5+.15*sin(time*2.),l+(hash(u*res)-.5)*.25));o=mix(c2,c1,o.r);}`,
};
const fsFor = (m) => `${HEAD}${PRE}\n ${BODIES[m] || ''}\n gl_FragColor=vec4(o,1.);\n}`;


export const GL_FX = {
  chroma: [1, 'Renk ayrışması'], zoomblur: [2, 'Zoom bulanıklığı'], swirl: [3, 'Girdap'], kaleido: [4, 'Kaleydoskop'], quad: [5, '4\'lü ekran'], split3: [6, '3\'lü ekran'],
  halftone: [7, 'Gazete noktası'], duotone: [8, 'Duoton'], thermal: [9, 'Termal kamera'], nightvision: [10, 'Gece görüşü'], crt: [11, 'Eski TV (CRT)'], neonedge: [12, 'Neon kenar'],
  sketch: [13, 'Karakalem'], cartoon: [14, 'Çizgi film'], ripple: [15, 'Su dalgası'], heatwave: [16, 'Sıcak hava'], fisheye: [17, 'Balıkgözü'], tiltshift: [18, 'Minyatür (tilt-shift)'],
  vigpulse: [19, 'Nabız vinyet'], rainbow: [20, 'Gökkuşağı'], strobe: [21, 'Stroboskop'], blockglitch: [22, 'Blok glitch'], sliceglitch: [23, 'Şerit glitch'], oldtv: [24, 'Eski televizyon'],
  sepia: [25, 'Sepya'], emboss: [26, 'Kabartma'], motionblur: [27, 'Hareket bulanıklığı'], dolly: [28, 'Nefes alan zoom'], dream: [29, 'Rüya parlaması'], dither: [30, 'İki renk'],
};

class FxGL {
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    this.ok = !!gl;
    if (!gl) return;
    this.gl = gl;
    this.vs = this._sh(gl.VERTEX_SHADER, VS);
    this.progs = new Map();
    this.broken = new Set();
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  _sh(type, src) { const gl = this.gl; const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const e = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(e); } return s; }
  _prog(mode) {
    if (this.progs.has(mode)) return this.progs.get(mode);
    const gl = this.gl;
    const pr = gl.createProgram();
    gl.attachShader(pr, this.vs); gl.attachShader(pr, this._sh(gl.FRAGMENT_SHADER, fsFor(mode))); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const u = {}; ['t', 'amt', 'time', 'ar', 'res', 'c1', 'c2'].forEach((n) => { u[n] = gl.getUniformLocation(pr, n); });
    const loc = gl.getAttribLocation(pr, 'p');
    const P = { pr, u, loc };
    this.progs.set(mode, P);
    return P;
  }
  process(src, mode, { amt = 1, time = 0, c1 = [0.1, 0.05, 0.3], c2 = [1, 0.8, 0.3] } = {}) {
    if (this.broken.has(mode)) return null;
    const gl = this.gl, w = src.width, h = src.height;
    let P;
    try { P = this._prog(mode); } catch (e) { console.warn('fx', mode, e.message); this.broken.add(mode); return null; }
    gl.useProgram(P.pr);
    gl.enableVertexAttribArray(P.loc); gl.vertexAttribPointer(P.loc, 2, gl.FLOAT, false, 0, 0);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const u = P.u;
    gl.uniform1i(u.t, 0); gl.uniform1f(u.amt, amt); gl.uniform1f(u.time, time); gl.uniform1f(u.ar, w / h);
    gl.uniform2f(u.res, w, h); gl.uniform3fv(u.c1, c1); gl.uniform3fv(u.c2, c2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}
let inst;
export function fxgl() {
  if (inst === undefined) { try { inst = new FxGL(); if (!inst.ok) inst = null; } catch (e) { console.warn('fxgl', e); inst = null; } }
  return inst;
}

const hx = (c) => { const n = parseInt((c || '#000000').slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
export function applyGLFx(ctx, id, lt, amt, L) {
  const g = fxgl(); if (!g) return false;
  const cv = ctx.canvas;
  const out = g.process(cv, GL_FX[id][0], { amt, time: lt * (L.speed ?? 1), c1: hx(L.c1 || '#1E1B4B'), c2: hx(L.c2 || '#FACC15') });
  if (!out) return false;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(1, amt); ctx.drawImage(out, 0, 0); ctx.restore();
  return true;
}

// ---------------- parçacık / kaplama efektleri (2D) ----------------
export const PARTICLE_FX = {
  snow: 'Kar', rain: 'Yağmur', confetti: 'Konfeti', sparkle: 'Parıltı', hearts: 'Uçan kalpler', bubbles: 'Baloncuk', embers: 'Kıvılcım', rays: 'Işık huzmesi',
  flare: 'Lens parlaması', bokeh: 'Bokeh', dust: 'Film tozu / çizik', glitter: 'Simli', money: 'Para yağmuru', ballrain: 'Top yağmuru', firerain: 'Ateş emojisi', shutter: 'Fotoğraf çekimi',
  rec: 'Kamera vizörü (REC)', letterbox: 'Sinema açılışı', spotlight: 'Spot ışığı', redpulse: 'Kırmızı alarm', speedlines: 'Hız çizgileri', zoomlines: 'Odak çizgileri', stars: 'Yıldızlar', lightning: 'Şimşek',
  grain: 'Film greni', vignette: 'Vinyet', scanlines: 'Tarama çizgileri', frame: 'Polaroid çerçeve',
};

const rnd = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

function emojiRain(ctx, ch, lt, W, H, amt, n = 26) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < n * amt; i++) {
    const sp = 380 + rnd(i, 1) * 520, sz = 60 + rnd(i, 2) * 70;
    const y = ((lt * sp + rnd(i, 3) * H * 1.4) % (H * 1.3)) - H * 0.15;
    const x = rnd(i, 4) * W + Math.sin(lt * 2 + i) * 30;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(lt * 3 + i) * 0.6); ctx.font = `${sz}px sans-serif`; ctx.fillText(ch, 0, 0); ctx.restore();
  }
}

export function drawParticleFx(ctx, id, lt, env, amt, L) {
  const { W, H } = env;
  const sp = L.speed ?? 1;
  const T = lt * sp;
  ctx.save();
  switch (id) {
    case 'snow': ctx.fillStyle = '#fff'; for (let i = 0; i < 160 * amt; i++) { const s = 2 + rnd(i) * 7; const y = ((T * (40 + s * 18) + rnd(i, 1) * H) % H); const x = (rnd(i, 2) * W + Math.sin(T + i) * 30 + W) % W; ctx.globalAlpha = 0.5 + rnd(i, 3) * 0.5; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); } break;
    case 'rain': ctx.strokeStyle = 'rgba(200,220,255,.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 220 * amt; i++) { const y = ((T * 2200 + rnd(i, 1) * H) % (H + 100)) - 50; const x = rnd(i, 2) * W - (y / H) * 80; ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 50); } ctx.stroke(); ctx.fillStyle = 'rgba(20,30,50,.18)'; ctx.fillRect(0, 0, W, H); break;
    case 'confetti': { const C = ['#F43F5E', '#FACC15', '#22C55E', '#3B82F6', '#A855F7', '#F97316']; for (let i = 0; i < 140 * amt; i++) { const y = ((T * (300 + rnd(i) * 300) + rnd(i, 1) * H) % (H + 60)) - 30; const x = rnd(i, 2) * W + Math.sin(T * 2 + i) * 40; ctx.save(); ctx.translate(x, y); ctx.rotate(T * 4 * (rnd(i, 3) - 0.5) * 3); ctx.scale(1, Math.cos(T * 6 + i)); ctx.fillStyle = C[i % C.length]; ctx.fillRect(-9, -5, 18, 10); ctx.restore(); } break; }
    case 'sparkle': case 'glitter': case 'stars': {
      const n = id === 'glitter' ? 260 : id === 'stars' ? 90 : 60;
      for (let i = 0; i < n * amt; i++) { const x = rnd(i, 1) * W, y = rnd(i, 2) * H; const tw = Math.max(0, Math.sin(T * (2 + rnd(i, 3) * 4) + i)); if (tw < 0.2) continue; const s = (id === 'glitter' ? 4 : 14 + rnd(i, 4) * 22) * tw; ctx.globalAlpha = tw; ctx.fillStyle = id === 'glitter' ? ['#FFD700', '#FFF', '#FBCFE8'][i % 3] : '#fff'; ctx.save(); ctx.translate(x, y); ctx.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.25 : s; const a = (k / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); ctx.restore(); }
      break;
    }
    case 'hearts': ctx.textAlign = 'center'; for (let i = 0; i < 22 * amt; i++) { const life = (T * 0.4 + rnd(i)) % 1; const x = W * (0.6 + rnd(i, 1) * 0.35) + Math.sin(life * 9 + i) * 40; const y = H * (1.05 - life * 0.9); ctx.globalAlpha = Math.sin(life * Math.PI); ctx.font = `${50 + rnd(i, 2) * 50}px sans-serif`; ctx.fillText(['❤️', '💜', '💖', '😍'][i % 4], x, y); } break;
    case 'bubbles': ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; for (let i = 0; i < 40 * amt; i++) { const life = (T * 0.15 + rnd(i)) % 1; const r = 14 + rnd(i, 1) * 40; const x = rnd(i, 2) * W + Math.sin(life * 8 + i) * 30; const y = H * (1.1 - life * 1.2); ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(); } break;
    case 'embers': ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 120 * amt; i++) { const life = (T * (0.2 + rnd(i) * 0.3) + rnd(i, 1)) % 1; const x = rnd(i, 2) * W + Math.sin(life * 10 + i) * 60; const y = H * (1.05 - life); const r = 2 + rnd(i, 3) * 5; ctx.globalAlpha = Math.sin(life * Math.PI); ctx.fillStyle = rnd(i, 4) > 0.5 ? '#FF7A1A' : '#FFD15C'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); } break;
    case 'rays': { ctx.globalCompositeOperation = 'screen'; const cx = W * 0.85, cy = -H * 0.05; for (let i = 0; i < 9; i++) { const a = 1.9 + i * 0.12 + Math.sin(T * 0.5 + i) * 0.03; const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * H * 1.3, cy + Math.sin(a) * H * 1.3); g.addColorStop(0, `rgba(255,240,200,${0.35 * amt})`); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - 0.04) * H * 1.5, cy + Math.sin(a - 0.04) * H * 1.5); ctx.lineTo(cx + Math.cos(a + 0.04) * H * 1.5, cy + Math.sin(a + 0.04) * H * 1.5); ctx.fill(); } break; }
    case 'flare': { ctx.globalCompositeOperation = 'screen'; const fx = W * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(T * 0.6))), fy = H * 0.25; const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, W * 0.5); g.addColorStop(0, `rgba(255,255,230,${0.9 * amt})`); g.addColorStop(0.15, `rgba(255,200,120,${0.4 * amt})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); const dx = W / 2 - fx, dy = H / 2 - fy; [0.4, 0.7, 1.1, 1.5].forEach((k, i) => { ctx.fillStyle = `rgba(${[150, 255, 120, 200][i]},${[200, 160, 255, 120][i]},255,${0.18 * amt})`; ctx.beginPath(); ctx.arc(fx + dx * k * 2, fy + dy * k * 2, 30 + i * 30, 0, 7); ctx.fill(); }); break; }
    case 'bokeh': ctx.globalCompositeOperation = 'screen'; for (let i = 0; i < 30 * amt; i++) { const x = rnd(i, 1) * W + Math.sin(T * 0.4 + i) * 40, y = rnd(i, 2) * H + Math.cos(T * 0.3 + i) * 40, r = 30 + rnd(i, 3) * 90; const g = ctx.createRadialGradient(x, y, 0, x, y, r); const col = ['255,200,120', '255,140,200', '140,200,255'][i % 3]; g.addColorStop(0, `rgba(${col},.35)`); g.addColorStop(0.8, `rgba(${col},.2)`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); } break;
    case 'dust': { const f = Math.floor(T * 24); ctx.fillStyle = 'rgba(255,250,235,.7)'; for (let i = 0; i < 30 * amt; i++) { ctx.globalAlpha = rnd(i, f); ctx.fillRect(rnd(i, f + 1) * W, rnd(i, f + 2) * H, 2 + rnd(i, f + 3) * 5, 2 + rnd(i, f + 4) * 5); } ctx.globalAlpha = 0.35; for (let i = 0; i < 2; i++) if (rnd(i, f) > 0.4) ctx.fillRect(rnd(i, f + 9) * W, 0, 2, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,230,190,${0.25 * amt})`; ctx.fillRect(0, 0, W, H); break; }
    case 'money': emojiRain(ctx, '💸', T, W, H, amt); break;
    case 'ballrain': emojiRain(ctx, '⚽', T, W, H, amt); break;
    case 'firerain': emojiRain(ctx, '🔥', T, W, H, amt); break;
    case 'shutter': { const p = T % 1.2; if (p < 0.25) { const k = Math.sin((p / 0.25) * Math.PI); ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H * 0.5 * k); ctx.fillRect(0, H - H * 0.5 * k, W, H * 0.5 * k); } else if (p < 0.35) { ctx.fillStyle = `rgba(255,255,255,${(0.35 - p) * 8 * amt})`; ctx.fillRect(0, 0, W, H); } break; }
    case 'rec': { ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; const m = 60, l = 90; [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke(); }); if (Math.floor(T * 2) % 2 === 0) { ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(m + 40, m + 60, 16, 0, 7); ctx.fill(); } ctx.fillStyle = '#fff'; ctx.font = '700 44px "Barlow", sans-serif'; ctx.fillText('REC', m + 70, m + 76); const s = Math.floor(lt); ctx.textAlign = 'right'; ctx.fillText(`00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, W - m - 20, m + 76); ctx.textAlign = 'left'; ctx.fillText('4K · 60FPS', m + 20, H - m - 30); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2 - 40, H / 2); ctx.lineTo(W / 2 + 40, H / 2); ctx.moveTo(W / 2, H / 2 - 40); ctx.lineTo(W / 2, H / 2 + 40); ctx.stroke(); break; }
    case 'letterbox': { const k = Math.min(1, lt / 0.8); const e = 1 - Math.pow(1 - k, 3); const bh = H * 0.5 * (1 - e) + H * 0.12 * e; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh); break; }
    case 'spotlight': { const x = W * (0.5 + 0.2 * Math.sin(T * 0.8)), y = H * (0.45 + 0.1 * Math.cos(T * 0.6)); const g = ctx.createRadialGradient(x, y, W * 0.18, x, y, W * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.85 * amt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); break; }
    case 'redpulse': { const p = 0.5 + 0.5 * Math.sin(T * 7); const g = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, H * 0.75); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,30,${0.6 * p * amt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); break; }
    case 'speedlines': ctx.strokeStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 60 * amt; i++) { const y = rnd(i, Math.floor(T * 20)) * H; const len = 200 + rnd(i, 3) * 500; const x = ((T * 3000 + rnd(i, 1) * W * 2) % (W + len)) - len; ctx.lineWidth = 2 + rnd(i, 4) * 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke(); } break;
    case 'zoomlines': { const f = Math.floor(T * 14); ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 70 * amt; i++) { const a = rnd(i, f) * Math.PI * 2; const r0 = Math.min(W, H) * (0.35 + rnd(i, f + 1) * 0.15), r1 = Math.max(W, H); const wd = 0.004 + rnd(i, f + 2) * 0.01; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a - wd) * r1, H / 2 + Math.sin(a - wd) * r1); ctx.lineTo(W / 2 + Math.cos(a + wd) * r1, H / 2 + Math.sin(a + wd) * r1); ctx.fill(); } break; }
    case 'lightning': { const f = Math.floor(T * 10); if (rnd(f, 7) > 0.8) { ctx.fillStyle = `rgba(220,230,255,${0.5 * amt})`; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.shadowColor = '#9cf'; ctx.shadowBlur = 30; let x = rnd(f, 1) * W, y = 0; ctx.beginPath(); ctx.moveTo(x, y); while (y < H * 0.7) { x += (rnd(f, y) - 0.5) * 120; y += 60 + rnd(f, y + 1) * 60; ctx.lineTo(x, y); } ctx.stroke(); } break; }
    case 'grain': { const f = Math.floor(T * 24); ctx.globalAlpha = 0.18 * amt; for (let i = 0; i < 1400; i++) { ctx.fillStyle = rnd(i, f) > 0.5 ? '#fff' : '#000'; ctx.fillRect(rnd(i, f + 1) * W, rnd(i, f + 2) * H, 3, 3); } break; }
    case 'vignette': { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.8 * amt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); break; }
    case 'scanlines': ctx.fillStyle = `rgba(0,0,0,${0.28 * amt})`; for (let y = (T * 40) % 8; y < H; y += 8) ctx.fillRect(0, y, W, 3); break;
    case 'frame': { const m = W * 0.06; ctx.fillStyle = '#F8F6F0'; ctx.fillRect(0, 0, W, m); ctx.fillRect(0, 0, m, H); ctx.fillRect(W - m, 0, m, H); ctx.fillRect(0, H - m * 3.2, W, m * 3.2); ctx.fillStyle = '#333'; ctx.font = `600 ${m * 0.9}px "Caveat", "Barlow", cursive`; ctx.textAlign = 'center'; ctx.fillText(L.text || 'anı ✨', W / 2, H - m * 1.4); break; }
  }
  ctx.restore();
}
