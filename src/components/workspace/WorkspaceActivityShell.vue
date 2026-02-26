<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import { useBottomDockResize } from '@/composables/useBottomDockResize.js';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';
import { useRightDockResize } from '@/composables/useRightDockResize.js';
import { onLanguageChange, t } from '@/app/i18n.js';
import {
  BOTTOM_DOCK_MODES,
  BOTTOM_DOCK_MIN_HEIGHT,
  RIGHT_DOCK_MIN_WIDTH,
  useWorkspaceStore
} from '@/stores/workspaceStore.js';
import CanvasInteractionToolbar from '@/components/workspace/CanvasInteractionToolbar.vue';
import RightContextDock from '@/components/workspace/RightContextDock.vue';
import ResizableBottomDock from '@/components/workspace/ResizableBottomDock.vue';
import WorkspaceProjectActions from '@/components/workspace/WorkspaceProjectActions.vue';
import WorkspaceViewStateControls from '@/components/workspace/WorkspaceViewStateControls.vue';

const workspaceStore = useWorkspaceStore();
const shellRef = ref(null);
const languageTick = ref(0);

const FLOATING_DOCK_MIN_WIDTH = 560;
const FLOATING_DOCK_MIN_HEIGHT = 260;
const FLOATING_DOCK_DEFAULT_WIDTH = 980;
const FLOATING_DOCK_DEFAULT_HEIGHT = 560;

const activityMeta = Object.freeze({
  design: { label: 'Design', i18nKey: 'ui.activity.design' },
  analysis: { label: 'Analysis', i18nKey: 'ui.activity.analysis' },
  settings: { label: 'Settings', i18nKey: 'ui.activity.settings' }
});

let detachResizeListener = null;
let unsubscribeLanguageChange = null;

const isRightDockVisible = computed(() => workspaceStore.rightDockVisible === true);
const isBottomDockVisible = computed(() => workspaceStore.bottomDockVisible === true);
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
const actionButtonLabels = computed(() => {
  void languageTick.value;
  return {
    dataTables: t('ui.sidebar.tables'),
    inspector: t('ui.visual_inspector.title'),
    dockedLayout: t('ui.layout.sidebar')
  };
});

const floatingDockDialogStyle = computed(() => ({
  width: `${floatingDockSize.value.width}px`,
  height: `${floatingDockSize.value.height}px`,
  maxWidth: '96vw',
  maxHeight: '80vh'
}));

const layoutStyle = computed(() => {
  const dockColumns = workspaceStore.rightDockVisible === true
    ? `12px minmax(${RIGHT_DOCK_MIN_WIDTH}px, ${workspaceStore.rightDockWidth}px)`
    : '0 minmax(0, 0px)';
  const bottomRows = isInlineBottomDockVisible.value
    ? `auto minmax(0, 1fr) 12px minmax(${BOTTOM_DOCK_MIN_HEIGHT}px, ${workspaceStore.bottomDockHeight}px)`
    : 'auto minmax(0, 1fr) 0 minmax(0, 0px)';
  return {
    gridTemplateColumns: `minmax(0, 1fr) ${dockColumns}`,
    gridTemplateRows: bottomRows
  };
});

const { startBottomDockResize } = useBottomDockResize(shellRef);
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

function toggleRightDock() {
  workspaceStore.toggleRightDock();
}

function toggleBottomDock() {
  workspaceStore.toggleBottomDock();
}

function setBottomDockMode(mode) {
  workspaceStore.setBottomDockMode(mode);
}

watch([isBottomDockFloating, isBottomDockVisible], ([isFloating, isVisible]) => {
  if (isFloating === true && isVisible === true) return;
  stopFloatingDockResize();
});

