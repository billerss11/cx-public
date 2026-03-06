<script setup>
defineOptions({ name: 'LasPlotStage' });

import { computed } from 'vue';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import LasPlotCanvas from '@/components/las/LasPlotCanvas.vue';

const props = defineProps({
  activeSession: {
    type: Object,
    default: null,
  },
  curveLibraryOpen: {
    type: Boolean,
    default: true,
  },
  data: {
    type: Object,
    default: null,
  },
  hasData: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  selectedCurveCount: {
    type: Number,
    default: 0,
  },
  selectedCurveNames: {
    type: Array,
    default: () => [],
  },
  resolveExactValuesAtDepth: {
    type: Function,
    default: null,
  }
});

const emit = defineEmits(['toggle-library']);

const stageHint = computed(() => {
  const session = props.activeSession;
  if (!session) return 'Choose a session to plot LAS curves.';
  const indexLabel = session.depthUnit ? `${session.indexCurve} (${session.depthUnit})` : session.indexCurve;
  return `Main stage aligned to ${indexLabel}. ${props.selectedCurveCount} curve${props.selectedCurveCount === 1 ? '' : 's'} selected.`;
});

const visibleCurveChips = computed(() => props.selectedCurveNames.slice(0, 4));
const hiddenCurveCount = computed(() => Math.max(props.selectedCurveNames.length - visibleCurveChips.value.length, 0));
const libraryButtonLabel = computed(() => (props.curveLibraryOpen ? 'Hide Curve Library' : 'Open Curve Library'));
</script>

<template>
  <section
    class="las-plot-stage"
    data-testid="las-plot-stage"
    :data-selected-count="String(selectedCurveCount)"
  >
    <header class="las-plot-stage__toolbar">
      <p class="las-plot-stage__hint">{{ stageHint }}</p>
      <div class="las-plot-stage__toolbar-end">
        <div v-if="selectedCurveCount > 0" class="las-plot-stage__chips">
          <span v-for="curveName in visibleCurveChips" :key="curveName" class="las-plot-stage__chip">
            {{ curveName }}
          </span>
          <span v-if="hiddenCurveCount > 0" class="las-plot-stage__chip las-plot-stage__chip--muted">
            +{{ hiddenCurveCount }} more
          </span>
        </div>
        <Button
          :label="libraryButtonLabel"
          icon="pi pi-sliders-h"
          severity="secondary"
          outlined
          size="small"
          @click="emit('toggle-library')"
        />
      </div>
    </header>

    <div class="las-plot-stage__surface">
      <div class="las-plot-stage__viewport">
        <div v-if="!hasData" class="las-plot-stage__empty">
          <i class="pi pi-chart-line las-plot-stage__empty-icon"></i>
          <p class="las-plot-stage__empty-title">No plot rendered yet</p>
          <p class="las-plot-stage__empty-copy">
            Select one or more curves in the library, then use <strong>Plot Selected</strong>.
          </p>
        </div>
        <div v-else class="las-plot-stage__canvas-shell">
          <LasPlotCanvas
            :data="data"
            :resolve-exact-values-at-depth="resolveExactValuesAtDepth"
            class="las-plot-stage__canvas"
          />
        </div>
      </div>

      <div v-if="isLoading" class="las-plot-stage__loading">
        <ProgressSpinner style="width: 42px; height: 42px" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.las-plot-stage {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--color-accent-primary) 14%, transparent), transparent 34%),
    linear-gradient(90deg, color-mix(in srgb, var(--color-accent-primary) 7%, transparent), transparent 22%),
    linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  box-shadow: var(--shadow-soft);
  isolation: isolate;
}

.las-plot-stage__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.las-plot-stage__toolbar-end {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.las-plot-stage__hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.las-plot-stage__chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 5px;
  align-items: center;
}

.las-plot-stage__chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent-primary) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-primary-strong) 20%, transparent);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ink);
}

.las-plot-stage__chip--muted {
  background: var(--color-surface-muted);
  border-color: color-mix(in srgb, var(--line) 84%, transparent);
  color: var(--muted);
}

.las-plot-stage__surface {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  padding: 6px;
  border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
  border-radius: calc(var(--radius-lg) - 4px);
  background: color-mix(in srgb, var(--color-surface-elevated) 90%, white);
  overflow: hidden;
}

.las-plot-stage__viewport {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
  border-radius: calc(var(--radius-lg) - 8px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface-elevated) 96%, white), color-mix(in srgb, var(--color-surface-subtle) 94%, white));
}

.las-plot-stage__canvas-shell {
  min-width: max-content;
  height: 100%;
}

.las-plot-stage__canvas {
  display: block;
  height: 100%;
  width: 100%;
}

.las-plot-stage__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 100%;
  padding: 24px;
  text-align: center;
  color: var(--muted);
}

.las-plot-stage__empty-icon {
  font-size: 2.4rem;
  opacity: 0.45;
}

.las-plot-stage__empty-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}

.las-plot-stage__empty-copy {
  margin: 0;
  max-width: 38ch;
  line-height: 1.45;
}

.las-plot-stage__loading {
  position: absolute;
  inset: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--radius-lg) - 8px);
  background: color-mix(in srgb, var(--color-surface-elevated) 72%, transparent);
  backdrop-filter: blur(2px);
}

@media (max-width: 720px) {
  .las-plot-stage__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .las-plot-stage__surface {
    min-height: 300px;
  }
}
</style>
