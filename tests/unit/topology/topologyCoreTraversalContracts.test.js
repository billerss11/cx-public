import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';

describe('topologyCore traversal contracts', () => {
  it('exposes explicit algorithm traversal contracts in topology output', () => {
    const result = buildTopologyModel({
      casingData: [
        {
          rowId: 'casing-1',
          label: 'Surface Casing',
          od: 9.625,
          weight: 40,
          grade: 'L80',
          top: 0,
          bottom: 10000,
          show: true
        }
      ],
      markers: [],
      annulusFluids: [],
      topologySources: [],
      equipmentData: []
    });

    expect(result.traversalContracts?.activeFlow?.edgeDirectionsByKind?.termination).toBe('forward');
    expect(result.traversalContracts?.activeFlow?.sinkNodeIds).toContain('node:SURFACE');
    expect(result.traversalContracts?.minimumFailure?.edgeDirectionsByKind?.termination).toBe('forward');
    expect(result.traversalContracts?.minimumFailure?.sinkNodeIds).toEqual([]);
  });

  it('emits annulus channel identity metadata for canonical annulus nodes', () => {
    const result = buildTopologyModel({
      casingData: [
        {
          rowId: 'casing-outer',
          label: 'Surface Casing',
          od: 9.625,
          weight: 40,
          grade: 'L80',
          top: 0,
          bottom: 10000,
          show: true
        },
        {
          rowId: 'casing-inner',
          label: 'Intermediate Casing',
          od: 7,
          weight: 29,
          grade: 'L80',
          top: 0,
          bottom: 8000,
          show: true
        }
      ],
      tubingData: [
        {
          rowId: 'tbg-1',
          label: 'Production Tubing',
          od: 4.5,
          weight: 12.6,
          top: 1000,
          bottom: 2000,
          show: true
        }
      ],
      markers: [],
      annulusFluids: [],
      topologySources: [],
      equipmentData: []
    });

    const annulusANodeInTubingSection = result.nodes.find((node) => (
      node.kind === 'ANNULUS_A'
      && Number(node.depthTop) >= 1000
      && Number(node.depthBottom) <= 2000
    ));

    expect(annulusANodeInTubingSection).toBeDefined();
    expect(annulusANodeInTubingSection?.meta?.innerPipeType).toBe('tubing');
    expect(annulusANodeInTubingSection?.meta?.innerPipeRowId).toBe('tbg-1');
    expect(annulusANodeInTubingSection?.meta).toHaveProperty('outerPipeType');
    expect(annulusANodeInTubingSection?.meta).toHaveProperty('outerPipeRowId');
  });
});