// Alpicut — yapay zekâ araçları: otomatik altyazı, metinden kurgu, dolgu kelime temizliği,
// arka plan silme, akıllı dikey kadraj, metinden sese, yapay zekâ asistanı
import { app, h, clone, fmt, toast, busy, uid, selected } from './state.js';
import { I } from './icons.js';
import { fields, openSheet, closeSheet, refreshSheet } from './sheets.js';
import { layoutClips } from './engine.js';
import { decodeMono } from './audiotools.js';
import { SUB_BASE } from './presets.js';
import { lsGet, lsSet } from './storage.js';

const SR16 = 16000;

// ================= proje sesini 16 kHz tek kanala karıştır =================
async function mixProjectAudio(opts = {}) {
  const P = app.P;
  const E = app.engine;
  const dur = E.duration();
  const out = new Float32Array(Math.ceil(dur * SR16) + SR16);
  const add = async (mediaId, tlStart, srcIn, srcOut, speed = 1, vol = 1) => {
    const m = E.media.get(mediaId);
    if (!m || m.kind === 'image') return;
    let a;
    try { a = await decodeMono(m, SR16); } catch (_) { return; }
    const i0 = Math.floor(srcIn * SR16), i1 = Math.min(a.data.length, Math.floor(srcOut * SR16));
    const o0 = Math.floor(tlStart * SR16);
    for (let i = i0, k = 0; i < i1; i += speed, k++) {
      const j = o0 + k;
      if (j >= out.length) break;
      out[j] += a.data[Math.floor(i)] * vol;
    }
  };
  for (const L of layoutClips(P.clips)) {
    const c = L.clip;
    if (c.type === 'image' || c.freeze || c.mute) continue;
    await add(c.mediaId, L.start, c.in, c.out, c.speed || 1, 1);
  }
  for (const a of P.audio) {
    if (a.mute) continue;
    const role = a.role || (a.sfx ? 'sfx' : 'music');
    if (role === 'sfx' || (role === 'music' && !opts.includeMusic)) continue;
    await add(a.mediaId, a.start, a.in, a.out, 1, 1);
  }
  for (const l of P.layers) {
    if (l.kind === 'media' && !l.mute && (l.volume ?? 0) > 0 && E.media.get(l.mediaId)?.kind === 'video') await add(l.mediaId, l.start, l.in || 0, (l.in || 0) + (l.end - l.start), 1, 1);
  }
  let pk = 0;
  for (let i = 0; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]));
  if (pk > 0.98) for (let i = 0; i < out.length; i++) out[i] /= pk;
  return { data: out, dur, peak: pk };
}

// ================= Whisper =================
let worker = null;
function asrWorker() {
  if (!worker) worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
  return worker;
}

export const ASR_LANGS = [['auto', 'Otomatik'], ['turkish', 'Türkçe'], ['english', 'İngilizce'], ['german', 'Almanca'], ['spanish', 'İspanyolca'], ['french', 'Fransızca'], ['arabic', 'Arapça'], ['portuguese', 'Portekizce'], ['italian', 'İtalyanca'], ['russian', 'Rusça']];
export const ASR_SIZES = [['tiny', 'Hızlı (~45 MB)'], ['base', 'Dengeli (~80 MB)'], ['small', 'En doğru (~250 MB)']];

function runWhisper(audio, size, language, onMsg) {
  return new Promise((resolve, reject) => {
    const w = asrWorker();
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'done') resolve(m);
      else if (m.type === 'error') reject(new Error(m.message));
      else onMsg(m);
    };
    w.onerror = (e) => reject(new Error(e.message || 'İşçi hatası'));
    w.postMessage({ cmd: 'run', audio, size, language, wordLevel: true });
  });
}

