import { describe, expect, it } from 'vitest';
import {
  resolveDirectionalCenterlineOffsetPatch,
  resolveDirectionalDepthShiftPatch,
  resolveDirectionalLineLabelSlidePatch,
  resolveDirectionalLabelDragPatch,
  resolveVerticalDepthShiftPatch,
  resolveVerticalLabelDragPatch
} from '@/utils/diagramLabelDrag.js';

function createLinearScale(multiplier = 1) {
  const scale = (value) => Number(value) * multiplier;
  scale.invert = (value) => Number(value) / multiplier;
  return scale;
}

describe('diagramLabelDrag patch mapping', () => {
  it('maps a canonical pointer to vertical label position fields', () => {
    const xScale = createLinearScale(10);
    const yScale = createLinearScale(2);

    const patch = resolveVerticalLabelDragPatch({
      pointer: { x: 80, y: 250 },
      xScale,
      yScale,
      xField: 'labelXPos',
      yField: 'manualLabelDepth',
      xRange: { min: -12, max: 12 },
      depthRange: { min: 100, max: 150 }
    });

    expect(patch).toEqual({
      labelXPos: 8,
      manualLabelDepth: 125
    });
  });

  it('maps a canonical pointer to directional label ratio and depth fields', () => {
    const patch = resolveDirectionalLabelDragPatch({
      pointer: { x: 75, y: 120 },
      bounds: { left: 25, right: 125, width: 100 },
      resolveDepthFromPoint: (point) => point.y / 2,
      resolveTvdFromPoint: (point) => point.y / 3,
      xField: 'directionalLabelXPos',
      yField: 'directionalManualLabelDepth',
      tvdField: 'directionalManualLabelTvd',
      depthRange: { min: 0, max: 100 }
    });

    expect(patch).toEqual({
      directionalLabelXPos: 0,
      directionalManualLabelDepth: 60,
      directionalManualLabelTvd: 40
    });
  });

  it('maps a canonical pointer to directional horizon label slide ratio without introducing free Y drift', () => {
    const patch = resolveDirectionalLineLabelSlidePatch({
      pointer: { x: 150 },
      bounds: { left: 100, right: 300, width: 200 },
      xField: 'directionalLabelXPos',
      clearYField: 'directionalManualLabelDepth'
    });

    expect(patch).toEqual({
      directionalLabelXPos: -0.5,
      directionalManualLabelDepth: null
    });
  });

  it('maps directional horizon label slide ratio from the previewed label anchor so release does not snap sideways', () => {
    const patch = resolveDirectionalLineLabelSlidePatch({
      pointer: { x: 150 },
      bounds: { left: 100, right: 300, width: 200 },
      xField: 'directionalLabelXPos',
      clearYField: 'directionalManualLabelDepth',
      boxX: 160,
      boxWidth: 80,
      textAnchor: 'end'
    });

    expect(patch?.directionalLabelXPos).toBeCloseTo(0.35, 6);
    expect(patch?.directionalManualLabelDepth).toBeNull();
  });

  it('maps directional md horizon label slide to a centerline-relative tangent offset', () => {
    const patch = resolveDirectionalCenterlineOffsetPatch({
      previewOffset: { x: 20, y: 10 },
      startOffsetPx: 30,
      offsetField: 'directionalCenterlineOffsetPx',
      clearYField: 'directionalManualLabelDepth',
      clearLegacyField: 'directionalLabelXPos',
      x1: 0,
      y1: 200,
      x2: 100,
      y2: 240
    });

    expect(patch?.directionalCenterlineOffsetPx).toBeCloseTo(52.283, 3);
    expect(patch?.directionalManualLabelDepth).toBeNull();
    expect(patch?.directionalLabelXPos).toBeNull();
  });

  it('shifts whole vertical entities by depth delta instead of relabeling them independently', () => {
    const yScale = createLinearScale(2);

    const patch = resolveVerticalDepthShiftPatch({
      startPointer: { y: 200 },
      pointer: { y: 240 },
      yScale,
      entries: [
        { field: 'depth', value: 100, min: 0, max: 500 },
        { field: 'manualLabelDepth', value: 120, min: 0, max: 500 }
      ]
    });

    expect(patch).toEqual({
      depth: 120,
      manualLabelDepth: 140
    });
  });

  it('shifts whole directional entities by MD delta while keeping interval length intact', () => {
    const patch = resolveDirectionalDepthShiftPatch({
      startPointer: { y: 200 },
      pointer: { y: 260 },
      resolveDepthFromPoint: (point) => point.y / 2,
      entries: [
        { field: 'topDepth', value: 100, min: 0, max: 500 },
        { field: 'bottomDepth', value: 160, min: 0, max: 500 },
        { field: 'directionalManualLabelDepth', value: 130, min: 0, max: 500 }
      ]
    });

    expect(patch).toEqual({
      topDepth: 130,
      bottomDepth: 190,
      directionalManualLabelDepth: 160
    });
  });

  it('ignores lateral mouse drift for directional depth-shift interactions when x is locked to the start anchor', () => {
    const patch = resolveDirectionalDepthShiftPatch({
      startPointer: { x: 50, y: 200 },
      pointer: { x: 120, y: 260 },
      lockXToStart: true,
      resolveDepthFromPoint: (point) => (point.x === 50 ? point.y / 2 : 999),
      entries: [
        { field: 'depth', value: 100, min: 0, max: 500 }
      ]
    });

    expect(patch).toEqual({
      depth: 130
    });
  });
});
