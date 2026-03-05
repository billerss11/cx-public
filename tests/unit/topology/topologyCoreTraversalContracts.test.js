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
});
