<script setup>
import { computed } from 'vue';
import { clamp, formatDepthValue } from '@/utils/general.js';
import {
  buildDirectionalProjector,
  normalizeXExaggeration,
  resolveScreenFrameAtMD
} from './directionalProjection.js';

const TICK_HALF_LENGTH_PX = 5;
const LABEL_OFFSET_PX = 7;

const props = defineProps({
  intervals: {
    type: Array,
    default: () => []
  },
  trajectoryPoints: {
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
  xExaggeration: {
    type: Number,
    default: 1
  },
  xOrigin: {
    type: Number,
    default: 0
  }
});

const project = computed(() => buildDirectionalProjector(
  Array.isArray(props.trajectoryPoints) ? props.trajectoryPoints : [],
  props.xScale,
  props.yScale,
  {
    xExaggeration: normalizeXExaggeration(props.xExaggeration),
    xOrigin: Number(props.xOrigin)
  }
));

const frameContext = computed(() => ({
  project: project.value,
  totalMD: Math.max(0, Number(props.totalMd))
}));

const debugTicks = computed(() => {
  const intervals = Array.isArray(props.intervals) ? props.intervals : [];
  const maxMd = Math.max(0, Number(props.totalMd));
  if (intervals.length === 0 || maxMd <= 0) return [];

  return intervals
    .map((interval, index) => {
      const boundaryMd = Number(interval?.bottom);
      if (!Number.isFinite(boundaryMd)) return null;
      const md = clamp(boundaryMd, 0, maxMd);
      const frame = resolveScreenFrameAtMD(md, frameContext.value);
      if (!frame) return null;

      const centerX = frame.center[0];
      const centerY = frame.center[1];
      const normalX = frame.normal.x;
      const normalY = frame.normal.y;
      const labelDistance = TICK_HALF_LENGTH_PX + LABEL_OFFSET_PX;

      return {
        id: `${md}-${index}`,
        md,
        x1: centerX - (normalX * TICK_HALF_LENGTH_PX),
        y1: centerY - (normalY * TICK_HALF_LENGTH_PX),
        x2: centerX + (normalX * TICK_HALF_LENGTH_PX),
        y2: centerY + (normalY * TICK_HALF_LENGTH_PX),
        centerX,
        centerY,
        labelX: centerX + (normalX * labelDistance),
        labelY: centerY + (normalY * labelDistance),
        textAnchor: normalX >= 0 ? 'start' : 'end'
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="directional-physics-debug-layer" aria-label="Directional physics interval boundaries">
    <g v-for="tick in debugTicks" :key="tick.id">
      <line
        :x1="tick.x1"
        :y1="tick.y1"
        :x2="tick.x2"
        :y2="tick.y2"
        class="directional-physics-debug-layer__tick"
      />
      <circle :cx="tick.centerX" :cy="tick.centerY" r="1.5" class="directional-physics-debug-layer__point" />
      <text
        :x="tick.labelX"
        :y="tick.labelY"
        class="directional-physics-debug-layer__label"
        dominant-baseline="middle"
        :text-anchor="tick.textAnchor"
      >
        MD {{ formatDepthValue(tick.md) }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.directional-physics-debug-layer__tick {
  stroke: var(--color-physics-debug-line);
  stroke-width: 1;
  opacity: 0.7;
}

.directional-physics-debug-layer__point {
  fill: var(--color-physics-debug-line);
  opacity: 0.85;
}

.directional-physics-debug-layer__label {
  fill: var(--color-physics-debug-fill);
  font-size: 10px;
}
</style>
