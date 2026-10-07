// Alpicut — ana uygulama
import { journal, flushJournal, journalSaved, recoveryFor, setSaveHook } from './guard.js';
import { app, $, h, uid, clone, fmt, toast, busy, selected } from './state.js';
import { I, LOGO } from './icons.js';
import { Engine, layoutClips, curvePts } from './engine.js';
import { RATIOS, DEFAULT_FILTERS, SUB_BASE, FX_BASE, TEXT_BASE, anim } from './presets.js';
import { renderTimeline, bindTimeline, syncScroll, setZoom, markSelection } from './timeline.js';
import { layerAt, hasKeys, setKey, writeProp, splitKeys } from './kf.js';
import { renderSfx } from './sfx.js';
import { lutStore } from './gl.js';
import { openAIHub, smartReframe, prepareProjectAI, openAutoCaptions, openTranscript, openTTS, openAutoEdit, openAccounts } from './ai.js';
import { openAlpico, runCommand, openDoctor } from './alpico.js';
import { openFavorites } from './favs.js';
import { openMic } from './recorder.js';
import { openFilters } from './filters.js';
import { openTransitions } from './transitions.js';
const openFilterLayer = () => openFilters(null);
import { themePickerBody } from './theme.js';
import * as WM from './wm.js';
import { openSfxLibrary, openMusicLibrary } from './library.js';
import { processVoice, STUDIO_PRESETS } from './studio.js';
import { ensureProjectFonts, getCatalog } from './fonts.js';
import { PROJECT_TEMPLATES } from './templates.js';
import {
  openMixer, openEffects, openStickers, addAdjustLayer, openBrand, openCover, openSilence, findBeats, normalizeItem,
  openVersions, exportPackage, importPackage, openRelink,
} from './ui3.js';
import {
  openSheet, closeSheet, closeAllSheets, refreshSheet, refreshLive, isSheetOpen, openInspector, openTemplates, openCTAs,
  openScoreMenu, openSubsMenu, openFx, openRatio, openExport, openShapes, openSfx, openSocial, openMotion, openSocialHub,
} from './sheets.js';
import { store, lsGet, lsSet, isNative } from './storage.js';
import { parseSRT } from './srt.js';
import { queueProxy, onProxyChange } from './proxy.js';
import { queueScrub } from './scrubcache.js';
import { enterFull, exitFull, isFull } from './fullscreen.js';
import { addToAssets, inAssets, openAssets } from './assets.js';
import { openPop, closePop, isPopOpen } from './popover.js';
import { openCaptionStyles } from './captions.js';
import { renderKfBar, updateKfBar } from './kfbar.js';
import { clipAt, CLIP_PROPS } from './kf.js';

// ---------- başlat ----------
function init() {
  setSaveHook(() => { flushJournal(); if (app.P) saveNow(); });
  $('brandLogo').innerHTML = LOGO;
  $('btnTheme').innerHTML = I.palette;
  $('btnTheme').addEventListener('click', () => openThemePicker());
  $('btnAccounts').innerHTML = I.key;
  $('btnAccounts').addEventListener('click', () => openAccounts());
  document.querySelector('.np-plus').innerHTML = I.plus;
  $('btnBack').innerHTML = I.back;
  $('btnUndo').innerHTML = I.undo;
  $('btnRedo').innerHTML = I.redo;
  $('btnZoomIn').innerHTML = I.zoomIn;
  $('btnFull').innerHTML = I.expand;
  $('btnFull').addEventListener('click', () => enterFull());
  $('btnFirst').innerHTML = I.first;
  $('btnPrevF').innerHTML = I.prevF;
  $('btnNextF').innerHTML = I.nextF;
  const step = (d) => { app.pause(); app.engine.seek(Math.round((app.engine.t + d) * 30) / 30); updateTime(); syncScroll(app.engine.t, true); };
  $('btnFirst').addEventListener('click', () => step(-1e9));
  $('btnPrevF').addEventListener('click', () => step(-1 / 30));
  $('btnNextF').addEventListener('click', () => step(1 / 30));
  $('btnZoomOut').innerHTML = I.zoomOut;

  app.newRatio = lsGet('alpicut.ratio', '9:16');
  renderRatioPick();

  app.engine = new Engine($('preview'));
  app.engine.onTime = (t) => {
    updateTime();
    syncScroll(t);
    if (app.stopAt != null && t >= app.stopAt) app.pause();
  };
  app.engine.onEnd = () => updateTime();

  buildToolbar();
  bindTimeline();
  bindPreview();

  $('newProject').addEventListener('click', () => newProject());
  $('fromTemplate').innerHTML = `${I.template} Şablondan başla`;
  $('fromTemplate').addEventListener('click', openProjectTemplates);
  $('btnAssets').innerHTML = I.folder; $('btnAssets').addEventListener('click', () => openAssets());
  $('vibeBtn').addEventListener('click', async () => { const v = await import('./vibe.js'); v.openVibe(); });
  $('importPkg').innerHTML = `${I.upload} Yedekten aç (.alpicut)`;
  $('importPkg').addEventListener('click', async () => {
    const files = await pickFiles('', false);
    if (!files.length) return;
    const b = busy('Yedek açılıyor…');
    try { const rec = await importPackage(files[0]); toast(`“${rec.name}” içe aktarıldı`); renderHome(); }
    catch (e) { toast(e.message || 'Açılamadı', 3500); } finally { b.close(); }
  });
  $('btnBack').addEventListener('click', () => { closeAllSheets(); goHome(); });
  $('btnPlay').addEventListener('click', () => (app.engine.playing ? app.pause() : app.play()));
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnZoomIn').addEventListener('click', () => setZoom(app.pps * 1.5));
  $('btnZoomOut').addEventListener('click', () => setZoom(app.pps / 1.5));
  $('btnExport').addEventListener('click', () => { closeAllSheets(); openExport(); });
  $('projName').addEventListener('change', () => { app.P.name = $('projName').value.trim() || 'Adsız proje'; commit(); });

  window.addEventListener('popstate', () => {
    if (window.__skipPop > 0) { window.__skipPop--; return; }
    if (isFull()) { exitFull(true); return; }
    if (isPopOpen()) { closePop(); try { history.pushState(history.state || { v: 'editor' }, ''); } catch (_) { /* yoksay */ } return; }
    if (isSheetOpen()) { closeSheet(true); if (isSheetOpen()) { try { history.pushState({ v: 'sheet' }, ''); } catch (_) { /* yoksay */ } } return; }
    if (!$('exportModal').classList.contains('hidden')) { try { history.pushState({ v: 'editor' }, ''); } catch (_) { /* yoksay */ } return; }
    if (!$('editor').classList.contains('hidden')) goHome(true);
  });
  window.addEventListener('resize', () => { if (app.P) { fitStage(); renderTimeline(); } });
  // v1.7: Android geri hareketi — ana ekranda yanlışlıkla çıkılmasın, önce sorulsun
  const CapApp = window.Capacitor?.Plugins?.App;
  if (CapApp && isNative()) {
    try {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (document.querySelector('.exit-confirm')) { closeExitConfirm(); return; }
        if (isFull()) { exitFull(); return; }
        const onHome = !$('home').classList.contains('hidden');
        if (onHome && !isSheetOpen() && !isPopOpen()) { showExitConfirm(() => CapApp.exitApp()); return; }
        if (canGoBack) history.back();
        else if (isPopOpen()) closePop();
        else if (isSheetOpen()) closeSheet(true);
        else if (!onHome) goHome(true);
        else showExitConfirm(() => CapApp.exitApp());
      });
    } catch (e) { console.warn('geri tuşu dinlenemedi', e); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.P) { app.pause(); saveNow(); } });
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => app.engine.requestDraw());
  loadFonts();
  getCatalog();
  onProxyChange((m, p) => { if (p >= 1 && m.purl) { toast(`Hafif önizleme hazır: ${m.name || 'video'}`); app.engine.requestDraw(); } });
  renderHome();
}

