// Alpicut — Whisper konuşma tanıma işçisi (transformers.js, cihaz üzerinde)
let pipe = null, pipeKey = '';

async function lib() {
  const m = await import('../vendor/transformers/transformers.js');
  const env = m.env;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  try { env.backends.onnx.wasm.numThreads = 1; } catch (_) { /* yoksay */ }
  return m;
}

const MODELS = {
  tiny: ['onnx-community/whisper-tiny_timestamped', 'onnx-community/whisper-tiny', 'Xenova/whisper-tiny'],
  base: ['onnx-community/whisper-base_timestamped', 'onnx-community/whisper-base', 'Xenova/whisper-base'],
  small: ['onnx-community/whisper-small_timestamped', 'onnx-community/whisper-small', 'Xenova/whisper-small'],
};

async function getPipe(size, post) {
  const key = size;
  if (pipe && pipeKey === key) return pipe;
  const { pipeline } = await lib();
  let lastErr = null;
  for (const id of MODELS[size] || MODELS.base) {
    try {
      post({ type: 'status', text: `Model hazırlanıyor: ${id}` });
      pipe = await pipeline('automatic-speech-recognition', id, {
        dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
        device: 'wasm',
        progress_callback: (p) => { if (p.status === 'progress' && p.total) post({ type: 'download', file: p.file, loaded: p.loaded, total: p.total }); },
      });
      pipeKey = key;
      post({ type: 'status', text: `Model: ${id}` });
      return pipe;
    } catch (e) { lastErr = e; post({ type: 'status', text: `${id} olmadı: ${e.message || e}` }); }
  }
  throw lastErr || new Error('Model yüklenemedi');
}

self.onmessage = async (ev) => {
  const { cmd, audio, size, language, wordLevel, opts: xo = {} } = ev.data;
  const post = (m) => self.postMessage(m);
  if (cmd !== 'run') return;
  try {
    const p = await getPipe(size || 'base', post);
    post({ type: 'status', text: 'Konuşma metne çevriliyor…' });
    const long = audio.length > 16000 * 29;
    const opts = { task: 'transcribe', return_timestamps: wordLevel ? 'word' : true };
    if ((long && !xo.nochunk) || xo.chunk) { opts.chunk_length_s = 30; opts.stride_length_s = 5; }
    if (language && language !== 'auto') opts.language = language;
    let out;
    try { out = await p(audio, opts); }
    catch (e) {
      if (!wordLevel) throw e;
      post({ type: 'status', text: 'Kelime zamanlaması desteklenmedi, cümle zamanlamasıyla deneniyor…' });
      out = await p(audio, { ...opts, return_timestamps: true });
      out.__segment = true;
    }
    post({ type: 'done', text: out.text, chunks: out.chunks || [], segment: !!out.__segment || !wordLevel });
  } catch (e) {
    post({ type: 'error', message: e.message || String(e) });
  }
};
