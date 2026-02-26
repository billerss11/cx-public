<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { HotTable } from '@handsontable/vue3';
import { useTableController } from '@/composables/useTableController.js';
import { useTopologyStore } from '@/stores/topologyStore.js';
import { buildScenarioBreakoutWarningIndex } from '@/topology/breakoutWarnings.js';
import {
  requestTableRowFocus,
  setActiveTableTabKey,
  setTablesAccordionOpen
} from '@/components/tables/panes/tablePaneState.js';

const { hotRef, hotSettings, tableData, addRow, deleteSelectedRow } = useTableController('topologyBreakout', 'topologyBreakouts');
const topologyStore = useTopologyStore();
const { activeWellTopology } = storeToRefs(topologyStore);

const breakoutWarningIndex = computed(() => buildScenarioBreakoutWarningIndex(
  tableData.value,
  activeWellTopology.value?.result?.validationWarnings
));

const breakoutWarnings = computed(() => breakoutWarningIndex.value.warnings.slice(0, 8));

const hotSettingsWithWarnings = computed(() => {
  const baseSettings = hotSettings.value;
  const baseCells = typeof baseSettings?.cells === 'function' ? baseSettings.cells : null;

  return {
    ...baseSettings,
    cells: (row, col, prop) => {
      const cellProperties = {
        ...(baseCells ? (baseCells(row, col, prop) || {}) : {})
      };
      const rowData = tableData.value?.[row];
      const rowId = String(rowData?.rowId ?? '').trim();
      const fieldName = typeof prop === 'string' ? prop : null;

      if (!rowId || !fieldName) return cellProperties;

      const warningFields = breakoutWarningIndex.value.fieldMapByRowId.get(rowId);
      if (!warningFields?.has(fieldName)) return cellProperties;

      const className = String(cellProperties.className ?? '').trim();
      cellProperties.className = className
        ? `${className} topology-breakout-warning-cell`
        : 'topology-breakout-warning-cell';
      return cellProperties;
    }
  };
});

function handleAddRow() {
  addRow();
}

function handleDeleteRow() {
  deleteSelectedRow();
}

function handleFocusWarningRow(warning) {
  const rowIndex = Number(warning?.rowIndex);
  if (!Number.isInteger(rowIndex) || rowIndex < 0) return;

  setTablesAccordionOpen(true);
  setActiveTableTabKey('topologyBreakouts');
  requestTableRowFocus('topologyBreakout', rowIndex);
}
</script>

<template>
  <div class="table-pane-content">
    <div class="info-box" data-i18n-html="ui.info.topology_breakouts">
      <strong>Topology breakouts:</strong> define explicit cross-annulus volume pairs across depth ranges.
    </div>
    <div class="handsontable-container">
      <HotTable ref="hotRef" :settings="hotSettingsWithWarnings" :data="tableData" />
    </div>
    <Button size="small" type="button" @click="handleAddRow">
      <i class="pi pi-plus-circle"></i>
      <span data-i18n="ui.add_row">Add Row</span>
    </Button>
    <Button class="ms-2" size="small" severity="danger" outlined type="button" @click="handleDeleteRow">
      <i class="pi pi-trash"></i>
      <span data-i18n="ui.delete_row">Delete Row</span>
    </Button>

    <div v-if="breakoutWarnings.length > 0" class="topology-breakouts-table-pane__warnings">
      <p class="topology-breakouts-table-pane__warnings-title" data-i18n="ui.topology_breakout_warnings_title">
        Topology breakout warnings:
      </p>
      <ul class="topology-breakouts-table-pane__warnings-list">
        <li
          v-for="warning in breakoutWarnings"
          :key="warning.key"
          class="topology-breakouts-table-pane__warnings-item"
        >
          <Button
            class="topology-breakouts-table-pane__warning-focus-button"
            size="small"
            text
            type="button"
            @click="handleFocusWarningRow(warning)"
          >
            #{{ warning.rowNumber }}
          </Button>
          <span class="topology-breakouts-table-pane__warning-separator">:</span>
          <span>{{ warning.message }}</span>
          <small
            v-if="warning.recommendation"
            class="topology-breakouts-table-pane__warning-recommendation"
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
.topology-breakouts-table-pane__warnings {
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  background: var(--color-surface-elevated);
}

.topology-breakouts-table-pane__warnings-title {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: var(--muted);
}

.topology-breakouts-table-pane__warnings-list {
  margin: 0;
  padding-left: 16px;
}

.topology-breakouts-table-pane__warnings-item {
  font-size: 0.8rem;
  line-height: 1.35;
}

.topology-breakouts-table-pane__warning-focus-button {
  padding: 0;
  min-width: auto;
  font-weight: 700;
  vertical-align: baseline;
}

.topology-breakouts-table-pane__warning-separator {
  margin-right: 4px;
}

.topology-breakouts-table-pane__warning-recommendation {
  display: block;
  color: var(--muted);
}
</style>
