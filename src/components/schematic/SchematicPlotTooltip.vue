<script setup>
import { computed } from 'vue';
import { clamp } from '@/utils/general.js';

const TOOLTIP_OFFSET = 18;
const TOOLTIP_MAX_WIDTH = 280;
const TOOLTIP_FALLBACK_HEIGHT = 140;
const TOOLTIP_EDGE_OFFSET = 8;

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  model: {
    type: Object,
    default: null
  },
  x: {
    type: Number,
    default: 0
  },
  y: {
    type: Number,
    default: 0
  },
  containerWidth: {
    type: Number,
    default: 0
  },
  containerHeight: {
    type: Number,
    default: 0
  },
  positionMode: {
    type: String,
    default: 'cursor',
    validator: (value) => value === 'cursor' || value === 'inline'
  }
});

const tooltipStyle = computed(() => {
  if (props.positionMode === 'inline') {
    return {};
  }

  const safeWidth = Math.max(0, Number(props.containerWidth) || 0);
  const safeHeight = Math.max(0, Number(props.containerHeight) || 0);

  const leftMax = Math.max(TOOLTIP_EDGE_OFFSET, safeWidth - TOOLTIP_MAX_WIDTH - TOOLTIP_EDGE_OFFSET);
  const topMax = Math.max(TOOLTIP_EDGE_OFFSET, safeHeight - TOOLTIP_FALLBACK_HEIGHT - TOOLTIP_EDGE_OFFSET);
  const left = clamp(Number(props.x) + TOOLTIP_OFFSET, TOOLTIP_EDGE_OFFSET, leftMax);
  const top = clamp(Number(props.y) + TOOLTIP_OFFSET, TOOLTIP_EDGE_OFFSET, topMax);

  return {
    left: `${left}px`,
    top: `${top}px`
  };
});

const tooltipClassName = computed(() => ({
  'schematic-plot-tooltip--inline': props.positionMode === 'inline'
}));
</script>

<template>
  <div
    v-if="visible && model"
    class="schematic-plot-tooltip"
    :class="tooltipClassName"
    :style="tooltipStyle"
  >
    <div class="schematic-plot-tooltip__title">
      <span
        v-if="model.color"
        class="schematic-plot-tooltip__swatch"
        :style="{ backgroundColor: model.color }"
      ></span>
      <span>{{ model.title }}</span>
    </div>
    <div
      v-for="(line, lineIndex) in (Array.isArray(model.lines) ? model.lines : [])"
      :key="`tooltip-line-${lineIndex}`"
      class="schematic-plot-tooltip__line"
    >
      {{ line }}
    </div>
  </div>
</template>

<style scoped>
.schematic-plot-tooltip {
  position: absolute;
  z-index: 30;
  pointer-events: none;
  max-width: 280px;
  background: var(--color-tooltip-bg);
  color: var(--color-tooltip-text);
  border: 1px solid var(--color-tooltip-border);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: var(--shadow-tooltip);
}

.schematic-plot-tooltip--inline {
  position: static;
  width: 100%;
  max-width: none;
}

.schematic-plot-tooltip__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: 4px;
}

.schematic-plot-tooltip__swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid var(--color-tooltip-swatch-border);
  flex: 0 0 auto;
}

.schematic-plot-tooltip__line {
  font-size: 0.76rem;
  line-height: 1.25;
  margin-top: 2px;
}
</style>
