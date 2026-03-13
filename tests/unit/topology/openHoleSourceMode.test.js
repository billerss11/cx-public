import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';

function createBaseState() {
  return {
    casingData: [
      {
        rowId: 'csg-1',
        label: 'Surface Casing',
        top: 0,
        bottom: 3000,
        od: 9.625,
        weight: 40,
        grade: 'L80',
        show: true
      },
      {
        rowId: 'open-hole-1',
        label: 'Open Hole',
        top: 3000,
        bottom: 4500,
        od: 4.5,
        weight: 0,
        grade: 'OH',
        show: true
      }
    ],
    tubingData: [],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [],
    trajectory: [],
    config: {},
    interaction: {}
  };
}

describe('open-hole source mode', () => {
  it('derives open-hole source nodes by default', () => {
    const state = createBaseState();

    const result = buildTopologyModel(state, { requestId: 1, wellId: 'open-hole-disabled' });
    const openHoleSources = result.sourceEntities.filter((source) => source.origin === 'open-hole-default');

    expect(result.sourcePolicy?.mode).toBe('open_hole_opt_in');
    expect(openHoleSources.length).toBeGreaterThan(0);
    expect(result.activeFlowNodeIds.length).toBeGreaterThan(0);
  });

  it('keeps deriving open-hole source nodes even when the legacy toggle is false', () => {
    const state = createBaseState();
    state.config = {
      ...state.config,
      topologyUseOpenHoleSource: false
    };

    const result = buildTopologyModel(state, { requestId: 2, wellId: 'open-hole-enabled' });
    const openHoleSources = result.sourceEntities.filter((source) => source.origin === 'open-hole-default');

    expect(result.sourcePolicy?.mode).toBe('open_hole_opt_in');
    expect(openHoleSources.length).toBeGreaterThan(0);
    expect(openHoleSources.every((source) => (
      source.volumeKey === 'FORMATION_ANNULUS' || source.volumeKey === 'TUBING_INNER'
    ))).toBe(true);
    expect(result.activeFlowNodeIds.length).toBeGreaterThan(0);
  });

  it('resolves ANNULUS_A scenario source rows against tubing-present first-annulus channels', () => {
    const state = createBaseState();
    state.tubingData = [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        top: 0,
        bottom: 2500,
        od: 4.5,
        weight: 12.6,
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'src-annulus-a',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1000,
        bottom: 1100,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 3, wellId: 'open-hole-canonical-annulus-a' });
    const sourceEntity = result.sourceEntities.find((source) => source.rowId === 'src-annulus-a');
    const noIntervalWarning = result.validationWarnings.find(
      (warning) => warning.code === 'scenario_source_no_resolvable_interval'
    );

    expect(sourceEntity).toBeDefined();
    expect(sourceEntity?.volumeKey).toBe('ANNULUS_A');
    expect((sourceEntity?.nodeIds?.length ?? 0) > 0).toBe(true);
    expect(noIntervalWarning).toBeUndefined();
  });
});
