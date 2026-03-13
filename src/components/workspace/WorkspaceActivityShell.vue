<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import { useBottomDockResize } from '@/composables/useBottomDockResize.js';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';
import { useLeftDockResize } from '@/composables/useLeftDockResize.js';
import { useRightDockResize } from '@/composables/useRightDockResize.js';
import { onLanguageChange, t } from '@/app/i18n.js';
import {
  BOTTOM_DOCK_MIN_HEIGHT,
  BOTTOM_DOCK_MODES,
  LEFT_DOCK_MIN_WIDTH,
  RIGHT_DOCK_MIN_WIDTH,
  useWorkspaceStore
} from '@/stores/workspaceStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import CanvasInteractionToolbar from '@/components/workspace/CanvasInteractionToolbar.vue';
import LeftHierarchyDock from '@/components/workspace/LeftHierarchyDock.vue';
import RightContextDock from '@/components/workspace/RightContextDock.vue';
import WorkspaceProjectActions from '@/components/workspace/WorkspaceProjectActions.vue';
import WorkspaceViewStateControls from '@/components/workspace/WorkspaceViewStateControls.vue';

const ResizableBottomDock = defineAsyncComponent(() => import('@/components/workspace/ResizableBottomDock.vue'));

const workspaceStore = useWorkspaceStore();
const projectStore = useProjectStore();
const shellRef = ref(null);
const languageTick = ref(0);
const isCompactToolbarMode = ref(false);
const compactToolsDialogVisible = ref(false);

const FLOATING_DOCK_MIN_WIDTH = 560;
const FLOATING_DOCK_MIN_HEIGHT = 260;
const FLOATING_DOCK_DEFAULT_WIDTH = 980;
const FLOATING_DOCK_DEFAULT_HEIGHT = 560;
const COMPACT_TOOLBAR_BREAKPOINT = 1200;

const activityMeta = Object.freeze({
  design: { label: 'Design', i18nKey: 'ui.activity.design' },
  analysis: { label: 'Analysis', i18nKey: 'ui.activity.analysis' },
  las: { label: 'LAS', i18nKey: 'ui.activity.las' },
  settings: { label: 'Settings', i18nKey: 'ui.activity.settings' }
});

let detachResizeListener = null;
let unsubscribeLanguageChange = null;

const isLasActivityActive = computed(() => workspaceStore.currentActivity === 'las');
const shouldShowSharedTopControls = computed(() => isLasActivityActive.value !== true);
const isLeftDockVisible = computed(() => (
  shouldShowSharedTopControls.value === true
  && workspaceStore.leftDockVisible === true
));
const isRightDockVisible = computed(() => (
  shouldShowSharedTopControls.value === true
  && workspaceStore.rightDockVisible === true
));
const isBottomDockVisible = computed(() => (
  shouldShowSharedTopControls.value === true
  && workspaceStore.bottomDockVisible === true
));
const isBottomDockFloating = computed(() => workspaceStore.bottomDockMode === BOTTOM_DOCK_MODES.floating);
const isBottomDockDocked = computed(() => isBottomDockFloating.value !== true);
const isInlineBottomDockVisible = computed(() => isBottomDockVisible.value && isBottomDockDocked.value);
const floatingBottomDockVisible = computed({
  get: () => isBottomDockVisible.value,
  set: (visible) => {
    workspaceStore.setBottomDockVisibility(visible === true);
  }
});
const activeActivity = computed(() => (
  activityMeta[workspaceStore.currentActivity] ?? activityMeta.design
));
const loadWarningMessage = computed(() => {
  const warnings = Array.isArray(projectStore.loadWarnings) ? projectStore.loadWarnings : [];
  const warning = warnings.find((entry) => String(entry?.message ?? '').trim().length > 0);
  return String(warning?.message ?? '').trim() || null;
});
const actionButtonLabels = computed(() => {
  void languageTick.value;
  return {
    hierarchy: t('ui.toolbar.hierarchy_short'),
    dataTables: t('ui.sidebar.tables'),
    inspector: t('ui.toolbar.inspector_short'),
    dockedLayout: t('ui.layout.sidebar'),
    tools: t('ui.toolbar.tools')
  };
});

const floatingDockDialogStyle = computed(() => ({
  width: `${floatingDockSize.value.width}px`,
  height: `${floatingDockSize.value.height}px`,
  maxWidth: '96vw',
  maxHeight: '80vh'
}));

