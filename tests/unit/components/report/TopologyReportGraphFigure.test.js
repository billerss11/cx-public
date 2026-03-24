import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TopologyReportGraphFigure from '@/components/report/TopologyReportGraphFigure.vue';

function createGraph() {
  return {
    nodes: {
      'node:SURFACE': {
        kind: 'SURFACE',
        displayLabel: 'Surface',
        detailLines: ['Surface'],
        tone: '#2e7d32'
      },
      'node:ANNULUS_A:0:1000': {
        kind: 'ANNULUS_A',
        displayLabel: '0-1,000 ft MD',
        detailLines: ['Annulus A', '0-1,000 ft MD'],
        tone: '#1565c0'
      }
    },
    edges: {
      'edge:a-surface': {
        source: 'node:ANNULUS_A:0:1000',
        target: 'node:SURFACE',
        tone: '#ef6c00',
        dasharray: 0
      }
    },
    layouts: {
      nodes: {
        'node:SURFACE': { x: 240, y: 60, fixed: true },
        'node:ANNULUS_A:0:1000': { x: 120, y: 220, fixed: true }
      }
    },
    laneHeaders: [
      { kind: 'ANNULUS_A', label: 'Annulus A', x: 120, y: 20 }
    ],
    laneGuides: [
      { kind: 'ANNULUS_A', x: 120, y: 40, width: 140, height: 240 }
    ],
    nodeCount: 2,
    edgeCount: 1
  };
}

describe('TopologyReportGraphFigure', () => {
  it('renders a static svg graph with nodes, edges, and lane metadata', async () => {
    const wrapper = mount(TopologyReportGraphFigure, {
      props: {
        graph: createGraph()
      }
    });

    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.findAll('circle')).toHaveLength(2);
    expect(wrapper.findAll('line')).toHaveLength(1);
    expect(wrapper.text()).toContain('Surface');
    expect(wrapper.text()).toContain('Annulus A');
    await flushPromises();
    expect(wrapper.emitted('svg-ready')).toHaveLength(1);
  });
});
