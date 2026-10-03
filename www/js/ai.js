// Alpicut — yapay zekâ araçları: otomatik altyazı, metinden kurgu, dolgu kelime temizliği,
// arka plan silme, akıllı dikey kadraj, metinden sese, yapay zekâ asistanı
import { app, h, clone, fmt, toast, busy, uid, selected } from './state.js';
import { I } from './icons.js';
import { fields, openSheet, closeSheet, refreshSheet } from './sheets.js';
import * as WM from './wm.js';
const curPanel = () => WM.cur();
const WMrefresh = (p) => { if (p) WM.refresh(p); };
const WMclose = (p) => { if (p) WM.close(p); };
import { layoutClips } from './engine.js';
import { decodeMono } from './audiotools.js';
import { SUB_BASE } from './presets.js';
import { lsGet, lsSet } from './storage.js';
import { PROVIDERS, getKey, setKey, getModel, setModel, hasKey, testKey, openExternal, chatProvider, setChatProvider, ask, transcribeOpenAI, agent } from './aiapi.js';
import { toWav } from './studio.js';

const SR16 = 16000;

// ================= proje sesini 16 kHz tek kanala karıştır =================
export async function mixProjectAudio(opts = {}) {
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
export const ASR_SIZES = [['base', 'Dengeli · önerilen (~80 MB)'], ['small', 'En doğru (~250 MB, yavaş)'], ['tiny', 'Çok hızlı (düşük doğruluk)']];

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

// enerjiye göre konuşma bölgeleri -> en çok maxLen sn'lik parçalar (sessizliklerden bölünür)
function speechChunks(x, sr, maxLen = 25) {
  const win = Math.round(sr * 0.03), n = Math.floor(x.length / win);
  const db = new Float32Array(n);
  for (let i = 0; i < n; i++) { let q = 0; for (let k = i * win; k < (i + 1) * win; k++) q += x[k] * x[k]; db[i] = 10 * Math.log10(q / win + 1e-12); }
  const sorted = Array.from(db).sort((a, b) => a - b);
  const floor = sorted[Math.floor(n * 0.1)] ?? -80, peak = sorted[Math.floor(n * 0.95)] ?? -20;
  const thr = Math.max(floor + 8, Math.min(peak - 25, -42));
  const voiced = Array.from(db, (v) => v > thr);
  // kısa boşlukları doldur (0.35 sn), kısa sesleri at (0.12 sn)
  const fill = Math.round(0.35 / 0.03), minOn = Math.round(0.12 / 0.03);
  const regs = [];
  let st = -1, gap = 0;
  for (let i = 0; i <= n; i++) {
    const v = i < n && voiced[i];
    if (v) { if (st < 0) st = i; gap = 0; } else if (st >= 0) { gap++; if (gap > fill || i === n) { const e = i - gap + 1; if (e - st >= minOn) regs.push([st, e]); st = -1; gap = 0; } }
  }
  if (!regs.length) return [{ s: 0, e: x.length / sr }];
  // bölgeleri maxLen'e kadar birleştir, kenarlara pay
  const out = [];
  let cur = null;
  regs.forEach(([a, b]) => {
    const s = Math.max(0, a * 0.03 - 0.25), e = Math.min(x.length / sr, b * 0.03 + 0.35);
    if (cur && e - cur.s <= maxLen) cur.e = e; else { if (cur) out.push(cur); cur = { s, e }; }
  });
  if (cur) out.push(cur);
  // tek parça maxLen'den uzunsa zorla böl
  return out.flatMap((p) => { const r = []; for (let t = p.s; t < p.e; t += maxLen) r.push({ s: t, e: Math.min(p.e, t + maxLen) }); return r; });
}
function normPeak(a) { let p = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > p) p = v; } const k = p > 1e-4 ? Math.min(8, 0.9 / p) : 1; const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] * k; return o; }

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

