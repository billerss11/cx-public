<script setup>
import { computed, watch } from 'vue';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { clamp, formatDepthValue } from '@/utils/general.js';
import { createContext as createPhysicsContext } from '@/composables/usePhysics.js';
import {
  getCrossSectionDepthRange,
  resolveCrossSectionSliderStep
} from '@/composables/useCrossSectionRange.js';
import CrossSectionCanvas from './CrossSectionCanvas.vue';

const projectDataStore = useProjectDataStore();
const viewConfigStore = useViewConfigStore();
const config = viewConfigStore.config;

const unitsLabel = computed(() => (config?.units === 'm' ? 'm' : 'ft'));

const physicsConfig = computed(() => ({
  operationPhase: config?.operationPhase,
  crossoverEpsilon: config?.crossoverEpsilon
}));

const physicsContext = computed(() => {
  const casingCount = Array.isArray(projectDataStore.casingData) ? projectDataStore.casingData.length : 0;
  const tubingCount = Array.isArray(projectDataStore.tubingData) ? projectDataStore.tubingData.length : 0;
  const drillStringCount = Array.isArray(projectDataStore.drillStringData) ? projectDataStore.drillStringData.length : 0;
  if ((casingCount + tubingCount + drillStringCount) === 0) {
    return null;
  }

  return createPhysicsContext({
    casingData: projectDataStore.casingData,
    tubingData: projectDataStore.tubingData,
    drillStringData: projectDataStore.drillStringData,
    equipmentData: projectDataStore.equipmentData,
    horizontalLines: projectDataStore.horizontalLines,
    annotationBoxes: projectDataStore.annotationBoxes,
    cementPlugs: projectDataStore.cementPlugs,
    annulusFluids: projectDataStore.annulusFluids,
    markers: projectDataStore.markers,
    trajectory: projectDataStore.trajectory,
    config: physicsConfig.value
  });
});

const depthRange = computed(() => (
  physicsContext.value ? getCrossSectionDepthRange(physicsContext.value) : null
));

const minDepth = computed(() => depthRange.value?.minDepth ?? 0);
const maxDepth = computed(() => depthRange.value?.maxDepth ?? 1);
const sliderStep = computed(() => (
  depthRange.value
    ? resolveCrossSectionSliderStep(maxDepth.value - minDepth.value)
    : 0.1
));
const isDepthDisabled = computed(() => depthRange.value === null);

function resolveCursorDepth() {
  if (!depthRange.value) return null;

  const requested = Number(config?.cursorDepth);
  if (!Number.isFinite(requested)) {
    return minDepth.value;
  }

  return clamp(requested, minDepth.value, maxDepth.value);
}

function setCursorDepth(value) {
  if (!depthRange.value) return;

  const requested = Number(value);
  if (!Number.isFinite(requested)) return;

  const nextDepth = clamp(requested, minDepth.value, maxDepth.value);
  viewConfigStore.setCursorDepth(nextDepth);
}

watch(depthRange, (range) => {
  if (!range) {
    viewConfigStore.setCursorDepth(null);
    return;
  }

  const requested = Number(config?.cursorDepth);
  const nextDepth = Number.isFinite(requested)
    ? clamp(requested, range.minDepth, range.maxDepth)
    : range.minDepth;
  viewConfigStore.setCursorDepth(nextDepth);
}, { immediate: true });

const depthInputModel = computed({
  get() {
    const depth = resolveCursorDepth();
    return Number.isFinite(depth) ? Number(depth.toFixed(3)) : null;
  },
  set(nextValue) {
    setCursorDepth(nextValue);
  }
});

const renderDepth = computed(() => {
  const depth = resolveCursorDepth();
  return Number.isFinite(depth) ? depth : minDepth.value;
});

const minDepthLabel = computed(() => (
  depthRange.value ? `${formatDepthValue(minDepth.value)} ${unitsLabel.value}` : '-'
));
const maxDepthLabel = computed(() => (
  depthRange.value ? `${formatDepthValue(maxDepth.value)} ${unitsLabel.value}` : '-'
));
const currentDepthLabel = computed(() => {
  const depth = resolveCursorDepth();
  if (!Number.isFinite(depth)) return 'Depth: -';
  return `Depth: ${formatDepthValue(depth)} ${unitsLabel.value}`;
});
</script>

<template>
  <div class="cross-section-panel">
    <div class="cross-section-content">
      <div class="cross-section-canvas-column">
        <CrossSectionCanvas
          :depth="renderDepth"
          :project-data="physicsContext"
          :config="config"
        />
        <div class="cross-section-depth-value">{{ currentDepthLabel }}</div>

        <div class="cross-section-depth-input-wrap">
          <label class="form-label" for="crossSectionDepthInputDeclarative" data-i18n="ui.cross_section_exact_depth">Exact depth</label>
          <InputNumber
            input-id="crossSectionDepthInputDeclarative"
            v-model="depthInputModel"
            data-vue-owned="true"
            :min="minDepth"
            :max="maxDepth"
            :step="sliderStep"
            :disabled="isDepthDisabled"
            :use-grouping="false"
            fluid
            size="small"
          />
        </div>

        <div class="cross-section-depth-range">
          <span>{{ minDepthLabel }}</span>
          <span>{{ maxDepthLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cross-section-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
  width: 100%;
  min-width: 0;
}

.cross-section-content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: 8px;
  width: 100%;
}

.cross-section-canvas-column {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto auto;
  justify-items: center;
  row-gap: 8px;
  height: 100%;
  min-height: 0;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}

.cross-section-depth-value {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-cross-panel-depth);
  text-align: center;
  min-height: 1.2rem;
}

.cross-section-depth-range {
  width: 100%;
  display: flex;
  justify-content: space-between;
  color: var(--color-cross-panel-range);
  font-size: 0.72rem;
}

@media (max-height: 760px) {
  .cross-section-canvas-column {
    row-gap: 6px;
  }
}
</style>
