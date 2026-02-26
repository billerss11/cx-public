<script setup>
import { computed } from 'vue';
import { MARKER_DEFAULT_COLORS } from '@/constants/index.js';
import { normalizeMarkerSide, normalizeMarkerType, isOpenHoleRow } from '@/app/domain.js';
import {
  createContext as createPhysicsContext,
  getStackAtDepth as getPhysicsStackAtDepth
} from '@/composables/usePhysics.js';
import { clamp } from '@/utils/general.js';
import {
  buildPipeReferenceMap,
  normalizePipeHostType,
  PIPE_HOST_TYPE_CASING,
  PIPE_HOST_TYPE_TUBING,
  resolvePipeHostReference
} from '@/utils/pipeReference.js';
import {
  DIRECTIONAL_EPSILON,
  toFiniteNumber,
  isFinitePoint,
  buildDirectionalProjector,
  resolveScreenFrameAtMD,
  normalizeXExaggeration
} from './directionalProjection.js';

const LINER_HANGER_LENGTH_PX = 15;
const FLOAT_SHOE_LENGTH_PX = 15;
const PERFORATION_TARGET_SPACING_PX = 16;

const MARKER_SIDE_BOTH = normalizeMarkerSide('Both sides');
const MARKER_SIDE_LEFT = normalizeMarkerSide('Left');
const MARKER_SIDE_RIGHT = normalizeMarkerSide('Right');
const LEAK_MARKER_TYPE = normalizeMarkerType('Leak');

const props = defineProps({
  trajectoryPoints: {
    type: Array,
    default: () => []
  },
  physicsContext: {
    type: Object,
    default: null
  },
  stateSnapshot: {
    type: Object,
    default: null
  },
  markers: {
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
  totalMd: {
    type: Number,
    default: 0
  },
  diameterScale: {
    type: Number,
    default: 1
  },
  maxProjectedRadius: {
    type: Number,
    default: 0
  },
  xExaggeration: {
    type: Number,
    default: 1
  },
  xOrigin: {
    type: Number,
    default: 0
  },
  crossoverPixelHalfHeight: {
    type: Number,
    default: 5
  },
  maxPerforationSymbols: {
    type: Number,
    default: 48
  }
});

const emit = defineEmits([
  'select-marker',
  'hover-marker',
  'leave-marker'
]);

function handleMarkerHover(shape, event) {
  const markerIndex = Number(shape?.markerIndex);
  if (!Number.isInteger(markerIndex)) return;
  emit('hover-marker', markerIndex, event);
}

function handleMarkerLeave(shape) {
  const markerIndex = Number(shape?.markerIndex);
  if (!Number.isInteger(markerIndex)) return;
  emit('leave-marker', markerIndex);
}

function handleMarkerSelect(shape) {
  const markerIndex = Number(shape?.markerIndex);
  if (!Number.isInteger(markerIndex)) return;
  emit('select-marker', markerIndex);
}

const project = computed(() => {
  const trajectoryPoints = Array.isArray(props.trajectoryPoints) ? props.trajectoryPoints : [];
  const xExaggeration = normalizeXExaggeration(props.xExaggeration);
  const xOrigin = toFiniteNumber(props.xOrigin, 0);
  return buildDirectionalProjector(trajectoryPoints, props.xScale, props.yScale, {
    xExaggeration,
    xOrigin
  });
});

const frameContext = computed(() => ({
  project: project.value,
  totalMD: Number(props.totalMd),
  diameterScale: Number(props.diameterScale),
  maxProjectedRadius: Number(props.maxProjectedRadius)
}));

const resolvedPhysicsContext = computed(() => {
  if (props.physicsContext?.__physicsContext) return props.physicsContext;
  if (props.physicsContext?.value?.__physicsContext) return props.physicsContext.value;
  if (props.stateSnapshot && typeof props.stateSnapshot === 'object') {
    return createPhysicsContext(props.stateSnapshot);
  }
  return null;
});

const casingRowsByIndex = computed(() => {
  const map = new Map();
  const rows = Array.isArray(resolvedPhysicsContext.value?.casingRows) ? resolvedPhysicsContext.value.casingRows : [];
  rows.forEach((row) => {
    map.set(Number(row?.__index), row);
  });
  return map;
});

function normalizePipeType(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'casing') return 'casing';
  if (token === 'tubing') return 'tubing';
  if (token === 'drillstring' || token === 'drill-string' || token === 'drill_string') return 'drillString';
  return null;
}

