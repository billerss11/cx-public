<script setup>
import { computed } from 'vue';

const props = defineProps({
  intervals: {
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
  xHalf: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    required: true
  }
});

const debugLines = computed(() => {
  const intervals = Array.isArray(props.intervals) ? props.intervals : [];
  const minX = props.xScale(-props.xHalf);
  const maxX = props.xScale(props.xHalf);
  const labelX = Math.min(props.width - 6, maxX + 6);

  return intervals
    .map((interval, index) => {
      const depth = Number(interval?.bottom);
      if (!Number.isFinite(depth)) return null;
      return {
        id: `${depth}-${index}`,
        depth,
        y: props.yScale(depth),
        minX,
        maxX,
        labelX
      };
    })
    .filter(Boolean);
});

function formatDepth(depth) {
  return Number.isFinite(depth) ? depth.toFixed(2) : '-';
}
</script>

<template>
  <g class="physics-debug-layer" aria-label="Physics interval boundaries">
    <g v-for="line in debugLines" :key="line.id">
      <line
        :x1="line.minX"
        :x2="line.maxX"
        :y1="line.y"
        :y2="line.y"
        class="physics-debug-line"
      />
      <text
        :x="line.labelX"
        :y="line.y - 2"
        class="physics-debug-label"
      >
        {{ formatDepth(line.depth) }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.physics-debug-line {
  stroke: var(--color-physics-debug-line);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  opacity: 0.7;
}

.physics-debug-label {
  fill: var(--color-physics-debug-fill);
  font-size: 10px;
  dominant-baseline: ideographic;
}
</style>
