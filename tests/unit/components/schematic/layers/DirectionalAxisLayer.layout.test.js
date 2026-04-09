import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DirectionalAxisLayer from '@/components/schematic/layers/DirectionalAxisLayer.vue';

function createLinearScale(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin;
  const rangeSpan = rangeMax - rangeMin;
  const scale = (value) => rangeMin + (((Number(value) - domainMin) / span) * rangeSpan);
  scale.ticks = () => [domainMin, (domainMin + domainMax) / 2, domainMax];
  return scale;
}

describe('DirectionalAxisLayer layout', () => {
  it('positions the y axis and datum from the displayed geometry envelope instead of the centerline range', () => {
    const xScale = createLinearScale(0, 100, 200, 800);
    const yScale = createLinearScale(0, 1000, 0, 1000);
    const wrapper = mount(DirectionalAxisLayer, {
      props: {
        xScale,
        yScale,
        minXData: 0,
        maxXData: 100,
        minYData: 0,
        maxYData: 1000,
        svgHeight: 1200,
        datumDepth: 0,
        unitsLabel: 'ft',
        leftVisualInsetPx: 80,
        rightVisualInsetPx: 32
      }
    });

    const yAxis = wrapper.get('.directional-axis-layer__y-axis');
    const datum = wrapper.get('.directional-axis-layer__datum');

    expect(Number(yAxis.attributes('x1'))).toBeLessThan(140);
    expect(Number(datum.attributes('x1'))).toBeCloseTo(120, 6);
  });

  it('anchors the x axis to the plot frame bottom instead of the geometry envelope bottom', () => {
    const xScale = createLinearScale(0, 100, 200, 800);
    const yScale = createLinearScale(0, 1000, 100, 900);
    const wrapper = mount(DirectionalAxisLayer, {
      props: {
        xScale,
        yScale,
        minXData: 0,
        maxXData: 100,
        minYData: 0,
        maxYData: 1000,
        svgHeight: 1200,
        plotBottomY: 980,
        datumDepth: 0,
        unitsLabel: 'ft',
        leftVisualInsetPx: 80,
        rightVisualInsetPx: 32
      }
    });

    const yAxis = wrapper.get('.directional-axis-layer__y-axis');
    const xAxis = wrapper.get('.directional-axis-layer__x-axis');

    expect(Number(xAxis.attributes('y1'))).toBe(980);
    expect(Number(yAxis.attributes('y2'))).toBe(980);
  });
});
