import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import LasCorrelationHeatmap from '@/components/las/LasCorrelationHeatmap.vue';
import LasPlotCanvas from '@/components/las/LasPlotCanvas.vue';
import LasPlotStage from '@/components/las/LasPlotStage.vue';

describe('LAS visual surfaces', () => {
  it('renders an empty plot canvas when no series are available', () => {
    const wrapper = mount(LasPlotCanvas, {
      props: {
        data: null,
      },
    });

    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('renders a plot svg when curve data exists', async () => {
    const wrapper = mount(LasPlotCanvas, {
      props: {
        data: {
          indexCurve: 'DEPT',
          depthRange: {
            minDepth: 1000,
            maxDepth: 1200,
            depthUnit: 'm',
          },
          series: [
            {
              mnemonic: 'GR',
              unit: 'api',
              points: [
                [1000, 45],
                [1100, 52],
                [1200, 61],
              ],
            },
          ],
        },
      },
    });

    await wrapper.vm.$nextTick();
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.text()).toContain('GR (api)');
  });

  it('expands a single-track plot to use the available stage width', async () => {
    const wrapper = mount(LasPlotCanvas, {
      props: {
        data: null,
      },
      attachTo: document.body,
    });

    Object.defineProperty(wrapper.element, 'clientWidth', {
      configurable: true,
      value: 920,
    });

    await wrapper.setProps({
      data: {
        indexCurve: 'DEPT',
        depthRange: {
          minDepth: 1000,
          maxDepth: 1200,
          depthUnit: 'm',
        },
        series: [
          {
            mnemonic: 'GR',
            unit: 'api',
            points: [
              [1000, 45],
              [1100, 52],
              [1200, 61],
            ],
          },
        ],
      },
    });
    await wrapper.vm.$nextTick();

    const svgWidth = Number(wrapper.find('svg').attributes('width'));
    expect(svgWidth).toBeGreaterThan(700);
  });

  it('renders plotted data inside a dedicated viewport shell', async () => {
    const wrapper = mount(LasPlotStage, {
      props: {
        activeSession: {
          indexCurve: 'DEPT',
          depthUnit: 'm',
        },
        curveLibraryOpen: true,
        hasData: true,
        isLoading: false,
        selectedCurveCount: 2,
        selectedCurveNames: ['GR', 'RHOB'],
        data: {
          indexCurve: 'DEPT',
          depthRange: {
            minDepth: 1000,
            maxDepth: 1200,
            depthUnit: 'm',
          },
          series: [
            {
              mnemonic: 'GR',
              unit: 'api',
              points: [
                [1000, 45],
                [1100, 52],
                [1200, 61],
              ],
            },
          ],
        },
      },
    });

    await wrapper.vm.$nextTick();
    expect(wrapper.find('.las-plot-stage__viewport').exists()).toBe(true);
    expect(wrapper.find('.las-plot-stage__canvas-shell').exists()).toBe(true);
  });

  it('renders an empty heatmap when the correlation matrix is missing', () => {
    const wrapper = mount(LasCorrelationHeatmap, {
      props: {
        data: null,
      },
    });

    expect(wrapper.find('svg').exists()).toBe(false);
  });

  it('renders a heatmap svg when the correlation matrix exists', async () => {
    const wrapper = mount(LasCorrelationHeatmap, {
      props: {
        data: {
          curves: ['GR', 'RHOB'],
          matrix: [
            [1, 0.42],
            [0.42, 1],
          ],
        },
      },
    });

    await wrapper.vm.$nextTick();
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.text()).toContain('GR');
    expect(wrapper.text()).toContain('RHOB');
  });
});
