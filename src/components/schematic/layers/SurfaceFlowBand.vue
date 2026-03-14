<script setup>
import { computed } from 'vue';

const props = defineProps({
  surfaceLayout: {
    type: Object,
    required: true
  },
  width: {
    type: [Number, Object],
    required: true
  },
  surfaceTransfers: {
    type: Array,
    default: () => []
  }
});

const numericWidth = computed(() => Number(props.width?.value ?? props.width) || 0);
const bandHeight = computed(() => Number(props.surfaceLayout?.bandHeight) || 0);
const lanes = computed(() => Array.isArray(props.surfaceLayout?.lanes) ? props.surfaceLayout.lanes : []);
const displayMode = computed(() => String(props.surfaceLayout?.displayMode ?? 'hidden'));
const lanePitch = 28;
const labelX = 18;
const contentX = 126;

function resolveLaneY(index) {
  return 22 + (index * lanePitch);
}
</script>

<template>
  <g v-if="bandHeight > 0" class="surface-flow-band" aria-hidden="true">
    <rect
      class="surface-flow-band__backdrop"
      x="0"
      y="0"
      :width="numericWidth"
      :height="bandHeight"
      rx="12"
      ry="12"
    />

    <g
      v-for="(lane, laneIndex) in lanes"
      :key="lane.channelKey"
      class="surface-flow-band__lane"
      :transform="`translate(0 ${resolveLaneY(laneIndex)})`"
    >
      <text class="surface-flow-band__label" :x="labelX" y="0">{{ lane.label }}</text>
      <text
        class="surface-flow-band__summary"
        :x="contentX"
        y="0"
      >
        <tspan v-if="displayMode === 'detail' && lane.items?.length">
          {{
            [
              lane.items.map((item) => item.label || item.itemType || 'Surface item').join(' -> '),
              lane.summaryEntry?.outletLabels?.length ? lane.summaryEntry.outletLabels.join(', ') : ''
            ].filter(Boolean).join(' -> ')
          }}
        </tspan>
        <tspan v-else>
          {{ lane.summaryLabel }}
        </tspan>
      </text>
    </g>

    <g
      v-if="displayMode === 'detail'"
      class="surface-flow-band__bridges"
    >
      <path
        v-for="(transfer, transferIndex) in surfaceTransfers"
        :key="transfer.rowId || transferIndex"
        class="surface-flow-band__bridge"
        :d="`M ${contentX + 210 + (transferIndex * 14)} ${resolveLaneY(0) - 10} v ${Math.max(16, (transferIndex + 1) * 10)} h 22`"
      />
    </g>
  </g>
</template>

<style scoped>
.surface-flow-band__backdrop {
  fill: color-mix(in srgb, var(--color-surface-elevated) 96%, var(--color-surface-subtle));
  stroke: var(--line);
}

.surface-flow-band__label {
  fill: var(--ink);
  font-size: 12px;
  font-weight: 700;
}

.surface-flow-band__summary {
  fill: var(--muted);
  font-size: 11px;
}

.surface-flow-band__bridge {
  fill: none;
  stroke: var(--p-primary-color);
  stroke-width: 1.2;
  opacity: 0.65;
}
</style>
