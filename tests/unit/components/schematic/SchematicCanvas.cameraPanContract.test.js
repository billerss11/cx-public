import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSchematicCanvasSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/SchematicCanvas.vue'), 'utf8');
}

describe('SchematicCanvas vertical camera pan contract', () => {
  it('derives camera transform from camera flags and vertical camera state', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const isCameraTransformEnabled = computed(() => (');
    expect(source).toContain('viewConfigStore.uiState?.useCameraTransform === true');
    expect(source).toContain('viewConfigStore.uiState?.cameraTransformVertical === true');
    expect(source).toContain('const verticalCameraState = computed(() => (');
    expect(source).toContain('sceneRootTransform = computed(() => buildCameraTransform(verticalCameraState.value));');
    expect(source).toContain('resolveCamera: () => verticalCameraState.value');
  });

  it('supports pan interaction handlers and template pointer-up wiring', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const cameraPanSession = useCameraPanSession({');
    expect(source).toContain('function handleCanvasPointerUp(event) {');
    expect(source).toContain('function updateCameraPanFromPointer(event) {');
    expect(source).toContain('if (!isCameraTransformEnabled.value && hasInteractiveSchematicTarget(target)) return;');
    expect(source).toContain('panBy: (deltaX, deltaY) => {');
    expect(source).toContain('viewConfigStore.panVerticalCameraBy(deltaX, deltaY);');
    expect(source).toContain('@pointerup="handleCanvasPointerUp"');
    expect(source).toContain('@pointercancel="handleCanvasPointerUp"');
  });

  it('recovers suppressed background clicks on pointerup when the camera session never moved', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const finishResult = cameraPanSession.finishPan(event);');
    expect(source).toContain('if (finishResult?.shouldProcessClick) {');
    expect(source).toContain('handleCanvasBackgroundClick(event);');
  });

  it('skips background click clearing right after a label drag finishes', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const consumedLabelDragClick = labelDrag.consumeFinishedDragClick();');
    expect(source).toContain('if (consumedLabelDragClick) return;');
  });

  it('suppresses post-drag selection toggles before entity click handlers can clear the inspector context', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('function consumeSelectionClickAfterLabelDrag() {');
    expect(source).toContain('if (consumeSelectionClickAfterLabelDrag()) return;');
    expect(source).toContain('consumeSelectClick: consumeSelectionClickAfterLabelDrag');
  });
});
