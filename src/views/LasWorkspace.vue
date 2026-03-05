<script setup>
defineOptions({ name: 'LasWorkspace' });

import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import LasCorrelationHeatmap from '@/components/las/LasCorrelationHeatmap.vue';
import LasCurveLibraryPanel from '@/components/las/LasCurveLibraryPanel.vue';
import LasInsightsDeck from '@/components/las/LasInsightsDeck.vue';
import LasPlotStage from '@/components/las/LasPlotStage.vue';
import LasWorkspaceHeader from '@/components/las/LasWorkspaceHeader.vue';
import { useFeatureTiming } from '@/composables/useFeatureTiming.js';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';
import { useLasStore } from '@/stores/lasStore.js';
import { clamp } from '@/utils/general.js';
import { detectLasIndexType } from '@/utils/lasIndexType.js';

const lasStore = useLasStore();
const { timeFeature } = useFeatureTiming();

const selectedCurveNames = ref([]);
const curveFilterText = shallowRef('');
const selectedWellSectionName = shallowRef(null);
const activeInsightsTab = shallowRef('overview');
const isCurveLibraryOpen = shallowRef(true);
const isCorrelationDialogOpen = shallowRef(false);
const plotError = shallowRef(null);
const workspaceBodyRef = ref(null);

const LEFT_PANEL_MIN_WIDTH = 300;
const RIGHT_PANEL_MIN_WIDTH = 320;
const LEFT_PANEL_DEFAULT_WIDTH = 340;
const RIGHT_PANEL_DEFAULT_WIDTH = 360;
const SPLITTER_WIDTH = 12;
const LEFT_FLOATING_DEFAULT_WIDTH = 520;
const RIGHT_FLOATING_DEFAULT_WIDTH = 560;
const CORRELATION_FLOATING_DEFAULT_WIDTH = 620;
const CORRELATION_FLOATING_DEFAULT_HEIGHT = 580;
const FLOATING_DEFAULT_HEIGHT = 620;

const leftPanelWidth = shallowRef(LEFT_PANEL_DEFAULT_WIDTH);
const rightPanelWidth = shallowRef(RIGHT_PANEL_DEFAULT_WIDTH);
const isLeftPanelFloating = shallowRef(false);
const isRightPanelFloating = shallowRef(false);

let detachGlobalResizeListener = null;
let detachLeftPanelResizeListeners = null;
let detachRightPanelResizeListeners = null;

const activeSession = computed(() => lasStore.activeSession);
const curveData = computed(() => lasStore.activeCurveData);
const curveStatistics = computed(() => lasStore.activeCurveStatistics);
const correlationMatrix = computed(() => lasStore.activeCorrelationMatrix);

const isLoading = computed(() => lasStore.loading);
const storeError = computed(() => lasStore.error);
const storeErrorCode = computed(() => lasStore.errorCode);
const storeWarning = computed(() => lasStore.warning);
const selectedCurveCount = computed(() => selectedCurveNames.value.length);
const hasData = computed(() => Array.isArray(curveData.value?.series) && curveData.value.series.length > 0);
const hasStatistics = computed(() => statisticsRows.value.length > 0);
const hasCorrelation = computed(() => {
  const matrix = correlationMatrix.value?.matrix;
  return Array.isArray(matrix) && matrix.length > 0;
});
const canPlot = computed(() => selectedCurveCount.value > 0);
const canCorrelate = computed(() => selectedCurveCount.value > 1);
const isLeftPanelDockedVisible = computed(() => isLeftPanelFloating.value !== true);
const isRightPanelDockedVisible = computed(() => isRightPanelFloating.value !== true);
const leftSplitterVisible = computed(() => isLeftPanelDockedVisible.value === true);
const rightSplitterVisible = computed(() => isRightPanelDockedVisible.value === true);

