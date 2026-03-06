import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const originalResizeObserver = globalThis.ResizeObserver;
  let resizeObserverCallback = null;

  beforeEach(() => {
    renderLasPlotMock.mockReset();
    clearLasSurfaceMock.mockReset();
    resizeObserverCallback = null;
    globalThis.ResizeObserver = class ResizeObserverMock {
      constructor(callback) {
        resizeObserverCallback = callback;
      }

      observe() {}

      disconnect() {}
    };
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
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

  it('ignores duplicate resize notifications when chart dimensions are unchanged', async () => {
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
      attachTo: document.body,
    });

    await nextTick();
    expect(renderLasPlotMock).toHaveBeenCalledTimes(1);
    expect(typeof resizeObserverCallback).toBe('function');

    const surface = wrapper.get('.las-plot-canvas__surface').element;
    Object.defineProperty(surface, 'clientWidth', {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(surface, 'clientHeight', {
      configurable: true,
      value: 480,
    });

    resizeObserverCallback();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(renderLasPlotMock).toHaveBeenCalledTimes(2);

    resizeObserverCallback();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(renderLasPlotMock).toHaveBeenCalledTimes(2);
  });
});
