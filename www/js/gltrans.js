// Alpicut — gl-transitions geçiş motoru (WebGL, iki doku)
import { GL_TRANSITIONS as GL_BASE } from './gltrans-data.js';
import { HF_TRANSITIONS } from './gltrans-hf.js';
import { AI_TRANSITIONS } from './gltrans-ai.js';
import { PRO_TRANSITIONS } from './gltrans-pro.js';
// v1.6: yapay zekâ geçişleri + HyperFrames sinematik geçişleri en başta
const GL_TRANSITIONS = [...PRO_TRANSITIONS, ...AI_TRANSITIONS, ...HF_TRANSITIONS, ...GL_BASE];

const VS = 'attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

const TR_NAMES = {
  cube: 'Küp', Directional: 'Yönlü kaydırma', DoomScreenTransition: 'Doom erime', ButterflyWaveScrawler: 'Kelebek dalga', CrossZoom: 'Çapraz zoom',
  Dreamy: 'Rüya', GlitchMemories: 'Glitch anılar', GridFlip: 'Izgara çevir', InvertedPageCurl: 'Sayfa kıvrımı', LinearBlur: 'Doğrusal bulanık',
  Mosaic: 'Mozaik', PolkaDotsCurtain: 'Puantiye perde', Radial: 'Radyal', SimpleZoom: 'Basit zoom', StereoViewer: 'Stereo', Swirl: 'Girdap',
  WaterDrop: 'Su damlası', ZoomInCircles: 'Çemberlerle zoom', angular: 'Açısal', burn: 'Yanma', circle: 'Çember', circleopen: 'Çember aç',
  colorphase: 'Renk fazı', crosshatch: 'Tarama', crosswarp: 'Çapraz bükme', directionalwarp: 'Yönlü bükme', directionalwipe: 'Yönlü silme',
  doorway: 'Kapı', fade: 'Solma', fadecolor: 'Renkle solma', fadegrayscale: 'Griye solma', flyeye: 'Sinek gözü', heart: 'Kalp',
  hexagonalize: 'Altıgen', kaleidoscope: 'Kaleydoskop', luminance_melt: 'Işık erimesi', morph: 'Dönüşüm', multiply_blend: 'Çarp karışım',
  perlin: 'Perlin', pinwheel: 'Fırıldak', pixelize: 'Pikselleş', polar_function: 'Kutupsal', randomsquares: 'Rastgele kareler', ripple: 'Dalgalanma',
  rotate_scale_fade: 'Dön-ölçekle-sol', squareswire: 'Kare tel', squeeze: 'Sıkıştır', swap: 'Değiş tokuş', undulatingBurnOut: 'Dalgalı yanma',
  wind: 'Rüzgâr', windowblinds: 'Panjur', windowslice: 'Pencere dilim', wipeDown: 'Aşağı silme', wipeLeft: 'Sola silme', wipeRight: 'Sağa silme',
  wipeUp: 'Yukarı silme', Bounce: 'Zıplama', BookFlip: 'Kitap çevir', Box: 'Kutu', CircleCrop: 'Çember kırp', ColourDistance: 'Renk mesafesi',
  FilmBurn: 'Film yanığı', Overexposure: 'Aşırı pozlama', PolkaDots: 'Puantiye', Rolls: 'Yuvarlan', RotateScaleVanish: 'Dön ve kaybol',
  StaticFade: 'Parazitle solma', TVStatic: 'TV paraziti', TopBottom: 'Üst-alt', ZoomLeftWipe: 'Zoom sola silme', ZoomRigthWipe: 'Zoom sağa silme',
  ZoomInCirclesWave: 'Zoom dalga', AdvancedMosaic: 'Gelişmiş mozaik', BlockDissolve: 'Blok çözülme', BowTieHorizontal: 'Papyon yatay', BowTieVertical: 'Papyon dikey',
  Dreamy2: 'Rüya 2', DreamyZoom: 'Rüya zoom', Hexagonalize: 'Altıgen', Lens: 'Mercek', RandomNoisex: 'Gürültü', Slides: 'Slaytlar',
  coord_from_in: 'Koordinat', hexagonal_shards: 'Altıgen kırıklar', powerKaleido: 'Güçlü kaleydoskop', scale_in: 'İçe ölçekle', static_wipe: 'Parazit silme',
};

