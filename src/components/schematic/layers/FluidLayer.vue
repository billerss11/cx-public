<script setup>
import { computed } from 'vue';
import { resolveVerticalFluidFill } from './verticalHatchPatterns.js';

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
  fluids: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['select-fluid', 'hover-fluid', 'leave-fluid']);

const fluidSegments = computed(() => {
  const slices = Array.isArray(props.slices) ? props.slices : [];
  const fluids = Array.isArray(props.fluids) ? props.fluids : [];
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
      if (layer?.role !== 'annulus' || layer?.material !== 'fluid') return;

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

      const fill = resolveVerticalFluidFill(layer, fluids);

      segments.push({
        id: `fluid-${sliceIndex}-${layerIndex}-left`,
        x: leftOuterX,
        y: yTop,
        width: widthLeft,
        height,
        fill,
        index: Number(layer?.source?.index)
      });

      segments.push({
        id: `fluid-${sliceIndex}-${layerIndex}-right`,
        x: rightInnerX,
        y: yTop,
        width: widthRight,
        height,
        fill,
        index: Number(layer?.source?.index)
      });
    });
  });

  return segments;
});
</script>

<template>
  <g class="fluid-layer">
    <rect
      v-for="segment in fluidSegments"
      :key="segment.id"
      class="fluid-layer__segment"
      :data-fluid-index="Number.isInteger(segment.index) ? segment.index : null"
      :x="segment.x"
      :y="segment.y"
      :width="segment.width"
      :height="segment.height"
      :fill="segment.fill"
      @click="Number.isInteger(segment.index) && emit('select-fluid', segment.index)"
      @mousemove="Number.isInteger(segment.index) && emit('hover-fluid', segment.index, $event)"
      @mouseleave="Number.isInteger(segment.index) && emit('leave-fluid', segment.index)"
    />
  </g>
</template>

<style scoped>
.fluid-layer__segment {
  cursor: pointer;
  stroke: var(--color-ink-soft);
  stroke-width: 0.4;
  opacity: 0.85;
}
</style>