function resolvePipeWallThickness(row) {
  const od = toFiniteNumber(row?.od, null);
  const innerDiameter = toFiniteNumber(row?.innerDiameter, null);
  if (!Number.isFinite(od) || !Number.isFinite(innerDiameter) || innerDiameter <= 0 || innerDiameter >= od) {
    return 0;
  }
  return ((od - innerDiameter) / 2) * Number(props.diameterScale);
}

function resolveCrossoverColor(pipeType) {
  if (pipeType === 'tubing') return 'var(--color-pipe-tubing)';
  if (pipeType === 'drillString') return 'var(--color-pipe-drillstring)';
  return 'var(--color-ink-strong)';
}

const pipeRowsByType = computed(() => {
  const context = resolvedPhysicsContext.value;
  const maps = {
    casing: new Map(),
    tubing: new Map(),
    drillString: new Map()
  };

  const addRows = (rows, type) => {
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const index = Number(row?.__index);
      if (!Number.isInteger(index)) return;
      maps[type].set(index, row);
    });
  };

  addRows(context?.casingRows, 'casing');
  addRows(context?.tubingRows, 'tubing');
  addRows(context?.drillStringRows, 'drillString');
  return maps;
});

const crossoverShapes = computed(() => {
  const context = resolvedPhysicsContext.value;
  const connections = Array.isArray(context?.connections) ? context.connections : [];
  const items = [];
  const crossoverHalfHeight = Number.isFinite(Number(props.crossoverPixelHalfHeight))
    ? Math.max(0, Number(props.crossoverPixelHalfHeight))
    : 5;

  connections.forEach((connection, connectionIndex) => {
    const pipeType = normalizePipeType(connection?.pipeType);
    if (!pipeType) return;

    const upperIndex = Number(connection?.upperIndex);
    const lowerIndex = Number(connection?.lowerIndex);
    if (!Number.isInteger(upperIndex) || !Number.isInteger(lowerIndex)) return;

    const rowMap = pipeRowsByType.value[pipeType];
    const upperRow = rowMap?.get(upperIndex) ?? null;
    const lowerRow = rowMap?.get(lowerIndex) ?? null;
    if (!upperRow || !lowerRow) return;

    const upperOuterRadius = (Number(upperRow?.od) * Number(props.diameterScale)) / 2;
    const lowerOuterRadius = (Number(lowerRow?.od) * Number(props.diameterScale)) / 2;
    if (!Number.isFinite(upperOuterRadius) || !Number.isFinite(lowerOuterRadius)) return;

    const wallThickness = Math.min(resolvePipeWallThickness(upperRow), resolvePipeWallThickness(lowerRow));
    if (!Number.isFinite(wallThickness) || wallThickness <= DIRECTIONAL_EPSILON) return;

    const topMd = toFiniteNumber(connection?.depthTop, null);
    const bottomMd = toFiniteNumber(connection?.depthBottom, null);
    if (!Number.isFinite(topMd) || !Number.isFinite(bottomMd)) return;

    const mdTop = clamp(Math.min(topMd, bottomMd), 0, Number(props.totalMd));
    const mdBottom = clamp(Math.max(topMd, bottomMd), 0, Number(props.totalMd));
    const isTightJoin = Math.abs(mdBottom - mdTop) <= DIRECTIONAL_EPSILON;
    const joinFrame = isTightJoin
      ? resolveScreenFrameAtMD(mdTop, frameContext.value)
      : null;
    if (isTightJoin && !joinFrame) return;

    [-1, 1].forEach((sideSign) => {
      const upperOuter = project.value(mdTop, sideSign * upperOuterRadius);
      const upperInner = project.value(mdTop, sideSign * (upperOuterRadius - wallThickness));
      const lowerOuter = project.value(mdBottom, sideSign * lowerOuterRadius);
      const lowerInner = project.value(mdBottom, sideSign * (lowerOuterRadius - wallThickness));
      if (!isFinitePoint(upperOuter) || !isFinitePoint(upperInner) || !isFinitePoint(lowerOuter) || !isFinitePoint(lowerInner)) {
        return;
      }

      let polygonPoints = [upperOuter, upperInner, lowerInner, lowerOuter];
      if (isTightJoin) {
        const upholeOffset = { x: -joinFrame.tangent.x * crossoverHalfHeight, y: -joinFrame.tangent.y * crossoverHalfHeight };
        const downholeOffset = { x: joinFrame.tangent.x * crossoverHalfHeight, y: joinFrame.tangent.y * crossoverHalfHeight };
        polygonPoints = [
          [upperOuter[0] + upholeOffset.x, upperOuter[1] + upholeOffset.y],
          [upperInner[0] + upholeOffset.x, upperInner[1] + upholeOffset.y],
          [lowerInner[0] + downholeOffset.x, lowerInner[1] + downholeOffset.y],
          [lowerOuter[0] + downholeOffset.x, lowerOuter[1] + downholeOffset.y]
        ];
      }

      const isOpenHoleTransition = upperRow.isOpenHole === true || lowerRow.isOpenHole === true;
      items.push({
        id: `crossover-${connectionIndex}-${pipeType}-${sideSign}`,
        points: polygonPoints.map((point) => point.join(',')).join(' '),
        fill: isOpenHoleTransition ? 'none' : resolveCrossoverColor(pipeType),
        stroke: isOpenHoleTransition ? 'var(--color-brown-accent)' : 'var(--color-ink-strong)',
        strokeDasharray: isOpenHoleTransition ? '5,5' : null
      });
    });
  });

  return items;
});

