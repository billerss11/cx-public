<script setup>
import { computed } from 'vue';

const EPSILON = 1e-6;
const SAFETY_VALVE_MIN_HALF_HEIGHT = 3;
const PACKER_ORPHAN_RADIUS = 0.9;
const ORPHAN_COLOR = 'red';
const ORPHAN_DASH_STYLE = '4 2';

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

const emit = defineEmits(['select-equipment', 'hover-equipment', 'leave-equipment']);

function normalizeEntity(index) {
  return Number.isInteger(index) && index >= 0
    ? { type: 'equipment', id: index }
    : null;
}

function isActiveEquipment(index) {
  return String(props.activeEntity?.type ?? '').trim() === 'equipment' &&
    Number(props.activeEntity?.id) === index;
}

function normalizeEquipmentType(type) {
  const normalized = String(type ?? '').trim().toLowerCase();
  if (normalized === 'packer') return 'packer';
  if (normalized === 'safety valve' || normalized === 'safety_valve' || normalized === 'safety-valve') {
    return 'safety-valve';
  }
  return '';
}

function resolveSafetyValveHalfHeight(innerRadiusPx, scaleFactor) {
  const rawHalfHeight = innerRadiusPx * 0.55 * scaleFactor;
  if (!Number.isFinite(rawHalfHeight) || rawHalfHeight <= 0) return SAFETY_VALVE_MIN_HALF_HEIGHT;
  return Math.max(SAFETY_VALVE_MIN_HALF_HEIGHT, Math.min(innerRadiusPx, rawHalfHeight));
}

const shapes = computed(() => {
  const scale = Number.isFinite(Number(props.scale)) && Number(props.scale) > 0 ? Number(props.scale) : 1;
  const rows = Array.isArray(props.items) ? props.items : [];
  const entries = [];

  rows.forEach((item) => {
    const entity = normalizeEntity(Number(item?.equipmentIndex));
    if (!entity) return;
    const isActive = isActiveEquipment(entity.id);
    const color = String(item?.color ?? 'black');
    const scaleFactor = Number.isFinite(Number(item?.scale)) && Number(item.scale) > 0 ? Number(item.scale) : 1;
    const type = normalizeEquipmentType(item?.type);

    if (type === 'packer') {
      const isOrphaned = item?.isOrphaned === true;
      const innerRadius = Number(item?.sealInnerRadius ?? item?.tubingOuterRadius);
      const outerRadius = Number(item?.sealOuterRadius ?? item?.parentInnerRadius);
      const hasResolvedGeometry = Number.isFinite(innerRadius)
        && Number.isFinite(outerRadius)
        && outerRadius > innerRadius + EPSILON;

      if (hasResolvedGeometry) {
        entries.push({
          id: `equipment-packer-${entity.id}`,
          type: 'ring',
          innerRadius: innerRadius * scale,
          outerRadius: outerRadius * scale,
          color: isOrphaned ? ORPHAN_COLOR : color,
          strokeDasharray: isOrphaned ? ORPHAN_DASH_STYLE : null,
          entity,
          isActive
        });
      } else if (isOrphaned) {
        entries.push({
          id: `equipment-packer-orphan-${entity.id}`,
          type: 'circle',
          cx: 0,
          cy: 0,
          r: PACKER_ORPHAN_RADIUS * scale,
          color: ORPHAN_COLOR,
          strokeDasharray: ORPHAN_DASH_STYLE,
          entity,
          isActive
        });
      }
      return;
    } else if (type === 'safety-valve') {
      const innerRadius = Number(item?.tubingInnerRadius);
      if (!Number.isFinite(innerRadius) || innerRadius <= EPSILON) return;
      const innerRadiusPx = innerRadius * scale;
      const halfHeight = resolveSafetyValveHalfHeight(innerRadiusPx, scaleFactor);
      const halfWidth = innerRadiusPx;
      const crossFactor = 0.7;

      entries.push({
        id: `equipment-ssv-ellipse-${entity.id}`,
        type: 'ellipse',
        cx: 0,
        cy: 0,
        rx: halfWidth,
        ry: halfHeight,
        color,
        strokeDasharray: null,
        entity,
        isActive
      });
      entries.push({
        id: `equipment-ssv-cross1-${entity.id}`,
        type: 'line',
        x1: -halfWidth * crossFactor,
        y1: -halfHeight * crossFactor,
        x2: halfWidth * crossFactor,
        y2: halfHeight * crossFactor,
        color,
        strokeDasharray: null,
        entity,
        isActive
      });
      entries.push({
        id: `equipment-ssv-cross2-${entity.id}`,
        type: 'line',
        x1: halfWidth * crossFactor,
        y1: -halfHeight * crossFactor,
        x2: -halfWidth * crossFactor,
        y2: halfHeight * crossFactor,
        color,
        strokeDasharray: null,
        entity,
        isActive
      });
    }
  });

  return entries;
});
</script>

