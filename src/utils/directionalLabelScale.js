import { clamp } from '@/utils/general.js';

export const MIN_DIRECTIONAL_LABEL_SCALE = 0.8;
export const MAX_DIRECTIONAL_LABEL_SCALE = 3.0;
export const DEFAULT_DIRECTIONAL_LABEL_SCALE = 1.0;
const DEFAULT_DIRECTIONAL_EFFECTIVE_FONT_MIN = 6;
const DEFAULT_DIRECTIONAL_EFFECTIVE_FONT_MAX = 40;

function normalizeFontBound(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeDirectionalLabelScale(
  value,
  fallback = DEFAULT_DIRECTIONAL_LABEL_SCALE
) {
  const safeFallback = clamp(
    normalizeFontBound(fallback, DEFAULT_DIRECTIONAL_LABEL_SCALE),
    MIN_DIRECTIONAL_LABEL_SCALE,
    MAX_DIRECTIONAL_LABEL_SCALE
  );
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return safeFallback;
  return clamp(numeric, MIN_DIRECTIONAL_LABEL_SCALE, MAX_DIRECTIONAL_LABEL_SCALE);
}

export function resolveDirectionalLabelFontSize(baseSize, options = {}) {
  const {
    fallbackSize = 11,
    scale = DEFAULT_DIRECTIONAL_LABEL_SCALE,
    min = DEFAULT_DIRECTIONAL_EFFECTIVE_FONT_MIN,
    max = DEFAULT_DIRECTIONAL_EFFECTIVE_FONT_MAX
  } = options;

  const safeBase = normalizeFontBound(baseSize, normalizeFontBound(fallbackSize, 11));
  const safeScale = normalizeDirectionalLabelScale(scale, DEFAULT_DIRECTIONAL_LABEL_SCALE);
  const safeMin = normalizeFontBound(min, DEFAULT_DIRECTIONAL_EFFECTIVE_FONT_MIN);
  const safeMax = Math.max(
    safeMin,
    normalizeFontBound(max, DEFAULT_DIRECTIONAL_EFFECTIVE_FONT_MAX)
  );

  return clamp(safeBase * safeScale, safeMin, safeMax);
}
