<script setup>
import { computed } from 'vue';

const props = defineProps({
  radii: {
    type: Array,
    default: () => []
  },
  scale: {
    type: Number,
    default: 1
  }
});

const circles = computed(() => {
  const source = Array.isArray(props.radii) ? props.radii : [];
  const scale = Number.isFinite(Number(props.scale)) && Number(props.scale) > 0 ? Number(props.scale) : 1;

  return source
    .map((radius, index) => {
      const parsed = Number(radius);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      return {
        id: `open-hole-boundary-${index}`,
        radius: parsed * scale
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="cross-section-open-hole-boundary-layer">
    <circle
      v-for="circle in circles"
      :key="circle.id"
      :r="circle.radius"
      fill="none"
      stroke="var(--color-brown-accent)"
      stroke-width="2"
      stroke-dasharray="5,5"
    />
  </g>
</template>

<style scoped>
.cross-section-open-hole-boundary-layer {
  pointer-events: none;
}
</style>
