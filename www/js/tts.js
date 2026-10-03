// Alpicut — Seslendirme stüdyosu (ElevenLabs tarzı): ses kartları, ton/duygu ön ayarları, önizleme, satır satır klip
// Motorlar: Cihazda (Piper, ücretsiz, internetsiz), OpenAI (gpt-4o-mini-tts), ElevenLabs (kendi anahtarınla)
import { app, h, toast, uid } from './state.js';
import { I } from './icons.js';
import { openSheet, refreshSheet, fields } from './sheets.js';
import { lsGet, lsSet } from './storage.js';
import { hasKey, ttsOpenAI, ttsEleven, elevenVoices, OPENAI_VOICES, PROVIDERS, getModel, setModel } from './aiapi.js';
import { star } from './favs.js';

export const PIPER_VOICES = [
  ['tr_TR-dfki-medium', 'Deniz', 'Türkçe · Erkek'], ['tr_TR-fahrettin-medium', 'Fahrettin', 'Türkçe · Erkek'], ['tr_TR-fettah-medium', 'Fettah', 'Türkçe · Erkek'],
  ['en_US-hfc_female-medium', 'Hannah', 'İngilizce · Kadın'], ['en_US-ryan-medium', 'Ryan', 'İngilizce · Erkek'], ['en_US-amy-medium', 'Amy', 'İngilizce · Kadın'], ['en_GB-alba-medium', 'Alba', 'İngilizce (UK) · Kadın'],
  ['de_DE-thorsten-medium', 'Thorsten', 'Almanca · Erkek'], ['es_ES-davefx-medium', 'Dave', 'İspanyolca · Erkek'], ['fr_FR-siwis-medium', 'Siwis', 'Fransızca · Kadın'], ['ar_JO-kareem-medium', 'Kareem', 'Arapça · Erkek'], ['it_IT-paola-medium', 'Paola', 'İtalyanca · Kadın'],
];

export const TONES = [
  ['natural', 'Doğal', 'Doğal, akıcı ve samimi konuş.', { stability: 0.5, style: 0.2 }],
  ['sports', 'Heyecanlı spiker', 'Heyecanlı bir futbol spikeri gibi, yüksek enerjiyle, vurgulu ve hızlı konuş.', { stability: 0.3, style: 0.7 }],
  ['narrator', 'Belgesel anlatıcı', 'Derin, sakin ve otoriter bir belgesel anlatıcısı gibi konuş.', { stability: 0.7, style: 0.25 }],
  ['ad', 'Reklam', 'Enerjik, ikna edici ve gülümseyen bir reklam seslendirmesi gibi konuş.', { stability: 0.45, style: 0.55 }],
  ['story', 'Hikâye', 'Merak uyandıran, duraklamalı ve sıcak bir hikâye anlatıcısı gibi konuş.', { stability: 0.55, style: 0.45 }],
  ['news', 'Haber', 'Net, tarafsız ve profesyonel bir haber spikeri gibi konuş.', { stability: 0.75, style: 0.1 }],
  ['calm', 'Sakin / ASMR', 'Çok yumuşak, yavaş ve rahatlatıcı konuş.', { stability: 0.8, style: 0.1 }],
  ['dramatic', 'Dramatik', 'Dramatik, gergin ve sinematik bir fragman sesi gibi konuş.', { stability: 0.35, style: 0.8 }],
];

const AVA = ['#8B5CF6', '#D4AF37', '#10B981', '#3B82F6', '#E11D48', '#F97316', '#06B6D4', '#EC4899'];
const ava = (name, i) => h('span', { class: 'v-ava', style: { background: `linear-gradient(135deg, ${AVA[i % AVA.length]}, ${AVA[(i + 3) % AVA.length]})` } }, (name || '?').slice(0, 1).toUpperCase());

let piperP = null;
const piper = () => (piperP || (piperP = import('../vendor/piper/piper-tts-web.js')));
let elevenCache = null;

