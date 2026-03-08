<script setup>
import { computed } from 'vue';
import {
  buildSurfaceAssemblyLayout,
  resolveSurfaceSlotGlyph,
} from '@/utils/surfaceAssemblyLayout.js';

const props = defineProps({
  assembly: {
    type: Object,
    default: null,
  },
  interactive: {
    type: Boolean,
    default: false,
  },
  showLabels: {
    type: Boolean,
    default: true,
  },
  selectedEntityKey: {
    type: String,
    default: null,
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['select-entity']);

const layoutModel = computed(() => buildSurfaceAssemblyLayout(props.assembly));
const svgStyle = computed(() => ({
  height: props.compact ? '210px' : '100%',
}));

function buildValvePoints(slot) {
  return [
    `${slot.x},${slot.y - 16}`,
    `${slot.x + 18},${slot.y}`,
    `${slot.x},${slot.y + 16}`,
    `${slot.x - 18},${slot.y}`,
  ].join(' ');
}

function buildSealRect(slot) {
  return {
    x: slot.x - 14,
    y: slot.y - 10,
    width: 28,
    height: 20,
  };
}

function buildChokePoints(slot) {
  return [
    `${slot.x - 16},${slot.y - 12}`,
    `${slot.x + 8},${slot.y - 12}`,
    `${slot.x + 16},${slot.y}`,
    `${slot.x + 8},${slot.y + 12}`,
    `${slot.x - 16},${slot.y + 12}`,
    `${slot.x - 8},${slot.y}`,
  ].join(' ');
}

function handleSelect(entityKey) {
  if (props.interactive !== true) return;
  emit('select-entity', entityKey);
}
</script>

<template>
  <div class="surface-assembly-preview" data-testid="surface-assembly-preview">
    <div
      v-if="!layoutModel.hasContent"
      class="surface-assembly-preview__empty"
      data-testid="surface-assembly-empty"
    >
      No surface assembly preview yet.
    </div>

    <template v-else>
      <header class="surface-assembly-preview__header">
        <strong class="surface-assembly-preview__title">{{ layoutModel.familyTitle }}</strong>
        <span class="surface-assembly-preview__description">{{ layoutModel.familyDescription }}</span>
      </header>

      <svg
        class="surface-assembly-preview__svg"
        :style="svgStyle"
        :viewBox="`0 0 ${layoutModel.width} ${layoutModel.height}`"
        role="img"
        aria-label="Surface assembly preview"
      >
        <polyline
          v-for="segment in layoutModel.guideSegments"
          :key="segment.key"
          class="surface-assembly-preview__segment surface-assembly-preview__segment--guide"
          :points="segment.points"
          fill="none"
        />

        <polyline
          v-for="segment in layoutModel.pathSegments"
          :key="segment.key"
          class="surface-assembly-preview__segment"
          :class="`surface-assembly-preview__segment--${segment.tone}`"
          :points="segment.points"
          fill="none"
        />

        <g
          v-for="structure in layoutModel.structures"
          :key="structure.key"
          class="surface-assembly-preview__structure"
        >
          <rect
            class="surface-assembly-preview__structure-body"
            :class="`surface-assembly-preview__structure-body--${structure.kind}`"
            :x="structure.x"
            :y="structure.y"
            :width="structure.width"
            :height="structure.height"
            rx="10"
          />
          <text
            class="surface-assembly-preview__structure-label"
            :x="structure.x + (structure.width / 2)"
            :y="structure.y + structure.height + 14"
            text-anchor="middle"
          >
            {{ structure.label }}
          </text>
        </g>

        <g
          v-for="junction in layoutModel.junctions"
          :key="junction.entityKey"
          class="surface-assembly-preview__junction"
        >
          <circle
            class="surface-assembly-preview__junction-node"
            :cx="junction.x"
            :cy="junction.y"
            r="6"
          />
          <text
            class="surface-assembly-preview__junction-label"
            :x="junction.x + 10"
            :y="junction.y - 8"
          >
            {{ junction.label }}
          </text>
        </g>

        <g
          v-for="slot in layoutModel.slots"
          :key="slot.entityKey"
          class="surface-assembly-preview__slot"
          :class="{
            'surface-assembly-preview__slot--interactive': interactive,
            'surface-assembly-preview__slot--selected': selectedEntityKey === slot.entityKey,
          }"
          :data-entity-key="slot.entityKey"
          data-testid="surface-assembly-slot"
          @click="handleSelect(slot.entityKey)"
        >
          <polygon
            v-if="resolveSurfaceSlotGlyph(slot) === 'valve'"
            class="surface-assembly-preview__slot-body"
            :class="`surface-assembly-preview__slot-body--${slot.tone}`"
            :points="buildValvePoints(slot)"
          />

          <polygon
            v-else-if="resolveSurfaceSlotGlyph(slot) === 'choke'"
            class="surface-assembly-preview__slot-body"
            :class="`surface-assembly-preview__slot-body--${slot.tone}`"
            :points="buildChokePoints(slot)"
          />

          <g v-else-if="resolveSurfaceSlotGlyph(slot) === 'seal'">
            <rect
              class="surface-assembly-preview__slot-body surface-assembly-preview__slot-body--seal"
              :x="buildSealRect(slot).x"
              :y="buildSealRect(slot).y"
              :width="buildSealRect(slot).width"
              :height="buildSealRect(slot).height"
              rx="4"
            />
            <line class="surface-assembly-preview__seal-line" :x1="slot.x - 10" :y1="slot.y - 9" :x2="slot.x - 10" :y2="slot.y + 9" />
            <line class="surface-assembly-preview__seal-line" :x1="slot.x + 10" :y1="slot.y - 9" :x2="slot.x + 10" :y2="slot.y + 9" />
          </g>

          <g v-else>
            <line
              class="surface-assembly-preview__slot-line"
              :class="`surface-assembly-preview__slot-line--${slot.tone}`"
              :x1="slot.x - 16"
              :y1="slot.y"
              :x2="slot.x + 8"
              :y2="slot.y"
            />
            <circle
              class="surface-assembly-preview__slot-cap"
              :class="{
                'surface-assembly-preview__slot-cap--blocked': resolveSurfaceSlotGlyph(slot) === 'cap',
                [`surface-assembly-preview__slot-cap--${slot.tone}`]: true,
              }"
              :cx="slot.x + 16"
              :cy="slot.y"
              r="8"
            />
          </g>

          <text
            v-if="showLabels"
            class="surface-assembly-preview__slot-label"
            :x="slot.x"
            :y="slot.y + 28"
            text-anchor="middle"
          >
            {{ slot.label }}
          </text>
        </g>
      </svg>
    </template>
  </div>