onMounted(() => {
  unsubscribeLanguageChange = onLanguageChange(() => {
    languageTick.value += 1;
  });

  workspaceStore.reconcileRightDockWidth();
  workspaceStore.reconcileBottomDockHeight();
  reconcileFloatingDockSize();

  const handleResize = () => {
    workspaceStore.reconcileRightDockWidth();
    workspaceStore.reconcileBottomDockHeight();
    reconcileFloatingDockSize();
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
      </div>

      <div class="workspace-activity-shell__row workspace-activity-shell__row--secondary">
        <WorkspaceProjectActions class="workspace-activity-shell__project-actions" />
        <WorkspaceViewStateControls class="workspace-activity-shell__view-state-controls" />

        <div class="workspace-activity-shell__utility-cluster">
          <CanvasInteractionToolbar class="workspace-activity-shell__interaction-toolbar" />

          <div class="workspace-activity-shell__dock-toggles">
            <Button
              type="button"
              size="small"
              :severity="isBottomDockVisible ? 'info' : 'secondary'"
              :outlined="!isBottomDockVisible"
              icon="pi pi-table"
              :label="actionButtonLabels.dataTables"
              @click="toggleBottomDock"
            />

            <Button
              type="button"
              size="small"
              :severity="isRightDockVisible ? 'info' : 'secondary'"
              :outlined="!isRightDockVisible"
              icon="pi pi-sliders-v"
              :label="actionButtonLabels.inspector"
              @click="toggleRightDock"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="workspace-activity-shell__content">
      <slot />
    </main>

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
  gap: 8px;
  margin-bottom: 10px;
}

.workspace-activity-shell__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}

.workspace-activity-shell__row--primary {
  justify-content: flex-start;
}

.workspace-activity-shell__row--secondary {
  border-top: 1px solid color-mix(in srgb, var(--line) 75%, transparent);
  padding-top: 8px;
  justify-content: flex-start;
  overflow-x: auto;
  overflow-y: hidden;
}

.workspace-activity-shell__title-block {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
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
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.workspace-activity-shell__title {
  margin: 0;
  font-size: clamp(1.25rem, 1.4vw, 1.68rem);
  line-height: 1.02;
  min-width: 0;
}

:deep(.workspace-project-actions.workspace-activity-shell__project-actions) {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-start;
  min-width: 0;
  margin-inline-start: 0;
}

.workspace-activity-shell__utility-cluster {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-inline-start: 0;
  flex-wrap: nowrap;
}

.workspace-activity-shell__dock-toggles {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 4px 6px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--panel-bg, #f8fafc) 92%, transparent);
  flex-wrap: wrap;
}

.workspace-activity-shell__dock-toggles :deep(.p-button) {
  min-height: 30px;
  flex: 0 0 auto;
}

.workspace-activity-shell__dock-toggles :deep(.p-button-label) {
  white-space: nowrap;
}

:deep(.workspace-view-state-controls.workspace-activity-shell__view-state-controls) {
  flex: 0 0 auto;
}

:deep(.canvas-interaction-toolbar.workspace-activity-shell__interaction-toolbar) {
  flex: 0 0 auto;
}

.workspace-activity-shell__content {
  grid-column: 1;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
}

.workspace-activity-shell__dock-splitter::before,
.workspace-activity-shell__bottom-splitter::before {
  content: '';
  position: absolute;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--line) 80%, transparent);
}

.workspace-activity-shell__dock-splitter::after,
.workspace-activity-shell__bottom-splitter::after {
  content: '';
  position: absolute;
  inset: 0;
}

.workspace-activity-shell__dock-splitter {
  grid-column: 2;
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
  grid-column: 3;
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

  .workspace-activity-shell__row {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .workspace-activity-shell__title-block {
    width: 100%;
  }

  .workspace-activity-shell__title {
    width: 100%;
  }

  :deep(.workspace-project-actions.workspace-activity-shell__project-actions) {
    flex: 1 1 100%;
    justify-content: flex-start;
    min-width: 0;
    margin-inline-start: 0;
  }

  .workspace-activity-shell__utility-cluster {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .workspace-activity-shell__dock-toggles {
    width: 100%;
    justify-content: flex-start;
  }

  .workspace-activity-shell__row--secondary {
    align-items: flex-start;
    overflow: visible;
  }

  :deep(.workspace-view-state-controls.workspace-activity-shell__view-state-controls) {
    width: 100%;
    flex: 1 1 auto;
  }

  :deep(.canvas-interaction-toolbar.workspace-activity-shell__interaction-toolbar) {
    max-width: 100%;
  }

  .workspace-activity-shell__dock-splitter,
  .workspace-activity-shell__bottom-splitter {
    display: none;
  }

  .workspace-activity-shell__content {
    min-height: auto;
  }

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
