<script setup>
import { computed } from 'vue';
import SelectButton from 'primevue/selectbutton';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

const viewConfigStore = useViewConfigStore();
const config = viewConfigStore.config;

const viewModeOptions = Object.freeze([
  { value: 'vertical', label: 'Vertical', i18nKey: 'ui.view_mode.vertical' },
  { value: 'directional', label: 'Directional', i18nKey: 'ui.view_mode.directional' }
]);

const operationPhaseOptions = Object.freeze([
  { value: 'drilling', label: 'Drilling', i18nKey: 'ui.operation_phase.drilling' },
  { value: 'production', label: 'Production', i18nKey: 'ui.operation_phase.production' }
]);

const viewModeModel = computed({
  get: () => (config.viewMode === 'directional' ? 'directional' : 'vertical'),
  set: (mode) => {
    setViewMode(mode);
  }
});

const operationPhaseModel = computed({
  get: () => (config.operationPhase === 'drilling' ? 'drilling' : 'production'),
  set: (phase) => {
    setOperationPhase(phase);
  }
});

function setViewMode(mode) {
  viewConfigStore.setViewMode(mode);
  requestSchematicRender({ immediate: true });
}

function setOperationPhase(phase) {
  viewConfigStore.setOperationPhase(phase);
  requestSchematicRender({ immediate: true });
}
</script>

<template>
  <section class="workspace-view-state-controls" role="group" aria-label="Well context controls">
    <div class="workspace-view-state-controls__inline-group">
      <span class="workspace-view-state-controls__inline-label" data-i18n="ui.toolbar.mode_short">Mode</span>
      <SelectButton
        v-model="viewModeModel"
        :options="viewModeOptions"
        option-label="label"
        option-value="value"
        size="small"
        class="workspace-view-state-controls__segmented-control"
        aria-label="Well view mode"
      >
        <template #option="slotProps">
          <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
        </template>
      </SelectButton>
    </div>

    <div class="workspace-view-state-controls__inline-group">
      <span class="workspace-view-state-controls__inline-label" data-i18n="ui.toolbar.phase_short">Phase</span>
      <SelectButton
        v-model="operationPhaseModel"
        :options="operationPhaseOptions"
        option-label="label"
        option-value="value"
        size="small"
        class="workspace-view-state-controls__segmented-control"
        aria-label="Operation phase"
      >
        <template #option="slotProps">
          <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
        </template>
      </SelectButton>
    </div>
  </section>
</template>

<style scoped>
.workspace-view-state-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  flex-wrap: nowrap;
  min-width: 0;
}

.workspace-view-state-controls__inline-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--panel-bg) 92%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-surface-elevated) 35%, transparent);
  min-width: 0;
}

.workspace-view-state-controls__inline-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--muted);
  text-transform: uppercase;
  white-space: nowrap;
}

.workspace-view-state-controls__segmented-control :deep(.p-selectbutton) {
  border: 1px solid color-mix(in srgb, var(--line) 74%, transparent);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.workspace-view-state-controls__segmented-control :deep(.p-togglebutton) {
  min-height: 28px;
  padding: 4px 9px;
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.1;
}

.workspace-view-state-controls__segmented-control :deep(.p-togglebutton-content) {
  white-space: nowrap;
}

@media (max-width: 991px) {
  .workspace-view-state-controls {
    width: auto;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .workspace-view-state-controls__inline-group {
    flex: 1 1 auto;
  }
}
</style>
