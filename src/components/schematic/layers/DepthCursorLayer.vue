<script setup>
import { computed } from 'vue';
import { clamp } from '@/utils/general.js';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'hover'
  },
  showLabel: {
    type: Boolean,
    default: true
  },
  cursorX: {
    type: Number,
    default: 0
  },
  cursorY: {
    type: Number,
    default: 0
  },
  lineStartX: {
    type: Number,
    default: NaN
  },
  lineStartY: {
    type: Number,
    default: NaN
  },
  lineEndX: {
    type: Number,
    default: NaN
  },
  lineEndY: {
    type: Number,
    default: NaN
  },
  plotLeftX: {
    type: Number,
    required: true
  },
  plotRightX: {
    type: Number,
    required: true
  },
  plotTopY: {
    type: Number,
    required: true
  },
  plotBottomY: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    default: ''
  }
});

const safeLeftX = computed(() => Math.min(props.plotLeftX, props.plotRightX));
const safeRightX = computed(() => Math.max(props.plotLeftX, props.plotRightX));
const safeTopY = computed(() => Math.min(props.plotTopY, props.plotBottomY));
const safeBottomY = computed(() => Math.max(props.plotTopY, props.plotBottomY));
const hasExplicitLineSegment = computed(() => (
  Number.isFinite(props.lineStartX) &&
  Number.isFinite(props.lineStartY) &&
  Number.isFinite(props.lineEndX) &&
  Number.isFinite(props.lineEndY)
));
const lineX1 = computed(() => (hasExplicitLineSegment.value ? props.lineStartX : safeLeftX.value));
const lineY1 = computed(() => (hasExplicitLineSegment.value ? props.lineStartY : props.cursorY));
const lineX2 = computed(() => (hasExplicitLineSegment.value ? props.lineEndX : safeRightX.value));
const lineY2 = computed(() => (hasExplicitLineSegment.value ? props.lineEndY : props.cursorY));

const labelText = computed(() => String(props.label ?? '').trim());
const shouldShowLabel = computed(() => props.showLabel !== false && labelText.value.length > 0);
const labelWidth = computed(() => (
  Math.max(88, Math.min(240, (labelText.value.length * 6.8) + 14))
));
const labelHeight = 20;

const labelX = computed(() => (
  clamp(
    props.cursorX + 10,
    safeLeftX.value + 4,
    safeRightX.value - labelWidth.value - 4
  )
));

const labelY = computed(() => (
  clamp(
    props.cursorY - labelHeight - 8,
    safeTopY.value + 4,
    safeBottomY.value - labelHeight - 4
  )
));
</script>

<template>
  <g v-if="visible" :class="['depth-cursor-layer', `depth-cursor-layer--${variant}`]">
    <line
      class="depth-cursor-layer__line"
      :x1="lineX1"
      :y1="lineY1"
      :x2="lineX2"
      :y2="lineY2"
    />
    <rect
      v-if="shouldShowLabel"
      class="depth-cursor-layer__label-box"
      :x="labelX"
      :y="labelY"
      :width="labelWidth"
      :height="labelHeight"
      rx="6"
      ry="6"
    />
    <text
      v-if="shouldShowLabel"
      class="depth-cursor-layer__label-text"
      :x="labelX + (labelWidth / 2)"
      :y="labelY + (labelHeight / 2)"
      text-anchor="middle"
      dominant-baseline="middle"
    >
      {{ labelText }}
    </text>
  </g>
</template>

<style scoped>
.depth-cursor-layer {
  pointer-events: none;
}

.depth-cursor-layer__line {
  stroke: var(--color-cursor-primary);
  stroke-width: 1.3;
  stroke-dasharray: 5 4;
  opacity: 0.95;
}

.depth-cursor-layer__label-box {
  fill: var(--color-cursor-primary-fill);
  stroke: var(--color-cursor-primary-stroke);
  stroke-width: 1;
}

.depth-cursor-layer__label-text {
  fill: var(--color-cursor-label-text);
  font-size: 11px;
  font-weight: 600;
  font-family: 'Space Grotesk', 'IBM Plex Sans', sans-serif;
  letter-spacing: 0.01em;
}

.depth-cursor-layer--anchor .depth-cursor-layer__line {
  stroke: var(--color-cursor-anchor);
  stroke-width: 1.8;
  stroke-dasharray: none;
  opacity: 0.95;
}

.depth-cursor-layer--anchor .depth-cursor-layer__label-box {
  fill: var(--color-cursor-anchor-fill);
  stroke: var(--color-cursor-anchor-stroke);
}
</style>
