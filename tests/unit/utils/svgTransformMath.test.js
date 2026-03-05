import { describe, expect, it } from 'vitest';
import {
  applyCameraPoint,
  buildCameraTransform,
  clampPan,
  clampZoom,
  invertCameraPoint
} from '@/utils/svgTransformMath.js';

describe('svgTransformMath', () => {
  it('builds translate + scale transform string from camera state', () => {
    const transform = buildCameraTransform({ scale: 2.5, translateX: 12, translateY: -6 });
    expect(transform).toBe('translate(12 -6) scale(2.5)');
  });

  it('uses identity transform defaults when camera state is missing', () => {
    expect(buildCameraTransform(null)).toBe('translate(0 0) scale(1)');
  });

  it('round-trips a point through forward and inverse camera transforms', () => {
    const camera = { scale: 2.25, translateX: 144.5, translateY: -72.25 };
    const source = { x: -34.75, y: 612.125 };

    const transformed = applyCameraPoint(source, camera);
    const restored = invertCameraPoint(transformed, camera);

    expect(restored.x).toBeCloseTo(source.x, 10);
    expect(restored.y).toBeCloseTo(source.y, 10);
  });

  it('keeps inverse stability for very small and very large scale factors', () => {
    const source = { x: 12456.789, y: -9321.1234 };

    const tinyCamera = { scale: 1e-4, translateX: 5000, translateY: -3000 };
    const tinyRestored = invertCameraPoint(applyCameraPoint(source, tinyCamera), tinyCamera);
    expect(tinyRestored.x).toBeCloseTo(source.x, 8);
    expect(tinyRestored.y).toBeCloseTo(source.y, 8);

    const hugeCamera = { scale: 2.5e3, translateX: -1.2e6, translateY: 8.5e5 };
    const hugeRestored = invertCameraPoint(applyCameraPoint(source, hugeCamera), hugeCamera);
    expect(hugeRestored.x).toBeCloseTo(source.x, 8);
    expect(hugeRestored.y).toBeCloseTo(source.y, 8);
  });

  it('clamps zoom inside provided bounds and normalizes invalid values', () => {
    expect(clampZoom(3.25, { min: 0.5, max: 4 })).toBe(3.25);
    expect(clampZoom(99, { min: 0.5, max: 4 })).toBe(4);
    expect(clampZoom(-4, { min: 0.5, max: 4 })).toBe(0.5);
    expect(clampZoom('invalid', { min: 0.5, max: 4, fallback: 2 })).toBe(2);
  });

  it('clamps pan x/y independently within configured bounds', () => {
    const clamped = clampPan(
      { x: 120, y: -80 },
      {
        minX: -40,
        maxX: 80,
        minY: -30,
        maxY: 60
      }
    );

    expect(clamped).toEqual({ x: 80, y: -30 });
  });
});
