<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';
import { downloadJPEG, downloadPNG, downloadSVG, downloadWebP } from '@/app/exportWorkflows.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { usePlotElementsStore } from '@/stores/plotElementsStore.js';
import { syncSelectionIndicators } from '@/app/selection.js';
import { getIntervalsWithBoundaryReasons } from '@/composables/usePhysics.js';
import { useSchematicRenderer } from '@/composables/useSchematicRenderer.js';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';
import { onLanguageChange, t } from '@/app/i18n.js';
import Menu from 'primevue/menu';
import CrossSectionPanel from '@/components/cross-section/CrossSectionPanel.vue';
import SchematicCanvas from './SchematicCanvas.vue';
import DirectionalSchematicCanvas from './DirectionalSchematicCanvas.vue';

const projectDataStore = useProjectDataStore();
const viewConfigStore = useViewConfigStore();
const plotElementsStore = usePlotElementsStore();
const config = viewConfigStore.config;

const plotTooltipRef = ref(null);
const exportMenuRef = ref(null);
const languageTick = ref(0);
const CROSS_SECTION_MIN_WIDTH = 320;
const CROSS_SECTION_MIN_HEIGHT = 480;
const CROSS_SECTION_DEFAULT_WIDTH = 560;
const CROSS_SECTION_DEFAULT_HEIGHT = 680;
let unsubscribeLanguageChange = null;
let detachCrossSectionResizeListener = null;

const isDirectionalView = computed(() => config?.viewMode === 'directional');
const crossSectionDialogVisible = computed({
  get: () => config?.showDepthCrossSection === true,
  set: (value) => {
    const nextVisible = value === true;
    viewConfigStore.setShowDepthCrossSection(nextVisible);
  }
});

const {
  dialogSize: crossSectionDialogSize,
  reconcileDialogSize: reconcileCrossSectionDialogSize,
  resizeDialogBy: resizeCrossSectionDialogBy,
  startDialogResize: startCrossSectionResize,
  stopDialogResize: stopCrossSectionResize
} = useFloatingDialogResize({
  minWidth: CROSS_SECTION_MIN_WIDTH,
  minHeight: CROSS_SECTION_MIN_HEIGHT,
  defaultWidth: CROSS_SECTION_DEFAULT_WIDTH,
  defaultHeight: CROSS_SECTION_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.96,
  maxViewportHeightRatio: 0.92,
  cursorClass: 'resizing-both'
});

const crossSectionDialogStyle = computed(() => ({
  width: `${crossSectionDialogSize.value.width}px`,
  height: `${crossSectionDialogSize.value.height}px`,
  maxWidth: '96vw',
  maxHeight: '92vh'
}));

watch(crossSectionDialogVisible, (isVisible) => {
  if (isVisible === true) return;
  stopCrossSectionResize();
});

function handleCrossSectionResizerKeydown(event) {
  const key = String(event?.key ?? '');
  const step = event?.shiftKey === true ? 32 : 16;
  if (key === 'ArrowRight') {
    event.preventDefault();
    resizeCrossSectionDialogBy(step, 0);
    return;
  }
  if (key === 'ArrowLeft') {
    event.preventDefault();
    resizeCrossSectionDialogBy(-step, 0);
    return;
  }
  if (key === 'ArrowDown') {
    event.preventDefault();
    resizeCrossSectionDialogBy(0, step);
    return;
  }
  if (key === 'ArrowUp') {
    event.preventDefault();
    resizeCrossSectionDialogBy(0, -step);
  }
}

const declarativeProjectData = computed(() => ({
  casingData: projectDataStore.casingData,
  tubingData: projectDataStore.tubingData,
  drillStringData: projectDataStore.drillStringData,
  equipmentData: projectDataStore.equipmentData,
  horizontalLines: projectDataStore.horizontalLines,
  annotationBoxes: projectDataStore.annotationBoxes,
  userAnnotations: projectDataStore.userAnnotations,
  cementPlugs: projectDataStore.cementPlugs,
  annulusFluids: projectDataStore.annulusFluids,
  markers: projectDataStore.markers,
  physicsIntervals: projectDataStore.physicsIntervals,
  trajectory: projectDataStore.trajectory
}));

