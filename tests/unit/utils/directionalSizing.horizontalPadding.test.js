import { describe, expect, it } from 'vitest';
import {
  resolveDirectionalHorizontalPadding,
  resolveVerticalEquivalentXHalf
} from '@/utils/directionalSizing.js';

describe('directionalSizing horizontal padding fallback', () => {
  it('resolves vertical-equivalent x-half using vertical width policy', () => {
    const xHalf = resolveVerticalEquivalentXHalf({
      maxCasingOuterRadius: 9.625 / 2,
      maxStackOuterRadius: 9.625 / 2,
      diameterScale: 5,
      widthMultiplier: 3.5
    });

    expect(xHalf).toBeCloseTo(84.21875, 6);
  });

  it('keeps radial padding when explicit trajectory rows exist', () => {
    const padding = resolveDirectionalHorizontalPadding({
      maxProjectedRadius: 40,
      hasTrajectoryDefinition: true,
      verticalEquivalentXHalf: 120
    });

    expect(padding).toBe(60);
  });

  it('uses max(radial padding, vertical-equivalent x-half) when trajectory definition is absent', () => {
    const padding = resolveDirectionalHorizontalPadding({
      maxProjectedRadius: 40,
      hasTrajectoryDefinition: false,
      verticalEquivalentXHalf: 120
    });

    expect(padding).toBe(120);
  });

  it('falls back to radial padding when vertical-equivalent x-half is invalid', () => {
    const padding = resolveDirectionalHorizontalPadding({
      maxProjectedRadius: 12,
      hasTrajectoryDefinition: false,
      verticalEquivalentXHalf: null
    });

    expect(padding).toBe(18);
  });
});
