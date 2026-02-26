<script setup>
import { computed, nextTick, ref } from 'vue';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { t } from '@/app/i18n.js';

const projectDataStore = useProjectDataStore();
const viewConfigStore = useViewConfigStore();
const config = viewConfigStore.config;

const intervals = computed(() => (
  Array.isArray(projectDataStore.physicsIntervals) ? projectDataStore.physicsIntervals : []
));
const selectedReasonTypes = ref([]);

const REASON_TYPE_LABEL_KEYS = Object.freeze({
  model: 'table.intervals.reason_type.model',
  depth: 'table.intervals.reason_type.depth',
  casing: 'table.intervals.reason_type.casing',
  cement: 'table.intervals.reason_type.cement',
  plug: 'table.intervals.reason_type.plug',
  fluid: 'table.intervals.reason_type.fluid',
  marker: 'table.intervals.reason_type.marker',
  tubingLeak: 'table.intervals.reason_type.tubing_leak',
  connection: 'table.intervals.reason_type.connection',
  barrier: 'table.intervals.reason_type.barrier'
});

const REASON_ACTION_LABEL_KEYS = Object.freeze({
  start: 'table.intervals.reason_action.start',
  end: 'table.intervals.reason_action.end',
  point: 'table.intervals.reason_action.point',
  transition: 'table.intervals.reason_action.transition'
});

const FILTER_REASON_TYPES = Object.freeze([
  'fluid',
  'cement',
  'plug',
  'marker',
  'tubingLeak',
  'casing',
  'connection',
  'barrier',
  'depth',
  'model'
]);

function formatDepth(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return numeric.toFixed(2);
}

function resolveReasonTypeLabel(type) {
  const normalizedType = String(type ?? '').trim();
  const key = REASON_TYPE_LABEL_KEYS[normalizedType];
  return key ? t(key) : t('table.intervals.reason_type.other');
}

function resolveReasonActionLabel(action) {
  const normalizedAction = String(action ?? '').trim();
  const key = REASON_ACTION_LABEL_KEYS[normalizedAction];
  return key ? t(key) : t('table.intervals.reason_action.transition');
}

function resolveReasonBadgeClass(type) {
  const normalizedType = String(type ?? '').trim();
  if (normalizedType === 'fluid') return 'is-fluid';
  if (normalizedType === 'cement' || normalizedType === 'plug') return 'is-cement';
  if (normalizedType === 'marker' || normalizedType === 'tubingLeak') return 'is-marker';
  if (normalizedType === 'casing' || normalizedType === 'connection' || normalizedType === 'barrier') return 'is-structure';
  if (normalizedType === 'model') return 'is-model';
  return 'is-depth';
}

function normalizeReasonType(type) {
  const normalizedType = String(type ?? '').trim();
  if (REASON_TYPE_LABEL_KEYS[normalizedType]) return normalizedType;
  return 'other';
}

function resolveIntervalStartReasons(interval, index) {
  const reasons = Array.isArray(interval?.startBoundaryReasons)
    ? interval.startBoundaryReasons
    : [];
  if (reasons.length > 0) return reasons;

  if (index === 0) {
    return [{
      type: 'model',
      action: 'start',
      label: ''
    }];
  }

  return [{
    type: 'depth',
    action: 'transition',
    label: t('table.intervals.reason_default.unspecified')
  }];
}

const filterOptions = computed(() => (
  FILTER_REASON_TYPES
    .map((type) => ({
      type,
      label: resolveReasonTypeLabel(type)
    }))
));

const hasActiveReasonTypeFilter = computed(() => selectedReasonTypes.value.length > 0);

const filteredIntervalRows = computed(() => (
  intervals.value
    .map((interval, index) => {
      const startReasons = resolveIntervalStartReasons(interval, index);
      const visibleReasons = hasActiveReasonTypeFilter.value
        ? startReasons.filter((reason) => selectedReasonTypes.value.includes(normalizeReasonType(reason?.type)))
        : startReasons;

      return {
        index,
        interval,
        visibleReasons
      };
    })
    .filter((row) => row.visibleReasons.length > 0)
));