<template>
  <g class="cross-section-equipment-layer">
    <path
      v-for="shape in shapes.filter((item) => item.type === 'ring')"
      :key="shape.id"
      :d="`M ${shape.outerRadius} 0 A ${shape.outerRadius} ${shape.outerRadius} 0 1 1 ${-shape.outerRadius} 0 A ${shape.outerRadius} ${shape.outerRadius} 0 1 1 ${shape.outerRadius} 0 M ${shape.innerRadius} 0 A ${shape.innerRadius} ${shape.innerRadius} 0 1 0 ${-shape.innerRadius} 0 A ${shape.innerRadius} ${shape.innerRadius} 0 1 0 ${shape.innerRadius} 0 Z`"
      class="cross-section-equipment-layer__shape"
      fill="none"
      fill-rule="evenodd"
      :stroke="shape.color"
      :stroke-dasharray="shape.strokeDasharray || null"
      stroke-width="1"
      :class="{ 'cross-section-equipment-layer__shape--active': shape.isActive }"
      :data-equipment-index="shape.entity.id"
      @click="emit('select-equipment', shape.entity, $event)"
      @mousemove="emit('hover-equipment', shape.entity, $event)"
      @mouseleave="emit('leave-equipment', shape.entity)"
    />

    <line
      v-for="shape in shapes.filter((item) => item.type === 'line')"
      :key="shape.id"
      class="cross-section-equipment-layer__shape"
      :x1="shape.x1"
      :y1="shape.y1"
      :x2="shape.x2"
      :y2="shape.y2"
      :stroke="shape.color"
      :stroke-dasharray="shape.strokeDasharray || null"
      stroke-width="1.4"
      :class="{ 'cross-section-equipment-layer__shape--active': shape.isActive }"
      :data-equipment-index="shape.entity.id"
      @click="emit('select-equipment', shape.entity, $event)"
      @mousemove="emit('hover-equipment', shape.entity, $event)"
      @mouseleave="emit('leave-equipment', shape.entity)"
    />

    <ellipse
      v-for="shape in shapes.filter((item) => item.type === 'ellipse')"
      :key="shape.id"
      class="cross-section-equipment-layer__shape"
      :cx="shape.cx"
      :cy="shape.cy"
      :rx="shape.rx"
      :ry="shape.ry"
      :stroke="shape.color"
      :stroke-dasharray="shape.strokeDasharray || null"
      stroke-width="1.4"
      fill="none"
      :class="{ 'cross-section-equipment-layer__shape--active': shape.isActive }"
      :data-equipment-index="shape.entity.id"
      @click="emit('select-equipment', shape.entity, $event)"
      @mousemove="emit('hover-equipment', shape.entity, $event)"
      @mouseleave="emit('leave-equipment', shape.entity)"
    />

    <circle
      v-for="shape in shapes.filter((item) => item.type === 'circle')"
      :key="shape.id"
      class="cross-section-equipment-layer__shape"
      :cx="shape.cx"
      :cy="shape.cy"
      :r="shape.r"
      :stroke="shape.color"
      :stroke-dasharray="shape.strokeDasharray || null"
      stroke-width="1.4"
      fill="none"
      :class="{ 'cross-section-equipment-layer__shape--active': shape.isActive }"
      :data-equipment-index="shape.entity.id"
      @click="emit('select-equipment', shape.entity, $event)"
      @mousemove="emit('hover-equipment', shape.entity, $event)"
      @mouseleave="emit('leave-equipment', shape.entity)"
    />
  </g>
</template>

<style scoped>
.cross-section-equipment-layer__shape {
  cursor: pointer;
}

.cross-section-equipment-layer__shape--active {
  stroke: var(--color-accent-primary-strong);
  stroke-width: 2;
}
</style>