// kelimelerden altyazı satırları oluştur
function buildCues(words, maxWords = 5, maxDur = 2.6) {
  const cues = [];
  let cur = [];
  const flush = () => { if (!cur.length) return; cues.push({ start: cur[0].s, end: cur[cur.length - 1].e, text: cur.map((w) => w.t).join(' '), words: cur.map((w) => ({ ...w })) }); cur = []; };
  words.forEach((w) => {
    if (cur.length && (cur.length >= maxWords || w.e - cur[0].s > maxDur || w.s - cur[cur.length - 1].e > 0.6)) flush();
    cur.push(w);
    if (/[.!?…]$/.test(w.t)) flush();
  });
  flush();
  cues.forEach((c, i) => { const n = cues[i + 1]; if (n && c.end > n.start) c.end = n.start; if (c.end - c.start < 0.25) c.end = c.start + 0.25; });
  return cues;
}

export function openAutoCaptions() {
  const st = { size: lsGet('alpicut.asrSize', 'base'), lang: lsGet('alpicut.asrLang', 'turkish'), music: false, maxWords: 4, running: false, log: '', pct: 0 };
  openSheet({
    title: 'Otomatik altyazı', tall: true,
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Konuşma <b>telefonunun içinde</b> yapay zekâ (Whisper) ile yazıya dökülür; ses hiçbir sunucuya gönderilmez. İlk kullanımda model bir kez indirilir (internet gerekir), sonra internetsiz çalışır. Kelimeler gerçek zamanlarıyla gelir; kelime vurgulu altyazı tam senkron olur.' }));
      if (st.running) {
        const bar = h('i', { style: { width: `${st.pct}%` } });
        body.append(h('div', { class: 'big-pct' }, `${Math.round(st.pct)}%`), h('div', { class: 'progress' }, bar), h('p', { class: 'hint' }, st.log));
        return;
      }
      body.append(fields(st, [
        { label: 'Dil', path: 'lang', type: 'chips', options: ASR_LANGS },
        { label: 'Model', path: 'size', type: 'chips', options: ASR_SIZES },
        { label: 'Satır başına en çok kelime', path: 'maxWords', type: 'range', min: 1, max: 10, step: 1, def: 4 },
        { label: 'Müzik izlerini de dinle', path: 'music', type: 'toggle' },
      ]));
      body.append(h('p', { class: 'hint', html: 'Not: Video kliplerin sesi ve <b>Konuşma</b> grubundaki ses dosyaları (seslendirme) dinlenir. Uzun videolarda işlem birkaç dakika sürebilir.' }));
      body.append(h('button', { class: 'btn block primary', html: `${I.ai} Altyazıyı oluştur`, onclick: async () => {
        lsSet('alpicut.asrSize', st.size); lsSet('alpicut.asrLang', st.lang);
        st.running = true; st.log = 'Ses hazırlanıyor…'; st.pct = 2; refreshSheet();
        const files = {};
        try {
          const mix = await mixProjectAudio({ includeMusic: st.music });
          if (mix.peak < 0.005) throw new Error('Projede konuşma sesi bulunamadı');
          const res = await runWhisper(mix.data, st.size, st.lang, (m) => {
            if (m.type === 'download') {
              files[m.file] = [m.loaded, m.total];
              const L = Object.values(files).reduce((a, x) => a + x[0], 0), T = Object.values(files).reduce((a, x) => a + x[1], 0);
              st.pct = 2 + (L / Math.max(1, T)) * 60; st.log = `Model indiriliyor… ${(L / 1048576).toFixed(0)} / ${(T / 1048576).toFixed(0)} MB`;
            } else if (m.type === 'status') { st.log = m.text; if (/çevriliyor/.test(m.text)) st.pct = Math.max(st.pct, 65); }
            refreshSheet();
          });
          let words = [];
          (res.chunks || []).forEach((c) => {
            const [s, e] = c.timestamp || [];
            const text = (c.text || '').trim();
            if (!text || s == null) return;
            if (res.segment) {
              // cümle zamanı: kelimelere orantılı dağıt
              const ws = text.split(/\s+/); const end = e ?? s + 2; const tot = ws.reduce((a, w) => a + w.length + 1, 0);
              let acc = s;
              ws.forEach((w) => { const d = ((w.length + 1) / tot) * (end - s); words.push({ t: w, s: acc, e: acc + d }); acc += d; });
            } else words.push({ t: text, s, e: e ?? s + 0.3 });
          });
          words = words.filter((w) => w.t && !/^\[.*\]$/.test(w.t));
          if (!words.length) throw new Error('Konuşma algılanamadı');
          const P = app.P;
          if (!P.subs) P.subs = clone(SUB_BASE);
          P.subs.cues = buildCues(words, st.maxWords);
          P.subs.offset = 0;
          P.subs.words = words;
          P.subs.source = res.segment ? 'asr-segment' : 'asr-word';
          app.commit();
          closeSheet();
          toast(`${P.subs.cues.length} altyazı satırı oluşturuldu${res.segment ? ' (yaklaşık kelime zamanı)' : ''}`, 3500);
          setTimeout(() => app.select({ type: 'subs', id: 'subs' }, 'Stil'), 250);
        } catch (e) {
          st.running = false; refreshSheet();
          toast(/fetch|network|Failed/i.test(e.message) ? 'Model indirilemedi — internet bağlantısını kontrol et' : (e.message || 'Altyazı oluşturulamadı'), 4500);
        }
      } }));
    },
  });
}

