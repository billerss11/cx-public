import { resolvePipeWallGeometry } from '@/utils/pipeWallGeometry.js';

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

const VISUAL_SIZING_DEFAULTS = Object.freeze({
  minSteelThicknessPx: 3,
  minAnnulusGapPx: 4,
  minCoreGapPx: 6,
  minMaxRadiusPx: 36,
  maxMaxRadiusPx: 84,
  baseMaxRadiusPx: 28,
  perBoundaryRadiusPx: 7,
  formationThicknessPx: 18,
  leftAxisGutterPx: 52,
  horizontalPaddingPx: 8,
  verticalPaddingPx: 6
});

const DIRECTIONAL_VISUAL_SIZING_EPSILON = 1e-6;

function clampPositive(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function toFinitePositive(value, fallback = null) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function roundRadiusKey(value) {
  return Number(value).toFixed(6);
}

function normalizePipeTypeToken(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'tubing') return 'tubing';
  if (token === 'drillstring' || token === 'drill-string' || token === 'drill_string') return 'drillString';
  return 'casing';
}

function normalizePipeIndex(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

export function resolveDirectionalPipeKey(pipeType, rowIndex) {
  const normalizedIndex = normalizePipeIndex(rowIndex);
  if (!Number.isInteger(normalizedIndex)) return null;
  return `${normalizePipeTypeToken(pipeType)}:${normalizedIndex}`;
}

function resolveLayerGapFloorPx(layer, options) {
  const material = String(layer?.material ?? '').trim().toLowerCase();
  if (material === 'steel') return clampPositive(options.minSteelThicknessPx, VISUAL_SIZING_DEFAULTS.minSteelThicknessPx);
  if (material === 'wellbore' || material === 'plug') return clampPositive(options.minCoreGapPx, VISUAL_SIZING_DEFAULTS.minCoreGapPx);
  return clampPositive(options.minAnnulusGapPx, VISUAL_SIZING_DEFAULTS.minAnnulusGapPx);
}

function resolveTargetMaxRadiusPx(boundaryCount, options) {
  const base = clampPositive(options.baseMaxRadiusPx, VISUAL_SIZING_DEFAULTS.baseMaxRadiusPx);
  const step = clampPositive(options.perBoundaryRadiusPx, VISUAL_SIZING_DEFAULTS.perBoundaryRadiusPx);
  const min = clampPositive(options.minMaxRadiusPx, VISUAL_SIZING_DEFAULTS.minMaxRadiusPx);
  const max = clampPositive(options.maxMaxRadiusPx, VISUAL_SIZING_DEFAULTS.maxMaxRadiusPx);
  return clampNumber(base + (Math.max(1, boundaryCount) * step), min, max);
}

function collectDirectionalSizingLayers(intervals = []) {
  const layers = [];
  const radiusValues = new Set([roundRadiusKey(0)]);

  (Array.isArray(intervals) ? intervals : []).forEach((interval) => {
    const stack = Array.isArray(interval?.stack) ? interval.stack : [];
    stack.forEach((layer) => {
      const innerRadius = Number(layer?.innerRadius);
      const outerRadius = Number(layer?.outerRadius);
      if (!Number.isFinite(innerRadius) || !Number.isFinite(outerRadius) || outerRadius <= innerRadius + DIRECTIONAL_VISUAL_SIZING_EPSILON) {
        return;
      }

      radiusValues.add(roundRadiusKey(innerRadius));
      radiusValues.add(roundRadiusKey(outerRadius));
      layers.push({
        ...layer,
        innerRadius,
        outerRadius
      });
    });
  });

  const physicalRadii = [...radiusValues]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);

  return { layers, physicalRadii };
}

