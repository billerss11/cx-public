<script setup>
import { computed } from 'vue';
import { DEFAULT_CEMENT_COLOR } from '@/constants/index.js';
import { resolveVerticalCementPattern } from './verticalHatchPatterns.js';

const props = defineProps({
  slices: {
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
  cementColor: {
    type: String,
    default: 'lightgray'
  },
  cementHatchEnabled: {
    type: Boolean,
    default: false
  },
  cementHatchStyle: {
    type: String,
    default: 'none'
  },
  showCement: {
    type: Boolean,
    default: true
  }
});

const cementPattern = computed(() => {
  return resolveVerticalCementPattern({
    showCement: props.showCement,
    cementHatchEnabled: props.cementHatchEnabled,
    cementHatchStyle: props.cementHatchStyle,
    cementColor: props.cementColor
  });
});

const cementFill = computed(() => (
  cementPattern.value ? `url(#${cementPattern.value.id})` : (props.cementColor || DEFAULT_CEMENT_COLOR)
));

const cementSegments = computed(() => {
  if (props.showCement !== true) return [];

  const slices = Array.isArray(props.slices) ? props.slices : [];
  const diameterScale = Number.isFinite(Number(props.diameterScale)) && Number(props.diameterScale) > 0
    ? Number(props.diameterScale)
    : 1;
  const segments = [];

  slices.forEach((slice, sliceIndex) => {
    const yTop = props.yScale(Number(slice?.top));
    const yBottom = props.yScale(Number(slice?.bottom));
    const height = yBottom - yTop;
    if (!Number.isFinite(height) || height <= 0) return;

    (Array.isArray(slice?.stack) ? slice.stack : []).forEach((layer, layerIndex) => {
      if (layer?.role !== 'annulus' || layer?.material !== 'cement') return;

      const inner = Number(layer?.innerRadius);
      const outer = Number(layer?.outerRadius);
      if (!Number.isFinite(inner) || !Number.isFinite(outer) || outer <= inner) return;

      const innerScaled = inner * diameterScale;
      const outerScaled = outer * diameterScale;
      const leftOuterX = props.xScale(-outerScaled);
      const leftInnerX = props.xScale(-innerScaled);
      const rightInnerX = props.xScale(innerScaled);
      const rightOuterX = props.xScale(outerScaled);
      const widthLeft = leftInnerX - leftOuterX;
      const widthRight = rightOuterX - rightInnerX;
      if (widthLeft <= 0 || widthRight <= 0) return;

      segments.push({
        id: `cement-${sliceIndex}-${layerIndex}-left`,
        x: leftOuterX,
        y: yTop,
        width: widthLeft,
        height
      });

      segments.push({
        id: `cement-${sliceIndex}-${layerIndex}-right`,
        x: rightInnerX,
        y: yTop,
        width: widthRight,
        height
      });
    });
  });

  return segments;
});
</script>

<template>
  <g class="cement-layer">
    <rect
      v-for="segment in cementSegments"
      :key="segment.id"
      class="cement-layer__segment"
      :x="segment.x"
      :y="segment.y"
      :width="segment.width"
      :height="segment.height"
      :fill="cementFill"
    />
  </g>
</template>

<style scoped>
.cement-layer__segment {
  stroke: none;
  opacity: 0.9;
}
</style>
