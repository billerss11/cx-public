import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDirectionalSchematicCanvasSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/DirectionalSchematicCanvas.vue'), 'utf8');
}

describe('DirectionalSchematicCanvas viewport auto-fit contract', () => {
  it('derives display dimensions from container size without mutating canonical directional dimensions', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const containerWidth = ref(900);');
    expect(source).toContain('const containerHeight = ref(720);');
    expect(source).toContain('const displayScaleValue = computed(() => {');
    expect(source).toContain('const displayWidthValue = computed(() => Math.round(svgWidthValue.value * displayScaleValue.value));');
    expect(source).toContain('const displayHeightValue = computed(() => Math.round(figHeightValue.value * displayScaleValue.value));');
    expect(source).toContain(':width="displayWidthValue"');
    expect(source).toContain(':height="displayHeightValue"');
    expect(source).toContain(':viewBox="`0 0 ${svgWidthValue} ${figHeightValue}`"');
  });

  it('keeps export dimensions bound to canonical directional dimensions through explicit export attributes', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain(':data-export-width="svgWidthValue"');
    expect(source).toContain(':data-export-height="figHeightValue"');
  });

  it('uses contain-fit scaling so directional viewport keeps full graph visibility', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const widthRatio = nextContainerWidth / svgWidthValue.value;');
    expect(source).toContain('const heightRatio = nextContainerHeight / figHeightValue.value;');
    expect(source).toContain('const containRatio = Math.min(widthRatio, heightRatio);');
    expect(source).toContain('return containRatio;');
  });
});
