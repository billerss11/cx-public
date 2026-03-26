import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DirectionalOverlayLayer from '@/components/schematic/layers/DirectionalOverlayLayer.vue';

function createLinearScale(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin;
  const rangeSpan = rangeMax - rangeMin;
  const scale = (value) => rangeMin + (((Number(value) - domainMin) / span) * rangeSpan);
  scale.range = () => [rangeMin, rangeMax];
  scale.invert = (value) => domainMin + (((Number(value) - rangeMin) / rangeSpan) * span);
  return scale;
}

function createWrapper(directionalDepthMode = 'tvd') {
  const xScale = createLinearScale(-20, 20, 0, 600);
  const yScale = createLinearScale(0, 2000, 0, 600);
  return mount(DirectionalOverlayLayer, {
    props: {
      trajectoryPoints: [
        { md: 0, x: 0, tvd: 0 },
        { md: 2000, x: 10, tvd: 1200 }
      ],
      physicsContext: null,
      casingData: [],
      horizontalLines: [
        {
          rowId: 'line-1',
          depth: 1000,
          directionalDepthMd: 1500,
          directionalDepthTvd: 700,
          directionalDepthMode,
          label: 'Landing',
          color: 'steelblue',
          fontColor: 'steelblue',
          fontSize: 11,
          lineStyle: 'Solid',
          show: true
        }
      ],
      annulusFluids: [],
      cementPlugs: [],
      annotationBoxes: [],
      config: {
        smartLabelsEnabled: true,
        directionalLabelScale: 1
      },
      xScale,
      yScale,
      minXData: -20,
      maxXData: 20,
      minYData: 0,
      maxYData: 2000,
      totalMd: 2000,
      diameterScale: 1,
      maxProjectedRadius: 8,
      xExaggeration: 1,
      xOrigin: 0
    }
  });
}

describe('DirectionalOverlayLayer reference horizon mode', () => {
  it('switches directional horizon rendering source between md and tvd modes', () => {
    const mdWrapper = createWrapper('md');
    const tvdWrapper = createWrapper('tvd');

    const mdLine = mdWrapper.get('.directional-overlay-layer__line-path');
    const tvdLine = tvdWrapper.get('.directional-overlay-layer__line-path');

    expect(Number(mdLine.attributes('y1'))).not.toBe(Number(mdLine.attributes('y2')));
    expect(Number(tvdLine.attributes('y1'))).toBe(Number(tvdLine.attributes('y2')));
  });

  it('emits a mode-aware drag payload for directional horizons', async () => {
    const wrapper = createWrapper('md');

    await wrapper.get('.directional-overlay-layer__line-group').trigger('pointerdown');

    const payload = wrapper.emitted('start-label-drag')?.[0]?.[0];
    expect(payload).toMatchObject({
      entityType: 'line',
      dragKind: 'depth-shift',
      resolveDepthMode: 'projected-y'
    });

    const tvdWrapper = createWrapper('tvd');
    await tvdWrapper.get('.directional-overlay-layer__line-group').trigger('pointerdown');
    const tvdPayload = tvdWrapper.emitted('start-label-drag')?.[0]?.[0];
    expect(tvdPayload).toMatchObject({
      entityType: 'line',
      dragKind: 'depth-shift',
      resolveDepthMode: 'tvd-y'
    });
  });
});
