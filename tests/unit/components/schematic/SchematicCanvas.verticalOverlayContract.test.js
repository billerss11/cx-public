import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/SchematicCanvas.vue'), 'utf8');
}

describe('SchematicCanvas vertical overlay contract', () => {
  it('routes label and callout families through the shared vertical overlay layer', () => {
    const source = readSource();

    expect(source).toContain("import VerticalOverlayLayer from './layers/VerticalOverlayLayer.vue';");
    expect(source).toContain('<VerticalOverlayLayer');
    expect(source).toContain(':surface-band-height="surfaceBandHeightValue"');
    expect(source).not.toContain('<AnnotationLayer');
    expect(source).not.toContain('<CasingLabelLayer');
    expect(source).not.toContain('<FluidLabelLayer');
    expect(source).not.toContain('<HorizontalLineLayer');
  });

  it('disables EquipmentLayer label rendering once the shared overlay layer owns labels', () => {
    const source = readSource();

    expect(source).toContain('<EquipmentLayer');
    expect(source).toContain(':show-labels="false"');
  });
});