const pipeReferenceMap = computed(() => {
  const context = resolvedPhysicsContext.value;
  return buildPipeReferenceMap(context?.casingRows, context?.tubingRows);
});

function resolveScaledWallThickness(row, diameterScale) {
  if (!row) return 0;
  const od = toFiniteNumber(row.od, null);
  if (!Number.isFinite(od) || od <= 0) return 0;
  const innerDiameter = toFiniteNumber(row.innerDiameter, null) ??
    (Number.isFinite(toFiniteNumber(row.innerRadius, null)) ? toFiniteNumber(row.innerRadius, 0) * 2 : null);
  if (!Number.isFinite(innerDiameter) || innerDiameter <= 0 || innerDiameter >= od) return 0;
  return ((od - innerDiameter) / 2) * diameterScale;
}

function resolveMarkerSideSigns(marker) {
  const side = normalizeMarkerSide(marker?.side);
  const sides = [];
  if (side === MARKER_SIDE_BOTH || side === MARKER_SIDE_LEFT) sides.push(-1);
  if (side === MARKER_SIDE_BOTH || side === MARKER_SIDE_RIGHT) sides.push(1);
  if (sides.length === 0) sides.push(1);
  return sides;
}

function getStackAtMD(md) {
  const physicsContext = resolvedPhysicsContext.value;
  if (!physicsContext) return [];
  const totalMD = Math.max(0, Number(props.totalMd));
  const safeMD = clamp(md, 0, totalMD);
  return getPhysicsStackAtDepth(safeMD, physicsContext);
}

function resolveHostPipeType(hostType) {
  return hostType === PIPE_HOST_TYPE_TUBING ? 'tubing' : 'casing';
}