async function synth(st, text) {
  if (st.engine === 'openai') {
    const tone = TONES.find((t) => t[0] === st.tone);
    return ttsOpenAI(text, { voice: st.oaVoice, instructions: `${tone ? tone[2] : ''} ${st.extra || ''}`.trim(), speed: st.speed });
  }
  if (st.engine === 'eleven') return ttsEleven(text, { voiceId: st.elVoice, stability: st.stability, similarity: st.similarity, style: st.style, speed: st.speed });
  const T = await piper();
  return T.predict({ text, voiceId: st.voice }, (p) => { if (p && p.total) { st.log = `Ses modeli indiriliyor… %${Math.round((p.loaded / p.total) * 100)}`; refreshSheet(); } });
}

let player = null;
function playBlob(blob, btn) {
  if (player) { player.pause(); if (player._b) player._b.innerHTML = I.play; const same = player._b === btn; player = null; if (same) return; }
  player = new Audio(URL.createObjectURL(blob)); player._b = btn; if (btn) btn.innerHTML = I.pause;
  player.onended = () => { if (btn) btn.innerHTML = I.play; player = null; };
  player.play().catch(() => toast('Çalınamadı'));
}

export function openTTS(prefill) {
  const st = {
    engine: lsGet('alpicut.ttsEngine', 'piper'), text: prefill || '', voice: lsGet('alpicut.voice', 'tr_TR-dfki-medium'), oaVoice: lsGet('alpicut.oaVoice', 'coral'), elVoice: lsGet('alpicut.elVoice', ''),
    tone: 'natural', extra: '', speed: 1, stability: 0.5, similarity: 0.75, style: 0.2, perLine: false, running: false, log: '', result: null,
  };
  if (!['piper', 'openai', 'eleven'].includes(st.engine)) st.engine = 'piper';
  openSheet({
    id: 'tts', title: 'Seslendirme stüdyosu', tabs: ['Cihazda', 'OpenAI', 'ElevenLabs'], tab: { piper: 'Cihazda', openai: 'OpenAI', eleven: 'ElevenLabs' }[st.engine],
    onClose: () => { if (player) { player.pause(); player = null; } },
    render: (body, tab) => {
      st.engine = { Cihazda: 'piper', OpenAI: 'openai', ElevenLabs: 'eleven' }[tab] || 'piper';
      lsSet('alpicut.ttsEngine', st.engine);
      if (st.engine !== 'piper' && !hasKey(st.engine)) {
        body.append(h('div', { class: 'acc-empty' }, h('span', { html: I.key }), h('b', {}, `${PROVIDERS[st.engine].name} bağlı değil`),
          h('p', { class: 'hint' }, st.engine === 'eleven' ? 'ElevenLabs en doğal ve duygulu sesleri verir (Türkçe dahil). Kendi hesabının API anahtarıyla çalışır; ücretsiz planda aylık sınırlı karakter vardır.' : 'OpenAI sesleri tona göre (heyecanlı spiker, belgesel…) konuşabilir. Kendi API anahtarınla çalışır; kullanım ücreti OpenAI\'ye aittir.'),
          h('button', { class: 'btn primary block', html: `${I.key} Hesabı bağla`, onclick: async () => { const { openAccounts } = await import('./ai.js'); openAccounts(st.engine); } })));
        return;
      }
      // ses kartları
      body.append(h('div', { class: 'sub-title' }, 'Ses'));
      const grid = h('div', { class: 'v-grid' });
      const card = (id, name, tag, i, sel, onSel, onPrev) => {
        const pb = h('button', { class: 'v-play', html: I.play, 'aria-label': 'Dinle' });
        pb.addEventListener('click', (e) => { e.stopPropagation(); onPrev(pb); });
        const c = h('div', { class: `v-card${sel ? ' on' : ''}`, role: 'button' }, ava(name, i), h('span', { class: 'v-t' }, h('b', {}, name), h('small', {}, tag)), pb, star('voice', `${st.engine}:${id}`, { name: `${name} (${tag})`, engine: st.engine, voice: id }));
        c.addEventListener('click', () => { onSel(); refreshSheet(); });
        return c;
      };
      const sample = 'Merhaba! Bu ses Alpicut seslendirme stüdyosundan geliyor.';
      if (st.engine === 'piper') {
        PIPER_VOICES.forEach(([id, n, tag], i) => grid.append(card(id, n, tag, i, st.voice === id, () => { st.voice = id; lsSet('alpicut.voice', id); }, async (b) => {
          b.innerHTML = '…';
          try { const w = await synth({ ...st, voice: id }, id.startsWith('tr') ? sample : id.startsWith('en') ? 'Hello! This voice comes from the Alpicut voice studio.' : 'Alpicut.'); playBlob(w, b); } catch (e) { b.innerHTML = I.play; toast(`Ses yüklenemedi: ${e.message || e}`, 4000); }
        })));
      } else if (st.engine === 'openai') {
        OPENAI_VOICES.forEach(([id, lbl], i) => grid.append(card(id, lbl.split(' ')[0], lbl.replace(/^\w+ /, '').replace(/[()]/g, ''), i, st.oaVoice === id, () => { st.oaVoice = id; lsSet('alpicut.oaVoice', id); }, async (b) => {
          b.innerHTML = '…'; try { playBlob(await synth({ ...st, oaVoice: id }, sample), b); } catch (e) { b.innerHTML = I.play; toast(e.message, 4000); }
        })));
      } else {
        if (!elevenCache) {
          grid.append(h('div', { class: 'spinner' }));
          elevenVoices().then((v) => { elevenCache = v; if (!st.elVoice && v[0]) st.elVoice = v[0].id; refreshSheet(); }).catch((e) => { elevenCache = []; toast(e.message, 5000); refreshSheet(); });
        } else {
          elevenCache.forEach((v, i) => grid.append(card(v.id, v.name, [v.labels.gender, v.labels.accent, v.labels.age].filter(Boolean).join(' · ') || v.cat || '', i, st.elVoice === v.id, () => { st.elVoice = v.id; lsSet('alpicut.elVoice', v.id); }, (b) => {
            if (v.preview) { const a = new Audio(v.preview); a.play().catch(() => toast('Önizleme çalınamadı')); } else toast('Önizleme yok');
            void b;
          })));
          const mdl = { m: getModel('eleven') };
          body.append(grid);
          body.append(fields(mdl, [{ label: 'Model', path: 'm', type: 'chips', options: PROVIDERS.eleven.models, post: (o) => setModel('eleven', o.m) }]));
        }
      }
      if (!grid.isConnected) body.append(grid);
      // metin
      body.append(h('div', { class: 'sub-title' }, 'Metin'));
      const ta = h('textarea', { class: 'tts-text', placeholder: 'Seslendirilecek metni yaz… Her satırı ayrı klip yapmak için alttaki seçeneği aç.' });
      ta.value = st.text;
      const cnt = h('small', { class: 'tts-cnt' }, `${st.text.length} karakter`);
      ta.addEventListener('input', () => { st.text = ta.value; cnt.textContent = `${st.text.length} karakter`; });
      body.append(ta, cnt);
      const quick = h('div', { class: 'chips scroll' });
      if (app.P?.subs?.cues?.length) quick.append(h('button', { onclick: () => { st.text = app.P.subs.cues.map((c) => c.text).join('\n'); refreshSheet(); } }, 'Altyazı metnini kullan'));
      quick.append(h('button', { onclick: () => { st.text += (st.text ? ' ' : '') + '… '; refreshSheet(); } }, '+ duraklama'));
      body.append(quick);
      // ton
      if (st.engine !== 'piper') {
        body.append(h('div', { class: 'sub-title' }, 'Ton / duygu'));
        const tc = h('div', { class: 'chips' });
        TONES.forEach(([id, n, , el]) => tc.append(h('button', { class: st.tone === id ? 'on' : '', onclick: () => { st.tone = id; if (st.engine === 'eleven') { st.stability = el.stability; st.style = el.style; } refreshSheet(); } }, n)));
        body.append(tc);
      }
      body.append(fields(st, [
        { label: 'Hız', path: 'speed', type: 'range', min: 0.7, max: 1.3, step: 0.05, def: 1, fmt: (x) => `${x.toFixed(2)}x`, hide: st.engine === 'piper' },
        { label: 'Stabilite (düşük = daha duygulu)', path: 'stability', type: 'range', min: 0, max: 1, step: 0.05, def: 0.5, fmt: (x) => `${Math.round(x * 100)}%`, hide: st.engine !== 'eleven' },
        { label: 'Sese benzerlik', path: 'similarity', type: 'range', min: 0, max: 1, step: 0.05, def: 0.75, fmt: (x) => `${Math.round(x * 100)}%`, hide: st.engine !== 'eleven' },
        { label: 'Stil abartısı', path: 'style', type: 'range', min: 0, max: 1, step: 0.05, def: 0.2, fmt: (x) => `${Math.round(x * 100)}%`, hide: st.engine !== 'eleven' },
        { label: 'Ek yönerge (ör. "Gol anında bağır")', path: 'extra', type: 'text', hide: st.engine !== 'openai' },
        { label: 'Her satırı ayrı klip yap (arka arkaya dizilir)', path: 'perLine', type: 'toggle' },
      ]));
      if (st.engine === 'piper') body.append(h('p', { class: 'hint' }, 'Cihazda motoru ücretsizdir ve internetsiz çalışır; her ses ilk kullanımda bir kez indirilir (~60 MB). Daha duygulu sesler için OpenAI veya ElevenLabs sekmesini kullan.'));
      if (st.running) { body.append(h('div', { class: 'spinner' }), h('p', { class: 'hint', style: { textAlign: 'center' } }, st.log)); return; }
      if (st.result) {
        const pb = h('button', { class: 'btn', html: `${I.play} Dinle` });
        pb.addEventListener('click', () => playBlob(st.result.blobs[0], null));
        body.append(h('div', { class: 'tts-res' }, h('b', {}, `${st.result.blobs.length} ses hazır`), h('div', { class: 'btn-row' }, pb, h('button', { class: 'btn primary', html: `${I.plus} Projeye ekle`, onclick: () => addResult(st) }))));
      }
      body.append(h('button', { class: 'btn block primary', style: { marginTop: '8px' }, html: `${I.wand} Sesi oluştur`, onclick: () => generate(st) }));
    },
  });
}

