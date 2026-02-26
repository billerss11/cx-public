import { DEFAULT_CEMENT_COLOR, DEFAULT_CEMENT_PLUG_COLOR } from '@/constants/index.js';
import { getHatchStyleKey, sanitizePatternId } from '@/app/rendering.js';

const VERTICAL_CEMENT_PATTERN_PREFIX = 'declarative-vertical-cement';
const VERTICAL_PLUG_PATTERN_PREFIX = 'declarative-vertical-plug';
const VERTICAL_FLUID_PATTERN_PREFIX = 'declarative-vertical-fluid';

export function buildVerticalCementPatternId(styleKey, color) {
  return `${VERTICAL_CEMENT_PATTERN_PREFIX}-${styleKey}-${sanitizePatternId(color)}`;
}

export function buildVerticalPlugPatternId(index, styleKey, color) {
  const token = Number.isInteger(index) ? index : 'x';
  return `${VERTICAL_PLUG_PATTERN_PREFIX}-${token}-${styleKey}-${sanitizePatternId(color)}`;
}

export function buildVerticalFluidPatternId(index, styleKey, color) {
  const token = Number.isInteger(index) ? index : 'x';
  return `${VERTICAL_FLUID_PATTERN_PREFIX}-${token}-${styleKey}-${sanitizePatternId(color)}`;
}

function resolvePlugBaseColor(layer, plugs = []) {
  const sourceIndexRaw = Number(layer?.source?.index);
  const sourceIndex = Number.isInteger(sourceIndexRaw) ? sourceIndexRaw : null;
  const plugRow = Number.isInteger(sourceIndex) ? plugs[sourceIndex] : null;
  return String(plugRow?.color || layer?.color || DEFAULT_CEMENT_PLUG_COLOR);
}

function resolveFluidBaseColor(layer, fluids = []) {
  const sourceIndexRaw = Number(layer?.source?.index);
  const sourceIndex = Number.isInteger(sourceIndexRaw) ? sourceIndexRaw : null;
  const fluidRow = Number.isInteger(sourceIndex) ? fluids[sourceIndex] : null;
  return String(fluidRow?.color || layer?.color || 'var(--color-default-hatch)');
}

export function resolveVerticalCementPattern(config = {}) {
  const showCement = config?.showCement !== false;
  const hatchEnabled = config?.cementHatchEnabled === true;
  if (!showCement || !hatchEnabled) return null;

  const styleKey = getHatchStyleKey(config?.cementHatchStyle);
  if (styleKey === 'none') return null;

  const color = String(config?.cementColor || DEFAULT_CEMENT_COLOR);
  return {
    id: buildVerticalCementPatternId(styleKey, color),
    styleKey,
    color
  };
}

export function resolveVerticalPlugPattern(layer, plugs = []) {
  if (layer?.material !== 'plug') return null;

  const sourceIndexRaw = Number(layer?.source?.index);
  const sourceIndex = Number.isInteger(sourceIndexRaw) ? sourceIndexRaw : null;
  const plugRow = Number.isInteger(sourceIndex) ? plugs[sourceIndex] : null;
  const hatchStyle = plugRow?.hatchStyle ?? layer?.hatchStyle ?? 'none';
  const styleKey = getHatchStyleKey(hatchStyle);
  if (styleKey === 'none') return null;

  const color = resolvePlugBaseColor(layer, plugs);
  return {
    id: buildVerticalPlugPatternId(sourceIndex, styleKey, color),
    styleKey,
    color
  };
}

export function resolveVerticalPlugFill(layer, plugs = []) {
  const pattern = resolveVerticalPlugPattern(layer, plugs);
  if (pattern) {
    return `url(#${pattern.id})`;
  }
  return resolvePlugBaseColor(layer, plugs);
}

export function resolveVerticalFluidPattern(layer, fluids = []) {
  if (layer?.material !== 'fluid') return null;

  const sourceIndexRaw = Number(layer?.source?.index);
  const sourceIndex = Number.isInteger(sourceIndexRaw) ? sourceIndexRaw : null;
  const fluidRow = Number.isInteger(sourceIndex) ? fluids[sourceIndex] : null;
  const hatchStyle = fluidRow?.hatchStyle ?? layer?.hatchStyle ?? 'none';
  const styleKey = getHatchStyleKey(hatchStyle);
  if (styleKey === 'none') return null;

  const color = resolveFluidBaseColor(layer, fluids);
  return {
    id: buildVerticalFluidPatternId(sourceIndex, styleKey, color),
    styleKey,
    color
  };
}

export function resolveVerticalFluidFill(layer, fluids = []) {
  const pattern = resolveVerticalFluidPattern(layer, fluids);
  if (pattern) {
    return `url(#${pattern.id})`;
  }
  return resolveFluidBaseColor(layer, fluids);
}

export function collectVerticalHatchPatterns(slices = [], plugs = [], fluids = [], config = {}) {
  const patternMap = new Map();
  const cementPattern = resolveVerticalCementPattern(config);
  if (cementPattern) {
    patternMap.set(cementPattern.id, cementPattern);
  }

  const safeSlices = Array.isArray(slices) ? slices : [];
  safeSlices.forEach((slice) => {
    const stack = Array.isArray(slice?.stack) ? slice.stack : [];
    stack.forEach((layer) => {
      const plugPattern = resolveVerticalPlugPattern(layer, plugs);
      if (plugPattern && !patternMap.has(plugPattern.id)) {
        patternMap.set(plugPattern.id, plugPattern);
      }

      const fluidPattern = resolveVerticalFluidPattern(layer, fluids);
      if (fluidPattern && !patternMap.has(fluidPattern.id)) {
        patternMap.set(fluidPattern.id, fluidPattern);
      }
    });
  });

  return Array.from(patternMap.values());
}
