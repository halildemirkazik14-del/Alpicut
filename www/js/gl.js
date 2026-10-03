// Alpicut — WebGL görüntü işleme: renk düzeltme, eğriler, 3D LUT, chroma key ve piksel efektleri
// Aynı fonksiyon hem önizlemede hem dışa aktarmada kullanılır.

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `precision mediump float;
varying vec2 v;
uniform sampler2D t; uniform sampler2D curve; uniform sampler2D lut;
uniform float exposure, contrast, sat, vib, temp, tint, shadows, highlights, lutMix, lutSize;
uniform int curveOn, lutOn, keyOn, fx;
uniform vec3 keyColor; uniform float keyTol, keySoft, keySpill;
uniform float fxAmt, time, uvZoom, uvRot; uniform vec2 res, uvOff;
const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
float rnd(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 lut3d(vec3 c){
  float n = lutSize; float b = c.b * (n - 1.0); float b0 = floor(b); float b1 = min(b0 + 1.0, n - 1.0); float f = b - b0;
  float x = c.r * (n - 1.0) + 0.5; float y = (c.g * (n - 1.0) + 0.5) / n;
  vec3 a = texture2D(lut, vec2((b0 * n + x) / (n * n), y)).rgb;
  vec3 d = texture2D(lut, vec2((b1 * n + x) / (n * n), y)).rgb;
  return mix(a, d, f);
}
vec2 cbcr(vec3 c){ return vec2(-0.1687*c.r - 0.3313*c.g + 0.5*c.b, 0.5*c.r - 0.4187*c.g - 0.0813*c.b); }
void main(){
  vec2 uv = v - 0.5;
  float cs = cos(uvRot), sn = sin(uvRot);
  uv = vec2(uv.x * cs - uv.y * sn * res.y / res.x, uv.x * sn * res.x / res.y + uv.y * cs);
  uv = uv / uvZoom + 0.5 + uvOff;
  if (fx == 4) { if (uv.x > 0.5) uv.x = 1.0 - uv.x; }
  if (fx == 2) { float px = max(2.0, fxAmt * res.x / 22.0); uv = (floor(uv * res / px) + 0.5) * px / res; }
  if (fx == 3) { float j = (rnd(vec2(floor(uv.y * 90.0), floor(time * 24.0))) - 0.5) * 0.012 * fxAmt; uv.x += j; }
  if (fx == 9) { float bl = step(0.85, rnd(vec2(floor(uv.y * 18.0), floor(time * 12.0)))); uv.x += bl * (rnd(vec2(floor(time * 12.0), floor(uv.y * 18.0))) - 0.5) * 0.15 * fxAmt; }
  vec4 s = texture2D(t, clamp(uv, 0.0, 1.0));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) s = vec4(0.0, 0.0, 0.0, s.a);
  if (fx == 1 || fx == 3 || fx == 9) {
    float o = (fx == 1 ? 0.012 : 0.006) * fxAmt;
    s.r = texture2D(t, clamp(uv + vec2(o, 0.0), 0.0, 1.0)).r;
    s.b = texture2D(t, clamp(uv - vec2(o, 0.0), 0.0, 1.0)).b;
  }
  vec3 c = s.rgb;
  c *= pow(2.0, exposure);
  c.r *= 1.0 + temp * 0.18; c.b *= 1.0 - temp * 0.18; c.g *= 1.0 - tint * 0.12; c.r *= 1.0 + tint * 0.05;
  float l = dot(c, LUM);
  c += shadows * 0.3 * (1.0 - smoothstep(0.0, 0.55, l));
  c += highlights * 0.3 * smoothstep(0.45, 1.0, l);
  c = (c - 0.5) * contrast + 0.5;
  float l2 = dot(c, LUM);
  c = mix(vec3(l2), c, sat);
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  c = mix(vec3(l2), c, 1.0 + vib * (1.0 - (mx - mn)));
  c = clamp(c, 0.0, 1.0);
  if (curveOn == 1) c = vec3(texture2D(curve, vec2(c.r, 0.5)).r, texture2D(curve, vec2(c.g, 0.5)).g, texture2D(curve, vec2(c.b, 0.5)).b);
  if (lutOn == 1) c = mix(c, lut3d(c), lutMix);
  if (fx == 3) { c *= 0.9 + 0.1 * sin(v.y * res.y * 1.4); c += (rnd(v * time) - 0.5) * 0.08 * fxAmt; c = mix(c, c * vec3(1.05, 0.95, 1.1), fxAmt); }
  if (fx == 5) { float g = dot(c, LUM); c = mix(c, vec3(smoothstep(0.1, 0.9, g)), fxAmt); }
  if (fx == 6) { float lv = mix(16.0, 3.0, fxAmt); c = floor(c * lv + 0.5) / lv; }
  if (fx == 7) c = mix(c, 1.0 - c, fxAmt);
  if (fx == 8) c += (rnd(v + fract(time)) - 0.5) * 0.25 * fxAmt;
  float a = s.a;
  if (keyOn == 1) {
    float d = distance(cbcr(c), cbcr(keyColor));
    float k = smoothstep(keyTol, keyTol + keySoft + 0.0001, d);
    float sp = keySpill * (1.0 - smoothstep(keyTol, keyTol + keySoft * 3.0 + 0.05, d));
    c = mix(c, vec3(dot(c, LUM)), sp);
    a *= k;
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), a);
}`;

