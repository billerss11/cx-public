<script setup>
import { computed } from 'vue';
import { MARKER_DEFAULT_COLORS } from '@/constants/index.js';
import { normalizeMarkerSide, normalizeMarkerType } from '@/app/domain.js';
import {
  buildPipeReferenceMap,
  normalizePipeHostType,
  PIPE_HOST_TYPE_CASING,
  PIPE_HOST_TYPE_TUBING,
  resolvePipeHostReference
} from '@/utils/pipeReference.js';

const props = defineProps({
  markers: {
    type: Array,
    default: () => []
  },
  casingData: {
    type: Array,
    default: () => []
  },
  tubingData: {
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
  maxPerforationSymbols: {
    type: Number,
    default: 48
  }
});

const emit = defineEmits(['select-marker', 'hover-marker', 'leave-marker']);
const MARKER_HITBOX_PADDING = 6;

function getMarkerBaseRadiusAtDepth(depth, hostRows = [], diameterScale = 1) {
  if (!Number.isFinite(depth)) return null;
  const candidates = hostRows
    .filter((row) => Number.isFinite(row?.top) && Number.isFinite(row?.bottom) && row.top < depth && depth < row.bottom)
    .filter((row) => Number.isFinite(row?.od) && row.od > 0);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Number(a.od) - Number(b.od));
  const selected = candidates[0];
  return selected ? (Number(selected.od) / 2) * diameterScale : null;
}

function resolveHostRows(hostType, casingRows, tubingRows) {
  if (hostType === PIPE_HOST_TYPE_TUBING) {
    return tubingRows;
  }
  return casingRows;
}

function getMarkerBaseRadius(marker, depth, pipeReferenceMap, casingRows, tubingRows, diameterScale = 1) {
  const hostType = normalizePipeHostType(marker?.attachToHostType, PIPE_HOST_TYPE_CASING);
  const attachToId = String(marker?.attachToId ?? '').trim();
  const attachToRow = String(marker?.attachToRow ?? '').trim();
  const resolvedHost = resolvePipeHostReference(attachToRow, pipeReferenceMap, {
    preferredId: attachToId,
    hostType
  });

  if (resolvedHost?.row && Number.isFinite(resolvedHost.row.od) && Number(resolvedHost.row.od) > 0) {
    return (Number(resolvedHost.row.od) / 2) * diameterScale;
  }

  const hostRows = resolveHostRows(hostType, casingRows, tubingRows);
  return getMarkerBaseRadiusAtDepth(depth, hostRows, diameterScale);
}

function splitMarkerInterval(top, bottom, hostRows = []) {
  const boundaries = [];
  hostRows.forEach((row) => {
    if (Number.isFinite(row?.top) && row.top > top && row.top < bottom) {
      boundaries.push(Number(row.top));
    }
    if (Number.isFinite(row?.bottom) && row.bottom > top && row.bottom < bottom) {
      boundaries.push(Number(row.bottom));
    }
  });
  const unique = Array.from(new Set(boundaries)).sort((a, b) => a - b);
  const points = [top, ...unique, bottom];
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const segTop = points[index];
    const segBottom = points[index + 1];
    if (segBottom > segTop) {
      segments.push({ top: segTop, bottom: segBottom });
    }
  }
  return segments;
}