async function loadFonts() {
  if (!document.fonts) return;
  if (!isNative()) {
    // tarayıcıda denerken Google Fonts yedeği
    document.head.append(h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;0,900;1,800;1,900&family=Barlow+Semi+Condensed:ital,wght@0,500;0,600;0,700;1,600&display=swap' }));
  }
  const specs = [
    '400 20px "Bricolage Grotesque"', '500 20px "Bricolage Grotesque"', '600 20px "Bricolage Grotesque"', '700 20px "Bricolage Grotesque"', '800 20px "Bricolage Grotesque"',
    '400 20px "Source Serif 4"', 'italic 400 20px "Source Serif 4"', '600 20px "Source Serif 4"',
    '400 20px "Barlow"', '600 20px "Barlow"', '700 20px "Barlow"',
    '500 20px "Barlow Semi Condensed"', '600 20px "Barlow Semi Condensed"', '700 20px "Barlow Semi Condensed"', 'italic 600 20px "Barlow Semi Condensed"',
    '600 20px "Barlow Condensed"', '700 20px "Barlow Condensed"', '800 20px "Barlow Condensed"', '900 20px "Barlow Condensed"',
    'italic 800 20px "Barlow Condensed"', 'italic 900 20px "Barlow Condensed"',
  ];
  try { await Promise.all(specs.map((s) => document.fonts.load(s, 'AĞŞİığşçöü'))); } catch (_) { /* yoksay */ }
  app.engine.requestDraw();
}

// ---------- araç çubuğu ----------
// Seçime göre değişen araç çubuğu
function buildToolbar() { renderToolbar(); }

const KIND_NAME = { wave: 'Ses dalgası', group: 'Grup', social: 'Sosyal', text: 'Yazı', media: 'Katman', cta: 'Çağrı', score: 'Skor kartı', shape: 'Şekil', sticker: 'Çıkartma', fx: 'Efekt', adjust: 'Ayar katmanı' };

function selLabel() {
  const s = app.sel, o = selected();
  if (!s || !o) return '';
  if (s.type === 'clip') return `${o.freeze ? 'Donmuş kare' : o.type === 'image' ? 'Fotoğraf' : 'Video'} · ${app.engine.media.get(o.mediaId)?.name || ''}`;
  if (s.type === 'audio') return `${o.sfx ? 'SFX' : o.role === 'voice' ? 'Seslendirme' : 'Ses'} · ${app.engine.media.get(o.mediaId)?.name || ''}`;
  if (s.type === 'subs') return `Altyazı · ${o.cues.length} satır`;
  const nm = o.kind === 'text' ? (o.text || '').split('\n')[0].replace(/\*/g, '') : o.kind === 'media' ? app.engine.media.get(o.mediaId)?.name : o.kind === 'fx' ? o.effect : o.label || '';
  return `${KIND_NAME[o.kind] || 'Katman'} · ${nm || ''}`;
}

// [ikon, ad, işlev, sınıf, açıklama] — kategoriye dokununca açıklamalı açılır menüde gösterilir
const TOOL_CATS = [
  { id: 'alpico', name: 'Alpi-co', icon: 'bot', cls: 'ai', direct: () => openAlpico() },
  { id: 'ai', name: 'Yapay zekâ', icon: 'ai', desc: 'Otomatik kurgu, altyazı, arka plan silme', tools: () => [
    ['wand', 'Otomatik kurgu', () => openAutoEdit(), 'ai', 'Claude / ChatGPT / DeepSeek tüm kurguyu yapar'], ['subtitle', 'Otomatik altyazı', () => openAutoCaptions(), '', 'Konuşmayı kelime kelime yazıya döker'], ['scissors', 'Jumpcut', () => runCommand('jumpcut', {}), '', 'Konuşmadaki boşlukları keser'],
    ['adjust', 'Arka plan sil', () => aiTarget('Arka plan'), '', 'Yeşil perde olmadan kişiyi ayır'], ['color', 'Chroma key', () => aiTarget('Chroma'), '', 'Yeşil/mavi perdeyi sil'], ['mic', 'Seslendirme', () => openTTS(), '', 'Metni doğal sesle okut'],
    ['edit', 'Metinden kurgu', () => openTranscript(), '', 'Kelimeleri silerek videoyu kes'], ['ratio', 'Akıllı kadraj', () => aiReframe(), '', 'Yatay videoda yüzü takip et'], ['doctor', 'Proje kontrolü', () => openDoctor(), '', 'Hataları bul, tek dokunuşla düzelt'], ['key', 'Hesaplar', () => openAccounts(), '', 'Claude, ChatGPT, DeepSeek, Gemini…'],
  ] },
  { id: 'motion', name: 'Motion', icon: 'anim', desc: 'Yüzlerce canlı şablon — hepsi düzenlenebilir', tools: () => [
    ['clock', 'Geri sayım', () => openMotion('Geri sayım'), '', 'Yapay zekâ, sci-fi, film, neon, tarihi'],
    ['film', 'Nostalji', () => openMotion('Nostalji'), '', "VHS, 70'ler, 80'ler, kaset, polaroid"], ['heart', 'Düğün & nişan', () => openMotion('Düğün & nişan'), '', 'İsimler, davetiye, monogram, kına'],
    ['ai', 'Yapay zekâ', () => openMotion('Yapay zekâ'), 'ai', 'Sohbet ekranı, komut, düşünme, görsel üretimi'], ['edit', 'Kod & geliştirici', () => openMotion('Kod & geliştirici'), '', 'Kod yazımı, terminal, diff, repo kartı'],
    ['bubble', 'Pop-up', () => openMotion('Pop-up'), '', 'Pencere, bildirim, başarı/hata'], ['anim', 'Motion 2D', () => openMotion('Motion 2D'), '', 'Kinetik yazı, grafik, sayaç, alt bant'],
    ['layer', 'Motion 3D', () => openMotion('Motion 3D'), '', 'Karusel, küp, kart çevirme, tünel'], ['sticker', 'Kağıt & stop-motion', () => openMotion('Kağıt & stop-motion'), '', 'Kesik kağıt, yırtık bant, damga'],
    ['fx', 'Sci-fi & HUD', () => openMotion('Sci-fi & HUD'), '', 'Hedef kilidi: yeşil başarı, kırmızı hata'], ['text', 'Başlık & yazı', () => openMotion('Başlık & yazı'), '', 'Glitch, daktilo, kelime yığını'],
    ['cta', 'Satış & ürün', () => openMotion('Satış & ürün'), '', 'Fiyat etiketi, geri sayım'], ['check', 'Bilgi & liste', () => openMotion('Bilgi & liste'), '', 'Liste, grafik, ilerleme'],
    ['marker', 'Etkinlik & mekan', () => openMotion('Etkinlik & mekan'), '', 'Harita, tarih, tabela'], ['bubble', 'Abone & etkileşim', () => openMotion('Abone & etkileşim'), '', 'Zil, bildirim, hedef'],
    ['layer', 'Alt bant', () => openMotion('Alt bant'), '', 'İsim / unvan bantları'], ['star', 'Favori motion', () => openMotion('★'), '', 'Yıldızladıkların'],
  ] },
  { id: 'text', name: 'Metin', icon: 'text', desc: 'Yazı, şablon, altyazı', tools: () => [
    ['text', 'Yazı ekle', () => addLayer(clone(TEXT_BASE)), '', 'Boş yazı katmanı'], ['template', 'Yazı şablonları', () => openTemplates(), '', 'Yüzlerce hazır başlık ve etiket'], ['subtitle', 'Altyazı', openSubsMenu, '', 'Otomatik, SRT veya elle'],
    ['brand', 'Altyazı şablonları', () => openCaptionStyles(), '', 'Hazır altyazı görünümleri'],
  ] },
  { id: 'audio', name: 'Ses', icon: 'audio', desc: 'Müzik, efekt, kayıt', tools: () => [
    ['mic', 'Ses stüdyosu', () => { const o = selected(); if (o && o.mediaId) studioClean(o); else { const c = app.P.clips.find((x) => x.type === 'video') || app.P.audio[0]; if (c) studioClean(c); else toast('Önce video ya da ses ekle'); } }, 'ai', 'Gürültü giderme, konuşma/müzik ayırma'], ['audio', 'Müzik', openMusicLibrary, '', 'Telifsiz müzik kütüphanesi'], ['sfx', 'Ses efekti', openSfxLibrary, '', 'Whoosh, riser, gerilim, glitch…'], ['mic', 'Kayıt stüdyosu', openMic, '', 'Mikrofonla seslendirme kaydet'], ['bot', 'Seslendirme', () => openTTS(), '', 'Metinden sese'],
    ['upload', 'Ses dosyası', () => addMedia('audio'), '', 'Telefondan ses/müzik ekle'], ['mixer', 'Mikser', openMixer, '', 'Seviyeler, ducking, limiter'], ['beat', 'Ses dalgası', addWave, '', 'Müziğe tepki veren çubuklar'],
  ] },
  { id: 'fx', name: 'Efekt', icon: 'fx', desc: 'Efekt, filtre, geçiş, çıkartma', tools: () => [
    ['fx', 'Efektler', () => openEffects(), '', 'Sarsıntı, glitch, zoom, ışık sızıntısı'], ['filter', 'Filtreler', () => openFilterLayer(), '', 'Sinematik renk görünümleri'], ['trans', 'Geçişler', () => openTransitions(), '', '120+ sinematik geçiş'], ['adjust', 'Renk katmanı', addAdjustLayer, '', 'Bir aralığa renk ayarı'],
    ['anim', 'Genel ayar', openFx, '', 'Vinyet, gren, sinema şeridi'], ['sticker', 'Çıkartma', () => openStickers(), '', 'Rozet, emoji, etiket'], ['shape', 'Şekil', openShapes, '', 'Ok, çember, çerçeve'],
  ] },
  { id: 'social', name: 'Sosyal', icon: 'bubble', direct: () => openSocialHub() },
  { id: 'edit', name: 'Düzen', icon: 'edit', desc: 'Katman, oran, kapak', tools: () => [
    ['layer', 'Katman ekle', () => addMedia('layer'), '', 'Video/foto üst katman (B-roll)'], ['ratio', 'Oran', openRatio, '', '9:16, 1:1, 16:9…'], ['marker', 'İşaret', toggleMarker, '', 'Oynatıcıya işaret koy'], ['check', 'Çoklu seç', startMulti, '', 'Katmanları grupla/sil'],
    ['cover', 'Kapak', openCover, '', 'Thumbnail tasarla'], ['brand', 'Marka kiti', openBrand, '', 'Renk, yazı tipi, logo'], ['palette', 'Tema', () => openThemePicker(), '', 'Arayüz renkleri'],
  ] },
  { id: 'assets', name: 'Assets', icon: 'folder', direct: () => openAssets() },
  { id: 'fav', name: 'Favoriler', icon: 'star', direct: () => openFavorites() },
];

// v1.5: kategori menüsü — açıklamalı kartlarla açılır pencere
function openCategory(c, btn) {
  const r = (btn || $('toolbar')).getBoundingClientRect();
  openPop({
    key: `cat:${c.id}`, anchor: { x: r.left + r.width / 2, y: $('toolbar').getBoundingClientRect().top }, place: 'above', variant: 'cards', cols: 2, wide: true,
    title: c.name, sub: c.desc, icon: c.icon,
    items: c.tools().map(([ic, label, fn, cls, desc]) => ({ icon: ic, label, desc, cls, fn: () => { app.pause(); fn(); } })),
  });
}

// v1.5: öğeye dokununca önce hızlı işlem menüsü (denetçi otomatik açılmaz — hiçbir şey kapanmaz)
function itemMenu(anchor, place = 'above') {
  const s = app.sel, o = selected();
  if (!s || !o) return;
  const insp = (tab) => () => openInspector(tab);
  let items = [];
  if (o.locked) items = [{ icon: 'unlock', label: 'Kilidi aç', fn: () => { o.locked = false; commit(); renderToolbar(); } }];
  else if (s.type === 'clip') {
    const isV = o.type === 'video' && !o.freeze;
    items = [
      { icon: 'edit', label: 'Düzenle', fn: insp('Düzen') }, { icon: 'split', label: 'Böl', fn: () => splitSel() },
      isV && { icon: 'curve', label: 'Hız', fn: insp('Düzen') }, isV && { icon: 'sfx', label: 'Ses', fn: insp('Ses') },
      { icon: 'diamond', label: 'Keyframe', fn: insp('Keyframe') }, { icon: 'trans', label: 'Geçiş', fn: insp('Geçiş') },
      { icon: 'color', label: 'Renk', fn: insp('Renk') }, { icon: 'filter', label: 'Filtre', fn: () => openFilters(o) },
      { icon: 'fx', label: 'Efekt', fn: () => openEffects() }, { icon: 'shape', label: 'Maske', fn: insp('Maske') },
      { icon: 'adjust', label: 'Arka plan', fn: insp('Arka plan') }, isV && { icon: 'freeze', label: 'Dondur', fn: freezeFrame },
      isV && { icon: 'reverse', label: 'Ters', fn: () => reverseClip(o) }, { icon: 'copy', label: 'Kopyala', fn: dupSel },
      { icon: 'trash', label: 'Sil', cls: 'danger', fn: delSel },
    ];
  } else if (s.type === 'layer') {
    const tabs = LAYER_TABS[o.kind] || [];
    items = tabs.map((t) => ({ icon: TAB_ICON[t] || 'edit', label: t, fn: insp(t) }));
    items.push({ icon: 'split', label: 'Böl', fn: () => splitSel() }, { icon: 'up', label: 'Öne', fn: () => layerOrder(1) }, { icon: 'down', label: 'Arkaya', fn: () => layerOrder(-1) },
      { icon: o.hidden ? 'eyeOff' : 'eye', label: o.hidden ? 'Göster' : 'Gizle', fn: () => { o.hidden = !o.hidden; commit(); renderToolbar(); } },
      { icon: 'lock', label: 'Kilitle', fn: () => { o.locked = true; commit(); renderToolbar(); } },
      { icon: 'copy', label: 'Kopyala', fn: dupSel }, { icon: 'trash', label: 'Sil', cls: 'danger', fn: delSel });
  } else if (s.type === 'audio') {
    items = [
      { icon: 'sfx', label: 'Ses', fn: insp('Ses') }, { icon: 'mixer', label: 'EQ / grup', fn: insp('Efekt') }, { icon: 'diamond', label: 'Keyframe', fn: insp('Keyframe') },
      { icon: 'split', label: 'Böl', fn: () => splitSel() }, { icon: 'silence', label: 'Sessizlik', fn: () => openSilence(o, 'audio') }, { icon: 'beat', label: 'Ritim bul', fn: () => findBeats(o) },
      { icon: 'adjust', label: 'Seviye eşitle', fn: () => normalizeItem(o) }, { icon: 'mic', label: 'Stüdyo ses', fn: () => studioClean(o) },
      { icon: o.mute ? 'mute' : 'sfx', label: o.mute ? 'Sesi aç' : 'Sessiz', fn: () => { o.mute = !o.mute; commit(); renderToolbar(); } },
      { icon: 'copy', label: 'Kopyala', fn: dupSel }, { icon: 'trash', label: 'Sil', cls: 'danger', fn: delSel },
    ];
  } else if (s.type === 'subs') {
    items = [
      { icon: 'brand', label: 'Şablonlar', fn: () => openCaptionStyles() }, { icon: 'palette', label: 'Stil', fn: insp('Stil') },
      { icon: 'text', label: 'Satırlar', fn: insp('Satırlar') }, { icon: 'edit', label: 'Ayarlar', fn: insp('Ayarlar') },
      { icon: 'trash', label: 'Tümünü sil', cls: 'danger', fn: delSel },
    ];
  }
  openPop({ key: `item:${s.type}:${s.id}`, anchor, place, title: selLabel(), variant: 'grid', cols: 5, items: items.filter(Boolean).map((it) => ({ ...it, fn: () => { app.pause(); it.fn(); } })) });
}

const LAYER_TABS = {
  text: ['Metin', 'Stil', 'Animasyon', 'Keyframe', 'Konum'], media: ['Düzen', 'Arka plan', 'Chroma', 'Maske', 'Renk', 'Animasyon', 'Keyframe', 'Konum'],
  group: ['Grup', 'Animasyon', 'Keyframe', 'Konum'], wave: ['Dalga', 'Animasyon', 'Keyframe', 'Konum'],
  cta: ['Buton', 'Animasyon', 'Keyframe', 'Konum'], score: ['Skor', 'Animasyon', 'Keyframe', 'Konum'], shape: ['Şekil', 'Animasyon', 'Keyframe', 'Konum'],
  sticker: ['Çıkartma', 'Animasyon', 'Keyframe', 'Konum'], fx: ['Efekt', 'Zaman'], adjust: ['Renk', 'Zaman'],
  social: ['İçerik', 'Animasyon', 'Keyframe', 'Konum'],
};
const TAB_ICON = { Dalga: 'beat', Grup: 'layer', 'Arka plan': 'adjust', İçerik: 'edit', Metin: 'text', Stil: 'brand', Animasyon: 'anim', Keyframe: 'diamond', Konum: 'layer', Düzen: 'edit', Maske: 'shape', Renk: 'color', Chroma: 'adjust', Buton: 'cta', Skor: 'score', Şekil: 'shape', Çıkartma: 'sticker', Efekt: 'fx', Zaman: 'versions' };

function addWave() { addLayer({ kind: 'wave', style: 'mirror', bars: 36, w: 0.8, h: 0.16, color: '#A855F7', color2: '#22D3EE', glow: true, x: 0.5, y: 0.6, rot: 0, sc: 1, opacity: 1, kf: {}, anim: anim('fade', 'fade') }, 5); }

// Yapay zekâ araçları hedefi: seçili klip yoksa oynatıcının altındaki klibi seç
function targetClip() {
  const o = selected();
  if (o && (app.sel.type === 'clip' || o.kind === 'media')) return o;
  const L = layoutClips(app.P.clips).find((x) => app.engine.t >= x.start && app.engine.t < x.end) || layoutClips(app.P.clips)[0];
  if (!L) return null;
  select({ type: 'clip', id: L.clip.id }, false);
  return L.clip;
}
function aiTarget(tab) { const o = targetClip(); if (!o) { toast('Önce Medya ile bir video ekle'); return; } openInspector(tab); }
function aiReframe() { const o = targetClip(); if (!o || app.sel.type !== 'clip') { toast('Önce Medya ile bir video ekle'); return; } smartReframe(o); }

// v1.9: seçim çubuğu — bir öğe seçilince oynatıcının altında ayrı bir satır olarak kayarak açılır (Böl, Kopyala, Sil, Tümü)
function updateQuick() {
  const bar = $('selBar');
  if (!bar) return;
  const s = app.sel, o = selected();
  const on = !!(s && o && !app.multi && !o.locked);
  bar.classList.toggle('on', on);
  const sig = on ? `${s.type}:${s.id}` : '';
  if (bar.dataset.sig === sig) return;
  bar.dataset.sig = sig;
  bar.textContent = '';
  if (!on) return;
  const btn = (ic, label, fn, cls = '') => h('button', { class: `sb-btn ${cls}`, onclick: () => { app.pause(); fn(); } }, h('span', { class: 'sb-ic', html: I[ic] || I.edit }), h('span', { class: 'sb-lb' }, label));
  if (s.type !== 'subs') bar.append(btn('split', 'Böl', () => splitSel()), btn('copy', 'Kopyala', dupSel));
  bar.append(btn('trash', 'Sil', delSel, 'danger'));
  const more = btn('more', 'Tümü', () => { const r = more.getBoundingClientRect(); itemMenu({ x: r.left + r.width / 2, y: bar.getBoundingClientRect().top }); }, 'ghost');
  bar.append(more);
}

function renderToolbar() {
  updateQuick();
  const bar = $('toolbar');
  bar.textContent = '';
  const s = app.sel, o = selected();
  const tool = (ic, label, fn, cls = '') => bar.append(h('button', { class: `tool ${cls}`, onclick: () => { app.pause(); fn(); } }, h('span', { class: 'ti', html: I[ic] || I.edit }), label));
  const insp = (tab) => () => openInspector(tab);
  if (app.multi) {
    bar.classList.add('ctx');
    bar.append(h('button', { class: 'tool back', onclick: () => endMulti() }, h('span', { class: 'ti', html: I.back }), 'Bitti'));
    bar.append(h('div', { class: 'sel-chip' }, `${app.multi.size} öğe seçili`));
    tool('layer', 'Grupla', groupSelected);
    tool('copy', 'Kopyala', () => { [...app.multi].forEach((id) => { const L = app.P.layers.find((x) => x.id === id); if (L) { const n = clone(L); n.id = uid(); app.P.layers.push(n); } }); commit(); toast('Kopyalandı'); });
    tool('eye', 'Gizle/Göster', () => { [...app.multi].forEach((id) => { const L = app.P.layers.find((x) => x.id === id); if (L) L.hidden = !L.hidden; }); commit(); });
    tool('trash', 'Sil', () => { app.P.layers = app.P.layers.filter((x) => !app.multi.has(x.id)); app.multi = new Set(); commit(); renderToolbar(); }, 'danger');
    return;
  }
  if (!s || !o) {
    bar.classList.remove('ctx');
    const cat = app.tbCat && TOOL_CATS.find((c) => c.id === app.tbCat);
    bar.classList.toggle('sub', !!cat);
    if (cat) {
      bar.append(h('button', { class: 'tool back', onclick: () => { app.tbCat = null; renderToolbar(); } }, h('span', { class: 'ti', html: I.back }), 'Geri'));
      bar.append(h('span', { class: 'tb-label' }, cat.name));
      cat.tools().forEach(([ic, label, fn, cls]) => tool(ic, label, fn, cls));
      return;
    }
    tool('media', 'Medya', () => addMedia('clip'), 'primary');
    TOOL_CATS.forEach((c) => {
      const b = h('button', { class: `tool tool-cat ${c.cls || ''}`, onclick: () => { app.pause(); if (c.direct) { c.direct(); return; } openCategory(c, b); } }, h('span', { class: 'ti', html: I[c.icon] || I.edit }), c.name);
      bar.append(b);
    });
    return;
  }
  bar.classList.add('ctx');
  bar.append(h('button', { class: 'tool back', onclick: () => deselect() }, h('span', { class: 'ti', html: I.back }), 'Bitti'));
  bar.append(h('div', { class: 'sel-chip' }, selLabel()));
  if (o.locked) { tool('unlock', 'Kilidi aç', () => { o.locked = false; commit(); renderToolbar(); }); return; }
  if (s.type === 'clip') {
    const isV = o.type === 'video' && !o.freeze;
    tool('edit', 'Düzen', insp('Düzen'));
    tool('color', 'Renk', insp('Renk'));
    tool('adjust', 'Arka plan sil', insp('Arka plan'));
    tool('shape', 'Maske', insp('Maske'));
    tool('color', 'Chroma', insp('Chroma'));
    if (isV) tool('ratio', 'Akıllı kadraj', () => smartReframe(o));
    if (isV) tool('sfx', 'Ses', insp('Ses'));
    if (isV) tool('mic', 'Stüdyo ses', () => studioClean(o));
    tool('diamond', 'Keyframe', insp('Keyframe'));
    tool('trans', 'Geçiş', insp('Geçiş'));
    tool('fx', 'Efekt', () => openEffects());
    tool('filter', 'Filtre', () => openFilters(o));
    if (isV) tool('freeze', 'Dondur', freezeFrame);
    if (isV) tool('silence', 'Sessizlik', () => openSilence(o, 'clip'));
    tool('beat', 'Ritimde böl', splitOnBeats);
  } else if (s.type === 'layer') {
    const tabs = LAYER_TABS[o.kind] || [];
    tabs.forEach((t) => tool(TAB_ICON[t], t, insp(t)));
    tool(o.hidden ? 'eyeOff' : 'eye', o.hidden ? 'Göster' : 'Gizle', () => { o.hidden = !o.hidden; commit(); renderToolbar(); });
    tool('lock', 'Kilitle', () => { o.locked = true; commit(); renderToolbar(); refreshLive(); });
  } else if (s.type === 'audio') {
    tool('sfx', 'Ses', insp('Ses'));
    tool('mixer', 'EQ / grup', insp('Efekt'));
    tool('diamond', 'Keyframe', insp('Keyframe'));
    tool('silence', 'Sessizlik', () => openSilence(o, 'audio'));
    tool('beat', 'Ritim bul', () => findBeats(o));
    tool('adjust', 'Seviye eşitle', () => normalizeItem(o));
    tool('mic', 'Stüdyo ses', () => studioClean(o));
    tool(o.mute ? 'mute' : 'sfx', o.mute ? 'Sesi aç' : 'Sessiz', () => { o.mute = !o.mute; commit(); renderToolbar(); });
    tool('lock', 'Kilitle', () => { o.locked = true; commit(); renderToolbar(); });
  } else if (s.type === 'subs') {
    tool('brand', 'Stil', insp('Stil'));
    tool('text', 'Satırlar', insp('Satırlar'));
    tool('edit', 'Ayarlar', insp('Ayarlar'));
    tool('trash', 'Tümünü sil', delSel, 'danger');
  }
}

function openThemePicker() {
  openSheet({ id: 'theme', title: 'Tema ve renkler', render: (body) => themePickerBody(body, () => refreshSheet()) });
}

// ---------- v1.7: çıkış onayı ----------
function closeExitConfirm() {
  const d = document.querySelector('.exit-confirm');
  if (!d) return;
  d.classList.add('out');
  setTimeout(() => d.remove(), 220);
}
function showExitConfirm(onExit) {
  if (document.querySelector('.exit-confirm')) return;
  const d = h('div', { class: 'exit-confirm', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'ec-card' },
      h('span', { class: 'ec-logo', html: LOGO }),
      h('b', {}, 'Alpicut\'tan çıkılsın mı?'),
      h('small', {}, 'Projelerin otomatik kaydedildi.'),
      h('div', { class: 'ec-row' },
        h('button', { class: 'btn', onclick: closeExitConfirm }, 'Kal'),
        h('button', { class: 'btn primary', onclick: () => { closeExitConfirm(); setTimeout(onExit, 150); } }, 'Çık'))));
  d.addEventListener('click', (e) => { if (e.target === d) closeExitConfirm(); });
  document.body.append(d);
}

