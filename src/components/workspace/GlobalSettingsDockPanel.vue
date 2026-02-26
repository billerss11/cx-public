<script setup>
import { defineAsyncComponent } from 'vue';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';

const ViewOptions = defineAsyncComponent(() => import('@/components/controls/ViewOptions.vue'));
const PlotSettings = defineAsyncComponent(() => import('@/components/controls/PlotSettings.vue'));
const AutoGenerateControl = defineAsyncComponent(() => import('@/components/AutoGenerateControl.vue'));

function handleGeneratePlot() {
  requestSchematicRender({
    immediate: true,
    force: true
  });
}
</script>

<template>
  <div class="global-settings-dock-panel">
    <ViewOptions />
    <PlotSettings />

    <div class="global-settings-dock-panel__actions">
      <Button class="w-100" severity="success" type="button" @click="handleGeneratePlot">
        <i class="pi pi-chart-line"></i>
        <span data-i18n="ui.generate_plot">Generate Plot</span>
      </Button>
      <AutoGenerateControl />
    </div>
  </div>
</template>

<style scoped>
.global-settings-dock-panel {
  display: grid;
  gap: 10px;
}

.global-settings-dock-panel__actions {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--color-surface-elevated);
  padding: 12px;
}
</style>
