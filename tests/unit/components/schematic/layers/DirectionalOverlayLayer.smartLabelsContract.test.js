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

  it('recomputes directional horizon preview geometry through the shared preview helper instead of freezing a group transform', () => {
    const source = readDirectionalOverlaySource();

    expect(source).toContain('function applyDirectionalHorizonLinePreview(items = [], bounds) {');
    expect(source).toContain('applyPreviewToDirectionalLineOverlay(');
    expect(source).toContain('horizontalLineOverlays: applyDirectionalHorizonLinePreview(');
    expect(source).not.toContain(':transform="resolveDepthShiftPreviewTransform(line.id)"');
    expect(source).not.toContain('<g :transform="resolvePreviewTransform(line.id)">');
  });

  it('anchors directional horizon depth-shift drag to the horizon centerline instead of the label box center', () => {
    const source = readDirectionalOverlaySource();

    expect(source).toContain("centerX: line.anchorX");
    expect(source).not.toContain("centerX: line.boxX + (line.boxWidth / 2)");
  });
});
