// Alpicut v1.7 — Vibe editing: istediğin videoyu anlat, medyanı seç; Alpicut kurgular.
// Yapay zekâ bağlıysa (Claude, ChatGPT, DeepSeek…) kurguyu ajan yapar ve HyperFrames esinli Motion stüdyosu
// şablonlarını, geçişleri, müzik ve ses efektlerini kendisi yerleştirir. Bağlı değilse seçilen "vibe" tarifine göre
// internetsiz kurgu kurulur — her durumda tek dokunuşla geri alınabilir.
import { app, h, toast, uid, clone } from './state.js';
import { I } from './icons.js';
import { openSheet, refreshSheet, closeSheet, fields } from './sheets.js';
import { RATIOS, SUB_BASE, FX_BASE, anim } from './presets.js';
import { lsGet, lsSet } from './storage.js';
import { chatProvider, agent, PROVIDERS } from './aiapi.js';
import { SOCIAL_TEMPLATES3 } from './social3.js';

// [id, ad, simge, açıklama, tarif]
export const VIBES = [
  ['cinematic', 'Sinematik', '🎬', 'Ağır, sinema şeritli, ışık sızmalı', { intro: 'm_sting', trans: 'hf_light_leak', td: 0.8, fx: { letterbox: 0.14, vignette: 0.35, grain: 0.2 }, mood: 'dramatik', maxClip: 6, outro: 'm_quote' }],
  ['energy', 'Enerjik shorts', '⚡', 'Hızlı kesim, whip pan, kinetik yazı', { intro: 'm_kinetic', trans: 'hf_whip_pan', td: 0.35, mood: 'hizli', maxClip: 2.5, sfx: 'whoosh', outro: 'm_success' }],
  ['ai', 'Yapay zekâ / teknoloji', '✨', 'Nöral geçiş, kod, Alpi-co ekranı', { intro: 'm_scramble', trans: 'ai_neural', td: 0.6, mid: 'm_aithink', mood: 'epik', maxClip: 4, outro: 'm_repo' }],
  ['vlog', 'Günlük vlog', '☀️', 'Sıcak, sade, alt bantlı', { intro: 'm_lt2', trans: 'fade', td: 0.5, mood: 'neseli', maxClip: 5, outro: 'm_confetti' }],
  ['doc', 'Belgesel', '🎞️', 'Serif başlık, yavaş zoom', { intro: 'm_quote', trans: 'hf_cinematic_zoom', td: 0.9, fx: { letterbox: 0.1, vignette: 0.3 }, mood: 'sakin', maxClip: 7, outro: 'm_timeline' }],
  ['funny', 'Komik', '😂', 'Flaş geçiş, pop efektler', { intro: 'm_kinetic', trans: 'hf_flash_through_white', td: 0.3, mood: 'neseli', maxClip: 3, sfx: 'pop', outro: 'm_stamp' }],
  ['luxury', 'Lüks / otel', '🥂', 'Cam alt bant, yumuşak ışık', { intro: 'm_lt4', trans: 'hf_light_leak', td: 1, fx: { vignette: 0.25 }, mood: 'sakin', maxClip: 5, outro: 'm_sting' }],
  ['recipe', 'Tarif', '🍳', 'Kağıt başlık, adımlar', { intro: 'm_paper2', trans: 'hf_cross_warp_morph', td: 0.5, mid: 'm_steps', mood: 'neseli', maxClip: 4, outro: 'm_sticky' }],
  ['paper', 'Kağıt stop-motion', '✂️', 'El yapımı, kare tutmalı', { intro: 'm_paper', trans: 'ai_dissolve', td: 0.5, fxLayer: 'paper', mood: 'sakin', maxClip: 4, outro: 'm_stamp' }],
  ['motivation', 'Motivasyon', '🔥', 'Fosforlu vurgu, epik müzik', { intro: 'm_marker', trans: 'hf_domain_warp', td: 0.7, mood: 'epik', maxClip: 4, outro: 'm_quote' }],
  ['travel', 'Seyahat', '✈️', 'Tabela açılışı, akıcı geçiş', { intro: 'm_flap', trans: 'hf_swirl_vortex', td: 0.6, mood: 'neseli', maxClip: 4, outro: 'm_lt4' }],
  ['scifi', 'Sci-fi / oyun', '🛸', 'HUD, hologram, glitch', { intro: 'm_lockok', trans: 'ai_holo', td: 0.5, mid: 'm_tele', mood: 'epik', maxClip: 3, sfx: 'glitch', outro: 'm_alertok' }],
];

