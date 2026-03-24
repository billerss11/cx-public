import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ReportFigureHost from '@/components/report/ReportFigureHost.vue';

vi.mock('@/components/schematic/SchematicCanvas.vue', () => ({
  default: {
    name: 'SchematicCanvas',
    emits: ['svg-ready'],
    mounted() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'vertical-report-figure');
      this.$emit('svg-ready', svg);
    },
    template: '<div class="vertical-canvas-stub" />'
  }
}));

vi.mock('@/components/schematic/DirectionalSchematicCanvas.vue', () => ({
  default: {
    name: 'DirectionalSchematicCanvas',
    props: {
      analysisRequestId: {
        type: Number,
        default: null
      }
    },
    emits: ['svg-ready', 'analysis-geometry-ready'],
    mounted() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'directional-report-figure');
      this.$emit('svg-ready', svg);
    },
    methods: {
      emitGeometryReady() {
        this.$emit('analysis-geometry-ready', this.analysisRequestId);
      }
    },
    template: '<button type="button" class="directional-ready-trigger" @click="emitGeometryReady">ready</button>'
  }
}));

vi.mock('@/components/report/TopologyReportGraphFigure.vue', () => ({
  default: {
    name: 'TopologyReportGraphFigure',
    emits: ['svg-ready'],
    mounted() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'graph-report-figure');
      this.$emit('svg-ready', svg);
    },
    template: '<div class="graph-figure-stub" />'
  }
}));

describe('ReportFigureHost', () => {
  it('serializes a vertical schematic figure and topology graph figure', async () => {
    const wrapper = mount(ReportFigureHost, {
      props: {
        snapshot: {
          config: {
            viewMode: 'vertical'
          },
          stateSnapshot: {
            config: {}
          }
        },
        topologyGraph: {
          nodeCount: 2,
          edgeCount: 1
        },
        includeTopologyGraph: true
      }
    });

    await flushPromises();

    expect(wrapper.emitted('ready')).toHaveLength(1);
    expect(wrapper.emitted('ready')[0][0]).toEqual(expect.objectContaining({
      schematicSvg: expect.stringContaining('vertical-report-figure'),
      topologyGraphSvg: expect.stringContaining('graph-report-figure')
    }));
  });

  it('waits for directional geometry readiness before emitting the final schematic figure payload', async () => {
    const wrapper = mount(ReportFigureHost, {
      props: {
        snapshot: {
          config: {
            viewMode: 'directional'
          },
          stateSnapshot: {
            config: {}
          }
        },
        includeTopologyGraph: false
      }
    });

    await flushPromises();
    expect(wrapper.emitted('ready')).toBeFalsy();

    await wrapper.find('.directional-ready-trigger').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('ready')).toHaveLength(1);
    expect(wrapper.emitted('ready')[0][0].schematicSvg).toContain('directional-report-figure');
    expect(wrapper.emitted('ready')[0][0].topologyGraphSvg).toBe('');
  });
});
