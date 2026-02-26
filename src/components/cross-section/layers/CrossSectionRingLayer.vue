<script setup>
import { computed } from 'vue';

const EPSILON = 1e-6;
const PIPE_TYPES = new Set(['casing', 'tubing', 'drillString']);
const NON_PIPE_TYPES = new Set(['fluid', 'plug', 'marker', 'line', 'box']);

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  scale: {
    type: Number,
    default: 1
  },
  defaultStroke: {
    type: String,
    default: 'var(--color-cross-mid-stroke)'
  },
  defaultFill: {
    type: String,
    default: 'var(--color-cross-mid-stroke)'
  },
  defaultOpacity: {
    type: Number,
    default: 1
  },
  minStrokeWidth: {
    type: Number,
    default: 0.6
  },
  defaultDasharray: {
    type: String,
    default: ''
  },
  activeEntity: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['select-entity', 'hover-entity', 'leave-entity']);

function resolveOuterRadius(item) {
  const explicitOuter = Number(item?.outerRadius);
  if (Number.isFinite(explicitOuter) && explicitOuter > 0) return explicitOuter;

  const od = Number(item?.od ?? item?.outerDiameter);
  if (Number.isFinite(od) && od > 0) return od / 2;
  return null;
}

function resolveInnerRadius(item) {
  const explicitInner = Number(item?.innerRadius);
  if (Number.isFinite(explicitInner) && explicitInner >= 0) return explicitInner;

  const id = Number(item?.id ?? item?.innerDiameter);
  if (Number.isFinite(id) && id >= 0) return id / 2;
  return 0;
}

function toDonutPath(outerRadius, innerRadius) {
  if (!Number.isFinite(outerRadius) || outerRadius <= EPSILON) return '';
  const safeInner = Number.isFinite(innerRadius) && innerRadius > EPSILON ? innerRadius : 0;
  if (safeInner <= EPSILON) {
    return [
      `M ${outerRadius} 0`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${-outerRadius} 0`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerRadius} 0`,
      'Z'
    ].join(' ');
  }

  return [
    `M ${outerRadius} 0`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${-outerRadius} 0`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${outerRadius} 0`,
    `M ${safeInner} 0`,
    `A ${safeInner} ${safeInner} 0 1 0 ${-safeInner} 0`,
    `A ${safeInner} ${safeInner} 0 1 0 ${safeInner} 0`,
    'Z'
  ].join(' ');
}

function normalizeEntity(value) {
  if (!value || typeof value !== 'object') return null;
  const type = String(value.type ?? '').trim();
  const id = Number(value.id);
  if (!type || !Number.isInteger(id) || id < 0) return null;
  return { type, id };
}

function serializePipeEntity(entity) {
  const normalized = normalizeEntity(entity);
  if (!normalized || !PIPE_TYPES.has(normalized.type)) return null;
  return `${normalized.type}:${normalized.id}`;
}

function isSameEntity(left, right) {
  const a = normalizeEntity(left);
  const b = normalizeEntity(right);
  if (!a || !b) return false;
  return a.type === b.type && a.id === b.id;
}

function resolveEntityAttrs(entity) {
  const normalized = normalizeEntity(entity);
  if (!normalized) {
    return {
      pipeKey: null,
      casingIndex: null,
      fluidIndex: null,
      plugIndex: null,
      markerIndex: null,
      lineIndex: null,
      boxIndex: null
    };
  }

  if (PIPE_TYPES.has(normalized.type)) {
    return {
      pipeKey: serializePipeEntity(normalized),
      casingIndex: normalized.type === 'casing' ? normalized.id : null,
      fluidIndex: null,
      plugIndex: null,
      markerIndex: null,
      lineIndex: null,
      boxIndex: null
    };
  }

  if (!NON_PIPE_TYPES.has(normalized.type)) {
    return {
      pipeKey: null,
      casingIndex: null,
      fluidIndex: null,
      plugIndex: null,
      markerIndex: null,
      lineIndex: null,
      boxIndex: null
    };
  }

  return {
    pipeKey: null,
    casingIndex: null,
    fluidIndex: normalized.type === 'fluid' ? normalized.id : null,
    plugIndex: normalized.type === 'plug' ? normalized.id : null,
    markerIndex: normalized.type === 'marker' ? normalized.id : null,
    lineIndex: normalized.type === 'line' ? normalized.id : null,
    boxIndex: normalized.type === 'box' ? normalized.id : null
  };
}

