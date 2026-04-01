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

  it('keeps directional interval callouts on stable side bands relative to the midpoint centerline', () => {
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
            topDepth: 80,
            bottomDepth: 120,
            label: 'Left band',
            detail: '',
            showDetails: false,
            show: true,
            directionalCenterlineOffsetPx: -120,
            bandWidth: 0.35,
            fontSize: 12,
            color: 'lightsteelblue',
            fontColor: 'steelblue',
            opacity: 0.35,
          },
          {
            topDepth: 80,
            bottomDepth: 120,
            label: 'Right band',
            detail: '',
            showDetails: false,
            show: true,
            directionalCenterlineOffsetPx: 120,
            bandWidth: 0.35,
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

    const fills = wrapper.findAll('.directional-overlay-layer__annotation-fill');
    const texts = wrapper.findAll('.directional-overlay-layer__annotation-text');
    expect(fills).toHaveLength(2);
    expect(texts).toHaveLength(2);

    const leftCenterX = Number(fills[0].attributes('x')) + (Number(fills[0].attributes('width')) / 2);
    const rightCenterX = Number(fills[1].attributes('x')) + (Number(fills[1].attributes('width')) / 2);
    const centerlineX = xScale(0);

    expect(leftCenterX).toBeLessThan(centerlineX);
    expect(rightCenterX).toBeGreaterThan(centerlineX);
    texts.forEach((textNode) => {
      expect(textNode.attributes('text-anchor')).toBe('middle');
    });
  });

  it('chooses the side with available space for a new directional interval when no manual side is stored yet', () => {
    const xScale = createLinearScale(0, 15000, 0, 600);
    const yScale = createLinearScale(0, 20000, 0, 600);
    const wrapper = mount(DirectionalOverlayLayer, {
      props: {
        trajectoryPoints: [
          { md: 0, x: 0, tvd: 0 },
          { md: 20000, x: 15000, tvd: 14000 },
        ],
        physicsContext: null,
        casingData: [],
        horizontalLines: [],
        annulusFluids: [],
        cementPlugs: [],
        annotationBoxes: [
          {
            topDepth: 3000,
            bottomDepth: 4000,
            label: 'New interval',
            detail: '',
            showDetails: false,
            show: true,
            labelXPos: null,
            manualLabelDepth: null,
            directionalCenterlineOffsetPx: null,
            directionalManualLabelDepth: null,
            directionalManualLabelTvd: null,
            bandWidth: 1,
            opacity: 0.35,
            color: 'lightsteelblue',
            fontColor: 'steelblue',
            fontSize: 12,
            rowId: 'annotation-box-new'
          },
        ],
        config: {
          smartLabelsEnabled: true,
          directionalLabelScale: 1,
        },
        xScale,
        yScale,
        minXData: 0,
        maxXData: 15000,
        minYData: 0,
        maxYData: 20000,
        totalMd: 20000,
        diameterScale: 1,
        maxProjectedRadius: 8,
        xExaggeration: 1,
        xOrigin: 0,
      },
    });

    const fills = wrapper.findAll('.directional-overlay-layer__annotation-fill');
    expect(fills).toHaveLength(1);

    const fill = fills[0];
    const centerX = Number(fill.attributes('x')) + (Number(fill.attributes('width')) / 2);
    const centerlineX = xScale(2625);

    expect(centerX).toBeGreaterThan(centerlineX);
  });

  it('switches directional interval band geometry between md and tvd modes', () => {
    const xScale = createLinearScale(0, 15000, 0, 600);
    const yScale = createLinearScale(0, 20000, 0, 600);
    const trajectoryPoints = [
      { md: 0, x: 0, tvd: 0 },
      { md: 20000, x: 15000, tvd: 14000 },
    ];

    const mdWrapper = mount(DirectionalOverlayLayer, {
      props: {
        trajectoryPoints,
        physicsContext: null,
        casingData: [],
        horizontalLines: [],
        annulusFluids: [],
        cementPlugs: [],
        annotationBoxes: [
          {
            topDepth: 3000,
            bottomDepth: 4000,
            directionalTopDepthMd: 3000,
            directionalBottomDepthMd: 4000,
            directionalTopDepthTvd: 8000,
            directionalBottomDepthTvd: 10000,
            directionalDepthMode: 'md',
            label: 'MD interval',
            detail: '',
            showDetails: false,
            show: true,
            directionalCenterlineOffsetPx: 120,
            bandWidth: 1,
            opacity: 0.35,
            color: 'lightsteelblue',
            fontColor: 'steelblue',
            fontSize: 12,
            rowId: 'annotation-box-md'
          },
        ],
        config: { smartLabelsEnabled: true, directionalLabelScale: 1 },
        xScale, yScale,
        minXData: 0, maxXData: 15000, minYData: 0, maxYData: 20000,
        totalMd: 20000, diameterScale: 1, maxProjectedRadius: 8, xExaggeration: 1, xOrigin: 0,
      },
    });

    const tvdWrapper = mount(DirectionalOverlayLayer, {
      props: {
        trajectoryPoints,
        physicsContext: null,
        casingData: [],
        horizontalLines: [],
        annulusFluids: [],
        cementPlugs: [],
        annotationBoxes: [
          {
            topDepth: 3000,
            bottomDepth: 4000,
            directionalTopDepthMd: 3000,
            directionalBottomDepthMd: 4000,
            directionalTopDepthTvd: 8000,
            directionalBottomDepthTvd: 10000,
            directionalDepthMode: 'tvd',
            label: 'TVD interval',
            detail: '',
            showDetails: false,
            show: true,
            directionalCenterlineOffsetPx: 120,
            bandWidth: 1,
            opacity: 0.35,
            color: 'lightsteelblue',
            fontColor: 'steelblue',
            fontSize: 12,
            rowId: 'annotation-box-tvd'
          },
        ],
        config: { smartLabelsEnabled: true, directionalLabelScale: 1 },
        xScale, yScale,
        minXData: 0, maxXData: 15000, minYData: 0, maxYData: 20000,
        totalMd: 20000, diameterScale: 1, maxProjectedRadius: 8, xExaggeration: 1, xOrigin: 0,
      },
    });

    const mdFill = mdWrapper.get('.directional-overlay-layer__annotation-fill');
    const tvdFill = tvdWrapper.get('.directional-overlay-layer__annotation-fill');

    expect(Number(mdFill.attributes('y'))).not.toBeCloseTo(Number(tvdFill.attributes('y')), 3);
    expect(Number(mdFill.attributes('height'))).not.toBeCloseTo(Number(tvdFill.attributes('height')), 3);
  });
});