function createPerforationShapes(segment, baseRadius, marker, xScale, yScale, maxPerforationSymbols) {
  const triHeight = 12;
  const scaleRaw = Number(marker?.scale);
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1.0;
  const triWidth = 16 * scale;
  const yTop = yScale(segment.top);
  const yBottom = yScale(segment.bottom);
  const count = Math.max(1, Math.floor((yBottom - yTop) / triHeight));
  const symbolCount = Math.min(Math.max(1, Number(maxPerforationSymbols) || 48), count);
  const side = normalizeMarkerSide(marker?.side);
  const bothSideToken = normalizeMarkerSide('Both sides');
  const leftSideToken = normalizeMarkerSide('Left');
  const rightSideToken = normalizeMarkerSide('Right');
  const fillColor = marker?.color || MARKER_DEFAULT_COLORS.Perforation;
  const shapes = [];

  for (let index = 0; index <= symbolCount; index += 1) {
    const y = yTop + index * triHeight;
    const yNext = Math.min(y + triHeight, yBottom);
    if (y >= yBottom) break;
    const yMid = y + (yNext - y) / 2;

    if (side === bothSideToken || side === leftSideToken) {
      const leftPoints = [
        [xScale(-baseRadius), y],
        [xScale(-baseRadius), yNext],
        [xScale(-baseRadius - triWidth), yMid]
      ];
      shapes.push({
        type: 'polygon',
        points: leftPoints.map((point) => point.join(',')).join(' '),
        fill: fillColor
      });
    }

    if (side === bothSideToken || side === rightSideToken) {
      const rightPoints = [
        [xScale(baseRadius), y],
        [xScale(baseRadius), yNext],
        [xScale(baseRadius + triWidth), yMid]
      ];
      shapes.push({
        type: 'polygon',
        points: rightPoints.map((point) => point.join(',')).join(' '),
        fill: fillColor
      });
    }
  }

  return shapes;
}

function createLeakShapes(segment, baseRadius, marker, xScale, yScale) {
  const scaleRaw = Number(marker?.scale);
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1.0;
  const size = 8 * scale;
  const y = yScale((segment.top + segment.bottom) / 2);
  const side = normalizeMarkerSide(marker?.side);
  const bothSideToken = normalizeMarkerSide('Both sides');
  const leftSideToken = normalizeMarkerSide('Left');
  const rightSideToken = normalizeMarkerSide('Right');
  const strokeColor = marker?.color || MARKER_DEFAULT_COLORS.Leak;
  const shapes = [];

  const drawX = (centerX) => {
    shapes.push({
      type: 'line',
      x1: xScale(centerX - size / 2),
      y1: y - size / 2,
      x2: xScale(centerX + size / 2),
      y2: y + size / 2,
      stroke: strokeColor,
      strokeWidth: 2
    });
    shapes.push({
      type: 'line',
      x1: xScale(centerX - size / 2),
      y1: y + size / 2,
      x2: xScale(centerX + size / 2),
      y2: y - size / 2,
      stroke: strokeColor,
      strokeWidth: 2
    });
  };

  if (side === bothSideToken || side === leftSideToken) {
    drawX(-baseRadius - size / 2);
  }
  if (side === bothSideToken || side === rightSideToken) {
    drawX(baseRadius + size / 2);
  }

  return shapes;
}

function expandBounds(bounds, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return bounds;
  if (!bounds) {
    return { minX: x, maxX: x, minY: y, maxY: y };
  }
  return {
    minX: Math.min(bounds.minX, x),
    maxX: Math.max(bounds.maxX, x),
    minY: Math.min(bounds.minY, y),
    maxY: Math.max(bounds.maxY, y)
  };
}

function resolveShapeBounds(shape) {
  if (!shape || typeof shape !== 'object') return null;
  if (shape.type === 'line') {
    const halfWidth = Math.max(1, Number(shape.strokeWidth) || 1) / 2;
    return {
      minX: Math.min(Number(shape.x1), Number(shape.x2)) - halfWidth,
      maxX: Math.max(Number(shape.x1), Number(shape.x2)) + halfWidth,
      minY: Math.min(Number(shape.y1), Number(shape.y2)) - halfWidth,
      maxY: Math.max(Number(shape.y1), Number(shape.y2)) + halfWidth
    };
  }
  if (shape.type === 'polygon') {
    const rawPoints = String(shape.points ?? '').trim();
    if (!rawPoints) return null;
    let bounds = null;
    rawPoints.split(/\s+/).forEach((pair) => {
      const [rawX, rawY] = pair.split(',');
      const x = Number(rawX);
      const y = Number(rawY);
      bounds = expandBounds(bounds, x, y);
    });
    return bounds;
  }
  return null;
}