function resolveMarkerBaseRadiusAtMD(marker, md) {
  const stack = getStackAtMD(md);
  const hostType = normalizePipeHostType(marker?.attachToHostType, PIPE_HOST_TYPE_CASING);
  const hostPipeType = resolveHostPipeType(hostType);
  const resolvedHost = resolvePipeHostReference(marker?.attachToRow, pipeReferenceMap.value, {
    preferredId: marker?.attachToId,
    hostType
  });
  const attachIndex = Number(resolvedHost?.row?.__index);

  if (Number.isInteger(attachIndex)) {
    const attachedLayer = (stack || []).find((layer) => (
      layer?.material === 'steel' &&
      String(layer?.source?.pipeType ?? '').trim() === hostPipeType &&
      Number(layer?.source?.index) === attachIndex &&
      Number.isFinite(Number(layer?.outerRadius))
    ));
    if (attachedLayer) {
      return Number(attachedLayer.outerRadius) * Number(props.diameterScale);
    }

    const attachRow = pipeRowsByType.value?.[hostPipeType]?.get(attachIndex) ?? null;
    const attachOD = Number(attachRow?.od);
    if (Number.isFinite(attachOD) && attachOD > 0) {
      return (attachOD / 2) * Number(props.diameterScale);
    }
  }

  const activeHostOuterRadii = (stack || [])
    .filter((layer) => (
      layer?.material === 'steel' &&
      String(layer?.source?.pipeType ?? '').trim() === hostPipeType
    ))
    .map((layer) => Number(layer?.outerRadius))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (activeHostOuterRadii.length > 0) {
    return activeHostOuterRadii[0] * Number(props.diameterScale);
  }

  const activeOuterRadii = (stack || [])
    .filter((layer) => layer?.material === 'steel')
    .map((layer) => Number(layer?.outerRadius))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (activeOuterRadii.length > 0) {
    return activeOuterRadii[0] * Number(props.diameterScale);
  }

  const maxProjectedRadius = Number(props.maxProjectedRadius);
  return maxProjectedRadius > DIRECTIONAL_EPSILON ? maxProjectedRadius * 0.7 : null;
}

function buildPerforationSamples(top, bottom) {
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom < top) return [];
  if (Math.abs(bottom - top) <= DIRECTIONAL_EPSILON) return [top];

  const start = project.value(top, 0);
  const end = project.value(bottom, 0);
  let spanPixels = 0;
  if (isFinitePoint(start) && isFinitePoint(end)) {
    spanPixels = Math.hypot(end[0] - start[0], end[1] - start[1]);
  } else {
    const ratio = Math.abs(bottom - top) / Math.max(Number(props.totalMd), 1);
    spanPixels = ratio * 600;
  }

  let count = Math.round(spanPixels / PERFORATION_TARGET_SPACING_PX);
  if (!Number.isFinite(count) || count < 1) count = 1;
  const maxSymbols = Math.max(1, Number(props.maxPerforationSymbols) || 48);
  count = Math.min(maxSymbols, count);
  if (count <= 1) return [(top + bottom) / 2];

  const samples = [];
  const span = bottom - top;
  for (let i = 0; i < count; i += 1) {
    const ratio = (i + 0.5) / count;
    samples.push(top + (span * ratio));
  }
  return samples;
}

function buildPerforationSymbol(center, tangent, normal, color, scale = 1) {
  const size = 8 * scale;
  const baseHalf = size * 0.36;
  const baseOffset = size * 0.16;

  const tip = [
    center[0] + (normal.x * size),
    center[1] + (normal.y * size)
  ];
  const baseCenter = [
    center[0] - (normal.x * baseOffset),
    center[1] - (normal.y * baseOffset)
  ];
  const p1 = [
    baseCenter[0] + (tangent.x * baseHalf),
    baseCenter[1] + (tangent.y * baseHalf)
  ];
  const p2 = [
    baseCenter[0] - (tangent.x * baseHalf),
    baseCenter[1] - (tangent.y * baseHalf)
  ];

  return {
    type: 'polygon',
    points: [p1, p2, tip].map((point) => point.join(',')).join(' '),
    color
  };
}