// ================= Metinden kurgu + dolgu kelimeler =================
const FILLERS = new Set(['ııı', 'ıı', 'ııh', 'eee', 'ee', 'eeh', 'ehh', 'ımm', 'hmm', 'mmm', 'şey', 'yani', 'hani', 'işte', 'um', 'uh', 'umm', 'uhh', 'erm', 'aa', 'aaa', 'öö', 'ööö']);
const clean = (w) => w.toLocaleLowerCase('tr-TR').replace(/[^\p{L}]/gu, '');

export function openTranscript() {
  const P = app.P;
  const words = P.subs?.words?.length ? P.subs.words : (P.subs?.cues || []).flatMap((c) => (c.words || []).map((w) => ({ ...w })));
  if (!words.length) { toast('Önce “Otomatik altyazı” ile konuşmayı yazıya dök'); openAutoCaptions(); return; }
  const off = P.subs.offset || 0;
  const del = new Set();
  openSheet({
    title: 'Metinden kurgu', tall: true,
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Kelimeye dokununca oraya gidilir; <b>uzun bas</b> veya <b>Seç</b> modunda dokun = kesilecek olarak işaretle. Kesimler videodan, seslerden ve altyazıdan birlikte çıkarılır (kelime kenarlarında pay bırakılır).' }));
      const mode = body.dataset.mode || 'jump';
      body.append(h('div', { class: 'btn-row three' },
        h('button', { class: `btn${mode === 'jump' ? ' primary' : ''}`, onclick: () => { body.dataset.mode = 'jump'; refreshSheet(); } }, 'Git'),
        h('button', { class: `btn${mode === 'select' ? ' primary' : ''}`, onclick: () => { body.dataset.mode = 'select'; refreshSheet(); } }, 'Seç'),
        h('button', { class: 'btn', onclick: () => { words.forEach((w, i) => { if (FILLERS.has(clean(w.t))) del.add(i); }); refreshSheet(); toast(`${[...del].length} kelime işaretli`); } }, 'Dolgu kelimeler')));
      const box = h('div', { class: 'transcript' });
      const now = app.engine.t - off;
      words.forEach((w, i) => {
        const sp = h('span', { class: `tw${del.has(i) ? ' del' : ''}${now >= w.s && now < w.e ? ' now' : ''}${FILLERS.has(clean(w.t)) ? ' fill' : ''}` }, w.t + ' ');
        let pressT = null;
        sp.addEventListener('pointerdown', () => { pressT = setTimeout(() => { pressT = 'long'; if (del.has(i)) del.delete(i); else del.add(i); refreshSheet(); }, 450); });
        sp.addEventListener('pointerup', () => {
          if (pressT === 'long') { pressT = null; return; }
          clearTimeout(pressT); pressT = null;
          if ((body.dataset.mode || 'jump') === 'select') { if (del.has(i)) del.delete(i); else del.add(i); refreshSheet(); }
          else { app.engine.seek(w.s + off + 0.01); app.updateTime(); app.syncScroll(); refreshSheet(); }
        });
        box.append(sp);
      });
      body.append(box);
      const sel = [...del].sort((a, b) => a - b);
      if (sel.length) {
        // ardışık kelimeleri aralıklara birleştir
        const ranges = [];
        sel.forEach((i) => {
          const w = words[i];
          const last = ranges[ranges.length - 1];
          if (last && last.i === i - 1) { last.e = w.e; last.i = i; } else ranges.push({ s: w.s, e: w.e, i });
        });
        const tot = ranges.reduce((a, r) => a + r.e - r.s, 0);
        body.append(h('p', { class: 'hint', html: `<b>${sel.length}</b> kelime · <b>${ranges.length}</b> kesim · ${tot.toFixed(1)} sn` }));
        body.append(h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => { del.clear(); refreshSheet(); } }, 'Temizle'),
          h('button', { class: 'btn primary', onclick: () => {
            const pad = 0.04;
            const tl = ranges.map((r) => ({ s: r.s + off + pad, e: r.e + off - pad })).filter((r) => r.e - r.s > 0.05);
            closeSheet();
            app.cutTimelineRanges(tl);
            // transkriptten kaldır
            const keep = words.filter((_, i) => !del.has(i));
            let shift = 0;
            const ord = [...tl].sort((a, b) => a.s - b.s);
            const shifted = keep.map((w) => {
              const t = w.s + off;
              shift = ord.filter((r) => r.e <= t + 1e-3).reduce((a, r) => a + (r.e - r.s), 0);
              return { ...w, s: w.s - shift, e: w.e - shift };
            });
            P.subs.words = shifted;
            P.subs.cues = buildCues(shifted, 4);
            app.commit();
          } }, 'Kesimleri uygula')));
      }
    },
  });
}