const curveOptions = computed(() => {
  const session = activeSession.value;
  if (!session?.curves) return [];
  const validCurveSet = new Set(Array.isArray(session.validCurves) ? session.validCurves : []);

  return session.curves
    .filter((curve) => curve.mnemonic !== session.indexCurve)
    .filter((curve) => validCurveSet.size === 0 || validCurveSet.has(curve.mnemonic))
    .map((curve) => ({
      mnemonic: curve.mnemonic,
      unit: curve.unit || '',
      description: curve.description || '',
      label: curve.unit ? `${curve.mnemonic} (${curve.unit})` : curve.mnemonic,
    }));
});

const filteredCurveOptions = computed(() => {
  const keyword = String(curveFilterText.value || '').trim().toLowerCase();
  if (!keyword) return curveOptions.value;

  return curveOptions.value.filter((curve) => {
    const label = String(curve.label || '').toLowerCase();
    const description = String(curve.description || '').toLowerCase();
    return label.includes(keyword) || description.includes(keyword);
  });
});

const sessionOptions = computed(() =>
  lasStore.sessionList.map((session) => ({
    value: session.sessionId,
    label: `${session.wellName || session.fileName} · ${session.curveCount} curves · ${session.rowCount} rows`,
  }))
);

const overview = computed(() => activeSession.value?.overview ?? null);
const indexType = computed(() =>
  detectLasIndexType(activeSession.value?.indexCurve, activeSession.value?.depthUnit)
);
const curveRanges = computed(() => activeSession.value?.curveRanges ?? []);
const dataPreview = computed(() => activeSession.value?.dataPreview ?? null);
const previewColumns = computed(() => {
  const headRows = dataPreview.value?.head;
  if (!Array.isArray(headRows) || headRows.length === 0) return [];
  return Object.keys(headRows[0]);
});

const wellSectionMap = computed(() => activeSession.value?.wellInformation?.sections ?? {});
const wellSectionOptions = computed(() =>
  Object.keys(wellSectionMap.value).map((name) => ({ value: name, label: name }))
);
const wellSectionRows = computed(() => {
  const section = selectedWellSectionName.value;
  if (!section) return [];
  const rows = wellSectionMap.value?.[section];
  return Array.isArray(rows) ? rows : [];
});

const statisticsRows = computed(() => curveStatistics.value?.metrics ?? []);
const statisticsColumns = computed(() => curveStatistics.value?.columns ?? []);

const activeSessionIdModel = computed({
  get: () => lasStore.activeSessionId,
  set: (sessionId) => lasStore.setActiveSession(sessionId),
});

const leftFloatingVisible = computed({
  get: () => isLeftPanelFloating.value,
  set: (visible) => {
    isLeftPanelFloating.value = visible === true;
  },
});

const rightFloatingVisible = computed({
  get: () => isRightPanelFloating.value,
  set: (visible) => {
    isRightPanelFloating.value = visible === true;
  },
});

const {
  dialogSize: leftFloatingSize,
  reconcileDialogSize: reconcileLeftFloatingSize,
  startDialogResize: startLeftFloatingResize,
  stopDialogResize: stopLeftFloatingResize
} = useFloatingDialogResize({
  minWidth: LEFT_PANEL_MIN_WIDTH,
  minHeight: 320,
  defaultWidth: LEFT_FLOATING_DEFAULT_WIDTH,
  defaultHeight: FLOATING_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.92,
  maxViewportHeightRatio: 0.82,
  cursorClass: 'resizing-both'
});

const {
  dialogSize: rightFloatingSize,
  reconcileDialogSize: reconcileRightFloatingSize,
  startDialogResize: startRightFloatingResize,
  stopDialogResize: stopRightFloatingResize
} = useFloatingDialogResize({
  minWidth: RIGHT_PANEL_MIN_WIDTH,
  minHeight: 340,
  defaultWidth: RIGHT_FLOATING_DEFAULT_WIDTH,
  defaultHeight: FLOATING_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.92,
  maxViewportHeightRatio: 0.82,
  cursorClass: 'resizing-both'
});

const {
  dialogSize: correlationFloatingSize,
  reconcileDialogSize: reconcileCorrelationFloatingSize,
  startDialogResize: startCorrelationFloatingResize,
  stopDialogResize: stopCorrelationFloatingResize
} = useFloatingDialogResize({
  minWidth: 400,
  minHeight: 360,
  defaultWidth: CORRELATION_FLOATING_DEFAULT_WIDTH,
  defaultHeight: CORRELATION_FLOATING_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.92,
  maxViewportHeightRatio: 0.88,
  cursorClass: 'resizing-both'
});