function buildLeakSymbols(center, tangent, normal, color, scale = 1) {
  const size = 8 * scale;
  const half = size / 2;
  const a1 = [
    center[0] - (tangent.x * half) - (normal.x * half),
    center[1] - (tangent.y * half) - (normal.y * half)
  ];
  const b1 = [
    center[0] + (tangent.x * half) + (normal.x * half),
    center[1] + (tangent.y * half) + (normal.y * half)
  ];
  const a2 = [
    center[0] - (tangent.x * half) + (normal.x * half),
    center[1] - (tangent.y * half) + (normal.y * half)
  ];
  const b2 = [
    center[0] + (tangent.x * half) - (normal.x * half),
    center[1] + (tangent.y * half) - (normal.y * half)
  ];

  return [
    {
      type: 'line',
      x1: a1[0],
      y1: a1[1],
      x2: b1[0],
      y2: b1[1],
      color
    },
    {
      type: 'line',
      x1: a2[0],
      y1: a2[1],
      x2: b2[0],
      y2: b2[1],
      color
    }
  ];
}

const linerHangers = computed(() => {
  const barriers = Array.isArray(resolvedPhysicsContext.value?.barriers)
    ? resolvedPhysicsContext.value.barriers
    : [];
  const items = [];

  barriers.forEach((barrier, barrierIndex) => {
    if (barrier?.type !== 'liner_packer') return;
    const rowIndex = Number(barrier?.rowIndex);
    if (!Number.isInteger(rowIndex)) return;
    const row = casingRowsByIndex.value.get(rowIndex);
    if (!row) return;

    const parentInnerDiameter = Number(barrier?.parentInnerDiameter);
    if (!Number.isFinite(parentInnerDiameter) || parentInnerDiameter <= Number(row?.od)) return;

    const childHalfWidth = (Number(row.od) * Number(props.diameterScale)) / 2;
    const parentHalfWidth = (parentInnerDiameter * Number(props.diameterScale)) / 2;
    if (!Number.isFinite(childHalfWidth) || !Number.isFinite(parentHalfWidth)) return;
    if (parentHalfWidth <= childHalfWidth + DIRECTIONAL_EPSILON) return;

    const depthValue = Number.isFinite(Number(barrier?.depth))
      ? Number(barrier.depth)
      : Number(row?.top);
    if (!Number.isFinite(depthValue)) return;
    const md = clamp(depthValue, 0, Number(props.totalMd));
    const frame = resolveScreenFrameAtMD(md, frameContext.value);
    if (!frame) return;

    [-1, 1].forEach((sideSign) => {
      const innerStart = project.value(md, sideSign * childHalfWidth);
      const outerStart = project.value(md, sideSign * parentHalfWidth);
      if (!isFinitePoint(innerStart) || !isFinitePoint(outerStart)) return;

      const innerEnd = [
        innerStart[0] + (frame.tangent.x * LINER_HANGER_LENGTH_PX),
        innerStart[1] + (frame.tangent.y * LINER_HANGER_LENGTH_PX)
      ];
      const outerEnd = [
        outerStart[0] + (frame.tangent.x * LINER_HANGER_LENGTH_PX),
        outerStart[1] + (frame.tangent.y * LINER_HANGER_LENGTH_PX)
      ];

      items.push({
        id: `liner-${barrierIndex}-${sideSign === -1 ? 'left' : 'right'}`,
        points: [outerStart, innerStart, innerEnd, outerEnd].map((point) => point.join(',')).join(' ')
      });
    });
  });

  return items;
});

