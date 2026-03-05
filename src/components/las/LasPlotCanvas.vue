<script setup>
defineOptions({ name: 'LasPlotCanvas' });

import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { clearLasSurface, renderLasPlot } from '@/utils/lasPlotRenderer.js';

const props = defineProps({
  data: {
    type: Object,
    default: null,
  },
});

const surfaceRef = useTemplateRef('surface');
let resizeObserver = null;

function renderSurface() {
  const surface = surfaceRef.value;
  if (!surface) return;
  renderLasPlot(surface, props.data);
}

watch(
  () => props.data,
  async () => {
    await nextTick();
    renderSurface();
  },
  { immediate: true }
);

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return;
  const surface = surfaceRef.value;
  if (!surface) return;
  resizeObserver = new ResizeObserver(() => {
    renderSurface();
  });
  resizeObserver.observe(surface);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
  resizeObserver = null;
  clearLasSurface(surfaceRef.value);
});
</script>

<template>
  <div ref="surface" class="las-plot-canvas"></div>
</template>

<style scoped>
.las-plot-canvas {
  height: 100%;
}
</style>
