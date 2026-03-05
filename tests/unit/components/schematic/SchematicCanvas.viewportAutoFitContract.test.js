import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSchematicCanvasSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/SchematicCanvas.vue'), 'utf8');
}

describe('SchematicCanvas viewport auto-fit contract', () => {
  it('derives display dimensions from container size without mutating canonical scale dimensions', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const containerClientWidth = ref(0);');
    expect(source).toContain('const containerClientHeight = ref(0);');
    expect(source).toContain('const displayScaleValue = computed(() => {');
    expect(source).toContain('const displayWidthValue = computed(() => Math.round(width.value * displayScaleValue.value));');
    expect(source).toContain('const displayHeightValue = computed(() => Math.round(height.value * displayScaleValue.value));');
    expect(source).toContain(':width="displayWidthValue"');
    expect(source).toContain(':height="displayHeightValue"');
    expect(source).toContain(':viewBox="`0 0 ${width} ${height}`"');
  });

  it('keeps export dimensions bound to canonical scale dimensions through explicit export attributes', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain(':data-export-width="width"');
    expect(source).toContain(':data-export-height="height"');
  });

  it('uses contain-fit scaling so the full vertical viewport remains visible without overflow', () => {
    const source = readSchematicCanvasSource();

    expect(source).toContain('const widthRatio = containerWidth / width.value;');
    expect(source).toContain('const heightRatio = containerHeight / height.value;');
    expect(source).toContain('const containRatio = Math.min(widthRatio, heightRatio);');
    expect(source).toContain('return containRatio;');
  });
});
