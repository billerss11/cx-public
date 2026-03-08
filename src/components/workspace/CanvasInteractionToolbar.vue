<script setup>
import { computed, ref } from 'vue';
import Popover from 'primevue/popover';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import DisplayControls from '@/components/controls/DisplayControls.vue';
import {
  MAGNIFIER_ZOOM_LEVEL_OPTIONS,
  normalizeMagnifierZoomLevel
} from '@/constants/index.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import {
  USER_ANNOTATION_TOOL_MODE_ADD,
  USER_ANNOTATION_TOOL_MODE_SELECT
} from '@/utils/userAnnotations.js';

const viewConfigStore = useViewConfigStore();
const config = viewConfigStore.config;
const CAMERA_ZOOM_STEP = 0.25;

const secondaryToolsPopoverRef = ref(null);
const isSecondaryToolsPopoverOpen = ref(false);
const isDisplayControlsExpanded = ref(false);

const isMagnifierEnabled = computed(() => config.showMagnifier === true);
const isDepthCursorEnabled = computed(() => config.showDepthCursor === true);
const isCrossSectionEnabled = computed(() => config.showDepthCrossSection === true);
const isPhysicsDebugEnabled = computed(() => config.showPhysicsDebug === true);
const isDirectionalView = computed(() => config.viewMode === 'directional');
const isCameraTransformGlobalEnabled = computed(() => (
  viewConfigStore.uiState?.useCameraTransform === true
));
const isCameraTransformModeEnabled = computed(() => (
  config.viewMode === 'directional'
    ? viewConfigStore.uiState?.cameraTransformDirectional === true
    : viewConfigStore.uiState?.cameraTransformVertical === true
));
const isCameraTransformEnabledForCurrentView = computed(() => (
  isCameraTransformGlobalEnabled.value === true &&
  isCameraTransformModeEnabled.value === true
));
const cameraControlsToggleTitle = computed(() => (
  isCameraTransformEnabledForCurrentView.value
    ? 'Disable camera controls (pan + zoom)'
    : 'Enable camera controls (pan + zoom)'
));
const cameraControlsToggleAriaLabel = computed(() => (
  isCameraTransformEnabledForCurrentView.value
    ? 'Disable camera controls'
    : 'Enable camera controls'
));
const cameraControlsStateLabel = computed(() => (
  isCameraTransformEnabledForCurrentView.value ? 'ON' : 'OFF'
));
const isCameraZoomAvailableForCurrentView = computed(() => (
  isCameraTransformEnabledForCurrentView.value === true
));
const isFitToDataAvailableForCurrentView = computed(() => (
  isCameraTransformEnabledForCurrentView.value === true
));
const currentCameraState = computed(() => (
  config.viewMode === 'directional'
    ? viewConfigStore.uiState?.directionalCamera
    : viewConfigStore.uiState?.verticalCamera
));
const hasCurrentCameraViewOffset = computed(() => {
  const scale = Number(currentCameraState.value?.scale);
  const translateX = Number(currentCameraState.value?.translateX);
  const translateY = Number(currentCameraState.value?.translateY);
  if (!Number.isFinite(scale) || !Number.isFinite(translateX) || !Number.isFinite(translateY)) return false;
  return Math.abs(scale - 1) > 1e-6 || Math.abs(translateX) > 1e-6 || Math.abs(translateY) > 1e-6;
});

const magnifierZoomOptions = Object.freeze(
  MAGNIFIER_ZOOM_LEVEL_OPTIONS.map((zoomLevel) => ({
    value: zoomLevel,
    label: `${zoomLevel}x`
  }))
);
const magnifierZoomLevelModel = computed({
  get: () => normalizeMagnifierZoomLevel(config.magnifierZoomLevel),
  set: (value) => {
    viewConfigStore.setMagnifierZoomLevel(value);
  }
});
const selectedMagnifierZoomOption = computed(() => (
  magnifierZoomOptions.find((option) => option.value === magnifierZoomLevelModel.value) ?? null
));