const correlationDialogVisible = computed({
  get: () => isCorrelationDialogOpen.value,
  set: (visible) => { isCorrelationDialogOpen.value = visible === true; },
});

const correlationDialogStyle = computed(() => ({
  width: `${correlationFloatingSize.value.width}px`,
  height: `${correlationFloatingSize.value.height}px`,
  maxWidth: '94vw',
  maxHeight: '90vh'
}));

const leftFloatingDialogStyle = computed(() => ({
  width: `${leftFloatingSize.value.width}px`,
  height: `${leftFloatingSize.value.height}px`,
  maxWidth: '94vw',
  maxHeight: '84vh'
}));

const rightFloatingDialogStyle = computed(() => ({
  width: `${rightFloatingSize.value.width}px`,
  height: `${rightFloatingSize.value.height}px`,
  maxWidth: '94vw',
  maxHeight: '84vh'
}));

const workspaceBodyStyle = computed(() => {
  const leftColumn = isLeftPanelDockedVisible.value === true
    ? `minmax(${LEFT_PANEL_MIN_WIDTH}px, ${leftPanelWidth.value}px)`
    : '0px';
  const leftSplitter = leftSplitterVisible.value === true ? `${SPLITTER_WIDTH}px` : '0px';
  const rightSplitter = rightSplitterVisible.value === true ? `${SPLITTER_WIDTH}px` : '0px';
  const rightColumn = isRightPanelDockedVisible.value === true
    ? `minmax(${RIGHT_PANEL_MIN_WIDTH}px, ${rightPanelWidth.value}px)`
    : '0px';

  return {
    gridTemplateColumns: `${leftColumn} ${leftSplitter} minmax(0, 1fr) ${rightSplitter} ${rightColumn}`,
  };
});

const storeErrorDetails = computed(() => {
  const details = lasStore.errorDetails;
  if (details === null || details === undefined) return null;
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
});

const backendErrorContext = computed(() => {
  if (!storeError.value) return '';
  const meta = lasStore.lastRequestMeta ?? {};
  const parts = [];
  if (storeErrorCode.value) parts.push(`code=${storeErrorCode.value}`);
  if (meta.task) parts.push(`task=${meta.task}`);
  if (meta.requestId) parts.push(`request=${meta.requestId}`);
  const elapsedMs = Number(meta.elapsedMs);
  if (Number.isFinite(elapsedMs)) parts.push(`elapsed=${elapsedMs}ms`);
  return parts.join(' | ');
});

watch(
  activeSession,
  (session) => {
    const persisted = Array.isArray(session?.selectedCurves) ? session.selectedCurves : [];
    selectedCurveNames.value = [...persisted];
    curveFilterText.value = '';
    activeInsightsTab.value = 'overview';
    isCurveLibraryOpen.value = Boolean(session);
  },
  { immediate: true }
);

watch(
  wellSectionOptions,
  (options) => {
    if (!Array.isArray(options) || options.length === 0) {
      selectedWellSectionName.value = null;
      return;
    }
    if (options.some((option) => option.value === selectedWellSectionName.value)) return;
    selectedWellSectionName.value = options[0].value;
  },
  { immediate: true }
);

watch(isLeftPanelFloating, (floating) => {
  if (floating === true) {
    stopLeftPanelResize();
    reconcileLeftFloatingSize();
    return;
  }
  stopLeftFloatingResize();
});

watch(isRightPanelFloating, (floating) => {
  if (floating === true) {
    stopRightPanelResize();
    reconcileRightFloatingSize();
    return;
  }
  stopRightFloatingResize();
});

