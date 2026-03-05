import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSchematicCanvasSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/schematic/SchematicCanvas.vue'),
    'utf8'
  );
}

function extractSchematicCanvasStyleBlock(source) {
  const match = source.match(/\.schematic-canvas\s*\{[\s\S]*?\}/);
  return match ? match[0] : '';
}

describe('SchematicCanvas scroll container style', () => {
  it('keeps container height independent from figHeight to preserve inner scrolling', () => {
    const source = readSchematicCanvasSource();
    const styleBlock = extractSchematicCanvasStyleBlock(source);

    expect(styleBlock).toContain('overflow: auto;');
    expect(styleBlock).toContain('height: 100%;');
    expect(styleBlock).not.toContain('height: v-bind(figHeightCss);');
  });
});

