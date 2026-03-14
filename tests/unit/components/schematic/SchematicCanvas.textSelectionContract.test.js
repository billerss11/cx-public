import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function expectNonSelectableSvgText(source) {
  expect(source).toContain('.schematic-canvas__svg :deep(text),');
  expect(source).toContain('.schematic-canvas__svg :deep(tspan)');
  expect(source).toContain('user-select: none;');
  expect(source).toContain('-webkit-user-select: none;');
}

describe('schematic canvas SVG text selection contract', () => {
  it('disables text selection for vertical schematic SVG labels', () => {
    const source = readSource('src/components/schematic/SchematicCanvas.vue');

    expectNonSelectableSvgText(source);
  });

  it('disables text selection for directional schematic SVG labels', () => {
    const source = readSource('src/components/schematic/DirectionalSchematicCanvas.vue');

    expectNonSelectableSvgText(source);
  });
});