function isFilterTypeSelected(type) {
  return selectedReasonTypes.value.includes(type);
}

function toggleReasonTypeFilter(type) {
  const normalizedType = normalizeReasonType(type);
  if (normalizedType === 'other') return;

  const selected = selectedReasonTypes.value;
  if (selected.includes(normalizedType)) {
    selectedReasonTypes.value = selected.filter((entry) => entry !== normalizedType);
    return;
  }

  selectedReasonTypes.value = [...selected, normalizedType];
}

function clearReasonTypeFilter() {
  selectedReasonTypes.value = [];
}

async function inspectInterval(interval) {
  const top = Number(interval?.top);
  const bottom = Number(interval?.bottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;
  const targetDepth = top;

  if (config?.showDepthCrossSection !== true) {
    viewConfigStore.setShowDepthCrossSection(true);
    await nextTick();
  }

  viewConfigStore.setCursorDepth(targetDepth);
}
</script>

<template>
  <div class="table-pane-content">
    <div class="interval-filter-toolbar">
      <span class="interval-filter-label" data-i18n="table.intervals.filter_label">Filter triggers:</span>
      <button
        type="button"
        class="interval-filter-chip"
        :class="{ 'is-active': !hasActiveReasonTypeFilter }"
        @click="clearReasonTypeFilter"
      >
        {{ t('table.intervals.filter_all') }}
      </button>
      <button
        v-for="option in filterOptions"
        :key="option.type"
        type="button"
        class="interval-filter-chip"
        :class="{ 'is-active': isFilterTypeSelected(option.type) }"
        @click="toggleReasonTypeFilter(option.type)"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="table-responsive interval-table-wrap">
      <table class="interval-table">
        <thead>
          <tr>
            <th class="col-index" data-i18n="table.intervals.index">#</th>
            <th class="col-top" data-i18n="table.intervals.top">Top (MD)</th>
            <th class="col-bottom" data-i18n="table.intervals.bottom">Bottom (MD)</th>
            <th class="col-span" data-i18n="table.intervals.span">Span</th>
            <th class="col-trigger" data-i18n="table.intervals.change_reason">Change Trigger</th>
            <th class="col-inspect" data-i18n="table.intervals.inspect">Inspect</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="intervals.length === 0">
            <td colspan="6" class="interval-empty-cell text-muted" data-i18n="table.intervals.empty">
              No physics intervals available.
            </td>
          </tr>
          <tr v-else-if="filteredIntervalRows.length === 0">
            <td colspan="6" class="interval-empty-cell text-muted" data-i18n="table.intervals.empty_filtered">
              No intervals match the selected trigger filters.
            </td>
          </tr>
          <tr
            v-for="row in filteredIntervalRows"
            :key="`${row.interval.top}-${row.interval.bottom}-${row.index}`"
          >
            <td class="col-index">{{ row.index + 1 }}</td>
            <td class="col-top">{{ formatDepth(row.interval.top) }}</td>
            <td class="col-bottom">{{ formatDepth(row.interval.bottom) }}</td>
            <td class="col-span">{{ formatDepth(Number(row.interval.bottom) - Number(row.interval.top)) }}</td>
            <td class="col-trigger">
              <div class="interval-reason-list">
                <div
                  v-for="(reason, reasonIndex) in row.visibleReasons"
                  :key="`${row.index}-${reason.type}-${reason.action}-${reason.label}-${reasonIndex}`"
                  class="interval-reason-row"
                >
                  <span class="interval-reason-chip" :class="resolveReasonBadgeClass(reason.type)">
                    {{ resolveReasonTypeLabel(reason.type) }}
                  </span>
                  <span class="interval-reason-text">
                    {{ resolveReasonActionLabel(reason.action) }}
                    <template v-if="reason.label">
                      : {{ reason.label }}
                    </template>
                  </span>
                </div>
              </div>
            </td>
            <td class="col-inspect">
              <Button class="inspect-button" size="small" outlined type="button" @click="inspectInterval(row.interval)">
                <span data-i18n="table.intervals.inspect">Inspect</span>
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.interval-filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.interval-filter-label {
  font-size: 0.8rem;
  color: var(--color-interval-filter-label);
  margin-right: 2px;
}

.interval-filter-chip {
  border: 1px solid var(--color-interval-chip-border);
  background: var(--color-interval-chip-bg);
  color: var(--color-interval-chip-text);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.72rem;
  line-height: 1.3;
}

.interval-filter-chip:hover {
  background: var(--color-interval-chip-hover-bg);
}

.interval-filter-chip.is-active {
  border-color: var(--color-interval-chip-active-border);
  background: var(--color-interval-chip-active-bg);
  color: var(--color-interval-chip-active-text);
}

.interval-table-wrap {
  border: 1px solid var(--color-interval-table-border);
  border-radius: 12px;
  background: var(--color-interval-table-wrap-bg);
  max-height: min(54vh, 520px);
  overflow: auto;
}

.interval-table {
  width: 100%;
  min-width: 0;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.interval-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 8px;
  border-bottom: 1px solid var(--color-interval-table-border);
  background: var(--color-interval-table-head-bg);
  color: var(--color-interval-table-head-text);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: left;
  white-space: nowrap;
}

.interval-table tbody td {
  padding: 8px 8px;
  border-bottom: 1px solid var(--color-interval-table-border-soft);
  vertical-align: top;
  background: var(--color-interval-table-row-bg);
  color: var(--color-interval-chip-text);
  font-size: 0.83rem;
}

.interval-table thead th + th,
.interval-table tbody td + td {
  border-left: 1px solid var(--color-interval-table-border-soft);
}

.interval-table tbody tr:nth-child(even) td {
  background: var(--color-interval-table-row-even-bg);
}

.interval-table tbody tr:hover td {
  background: var(--color-interval-table-row-hover-bg);
}

.interval-table tbody tr:last-child td {
  border-bottom: none;
}

.interval-table .col-index {
  width: 34px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.interval-table .col-top,
.interval-table .col-bottom,
.interval-table .col-span {
  width: 88px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.interval-table .col-trigger {
  width: auto;
}

.interval-table .col-inspect {
  width: 98px;
  text-align: center;
  white-space: nowrap;
  position: sticky;
  right: 0;
  z-index: 1;
}

.interval-table thead .col-inspect {
  z-index: 3;
  background: var(--color-interval-table-sticky-bg);
}

.interval-table tbody td.col-inspect {
  box-shadow: -1px 0 0 var(--color-interval-table-border-soft);
}

.interval-table tbody tr:nth-child(even) td.col-inspect {
  background: var(--color-interval-table-row-even-bg);
}

.interval-table tbody tr:hover td.col-inspect {
  background: var(--color-interval-table-row-hover-bg);
}

.interval-empty-cell {
  text-align: center;
  padding: 14px 12px;
}

.inspect-button {
  min-width: 72px;
  padding-inline: 8px;
}

.interval-reason-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.interval-reason-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
}

.interval-reason-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 0.68rem;
  line-height: 1.2;
  font-weight: 600;
  background: var(--color-interval-reason-chip-bg);
  color: var(--color-interval-reason-chip-text);
}

.interval-reason-text {
  font-size: 0.78rem;
  color: var(--color-interval-reason-text);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.interval-reason-chip.is-fluid {
  background: var(--color-interval-reason-fluid-bg);
  color: var(--color-interval-reason-fluid-text);
}

.interval-reason-chip.is-cement {
  background: var(--color-interval-reason-cement-bg);
  color: var(--color-interval-reason-cement-text);
}

.interval-reason-chip.is-marker {
  background: var(--color-interval-reason-marker-bg);
  color: var(--color-interval-reason-marker-text);
}

.interval-reason-chip.is-structure {
  background: var(--color-interval-reason-structure-bg);
  color: var(--color-interval-reason-structure-text);
}

.interval-reason-chip.is-model {
  background: var(--color-interval-reason-model-bg);
  color: var(--color-interval-reason-model-text);
}

.interval-reason-chip.is-depth {
  background: var(--color-interval-reason-depth-bg);
  color: var(--color-interval-reason-depth-text);
}
</style>
