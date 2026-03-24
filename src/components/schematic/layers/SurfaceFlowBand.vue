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
  }
});

const numericWidth = computed(() => Number(props.width?.value ?? props.width) || 0);
const bandHeight = computed(() => Number(props.surfaceLayout?.bandHeight) || 0);
const lanes = computed(() => Array.isArray(props.surfaceLayout?.lanes) ? props.surfaceLayout.lanes : []);
const displayMode = computed(() => String(props.surfaceLayout?.displayMode ?? 'hidden'));

const labelX = 18;
const flowLineStartX = 130;
const componentSpacing = 80;
const valveWidth = 56;
const valveHeight = 18;
const lanePitch = 40;

function resolveLaneY(index) {
  return 28 + (index * lanePitch);
}

function resolveStatusColor(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'open') return 'var(--p-green-500, #22c55e)';
  if (normalized === 'closed') return 'var(--p-red-500, #ef4444)';
  if (normalized === 'failed_open' || normalized === 'failed_closed') return 'var(--p-orange-500, #f97316)';
  if (normalized === 'leaking') return 'var(--p-yellow-500, #eab308)';
  return 'var(--muted, #888)';
}

function resolveStatusTextColor(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'leaking') return '#000';
  return '#fff';
}

const crossovers = computed(() => {
  const results = [];
  const laneIndexByChannel = new Map();
  lanes.value.forEach((lane, index) => {
    laneIndexByChannel.set(lane.channelKey, index);
  });

  lanes.value.forEach((lane) => {
    (lane.components ?? []).forEach((component, componentIndex) => {
      if (component.componentType !== 'crossover') return;
      const fromLaneIndex = laneIndexByChannel.get(lane.channelKey);
      const toLaneIndex = laneIndexByChannel.get(component.connectedTo);
      if (fromLaneIndex === undefined || toLaneIndex === undefined) return;
      results.push({
        rowId: component.rowId,
        label: component.label,
        fromY: resolveLaneY(fromLaneIndex),
        toY: resolveLaneY(toLaneIndex),
        x: flowLineStartX + ((componentIndex + 1) * componentSpacing),
        direction: component.crossoverDirection ?? 'bidirectional'
      });
    });
  });

  return results;
});
</script>

<template>
  <g v-if="bandHeight > 0" class="surface-flow-band">
    <rect
      class="surface-flow-band__backdrop"
      x="0"
      y="0"
      :width="numericWidth"
      :height="bandHeight"
      rx="12"
      ry="12"
    />

    <text class="surface-flow-band__title" :x="labelX" y="14">
      SURFACE EQUIPMENT
    </text>

    <g
      v-for="(lane, laneIndex) in lanes"
      :key="lane.channelKey"
      class="surface-flow-band__lane"
    >
      <text
        class="surface-flow-band__label"
        :x="labelX"
        :y="resolveLaneY(laneIndex) + 5"
      >
        {{ lane.label }}
      </text>

      <template v-if="displayMode === 'detail' && lane.components?.length">
        <line
          class="surface-flow-band__flow-line"
          :x1="flowLineStartX"
          :y1="resolveLaneY(laneIndex)"
          :x2="flowLineStartX + (lane.components.length * componentSpacing)"
          :y2="resolveLaneY(laneIndex)"
        />

        <circle
          class="surface-flow-band__start-node"
          :cx="flowLineStartX"
          :cy="resolveLaneY(laneIndex)"
          r="4"
        />

        <g
          v-for="(component, compIndex) in lane.components"
          :key="component.rowId || compIndex"
        >
          <template v-if="component.componentType === 'valve'">
            <rect
              class="surface-flow-band__valve"
              :x="flowLineStartX + ((compIndex + 0.5) * componentSpacing) - (valveWidth / 2)"
              :y="resolveLaneY(laneIndex) - (valveHeight / 2)"
              :width="valveWidth"
              :height="valveHeight"
              rx="3"
              ry="3"
              :fill="resolveStatusColor(component.status)"
            />
            <text
              class="surface-flow-band__valve-label"
              :x="flowLineStartX + ((compIndex + 0.5) * componentSpacing)"
              :y="resolveLaneY(laneIndex) + 4"
              :fill="resolveStatusTextColor(component.status)"
            >
              {{ (component.label || 'Valve').substring(0, 8) }}
            </text>
          </template>

          <template v-if="component.componentType === 'outlet'">
            <polygon
              class="surface-flow-band__outlet"
              :points="`
                ${flowLineStartX + ((compIndex + 0.5) * componentSpacing) - 8},${resolveLaneY(laneIndex) - 8}
                ${flowLineStartX + ((compIndex + 0.5) * componentSpacing) + 8},${resolveLaneY(laneIndex)}
                ${flowLineStartX + ((compIndex + 0.5) * componentSpacing) - 8},${resolveLaneY(laneIndex) + 8}
              `"
            />
            <text
              class="surface-flow-band__outlet-label"
              :x="flowLineStartX + ((compIndex + 0.5) * componentSpacing) + 14"
              :y="resolveLaneY(laneIndex) + 4"
            >
              {{ component.label || 'Outlet' }}
            </text>
          </template>

          <template v-if="component.componentType === 'crossover'">
            <circle
              class="surface-flow-band__crossover-node"
              :cx="flowLineStartX + ((compIndex + 0.5) * componentSpacing)"
              :cy="resolveLaneY(laneIndex)"
              r="5"
            />
          </template>
        </g>
      </template>

      <template v-else>
        <text
          class="surface-flow-band__summary"
          :x="flowLineStartX"
          :y="resolveLaneY(laneIndex) + 4"
        >
          {{ lane.summaryLabel }}
        </text>
      </template>
    </g>

    <g class="surface-flow-band__crossovers">
      <line
        v-for="xover in crossovers"
        :key="xover.rowId"
        class="surface-flow-band__crossover-line"
        :x1="xover.x"
        :y1="xover.fromY"
        :x2="xover.x"
        :y2="xover.toY"
      />
    </g>
  </g>
</template>

<style scoped>
.surface-flow-band {
  pointer-events: none;
}

.surface-flow-band__backdrop {
  fill: color-mix(in srgb, var(--color-surface-elevated) 96%, var(--color-surface-subtle));
  stroke: var(--line);
}

.surface-flow-band__title {
  fill: var(--muted);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.surface-flow-band__label {
  fill: var(--ink);
  font-size: 11px;
  font-weight: 700;
}

.surface-flow-band__flow-line {
  stroke: var(--muted);
  stroke-width: 1.5;
  opacity: 0.4;
}

.surface-flow-band__start-node {
  fill: var(--muted);
  opacity: 0.6;
}

.surface-flow-band__valve {
  stroke: none;
}

.surface-flow-band__valve-label {
  font-size: 8px;
  font-weight: 600;
  text-anchor: middle;
  pointer-events: none;
}

.surface-flow-band__outlet {
  fill: var(--p-primary-color, #3b82f6);
  opacity: 0.8;
}

.surface-flow-band__outlet-label {
  fill: var(--ink);
  font-size: 10px;
  font-weight: 500;
}

.surface-flow-band__crossover-node {
  fill: var(--p-primary-color, #3b82f6);
  stroke: var(--p-primary-color, #3b82f6);
  stroke-width: 1;
  opacity: 0.7;
}

.surface-flow-band__crossover-line {
  stroke: var(--p-primary-color, #3b82f6);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  opacity: 0.6;
}

.surface-flow-band__summary {
  fill: var(--muted);
  font-size: 11px;
}
</style>
