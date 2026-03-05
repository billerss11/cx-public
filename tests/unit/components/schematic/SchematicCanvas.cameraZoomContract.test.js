import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSchematicCanvasSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/SchematicCanvas.vue'), 'utf8');
}

describe('SchematicCanvas vertical camera zoom contract', () => {
  it('provides wheel-based zoom handler behind camera migration flags', () => {
    const source = readSchematicCanvasSource();
    const wheelHandlerContract = /function handleCanvasWheel\(event\)\s*\{\s*if \(!isCameraTransformEnabled\.value\) return;\s*if \(isCameraPanActive\.value\) return;\s*const pointerResult = pointerMapping\.resolvePointer\(event\);/s;

    expect(source).toContain('function handleCanvasWheel(event) {');
    expect(source).toContain('if (!isCameraTransformEnabled.value) return;');
    expect(source).toContain('if (isCameraPanActive.value) return;');
    expect(source).toContain('const pointerResult = pointerMapping.resolvePointer(event);');
    expect(wheelHandlerContract.test(source)).toBe(true);
    expect(source).toContain('viewConfigStore.setVerticalCameraZoom(nextScale);');
    expect(source).toContain('viewConfigStore.setVerticalCameraPan({');
    expect(source).toContain('@wheel="handleCanvasWheel"');
  });

  it('keeps zoom clamping and pointer-anchored translation composition in-canvas', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const VERTICAL_WHEEL_ZOOM_SENSITIVITY = 0.0025;');
    expect(source).toContain('const VERTICAL_WHEEL_ZOOM_MIN = 0.25;');
    expect(source).toContain('const VERTICAL_WHEEL_ZOOM_MAX = 4;');
    expect(source).toContain('const nextScale = clampZoom(currentScale + zoomDelta, {');
    expect(source).toContain('const nextTranslateX = pointer.x - (canonicalPoint.x * nextScale);');
    expect(source).toContain('const nextTranslateY = pointer.y - (canonicalPoint.y * nextScale);');
  });
});