// ---------- ana ekran ----------
function renderRatioPick() {
  const box = $('ratioPick');
  box.textContent = '';
  Object.keys(RATIOS).forEach((r) => {
    const [w, hh] = RATIOS[r]; const k = 18 / Math.max(w, hh);
    box.append(h('button', { class: app.newRatio === r ? 'on' : '', onclick: () => { app.newRatio = r; lsSet('alpicut.ratio', r); renderRatioPick(); } }, h('i', { class: 'rt', style: { width: `${Math.round(w * k)}px`, height: `${Math.round(hh * k)}px` } }), r));
  });
  // hızlı şablonlar
  const q = $('quickTpl');
  if (q && !q.childElementCount) {
    const pick = ['aitool', 'devlog', 'vlog', 'product', 'recipe', 'travel', 'aicompare', 'paperstory', 'podcast', 'edu', 'wedding', 'fitness', 'hotel', 'gaming', 'motivation', 'football'];
    pick.map((id) => PROJECT_TEMPLATES.find((t) => t.id === id)).filter(Boolean).forEach((t, i) => q.append(h('button', { class: 'qt', style: { '--i': String(i) }, onclick: () => newProject(t) }, h('span', { class: 'qt-ic' }, t.icon), h('b', {}, t.name))));
    q.append(h('button', { class: 'qt more', onclick: openProjectTemplates }, h('span', { class: 'qt-ic', html: I.template }), h('b', {}, `Tümü · ${PROJECT_TEMPLATES.length}`)));
  }
}