onMounted(() => {
  reconcilePanelWidths();
  reconcileLeftFloatingSize();
  reconcileRightFloatingSize();
  reconcileCorrelationFloatingSize();

  if (typeof window === 'undefined') return;

  const handleResize = () => {
    reconcilePanelWidths();
    reconcileLeftFloatingSize();
    reconcileRightFloatingSize();
    reconcileCorrelationFloatingSize();
  };

  window.addEventListener('resize', handleResize);
  detachGlobalResizeListener = () => {
    window.removeEventListener('resize', handleResize);
  };
});

onBeforeUnmount(() => {
  stopLeftPanelResize();
  stopRightPanelResize();
  stopLeftFloatingResize();
  stopRightFloatingResize();
  stopCorrelationFloatingResize();
  detachGlobalResizeListener?.();
  detachGlobalResizeListener = null;
});

function normalizeCurveSelection(curveNames) {
  if (!Array.isArray(curveNames)) return [];
  return [...new Set(curveNames.map((curve) => String(curve).trim()).filter(Boolean))];
}

function updateSelectedCurves(curveNames) {
  const normalized = normalizeCurveSelection(curveNames);
  selectedCurveNames.value = normalized;
  lasStore.setSelectedCurves?.(normalized);
}

function clearSelection() {
  updateSelectedCurves([]);
}

function resolveLasTimingMeta(error = null) {
  const meta = lasStore.lastRequestMeta ?? {};
  const errorElapsed = Number(error?.elapsedMs);
  const metaElapsed = Number(meta.elapsedMs);
  const backendMs = Number.isFinite(errorElapsed)
    ? errorElapsed
    : (Number.isFinite(metaElapsed) ? metaElapsed : null);

  return {
    backendMs,
    task: error?.task ?? meta.task ?? null,
    requestId: error?.requestId ?? meta.requestId ?? null,
    mode: 'las',
  };
}

function runTimedLasAction(featureKey, executor) {
  return timeFeature(featureKey, executor, {
    resolveMeta: () => resolveLasTimingMeta(),
    resolveErrorMeta: (error) => resolveLasTimingMeta(error),
  });
}

function clampLeftPanelWidth(value, fallback = LEFT_PANEL_DEFAULT_WIDTH) {
  const numeric = Number(value);
  const fallbackNumeric = Number.isFinite(Number(fallback)) ? Number(fallback) : LEFT_PANEL_DEFAULT_WIDTH;
  const safeFallback = Math.max(LEFT_PANEL_MIN_WIDTH, Math.round(fallbackNumeric));
  if (!Number.isFinite(numeric)) return safeFallback;
  const max = typeof window === 'undefined'
    ? 560
    : Math.max(LEFT_PANEL_MIN_WIDTH, Math.round(window.innerWidth * 0.4));
  return clamp(Math.round(numeric), LEFT_PANEL_MIN_WIDTH, max);
}

function clampRightPanelWidth(value, fallback = RIGHT_PANEL_DEFAULT_WIDTH) {
  const numeric = Number(value);
  const fallbackNumeric = Number.isFinite(Number(fallback)) ? Number(fallback) : RIGHT_PANEL_DEFAULT_WIDTH;
  const safeFallback = Math.max(RIGHT_PANEL_MIN_WIDTH, Math.round(fallbackNumeric));
  if (!Number.isFinite(numeric)) return safeFallback;
  const max = typeof window === 'undefined'
    ? 620
    : Math.max(RIGHT_PANEL_MIN_WIDTH, Math.round(window.innerWidth * 0.45));
  return clamp(Math.round(numeric), RIGHT_PANEL_MIN_WIDTH, max);
}

function reconcilePanelWidths() {
  leftPanelWidth.value = clampLeftPanelWidth(leftPanelWidth.value, LEFT_PANEL_DEFAULT_WIDTH);
  rightPanelWidth.value = clampRightPanelWidth(rightPanelWidth.value, RIGHT_PANEL_DEFAULT_WIDTH);
}

function stopLeftPanelResize() {
  detachLeftPanelResizeListeners?.();
  detachLeftPanelResizeListeners = null;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('resizing');
  }
}

function stopRightPanelResize() {
  detachRightPanelResizeListeners?.();
  detachRightPanelResizeListeners = null;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('resizing');
  }
}