function buildDirectionalBoundaryMap(physicalRadii = [], layers = [], options = {}) {
  if (physicalRadii.length < 2) {
    return {
      physicalRadii,
      visualRadii: physicalRadii.map(() => 0),
      boundaryRadiiByKey: Object.freeze({ [roundRadiusKey(0)]: 0 }),
      maxVisualRadiusPx: 0
    };
  }

  const indexByKey = new Map(physicalRadii.map((radius, index) => [roundRadiusKey(radius), index]));
  const pairRequirements = Array.from({ length: physicalRadii.length - 1 }, (_, index) => ({
    index,
    minGapPx: 0,
    weight: Math.max(
      physicalRadii[index + 1] - physicalRadii[index],
      DIRECTIONAL_VISUAL_SIZING_EPSILON
    )
  }));

  layers.forEach((layer) => {
    const innerIndex = indexByKey.get(roundRadiusKey(layer.innerRadius));
    const outerIndex = indexByKey.get(roundRadiusKey(layer.outerRadius));
    if (!Number.isInteger(innerIndex) || !Number.isInteger(outerIndex) || outerIndex <= innerIndex) return;

    const floorPx = resolveLayerGapFloorPx(layer, options);
    for (let pairIndex = innerIndex; pairIndex < outerIndex; pairIndex += 1) {
      const pair = pairRequirements[pairIndex];
      pair.minGapPx = Math.max(pair.minGapPx, floorPx);
    }
  });

  const totalFloor = pairRequirements.reduce((sum, pair) => sum + pair.minGapPx, 0);
  const totalWeight = pairRequirements.reduce((sum, pair) => sum + pair.weight, 0);
  const targetMaxRadiusPx = Math.max(
    totalFloor,
    resolveTargetMaxRadiusPx(pairRequirements.length, options)
  );
  const extraSpacePx = Math.max(0, targetMaxRadiusPx - totalFloor);
  const visualRadii = [0];

  pairRequirements.forEach((pair) => {
    const weightedExtra = totalWeight > DIRECTIONAL_VISUAL_SIZING_EPSILON
      ? (extraSpacePx * (pair.weight / totalWeight))
      : 0;
    const gapPx = pair.minGapPx + weightedExtra;
    visualRadii.push((visualRadii[visualRadii.length - 1] || 0) + gapPx);
  });

  const boundaryRadiiByKey = physicalRadii.reduce((result, radius, index) => {
    result[roundRadiusKey(radius)] = visualRadii[index];
    return result;
  }, Object.create(null));

  return {
    physicalRadii,
    visualRadii,
    boundaryRadiiByKey: Object.freeze(boundaryRadiiByKey),
    maxVisualRadiusPx: visualRadii[visualRadii.length - 1] || 0
  };
}

export function buildDirectionalVisualSizing(options = {}) {
  const { layers, physicalRadii } = collectDirectionalSizingLayers(options.intervals);
  const boundaryMap = buildDirectionalBoundaryMap(physicalRadii, layers, options);
  const formationThicknessPx = clampPositive(
    options.formationThicknessPx,
    VISUAL_SIZING_DEFAULTS.formationThicknessPx
  );
  const radiusIndexByKey = new Map(
    boundaryMap.physicalRadii.map((radius, index) => [roundRadiusKey(radius), index])
  );
  const boundaryRadiiByKey = {
    ...boundaryMap.boundaryRadiiByKey
  };
  const pipeGeometryByKey = Object.create(null);

  layers.forEach((layer) => {
    if (String(layer?.material ?? '').trim().toLowerCase() !== 'steel') return;
    const pipeKey = resolveDirectionalPipeKey(
      layer?.source?.pipeType,
      layer?.source?.sourceIndex ?? layer?.source?.index
    );
    if (!pipeKey) return;

    const outerRadius = Number(boundaryRadiiByKey[roundRadiusKey(layer.outerRadius)]);
    if (!Number.isFinite(outerRadius) || outerRadius <= DIRECTIONAL_VISUAL_SIZING_EPSILON) return;

    const physicalWallThickness = Math.max(0, Number(layer.outerRadius) - Number(layer.innerRadius));
    const physicalWallRatio = physicalWallThickness > DIRECTIONAL_VISUAL_SIZING_EPSILON
      ? clampNumber(physicalWallThickness / Math.max(Number(layer.outerRadius), DIRECTIONAL_VISUAL_SIZING_EPSILON), 0, 0.95)
      : 0;
    const wallThickness = clampNumber(
      outerRadius * physicalWallRatio,
      clampPositive(options.minSteelThicknessPx, VISUAL_SIZING_DEFAULTS.minSteelThicknessPx),
      outerRadius
    );
    const desiredInnerRadius = Math.max(0, outerRadius - wallThickness);
    const innerRadiusIndex = radiusIndexByKey.get(roundRadiusKey(layer.innerRadius));
    const previousPhysicalRadius = Number.isInteger(innerRadiusIndex) && innerRadiusIndex > 0
      ? boundaryMap.physicalRadii[innerRadiusIndex - 1]
      : null;
    const previousDisplayedRadius = Number.isFinite(previousPhysicalRadius)
      ? Number(boundaryRadiiByKey[roundRadiusKey(previousPhysicalRadius)])
      : 0;
    const minimumInnerRadius = Number.isFinite(previousPhysicalRadius) && previousPhysicalRadius > DIRECTIONAL_VISUAL_SIZING_EPSILON
      ? previousDisplayedRadius + clampPositive(options.minAnnulusGapPx, VISUAL_SIZING_DEFAULTS.minAnnulusGapPx)
      : 0;
    const innerRadius = Math.min(
      outerRadius,
      Math.max(desiredInnerRadius, minimumInnerRadius)
    );
    boundaryRadiiByKey[roundRadiusKey(layer.innerRadius)] = innerRadius;

    const previous = pipeGeometryByKey[pipeKey];
    if (previous && previous.wallThickness >= wallThickness) return;

    pipeGeometryByKey[pipeKey] = Object.freeze({
      innerRadius,
      outerRadius,
      wallThickness,
      wallCenterRadius: outerRadius - (wallThickness / 2)
    });
  });

  return Object.freeze({
    physicalRadii: Object.freeze([...boundaryMap.physicalRadii]),
    visualRadii: Object.freeze([...boundaryMap.visualRadii]),
    boundaryRadiiByKey: Object.freeze(boundaryRadiiByKey),
    pipeGeometryByKey: Object.freeze(pipeGeometryByKey),
    formationThicknessPx,
    maxVisualRadius: boundaryMap.maxVisualRadiusPx,
    maxVisualRadiusPx: boundaryMap.maxVisualRadiusPx
  });
}

