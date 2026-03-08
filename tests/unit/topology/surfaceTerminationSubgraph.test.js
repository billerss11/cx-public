import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';
import {
  createSurfaceAssemblyFromFamily,
  updateSurfaceAssemblyTerminationType,
} from '@/utils/surfaceAssemblyModel.js';

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
    surfaceAssembly: null,
    config: {},
    interaction: {},
  };
}

describe('surface termination subgraph', () => {
  it('falls back to the legacy direct surface sink when no surface assembly exists', () => {
    const result = buildTopologyModel(createBaseState(), {
      requestId: 1,
      wellId: 'surface-fallback',
    });

    expect(result.minFailureCostToSurface).toBe(0);
    expect(
      result.edges.some((edge) => edge.kind === 'termination' && edge.to === 'node:SURFACE')
    ).toBe(true);
  });

  it('routes tubing access through the configured surface termination chain when a surface assembly exists', () => {
    const state = createBaseState();
    state.surfaceAssembly = updateSurfaceAssemblyTerminationType(
      createSurfaceAssemblyFromFamily('conventional-wellhead-stack'),
      'productionOutlet',
      'capped-outlet'
    );

    const result = buildTopologyModel(state, {
      requestId: 2,
      wellId: 'surface-subgraph',
    });

    expect(result.nodes.some((node) => String(node.nodeId).includes('SURFACE_DEVICE'))).toBe(true);
    expect(result.minFailureCostToSurface).toBe(1);
    expect(
      result.minCostPathEdgeIds.some((edgeId) => String(edgeId).includes('surface-termination-slot'))
    ).toBe(true);
  });
});