function startLeftPanelResize(event) {
  if (typeof window === 'undefined') return;
  if (event?.button !== 0) return;
  if (isLeftPanelDockedVisible.value !== true) return;
  const container = workspaceBodyRef.value;
  if (!container) return;

  event.preventDefault();
  stopLeftPanelResize();
  document.documentElement.classList.add('resizing');

  const rect = container.getBoundingClientRect();
  const handlePointerMove = (moveEvent) => {
    const nextWidth = moveEvent.clientX - rect.left;
    leftPanelWidth.value = clampLeftPanelWidth(nextWidth, leftPanelWidth.value);
  };
  const handlePointerUp = () => {
    stopLeftPanelResize();
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  detachLeftPanelResizeListeners = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };
}

function startRightPanelResize(event) {
  if (typeof window === 'undefined') return;
  if (event?.button !== 0) return;
  if (isRightPanelDockedVisible.value !== true) return;
  const container = workspaceBodyRef.value;
  if (!container) return;

  event.preventDefault();
  stopRightPanelResize();
  document.documentElement.classList.add('resizing');

  const rect = container.getBoundingClientRect();
  const handlePointerMove = (moveEvent) => {
    const nextWidth = rect.right - moveEvent.clientX;
    rightPanelWidth.value = clampRightPanelWidth(nextWidth, rightPanelWidth.value);
  };
  const handlePointerUp = () => {
    stopRightPanelResize();
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  detachRightPanelResizeListeners = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };
}

function undockLeftPanel() {
  isLeftPanelFloating.value = true;
}

function dockLeftPanel() {
  isLeftPanelFloating.value = false;
}

function undockRightPanel() {
  isRightPanelFloating.value = true;
}

function dockRightPanel() {
  isRightPanelFloating.value = false;
}

async function handleOpenFile() {
  plotError.value = null;
  try {
    await runTimedLasAction('las.open_and_parse_file', () => lasStore.openAndParseFile());
  } catch (err) {
    plotError.value = err?.message || 'Failed to open LAS file.';
  }
}

async function handlePlotSelected() {
  if (!canPlot.value) return;
  plotError.value = null;
  try {
    await runTimedLasAction(
      'las.fetch_curve_data',
      () => lasStore.fetchCurveData([...selectedCurveNames.value])
    );
  } catch (err) {
    plotError.value = err?.message || 'Failed to fetch curve data.';
  }
}

async function handleShowStatistics() {
  if (!canPlot.value) return;
  plotError.value = null;
  try {
    await runTimedLasAction(
      'las.fetch_curve_statistics',
      () => lasStore.fetchCurveStatistics([...selectedCurveNames.value])
    );
    activeInsightsTab.value = 'analytics';
  } catch (err) {
    plotError.value = err?.message || 'Failed to calculate curve statistics.';
  }
}

async function handleShowCorrelation() {
  if (!canCorrelate.value) return;
  plotError.value = null;
  try {
    await runTimedLasAction(
      'las.fetch_correlation_matrix',
      () => lasStore.fetchCorrelationMatrix([...selectedCurveNames.value])
    );
    reconcileCorrelationFloatingSize();
    isCorrelationDialogOpen.value = true;
  } catch (err) {
    plotError.value = err?.message || 'Failed to calculate correlation matrix.';
  }
}

async function handleCloseSession() {
  await lasStore.deleteSession();
  selectedCurveNames.value = [];
  curveFilterText.value = '';
  activeInsightsTab.value = 'overview';
  isCurveLibraryOpen.value = Boolean(lasStore.activeSessionId);
}

function toggleCurveLibrary() {
  isCurveLibraryOpen.value = !isCurveLibraryOpen.value;
}
</script>