// ================= Arka plan silme =================
export function bgRemoveTab(body, o) {
  if (!o.bgr) o.bgr = { on: false, threshold: 0.5, edge: 0.15, feather: 2, mode: 'transparent', color: '#00B140', blur: 30 };
  const isClip = !!o.type;
  body.append(h('p', { class: 'hint', html: 'Yapay zekâ kişiyi algılar ve arka planı siler (cihaz üzerinde, internetsiz). Yeşil perde gerekmez. En iyi sonuç: kişi net ve yakın planda.' }));
  body.append(fields(o, [
    { label: 'Arka planı sil', path: 'bgr.on', type: 'toggle', rerender: true, post: async (ob) => { if (ob.bgr.on) { const b = busy('Yapay zekâ modeli yükleniyor…'); try { const S = await import('./seg.js'); await S.initSegmenter(); app.engine.seg = S; app.engine.requestDraw(); } catch (e) { ob.bgr.on = false; toast(e.message || 'Model yüklenemedi', 4000); } finally { b.close(); refreshSheet(); } } } },
  ]));
  if (!o.bgr.on) return;
  body.append(fields(o, [
    { label: 'Yerine', path: 'bgr.mode', type: 'chips', options: isClip ? [['blur', 'Bulanık arka plan'], ['color', 'Renk'], ['transparent', 'Siyah']] : [['transparent', 'Saydam'], ['color', 'Renk'], ['blur', 'Bulanık']], rerender: true },
    { label: 'Renk', path: 'bgr.color', type: 'color', hide: o.bgr.mode !== 'color' },
    { label: 'Bulanıklık', path: 'bgr.blur', type: 'range', min: 5, max: 80, step: 1, def: 30, hide: o.bgr.mode !== 'blur' },
    { label: 'Hassasiyet', path: 'bgr.threshold', type: 'range', min: 0.15, max: 0.85, step: 0.01, def: 0.5, fmt: (x) => `${Math.round(x * 100)}%` },
    { label: 'Kenar yumuşaklığı', path: 'bgr.edge', type: 'range', min: 0.02, max: 0.4, step: 0.01, def: 0.15, fmt: (x) => `${Math.round(x * 100)}%` },
    { label: 'Kenar bulanıklığı', path: 'bgr.feather', type: 'range', min: 0, max: 12, step: 0.5, def: 2 },
  ]));
  body.append(h('p', { class: 'hint', html: 'İpucu: Kişiyi başka bir videonun üstüne koymak için bu videoyu <b>Katman</b> olarak ekle ve arka planı <b>Saydam</b> yap. Önizleme hızı için oynatırken model düşük çözünürlükte çalışır; dışa aktarmada tam kalite kullanılır.' }));
}

