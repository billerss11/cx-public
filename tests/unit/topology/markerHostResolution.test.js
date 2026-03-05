import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';

function buildBaseState() {
  return {
    casingData: [{ rowId: 'csg-1', label: 'Surface Casing', top: 0, bottom: 3000, od: 9.625, weight: 40 }],
    tubingData: [{ rowId: 'tbg-1', label: 'Production Tubing', top: 0, bottom: 2500, od: 4.5, weight: 12 }],
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

describe('marker host resolution', () => {
  it('accepts tubing rowId as marker host reference', () => {
    const state = buildBaseState();
    state.markers = [
      {
        rowId: 'm-1',
        type: 'Leak',
        top: 1200,
        bottom: 1205,
        attachToId: 'tbg-1',
        attachToHostType: 'tubing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 1, wellId: 'test' });
    const hostWarning = result.validationWarnings.find((warning) => warning.code === 'marker_unresolved_host_reference');

    expect(hostWarning).toBeUndefined();
  });

  it('keeps legacy marker rows casing-compatible when attachToHostType is missing', () => {
    const state = buildBaseState();
    state.markers = [
      {
        rowId: 'm-legacy',
        type: 'Perforation',
        top: 800,
        bottom: 810,
        attachToId: 'csg-1',
        attachToRow: 'Surface Casing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 2, wellId: 'legacy-test' });
    const hostWarning = result.validationWarnings.find((warning) => warning.code === 'marker_unresolved_host_reference');

    expect(hostWarning).toBeUndefined();
  });

  it('routes middle-casing marker radial connectivity across adjacent annuli', () => {
    const state = buildBaseState();
    state.casingData = [
      { rowId: 'csg-outer', label: 'Outer', top: 0, bottom: 3000, od: 16, weight: 58 },
      { rowId: 'csg-middle', label: 'Middle', top: 0, bottom: 3000, od: 13.375, weight: 54.5 },
      { rowId: 'csg-inner', label: 'Inner', top: 0, bottom: 3000, od: 9.625, weight: 40 }
    ];
    state.tubingData = [];
    state.markers = [
      {
        rowId: 'm-middle-casing-perf',
        type: 'Perforation',
        top: 1200,
        bottom: 1205,
        attachToId: 'csg-middle',
        attachToHostType: 'casing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 3, wellId: 'middle-casing-test' });
    const markerEdges = result.edges.filter((edge) => edge.kind === 'radial' && edge.meta?.markerRowId === 'm-middle-casing-perf');
    const hasBoreRadialEdge = markerEdges.some((edge) => (
      edge.meta?.fromVolumeKey === 'BORE' || edge.meta?.toVolumeKey === 'BORE'
    ));
    const hasAnnulusABPair = markerEdges.some((edge) => (
      edge.meta?.fromVolumeKey === 'ANNULUS_A' && edge.meta?.toVolumeKey === 'ANNULUS_B'
    ));

    expect(markerEdges.length).toBeGreaterThan(0);
    expect(hasBoreRadialEdge).toBe(false);
    expect(hasAnnulusABPair).toBe(true);
  });
});