useSchematicRenderer({
  dataSources: [
    () => projectDataStore.casingData,
    () => projectDataStore.tubingData,
    () => projectDataStore.drillStringData,
    () => projectDataStore.equipmentData,
    () => projectDataStore.horizontalLines,
    () => projectDataStore.annotationBoxes,
    () => projectDataStore.userAnnotations,
    () => projectDataStore.cementPlugs,
    () => projectDataStore.annulusFluids,
    () => projectDataStore.markers,
    () => projectDataStore.trajectory
  ],
  styleSources: [
    () => config.colorPalette,
    () => config.plotTitle,
    () => config.operationPhase,
    () => config.cementColor,
    () => config.cementHatchEnabled,
    () => config.cementHatchStyle,
    () => config.showCement,
    () => config.crossoverPixelHalfHeight,
    () => config.units
  ],
  onRender: ({ source, invalidation }) => {
    syncSelectionIndicators();
    if (import.meta.env.DEV) {
      console.debug('[SchematicRenderer]', source, invalidation);
    }
  }
});

watchEffect(() => {
  const intervals = getIntervalsWithBoundaryReasons({
    casingData: projectDataStore.casingData,
    tubingData: projectDataStore.tubingData,
    drillStringData: projectDataStore.drillStringData,
    equipmentData: projectDataStore.equipmentData,
    horizontalLines: projectDataStore.horizontalLines,
    annotationBoxes: projectDataStore.annotationBoxes,
    userAnnotations: projectDataStore.userAnnotations,
    cementPlugs: projectDataStore.cementPlugs,
    annulusFluids: projectDataStore.annulusFluids,
    markers: projectDataStore.markers,
    trajectory: projectDataStore.trajectory,
    config,
    interaction: {}
  });
  projectDataStore.setPhysicsIntervals(intervals);
});

function handleDownloadPng(scale) {
  downloadPNG(scale);
}

function handleDownloadJpeg(quality) {
  downloadJPEG(quality);
}

function handleDownloadWebp(quality) {
  downloadWebP(quality);
}

function handleDownloadSvg() {
  downloadSVG();
}

const exportMenuItems = computed(() => {
  void languageTick.value;
  return [
    {
      label: t('ui.download_png_3x'),
      icon: 'pi pi-image',
      command: () => handleDownloadPng(3)
    },
    {
      label: t('ui.download_png_2x'),
      icon: 'pi pi-image',
      command: () => handleDownloadPng(2)
    },
    {
      label: t('ui.download_png_4x'),
      icon: 'pi pi-image',
      command: () => handleDownloadPng(4)
    },
    {
      label: t('ui.download_jpeg'),
      icon: 'pi pi-image',
      command: () => handleDownloadJpeg(0.95)
    },
    {
      label: t('ui.download_webp'),
      icon: 'pi pi-image',
      command: () => handleDownloadWebp(0.9)
    },
    {
      separator: true
    },
    {
      label: t('ui.download_svg'),
      icon: 'pi pi-file',
      command: () => handleDownloadSvg()
    }
  ];
});

function toggleExportMenu(event) {
  exportMenuRef.value?.toggle(event);
}

function handleDeclarativeSvgReady(svgElement) {
  plotElementsStore.setPlotElement('schematicSvg', svgElement ?? null);
  syncSelectionIndicators();
}

onMounted(() => {
  plotElementsStore.setPlotElement('plotTooltip', plotTooltipRef.value);
  unsubscribeLanguageChange = onLanguageChange(() => {
    languageTick.value += 1;
  });
  reconcileCrossSectionDialogSize();
  const handleResize = () => {
    reconcileCrossSectionDialogSize();
  };
  window.addEventListener('resize', handleResize);
  detachCrossSectionResizeListener = () => {
    window.removeEventListener('resize', handleResize);
  };
});

onBeforeUnmount(() => {
  stopCrossSectionResize();
  detachCrossSectionResizeListener?.();
  detachCrossSectionResizeListener = null;
  plotElementsStore.setPlotElement('schematicSvg', null);
  plotElementsStore.setPlotElement('plotTooltip', null);
  unsubscribeLanguageChange?.();
  unsubscribeLanguageChange = null;
});
</script>