// ================= Akıllı dikey kadraj (yüz takibi) =================
export async function smartReframe(c) {
  const E = app.engine;
  const m = E.media.get(c.mediaId);
  if (!m || m.kind !== 'video') { toast('Bu araç video klipler içindir'); return; }
  const b = busy('Yüzler analiz ediliyor…');
  try {
    const S = await import('./seg.js');
    await S.initFaces();
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.src = m.url; v.preload = 'auto';
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j(new Error('Video açılamadı')); });
    const speed = c.speed || 1;
    const len = (c.out - c.in) / speed;
    const step = Math.max(0.33, len / 40);
    const pts = [];
    for (let t = 0; t <= len + 1e-3; t += step) {
      v.currentTime = Math.min(c.out - 0.05, c.in + t * speed);
      await new Promise((r) => { v.onseeked = r; });
      const f = S.detectFaces(v, v.videoWidth, v.videoHeight);
      const best = f.sort((a, z) => z.w * z.h * z.score - a.w * a.h * a.score)[0];
      pts.push({ t, x: best ? best.x : null });
      b.set(`Yüzler analiz ediliyor… %${Math.round((t / len) * 100)}`);
    }
    // boşlukları doldur + yumuşat
    let last = pts.find((p) => p.x != null)?.x ?? 0.5;
    pts.forEach((p) => { if (p.x == null) p.x = last; else last = p.x; });
    const sm = pts.map((p, i) => { const a = pts.slice(Math.max(0, i - 2), i + 3); return { t: p.t, x: a.reduce((s, q) => s + q.x, 0) / a.length }; });
    // panX: cover kırpmada -1 (sol) .. 1 (sağ)
    const [W, H] = [E.W, E.H];
    const vr = v.videoWidth / v.videoHeight, pr = W / H;
    if (vr <= pr) { toast('Bu video zaten dikey; kadraja gerek yok'); return; }
    const visible = pr / vr; // görünen genişlik oranı
    const toPan = (x) => Math.max(-1, Math.min(1, (x - 0.5) / ((1 - visible) / 2)));
    c.fit = 'cover';
    c.kf = c.kf || {};
    const keys = [];
    sm.forEach((p) => { const v2 = toPan(p.x); if (!keys.length || Math.abs(keys[keys.length - 1].v - v2) > 0.04) keys.push({ t: p.t, v: +v2.toFixed(3), ease: 'inout' }); });
    c.kf.panX = keys.length > 1 ? keys : undefined;
    if (keys.length <= 1) { c.panX = keys[0]?.v ?? 0; delete c.kf.panX; }
    app.commit();
    toast(`Akıllı kadraj uygulandı (${keys.length} hareket noktası)`);
  } catch (e) { toast(e.message || 'Analiz edilemedi', 4000); } finally { b.close(); }
}

// ================= Metinden sese (Piper) =================
export const TTS_VOICES = [
  ['tr_TR-dfki-medium', 'Türkçe · Erkek (dfki)'], ['tr_TR-fahrettin-medium', 'Türkçe · Erkek 2'], ['tr_TR-fettah-medium', 'Türkçe · Erkek 3'],
  ['en_US-hfc_female-medium', 'İngilizce · Kadın'], ['en_US-ryan-medium', 'İngilizce · Erkek'], ['en_GB-alba-medium', 'İngilizce (UK) · Kadın'],
  ['de_DE-thorsten-medium', 'Almanca · Erkek'], ['es_ES-davefx-medium', 'İspanyolca · Erkek'], ['fr_FR-siwis-medium', 'Fransızca · Kadın'], ['ar_JO-kareem-medium', 'Arapça · Erkek'],
];

let ttsLib = null;
async function tts() {
  if (!ttsLib) ttsLib = import('../vendor/piper/piper-tts-web.js');
  return ttsLib;
}

