// Alpicut v1.8 — yeni motion modüllerini tek yerde toplar: geri sayım, nostalji, düğün & nişan, sosyal medya
import { CD_DRAW, CD_FIELDS, CD_META, CD_TEMPLATES } from './motion-countdown.js';
import { NO_DRAW, NO_FIELDS, NO_META, NO_TEMPLATES, NO_FULL } from './motion-nostalgia.js';
import { WD_DRAW, WD_FIELDS, WD_META, WD_TEMPLATES, WD_FULL } from './motion-wedding.js';
import { SM_DRAW, SM_FIELDS, SM_META, SM_TEMPLATES, SM_FULL } from './motion-social.js';

const DRAW = { ...CD_DRAW, ...NO_DRAW, ...WD_DRAW, ...SM_DRAW };
export const FIELDS4 = { ...CD_FIELDS, ...NO_FIELDS, ...WD_FIELDS, ...SM_FIELDS };
export const META4 = { ...CD_META, ...NO_META, ...WD_META, ...SM_META };
export const TEMPLATES4 = [...SM_TEMPLATES, ...CD_TEMPLATES, ...NO_TEMPLATES, ...WD_TEMPLATES];
// tam ekran (kart değil, kareyi kaplayan) türler — önizleme ölçeği buna göre
export const FULL4 = new Set([...NO_FULL, ...WD_FULL, ...SM_FULL]);

export function drawMotion4(ctx, L, lt, env) {
  const fn = DRAW[L.type];
  if (!fn) return null;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  return fn(ctx, L, lt, env) || { w: 600, h: 200 };
}