<template>
  <div class="las-workspace" data-testid="las-workspace-shell">
    <Message
      v-if="storeWarning"
      severity="warn"
      :closable="true"
      data-testid="las-large-file-warning"
      @close="lasStore.clearWarning()"
    >
      <div class="las-workspace__error-message">
        <p class="las-workspace__error-text">{{ storeWarning.message }}</p>
      </div>
    </Message>

    <Message
      v-if="storeError || plotError"
      severity="error"
      :closable="true"
      @close="lasStore.clearError(); plotError = null"
    >
      <div class="las-workspace__error-message">
        <p class="las-workspace__error-text">{{ storeError || plotError }}</p>
        <p v-if="backendErrorContext" class="las-workspace__error-meta">{{ backendErrorContext }}</p>
        <pre v-if="storeErrorDetails" class="las-workspace__error-details">{{ storeErrorDetails }}</pre>
      </div>
    </Message>

    <LasWorkspaceHeader
      :active-session="activeSession"
      :session-options="sessionOptions"
      :active-session-id="activeSessionIdModel"
      :overview="overview"
      :index-type="indexType"
      :selected-curve-count="selectedCurveCount"
      :is-loading="isLoading"
      @open-file="handleOpenFile"
      @close-session="handleCloseSession"
      @update:active-session-id="activeSessionIdModel = $event"
    />

    <div v-if="isLoading && !activeSession" class="las-workspace__splash">
      <ProgressSpinner style="width: 52px; height: 52px" />
      <p class="las-workspace__splash-title">Loading LAS data...</p>
      <p class="las-workspace__splash-copy">Preparing the session and keeping the plot stage ready.</p>
    </div>

    <div v-else-if="!activeSession" class="las-workspace__splash">
      <i class="pi pi-chart-bar las-workspace__splash-icon"></i>
      <p class="las-workspace__splash-title">Open a <strong>.las</strong> file to begin</p>
      <p class="las-workspace__splash-copy">
        The redesigned workspace keeps plotting front and center while analytics and details stay one switch away.
      </p>
    </div>

    <section
      v-else
      ref="workspaceBodyRef"
      class="las-workspace__body"
      :style="workspaceBodyStyle"
    >
      <aside v-if="isLeftPanelDockedVisible" class="las-workspace__left-panel" data-testid="las-left-panel">
        <header class="las-workspace__panel-header">
          <h3 class="las-workspace__panel-title">Curves and actions</h3>
          <Button
            type="button"
            text
            rounded
            icon="pi pi-window-maximize"
            size="small"
            title="Float curves panel"
            data-testid="las-left-panel-undock"
            @click="undockLeftPanel"
          />
        </header>

        <LasCurveLibraryPanel
          v-show="isCurveLibraryOpen"
          :curve-filter-text="curveFilterText"
          :filtered-curve-options="filteredCurveOptions"
          :selected-curve-names="selectedCurveNames"
          :selected-curve-count="selectedCurveCount"
          :can-plot="canPlot"
          :can-correlate="canCorrelate"
          :is-loading="isLoading"
          @update:curve-filter-text="curveFilterText = $event"
          @update:selected-curve-names="updateSelectedCurves"
          @clear-selection="clearSelection"
          @close="toggleCurveLibrary"
          @plot-selected="handlePlotSelected"
          @show-statistics="handleShowStatistics"
          @show-correlation="handleShowCorrelation"
        />
      </aside>

      <div
        v-if="leftSplitterVisible"
        class="las-workspace__splitter las-workspace__splitter--left"
        data-testid="las-left-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize curves panel"
        @pointerdown="startLeftPanelResize"
      ></div>

      <main class="las-workspace__plot-shell" data-testid="las-plot-shell">
        <LasPlotStage
          :active-session="activeSession"
          :curve-library-open="isCurveLibraryOpen"
          :data="curveData"
          :has-data="hasData"
          :is-loading="isLoading"
          :selected-curve-count="selectedCurveCount"
          :selected-curve-names="selectedCurveNames"
          @toggle-library="toggleCurveLibrary"
        />
      </main>

      <div
        v-if="rightSplitterVisible"
        class="las-workspace__splitter las-workspace__splitter--right"
        data-testid="las-right-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize insights panel"
        @pointerdown="startRightPanelResize"
      ></div>

      <aside v-if="isRightPanelDockedVisible" class="las-workspace__right-panel" data-testid="las-right-panel">
        <header class="las-workspace__panel-header">
          <h3 class="las-workspace__panel-title">Insights Deck</h3>
          <Button
            type="button"
            text
            rounded
            icon="pi pi-window-maximize"
            size="small"
            title="Float insights panel"
            data-testid="las-right-panel-undock"
            @click="undockRightPanel"
          />
        </header>

        <div class="las-workspace__insights-shell">
          <LasInsightsDeck
            :active-insights-tab="activeInsightsTab"
            :curve-ranges="curveRanges"
            :data-preview="dataPreview"
            :has-statistics="hasStatistics"
            :overview="overview"
            :preview-columns="previewColumns"
            :selected-well-section-name="selectedWellSectionName"
            :statistics-columns="statisticsColumns"
            :statistics-rows="statisticsRows"
            :well-section-options="wellSectionOptions"
            :well-section-rows="wellSectionRows"
            @update:active-insights-tab="activeInsightsTab = $event"
            @update:selected-well-section-name="selectedWellSectionName = $event"
          />
        </div>
      </aside>
    </section>

    <Dialog
      v-if="isLeftPanelFloating"
      v-model:visible="leftFloatingVisible"
      class="las-workspace__floating-dialog"
      :modal="false"
      :draggable="true"
      :style="leftFloatingDialogStyle"
    >
      <template #header>
        <div class="las-workspace__floating-header">
          <span>Curves and actions</span>
          <Button
            type="button"
            text
            rounded
            icon="pi pi-window-minimize"
            size="small"
            data-testid="las-left-panel-dock"
            @click="dockLeftPanel"
          />
        </div>
      </template>

      <div class="las-workspace__floating-content" data-testid="las-left-floating-panel">
        <LasCurveLibraryPanel
          v-show="isCurveLibraryOpen"
          :curve-filter-text="curveFilterText"
          :filtered-curve-options="filteredCurveOptions"
          :selected-curve-names="selectedCurveNames"
          :selected-curve-count="selectedCurveCount"
          :can-plot="canPlot"
          :can-correlate="canCorrelate"
          :is-loading="isLoading"
          @update:curve-filter-text="curveFilterText = $event"
          @update:selected-curve-names="updateSelectedCurves"
          @clear-selection="clearSelection"
          @close="toggleCurveLibrary"
          @plot-selected="handlePlotSelected"
          @show-statistics="handleShowStatistics"
          @show-correlation="handleShowCorrelation"
        />
        <span class="las-workspace__floating-resizer" @pointerdown="startLeftFloatingResize"></span>
      </div>
    </Dialog>

    <Dialog
      v-if="isRightPanelFloating"
      v-model:visible="rightFloatingVisible"
      class="las-workspace__floating-dialog"
      :modal="false"
      :draggable="true"
      :style="rightFloatingDialogStyle"
    >
      <template #header>
        <div class="las-workspace__floating-header">
          <span>Insights Deck</span>
          <Button
            type="button"
            text
            rounded
            icon="pi pi-window-minimize"
            size="small"
            data-testid="las-right-panel-dock"
            @click="dockRightPanel"
          />
        </div>
      </template>

      <div class="las-workspace__floating-content" data-testid="las-right-floating-panel">
        <div class="las-workspace__insights-shell">
          <LasInsightsDeck
            :active-insights-tab="activeInsightsTab"
            :curve-ranges="curveRanges"
            :data-preview="dataPreview"
            :has-statistics="hasStatistics"
            :overview="overview"
            :preview-columns="previewColumns"
            :selected-well-section-name="selectedWellSectionName"
            :statistics-columns="statisticsColumns"
            :statistics-rows="statisticsRows"
            :well-section-options="wellSectionOptions"
            :well-section-rows="wellSectionRows"
            @update:active-insights-tab="activeInsightsTab = $event"
            @update:selected-well-section-name="selectedWellSectionName = $event"
          />
        </div>
        <span class="las-workspace__floating-resizer" @pointerdown="startRightFloatingResize"></span>
      </div>
    </Dialog>

    <Dialog
      v-if="isCorrelationDialogOpen"
      v-model:visible="correlationDialogVisible"
      class="las-workspace__floating-dialog las-workspace__correlation-dialog"
      :modal="false"
      :draggable="true"
      :style="correlationDialogStyle"
    >
      <template #header>
        <div class="las-workspace__floating-header">
          <span>Correlation Matrix</span>
          <span v-if="correlationMatrix?.sampleSize" class="las-workspace__correlation-meta">
            Sample size: {{ correlationMatrix.sampleSize.toLocaleString() }}
          </span>
        </div>
      </template>

      <div class="las-workspace__floating-content las-workspace__correlation-content">
        <LasCorrelationHeatmap v-if="hasCorrelation" :data="correlationMatrix" />
        <div v-else class="las-workspace__correlation-empty">
          No correlation data available.
        </div>
        <span class="las-workspace__floating-resizer" @pointerdown="startCorrelationFloatingResize"></span>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.las-workspace {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.las-workspace__body {
  display: grid;
  gap: 8px;
  flex: 1 1 0;
  align-items: stretch;
  align-content: stretch;
  min-height: 0;
  isolation: isolate;
  overflow: hidden;
}

.las-workspace__left-panel,
.las-workspace__right-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  box-shadow: var(--shadow-soft);
}

