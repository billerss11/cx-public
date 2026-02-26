<script setup>
import { computed } from 'vue';

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
  }
});

const MATERIAL_STYLE = Object.freeze({
  wellbore: { fill: 'var(--color-cross-core-fill)', opacity: 1.0 },
  mud: { fill: 'var(--color-cross-annulus-fill)', opacity: 0.75 }
});

const baseSegments = computed(() => {
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
      if (layer?.role !== 'core' && layer?.role !== 'annulus') return;
      const style = MATERIAL_STYLE[layer?.material];
      if (!style) return;

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
        id: `base-${sliceIndex}-${layerIndex}-left`,
        x: leftOuterX,
        y: yTop,
        width: widthLeft,
        height,
        fill: style.fill,
        opacity: style.opacity
      });

      segments.push({
        id: `base-${sliceIndex}-${layerIndex}-right`,
        x: rightInnerX,
        y: yTop,
        width: widthRight,
        height,
        fill: style.fill,
        opacity: style.opacity
      });
    });
  });

  return segments;
});
</script>

<template>
  <g class="base-fill-layer">
    <rect
      v-for="segment in baseSegments"
      :key="segment.id"
      class="base-fill-layer__segment"
      :x="segment.x"
      :y="segment.y"
      :width="segment.width"
      :height="segment.height"
      :fill="segment.fill"
      :opacity="segment.opacity"
    />
  </g>
</template>

<style scoped>
.base-fill-layer__segment {
  stroke: none;
}
</style>
