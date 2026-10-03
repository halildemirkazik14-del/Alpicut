// Alpicut — Alpi-co: yardımcı yapay zekâ asistanı. Sohbetten videoya ve sese geri alınabilir şekilde müdahale eder.
// İnternetsiz: Türkçe komut anlayıcı (jumpcut, altyazı, müzik, zoom, geçiş…). Claude/ChatGPT bağlıysa: araç kullanan ajan.
import { app, h, toast, uid, clone, fmt, selected } from './state.js';
import { I } from './icons.js';
import { openSheet, refreshSheet } from './sheets.js';
import { layoutClips } from './engine.js';
import { TEXT_BASE, TEXT_TEMPLATES, CTA_BASE, CTA_PRESETS, RATIOS, anim, FILTER_PRESETS, DEFAULT_FILTERS } from './presets.js';
import { findSilences } from './audiotools.js';
import { chatProvider, agent, PROVIDERS } from './aiapi.js';
import { lsGet } from './storage.js';

// ======================= komut kayıt defteri =======================
const sec = (t) => `${(+t).toFixed(1)} sn`;
const playheadClip = () => { const lay = layoutClips(app.P.clips); return lay.find((x) => app.engine.t >= x.start && app.engine.t < x.end) || lay[lay.length - 1]; };
const loadJSON = async (u) => { try { return await (await fetch(u)).json(); } catch (_) { return []; } };
const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