export const FX_SHADER = { none: 0, rgb: 1, pixel: 2, vhs: 3, mirror: 4, bwpop: 5, poster: 6, invert: 7, noise: 8, glitch: 9 };

class Grader {
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false })
      || this.canvas.getContext('experimental-webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    this.ok = !!gl;
    if (!gl) return;
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    this.pr = pr;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    ['t', 'curve', 'lut', 'exposure', 'contrast', 'sat', 'vib', 'temp', 'tint', 'shadows', 'highlights', 'lutMix', 'lutSize', 'curveOn', 'lutOn', 'keyOn', 'fx',
      'keyColor', 'keyTol', 'keySoft', 'keySpill', 'fxAmt', 'time', 'uvZoom', 'uvRot', 'res', 'uvOff'].forEach((n) => { this.u[n] = gl.getUniformLocation(pr, n); });
    this.tex = this._tex(0);
    this.curveTex = this._tex(1);
    this.lutTex = this._tex(2);
    gl.uniform1i(this.u.t, 0); gl.uniform1i(this.u.curve, 1); gl.uniform1i(this.u.lut, 2);
    this.curveKey = null; this.lutKey = null;
    // boş dokular
    gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.activeTexture(gl.TEXTURE2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }

  _tex(unit) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  setCurve(key, data) {
    if (this.curveKey === key) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    this.curveKey = key;
  }

  setLut(key, size, data) {
    if (this.lutKey === key) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE2);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size * size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    this.lutKey = key;
  }

  // src: video/img/canvas; w,h: çıkış boyutu; p: parametreler
  process(src, w, h, p) {
    const gl = this.gl;
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return null; }
    const c = p.color || {};
    const u = this.u;
    gl.uniform1f(u.exposure, c.exposure || 0);
    gl.uniform1f(u.contrast, c.contrast ?? 1);
    gl.uniform1f(u.sat, c.sat ?? 1);
    gl.uniform1f(u.vib, c.vib || 0);
    gl.uniform1f(u.temp, c.temp || 0);
    gl.uniform1f(u.tint, c.tint || 0);
    gl.uniform1f(u.shadows, c.shadows || 0);
    gl.uniform1f(u.highlights, c.highlights || 0);
    gl.uniform1i(u.curveOn, p.curve ? 1 : 0);
    if (p.curve) this.setCurve(p.curve.key, p.curve.data);
    gl.uniform1i(u.lutOn, p.lut ? 1 : 0);
    if (p.lut) { this.setLut(p.lut.key, p.lut.size, p.lut.data); gl.uniform1f(u.lutSize, p.lut.size); gl.uniform1f(u.lutMix, p.lut.mix ?? 1); }
    const k = p.key;
    gl.uniform1i(u.keyOn, k ? 1 : 0);
    if (k) {
      gl.uniform3f(u.keyColor, k.rgb[0], k.rgb[1], k.rgb[2]);
      gl.uniform1f(u.keyTol, k.tol ?? 0.1); gl.uniform1f(u.keySoft, k.soft ?? 0.08); gl.uniform1f(u.keySpill, k.spill ?? 0.5);
    }
    gl.uniform1i(u.fx, p.fx || 0);
    gl.uniform1f(u.fxAmt, p.fxAmt ?? 1);
    gl.uniform1f(u.time, p.time || 0);
    gl.uniform1f(u.uvZoom, p.zoom || 1);
    gl.uniform1f(u.uvRot, p.rot || 0);
    gl.uniform2f(u.uvOff, p.offX || 0, p.offY || 0);
    gl.uniform2f(u.res, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}

let grader = null;
export function getGrader() {
  if (grader === null) {
    try { grader = new Grader(); if (!grader.ok) grader = false; } catch (e) { console.warn('WebGL yok', e); grader = false; }
  }
  return grader || null;
}

