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
        show: true,
      },
    ],
    tubingData: [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        top: 0,
        bottom: 2800,
        od: 4.5,
        weight: 12.6,
        show: true,
      },
    ],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [
      {
        rowId: 'src-1',
        sourceType: 'scenario',
        volumeKey: 'TUBING_INNER',
        top: 1500,
        bottom: 1520,
        show: true,
      },
    ],
    trajectory: [],
    config: {},
    interaction: {},
  };
}

describe('direct surface termination edges', () => {
  it('connects top-interval volume nodes directly to node:SURFACE', () => {
    const result = buildTopologyModel(createBaseState(), {
      requestId: 1,
      wellId: 'direct-surface-fallback',
    });

    const terminationEdges = result.edges.filter((edge) => edge.kind === 'termination');
    expect(terminationEdges.length).toBeGreaterThan(0);
    expect(terminationEdges.every((edge) => edge.to === 'node:SURFACE')).toBe(true);
    expect(
      terminationEdges.every((edge) => result.edgeReasons[edge.edgeId]?.ruleId === 'surface-termination')
    ).toBe(true);
    expect(result.nodes.some((node) => String(node.nodeId).includes('SURFACE_'))).toBe(false);
    expect(result.minFailureCostToSurface).toBe(0);
  });

  it('ignores legacy removed-surface payloads and keeps fallback behavior unchanged', () => {
    const baselineState = createBaseState();
    const legacyState = {
      ...createBaseState(),
      surfaceAssembly: {
        familyKey: 'legacy-ignored',
        entryPaths: [{ roleKey: 'TUBING_BORE', sourceVolumeKey: 'TUBING_INNER' }],
      },
    };

    const baseline = buildTopologyModel(baselineState, {
      requestId: 2,
      wellId: 'direct-surface-baseline',
    });
    const withLegacyField = buildTopologyModel(legacyState, {
      requestId: 3,
      wellId: 'direct-surface-legacy-ignored',
    });

    const baselineTerminationEdgeIds = baseline.edges
      .filter((edge) => edge.kind === 'termination')
      .map((edge) => edge.edgeId)
      .sort();
    const legacyTerminationEdgeIds = withLegacyField.edges
      .filter((edge) => edge.kind === 'termination')
      .map((edge) => edge.edgeId)
      .sort();

    expect(withLegacyField.nodes.some((node) => String(node.nodeId).includes('SURFACE_'))).toBe(false);
    expect(withLegacyField.minFailureCostToSurface).toBe(baseline.minFailureCostToSurface);
    expect(legacyTerminationEdgeIds).toEqual(baselineTerminationEdgeIds);
  });
});