async function renderHome() {
  const list = $('projectList');
  let projects = [];
  try { projects = await store.allProjects(); } catch (e) { console.warn(e); }
  projects.sort((a, b) => b.updated - a.updated);
  list.textContent = '';
  if (!projects.length) {
    list.append(h('div', { class: 'empty-projects' }, 'Henüz proje yok. İlk videonu oluşturmak için “Yeni Proje”ye dokun.'));
    return;
  }
  projects.forEach((p, idx) => {
    const d = new Date(p.updated);
    const card = h('div', { class: 'pcard', style: { '--i': String(Math.min(idx, 12)) } },
      h('button', { class: 'thumb', style: { backgroundImage: p.thumb ? `url(${p.thumb})` : '', width: '100%' }, onclick: () => openProject(p.id), html: p.thumb ? '' : I.media }),
      h('span', { class: 'dur' }, fmt(p.duration || 0, false)),
      h('button', { class: 'pmenu', html: I.more, onclick: () => projectMenu(p) }),
      h('button', { class: 'meta', style: { width: '100%', textAlign: 'left' }, onclick: () => openProject(p.id) },
        h('b', {}, p.name || 'Adsız proje'),
        h('small', {}, `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`)));
    list.append(card);
  });
}

function projectMenu(p) {
  openSheet({
    title: p.name || 'Proje',
    render: (body) => {
      body.append(h('button', { class: 'btn block', style: { marginBottom: '8px' }, html: `${I.edit} Yeniden adlandır`, onclick: async () => {
        const n = prompt('Proje adı', p.name || '');
        if (n == null) return;
        const rec = await store.getProject(p.id);
        rec.name = n.trim() || rec.name; rec.data.name = rec.name;
        await store.putProject(rec); closeSheet(); renderHome();
      } }));
      body.append(h('button', { class: 'btn block', style: { marginBottom: '8px' }, html: `${I.copy} Kopyasını oluştur`, onclick: async () => {
        const rec = await store.getProject(p.id);
        const n = clone(rec); n.id = uid(); n.name = `${rec.name} (kopya)`; n.data.id = n.id; n.data.name = n.name; n.updated = Date.now();
        await store.putProject(n); closeSheet(); renderHome();
      } }));
      body.append(h('button', { class: 'btn block', style: { marginBottom: '8px' }, html: `${I.versions} Sürümler`, onclick: () => openVersions(p.id, () => renderHome()) }));
      body.append(h('button', { class: 'btn block', style: { marginBottom: '8px' }, html: `${I.export} Yedekle (.alpicut)`, onclick: () => { closeSheet(); exportPackage(p.id); } }));
      body.append(h('button', { class: 'btn block danger', html: `${I.trash} Projeyi sil`, onclick: async () => {
        if (!confirm(`"${p.name}" silinsin mi? Bu işlem geri alınamaz.`)) return;
        await deleteProject(p.id); closeSheet(); renderHome();
      } }));
    },
  });
}

function mediaIds(P) {
  const s = new Set();
  P.clips.forEach((c) => s.add(c.mediaId));
  P.layers.forEach((l) => { if (l.mediaId) s.add(l.mediaId); });
  P.audio.forEach((a) => s.add(a.mediaId));
  return s;
}

async function deleteProject(id) {
  const all = await store.allProjects();
  const target = all.find((p) => p.id === id);
  if (!target) return;
  const keep = new Set();
  all.filter((p) => p.id !== id).forEach((p) => mediaIds(p.data).forEach((m) => keep.add(m)));
  for (const m of mediaIds(target.data)) if (!keep.has(m) && !inAssets(m)) { try { await store.delMedia(m); } catch (_) { /* yoksay */ } }
  await store.delProject(id);
}

function openProjectTemplates() {
  openSheet({
    title: 'Şablondan başla', tall: true,
    render: (body) => {
      body.append(h('p', { class: 'hint' }, 'Hazır yerleşimle başla; sonra kendi videolarını, fotoğraflarını ve sesini ekle. Her şey düzenlenebilir.'));
      PROJECT_TEMPLATES.forEach((t) => body.append(h('button', { class: 'ai-card', onclick: () => { closeSheet(); newProject(t); } },
        h('span', { class: 'ai-ic', style: { fontSize: '24px' } }, t.icon), h('span', { class: 'ai-t' }, h('b', {}, t.name), h('small', {}, t.desc)), h('em', {}, t.ratio))));
    },
  });
}

function newProject(tpl) {
  const n = (Number(lsGet('alpicut.count', '0')) || 0) + 1;
  lsSet('alpicut.count', String(n));
  const built = tpl ? tpl.build() : null;
  const P = {
    id: uid(), name: tpl ? tpl.name : `Proje ${n}`, ratio: tpl ? tpl.ratio : app.newRatio, clips: [], layers: built ? built.layers : [], audio: [],
    subs: clone(SUB_BASE), fx: clone(FX_BASE), created: Date.now(), v: PROJECT_VERSION,
  };
  if (built) { P.subs = built.subs; P.fx = built.fx; }
  showEditor(P);
  saveNow();
  if (tpl && !tpl.silent) setTimeout(() => toast('Şablon hazır — şimdi alttan Medya ekle', 3500), 600);
}

async function openProject(id) {
  const b = busy('Proje açılıyor…');
  try {
    const rec = await store.getProject(id);
    if (!rec) throw new Error('Proje bulunamadı');
    let P = rec.data;
    // çökme / ani kapanma sonrası: kayıttan daha yeni kurtarma görüntüsü varsa onu kullan
    const rcv = recoveryFor(id, rec.updated);
    if (rcv) { P = rcv; setTimeout(() => toast('Kaydedilmemiş son değişikliklerin geri getirildi', 3500), 700); }
    if ((P.v || 1) > PROJECT_VERSION) throw new Error('Bu proje Alpicut\'un daha yeni bir sürümüyle kaydedilmiş. Uygulamayı güncelle.');
    migrate(P);
    P.subs = P.subs || clone(SUB_BASE);
    P.fx = { ...clone(FX_BASE), ...(P.fx || {}) };
    const missing = [];
    for (const mid of mediaIds(P)) {
      if (app.engine.media.has(mid)) continue;
      const m = await store.getMedia(mid);
      if (m) registerMedia(m); else missing.push({ id: mid, name: P.mediaNames?.[mid] || mid });
    }
    // kullanıcı LUT'ları
    for (const o of [...P.clips, ...P.layers]) {
      const lid = o.lut?.id;
      if (lid && !lid.startsWith('b:') && !lutStore.has(lid)) { const r = await store.getMedia(lid).catch(() => null); if (r) lutStore.set(lid, r); }
    }
    ensureProjectFonts(P).then(() => app.engine.requestDraw());
    prepareProjectAI(P);
    showEditor(P);
    if (missing.length) setTimeout(() => openRelink(missing, () => app.engine.requestDraw()), 400);
  } catch (e) {
    toast(`Açılamadı: ${e.message || e}`);
  } finally { b.close(); }
}

function showEditor(P) {
  WM.list().forEach((p) => WM.close(p, true)); // ana ekrandan kalan paneller (geçmişe dokunmadan)
  app.P = P;
  app.sel = null;
  app.undo = []; app.redo = [];
  app.snap = JSON.stringify(P);
  $('home').classList.add('hidden');
  $('editor').classList.remove('hidden');
  $('projName').value = P.name;
  try { history.pushState({ v: 'editor' }, ''); } catch (_) { /* yoksay */ }
  app.engine.selectedId = null;
  app.engine.setProject(P);
  requestAnimationFrame(() => {
    fitStage();
    app.engine.seek(0);
    renderTimeline();
    renderKfBar();
    updateTime();
    updateUndo();
  });
}

function goHome(fromPop = false) {
  if (!app.P) return;
  closePop(true);
  app.pause();
  saveNow();
  $('exportModal').classList.add('hidden');
  $('editor').classList.add('hidden');
  $('home').classList.remove('hidden');
  app.P = null;
  app.sel = null;
  if (!fromPop && history.state?.v === 'editor') { try { history.back(); } catch (_) { /* yoksay */ } }
  setTimeout(renderHome, 200);
}

// ---------- kaydetme / geçmiş ----------
function scheduleSave() {
  clearTimeout(app.saveTimer);
  app.saveTimer = setTimeout(saveNow, 1200);
}

async function saveNow() {
  clearTimeout(app.saveTimer);
  const P = app.P;
  if (!P) return;
  const first = P.clips[0];
  // v1.7: kapak = kullanıcının kapağı, yoksa oynatıcıdaki gerçek kare (yazı/motion dahil, yüksek çözünürlük)
  let thumb = P.coverThumb || null;
  if (!thumb && !$('editor').classList.contains('hidden') && (P.clips.length || P.layers.length)) thumb = app.engine.snapshot(540);
  if (!thumb) thumb = first ? app.engine.media.get(first.mediaId)?.thumb : null;
  try {
    const prev = await store.getProject(P.id).catch(() => null);
    let versions = prev?.versions || [];
    const last = versions[versions.length - 1];
    if (prev?.data && (!last || Date.now() - last.at > 3 * 60 * 1000)) versions = [...versions, { at: Date.now(), json: JSON.stringify(prev.data) }].slice(-15);
    const at = Date.now();
    await store.putProject({ id: P.id, name: P.name, updated: at, thumb, duration: app.engine.duration(), data: clone(P), versions });
    journalSaved(P.id, at);
  } catch (e) { console.warn('kaydedilemedi', e); }
}

function commit() {
  const P = app.P;
  if (!P) return;
  const snap = JSON.stringify(P);
  if (snap !== app.snap) {
    app.undo.push(app.snap);
    if (app.undo.length > 80) app.undo.shift();
    app.snap = snap;
    app.redo = [];
    journal(P);
    scheduleSave();
  }
  app.engine.applyMix();
  app.engine.sync(app.engine.t);
  app.engine.requestDraw();
  renderTimeline();
  renderKfBar();
  updateTime();
  updateUndo();
}

function restore(snap) {
  const P = JSON.parse(snap);
  app.P = P;
  app.snap = snap;
  journal(P);
  app.engine.setProject(P);
  $('projName').value = P.name;
  if (app.sel && !selected()) deselect();
  app.engine.selectedId = app.sel?.type === 'layer' ? app.sel.id : null;
  fitStage();
  app.engine.seek(Math.min(app.engine.t, app.engine.duration()));
  renderTimeline();
  updateTime();
  updateUndo();
  refreshLive();
  renderToolbar();
  renderKfBar();
  scheduleSave();
}

function restoreTo(snap) { if (!snap || snap === app.snap) return; app.undo.push(app.snap); app.redo = []; restore(snap); }
function undo() { if (!app.undo.length) return; app.redo.push(app.snap); restore(app.undo.pop()); }
function redo() { if (!app.redo.length) return; app.undo.push(app.snap); restore(app.redo.pop()); }
function updateUndo() { $('btnUndo').disabled = !app.undo.length; $('btnRedo').disabled = !app.redo.length; }

// ---------- önizleme ----------
function fitStage() {
  if (!app.P) return;
  const wrap = $('previewWrap').getBoundingClientRect();
  const [W, H] = RATIOS[app.P.ratio];
  const fs = isFull();
  const pad = fs ? 0 : 16;
  // tam ekranda yan çevrilmiş görünüm: genişlik/yükseklik yer değiştirir
  const rw = app.fsRot ? wrap.height : wrap.width, rh = app.fsRot ? wrap.width : wrap.height;
  const aw = Math.max(50, rw - pad), ah = Math.max(50, rh - pad);
  const cw = Math.min(aw, (ah * W) / H);
  const ch = (cw * H) / W;
  const cv = $('preview');
  cv.style.width = `${cw}px`;
  cv.style.height = `${ch}px`;
  const dpr = window.devicePixelRatio || 1;
  if (!app.engine.exporting) app.engine.resize(Math.max(0.3, Math.min(fs ? 0.9 : 0.6, (cw * dpr) / W)));
}

function updateTime() {
  const E = app.engine;
  if (!app.P) return;
  $('timeCode').textContent = `${fmt(E.t)} / ${fmt(E.duration())}`;
  const pi = E.playing ? 'pause' : 'play';
  if ($('btnPlay').dataset.i !== pi) { $('btnPlay').innerHTML = I[pi]; $('btnPlay').dataset.i = pi; }
  updateKfBar();
  $('emptyHint').classList.toggle('hidden', !!(app.P.clips.length || app.P.layers.length));
}

// Önizleme: katman sürükle/döndür/ölçekle; boşta iki parmakla görünümü yakınlaştır, tek parmakla kaydır
app.view = { z: 1, x: 0, y: 0 };
function applyView() {
  const v = app.view;
  $('stage').style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
  $('viewReset').classList.toggle('hidden', v.z === 1 && !v.x && !v.y);
  $('viewReset').textContent = `${Math.round(v.z * 100)}% · Sığdır`;
}
function resetView() { app.view = { z: 1, x: 0, y: 0 }; applyView(); }

