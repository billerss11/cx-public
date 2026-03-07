<script setup>
import { computed, ref } from 'vue';
import Select from 'primevue/select';
import Popover from 'primevue/popover';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import DisplayControls from '@/components/controls/DisplayControls.vue';
import {
  MAGNIFIER_ZOOM_LEVEL_OPTIONS,
  normalizeMagnifierZoomLevel
} from '@/constants/index.js';
import {
  USER_ANNOTATION_TOOL_MODE_ADD,
  USER_ANNOTATION_TOOL_MODE_SELECT
} from '@/utils/userAnnotations.js';

const viewConfigStore = useViewConfigStore();
const config = viewConfigStore.config;

const isMagnifierEnabled = computed(() => config.showMagnifier === true);
const isDepthCursorEnabled = computed(() => config.showDepthCursor === true);
const isCrossSectionEnabled = computed(() => config.showDepthCrossSection === true);
const isPhysicsDebugEnabled = computed(() => config.showPhysicsDebug === true);
const isDirectionalView = computed(() => config.viewMode === 'directional');
const CAMERA_ZOOM_STEP = 0.25;
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
const isDisplayControlsOpen = ref(false);
const displayControlsPopoverRef = ref(null);
const annotationToolMode = computed(() => (
  config.annotationToolMode === USER_ANNOTATION_TOOL_MODE_ADD
    ? USER_ANNOTATION_TOOL_MODE_ADD
    : USER_ANNOTATION_TOOL_MODE_SELECT
));
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

function toggleDisplayControlsPanel(event) {
  displayControlsPopoverRef.value?.toggle(event);
}

function handleDisplayControlsShow() {
  isDisplayControlsOpen.value = true;
}

function handleDisplayControlsHide() {
  isDisplayControlsOpen.value = false;
}

function setAnnotationToolMode(mode) {
  viewConfigStore.setAnnotationToolMode(mode);
}
</script>

<template>
  <section class="canvas-interaction-toolbar" role="toolbar" aria-label="Canvas interaction tools">
    <div class="canvas-interaction-toolbar__group" aria-label="Inspection tools">
      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        :class="{ 'canvas-interaction-toolbar__button--active': isMagnifierEnabled }"
        title="Show magnifier"
        data-i18n-title="ui.show_magnifier"
        aria-label="Show magnifier"
        @click="toggleMagnifier"
      >
        <i class="pi pi-search-plus" aria-hidden="true"></i>
      </button>

      <div v-if="isMagnifierEnabled" class="canvas-interaction-toolbar__magnifier-mode">
        <Select
          v-model="magnifierZoomLevelModel"
          :options="magnifierZoomOptions"
          option-label="label"
          option-value="value"
          class="canvas-interaction-toolbar__magnifier-mode-select"
        >
          <template #value="slotProps">
            <span v-if="selectedMagnifierZoomOption">
              {{ selectedMagnifierZoomOption.label }}
            </span>
            <span v-else>{{ slotProps.placeholder }}</span>
          </template>
        </Select>
      </div>

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

      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        :class="{ 'canvas-interaction-toolbar__button--active': isCrossSectionEnabled }"
        title="Show depth cross-section"
        data-i18n-title="ui.show_depth_cross_section"
        aria-label="Show depth cross-section"
        @click="toggleCrossSection"
      >
        <i class="pi pi-chart-line" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        :class="{ 'canvas-interaction-toolbar__button--active': isPhysicsDebugEnabled }"
        title="Debug: Show Physics Intervals"
        aria-label="Debug: Show Physics Intervals"
        @click="togglePhysicsDebug"
      >
        <i class="pi pi-sliders-h" aria-hidden="true"></i>
      </button>
    </div>

    <span class="canvas-interaction-toolbar__divider" aria-hidden="true"></span>

    <div class="canvas-interaction-toolbar__group" aria-label="Camera tools">
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
    </div>

    <span class="canvas-interaction-toolbar__divider" aria-hidden="true"></span>

    <div class="canvas-interaction-toolbar__group" aria-label="Display and annotation tools">
      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        :class="{ 'canvas-interaction-toolbar__button--active': isDisplayControlsOpen }"
        title="Display Layers & Colors"
        data-i18n-title="ui.display_controls_title"
        aria-label="Display Layers & Colors"
        @click="toggleDisplayControlsPanel"
      >
        <i class="pi pi-palette" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        :class="{ 'canvas-interaction-toolbar__button--active': annotationToolMode === USER_ANNOTATION_TOOL_MODE_SELECT }"
        title="Select"
        data-i18n-title="ui.annotation_tool.select"
        aria-label="Select annotation tool"
        @click="setAnnotationToolMode(USER_ANNOTATION_TOOL_MODE_SELECT)"
      >
        <i class="pi pi-check" aria-hidden="true"></i>
      </button>

      <button
        type="button"
        class="canvas-interaction-toolbar__button"
        :class="{ 'canvas-interaction-toolbar__button--active': annotationToolMode === USER_ANNOTATION_TOOL_MODE_ADD }"
        title="Add Note"
        data-i18n-title="ui.annotation_tool.add_note"
        aria-label="Add annotation note"
        @click="setAnnotationToolMode(USER_ANNOTATION_TOOL_MODE_ADD)"
      >
        <i class="pi pi-file-edit" aria-hidden="true"></i>
      </button>
    </div>

    <Popover
      ref="displayControlsPopoverRef"
      appendTo="body"
      class="canvas-interaction-toolbar__popover"
      @show="handleDisplayControlsShow"
      @hide="handleDisplayControlsHide"
    >
      <DisplayControls />
    </Popover>
  </section>
</template>

<style scoped>
.canvas-interaction-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-surface-elevated) 94%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-canvas-toolbar);
  padding: 4px;
  pointer-events: auto;
  white-space: nowrap;
}

.canvas-interaction-toolbar__group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
}

.canvas-interaction-toolbar__button {
  width: 30px;
  height: 30px;
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

.canvas-interaction-toolbar__button--camera-toggle {
  width: auto;
  min-width: 58px;
  padding-inline: 8px;
  gap: 4px;
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

.canvas-interaction-toolbar__camera-state {
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-secondary) 32%, transparent);
  color: var(--color-text-secondary);
}

.canvas-interaction-toolbar__camera-state--on {
  background: color-mix(in srgb, var(--color-accent-primary) 30%, transparent);
  color: var(--color-accent-primary-strong);
}

.canvas-interaction-toolbar__divider {
  width: 1px;
  align-self: stretch;
  background: color-mix(in srgb, var(--color-text-secondary) 35%, transparent);
  margin-inline: 1px;
}

.canvas-interaction-toolbar__depth-mode {
  min-width: 126px;
}

.canvas-interaction-toolbar__magnifier-mode {
  min-width: 88px;
}

.canvas-interaction-toolbar__depth-mode--disabled {
  opacity: 0.68;
}

.canvas-interaction-toolbar__magnifier-mode-select :deep(.p-select-label),
.canvas-interaction-toolbar__depth-mode-select :deep(.p-select-label) {
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  font-size: 0.72rem;
}

.canvas-interaction-toolbar__magnifier-mode-select :deep(.p-select-dropdown),
.canvas-interaction-toolbar__depth-mode-select :deep(.p-select-dropdown) {
  width: 2rem;
}

.canvas-interaction-toolbar__popover :deep(.control-group) {
  margin: 0;
  width: min(340px, calc(100vw - 24px));
}

@media (max-width: 1199px) {
  .canvas-interaction-toolbar {
    flex-wrap: wrap;
    white-space: normal;
  }

  .canvas-interaction-toolbar__divider {
    display: none;
  }
}
</style>