export function openTTS(prefill) {
  const st = { text: prefill || '', voice: lsGet('alpicut.voice', 'tr_TR-dfki-medium'), speed: 1, running: false, log: '' };
  openSheet({
    title: 'Metinden sese', tall: true,
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Yazdığın metni doğal bir sesle okur (Piper, cihaz üzerinde). Her ses ilk kullanımda bir kez indirilir (~60 MB). Oluşan ses <b>Konuşma</b> grubuna normal bir ses klibi olarak eklenir.' }));
      if (st.running) { body.append(h('div', { class: 'spinner' }), h('p', { class: 'hint', style: { textAlign: 'center' } }, st.log)); return; }
      body.append(fields(st, [
        { label: 'Metin', path: 'text', type: 'textarea' },
        { label: 'Ses', path: 'voice', type: 'chips', options: TTS_VOICES },
      ]));
      if (app.P.subs?.cues?.length) body.append(h('button', { class: 'btn block', style: { marginBottom: '8px' }, onclick: () => { st.text = app.P.subs.cues.map((c) => c.text).join(' '); refreshSheet(); } }, 'Altyazı metnini kullan'));
      body.append(h('button', { class: 'btn block primary', html: `${I.sfx} Sesi oluştur ve ekle`, onclick: async () => {
        if (!st.text.trim()) { toast('Önce metin yaz'); return; }
        lsSet('alpicut.voice', st.voice);
        st.running = true; st.log = 'Ses modeli hazırlanıyor…'; refreshSheet();
        try {
          const T = await tts();
          const wav = await T.predict({ text: st.text.trim(), voiceId: st.voice }, (p) => {
            if (p && p.total) { st.log = `Ses indiriliyor… ${Math.round((p.loaded / p.total) * 100)}%`; refreshSheet(); }
          });
          const file = new File([wav], `Seslendirme_${st.voice.split('-')[1] || 'tts'}.wav`, { type: 'audio/wav' });
          const recs = await app.importFiles([file], true);
          if (recs[0]) {
            app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: app.engine.t, in: 0, out: recs[0].duration || 3, volume: 1, fadeIn: 0, fadeOut: 0, role: 'voice' });
            app.commit();
            toast('Seslendirme eklendi');
          }
          closeSheet();
        } catch (e) {
          st.running = false; refreshSheet();
          toast(/fetch|network|Failed/i.test(e.message || '') ? 'Ses indirilemedi — internet bağlantısını kontrol et' : (e.message || 'Ses oluşturulamadı'), 4500);
        }
      } }));
    },
  });
}

// ================= Yapay zekâ asistanı (kullanıcının kendi API anahtarı ile) =================
const AI_TASKS = [
  ['hooks', 'Hook başlık önerileri', 'Bu kısa video için dikkat çekici, Türkçe, en fazla 6 kelimelik 8 hook başlık öner. Sadece maddeler halinde yaz.'],
  ['title', 'Başlık + açıklama', 'Bu video için YouTube Shorts/Reels uyumlu 3 başlık ve 2-3 cümlelik bir açıklama yaz. Türkçe.'],
  ['tags', 'Hashtag', 'Bu video için 15 alakalı hashtag öner. Türkçe ve genel karışık. Tek satırda boşlukla ayır.'],
  ['chapters', 'Bölüm başlıkları', 'Aşağıdaki zaman damgalı altyazılardan YouTube bölümleri (00:00 Başlık formatında) çıkar.'],
  ['translate', 'Altyazıyı çevir', 'Aşağıdaki altyazı satırlarını İngilizceye çevir. Her satırı aynı sırada, numarasıyla birlikte ver: "1) ..."'],
  ['script', 'Senaryo yaz', 'Aşağıdaki konu için 30-45 saniyelik, ilk 2 saniyesi çok güçlü bir kısa video seslendirme metni yaz. Türkçe.'],
];