.las-workspace__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.las-workspace__panel-title {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink);
}

.las-workspace__splitter {
  position: relative;
  cursor: col-resize;
}

.las-workspace__splitter::before {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: 2px;
  height: 100%;
  background: color-mix(in srgb, var(--line) 78%, transparent);
}

.las-workspace__splitter:hover::before {
  background: color-mix(in srgb, var(--color-accent-primary) 60%, var(--line));
}

.las-workspace__plot-shell {
  grid-column: 3;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.las-workspace__left-panel {
  grid-column: 1;
}

.las-workspace__splitter--left {
  grid-column: 2;
}

.las-workspace__splitter--right {
  grid-column: 4;
}

.las-workspace__right-panel {
  grid-column: 5;
}

.las-workspace__insights-shell {
  position: relative;
  z-index: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
}

.las-workspace__floating-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.las-workspace__floating-content {
  position: relative;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
  padding: 0 22px 22px 0;
}

.las-workspace__floating-content .las-workspace__insights-shell {
  height: 100%;
}

.las-workspace__floating-resizer {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 14px;
  height: 14px;
  display: block;
  cursor: nwse-resize;
  border-right: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 0 0 2px 0;
  z-index: 3;
}

.las-workspace__floating-resizer::before {
  content: none;
}

.las-workspace__correlation-meta {
  font-size: 0.78rem;
  color: var(--muted);
  font-weight: 400;
}

.las-workspace__correlation-content {
  overflow: auto;
}

.las-workspace__correlation-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--muted);
}

