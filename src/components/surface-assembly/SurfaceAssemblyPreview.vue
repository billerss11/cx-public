<script setup>
import { computed } from 'vue';
import { buildSurfaceAssemblyLayout } from '@/utils/surfaceAssemblyLayout.js';

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
  selectedComponentId: {
    type: String,
    default: null,
  },
  compact: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['select-component']);

const layoutModel = computed(() => buildSurfaceAssemblyLayout(props.assembly));
const svgStyle = computed(() => ({
  height: props.compact ? '180px' : '100%',
}));

function buildValvePoints(component) {
  const halfWidth = component.preview.width / 2;
  const halfHeight = component.preview.height / 2;
  return [
    `${component.x},${component.y - halfHeight}`,
    `${component.x + halfWidth},${component.y}`,
    `${component.x},${component.y + halfHeight}`,
    `${component.x - halfWidth},${component.y}`,
  ].join(' ');
}

function handleSelect(componentId) {
  if (props.interactive !== true) return;
  emit('select-component', componentId);
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

    <svg
      v-else
      class="surface-assembly-preview__svg"
      :style="svgStyle"
      :viewBox="`0 0 ${layoutModel.width} ${layoutModel.height}`"
      role="img"
      aria-label="Surface assembly preview"
    >
      <line
        v-for="segment in layoutModel.trunkConnections"
        :key="segment.key"
        class="surface-assembly-preview__connection"
        :x1="segment.x1"
        :y1="segment.y1"
        :x2="segment.x2"
        :y2="segment.y2"
      />

      <line
        v-for="segment in layoutModel.branchConnections"
        :key="segment.key"
        class="surface-assembly-preview__connection"
        :x1="segment.x1"
        :y1="segment.y1"
        :x2="segment.x2"
        :y2="segment.y2"
      />

      <g
        v-for="component in layoutModel.components"
        :key="component.componentId"
        class="surface-assembly-preview__component"
        :class="{
          'surface-assembly-preview__component--selected': selectedComponentId === component.componentId,
          'surface-assembly-preview__component--interactive': interactive,
        }"
        :data-component-id="component.componentId"
        data-testid="surface-assembly-component"
        @click="handleSelect(component.componentId)"
      >
        <rect
          v-if="component.preview.shape === 'spool'"
          class="surface-assembly-preview__body"
          :x="component.x - (component.preview.width / 2)"
          :y="component.y - (component.preview.height / 2)"
          :width="component.preview.width"
          :height="component.preview.height"
          rx="6"
        />

        <polygon
          v-else-if="component.preview.shape === 'valve'"
          class="surface-assembly-preview__body"
          :points="buildValvePoints(component)"
        />

        <g v-else-if="component.preview.shape === 'cross'">
          <rect
            class="surface-assembly-preview__body"
            :x="component.x - (component.preview.width / 2)"
            :y="component.y - (component.preview.height / 2)"
            :width="component.preview.width"
            :height="component.preview.height"
            rx="6"
          />
          <line
            class="surface-assembly-preview__port-line"
            :x1="component.x + (component.preview.width / 2)"
            :y1="component.y"
            :x2="component.x + (component.preview.width / 2) + 18"
            :y2="component.y"
          />
        </g>

        <g v-else-if="component.preview.shape === 'outlet'">
          <line
            class="surface-assembly-preview__port-line"
            :x1="component.x - (component.preview.width / 2)"
            :y1="component.y"
            :x2="component.x + (component.preview.width / 2)"
            :y2="component.y"
          />
          <circle
            class="surface-assembly-preview__outlet-cap"
            :cx="component.x + (component.preview.width / 2)"
            :cy="component.y"
            r="8"
          />
        </g>

        <text
          v-if="showLabels"
          class="surface-assembly-preview__label"
          :x="component.x"
          :y="component.y + (component.preview.height / 2) + 18"
          text-anchor="middle"
        >
          {{ component.label }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.surface-assembly-preview {
  display: flex;
  width: 100%;
  min-height: 0;
  align-items: center;
  justify-content: center;
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
  min-height: 220px;
}

.surface-assembly-preview__connection,
.surface-assembly-preview__port-line {
  stroke: var(--color-ink-strong);
  stroke-width: 2.5;
  stroke-linecap: round;
}

.surface-assembly-preview__body,
.surface-assembly-preview__outlet-cap {
  fill: color-mix(in srgb, var(--color-surface-elevated) 92%, white);
  stroke: var(--color-ink-strong);
  stroke-width: 2.5;
}

.surface-assembly-preview__label {
  fill: var(--color-ink-strong);
  font-size: 11px;
  font-weight: 700;
}

.surface-assembly-preview__component--selected .surface-assembly-preview__body,
.surface-assembly-preview__component--selected .surface-assembly-preview__outlet-cap {
  stroke: var(--color-accent-primary-strong);
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--color-accent-primary) 42%, transparent));
}

.surface-assembly-preview__component--interactive {
  cursor: pointer;
}
</style>
