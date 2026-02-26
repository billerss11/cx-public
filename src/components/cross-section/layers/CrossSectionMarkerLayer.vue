<script setup>
import { computed } from 'vue';

const EPSILON = 1e-6;
const MARKER_TYPE = 'marker';

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  scale: {
    type: Number,
    default: 1
  },
  activeEntity: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['select-marker', 'hover-marker', 'leave-marker']);

function formatPoints(points = []) {
  return points.map((point) => `${point[0]},${point[1]}`).join(' ');
}

function normalizeMarkerEntity(index) {
  return Number.isInteger(index) && index >= 0
    ? { type: MARKER_TYPE, id: index }
    : null;
}

function isActiveMarker(index) {
  return String(props.activeEntity?.type ?? '').trim() === MARKER_TYPE &&
    Number(props.activeEntity?.id) === index;
}

const symbols = computed(() => {
  const markerRows = Array.isArray(props.items) ? props.items : [];
  const scale = Number.isFinite(Number(props.scale)) && Number(props.scale) > 0 ? Number(props.scale) : 1;
  const rows = [];

  markerRows.forEach((marker, markerIndex) => {
    const baseRadius = Number(marker?.baseRadius);
    if (!Number.isFinite(baseRadius) || baseRadius <= EPSILON) return;

    const plottedRadius = baseRadius * scale;
    if (!Number.isFinite(plottedRadius) || plottedRadius <= EPSILON) return;

    const markerScale = Number(marker?.scale);
    const symbolScale = Number.isFinite(markerScale) && markerScale > 0 ? markerScale : 1;
    const symbolSize = 10 * symbolScale;
    const color = marker?.color || 'var(--color-cross-marker-default)';
    const markerType = String(marker?.type ?? '');
    const entity = normalizeMarkerEntity(Number(marker?.markerIndex));
    if (!entity) return;
    const isActive = isActiveMarker(entity.id);

    const addPerforation = (side) => {
      const x = side === 'left' ? -plottedRadius : plottedRadius;
      const points = side === 'left'
        ? [[x, -symbolSize * 0.6], [x, symbolSize * 0.6], [x - symbolSize, 0]]
        : [[x, -symbolSize * 0.6], [x, symbolSize * 0.6], [x + symbolSize, 0]];

      rows.push({
        id: `marker-${markerIndex}-${side}`,
        type: 'perforation',
        color,
        points: formatPoints(points),
        entity,
        isActive
      });
    };

    const addLeak = (side) => {
      const centerX = side === 'left'
        ? -(plottedRadius + symbolSize * 0.5)
        : (plottedRadius + symbolSize * 0.5);

      rows.push({
        id: `marker-${markerIndex}-${side}-line-a`,
        type: 'leak-line',
        color,
        x1: centerX - symbolSize * 0.5,
        y1: -symbolSize * 0.5,
        x2: centerX + symbolSize * 0.5,
        y2: symbolSize * 0.5,
        entity,
        isActive
      });
      rows.push({
        id: `marker-${markerIndex}-${side}-line-b`,
        type: 'leak-line',
        color,
        x1: centerX - symbolSize * 0.5,
        y1: symbolSize * 0.5,
        x2: centerX + symbolSize * 0.5,
        y2: -symbolSize * 0.5,
        entity,
        isActive
      });
    };

    const drawLeft = marker?.showLeft === true;
    const drawRight = marker?.showRight === true;
    if (!drawLeft && !drawRight) return;

    if (drawLeft) {
      if (markerType === 'leak') {
        addLeak('left');
      } else {
        addPerforation('left');
      }
    }

    if (drawRight) {
      if (markerType === 'leak') {
        addLeak('right');
      } else {
        addPerforation('right');
      }
    }
  });

  return rows;
});
</script>

<template>
  <g class="cross-section-marker-layer">
    <polygon
      v-for="symbol in symbols.filter((item) => item.type === 'perforation')"
      :key="symbol.id"
      :points="symbol.points"
      :fill="symbol.color"
      stroke="var(--color-cross-marker-stroke)"
      stroke-width="0.4"
      :class="{ 'cross-section-marker-layer__shape--active': symbol.isActive }"
      :data-marker-index="symbol.entity.id"
      @click="emit('select-marker', symbol.entity, $event)"
      @mousemove="emit('hover-marker', symbol.entity, $event)"
      @mouseleave="emit('leave-marker', symbol.entity)"
    />
    <line
      v-for="line in symbols.filter((item) => item.type === 'leak-line')"
      :key="line.id"
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
      :stroke="line.color"
      stroke-width="2"
      :class="{ 'cross-section-marker-layer__shape--active': line.isActive }"
      :data-marker-index="line.entity.id"
      @click="emit('select-marker', line.entity, $event)"
      @mousemove="emit('hover-marker', line.entity, $event)"
      @mouseleave="emit('leave-marker', line.entity)"
    />
  </g>
</template>

<style scoped>
.cross-section-marker-layer {
  pointer-events: auto;
}

.cross-section-marker-layer__shape--active {
  stroke: var(--color-accent-primary-strong);
  stroke-width: 2.4;
}

.cross-section-marker-layer :is(polygon, line) {
  cursor: pointer;
}
</style>
