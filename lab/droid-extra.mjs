// v1.4 emülatör senaryosu (droid.mjs tarafından çağrılır). Dosya seçici açan araçlara dokunulmaz.
export async function run({ ev, step, tapEl, tapXY, shot, sleep, R }) {
  await step('newProject', async () => { await tapEl('#newProject'); await sleep(900); return ev(() => ({ editor: !document.getElementById('editor').classList.contains('hidden') })); });
  await step('import', () => ev(async () => {
    const app = window.__alpicut;
    const get = async (u, n) => new File([await (await fetch(u)).blob()], n, { type: 'video/mp4' });
    const recs = await app.importFiles([await get('labmedia/test.mp4', 'test.mp4'), await get('labmedia/wide.mp4', 'wide.mp4')]);
    recs.forEach((m, i) => app.P.clips.push({ id: `c${i}`, mediaId: m.id, type: 'video', in: 0, out: m.duration, dur: 3, speed: 1, volume: 1, mute: false, fit: 'cover', bgMode: 'blur', bgColor: '#000', zoom: 1, panX: 0, panY: 0, filters: {}, filterPreset: 'none', trans: { type: 'none', dur: 0.5 }, kf: {} }));
    app.commit();
    return { n: recs.length, total: app.engine.duration() };
  }));
  await sleep(800); shot('10-editor');
  const health = () => ev(async () => {
    const app = window.__alpicut; const E = app.engine;
    const br = () => { const c = document.createElement('canvas'); c.width = 16; c.height = 16; const x = c.getContext('2d'); x.drawImage(E.canvas, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return +(s / 768).toFixed(1); };
    E.seek(1); await new Promise((r) => setTimeout(r, 800)); E.draw();
    const before = br();
    const t0 = E.t; app.play(); await new Promise((r) => setTimeout(r, 2000)); const t1 = E.t; app.pause();
    await new Promise((r) => setTimeout(r, 400));
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const x = c.getContext('2d');
    x.drawImage(E.canvas, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    let mid = -1; return { before, advanced: +(t1 - t0).toFixed(2), brightness: +(s / 768).toFixed(1), hidden: document.hidden, readyStates: [...E.els.values()].map((e) => e.readyState), mid };
  });
  await step('playback', health);
  shot('10b-after-play');
  await step('timelineEnd', () => ev(async () => { const app = window.__alpicut; const sc = document.getElementById('tlScroll'); sc.scrollLeft = 1e7; await new Promise((r) => setTimeout(r, 400)); const o = { dur: app.engine.duration(), t: app.engine.t, over: sc.scrollWidth - sc.clientWidth - Math.round(app.engine.duration() * app.pps) }; sc.scrollLeft = 0; return o; }));

  await step('export', () => ev(async () => {
    const app = window.__alpicut; document.querySelectorAll('.panel .p-btn.close').forEach((x) => x.click());
    
    const t0 = performance.now(); const r = await app.engine.export({ res: 0.5, fps: 30, bitrate: 4e6 });
    const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(r.blob); await new Promise((q) => { v.onloadeddata = q; v.onerror = q; setTimeout(q, 8000); });
    v.currentTime = 1; await new Promise((q) => { v.onseeked = q; setTimeout(q, 4000); });
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const x = c.getContext('2d'); let br = -1; try { x.drawImage(v, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; br = +(s / 768).toFixed(1); } catch (e) { br = String(e.message); }
    return { size: r?.blob.size, ext: r?.ext, ms: Math.round(performance.now() - t0), dur: app.engine.duration(), videoDur: v.duration, brightness: br };
  }, null, 600000));

  await step('captions', () => ev(async () => {
    const ai = await import('./js/ai.js'); const t0 = performance.now(); const st = [];
    const n = await ai.autoCaptions({ lang: 'turkish', size: 'base', provider: 'local', onStatus: (t) => st.push(t) });
    return { n, ms: Math.round(performance.now() - t0), cues: window.__alpicut.P.subs.cues.slice(0, 6).map((c) => `${c.start.toFixed(1)} ${c.text}`), st: st.slice(-4), mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
  }, null, 900000));
  await sleep(500); shot('11-captions');
  await step('playbackAfterCaptions', health);

  await step('jumpcut', () => ev(async () => { const a = await import('./js/alpico.js'); const b = window.__alpicut.engine.duration(); const r = await a.runCommand('jumpcut', {}, { quiet: true }); return { r: r?.summary || r?.error, before: b, after: window.__alpicut.engine.duration() }; }, null, 300000));

  await step('bgRemoval', () => ev(async () => {
    const app = window.__alpicut; const c = app.P.clips[0];
    c.bgr = { on: true, threshold: 0.5, edge: 0.15, feather: 2, mode: 'color', color: '#00FF00', blur: 30 };
    const S = await import('./js/seg.js'); const t0 = performance.now(); await S.initSegmenter(); app.engine.seg = S;
    app.engine.seek(1); await new Promise((r) => setTimeout(r, 600)); app.engine.draw(); app.commit();
    return { init: Math.round(performance.now() - t0) };
  }, null, 300000));
  await sleep(600); shot('12-bgremoval');

  await step('studio', () => ev(async () => {
    const S = await import('./js/studio.js');
    const blob = await (await fetch('labmedia/noisy.wav')).blob();
    const meas = async (b) => { const ac = new OfflineAudioContext(1, 48000, 48000); const a = await ac.decodeAudioData(await b.arrayBuffer()); const x = a.getChannelData(0); const rms = (s, e) => { let q = 0; const i0 = Math.floor(s * 48000), i1 = Math.min(x.length, Math.floor(e * 48000)); for (let i = i0; i < i1; i++) q += x[i] * x[i]; return +(10 * Math.log10(q / Math.max(1, i1 - i0) + 1e-12)).toFixed(1); }; return { speech: rms(3, 6), silenceStart: rms(0.2, 1.6), silenceEnd: rms(a.duration - 1.6, a.duration - 0.2) }; };
    const out = { before: await meas(blob) };
    for (const k of ['podcast', 'hiss']) { const t0 = performance.now(); try { out[k] = { ...(await meas(await S.processVoice(blob, S.STUDIO_PRESETS[k]))), ms: Math.round(performance.now() - t0) }; } catch (e) { out[k] = String(e.message || e); } }
    return out;
  }, null, 600000));

  await step('tts', () => ev(async () => {
    const t0 = performance.now(); const T = await import('./vendor/piper/piper-tts-web.js');
    const w = await T.predict({ text: 'Merhaba, bu bir deneme.', voiceId: 'tr_TR-dfki-medium' });
    return { size: w.size, ms: Math.round(performance.now() - t0) };
  }, null, 600000));

  await step('effectsRender', () => ev(async () => {
    const app = window.__alpicut; const F = await import('./js/fxlib.js'); const bad = []; let ms = 0;
    for (const [id] of F.FX_LIST) { app.P.layers = app.P.layers.filter((l) => l.kind !== 'fx'); app.P.layers.push({ id: 'fx1', kind: 'fx', effect: id, start: 0, end: 3, amount: 1, speed: 1, anim: { in: 'none', out: 'none', loop: 'none', inDur: 0.3, outDur: 0.3 }, x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, kf: {} }); app.engine.setProject(app.P); const t0 = performance.now(); try { app.engine.draw(1); } catch (e) { bad.push(`${id}:${e.message}`); } ms = Math.max(ms, performance.now() - t0); }
    app.P.layers = app.P.layers.filter((l) => l.kind !== 'fx'); app.commit();
    return { n: F.FX_LIST.length, bad, worstMs: Math.round(ms) };
  }, null, 300000));

  await step('transitionsRender', () => ev(async () => {
    const G = await import('./js/gltrans.js'); const T = G.transGL(); const a = document.createElement('canvas'); a.width = 72; a.height = 128; a.getContext('2d').fillStyle = '#f00'; a.getContext('2d').fillRect(0, 0, 72, 128); const b = document.createElement('canvas'); b.width = 72; b.height = 128; b.getContext('2d').fillStyle = '#00f'; b.getContext('2d').fillRect(0, 0, 72, 128);
    const bad = []; for (const t of G.GL_LIST) { try { const o = T.render(t.raw, a, b, 0.5, 72, 128); if (!o) bad.push(t.raw); } catch (e) { bad.push(`${t.raw}:${e.message}`); } }
    return { ok: !!T, n: G.GL_LIST.length, bad: bad.slice(0, 20), nbad: bad.length };
  }, null, 300000));

  // arayüz: paneller, kategoriler (dosya seçici açanlar hariç)
  await step('ui', async () => {
    const res = {};
    const cats = { ai: ['Otomatik kurgu', 'Otomatik altyazı', 'Arka plan sil', 'Seslendirme', 'Proje kontrolü', 'Hesaplar'], text: ['Şablonlar', 'Altyazı'], audio: ['Müzik', 'Ses efekti', 'Kayıt stüdyosu', 'Mikser'], fx: ['Efektler', 'Filtreler', 'Geçişler'], social: ['Sosyal şablon', 'Sohbet'], edit: ['Tema'] };
    let k = 0;
    for (const [cat, tools] of Object.entries(cats)) {
      for (const t of tools) {
        await ev(([c, n]) => { const a = window.__alpicut; a.deselect(); a.tbCat = c; a.renderToolbar(); [...document.querySelectorAll('#toolbar .tool')].find((x) => x.textContent.trim() === n)?.click(); }, [cat, t]);
        await sleep(1500);
        res[`${cat}/${t}`] = await ev(() => [...document.querySelectorAll('.panel:not(.min) .p-title')].map((x) => x.textContent));
        shot(`20-ui-${String(++k).padStart(2, '0')}`);
        await ev(() => document.querySelectorAll('.panel .p-btn.close').forEach((x) => x.click()));
        await sleep(400);
      }
    }
    return res;
  });
  await step('threePanels', async () => {
    const res = {};
    await ev(async () => { const a = await import('./js/alpico.js'); a.openAlpico(); }); await sleep(1500); shot('30-p1');
    await ev(async () => { const s = await import('./js/sheets.js'); s.openSocial(); }); await sleep(1500); shot('31-p2');
    await ev(() => window.__alpicut.select({ type: 'clip', id: window.__alpicut.P.clips[0].id }, 'Keyframe')); await sleep(1500); shot('32-p3');
    const box = await ev(() => { const r = document.getElementById('previewWrap').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20 }; });
    await tapXY(box.x, box.y);
    res.afterPreviewTap = await ev(() => document.querySelectorAll('.panel').length);
    return res;
  });

  await step('mic', () => ev(async () => {
    const Rm = await import('./js/recorder.js');
    try { const r = await Promise.race([Rm.startRecorder({ mode: 'natural' }), new Promise((_, j) => setTimeout(() => j(new Error('zaman aşımı')), 15000))]); r.begin(); await new Promise((q) => setTimeout(q, 1500)); r.mark(); await new Promise((q) => setTimeout(q, 1500)); const t = r.stop(); return { noise: t.noise.length, voice: t.voice.length, sr: t.sr }; } catch (e) { return { err: `${e.name}: ${e.message}` }; }
  }, null, 60000));
  void R;
}
