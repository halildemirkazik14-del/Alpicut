// Alpicut — bulut yapay zekâ bağlantıları (kullanıcının kendi anahtarlarıyla): Claude, ChatGPT/OpenAI, ElevenLabs
// Anahtarlar yalnızca bu cihazda (localStorage) saklanır. İstekler doğrudan sağlayıcıya gider.
import { lsGet, lsSet } from './storage.js';

// kind: 'anthropic' (Messages API) | 'openai' (Chat Completions uyumlu) | 'tts'
// Model listesindeki adlar öneridir; her sağlayıcıda "Özel model" alanına istediğin modeli yazabilirsin.
export const PROVIDERS = {
  anthropic: { name: 'Claude (Anthropic)', short: 'Claude', logo: 'C', color: '#D97757', kind: 'anthropic', base: 'https://api.anthropic.com/v1', keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-…', models: [['claude-sonnet-5-5', 'Claude Sonnet 5.5 (önerilen)'], ['claude-opus-5-5', 'Claude Opus 5.5 (en güçlü)'], ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5 (hızlı, ucuz)']], use: 'Alpi-co sohbet, otomatik kurgu, başlık/hashtag, altyazı düzeltme' },
  openai: { name: 'ChatGPT (OpenAI)', short: 'ChatGPT', logo: 'G', color: '#10A37F', kind: 'openai', base: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…', models: [['gpt-5-mini', 'GPT-5 mini (hızlı)'], ['gpt-5', 'GPT-5'], ['gpt-4.1', 'GPT-4.1'], ['gpt-4o-mini', 'GPT-4o mini (ucuz)']], use: 'Alpi-co, otomatik kurgu, en doğru altyazı (Whisper), duygulu seslendirme', asr: true },
  deepseek: { name: 'DeepSeek', short: 'DeepSeek', logo: 'D', color: '#4D6BFE', kind: 'openai', base: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', keyHint: 'sk-…', models: [['deepseek-chat', 'DeepSeek Chat (önerilen, çok ucuz)'], ['deepseek-reasoner', 'DeepSeek Reasoner (düşünen; araç kullanmaz)']], use: 'Alpi-co, otomatik kurgu, başlık/hashtag — çok uygun fiyatlı' },
  gemini: { name: 'Gemini (Google)', short: 'Gemini', logo: 'G', color: '#4285F4', kind: 'openai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…', models: [['gemini-2.5-flash', 'Gemini 2.5 Flash (önerilen, ücretsiz kota)'], ['gemini-2.5-pro', 'Gemini 2.5 Pro'], ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite']], use: 'Alpi-co, otomatik kurgu — Google AI Studio ücretsiz kotası ile' },
  groq: { name: 'Groq', short: 'Groq', logo: 'Q', color: '#F55036', kind: 'openai', base: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_…', models: [['llama-3.3-70b-versatile', 'Llama 3.3 70B (çok hızlı)'], ['openai/gpt-oss-120b', 'GPT-OSS 120B']], use: 'Çok hızlı sohbet + ücretsiz kotalı Whisper altyazı (çok doğru)', asr: true },
  mistral: { name: 'Mistral', short: 'Mistral', logo: 'M', color: '#FA520F', kind: 'openai', base: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', keyHint: '…', models: [['mistral-large-latest', 'Mistral Large'], ['mistral-small-latest', 'Mistral Small (ucuz)']], use: 'Alpi-co, otomatik kurgu' },
  xai: { name: 'Grok (xAI)', short: 'Grok', logo: 'X', color: '#9CA3AF', kind: 'openai', base: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai', keyHint: 'xai-…', models: [['grok-4', 'Grok 4'], ['grok-3-mini', 'Grok 3 mini (hızlı)']], use: 'Alpi-co, otomatik kurgu' },
  openrouter: { name: 'OpenRouter (tüm modeller)', short: 'OpenRouter', logo: 'R', color: '#6467F2', kind: 'openai', base: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…', models: [['openrouter/auto', 'Otomatik seçim']], use: 'Tek anahtarla yüzlerce model (Claude, GPT, Llama, Qwen…) — model adını yaz' },
  custom: { name: 'Özel (OpenAI uyumlu)', short: 'Özel', logo: '⚙', color: '#64748B', kind: 'openai', base: '', keyUrl: '', keyHint: 'anahtar (gerekmiyorsa boş)', models: [], custom: true, use: 'Kendi sunucun, Ollama, LM Studio, Together, Fireworks, Qwen… — adres + model yaz' },
  eleven: { name: 'ElevenLabs (ses)', short: 'ElevenLabs', logo: 'E', color: '#111827', kind: 'tts', keyUrl: 'https://elevenlabs.io/app/settings/api-keys', keyHint: 'sk_…', models: [['eleven_multilingual_v2', 'Multilingual v2 (dengeli, Türkçe)'], ['eleven_v3', 'Eleven v3 (en duygusal)'], ['eleven_flash_v2_5', 'Flash v2.5 (çok hızlı)'], ['eleven_turbo_v2_5', 'Turbo v2.5']], use: 'En doğal, duygulu Türkçe seslendirme' },
};
export const CHAT_PROVIDERS = Object.keys(PROVIDERS).filter((p) => PROVIDERS[p].kind !== 'tts');

export const getKey = (p) => lsGet(`alpicut.key.${p}`, p === 'anthropic' && lsGet('alpicut.aiProv', 'anthropic') === 'anthropic' ? lsGet('alpicut.aiKey', '') : p === 'openai' && lsGet('alpicut.aiProv', '') === 'openai' ? lsGet('alpicut.aiKey', '') : '');
export const setKey = (p, k) => lsSet(`alpicut.key.${p}`, (k || '').trim());
export const getModel = (p) => lsGet(`alpicut.model.${p}`, '') || PROVIDERS[p].models[0]?.[0] || '';
export const setModel = (p, m) => lsSet(`alpicut.model.${p}`, (m || '').trim());
export const getBase = (p) => (lsGet(`alpicut.base.${p}`, '') || PROVIDERS[p].base || '').replace(/\/+$/, '');
export const setBase = (p, u) => lsSet(`alpicut.base.${p}`, (u || '').trim());
// bağlı mı: anahtar var (özel sağlayıcıda adres + model yeterli)
export const hasKey = (p) => (p === 'custom' ? !!(getBase(p) && getModel(p)) : !!getKey(p));
// Sohbet/kurgu için tercih edilen sağlayıcı (bağlı olan)
export function chatProvider() {
  const pref = lsGet('alpicut.chatProv', '');
  if (pref && CHAT_PROVIDERS.includes(pref) && hasKey(pref)) return pref;
  return CHAT_PROVIDERS.find((p) => hasKey(p)) || null;
}
export const setChatProvider = (p) => lsSet('alpicut.chatProv', p);
export const connectedChat = () => CHAT_PROVIDERS.filter((p) => hasKey(p));

function native() { return !!window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.CapacitorHttp; }

// fetch; CORS/ağ hatasında Android'de yerel HTTP ile dene (yalnızca JSON)
async function jfetch(url, { method = 'POST', headers = {}, body } = {}) {
  let r;
  try {
    r = await fetch(url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    if (!native()) throw new Error('Bağlantı kurulamadı — internetini kontrol et');
    const res = await window.Capacitor.Plugins.CapacitorHttp.request({ url, method, headers: { 'content-type': 'application/json', ...headers }, data: body });
    const j = typeof res.data === 'string' ? JSON.parse(res.data || '{}') : res.data;
    if (res.status >= 400) throw new Error(errMsg(j, res.status));
    return j;
  }
  const txt = await r.text();
  let j = {};
  try { j = txt ? JSON.parse(txt) : {}; } catch (_) { j = { raw: txt }; }
  if (!r.ok) throw new Error(errMsg(j, r.status));
  return j;
}
function errMsg(j, status) {
  const m = j?.error?.message || j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : '') || j?.message || '';
  if (status === 401) return 'API anahtarı geçersiz (401). Anahtarı kontrol et.';
  if (status === 402 || /credit|quota|balance|billing/i.test(m)) return `Hesapta kredi/kota yok: ${m}`.trim();
  if (status === 429) return 'Çok fazla istek veya kota doldu (429). Biraz sonra tekrar dene.';
  return m || `Hata ${status}`;
}

// ---------- düz metin sorusu ----------
export async function ask(prompt, { system, maxTokens = 2000, provider = chatProvider() } = {}) {
  if (!provider) throw new Error('Önce Hesaplar bölümünden bir yapay zekâ (Claude, ChatGPT, DeepSeek, Gemini…) bağla');
  const r = await chatOnce(provider, { system, messages: [{ role: 'user', content: prompt }], maxTokens });
  return r.text;
}

async function chatOnce(provider, { system, messages, tools, maxTokens = 2000 }) {
  const key = getKey(provider), model = getModel(provider);
  const P = PROVIDERS[provider];
  if (!hasKey(provider)) throw new Error(`${P.name} bağlı değil`);
  if (!model) throw new Error(`${P.name}: model adı yaz`);
  if (P.kind === 'anthropic') {
    const body = { model, max_tokens: maxTokens, messages };
    if (system) body.system = system;
    if (tools?.length) body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    const j = await jfetch('https://api.anthropic.com/v1/messages', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body });
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const calls = (j.content || []).filter((c) => c.type === 'tool_use').map((c) => ({ id: c.id, name: c.name, args: c.input || {} }));
    return { text, calls, raw: { role: 'assistant', content: j.content }, stop: j.stop_reason };
  }
  const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
  const body = { model, messages: msgs };
  // DeepSeek Reasoner araç kullanamaz
  if (tools?.length && !(provider === 'deepseek' && /reasoner/.test(model))) body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  if (provider === 'openai' && /^(gpt-5|o\d)/.test(model)) body.max_completion_tokens = maxTokens; else body.max_tokens = maxTokens;
  const headers = key ? { authorization: `Bearer ${key}` } : {};
  if (provider === 'openrouter') { headers['HTTP-Referer'] = 'https://github.com/halildemirkazik14-del/Alpicut'; headers['X-Title'] = 'Alpicut'; }
  const j = await jfetch(`${getBase(provider)}/chat/completions`, { headers, body });
  const m = j.choices?.[0]?.message || {};
  const calls = (m.tool_calls || []).map((c) => { let a = {}; try { a = JSON.parse(c.function.arguments || '{}'); } catch (_) { /* yoksay */ } return { id: c.id, name: c.function.name, args: a }; });
  return { text: m.content || '', calls, raw: m };
}

// ---------- araç kullanan ajan döngüsü ----------
// history: sağlayıcıya özgü mesaj dizisi (yerinde güncellenir)
export async function agent({ provider = chatProvider(), system, history, tools, exec, onStep, maxSteps = 8 }) {
  if (!provider) throw new Error('Bağlı yapay zekâ hesabı yok');
  let finalText = '';
  for (let step = 0; step < maxSteps; step++) {
    const r = await chatOnce(provider, { system, messages: history, tools, maxTokens: 3000 });
    history.push(r.raw);
    if (r.text) { finalText = r.text; onStep?.({ type: 'text', text: r.text }); }
    if (!r.calls.length) break;
    const results = [];
    for (const c of r.calls) {
      onStep?.({ type: 'tool', name: c.name, args: c.args });
      let out;
      try { out = await exec(c.name, c.args); } catch (e) { out = { ok: false, error: e.message || String(e) }; }
      results.push({ c, out });
    }
    if (PROVIDERS[provider].kind === 'anthropic') history.push({ role: 'user', content: results.map(({ c, out }) => ({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out).slice(0, 12000) })) });
    else results.forEach(({ c, out }) => history.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(out).slice(0, 12000) }));
  }
  return finalText;
}

// ---------- OpenAI konuşma tanıma (kelime zamanlı) ----------
export async function transcribeOpenAI(wavBlob, language, provider = 'openai') {
  const key = getKey(provider);
  if (!key) throw new Error(`${PROVIDERS[provider].name} anahtarı yok`);
  const fd = new FormData();
  fd.append('file', wavBlob, 'audio.wav');
  fd.append('model', provider === 'groq' ? 'whisper-large-v3' : 'whisper-1');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'word');
  fd.append('timestamp_granularities[]', 'segment');
  const iso = { turkish: 'tr', english: 'en', german: 'de', spanish: 'es', french: 'fr', arabic: 'ar', portuguese: 'pt', italian: 'it', russian: 'ru' }[language];
  if (iso) fd.append('language', iso);
  let r;
  try { r = await fetch(`${getBase(provider)}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: fd }); }
  catch (_) { throw new Error(`${PROVIDERS[provider].short}'a bağlanılamadı — internetini kontrol et`); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errMsg(j, r.status));
  return j; // {text, words:[{word,start,end}], segments}
}

// ---------- metinden sese: OpenAI ----------
export const OPENAI_VOICES = [['coral', 'Coral (kadın, sıcak)'], ['nova', 'Nova (kadın, enerjik)'], ['shimmer', 'Shimmer (kadın, yumuşak)'], ['sage', 'Sage (kadın, sakin)'], ['ballad', 'Ballad (erkek, duygusal)'], ['ash', 'Ash (erkek, net)'], ['onyx', 'Onyx (erkek, kalın)'], ['echo', 'Echo (erkek)'], ['verse', 'Verse (erkek, dinamik)'], ['alloy', 'Alloy (nötr)'], ['fable', 'Fable (anlatıcı)']];
export async function ttsOpenAI(text, { voice = 'coral', instructions = '', speed = 1 } = {}) {
  const key = getKey('openai');
  if (!key) throw new Error('OpenAI anahtarı yok');
  const body = { model: 'gpt-4o-mini-tts', voice, input: text, response_format: 'mp3', speed };
  if (instructions) body.instructions = instructions;
  let r;
  try { r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
  catch (_) { throw new Error('OpenAI\'ye bağlanılamadı'); }
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(errMsg(j, r.status)); }
  return new Blob([await r.arrayBuffer()], { type: 'audio/mpeg' });
}

// ---------- metinden sese: ElevenLabs ----------
export async function elevenVoices() {
  const key = getKey('eleven');
  if (!key) throw new Error('ElevenLabs anahtarı yok');
  const j = await jfetch('https://api.elevenlabs.io/v1/voices', { method: 'GET', headers: { 'xi-api-key': key } });
  return (j.voices || []).map((v) => ({ id: v.voice_id, name: v.name, cat: v.category, labels: v.labels || {}, preview: v.preview_url }));
}
export async function ttsEleven(text, { voiceId, model = getModel('eleven'), stability = 0.5, similarity = 0.75, style = 0.3, speed = 1, boost = true } = {}) {
  const key = getKey('eleven');
  if (!key) throw new Error('ElevenLabs anahtarı yok');
  if (!voiceId) throw new Error('Önce bir ses seç');
  let r;
  try {
    r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability, similarity_boost: similarity, style, use_speaker_boost: boost, speed } }),
    });
  } catch (_) { throw new Error('ElevenLabs\'e bağlanılamadı'); }
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(errMsg(j, r.status)); }
  return new Blob([await r.arrayBuffer()], { type: 'audio/mpeg' });
}

// bağlantı testi
export async function testKey(p) {
  if (p === 'eleven') { const v = await elevenVoices(); return `${v.length} ses bulundu`; }
  const t = await ask('Sadece "Tamam" yaz.', { provider: p, maxTokens: 30 });
  return `Yanıt: ${t.slice(0, 40)}`;
}

export function openExternal(url) {
  // Android'de uygulama dışı bağlantılar telefonun tarayıcısında açılır
  if (window.Capacitor?.isNativePlatform?.()) { location.href = url; return; }
  try { window.open(url, '_blank'); } catch (_) { location.href = url; }
}