export const COMMANDS = {
  project_info: {
    desc: 'Projenin özetini verir: süre, oran, klipler, katmanlar, sesler, altyazı. Kurgu yapmadan önce çağır.',
    params: { type: 'object', properties: {} },
    run: async () => {
      const P = app.P;
      const lay = layoutClips(P.clips);
      return {
        name: P.name, ratio: P.ratio, duration: +app.engine.duration().toFixed(2), playhead: +app.engine.t.toFixed(2),
        clips: lay.map((L, i) => ({ index: i, start: +L.start.toFixed(2), end: +L.end.toFixed(2), type: L.clip.type, speed: L.clip.speed || 1, transition: L.clip.trans?.type || 'none', name: app.engine.media.get(L.clip.mediaId)?.name })),
        layers: P.layers.map((l) => ({ id: l.id, kind: l.kind, start: +l.start.toFixed(2), end: +l.end.toFixed(2), text: l.text || l.label || l.title || undefined })),
        audio: P.audio.map((a) => ({ id: a.id, role: a.role || (a.sfx ? 'sfx' : 'music'), start: +a.start.toFixed(2), len: +(a.out - a.in).toFixed(2), volume: a.volume, name: app.engine.media.get(a.mediaId)?.name })),
        subtitles: P.subs?.cues?.length || 0,
      };
    },
  },
  get_transcript: {
    desc: 'Konuşmanın kelime/satır zamanlı metnini verir (önce altyazı oluşturulmuş olmalı). Zamanlar zaman çizelgesi saniyesidir.',
    params: { type: 'object', properties: {} },
    run: async () => {
      const S = app.P.subs; const off = S?.offset || 0;
      if (!S?.cues?.length) return { ok: false, error: 'Henüz altyazı/transkript yok. Önce auto_captions çağır.' };
      return { lines: S.cues.map((c) => ({ start: +(c.start + off).toFixed(2), end: +(c.end + off).toFixed(2), text: c.text })) };
    },
  },
  jumpcut: {
    desc: 'Konuşmadaki sessiz boşlukları (duraklamaları) otomatik bulup keser — jumpcut. Video, ses ve altyazı birlikte kısalır.',
    params: { type: 'object', properties: { threshold_db: { type: 'number', description: 'Sessizlik eşiği dB (varsayılan -38)' }, min_silence: { type: 'number', description: 'En kısa kesilecek boşluk sn (varsayılan 0.45)' }, padding: { type: 'number', description: 'Kelime kenarı payı sn (varsayılan 0.08)' } } },
    run: async (a = {}) => {
      if (!app.P.clips.length && !app.P.audio.some((x) => x.role === 'voice')) return { ok: false, error: 'Projede konuşma yok' };
      const { mixProjectAudio } = await import('./ai.js');
      const mix = await mixProjectAudio({ includeMusic: false });
      if (mix.peak < 0.005) return { ok: false, error: 'Ses bulunamadı' };
      const thr = a.threshold_db ?? -38, minDur = a.min_silence ?? 0.45, pad = a.padding ?? 0.08;
      const rs = findSilences({ data: mix.data, sr: 16000, dur: mix.dur }, { threshold: thr, minDur, pad }).filter((r) => r.e - r.s > 0.12);
      if (!rs.length) return { ok: true, summary: 'Kesilecek sessiz boşluk bulunamadı' };
      const total = rs.reduce((s, r) => s + r.e - r.s, 0);
      app.cutTimelineRanges(rs.map((r) => ({ s: r.s, e: r.e })));
      return { ok: true, summary: `${rs.length} boşluk kesildi, video ${sec(total)} kısaldı` };
    },
  },
  auto_captions: {
    desc: 'Konuşmadan otomatik altyazı oluşturur (kelime zamanlı).',
    params: { type: 'object', properties: { language: { type: 'string', description: 'turkish, english, …' }, words_per_line: { type: 'number' } } },
    run: async (a = {}) => {
      const { autoCaptions } = await import('./ai.js');
      const n = await autoCaptions({ lang: a.language || 'turkish', maxWords: a.words_per_line || 4, onStatus: (t) => status(t) });
      return { ok: true, summary: `${n} altyazı satırı oluşturuldu` };
    },
  },
  add_text: {
    desc: 'Videoya yazı ekler. position: top|center|bottom. style: hook|kinetic|breaking|simple veya şablon id.',
    params: { type: 'object', properties: { text: { type: 'string' }, start: { type: 'number' }, duration: { type: 'number' }, position: { type: 'string' }, style: { type: 'string' } }, required: ['text'] },
    run: async (a) => {
      const tpl = TEXT_TEMPLATES.find((t) => t.id === a.style) || TEXT_TEMPLATES.find((t) => t.id === 'hook');
      const L = { ...clone(TEXT_BASE), ...clone(tpl.p), text: a.text, id: uid() };
      L.start = Math.max(0, a.start ?? app.engine.t);
      L.end = L.start + (a.duration ?? 3);
      if (a.position === 'top') L.y = 0.2; else if (a.position === 'bottom') L.y = 0.75; else if (a.position === 'center') L.y = 0.5;
      app.P.layers.push(L);
      app.commit();
      return { ok: true, id: L.id, summary: `“${a.text.replace(/\*/g, '')}” yazısı eklendi (${sec(L.start)})` };
    },
  },
  add_cta: {
    desc: 'Abone ol / beğen / takip et butonu ekler. kind: subscribe|like|follow',
    params: { type: 'object', properties: { kind: { type: 'string' }, start: { type: 'number' }, duration: { type: 'number' } } },
    run: async (a = {}) => {
      const pr = CTA_PRESETS.find((p) => p.id === (a.kind || 'subscribe')) || CTA_PRESETS[0];
      const L = { ...clone(CTA_BASE), ...clone(pr.p), id: uid() };
      L.start = Math.max(0, a.start ?? Math.max(0, app.engine.duration() - 4)); L.end = L.start + (a.duration ?? 3.5);
      app.P.layers.push(L); app.commit();
      return { ok: true, summary: `${pr.name} butonu eklendi (${sec(L.start)})` };
    },
  },
  add_music: {
    desc: 'Kamu malı klasik müzik ekler (Vivaldi, Mozart, Bach, Beethoven…). query: besteci veya eser adı ya da ruh hali (epik, sakin, neşeli, dramatik).',
    params: { type: 'object', properties: { query: { type: 'string' }, volume: { type: 'number', description: '0-1, varsayılan 0.3' } } },
    run: async (a = {}) => {
      const list = await loadJSON('data/music.json');
      if (!list.length) return { ok: false, error: 'Müzik kataloğu yok' };
      const moods = { epik: ['wagner', 'holst', 'orff', 'beethoven symphony', 'verdi'], sakin: ['satie', 'debussy', 'chopin nocturne', 'gymnop', 'clair'], neseli: ['mozart', 'vivaldi spring', 'strauss', 'haydn', 'rossini'], dramatik: ['beethoven', 'tchaikovsky', 'bach toccata', 'grieg', 'mussorgsky'], hizli: ['rimsky', 'flight', 'rossini', 'paganini', 'hungarian'] };
      const q = norm(a.query || 'vivaldi');
      const keys = Object.entries(moods).find(([k]) => q.includes(k))?.[1] || [q];
      const hit = list.filter((m) => keys.some((k) => k.split(' ').every((w) => norm(`${m.c} ${m.t}`).includes(w))));
      const pick = (hit.length ? hit : list)[Math.floor(Math.random() * Math.min(5, (hit.length ? hit : list).length))];
      status(`Müzik indiriliyor: ${pick.c} – ${pick.t}`);
      const blob = await (await fetch(pick.u)).blob();
      const recs = await app.importFiles([new File([blob], `${pick.c} – ${pick.t}`.slice(0, 70) + '.ogg', { type: blob.type || 'audio/ogg' })], true);
      if (!recs[0]) return { ok: false, error: 'İndirilemedi' };
      const dur = app.engine.duration() || recs[0].duration;
      app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: 0, in: 0, out: Math.min(recs[0].duration, dur || recs[0].duration), volume: a.volume ?? 0.3, fadeIn: 1, fadeOut: 2, role: 'music' });
      app.commit();
      return { ok: true, summary: `Müzik eklendi: ${pick.c} – ${pick.t}` };
    },
  },
  add_sfx: {
    desc: 'Ses efekti ekler. query: whoosh, boom, ding, pop, riser, kalabalık, alkış, para, kamera, glitch… at: saniye (varsayılan oynatıcı).',
    params: { type: 'object', properties: { query: { type: 'string' }, at: { type: 'number' } }, required: ['query'] },
    run: async (a) => {
      const q = norm(a.query);
      const { SFX } = await import('./sfx.js');
      const syn = SFX.find(([id, n]) => norm(`${id} ${n}`).includes(q));
      const t0 = app.engine.t;
      if (a.at != null) app.engine.t = a.at;
      try {
        if (syn) { await app.addSfx(syn[0], syn[1]); return { ok: true, summary: `${syn[1]} eklendi (${sec(a.at ?? t0)})` }; }
        const idx = await loadJSON('sfx/index.json');
        const m = idx.find((x) => norm(`${x.n} ${x.c}`).includes(q));
        if (!m) return { ok: false, error: `“${a.query}” bulunamadı` };
        const blob = await (await fetch(`sfx/${m.id}.ogg`)).blob();
        const recs = await app.importFiles([new File([blob], `SFX · ${m.n}.ogg`, { type: 'audio/ogg' })], true);
        app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: a.at ?? t0, in: 0, out: recs[0].duration, volume: 1, fadeIn: 0, fadeOut: 0, sfx: true });
        app.commit();
        return { ok: true, summary: `${m.n} eklendi (${sec(a.at ?? t0)})` };
      } finally { app.engine.t = t0; }
    },
  },
  zoom: {
    desc: 'Klibe zoom hareketi ekler. type: punch (ani yakınlaşma, vurgu) | slow (yavaş yakınlaşma) | out. at: saniye.',
    params: { type: 'object', properties: { type: { type: 'string' }, at: { type: 'number' }, amount: { type: 'number', description: '1.1-1.6' } } },
    run: async (a = {}) => {
      const t = a.at ?? app.engine.t;
      const L = layoutClips(app.P.clips).find((x) => t >= x.start && t < x.end);
      if (!L) return { ok: false, error: 'Bu zamanda klip yok' };
      const c = L.clip, lt = t - L.start, amt = a.amount ?? (a.type === 'slow' ? 1.18 : 1.3);
      c.kf = c.kf || {};
      if (a.type === 'slow') c.kf.zoom = [{ t: 0, v: 1, ease: 'auto' }, { t: L.len, v: amt, ease: 'auto' }];
      else if (a.type === 'out') c.kf.zoom = [{ t: 0, v: amt, ease: 'out' }, { t: Math.min(L.len, 0.8), v: 1, ease: 'inout' }];
      else {
        const keys = (c.kf.zoom || []).filter((k) => k.t < lt - 0.05 || k.t > lt + 0.6);
        keys.push({ t: Math.max(0, lt - 0.01), v: 1, ease: 'out' }, { t: lt + 0.15, v: amt, ease: 'hold' }, { t: lt + 0.55, v: amt, ease: 'inout' });
        c.kf.zoom = keys.sort((x, y) => x.t - y.t);
      }
      app.commit();
      return { ok: true, summary: `${a.type === 'slow' ? 'Yavaş' : a.type === 'out' ? 'Uzaklaşan' : 'Darbe'} zoom eklendi (${sec(t)})` };
    },
  },
  add_transitions: {
    desc: 'Tüm kesimlere (veya index verilen klibe) geçiş ekler. type: fade|black|flash|slideLeft|zoom|glitch|whip|blur|spin veya gl geçiş id.',
    params: { type: 'object', properties: { type: { type: 'string' }, duration: { type: 'number' }, index: { type: 'number' } } },
    run: async (a = {}) => {
      const list = app.P.clips;
      let n = 0;
      list.forEach((c, i) => { if (i === 0) return; if (a.index != null && a.index !== i) return; c.trans = { type: a.type || 'fade', dur: a.duration ?? 0.4 }; n++; });
      app.commit();
      return { ok: true, summary: n ? `${n} kesime “${a.type || 'fade'}” geçişi eklendi` : 'Geçiş eklenecek kesim yok (en az 2 klip gerekli)' };
    },
  },
  set_ratio: {
    desc: 'Video oranını değiştirir: 9:16, 4:5, 1:1, 16:9',
    params: { type: 'object', properties: { ratio: { type: 'string' } }, required: ['ratio'] },
    run: async (a) => { if (!RATIOS[a.ratio]) return { ok: false, error: 'Geçersiz oran' }; app.P.ratio = a.ratio; app.engine.setProject(app.P); app.fitStage(); app.commit(); return { ok: true, summary: `Oran ${a.ratio} yapıldı` }; },
  },
  apply_filter: {
    desc: `Kliplere renk filtresi uygular. preset: ${FILTER_PRESETS.map((f) => f[0]).join(', ')}. target: all|current`,
    params: { type: 'object', properties: { preset: { type: 'string' }, target: { type: 'string' } }, required: ['preset'] },
    run: async (a) => {
      const f = FILTER_PRESETS.find((x) => x[0] === a.preset || norm(x[1]) === norm(a.preset));
      if (!f) return { ok: false, error: 'Filtre bulunamadı' };
      const cs = a.target === 'current' ? [playheadClip()?.clip].filter(Boolean) : app.P.clips;
      cs.forEach((c) => { c.filters = { ...DEFAULT_FILTERS, ...f[2] }; c.filterPreset = f[0]; });
      app.commit();
      return { ok: true, summary: `${f[1]} filtresi ${cs.length} klibe uygulandı` };
    },
  },
  set_speed: {
    desc: 'Klibin hızını değiştirir (0.25-4). index verilmezse oynatıcıdaki klip.',
    params: { type: 'object', properties: { speed: { type: 'number' }, index: { type: 'number' } }, required: ['speed'] },
    run: async (a) => {
      const c = a.index != null ? app.P.clips[a.index] : playheadClip()?.clip;
      if (!c) return { ok: false, error: 'Klip yok' };
      c.speed = Math.max(0.25, Math.min(4, a.speed)); delete c.curve; app.commit();
      return { ok: true, summary: `Klip hızı ${c.speed}x` };
    },
  },
  set_volume: {
    desc: 'Ses seviyesi: target music|voice|sfx|video, level 0-1.5',
    params: { type: 'object', properties: { target: { type: 'string' }, level: { type: 'number' } }, required: ['target', 'level'] },
    run: async (a) => {
      let n = 0;
      if (a.target === 'video') app.P.clips.forEach((c) => { c.volume = a.level; n++; });
      else app.P.audio.forEach((x) => { const r = x.role || (x.sfx ? 'sfx' : 'music'); if (r === a.target) { x.volume = a.level; n++; } });
      app.commit();
      return { ok: true, summary: `${n} öğenin sesi %${Math.round(a.level * 100)} yapıldı` };
    },
  },
  denoise: {
    desc: 'Konuşma sesindeki hışırtı/gürültüyü stüdyo kalitesinde temizler. preset: podcast|voiceover|hiss|outdoor',
    params: { type: 'object', properties: { preset: { type: 'string' } } },
    run: async (a = {}) => {
      const { processVoice, STUDIO_PRESETS } = await import('./studio.js');
      const pr = STUDIO_PRESETS[a.preset || 'podcast'] || STUDIO_PRESETS.podcast;
      const targets = [...app.P.clips.filter((c) => c.type === 'video' && !c.mute && !c.freeze), ...app.P.audio.filter((x) => (x.role || '') === 'voice')];
      if (!targets.length) return { ok: false, error: 'Temizlenecek konuşma bulunamadı' };
      let n = 0;
      for (const o of targets.slice(0, 6)) {
        const m = app.engine.media.get(o.mediaId); if (!m) continue;
        status(`Ses temizleniyor (${n + 1}/${Math.min(6, targets.length)})…`);
        const wav = await processVoice(m.blob, pr);
        const recs = await app.importFiles([new File([wav], `${(m.name || 'ses').replace(/\.\w+$/, '')}_temiz.wav`, { type: 'audio/wav' })], true);
        if (!recs[0]) continue;
        if (o.type === 'video') {
          const L = layoutClips(app.P.clips).find((x) => x.clip === o);
          o.mute = true;
          app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: L.start, in: o.in, out: o.out, volume: o.volume ?? 1, fadeIn: 0, fadeOut: 0, role: 'voice', linked: o.id });
        } else { o.mediaId = recs[0].id; }
        n++;
      }
      app.commit();
      return { ok: true, summary: `${n} konuşma sesi temizlendi (${pr.label})` };
    },
  },
  duck_music: {
    desc: 'Konuşma varken müziği otomatik kıs (ducking) aç/kapat',
    params: { type: 'object', properties: { on: { type: 'boolean' } } },
    run: async (a = {}) => { app.P.mix = app.P.mix || {}; app.P.mix.duck = a.on !== false; app.P.mix.duckAmt = app.P.mix.duckAmt ?? 0.35; app.commit(); return { ok: true, summary: `Müzik kısma ${app.P.mix.duck ? 'açık' : 'kapalı'}` }; },
  },
  delete_range: {
    desc: 'Zaman çizelgesinden bir aralığı keser ve sonrasını kaydırır (start-end saniye)',
    params: { type: 'object', properties: { start: { type: 'number' }, end: { type: 'number' } }, required: ['start', 'end'] },
    run: async (a) => { if (a.end - a.start < 0.05) return { ok: false, error: 'Aralık çok kısa' }; app.cutTimelineRanges([{ s: a.start, e: a.end }]); return { ok: true, summary: `${sec(a.start)}–${sec(a.end)} arası kesildi` }; },
  },
  add_effect: {
    desc: 'Görsel efekt ekler (shake, zoompulse, punch, glitch, rgb, vhs, flash, leak, film, cinema, …). at, duration saniye.',
    params: { type: 'object', properties: { effect: { type: 'string' }, at: { type: 'number' }, duration: { type: 'number' } }, required: ['effect'] },
    run: async (a) => {
      const { FX_LIST } = await import('./fxlib.js');
      const f = FX_LIST.find((x) => x[0] === a.effect || norm(x[1]).includes(norm(a.effect)));
      if (!f) return { ok: false, error: 'Efekt bulunamadı' };
      const s = a.at ?? app.engine.t;
      app.P.layers.push({ id: uid(), kind: 'fx', effect: f[0], start: s, end: s + (a.duration ?? 1.5), amount: 1, speed: 1, anim: anim('none', 'none'), x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, kf: {} });
      app.commit();
      return { ok: true, summary: `${f[1]} efekti eklendi (${sec(s)})` };
    },
  },
  check_project: {
    desc: 'Projeyi hatalara karşı kontrol eder (self kontrol) ve sorunları listeler.',
    params: { type: 'object', properties: {} },
    run: async () => ({ ok: true, issues: doctorIssues().map((x) => x.text) }),
  },
  seek: { desc: 'Oynatıcıyı bir zamana götürür', params: { type: 'object', properties: { time: { type: 'number' } }, required: ['time'] }, run: async (a) => { app.engine.seek(Math.max(0, a.time)); app.updateTime(); app.syncScroll(); return { ok: true }; } },
};

