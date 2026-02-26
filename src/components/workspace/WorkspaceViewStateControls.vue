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
    <div class="workspace-view-state-controls__state-group">
      <p class="workspace-view-state-controls__state-label" data-i18n="ui.well_view_mode">Well View Mode:</p>
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

    <div class="workspace-view-state-controls__state-group">
      <p class="workspace-view-state-controls__state-label" data-i18n="ui.operation_phase">Operation Phase:</p>
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
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.workspace-view-state-controls__state-group {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.workspace-view-state-controls__state-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--muted);
  text-transform: uppercase;
  margin: 0;
}

.workspace-view-state-controls__segmented-control :deep(.p-selectbutton) {
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.workspace-view-state-controls__segmented-control :deep(.p-togglebutton) {
  padding: 5px 11px;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.1;
}

.workspace-view-state-controls__segmented-control :deep(.p-togglebutton-content) {
  white-space: nowrap;
}

@media (max-width: 991px) {
  .workspace-view-state-controls {
    width: 100%;
    justify-content: flex-start;
  }

  .workspace-view-state-controls__state-group {
    flex: 1 1 210px;
  }
}
</style>