export function trName(id) {
  if (TR_NAMES[id]) return TR_NAMES[id];
  return id.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

export const GL_LIST = GL_TRANSITIONS.map((t) => ({ id: `gl:${t.id}`, raw: t.id, name: t.name || trName(t.id), author: t.author, license: t.license }));

class TransGL {
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    this.gl = gl;
    this.ok = !!gl;
    if (!gl) return;
    this.hp = !!(gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision);
    this.vs = this._sh(gl.VERTEX_SHADER, VS);
    this.progs = new Map();
    this.broken = new Set();
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.texA = this._tex(); this.texB = this._tex();
  }
  _sh(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const e = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(e); }
    return s;
  }
  _tex() {
    const gl = this.gl; const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  program(raw) {
    if (this.progs.has(raw)) return this.progs.get(raw);
    if (this.broken.has(raw)) return null;
    const def = GL_TRANSITIONS.find((t) => t.id === raw);
    if (!def) return null;
    const gl = this.gl;
    // v1.6: tam fragment biçimi (HyperFrames / Alpicut yapay zekâ geçişleri)
    const full = def.frag ? `precision ${this.hp ? 'highp' : 'mediump'} float;
varying vec2 v;
uniform sampler2D uFrom; uniform sampler2D uTo; uniform float progress; uniform float ratio; uniform vec2 u_resolution;
#define v_uv v
#define u_from uFrom
#define u_to uTo
#define u_progress progress
const vec3 u_accent = vec3(0.616, 0.549, 0.949);
const vec3 u_accent_dark = vec3(0.247, 0.180, 0.620);
const vec3 u_accent_bright = vec3(0.886, 0.851, 1.0);
${def.frag}` : null;
    const fs = full || `precision ${this.hp ? 'highp' : 'mediump'} float;
varying vec2 v;
uniform sampler2D uFrom; uniform sampler2D uTo; uniform float progress; uniform float ratio;
vec4 getFromColor(vec2 uv) { return texture2D(uFrom, uv); }
vec4 getToColor(vec2 uv) { return texture2D(uTo, uv); }
${def.glsl}
void main() { gl_FragColor = transition(v); }`;
    try {
      const pr = gl.createProgram();
      gl.attachShader(pr, this.vs); gl.attachShader(pr, this._sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      const P = { pr, loc: gl.getAttribLocation(pr, 'p'), uFrom: gl.getUniformLocation(pr, 'uFrom'), uTo: gl.getUniformLocation(pr, 'uTo'), progress: gl.getUniformLocation(pr, 'progress'), ratio: gl.getUniformLocation(pr, 'ratio'), res: gl.getUniformLocation(pr, 'u_resolution') };
      this.progs.set(raw, P);
      return P;
    } catch (e) {
      console.warn('geçiş derlenemedi', raw, e.message);
      this.broken.add(raw);
      return null;
    }
  }
  render(raw, a, b, progress, w, h) {
    const P = this.program(raw);
    if (!P) return null;
    const gl = this.gl;
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.useProgram(P.pr);
    gl.enableVertexAttribArray(P.loc); gl.vertexAttribPointer(P.loc, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texA); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texB); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, b);
    gl.uniform1i(P.uFrom, 0); gl.uniform1i(P.uTo, 1);
    gl.uniform1f(P.progress, progress); gl.uniform1f(P.ratio, w / h);
    if (P.res) gl.uniform2f(P.res, w, h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}

let inst = null;
export function transGL() {
  if (inst === null) { try { inst = new TransGL(); if (!inst.ok) inst = false; } catch (e) { inst = false; } }
  return inst || null;
}
