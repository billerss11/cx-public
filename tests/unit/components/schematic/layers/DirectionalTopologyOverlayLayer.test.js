import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DirectionalTopologyOverlayLayer from '@/components/schematic/layers/DirectionalTopologyOverlayLayer.vue';

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

function parsePolygonPointCount(pointsText = '') {
  return String(pointsText)
    .trim()
    .split(/\s+/)
    .filter((token) => token.includes(','))
    .length;
}

describe('DirectionalTopologyOverlayLayer', () => {
  it('uses dense md sampling for long highlighted intervals', () => {
    const intervals = [
      { top: 0, bottom: 200, stack: createAnnulusStack() }
    ];

    const topologyResult = {
      nodes: [
        {
          nodeId: 'node:ANNULUS_A:0',
          kind: 'ANNULUS_A',
          depthTop: 0,
          depthBottom: 200
        }
      ],
      activeFlowNodeIds: ['node:ANNULUS_A:0'],
      edges: [],
      minCostPathEdgeIds: [],
      spofEdgeIds: []
    };

    const wrapper = mount(DirectionalTopologyOverlayLayer, {
      props: {
        intervals,
        topologyResult,
        projector: (md, offset) => [Number(md), Number(offset)],
        diameterScale: 1,
        showActiveFlow: true,
        showMinCostPath: true,
        showSpof: true,
        selectedNodeIds: [],
        sampleStepMd: 20
      }
    });

    const polygons = wrapper.findAll('polygon');
    expect(polygons.length).toBe(2);
    polygons.forEach((polygon) => {
      const pointCount = parsePolygonPointCount(polygon.attributes('points'));
      expect(pointCount).toBe(22);
    });
  });

  it('renders overlap span even when node interval extends beyond render interval', () => {
    const intervals = [
      { top: 0, bottom: 200, stack: createAnnulusStack() }
    ];

    const topologyResult = {
      nodes: [
        {
          nodeId: 'node:ANNULUS_A:0',
          kind: 'ANNULUS_A',
          depthTop: 0,
          depthBottom: 220
        }
      ],
      activeFlowNodeIds: ['node:ANNULUS_A:0'],
      edges: [],
      minCostPathEdgeIds: [],
      spofEdgeIds: []
    };

    const wrapper = mount(DirectionalTopologyOverlayLayer, {
      props: {
        intervals,
        topologyResult,
        projector: (md, offset) => [Number(md), Number(offset)],
        diameterScale: 1,
        showActiveFlow: true,
        showMinCostPath: true,
        showSpof: true,
        selectedNodeIds: [],
        sampleStepMd: 20
      }
    });

    expect(wrapper.findAll('polygon').length).toBe(2);
  });

  it('renders a single center-spanning polygon for highlighted bore nodes', () => {
    const intervals = [
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

    const wrapper = mount(DirectionalTopologyOverlayLayer, {
      props: {
        intervals,
        topologyResult,
        projector: (md, offset) => [Number(md), Number(offset)],
        diameterScale: 1,
        showActiveFlow: true,
        showMinCostPath: true,
        showSpof: true,
        selectedNodeIds: [],
        sampleStepMd: 20
      }
    });

    const polygons = wrapper.findAll('polygon');
    expect(polygons.length).toBe(1);
    const pointCount = parsePolygonPointCount(polygons[0].attributes('points'));
    expect(pointCount).toBe(22);
  });
});
