const DIRECTIONAL_MIN_FIGURE_HEIGHT = 520;
const DIRECTIONAL_MIN_SVG_WIDTH = 600;
const DIRECTIONAL_MAX_SVG_WIDTH = 12000;
const DIRECTIONAL_BASE_SVG_WIDTH = 1000;
const DIRECTIONAL_MARGIN = Object.freeze({
  top: 60,
  right: 120,
  bottom: 80,
  left: 120
});

function clampPositive(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function resolvePlotHeightFromFigureHeight(figHeight) {
  return Math.max(10, clampPositive(figHeight, DIRECTIONAL_MIN_FIGURE_HEIGHT) - DIRECTIONAL_MARGIN.top - DIRECTIONAL_MARGIN.bottom);
}

function resolveDataAspectRatio(dataWidth, dataHeight) {
  const safeWidth = Math.max(1, Math.abs(Number(dataWidth) || 0));
  const safeHeight = Math.max(1, Math.abs(Number(dataHeight) || 0));
  return safeWidth / safeHeight;
}

function clampSvgWidth(svgWidth) {
  return Math.max(DIRECTIONAL_MIN_SVG_WIDTH, Math.min(DIRECTIONAL_MAX_SVG_WIDTH, Math.round(svgWidth)));
}

function clampFigureHeight(figHeight) {
  return Math.max(DIRECTIONAL_MIN_FIGURE_HEIGHT, Math.round(figHeight));
}

export function resolveDirectionalSvgWidthFromHeight(figHeight, dataAspectRatio) {
  const plotHeight = resolvePlotHeightFromFigureHeight(figHeight);
  const aspectRatio = resolveDataAspectRatio(dataAspectRatio, 1);
  const unclampedPlotWidth = plotHeight * aspectRatio;
  const maxPlotWidth = Math.max(10, DIRECTIONAL_MAX_SVG_WIDTH - DIRECTIONAL_MARGIN.left - DIRECTIONAL_MARGIN.right);
  const plotWidth = Math.min(unclampedPlotWidth, maxPlotWidth);
  return clampSvgWidth(plotWidth + DIRECTIONAL_MARGIN.left + DIRECTIONAL_MARGIN.right);
}

export function resolveDirectionalFigureHeightFromWidth(svgWidth, dataAspectRatio) {
  const safeSvgWidth = clampSvgWidth(svgWidth);
  const aspectRatio = resolveDataAspectRatio(dataAspectRatio, 1);
  const plotWidth = Math.max(10, safeSvgWidth - DIRECTIONAL_MARGIN.left - DIRECTIONAL_MARGIN.right);
  const plotHeight = plotWidth / aspectRatio;
  return clampFigureHeight(plotHeight + DIRECTIONAL_MARGIN.top + DIRECTIONAL_MARGIN.bottom);
}

export function resolveDirectionalSvgWidthFromMultiplier(multiplier) {
  return clampSvgWidth(clampPositive(multiplier, 1) * DIRECTIONAL_BASE_SVG_WIDTH);
}

export function resolveDirectionalWidthMultiplierFromSvgWidth(svgWidth) {
  return clampSvgWidth(svgWidth) / DIRECTIONAL_BASE_SVG_WIDTH;
}

export {
  DIRECTIONAL_BASE_SVG_WIDTH,
  DIRECTIONAL_MARGIN,
  DIRECTIONAL_MAX_SVG_WIDTH,
  DIRECTIONAL_MIN_FIGURE_HEIGHT,
  DIRECTIONAL_MIN_SVG_WIDTH
};