// Programlı otomatik altyazı (Alpi-co ve panel kullanır). Dönen: satır sayısı
export async function autoCaptions({ lang = 'turkish', size, provider, maxWords = 4, music = false, fix = false, onStatus = () => {}, onPct = () => {} } = {}) {
  const P = app.P;
  if (!P) throw new Error('Proje yok');
  provider = provider || lsGet('alpicut.asrProv', hasKey('openai') ? 'openai' : 'local');
  size = size || lsGet('alpicut.asrSize2', 'base');
  onStatus('Ses hazırlanıyor…'); onPct(2);
  const mix = await mixProjectAudio({ includeMusic: music });
  if (mix.peak < 0.005) throw new Error('Projede konuşma sesi bulunamadı');
  let words = [], segment = false;
  if (provider === 'openai') {
    onStatus('OpenAI Whisper ile yazıya dökülüyor…'); onPct(20);
    // 16 kHz WAV (25 MB sınırı ≈ 13 dk); uzun videoyu parçala
    const per = 600 * SR16;
    for (let o = 0; o < mix.data.length; o += per) {
      const part = mix.data.subarray(o, Math.min(mix.data.length, o + per));
      const j = await transcribeOpenAI(toWav(part, SR16), lang);
      const off = o / SR16;
      (j.words || []).forEach((w) => words.push({ t: String(w.word).trim(), s: w.start + off, e: w.end + off }));
      onPct(20 + (o / mix.data.length) * 70);
    }
  } else {
    // Konuşma bölgelerine göre ≤25 sn parçalar (doğru zamanlama, daha az uydurma, daha az bellek)
    const pieces = speechChunks(mix.data, SR16, 25);
    const files = {};
    let done = 0;
    for (const pc of pieces) {
      const audio = normPeak(mix.data.subarray(Math.floor(pc.s * SR16), Math.floor(pc.e * SR16)));
      const res = await runWhisper(audio, size, lang, (m) => {
        if (m.type === 'download') {
          files[m.file] = [m.loaded, m.total];
          const L = Object.values(files).reduce((x, y) => x + y[0], 0), T = Object.values(files).reduce((x, y) => x + y[1], 0);
          onPct(2 + (L / Math.max(1, T)) * 50); onStatus(`Model indiriliyor (ilk sefer)… ${(L / 1048576).toFixed(0)} / ${(T / 1048576).toFixed(0)} MB`);
        } else if (m.type === 'status' && /çevriliyor/.test(m.text)) onStatus(`Konuşma yazıya dökülüyor… (${done + 1}/${pieces.length})`);
      });
      segment = segment || !!res.segment;
      // zaman damgası doğrulaması: küçük modeller bazen tüm kelimeleri parçanın sonuna yığar
      const plen = pc.e - pc.s;
      const ts = (res.chunks || []).map((c) => c.timestamp?.[0]).filter((x) => x != null);
      const bad = !res.segment && ts.length > 1 && (Math.max(...ts) > plen + 0.6 || (ts[0] > plen * 0.75 && plen > 3));
      if (bad) {
        const all = (res.text || '').trim().split(/\s+/).filter(Boolean);
        const tot = all.reduce((x, w) => x + w.length + 1, 0) || 1;
        let acc = pc.s + 0.15; const span = Math.max(0.5, plen - 0.4);
        all.forEach((w) => { const d = ((w.length + 1) / tot) * span; words.push({ t: w, s: acc, e: acc + d }); acc += d; });
        done++; onPct(55 + (done / pieces.length) * 37);
        continue;
      }
      (res.chunks || []).forEach((c) => {
        const [st0, e0] = c.timestamp || [];
        const text = (c.text || '').trim();
        if (!text || st0 == null) return;
        const s0 = st0 + pc.s, e1 = (e0 ?? st0 + (res.segment ? 2 : 0.3)) + pc.s;
        if (res.segment) {
          const ws = text.split(/\s+/); const tot = ws.reduce((x, w) => x + w.length + 1, 0);
          let acc = s0;
          ws.forEach((w) => { const d = ((w.length + 1) / tot) * (e1 - s0); words.push({ t: w, s: acc, e: acc + d }); acc += d; });
        } else words.push({ t: text, s: s0, e: Math.min(e1, pc.e + 0.2) });
      });
      done++;
      onPct(55 + (done / pieces.length) * 37);
    }
    // belleği boşalt (telefonda uygulamanın kapanmasını önler)
    try { worker?.terminate(); } catch (_) { /* yoksay */ }
    worker = null;
  }
  words = words.filter((w) => w.t && !/^\[.*\]$/.test(w.t) && isFinite(w.s) && isFinite(w.e)).sort((x, y) => x.s - y.s);
  // halüsinasyon: aynı kelimenin art arda çok tekrarı
  words = words.filter((w, i) => !(i >= 3 && [1, 2, 3].every((k) => words[i - k].t === w.t)));
  if (!words.length) throw new Error('Konuşma algılanamadı');
  let cues = buildCues(words, maxWords);
  if (fix && chatProvider()) {
    onStatus('Yapay zekâ yazım ve noktalamayı düzeltiyor…'); onPct(92);
    try {
      const out = await ask(`Aşağıdaki otomatik altyazı satırlarındaki yazım, Türkçe karakter ve noktalama hatalarını düzelt. Anlamı ve kelime sayısını mümkün olduğunca koru. Satır sayısı AYNI kalsın. Sadece "numara) metin" biçiminde döndür.\n\n${cues.map((c, i) => `${i + 1}) ${c.text}`).join('\n')}`, { maxTokens: 4000 });
      const map = {};
      out.split('\n').forEach((l) => { const m = l.match(/^\s*(\d+)\)\s*(.*)$/); if (m) map[+m[1]] = m[2].trim(); });
      cues = cues.map((c, i) => {
        const t = map[i + 1];
        if (!t) return c;
        const ws = t.split(/\s+/);
        const nw = ws.length === c.words.length ? c.words.map((w, k) => ({ ...w, t: ws[k] })) : ws.map((w, k) => ({ t: w, s: c.start + ((c.end - c.start) * k) / ws.length, e: c.start + ((c.end - c.start) * (k + 1)) / ws.length }));
        return { ...c, text: t, words: nw };
      });
    } catch (e) { toast(`Düzeltme atlandı: ${e.message}`, 3500); }
  }
  if (!P.subs) P.subs = clone(SUB_BASE);
  P.subs.cues = cues;
  P.subs.offset = 0;
  P.subs.words = cues.flatMap((c) => c.words || []);
  P.subs.source = provider === 'openai' ? 'openai' : segment ? 'asr-segment' : 'asr-word';
  app.commit();
  onPct(100);
  return cues.length;
}