const layoutStyle = computed(() => {
  const leftColumns = isLeftDockVisible.value === true
    ? `minmax(${LEFT_DOCK_MIN_WIDTH}px, ${workspaceStore.leftDockWidth}px) 12px`
    : 'minmax(0, 0px) 0';
  const rightColumns = isRightDockVisible.value === true
    ? `12px minmax(${RIGHT_DOCK_MIN_WIDTH}px, ${workspaceStore.rightDockWidth}px)`
    : '0 minmax(0, 0px)';
  const bottomRows = isInlineBottomDockVisible.value
    ? `auto minmax(0, 1fr) 12px minmax(${BOTTOM_DOCK_MIN_HEIGHT}px, ${workspaceStore.bottomDockHeight}px)`
    : 'auto minmax(0, 1fr) 0 minmax(0, 0px)';
  return {
    gridTemplateColumns: `${leftColumns} minmax(0, 1fr) ${rightColumns}`,
    gridTemplateRows: bottomRows
  };
});

const { startBottomDockResize } = useBottomDockResize(shellRef);
const { startLeftDockResize } = useLeftDockResize(shellRef);
const { startRightDockResize } = useRightDockResize(shellRef);
const {
  dialogSize: floatingDockSize,
  reconcileDialogSize: reconcileFloatingDockSize,
  startDialogResize: startFloatingDockResize,
  stopDialogResize: stopFloatingDockResize
} = useFloatingDialogResize({
  minWidth: FLOATING_DOCK_MIN_WIDTH,
  minHeight: FLOATING_DOCK_MIN_HEIGHT,
  defaultWidth: FLOATING_DOCK_DEFAULT_WIDTH,
  defaultHeight: FLOATING_DOCK_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.96,
  maxViewportHeightRatio: 0.8,
  cursorClass: 'resizing-both'
});

function toggleLeftDock() {
  workspaceStore.toggleLeftDock();
}

function toggleRightDock() {
  workspaceStore.toggleRightDock();
}

function toggleBottomDock() {
  workspaceStore.toggleBottomDock();
}

function setBottomDockMode(mode) {
  workspaceStore.setBottomDockMode(mode);
}

function openCompactToolsDialog() {
  compactToolsDialogVisible.value = true;
}

function updateCompactToolbarMode() {
  const nextCompactMode = window.innerWidth <= COMPACT_TOOLBAR_BREAKPOINT;
  isCompactToolbarMode.value = nextCompactMode;
  if (!nextCompactMode) {
    compactToolsDialogVisible.value = false;
  }
}

watch([isBottomDockFloating, isBottomDockVisible], ([isFloating, isVisible]) => {
  if (isFloating === true && isVisible === true) return;
  stopFloatingDockResize();
});

onMounted(() => {
  unsubscribeLanguageChange = onLanguageChange(() => {
    languageTick.value += 1;
  });

  workspaceStore.reconcileLeftDockWidth();
  workspaceStore.reconcileRightDockWidth();
  workspaceStore.reconcileBottomDockHeight();
  reconcileFloatingDockSize();
  updateCompactToolbarMode();

  const handleResize = () => {
    workspaceStore.reconcileLeftDockWidth();
    workspaceStore.reconcileRightDockWidth();
    workspaceStore.reconcileBottomDockHeight();
    reconcileFloatingDockSize();
    updateCompactToolbarMode();
  };

  window.addEventListener('resize', handleResize);
  detachResizeListener = () => {
    window.removeEventListener('resize', handleResize);
  };
});

onBeforeUnmount(() => {
  stopFloatingDockResize();
  detachResizeListener?.();
  detachResizeListener = null;
  unsubscribeLanguageChange?.();
  unsubscribeLanguageChange = null;
});
</script>

