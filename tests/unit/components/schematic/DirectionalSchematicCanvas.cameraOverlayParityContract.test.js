import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDirectionalSchematicCanvasSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/DirectionalSchematicCanvas.vue'), 'utf8');
}

describe('DirectionalSchematicCanvas camera overlay parity contract', () => {
  it('routes cross-section and hover-derived depth mapping through canonical pointer coordinates', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('function resolveCrossSectionDepthFromClient(clientX, clientY) {');
    expect(source).toContain('const pointer = pointerResult?.canonicalPoint;');
    expect(source).toContain('const nearestMD = Number(resolveNearestMDFromPointer(pointer));');
    expect(source).toContain('const crossSectionDepthInteraction = useCrossSectionDepthInteraction({');
    expect(source).toContain('resolveDepthFromClient: resolveCrossSectionDepthFromClient,');
    expect(source).toContain('resolvePointerFromClient: ({ localPointer }) => (');
    expect(source).toContain('invertCameraPoint(localPointer, directionalCameraState.value) ?? localPointer');
    expect(source).toContain('function resolveFluidTooltipMeta({ index, event }) {');
    expect(source).toContain('const depth = Number(resolveNearestMDFromPointer(pointer));');
  });

  it('locks cross-section depth from transformed pointer mapping before background-selection fallback', () => {
    const source = readDirectionalSchematicCanvasSource();
    const lockContract = /function handleCanvasBackgroundClick\(event\)\s*\{\s*if \(crossSectionVisible\.value\) \{\s*crossSectionDepthInteraction\.lockDepthFromEvent\(event\);\s*\}\s*if \(hasInteractiveSchematicTarget\(event\?\.target\)\) return;/s;

    expect(source).toContain('function handleCanvasBackgroundClick(event) {');
    expect(source).toContain('crossSectionDepthInteraction.lockDepthFromEvent(event);');
    expect(lockContract.test(source)).toBe(true);
  });

  it('keeps magnifier overlay bound to transformed scene root via scene use-reference', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const magnifierSceneId = `directional-scene-${magnifierIdToken}`;');
    expect(source).toContain('<g ref="sceneRootRef" :id="magnifierSceneId" :transform="sceneRootTransform">');
    expect(source).toContain('<g ref="magnifierTransformGroupRef">');
    expect(source).toContain('<use :href="`#${magnifierSceneId}`" />');
  });

  it('anchors tooltip placement from client pointer resolver in container space', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const tooltipPointerResolver = createClientPointerResolver();');
    expect(source).toContain('function resolvePointerPosition(event) {');
    expect(source).toContain('const pointer = tooltipPointerResolver.resolveFromClient(');
    expect(source).toContain('x: clamp(pointer.x, 0, displayWidthValue.value),');
    expect(source).toContain('y: clamp(pointer.y, 0, displayHeightValue.value)');
  });

  it('keeps depth-cursor MD/TVD mode resolution camera-aware under transformed pointers', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const depthCursorDirectionalMode = computed(() => (');
    expect(source).toContain("props.config?.depthCursorDirectionalMode === 'md' ? 'md' : 'tvd'");
    expect(source).toContain('resolveDepth: (pointer) => {');
    expect(source).toContain("if (depthCursorDirectionalMode.value === 'md') {");
    expect(source).toContain('return resolveNearestMDFromPointer(pointer);');
    expect(source).toContain('return tvd;');
  });

  it('consumes directional fit-to-data requests and executes forced smart auto-fit', () => {
    const source = readDirectionalSchematicCanvasSource();
    const fitRequestWatchContract = /const directionalFitToDataRequestCount = computed\(\(\) => \(\s*Number\(viewConfigStore\.uiState\?\.directionalFitToDataRequestCount\)\s*\|\|\s*0\s*\)\);[\s\S]*watch\(directionalFitToDataRequestCount,\s*async \(nextCount, previousCount\) => \{[\s\S]*await nextTick\(\);[\s\S]*executeSmartAutoFit\(\{ force: true \}\);/s;

    expect(source).toContain('const directionalFitToDataRequestCount = computed(() => (');
    expect(source).toContain('Number(viewConfigStore.uiState?.directionalFitToDataRequestCount) || 0');
    expect(source).toContain('watch(directionalFitToDataRequestCount, async (nextCount, previousCount) => {');
    expect(source).toContain('executeSmartAutoFit({ force: true });');
    expect(fitRequestWatchContract.test(source)).toBe(true);
  });
});
