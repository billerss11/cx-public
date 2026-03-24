import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/schematic/layers/SurfaceFlowBand.vue'), 'utf8');
}

describe('SurfaceFlowBand contract', () => {
  it('does not intercept pointer events when painted above the schematic scene', () => {
    const source = readSource();

    expect(source).toContain('.surface-flow-band {');
    expect(source).toContain('pointer-events: none;');
  });
});