const st = { prompt: '', vibe: lsGet('alpicut.vibe', 'cinematic'), ratio: lsGet('alpicut.ratio', '9:16'), files: [], music: true, useAI: true, running: false, log: [], before: null, done: '' };

export function openVibe(reset = true) {
  if (reset) { st.done = ''; st.running = false; }
  openSheet({
    id: 'vibe', title: 'Vibe editing', tall: true,
    render: (body) => {
      if (st.running) {
        body.append(h('div', { class: 'vibe-run' }, h('div', { class: 'vibe-orb' }), h('b', {}, 'Kurguluyor…')));
        const lg = h('div', { class: 'ae-log' }); st.log.slice(-10).forEach((l) => lg.append(h('div', {}, l))); body.append(lg);
        return;
      }
      if (st.done) {
        body.append(h('div', { class: 'ai-out' }, st.done));
        body.append(h('div', { class: 'btn-row' },
          st.before ? h('button', { class: 'btn', html: `${I.undo} Geri al`, onclick: () => { app.restoreTo(st.before); st.before = null; st.done = ''; refreshSheet(); } }) : h('span'),
          h('button', { class: 'btn primary', html: `${I.play} Oynat`, onclick: () => { closeSheet(); app.engine.seek(0); app.play(); } })));
        return;
      }
      body.append(h('p', { class: 'hint' }, 'Nasıl bir video istediğini kendi cümlelerinle yaz, havasını seç, medyanı ekle. Gerisini Alpicut yapar.'));
      const ta = h('textarea', { class: 'vibe-prompt', rows: 3, placeholder: 'Örn: Kapadokya gezimden, gün doğumunda balonlarla başlayan duygusal bir video. Sonunda “Tekrar geleceğim” yazsın.' });
      ta.value = st.prompt;
      ta.addEventListener('input', () => { st.prompt = ta.value; });
      body.append(ta);
      const vg = h('div', { class: 'vibe-grid' });
      VIBES.forEach(([id, n, ic, d], i) => vg.append(h('button', { class: `vibe-chip${st.vibe === id ? ' on' : ''}`, style: { '--i': String(i) }, onclick: () => { st.vibe = id; lsSet('alpicut.vibe', id); refreshSheet(); } }, h('span', { class: 'vc-ic' }, ic), h('b', {}, n), h('small', {}, d))));
      body.append(h('div', { class: 'sub-title' }, 'Havası'), vg);
      body.append(fields(st, [
        { label: 'Oran', path: 'ratio', type: 'chips', options: Object.keys(RATIOS).map((r) => [r, r]) },
        { label: 'Fon müziği ekle', path: 'music', type: 'toggle' },
      ]));
      const prov = chatProvider();
      if (prov) body.append(fields(st, [{ label: `Kurguyu ${PROVIDERS[prov].name} yapsın (motion, geçiş, efekt seçimi)`, path: 'useAI', type: 'toggle' }]));
      else body.append(h('p', { class: 'hint', html: 'Yapay zekâ bağlı değil: seçtiğin havaya göre <b>internetsiz</b> kurgu yapılır. Daha akıllı kurgu için Hesaplar\'dan Claude / ChatGPT / DeepSeek bağlayabilirsin.' }));
      const fl = h('div', { class: 'vibe-files' }, st.files.length ? `${st.files.length} dosya seçildi` : 'Henüz medya seçilmedi');
      body.append(h('div', { class: 'btn-row' },
        h('button', { class: 'btn', html: `${I.media} Video / foto seç`, onclick: async () => { const f = await app.pickFiles('video/*,image/*', true); if (f.length) { st.files = f; refreshSheet(); } } }),
        h('button', { class: 'btn', html: `${I.folder || I.media} Assets'ten`, onclick: async () => { try { const a = await import('./assets.js'); a.openAssets({ pick: (recs) => { st.picked = recs; st.files = recs.map((r) => r.blob ? new File([r.blob], r.name || 'medya', { type: r.blob.type }) : null).filter(Boolean); refreshSheet(); } }); } catch (_) { toast('Assets penceresi açılamadı'); } } })));
      body.append(fl);
      body.append(h('button', { class: 'btn block primary vibe-go', html: `✦ Vibe edit başlat`, disabled: !st.files.length || null, onclick: () => runVibe() }));
    },
  });
}

