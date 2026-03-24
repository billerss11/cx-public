import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DirectionalOverlayLayer from '@/components/schematic/layers/DirectionalOverlayLayer.vue';

function createLinearScale(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin;
  const rangeSpan = rangeMax - rangeMin;
  const scale = (value) => rangeMin + (((Number(value) - domainMin) / span) * rangeSpan);
  scale.range = () => [rangeMin, rangeMax];
  return scale;
}

describe('DirectionalOverlayLayer annotation bands', () => {
  it('keeps short annotation text rows separated instead of collapsing them onto the same y position', () => {
    const xScale = createLinearScale(-20, 20, 0, 600);
    const yScale = createLinearScale(0, 200, 0, 600);
    const wrapper = mount(DirectionalOverlayLayer, {
      props: {
        trajectoryPoints: [
          { md: 0, x: 0, tvd: 0 },
          { md: 200, x: 0, tvd: 200 },
        ],
        physicsContext: null,
        casingData: [],
        horizontalLines: [],
        annulusFluids: [],
        cementPlugs: [],
        annotationBoxes: [
          {
            topDepth: 120,
            bottomDepth: 121,
            label: 'Reservoir interval',
            detail: 'Main sandstone, porosity 32%',
            showDetails: true,
            show: true,
            labelXPos: -0.5,
            fontSize: 12,
            color: 'lightsteelblue',
            fontColor: 'steelblue',
            opacity: 0.35,
          },
        ],
        config: {
          smartLabelsEnabled: true,
          directionalLabelScale: 1,
        },
        xScale,
        yScale,
        minXData: -20,
        maxXData: 20,
        minYData: 0,
        maxYData: 200,
        totalMd: 200,
        diameterScale: 1,
        maxProjectedRadius: 8,
        xExaggeration: 1,
        xOrigin: 0,
      },
    });

    const textNodes = wrapper.findAll('.directional-overlay-layer__annotation-text');
    expect(textNodes).toHaveLength(2);

    const firstY = Number(textNodes[0].attributes('y'));
    const secondY = Number(textNodes[1].attributes('y'));
    expect(secondY - firstY).toBeGreaterThan(4);
  });
});
