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
  it('keeps marker_default without sources when open-hole source mode is disabled', () => {
    const state = createBaseState();

    const result = buildTopologyModel(state, { requestId: 1, wellId: 'open-hole-disabled' });

    expect(result.sourcePolicy?.mode).toBe('marker_default');
    expect(result.sourceEntities).toHaveLength(0);
    expect(result.activeFlowNodeIds).toHaveLength(0);
  });

  it('seeds open-hole source nodes when open-hole source mode is enabled', () => {
    const state = createBaseState();
    state.config = {
      ...state.config,
      topologyUseOpenHoleSource: true
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
});
