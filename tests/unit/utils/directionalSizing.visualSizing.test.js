import { describe, expect, it } from 'vitest';
import {
  buildDirectionalVisualSizing,
  resolveDirectionalLayerVisualRadii,
  resolveDirectionalPlotInsetRange,
  resolveDirectionalPipeVisualGeometry,
  resolveDirectionalSvgWidthFromHeightWithInsets,
  resolveDirectionalVisualInsetPadding,
  resolveDirectionalSvgWidthFromHeight
} from '@/utils/directionalSizing.js';

function createPipeLayer({ index, outerRadius, innerRadius, pipeType = 'casing' }) {
  return {
    material: 'steel',
    innerRadius,
    outerRadius,
    source: {
      type: 'pipe',
      pipeType,
      index,
      sourceIndex: index
    }
  };
}

describe('directionalSizing visual sizing', () => {
  it('keeps nested visual radii monotonic and readable for tight physical gaps', () => {
    const outerPipe = createPipeLayer({ index: 0, outerRadius: 10, innerRadius: 9.4 });
    const annulusLayer = {
      material: 'fluid',
      innerRadius: 6.15,
      outerRadius: 9.4,
      source: { type: 'fluid', index: 0 }
    };
    const innerPipe = createPipeLayer({ index: 1, outerRadius: 6.15, innerRadius: 5.7 });

    const visualSizing = buildDirectionalVisualSizing({
      intervals: [
        {
          top: 0,
          bottom: 1000,
          stack: [
            outerPipe,
            annulusLayer,
            innerPipe
          ]
        }
      ]
    });

    const outerPipeVisual = resolveDirectionalLayerVisualRadii(outerPipe, visualSizing);
    const annulusVisual = resolveDirectionalLayerVisualRadii(annulusLayer, visualSizing);
    const innerPipeVisual = resolveDirectionalLayerVisualRadii(innerPipe, visualSizing);

    expect(outerPipeVisual.outerRadius).toBeGreaterThan(innerPipeVisual.outerRadius);
    expect(outerPipeVisual.wallThickness).toBeGreaterThanOrEqual(3);
    expect(innerPipeVisual.wallThickness).toBeGreaterThanOrEqual(3);
    expect(annulusVisual.outerRadius - annulusVisual.innerRadius).toBeGreaterThanOrEqual(4);
    expect(visualSizing.maxVisualRadiusPx).toBeCloseTo(outerPipeVisual.outerRadius, 6);
  });

  it('keeps same-od pipes visually distinct by wall thickness using pipe identity', () => {
    const lightWallPipe = createPipeLayer({ index: 0, outerRadius: 5, innerRadius: 4.7 });
    const heavyWallPipe = createPipeLayer({ index: 1, outerRadius: 5, innerRadius: 4.2 });

    const visualSizing = buildDirectionalVisualSizing({
      intervals: [
        { top: 0, bottom: 1000, stack: [lightWallPipe] },
        { top: 1000, bottom: 2000, stack: [heavyWallPipe] }
      ]
    });

    const lightGeometry = resolveDirectionalPipeVisualGeometry({ pipeType: 'casing', rowIndex: 0 }, visualSizing);
    const heavyGeometry = resolveDirectionalPipeVisualGeometry({ pipeType: 'casing', rowIndex: 1 }, visualSizing);

    expect(lightGeometry).not.toBeNull();
    expect(heavyGeometry).not.toBeNull();
    expect(lightGeometry.outerRadius).toBeCloseTo(heavyGeometry.outerRadius, 6);
    expect(heavyGeometry.wallThickness).toBeGreaterThan(lightGeometry.wallThickness);
  });

  it('keeps smaller high-wall-ratio strings visibly thicker than larger thin-wall strings', () => {
    const largeThinPipe = createPipeLayer({ index: 0, outerRadius: 15, innerRadius: 14.1 });
    const smallThickPipe = createPipeLayer({ index: 1, outerRadius: 2.5, innerRadius: 1.6 });

    const visualSizing = buildDirectionalVisualSizing({
      intervals: [
        {
          top: 0,
          bottom: 1000,
          stack: [largeThinPipe, smallThickPipe]
        }
      ]
    });

    const largeThinGeometry = resolveDirectionalPipeVisualGeometry({ pipeType: 'casing', rowIndex: 0 }, visualSizing);
    const smallThickGeometry = resolveDirectionalPipeVisualGeometry({ pipeType: 'casing', rowIndex: 1 }, visualSizing);

    expect(smallThickGeometry.wallThickness).toBeGreaterThan(largeThinGeometry.wallThickness);
  });

  it('expands directional width calculations with visual inset padding from widened geometry', () => {
    const insetPadding = resolveDirectionalVisualInsetPadding({
      visualMaxRadiusPx: 40,
      formationThicknessPx: 18
    });
    const widthWithInsets = resolveDirectionalSvgWidthFromHeightWithInsets(
      800,
      2,
      {
        top: 60,
        right: 120,
        bottom: 80,
        left: 120
      },
      insetPadding
    );
    const legacyWidth = resolveDirectionalSvgWidthFromHeight(800, 2);

    expect(insetPadding.horizontal).toBeGreaterThan(40);
    expect(insetPadding.vertical).toBeGreaterThan(0);
    expect(widthWithInsets).toBeGreaterThan(legacyWidth);
  });

  it('reserves a larger left inset than right inset to keep the y axis clear of widened geometry', () => {
    const insetPadding = resolveDirectionalVisualInsetPadding({
      visualMaxRadiusPx: 40,
      formationThicknessPx: 18
    });
    const insetRange = resolveDirectionalPlotInsetRange(
      1400,
      800,
      {
        top: 60,
        right: 120,
        bottom: 80,
        left: 120
      },
      insetPadding
    );

    expect(insetPadding.left).toBeGreaterThan(insetPadding.right);
    expect(insetRange.left - 120).toBeCloseTo(insetPadding.left, 6);
  });
});
