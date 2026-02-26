<script setup>
import { HotTable } from '@handsontable/vue3';
import { useTableController } from '@/composables/useTableController.js';

const { hotRef, hotSettings, tableData, addRow, deleteSelectedRow } = useTableController('fluid', 'fluids');

function handleAddRow() {
  addRow();
}

function handleDeleteRow() {
  deleteSelectedRow();
}
</script>

<template>
  <div class="table-pane-content">
    <div class="info-box" data-i18n-html="ui.info.fluids">
      <strong>Annulus fluids:</strong> configure placement and interval details.
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
