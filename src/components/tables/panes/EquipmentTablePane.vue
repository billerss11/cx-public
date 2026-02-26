<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { HotTable } from '@handsontable/vue3';
import { useTableController } from '@/composables/useTableController.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { getEquipmentRuleRowWarnings } from '@/topology/equipmentRules.js';

const { hotRef, hotSettings, tableData, addRow, deleteSelectedRow } = useTableController('equipment', 'equipment');
const projectDataStore = useProjectDataStore();
const { equipmentData, casingData, tubingData } = storeToRefs(projectDataStore);

const engineeringWarnings = computed(() => {
  const rows = Array.isArray(equipmentData.value) ? equipmentData.value : [];
  const warnings = [];

  rows.forEach((row, rowIndex) => {
    const rowWarnings = getEquipmentRuleRowWarnings(row, {
      casingRows: casingData.value,
      tubingRows: tubingData.value
    });
    rowWarnings.forEach((warning, warningIndex) => {
      warnings.push({
        key: `${row?.rowId ?? rowIndex}-${warningIndex}-${warning.message}`,
        rowNumber: rowIndex + 1,
        message: warning.message,
        recommendation: String(warning?.recommendation ?? '').trim() || null
      });
    });
  });

  return warnings.slice(0, 8);
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
    <div class="info-box" data-i18n-html="ui.info.equipment">
      <strong>Equipment:</strong> define depth/type and optional engineering state fields used by topology rules.
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

    <div v-if="engineeringWarnings.length > 0" class="equipment-table-pane__warnings">
      <p class="equipment-table-pane__warnings-title" data-i18n="ui.equipment_engineering_warnings_title">
        Equipment engineering warnings:
      </p>
      <ul class="equipment-table-pane__warnings-list">
        <li
          v-for="warning in engineeringWarnings"
          :key="warning.key"
          class="equipment-table-pane__warnings-item"
        >
          <strong>#{{ warning.rowNumber }}:</strong>
          <span>{{ warning.message }}</span>
          <small
            v-if="warning.recommendation"
            class="equipment-table-pane__warning-recommendation"
          >
            <strong data-i18n="ui.visual_inspector.recommendation_label">Recommendation:</strong>
            <span>{{ warning.recommendation }}</span>
          </small>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.equipment-table-pane__warnings {
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  background: var(--color-surface-elevated);
}

.equipment-table-pane__warnings-title {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: var(--muted);
}

.equipment-table-pane__warnings-list {
  margin: 0;
  padding-left: 16px;
}

.equipment-table-pane__warnings-item {
  font-size: 0.8rem;
  line-height: 1.35;
}

.equipment-table-pane__warning-recommendation {
  display: block;
  color: var(--muted);
}
</style>
