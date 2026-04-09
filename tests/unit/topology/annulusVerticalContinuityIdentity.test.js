import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';

function createBoundaryState() {
  return {
    casingData: [
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 9.625,
        weight: 40,
        grade: 'L80',
        top: 0,
        bottom: 5000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner',
        label: 'Inner Casing',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 0,
        bottom: 4500,
        toc: null,
        boc: null,
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
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [],
    trajectory: [],
    config: {
      operationPhase: 'production'
    },
    interaction: {}
  };
}

function isBoundaryEdge(fromNode, toNode, boundaryDepth, epsilon = 1e-6) {
  const fromBottom = Number(fromNode?.depthBottom);
  const toTop = Number(toNode?.depthTop);
  if (!Number.isFinite(fromBottom) || !Number.isFinite(toTop)) return false;
  return Math.abs(fromBottom - boundaryDepth) <= epsilon && Math.abs(toTop - boundaryDepth) <= epsilon;
}

describe('annulus continuity identity contracts', () => {
  it('suppresses ANNULUS_A -> ANNULUS_A vertical continuity across tubing entry/exit boundaries', () => {
    const result = buildTopologyModel(createBoundaryState(), { requestId: 11, wellId: 'annulus-boundary-continuity' });
    const nodeById = new Map(result.nodes.map((node) => [node.nodeId, node]));
    const boundaryDepths = [1000, 2000];

    const invalidContinuityEdges = result.edges.filter((edge) => {
      if (edge.reason?.ruleId !== 'vertical-continuity') return false;
      const fromNode = nodeById.get(edge.from);
      const toNode = nodeById.get(edge.to);
      if (fromNode?.kind !== 'ANNULUS_A' || toNode?.kind !== 'ANNULUS_A') return false;
      return boundaryDepths.some((boundaryDepth) => isBoundaryEdge(fromNode, toNode, boundaryDepth));
    });

    expect(invalidContinuityEdges).toHaveLength(0);
  });

  it('emits ANNULUS_A -> ANNULUS_B and ANNULUS_B -> ANNULUS_A transitions at tubing boundaries', () => {
    const result = buildTopologyModel(createBoundaryState(), { requestId: 12, wellId: 'annulus-boundary-transition' });
    const nodeById = new Map(result.nodes.map((node) => [node.nodeId, node]));

    const transitionPairs = result.edges
      .map((edge) => {
        const fromNode = nodeById.get(edge.from);
        const toNode = nodeById.get(edge.to);
        return `${fromNode?.kind ?? ''}->${toNode?.kind ?? ''}`;
      });

    expect(transitionPairs).toContain('ANNULUS_A->ANNULUS_B');
    expect(transitionPairs).toContain('ANNULUS_B->ANNULUS_A');
  });
});