function interpolateDirectionalVisualRadius(physicalRadius, visualSizing, fallbackScale = 1) {
  const radius = Number(physicalRadius);
  if (!Number.isFinite(radius) || radius < 0) return null;

  const boundaryRadiiByKey = visualSizing?.boundaryRadiiByKey;
  if (boundaryRadiiByKey && Object.prototype.hasOwnProperty.call(boundaryRadiiByKey, roundRadiusKey(radius))) {
    return Number(boundaryRadiiByKey[roundRadiusKey(radius)]);
  }

  const physicalRadii = Array.isArray(visualSizing?.physicalRadii) ? visualSizing.physicalRadii : [];
  const visualRadii = Array.isArray(visualSizing?.visualRadii) ? visualSizing.visualRadii : [];
  if (physicalRadii.length >= 2 && visualRadii.length === physicalRadii.length) {
    if (radius <= physicalRadii[0]) {
      return visualRadii[0];
    }

    for (let index = 1; index < physicalRadii.length; index += 1) {
      const leftPhysical = physicalRadii[index - 1];
      const rightPhysical = physicalRadii[index];
      if (radius <= rightPhysical + DIRECTIONAL_VISUAL_SIZING_EPSILON) {
        const leftVisual = visualRadii[index - 1];
        const rightVisual = visualRadii[index];
        const span = Math.max(
          rightPhysical - leftPhysical,
          DIRECTIONAL_VISUAL_SIZING_EPSILON
        );
        const ratio = clampNumber((radius - leftPhysical) / span, 0, 1);
        return leftVisual + ((rightVisual - leftVisual) * ratio);
      }
    }

    const lastIndex = physicalRadii.length - 1;
    const previousIndex = Math.max(0, lastIndex - 1);
    const physicalSpan = Math.max(
      physicalRadii[lastIndex] - physicalRadii[previousIndex],
      DIRECTIONAL_VISUAL_SIZING_EPSILON
    );
    const visualSpan = Math.max(
      visualRadii[lastIndex] - visualRadii[previousIndex],
      DIRECTIONAL_VISUAL_SIZING_EPSILON
    );
    const slope = visualSpan / physicalSpan;
    return visualRadii[lastIndex] + ((radius - physicalRadii[lastIndex]) * slope);
  }

  return radius * clampPositive(fallbackScale, 1);
}

export function resolveDirectionalVisualRadiusForPhysicalRadius(physicalRadius, visualSizing, fallbackScale = 1) {
  return interpolateDirectionalVisualRadius(physicalRadius, visualSizing, fallbackScale);
}

export function resolveDirectionalVisualRadiusForDiameter(diameter, visualSizing, fallbackScale = 1) {
  const safeDiameter = toFinitePositive(diameter, null);
  if (!Number.isFinite(safeDiameter)) return null;
  return interpolateDirectionalVisualRadius(safeDiameter / 2, visualSizing, fallbackScale);
}