<template>
  <div
    ref="shellRef"
    class="workspace-activity-shell"
    :style="layoutStyle"
  >
    <header class="workspace-activity-shell__top top-bar">
      <div class="workspace-activity-shell__row workspace-activity-shell__row--primary">
        <div class="workspace-activity-shell__title-block">
          <p class="workspace-activity-shell__activity-pill">
            <i class="pi pi-compass" aria-hidden="true"></i>
            <span :data-i18n="activeActivity.i18nKey">{{ activeActivity.label }}</span>
          </p>
          <h2 class="workspace-activity-shell__title" data-i18n="app.title">Casing Schematic Plotter</h2>
        </div>
        <WorkspaceProjectActions
          v-show="shouldShowSharedTopControls"
          class="workspace-activity-shell__project-actions"
        />
      </div>

      <div
        v-show="shouldShowSharedTopControls"
        class="workspace-activity-shell__row workspace-activity-shell__row--secondary"
      >
        <template v-if="!isCompactToolbarMode">
          <WorkspaceViewStateControls class="workspace-activity-shell__view-state-controls" />
          <CanvasInteractionToolbar class="workspace-activity-shell__interaction-toolbar" />

          <div class="workspace-activity-shell__panel-segment" role="group" aria-label="Workspace panel visibility">
            <Button
              type="button"
              size="small"
              text
              class="workspace-activity-shell__panel-toggle"
              :class="{ 'workspace-activity-shell__panel-toggle--active': isLeftDockVisible }"
              icon="pi pi-list"
              :label="actionButtonLabels.hierarchy"
              @click="toggleLeftDock"
            />

            <Button
              type="button"
              size="small"
              text
              class="workspace-activity-shell__panel-toggle"
              :class="{ 'workspace-activity-shell__panel-toggle--active': isBottomDockVisible }"
              icon="pi pi-table"
              :label="actionButtonLabels.dataTables"
              @click="toggleBottomDock"
            />

            <Button
              type="button"
              size="small"
              text
              class="workspace-activity-shell__panel-toggle"
              :class="{ 'workspace-activity-shell__panel-toggle--active': isRightDockVisible }"
              icon="pi pi-sliders-v"
              :label="actionButtonLabels.inspector"
              @click="toggleRightDock"
            />
          </div>
        </template>

        <div v-else class="workspace-activity-shell__compact-launcher">
          <Button
            type="button"
            size="small"
            outlined
            icon="pi pi-sliders-h"
            :label="actionButtonLabels.tools"
            @click="openCompactToolsDialog"
          />
        </div>
      </div>

      <Message
        v-if="loadWarningMessage"
        severity="warn"
        :closable="false"
        class="workspace-activity-shell__warning"
      >
        {{ loadWarningMessage }}
      </Message>
    </header>

    <main class="workspace-activity-shell__content">
      <slot />
    </main>

    <div
      v-show="isLeftDockVisible"
      class="workspace-activity-shell__left-splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize hierarchy dock"
      @pointerdown="startLeftDockResize"
    ></div>

    <aside v-show="isLeftDockVisible" class="workspace-activity-shell__left-dock">
      <LeftHierarchyDock />
    </aside>

    <div
      v-show="isRightDockVisible"
      class="workspace-activity-shell__dock-splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize inspector dock"
      @pointerdown="startRightDockResize"
    ></div>

    <aside v-show="isRightDockVisible" class="workspace-activity-shell__dock">
      <RightContextDock />
    </aside>

    <div
      v-show="isInlineBottomDockVisible"
      class="workspace-activity-shell__bottom-splitter"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize data tables dock"
      @pointerdown="startBottomDockResize"
    ></div>

    <section v-show="isInlineBottomDockVisible" class="workspace-activity-shell__bottom-dock">
      <ResizableBottomDock
        :mode="BOTTOM_DOCK_MODES.docked"
        @request-mode-change="setBottomDockMode"
      />
    </section>
  </div>

  <Dialog
    v-if="isBottomDockFloating && isBottomDockVisible"
    v-model:visible="floatingBottomDockVisible"
    data-vue-owned="true"
    class="workspace-activity-shell__floating-dock"
    :modal="false"
    :draggable="true"
    :style="floatingDockDialogStyle"
    :breakpoints="{ '1200px': '96vw' }"
  >
    <template #header>
      <div class="workspace-activity-shell__floating-dock-header">
        <span data-i18n="ui.sidebar.tables">Data Tables</span>
        <Button
          type="button"
          text
          rounded
          icon="pi pi-window-minimize"
          size="small"
          :title="actionButtonLabels.dockedLayout"
          @click="setBottomDockMode(BOTTOM_DOCK_MODES.docked)"
        />
      </div>
    </template>

    <div class="workspace-activity-shell__floating-dock-content">
      <ResizableBottomDock
        :mode="BOTTOM_DOCK_MODES.floating"
        :show-header="false"
        @request-mode-change="setBottomDockMode"
      />
      <span
        class="workspace-activity-shell__floating-dock-resizer"
        aria-label="Resize floating data tables"
        @pointerdown="startFloatingDockResize"
      ></span>
    </div>
  </Dialog>

  <Dialog
    v-if="shouldShowSharedTopControls && isCompactToolbarMode"
    v-model:visible="compactToolsDialogVisible"
    modal
    :draggable="false"
    :header="actionButtonLabels.tools"
    :style="{ width: 'min(96vw, 36rem)' }"
    :content-style="{ paddingTop: '0.45rem' }"
  >
    <div class="workspace-activity-shell__compact-tools-panel">
      <WorkspaceViewStateControls class="workspace-activity-shell__view-state-controls workspace-activity-shell__view-state-controls--compact" />
      <CanvasInteractionToolbar class="workspace-activity-shell__interaction-toolbar workspace-activity-shell__interaction-toolbar--compact" />

      <div class="workspace-activity-shell__panel-segment workspace-activity-shell__panel-segment--compact" role="group" aria-label="Workspace panel visibility">
        <Button
          type="button"
          size="small"
          text
          class="workspace-activity-shell__panel-toggle"
          :class="{ 'workspace-activity-shell__panel-toggle--active': isLeftDockVisible }"
          icon="pi pi-list"
          :label="actionButtonLabels.hierarchy"
          @click="toggleLeftDock"
        />

        <Button
          type="button"
          size="small"
          text
          class="workspace-activity-shell__panel-toggle"
          :class="{ 'workspace-activity-shell__panel-toggle--active': isBottomDockVisible }"
          icon="pi pi-table"
          :label="actionButtonLabels.dataTables"
          @click="toggleBottomDock"
        />

        <Button
          type="button"
          size="small"
          text
          class="workspace-activity-shell__panel-toggle"
          :class="{ 'workspace-activity-shell__panel-toggle--active': isRightDockVisible }"
          icon="pi pi-sliders-v"
          :label="actionButtonLabels.inspector"
          @click="toggleRightDock"
        />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.workspace-activity-shell {
  display: grid;
  align-items: stretch;
  gap: 0;
  height: calc(100vh - 36px);
  min-height: 560px;
}

