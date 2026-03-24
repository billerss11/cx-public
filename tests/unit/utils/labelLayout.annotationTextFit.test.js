import { describe, expect, it } from 'vitest';
import * as labelLayout from '@/utils/labelLayout.js';

describe('resolveAnnotationTextBlockLayout', () => {
  it('keeps all lines visible and separated when the annotation interval is too short', () => {
    const result = labelLayout.resolveAnnotationTextBlockLayout({
      topY: 100,
      bottomY: 118,
      preferredCenterY: 109,
      lines: [
        {
          id: 'title',
          text: 'Reservoir interval',
          fontSize: 12,
          fontWeight: 'bold',
        },
        {
          id: 'detail',
          text: 'Main sandstone, porosity 32%',
          fontSize: 10,
          fontWeight: 'normal',
        },
      ],
    });

    expect(result.lines).toHaveLength(2);
    expect(result.overflowsBand).toBe(true);
    expect(result.lines[0].fontSize).toBeGreaterThanOrEqual(8);
    expect(result.lines[1].fontSize).toBeGreaterThanOrEqual(8);
    expect(result.lines[1].y - result.lines[0].y).toBeGreaterThanOrEqual(result.lineHeight - 0.01);
    expect(result.blockTopY).toBeLessThan(100);
    expect(result.blockBottomY).toBeGreaterThan(118);
  });

  it('keeps text inside the interval when the band has enough room', () => {
    const result = labelLayout.resolveAnnotationTextBlockLayout({
      topY: 100,
      bottomY: 180,
      preferredCenterY: 140,
      lines: [
        {
          id: 'title',
          text: 'Pay zone',
          fontSize: 12,
          fontWeight: 'bold',
        },
        {
          id: 'detail',
          text: 'Monitor pressure drawdown',
          fontSize: 10,
          fontWeight: 'normal',
        },
      ],
    });

    expect(result.lines).toHaveLength(2);
    expect(result.overflowsBand).toBe(false);
    expect(result.blockTopY).toBeGreaterThanOrEqual(100);
    expect(result.blockBottomY).toBeLessThanOrEqual(180);
    expect(result.lines[1].y - result.lines[0].y).toBeGreaterThanOrEqual(result.lineHeight - 0.01);
  });
});
