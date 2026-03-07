import { describe, expect, it } from 'vitest';
import {
  SMART_LABEL_INITIAL_GAP_PX,
  SMART_LABEL_MAX_MOVE_PASSES,
  SMART_LABEL_MAX_SHRINK_PASSES,
  SMART_LABEL_SHRINK_STEP_PX,
  applyDeterministicSmartLabelLayout,
  resolveSmartLabelAutoScale,
  resolveSmartLabelFontSize
} from '@/utils/smartLabels.js';

describe('smart label typography utilities', () => {
  it('resolves deterministic auto-scale from density only', () => {
    expect(resolveSmartLabelAutoScale({
      totalPreferredLabelHeight: 0,
      availableTrackHeight: 1000
    })).toBe(1);
    expect(resolveSmartLabelAutoScale({
      totalPreferredLabelHeight: 300,
      availableTrackHeight: 600
    })).toBe(1.25);
    expect(resolveSmartLabelAutoScale({
      totalPreferredLabelHeight: 1200,
      availableTrackHeight: 600
    })).toBe(0.85);
  });

  it('resolves effective label font with auto + manual scaling and clamping', () => {
    expect(resolveSmartLabelFontSize(12, {
      manualScale: 1,
      autoScale: 1
    })).toBe(12);
    expect(resolveSmartLabelFontSize(12, {
      manualScale: 1.5,
      autoScale: 1.2
    })).toBeCloseTo(21.6, 6);
    expect(resolveSmartLabelFontSize(12, {
      manualScale: 10,
      autoScale: 2
    })).toBe(24);
    expect(resolveSmartLabelFontSize(2, {
      manualScale: 0.1,
      autoScale: 0.1
    })).toBe(8);
  });
});

describe('smart label placement utilities', () => {
  it('keeps candidate count unchanged (no-hide invariant)', () => {
    const source = [
      {
        id: 'a',
        side: 'left',
        preferredCenterY: 120,
        centerY: 120,
        boxHeight: 40,
        boxWidth: 120,
        boxX: 40,
        baseFontPx: 12,
        fontSize: 12,
        isPositionPinned: false
      },
      {
        id: 'b',
        side: 'left',
        preferredCenterY: 125,
        centerY: 125,
        boxHeight: 40,
        boxWidth: 120,
        boxX: 40,
        baseFontPx: 12,
        fontSize: 12,
        isPositionPinned: false
      }
    ];

    const result = applyDeterministicSmartLabelLayout(source, {
      bounds: {
        top: 0,
        bottom: 200,
        left: 0,
        right: 400
      }
    });

    expect(result).toHaveLength(source.length);
  });

  it('keeps pinned labels fixed except for hard bounds clamp', () => {
    const source = [
      {
        id: 'pinned',
        side: 'left',
        preferredCenterY: 60,
        centerY: 60,
        boxHeight: 30,
        boxWidth: 100,
        boxX: 30,
        baseFontPx: 12,
        fontSize: 12,
        isPositionPinned: true
      },
      {
        id: 'movable',
        side: 'left',
        preferredCenterY: 64,
        centerY: 64,
        boxHeight: 30,
        boxWidth: 100,
        boxX: 30,
        baseFontPx: 12,
        fontSize: 12,
        isPositionPinned: false
      }
    ];

    const result = applyDeterministicSmartLabelLayout(source, {
      bounds: {
        top: 0,
        bottom: 200,
        left: 0,
        right: 400
      }
    });

    const pinned = result.find((item) => item.id === 'pinned');
    expect(pinned?.centerY).toBe(60);
  });

  it('uses bounded move/shrink iteration caps and can swap side for movable labels', () => {
    const source = [
      {
        id: 'movable-overlap',
        side: 'left',
        preferredCenterY: 120,
        centerY: 120,
        boxHeight: 60,
        boxWidth: 160,
        boxX: 30,
        baseFontPx: 14,
        fontSize: 14,
        isPositionPinned: false,
        canSwapSide: true
      },
      {
        id: 'pinned-overlap',
        side: 'left',
        preferredCenterY: 120,
        centerY: 120,
        boxHeight: 60,
        boxWidth: 160,
        boxX: 30,
        baseFontPx: 14,
        fontSize: 14,
        isPositionPinned: true
      }
    ];

    const result = applyDeterministicSmartLabelLayout(source, {
      bounds: {
        top: 0,
        bottom: 180,
        left: 0,
        right: 400
      },
      initialGap: SMART_LABEL_INITIAL_GAP_PX,
      shrinkStep: SMART_LABEL_SHRINK_STEP_PX,
      maxMovePasses: SMART_LABEL_MAX_MOVE_PASSES,
      maxShrinkPasses: SMART_LABEL_MAX_SHRINK_PASSES
    });

    const movable = result.find((item) => item.id === 'movable-overlap');
    expect(['left', 'right']).toContain(movable?.side);
    expect(Number(movable?.fontSize)).toBeLessThanOrEqual(14);
  });

  it('remains deterministic for identical inputs', () => {
    const source = [
      {
        id: 'alpha',
        side: 'left',
        preferredCenterY: 40,
        centerY: 40,
        boxHeight: 28,
        boxWidth: 140,
        boxX: 20,
        baseFontPx: 11,
        fontSize: 11,
        isPositionPinned: false
      },
      {
        id: 'bravo',
        side: 'left',
        preferredCenterY: 45,
        centerY: 45,
        boxHeight: 28,
        boxWidth: 140,
        boxX: 20,
        baseFontPx: 11,
        fontSize: 11,
        isPositionPinned: false
      }
    ];
    const options = {
      bounds: {
        top: 0,
        bottom: 180,
        left: 0,
        right: 300
      },
      initialGap: SMART_LABEL_INITIAL_GAP_PX,
      shrinkStep: SMART_LABEL_SHRINK_STEP_PX,
      maxMovePasses: SMART_LABEL_MAX_MOVE_PASSES,
      maxShrinkPasses: SMART_LABEL_MAX_SHRINK_PASSES
    };

    const first = applyDeterministicSmartLabelLayout(source, options);
    const second = applyDeterministicSmartLabelLayout(source, options);
    expect(second).toEqual(first);
  });

  it('clamps pinned labels to hard bounds without reflowing them elsewhere', () => {
    const source = [
      {
        id: 'pinned-outside',
        side: 'right',
        preferredCenterY: -20,
        centerY: -20,
        boxHeight: 20,
        boxWidth: 120,
        boxX: 100,
        baseFontPx: 10,
        fontSize: 10,
        isPositionPinned: true
      }
    ];

    const result = applyDeterministicSmartLabelLayout(source, {
      bounds: {
        top: 0,
        bottom: 160,
        left: 0,
        right: 300
      }
    });
    const pinned = result[0];
    expect(pinned.centerY).toBe(10);
    expect(pinned.boxY).toBe(0);
  });
});