.workspace-activity-shell__top {
  grid-column: 1 / -1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.workspace-activity-shell__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.workspace-activity-shell__row--primary {
  min-height: 34px;
  justify-content: space-between;
  flex-wrap: nowrap;
}

.workspace-activity-shell__row--secondary {
  border-top: 1px solid color-mix(in srgb, var(--line) 75%, transparent);
  padding-top: 6px;
  min-height: 34px;
  justify-content: flex-start;
  align-items: center;
  gap: 7px;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
}

.workspace-activity-shell__title-block {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}

.workspace-activity-shell__activity-pill {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--color-accent-primary) 34%, transparent);
  background: color-mix(in srgb, var(--color-accent-primary) 13%, transparent);
  color: var(--color-accent-primary-strong);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.workspace-activity-shell__title {
  margin: 0;
  font-size: clamp(1.02rem, 1.1vw, 1.22rem);
  line-height: 1.1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.workspace-project-actions.workspace-activity-shell__project-actions) {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-start;
  min-width: 0;
  margin-inline-start: auto;
}

.workspace-activity-shell__compact-launcher {
  display: inline-flex;
  align-items: center;
}

.workspace-activity-shell__panel-segment {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--panel-bg) 92%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-surface-elevated) 35%, transparent);
  overflow: hidden;
}

.workspace-activity-shell__panel-toggle {
  min-height: 30px;
  border-radius: 0;
  padding-inline: 9px;
}

.workspace-activity-shell__panel-toggle:not(:last-child) {
  border-right: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
}

.workspace-activity-shell__panel-toggle--active {
  background: color-mix(in srgb, var(--color-accent-primary) 15%, transparent);
  color: var(--color-accent-primary-strong);
}

:deep(.workspace-view-state-controls.workspace-activity-shell__view-state-controls) {
  flex: 0 0 auto;
}

:deep(.canvas-interaction-toolbar.workspace-activity-shell__interaction-toolbar) {
  flex: 0 0 auto;
}

.workspace-activity-shell__compact-tools-panel {
  display: grid;
  gap: 10px;
}

.workspace-activity-shell__panel-segment--compact {
  width: fit-content;
}

:deep(.workspace-view-state-controls.workspace-activity-shell__view-state-controls--compact),
:deep(.canvas-interaction-toolbar.workspace-activity-shell__interaction-toolbar--compact) {
  width: 100%;
}