const depthCursorModeOptions = [
  { value: 'tvd', label: 'TVD', i18nKey: 'ui.depth_cursor_mode.tvd' },
  { value: 'md', label: 'MD', i18nKey: 'ui.depth_cursor_mode.md' }
];
const depthCursorDirectionalModeModel = computed({
  get: () => (config.depthCursorDirectionalMode === 'md' ? 'md' : 'tvd'),
  set: (value) => {
    viewConfigStore.setDepthCursorDirectionalMode(value);
  }
});
const selectedDepthCursorModeOption = computed(() => (
  depthCursorModeOptions.find((option) => option.value === depthCursorDirectionalModeModel.value) ?? null
));

const annotationToolOptions = Object.freeze([
  {
    value: USER_ANNOTATION_TOOL_MODE_SELECT,
    label: 'Select',
    i18nKey: 'ui.annotation_tool.select',
    icon: 'pi pi-check'
  },
  {
    value: USER_ANNOTATION_TOOL_MODE_ADD,
    label: 'Add Note',
    i18nKey: 'ui.annotation_tool.add_note',
    icon: 'pi pi-file-edit'
  }
]);
const annotationToolModeModel = computed({
  get: () => (
    config.annotationToolMode === USER_ANNOTATION_TOOL_MODE_ADD
      ? USER_ANNOTATION_TOOL_MODE_ADD
      : USER_ANNOTATION_TOOL_MODE_SELECT
  ),
  set: (mode) => {
    viewConfigStore.setAnnotationToolMode(mode);
  }
});

function toggleMagnifier() {
  viewConfigStore.setShowMagnifier(!isMagnifierEnabled.value);
}

function toggleDepthCursor() {
  viewConfigStore.setShowDepthCursor(!isDepthCursorEnabled.value);
}

function toggleCrossSection() {
  viewConfigStore.setShowDepthCrossSection(!isCrossSectionEnabled.value);
}

function togglePhysicsDebug() {
  viewConfigStore.setShowPhysicsDebug(!isPhysicsDebugEnabled.value);
}

function toggleCameraTransformForCurrentView() {
  const nextEnabled = !isCameraTransformEnabledForCurrentView.value;
  viewConfigStore.setUseCameraTransform(true);

  if (config.viewMode === 'directional') {
    viewConfigStore.setCameraTransformDirectional(nextEnabled);
  } else {
    viewConfigStore.setCameraTransformVertical(nextEnabled);
  }

  if (nextEnabled) return;

  const hasOtherModeEnabled = config.viewMode === 'directional'
    ? viewConfigStore.uiState?.cameraTransformVertical === true
    : viewConfigStore.uiState?.cameraTransformDirectional === true;
  if (!hasOtherModeEnabled) {
    viewConfigStore.setUseCameraTransform(false);
  }
}

function resetCameraPanForCurrentView() {
  if (config.viewMode === 'directional') {
    viewConfigStore.resetDirectionalCameraView();
    return;
  }
  viewConfigStore.resetVerticalCameraView();
}

function zoomCameraIn() {
  if (!isCameraZoomAvailableForCurrentView.value) return;
  if (config.viewMode === 'directional') {
    viewConfigStore.zoomDirectionalCameraBy(CAMERA_ZOOM_STEP);
    return;
  }
  viewConfigStore.zoomVerticalCameraBy(CAMERA_ZOOM_STEP);
}

function zoomCameraOut() {
  if (!isCameraZoomAvailableForCurrentView.value) return;
  if (config.viewMode === 'directional') {
    viewConfigStore.zoomDirectionalCameraBy(-CAMERA_ZOOM_STEP);
    return;
  }
  viewConfigStore.zoomVerticalCameraBy(-CAMERA_ZOOM_STEP);
}

function fitToDataForCurrentView() {
  if (!isCameraTransformEnabledForCurrentView.value) return;
  if (config.viewMode === 'directional') {
    viewConfigStore.resetDirectionalCameraView();
    return;
  }
  viewConfigStore.resetVerticalCameraView();
}

function toggleSecondaryToolsPopover(event) {
  secondaryToolsPopoverRef.value?.toggle(event);
}

function handleSecondaryToolsPopoverShow() {
  isSecondaryToolsPopoverOpen.value = true;
}

