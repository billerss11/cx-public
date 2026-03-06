import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import LasPlotCanvas from '@/components/las/LasPlotCanvas.vue';

function createPlotData() {
  return {
    indexCurve: 'DEPT',
    depthRange: {
      minDepth: 1000,
      maxDepth: 1200,
      depthUnit: 'm',
      samplingStep: 4,
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
      {
        mnemonic: 'RHOB',
        unit: 'g/cc',
        points: [
          [1000, 2.2],
          [1100, 2.3],
          [1200, 2.4],
        ],
      },
    ],
  };
}

describe('LasPlotCanvas cursor overlay', () => {
  it('shows a cross-track horizontal cursor and multi-curve tooltip on pointer hover', async () => {
    const wrapper = mount(LasPlotCanvas, {
      props: {
        data: createPlotData(),
      },
      attachTo: document.body,
    });

    await wrapper.vm.$nextTick();

    const initialLine = wrapper.get('.las-plot-canvas__cursor-line');
    expect(initialLine.element.style.display).toBe('none');

    const overlay = wrapper.get('.las-plot-canvas__cursor-overlay');
    await overlay.trigger('pointermove', { clientX: 140, clientY: 120 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await wrapper.vm.$nextTick();

    const line = wrapper.get('.las-plot-canvas__cursor-line');
    const tooltip = wrapper.get('.las-plot-canvas__cursor-tooltip');

    expect(line.element.style.display).not.toBe('none');
    expect(tooltip.text()).toContain('GR');
    expect(tooltip.text()).toContain('RHOB');
    expect(tooltip.text()).toContain('Depth');
  });

  it('locks cursor and resolves authoritative values on click', async () => {
    vi.useFakeTimers();

    const resolveExactValuesAtDepth = vi.fn().mockResolvedValue({
      rows: [
        { mnemonic: 'GR', unit: 'api', value: 51.25, status: 'exact' },
        { mnemonic: 'RHOB', unit: 'g/cc', value: 2.31, status: 'interpolated' },
      ],
    });

    const wrapper = mount(LasPlotCanvas, {
      props: {
        data: createPlotData(),
        resolveExactValuesAtDepth,
      },
      attachTo: document.body,
    });

    await wrapper.vm.$nextTick();

    const overlay = wrapper.get('.las-plot-canvas__cursor-overlay');
    await overlay.trigger('pointermove', { clientX: 120, clientY: 140 });
    await overlay.trigger('pointerdown', { button: 0, clientX: 120, clientY: 140 });

    vi.runOnlyPendingTimers();
    await Promise.resolve();
    await wrapper.vm.$nextTick();

    expect(resolveExactValuesAtDepth).toHaveBeenCalledTimes(1);
    expect(wrapper.get('.las-plot-canvas__cursor-tooltip').text()).toContain('EXACT');
  });
});