// ---------- renk yardımcıları ----------
export const COLOR_BASE = { exposure: 0, contrast: 1, sat: 1, vib: 0, temp: 0, tint: 0, shadows: 0, highlights: 0 };

export function colorActive(c) {
  if (!c) return false;
  return Object.keys(COLOR_BASE).some((k) => Math.abs((c[k] ?? COLOR_BASE[k]) - COLOR_BASE[k]) > 1e-3);
}

export function hexToRgb(hex) {
  let c = (hex || '#00ff00').replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------- Eğriler (monoton kübik) ----------
function monotone(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  const n = p.length;
  const out = new Float32Array(256);
  if (n < 2) { for (let i = 0; i < 256; i++) out[i] = i / 255; return out; }
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(p[i + 1][0] - p[i][0] || 1e-6); dy.push((p[i + 1][1] - p[i][1]) / (dx[i])); }
  m.push(dy[0]);
  for (let i = 1; i < n - 1; i++) m.push(dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2);
  m.push(dy[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(dy[i]) < 1e-9) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / dy[i], b = m[i + 1] / dy[i], s = a * a + b * b;
    if (s > 9) { const tt = 3 / Math.sqrt(s); m[i] = tt * a * dy[i]; m[i + 1] = tt * b * dy[i]; }
  }
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    let k = 0;
    if (x <= p[0][0]) { out[i] = p[0][1]; continue; }
    if (x >= p[n - 1][0]) { out[i] = p[n - 1][1]; continue; }
    while (k < n - 2 && x > p[k + 1][0]) k++;
    const h = dx[k], tt = (x - p[k][0]) / h;
    const h00 = 2 * tt ** 3 - 3 * tt ** 2 + 1, h10 = tt ** 3 - 2 * tt ** 2 + tt, h01 = -2 * tt ** 3 + 3 * tt ** 2, h11 = tt ** 3 - tt ** 2;
    out[i] = h00 * p[k][1] + h10 * h * m[k] + h01 * p[k + 1][1] + h11 * h * m[k + 1];
  }
  return out;
}

export const CURVE_IDENTITY = [[0, 0], [1, 1]];

export function curveActive(cv) {
  if (!cv) return false;
  return ['m', 'r', 'g', 'b'].some((ch) => cv[ch] && !(cv[ch].length === 2 && cv[ch][0][0] === 0 && cv[ch][0][1] === 0 && cv[ch][1][0] === 1 && cv[ch][1][1] === 1));
}

const curveCache = new Map();
export function curveData(cv) {
  const key = JSON.stringify(cv);
  if (curveCache.has(key)) return { key, data: curveCache.get(key) };
  const M = monotone(cv.m || CURVE_IDENTITY), R = monotone(cv.r || CURVE_IDENTITY), G = monotone(cv.g || CURVE_IDENTITY), B = monotone(cv.b || CURVE_IDENTITY);
  const look = (arr, x) => arr[Math.max(0, Math.min(255, Math.round(x * 255)))];
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const mi = M[i];
    data[i * 4] = Math.round(Math.max(0, Math.min(1, look(R, mi))) * 255);
    data[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, look(G, mi))) * 255);
    data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, look(B, mi))) * 255);
    data[i * 4 + 3] = 255;
  }
  if (curveCache.size > 30) curveCache.clear();
  curveCache.set(key, data);
  return { key, data };
}
export { monotone as curveSamples };

// ---------- 3D LUT ----------
// .cube ayrıştır -> { size, data: Uint8Array (size*size genişlik, size yükseklik) }
export function parseCube(text) {
  let size = 0;
  const vals = [];
  let dmin = [0, 0, 0], dmax = [1, 1, 1];
  text.split(/\r?\n/).forEach((line) => {
    const l = line.trim();
    if (!l || l[0] === '#') return;
    if (/^LUT_3D_SIZE/i.test(l)) { size = parseInt(l.split(/\s+/)[1], 10); return; }
    if (/^DOMAIN_MIN/i.test(l)) { dmin = l.split(/\s+/).slice(1).map(Number); return; }
    if (/^DOMAIN_MAX/i.test(l)) { dmax = l.split(/\s+/).slice(1).map(Number); return; }
    if (/^[A-Za-z]/.test(l)) return;
    const p = l.split(/\s+/).map(Number);
    if (p.length >= 3 && p.every((x) => !Number.isNaN(x))) vals.push(p);
  });
  if (!size || size > 65 || vals.length < size ** 3) throw new Error('Geçerli bir 3D .cube dosyası değil');
  return packLut(size, (r, g, b) => {
    const v = vals[r + g * size + b * size * size];
    return [0, 1, 2].map((i) => (v[i] - dmin[i]) / ((dmax[i] - dmin[i]) || 1));
  });
}

