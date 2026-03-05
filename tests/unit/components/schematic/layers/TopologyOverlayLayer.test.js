import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TopologyOverlayLayer from '@/components/schematic/layers/TopologyOverlayLayer.vue';

function createAnnulusStack() {
  return [
    {
      material: 'wellbore',
      role: 'core',
      innerRadius: 0,
      outerRadius: 3
    },
    {
      material: 'fluid',
      role: 'annulus',
      slotIndex: 0,
      innerRadius: 3,
      outerRadius: 5
    }
  ];
}

function createBoreStack() {
  return [
    {
      material: 'wellbore',
      role: 'core',
      innerRadius: 0,
      outerRadius: 3
    }
  ];
}

describe('TopologyOverlayLayer', () => {
  it('merges contiguous highlighted spans into one segment per side', () => {
    const slices = [
      { top: 0, bottom: 100, stack: createAnnulusStack() },
      { top: 100, bottom: 200, stack: createAnnulusStack() }
    ];

    const topologyResult = {
      nodes: [
        {
          nodeId: 'node:ANNULUS_A:0',
          kind: 'ANNULUS_A',
          depthTop: 0,
          depthBottom: 100
        },
        {
          nodeId: 'node:ANNULUS_A:1',
          kind: 'ANNULUS_A',
          depthTop: 100,
          depthBottom: 200
        }
      ],
      activeFlowNodeIds: ['node:ANNULUS_A:0', 'node:ANNULUS_A:1'],
      edges: [],
      minCostPathEdgeIds: [],
      spofEdgeIds: []
    };

    const wrapper = mount(TopologyOverlayLayer, {
      props: {
        slices,
        topologyResult,
        xScale: (value) => Number(value),
        yScale: (value) => Number(value),
        diameterScale: 1,
        showActiveFlow: true,
        showMinCostPath: true,
        showSpof: true,
        selectedNodeIds: []
      }
    });

    const segments = wrapper.findAll('rect');
    expect(segments.length).toBe(2);
    segments.forEach((segment) => {
      expect(Number(segment.attributes('height'))).toBeCloseTo(200, 6);
    });
  });

  it('renders a single center-spanning segment for highlighted bore nodes', () => {
    const slices = [
      { top: 0, bottom: 200, stack: createBoreStack() }
    ];

    const topologyResult = {
      nodes: [
        {
          nodeId: 'node:BORE:0',
          kind: 'BORE',
          depthTop: 0,
          depthBottom: 200
        }
      ],
      activeFlowNodeIds: ['node:BORE:0'],
      edges: [],
      minCostPathEdgeIds: [],
      spofEdgeIds: []
    };

    const wrapper = mount(TopologyOverlayLayer, {
      props: {
        slices,
        topologyResult,
        xScale: (value) => Number(value),
        yScale: (value) => Number(value),
        diameterScale: 1,
        showActiveFlow: true,
        showMinCostPath: true,
        showSpof: true,
        selectedNodeIds: []
      }
    });

    const segments = wrapper.findAll('rect');
    expect(segments.length).toBe(1);
    expect(Number(segments[0].attributes('x'))).toBeCloseTo(-3, 6);
    expect(Number(segments[0].attributes('width'))).toBeCloseTo(6, 6);
  });
});
