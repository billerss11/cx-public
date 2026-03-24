<script setup>
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { HotTable } from '@handsontable/vue3';
import Button from 'primevue/button';
import { useTableController } from '@/composables/useTableController.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { resolveAvailableSurfaceChannels } from '@/surface/channelAvailability.js';
import { buildDefaultSurfaceComponents } from '@/surface/templateCatalog.js';

const { hotRef, hotSettings, tableData, addRow, deleteSelectedRow } = useTableController('surfaceEquipment', 'surfaceEquipment');
const projectDataStore = useProjectDataStore();
const { surfaceComponents, casingData, tubingData } = storeToRefs(projectDataStore);

const isEmpty = computed(() => {
  const rows = surfaceComponents.value;
  return !Array.isArray(rows) || rows.length === 0;
});

function handleAddRow() {
  addRow();
}

function handleDeleteRow() {
  deleteSelectedRow();
}

function handlePopulateDefaults() {
  const availableChannels = resolveAvailableSurfaceChannels({
    casingData: casingData.value,
    tubingData: tubingData.value
  });
  const defaults = buildDefaultSurfaceComponents(availableChannels);
  projectDataStore.setSurfaceComponents(defaults);
}
</script>

<template>
  <div class="table-pane-content">
    <div class="info-box" data-i18n-html="ui.info.surface_equipment">
      <strong>Surface Equipment:</strong> define wellhead valves, outlets, and crossovers for each flow channel.
    </div>

    <div v-if="isEmpty" class="surface-equipment-pane__empty">
      <p class="surface-equipment-pane__empty-text">
        No surface equipment defined. Populate with standard defaults based on your well configuration.
      </p>
      <Button size="small" type="button" @click="handlePopulateDefaults">
        <i class="pi pi-bolt"></i>
        <span data-i18n="ui.surface_equipment.populate_defaults">Populate from Well Data</span>
      </Button>
    </div>

    <div class="handsontable-container">
      <HotTable ref="hotRef" :settings="hotSettings" :data="tableData" />
    </div>

    <div class="surface-equipment-pane__actions">
      <Button size="small" type="button" @click="handleAddRow">
        <i class="pi pi-plus-circle"></i>
        <span data-i18n="ui.add_row">Add Row</span>
      </Button>
      <Button class="ms-2" size="small" severity="danger" outlined type="button" @click="handleDeleteRow">
        <i class="pi pi-trash"></i>
        <span data-i18n="ui.delete_row">Delete Row</span>
      </Button>
      <Button
        v-if="!isEmpty"
        class="ms-2"
        size="small"
        severity="secondary"
        outlined
        type="button"
        @click="handlePopulateDefaults"
      >
        <i class="pi pi-refresh"></i>
        <span data-i18n="ui.surface_equipment.reset_defaults">Reset to Defaults</span>
      </Button>
    </div>
  </div>
</template>

<style scoped>
.surface-equipment-pane__empty {
  padding: 16px;
  margin-bottom: 10px;
  border: 1px dashed var(--line);
  border-radius: var(--radius-md);
  background: var(--color-surface-elevated);
  text-align: center;
}

.surface-equipment-pane__empty-text {
  margin: 0 0 10px;
  font-size: 0.85rem;
  color: var(--muted);
}

.surface-equipment-pane__actions {
  margin-top: 6px;
}
</style>
