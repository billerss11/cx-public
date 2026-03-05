import { describe, expect, it } from 'vitest';
import {
  computeActiveFlowNodeIds,
  computeMinimumFailurePath,
  computeSpofEdgeIds
} from '@/topology/pathAlgorithms.js';

describe('pathAlgorithms', () => {
  it('marks all reachable nodes as active flow nodes', () => {
    const edges = [
      { edgeId: 'edge:a-b', from: 'node:A', to: 'node:B', cost: 0 },
      { edgeId: 'edge:b-c', from: 'node:B', to: 'node:C', cost: 1 },
      { edgeId: 'edge:a-c', from: 'node:A', to: 'node:C', cost: 0 }
    ];

    expect(computeActiveFlowNodeIds(['node:A'], edges)).toEqual(['node:A', 'node:B', 'node:C']);
  });

  it('treats surface as sink-only for active-flow traversal', () => {
    const edges = [
      { edgeId: 'edge:a-surface', from: 'node:A', to: 'node:SURFACE', cost: 0, kind: 'termination' },
      { edgeId: 'edge:b-surface', from: 'node:B', to: 'node:SURFACE', cost: 0, kind: 'termination' }
    ];

    expect(computeActiveFlowNodeIds(['node:A'], edges)).toEqual(['node:A', 'node:SURFACE']);
  });

  it('prefers zero-cost route when one exists', () => {
    const edges = [
      { edgeId: 'edge:a-b', from: 'node:A', to: 'node:B', cost: 0 },
      { edgeId: 'edge:b-c', from: 'node:B', to: 'node:C', cost: 1 },
      { edgeId: 'edge:a-c', from: 'node:A', to: 'node:C', cost: 0 }
    ];

    const result = computeMinimumFailurePath(['node:A'], 'node:C', edges);

    expect(result.minFailureCostToSurface).toBe(0);
    expect(result.minCostPathEdgeIds).toEqual(['edge:a-c']);
    expect(computeSpofEdgeIds(result.minFailureCostToSurface, result.minCostPathEdgeIds, new Map())).toEqual([]);
  });

  it('returns sealed edge as SPOF when minimum path requires one failure', () => {
    const edges = [
      { edgeId: 'edge:a-b', from: 'node:A', to: 'node:B', cost: 0 },
      { edgeId: 'edge:b-c', from: 'node:B', to: 'node:C', cost: 1 }
    ];

    const result = computeMinimumFailurePath(['node:A'], 'node:C', edges);
    const spofEdgeIds = computeSpofEdgeIds(
      result.minFailureCostToSurface,
      result.minCostPathEdgeIds,
      new Map(edges.map((edge) => [edge.edgeId, edge]))
    );

    expect(result.minFailureCostToSurface).toBe(1);
    expect(result.minCostPathEdgeIds).toEqual(['edge:a-b', 'edge:b-c']);
    expect(spofEdgeIds).toEqual(['edge:b-c']);
  });

  it('keeps source-to-surface intent by default for minimum-failure traversal', () => {
    const edges = [
      { edgeId: 'edge:a-surface', from: 'node:A', to: 'node:SURFACE', cost: 0, kind: 'termination' }
    ];

    const result = computeMinimumFailurePath(['node:SURFACE'], 'node:A', edges);

    expect(result.minFailureCostToSurface).toBe(null);
    expect(result.minCostPathEdgeIds).toEqual([]);
  });

  it('applies explicit traversal-direction overrides for minimum-failure traversal', () => {
    const edges = [
      { edgeId: 'edge:a-b', from: 'node:A', to: 'node:B', cost: 0, kind: 'vertical' }
    ];

    const result = computeMinimumFailurePath(['node:A'], 'node:B', edges, {
      traversalPolicy: {
        defaultEdgeDirection: 'reverse'
      }
    });

    expect(result.minFailureCostToSurface).toBe(null);
    expect(result.minCostPathEdgeIds).toEqual([]);
  });
});