<template>
  <div class="plot-container">
    <div class="plot-container__header d-flex justify-content-between align-items-start">
      <div class="plot-container__copy">
        <div class="plot-container__headline">
          <h5 class="plot-container__title" data-i18n="ui.plot_heading">Well Schematic Plot</h5>
          <div class="plot-container__meta">
            <small class="plot-container__subtitle text-muted">Interactive result canvas with export-ready output presets.</small>
            <small class="plot-container__note text-muted" data-i18n="ui.plot_note">
              Hover or tap segments to inspect values; click to lock highlight, or focus rows in tables.
            </small>
          </div>
        </div>
      </div>
      <div class="export-button-group">
        <Button
          type="button"
          size="small"
          class="plot-export-trigger"
          icon="pi pi-download"
          aria-haspopup="true"
          aria-controls="plotExportMenu"
          title="Download"
          data-i18n-title="ui.download"
          @click="toggleExportMenu"
        >
          <span class="plot-export-trigger__label" data-i18n="ui.download">Download</span>
          <i class="pi pi-chevron-down plot-export-trigger__chevron" aria-hidden="true"></i>
        </Button>
        <Menu
          id="plotExportMenu"
          ref="exportMenuRef"
          :model="exportMenuItems"
          :popup="true"
        />
      </div>
    </div>

    <div class="plot-view-grid">
      <div class="plot-primary schematic-light-scope">
        <div class="comparison-stage">
          <SchematicCanvas
            v-if="!isDirectionalView"
            :project-data="declarativeProjectData"
            :config="config"
            @svg-ready="handleDeclarativeSvgReady"
          />
          <DirectionalSchematicCanvas
            v-else
            :project-data="declarativeProjectData"
            :config="config"
            @svg-ready="handleDeclarativeSvgReady"
          />
        </div>

        <div id="plotTooltip" ref="plotTooltipRef" class="plot-tooltip"></div>
      </div>
    </div>

    <Dialog
      v-model:visible="crossSectionDialogVisible"
      data-vue-owned="true"
      class="cross-section-dialog"
      :modal="false"
      :draggable="true"
      :style="crossSectionDialogStyle"
      :breakpoints="{ '960px': '96vw' }"
    >
      <template #header>
        <span data-i18n="ui.depth_cross_section">Depth Cross-Section</span>
      </template>

      <div class="cross-section-dialog__content">
        <CrossSectionPanel />
        <button
          type="button"
          class="cross-section-dialog__resizer"
          aria-label="Resize depth cross-section"
          @keydown="handleCrossSectionResizerKeydown"
          @pointerdown="startCrossSectionResize"
        ></button>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.plot-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--spacing-sm);
  margin-top: 0;
  position: relative;
  box-shadow: var(--shadow);
}

.plot-container__header {
  gap: var(--spacing-xs);
  margin-bottom: 4px;
}

.plot-container__copy {
  min-width: 0;
}

.plot-container__headline {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.plot-container__title {
  margin: 0;
  font-size: 1.2rem;
  line-height: 1.15;
  white-space: nowrap;
}

.plot-container__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plot-container__subtitle {
  display: block;
  margin-top: 0;
  line-height: 1.25;
  font-size: 0.73rem;
}

.plot-container__note {
  margin: 0;
  display: block;
  line-height: 1.25;
  font-size: 0.73rem;
}

.plot-view-grid {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.plot-primary {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  position: relative;
}

.plot-tooltip {
  position: absolute;
  pointer-events: none;
  background-color: var(--color-tooltip-bg);
  color: var(--color-tooltip-text);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  box-shadow: var(--shadow-tooltip);
  display: none;
  z-index: 20;
  max-width: 260px;
  line-height: 1.25;
}

.declarative-preview {
  margin-top: 16px;
}

.comparison-stage {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}

.export-button-group {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
}

.plot-export-trigger {
  gap: 6px;
  min-width: fit-content;
  min-height: 30px;
}

.plot-export-trigger__label {
  font-weight: 600;
  white-space: nowrap;
}

.plot-export-trigger__chevron {
  font-size: 0.7rem;
  opacity: 0.9;
}

:deep(.cross-section-dialog .p-dialog-content) {
  height: calc(100% - 0.25rem);
  padding-top: 0.5rem;
  overflow: auto;
}

.cross-section-dialog__content {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 20px 20px 0;
}

.cross-section-dialog__content :deep(.cross-section-panel) {
  flex: 1 1 auto;
  min-height: 0;
}

.cross-section-dialog__resizer {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 20px;
  height: 20px;
  border: 0;
  background: transparent;
  border-right: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 0 0 2px 0;
  cursor: nwse-resize;
  touch-action: none;
  z-index: 3;
}

.cross-section-dialog__resizer:focus-visible {
  outline: 2px solid var(--color-accent-primary);
  outline-offset: 1px;
}

@media (max-width: 991px) {
  .plot-container__header {
    flex-wrap: wrap;
  }

  .export-button-group {
    width: 100%;
    justify-content: flex-start;
  }

  .plot-container__title {
    font-size: 1.05rem;
  }

  :deep(.cross-section-dialog) {
    width: 96vw !important;
    height: 72vh !important;
  }

  :deep(.cross-section-dialog .p-dialog-content) {
    overflow: auto;
  }

  .cross-section-dialog__resizer {
    display: none;
  }
}
</style>
