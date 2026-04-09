<script setup>
import { computed } from 'vue';
import { isOpenHoleRow } from '@/app/domain.js';
import { resolveOpenHoleWaveConfig } from '@/utils/openHoleWave.js';
import { generateWavyPath } from '@/utils/wavyPath.js';

const BOUNDARY_HIT_TARGET_STROKE_WIDTH = 24;
const EPSILON = 1e-6;

const props = defineProps({
  slices: {
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
  }
});

const emit = defineEmits(['select-pipe', 'hover-pipe', 'leave-pipe']);

function resolveSourceRowIndex(source = null) {
  const sourceIndex = Number(source?.sourceIndex);
  if (Number.isInteger(sourceIndex) && sourceIndex >= 0) return sourceIndex;
  const index = Number(source?.index);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function resolveBoundaryCasingRowIndex(layer = null) {
  const innerPipeSourceIndex = Number(layer?.innerPipe?.sourceIndex);
  if (Number.isInteger(innerPipeSourceIndex) && innerPipeSourceIndex >= 0) {
    return innerPipeSourceIndex;
  }

  const innerPipeIndex = Number(layer?.innerPipe?.__index);
  if (Number.isInteger(innerPipeIndex) && innerPipeIndex >= 0) {
    return innerPipeIndex;
  }

  return resolveSourceRowIndex(layer?.source);
}

function serializePipeEntity(rowIndex) {
  const normalizedRowIndex = Number(rowIndex);
  if (!Number.isInteger(normalizedRowIndex) || normalizedRowIndex < 0) return null;
  return `casing:${normalizedRowIndex}`;
}

const boundarySegments = computed(() => {
  const slices = Array.isArray(props.slices) ? props.slices : [];
  const casingRows = Array.isArray(props.casingData) ? props.casingData : [];
  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  const segments = [];

  slices.forEach((slice, sliceIndex) => {
    const top = Number(slice?.top);
    const bottom = Number(slice?.bottom);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;

    const yTop = props.yScale(top);
    const yBottom = props.yScale(bottom);
    const height = yBottom - yTop;
    if (!Number.isFinite(height) || height <= 0) return;

    const stack = Array.isArray(slice?.stack) ? slice.stack : [];
    stack.forEach((layer, layerIndex) => {
      if (layer?.isOpenHoleBoundary !== true) return;

      const rowIndex = resolveBoundaryCasingRowIndex(layer);
      if (!Number.isInteger(rowIndex)) return;

      const sourceRow = casingRows[rowIndex] ?? null;
      if (isOpenHoleRow(sourceRow)) return;

      const outerRadius = Number(layer?.outerRadius);
      if (!Number.isFinite(outerRadius) || outerRadius <= EPSILON) return;
      const outerScaled = outerRadius * diameterScale;

      const leftBoundaryX = props.xScale(-outerScaled);
      const rightBoundaryX = props.xScale(outerScaled);
      if (!Number.isFinite(leftBoundaryX) || !Number.isFinite(rightBoundaryX)) return;

      const openHoleWave = resolveOpenHoleWaveConfig(sourceRow);
      const seedBase = ((sliceIndex + 1) * 4099) + ((layerIndex + 1) * 131) + (rowIndex * 17);
      const leftWavyPath = generateWavyPath(
        [[leftBoundaryX, yTop], [leftBoundaryX, yBottom]],
        {
          amplitude: openHoleWave.amplitude,
          wavelength: openHoleWave.wavelength,
          seed: seedBase
        }
      );
      const rightWavyPath = generateWavyPath(
        [[rightBoundaryX, yTop], [rightBoundaryX, yBottom]],
        {
          amplitude: openHoleWave.amplitude,
          wavelength: openHoleWave.wavelength,
          seed: seedBase + 0.5
        }
      );

      if (!leftWavyPath || !rightWavyPath) return;

      const pipeEntity = { pipeType: 'casing', rowIndex };
      const pipeKey = serializePipeEntity(rowIndex);

      segments.push({
        id: `open-hole-boundary-${sliceIndex}-${layerIndex}-${rowIndex}`,
        pipeEntity,
        pipeKey,
        isSelectable: Boolean(pipeKey),
        rowIndex,
        leftWavyPath,
        rightWavyPath
      });
    });
  });

  return segments;
});
</script>

<template>
  <g class="vertical-open-hole-boundary-layer">
    <g
      v-for="segment in boundarySegments"
      :key="segment.id"
      class="vertical-open-hole-boundary-layer__segment"
    >
      <path
        class="vertical-open-hole-boundary-layer__wall"
        :d="segment.leftWavyPath"
      />
      <path
        class="vertical-open-hole-boundary-layer__wall"
        :d="segment.rightWavyPath"
      />
      <path
        class="vertical-open-hole-boundary-layer__hit-target"
        :data-pipe-key="segment.isSelectable ? segment.pipeKey : null"
        :data-casing-index="segment.isSelectable ? segment.rowIndex : null"
        :d="segment.leftWavyPath"
        :stroke-width="BOUNDARY_HIT_TARGET_STROKE_WIDTH"
        @click="segment.isSelectable && emit('select-pipe', segment.pipeEntity)"
        @mousemove="segment.isSelectable && emit('hover-pipe', segment.pipeEntity, $event)"
        @mouseleave="segment.isSelectable && emit('leave-pipe', segment.pipeEntity)"
      />
      <path
        class="vertical-open-hole-boundary-layer__hit-target"
        :data-pipe-key="segment.isSelectable ? segment.pipeKey : null"
        :data-casing-index="segment.isSelectable ? segment.rowIndex : null"
        :d="segment.rightWavyPath"
        :stroke-width="BOUNDARY_HIT_TARGET_STROKE_WIDTH"
        @click="segment.isSelectable && emit('select-pipe', segment.pipeEntity)"
        @mousemove="segment.isSelectable && emit('hover-pipe', segment.pipeEntity, $event)"
        @mouseleave="segment.isSelectable && emit('leave-pipe', segment.pipeEntity)"
      />
    </g>
  </g>
</template>

<style scoped>
.vertical-open-hole-boundary-layer__wall {
  stroke: var(--color-brown-accent);
  stroke-width: 2;
  fill: none;
  pointer-events: none;
}

.vertical-open-hole-boundary-layer__hit-target {
  fill: none;
  stroke: transparent;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: auto;
}
</style>
