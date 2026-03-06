<script setup>
defineOptions({ name: 'LasPlotCanvas' });

import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { useLasPlotCursorLayerDom } from '@/composables/useLasPlotCursorLayerDom.js';
import { useLasPlotCursorOverlay } from '@/composables/useLasPlotCursorOverlay.js';
import { clearLasSurface, renderLasPlot } from '@/utils/lasPlotRenderer.js';

const props = defineProps({
  data: {
    type: Object,
    default: null,
  },
  resolveExactValuesAtDepth: {
    type: Function,
    default: null,
  }
});

const containerRef = useTemplateRef('container');
const surfaceRef = useTemplateRef('surface');
const cursorOverlayLayerRef = useTemplateRef('cursorOverlayLayer');
const cursorLineRef = useTemplateRef('cursorLine');
const cursorTooltipRef = useTemplateRef('cursorTooltip');
const plotModelRef = shallowRef(null);
let resizeObserver = null;
let queuedRenderFrame = null;
let forceRenderQueued = false;
let lastRenderWidth = null;
let lastRenderHeight = null;
let lastDataRef = null;

const cursorOverlay = useLasPlotCursorOverlay({
  enabled: true,
  containerRef: cursorOverlayLayerRef,
  plotModelRef,
  resolveExactValuesAtDepth(payload) {
    if (typeof props.resolveExactValuesAtDepth !== 'function') return null;
    return props.resolveExactValuesAtDepth(payload);
  }
});

useLasPlotCursorLayerDom({
  overlayRef: cursorOverlayLayerRef,
  lineRef: cursorLineRef,
  tooltipRef: cursorTooltipRef,
  plotModelRef,
  visible: cursorOverlay.visible,
  x: cursorOverlay.x,
  y: cursorOverlay.y,
  depth: cursorOverlay.depth,
  rows: cursorOverlay.rows,
  locked: cursorOverlay.locked,
  exactPending: cursorOverlay.exactPending
});

function measureSurfaceSize(surface) {
  return {
    width: Number(surface?.clientWidth ?? 0),
    height: Number(surface?.clientHeight ?? 0),
  };
}

function renderSurface(force = false) {
  const surface = surfaceRef.value;
  if (!surface) return;
  const { width, height } = measureSurfaceSize(surface);
  const sizeChanged = width !== lastRenderWidth || height !== lastRenderHeight;
  const dataChanged = lastDataRef !== props.data;
  if (!force && !sizeChanged && !dataChanged) return;
  plotModelRef.value = renderLasPlot(surface, props.data) ?? null;
  lastRenderWidth = width;
  lastRenderHeight = height;
  lastDataRef = props.data;
}

function queueRender(force = false) {
  if (force) forceRenderQueued = true;
  if (queuedRenderFrame !== null) return;

  queuedRenderFrame = requestAnimationFrame(() => {
    queuedRenderFrame = null;
    const shouldForce = forceRenderQueued;
    forceRenderQueued = false;
    renderSurface(shouldForce);
  });
}

watch(
  () => props.data,
  async () => {
    await nextTick();
    renderSurface(true);
  },
  { immediate: true }
);

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return;
  const container = containerRef.value;
  if (!container) return;
  resizeObserver = new ResizeObserver(() => {
    queueRender();
  });
  resizeObserver.observe(container);
});

onBeforeUnmount(() => {
  if (queuedRenderFrame !== null) {
    cancelAnimationFrame(queuedRenderFrame);
    queuedRenderFrame = null;
  }
  forceRenderQueued = false;
  lastRenderWidth = null;
  lastRenderHeight = null;
  lastDataRef = null;
  resizeObserver?.disconnect?.();
  resizeObserver = null;
  plotModelRef.value = null;
  clearLasSurface(surfaceRef.value);
});
</script>

<template>
  <div ref="container" class="las-plot-canvas">
    <div ref="surface" class="las-plot-canvas__surface"></div>
    <div
      ref="cursorOverlayLayer"
      class="las-plot-canvas__cursor-overlay"
      @pointermove="cursorOverlay.handlePointerMove"
      @pointerleave="cursorOverlay.handlePointerLeave"
      @pointerdown="cursorOverlay.handlePointerDown"
      @mousemove="cursorOverlay.handlePointerMove"
      @mouseleave="cursorOverlay.handlePointerLeave"
    >
      <div ref="cursorLine" class="las-plot-canvas__cursor-line" style="display: none;"></div>
      <pre ref="cursorTooltip" class="las-plot-canvas__cursor-tooltip" style="display: none;"></pre>
    </div>
  </div>
</template>

<style scoped>
.las-plot-canvas {
  position: relative;
  height: 100%;
  min-height: 0;
}

.las-plot-canvas__surface {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.las-plot-canvas__cursor-overlay {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.las-plot-canvas__cursor-line {
  position: absolute;
  height: 1px;
  background: var(--color-cursor-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-cursor-primary) 30%, transparent);
  pointer-events: none;
}

.las-plot-canvas__cursor-tooltip {
  position: absolute;
  margin: 0;
  min-width: 180px;
  max-width: min(420px, 90%);
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-tooltip-border);
  background: var(--color-tooltip-bg);
  color: var(--color-tooltip-text);
  box-shadow: var(--shadow-tooltip);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  line-height: 1.35;
  white-space: pre;
  pointer-events: none;
}
</style>
