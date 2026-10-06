// Alpicut — tema sistemi: hazır temalar (Obsidyen mor, Altın, Gümüş, Gece, Beyaz) + kendi vurgu rengin
import { h } from './state.js';
import { lsGet, lsSet } from './storage.js';

export const THEMES = {
  amethyst: { name: 'Ametist', desc: 'Sıcak grafit, yumuşak mor (varsayılan)', scheme: 'dark',
    bg: '#0E0D11', bg2: '#131217', surface: '#1A1920', surface2: '#222129', surface3: '#2D2B35', line: '#34313E', line2: '#1E1D24',
    primary: '#9D8CF2', primary2: '#B9ACF7', primary3: '#DCD5FB', accent: '#E9C7A1', text: '#F3F1F5', text2: '#D2CED9', muted: '#8F8A99', onPrimary: '#16112B',
    grad: 'linear-gradient(160deg, #B3A4F8 0%, #9D8CF2 50%, #7E6AE0 100%)', preview: '#08070A' },
  lilac: { name: 'Lila gün', desc: 'Kağıt beyazı zemin, mor vurgu — aydınlık', scheme: 'light',
    bg: '#F6F4F1', bg2: '#EFECE7', surface: '#FFFFFF', surface2: '#F3F0F6', surface3: '#E7E2EE', line: '#E0DAE6', line2: '#ECE8EF',
    primary: '#6D5BD8', primary2: '#5A48C4', primary3: '#4535A8', accent: '#C2603D', text: '#1B1722', text2: '#3A3443', muted: '#756E80', onPrimary: '#FFFFFF',
    grad: 'linear-gradient(160deg, #8C7CEB 0%, #6D5BD8 55%, #5444BD 100%)', preview: '#1A1820' },
  obsidian: { name: 'Obsidyen', desc: 'Grafit siyah, canlı mor', scheme: 'dark',
    bg: '#09090C', bg2: '#0E0D12', surface: '#15141B', surface2: '#1C1B24', surface3: '#272532', line: '#2D2B39', line2: '#1A1921',
    primary: '#8467F4', primary2: '#A792FF', primary3: '#D3C9FF', accent: '#C4B5FD', text: '#F2F1F6', text2: '#CFCCDA', muted: '#8C889C', onPrimary: '#FFFFFF',
    grad: 'linear-gradient(160deg, #9A82FF 0%, #8467F4 55%, #6A4FDB 100%)', preview: '#050507' },
  gold: { name: 'Altın', desc: 'Siyah üzerine altın — lüks', scheme: 'dark',
    bg: '#0A0907', bg2: '#0F0D0A', surface: '#16140F', surface2: '#1F1C15', surface3: '#2B271D', line: '#3A3326', line2: '#1F1B14',
    primary: '#D4AF37', primary2: '#E6C766', primary3: '#F3DFA2', accent: '#F59E0B', text: '#F8F4E9', text2: '#E6DCC4', muted: '#A99F88', onPrimary: '#1A1406',
    grad: 'linear-gradient(135deg, #F6DE8D 0%, #D4AF37 50%, #9C7418 100%)', preview: '#050403' },
  silver: { name: 'Gümüş', desc: 'Grafit ve gümüş — sade', scheme: 'dark',
    bg: '#0C0D0F', bg2: '#111316', surface: '#17191D', surface2: '#202328', surface3: '#2B2F35', line: '#363B42', line2: '#1D2024',
    primary: '#C3C9D2', primary2: '#DDE2E8', primary3: '#EEF1F4', accent: '#8AB4F8', text: '#F3F5F7', text2: '#D5DAE0', muted: '#959CA6', onPrimary: '#111316',
    grad: 'linear-gradient(135deg, #F4F6F8 0%, #C3C9D2 50%, #8A919B 100%)', preview: '#060708' },
  night: { name: 'Gece', desc: 'Saf siyah, mavi vurgu (AMOLED)', scheme: 'dark',
    bg: '#000000', bg2: '#050506', surface: '#0E0F11', surface2: '#17181B', surface3: '#222428', line: '#2A2C31', line2: '#141518',
    primary: '#3B82F6', primary2: '#60A5FA', primary3: '#BFDBFE', accent: '#22D3EE', text: '#F5F7FA', text2: '#D6DBE3', muted: '#8E95A1', onPrimary: '#FFFFFF',
    grad: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 50%, #1D4ED8 100%)', preview: '#000000' },
  white: { name: 'Beyaz', desc: 'Aydınlık arayüz', scheme: 'light',
    bg: '#F4F4F7', bg2: '#ECECF1', surface: '#FFFFFF', surface2: '#F1F0F5', surface3: '#E4E2EC', line: '#D9D6E3', line2: '#E9E7EF',
    primary: '#6D28D9', primary2: '#7C3AED', primary3: '#5B21B6', accent: '#DB2777', text: '#17141F', text2: '#2E2A3B', muted: '#6E6880', onPrimary: '#FFFFFF',
    grad: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #5B21B6 100%)', preview: '#1A1820' },
  ruby: { name: 'Yakut', desc: 'Koyu, kırmızı vurgu — spor', scheme: 'dark',
    bg: '#0B0909', bg2: '#110D0E', surface: '#181314', surface2: '#221B1C', surface3: '#2F2526', line: '#3A2D2F', line2: '#1E1718',
    primary: '#E11D48', primary2: '#FB7185', primary3: '#FECDD3', accent: '#F59E0B', text: '#FAF3F4', text2: '#E7D7D9', muted: '#A8969A', onPrimary: '#FFFFFF',
    grad: 'linear-gradient(135deg, #FB7185 0%, #E11D48 50%, #9F1239 100%)', preview: '#050404' },
  emerald: { name: 'Zümrüt', desc: 'Koyu, yeşil vurgu — saha', scheme: 'dark',
    bg: '#070A09', bg2: '#0B0F0D', surface: '#121815', surface2: '#1A221E', surface3: '#243029', line: '#2C3A33', line2: '#151C18',
    primary: '#10B981', primary2: '#34D399', primary3: '#A7F3D0', accent: '#FACC15', text: '#F1F8F4', text2: '#D3E5DB', muted: '#8EA399', onPrimary: '#04140D',
    grad: 'linear-gradient(135deg, #6EE7B7 0%, #10B981 50%, #047857 100%)', preview: '#030504' },
};

function hexToRgb(hx) { const n = parseInt(hx.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`; }
function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
function lum(hx) { const [r, g, b] = hexToRgb(hx).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

export function currentTheme() {
  // v1.6: eski varsayılan (Obsidyen) bir kez yeni varsayılana (Ametist) taşınır
  if (!lsGet('alpicut.v16theme', '')) { lsSet('alpicut.v16theme', '1'); if (lsGet('alpicut.theme', 'obsidian') === 'obsidian') lsSet('alpicut.theme', 'amethyst'); }
  return { id: lsGet('alpicut.theme', 'amethyst'), accent: lsGet('alpicut.accent', '') };
}

export function applyTheme(id = currentTheme().id, accent = currentTheme().accent) {
  const T = { ...(THEMES[id] || THEMES.amethyst) };
  if (accent && /^#[0-9a-f]{6}$/i.test(accent)) {
    const light = T.scheme === 'light';
    T.primary = accent;
    T.primary2 = light ? mix(accent, '#000000', 0.12) : mix(accent, '#FFFFFF', 0.25);
    T.primary3 = light ? mix(accent, '#000000', 0.3) : mix(accent, '#FFFFFF', 0.6);
    T.onPrimary = lum(accent) > 0.45 ? '#111111' : '#FFFFFF';
    T.grad = `linear-gradient(135deg, ${mix(accent, '#FFFFFF', 0.3)} 0%, ${accent} 50%, ${mix(accent, '#000000', 0.3)} 100%)`;
  }
  const [pr, pg, pb] = hexToRgb(T.primary);
  const r = document.documentElement.style;
  const set = (k, v) => r.setProperty(k, v);
  set('--bg', T.bg); set('--bg-2', T.bg2); set('--surface', T.surface); set('--surface-2', T.surface2); set('--surface-3', T.surface3);
  set('--line', T.line); set('--line-2', T.line2); set('--primary', T.primary); set('--primary-2', T.primary2); set('--primary-3', T.primary3);
  set('--accent', T.accent); set('--text', T.text); set('--text-2', T.text2); set('--muted', T.muted); set('--on-primary', T.onPrimary);
  set('--grad', T.grad); set('--preview-bg', T.preview);
  set('--glow', `rgba(${pr},${pg},${pb},.35)`); set('--tint', `rgba(${pr},${pg},${pb},.14)`);
  set('--scrim', T.scheme === 'light' ? 'rgba(255,255,255,.86)' : `${T.surface}e6`);
  document.documentElement.dataset.scheme = T.scheme;
  document.documentElement.style.colorScheme = T.scheme;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', T.bg);
  window.__themeColor = T.primary;
  window.dispatchEvent(new CustomEvent('alpicut-theme'));
  try { window.__alpicut?.engine?.requestDraw(); } catch (_) { /* yoksay */ }
}

export function setTheme(id, accent) {
  lsSet('alpicut.theme', id);
  lsSet('alpicut.accent', accent || '');
  applyTheme(id, accent || '');
}

const ACCENTS = ['', '#9D8CF2', '#8B5CF6', '#D4AF37', '#C3C9D2', '#3B82F6', '#22D3EE', '#10B981', '#84CC16', '#FACC15', '#F97316', '#E11D48', '#EC4899', '#A855F7', '#FFFFFF'];

// Tema seçici paneli içeriği
export function themePickerBody(body, refresh) {
  const cur = currentTheme();
  body.append(h('p', { class: 'hint' }, 'Arayüz rengini seç. Videonun kendisi etkilenmez; yalnızca uygulamanın görünümü değişir.'));
  const grid = h('div', { class: 'theme-grid' });
  Object.entries(THEMES).forEach(([id, T]) => {
    const sw = h('div', { class: 'theme-sw', style: { background: T.bg } },
      h('i', { style: { background: T.surface2 } }), h('i', { style: { background: T.grad } }), h('i', { style: { background: T.text } }));
    grid.append(h('button', { class: `theme-card${cur.id === id ? ' on' : ''}`, onclick: () => { setTheme(id, ''); refresh(); } }, sw, h('b', {}, T.name), h('small', {}, T.desc)));
  });
  body.append(grid);
  body.append(h('div', { class: 'sub-title' }, 'Vurgu rengi'));
  const row = h('div', { class: 'swatches accent-row' });
  ACCENTS.forEach((c) => row.append(h('button', { class: (cur.accent || '') === c ? 'on' : '', style: { background: c || 'conic-gradient(#8B5CF6, #D4AF37, #10B981, #3B82F6, #E11D48, #8B5CF6)' }, title: c || 'Temanın kendi rengi', onclick: () => { setTheme(cur.id, c); refresh(); } })));
  const pick = h('input', { type: 'color', value: cur.accent || THEMES[cur.id]?.primary || '#8B5CF6', title: 'Özel renk' });
  pick.addEventListener('change', () => { setTheme(cur.id, pick.value); refresh(); });
  row.append(pick);
  body.append(row);
}

applyTheme();
