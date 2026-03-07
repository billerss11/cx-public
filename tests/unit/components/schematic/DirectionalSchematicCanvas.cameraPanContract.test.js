import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDirectionalSchematicCanvasSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/DirectionalSchematicCanvas.vue'), 'utf8');
}

describe('DirectionalSchematicCanvas camera pan contract', () => {
  it('derives camera transform from camera flags and directional camera state', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const isCameraTransformEnabled = computed(() => (');
    expect(source).toContain('viewConfigStore.uiState?.useCameraTransform === true');
    expect(source).toContain('viewConfigStore.uiState?.cameraTransformDirectional === true');
    expect(source).toContain('const directionalCameraState = computed(() => (');
    expect(source).toContain('const sceneRootTransform = computed(() => buildCameraTransform(directionalCameraState.value));');
    expect(source).toContain('resolveCamera: () => directionalCameraState.value');
  });

  it('supports directional pan interaction handlers and template pointer-up wiring', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const cameraPanSession = useCameraPanSession({');
    expect(source).toContain('function handleCanvasPointerUp(event) {');
    expect(source).toContain('function updateCameraPanFromPointer(event) {');
    expect(source).toContain('panBy: (deltaX, deltaY) => {');
    expect(source).toContain('viewConfigStore.panDirectionalCameraBy(deltaX, deltaY);');
    expect(source).toContain('resolvePointerFromClient: ({ localPointer }) => (');
    expect(source).toContain('invertCameraPoint(localPointer, directionalCameraState.value) ?? localPointer');
    expect(source).toContain('@pointerup="handleCanvasPointerUp"');
    expect(source).toContain('@pointercancel="handleCanvasPointerUp"');
  });

  it('recovers suppressed background clicks on pointerup when the camera session never moved', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const finishResult = cameraPanSession.finishPan(event);');
    expect(source).toContain('if (finishResult?.shouldProcessClick) {');
    expect(source).toContain('handleCanvasBackgroundClick(event);');
  });

  it('keeps pan session state local without worker drift instrumentation hooks', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('watch([directionalStateSnapshot, () => props.analysisRequestId], async ([snapshot, analysisRequestId]) => {');
    expect(source).not.toContain('cameraPanWorkerInvocationBaseline');
    expect(source).not.toContain('function resolveDirectionalWorkerInvocationCount() {');
    expect(source).not.toContain('function recordDirectionalPanWorkerDriftIfNeeded() {');
    expect(source).not.toContain('incrementDirectionalPanWorkerDriftCount');
  });
});
