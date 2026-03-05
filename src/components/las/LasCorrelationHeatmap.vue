<script setup>
defineOptions({ name: 'LasCorrelationHeatmap' });

import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { clearLasSurface } from '@/utils/lasPlotRenderer.js';
import { renderLasCorrelationHeatmap } from '@/utils/lasCorrelationHeatmapRenderer.js';

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
  renderLasCorrelationHeatmap(surface, props.data);
}

watch(
  () => props.data,
  async () => {
    await nextTick();
    renderSurface();
  },
  { immediate: true, deep: true }
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
  <div ref="surface" class="las-correlation-heatmap"></div>
</template>

<style scoped>
.las-correlation-heatmap {
  width: 100%;
  height: 100%;
  overflow: auto;
}
</style>