// Keyframe yazma: "Oto keyframe" açıksa her zaman keyframe, değilse iz varsa keyframe, yoksa temel değer
function writeK(o, p, lt, v) { if (app.autoKey) setKey(o, p, lt, v); else writeProp(o, p, lt, v); }

// Seçili ana iz klibinin ekrandaki kaydırma ölçeği (piksel -> panX/panY)
function clipPanScale(c) {
  const [W, H] = RATIOS[app.P.ratio];
  const m = app.engine.media.get(c.mediaId) || {};
  const mw = m.w || W, mh = m.h || H;
  const lt = app.engine.t - (layoutClips(app.P.clips).find((x) => x.clip === c)?.start || 0);
  const z = clipAt(c, lt).zoom || 1;
  if ((c.fit || 'cover') === 'contain') return { kx: W * 0.5, ky: H * 0.5 };
  const sr = mw / mh, dr = W / H;
  let dw, dh;
  if (sr > dr) { dh = H; dw = H * sr; } else { dw = W; dh = W / sr; }
  dw *= z; dh *= z;
  return { kx: Math.max(1, (dw - W) / 2), ky: Math.max(1, (dh - H) / 2) };
}

function bindPreview() {
  const wrap = $('previewWrap');
  const cv = $('preview');
  const ptrs = new Map(); // normalize
  const raw = new Map(); // ekran pikseli
  let g = null;
  let lastTap = 0;
  const norm = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const sizeKey = (L) => (L.kind === 'media' ? 'w' : L.kind === 'text' ? 'size' : L.kind === 'sticker' ? 'size' : 'scale');
  $('viewReset').addEventListener('click', (e) => { e.stopPropagation(); resetView(); });
  $('viewReset').addEventListener('pointerdown', (e) => e.stopPropagation());
  // seçili ve şu an ekranda olan ana iz klibi
  const activeSelClip = () => {
    if (app.sel?.type !== 'clip') return null;
    const o = selected();
    if (!o || o.locked) return null;
    const L = layoutClips(app.P.clips).find((x) => x.clip === o);
    if (!L || app.engine.t < L.start || app.engine.t >= L.end) return null;
    return { c: o, start: L.start };
  };

  wrap.addEventListener('pointerdown', (e) => {
    if (!app.P) return;
    if (e.target.closest('.panel-dock, .view-reset')) return;
    try { wrap.setPointerCapture(e.pointerId); } catch (_) { /* yoksay */ }
    ptrs.set(e.pointerId, norm(e));
    raw.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      closePop();
      if (app.engine.playing) app.pause();
      const p = norm(e);
      if (app.pickMode) { ptrs.delete(e.pointerId); raw.delete(e.pointerId); samplePreview(p.x, p.y); return; }
      const inside = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
      const hit = inside ? app.engine.hitTest(p.x, p.y) : null;
      const kv = hit ? layerAt(hit, app.engine.t) : null;
      const SC = !hit ? activeSelClip() : null;
      g = { L: hit && !hit.locked ? hit : null, tapL: hit, C: SC, p0: p, r0: { x: e.clientX, y: e.clientY }, v0: { ...app.view }, x0: kv?.x, y0: kv?.y, moved: false, wasSel: hit && app.sel?.id === hit.id };
      if (SC) { const lt = app.engine.t - SC.start; g.ck = clipAt(SC.c, lt); g.cs = clipPanScale(SC.c); }
      if (hit && !g.wasSel) { app.sel = { type: 'layer', id: hit.id }; app.engine.selectedId = hit.id; app.engine.requestDraw(); }
    } else if (ptrs.size === 2 && g) {
      const [a, b] = [...ptrs.values()];
      const [ra, rb] = [...raw.values()];
      g.moved = true;
      if (g.L) {
        const ar = RATIOS[app.P.ratio][1] / RATIOS[app.P.ratio][0];
        const kv = layerAt(g.L, app.engine.t);
        g.pinch = { d: Math.hypot(a.x - b.x, (a.y - b.y) * ar), ang: Math.atan2((b.y - a.y) * ar, b.x - a.x), size: hasKeys(g.L, 's') || app.autoKey ? kv.s : (g.L[sizeKey(g.L)] ?? 1), rot: kv.rot };
      } else if (g.C) {
        // seçili klip: iki parmak = klibi yakınlaştır/uzaklaştır (+ ortadan kaydır) — keyframe destekli
        const lt = app.engine.t - g.C.start;
        g.ck = clipAt(g.C.c, lt);
        g.cpinch = { d: Math.hypot(ra.x - rb.x, ra.y - rb.y), mx: (ra.x + rb.x) / 2, my: (ra.y + rb.y) / 2 };
      } else {
        g.vpinch = { d: Math.hypot(ra.x - rb.x, ra.y - rb.y), mx: (ra.x + rb.x) / 2, my: (ra.y + rb.y) / 2, v0: { ...app.view } };
      }
    }
  });

  wrap.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId) || !g) return;
    ptrs.set(e.pointerId, norm(e));
    raw.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const L = g.L;
    if (ptrs.size === 2 && g.vpinch) {
      const [ra, rb] = [...raw.values()];
      const d = Math.hypot(ra.x - rb.x, ra.y - rb.y);
      const mx = (ra.x + rb.x) / 2, my = (ra.y + rb.y) / 2;
      const z = Math.max(0.5, Math.min(8, g.vpinch.v0.z * (d / Math.max(10, g.vpinch.d))));
      app.view = { z, x: g.vpinch.v0.x + (mx - g.vpinch.mx), y: g.vpinch.v0.y + (my - g.vpinch.my) };
      applyView();
      return;
    }
    if (g.C && !L) {
      const c = g.C.c, lt = app.engine.t - g.C.start;
      const r = cv.getBoundingClientRect();
      const [W] = RATIOS[app.P.ratio];
      const pxK = W / Math.max(1, r.width); // ekran pikseli -> video pikseli
      if (ptrs.size === 2 && g.cpinch) {
        const [ra, rb] = [...raw.values()];
        const d = Math.hypot(ra.x - rb.x, ra.y - rb.y);
        const z = Math.max(0.5, Math.min(3, g.ck.zoom * (d / Math.max(10, g.cpinch.d))));
        writeK(c, 'zoom', lt, +z.toFixed(3));
        const sc = clipPanScale(c);
        const mx = (ra.x + rb.x) / 2, my = (ra.y + rb.y) / 2;
        writeK(c, 'panX', lt, +Math.max(-1, Math.min(1, g.ck.panX + ((mx - g.cpinch.mx) * pxK) / sc.kx)).toFixed(3));
        writeK(c, 'panY', lt, +Math.max(-1, Math.min(1, g.ck.panY + ((my - g.cpinch.my) * pxK) / sc.ky)).toFixed(3));
        g.cmoved = true;
        app.engine.requestDraw(); updateKfBar();
        return;
      }
      if (ptrs.size === 1 && !g.cpinch) {
        const dx = e.clientX - g.r0.x, dy = e.clientY - g.r0.y;
        if (!g.moved && Math.hypot(dx, dy) < 8) return;
        g.moved = true; g.cmoved = true;
        writeK(c, 'panX', lt, +Math.max(-1, Math.min(1, g.ck.panX + (dx * pxK) / g.cs.kx)).toFixed(3));
        writeK(c, 'panY', lt, +Math.max(-1, Math.min(1, g.ck.panY + (dy * pxK) / g.cs.ky)).toFixed(3));
        app.engine.requestDraw(); updateKfBar();
      }
      return;
    }
    if (!L) {
      // boş alanda tek parmak: yakınlaştırılmışsa görünümü kaydır
      if (ptrs.size === 1 && app.view.z !== 1) {
        const dx = e.clientX - g.r0.x, dy = e.clientY - g.r0.y;
        if (!g.moved && Math.hypot(dx, dy) < 6) return;
        g.moved = true; g.panned = true;
        app.view = { ...g.v0, x: g.v0.x + dx, y: g.v0.y + dy };
        applyView();
      }
      return;
    }
    if (ptrs.size === 1 && !g.pinch) {
      const p = norm(e);
      const dx = p.x - g.p0.x, dy = p.y - g.p0.y;
      if (!g.moved && Math.hypot(dx, dy) < 0.012 / app.view.z) return;
      g.moved = true;
      let nx = g.x0 + dx, ny = g.y0 + dy;
      const gx = Math.abs(nx - 0.5) < 0.015 / app.view.z, gy = Math.abs(ny - 0.5) < 0.012 / app.view.z;
      if (gx) nx = 0.5;
      if (gy) ny = 0.5;
      const lt = app.engine.t - L.start;
      writeK(L, 'x', lt, nx); writeK(L, 'y', lt, ny);
      app.engine.guides = { x: gx, y: gy };
      app.engine.requestDraw(); updateKfBar();
    } else if (ptrs.size === 2 && g.pinch) {
      const [a, b] = [...ptrs.values()];
      const ar = RATIOS[app.P.ratio][1] / RATIOS[app.P.ratio][0];
      const d = Math.hypot(a.x - b.x, (a.y - b.y) * ar);
      const ang = Math.atan2((b.y - a.y) * ar, b.x - a.x);
      const k = sizeKey(L);
      const v = g.pinch.size * (d / Math.max(0.01, g.pinch.d));
      const lt = app.engine.t - L.start;
      if (hasKeys(L, 's') || app.autoKey) setKey(L, 's', lt, Math.max(0.05, Math.min(4, v)));
      else L[k] = k === 'size' ? Math.round(Math.max(16, Math.min(k === 'size' && L.kind === 'sticker' ? 1200 : 400, v))) : Math.max(0.05, Math.min(4, v));
      let rot = g.pinch.rot + ((ang - g.pinch.ang) * 180) / Math.PI;
      if (Math.abs(rot) < 4) rot = 0;
      writeK(L, 'rot', lt, Math.round(rot));
      app.engine.requestDraw(); updateKfBar();
    }
  });

  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    raw.delete(e.pointerId);
    if (ptrs.size > 0) return;
    app.engine.guides = null;
    const G = g; g = null;
    if (!G) return;
    if (G.vpinch || G.panned) { app.engine.requestDraw(); return; }
    if (G.moved || G.cmoved) { commit(); refreshSheet(); if (G.C) undoToast(app.autoKey || hasKeys(G.C.c, 'zoom') || hasKeys(G.C.c, 'panX') ? 'Keyframe yazıldı' : 'Kadraj değişti'); return; }
    if (G.tapL) {
      // v1.8: önizlemede dokunmak yalnızca seçer; menü oynatıcı altındaki ⋯ veya zaman çizelgesinde basılı tutarak açılır
      select({ type: 'layer', id: G.tapL.id }, false);
      return;
    }
    const now = performance.now();
    if (now - lastTap < 320) { lastTap = 0; resetView(); return; }
    lastTap = now;
    if (G.C) return; // seçili klipte tek dokunuş seçimi bırakmaz (yanlışlıkla kaybolmasın)
    deselect();
  };
  wrap.addEventListener('pointerup', up);
  wrap.addEventListener('pointercancel', up);
}

function undoToast(msg) { toast(msg, 3200, { label: 'Geri al', fn: undo }); }

// ---------- seçim ----------
function select(sel, tab, extra) {
  app.sel = sel;
  app.engine.selectedId = sel.type === 'layer' ? sel.id : null;
  app.engine.requestDraw();
  markSelection();
  renderToolbar();
  renderKfBar();
  if (tab !== false) openInspector(tab, extra);
}

function deselect() {
  app.sel = null;
  app.engine.selectedId = null;
  closePop();
  app.engine.requestDraw();
  markSelection();
  renderToolbar();
  renderKfBar();
  refreshLive();
}

// ---------- düzenleme oturumu (Uygula / İptal) ----------
function beginEdit() { return { snap: app.snap, ulen: app.undo.length }; }
function endEdit(tk, apply) {
  if (!app.P || !tk) return;
  if (apply) {
    commit();
    if (app.undo.length > tk.ulen + 1) { app.undo = app.undo.slice(0, tk.ulen); app.undo.push(tk.snap); updateUndo(); }
  } else {
    app.undo = app.undo.slice(0, tk.ulen);
    app.redo = [];
    if (tk.snap !== JSON.stringify(app.P)) restore(tk.snap);
    updateUndo();
    renderToolbar();
  }
}

