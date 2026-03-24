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

    expect(source).toContain("const DIRECTIONAL_VIEWPORT_FIT_MODE_CONTAIN = 'contain';");
    expect(source).toContain("const DIRECTIONAL_VIEWPORT_FIT_MODE_FILL_WIDTH = 'fill-width';");
    expect(source).toContain('const directionalViewportFitMode = computed(() => (');
    expect(source).toContain('const widthRatio = nextContainerWidth / svgWidthValue.value;');
    expect(source).toContain('if (directionalViewportFitMode.value === DIRECTIONAL_VIEWPORT_FIT_MODE_FILL_WIDTH) {');
    expect(source).toContain('return widthRatio;');
    expect(source).toContain('const heightRatio = nextContainerHeight / figHeightValue.value;');
    expect(source).toContain('const containRatio = Math.min(widthRatio, heightRatio);');
    expect(source).toContain('return containRatio;');
  });

  it('derives directional layout from centerline bounds first and then applies visual inset padding for widened geometry', () => {
    const source = readDirectionalSchematicCanvasSource();

    expect(source).toContain('const visualSizingValue = computed(() => (');
    expect(source).toContain('buildDirectionalVisualSizing({');
    expect(source).toContain('const visualInsetPaddingValue = computed(() => (');
    expect(source).toContain('resolveDirectionalVisualInsetPadding({');
    expect(source).toContain('resolveDirectionalSvgWidthFromHeightWithInsets(');
    expect(source).toContain('const plotInsetRangeValue = computed(() => (');
    expect(source).toContain('resolveDirectionalPlotInsetRange(');
    expect(source).toContain(':left-visual-inset-px="visualInsetPaddingValue.left"');
    expect(source).toContain(':right-visual-inset-px="visualInsetPaddingValue.right"');
  });
});