const floatShoes = computed(() => {
  const rows = Array.isArray(resolvedPhysicsContext.value?.casingRows)
    ? resolvedPhysicsContext.value.casingRows
    : [];
  const items = [];

  rows.forEach((row) => {
    if (isOpenHoleRow(row)) return;
    if (!Number.isFinite(row?.top) || !Number.isFinite(row?.bottom) || row.bottom <= row.top) return;

    const wallThickness = resolveScaledWallThickness(row, Number(props.diameterScale));
    if (!Number.isFinite(wallThickness) || wallThickness <= DIRECTIONAL_EPSILON) return;

    const halfWidth = (Number(row.od) * Number(props.diameterScale)) / 2;
    if (!Number.isFinite(halfWidth) || halfWidth <= DIRECTIONAL_EPSILON) return;

    const innerHalf = Math.max(halfWidth - wallThickness, DIRECTIONAL_EPSILON);
    const md = clamp(Number(row.bottom), 0, Number(props.totalMd));
    const frame = resolveScreenFrameAtMD(md, frameContext.value);
    if (!frame) return;
    const uphole = { x: -frame.tangent.x, y: -frame.tangent.y };

    [-1, 1].forEach((sideSign) => {
      const outer = project.value(md, sideSign * halfWidth);
      const inner = project.value(md, sideSign * innerHalf);
      if (!isFinitePoint(outer) || !isFinitePoint(inner)) return;

      const tip = [
        inner[0] + (uphole.x * FLOAT_SHOE_LENGTH_PX),
        inner[1] + (uphole.y * FLOAT_SHOE_LENGTH_PX)
      ];
      items.push({
        id: `shoe-${row.__index}-${sideSign === -1 ? 'left' : 'right'}`,
        points: [tip, inner, outer].map((point) => point.join(',')).join(' ')
      });
    });
  });

  return items;
});

const markerShapes = computed(() => {
  const markers = Array.isArray(props.markers) ? props.markers : [];
  const items = [];

  markers.forEach((marker, markerIndex) => {
    if (marker?.show === false) return;
    const topRaw = toFiniteNumber(marker?.top, null);
    const bottomRaw = toFiniteNumber(marker?.bottom, null);
    if (!Number.isFinite(topRaw) || !Number.isFinite(bottomRaw) || bottomRaw < topRaw) return;

    const top = clamp(topRaw, 0, Number(props.totalMd));
    const bottom = clamp(bottomRaw, 0, Number(props.totalMd));
    if (bottom < top) return;

    const markerType = normalizeMarkerType(marker?.type);
    const isLeak = markerType === LEAK_MARKER_TYPE;
    const markerColor = marker?.color || (isLeak ? MARKER_DEFAULT_COLORS.Leak : MARKER_DEFAULT_COLORS.Perforation);
    const scaleRaw = Number(marker?.scale);
    const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1.0;
    const sideSigns = resolveMarkerSideSigns(marker);

    if (isLeak) {
      const md = clamp((top + bottom) / 2, 0, Number(props.totalMd));
      const frame = resolveScreenFrameAtMD(md, frameContext.value);
      if (!frame) return;
      const baseRadius = resolveMarkerBaseRadiusAtMD(marker, md);
      if (!Number.isFinite(baseRadius)) return;

      sideSigns.forEach((sideSign) => {
        const wallPoint = project.value(md, sideSign * baseRadius);
        if (!isFinitePoint(wallPoint)) return;
        const outward = sideSign === 1
          ? frame.normal
          : { x: -frame.normal.x, y: -frame.normal.y };
        const center = [
          wallPoint[0] + (outward.x * 5 * scale),
          wallPoint[1] + (outward.y * 5 * scale)
        ];
        items.push(...buildLeakSymbols(center, frame.tangent, outward, markerColor, scale).map((shape, index) => ({
          ...shape,
          id: `marker-leak-${markerIndex}-${sideSign}-${index}`,
          markerIndex
        })));
      });
      return;
    }

    const samplePoints = top === bottom
      ? [top]
      : buildPerforationSamples(top, bottom);

    samplePoints.forEach((md, sampleIndex) => {
      const frame = resolveScreenFrameAtMD(md, frameContext.value);
      if (!frame) return;
      const baseRadius = resolveMarkerBaseRadiusAtMD(marker, md);
      if (!Number.isFinite(baseRadius)) return;

      sideSigns.forEach((sideSign) => {
        const wallPoint = project.value(md, sideSign * baseRadius);
        if (!isFinitePoint(wallPoint)) return;
        const outward = sideSign === 1
          ? frame.normal
          : { x: -frame.normal.x, y: -frame.normal.y };
        const symbolOffset = Math.max(2.5 * scale, 2);
        const center = [
          wallPoint[0] + (outward.x * symbolOffset),
          wallPoint[1] + (outward.y * symbolOffset)
        ];
        items.push({
          ...buildPerforationSymbol(center, frame.tangent, outward, markerColor, scale),
          id: `marker-perf-${markerIndex}-${sampleIndex}-${sideSign}`,
          markerIndex
        });
      });
    });
  });

  return items;
});
</script>

