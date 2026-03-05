import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';

function createBaseState() {
  return {
    casingData: [],
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

function collectMarkerEdges(result, rowId) {
  return result.edges.filter((edge) => edge.kind === 'radial' && edge.meta?.markerRowId === rowId);
}

describe('marker leak radial gating semantics', () => {
  it('blocks casing leak radial edges into cemented annulus from active-flow traversal', () => {
    const state = createBaseState();
    state.casingData = [
      {
        rowId: 'csg-1',
        label: 'Surface Casing',
        top: 0,
        bottom: 3000,
        toc: 0,
        boc: 3000,
        od: 9.625,
        weight: 40
      },
      {
        rowId: 'oh-1',
        label: 'Open Hole',
        top: 0,
        bottom: 3000,
        od: 12.25,
        weight: 0,
        grade: 'OH'
      }
    ];
    state.markers = [
      {
        rowId: 'm-cemented-leak',
        type: 'Leak',
        top: 1200,
        bottom: 1205,
        attachToId: 'csg-1',
        attachToHostType: 'casing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 1, wellId: 'cemented-casing-leak' });
    const markerEdges = collectMarkerEdges(result, 'm-cemented-leak');
    const nodeById = new Map(result.nodes.map((node) => [node.nodeId, node]));
    const activeNodeIdSet = new Set(result.activeFlowNodeIds);
    const leakSourceEntity = result.sourceEntities.find((source) => source.rowId === 'm-cemented-leak');

    const blockedAnnulusNodesOnActiveFlow = result.activeFlowNodeIds.filter((nodeId) => {
      const node = nodeById.get(nodeId);
      return node?.kind === 'ANNULUS_A' && node?.meta?.isBlocked === true;
    });
    const activeMarkerEdges = markerEdges.filter((edge) => (
      activeNodeIdSet.has(edge.from) && activeNodeIdSet.has(edge.to)
    ));

    expect(markerEdges.length).toBeGreaterThan(0);
    expect(markerEdges.every((edge) => edge.cost === 1)).toBe(true);
    expect(markerEdges.every((edge) => edge.state === 'closed_failable')).toBe(true);
    expect(markerEdges.every((edge) => edge.reason?.details?.blockedByMaterial === true)).toBe(true);
    expect(blockedAnnulusNodesOnActiveFlow).toHaveLength(0);
    expect(activeMarkerEdges).toHaveLength(0);
    expect(leakSourceEntity).toBeUndefined();
  });

  it('does not create radial leak edges when attach target is unresolved', () => {
    const state = createBaseState();
    state.casingData = [
      { rowId: 'csg-1', label: 'Surface Casing', top: 0, bottom: 3000, od: 9.625, weight: 40 },
      { rowId: 'oh-1', label: 'Open Hole', top: 0, bottom: 3000, od: 12.25, weight: 0, grade: 'OH' }
    ];
    state.markers = [
      {
        rowId: 'm-unresolved-host',
        type: 'Leak',
        top: 1400,
        bottom: 1410,
        attachToHostType: 'casing',
        attachToId: 'missing-host-id',
        attachToRow: 'Missing Host Label',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 2, wellId: 'unresolved-host-leak' });
    const markerEdges = collectMarkerEdges(result, 'm-unresolved-host');
    const unresolvedWarning = result.validationWarnings.find((warning) => warning.code === 'marker_unresolved_host_reference');

    expect(markerEdges).toHaveLength(0);
    expect(unresolvedWarning).toBeDefined();
  });

  it('prefers attachToRow over stale attachToId when resolving casing leak host in topology', () => {
    const state = createBaseState();
    state.casingData = [
      { rowId: 'csg-inner', label: 'Inner Casing', top: 0, bottom: 3000, od: 9.625, weight: 40 },
      { rowId: 'csg-outer', label: 'Outer Casing', top: 0, bottom: 3000, od: 13.375, weight: 54.5 },
      { rowId: 'oh-1', label: 'Open Hole', top: 0, bottom: 3000, od: 17.5, weight: 0, grade: 'OH' }
    ];
    state.markers = [
      {
        rowId: 'm-stale-id',
        type: 'Leak',
        top: 1500,
        bottom: 1510,
        attachToHostType: 'casing',
        attachToId: 'csg-inner',
        attachToRow: 'Outer Casing',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 3, wellId: 'stale-marker-id' });
    const markerEdges = collectMarkerEdges(result, 'm-stale-id');
    const hasOuterHostPair = markerEdges.some((edge) => (
      edge.meta?.fromVolumeKey === 'ANNULUS_A' && edge.meta?.toVolumeKey === 'ANNULUS_B'
    ));
    const hasStaleInnerPair = markerEdges.some((edge) => (
      edge.meta?.fromVolumeKey === 'BORE' && edge.meta?.toVolumeKey === 'ANNULUS_A'
    ));

    expect(markerEdges.length).toBeGreaterThan(0);
    expect(hasOuterHostPair).toBe(true);
    expect(hasStaleInnerPair).toBe(false);
  });
});
