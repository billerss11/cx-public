<script setup>
import { computed } from 'vue';
import { HotTable } from '@handsontable/vue3';
import ToggleSwitch from 'primevue/toggleswitch';
import { useTableController } from '@/composables/useTableController.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

const { hotRef, hotSettings, tableData, addRow, deleteSelectedRow } = useTableController('topologySource', 'topologySources');
const viewConfigStore = useViewConfigStore();

const openHoleSourceEnabled = computed({
  get: () => viewConfigStore.config?.topologyUseOpenHoleSource === true,
  set: (value) => {
    viewConfigStore.setConfigValue('topologyUseOpenHoleSource', value === true);
  }
});

function handleAddRow() {
  addRow();
}

function handleDeleteRow() {
  deleteSelectedRow();
}
</script>

<template>
  <div class="table-pane-content">
    <div class="info-box" data-i18n-html="ui.info.topology_sources">
      <strong>Inflow points:</strong> define explicit inflow rows for analysis runs.
    </div>
    <div class="d-flex flex-column gap-1 mb-2">
      <div class="d-flex align-items-center gap-2">
        <ToggleSwitch
          input-id="topologyOpenHoleSourceToggle"
          v-model="openHoleSourceEnabled"
        />
        <label for="topologyOpenHoleSourceToggle" data-i18n="ui.topology.open_hole_source_toggle">
          Treat open hole as inflow point (basic mode)
        </label>
      </div>
      <small class="text-muted" data-i18n="ui.topology.open_hole_source_toggle_help">
        Adds inflow seeds on open-hole intervals when explicit inflow rows are absent/unresolved.
      </small>
    </div>
    <div class="handsontable-container">
      <HotTable ref="hotRef" :settings="hotSettings" :data="tableData" />
    </div>
    <Button size="small" type="button" @click="handleAddRow">
      <i class="pi pi-plus-circle"></i>
      <span data-i18n="ui.add_row">Add Row</span>
    </Button>
    <Button class="ms-2" size="small" severity="danger" outlined type="button" @click="handleDeleteRow">
      <i class="pi pi-trash"></i>
      <span data-i18n="ui.delete_row">Delete Row</span>
    </Button>
  </div>
</template>
