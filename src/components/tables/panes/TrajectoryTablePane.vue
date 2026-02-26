<script setup>
import { HotTable } from '@handsontable/vue3';
import { useTableController } from '@/composables/useTableController.js';

const { hotRef, hotSettings, tableData, addRow, deleteSelectedTrajectoryRow } = useTableController('trajectory', 'trajectory');

function handleAddTrajectoryRow() {
  addRow();
}

function handleDeleteSelectedTrajectoryRow() {
  deleteSelectedTrajectoryRow();
}
</script>

<template>
  <div class="table-pane-content">
    <div class="handsontable-container hot-container">
      <HotTable ref="hotRef" :settings="hotSettings" :data="tableData" />
    </div>
    <Button size="small" type="button" @click="handleAddTrajectoryRow">
      <i class="pi pi-plus-circle"></i>
      <span data-i18n="ui.add_row">Add Row</span>
    </Button>
    <Button class="ms-2" size="small" severity="danger" outlined type="button" @click="handleDeleteSelectedTrajectoryRow">
      <i class="pi pi-trash"></i>
      <span data-i18n="ui.delete_row">Delete Row</span>
    </Button>
    <div class="text-muted small mt-2">
      <i class="pi pi-info-circle"></i>
      Enter <b>MD</b>, <b>Inc</b>, and <b>Azi</b>. The directional view computes TVD and offset from minimum curvature.
    </div>
  </div>
</template>
