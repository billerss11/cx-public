import { describe, expect, it } from 'vitest';
import {
  createTopologyInspectorEdgeRows,
  createTopologyInspectorNodeRows,
  createTopologyPathEdgeSummaryRows,
  resolveTopologyInspectorOverlayNodeIds,
  resolveTopologyInspectorScopeEdgeIds
} from '@/topology/topologyInspector.js';

const TOPOLOGY_RESULT_FIXTURE = Object.freeze({
  nodes: [
    { nodeId: 'node:SURFACE', kind: 'SURFACE', depthTop: null, depthBottom: null },
    { nodeId: 'node:ANNULUS_A:0:1000', kind: 'ANNULUS_A', depthTop: 0, depthBottom: 1000 },
    { nodeId: 'node:ANNULUS_A:1000:2000', kind: 'ANNULUS_A', depthTop: 1000, depthBottom: 2000 },
    { nodeId: 'node:ANNULUS_B:1000:2000', kind: 'ANNULUS_B', depthTop: 1000, depthBottom: 2000 }
  ],
  edges: [
    {
      edgeId: 'edge:vertical:a0-a1',
      kind: 'vertical',
      cost: 0,
      from: 'node:ANNULUS_A:0:1000',
      to: 'node:ANNULUS_A:1000:2000'
    },
    {
      edgeId: 'edge:radial:a1-b1',
      kind: 'radial',
      cost: 1,
      from: 'node:ANNULUS_A:1000:2000',
      to: 'node:ANNULUS_B:1000:2000'
    },
    {
      edgeId: 'edge:termination:a0-surface',
      kind: 'termination',
      cost: 0,
      from: 'node:ANNULUS_A:0:1000',
      to: 'node:SURFACE'
    }
  ],
  activeFlowNodeIds: ['node:ANNULUS_A:0:1000', 'node:ANNULUS_A:1000:2000', 'node:SURFACE'],
  minCostPathEdgeIds: ['edge:vertical:a0-a1', 'edge:termination:a0-surface'],
  spofEdgeIds: ['edge:radial:a1-b1'],
  edgeReasons: {
    'edge:radial:a1-b1': {
      ruleId: 'marker-leak',
      summary: 'Tubing-host leak marker creates radial communication.'
    }
  }
});

describe('topologyInspector', () => {
  it('resolves scope edge ids by topology scope', () => {
    expect(resolveTopologyInspectorScopeEdgeIds(TOPOLOGY_RESULT_FIXTURE, 'all', []))
      .toEqual([
        'edge:vertical:a0-a1',
        'edge:radial:a1-b1',
        'edge:termination:a0-surface'
      ]);

    expect(resolveTopologyInspectorScopeEdgeIds(TOPOLOGY_RESULT_FIXTURE, 'min_path', []))
      .toEqual(['edge:vertical:a0-a1', 'edge:termination:a0-surface']);

    expect(resolveTopologyInspectorScopeEdgeIds(TOPOLOGY_RESULT_FIXTURE, 'spof', []))
      .toEqual(['edge:radial:a1-b1']);

    expect(resolveTopologyInspectorScopeEdgeIds(
      TOPOLOGY_RESULT_FIXTURE,
      'selected_barrier',
      ['edge:radial:a1-b1']
    )).toEqual(['edge:radial:a1-b1']);

    expect(resolveTopologyInspectorScopeEdgeIds(TOPOLOGY_RESULT_FIXTURE, 'active_flow', []))
      .toEqual(['edge:vertical:a0-a1', 'edge:termination:a0-surface']);
  });

  it('builds edge rows with reason metadata and topology flags', () => {
    const rows = createTopologyInspectorEdgeRows(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'all',
      selectedBarrierEdgeIds: []
    });

    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({
      edgeId: 'edge:radial:a1-b1',
      kind: 'radial',
      cost: 1,
      fromNodeId: 'node:ANNULUS_A:1000:2000',
      toNodeId: 'node:ANNULUS_B:1000:2000',
      ruleId: 'marker-leak',
      reasonSummary: 'Tubing-host leak marker creates radial communication.',
      isOnMinPath: false,
      isSpof: true
    });
  });

  it('builds node rows from selected scope edges', () => {
    const minPathNodeRows = createTopologyInspectorNodeRows(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'min_path',
      selectedBarrierEdgeIds: []
    });

    expect(minPathNodeRows.map((row) => row.nodeId)).toEqual([
      'node:ANNULUS_A:0:1000',
      'node:ANNULUS_A:1000:2000',
      'node:SURFACE'
    ]);

    const barrierNodeRows = createTopologyInspectorNodeRows(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'selected_barrier',
      selectedBarrierEdgeIds: ['edge:radial:a1-b1']
    });

    expect(barrierNodeRows.map((row) => row.nodeId)).toEqual([
      'node:ANNULUS_A:1000:2000',
      'node:ANNULUS_B:1000:2000'
    ]);
  });

  it('merges barrier and inspector selections into overlay node ids', () => {
    expect(resolveTopologyInspectorOverlayNodeIds({
      topologyResult: TOPOLOGY_RESULT_FIXTURE,
      selectedBarrierNodeIds: ['node:ANNULUS_B:1000:2000'],
      selectedInspectorNodeId: 'node:ANNULUS_A:0:1000',
      selectedInspectorEdgeId: 'edge:radial:a1-b1'
    })).toEqual([
      'node:ANNULUS_B:1000:2000',
      'node:ANNULUS_A:0:1000',
      'node:ANNULUS_A:1000:2000'
    ]);
  });

  it('builds ordered path summary rows from path edge ids', () => {
    const rows = createTopologyPathEdgeSummaryRows(TOPOLOGY_RESULT_FIXTURE);
    expect(rows.map((row) => row.edgeId)).toEqual([
      'edge:vertical:a0-a1',
      'edge:termination:a0-surface'
    ]);
    expect(rows[0]).toMatchObject({
      step: 1,
      kind: 'vertical',
      fromNodeId: 'node:ANNULUS_A:0:1000',
      toNodeId: 'node:ANNULUS_A:1000:2000'
    });
  });
});
