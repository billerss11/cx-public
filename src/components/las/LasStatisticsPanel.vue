<script setup>
defineOptions({ name: 'LasStatisticsPanel' });

import Column from 'primevue/column';
import DataTable from 'primevue/datatable';

const props = defineProps({
  hasStatistics: {
    type: Boolean,
    default: false,
  },
  statisticsColumns: {
    type: Array,
    default: () => [],
  },
  statisticsRows: {
    type: Array,
    default: () => [],
  },
});
</script>

<template>
  <section class="las-statistics-panel" data-testid="las-statistics-panel">
    <p class="las-statistics-panel__hint">Distribution and completeness metrics for the selected curves.</p>
    <div class="las-statistics-panel__table-shell">
      <DataTable
        v-if="hasStatistics"
        :value="statisticsRows"
        size="small"
        scrollable
        scroll-height="100%"
        :rows="10"
        striped-rows
      >
        <Column field="metricLabel" header="Metric" />
        <Column v-for="columnName in statisticsColumns" :key="columnName" :header="columnName">
          <template #body="{ data }">
            {{ data.values?.[columnName] ?? 'N/A' }}
          </template>
        </Column>
      </DataTable>
      <div v-else class="las-statistics-panel__empty">
        No statistics data available.
      </div>
    </div>
  </section>
</template>

<style scoped>
.las-statistics-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  height: 100%;
}

.las-statistics-panel__hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.las-statistics-panel__table-shell {
  min-height: 0;
  height: 100%;
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-elevated) 94%, white);
}

.las-statistics-panel__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  padding: 16px;
  color: var(--muted);
  text-align: center;
}

.las-statistics-panel__table-shell :deep(.p-datatable) {
  height: 100%;
}

.las-statistics-panel__table-shell :deep(.p-datatable-table-container) {
  max-width: 100%;
  overflow: auto;
}

.las-statistics-panel__table-shell :deep(.p-datatable-table) {
  min-width: max-content;
}
</style>