const titleFrom = (s) => {
  const w = String(s || '').replace(/[“”"]/g, '').split(/\s+/).filter(Boolean).slice(0, 5);
  if (!w.length) return 'YENİ *VİDEO*';
  const up = w.map((x) => x.toLocaleUpperCase('tr-TR'));
  up[up.length - 1] = `*${up[up.length - 1].replace(/[.,!?]+$/, '')}*`;
  return up.join(' ');
};

function motion(id, start, dur, extra = {}) {
  const tp = SOCIAL_TEMPLATES3.find((t) => t.id === id);
  if (!tp) return null;
  return { kind: 'social', x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, scale: 1, dark: false, accent: '#9D8CF2', ...clone(tp.p), ...extra, id: uid(), start, end: start + (dur ?? tp.dur ?? 4), kf: {} };
}

async function runVibe() {
  const V = VIBES.find((v) => v[0] === st.vibe) || VIBES[0];
  const R = V[4];
  st.running = true; st.log = ['Proje hazırlanıyor…']; refreshSheet();
  const log = (t) => { st.log.push(t); refreshSheet(); };
  try {
    // 1) yeni proje + medya
    app.newProject({ name: `Vibe · ${V[1]}`, ratio: st.ratio, silent: true, build: () => ({ dur: 0, layers: [], subs: clone(SUB_BASE), fx: clone(FX_BASE) }) });
    openVibe(false); // editör açılınca panel kapanır; ilerlemeyi göstermek için yeniden aç
    const recs = await app.importFiles(st.files);
    const P = app.P;
    recs.forEach((m) => {
      if (m.kind === 'audio') { P.audio.push(app.newAudio(m, 0)); return; }
      const c = app.makeClip(m);
      if (m.kind === 'image') c.dur = Math.max(1.5, R.maxClip * 0.8);
      else if (R.maxClip && (m.duration || 0) > R.maxClip * 2.5) { const mid = (m.duration - R.maxClip * 2) / 2; c.in = Math.max(0, mid); c.out = Math.min(m.duration, c.in + R.maxClip * 2); }
      P.clips.push(c);
    });
    app.commit();
    st.before = app.snap;
    log(`${recs.length} medya eklendi`);
    const prov = chatProvider();
    let aiDone = false;
    if (prov && st.useAI) {
      try { await aiVibe(V, log); aiDone = true; } catch (e) { log(`Yapay zekâ kurgusu olmadı (${e.message || e}); internetsiz kurguya geçiliyor`); }
    }
    if (!aiDone) await offlineVibe(V, log);
    app.engine.seek(0);
    st.done = aiDone ? 'Kurgu hazır ✓ Yapay zekâ seçimlerini yaptı. Beğenmediğin her şeyi tek tek değiştirebilir ya da tamamen geri alabilirsin.' : `Kurgu hazır ✓ “${V[1]}” havasında: açılış, geçişler, ${R.mid ? 'ara motion, ' : ''}kapanış${st.music && st.musicOk ? ', müzik' : ''}. Hepsi düzenlenebilir.${st.music && !st.musicOk ? ' (Müzik eklenemedi — internet bağlantını kontrol et.)' : ''}`;
  } catch (e) {
    st.done = `Kurgu yarıda kaldı: ${e.message || e}`;
  }
  st.running = false; refreshSheet();
}

// internetsiz tarif
async function offlineVibe(V, log) {
  const R = V[4];
  const P = app.P;
  const { runCommand } = await import('./alpico.js');
  // geçişler
  P.clips.forEach((c, i) => { if (i > 0) c.trans = { type: R.trans === 'fade' ? 'fade' : `gl:${R.trans}`, dur: R.td || 0.5 }; });
  app.commit();
  const D = app.engine.duration();
  // açılış
  const intro = motion(R.intro, 0, Math.min(3.5, Math.max(2, D * 0.25)), { text: titleFrom(st.prompt), name: st.prompt.split(/[.,]/)[0].slice(0, 28) || 'Alpicut', title: V[1], y: R.intro.startsWith('m_lt') ? 0.8 : 0.32 });
  if (intro) P.layers.push(intro);
  // ara motion
  if (R.mid && D > 8) { const m = motion(R.mid, D * 0.45, Math.min(5, D * 0.3), { y: 0.5 }); if (m) P.layers.push(m); }
  // kapanış
  const tail = (st.prompt.match(/[“"]([^”"]+)[”"]/) || [])[1];
  if (R.outro && D > 4) { const o = motion(R.outro, Math.max(0, D - 3), 3, tail ? { text: tail, title: tail } : { y: 0.5 }); if (o) P.layers.push(o); }
  if (R.fx) P.fx = { ...P.fx, ...R.fx };
  if (R.fxLayer) P.layers.unshift({ id: uid(), kind: 'fx', effect: R.fxLayer, start: 0, end: D, amount: 1, speed: 1, fps: 8, x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, kf: {}, anim: anim('none', 'none') });
  app.commit();
  log('Açılış, geçişler ve kapanış yerleştirildi');
  if (R.sfx) {
    const lay = (await import('./engine.js')).layoutClips(P.clips);
    for (const L of lay.slice(1, 6)) { try { await runCommand('add_sfx', { query: R.sfx, at: Math.max(0, L.start - 0.1) }, { quiet: true }); } catch (_) { /* yoksay */ } }
    log('Ses efektleri eklendi');
  }
  if (st.music) { try { const r = await runCommand('add_music', { query: R.mood, volume: 0.25 }, { quiet: true }); st.musicOk = r?.ok !== false; log(r?.summary || r?.error || 'Müzik'); } catch (e) { st.musicOk = false; log('Müzik eklenemedi (internet?)'); } }
}

// yapay zekâ ajanı
async function aiVibe(V, log) {
  const { COMMANDS, runCommand } = await import('./alpico.js');
  const tools = Object.entries(COMMANDS).filter(([n]) => n !== 'seek').map(([name, c]) => ({ name, description: c.desc, parameters: c.params }));
  const R = V[4];
  const sys = `Sen "vibe editing" yapan yaratıcı bir video editörüsün ve Alpicut'ı araçlarla kontrol ediyorsun. Türkçe düşün.
Kullanıcı istediği videoyu kendi cümleleriyle anlattı; medya zaten ana ize eklendi. Görevin bu anlatımı en iyi hissettirecek kurguyu kurmak.
Seçilen hava: ${V[1]} — ${V[3]}. Önerilen geçiş: gl:${R.trans}. Önerilen motion açılışı: ${R.intro}.
Motion stüdyosu (HyperFrames esinli hareketli şablonlar) çok güçlü: önce motion_catalog çağır, sonra add_motion ile 2-4 tane yerleştir (açılış başlığı, gerekiyorsa ara bilgi kartı, kapanış). Metinleri kullanıcının anlatımına göre Türkçe yaz.
Adımlar: 1) project_info. 2) add_transitions ile kesimlere uygun geçiş. 3) motion_catalog + add_motion. 4) Uygun yerlere add_sfx. ${st.music ? `5) add_music (ruh hali: ${R.mood}, seviye 0.25).` : ''} 6) check_project ve düzelt.
Aşırıya kaçma; hikâye akışı önemli. Son mesajında yaptıklarını kısa madde madde yaz.`;
  log('Yapay zekâ kurguyu planlıyor…');
  const reply = await agent({
    system: sys, history: [{ role: 'user', content: `Videom: ${st.prompt || '(açıklama yok, havaya göre kurgula)'}` }], tools, maxSteps: 18,
    exec: async (name, args) => { log(`▸ ${name}`); const r = await runCommand(name, args, { quiet: true }); if (r?.summary) log(`  ✓ ${r.summary}`); if (r?.ok === false) log(`  ✗ ${r.error}`); return r ? { ...r, before: undefined } : { ok: false }; },
    onStep: (s) => { if (s.type === 'text' && s.text) log(s.text.slice(0, 120)); },
  });
  if (reply) log(reply.slice(0, 300));
}
