import { describe, expect, it } from 'vitest';
import {
  buildTopologyDebugGraph,
  formatTopologyGraphEdgeLabel,
  formatTopologyGraphNodeLabel
} from '@/topology/topologyGraphDebug.js';

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

const DENSE_TUBING_CHAIN_FIXTURE = Object.freeze({
  nodes: [
    { nodeId: 'node:SURFACE', kind: 'SURFACE', depthTop: null, depthBottom: null },
    { nodeId: 'node:TUBING:1400:1800', kind: 'TUBING_INNER', depthTop: 1400, depthBottom: 1800 },
    { nodeId: 'node:TUBING:1800:2000', kind: 'TUBING_INNER', depthTop: 1800, depthBottom: 2000 },
    { nodeId: 'node:TUBING:2000:3000', kind: 'TUBING_INNER', depthTop: 2000, depthBottom: 3000 },
    { nodeId: 'node:TUBING:3000:3500', kind: 'TUBING_INNER', depthTop: 3000, depthBottom: 3500 },
    { nodeId: 'node:TUBING:3500:7900', kind: 'TUBING_INNER', depthTop: 3500, depthBottom: 7900 }
  ],
  edges: [
    {
      edgeId: 'edge:vertical:t0-t1',
      kind: 'vertical',
      cost: 0,
      from: 'node:TUBING:1400:1800',
      to: 'node:TUBING:1800:2000'
    },
    {
      edgeId: 'edge:vertical:t1-t2',
      kind: 'vertical',
      cost: 0,
      from: 'node:TUBING:1800:2000',
      to: 'node:TUBING:2000:3000'
    },
    {
      edgeId: 'edge:vertical:t2-t3',
      kind: 'vertical',
      cost: 0,
      from: 'node:TUBING:2000:3000',
      to: 'node:TUBING:3000:3500'
    },
    {
      edgeId: 'edge:vertical:t3-t4',
      kind: 'vertical',
      cost: 0,
      from: 'node:TUBING:3000:3500',
      to: 'node:TUBING:3500:7900'
    },
    {
      edgeId: 'edge:termination:t0-surface',
      kind: 'termination',
      cost: 0,
      from: 'node:TUBING:1400:1800',
      to: 'node:SURFACE'
    }
  ],
  activeFlowNodeIds: [
    'node:TUBING:1400:1800',
    'node:TUBING:1800:2000',
    'node:TUBING:2000:3000',
    'node:TUBING:3000:3500',
    'node:TUBING:3500:7900',
    'node:SURFACE'
  ],
  minCostPathEdgeIds: [
    'edge:vertical:t0-t1',
    'edge:vertical:t1-t2',
    'edge:vertical:t2-t3',
    'edge:vertical:t3-t4',
    'edge:termination:t0-surface'
  ],
  spofEdgeIds: [],
  edgeReasons: {}
});

const ACTIVE_FLOW_SCOPE_FIXTURE = Object.freeze({
  nodes: [
    { nodeId: 'node:SURFACE', kind: 'SURFACE', depthTop: null, depthBottom: null },
    { nodeId: 'node:ANNULUS_A:0:1000', kind: 'ANNULUS_A', depthTop: 0, depthBottom: 1000 },
    { nodeId: 'node:ANNULUS_A:1000:2000', kind: 'ANNULUS_A', depthTop: 1000, depthBottom: 2000 }
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
      edgeId: 'edge:termination:a0-surface',
      kind: 'termination',
      cost: 0,
      from: 'node:ANNULUS_A:0:1000',
      to: 'node:SURFACE'
    }
  ],
  activeFlowNodeIds: ['node:ANNULUS_A:0:1000', 'node:ANNULUS_A:1000:2000'],
  minCostPathEdgeIds: ['edge:vertical:a0-a1', 'edge:termination:a0-surface'],
  spofEdgeIds: [],
  edgeReasons: {}
});