// ---------- işaretleyiciler ----------
function toggleMarker() {
  const P = app.P;
  P.markers = P.markers || [];
  const t = app.engine.t;
  const i = P.markers.findIndex((m) => m.kind !== 'beat' && Math.abs(m.t - t) < 0.08);
  if (i >= 0) { P.markers.splice(i, 1); toast('İşaret kaldırıldı'); } else { P.markers.push({ id: uid(), t, kind: 'user' }); P.markers.sort((a, b) => a.t - b.t); toast('İşaret eklendi'); }
  commit();
}

function splitOnBeats() {
  const P = app.P, o = selected();
  const L = layoutClips(P.clips).find((x) => x.clip === o);
  if (!L) return;
  const beats = (P.markers || []).filter((m) => m.t > L.start + 0.15 && m.t < L.end - 0.15).map((m) => m.t).sort((a, b) => b - a);
  if (!beats.length) { toast('Bu klibin üzerinde işaret yok. Önce müziğe dokunup “Ritim bul” kullan.', 3500); return; }
  const saveT = app.engine.t;
  beats.forEach((t) => { app.engine.t = t; splitSel(true); });
  app.engine.seek(saveT);
  commit();
  toast(`${beats.length} noktadan bölündü`);
}

// Kaynak zamanındaki aralıkları kes (sessizlik kaldırma). ripple: sonraki öğeleri de kaydır
function cutSourceRanges(o, type, ranges, ripple) {
  const P = app.P;
  const rs = [...ranges].sort((a, b) => b.s - a.s);
  const sp = o.speed || 1;
  let removed = 0;
  if (type === 'clip') {
    const L0 = layoutClips(P.clips).find((x) => x.clip === o);
    let pieces = [o];
    rs.forEach((r) => {
      const s = Math.max(r.s, o.in), e = Math.min(r.e, o.out);
      if (e - s < 0.05) return;
      // ilgili parçayı bul
      const piece = pieces.find((p) => s >= p.in - 1e-6 && e <= p.out + 1e-6);
      if (!piece) return;
      const idx = P.clips.indexOf(piece);
      const tl = L0.start + (s - o.in) / sp; // zaman çizelgesindeki konum (sondan başa işlendiği için geçerli)
      const d = (e - s) / sp;
      const right = clone(piece); right.id = uid(); right.in = e; right.trans = { type: 'none', dur: 0.5 }; right.kf = {};
      const leftLen = (s - piece.in);
      if (leftLen > 0.04) { piece.out = s; P.clips.splice(idx + 1, 0, right); pieces.push(right); }
      else { piece.in = e; }
      if (right.out - right.in < 0.04) { const k = P.clips.indexOf(right); if (k >= 0) P.clips.splice(k, 1); }
      removed += d;
      if (ripple) shiftAfter(tl, d);
    });
  } else {
    let pieces = [o];
    rs.forEach((r) => {
      const s = Math.max(r.s, o.in), e = Math.min(r.e, o.out);
      if (e - s < 0.05) return;
      const piece = pieces.find((p) => s >= p.in - 1e-6 && e <= p.out + 1e-6);
      if (!piece) return;
      const d = e - s;
      const right = clone(piece); right.id = uid(); right.kf = {};
      right.in = e; right.start = piece.start + (s - piece.in);
      piece.out = s;
      // bu ses parçasından sonraki parçaları sola kaydır
      pieces.forEach((p) => { if (p !== piece && p.start > piece.start) p.start -= d; });
      if (piece.out - piece.in < 0.04) { P.audio.splice(P.audio.indexOf(piece), 1); pieces = pieces.filter((x) => x !== piece); }
      if (right.out - right.in >= 0.04) { P.audio.push(right); pieces.push(right); }
      removed += d;
    });
  }
  commit();
  toast(`${rs.length} bölüm kesildi · ${removed.toFixed(1)} sn kısaldı`);
}

function shiftAfter(t0, d) {
  const P = app.P;
  P.layers.forEach((l) => {
    if (l.start >= t0) { l.start -= d; l.end -= d; } else if (l.end > t0) { l.end = Math.max(l.start + 0.2, l.end - Math.min(d, l.end - t0)); }
  });
  P.audio.forEach((a) => { if (a.start >= t0) a.start -= d; });
  (P.markers || []).forEach((m) => { if (m.t >= t0) m.t -= d; });
  if (P.subs?.cues) {
    const off = P.subs.offset || 0;
    P.subs.cues = P.subs.cues.filter((c) => !(c.start + off >= t0 && c.end + off <= t0 + d));
    P.subs.cues.forEach((c) => {
      if (c.start + off >= t0 + d) { c.start -= d; c.end -= d; } else if (c.end + off > t0) { c.end = Math.max(c.start + 0.1, c.end - Math.min(d, c.end + off - t0)); }
    });
  }
}

// Önizlemeden renk seç (chroma key)
function pickColor(o, cb) { app.pickMode = { o, cb }; }
function samplePreview(nx, ny) {
  const pm = app.pickMode; app.pickMode = null;
  const o = pm.o;
  const was = o.key?.on;
  if (o.key) o.key.on = false;
  app.engine.draw();
  const cv = app.engine.canvas;
  let hex = '#00ff00';
  try {
    const d = cv.getContext('2d').getImageData(Math.floor(nx * cv.width), Math.floor(ny * cv.height), 1, 1).data;
    hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  } catch (_) { /* yoksay */ }
  if (o.key) o.key.on = was;
  app.engine.requestDraw();
  pm.cb(hex);
}

async function relinkMedia(id, file) {
  const kind = kindOf(file);
  const meta = await probe(file, kind);
  const rec = { id, kind, name: file.name, blob: file, ...meta };
  await store.putMedia(rec);
  const old = app.engine.media.get(id);
  if (old?.url) URL.revokeObjectURL(old.url);
  registerMedia(rec);
  for (const [k, el] of app.engine.els) if (el._mid === id) { el.pause(); app.engine.els.delete(k); }
  app.engine.imgs.delete(id);
  app.engine.requestDraw();
  renderTimeline();
}

// ---------- medya ekleme ----------
function pickFiles(accept, multiple = true) {
  return new Promise((resolve) => {
    const inp = $('fileInput');
    inp.value = '';
    if (accept) inp.setAttribute('accept', accept); else inp.removeAttribute('accept');
    inp.multiple = multiple;
    inp.onchange = () => resolve([...inp.files]);
    inp.click();
  });
}

function kindOf(f) {
  const t = f.type || '';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) return 'video';
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'bmp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'].includes(ext)) return 'audio';
  return 'video';
}

function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), ms))]); }

async function probe(blob, kind) {
  const url = URL.createObjectURL(blob);
  try {
    if (kind === 'image') {
      const img = new Image();
      await withTimeout(new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('resim açılamadı')); img.src = url; }), 15000);
      return { w: img.naturalWidth, h: img.naturalHeight, duration: 0, thumb: thumbOf(img, img.naturalWidth, img.naturalHeight) };
    }
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
    el.preload = 'auto'; el.muted = true; el.playsInline = true; el.src = url;
    await withTimeout(new Promise((res, rej) => { el.onloadedmetadata = res; el.onerror = () => rej(new Error('dosya açılamadı')); }), 20000);
    let duration = el.duration;
    if (!isFinite(duration)) {
      el.currentTime = 1e7;
      await withTimeout(new Promise((res) => { el.ontimeupdate = () => { el.ontimeupdate = null; res(); }; }), 8000).catch(() => {});
      duration = isFinite(el.duration) ? el.duration : 10;
    }
    if (kind === 'audio') return { duration, w: 0, h: 0, thumb: null };
    el.currentTime = Math.min(0.6, duration / 3);
    await withTimeout(new Promise((res) => { el.onseeked = res; }), 8000).catch(() => {});
    let thumb = null;
    try { thumb = thumbOf(el, el.videoWidth, el.videoHeight); } catch (_) { /* yoksay */ }
    return { duration, w: el.videoWidth, h: el.videoHeight, thumb };
  } finally { URL.revokeObjectURL(url); }
}

function thumbOf(src, w, h) {
  if (!w || !h) return null;
  const th = 200, tw = Math.round((th * w) / h);
  const c = document.createElement('canvas');
  c.width = Math.min(tw, 360); c.height = th;
  const ctx = c.getContext('2d');
  const k = Math.max(c.width / w, c.height / h);
  ctx.drawImage(src, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k);
  return c.toDataURL('image/jpeg', 0.8);
}

function registerMedia(rec) {
  if (app.P && rec.kind !== 'lut') { app.P.mediaNames = app.P.mediaNames || {}; app.P.mediaNames[rec.id] = rec.name; }
  const url = URL.createObjectURL(rec.blob);
  const purl = rec.proxyBlob ? URL.createObjectURL(rec.proxyBlob) : null;
  app.engine.media.set(rec.id, { ...rec, url, purl });
  const m = app.engine.media.get(rec.id);
  if (!purl) setTimeout(() => queueProxy(m), 1500); // v1.6: ağır videoya hafif önizleme kopyası
  queueScrub(m); // v1.7: anlık kaydırma önizlemesi
  return m;
}

async function importFiles(files, forceAudio = false) {
  const out = [];
  const b = busy('Medya ekleniyor…');
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      b.set(`Medya ekleniyor… (${i + 1}/${files.length})`);
      const kind = forceAudio && kindOf(f) === 'video' ? 'video' : kindOf(f);
      try {
        const meta = await probe(f, kind);
        const rec = { id: uid(), kind, name: f.name, blob: f, ...meta };
        try { await store.putMedia(rec); } catch (e) { console.warn(e); toast('Uyarı: medya cihaza kaydedilemedi, proje kapanınca kaybolabilir'); }
        out.push(registerMedia(rec));
        addToAssets(rec); // v1.7: her medya Assets kütüphanesine
      } catch (e) { toast(`${f.name}: ${e.message || 'açılamadı'}`); }
    }
  } finally { b.close(); }
  return out;
}

// v1.7: medyadan ana iz klibi (Vibe editing de kullanır)
function makeClip(m) {
  const [W, H] = RATIOS[app.P.ratio];
  const wide = m.w && m.h && (m.w / m.h) > (W / H) * 1.3;
  return {
    id: uid(), mediaId: m.id, type: m.kind === 'image' ? 'image' : 'video',
    in: 0, out: m.duration || 3, dur: 3, speed: 1, volume: 1, mute: false,
    fit: wide ? 'contain' : 'cover', bgMode: 'blur', bgColor: '#000000', zoom: 1, panX: 0, panY: 0,
    kenburns: m.kind === 'image', filters: { ...DEFAULT_FILTERS }, filterPreset: 'none', trans: { type: 'none', dur: 0.5 },
  };
}

async function addMedia(target) {
  const accept = target === 'audio' ? 'audio/*,video/*' : 'video/*,image/*';
  const files = await pickFiles(accept, target !== 'audio');
  if (!files.length) return;
  const recs = await importFiles(files, target === 'audio');
  if (!recs.length) return;
  const P = app.P;
  const t = app.engine.t;
  const [W, H] = RATIOS[P.ratio];
  let last = null;
  recs.forEach((m) => {
    if (target === 'clip') {
      if (m.kind === 'audio') { P.audio.push(newAudio(m, t)); return; }
      const wide = m.w && m.h && (m.w / m.h) > (W / H) * 1.3;
      const c = {
        id: uid(), mediaId: m.id, type: m.kind === 'image' ? 'image' : 'video',
        in: 0, out: m.duration || 3, dur: 3, speed: 1, volume: 1, mute: false,
        fit: wide ? 'contain' : 'cover', bgMode: 'blur', bgColor: '#000000', zoom: 1, panX: 0, panY: 0,
        kenburns: m.kind === 'image', filters: { ...DEFAULT_FILTERS }, filterPreset: 'none', trans: { type: 'none', dur: 0.5 },
      };
      P.clips.push(c); last = { type: 'clip', id: c.id };
    } else if (target === 'layer') {
      if (m.kind === 'audio') { P.audio.push(newAudio(m, t)); return; }
      const dur = m.kind === 'image' ? 4 : Math.min(m.duration || 4, 15);
      const l = {
        id: uid(), kind: 'media', mediaId: m.id, start: t, end: t + dur, in: 0, out: m.duration || dur,
        x: 0.5, y: 0.42, w: 0.72, rot: 0, opacity: 1, crop: 'none', radius: 28, borderW: 0, borderColor: '#FFFFFF',
        shadowOn: true, kenburns: false, volume: 0, loop: false, filters: { ...DEFAULT_FILTERS }, filterPreset: 'none',
        anim: anim('pop', 'fade'),
      };
      P.layers.push(l); last = { type: 'layer', id: l.id };
    } else {
      const a = newAudio(m, t); P.audio.push(a); last = { type: 'audio', id: a.id };
    }
  });
  commit();
  if (target !== 'clip' && last) select(last);
  else if (P.clips.length === recs.length) { app.engine.seek(0); syncScroll(0, true); }
}

