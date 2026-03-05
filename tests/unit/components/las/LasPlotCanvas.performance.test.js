import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderLasPlotMock, clearLasSurfaceMock } = vi.hoisted(() => ({
  renderLasPlotMock: vi.fn(),
  clearLasSurfaceMock: vi.fn(),
}));

vi.mock('@/utils/lasPlotRenderer.js', () => ({
  clearLasSurface: clearLasSurfaceMock,
  renderLasPlot: renderLasPlotMock,
}));

import LasPlotCanvas from '@/components/las/LasPlotCanvas.vue';

describe('LasPlotCanvas performance contract', () => {
  beforeEach(() => {
    renderLasPlotMock.mockReset();
    clearLasSurfaceMock.mockReset();
  });

  it('does not rerender for nested point mutations when the plot payload reference is unchanged', async () => {
    const Wrapper = defineComponent({
      components: {
        LasPlotCanvas,
      },
      setup() {
        const plotData = ref({
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
        });

        return { plotData };
      },
      template: '<LasPlotCanvas :data="plotData" />',
    });

    const wrapper = mount(Wrapper);
    await nextTick();

    expect(renderLasPlotMock).toHaveBeenCalledTimes(1);

    wrapper.vm.plotData.series[0].points[0][1] = 46;
    await nextTick();

    expect(renderLasPlotMock).toHaveBeenCalledTimes(1);
  });
});
