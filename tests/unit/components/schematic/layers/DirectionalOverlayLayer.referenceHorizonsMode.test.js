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

function createWrapper(directionalDepthMode = 'tvd', options = {}) {
  const xScale = options.xScale ?? createLinearScale(-20, 20, 0, 600);
  const yScale = options.yScale ?? createLinearScale(0, 2000, 0, 600);
  const horizontalLines = Array.isArray(options.horizontalLines) && options.horizontalLines.length > 0
    ? options.horizontalLines
    : [
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
    ];
  return mount(DirectionalOverlayLayer, {
    props: {
      trajectoryPoints: Array.isArray(options.trajectoryPoints) && options.trajectoryPoints.length > 0
        ? options.trajectoryPoints
        : [
          { md: 0, x: 0, tvd: 0 },
          { md: 2000, x: 10, tvd: 1200 }
        ],
      physicsContext: null,
      casingData: [],
      horizontalLines,
      annulusFluids: [],
      cementPlugs: [],
      annotationBoxes: [],
      config: {
        smartLabelsEnabled: options.smartLabelsEnabled ?? true,
        directionalLabelScale: 1
      },
      xScale,
      yScale,
      minXData: options.minXData ?? -20,
      maxXData: options.maxXData ?? 20,
      minYData: options.minYData ?? 0,
      maxYData: options.maxYData ?? 2000,
      totalMd: 2000,
      diameterScale: 1,
      maxProjectedRadius: options.maxProjectedRadius ?? 8,
      visualSizing: options.visualSizing ?? null,
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

  it('extends directional horizon line rendering across the full visual well span, not just the centerline data span', () => {
    const xScale = createLinearScale(0, 100, 200, 400);
    const yScale = createLinearScale(0, 2000, 0, 600);
    const wrapper = createWrapper('tvd', {
      xScale,
      yScale,
      minXData: 0,
      maxXData: 100,
      maxProjectedRadius: 40,
      visualSizing: { formationThicknessPx: 18 }
    });

    const line = wrapper.get('.directional-overlay-layer__line-path');

    expect(Number(line.attributes('x1'))).toBeLessThan(200);
    expect(Number(line.attributes('x2'))).toBeGreaterThan(400);
  });

  it('rotates the md horizon label group to match the line angle while keeping tvd labels horizontal', () => {
    const mdWrapper = createWrapper('md');
    const tvdWrapper = createWrapper('tvd');

    const mdLine = mdWrapper.get('.directional-overlay-layer__line-path');
    const mdLabelGroup = mdWrapper.get('.directional-overlay-layer__line-label-group');
    const tvdLabelGroup = tvdWrapper.get('.directional-overlay-layer__line-label-group');

    const x1 = Number(mdLine.attributes('x1'));
    const y1 = Number(mdLine.attributes('y1'));
    const x2 = Number(mdLine.attributes('x2'));
    const y2 = Number(mdLine.attributes('y2'));
    const expectedAngle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    const transform = mdLabelGroup.attributes('transform');
    const angleMatch = /rotate\(([-\d.]+)/.exec(transform ?? '');
    const actualAngle = Number(angleMatch?.[1]);

    expect(actualAngle).toBeCloseTo(expectedAngle, 3);
    expect(tvdLabelGroup.attributes('transform')).toBeUndefined();
  });

  it('keeps md label text direction readable when the line segment endpoints are reversed by a steep projected angle', () => {
    const wrapper = createWrapper('md', {
      trajectoryPoints: [
        { md: 0, x: 0, tvd: 0 },
        { md: 2000, x: 10, tvd: 100 }
      ]
    });

    const mdLine = wrapper.get('.directional-overlay-layer__line-path');
    const mdLabelGroup = wrapper.get('.directional-overlay-layer__line-label-group');

    const rawX1 = Number(mdLine.attributes('x1'));
    const rawY1 = Number(mdLine.attributes('y1'));
    const rawX2 = Number(mdLine.attributes('x2'));
    const rawY2 = Number(mdLine.attributes('y2'));
    expect(rawX2).toBeLessThan(rawX1);

    const normalizedX1 = rawX2;
    const normalizedY1 = rawY2;
    const normalizedX2 = rawX1;
    const normalizedY2 = rawY1;
    const expectedReadableAngle = Math.atan2(
      normalizedY2 - normalizedY1,
      normalizedX2 - normalizedX1
    ) * (180 / Math.PI);

    const transform = mdLabelGroup.attributes('transform');
    const angleMatch = /rotate\(([-\d.]+)/.exec(transform ?? '');
    const actualAngle = Number(angleMatch?.[1]);

    expect(actualAngle).toBeCloseTo(expectedReadableAngle, 3);
  });

  it('keeps the md label centered on the angled horizon line at the label position', () => {
    const wrapper = createWrapper('md');

    const line = wrapper.get('.directional-overlay-layer__line-path');
    const labelBox = wrapper.get('.directional-overlay-layer__line-label-bg');
    const labelText = wrapper.get('.directional-overlay-layer__line-label-text');

    const x1 = Number(line.attributes('x1'));
    const y1 = Number(line.attributes('y1'));
    const x2 = Number(line.attributes('x2'));
    const y2 = Number(line.attributes('y2'));
    const boxX = Number(labelBox.attributes('x'));
    const boxWidth = Number(labelBox.attributes('width'));
    const textY = Number(labelText.attributes('y'));
    const boxCenterX = boxX + (boxWidth / 2);
    const expectedLineYAtLabel = y1 + (((boxCenterX - x1) / (x2 - x1)) * (y2 - y1));

    expect(textY).toBeCloseTo(expectedLineYAtLabel, 3);
  });

  it('keeps md horizon labels attached to their own line center even when nearby horizons overlap', () => {
    const wrapper = createWrapper('md', {
      horizontalLines: [
        {
          rowId: 'line-1',
          depth: 1000,
          directionalDepthMd: 1480,
          directionalDepthTvd: 690,
          directionalDepthMode: 'md',
          label: 'Upper',
          color: 'steelblue',
          fontColor: 'steelblue',
          fontSize: 11,
          lineStyle: 'Solid',
          show: true
        },
        {
          rowId: 'line-2',
          depth: 1000,
          directionalDepthMd: 1520,
          directionalDepthTvd: 710,
          directionalDepthMode: 'md',
          label: 'Lower',
          color: 'seagreen',
          fontColor: 'seagreen',
          fontSize: 11,
          lineStyle: 'Solid',
          show: true
        }
      ]
    });

    const linePaths = wrapper.findAll('.directional-overlay-layer__line-path');
    const labelBoxes = wrapper.findAll('.directional-overlay-layer__line-label-bg');
    const labelTexts = wrapper.findAll('.directional-overlay-layer__line-label-text');

    labelTexts.forEach((labelText, index) => {
      const line = linePaths[index];
      const labelBox = labelBoxes[index];
      const x1 = Number(line.attributes('x1'));
      const y1 = Number(line.attributes('y1'));
      const x2 = Number(line.attributes('x2'));
      const y2 = Number(line.attributes('y2'));
      const boxX = Number(labelBox.attributes('x'));
      const boxWidth = Number(labelBox.attributes('width'));
      const textY = Number(labelText.attributes('y'));
      const boxCenterX = boxX + (boxWidth / 2);
      const expectedLineYAtLabel = y1 + (((boxCenterX - x1) / (x2 - x1)) * (y2 - y1));

      expect(textY).toBeCloseTo(expectedLineYAtLabel, 3);
    });
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

  it('emits a constrained label-slide payload when dragging a directional horizon label', async () => {
    const wrapper = createWrapper('md');

    await wrapper.get('.directional-overlay-layer__line-label-group').trigger('pointerdown');

    const payload = wrapper.emitted('start-label-drag')?.[0]?.[0];
    expect(payload).toMatchObject({
      entityType: 'line',
      dragKind: 'line-label-slide',
      xField: 'directionalLabelXPos',
      clearYField: 'directionalManualLabelDepth',
      boxX: expect.any(Number),
      boxWidth: expect.any(Number),
      textAnchor: expect.stringMatching(/^(start|middle|end)$/)
    });
  });

  it('allows directional casing labels to use the full visual inset span in deviated sections instead of clamping to the centerline bounds', () => {
    const xScale = createLinearScale(0, 100, 200, 400);
    const yScale = createLinearScale(0, 2000, 0, 600);
    const wrapper = mount(DirectionalOverlayLayer, {
      props: {
        trajectoryPoints: [
          { md: 0, x: 0, tvd: 0 },
          { md: 1000, x: 60, tvd: 900 }
        ],
        physicsContext: {
          __physicsContext: true,
          operationPhase: 'production',
          casingRows: [
            { __index: 0, od: 10.75, top: 0, bottom: 1000 }
          ]
        },
        casingData: [
          {
            rowId: 'casing-1',
            label: 'Production',
            od: 10.75,
            weight: 40,
            grade: 'L80',
            top: 0,
            bottom: 1000,
            directionalLabelXPos: 1,
            directionalManualLabelDepth: 900,
            showTop: false,
            showBottom: false
          }
        ],
        horizontalLines: [],
        annulusFluids: [],
        cementPlugs: [],
        annotationBoxes: [],
        config: {
          smartLabelsEnabled: true,
          directionalLabelScale: 1
        },
        xScale,
        yScale,
        minXData: 0,
        maxXData: 100,
        minYData: 0,
        maxYData: 2000,
        totalMd: 1000,
        diameterScale: 10,
        maxProjectedRadius: 40,
        visualSizing: { formationThicknessPx: 18 },
        xExaggeration: 1,
        xOrigin: 0
      }
    });

    const labelBox = wrapper.get('.directional-overlay-layer__casing-label-bg');
    const centerX = Number(labelBox.attributes('x')) + (Number(labelBox.attributes('width')) / 2);

    expect(centerX).toBeGreaterThan(400);
  });

  it('emits extended directional bounds for casing label dragging in deviated sections', async () => {
    const xScale = createLinearScale(0, 100, 200, 400);
    const yScale = createLinearScale(0, 2000, 0, 600);
    const wrapper = mount(DirectionalOverlayLayer, {
      props: {
        trajectoryPoints: [
          { md: 0, x: 0, tvd: 0 },
          { md: 1000, x: 60, tvd: 900 }
        ],
        physicsContext: {
          __physicsContext: true,
          operationPhase: 'production',
          casingRows: [
            { __index: 0, od: 10.75, top: 0, bottom: 1000 }
          ]
        },
        casingData: [
          {
            rowId: 'casing-1',
            label: 'Production',
            od: 10.75,
            weight: 40,
            grade: 'L80',
            top: 0,
            bottom: 1000,
            directionalLabelXPos: 0.6,
            directionalManualLabelDepth: 900,
            showTop: false,
            showBottom: false
          }
        ],
        horizontalLines: [],
        annulusFluids: [],
        cementPlugs: [],
        annotationBoxes: [],
        config: {
          smartLabelsEnabled: true,
          directionalLabelScale: 1
        },
        xScale,
        yScale,
        minXData: 0,
        maxXData: 100,
        minYData: 0,
        maxYData: 2000,
        totalMd: 1000,
        diameterScale: 10,
        maxProjectedRadius: 40,
        visualSizing: { formationThicknessPx: 18 },
        xExaggeration: 1,
        xOrigin: 0
      }
    });

    await wrapper.get('.directional-overlay-layer__casing-group').trigger('pointerdown');

    const payload = wrapper.emitted('start-label-drag')?.[0]?.[0];
    expect(payload.bounds.left).toBeLessThan(200);
    expect(payload.bounds.right).toBeGreaterThan(400);
  });

  it('uses stored directional manual label tvd to preserve casing label screen y in deviated sections', () => {
    const xScale = createLinearScale(0, 100, 200, 400);
    const yScale = createLinearScale(0, 2000, 0, 600);
    const wrapper = mount(DirectionalOverlayLayer, {
      props: {
        trajectoryPoints: [
          { md: 0, x: 0, tvd: 0 },
          { md: 1000, x: 60, tvd: 900 }
        ],
        physicsContext: {
          __physicsContext: true,
          operationPhase: 'production',
          casingRows: [
            { __index: 0, od: 10.75, top: 0, bottom: 1000 }
          ]
        },
        casingData: [
          {
            rowId: 'casing-1',
            label: 'Production',
            od: 10.75,
            weight: 40,
            grade: 'L80',
            top: 0,
            bottom: 1000,
            directionalLabelXPos: 1,
            directionalManualLabelDepth: 1000,
            directionalManualLabelTvd: 1200,
            showTop: false,
            showBottom: false
          }
        ],
        horizontalLines: [],
        annulusFluids: [],
        cementPlugs: [],
        annotationBoxes: [],
        config: {
          smartLabelsEnabled: true,
          directionalLabelScale: 1
        },
        xScale,
        yScale,
        minXData: 0,
        maxXData: 100,
        minYData: 0,
        maxYData: 2000,
        totalMd: 1000,
        diameterScale: 10,
        maxProjectedRadius: 40,
        visualSizing: { formationThicknessPx: 18 },
        xExaggeration: 1,
        xOrigin: 0
      }
    });

    const labelBox = wrapper.get('.directional-overlay-layer__casing-label-bg');
    const centerY = Number(labelBox.attributes('y')) + (Number(labelBox.attributes('height')) / 2);

    expect(centerY).toBeCloseTo(yScale(1200), 3);
  });

  it('emits directional manual label tvd in casing label drag payloads', async () => {
    const xScale = createLinearScale(0, 100, 200, 400);
    const yScale = createLinearScale(0, 2000, 0, 600);
    const wrapper = mount(DirectionalOverlayLayer, {
      props: {
        trajectoryPoints: [
          { md: 0, x: 0, tvd: 0 },
          { md: 1000, x: 60, tvd: 900 }
        ],
        physicsContext: {
          __physicsContext: true,
          operationPhase: 'production',
          casingRows: [
            { __index: 0, od: 10.75, top: 0, bottom: 1000 }
          ]
        },
        casingData: [
          {
            rowId: 'casing-1',
            label: 'Production',
            od: 10.75,
            weight: 40,
            grade: 'L80',
            top: 0,
            bottom: 1000,
            directionalLabelXPos: 0.6,
            directionalManualLabelDepth: 900,
            showTop: false,
            showBottom: false
          }
        ],
        horizontalLines: [],
        annulusFluids: [],
        cementPlugs: [],
        annotationBoxes: [],
        config: {
          smartLabelsEnabled: true,
          directionalLabelScale: 1
        },
        xScale,
        yScale,
        minXData: 0,
        maxXData: 100,
        minYData: 0,
        maxYData: 2000,
        totalMd: 1000,
        diameterScale: 10,
        maxProjectedRadius: 40,
        visualSizing: { formationThicknessPx: 18 },
        xExaggeration: 1,
        xOrigin: 0
      }
    });

    await wrapper.get('.directional-overlay-layer__casing-group').trigger('pointerdown');

    const payload = wrapper.emitted('start-label-drag')?.[0]?.[0];
    expect(payload.tvdField).toBe('directionalManualLabelTvd');
  });
});