export function openAutoCaptions() {
  const st = { prov: lsGet('alpicut.asrProv', hasKey('openai') ? 'openai' : 'local'), size: lsGet('alpicut.asrSize2', 'base'), lang: lsGet('alpicut.asrLang', 'turkish'), music: false, maxWords: 4, fix: !!chatProvider(), running: false, log: '', pct: 0 };
  openSheet({
    id: 'captions', title: 'Otomatik altyazı',
    render: (body) => {
      if (st.running) {
        body.append(h('div', { class: 'big-pct' }, `${Math.round(st.pct)}%`), h('div', { class: 'progress' }, h('i', { style: { width: `${st.pct}%` } })), h('p', { class: 'hint', style: { textAlign: 'center' } }, st.log));
        body.append(h('p', { class: 'hint', style: { textAlign: 'center' } }, 'Bu paneli küçültüp (–) çalışmaya devam edebilirsin.'));
        return;
      }
      body.append(fields(st, [
        { label: 'Yöntem', path: 'prov', type: 'chips', options: [['local', 'Telefonda (ücretsiz, internetsiz)'], ['openai', `OpenAI Whisper (en doğru)${hasKey('openai') ? '' : ' · anahtar gerekli'}`]], rerender: true },
        { label: 'Dil', path: 'lang', type: 'chips', options: ASR_LANGS },
        { label: 'Model', path: 'size', type: 'chips', options: ASR_SIZES, hide: st.prov !== 'local' },
        { label: 'Satır başına en çok kelime', path: 'maxWords', type: 'range', min: 1, max: 10, step: 1, def: 4 },
        { label: 'Müzik izlerini de dinle', path: 'music', type: 'toggle' },
        { label: `Claude/ChatGPT ile yazımı düzelt${chatProvider() ? '' : ' (hesap bağlı değil)'}`, path: 'fix', type: 'toggle', hide: !chatProvider() },
      ]));
      body.append(h('p', { class: 'hint', html: st.prov === 'local'
        ? 'Konuşma <b>telefonunda</b> yazıya dökülür; ses hiçbir yere gönderilmez. İlk kullanımda model bir kez indirilir. "Hızlı" model düşük bellekli telefonlar içindir; daha doğru sonuç için <b>OpenAI</b> yöntemini kullan.'
        : 'Ses (sadece konuşma, 16 kHz) OpenAI\'ye gönderilir ve kelime zamanlı altyazı döner. Kendi API anahtarınla çalışır. Not: Claude ses dinleyemez; Claude yalnızca yazım düzeltmede kullanılır.' }));
      if (st.prov === 'openai' && !hasKey('openai')) { body.append(h('button', { class: 'btn block primary', html: `${I.key} OpenAI hesabını bağla`, onclick: () => openAccounts('openai') })); return; }
      body.append(h('button', { class: 'btn block primary', html: `${I.ai} Altyazıyı oluştur`, onclick: async () => {
        lsSet('alpicut.asrSize2', st.size); lsSet('alpicut.asrLang', st.lang); lsSet('alpicut.asrProv', st.prov);
        st.running = true; st.log = 'Ses hazırlanıyor…'; st.pct = 2; refreshSheet();
        const panel = curPanel();
        try {
          const n = await autoCaptions({ lang: st.lang, size: st.size, provider: st.prov, maxWords: st.maxWords, music: st.music, fix: st.fix, onStatus: (t) => { st.log = t; WMrefresh(panel); }, onPct: (p) => { st.pct = p; } });
          WMclose(panel);
          toast(`${n} altyazı satırı oluşturuldu`, 3500);
          setTimeout(() => app.select({ type: 'subs', id: 'subs' }, 'Stil'), 250);
        } catch (e) {
          st.running = false; WMrefresh(panel);
          toast(/fetch|network|Failed/i.test(e.message) ? 'Model indirilemedi — internet bağlantısını kontrol et' : (e.message || 'Altyazı oluşturulamadı'), 5000);
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

// ================= Metinden sese: tts.js =================
export { openTTS } from './tts.js';
import { openTTS } from './tts.js';

// ================= Yapay zekâ asistanı (kullanıcının kendi API anahtarı ile) =================
const AI_TASKS = [
  ['hooks', 'Hook başlık önerileri', 'Bu kısa video için dikkat çekici, Türkçe, en fazla 6 kelimelik 8 hook başlık öner. Sadece maddeler halinde yaz.'],
  ['title', 'Başlık + açıklama', 'Bu video için YouTube Shorts/Reels uyumlu 3 başlık ve 2-3 cümlelik bir açıklama yaz. Türkçe.'],
  ['tags', 'Hashtag', 'Bu video için 15 alakalı hashtag öner. Türkçe ve genel karışık. Tek satırda boşlukla ayır.'],
  ['chapters', 'Bölüm başlıkları', 'Aşağıdaki zaman damgalı altyazılardan YouTube bölümleri (00:00 Başlık formatında) çıkar.'],
  ['translate', 'Altyazıyı çevir', 'Aşağıdaki altyazı satırlarını İngilizceye çevir. Her satırı aynı sırada, numarasıyla birlikte ver: "1) ..."'],
  ['script', 'Senaryo yaz', 'Aşağıdaki konu için 30-45 saniyelik, ilk 2 saniyesi çok güçlü bir kısa video seslendirme metni yaz. Türkçe.'],
];

async function callAI(prompt) { return ask(prompt, { maxTokens: 1800 }); }

export function openAssistant() {
  const st = { task: 'hooks', topic: '', out: '', running: false, key: lsGet('alpicut.aiKey', ''), prov: lsGet('alpicut.aiProv', 'anthropic'), model: lsGet('alpicut.aiModel', '') };
  openSheet({
    title: 'Yapay zekâ asistanı', tall: true, tabs: ['Asistan', 'Ayarlar'],
    render: (body, tab) => {
      if (tab === 'Ayarlar' || !chatProvider()) { accountsBody(body); return; }
      if (false) {
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

// ================= Hesaplar (Claude / ChatGPT / ElevenLabs) =================
export function accountsBody(body, focus) {
  body.append(h('p', { class: 'hint', html: 'Claude ve ChatGPT, üçüncü taraf uygulamalara "hesapla giriş yap" imkânı vermiyor; bağlantı <b>API anahtarı</b> ile yapılır. Anahtar yalnızca bu telefonda saklanır, istekler doğrudan sağlayıcıya gider. Kullanım ücretini sağlayıcı faturalandırır (Claude Pro / ChatGPT Plus aboneliği API kredisi içermez).' }));
  Object.entries(PROVIDERS).forEach(([id, pr]) => {
    const st = { key: getKey(id), model: getModel(id) };
    const on = hasKey(id);
    const card = h('div', { class: `acc-card${on ? ' on' : ''}${focus === id ? ' focus' : ''}` });
    card.append(h('div', { class: 'acc-head' }, h('span', { class: 'acc-logo' }, id === 'anthropic' ? 'C' : id === 'openai' ? 'G' : 'E'), h('b', {}, pr.name), h('span', { class: `acc-state${on ? ' on' : ''}` }, on ? 'Bağlı' : 'Bağlı değil')));
    const use = { anthropic: 'Alpi-co sohbet, otomatik kurgu, başlık/hashtag, altyazı düzeltme', openai: 'Alpi-co, otomatik kurgu, en doğru altyazı (Whisper), duygulu seslendirme', eleven: 'En doğal, duygulu Türkçe seslendirme' }[id];
    card.append(h('p', { class: 'hint', style: { margin: '4px 0 8px' } }, use));
    const inp = h('input', { type: 'password', placeholder: pr.keyHint, value: st.key, autocomplete: 'off', spellcheck: 'false' });
    card.append(inp);
    const mdl = h('div', { class: 'chips scroll', style: { margin: '8px 0' } });
    pr.models.forEach(([m, n]) => mdl.append(h('button', { class: st.model === m ? 'on' : '', onclick: () => { setModel(id, m); refreshSheet(); } }, n)));
    card.append(mdl);
    const row = h('div', { class: 'btn-row three' },
      h('button', { class: 'btn', onclick: () => openExternal(pr.keyUrl) }, 'Anahtar al'),
      h('button', { class: 'btn', onclick: async (e) => { setKey(id, inp.value); const b = e.currentTarget; b.textContent = 'Deneniyor…'; try { const r = await testKey(id); toast(`✓ ${pr.name}: ${r}`, 3500); } catch (er) { toast(er.message, 5000); } refreshSheet(); } }, 'Kaydet + dene'),
      on ? h('button', { class: 'btn danger', onclick: () => { setKey(id, ''); refreshSheet(); } }, 'Kaldır') : h('button', { class: 'btn primary', onclick: () => { setKey(id, inp.value); toast('Kaydedildi'); refreshSheet(); } }, 'Kaydet'));
    card.append(row);
    body.append(card);
  });
  if (hasKey('anthropic') && hasKey('openai')) {
    const st = { p: chatProvider() };
    body.append(fields(st, [{ label: 'Alpi-co ve otomatik kurgu için', path: 'p', type: 'chips', options: [['anthropic', 'Claude'], ['openai', 'ChatGPT']], post: (o) => setChatProvider(o.p) }]));
  }
  body.append(h('details', { class: 'acc-help' }, h('summary', {}, 'Anahtar nasıl alınır?'), h('ol', {},
    h('li', {}, '"Anahtar al"a dokun; sağlayıcının sitesi tarayıcıda açılır.'),
    h('li', {}, 'Hesabınla giriş yap (Claude için console.anthropic.com, ChatGPT için platform.openai.com).'),
    h('li', {}, 'Faturalandırma/kredi ekle (birkaç dolar uzun süre yeter).'),
    h('li', {}, '"Create key / Yeni anahtar" ile anahtar oluştur, kopyala.'),
    h('li', {}, 'Buraya yapıştırıp "Kaydet + dene"ye dokun.'))));
}

export function openAccounts(focus) {
  openSheet({ id: 'accounts', title: 'Yapay zekâ hesapları', render: (body) => accountsBody(body, focus) });
}

// ================= Otomatik kurgu (Claude / ChatGPT tüm kurguyu yapar) =================
const STYLES = [
  ['shorts', 'Viral Shorts / Reels', 'Hızlı tempo, güçlü hook, jumpcut, punch zoom, vurgu sesleri, büyük kelime vurgulu altyazı, sonda abone ol.'],
  ['football', 'Futbol analizi', 'Spiker enerjisi, önemli anlarda zoom ve whoosh/boom, skor/isim vurguları, heyecanlı hook.'],
  ['ai', 'Yapay zekâ videosu', 'Sinematik, gizemli, glitch/flash geçişler, minimal yazılar, dramatik müzik.'],
  ['vlog', 'Vlog', 'Doğal akış, yumuşak geçişler, sıcak filtre, sakin müzik, az yazı.'],
  ['podcast', 'Podcast / konuşma', 'Sessizlikleri kes, ses temizliği, altyazı, önemli cümlelerde yazı.'],
  ['edu', 'Eğitim / bilgi', 'Net, anlaşılır; madde başlıkları yazı olarak, sade geçişler.'],
];

export function openAutoEdit() {
  const st = { style: lsGet('alpicut.aeStyle', 'shorts'), target: 0, notes: '', caps: true, clean: true, music: true, running: false, log: [], before: null, summary: '' };
  openSheet({
    id: 'autoedit', title: 'Otomatik kurgu',
    render: (body) => {
      const prov = chatProvider();
      if (!prov) {
        body.append(h('div', { class: 'acc-empty' }, h('span', { html: I.wand }), h('b', {}, 'Tüm kurguyu yapay zekâ yapsın'),
          h('p', { class: 'hint' }, 'Videonu ve konuşmayı analiz eder; jumpcut, altyazı, hook başlık, zoom, ses efekti, geçiş ve müziği kendisi ekler. Bunun için Claude veya ChatGPT hesabını (API anahtarı) bağla.'),
          h('button', { class: 'btn primary block', html: `${I.key} Claude / ChatGPT bağla`, onclick: () => openAccounts() }),
          h('p', { class: 'hint' }, 'Hesap bağlamadan da Alpi-co\'ya "jumpcut yap", "altyazı ekle" gibi komutlar verebilirsin.')));
        return;
      }
      if (st.running) {
        body.append(h('div', { class: 'spinner' }));
        const lg = h('div', { class: 'ae-log' }); st.log.slice(-12).forEach((l) => lg.append(h('div', {}, l))); body.append(lg);
        return;
      }
      if (st.summary) {
        body.append(h('div', { class: 'ai-out' }, st.summary));
        body.append(h('div', { class: 'btn-row' },
          st.before ? h('button', { class: 'btn', html: `${I.undo} Hepsini geri al`, onclick: () => { app.restoreTo(st.before); st.before = null; st.summary = ''; refreshSheet(); toast('Otomatik kurgu geri alındı'); } }) : h('span'),
          h('button', { class: 'btn primary', onclick: () => { app.play(); } }, 'Önizle')));
        body.append(h('button', { class: 'btn block', style: { marginTop: '8px' }, onclick: () => { st.summary = ''; refreshSheet(); } }, 'Yeniden ayarla'));
        return;
      }
      if (!app.P.clips.length) { body.append(h('p', { class: 'hint' }, 'Önce Medya ile video ekle.')); return; }
      const grid = h('div', { class: 'ae-styles' });
      STYLES.forEach(([id, n, d]) => grid.append(h('button', { class: `ae-style${st.style === id ? ' on' : ''}`, onclick: () => { st.style = id; lsSet('alpicut.aeStyle', id); refreshSheet(); } }, h('b', {}, n), h('small', {}, d))));
      body.append(grid);
      body.append(fields(st, [
        { label: 'Hedef süre (0 = serbest)', path: 'target', type: 'range', min: 0, max: 180, step: 5, def: 0, fmt: (x) => (x ? `${x} sn` : 'serbest') },
        { label: 'Önce altyazı oluştur (konuşmayı anlaması için)', path: 'caps', type: 'toggle' },
        { label: 'Önce ses temizliği', path: 'clean', type: 'toggle' },
        { label: 'Fon müziği ekleyebilir', path: 'music', type: 'toggle' },
        { label: 'Ek isteğin (ör. "golü 2 kez göster, başlık: TARİHİ GOL")', path: 'notes', type: 'textarea' },
      ]));
      body.append(h('p', { class: 'hint', html: `Kurguyu <b>${PROVIDERS[prov].name}</b> yapacak. Gönderilen: proje özeti ve konuşmanın yazısı (video gönderilmez). Her şey tek dokunuşla geri alınabilir.` }));
      body.append(h('button', { class: 'btn block primary', html: `${I.wand} Kurguyu yap`, onclick: () => runAutoEdit(st) }));
    },
  });
}

async function runAutoEdit(st) {
  const panel = curPanel();
  st.running = true; st.log = ['Başlıyor…']; st.before = app.snap; WMrefresh(panel);
  const log = (t) => { st.log.push(t); WMrefresh(panel); };
  const { COMMANDS, runCommand } = await import('./alpico.js');
  try {
    if (st.clean) { log('Ses temizleniyor…'); await runCommand('denoise', { preset: 'podcast' }, { quiet: true }); }
    if (st.caps && !(app.P.subs?.cues?.length)) {
      log('Konuşma yazıya dökülüyor…');
      try { await autoCaptions({ lang: lsGet('alpicut.asrLang', 'turkish'), onStatus: (t) => { st.log[st.log.length - 1] = t; WMrefresh(panel); } }); } catch (e) { log(`Altyazı atlandı: ${e.message}`); }
    }
    const style = STYLES.find((x) => x[0] === st.style);
    const tools = Object.entries(COMMANDS).filter(([n]) => !['seek'].includes(n)).map(([name, c]) => ({ name, description: c.desc, parameters: c.params }));
    const sys = `Sen profesyonel bir kısa video editörüsün ve Alpicut uygulamasını araçlarla kontrol ediyorsun. Türkçe düşün.
Görev: kullanıcının videosunu baştan sona kurgula. Stil: ${style[1]} — ${style[2]}
${st.target ? `Hedef süre yaklaşık ${st.target} saniye; gerekirse delete_range ile zayıf/tekrarlı kısımları çıkar.` : ''}
${st.music ? 'Uygunsa add_music ile fon müziği ekle (seviye 0.2-0.3) ve duck_music aç.' : 'Müzik ekleme.'}
Adımlar: 1) project_info ve get_transcript çağır. 2) jumpcut (konuşma varsa). 3) Transkripti tekrar oku (zamanlar değişti). 4) İlk 2 sn'ye güçlü hook yazısı (add_text, style hook, *vurgu* için yıldız kullan). 5) Önemli anlara zoom punch ve uygun add_sfx (whoosh, boom, ding, pop). 6) Kesimlere uygun geçiş. 7) Gerekirse filtre. 8) Sona add_cta subscribe. 9) check_project ile kontrol et ve sorunları düzelt.
Aşırıya kaçma: her 3-5 saniyede en fazla bir vurgu. Son mesajında yaptıklarını madde madde, kısa özetle.`;
    const history = [{ role: 'user', content: `Kurguyu yap.${st.notes ? ` Ek istek: ${st.notes}` : ''}` }];
    const reply = await agent({ system: sys, history, tools, maxSteps: 14,
      exec: async (name, args) => { log(`▸ ${name} ${Object.keys(args || {}).length ? JSON.stringify(args).slice(0, 60) : ''}`); const r = await runCommand(name, args, { quiet: true }); if (r?.summary) log(`  ✓ ${r.summary}`); if (r?.ok === false) log(`  ✗ ${r.error}`); return r ? { ...r, before: undefined } : { ok: false }; },
      onStep: (s) => { if (s.type === 'text' && s.text) log(s.text.slice(0, 120)); },
    });
    st.summary = reply || 'Kurgu tamamlandı.';
  } catch (e) {
    st.summary = `Kurgu yarıda kaldı: ${e.message || e}\n\nYapılan değişiklikler geri alınabilir.`;
  }
  if (st.before === app.snap) st.before = null;
  st.running = false; WMrefresh(panel);
}

// ================= Yapay zekâ merkezi =================
export function openAIHub() {
  openSheet({
    id: 'aihub', title: 'Yapay zekâ araçları',
    render: async (body) => {
      const { star } = await import('./favs.js');
      const card = (ic, t, d, fn, tag) => { const c = h('div', { class: 'ai-card', role: 'button' }, h('span', { class: 'ai-ic', html: I[ic] }), h('span', { class: 'ai-t' }, h('b', {}, t), h('small', {}, d)), tag ? h('em', {}, tag) : star('tool', `ai:${t}`, { name: t })); c.addEventListener('click', fn); return c; };
      const target = (tab) => () => { if (app.aiTarget) app.aiTarget(tab); };
      body.append(
        card('bot', 'Alpi-co asistan', 'Sohbet ederek düzenle: "jumpcut yap", "altyazı ekle"…', async () => { const m = await import('./alpico.js'); m.openAlpico(); }, chatProvider() ? 'bağlı' : 'internetsiz'),
        card('wand', 'Otomatik kurgu', 'Claude / ChatGPT tüm kurguyu kendisi yapsın', openAutoEdit, chatProvider() ? 'hazır' : 'hesap'),
        card('subtitle', 'Otomatik altyazı', 'Kelime kelime zamanlı altyazı (telefonda veya OpenAI)', openAutoCaptions),
        card('scissors', 'Jumpcut', 'Konuşmadaki boşlukları tek dokunuşla kes', async () => { const m = await import('./alpico.js'); m.runCommand('jumpcut', {}); }),
        card('adjust', 'Arka plan silme', 'Yeşil perde olmadan kişiyi ayır', target('Arka plan')),
        card('color', 'Chroma key', 'Yeşil/mavi perdeyi sil', target('Chroma')),
        card('mic', 'Seslendirme stüdyosu', 'Metni doğal sesle oku (Türkçe, ElevenLabs, OpenAI)', () => openTTS()),
        card('sfx', 'Stüdyo ses / hışırtı giderici', 'Gürültü, uğultu, hışırtıyı temizle', async () => { const m = await import('./alpico.js'); m.runCommand('denoise', { preset: 'hiss' }); }),
        card('edit', 'Metinden kurgu', 'Kelimeleri silerek videoyu kes', openTranscript),
        card('ratio', 'Akıllı dikey kadraj', 'Yatay videoda yüzü takip et', () => { if (app.aiReframe) app.aiReframe(); }),
        card('doctor', 'Proje kontrolü', 'Hataları bul ve tek dokunuşla düzelt', async () => { const m = await import('./alpico.js'); m.openDoctor(); }),
        card('ai', 'Başlık / hashtag / senaryo', 'Hook, açıklama, bölüm, çeviri', openAssistant, chatProvider() ? '' : 'hesap'),
        card('key', 'Hesaplar', 'Claude, ChatGPT, ElevenLabs bağlantıları', () => openAccounts()),
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
