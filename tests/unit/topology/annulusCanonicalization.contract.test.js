import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';
import { normalizeSourceVolumeKind } from '@/topology/topologyTypes.js';

function createBaseState() {
  return {
    casingData: [
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 9.625,
        weight: 40,
        grade: 'L80',
        top: 0,
        bottom: 5000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner',
        label: 'Inner Casing',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 0,
        bottom: 4500,
        toc: null,
        boc: null,
        show: true
      }
    ],
    tubingData: [],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [],
    trajectory: [],
    config: {
      operationPhase: 'production'
    },
    interaction: {}
  };
}

function collectKindsForAnnulusIndex(nodes = [], annulusIndex = -1) {
  return new Set(
    nodes
      .filter((node) => Number(node?.meta?.annulusIndex) === annulusIndex)
      .map((node) => node.kind)
  );
}

describe('annulus canonicalization contracts', () => {
  it('maps physical annulus slots to canonical ANNULUS_A/ANNULUS_B when tubing is present', () => {
    const state = createBaseState();
    state.tubingData = [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        od: 4.5,
        weight: 12.6,
        top: 0,
        bottom: 3500,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 1, wellId: 'annulus-canonical-with-tubing' });
    const slotZeroKinds = collectKindsForAnnulusIndex(result.nodes, 0);
    const slotOneKinds = collectKindsForAnnulusIndex(result.nodes, 1);

    expect(slotZeroKinds.has('ANNULUS_A')).toBe(true);
    expect(slotOneKinds.has('ANNULUS_B')).toBe(true);
  });

  it('maps physical annulus slot 0 to canonical ANNULUS_A when tubing is absent', () => {
    const result = buildTopologyModel(createBaseState(), { requestId: 2, wellId: 'annulus-canonical-no-tubing' });
    const slotZeroKinds = collectKindsForAnnulusIndex(result.nodes, 0);
    const slotOneKinds = collectKindsForAnnulusIndex(result.nodes, 1);

    expect(slotZeroKinds.has('ANNULUS_A')).toBe(true);
    expect(slotOneKinds.has('ANNULUS_B')).toBe(false);
  });

  it('does not emit TUBING_ANNULUS as a modeled node kind', () => {
    const state = createBaseState();
    state.tubingData = [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        od: 4.5,
        weight: 12.6,
        top: 0,
        bottom: 3500,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 3, wellId: 'annulus-no-tubing-annulus-kind' });
    expect(result.nodes.some((node) => node.kind === 'TUBING_ANNULUS')).toBe(false);
  });

  it('rejects TUBING_ANNULUS and alias source tokens', () => {
    expect(normalizeSourceVolumeKind('TUBING_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('PRIMARY_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('PRODUCTION_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('PROD_ANNULUS')).toBe(null);

    const state = createBaseState();
    state.topologySources = [
      {
        rowId: 'src-legacy-annulus',
        sourceType: 'scenario',
        volumeKey: 'TUBING_ANNULUS',
        top: 1200,
        bottom: 1300,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 4, wellId: 'annulus-legacy-token-reject' });
    const unsupportedWarning = result.validationWarnings.find(
      (warning) => warning.code === 'scenario_source_unsupported_volume'
    );

    expect(result.sourceEntities).toHaveLength(0);
    expect(unsupportedWarning).toBeDefined();
  });
});