import { describe, expect, it } from 'vitest';
import { renderLasPlot } from '@/utils/lasPlotRenderer.js';

function createPlotContainer(width = 920, height = 420) {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    value: height,
  });
  return container;
}

function createPlotData(minDepth, maxDepth) {
  const midpoint = minDepth + ((maxDepth - minDepth) / 2);
  return {
    indexCurve: 'TIME',
    depthRange: {
      minDepth,
      maxDepth,
      depthUnit: 'ms',
    },
    series: [
      {
        mnemonic: 'BDTI',
        unit: 'h',
        points: [
          [minDepth, 0],
          [midpoint, 1],
          [maxDepth, 2],
        ],
      },
    ],
  };
}

describe('lasPlotRenderer', () => {
  it('expands left plot margin when depth/index tick labels are long', () => {
    const shortRangeModel = renderLasPlot(
      createPlotContainer(),
      createPlotData(0, 12_000)
    );
    const longRangeModel = renderLasPlot(
      createPlotContainer(),
      createPlotData(0, 2_159_995_000)
    );

    expect(shortRangeModel).not.toBeNull();
    expect(longRangeModel).not.toBeNull();
    expect(longRangeModel.plotArea.left).toBeGreaterThan(shortRangeModel.plotArea.left);
    expect(longRangeModel.plotArea.left).toBeGreaterThan(90);
  });

  it('renders clock-time tick labels when time-axis clock mode is enabled', () => {
    const container = createPlotContainer();
    renderLasPlot(container, {
      ...createPlotData(0, 10_000),
      timeAxis: {
        mode: 'clock',
        status: 'ready',
        timezone: 'UTC',
        millisecondsPerIndexUnit: 1,
        anchorEpochMs: Date.UTC(2015, 7, 3, 0, 0, 5),
        anchorIndexValue: 0,
      },
    });

    expect(container.textContent).toContain('2015-08-03');
    expect(container.textContent).toContain('00:00:10');
  });
});