async function generate(st) {
  const text = st.text.trim();
  if (!text) { toast('Önce metin yaz'); return; }
  const parts = st.perLine ? text.split(/\n+/).map((x) => x.trim()).filter(Boolean) : [text];
  st.running = true; st.result = null; st.log = 'Ses oluşturuluyor…'; refreshSheet();
  try {
    const blobs = [];
    for (let i = 0; i < parts.length; i++) { st.log = `Ses oluşturuluyor… (${i + 1}/${parts.length})`; refreshSheet(); blobs.push(await synth(st, parts[i])); }
    st.result = { blobs, parts };
  } catch (e) {
    toast(/fetch|network|Failed/i.test(e.message || '') ? 'Bağlantı hatası — internetini kontrol et' : (e.message || 'Ses oluşturulamadı'), 5000);
  }
  st.running = false; refreshSheet();
}

async function addResult(st) {
  const r = st.result;
  if (!r) return;
  let t = app.engine.t;
  for (let i = 0; i < r.blobs.length; i++) {
    const b = r.blobs[i];
    const ext = b.type.includes('mpeg') ? 'mp3' : 'wav';
    const recs = await app.importFiles([new File([b], `Seslendirme_${i + 1}.${ext}`, { type: b.type })], true);
    if (!recs[0]) continue;
    const d = recs[0].duration || 2;
    app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: t, in: 0, out: d, volume: 1, fadeIn: 0, fadeOut: 0.03, role: 'voice' });
    t += d + 0.15;
  }
  app.commit();
  st.result = null;
  toast(`${r.blobs.length} seslendirme eklendi`);
  refreshSheet();
}
