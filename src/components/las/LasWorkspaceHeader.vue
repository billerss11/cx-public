<script setup>
defineOptions({ name: 'LasWorkspaceHeader' });

import { computed } from 'vue';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { getLasIndexTypeMeta } from '@/utils/lasIndexType.js';

const props = defineProps({
  activeSession: {
    type: Object,
    default: null,
  },
  sessionOptions: {
    type: Array,
    default: () => [],
  },
  activeSessionId: {
    type: String,
    default: null,
  },
  overview: {
    type: Object,
    default: null,
  },
  selectedCurveCount: {
    type: Number,
    default: 0,
  },
  indexType: {
    type: String,
    default: 'unknown',
    validator: (v) => ['depth', 'time', 'index', 'unknown'].includes(v),
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['open-file', 'close-session', 'update:activeSessionId']);

const activeSessionIdModel = computed({
  get: () => props.activeSessionId,
  set: (value) => emit('update:activeSessionId', value),
});

const heroTitle = computed(() => props.activeSession?.wellName || props.activeSession?.fileName || 'LAS Analysis');

const indexTypeMeta = computed(() => getLasIndexTypeMeta(props.indexType));

const heroMetrics = computed(() => {
  if (!props.activeSession) {
    return [
      { label: 'Workspace', value: 'Ready' },
      { label: 'Focus', value: 'Plot First' },
      { label: 'Analytics', value: 'On Demand' },
      { label: 'Details', value: 'Tabbed' },
    ];
  }

  return [
    { label: 'File Size', value: props.activeSession.fileSizeDisplay || '-' },
    { label: 'Data Points', value: formatMetric(props.overview?.dataPoints) },
    { label: indexTypeMeta.value.rangeLabel, value: props.overview?.indexRangeDisplay || '-' },
    { label: 'Selected Curves', value: String(props.selectedCurveCount) },
  ];
});

function formatMetric(value) {
  if (!Number.isFinite(Number(value))) return '-';
  return Number(value).toLocaleString();
}
</script>

<template>
  <section class="las-header" data-testid="las-workspace-header">
    <div class="las-header__identity">
      <p class="las-header__eyebrow">LAS Workspace</p>
      <div class="las-header__title-row">
        <h1 class="las-header__title">{{ heroTitle }}</h1>
        <span
          v-if="activeSession"
          class="las-header__index-badge"
          :class="`las-header__index-badge--${indexType}`"
          :title="`Index curve: ${activeSession.indexCurve}${activeSession.depthUnit ? ' (' + activeSession.depthUnit + ')' : ''}`"
        >
          <i :class="indexTypeMeta.icon"></i>
          {{ indexTypeMeta.label }}
        </span>
      </div>
    </div>

    <div class="las-header__metrics">
      <article v-for="metric in heroMetrics" :key="metric.label" class="las-header__metric">
        <p class="las-header__metric-label">{{ metric.label }}</p>
        <p class="las-header__metric-value">{{ metric.value }}</p>
      </article>
    </div>

    <div class="las-header__controls">
      <Button
        label="Open LAS File"
        icon="pi pi-folder-open"
        severity="primary"
        size="small"
        :loading="isLoading"
        @click="emit('open-file')"
      />
      <Select
        v-if="sessionOptions.length > 1"
        v-model="activeSessionIdModel"
        :options="sessionOptions"
        option-label="label"
        option-value="value"
        placeholder="Select session"
        class="las-header__session-select"
      />
      <Button
        v-if="activeSession"
        label="Close Session"
        icon="pi pi-times"
        severity="secondary"
        size="small"
        outlined
        @click="emit('close-session')"
      />
    </div>
  </section>
</template>

<style scoped>
.las-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--color-accent-primary) 14%, transparent), transparent 30%),
    linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  box-shadow: var(--shadow-soft);
  flex-wrap: wrap;
  min-height: 0;
}

.las-header__identity {
  min-width: 0;
  flex-shrink: 0;
}

.las-header__eyebrow {
  margin: 0 0 2px;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 800;
  color: var(--p-primary-700);
}

.las-header__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.las-header__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 34ch;
}

.las-header__index-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  border: 1.5px solid transparent;
  flex-shrink: 0;
}

.las-header__index-badge--depth {
  background: color-mix(in srgb, #3b82f6 14%, transparent);
  border-color: color-mix(in srgb, #3b82f6 36%, transparent);
  color: #1d4ed8;
}

.las-header__index-badge--time {
  background: color-mix(in srgb, #8b5cf6 14%, transparent);
  border-color: color-mix(in srgb, #8b5cf6 36%, transparent);
  color: #6d28d9;
}

.las-header__index-badge--index {
  background: color-mix(in srgb, #0d9488 14%, transparent);
  border-color: color-mix(in srgb, #0d9488 36%, transparent);
  color: #0f766e;
}

.las-header__index-badge--unknown {
  background: color-mix(in srgb, var(--line) 40%, transparent);
  border-color: color-mix(in srgb, var(--line) 70%, transparent);
  color: var(--muted);
}

.las-header__metrics {
  display: flex;
  align-items: stretch;
  gap: 1px;
  flex: 1 1 0;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: color-mix(in srgb, var(--line) 80%, transparent);
}

.las-header__metric {
  flex: 1 1 0;
  min-width: 0;
  padding: 7px 12px;
  background: color-mix(in srgb, var(--color-surface-elevated) 92%, white);
}

.las-header__metric-label {
  margin: 0 0 1px;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--p-text-muted-color, #6f7786);
  white-space: nowrap;
}

.las-header__metric-value {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.las-header__controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.las-header__session-select {
  min-width: min(100%, 260px);
}

@media (max-width: 1100px) {
  .las-header__metrics {
    flex: 1 1 100%;
    order: 3;
  }

  .las-header__controls {
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .las-header__metrics {
    flex-wrap: wrap;
  }

  .las-header__metric {
    flex: 1 1 40%;
  }
}
</style>
