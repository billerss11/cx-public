import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readCanvasInteractionToolbarSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/workspace/CanvasInteractionToolbar.vue'), 'utf8');
}

describe('CanvasInteractionToolbar camera controls contract', () => {
  it('derives camera-enable state from global and mode-scoped migration flags', () => {
    const source = readCanvasInteractionToolbarSource();

    expect(source).toContain('const isCameraTransformGlobalEnabled = computed(() => (');
    expect(source).toContain('viewConfigStore.uiState?.useCameraTransform === true');
    expect(source).toContain('const isCameraTransformModeEnabled = computed(() => (');
    expect(source).toContain("config.viewMode === 'directional'");
    expect(source).toContain('viewConfigStore.uiState?.cameraTransformDirectional === true');
    expect(source).toContain('viewConfigStore.uiState?.cameraTransformVertical === true');
  });

  it('supports current-view camera toggle and full-view reset actions', () => {
    const source = readCanvasInteractionToolbarSource();

    expect(source).toContain('function toggleCameraTransformForCurrentView() {');
    expect(source).toContain('const cameraControlsToggleTitle = computed(() => (');
    expect(source).toContain("    ? 'Disable camera controls (pan + zoom)'");
    expect(source).toContain("    : 'Enable camera controls (pan + zoom)'");
    expect(source).toContain('const cameraControlsToggleAriaLabel = computed(() => (');
    expect(source).toContain("    ? 'Disable camera controls'");
    expect(source).toContain("    : 'Enable camera controls'");
    expect(source).toContain('const cameraControlsStateLabel = computed(() => (');
    expect(source).toContain("  isCameraTransformEnabledForCurrentView.value ? 'ON' : 'OFF'");
    expect(source).toContain('viewConfigStore.setUseCameraTransform(true);');
    expect(source).toContain('viewConfigStore.setCameraTransformDirectional(nextEnabled);');
    expect(source).toContain('viewConfigStore.setCameraTransformVertical(nextEnabled);');
    expect(source).toContain('function resetCameraPanForCurrentView() {');
    expect(source).toContain('viewConfigStore.resetDirectionalCameraView();');
    expect(source).toContain('viewConfigStore.resetVerticalCameraView();');
    expect(source).toContain('@click="toggleCameraTransformForCurrentView"');
    expect(source).toContain(':aria-pressed="isCameraTransformEnabledForCurrentView"');
    expect(source).toContain('class="canvas-interaction-toolbar__button canvas-interaction-toolbar__button--camera-toggle"');
    expect(source).toContain("class=\"canvas-interaction-toolbar__camera-state\"");
    expect(source).toContain("{{ cameraControlsStateLabel }}");
    expect(source).toContain('@click="resetCameraPanForCurrentView"');
  });

  it('provides current-view zoom controls gated by camera-enable state', () => {
    const source = readCanvasInteractionToolbarSource();

    expect(source).toContain('const CAMERA_ZOOM_STEP = 0.25;');
    expect(source).toContain('const isCameraZoomAvailableForCurrentView = computed(() => (');
    expect(source).toContain('isCameraTransformEnabledForCurrentView.value === true');
    expect(source).toContain('function zoomCameraIn() {');
    expect(source).toContain('function zoomCameraOut() {');
    expect(source).toContain("if (config.viewMode === 'directional') {");
    expect(source).toContain('viewConfigStore.zoomDirectionalCameraBy(CAMERA_ZOOM_STEP);');
    expect(source).toContain('viewConfigStore.zoomVerticalCameraBy(CAMERA_ZOOM_STEP);');
    expect(source).toContain('viewConfigStore.zoomDirectionalCameraBy(-CAMERA_ZOOM_STEP);');
    expect(source).toContain('viewConfigStore.zoomVerticalCameraBy(-CAMERA_ZOOM_STEP);');
    expect(source).toContain('@click="zoomCameraIn"');
    expect(source).toContain('@click="zoomCameraOut"');
  });

  it('gates fit-to-data to camera mode and keeps action camera-reset only', () => {
    const source = readCanvasInteractionToolbarSource();

    expect(source).toContain('const isFitToDataAvailableForCurrentView = computed(() => (');
    expect(source).toContain('isCameraTransformEnabledForCurrentView.value === true');
    expect(source).toContain('function fitToDataForCurrentView() {');
    expect(source).toContain('if (!isCameraTransformEnabledForCurrentView.value) return;');
    expect(source).toContain('viewConfigStore.resetDirectionalCameraView();');
    expect(source).toContain('viewConfigStore.resetVerticalCameraView();');
    expect(source).toContain('@click="fitToDataForCurrentView"');
  });
});
