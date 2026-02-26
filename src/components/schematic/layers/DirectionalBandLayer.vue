<script setup>
import { computed } from 'vue';
import * as d3 from 'd3';
import { COLOR_PALETTES, DEFAULT_CEMENT_COLOR, DEFAULT_CEMENT_PLUG_COLOR } from '@/constants/index.js';
import { getHatchStyleKey, sanitizePatternId } from '@/app/rendering.js';
import { resolveOpenHoleWaveConfig } from '@/utils/openHoleWave.js';
import { generateWavyPath } from '@/utils/wavyPath.js';
import PatternDefs from './PatternDefs.vue';
import {
  DIRECTIONAL_EPSILON,
  toFiniteNumber,
  isFinitePoint,
  buildMDSamples,
  buildDirectionalProjector,
  normalizeXExaggeration
} from './directionalProjection.js';

const CASING_HIT_TARGET_MIN_STROKE_PX = 14;
const FLUID_HIT_TARGET_MIN_STROKE_PX = 10;
const HIT_TARGET_MAX_STROKE_PX = 28;
const LAYER_SPAN_MERGE_EPSILON = 1e-4;
const OPEN_HOLE_FORMATION_THICKNESS_PX = 15;

const props = defineProps({
  intervals: {
    type: Array,
    default: () => []
  },
  trajectoryPoints: {
    type: Array,
    default: () => []
  },
  casingData: {
    type: Array,
    default: () => []
  },
  xScale: {
    type: Function,
    required: true
  },
  yScale: {
    type: Function,
    required: true
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  colorPalette: {
    type: String,
    default: 'Tableau 10'
  },
  showCement: {
    type: Boolean,
    default: true
  },
  cementColor: {
    type: String,
    default: DEFAULT_CEMENT_COLOR
  },
  cementHatchEnabled: {
    type: Boolean,
    default: false
  },
  cementHatchStyle: {
    type: String,
    default: 'none'
  },
  xExaggeration: {
    type: Number,
    default: 1
  },
  xOrigin: {
    type: Number,
    default: 0
  },
  sampleStepMd: {
    type: Number,
    default: 20
  }
});

const emit = defineEmits([
  'select-pipe',
  'hover-pipe',
  'leave-pipe',
  'select-fluid',
  'hover-fluid',
  'leave-fluid',
  'select-plug',
  'hover-plug',
  'leave-plug'
]);

function normalizePipeType(pipeType) {
  const normalized = String(pipeType ?? '').trim().toLowerCase();
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return 'casing';
}

function serializePipeEntity(pipeType, rowIndex) {
  const normalizedType = normalizePipeType(pipeType);
  const normalizedRowIndex = Number(rowIndex);
  if (!Number.isInteger(normalizedRowIndex) || normalizedRowIndex < 0) return null;
  return `${normalizedType}:${normalizedRowIndex}`;
}

function resolveBandInteractionMeta(layer = null) {
  const material = layer?.material;
  const source = layer?.source ?? null;
  const token = String(material ?? '').toLowerCase();
  if (layer?.isOpenHoleBoundary === true && String(source?.type ?? '').toLowerCase() === 'pipe') {
    const pipeType = normalizePipeType(source?.pipeType);
    const sourceIndex = Number(source?.index);
    if (!Number.isInteger(sourceIndex)) return { type: null, index: null, interactive: false };
    return { type: 'pipe', pipeType, index: sourceIndex, interactive: true };
  }

  if (token === 'steel') {
    const sourceType = String(source?.type ?? '').toLowerCase();
    const pipeType = normalizePipeType(source?.pipeType);
    const sourceIndex = Number(source?.index);
    if (sourceType !== 'pipe') return { type: null, index: null, interactive: false };
    if (!Number.isInteger(sourceIndex)) return { type: null, index: null, interactive: false };
    return { type: 'pipe', pipeType, index: sourceIndex, interactive: true };
  }
  const sourceIndex = Number(source?.index);
  if (!Number.isInteger(sourceIndex)) return { type: null, index: null, interactive: false };
  if (token === 'fluid') {
    return { type: 'fluid', index: sourceIndex, interactive: true };
  }
  if (token === 'plug') {
    return { type: 'plug', index: sourceIndex, interactive: true };
  }
  return { type: null, index: null, interactive: false };
}

function emitBandHover(band, event) {
  if (!band?.interactive || !Number.isInteger(band?.interactionIndex)) return;
  if (band.interactionType === 'pipe') {
    emit('hover-pipe', {
      pipeType: band.interactionPipeType,
      rowIndex: band.interactionIndex
    }, event);
    return;
  }
  if (band.interactionType === 'fluid') {
    emit('hover-fluid', band.interactionIndex, event);
    return;
  }
  if (band.interactionType === 'plug') {
    emit('hover-plug', band.interactionIndex, event);
  }
}

function emitBandLeave(band) {
  if (!band?.interactive || !Number.isInteger(band?.interactionIndex)) return;
  if (band.interactionType === 'pipe') {
    emit('leave-pipe', {
      pipeType: band.interactionPipeType,
      rowIndex: band.interactionIndex
    });
    return;
  }
  if (band.interactionType === 'fluid') {
    emit('leave-fluid', band.interactionIndex);
    return;
  }
  if (band.interactionType === 'plug') {
    emit('leave-plug', band.interactionIndex);
  }
}

function emitBandSelect(band) {
  if (!band?.interactive || !Number.isInteger(band?.interactionIndex)) return;
  if (band.interactionType === 'pipe') {
    emit('select-pipe', {
      pipeType: band.interactionPipeType,
      rowIndex: band.interactionIndex
    });
    return;
  }
  if (band.interactionType === 'fluid') {
    emit('select-fluid', band.interactionIndex);
    return;
  }
  if (band.interactionType === 'plug') {
    emit('select-plug', band.interactionIndex);
  }
}

function buildMidlineSamples(samples = []) {
  return samples
    .map((sample) => {
      const outer = sample?.outer;
      const inner = sample?.inner;
      if (!isFinitePoint(outer) || !isFinitePoint(inner)) return null;
      return [
        (outer[0] + inner[0]) / 2,
        (outer[1] + inner[1]) / 2
      ];
    })
    .filter((point) => isFinitePoint(point));
}

function resolveAverageBandThickness(samples = []) {
  const distances = samples
    .map((sample) => {
      const outer = sample?.outer;
      const inner = sample?.inner;
      if (!isFinitePoint(outer) || !isFinitePoint(inner)) return null;
      return Math.hypot(outer[0] - inner[0], outer[1] - inner[1]);
    })
    .filter((value) => Number.isFinite(value));
  if (distances.length === 0) return 0;
  return distances.reduce((sum, value) => sum + value, 0) / distances.length;
}

function resolveHitStrokeWidth(interactionType, bandThicknessPx) {
  const baseMin = interactionType === 'pipe'
    ? CASING_HIT_TARGET_MIN_STROKE_PX
    : FLUID_HIT_TARGET_MIN_STROKE_PX;
  const padding = interactionType === 'pipe' ? 9 : 7;
  return Math.min(HIT_TARGET_MAX_STROKE_PX, Math.max(baseMin, bandThicknessPx + padding));
}

function resolveOpenHoleBoundaryHitStrokeWidth() {
  return 24;
}

function hashStringToSeed(value = '') {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function resolveSourceRowIndex(source = null) {
  const sourceIndex = Number(source?.sourceIndex);
  if (Number.isInteger(sourceIndex) && sourceIndex >= 0) return sourceIndex;
  const index = Number(source?.index);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function resolveOpenHoleWaveConfigByLayerSource(layer, casingRows) {
  const rowIndex = resolveSourceRowIndex(layer?.source);
  if (!Number.isInteger(rowIndex)) return resolveOpenHoleWaveConfig(null);
  const rows = Array.isArray(casingRows) ? casingRows : [];
  const row = rows[rowIndex];
  return resolveOpenHoleWaveConfig(row);
}

function buildDirectionalOpenHoleBoundaryPath(points = [], waveConfig, seed = 0) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const path = generateWavyPath(points, {
    amplitude: waveConfig.amplitude,
    wavelength: waveConfig.wavelength,
    seed
  });
  return path && String(path).trim() ? path : null;
}

function buildOpenHoleFormationFillPath(sideSamples = [], thicknessPx = OPEN_HOLE_FORMATION_THICKNESS_PX) {
  if (!Array.isArray(sideSamples) || sideSamples.length < 2) return null;
  const safeThickness = Number(thicknessPx);
  if (!Number.isFinite(safeThickness) || safeThickness <= DIRECTIONAL_EPSILON) return null;

  const samples = sideSamples
    .map((sample) => {
      const boundary = sample?.outer;
      const inner = sample?.inner;
      if (!isFinitePoint(boundary) || !isFinitePoint(inner)) return null;

      const vectorX = boundary[0] - inner[0];
      const vectorY = boundary[1] - inner[1];
      const vectorLength = Math.hypot(vectorX, vectorY);
      if (!Number.isFinite(vectorLength) || vectorLength <= DIRECTIONAL_EPSILON) return null;

      const unitX = vectorX / vectorLength;
      const unitY = vectorY / vectorLength;
      const formation = [
        boundary[0] + (unitX * safeThickness),
        boundary[1] + (unitY * safeThickness)
      ];

      return { boundary, formation };
    })
    .filter(Boolean);

  if (samples.length < 2) return null;

  const formationAreaBuilder = d3.area()
    .x0((sample) => sample.formation[0])
    .y0((sample) => sample.formation[1])
    .x1((sample) => sample.boundary[0])
    .y1((sample) => sample.boundary[1])
    .curve(d3.curveLinear);

  return formationAreaBuilder(samples);
}

function resolveInteractionPriority(interactionType) {
  if (interactionType === 'plug') return 3;
  if (interactionType === 'fluid') return 2;
  if (interactionType === 'pipe') return 1;
  return 0;
}

function resolvePipeHitTargetRadius(target) {
  const radius = Number(target?.interactionOuterRadius);
  return Number.isFinite(radius) ? radius : 0;
}

function nearlyEqual(left, right, epsilon = LAYER_SPAN_MERGE_EPSILON) {
  return Math.abs(Number(left) - Number(right)) <= epsilon;
}

function buildPlugMergeKey(entry) {
  const sourceIndex = Number(entry?.layer?.source?.index);
  const interactionIndex = Number(entry?.interactionMeta?.index);
  const safeSourceIndex = Number.isInteger(sourceIndex) ? sourceIndex : 'x';
  const safeInteractionIndex = Number.isInteger(interactionIndex) ? interactionIndex : 'x';
  const innerToken = Number(entry?.innerScaled).toFixed(6);
  const outerToken = Number(entry?.outerScaled).toFixed(6);
  const fillToken = String(entry?.style?.fill ?? '');
  const opacityToken = Number(entry?.style?.opacity ?? 0).toFixed(3);
  const hatchToken = String(entry?.layer?.hatchStyle ?? 'none');
  return [
    safeSourceIndex,
    safeInteractionIndex,
    innerToken,
    outerToken,
    fillToken,
    opacityToken,
    hatchToken
  ].join('|');
}

function mergeContiguousPlugEntries(entries = []) {
  const mergedEntries = [];
  const mergeIndexByKey = new Map();

  entries.forEach((entry) => {
    if (entry?.layer?.material !== 'plug') {
      mergedEntries.push(entry);
      return;
    }

    const key = buildPlugMergeKey(entry);
    const existingIndex = mergeIndexByKey.get(key);
    const candidate = Number.isInteger(existingIndex) ? mergedEntries[existingIndex] : null;

    if (candidate && nearlyEqual(candidate.bottom, entry.top)) {
      candidate.bottom = entry.bottom;
      return;
    }

    const nextIndex = mergedEntries.length;
    mergedEntries.push({ ...entry });
    mergeIndexByKey.set(key, nextIndex);
  });

  return mergedEntries;
}

function resolveLayerStyle(layer, context) {
  const annulusMudFill = 'var(--color-cross-annulus-fill)';
  const annulusMudStroke = 'var(--color-cross-annulus-stroke)';
  const coreFill = 'var(--color-cross-core-fill)';
  const coreStroke = 'var(--color-cross-core-stroke)';

  if (layer?.material === 'wellbore') {
    return { fill: coreFill, stroke: 'none', strokeWidth: 0, opacity: 1.0 };
  }

  if (layer?.material === 'steel') {
    const sourceIndex = Number(layer?.source?.index);
    const pipeType = String(layer?.source?.pipeType ?? layer?.pipeType ?? 'casing').toLowerCase();
    if (pipeType === 'tubing') {
      return { fill: 'var(--color-pipe-tubing)', stroke: 'var(--color-pipe-tubing-stroke)', strokeWidth: 0.75, opacity: 0.95 };
    }
    if (pipeType === 'drillstring') {
      return { fill: 'var(--color-pipe-drillstring)', stroke: 'var(--color-pipe-drillstring-stroke)', strokeWidth: 0.75, opacity: 0.95 };
    }
    const color = context.colorMap.get(sourceIndex) || context.colors[0] || 'var(--color-pipe-fallback)';
    return { fill: color, stroke: 'var(--color-ink-strong)', strokeWidth: 0.8, opacity: 0.96 };
  }

  if (layer?.material === 'cement') {
    if (!context.showCement) {
      return { fill: annulusMudFill, stroke: annulusMudStroke, strokeWidth: 0.45, opacity: 0.85 };
    }
    const cementFill = context.cementPatternId
      ? `url(#${context.cementPatternId})`
      : (context.cementColor || DEFAULT_CEMENT_COLOR);
    return {
      fill: cementFill,
      stroke: 'var(--color-ink-soft)',
      strokeWidth: 0.55,
      opacity: 0.88
    };
  }

  if (layer?.material === 'fluid') {
    if (layer?.role === 'core') {
      return { fill: coreFill, stroke: coreStroke, strokeWidth: 0.45, opacity: 1.0 };
    }

    const baseColor = String(layer?.color || DEFAULT_CEMENT_COLOR);
    const fluidSourceIndexRaw = Number(layer?.source?.index);
    const fluidSourceIndex = Number.isInteger(fluidSourceIndexRaw) ? fluidSourceIndexRaw : null;
    const fluidHatchStyleKey = getHatchStyleKey(layer?.hatchStyle || 'none');
    let fill = baseColor;
    if (fluidHatchStyleKey !== 'none') {
      const patternId = `declarative-directional-fluid-${Number.isInteger(fluidSourceIndex) ? fluidSourceIndex : 'x'}-${fluidHatchStyleKey}-${sanitizePatternId(baseColor)}`;
      if (!context.hatchPatternMap.has(patternId)) {
        context.hatchPatternMap.set(patternId, {
          id: patternId,
          styleKey: fluidHatchStyleKey,
          color: baseColor
        });
      }
      fill = `url(#${patternId})`;
    }
    return { fill, stroke: 'var(--color-ink-soft)', strokeWidth: 0.45, opacity: 0.82 };
  }

  if (layer?.material === 'plug') {
    const baseColor = String(layer?.color || DEFAULT_CEMENT_PLUG_COLOR);
    const plugSourceIndexRaw = Number(layer?.source?.index);
    const plugSourceIndex = Number.isInteger(plugSourceIndexRaw) ? plugSourceIndexRaw : null;
    const plugHatchStyleKey = getHatchStyleKey(layer?.hatchStyle || 'none');
    let fill = baseColor;
    if (plugHatchStyleKey !== 'none') {
      const patternId = `declarative-directional-plug-${Number.isInteger(plugSourceIndex) ? plugSourceIndex : 'x'}-${plugHatchStyleKey}-${sanitizePatternId(baseColor)}`;
      if (!context.hatchPatternMap.has(patternId)) {
        context.hatchPatternMap.set(patternId, {
          id: patternId,
          styleKey: plugHatchStyleKey,
          color: baseColor
        });
      }
      fill = `url(#${patternId})`;
    }
    return {
      fill,
      stroke: 'var(--color-ink-strong)',
      strokeWidth: 0.6,
      opacity: 0.92
    };
  }

  if (layer?.material === 'void') {
    return { fill: 'none', stroke: 'none', strokeWidth: 0, opacity: 0 };
  }

  if (layer?.role === 'core') {
    return { fill: coreFill, stroke: coreStroke, strokeWidth: 0.45, opacity: 1.0 };
  }

  return { fill: annulusMudFill, stroke: annulusMudStroke, strokeWidth: 0.4, opacity: 0.72 };
}

const colors = computed(() => (
  COLOR_PALETTES[props.colorPalette] || COLOR_PALETTES['Tableau 10']
));

const colorMap = computed(() => {
  const map = new Map();
  const rows = Array.isArray(props.casingData) ? props.casingData : [];
  rows.forEach((row, index) => {
    map.set(index, colors.value[index % colors.value.length]);
  });
  return map;
});

const cementPattern = computed(() => {
  if (props.showCement !== true || props.cementHatchEnabled !== true) return null;
  const styleKey = getHatchStyleKey(props.cementHatchStyle);
  if (!styleKey || styleKey === 'none') return null;
  const color = String(props.cementColor || DEFAULT_CEMENT_COLOR);
  return {
    id: `declarative-directional-cement-${styleKey}-${sanitizePatternId(color)}`,
    styleKey,
    color
  };
});

const projectedBands = computed(() => {
  const intervals = Array.isArray(props.intervals) ? props.intervals : [];
  const trajectoryPoints = Array.isArray(props.trajectoryPoints) ? props.trajectoryPoints : [];
  if (intervals.length === 0 || trajectoryPoints.length < 2) {
    return { bands: [], walls: [], hitTargets: [], hatchPatterns: [] };
  }

  const safeDiameterScale = toFiniteNumber(props.diameterScale, 1);
  const diameterScale = safeDiameterScale > 0 ? safeDiameterScale : 1;
  const xExaggeration = normalizeXExaggeration(props.xExaggeration);
  const xOrigin = toFiniteNumber(props.xOrigin, 0);
  const project = buildDirectionalProjector(trajectoryPoints, props.xScale, props.yScale, {
    xExaggeration,
    xOrigin
  });
  const styleContext = {
    colors: colors.value,
    colorMap: colorMap.value,
    showCement: props.showCement === true,
    cementColor: props.cementColor,
    cementPatternId: cementPattern.value?.id || null,
    hatchPatternMap: new Map()
  };
  const areaBuilder = d3.area()
    .x0((d) => d.outer[0])
    .y0((d) => d.outer[1])
    .x1((d) => d.inner[0])
    .y1((d) => d.inner[1])
    .curve(d3.curveLinear);
  const lineBuilder = d3.line()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(d3.curveLinear);

  const bands = [];
  const formationFills = [];
  const walls = [];
  const hitTargets = [];
  const layerEntries = [];

  intervals.forEach((interval, intervalIndex) => {
    const top = toFiniteNumber(interval?.top, null);
    const bottom = toFiniteNumber(interval?.bottom, null);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;

    const stack = Array.isArray(interval?.stack) ? interval.stack : [];
    stack.forEach((layer, layerIndex) => {
      const inner = toFiniteNumber(layer?.innerRadius, null);
      const outer = toFiniteNumber(layer?.outerRadius, null);
      if (!Number.isFinite(inner) || !Number.isFinite(outer) || outer <= inner) return;

      const innerScaled = inner * diameterScale;
      const outerScaled = outer * diameterScale;
      if (!Number.isFinite(innerScaled) || !Number.isFinite(outerScaled) || outerScaled <= innerScaled) return;

      const style = resolveLayerStyle(layer, styleContext);
      const interactionMeta = resolveBandInteractionMeta(layer);
      layerEntries.push({
        id: `entry-${intervalIndex}-${layerIndex}`,
        top,
        bottom,
        layer,
        innerScaled,
        outerScaled,
        style,
        interactionMeta
      });
    });
  });

  const renderEntries = mergeContiguousPlugEntries(layerEntries);

  renderEntries.forEach((entry) => {
    const top = toFiniteNumber(entry?.top, null);
    const bottom = toFiniteNumber(entry?.bottom, null);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;
    const mdSamples = buildMDSamples(top, bottom, props.sampleStepMd);
    if (mdSamples.length < 2) return;

    const layer = entry?.layer;
    const style = entry?.style ?? {};
    const interactionMeta = entry?.interactionMeta ?? { type: null, index: null, interactive: false };
    const innerScaled = toFiniteNumber(entry?.innerScaled, null);
    const outerScaled = toFiniteNumber(entry?.outerScaled, null);
    if (!Number.isFinite(innerScaled) || !Number.isFinite(outerScaled) || outerScaled <= innerScaled) return;

    const leftBandSamples = mdSamples.map((md) => ({
      outer: project(md, -outerScaled),
      inner: project(md, -innerScaled)
    }));
    const rightBandSamples = mdSamples.map((md) => ({
      outer: project(md, outerScaled),
      inner: project(md, innerScaled)
    }));

    const allBandPoints = leftBandSamples.concat(rightBandSamples);
    const hasInvalidBandPoint = allBandPoints.some((sample) => (
      !isFinitePoint(sample.outer) || !isFinitePoint(sample.inner)
    ));
    if (hasInvalidBandPoint) return;

    const isOpenHoleBoundary = layer?.isOpenHoleBoundary === true;
    const openHoleWaveConfig = isOpenHoleBoundary
      ? resolveOpenHoleWaveConfigByLayerSource(layer, props.casingData)
      : null;
    if (isOpenHoleBoundary) {
      const leftFormationPath = buildOpenHoleFormationFillPath(leftBandSamples);
      const rightFormationPath = buildOpenHoleFormationFillPath(rightBandSamples);
      if (leftFormationPath) {
        formationFills.push({
          id: `formation-${entry.id}-left`,
          d: leftFormationPath
        });
      }
      if (rightFormationPath) {
        formationFills.push({
          id: `formation-${entry.id}-right`,
          d: rightFormationPath
        });
      }
    }

    if (style.fill !== 'none' && style.opacity > 0) {
      const spansCenter = Math.abs(innerScaled) <= DIRECTIONAL_EPSILON;
      if (spansCenter) {
        const fullBandSamples = mdSamples.map((md) => ({
          outer: project(md, -outerScaled),
          inner: project(md, outerScaled)
        }));
        const hasInvalidFullBandPoint = fullBandSamples.some((sample) => (
          !isFinitePoint(sample.outer) || !isFinitePoint(sample.inner)
        ));
        const fullBandPath = hasInvalidFullBandPoint ? null : areaBuilder(fullBandSamples);
        if (fullBandPath) {
          bands.push({
            id: `band-${entry.id}-full`,
            d: fullBandPath,
            fill: style.fill,
            opacity: style.opacity,
            interactionType: interactionMeta.type,
            interactionPipeType: interactionMeta.pipeType ?? null,
            interactionIndex: interactionMeta.index,
            interactionPipeKey: serializePipeEntity(interactionMeta.pipeType, interactionMeta.index),
            interactive: interactionMeta.interactive
          });
        } else {
          const leftBandPath = areaBuilder(leftBandSamples);
          const rightBandPath = areaBuilder(rightBandSamples);
          if (leftBandPath) {
            bands.push({
              id: `band-${entry.id}-left`,
              d: leftBandPath,
              fill: style.fill,
              opacity: style.opacity,
              interactionType: interactionMeta.type,
              interactionPipeType: interactionMeta.pipeType ?? null,
              interactionIndex: interactionMeta.index,
              interactionPipeKey: serializePipeEntity(interactionMeta.pipeType, interactionMeta.index),
              interactive: interactionMeta.interactive
            });
          }
          if (rightBandPath) {
            bands.push({
              id: `band-${entry.id}-right`,
              d: rightBandPath,
              fill: style.fill,
              opacity: style.opacity,
              interactionType: interactionMeta.type,
              interactionPipeType: interactionMeta.pipeType ?? null,
              interactionIndex: interactionMeta.index,
              interactionPipeKey: serializePipeEntity(interactionMeta.pipeType, interactionMeta.index),
              interactive: interactionMeta.interactive
            });
          }
        }
      } else {
        const leftBandPath = areaBuilder(leftBandSamples);
        const rightBandPath = areaBuilder(rightBandSamples);
        if (leftBandPath) {
          bands.push({
            id: `band-${entry.id}-left`,
            d: leftBandPath,
            fill: style.fill,
            opacity: style.opacity,
            interactionType: interactionMeta.type,
            interactionPipeType: interactionMeta.pipeType ?? null,
            interactionIndex: interactionMeta.index,
            interactionPipeKey: serializePipeEntity(interactionMeta.pipeType, interactionMeta.index),
            interactive: interactionMeta.interactive
          });
        }
        if (rightBandPath) {
          bands.push({
            id: `band-${entry.id}-right`,
            d: rightBandPath,
            fill: style.fill,
            opacity: style.opacity,
            interactionType: interactionMeta.type,
            interactionPipeType: interactionMeta.pipeType ?? null,
            interactionIndex: interactionMeta.index,
            interactionPipeKey: serializePipeEntity(interactionMeta.pipeType, interactionMeta.index),
            interactive: interactionMeta.interactive
          });
        }
      }
    }

    if (interactionMeta.interactive) {
      const openHoleSeedBase = hashStringToSeed(`open-hole:${entry.id}`);
      const leftMidline = buildMidlineSamples(leftBandSamples);
      const rightMidline = buildMidlineSamples(rightBandSamples);
      const leftOuter = leftBandSamples.map((sample) => sample.outer).filter((point) => isFinitePoint(point));
      const rightOuter = rightBandSamples.map((sample) => sample.outer).filter((point) => isFinitePoint(point));
      const leftPath = isOpenHoleBoundary
        ? buildDirectionalOpenHoleBoundaryPath(leftOuter, openHoleWaveConfig, openHoleSeedBase)
        : (leftMidline.length > 1 ? lineBuilder(leftMidline) : null);
      const rightPath = isOpenHoleBoundary
        ? buildDirectionalOpenHoleBoundaryPath(rightOuter, openHoleWaveConfig, openHoleSeedBase + 1)
        : (rightMidline.length > 1 ? lineBuilder(rightMidline) : null);
      const leftThickness = resolveAverageBandThickness(leftBandSamples);
      const rightThickness = resolveAverageBandThickness(rightBandSamples);
      const leftHitStrokeWidth = isOpenHoleBoundary
        ? resolveOpenHoleBoundaryHitStrokeWidth()
        : resolveHitStrokeWidth(interactionMeta.type, leftThickness);
      const rightHitStrokeWidth = isOpenHoleBoundary
        ? resolveOpenHoleBoundaryHitStrokeWidth()
        : resolveHitStrokeWidth(interactionMeta.type, rightThickness);

      if (leftPath) {
        hitTargets.push({
          id: `band-hit-${entry.id}-left`,
          d: leftPath,
          interactionType: interactionMeta.type,
          interactionPipeType: interactionMeta.pipeType ?? null,
          interactionIndex: interactionMeta.index,
          interactionPipeKey: serializePipeEntity(interactionMeta.pipeType, interactionMeta.index),
          interactive: true,
          strokeWidth: leftHitStrokeWidth,
          interactionOuterRadius: outerScaled
        });
      }
      if (rightPath) {
        hitTargets.push({
          id: `band-hit-${entry.id}-right`,
          d: rightPath,
          interactionType: interactionMeta.type,
          interactionPipeType: interactionMeta.pipeType ?? null,
          interactionIndex: interactionMeta.index,
          interactionPipeKey: serializePipeEntity(interactionMeta.pipeType, interactionMeta.index),
          interactive: true,
          strokeWidth: rightHitStrokeWidth,
          interactionOuterRadius: outerScaled
        });
      }
    }

    const strokeWidth = toFiniteNumber(style.strokeWidth, 0);
    const shouldDrawWalls = isOpenHoleBoundary || (
      strokeWidth > 0 &&
      style.stroke &&
      style.stroke !== 'none'
    );
    if (!shouldDrawWalls) return;

    const outerStroke = isOpenHoleBoundary ? 'var(--color-brown-accent)' : style.stroke;
    const outerStrokeWidth = isOpenHoleBoundary ? 2 : strokeWidth;
    const leftOuter = leftBandSamples.map((sample) => sample.outer);
    const rightOuter = rightBandSamples.map((sample) => sample.outer);
    const openHoleSeedBase = hashStringToSeed(`open-hole:${entry.id}`);
    const leftOuterPath = isOpenHoleBoundary
      ? buildDirectionalOpenHoleBoundaryPath(leftOuter, openHoleWaveConfig, openHoleSeedBase)
      : lineBuilder(leftOuter);
    const rightOuterPath = isOpenHoleBoundary
      ? buildDirectionalOpenHoleBoundaryPath(rightOuter, openHoleWaveConfig, openHoleSeedBase + 1)
      : lineBuilder(rightOuter);

    if (leftOuterPath) {
      walls.push({
        id: `wall-${entry.id}-left-outer`,
        d: leftOuterPath,
        stroke: outerStroke,
        strokeWidth: outerStrokeWidth,
        strokeDasharray: null
      });
    }
    if (rightOuterPath) {
      walls.push({
        id: `wall-${entry.id}-right-outer`,
        d: rightOuterPath,
        stroke: outerStroke,
        strokeWidth: outerStrokeWidth,
        strokeDasharray: null
      });
    }

    if (Math.abs(innerScaled) <= DIRECTIONAL_EPSILON || isOpenHoleBoundary) return;
    const leftInner = leftBandSamples.map((sample) => sample.inner);
    const rightInner = rightBandSamples.map((sample) => sample.inner);
    const leftInnerPath = lineBuilder(leftInner);
    const rightInnerPath = lineBuilder(rightInner);
    if (leftInnerPath) {
      walls.push({
        id: `wall-${entry.id}-left-inner`,
        d: leftInnerPath,
        stroke: style.stroke,
        strokeWidth,
        strokeDasharray: null
      });
    }
    if (rightInnerPath) {
      walls.push({
        id: `wall-${entry.id}-right-inner`,
        d: rightInnerPath,
        stroke: style.stroke,
        strokeWidth,
        strokeDasharray: null
      });
    }
  });

  const prioritizedHitTargets = [...hitTargets].sort((a, b) => {
    const typeDelta = resolveInteractionPriority(a?.interactionType) - resolveInteractionPriority(b?.interactionType);
    if (typeDelta !== 0) return typeDelta;

    if (a?.interactionType === 'pipe' && b?.interactionType === 'pipe') {
      // Keep inner strings on top so tubing/drill-string remains easy to pick
      // when pipe hit targets overlap in directional mode.
      return resolvePipeHitTargetRadius(b) - resolvePipeHitTargetRadius(a);
    }

    return 0;
  });

  return {
    bands,
    formationFills,
    walls,
    hitTargets: prioritizedHitTargets,
    hatchPatterns: Array.from(styleContext.hatchPatternMap.values())
  };
});

const hatchPatterns = computed(() => {
  const patterns = [];
  if (cementPattern.value) {
    patterns.push(cementPattern.value);
  }
  patterns.push(...projectedBands.value.hatchPatterns);
  return patterns;
});
</script>

<template>
  <g class="directional-band-layer">
    <defs>
      <pattern id="directional-formation-dots" patternUnits="userSpaceOnUse" width="8" height="8">
        <g>
          <circle cx="2" cy="2" r="1.2" fill="var(--color-brown-light)" />
          <circle cx="6" cy="6" r="1.2" fill="var(--color-brown-light)" />
        </g>
      </pattern>
    </defs>
    <PatternDefs :patterns="hatchPatterns" />

    <path
      v-for="formationFill in projectedBands.formationFills"
      :key="formationFill.id"
      class="directional-band-layer__formation-fill"
      :d="formationFill.d"
    />

    <path
      v-for="band in projectedBands.bands"
      :key="band.id"
      class="directional-band-layer__band"
      :class="{ 'directional-band-layer__band--interactive': band.interactive }"
      :data-pipe-key="band.interactionType === 'pipe' ? band.interactionPipeKey : null"
      :data-casing-index="band.interactionType === 'pipe' && band.interactionPipeType === 'casing' ? band.interactionIndex : null"
      :data-fluid-index="band.interactionType === 'fluid' ? band.interactionIndex : null"
      :data-plug-index="band.interactionType === 'plug' ? band.interactionIndex : null"
      :d="band.d"
      :fill="band.fill"
      :opacity="band.opacity"
      @mousemove="emitBandHover(band, $event)"
      @mouseleave="emitBandLeave(band)"
      @click="emitBandSelect(band)"
    />

    <path
      v-for="wall in projectedBands.walls"
      :key="wall.id"
      class="directional-band-layer__wall"
      :d="wall.d"
      fill="none"
      :stroke="wall.stroke"
      :stroke-width="wall.strokeWidth"
      :stroke-dasharray="wall.strokeDasharray || null"
    />

    <path
      v-for="target in projectedBands.hitTargets"
      :key="target.id"
      class="directional-band-layer__hit-target"
      :data-pipe-key="target.interactionType === 'pipe' ? target.interactionPipeKey : null"
      :data-casing-index="target.interactionType === 'pipe' && target.interactionPipeType === 'casing' ? target.interactionIndex : null"
      :data-fluid-index="target.interactionType === 'fluid' ? target.interactionIndex : null"
      :data-plug-index="target.interactionType === 'plug' ? target.interactionIndex : null"
      :d="target.d"
      fill="none"
      stroke="transparent"
      :stroke-width="target.strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      @mousemove="emitBandHover(target, $event)"
      @mouseleave="emitBandLeave(target)"
      @click="emitBandSelect(target)"
    />
  </g>
</template>

<style scoped>
.directional-band-layer__wall {
  pointer-events: none;
}

.directional-band-layer__formation-fill {
  fill: url(#directional-formation-dots);
  stroke: none;
  opacity: 0.6;
  pointer-events: none;
}

.directional-band-layer__band {
  pointer-events: none;
}

.directional-band-layer__band--interactive {
  pointer-events: auto;
  cursor: pointer;
}

.directional-band-layer__hit-target {
  pointer-events: stroke;
  cursor: pointer;
}
</style>
