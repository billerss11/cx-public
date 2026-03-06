import { describe, expect, it } from 'vitest';
import { resolveCurveValueAtDepth } from '@/utils/lasCursorLookup.js';

describe('lasCursorLookup', () => {
  it('returns exact value when the depth matches a point', () => {
    const result = resolveCurveValueAtDepth(
      [
        [1000, 10],
        [1010, 20],
      ],
      1010
    );

    expect(result.status).toBe('exact');
    expect(result.value).toBe(20);
  });

  it('returns interpolated value between two finite points', () => {
    const result = resolveCurveValueAtDepth(
      [
        [1000, 10],
        [1010, 20],
      ],
      1005
    );

    expect(result.status).toBe('interpolated');
    expect(result.value).toBeCloseTo(15, 8);
  });

  it('treats descending depth arrays as valid input', () => {
    const result = resolveCurveValueAtDepth(
      [
        [1020, 40],
        [1010, 20],
        [1000, 10],
      ],
      1015
    );

    expect(result.status).toBe('interpolated');
    expect(result.value).toBeCloseTo(30, 8);
  });

  it('returns no_data when exact depth value is null', () => {
    const result = resolveCurveValueAtDepth(
      [
        [1000, null],
        [1010, 20],
      ],
      1000
    );

    expect(result.status).toBe('no_data');
    expect(result.value).toBeNull();
  });

  it('returns out_of_range when the requested depth is outside curve coverage', () => {
    const result = resolveCurveValueAtDepth(
      [
        [1000, 10],
        [1010, 20],
      ],
      990
    );

    expect(result.status).toBe('out_of_range');
    expect(result.value).toBeNull();
  });
});
