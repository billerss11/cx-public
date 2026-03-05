import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSchematicCanvasSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/SchematicCanvas.vue'), 'utf8');
}

describe('SchematicCanvas vertical camera overlay parity contract', () => {
  it('routes cross-section and hover-derived depth mapping through canonical pointer coordinates', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('function resolveCrossSectionDepthFromClient(clientX, clientY) {');
    expect(source).toContain('const pointer = pointerResult?.canonicalPoint;');
    expect(source).toContain('const nextDepth = Number(yScale.value.invert(pointer.y));');
    expect(source).toContain('resolvePointerFromClient: ({ clientX, clientY, localPointer }) => (');
    expect(source).toContain('pointerMapping.resolvePointer({ clientX, clientY })?.canonicalPoint ??');
    expect(source).toContain('invertCameraPoint(localPointer, verticalCameraState.value) ??');
    expect(source).toContain('function resolveFluidTooltipMeta({ index, event }) {');
    expect(source).toContain('const depth = clamp(Number(yScale.value.invert(pointer.y)), minDepth.value, maxDepth.value);');
  });

  it('keeps magnifier overlay bound to transformed scene root via scene use-reference', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const magnifierSceneId = `schematic-scene-${magnifierIdToken}`;');
    expect(source).toContain('<g ref="sceneRootRef" :id="magnifierSceneId" :transform="sceneRootTransform">');
    expect(source).toContain('<g ref="magnifierTransformGroupRef">');
    expect(source).toContain('<use :href="`#${magnifierSceneId}`" />');
  });

  it('anchors tooltip placement from client pointer resolver in container space', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const tooltipPointerResolver = createClientPointerResolver();');
    expect(source).toContain('function resolvePointerPosition(event) {');
    expect(source).toContain('const pointer = tooltipPointerResolver.resolveFromClient(');
    expect(source).toContain('displayWidthValue.value,');
    expect(source).toContain('displayHeightValue.value');
    expect(source).toContain('x: clamp(pointer.x, 0, displayWidthValue.value),');
    expect(source).toContain('y: clamp(pointer.y, 0, displayHeightValue.value)');
  });
});