export function packLut(size, fn) {
  const data = new Uint8Array(size * size * size * 4);
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const v = fn(r, g, b, size);
    const x = b * size + r, y = g;
    const o = (y * size * size + x) * 4;
    data[o] = Math.round(Math.max(0, Math.min(1, v[0])) * 255);
    data[o + 1] = Math.round(Math.max(0, Math.min(1, v[1])) * 255);
    data[o + 2] = Math.round(Math.max(0, Math.min(1, v[2])) * 255);
    data[o + 3] = 255;
  }
  return { size, data };
}

// Uygulamanın kendi ürettiği LUT'lar (lisans gerektirmez)
const smooth = (x) => x * x * (3 - 2 * x);
const lumOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mixv = (a, b, t) => a + (b - a) * t;
export const BUILTIN_LUTS = [
  ['tealorange', 'Teal & Orange', (r, g, b) => {
    const l = lumOf(r, g, b);
    const k = smooth(l);
    return [mixv(r, mixv(0.1, 1.0, l), 0.25 * k + 0.05), mixv(g, mixv(0.35, 0.75, l), 0.15), mixv(b, mixv(0.45, 0.55, l), 0.3 * (1 - k))];
  }],
  ['warmfilm', 'Sıcak Film', (r, g, b) => [Math.min(1, smooth(r) * 0.9 + 0.08), smooth(g) * 0.88 + 0.06, smooth(b) * 0.72 + 0.08]],
  ['coldnight', 'Soğuk Gece', (r, g, b) => { const l = lumOf(r, g, b); return [r * 0.8 + l * 0.05, g * 0.92 + l * 0.04, Math.min(1, b * 1.08 + 0.06)]; }],
  ['bleach', 'Bleach Bypass', (r, g, b) => { const l = lumOf(r, g, b); const c = (x) => smooth(smooth(x)); return [mixv(c(r), c(l), 0.55), mixv(c(g), c(l), 0.55), mixv(c(b), c(l), 0.55)]; }],
  ['stadium', 'Stadyum Canlı', (r, g, b) => { const l = lumOf(r, g, b); const s = 1.35; return [l + (r - l) * s, l + (g - l) * s * 1.05, l + (b - l) * s].map((x) => smooth(Math.max(0, Math.min(1, x)))); }],
  ['purple', 'Mor Rüya', (r, g, b) => { const l = lumOf(r, g, b); return [mixv(r, l + 0.12, 0.25), g * 0.86, Math.min(1, mixv(b, l + 0.2, 0.35) + 0.04)]; }],
  ['mono', 'Kontrast S/B', (r, g, b) => { const l = smooth(smooth(lumOf(r, g, b))); return [l, l, l]; }],
];

const builtinCache = new Map();
export function builtinLut(id) {
  if (builtinCache.has(id)) return builtinCache.get(id);
  const def = BUILTIN_LUTS.find((x) => x[0] === id);
  if (!def) return null;
  const n = 17;
  const lut = packLut(n, (r, g, b) => def[2](r / (n - 1), g / (n - 1), b / (n - 1)));
  builtinCache.set(id, lut);
  return lut;
}

// ---------- nesneden işleme parametreleri ----------
export const lutStore = new Map(); // kullanıcı LUT'ları: id -> { name, size, data }

export function gradeParams(o) {
  if (!o) return null;
  const p = {};
  let any = false;
  if (colorActive(o.color)) { p.color = o.color; any = true; }
  if (curveActive(o.curves)) { p.curve = curveData(o.curves); any = true; }
  if (o.lut && o.lut.id) {
    const L = o.lut.id.startsWith('b:') ? builtinLut(o.lut.id.slice(2)) : lutStore.get(o.lut.id);
    if (L) { p.lut = { key: o.lut.id, size: L.size, data: L.data, mix: o.lut.mix ?? 1 }; any = true; }
  }
  if (o.key && o.key.on) { p.key = { rgb: hexToRgb(o.key.color), tol: o.key.tol ?? 0.1, soft: o.key.soft ?? 0.08, spill: o.key.spill ?? 0.5 }; any = true; }
  return any ? p : null;
}

// Görüntüyü (gerekirse küçülterek) işle; işlenemezse kaynağı döndür
export function gradeSource(el, sw, sh, p, maxSide = 1920) {
  const g = getGrader();
  if (!g || !p) return el;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  return g.process(el, sw * k, sh * k, p) || el;
}