function handleSecondaryToolsPopoverHide() {
  isSecondaryToolsPopoverOpen.value = false;
  isDisplayControlsExpanded.value = false;
}

function toggleDisplayControlsExpanded() {
  isDisplayControlsExpanded.value = !isDisplayControlsExpanded.value;
}
</script>

<template>
  <section class="canvas-interaction-toolbar" role="toolbar" aria-label="Canvas interaction tools">
    <div class="canvas-interaction-toolbar__core-strip">
      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        :class="{ 'canvas-interaction-toolbar__button--active': isDepthCursorEnabled }"
        title="Show depth cursor"
        data-i18n-title="ui.show_depth_cursor"
        aria-label="Show depth cursor"
        @click="toggleDepthCursor"
      >
        <i class="pi pi-arrows-h" aria-hidden="true"></i>
      </button>

      <div
        v-if="isDirectionalView"
        class="canvas-interaction-toolbar__depth-mode"
        :class="{ 'canvas-interaction-toolbar__depth-mode--disabled': !isDepthCursorEnabled }"
      >
        <Select
          v-model="depthCursorDirectionalModeModel"
          :options="depthCursorModeOptions"
          option-label="label"
          option-value="value"
          class="canvas-interaction-toolbar__depth-mode-select"
          :disabled="!isDepthCursorEnabled"
        >
          <template #value="slotProps">
            <span
              v-if="selectedDepthCursorModeOption"
              :data-i18n="selectedDepthCursorModeOption.i18nKey"
            >
              {{ selectedDepthCursorModeOption.label }}
            </span>
            <span v-else>{{ slotProps.placeholder }}</span>
          </template>
          <template #option="slotProps">
            <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
          </template>
        </Select>
      </div>

      <span class="canvas-interaction-toolbar__divider" aria-hidden="true"></span>

      <button
        type="button"
        class="canvas-interaction-toolbar__button canvas-interaction-toolbar__button--camera-toggle"
        :class="{ 'canvas-interaction-toolbar__button--active': isCameraTransformEnabledForCurrentView }"
        :title="cameraControlsToggleTitle"
        :aria-label="cameraControlsToggleAriaLabel"
        :aria-pressed="isCameraTransformEnabledForCurrentView"
        @click="toggleCameraTransformForCurrentView"
      >
        <i class="pi pi-arrows-alt" aria-hidden="true"></i>
        <span
          class="canvas-interaction-toolbar__camera-state"
          :class="{ 'canvas-interaction-toolbar__camera-state--on': isCameraTransformEnabledForCurrentView }"
          aria-hidden="true"
        >
          {{ cameraControlsStateLabel }}
        </span>
      </button>

      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        title="Zoom out"
        aria-label="Zoom out"
        :disabled="!isCameraZoomAvailableForCurrentView"
        @click="zoomCameraOut"
      >
        <i class="pi pi-minus" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        title="Zoom in"
        aria-label="Zoom in"
        :disabled="!isCameraZoomAvailableForCurrentView"
        @click="zoomCameraIn"
      >
        <i class="pi pi-plus" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        title="Fit to data"
        aria-label="Fit to data"
        :disabled="!isFitToDataAvailableForCurrentView"
        @click="fitToDataForCurrentView"
      >
        <i class="pi pi-expand" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        title="Reset camera view"
        aria-label="Reset camera view"
        :disabled="!hasCurrentCameraViewOffset"
        @click="resetCameraPanForCurrentView"
      >
        <i class="pi pi-refresh" aria-hidden="true"></i>
      </button>

      <span class="canvas-interaction-toolbar__divider" aria-hidden="true"></span>

      <SelectButton
        v-model="annotationToolModeModel"
        :options="annotationToolOptions"
        option-label="label"
        option-value="value"
        class="canvas-interaction-toolbar__annotation-mode"
      >
        <template #option="slotProps">
          <span class="canvas-interaction-toolbar__annotation-option">
            <i :class="slotProps.option.icon" aria-hidden="true"></i>
            <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
          </span>
        </template>
      </SelectButton>
    </div>

    <Button
      type="button"
      size="small"
      text
      rounded
      class="canvas-interaction-toolbar__overflow-trigger"
      :class="{ 'canvas-interaction-toolbar__overflow-trigger--active': isSecondaryToolsPopoverOpen }"
      icon="pi pi-ellipsis-h"
      title="More tools"
      data-i18n-title="ui.toolbar.more_tools"
      aria-label="More tools"
      @click="toggleSecondaryToolsPopover"
    />

    <Popover
      ref="secondaryToolsPopoverRef"
      appendTo="body"
      class="canvas-interaction-toolbar__secondary-popover"
      @show="handleSecondaryToolsPopoverShow"
      @hide="handleSecondaryToolsPopoverHide"
    >
      <div class="canvas-interaction-toolbar__secondary-panel">
        <p class="canvas-interaction-toolbar__secondary-title" data-i18n="ui.toolbar.secondary_tools">Extra Tools</p>

        <Button
          type="button"
          size="small"
          outlined
          class="canvas-interaction-toolbar__secondary-action"
          :class="{ 'canvas-interaction-toolbar__secondary-action--active': isMagnifierEnabled }"
          @click="toggleMagnifier"
        >
          <i class="pi pi-search-plus" aria-hidden="true"></i>
          <span data-i18n="ui.show_magnifier">Show magnifier</span>
        </Button>

        <div v-if="isMagnifierEnabled" class="canvas-interaction-toolbar__secondary-setting">
          <span class="canvas-interaction-toolbar__secondary-setting-label" data-i18n="ui.toolbar.zoom_short">Zoom</span>
          <Select
            v-model="magnifierZoomLevelModel"
            :options="magnifierZoomOptions"
            option-label="label"
            option-value="value"
            class="canvas-interaction-toolbar__secondary-setting-select"
          >
            <template #value="slotProps">
              <span v-if="selectedMagnifierZoomOption">
                {{ selectedMagnifierZoomOption.label }}
              </span>
              <span v-else>{{ slotProps.placeholder }}</span>
            </template>
          </Select>
        </div>

        <Button
          type="button"
          size="small"
          outlined
          class="canvas-interaction-toolbar__secondary-action"
          :class="{ 'canvas-interaction-toolbar__secondary-action--active': isCrossSectionEnabled }"
          @click="toggleCrossSection"
        >
          <i class="pi pi-chart-line" aria-hidden="true"></i>
          <span data-i18n="ui.show_depth_cross_section">Show depth cross-section</span>
        </Button>

        <Button
          type="button"
          size="small"
          outlined
          class="canvas-interaction-toolbar__secondary-action"
          :class="{ 'canvas-interaction-toolbar__secondary-action--active': isPhysicsDebugEnabled }"
          @click="togglePhysicsDebug"
        >
          <i class="pi pi-sliders-h" aria-hidden="true"></i>
          <span data-i18n="ui.toolbar.physics_debug">Debug Physics Intervals</span>
        </Button>

        <Button
          type="button"
          size="small"
          outlined
          class="canvas-interaction-toolbar__secondary-action"
          :class="{ 'canvas-interaction-toolbar__secondary-action--active': isDisplayControlsExpanded }"
          @click="toggleDisplayControlsExpanded"
        >
          <i class="pi pi-palette" aria-hidden="true"></i>
          <span data-i18n="ui.display_controls_title">Display Layers & Colors</span>
          <i
            class="pi canvas-interaction-toolbar__secondary-chevron"
            :class="isDisplayControlsExpanded ? 'pi-chevron-up' : 'pi-chevron-down'"
            aria-hidden="true"
          ></i>
        </Button>

        <div v-if="isDisplayControlsExpanded" class="canvas-interaction-toolbar__display-controls-stage">
          <DisplayControls />
        </div>
      </div>
    </Popover>
  </section>
