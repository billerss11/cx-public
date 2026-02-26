<script setup>
import { computed } from 'vue';

const props = defineProps({
  patterns: {
    type: Array,
    default: () => []
  }
});

const normalizedPatterns = computed(() => (
  (Array.isArray(props.patterns) ? props.patterns : [])
    .map((pattern) => ({
      id: String(pattern?.id ?? ''),
      styleKey: String(pattern?.styleKey ?? 'none'),
      color: String(pattern?.color ?? '')
    }))
    .filter((pattern) => pattern.id && pattern.styleKey !== 'none')
));
</script>

<template>
  <defs v-if="normalizedPatterns.length > 0">
    <pattern
      v-for="pattern in normalizedPatterns"
      :id="pattern.id"
      :key="pattern.id"
      patternUnits="userSpaceOnUse"
      width="8"
      height="8"
    >
      <path
        v-if="pattern.styleKey === 'diag'"
        d="M0,8 l8,-8 M-2,2 l4,-4 M6,10 l4,-4"
        :stroke="pattern.color"
        stroke-width="1"
      />
      <path
        v-else-if="pattern.styleKey === 'cross'"
        d="M0,8 l8,-8 M0,0 l8,8"
        :stroke="pattern.color"
        stroke-width="1"
      />
      <g v-else-if="pattern.styleKey === 'dots'">
        <circle cx="2" cy="2" r="1.2" :fill="pattern.color" />
        <circle cx="6" cy="6" r="1.2" :fill="pattern.color" />
      </g>
      <path
        v-else-if="pattern.styleKey === 'grid'"
        d="M0,4 l8,0 M4,0 l0,8"
        :stroke="pattern.color"
        stroke-width="1"
      />
    </pattern>
  </defs>
</template>
