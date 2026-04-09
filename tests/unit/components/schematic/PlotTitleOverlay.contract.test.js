import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('plot title overlay contract', () => {
  it('renders the vertical plot title outside the scene root so geometry cannot cover it', () => {
    const source = readSource('src/components/schematic/SchematicCanvas.vue');
    const sceneRootIndex = source.indexOf('<g ref="sceneRootRef"');
    const titleIndex = source.indexOf('class="schematic-canvas__plot-title"');

    expect(source).not.toContain(':title-text="plotTitle"');
    expect(sceneRootIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeGreaterThan(sceneRootIndex);
    expect(source).toContain('top: 60 + plotTitleBandHeight.value');
  });

  it('renders the directional plot title outside the scene root and keeps directional top margin compact', () => {
    const canvasSource = readSource('src/components/schematic/DirectionalSchematicCanvas.vue');
    const sizingSource = readSource('src/utils/directionalSizing.js');
    const sceneRootIndex = canvasSource.indexOf('<g ref="sceneRootRef"');
    const titleIndex = canvasSource.indexOf('class="schematic-canvas__plot-title"');

    expect(canvasSource).not.toContain(':title-text="plotTitle"');
    expect(sceneRootIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeGreaterThan(sceneRootIndex);
    expect(canvasSource).toContain('top: baseMargin.top + plotTitleBandHeight.value');
    expect(sizingSource).toContain('top: 18');
  });
});
