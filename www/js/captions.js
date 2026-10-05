// Alpicut — altyazı şablonları (geçici; v1.5'te genişletiliyor)
import { app } from './state.js';
export function openCaptionStyles() { if (app.P?.subs?.cues?.length) app.select({ type: 'subs', id: 'subs' }, 'Stil'); }
