<script setup>
defineOptions({ name: 'LasInsightsDeck' });

import { computed } from 'vue';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Select from 'primevue/select';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
const MAX_PREVIEW_RENDER_ROWS = 12;
const MAX_PREVIEW_RENDER_COLUMNS = 12;

const props = defineProps({
  activeInsightsTab: {
    type: String,
    default: 'overview',
  },
  curveRanges: {
    type: Array,
    default: () => [],
  },
  dataPreview: {
    type: Object,
    default: null,
  },
  hasStatistics: {
    type: Boolean,
    default: false,
  },
  overview: {
    type: Object,
    default: null,
  },
  previewColumns: {
    type: Array,
    default: () => [],
  },
  selectedWellSectionName: {
    type: String,
    default: null,
  },
  statisticsColumns: {
    type: Array,
    default: () => [],
  },
  statisticsRows: {
    type: Array,
    default: () => [],
  },
  wellSectionOptions: {
    type: Array,
    default: () => [],
  },
  wellSectionRows: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:activeInsightsTab', 'update:selectedWellSectionName']);

const activeInsightsTabModel = computed({
  get: () => props.activeInsightsTab,
  set: (value) => emit('update:activeInsightsTab', value),
});

const selectedWellSectionModel = computed({
  get: () => props.selectedWellSectionName,
  set: (value) => emit('update:selectedWellSectionName', value),
});

const previewHeadRows = computed(() => {
  if (!Array.isArray(props.dataPreview?.head)) {
    return [];
  }

  return props.dataPreview.head;
});

const resolvedPreviewColumns = computed(() => {
  if (props.previewColumns.length) {
    return props.previewColumns;
  }

  return Object.keys(previewHeadRows.value[0] ?? {});
});

const previewVisibleColumns = computed(() =>
  resolvedPreviewColumns.value.slice(0, MAX_PREVIEW_RENDER_COLUMNS),
);

const previewVisibleRows = computed(() =>
  previewHeadRows.value.slice(0, MAX_PREVIEW_RENDER_ROWS).map((row) =>
    previewVisibleColumns.value.reduce((accumulator, columnName) => {
      accumulator[columnName] = row?.[columnName] ?? null;
      return accumulator;
    }, {}),
  ),
);

const previewLimitSummary = computed(() => {
  const totalRows = previewHeadRows.value.length;
  const totalColumns = resolvedPreviewColumns.value.length;
  const visibleRows = Math.min(totalRows, MAX_PREVIEW_RENDER_ROWS);
  const visibleColumns = Math.min(totalColumns, MAX_PREVIEW_RENDER_COLUMNS);

  if (!visibleRows && !visibleColumns) {
    return 'No preview sample is loaded.';
  }

  if (totalRows <= MAX_PREVIEW_RENDER_ROWS && totalColumns <= MAX_PREVIEW_RENDER_COLUMNS) {
    return `Showing ${visibleRows} rows and ${visibleColumns} columns.`;
  }

  return `Showing ${visibleRows} of ${totalRows} rows and ${visibleColumns} of ${totalColumns} columns.`;
});
</script>

<template>
  <section
    class="las-insights"
    data-testid="las-insights-deck"
    :data-active-tab="activeInsightsTab"
  >
    <header class="las-insights__header">
      <div>
        <p class="las-insights__eyebrow">Insights Deck</p>
        <h2 class="las-insights__title">Analytics and file details stay one pane away from the plot</h2>
      </div>
    </header>

    <Tabs v-model:value="activeInsightsTabModel" :lazy="true" class="las-insights__tabs">
      <TabList>
        <Tab value="overview">Overview</Tab>
        <Tab value="curves">Curves</Tab>
        <Tab value="analytics">Analytics</Tab>
        <Tab value="well">Well Info</Tab>
        <Tab value="preview">Data Preview</Tab>
      </TabList>

      <TabPanels>
        <TabPanel value="overview">
          <section class="las-insights__panel las-insights__panel--overview">
            <h3 class="las-insights__panel-title">Dataset Overview</h3>
            <div class="las-insights__overview-cards">
              <article class="las-insights__overview-card">
                <p class="las-insights__overview-label">Index Type</p>
                <p class="las-insights__overview-value">{{ overview?.indexDtype || '-' }}</p>
              </article>
              <article class="las-insights__overview-card">
                <p class="las-insights__overview-label">Index Range</p>
                <p class="las-insights__overview-value">{{ overview?.indexRangeDisplay || '-' }}</p>
              </article>
              <article class="las-insights__overview-card">
                <p class="las-insights__overview-label">Curves</p>
                <p class="las-insights__overview-value">{{ curveRanges.length.toLocaleString() }}</p>
              </article>
              <article class="las-insights__overview-card">
                <p class="las-insights__overview-label">Preview Shape</p>
                <p class="las-insights__overview-value">
                  {{ dataPreview?.shape?.[0] ?? 0 }} x {{ dataPreview?.shape?.[1] ?? 0 }}
                </p>
              </article>
            </div>
            <dl class="las-insights__meta">
              <dt>Index Min</dt>
              <dd>{{ overview?.indexMin ?? '-' }}</dd>
              <dt>Index Max</dt>
              <dd>{{ overview?.indexMax ?? '-' }}</dd>
              <dt>Preview Rows</dt>
              <dd>{{ dataPreview?.head?.length ?? 0 }}</dd>
              <dt>Well Sections</dt>
              <dd>{{ wellSectionOptions.length }}</dd>
            </dl>
          </section>
        </TabPanel>

        <TabPanel value="curves">
          <section class="las-insights__panel">
            <h3 class="las-insights__panel-title">Curve Details</h3>
            <p class="las-insights__panel-hint">
              Curve metadata is paginated here so large LAS files do not block the workspace on open.
            </p>
            <DataTable
              v-if="curveRanges.length"
              :value="curveRanges"
              size="small"
              :paginator="true"
              :rows="12"
              :rows-per-page-options="[12, 25, 50]"
              striped-rows
            >
              <Column field="curve" header="Curve" />
              <Column field="unit" header="Unit" />
              <Column field="range" header="Range" />
              <Column field="dataPoints" header="Data Points" />
              <Column field="description" header="Description" />
            </DataTable>
            <div v-else class="las-insights__empty">Curve metadata will appear after a session is loaded.</div>
          </section>
        </TabPanel>

        <TabPanel value="analytics">
          <section class="las-insights__panel las-insights__panel--bounded">
            <h3 class="las-insights__panel-title">Curve Statistics</h3>
            <p class="las-insights__panel-hint">Distribution and completeness metrics for the selected curves.</p>
            <div class="las-insights__data-shell">
              <DataTable
                v-if="hasStatistics"
                :value="statisticsRows"
                size="small"
                scrollable
                scroll-height="340px"
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
              <div v-else class="las-insights__empty">
                Use <strong>Statistics</strong> in the curve library to populate this panel.
              </div>
            </div>
          </section>
        </TabPanel>

        <TabPanel value="well">
          <section class="las-insights__panel">
            <div class="las-insights__panel-head">
              <h3 class="las-insights__panel-title">Well Information</h3>
              <Select
                v-if="wellSectionOptions.length"
                v-model="selectedWellSectionModel"
                :options="wellSectionOptions"
                option-label="label"
                option-value="value"
                class="las-insights__section-select"
              />
            </div>

            <DataTable
              v-if="wellSectionOptions.length"
              :value="wellSectionRows"
              size="small"
              scrollable
              :rows="10"
              striped-rows
            >
              <Column field="mnemonic" header="Mnemonic" />
              <Column field="value" header="Value" />
              <Column field="unit" header="Unit" />
              <Column field="description" header="Description" />
            </DataTable>
            <div v-else class="las-insights__empty">No LAS section metadata is available for this file.</div>
          </section>
        </TabPanel>

        <TabPanel value="preview">
          <section class="las-insights__panel">
            <h3 class="las-insights__panel-title">Preview Rows</h3>
            <p class="las-insights__panel-hint">
              Shape: {{ dataPreview?.shape?.[0] ?? 0 }} x {{ dataPreview?.shape?.[1] ?? 0 }}
            </p>
            <p class="las-insights__panel-hint">{{ previewLimitSummary }}</p>
            <DataTable
              v-if="previewVisibleRows.length"
              :value="previewVisibleRows"
              size="small"
              scrollable
              :rows="8"
              striped-rows
            >
              <Column
                v-for="columnName in previewVisibleColumns"
                :key="columnName"
                :field="columnName"
                :header="columnName"
              />
            </DataTable>
            <div v-else class="las-insights__empty">No preview rows are available for this session.</div>
          </section>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </section>
</template>

<style scoped>
.las-insights {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow: hidden;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  box-shadow: var(--shadow-soft);
  isolation: isolate;
  position: relative;
  z-index: 1;
}

.las-insights__eyebrow {
  margin: 0 0 4px;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--p-text-muted-color, #6f7786);
}

.las-insights__title {
  margin: 0;
  font-size: 1.02rem;
}

.las-insights__tabs :deep(.p-tablist-tab-list) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.las-insights__tabs :deep(.p-tab) {
  margin: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-weight: 700;
  color: var(--muted);
  transition: all 0.18s ease;
}

.las-insights__tabs :deep(.p-tab.p-tab-active) {
  color: var(--ink);
  background: color-mix(in srgb, var(--color-accent-primary) 16%, transparent);
  border-color: color-mix(in srgb, var(--color-accent-primary-strong) 26%, transparent);
}

.las-insights__tabs :deep(.p-tablist-active-bar) {
  display: none;
}

.las-insights__tabs :deep(.p-tabpanels) {
  padding-top: 12px;
}

.las-insights__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.las-insights__grid--overview {
  grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1.28fr);
}

.las-insights__panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: auto;
  overflow: hidden;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, white);
}