</template>

<style scoped>
.canvas-interaction-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  min-width: 0;
}

.canvas-interaction-toolbar__core-strip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 3px 4px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--panel-bg) 92%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-surface-elevated) 35%, transparent);
  min-width: 0;
}

.canvas-interaction-toolbar__button {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease;
}

.canvas-interaction-toolbar__button:hover {
  border-color: color-mix(in srgb, var(--color-accent-primary-strong) 45%, transparent);
  background: color-mix(in srgb, var(--color-accent-primary) 10%, transparent);
}

.canvas-interaction-toolbar__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.canvas-interaction-toolbar__button--active {
  border-color: color-mix(in srgb, var(--color-accent-primary-strong) 70%, transparent);
  background: color-mix(in srgb, var(--color-accent-primary) 18%, transparent);
  color: var(--color-accent-primary-strong);
}

.canvas-interaction-toolbar__button--camera-toggle {
  width: auto;
  min-width: 56px;
  padding-inline: 8px;
  gap: 4px;
}

.canvas-interaction-toolbar__camera-state {
  font-size: 0.54rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-secondary) 30%, transparent);
  color: var(--color-text-secondary);
}

.canvas-interaction-toolbar__camera-state--on {
  background: color-mix(in srgb, var(--color-accent-primary) 30%, transparent);
  color: var(--color-accent-primary-strong);
}

