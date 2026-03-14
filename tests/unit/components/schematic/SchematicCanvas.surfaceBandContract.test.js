import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/SchematicCanvas.vue'), 'utf8');
}

describe('SchematicCanvas surface band contract', () => {
  it('derives a dynamic top margin from the surface layout band height and renders the shared surface band', () => {
    const source = readSource();

    expect(source).toContain("import SurfaceFlowBand from './layers/SurfaceFlowBand.vue';");
    expect(source).toContain('const surfaceLayoutModel = computed(() => (');
    expect(source).toContain('const surfaceBandHeightValue = computed(() => surfaceLayoutModel.value.bandHeight || 0);');
    expect(source).toContain('top: 60 + surfaceBandHeightValue.value');
    expect(source).toContain('<SurfaceFlowBand');
  });
});
