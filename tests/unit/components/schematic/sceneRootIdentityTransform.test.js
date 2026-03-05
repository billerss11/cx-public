import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('schematic scene root transform contract', () => {
  it('keeps an explicit scene root ref + transform binding in vertical canvas', () => {
    const source = readSource('src/components/schematic/SchematicCanvas.vue');

    expect(source).toContain("from '@/utils/svgTransformMath.js';");
    expect(source).toContain('buildCameraTransform');
    expect(source).toContain('const sceneRootRef = ref(null);');
    expect(source).toContain('const verticalCameraState = computed(() => (');
    expect(source).toContain('const sceneRootTransform = computed(() => buildCameraTransform(verticalCameraState.value));');
    expect(source).toContain('<g ref="sceneRootRef" :id="magnifierSceneId" :transform="sceneRootTransform">');
  });

  it('keeps an explicit scene root ref + transform binding in directional canvas', () => {
    const source = readSource('src/components/schematic/DirectionalSchematicCanvas.vue');

    expect(source).toContain("from '@/utils/svgTransformMath.js';");
    expect(source).toContain('buildCameraTransform');
    expect(source).toContain('const sceneRootRef = ref(null);');
    expect(source).toContain('const directionalCameraState = computed(() => (');
    expect(source).toContain('const sceneRootTransform = computed(() => buildCameraTransform(directionalCameraState.value));');
    expect(source).toContain('<g ref="sceneRootRef" :id="magnifierSceneId" :transform="sceneRootTransform">');
  });
});
