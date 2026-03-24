import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function resolveSourcePath() {
  return resolve(process.cwd(), 'src/components/schematic/layers/VerticalOverlayLayer.vue');
}

function readSource() {
  return readFileSync(resolveSourcePath(), 'utf8');
}

describe('VerticalOverlayLayer smart-label contract', () => {
  it('computes a shared deterministic overlay state when smart labels are enabled', () => {
    const sourcePath = resolveSourcePath();

    expect(existsSync(sourcePath)).toBe(true);

    const source = readSource();
    expect(source).toContain('const verticalOverlayState = computed(() => {');
    expect(source).toContain('const candidateMap = buildVerticalLayoutCandidateMap(base, layoutBounds);');
    expect(source).toContain('applyDeterministicSmartLabelLayout(candidates, {');
  });

  it('renders all vertical overlay families from verticalOverlayState to keep the shared layout pass authoritative', () => {
    const sourcePath = resolveSourcePath();

    expect(existsSync(sourcePath)).toBe(true);

    const source = readSource();
    expect(source).toContain('v-for="annotation in verticalOverlayState.annotationBandOverlays"');
    expect(source).toContain('v-for="label in verticalOverlayState.pipeLabelOverlays"');
    expect(source).toContain('v-for="label in verticalOverlayState.equipmentLabelOverlays"');
    expect(source).toContain('v-for="fluid in verticalOverlayState.fluidLabelOverlays"');
    expect(source).toContain('v-for="line in verticalOverlayState.horizontalLineOverlays"');
  });
});