export async function runCommand(name, args = {}, { quiet = false } = {}) {
  const c = COMMANDS[name];
  if (!c) { toast('Bilinmeyen komut'); return null; }
  if (!app.P) return null;
  const before = app.snap;
  try {
    const r = await c.run(args);
    if (!quiet && r?.summary) toast(r.summary, 3500);
    if (!quiet && r && r.ok === false && r.error) toast(r.error, 3500);
    return { ...r, before };
  } catch (e) { if (!quiet) toast(e.message || 'Yapılamadı', 4000); return { ok: false, error: e.message || String(e), before }; }
}

// ======================= self kontrol (proje doktoru) =======================
export function doctorIssues() {
  const P = app.P, E = app.engine;
  if (!P) return [];
  const out = [];
  const dur = E.duration();
  const add = (sev, text, fix, fixLabel = 'Düzelt') => out.push({ sev, text, fix, fixLabel });
  if (!P.clips.length && !P.layers.length) { add('info', 'Proje boş. Başlamak için Medya ekle.', () => app.addMedia('clip'), 'Medya ekle'); return out; }
  const missing = [...new Set([...P.clips, ...P.layers, ...P.audio].map((o) => o.mediaId).filter((m) => m && !E.media.has(m)))];
  if (missing.length) add('err', `${missing.length} medya dosyası eksik (silinmiş veya taşınmış).`, null);
  const longL = P.layers.filter((l) => l.end > dur + 0.05 && l.start < dur);
  if (longL.length) add('warn', `${longL.length} katman videonun bitişinden sonra da sürüyor (sonda boş/siyah kalır).`, () => { longL.forEach((l) => { l.end = dur; }); app.commit(); });
  const after = P.layers.filter((l) => l.start >= dur && dur > 0);
  if (after.length) add('warn', `${after.length} katman video bittikten sonra başlıyor — görünmeyecek.`, () => { P.layers = P.layers.filter((l) => !after.includes(l)); app.commit(); }, 'Sil');
  const music = P.audio.filter((a) => (a.role || (a.sfx ? 'sfx' : 'music')) === 'music');
  const voice = P.audio.some((a) => a.role === 'voice') || P.clips.some((c) => c.type === 'video' && !c.mute && (c.volume ?? 1) > 0);
  if (voice && music.some((m) => (m.volume ?? 1) > 0.45)) add('warn', 'Müzik konuşmaya göre çok yüksek; konuşma anlaşılmayabilir.', () => { music.forEach((m) => { m.volume = 0.28; }); P.mix = { ...(P.mix || {}), duck: true, duckAmt: 0.35 }; app.commit(); }, 'Müziği kıs + otomatik kısma');
  const loud = [...P.audio, ...P.clips].filter((o) => (o.volume ?? 1) > 1.6);
  if (loud.length) add('warn', `${loud.length} öğenin sesi çok yüksek; dışa aktarmada cızırtı (clipping) olabilir.`, () => { loud.forEach((o) => { o.volume = 1.2; }); app.commit(); });
  const texts = P.layers.filter((l) => l.kind === 'text');
  const unsafe = texts.filter((l) => l.y < 0.07 || l.y > 0.9 || l.x < 0.08 || l.x > 0.92);
  if (unsafe.length) add('warn', `${unsafe.length} yazı ekranın kenarına çok yakın; telefonda arayüzün altında kalabilir.`, () => { unsafe.forEach((l) => { l.x = Math.max(0.12, Math.min(0.88, l.x)); l.y = Math.max(0.12, Math.min(0.82, l.y)); }); app.commit(); }, 'Güvenli alana taşı');
  const tiny = texts.filter((l) => (l.size || 80) * (l.sc ?? 1) < 42);
  if (tiny.length) add('info', `${tiny.length} yazı telefonda okunamayacak kadar küçük.`, () => { tiny.forEach((l) => { l.size = 56; }); app.commit(); }, 'Büyüt');
  if (P.ratio === '9:16' && dur > 4 && !P.layers.some((l) => l.kind === 'text' && l.start < 2)) add('info', 'İlk 2 saniyede dikkat çeken bir başlık (hook) yok — izleyici kaydırıp geçebilir.', () => runCommand('add_text', { text: 'BUNU İZLE!', start: 0, duration: 2.5, position: 'top', style: 'hook' }), 'Hook ekle');
  if (P.subs?.cues?.length) {
    const bottomText = texts.filter((l) => l.y > 0.68);
    if (bottomText.length && (P.subs.style?.y ?? 0.75) > 0.65) add('warn', 'Altyazı ile alttaki yazı üst üste biniyor olabilir.', () => { P.subs.style = { ...(P.subs.style || {}), y: 0.62 }; app.commit(); }, 'Altyazıyı yukarı al');
    const off = P.subs.offset || 0;
    const past = P.subs.cues.filter((c) => c.start + off > dur);
    if (past.length) add('warn', `${past.length} altyazı satırı video bittikten sonra.`, () => { P.subs.cues = P.subs.cues.filter((c) => c.start + off <= dur); app.commit(); }, 'Temizle');
  } else if (voice && dur > 3) add('info', 'Konuşma var ama altyazı yok — sessiz izleyenler için altyazı önerilir.', () => runCommand('auto_captions', {}), 'Altyazı oluştur');
  const lay = layoutClips(P.clips);
  const long = lay.filter((L) => L.len > 15 && L.clip.type === 'video' && !L.clip.kf?.zoom);
  if (P.ratio === '9:16' && long.length) add('info', `${long.length} klip 15 saniyeden uzun ve hareketsiz — jumpcut veya zoom ile tempo ekle.`, () => runCommand('jumpcut', {}), 'Jumpcut');
  const contain = P.clips.filter((c) => c.fit === 'contain' && c.bgMode === 'color' && /^#0{3,6}$/i.test(c.bgColor || ''));
  if (contain.length) add('info', `${contain.length} klipte siyah boşluk (kenar) var.`, () => { contain.forEach((c) => { c.bgMode = 'blur'; }); app.commit(); }, 'Bulanık arka plan');
  if (!out.length) add('ok', 'Her şey yolunda görünüyor. Dışa aktarmaya hazır!', null);
  return out;
}

export function openDoctor() {
  openSheet({
    id: 'doctor', title: 'Proje kontrolü',
    render: (body) => {
      body.append(h('p', { class: 'hint' }, 'Alpi-co projeni yaygın hatalara karşı kontrol etti. "Düzelt" ile tek dokunuşta onar; hepsi geri alınabilir.'));
      doctorIssues().forEach((x) => {
        const row = h('div', { class: `doc-row ${x.sev}` }, h('span', { class: 'doc-dot' }), h('span', { class: 'doc-t' }, x.text));
        if (x.fix) row.append(h('button', { class: 'btn', onclick: async () => { await x.fix(); refreshSheet(); } }, x.fixLabel));
        body.append(row);
      });
    },
  });
}

// ======================= internetsiz komut anlayıcı =======================
function parseLocal(text) {
  const t = norm(text);
  const num = (re) => { const m = t.match(re); return m ? parseFloat(m[1].replace(',', '.')) : undefined; };
  const quoted = text.match(/[“"']([^”"']+)[”"']/)?.[1];
  const cmds = [];
  if (/(jump ?cut|sessizlik|bosluk|duraklama|nefes)/.test(t)) cmds.push(['jumpcut', {}]);
  if (/(altyaz|subtitle|caption)/.test(t)) cmds.push(['auto_captions', { language: /ingilizce|english/.test(t) ? 'english' : 'turkish' }]);
  if (/(gurultu|hisirti|temizle|parazit|cizirti)/.test(t)) cmds.push(['denoise', { preset: /hisirti|cizirti/.test(t) ? 'hiss' : 'podcast' }]);
  if (/(muzik|fon muzi|vivaldi|mozart|bach|beethoven|chopin)/.test(t) && !/kis|azalt/.test(t)) cmds.push(['add_music', { query: (t.match(/(vivaldi|mozart|bach|beethoven|chopin|tchaikovsky|debussy|satie|epik|sakin|neseli|dramatik|hizli)/) || [])[1] || 'neseli' }]);
  if (/muzi\w* (kis|azalt|dusur)/.test(t)) cmds.push(['set_volume', { target: 'music', level: 0.2 }], ['duck_music', { on: true }]);
  if (/(zoom|yakinlas)/.test(t)) cmds.push(['zoom', { type: /yavas|slow/.test(t) ? 'slow' : /uzaklas/.test(t) ? 'out' : 'punch', at: num(/(\d+[.,]?\d*) ?(sn|saniye)/) }]);
  if (/(gecis|transition)/.test(t)) cmds.push(['add_transitions', { type: /flas/.test(t) ? 'flash' : /glitch/.test(t) ? 'glitch' : /siyah/.test(t) ? 'black' : /kaydir|slide/.test(t) ? 'slideLeft' : /zoom/.test(t) ? 'zoom' : 'fade' }]);
  if (/(9:16|dikey|shorts|reels|tiktok)/.test(t) && /(oran|yap|cevir)/.test(t)) cmds.push(['set_ratio', { ratio: '9:16' }]);
  else if (/(16:9|yatay|youtube)/.test(t) && /(oran|yap|cevir)/.test(t)) cmds.push(['set_ratio', { ratio: '16:9' }]);
  else if (/(1:1|kare)/.test(t) && /(oran|yap|cevir)/.test(t)) cmds.push(['set_ratio', { ratio: '1:1' }]);
  if (/(abone|subscribe)/.test(t)) cmds.push(['add_cta', { kind: 'subscribe' }]);
  else if (/(begen|like)/.test(t) && /(buton|ekle)/.test(t)) cmds.push(['add_cta', { kind: 'like' }]);
  if (/(baslik|yazi|hook)/.test(t) && /(ekle|koy|yaz)/.test(t)) cmds.push(['add_text', { text: quoted || (/hook/.test(t) ? 'BUNU KİMSE *BEKLEMİYORDU*' : 'YAZI'), position: /alt/.test(t) ? 'bottom' : /orta/.test(t) ? 'center' : 'top', style: /hook/.test(t) ? 'hook' : undefined }]);
  const fx = t.match(/(whoosh|vuus|boom|bum|ding|pop|riser|alkis|kalabalik|para|kasa|kamera|glitch|davul|bas)/);
  if (fx && /(efekt|sfx|\bses)/.test(t) && !/gecis/.test(t)) cmds.push(['add_sfx', { query: { vuus: 'whoosh', bum: 'boom', kasa: 'para', alkis: 'alkış', kalabalik: 'kalabalık' }[fx[1]] || fx[1] }]);
  const fl = FILTER_PRESETS.find((f) => t.includes(norm(f[1])) && f[0] !== 'none');
  if (fl && /(filtre|renk|uygula|yap)/.test(t)) cmds.push(['apply_filter', { preset: fl[0] }]);
  const sp = num(/(\d+[.,]?\d*) ?x/);
  if (/(hizlandir|yavaslat|hiz)/.test(t)) cmds.push(['set_speed', { speed: sp || (/yavas/.test(t) ? 0.5 : 2) }]);
  if (/(kontrol|hata|sorun|denetle|incele)/.test(t)) cmds.push(['check_project', {}]);
  return cmds;
}

// ======================= sohbet arayüzü =======================
let status = () => {};
const chat = { msgs: [], history: [], prov: null, busy: false, draft: '' };
const SUGGEST = ['Jumpcut yap', 'Otomatik altyazı ekle', 'Hışırtıyı temizle', 'Başa hook başlık ekle', 'Vivaldi müziği ekle', 'Sona abone ol butonu koy', 'Kesimlere flaş geçiş ekle', 'Projeyi kontrol et'];

function system() {
  return `Sen Alpi-co'sun: Alpicut adlı Android video editörünün yardımcı asistanı. Türkçe, samimi ve kısa konuş.
Kullanıcı futbol, yapay zekâ ve genel içerik videoları (Shorts/Reels/TikTok/YouTube) üretiyor.
Kullanıcının isteğini araçlarla (fonksiyonlarla) doğrudan uygula; gerektiğinde önce project_info / get_transcript çağır.
Tüm değişiklikler geri alınabilir; kullanıcı istemedikçe onay sorma, yap ve ne yaptığını tek cümleyle söyle.
Zamanlar saniye cinsindendir. Bilmediğin özellik uydurma. Kurgu yaparken tempo, hook (ilk 2 sn), altyazı okunabilirliği ve ses dengesine dikkat et.
Uygulamadaki menüler: Medya, Alpi-co, Yapay zekâ, Metin, Ses, Efekt, Sosyal, Düzen, Favoriler. Paneller X ile kapanır, – ile küçülür, başlıktan sürüklenir.`;
}

function toolsSpec() { return Object.entries(COMMANDS).map(([name, c]) => ({ name, description: c.desc, parameters: c.params })); }

async function send(text) {
  text = (text || '').trim();
  if (!text || chat.busy) return;
  chat.msgs.push({ role: 'user', text });
  chat.busy = true; chat.draft = '';
  const before = app.snap;
  const steps = [];
  const prov = chatProvider();
  status = (t) => { chat.status = t; refreshChat(); };
  refreshChat();
  try {
    if (prov) {
      if (chat.prov !== prov) { chat.history = []; chat.prov = prov; }
      chat.history.push({ role: 'user', content: `${text}\n\n(Oynatıcı: ${fmt(app.engine.t)} · Süre: ${fmt(app.engine.duration())})` });
      if (chat.history.length > 40) chat.history = chat.history.slice(-30);
      // ilk mesaj kullanıcı olmalı (araç sonuçları yarım kalmasın)
      while (chat.history.length && chat.history[0].role !== 'user') chat.history.shift();
      const reply = await agent({
        provider: prov, system: system(), history: chat.history, tools: toolsSpec(),
        exec: async (name, args) => { status(`${name} çalışıyor…`); const r = await runCommand(name, args, { quiet: true }); steps.push({ name, r }); return r ? { ...r, before: undefined } : { ok: false }; },
      });
      chat.msgs.push({ role: 'bot', text: reply || 'Tamam.', steps, before: app.snap !== before ? before : null });
    } else {
      const cmds = parseLocal(text);
      const faq = FAQ.find(([re]) => re.test(norm(text)));
      if (faq && (!cmds.length || /nasil|nerede|ne ise|nedir/.test(norm(text)))) {
        chat.msgs.push({ role: 'bot', text: faq[1] });
      } else if (/(yardim|neler yapabilirsin|ne yapabilirsin|nasil kullan)/.test(norm(text)) || !cmds.length) {
        chat.msgs.push({ role: 'bot', text: helpText() });
      } else {
        const lines = [];
        for (const [n, a] of cmds) {
          status(`${n} çalışıyor…`);
          const r = await runCommand(n, a, { quiet: true });
          steps.push({ name: n, r });
          if (n === 'check_project') lines.push(...(r?.issues || []).map((x) => `• ${x}`));
          else lines.push(r?.ok === false ? `✗ ${r.error}` : `✓ ${r?.summary || n}`);
        }
        chat.msgs.push({ role: 'bot', text: lines.join('\n'), steps, before: app.snap !== before ? before : null });
      }
    }
  } catch (e) {
    chat.msgs.push({ role: 'bot', text: `Bir sorun oldu: ${e.message || e}`, err: true, before: app.snap !== before ? before : null });
  }
  chat.busy = false; chat.status = '';
  refreshChat();
}

const FAQ = [
  [/chroma|yesil perde|green/, 'Chroma key: videoya dokun → alttaki araçlardan "Chroma" → "Önizlemeden renk seç"e dokun ve görüntüde silinecek yeşile dokun. Tolerans ve kenar yumuşatmayı kaydırıcılarla ayarla.'],
  [/arka ?plan/, 'Arka plan silme: Yapay zekâ → "Arka plan sil". Seçili klip yoksa oynatıcının üzerindeki klip otomatik seçilir. "Arka planı sil"i aç; yerine bulanık, renk veya saydam seçebilirsin. Kişiyi başka bir videonun üstüne koymak için onu Düzen → "Katman ekle" ile ekle.'],
  [/gecis.*(nasil|nerede)|(nasil|nerede).*gecis/, 'Geçiş: zaman çizelgesinde iki klip arasındaki + noktasına dokun veya Efekt → Geçişler. En az 2 klip gerekir; tek klibin varsa oynatıcıyı ortaya getirip "Böl" de.'],
  [/panel|pencere|kapat|kucult/, 'Paneller: sağ üstteki X kapatır, – küçültür (önizlemenin üstünde çip olur, dokununca geri gelir). Başlıktan sürükleyerek taşırsın, alttaki panelde başlığı yukarı/aşağı çekerek boyunu ayarlarsın. Aynı anda 3 panel açık kalabilir; zaman çizelgesine dokununca onu örten paneller küçülür.'],
  [/keyframe|animasyon egri|egri/, 'Keyframe: öğeye dokun → Keyframe. ◆ ile işaret koy, başka zamana gidip değeri değiştir. Altta hareket eğrisini seç (Otomatik yumuşak, Elastik, Özel eğri…). "Tümünü otomatik yumuşat" tüm hareketleri pürüzsüzleştirir.'],
  [/tema|renk degis|gold|altin|beyaz arayuz/, 'Tema: ana ekrandaki palet simgesi veya Düzen → Tema. Obsidyen, Altın, Gümüş, Gece, Beyaz, Yakut, Zümrüt ve istediğin vurgu rengi var.'],
  [/favori/, 'Favoriler: efekt, filtre, geçiş, şablon, ses, müzik ve fontlarda ☆ simgesine dokun. Hepsi alttaki "Favoriler" düğmesinde toplanır.'],
  [/disa aktar|kaydet|export|indir/, 'Dışa aktarma: sağ üstteki "Dışa Aktar". 1080p/720p, 30/60 fps veya dosya boyutu sınırı seçebilirsin. Video Galeri/Alpicut klasörüne kaydedilir.'],
  [/kayit|mikrofon|ses kaydi/, 'Kayıt: Ses → Kayıt stüdyosu. "Doğal stüdyo" modunu kullan, geri sayımda sessiz kal (ortam gürültüsü ölçülür). Kayıttan sonra ham/işlenmiş hâlini dinleyip ekle.'],
  [/seslendir|metinden ses|eleven/, 'Seslendirme: Ses → Seslendirme. Cihazda (ücretsiz), OpenAI veya ElevenLabs motorunu seç, sesi dinle, metni yaz ve oluştur.'],
];

function helpText() {
  return `Merhaba, ben Alpi-co 👋 Videonu birlikte düzenleyelim. Bana şunları yazabilirsin:
• "Jumpcut yap" — duraklamaları keserim
• "Otomatik altyazı ekle"
• "Hışırtıyı temizle" — sesi stüdyo kalitesine getiririm
• "Başa hook başlık ekle: “BU GOL TARİHE GEÇTİ”"
• "Vivaldi müziği ekle" / "Müziği kıs"
• "3. saniyeye zoom ekle" · "Kesimlere flaş geçiş ekle"
• "Sona abone ol butonu koy" · "Boom ses efekti ekle"
• "Projeyi kontrol et"
${chatProvider() ? '' : '\nClaude veya ChatGPT hesabını bağlarsan (Hesaplar) serbest cümlelerle tüm kurguyu da yapabilirim.'}`;
}

let chatPanel = null;
function refreshChat() { if (chatPanel && chatPanel.el.isConnected) { const b = chatPanel.body; const st = b.scrollTop; chatPanel.cfg.render(b, null, chatPanel, true); void st; } }

export function openAlpico(prefill) {
  if (prefill) chat.draft = prefill;
  chatPanel = openSheet({
    id: 'alpico', title: 'Alpi-co', slot: 'bottom',
    actions: [{ icon: I.doctor, label: 'Proje kontrolü', onClick: () => openDoctor() }, { icon: I.trash, label: 'Sohbeti temizle', onClick: () => { chat.msgs = []; chat.history = []; refreshChat(); } }],
    render: (body, tab, panel, soft) => {
      chatPanel = panel || chatPanel;
      body.textContent = '';
      body.classList.add('chat-body');
      const prov = chatProvider();
      const head = h('div', { class: 'chat-mode' },
        h('span', { class: `chat-dot ${prov ? 'on' : ''}` }), prov ? `${PROVIDERS[prov].name.split(' ')[0]} bağlı · serbest konuş` : 'İnternetsiz mod · komutlarla çalışır',
        h('button', { class: 'chat-link', onclick: async () => { const { openAccounts } = await import('./ai.js'); openAccounts(); } }, prov ? 'Değiştir' : 'Claude / ChatGPT bağla'));
      const list = h('div', { class: 'chat-list' });
      if (!chat.msgs.length) list.append(bubble({ role: 'bot', text: helpText() }));
      chat.msgs.forEach((m) => list.append(bubble(m)));
      if (chat.busy) list.append(h('div', { class: 'chat-msg bot typing' }, h('span', { class: 'chat-av', html: I.bot }), h('div', { class: 'chat-b' }, h('i'), h('i'), h('i'), chat.status ? h('small', {}, chat.status) : null)));
      const sug = h('div', { class: 'chips scroll chat-sug' });
      SUGGEST.forEach((s) => sug.append(h('button', { onclick: () => send(s) }, s)));
      const inp = h('textarea', { class: 'chat-in', rows: 1, placeholder: 'Alpi-co\'ya yaz…' });
      inp.value = chat.draft || '';
      inp.addEventListener('input', () => { chat.draft = inp.value; inp.style.height = 'auto'; inp.style.height = `${Math.min(110, inp.scrollHeight)}px`; });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inp.value); } });
      const sendB = h('button', { class: 'chat-send', html: I.send, 'aria-label': 'Gönder', disabled: chat.busy, onclick: () => send(inp.value) });
      body.append(head, list, sug, h('div', { class: 'chat-bar' }, inp, sendB));
      requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
      void tab; void soft;
    },
  });
}