.las-insights__panel--overview {
  gap: 16px;
}

.las-insights__panel--bounded {
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 65%, transparent);
}

.las-insights__overview-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.las-insights__overview-card {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-subtle) 92%, white);
}

.las-insights__overview-label {
  margin: 0 0 4px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--p-text-muted-color, #6f7786);
}

.las-insights__overview-value {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}

.las-insights__panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.las-insights__panel-title {
  margin: 0;
  font-size: 0.9rem;
}

.las-insights__panel-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.las-insights__section-select {
  width: min(100%, 260px);
}

.las-insights__meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  margin: 0;
}

.las-insights__meta dt {
  font-weight: 700;
  color: var(--p-text-muted-color, #6f7786);
}

.las-insights__meta dd {
  margin: 0;
  color: var(--ink);
}

.las-insights__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  padding: 16px;
  border: 1px dashed var(--line);
  border-radius: var(--radius-md);
  color: var(--muted);
  text-align: center;
}

.las-insights__data-shell {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-elevated) 94%, white);
}

.las-insights__tabs :deep(.p-tabpanels),
.las-insights__data-shell :deep(.p-datatable-table-container) {
  max-width: 100%;
  overflow: auto;
}

.las-insights__data-shell :deep(.p-datatable-table) {
  min-width: max-content;
}

@media (max-width: 960px) {
  .las-insights__grid {
    grid-template-columns: 1fr;
  }

  .las-insights__grid--overview {
    grid-template-columns: 1fr;
  }

  .las-insights__overview-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .las-insights__panel-head {
    flex-direction: column;
    align-items: stretch;
  }

  .las-insights__section-select {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .las-insights__overview-cards {
    grid-template-columns: 1fr;
  }
}
</style>