export function resolveDirectionalLayerVisualRadii(layer = {}, visualSizing = null, fallbackScale = 1) {
  const isPipeLayer = String(layer?.material ?? '').trim().toLowerCase() === 'steel'
    && String(layer?.source?.type ?? '').trim().toLowerCase() === 'pipe';
  const sourcePipeKey = isPipeLayer
    ? resolveDirectionalPipeKey(
      layer?.source?.pipeType,
      layer?.source?.sourceIndex ?? layer?.source?.index
    )
    : null;
  const exactPipeGeometry = sourcePipeKey
    ? visualSizing?.pipeGeometryByKey?.[sourcePipeKey]
    : null;
  if (exactPipeGeometry) {
    return exactPipeGeometry;
  }

  const innerPhysical = Number(layer?.innerRadius);
  const outerPhysical = Number(layer?.outerRadius);
  if (!Number.isFinite(innerPhysical) || !Number.isFinite(outerPhysical) || outerPhysical <= innerPhysical) {
    return null;
  }

  const innerRadius = interpolateDirectionalVisualRadius(innerPhysical, visualSizing, fallbackScale);
  const outerRadius = interpolateDirectionalVisualRadius(outerPhysical, visualSizing, fallbackScale);
  if (!Number.isFinite(innerRadius) || !Number.isFinite(outerRadius) || outerRadius <= innerRadius) return null;

  const wallThickness = Math.max(0, outerRadius - innerRadius);
  return {
    innerRadius,
    outerRadius,
    wallThickness,
    wallCenterRadius: outerRadius - (wallThickness / 2)
  };
}

export function resolveDirectionalPipeVisualGeometry(pipeLike = {}, visualSizing = null, fallbackScale = 1) {
  const pipeKey = resolveDirectionalPipeKey(
    pipeLike?.pipeType ?? pipeLike?.source?.pipeType,
    pipeLike?.rowIndex
      ?? pipeLike?.index
      ?? pipeLike?.sourceIndex
      ?? pipeLike?.__index
      ?? pipeLike?.source?.sourceIndex
      ?? pipeLike?.source?.index
  );
  if (pipeKey && visualSizing?.pipeGeometryByKey?.[pipeKey]) {
    return visualSizing.pipeGeometryByKey[pipeKey];
  }

  const wallGeometry = resolvePipeWallGeometry(pipeLike, 1);
  if (!wallGeometry) return null;

  const innerRadius = interpolateDirectionalVisualRadius(wallGeometry.innerRadius, visualSizing, fallbackScale);
  const outerRadius = interpolateDirectionalVisualRadius(wallGeometry.outerRadius, visualSizing, fallbackScale);
  if (!Number.isFinite(innerRadius) || !Number.isFinite(outerRadius) || outerRadius <= innerRadius) return null;

  const wallThickness = Math.max(0, outerRadius - innerRadius);
  return {
    innerRadius,
    outerRadius,
    wallThickness,
    wallCenterRadius: outerRadius - (wallThickness / 2)
  };
}

export function resolveDirectionalMaxVisualRadiusPx(visualSizing = null, fallback = 0) {
  const numeric = Number(visualSizing?.maxVisualRadiusPx);
  if (!Number.isFinite(numeric) || numeric <= 0) return Math.max(0, Number(fallback) || 0);
  return numeric;
}

export function resolveDirectionalVisualInsetPadding(options = {}) {
  const visualMaxRadiusPx = clampPositive(options.visualMaxRadiusPx, 0);
  const formationThicknessPx = clampPositive(options.formationThicknessPx, VISUAL_SIZING_DEFAULTS.formationThicknessPx);
  const horizontal = Math.max(
    0,
    visualMaxRadiusPx + formationThicknessPx + VISUAL_SIZING_DEFAULTS.horizontalPaddingPx
  );
  const vertical = Math.max(
    0,
    Math.round((visualMaxRadiusPx * 0.7) + VISUAL_SIZING_DEFAULTS.verticalPaddingPx)
  );
  return Object.freeze({
    left: horizontal + VISUAL_SIZING_DEFAULTS.leftAxisGutterPx,
    right: horizontal,
    top: vertical,
    bottom: vertical,
    horizontal,
    vertical
  });
}

export function resolveDirectionalSvgWidthFromHeight(figHeight, dataAspectRatio) {
  const plotHeight = resolvePlotHeightFromFigureHeight(figHeight);
  const aspectRatio = resolveDataAspectRatio(dataAspectRatio, 1);
  const unclampedPlotWidth = plotHeight * aspectRatio;
  const maxPlotWidth = Math.max(10, DIRECTIONAL_MAX_SVG_WIDTH - DIRECTIONAL_MARGIN.left - DIRECTIONAL_MARGIN.right);
  const plotWidth = Math.min(unclampedPlotWidth, maxPlotWidth);
  return clampSvgWidth(plotWidth + DIRECTIONAL_MARGIN.left + DIRECTIONAL_MARGIN.right);
}

