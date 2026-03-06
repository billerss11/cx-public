<script setup>
defineOptions({ name: 'LasCurveLibraryPanel' });

import { computed } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';

const props = defineProps({
  curveFilterText: {
    type: String,
    default: '',
  },
  filteredCurveOptions: {
    type: Array,
    default: () => [],
  },
  selectedCurveNames: {
    type: Array,
    default: () => [],
  },
  selectedCurveCount: {
    type: Number,
    default: 0,
  },
  canPlot: {
    type: Boolean,
    default: false,
  },
  canCorrelate: {
    type: Boolean,
    default: false,
  },
  canExportAllCurves: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'clear-selection',
  'close',
  'export-all-csv',
  'export-selected-csv',
  'plot-selected',
  'show-correlation',
  'show-statistics',
  'update:curveFilterText',
  'update:selectedCurveNames',
]);

const curveFilterModel = computed({
  get: () => props.curveFilterText,
  set: (value) => emit('update:curveFilterText', value),
});

const selectionModel = computed({
  get: () => props.selectedCurveNames,
  set: (value) => emit('update:selectedCurveNames', value),
});

const visibleCurveCount = computed(() => props.filteredCurveOptions.length);

function selectVisibleCurves() {
  emit(
    'update:selectedCurveNames',
    props.filteredCurveOptions.map((curve) => curve.mnemonic)
  );
}
</script>

<template>
  <aside class="las-curve-library" data-testid="las-curve-library">
    <header class="las-curve-library__header">
      <div>
        <p class="las-curve-library__eyebrow">Curve Library</p>
        <h2 class="las-curve-library__title">Curves and actions</h2>
      </div>
      <Button
        icon="pi pi-angle-left"
        severity="secondary"
        text
        rounded
        aria-label="Collapse curve library"
        @click="emit('close')"
      />
    </header>

    <InputText
      v-model="curveFilterModel"
      placeholder="Filter by mnemonic or description"
      class="las-curve-library__search"
    />

    <div class="las-curve-library__toolbar">
      <Button label="All Visible" text size="small" @click="selectVisibleCurves" />
      <Button label="None" text size="small" @click="emit('clear-selection')" />
      <span class="las-curve-library__count">{{ selectedCurveCount }} selected</span>
    </div>

    <div class="las-curve-library__list">
      <label
        v-for="curve in filteredCurveOptions"
        :key="curve.mnemonic"
        class="las-curve-library__item"
      >
        <Checkbox v-model="selectionModel" :value="curve.mnemonic" :binary="false" />
        <span class="las-curve-library__item-copy">
          <span class="las-curve-library__item-label">{{ curve.label }}</span>
          <span v-if="curve.description" class="las-curve-library__item-description">{{ curve.description }}</span>
        </span>
      </label>

      <div v-if="visibleCurveCount === 0" class="las-curve-library__empty">
        No curves match the current filter.
      </div>
    </div>

    <footer class="las-curve-library__footer">
      <p class="las-curve-library__footer-note">
        Plot stays central. Analytics open below only when you ask for them.
      </p>
      <div class="las-curve-library__actions">
        <Button
          label="Plot Selected"
          icon="pi pi-chart-line"
          severity="primary"
          :disabled="!canPlot"
          :loading="isLoading"
          @click="emit('plot-selected')"
        />
        <Button
          label="Statistics"
          icon="pi pi-table"
          severity="secondary"
          :disabled="!canPlot"
          :loading="isLoading"
          @click="emit('show-statistics')"
        />
        <Button
          label="Correlation"
          icon="pi pi-th-large"
          severity="contrast"
          outlined
          :disabled="!canCorrelate"
          :loading="isLoading"
          @click="emit('show-correlation')"
        />
      </div>
      <div class="las-curve-library__actions las-curve-library__actions--export">
        <Button
          label="Export Selected CSV"
          icon="pi pi-download"
          severity="secondary"
          text
          :disabled="!canPlot"
          :loading="isLoading"
          @click="emit('export-selected-csv')"
        />
        <Button
          label="Export All CSV"
          icon="pi pi-download"
          severity="secondary"
          text
          :disabled="!canExportAllCurves"
          :loading="isLoading"
          @click="emit('export-all-csv')"
        />
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.las-curve-library {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  box-shadow: var(--shadow-soft);
}

.las-curve-library__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.las-curve-library__eyebrow {
  margin: 0 0 4px;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--p-text-muted-color, #6f7786);
}

.las-curve-library__title {
  margin: 0;
  font-size: 0.96rem;
  line-height: 1.3;
}

.las-curve-library__search {
  width: 100%;
}

.las-curve-library__toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.las-curve-library__count {
  margin-left: auto;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--p-text-muted-color, #6f7786);
}

.las-curve-library__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(36vh, 320px);
  overflow: auto;
  padding-right: 4px;
}

.las-curve-library__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-elevated) 90%, transparent);
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.las-curve-library__item:hover {
  border-color: color-mix(in srgb, var(--color-accent-primary-strong) 26%, transparent);
  background: color-mix(in srgb, var(--color-accent-primary) 10%, var(--color-surface-elevated));
  transform: translateY(-1px);
}

.las-curve-library__item-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.las-curve-library__item-label {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--ink);
}

.las-curve-library__item-description {
  font-size: 0.74rem;
  color: var(--muted);
  line-height: 1.35;
}

.las-curve-library__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: 16px;
  border: 1px dashed var(--line);
  border-radius: var(--radius-md);
  color: var(--muted);
  text-align: center;
}

.las-curve-library__footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
}

.las-curve-library__footer-note {
  margin: 0;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.4;
}

.las-curve-library__actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.las-curve-library__actions--export {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
</style>