describe('topologyGraphDebug', () => {
  it('formats node and edge labels for engineering readability', () => {
    expect(formatTopologyGraphNodeLabel({
      kind: 'ANNULUS_A',
      depthTop: 9000,
      depthBottom: 9500
    }, { depthUnitsLabel: 'ft' })).toBe('Annulus A (First Annulus) | 9,000-9,500 ft MD');

    expect(formatTopologyGraphEdgeLabel({
      kind: 'radial',
      cost: 1,
      ruleId: 'marker-leak'
    })).toBe('Radial communication | cost=1 | marker-leak');
  });

  it('builds min-path graph with scoped edges and row-based coordinates', () => {
    const graph = buildTopologyDebugGraph(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'min_path',
      depthUnitsLabel: 'ft'
    });

    expect(graph.nodeCount).toBe(3);
    expect(graph.edgeCount).toBe(2);
    expect(Object.keys(graph.edges)).toEqual([
      'edge:vertical:a0-a1',
      'edge:termination:a0-surface'
    ]);

    const annulusX = graph.layouts.nodes['node:ANNULUS_A:0:1000'].x;
    const surfaceY = graph.layouts.nodes['node:SURFACE'].y;
    const annulusY = graph.layouts.nodes['node:ANNULUS_A:0:1000'].y;
    expect(annulusX).toBeGreaterThan(0);
    expect(annulusY).toBeGreaterThan(surfaceY);
    expect(graph.layouts.nodes['node:SURFACE'].fixed).toBe(true);
  });

  it('compacts sparse lane layouts so scoped graphs remain readable', () => {
    const graph = buildTopologyDebugGraph(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'min_path',
      depthUnitsLabel: 'ft'
    });

    const annulusX = graph.layouts.nodes['node:ANNULUS_A:0:1000'].x;
    const surfaceX = graph.layouts.nodes['node:SURFACE'].x;
    expect(surfaceX - annulusX).toBeLessThanOrEqual(240);
  });

  it('builds selected-barrier graph only when barrier edge ids are provided', () => {
    const emptyBarrierGraph = buildTopologyDebugGraph(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'selected_barrier',
      selectedBarrierEdgeIds: []
    });
    expect(emptyBarrierGraph.nodeCount).toBe(0);
    expect(emptyBarrierGraph.edgeCount).toBe(0);

    const selectedBarrierGraph = buildTopologyDebugGraph(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'selected_barrier',
      selectedBarrierEdgeIds: ['edge:radial:a1-b1']
    });
    expect(selectedBarrierGraph.nodeCount).toBe(2);
    expect(selectedBarrierGraph.edgeCount).toBe(1);
    expect(selectedBarrierGraph.edges['edge:radial:a1-b1'].dasharray).toBe('6 4');
  });

  it('applies horizontal jitter to dense same-lane chains so edges do not fully overlap', () => {
    const graph = buildTopologyDebugGraph(DENSE_TUBING_CHAIN_FIXTURE, {
      scope: 'min_path',
      depthUnitsLabel: 'ft'
    });

    const tubingNodeIds = [
      'node:TUBING:1400:1800',
      'node:TUBING:1800:2000',
      'node:TUBING:2000:3000',
      'node:TUBING:3000:3500',
      'node:TUBING:3500:7900'
    ];
    const tubingXCoordinates = tubingNodeIds.map((nodeId) => graph.layouts.nodes[nodeId].x);
    expect(new Set(tubingXCoordinates).size).toBeGreaterThan(1);
  });

  it('uses compact depth labels for graph nodes and preserves detail payloads', () => {
    const graph = buildTopologyDebugGraph(DENSE_TUBING_CHAIN_FIXTURE, {
      scope: 'min_path',
      depthUnitsLabel: 'ft'
    });

    const tubingLabel = graph.nodes['node:TUBING:1400:1800'].displayLabel;
    expect(tubingLabel).toBe('1,400-1,800 ft MD');

    const tubingNode = graph.nodes['node:TUBING:1400:1800'];
    expect(tubingNode.detailLines).toEqual([
      'Tubing Inner',
      '1,400-1,800 ft MD'
    ]);

    const surfaceNode = graph.nodes['node:SURFACE'];
    expect(surfaceNode.displayLabel).toBe('Surface');
    expect(surfaceNode.detailLines).toEqual(['Surface']);
  });

  it('adds lane guide metadata for structured-lane rendering', () => {
    const graph = buildTopologyDebugGraph(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'selected_barrier',
      selectedBarrierEdgeIds: ['edge:radial:a1-b1'],
      depthUnitsLabel: 'ft'
    });

    expect(graph.laneGuides).toHaveLength(2);
    expect(graph.laneGuides).toEqual([
      expect.objectContaining({ kind: 'ANNULUS_A' }),
      expect.objectContaining({ kind: 'ANNULUS_B' })
    ]);
  });

  it('compresses large depth gaps into readable row bands', () => {
    const sparseDepthFixture = {
      nodes: [
        { nodeId: 'node:SURFACE', kind: 'SURFACE', depthTop: null, depthBottom: null },
        { nodeId: 'node:ANNULUS_A:0:1000', kind: 'ANNULUS_A', depthTop: 0, depthBottom: 1000 },
        { nodeId: 'node:ANNULUS_A:10000:11000', kind: 'ANNULUS_A', depthTop: 10000, depthBottom: 11000 }
      ],
      edges: [
        {
          edgeId: 'edge:vertical:a0-a1',
          kind: 'vertical',
          cost: 0,
          from: 'node:ANNULUS_A:0:1000',
          to: 'node:ANNULUS_A:10000:11000'
        }
      ],
      activeFlowNodeIds: [],
      minCostPathEdgeIds: ['edge:vertical:a0-a1'],
      spofEdgeIds: [],
      edgeReasons: {}
    };

    const graph = buildTopologyDebugGraph(sparseDepthFixture, {
      scope: 'min_path',
      depthUnitsLabel: 'ft'
    });

    const shallowerY = graph.layouts.nodes['node:ANNULUS_A:0:1000'].y;
    const deeperY = graph.layouts.nodes['node:ANNULUS_A:10000:11000'].y;
    expect(deeperY - shallowerY).toBeLessThan(120);
  });

  it('supports active-flow scope for the debug graph', () => {
    const graph = buildTopologyDebugGraph(ACTIVE_FLOW_SCOPE_FIXTURE, {
      scope: 'active_flow',
      depthUnitsLabel: 'ft'
    });

    expect(graph.nodeCount).toBe(2);
    expect(graph.edgeCount).toBe(1);
    expect(Object.keys(graph.edges)).toEqual(['edge:vertical:a0-a1']);
  });

  it('adds human lane headers and engineering edge tooltip lines', () => {
    const graph = buildTopologyDebugGraph(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'selected_barrier',
      selectedBarrierEdgeIds: ['edge:radial:a1-b1'],
      depthUnitsLabel: 'ft'
    });

    expect(graph.laneHeaders).toEqual([
      expect.objectContaining({ kind: 'ANNULUS_A', label: 'Annulus A (First Annulus)' }),
      expect.objectContaining({ kind: 'ANNULUS_B', label: 'Annulus B' })
    ]);

    const radialEdge = graph.edges['edge:radial:a1-b1'];
    expect(radialEdge.tooltipLines).toContain('Path: Annulus A (First Annulus) -> Annulus B');
    expect(radialEdge.tooltipLines).toContain('Rule: marker-leak');
    expect(radialEdge.tooltipLines).toContain('Tubing-host leak marker creates radial communication.');
    expect(radialEdge.detailLines).toEqual(radialEdge.tooltipLines);
  });

  it('emits theme-token tones so graph colors follow theme mode', () => {
    const minPathGraph = buildTopologyDebugGraph(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'min_path',
      depthUnitsLabel: 'ft'
    });
    const selectedBarrierGraph = buildTopologyDebugGraph(TOPOLOGY_RESULT_FIXTURE, {
      scope: 'selected_barrier',
      selectedBarrierEdgeIds: ['edge:radial:a1-b1'],
      depthUnitsLabel: 'ft'
    });

    expect(minPathGraph.nodes['node:SURFACE'].tone).toBe('var(--color-analysis-graph-node-surface)');
    expect(minPathGraph.nodes['node:ANNULUS_A:0:1000'].tone).toBe('var(--color-analysis-graph-node-default)');
    expect(minPathGraph.edges['edge:vertical:a0-a1'].tone).toBe('var(--color-analysis-graph-line-open)');
    expect(selectedBarrierGraph.edges['edge:radial:a1-b1'].tone).toBe('var(--color-analysis-graph-line-barrier)');
  });
});