:deep(.las-workspace__floating-dialog .p-dialog-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: calc(100% - 0.25rem);
  padding-top: 0.5rem;
}

.las-workspace__error-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.las-workspace__error-text {
  margin: 0;
}

.las-workspace__error-meta {
  margin: 0;
  font-size: 0.78rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.las-workspace__error-details {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-surface-elevated) 95%, black);
  font-size: 0.74rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.las-workspace__splash {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 340px;
  padding: 24px;
  border: 1px dashed var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  text-align: center;
  color: var(--muted);
}

.las-workspace__splash-icon {
  font-size: 2.7rem;
  opacity: 0.42;
}

.las-workspace__splash-title {
  margin: 0;
  font-size: 1.05rem;
  color: var(--ink);
}

.las-workspace__splash-copy {
  margin: 0;
  max-width: 42ch;
  line-height: 1.5;
}

@media (max-width: 1120px) {
  .las-workspace__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .las-workspace__left-panel,
  .las-workspace__splitter--left,
  .las-workspace__plot-shell,
  .las-workspace__splitter--right,
  .las-workspace__right-panel {
    grid-column: auto;
  }

  .las-workspace__plot-shell {
    order: 1;
  }

  .las-workspace__left-panel {
    order: 2;
  }

  .las-workspace__right-panel {
    order: 3;
  }

  .las-workspace__splitter {
    display: none;
  }
}
</style>