const markerGroups = computed(() => {
  const markers = Array.isArray(props.markers) ? props.markers : [];
  const casingRows = Array.isArray(props.casingData) ? props.casingData : [];
  const tubingRows = Array.isArray(props.tubingData) ? props.tubingData : [];
  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  const pipeReferenceMap = buildPipeReferenceMap(casingRows, tubingRows);
  const leakToken = normalizeMarkerType('Leak');

  return markers
    .map((marker, markerIndex) => {
      if (marker?.show === false) return null;
      const top = Number(marker?.top);
      const bottom = Number(marker?.bottom);
      if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;

      const markerType = normalizeMarkerType(marker?.type);
      const isLeak = markerType === leakToken;
      if (bottom < top) return null;
      if (!isLeak && bottom === top) return null;

      const segments = (isLeak && bottom === top)
        ? [{ top, bottom }]
        : splitMarkerInterval(
          top,
          bottom,
          resolveHostRows(
            normalizePipeHostType(marker?.attachToHostType, PIPE_HOST_TYPE_CASING),
            casingRows,
            tubingRows
          )
        );
      const shapes = [];

      segments.forEach((segment) => {
        const centerDepth = (segment.top + segment.bottom) / 2;
        const baseRadius = getMarkerBaseRadius(
          marker,
          centerDepth,
          pipeReferenceMap,
          casingRows,
          tubingRows,
          diameterScale
        );
        if (!Number.isFinite(baseRadius)) return;

        if (isLeak) {
          shapes.push(...createLeakShapes(segment, baseRadius, marker, props.xScale, props.yScale));
        } else {
          shapes.push(...createPerforationShapes(
            segment,
            baseRadius,
            marker,
            props.xScale,
            props.yScale,
            props.maxPerforationSymbols
          ));
        }
      });

      if (shapes.length === 0) return null;
      const shapeBounds = shapes
        .map((shape) => resolveShapeBounds(shape))
        .filter(Boolean)
        .reduce((accumulator, current) => {
          if (!accumulator) return current;
          return {
            minX: Math.min(accumulator.minX, current.minX),
            maxX: Math.max(accumulator.maxX, current.maxX),
            minY: Math.min(accumulator.minY, current.minY),
            maxY: Math.max(accumulator.maxY, current.maxY)
          };
        }, null);
      if (!shapeBounds) return null;

      return {
        id: `marker-${markerIndex}`,
        index: markerIndex,
        shapes,
        hitbox: {
          x: shapeBounds.minX - MARKER_HITBOX_PADDING,
          y: shapeBounds.minY - MARKER_HITBOX_PADDING,
          width: Math.max(8, (shapeBounds.maxX - shapeBounds.minX) + (MARKER_HITBOX_PADDING * 2)),
          height: Math.max(8, (shapeBounds.maxY - shapeBounds.minY) + (MARKER_HITBOX_PADDING * 2))
        }
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="marker-layer">
    <g
      v-for="group in markerGroups"
      :key="group.id"
      class="marker-layer__group"
      :data-marker-index="group.index"
      @click="emit('select-marker', group.index)"
      @mousemove="emit('hover-marker', group.index, $event)"
      @mouseleave="emit('leave-marker', group.index)"
    >
      <rect
        class="marker-layer__hitbox"
        :x="group.hitbox.x"
        :y="group.hitbox.y"
        :width="group.hitbox.width"
        :height="group.hitbox.height"
      />

      <template v-for="(shape, shapeIndex) in group.shapes" :key="`${group.id}-${shapeIndex}`">
        <polygon
          v-if="shape.type === 'polygon'"
          class="marker-layer__triangle"
          :points="shape.points"
          :fill="shape.fill"
        />
        <line
          v-else-if="shape.type === 'line'"
          class="marker-layer__leak"
          :x1="shape.x1"
          :y1="shape.y1"
          :x2="shape.x2"
          :y2="shape.y2"
          :stroke="shape.stroke"
          :stroke-width="shape.strokeWidth"
        />
      </template>
    </g>
  </g>
</template>

<style scoped>
.marker-layer__group {
  cursor: pointer;
}

.marker-layer__hitbox {
  fill: transparent;
  stroke: none;
  pointer-events: none;
}
</style>