const rings = computed(() => {
  const source = Array.isArray(props.items) ? props.items : [];
  const scale = Number.isFinite(Number(props.scale)) && Number(props.scale) > 0 ? Number(props.scale) : 1;
  const minStrokeWidth = Number.isFinite(Number(props.minStrokeWidth)) ? Number(props.minStrokeWidth) : 0.6;

  return source
    .map((item, index) => {
      const outerRadius = resolveOuterRadius(item);
      const innerRadius = resolveInnerRadius(item);
      if (!Number.isFinite(outerRadius) || !Number.isFinite(innerRadius) || outerRadius <= innerRadius + EPSILON) {
        return null;
      }

      const plottedInner = innerRadius * scale;
      const plottedOuter = outerRadius * scale;
      const strokeWidth = plottedOuter - plottedInner;
      if (!Number.isFinite(strokeWidth) || strokeWidth <= EPSILON) return null;

      const opacityValue = Number(item?.opacity);
      const entity = normalizeEntity(item?.interactionEntity);
      const attrs = resolveEntityAttrs(entity);

      return {
        id: item?.id ?? `ring-${index}`,
        path: toDonutPath(plottedOuter, plottedInner),
        fill: item?.fill ?? item?.color ?? props.defaultFill,
        stroke: item?.stroke ?? item?.color ?? props.defaultStroke,
        strokeWidth: Number.isFinite(Number(item?.strokeWidth))
          ? Number(item.strokeWidth)
          : Math.max(minStrokeWidth, 0),
        opacity: Number.isFinite(opacityValue) ? opacityValue : props.defaultOpacity,
        strokeDasharray: item?.strokeDasharray ?? props.defaultDasharray,
        interactionEntity: entity,
        attrs,
        isInteractive: Boolean(entity),
        isActive: isSameEntity(entity, props.activeEntity)
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <g class="cross-section-ring-layer">
    <path
      v-for="ring in rings"
      :key="ring.id"
      class="cross-section-ring-layer__ring"
      :class="{
        'cross-section-ring-layer__ring--interactive': ring.isInteractive,
        'cross-section-ring-layer__ring--active': ring.isActive
      }"
      :d="ring.path"
      fill-rule="evenodd"
      :fill="ring.fill"
      :stroke="ring.stroke"
      :stroke-width="ring.strokeWidth"
      :stroke-dasharray="ring.strokeDasharray || null"
      :opacity="ring.opacity"
      :data-pipe-key="ring.attrs.pipeKey"
      :data-casing-index="ring.attrs.casingIndex"
      :data-fluid-index="ring.attrs.fluidIndex"
      :data-plug-index="ring.attrs.plugIndex"
      :data-marker-index="ring.attrs.markerIndex"
      :data-line-index="ring.attrs.lineIndex"
      :data-box-index="ring.attrs.boxIndex"
      @click="ring.isInteractive && emit('select-entity', ring.interactionEntity, $event)"
      @mousemove="ring.isInteractive && emit('hover-entity', ring.interactionEntity, $event)"
      @mouseleave="ring.isInteractive && emit('leave-entity', ring.interactionEntity)"
    />
  </g>
</template>

<style scoped>
.cross-section-ring-layer__ring {
  shape-rendering: geometricPrecision;
}

.cross-section-ring-layer__ring--interactive {
  cursor: pointer;
}

.cross-section-ring-layer__ring--active {
  filter: brightness(1.08);
  stroke: var(--color-accent-primary-strong);
  stroke-width: 1.2;
}
</style>