.workspace-activity-shell__content {
  grid-column: 3;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
}

.workspace-activity-shell__warning {
  margin: 0 var(--spacing-md) var(--spacing-sm);
}

.workspace-activity-shell__left-splitter::before,
.workspace-activity-shell__dock-splitter::before,
.workspace-activity-shell__bottom-splitter::before {
  content: '';
  position: absolute;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--line) 80%, transparent);
}

.workspace-activity-shell__left-splitter::after,
.workspace-activity-shell__dock-splitter::after,
.workspace-activity-shell__bottom-splitter::after {
  content: '';
  position: absolute;
  inset: 0;
}

.workspace-activity-shell__left-splitter {
  grid-column: 2;
  grid-row: 2;
  width: 12px;
  cursor: col-resize;
  position: relative;
}

.workspace-activity-shell__left-splitter::before {
  top: 8px;
  bottom: 8px;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
}

.workspace-activity-shell__left-dock {
  grid-column: 1;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
}

.workspace-activity-shell__dock-splitter {
  grid-column: 4;
  grid-row: 2;
  width: 12px;
  cursor: col-resize;
  position: relative;
}

.workspace-activity-shell__dock-splitter::before {
  top: 8px;
  bottom: 8px;
  left: 50%;
  width: 4px;
  transform: translateX(-50%);
}

.workspace-activity-shell__dock {
  grid-column: 5;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
}

.workspace-activity-shell__bottom-splitter {
  grid-column: 1 / -1;
  grid-row: 3;
  height: 12px;
  cursor: row-resize;
  position: relative;
}

.workspace-activity-shell__bottom-splitter::before {
  left: 8px;
  right: 8px;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
}

.workspace-activity-shell__bottom-dock {
  grid-column: 1 / -1;
  grid-row: 4;
  min-height: 0;
}

.workspace-activity-shell__bottom-dock :deep(.resizable-bottom-dock) {
  height: 100%;
}

.workspace-activity-shell__floating-dock-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.workspace-activity-shell__floating-dock-content {
  position: relative;
  height: 100%;
  box-sizing: border-box;
  padding: 0 22px 22px 0;
}

.workspace-activity-shell__floating-dock-content :deep(.resizable-bottom-dock) {
  height: 100%;
}

.workspace-activity-shell__floating-dock-resizer {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 14px;
  height: 14px;
  border-right: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 0 0 2px 0;
  cursor: nwse-resize;
  z-index: 3;
}

:deep(.workspace-activity-shell__floating-dock .p-dialog-content) {
  height: calc(100% - 0.25rem);
  padding-top: 0.5rem;
}

@media (max-width: 991px) {
  .workspace-activity-shell {
    display: block;
    height: auto;
    min-height: 0;
  }

  .workspace-activity-shell__top {
    margin-bottom: 8px;
  }

  .workspace-activity-shell__row--primary {
    align-items: flex-start;
    flex-wrap: wrap;
    row-gap: 6px;
  }

  .workspace-activity-shell__title-block {
    width: auto;
    max-width: 100%;
  }

  .workspace-activity-shell__title {
    width: auto;
    max-width: min(100%, 24rem);
  }

  :deep(.workspace-project-actions.workspace-activity-shell__project-actions) {
    flex: 1 1 100%;
    justify-content: flex-start;
    min-width: 0;
    margin-inline-start: 0;
  }

  .workspace-activity-shell__row--secondary {
    min-height: 32px;
  }

  :deep(.workspace-view-state-controls.workspace-activity-shell__view-state-controls) {
    width: 100%;
    flex: 1 1 auto;
  }

  :deep(.canvas-interaction-toolbar.workspace-activity-shell__interaction-toolbar) {
    max-width: 100%;
  }

  .workspace-activity-shell__dock-splitter,
  .workspace-activity-shell__left-splitter,
  .workspace-activity-shell__bottom-splitter {
    display: none;
  }

  .workspace-activity-shell__content {
    min-height: auto;
  }

  .workspace-activity-shell__left-dock,
  .workspace-activity-shell__dock,
  .workspace-activity-shell__bottom-dock {
    margin-top: var(--spacing-md);
  }

  :deep(.workspace-activity-shell__floating-dock) {
    width: 96vw !important;
    height: 70vh !important;
  }
}
</style>
