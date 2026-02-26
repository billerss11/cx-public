<script setup>
import { computed } from 'vue';

const EPSILON = 1e-6;
const LABEL_SPACING = 13;
const PIPE_TYPES = new Set(['casing', 'tubing', 'drillString']);

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  scale: {
    type: Number,
    default: 1
  },
  availableRadius: {
    type: Number,
    default: 100
  },
  activeEntity: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['select-pipe-label', 'hover-pipe-label', 'leave-pipe-label']);

const arrowheadId = `cross-section-arrowhead-${Math.random().toString(36).slice(2, 10)}`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatOdLabel(od) {
  const parsed = Number(od);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return `${parsed.toFixed(3).replace(/\.?0+$/, '')}"`;
}

function normalizePipeType(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'tubing') return 'tubing';
  if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
    return 'drillString';
  }
  return 'casing';
}

function normalizePipeEntity(entry) {
  const pipeType = normalizePipeType(entry?.pipeType);
  const rowIndex = Number(entry?.row?.sourceIndex ?? entry?.row?.__index);
  if (!PIPE_TYPES.has(pipeType) || !Number.isInteger(rowIndex) || rowIndex < 0) return null;
  return { type: pipeType, id: rowIndex };
}

function isActivePipe(entity) {
  return entity &&
    String(props.activeEntity?.type ?? '').trim() === entity.type &&
    Number(props.activeEntity?.id) === entity.id;
}

const labelRows = computed(() => {
  const scale = Number.isFinite(Number(props.scale)) && Number(props.scale) > 0 ? Number(props.scale) : 1;
  const availableRadius = Number.isFinite(Number(props.availableRadius)) && Number(props.availableRadius) > 0
    ? Number(props.availableRadius)
    : 100;
  const entries = (Array.isArray(props.items) ? props.items : [])
    .map((entry, index) => {
      const radius = Number(entry?.radius);
      const text = formatOdLabel(entry?.row?.od);
      const entity = normalizePipeEntity(entry);
      if (!Number.isFinite(radius) || radius <= EPSILON || !text || !entity) return null;
      return {
        id: `cross-section-label-${index}`,
        plottedRadius: radius * scale,
        text,
        entity,
        pipeKey: `${entity.type}:${entity.id}`,
        isActive: isActivePipe(entity)
      };
    })
    .filter(Boolean);
  if (entries.length === 0) return [];

  const maxY = Math.max(24, availableRadius - 12);
  const labelX = availableRadius + 10;
  const lineStartX = labelX - 6;
  const busX = Math.max(availableRadius - 3, lineStartX - 16);
  const requiredHalfSpan = ((entries.length - 1) * LABEL_SPACING) / 2;
  const halfSpan = entries.length <= 1 ? 0 : Math.min(requiredHalfSpan, maxY);
  const topY = -halfSpan;
  const bottomY = halfSpan;

  return entries.map((entry, index) => {
    const ratio = entries.length <= 1 ? 0.5 : index / (entries.length - 1);
    const targetY = entries.length <= 1 ? 0 : (topY + (bottomY - topY) * ratio);
    const anchorYLimit = entry.plottedRadius * 0.88;
    const anchorY = clamp(targetY, -anchorYLimit, anchorYLimit);
    const xSquared = Math.max(0, entry.plottedRadius * entry.plottedRadius - anchorY * anchorY);
    const anchorX = Math.sqrt(xSquared);

    const estimatedTextWidth = entry.text.length * 5.4;
    const boxPadding = 3;
    const boxWidth = estimatedTextWidth + boxPadding * 2;
    const boxHeight = 11.5;

    return {
      ...entry,
      lineStartX,
      busX,
      targetY,
      anchorX,
      anchorY,
      textX: labelX,
      textY: targetY,
      boxX: labelX - boxWidth - 2,
      boxY: targetY - boxHeight / 2,
      boxWidth,
      boxHeight
    };
  });
});
</script>

<template>
  <g v-if="labelRows.length > 0" class="cross-section-label-layer">
    <defs>
      <marker
        :id="arrowheadId"
        viewBox="0 0 10 10"
        refX="8.5"
        refY="5"
        markerWidth="4"
        markerHeight="4"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-cross-label-line)" />
      </marker>
    </defs>

    <g
      v-for="row in labelRows"
      :key="row.id"
      class="cross-section-label-layer__entry"
      :class="{ 'cross-section-label-layer__entry--active': row.isActive }"
      :data-pipe-key="row.pipeKey"
      :data-casing-index="row.entity.type === 'casing' ? row.entity.id : null"
      @click="emit('select-pipe-label', row.entity, $event)"
      @mousemove="emit('hover-pipe-label', row.entity, $event)"
      @mouseleave="emit('leave-pipe-label', row.entity)"
    >
      <path
        :d="`M ${row.lineStartX},${row.targetY} L ${row.busX},${row.targetY} L ${row.busX},${row.anchorY} L ${row.anchorX},${row.anchorY}`"
        fill="none"
        stroke="var(--color-cross-label-line)"
        stroke-width="0.9"
        stroke-linecap="round"
        stroke-linejoin="round"
        :marker-end="`url(#${arrowheadId})`"
      />
      <rect
        :x="row.boxX"
        :y="row.boxY"
        :width="row.boxWidth"
        :height="row.boxHeight"
        rx="3"
        ry="3"
        fill="var(--color-cross-label-box-fill)"
        stroke="var(--color-cross-label-box-stroke)"
        stroke-width="0.6"
      />
      <text
        :x="row.textX"
        :y="row.textY"
        text-anchor="end"
        dominant-baseline="middle"
        fill="var(--color-cross-label-text)"
        font-size="8.5px"
        font-weight="600"
      >
        {{ row.text }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.cross-section-label-layer {
  pointer-events: auto;
}

.cross-section-label-layer__entry {
  cursor: pointer;
}

.cross-section-label-layer__entry--active path {
  stroke: var(--color-accent-primary-strong);
}

.cross-section-label-layer__entry--active rect {
  stroke: var(--color-accent-primary-strong);
}

.cross-section-label-layer__entry--active text {
  fill: var(--color-accent-primary-strong);
}
</style>
