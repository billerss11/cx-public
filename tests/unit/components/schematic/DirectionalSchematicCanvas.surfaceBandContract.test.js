import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/DirectionalSchematicCanvas.vue'), 'utf8');
}

describe('DirectionalSchematicCanvas surface band contract', () => {
  it('uses the shared surface band layout above the directional well without changing the depth scale scene contract', () => {
    const source = readSource();

    expect(source).toContain("import SurfaceFlowBand from './layers/SurfaceFlowBand.vue';");
    expect(source).toContain('const surfaceLayoutModel = computed(() => (');
    expect(source).toContain('const surfaceBandHeightValue = computed(() => surfaceLayoutModel.value.bandHeight || 0);');
    expect(source).toContain('top: baseMargin.top + surfaceBandHeightValue.value');
    expect(source).toContain('<SurfaceFlowBand');
  });
});