function newAudio(m, t) {
  return { id: uid(), mediaId: m.id, start: t, in: 0, out: m.duration || 10, volume: 1, fadeIn: 0, fadeOut: 0 };
}

function addLayer(L, dur = 3) {
  const t = app.engine.t;
  L.id = uid();
  L.start = t;
  L.end = t + dur;
  app.P.layers.push(L);
  commit();
  closeSheet();
  setTimeout(() => select({ type: 'layer', id: L.id }), 240);
}

// ---------- düzenleme işlemleri ----------
function splitSel(quiet = false) {
  if (quiet && typeof quiet !== 'boolean') quiet = false;
  const s = app.sel, o = selected();
  const t = app.engine.t;
  const P = app.P;
  if (!s || !o) return;
  if (s.type === 'clip') {
    const L = layoutClips(P.clips).find((x) => x.clip === o);
    const local = t - L.start;
    if (curvePts(o)) { toast('Hız eğrili klip bölünemez; önce Düzen > Hız eğrisi > Sabit seç'); return; }
    if (local < 0.1 || local > L.len - 0.1) { toast('Bölmek için oynatıcıyı klibin üzerine getir'); return; }
    const n = clone(o); n.id = uid(); n.trans = { type: 'none', dur: 0.5 };
    if (o.type === 'image' || o.freeze) { n.dur = L.len - local; o.dur = local; } else { const st = o.in + local * (o.speed || 1); o.out = st; n.in = st; }
    splitKeys(o, n, local);
    P.clips.splice(P.clips.indexOf(o) + 1, 0, n);
  } else if (s.type === 'layer') {
    if (t < o.start + 0.1 || t > o.end - 0.1) { toast('Bölmek için oynatıcıyı katmanın üzerine getir'); return; }
    const n = clone(o); n.id = uid();
    if (o.kind === 'media') n.in = (o.in || 0) + (t - o.start);
    splitKeys(o, n, t - o.start);
    o.end = t; n.start = t;
    P.layers.splice(P.layers.indexOf(o) + 1, 0, n);
  } else if (s.type === 'audio') {
    const local = t - o.start;
    if (local < 0.1 || local > o.out - o.in - 0.1) { toast('Bölmek için oynatıcıyı sesin üzerine getir'); return; }
    const n = clone(o); n.id = uid();
    const st = o.in + local; o.out = st; n.in = st; n.start = t;
    P.audio.splice(P.audio.indexOf(o) + 1, 0, n);
  }
  if (quiet) return;
  commit();
  refreshSheet();
  toast('Bölündü');
}

function dupSel() {
  const s = app.sel, o = selected();
  const P = app.P;
  if (!s || !o) return;
  const n = clone(o); n.id = uid();
  if (s.type === 'clip') P.clips.splice(P.clips.indexOf(o) + 1, 0, n);
  else if (s.type === 'layer') { const len = o.end - o.start; n.start = o.end; n.end = o.end + len; P.layers.push(n); }
  else if (s.type === 'audio') { n.start = o.start + (o.out - o.in); P.audio.push(n); }
  commit();
  select({ type: s.type, id: n.id });
  toast('Kopyalandı');
}

function delSel() {
  const s = app.sel, o = selected();
  const P = app.P;
  if (!s || !o) return;
  if (s.type === 'clip') P.clips.splice(P.clips.indexOf(o), 1);
  else if (s.type === 'layer') P.layers.splice(P.layers.indexOf(o), 1);
  else if (s.type === 'audio') P.audio.splice(P.audio.indexOf(o), 1);
  else if (s.type === 'subs') P.subs.cues = [];
  deselect();
  app.engine.seek(Math.min(app.engine.t, app.engine.duration()));
  commit();
}

function moveClip(dir) {
  const P = app.P, o = selected();
  const i = P.clips.indexOf(o), j = i + dir;
  if (i < 0 || j < 0 || j >= P.clips.length) return;
  [P.clips[i], P.clips[j]] = [P.clips[j], P.clips[i]];
  commit();
  refreshSheet();
}

function layerOrder(dir) {
  const P = app.P, o = selected();
  const i = P.layers.indexOf(o), j = i + dir;
  if (i < 0 || j < 0 || j >= P.layers.length) { toast(dir > 0 ? 'Zaten en önde' : 'Zaten en arkada'); return; }
  [P.layers[i], P.layers[j]] = [P.layers[j], P.layers[i]];
  commit();
  toast(dir > 0 ? 'Öne getirildi' : 'Arkaya gönderildi');
}

// ---------- çoklu seçim ve gruplama ----------
function startMulti() { app.multi = new Set(); deselect(); renderToolbar(); renderTimeline(); toast('Katmanlara dokunarak seç'); }
function endMulti() { app.multi = null; renderToolbar(); renderTimeline(); }
function toggleMulti(id) { if (!app.multi) return; if (app.multi.has(id)) app.multi.delete(id); else app.multi.add(id); renderToolbar(); renderTimeline(); }

function groupSelected() {
  const P = app.P;
  const sel = P.layers.filter((l) => app.multi?.has(l.id) && l.kind !== 'group');
  if (sel.length < 2) { toast('Gruplamak için en az 2 katman seç'); return; }
  const idx = Math.max(...sel.map((l) => P.layers.indexOf(l)));
  const G = { id: uid(), kind: 'group', name: `Grup (${sel.length})`, children: sel.map((l) => clone(l)), start: Math.min(...sel.map((l) => l.start)), end: Math.max(...sel.map((l) => l.end)), x: 0.5, y: 0.5, rot: 0, sc: 1, opacity: 1, kf: {}, anim: anim('none', 'none') };
  P.layers.splice(idx + 1, 0, G);
  P.layers = P.layers.filter((l) => !sel.includes(l));
  app.multi = null;
  commit();
  select({ type: 'layer', id: G.id }, false);
  toast('Gruplandı — artık birlikte taşınır, ölçeklenir ve animasyonlanır');
}

function ungroup(G) {
  const P = app.P;
  const W = app.engine.W, H = app.engine.H;
  const a = ((G.rot || 0) * Math.PI) / 180, s = G.sc || 1;
  const kids = (G.children || []).map((c) => {
    const n = clone(c);
    const dx = (c.x - 0.5) * W, dy = (c.y - 0.5) * H;
    n.x = 0.5 + (G.x - 0.5) + (dx * Math.cos(a) - dy * Math.sin(a)) * s / W;
    n.y = 0.5 + (G.y - 0.5) + (dx * Math.sin(a) + dy * Math.cos(a)) * s / H;
    n.rot = (c.rot || 0) + (G.rot || 0);
    n.sc = (c.sc ?? 1) * s;
    n.opacity = (c.opacity ?? 1) * (G.opacity ?? 1);
    return n;
  });
  const i = P.layers.indexOf(G);
  P.layers.splice(i, 1, ...kids);
  deselect();
  commit();
  toast('Grup çözüldü');
}

// zaman çizelgesinde aralıkları kes (metinden kurgu) ve sonrasını kaydır
function cutTimelineRanges(ranges) {
  const P = app.P;
  const rs = [...ranges].sort((x, y) => y.s - x.s);
  let total = 0;
  rs.forEach((r) => {
    const lay = layoutClips(P.clips);
    for (let k = lay.length - 1; k >= 0; k--) {
      const L = lay[k], c = L.clip;
      const a = Math.max(r.s, L.start), b = Math.min(r.e, L.end);
      if (b - a < 0.02) continue;
      const sp = c.speed || 1;
      const ls = a - L.start, le = b - L.start;
      const i = P.clips.indexOf(c);
      if (c.type === 'image' || c.freeze) {
        c.dur = Math.max(0.2, c.dur - (le - ls));
      } else if (ls < 0.03 && le > L.len - 0.03) {
        P.clips.splice(i, 1);
      } else if (ls < 0.03) { c.in += le * sp; }
      else if (le > L.len - 0.03) { c.out = c.in + ls * sp; }
      else {
        const right = clone(c); right.id = uid(); right.trans = { type: 'none', dur: 0.5 }; right.kf = {};
        right.in = c.in + le * sp; c.out = c.in + ls * sp;
        P.clips.splice(i + 1, 0, right);
      }
    }
    shiftAfter(r.s, r.e - r.s);
    total += r.e - r.s;
  });
  // ses dosyalarını da aynı aralıklardan kes
  rs.forEach((r) => {
    P.audio.slice().forEach((a) => {
      const len = a.out - a.in, s0 = a.start, e0 = a.start + len;
      const x = Math.max(r.s, s0), y = Math.min(r.e, e0);
      if (y - x < 0.02 || a.sfx || (a.role || 'music') === 'music') return;
      const right = clone(a); right.id = uid();
      right.in = a.in + (y - s0); right.start = r.s;
      a.out = a.in + (x - s0);
      if (a.out - a.in < 0.03) P.audio.splice(P.audio.indexOf(a), 1);
      if (right.out - right.in >= 0.03) P.audio.push(right);
    });
  });
  commit();
  toast(`${ranges.length} kesim · ${total.toFixed(1)} sn kısaldı`);
}

// stüdyo ses temizliği
function studioClean(o) {
  // v1.7: tam ekran Ses stüdyosu (temizle + ayır)
  import('./audiostudio.js').then((m) => m.openAudioStudio(o));
}
function studioCleanOld(o) {
  const st = { preset: 'podcast' };
  openSheet({
    title: 'Stüdyo ses', 
    render: (body) => {
      body.append(h('p', { class: 'hint', html: 'Sesi yapay zekâ gürültü temizliği (RNNoise), uğultu filtresi, EQ, de-esser (sert “s” sesleri), kompresör ve seviye eşitlemeden geçirir. Orijinal dosya korunur; geri al ile dönebilirsin.' }));
      const ch = h('div', { class: 'chips' });
      Object.entries(STUDIO_PRESETS).forEach(([k, v]) => ch.append(h('button', { class: st.preset === k ? 'on' : '', onclick: () => { st.preset = k; refreshSheet(); } }, v.label)));
      body.append(h('div', { class: 'field full' }, h('label', {}, 'Ön ayar'), ch));
      body.append(h('button', { class: 'btn block primary', html: `${I.mic} Uygula`, onclick: async () => {
        const m = app.engine.media.get(o.mediaId);
        if (!m) return;
        closeSheet();
        const b = busy('Ses işleniyor…');
        try {
          const wav = await processVoice(m.blob, STUDIO_PRESETS[st.preset], (p, t) => b.set(`${t} %${Math.round(p * 100)}`));
          const file = new File([wav], `${(m.name || 'ses').replace(/\.\w+$/, '')}_studyo.wav`, { type: 'audio/wav' });
          const recs = await importFiles([file], true);
          if (!recs[0]) throw new Error('Kaydedilemedi');
          if (o.type === 'video') {
            // video sesini kapat, temiz sesi aynı yere ve aynı kırpmayla ekle
            const L = layoutClips(app.P.clips).find((x) => x.clip === o);
            o.mute = true;
            app.P.audio.push({ id: uid(), mediaId: recs[0].id, start: L.start, in: o.in, out: o.out, volume: o.volume ?? 1, fadeIn: 0, fadeOut: 0, role: 'voice', linked: o.id });
            if ((o.speed || 1) !== 1) toast('Not: hızlandırılmış kliplerde temiz ses normal hızda eklenir', 3500);
          } else { o.mediaId = recs[0].id; o.afx = { hp: false, low: 0, mid: 0, high: 0, comp: false }; }
          commit();
          toast('Stüdyo ses uygulandı');
        } catch (e) { toast(e.message || 'İşlenemedi', 4000); } finally { b.close(); }
      } }));
    },
  });
}

