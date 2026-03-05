import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';

function createBaseState() {
  return {
    casingData: [{ rowId: 'csg-1', label: 'Surface Casing', top: 0, bottom: 3000, od: 9.625, weight: 40 }],
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

describe('tubing leak topology semantics', () => {
  it('creates tubing leak radial edges only when tubing host exists at depth', () => {
    const state = createBaseState();
    state.tubingData = [{ rowId: 'tbg-1', label: 'Production Tubing', top: 0, bottom: 2500, od: 4.5, weight: 12 }];
    state.markers = [
      {
        rowId: 'm-tbg-leak',
        type: 'Leak',
        top: 1200,
        bottom: 1205,
        attachToId: 'tbg-1',
        attachToHostType: 'tubing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 1, wellId: 'tubing-leak-host-valid' });
    const markerEdges = result.edges.filter((edge) => edge.kind === 'radial' && edge.meta?.markerRowId === 'm-tbg-leak');
    const invalidHostWarning = result.validationWarnings.find((warning) => warning.code === 'marker_invalid_tubing_host_at_depth');
    const leakSourceEntity = result.sourceEntities.find((source) => source.rowId === 'm-tbg-leak');

    expect(markerEdges.length).toBeGreaterThan(0);
    expect(markerEdges.every((edge) => edge.reason?.details?.markerHostType === 'tubing')).toBe(true);
    expect(invalidHostWarning).toBeUndefined();
    expect(leakSourceEntity).toBeUndefined();
    expect(result.activeFlowNodeIds).toEqual([]);
  });

  it('emits deterministic warning when tubing leak marker host is invalid at marker depth', () => {
    const state = createBaseState();
    state.tubingData = [{ rowId: 'tbg-1', label: 'Production Tubing', top: 0, bottom: 900, od: 4.5, weight: 12 }];
    state.markers = [
      {
        rowId: 'm-invalid-tbg-leak',
        type: 'Leak',
        top: 1200,
        bottom: 1205,
        attachToId: 'tbg-1',
        attachToHostType: 'tubing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 2, wellId: 'tubing-leak-host-invalid' });
    const markerEdges = result.edges.filter((edge) => edge.kind === 'radial' && edge.meta?.markerRowId === 'm-invalid-tbg-leak');
    const invalidHostWarning = result.validationWarnings.find((warning) => warning.code === 'marker_invalid_tubing_host_at_depth');

    expect(markerEdges).toHaveLength(0);
    expect(invalidHostWarning).toBeDefined();
  });

  it('treats point leak markers as resolvable when depth is inside host interval', () => {
    const state = createBaseState();
    state.tubingData = [{ rowId: 'tbg-1', label: 'Production Tubing', top: 0, bottom: 2500, od: 4.5, weight: 12 }];
    state.markers = [
      {
        rowId: 'm-point-leak-inside',
        type: 'Leak',
        top: 1200,
        bottom: 1200,
        attachToId: 'tbg-1',
        attachToHostType: 'tubing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 3, wellId: 'tubing-leak-point-inside' });
    const markerEdges = result.edges.filter((edge) => edge.kind === 'radial' && edge.meta?.markerRowId === 'm-point-leak-inside');
    const overlapWarning = result.validationWarnings.find((warning) => warning.code === 'marker_no_resolvable_interval_overlap');
    const leakSourceEntity = result.sourceEntities.find((source) => source.rowId === 'm-point-leak-inside');

    expect(markerEdges.length).toBeGreaterThan(0);
    expect(overlapWarning).toBeUndefined();
    expect(leakSourceEntity).toBeUndefined();
    expect(result.activeFlowNodeIds).toEqual([]);
  });

  it('treats point leak markers as resolvable on host boundary depth', () => {
    const state = createBaseState();
    state.tubingData = [{ rowId: 'tbg-1', label: 'Production Tubing', top: 0, bottom: 2500, od: 4.5, weight: 12 }];
    state.markers = [
      {
        rowId: 'm-point-leak-boundary',
        type: 'Leak',
        top: 2500,
        bottom: 2500,
        attachToId: 'tbg-1',
        attachToHostType: 'tubing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 4, wellId: 'tubing-leak-point-boundary' });
    const markerEdges = result.edges.filter((edge) => edge.kind === 'radial' && edge.meta?.markerRowId === 'm-point-leak-boundary');
    const overlapWarning = result.validationWarnings.find((warning) => warning.code === 'marker_no_resolvable_interval_overlap');
    const leakSourceEntity = result.sourceEntities.find((source) => source.rowId === 'm-point-leak-boundary');

    expect(markerEdges.length).toBeGreaterThan(0);
    expect(overlapWarning).toBeUndefined();
    expect(leakSourceEntity).toBeUndefined();
    expect(result.activeFlowNodeIds).toEqual([]);
  });
});