export function resolveDirectionalSvgWidthFromHeightWithInsets(figHeight, dataAspectRatio, marginBox = DIRECTIONAL_MARGIN, insetPadding = {}) {
  const safeHeight = clampFigureHeight(figHeight);
  const rawPlotHeight = Math.max(
    10,
    safeHeight - Number(marginBox?.top || 0) - Number(marginBox?.bottom || 0)
  );
  const insetLeft = Math.max(0, Number(insetPadding?.left ?? insetPadding?.horizontal) || 0);
  const insetRight = Math.max(0, Number(insetPadding?.right ?? insetPadding?.horizontal) || 0);
  const aspectRatio = resolveDataAspectRatio(dataAspectRatio, 1);
  const centerlinePlotHeight = rawPlotHeight;
  const centerlinePlotWidth = centerlinePlotHeight * aspectRatio;
  const fullPlotWidth = centerlinePlotWidth + insetLeft + insetRight;
  const maxPlotWidth = Math.max(10, DIRECTIONAL_MAX_SVG_WIDTH - Number(marginBox?.left || 0) - Number(marginBox?.right || 0));
  return clampSvgWidth(
    Math.min(fullPlotWidth, maxPlotWidth) + Number(marginBox?.left || 0) + Number(marginBox?.right || 0)
  );
}

export function resolveDirectionalPlotInsetRange(svgWidth, figHeight, marginBox = DIRECTIONAL_MARGIN, insetPadding = {}) {
  const safeSvgWidth = clampSvgWidth(svgWidth);
  const safeFigureHeight = clampFigureHeight(figHeight);
  const plotWidth = Math.max(10, safeSvgWidth - Number(marginBox?.left || 0) - Number(marginBox?.right || 0));
  const plotHeight = Math.max(10, safeFigureHeight - Number(marginBox?.top || 0) - Number(marginBox?.bottom || 0));
  const insetLeft = Math.max(0, Math.min((plotWidth / 2) - 1, Number(insetPadding?.left ?? insetPadding?.horizontal) || 0));
  const insetRight = Math.max(0, Math.min((plotWidth / 2) - 1, Number(insetPadding?.right ?? insetPadding?.horizontal) || 0));
  const insetTop = Math.max(0, Math.min((plotHeight / 2) - 1, Number(insetPadding?.top ?? insetPadding?.vertical) || 0));
  const insetBottom = Math.max(0, Math.min((plotHeight / 2) - 1, Number(insetPadding?.bottom ?? insetPadding?.vertical) || 0));

  return Object.freeze({
    left: Number(marginBox?.left || 0) + insetLeft,
    right: Number(marginBox?.left || 0) + plotWidth - insetRight,
    top: Number(marginBox?.top || 0) + insetTop,
    bottom: Number(marginBox?.top || 0) + plotHeight - insetBottom
  });
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

export function resolveVerticalEquivalentXHalf(options = {}) {
  const maxCasingOuterRadius = clampPositive(options?.maxCasingOuterRadius, 1);
  const maxStackOuterRadius = clampPositive(options?.maxStackOuterRadius, 1);
  const diameterScale = clampPositive(options?.diameterScale, 1);
  const widthMultiplier = clampPositive(options?.widthMultiplier, 3.5);
  const minHalfWidth = clampPositive(options?.minHalfWidth, 30);

  const maxOD = Math.max(1, maxCasingOuterRadius * 2, maxStackOuterRadius * 2);
  const halfWidth = (maxOD * diameterScale) / 2;
  return Math.max(minHalfWidth, halfWidth * widthMultiplier);
}

export function resolveDirectionalHorizontalPadding(options = {}) {
  const maxProjectedRadius = Math.max(0, Number(options?.maxProjectedRadius) || 0);
  const radialPaddingMultiplier = clampPositive(options?.radialPaddingMultiplier, 1.5);
  const minRadialPadding = clampPositive(options?.minRadialPadding, 10);
  const radialPadding = Math.max(minRadialPadding, maxProjectedRadius * radialPaddingMultiplier);

  if (options?.hasTrajectoryDefinition !== false) return radialPadding;

  const verticalEquivalentXHalf = toFinitePositive(options?.verticalEquivalentXHalf, null);
  if (!Number.isFinite(verticalEquivalentXHalf)) return radialPadding;

  return Math.max(radialPadding, verticalEquivalentXHalf);
}

export {
  DIRECTIONAL_BASE_SVG_WIDTH,
  DIRECTIONAL_MARGIN,
  DIRECTIONAL_MAX_SVG_WIDTH,
  DIRECTIONAL_MIN_FIGURE_HEIGHT,
  DIRECTIONAL_MIN_SVG_WIDTH
};