async function callAI(prompt) {
  const key = lsGet('alpicut.aiKey', '');
  const prov = lsGet('alpicut.aiProv', 'anthropic');
  const model = lsGet('alpicut.aiModel', '');
  if (!key) throw new Error('Önce API anahtarını gir');
  if (prov === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: model || 'claude-sonnet-5-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Hata ${r.status}`);
    return j.content.map((c) => c.text || '').join('');
  }
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Hata ${r.status}`);
  return j.choices[0].message.content;
}

export function openAssistant() {
  const st = { task: 'hooks', topic: '', out: '', running: false, key: lsGet('alpicut.aiKey', ''), prov: lsGet('alpicut.aiProv', 'anthropic'), model: lsGet('alpicut.aiModel', '') };
  openSheet({
    title: 'Yapay zekâ asistanı', tall: true, tabs: ['Asistan', 'Ayarlar'],
    render: (body, tab) => {
      if (tab === 'Ayarlar' || !lsGet('alpicut.aiKey', '')) {
        body.append(h('p', { class: 'hint', html: 'Asistan isteğe bağlıdır ve <b>kendi API anahtarınla</b> çalışır (kullanımı sağlayıcı faturalandırır). Anahtar yalnızca bu telefonda saklanır. Gönderilen veri: seçtiğin görev, yazdığın konu ve gerekiyorsa altyazı metni — video veya ses gönderilmez.' }));
        body.append(fields(st, [
          { label: 'Sağlayıcı', path: 'prov', type: 'chips', options: [['anthropic', 'Anthropic (Claude)'], ['openai', 'OpenAI']] },
          { label: 'API anahtarı', path: 'key', type: 'text' },
          { label: 'Model (boş = varsayılan)', path: 'model', type: 'text' },
        ]));
        body.append(h('button', { class: 'btn block primary', onclick: () => { lsSet('alpicut.aiKey', st.key.trim()); lsSet('alpicut.aiProv', st.prov); lsSet('alpicut.aiModel', st.model.trim()); toast('Kaydedildi'); refreshSheet(); } }, 'Kaydet'));
        if (lsGet('alpicut.aiKey', '')) body.append(h('button', { class: 'btn block danger', style: { marginTop: '6px' }, onclick: () => { lsSet('alpicut.aiKey', ''); st.key = ''; refreshSheet(); } }, 'Anahtarı sil'));
        return;
      }
      body.append(fields(st, [
        { label: 'Görev', path: 'task', type: 'chips', options: AI_TASKS.map(([id, n]) => [id, n]) },
        { label: 'Konu / not (isteğe bağlı)', path: 'topic', type: 'textarea' },
      ]));
      body.append(h('button', { class: 'btn block primary', disabled: st.running, html: `${I.ai} ${st.running ? 'Düşünüyor…' : 'Oluştur'}`, onclick: async () => {
        const t = AI_TASKS.find((x) => x[0] === st.task);
        const cues = app.P.subs?.cues || [];
        const subs = cues.map((c, i) => `${i + 1}) [${fmt(c.start + (app.P.subs.offset || 0))}] ${c.text}`).join('\n');
        const texts = app.P.layers.filter((l) => l.kind === 'text').map((l) => l.text.replace(/\*/g, '')).join(' / ');
        const prompt = `${t[2]}\n\nProje adı: ${app.P.name}\nVideodaki yazılar: ${texts || '-'}\nKonu/not: ${st.topic || '-'}\n${subs ? `Altyazılar:\n${subs.slice(0, 12000)}` : ''}`;
        st.running = true; refreshSheet();
        try { st.out = await callAI(prompt); } catch (e) { toast(e.message, 4500); }
        st.running = false; refreshSheet();
      } }));
      if (st.out) {
        const pre = h('div', { class: 'ai-out' }, st.out);
        body.append(pre);
        const lines = st.out.split('\n').map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean);
        const acts = h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => { navigator.clipboard?.writeText(st.out).then(() => toast('Kopyalandı')).catch(() => toast('Kopyalanamadı')); } }, 'Kopyala'),
          st.task === 'script' ? h('button', { class: 'btn primary', onclick: () => openTTS(st.out) }, 'Seslendir') : null);
        body.append(acts);
        if (st.task === 'hooks') {
          body.append(h('p', { class: 'hint' }, 'Bir başlığa dokun → videoya yazı olarak eklensin:'));
          const ch = h('div', { class: 'chips' });
          lines.slice(0, 10).forEach((l) => ch.append(h('button', { onclick: async () => { const { TEXT_BASE, TEXT_TEMPLATES } = await import('./presets.js'); app.addLayer({ ...clone(TEXT_BASE), ...clone(TEXT_TEMPLATES[0].p), text: l.replace(/^"|"$/g, '') }); } }, l)));
          body.append(ch);
        }
        if (st.task === 'translate' && cues.length) {
          body.append(h('button', { class: 'btn block', onclick: () => {
            const map = {};
            st.out.split('\n').forEach((l) => { const m = l.match(/^\s*(\d+)\)\s*(?:\[[^\]]*\]\s*)?(.*)$/); if (m) map[+m[1]] = m[2].trim(); });
            let n = 0;
            cues.forEach((c, i) => { if (map[i + 1]) { c.text = map[i + 1]; delete c.words; n++; } });
            app.commit(); toast(`${n} satır çevrildi`);
          } }, 'Çeviriyi altyazıya uygula'));
        }
      }
    },
  });
}

// ================= Yapay zekâ merkezi =================
export function openAIHub() {
  openSheet({
    title: 'Yapay zekâ araçları', tall: true,
    render: (body) => {
      const card = (ic, t, d, fn, tag) => h('button', { class: 'ai-card', onclick: fn }, h('span', { class: 'ai-ic', html: I[ic] }), h('span', { class: 'ai-t' }, h('b', {}, t), h('small', {}, d)), tag ? h('em', {}, tag) : null);
      body.append(
        card('subtitle', 'Otomatik altyazı', 'Konuşmayı kelime kelime zamanlı altyazıya çevir', openAutoCaptions, 'cihazda'),
        card('edit', 'Metinden kurgu', 'Metindeki kelimeleri silerek videoyu kes; dolgu kelimeleri temizle', openTranscript, 'cihazda'),
        card('adjust', 'Arka plan silme', 'Seçili klip/katmanda kişiyi ayır', () => { const o = selected(); if (!o || !(app.sel.type === 'clip' || o.kind === 'media')) { toast('Önce bir video klibe veya katmana dokun'); return; } app.openInspector('Arka plan'); }, 'cihazda'),
        card('ratio', 'Akıllı dikey kadraj', 'Yatay videoda yüzü takip ederek 9:16 kadrajla', () => { const o = selected(); if (!o || app.sel.type !== 'clip') { toast('Önce yatay bir video klibe dokun'); return; } closeSheet(); smartReframe(o); }, 'cihazda'),
        card('mic', 'Metinden sese', 'Yazdığın metni doğal sesle seslendir', () => openTTS(), 'cihazda'),
        card('silence', 'Sessizlikleri kes', 'Uzun duraklamaları bul ve çıkar', () => { const o = selected(); if (!o || !(app.sel.type === 'clip' || app.sel.type === 'audio')) { toast('Önce konuşma içeren bir klibe veya sese dokun'); return; } app.openSilenceFor(o); }, 'cihazda'),
        card('sfx', 'Gürültü giderme', 'Seste uğultu ve arka plan gürültüsünü temizle', () => { const o = selected(); if (!o || !(app.sel.type === 'clip' || app.sel.type === 'audio')) { toast('Önce bir klibe veya sese dokun'); return; } app.studioClean(o); }, 'cihazda'),
        card('ai', 'Yapay zekâ asistanı', 'Hook, başlık, hashtag, çeviri, bölüm, senaryo', openAssistant, 'API anahtarı'),
      );
    },
  });
}

// Proje açılırken arka plan silme kullanılıyorsa modeli hazırla
export async function prepareProjectAI(P) {
  const need = [...P.clips, ...P.layers].some((o) => o.bgr?.on);
  if (!need) return;
  try { const S = await import('./seg.js'); await S.initSegmenter(); app.engine.seg = S; app.engine.requestDraw(); } catch (e) { toast('Arka plan silme modeli yüklenemedi', 3500); }
}