</template>

<style scoped>
.surface-assembly-preview {
  display: flex;
  width: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
  justify-content: center;
}

.surface-assembly-preview__header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.surface-assembly-preview__title {
  color: var(--color-ink-strong);
  font-size: 0.9rem;
}

.surface-assembly-preview__description {
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1.35;
}

.surface-assembly-preview__empty {
  width: 100%;
  border: 1px dashed color-mix(in srgb, var(--line) 84%, transparent);
  border-radius: var(--radius-md);
  padding: 22px 18px;
  text-align: center;
  color: var(--muted);
  background: color-mix(in srgb, var(--color-surface-subtle) 82%, transparent);
}

.surface-assembly-preview__svg {
  width: 100%;
  min-height: 240px;
  overflow: visible;
}

.surface-assembly-preview__segment {
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.surface-assembly-preview__segment--guide {
  stroke: color-mix(in srgb, var(--line) 85%, transparent);
  stroke-dasharray: 5 6;
  stroke-width: 2;
}

.surface-assembly-preview__segment--production {
  stroke: #b9483c;
}

.surface-assembly-preview__segment--annulus {
  stroke: #3d79b4;
}

.surface-assembly-preview__structure-body {
  fill: color-mix(in srgb, var(--color-surface-elevated) 94%, white);
  stroke: var(--color-ink-strong);
  stroke-width: 2;
}

.surface-assembly-preview__structure-body--integrated {
  fill: color-mix(in srgb, #d8e2eb 72%, white);
}

.surface-assembly-preview__structure-label,
.surface-assembly-preview__slot-label,
.surface-assembly-preview__junction-label {
  fill: var(--color-ink-strong);
  font-size: 11px;
  font-weight: 700;
}

.surface-assembly-preview__junction-node {
  fill: var(--color-ink-strong);
}

.surface-assembly-preview__slot-body,
.surface-assembly-preview__slot-cap {
  stroke: var(--color-ink-strong);
  stroke-width: 2.2;
}

.surface-assembly-preview__slot-body--production,
.surface-assembly-preview__slot-cap--production {
  fill: color-mix(in srgb, #f0c1b7 75%, white);
}

.surface-assembly-preview__slot-body--annulus,
.surface-assembly-preview__slot-cap--annulus {
  fill: color-mix(in srgb, #bed4eb 75%, white);
}

.surface-assembly-preview__slot-body--seal {
  fill: color-mix(in srgb, #d4ddc4 84%, white);
}

.surface-assembly-preview__seal-line,
.surface-assembly-preview__slot-line {
  stroke: var(--color-ink-strong);
  stroke-width: 2;
}

.surface-assembly-preview__slot-cap--blocked {
  fill: color-mix(in srgb, #f2d7aa 85%, white);
}

.surface-assembly-preview__slot--selected .surface-assembly-preview__slot-body,
.surface-assembly-preview__slot--selected .surface-assembly-preview__slot-cap {
  stroke: var(--color-accent-primary-strong);
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--color-accent-primary) 42%, transparent));
}

.surface-assembly-preview__slot--interactive {
  cursor: pointer;
}
</style>