// Ters oynatma: kareleri sondan başa çizip yeni bir video olarak kaydeder (sesi de ters çevrilir)
async function reverseClip(c) {
  const m = app.engine.media.get(c.mediaId);
  if (!m || m.kind !== 'video') return;
  const len = c.out - c.in;
  if (len > 60) { toast('Ters çevirme en fazla 60 saniyelik kırpılmış klipte yapılabilir'); return; }
  const b = busy('Ters çevriliyor…');
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = m.url;
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j(new Error('Video açılamadı')); });
    const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * k / 2) * 2; cv.height = Math.round(v.videoHeight * k / 2) * 2;
    const x = cv.getContext('2d');
    const fps = 30, n = Math.max(1, Math.round(len * fps));
    const frames = [];
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.max(c.in, c.out - (i + 0.5) / fps);
      await new Promise((r) => { v.onseeked = r; });
      x.drawImage(v, 0, 0, cv.width, cv.height);
      frames.push(await createImageBitmap(cv));
      if (i % 10 === 0) b.set(`Kareler okunuyor… %${Math.round((i / n) * 70)}`);
    }
    // ses: ters çevrilmiş AudioBuffer
    let audioBuf = null;
    try {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const dec = await new OAC(2, 48000, 48000).decodeAudioData(await m.blob.arrayBuffer());
      const s0 = Math.floor(c.in * dec.sampleRate), s1 = Math.min(dec.length, Math.floor(c.out * dec.sampleRate));
      const ac0 = new OAC(dec.numberOfChannels, Math.max(1, s1 - s0), dec.sampleRate);
      audioBuf = ac0.createBuffer(dec.numberOfChannels, Math.max(1, s1 - s0), dec.sampleRate);
      for (let ch = 0; ch < dec.numberOfChannels; ch++) { const src = dec.getChannelData(ch).subarray(s0, s1); const dst = audioBuf.getChannelData(ch); for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i]; }
    } catch (_) { audioBuf = null; }
    // kaydet
    const stream = cv.captureStream(0);
    const track = stream.getVideoTracks()[0];
    let ac = null;
    if (audioBuf) {
      ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: audioBuf.sampleRate });
      const dest = ac.createMediaStreamDestination();
      const srcN = ac.createBufferSource(); srcN.buffer = audioBuf; srcN.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      ac._src = srcN;
    }
    const mime = Engine.pickMime() || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((r) => { rec.onstop = r; });
    rec.start(200);
    if (ac) ac._src.start();
    const t0 = performance.now();
    for (let i = 0; i < frames.length; i++) {
      const due = t0 + (i * 1000) / fps;
      const wait = due - performance.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      x.drawImage(frames[i], 0, 0); track.requestFrame && track.requestFrame();
      if (i % 10 === 0) b.set(`Kaydediliyor… %${70 + Math.round((i / frames.length) * 30)}`);
    }
    await new Promise((r) => setTimeout(r, 200));
    rec.stop(); await done;
    if (ac) ac.close();
    frames.forEach((f) => f.close && f.close());
    const type = (mime || 'video/webm').split(';')[0];
    let rb = new Blob(chunks, { type });
    if (type.includes('webm')) { const { fixWebmDuration } = await import('./webmfix.js'); rb = await fixWebmDuration(rb, len * 1000); }
    const file = new File([rb], `${(m.name || 'klip').replace(/\.\w+$/, '')}_ters.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type });
    const recs = await importFiles([file]);
    if (!recs[0]) throw new Error('Kaydedilemedi');
    c.mediaId = recs[0].id; c.in = 0; c.out = recs[0].duration || len; c.kf = {}; c.reversed = !c.reversed;
    commit();
    toast('Klip ters çevrildi');
  } catch (e) { toast(e.message || 'Ters çevrilemedi', 4000); } finally { b.close(); }
}

const PROJECT_VERSION = 4; // v1.5: altyazı şablonları, keyframe şeridi
function migrate(P) {
  // eski projeleri yeni sürüme taşı
  P.v = P.v || 1;
  P.layers.forEach((l) => { if (l.sc == null) l.sc = 1; if (!l.kf) l.kf = {}; });
  P.clips.forEach((c) => { if (!c.kf) c.kf = {}; });
  if (P.subs && P.subs.burn == null) P.subs.burn = true;
  P.v = PROJECT_VERSION;
}

function freezeFrame() {
  const o = selected();
  const P = app.P;
  if (!o || o.type !== 'video' || o.freeze) return;
  const L = layoutClips(P.clips).find((x) => x.clip === o);
  const local = app.engine.t - L.start;
  if (local < 0 || local > L.len) { toast('Dondurmak için oynatıcıyı klibin üzerine getir'); return; }
  const at = Math.min(o.out - 0.04, o.in + local * (o.speed || 1));
  const fr = { ...clone(o), id: uid(), freeze: true, freezeAt: at, dur: 2, trans: { type: 'none', dur: 0.5 }, kf: {} };
  const i = P.clips.indexOf(o);
  if (local > 0.1 && local < L.len - 0.1) {
    const rest = clone(o); rest.id = uid(); rest.trans = { type: 'none', dur: 0.5 };
    o.out = at; rest.in = at;
    splitKeys(o, rest, local);
    P.clips.splice(i + 1, 0, fr, rest);
  } else if (local <= 0.1) P.clips.splice(i, 0, fr);
  else P.clips.splice(i + 1, 0, fr);
  commit();
  select({ type: 'clip', id: fr.id });
  toast('Kare donduruldu (2 sn)');
}

async function addSfx(id, name) {
  // v1.5: önce ses fabrikası kütüphanesi (sfx/*.ogg); yoksa uygulama içi sentez (eski kimlikler)
  const { SFX_MAP } = await import('./sfx.js');
  const lib = SFX_MAP[id] || id;
  try {
    let mid = `sfxlib-${lib}`;
    if (!app.engine.media.has(mid)) {
      let rec = await store.getMedia(mid).catch(() => null);
      if (!rec) {
        let blob = null;
        try { const r = await fetch(`sfx/${lib}.ogg`); if (r.ok) blob = await r.blob(); } catch (_) { /* yok */ }
        if (blob) {
          const dur = await new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 1); a.onerror = () => res(1); a.src = URL.createObjectURL(blob); });
          rec = { id: mid, kind: 'audio', name: `SFX · ${name}`, blob, duration: dur, w: 0, h: 0, thumb: null };
        } else {
          mid = `sfx-${id}`;
          rec = await store.getMedia(mid).catch(() => null);
          if (!rec) { const r = await renderSfx(id); rec = { id: mid, kind: 'audio', name: `SFX · ${name}`, blob: r.blob, duration: r.duration, w: 0, h: 0, thumb: null }; }
        }
        try { await store.putMedia(rec); } catch (_) { /* yoksay */ }
      }
      if (!app.engine.media.has(rec.id)) registerMedia(rec);
      mid = rec.id;
    }
    const m = app.engine.media.get(mid);
    const a = { ...newAudio(m, app.engine.t), sfx: true };
    app.P.audio.push(a);
    commit();
    toast(`${name} eklendi`);
  } catch (e) { toast(`Eklenemedi: ${e.message || e}`); }
}

// ---------- kişisel stiller ----------
function getStyles(kind) {
  try { return JSON.parse(lsGet('alpicut.styles', '[]')).filter((x) => !kind || x.kind === kind); } catch (_) { return []; }
}
function putStyles(list) { lsSet('alpicut.styles', JSON.stringify(list)); }
function saveStyle(kind, obj) {
  const name = prompt('Stil adı', kind === 'text' ? ((obj.text || '').split('\n')[0].replace(/\*/g, '').slice(0, 24) || 'Yazı stilim') : 'Altyazı stilim');
  if (name == null) return;
  const data = clone(obj);
  ['id', 'start', 'end', 'kf', 'mediaId'].forEach((k) => delete data[k]);
  const list = getStyles();
  list.unshift({ id: uid(), kind, name: name.trim() || 'Stilim', data });
  putStyles(list);
  toast('Stil kaydedildi');
}
function deleteStyle(id) { putStyles(getStyles().filter((x) => x.id !== id)); }
async function exportStyles() {
  const blob = new Blob([JSON.stringify({ app: 'alpicut', type: 'styles', v: 1, styles: getStyles() }, null, 1)], { type: 'application/json' });
  const { saveVideo } = await import('./storage.js');
  const r = await saveVideo(blob, 'alpicut-stillerim.json', { share: true });
  toast(r.where ? `${r.where} klasörüne kaydedildi` : 'Kaydedildi');
}
async function importStyles() {
  const files = await pickFiles('', false);
  if (!files.length) return;
  try {
    const d = JSON.parse(await files[0].text());
    if (d.app !== 'alpicut' || !Array.isArray(d.styles)) throw new Error('Alpicut stil dosyası değil');
    const list = getStyles();
    const ids = new Set(list.map((x) => x.id));
    let n = 0;
    d.styles.forEach((st) => { if (st && st.kind && st.data && !ids.has(st.id)) { list.push(st); n++; } });
    putStyles(list);
    toast(`${n} stil eklendi`);
    refreshSheet();
  } catch (e) { toast(`Yüklenemedi: ${e.message || e}`); }
}

async function importSRT() {
  const files = await pickFiles('', false);
  if (!files.length) return;
  try {
    const text = await files[0].text();
    const cues = parseSRT(text);
    if (!cues.length) { toast('Bu dosyada altyazı bulunamadı'); return; }
    const P = app.P;
    if (!P.subs) P.subs = clone(SUB_BASE);
    P.subs.cues = cues;
    P.subs.offset = 0;
    commit();
    toast(`${cues.length} altyazı satırı eklendi`);
    select({ type: 'subs', id: 'subs' }, 'Stil');
  } catch (e) { toast(`SRT okunamadı: ${e.message || e}`); }
}

// ---------- uygulama arayüzü (diğer modüller için) ----------
let tlSoon = null;
Object.assign(app, {
  change(final) {
    app.engine.sync(app.engine.t);
    app.engine.requestDraw();
    if (final) commit();
  },
  commit,
  refreshTimeline: () => renderTimeline(),
  refreshTimelineSoon: () => { clearTimeout(tlSoon); tlSoon = setTimeout(renderTimeline, 400); },
  updateTime,
  syncScroll: () => syncScroll(app.engine.t, true),
  play() { app.stopAt = null; app.engine.play(); updateTime(); },
  pause() { app.stopAt = null; app.engine.pause(); updateTime(); },
  previewRange(a, b) {
    app.engine.seek(Math.max(0, a));
    app.engine.play();
    app.stopAt = b;
    updateTime();
  },
  select, deselect, restoreTo, undo, redo, aiTarget, aiReframe, itemMenu, undoToast, writeK,
  openInspector: (tab) => openInspector(tab),
  addMedia, addLayer, splitSel, dupSel, delSel, moveClip, layerOrder, importSRT, freezeFrame, addSfx,
  beginEdit, endEdit, cutSourceRanges, pickColor, relinkMedia, pickFiles, importFiles, renderToolbar,
  registerMedia, cutTimelineRanges, studioClean, toggleMulti, ungroup, reverseClip, openSilenceFor: (o) => openSilence(o, app.sel?.type === 'clip' ? 'clip' : 'audio'),
  getStyles, saveStyle, deleteStyle, exportStyles, importStyles,
  layout: () => layoutClips(app.P.clips),
  fitStage, openCover, renderTimeline, newProject, registerMedia, openAssets, makeClip, newAudio: (m, t) => newAudio(m, t), ratioWH: () => RATIOS[app.P?.ratio || "9:16"],
});

init();
window.__alpicut = app; // hata ayıklama için
window.__toast = toast;
