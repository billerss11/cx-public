<script setup>
import { nextTick } from 'vue';
import { HotTable } from '@handsontable/vue3';
import { useTableController } from '@/composables/useTableController.js';
import { focusHandsontableRow } from '@/composables/useTableHelpers.js';

const { hotRef, hotSettings, tableData, addRow, deleteSelectedRow } = useTableController('topologySource', 'topologySources');

function handleAddRow() {
  addRow();
}

function handleDeleteRow() {
  deleteSelectedRow();
}

async function focusRow(rowIndex) {
  await nextTick();
  return focusHandsontableRow(hotRef.value?.hotInstance ?? null, rowIndex);
}

defineExpose({
  focusRow
});
</script>

<template>
  <div class="table-pane-content">
    <div class="info-box" data-i18n-html="ui.info.topology_sources">
      <strong>Manual source overrides:</strong> add a source only when a real inflow origin is known but not represented elsewhere in the model.
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
