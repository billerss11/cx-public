import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDirectionalOverlaySource() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/schematic/layers/DirectionalOverlayLayer.vue'),
    'utf8'
  );
}

describe('DirectionalOverlayLayer smart-label contract', () => {
  it('computes a shared deterministic overlay state when smart labels are enabled', () => {
    const source = readDirectionalOverlaySource();

    expect(source).toContain('const directionalOverlayState = computed(() => {');
    expect(source).toContain('const candidateMap = buildDirectionalLayoutCandidateMap(base, bounds);');
    expect(source).toContain('applyDeterministicSmartLabelLayout(candidates, {');
  });

  it('renders all overlay families from directionalOverlayState to keep layout pass authoritative', () => {
    const source = readDirectionalOverlaySource();

    expect(source).toContain('v-for="annotation in directionalOverlayState.annotationBandOverlays"');
    expect(source).toContain('v-for="plug in directionalOverlayState.plugLabelOverlays"');
    expect(source).toContain('v-for="fluid in directionalOverlayState.fluidLabelOverlays"');
    expect(source).toContain('v-for="item in directionalOverlayState.depthAnnotations"');
    expect(source).toContain('v-for="label in directionalOverlayState.casingLabelOverlays"');
    expect(source).toContain('v-for="label in directionalOverlayState.transientPipeLabelOverlays"');
    expect(source).toContain('v-for="label in directionalOverlayState.equipmentLabelOverlays"');
    expect(source).toContain('v-for="line in directionalOverlayState.horizontalLineOverlays"');
  });
});