const STEP_NAMES = { project_info: 'Proje incelendi', get_transcript: 'Konuşma okundu', jumpcut: 'Jumpcut', auto_captions: 'Altyazı', add_text: 'Yazı', add_cta: 'Buton', add_music: 'Müzik', add_sfx: 'Ses efekti', zoom: 'Zoom', add_transitions: 'Geçiş', set_ratio: 'Oran', apply_filter: 'Filtre', set_speed: 'Hız', set_volume: 'Ses seviyesi', denoise: 'Ses temizliği', duck_music: 'Müzik kısma', delete_range: 'Kesim', add_effect: 'Efekt', check_project: 'Kontrol', seek: 'Git' };
function bubble(m) {
  const b = h('div', { class: `chat-b${m.err ? ' err' : ''}` }, m.text);
  if (m.steps?.length) {
    const st = h('div', { class: 'chat-steps' });
    m.steps.forEach((s) => st.append(h('span', { class: s.r?.ok === false ? 'bad' : '' }, `${s.r?.ok === false ? '✗' : '✓'} ${STEP_NAMES[s.name] || s.name}`)));
    b.append(st);
  }
  if (m.before) {
    const ub = h('button', { class: 'chat-undo', html: `${I.undo} Geri al` });
    ub.addEventListener('click', () => { app.restoreTo(m.before); m.before = null; m.undone = true; toast('Alpi-co\'nun değişiklikleri geri alındı'); refreshChat(); });
    b.append(ub);
  } else if (m.undone) b.append(h('small', { class: 'chat-undone' }, 'Geri alındı'));
  return h('div', { class: `chat-msg ${m.role}` }, m.role === 'bot' ? h('span', { class: 'chat-av', html: I.bot }) : null, b);
}

void selected; void lsGet;