.canvas-interaction-toolbar__divider {
  width: 1px;
  align-self: stretch;
  background: color-mix(in srgb, var(--line) 72%, transparent);
  margin-inline: 1px;
}

.canvas-interaction-toolbar__depth-mode {
  min-width: 112px;
}

.canvas-interaction-toolbar__depth-mode--disabled {
  opacity: 0.68;
}

.canvas-interaction-toolbar__depth-mode-select :deep(.p-select-label) {
  padding-top: 0.34rem;
  padding-bottom: 0.34rem;
  font-size: 0.7rem;
}

.canvas-interaction-toolbar__depth-mode-select :deep(.p-select-dropdown) {
  width: 1.9rem;
}

.canvas-interaction-toolbar__annotation-mode :deep(.p-selectbutton) {
  border: 1px solid color-mix(in srgb, var(--line) 74%, transparent);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.canvas-interaction-toolbar__annotation-mode :deep(.p-togglebutton) {
  min-height: 28px;
  padding: 4px 8px;
  font-size: 0.7rem;
}

.canvas-interaction-toolbar__annotation-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.canvas-interaction-toolbar__overflow-trigger {
  width: 28px;
  height: 28px;
}

.canvas-interaction-toolbar__overflow-trigger--active {
  color: var(--color-accent-primary-strong);
  background: color-mix(in srgb, var(--color-accent-primary) 15%, transparent);
}

.canvas-interaction-toolbar__secondary-panel {
  display: grid;
  gap: 8px;
  width: min(360px, calc(100vw - 28px));
}

.canvas-interaction-toolbar__secondary-title {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

.canvas-interaction-toolbar__secondary-action {
  justify-content: flex-start;
  gap: 6px;
}

.canvas-interaction-toolbar__secondary-action--active {
  border-color: color-mix(in srgb, var(--color-accent-primary-strong) 70%, transparent);
  background: color-mix(in srgb, var(--color-accent-primary) 14%, transparent);
  color: var(--color-accent-primary-strong);
}

.canvas-interaction-toolbar__secondary-setting {
  display: grid;
  gap: 4px;
}

.canvas-interaction-toolbar__secondary-setting-label {
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.canvas-interaction-toolbar__secondary-setting-select :deep(.p-select-label) {
  padding-top: 0.36rem;
  padding-bottom: 0.36rem;
  font-size: 0.72rem;
}

.canvas-interaction-toolbar__secondary-chevron {
  margin-left: auto;
}

.canvas-interaction-toolbar__display-controls-stage {
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-elevated) 96%, transparent);
}

.canvas-interaction-toolbar__display-controls-stage :deep(.control-group) {
  margin: 0;
  width: 100%;
}

@media (max-width: 1199px) {
  .canvas-interaction-toolbar {
    width: 100%;
    justify-content: space-between;
  }

  .canvas-interaction-toolbar__core-strip {
    min-width: 0;
    max-width: calc(100% - 34px);
    overflow-x: auto;
    scrollbar-width: thin;
  }
}
</style>
