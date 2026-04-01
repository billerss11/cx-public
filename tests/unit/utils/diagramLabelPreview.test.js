import { describe, expect, it } from 'vitest';
import {
  applyPreviewToArrowedBoxLabel,
  applyPreviewToDirectionalLineLabel,
  applyPreviewToDirectionalLineOverlay
} from '@/utils/diagramLabelPreview.js';

function buildArrowGeometry(startX, startY, endX, endY) {
  return {
    lineX1: startX,
    lineY1: startY,
    lineX2: endX,
    lineY2: endY
  };
}

function buildArrowHeadPoints(start, end) {
  return `${start[0]},${start[1]} ${end[0]},${end[1]}`;
}

function resolvePointToLineDistance({ x1, y1, x2, y2, x, y }) {
  const dx = Number(x2) - Number(x1);
  const dy = Number(y2) - Number(y1);
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 1e-6) return null;
  return Math.abs((dy * Number(x)) - (dx * Number(y)) + (Number(x2) * Number(y1)) - (Number(y2) * Number(x1))) / length;
}

describe('diagramLabelPreview', () => {
  it('shifts the label box while keeping the anchor fixed for arrowed labels', () => {
    const previewed = applyPreviewToArrowedBoxLabel(
      {
        id: 'label-1',
        boxX: 100,
        boxY: 200,
        boxWidth: 80,
        boxHeight: 20,
        anchorX: 40,
        anchorY: 210,
        textRows: [
          { id: 'row-1', x: 140, y: 212, text: 'Label' }
        ]
      },
      'label-1',
      { x: 25, y: 10 },
      { buildArrowGeometry }
    );

    expect(previewed.boxX).toBe(125);
    expect(previewed.boxY).toBe(210);
    expect(previewed.textRows[0]).toMatchObject({ x: 165, y: 222 });
    expect(previewed.anchorX).toBe(40);
    expect(previewed.anchorY).toBe(210);
    expect(previewed.arrow).toEqual({
      lineX1: 125,
      lineY1: 220,
      lineX2: 40,
      lineY2: 210
    });
  });

  it('recomputes line-end geometry for depth callouts while keeping the start anchor fixed', () => {
    const previewed = applyPreviewToArrowedBoxLabel(
      {
        id: 'depth-1',
        boxX: 90,
        boxY: 100,
        boxWidth: 60,
        boxHeight: 20,
        lineX1: 50,
        lineY1: 110,
        textX: 120,
        textY: 110
      },
      'depth-1',
      { x: 30, y: 15 },
      { buildArrowHeadPoints }
    );

    expect(previewed.boxX).toBe(120);
    expect(previewed.boxY).toBe(115);
    expect(previewed.textX).toBe(150);
    expect(previewed.textY).toBe(125);
    expect(previewed.lineX1).toBe(50);
    expect(previewed.lineY1).toBe(110);
    expect(previewed.lineX2).toBe(120);
    expect(previewed.lineY2).toBe(125);
    expect(previewed.arrowHeadPoints).toBe('120,125 50,110');
  });

  it('recomputes directional md horizon line geometry while dragging instead of freezing the original angle', () => {
    const previewed = applyPreviewToDirectionalLineOverlay(
      {
        id: 'line-1',
        activeMode: 'md',
        centerlineAnchorX: 50,
        centerlineAnchorY: 200,
        centerlineOffsetPx: 0,
        normalOffsetPx: 0,
        textAnchor: 'middle',
        anchorScreenX: 50,
        anchorScreenY: 200,
        boxWidth: 40,
        boxHeight: 20,
        y: 200,
        x1: 0,
        y1: 200,
        x2: 100,
        y2: 200,
        boxY: 190,
        textY: 200
      },
      'line-1',
      { x: 0, y: 20 },
      {
        resolveDepthFromPreviewY: (screenY) => screenY,
        resolveSegmentAtDepth: (depth) => {
          if (depth !== 220) return null;
          return {
            centerlineAnchorX: 50,
            centerlineAnchorY: 220,
            x1: 10,
            y1: 200,
            x2: 90,
            y2: 240
          };
        }
      }
    );

    expect(previewed.y).toBe(220);
    expect(previewed.x1).toBe(10);
    expect(previewed.y1).toBe(200);
    expect(previewed.x2).toBe(90);
    expect(previewed.y2).toBe(240);
    const centerX = Number(previewed.boxX) + (Number(previewed.boxWidth) / 2);
    const centerY = Number(previewed.boxY) + (Number(previewed.boxHeight) / 2);
    const distance = resolvePointToLineDistance({
      x1: previewed.x1,
      y1: previewed.y1,
      x2: previewed.x2,
      y2: previewed.y2,
      x: centerX,
      y: centerY
    });
    expect(distance).toBeCloseTo(0, 3);
  });

  it('slides a directional md horizon label along the existing line without free vertical drift', () => {
    const previewed = applyPreviewToDirectionalLineLabel(
      {
        id: 'line-1',
        activeMode: 'md',
        centerlineAnchorX: 50,
        centerlineAnchorY: 220,
        centerlineOffsetPx: 25,
        normalOffsetPx: 0,
        textAnchor: 'middle',
        anchorScreenX: 75,
        x1: 0,
        y1: 200,
        x2: 100,
        y2: 240,
        boxX: 40,
        boxY: 204,
        boxWidth: 40,
        boxHeight: 20,
        textX: 60,
        textY: 214
      },
      'line-1:label',
      { x: 20, y: 30 },
      { bounds: { left: 0, right: 100 } }
    );

    const centerX = Number(previewed.boxX) + (Number(previewed.boxWidth) / 2);
    const centerY = Number(previewed.boxY) + (Number(previewed.boxHeight) / 2);
    const distance = resolvePointToLineDistance({
      x1: previewed.x1,
      y1: previewed.y1,
      x2: previewed.x2,
      y2: previewed.y2,
      x: centerX,
      y: centerY
    });
    const expectedProjectedDelta = ((20 * 100) + (30 * 40)) / Math.hypot(100, 40);
    const expectedOffsetPx = 25 + expectedProjectedDelta;
    const expectedAnchorX = 50 + ((100 / Math.hypot(100, 40)) * expectedOffsetPx);

    expect(previewed.centerlineOffsetPx).toBeCloseTo(expectedOffsetPx, 3);
    expect(previewed.anchorScreenX).toBeCloseTo(expectedAnchorX, 3);
    expect(distance).toBeCloseTo(0, 3);
  });

  it('re-anchors a directional md horizon label to the next preview segment instead of preserving stale vertical offset', () => {
    const previewed = applyPreviewToDirectionalLineOverlay(
      {
        id: 'line-1',
        activeMode: 'md',
        centerlineAnchorX: 50,
        centerlineAnchorY: 220,
        centerlineOffsetPx: 25,
        normalOffsetPx: 0,
        textAnchor: 'middle',
        anchorScreenX: 75,
        y: 200,
        x1: 0,
        y1: 200,
        x2: 100,
        y2: 240,
        boxX: 40,
        boxY: 240,
        boxWidth: 40,
        boxHeight: 20,
        textX: 60,
        textY: 250
      },
      'line-1',
      { x: 0, y: 20 },
      {
        resolveDepthFromPreviewY: (screenY) => screenY,
        resolveSegmentAtDepth: (depth) => {
          if (depth !== 220) return null;
          return {
            centerlineAnchorX: 55,
            centerlineAnchorY: 232.5,
            x1: 10,
            y1: 210,
            x2: 90,
            y2: 250
          };
        }
      }
    );

    const centerX = Number(previewed.boxX) + (Number(previewed.boxWidth) / 2);
    const centerY = Number(previewed.boxY) + (Number(previewed.boxHeight) / 2);
    const distance = resolvePointToLineDistance({
      x1: previewed.x1,
      y1: previewed.y1,
      x2: previewed.x2,
      y2: previewed.y2,
      x: centerX,
      y: centerY
    });

    expect(previewed.y).toBe(230);
    expect(previewed.x1).toBe(10);
    expect(previewed.y1).toBe(210);
    expect(previewed.x2).toBe(90);
    expect(previewed.y2).toBe(250);
    expect(previewed.centerlineAnchorX).toBe(55);
    expect(previewed.centerlineAnchorY).toBe(232.5);
    expect(previewed.centerlineOffsetPx).toBe(25);
    expect(distance).toBeCloseTo(0, 3);
  });
});