<template>
  <g class="directional-decoration-layer">
    <polygon
      v-for="crossover in crossoverShapes"
      :key="crossover.id"
      class="directional-decoration-layer__crossover"
      :points="crossover.points"
      :fill="crossover.fill"
      :stroke="crossover.stroke"
      :stroke-dasharray="crossover.strokeDasharray"
    />

    <polygon
      v-for="hanger in linerHangers"
      :key="hanger.id"
      class="directional-decoration-layer__liner-hanger"
      :points="hanger.points"
    />

    <polygon
      v-for="shoe in floatShoes"
      :key="shoe.id"
      class="directional-decoration-layer__float-shoe"
      :points="shoe.points"
    />

    <template v-for="shape in markerShapes" :key="shape.id">
      <template v-if="shape.type === 'polygon'">
        <polygon
          class="directional-decoration-layer__marker-perf-hit"
          :data-marker-index="shape.markerIndex"
          :points="shape.points"
          @mousemove="handleMarkerHover(shape, $event)"
          @mouseleave="handleMarkerLeave(shape)"
          @click="handleMarkerSelect(shape)"
        />
        <polygon
          class="directional-decoration-layer__marker-perf"
          :data-marker-index="shape.markerIndex"
          :points="shape.points"
          :fill="shape.color"
          @mousemove="handleMarkerHover(shape, $event)"
          @mouseleave="handleMarkerLeave(shape)"
          @click="handleMarkerSelect(shape)"
        />
      </template>
      <template v-else-if="shape.type === 'line'">
        <line
          class="directional-decoration-layer__marker-leak-hit"
          :data-marker-index="shape.markerIndex"
          :x1="shape.x1"
          :y1="shape.y1"
          :x2="shape.x2"
          :y2="shape.y2"
          @mousemove="handleMarkerHover(shape, $event)"
          @mouseleave="handleMarkerLeave(shape)"
          @click="handleMarkerSelect(shape)"
        />
        <line
          class="directional-decoration-layer__marker-leak"
          :data-marker-index="shape.markerIndex"
          :x1="shape.x1"
          :y1="shape.y1"
          :x2="shape.x2"
          :y2="shape.y2"
          :stroke="shape.color"
          @mousemove="handleMarkerHover(shape, $event)"
          @mouseleave="handleMarkerLeave(shape)"
          @click="handleMarkerSelect(shape)"
        />
      </template>
    </template>
  </g>
</template>

<style scoped>
.directional-decoration-layer__crossover {
  stroke-width: 1;
  pointer-events: none;
}

.directional-decoration-layer__liner-hanger,
.directional-decoration-layer__float-shoe {
  fill: var(--color-ink-strong);
  stroke: none;
  pointer-events: none;
}

.directional-decoration-layer__marker-perf,
.directional-decoration-layer__marker-leak {
  pointer-events: auto;
  cursor: pointer;
}

.directional-decoration-layer__marker-perf-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 10;
  pointer-events: stroke;
  cursor: pointer;
}

.directional-decoration-layer__marker-leak-hit {
  stroke: transparent;
  stroke-width: 12;
  stroke-linecap: round;
  pointer-events: stroke;
  cursor: pointer;
}

.directional-decoration-layer__marker-leak {
  stroke-width: 2;
}
</style>
