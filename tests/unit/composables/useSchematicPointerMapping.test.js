import { describe, expect, it, vi } from 'vitest';

const resolveSvgPointerPositionMock = vi.hoisted(() => vi.fn());

vi.mock('@/composables/useSchematicInteraction.js', () => ({
  resolveSvgPointerPosition: resolveSvgPointerPositionMock
}));

import { createSchematicPointerMapping } from '@/composables/useSchematicPointerMapping.js';

describe('useSchematicPointerMapping', () => {
  it('returns screen/svg/canonical points with identity camera', () => {
    resolveSvgPointerPositionMock.mockReturnValueOnce({ x: 120, y: 340 });

    const mapping = createSchematicPointerMapping({
      svgElement: null
    });

    const result = mapping.resolvePointer({ clientX: 800, clientY: 600 });

    expect(result).toEqual({
      screenPoint: { x: 800, y: 600 },
      svgPoint: { x: 120, y: 340 },
      canonicalPoint: { x: 120, y: 340 },
      camera: { scale: 1, translateX: 0, translateY: 0 }
    });
  });

  it('applies inverse camera transform to produce canonical point', () => {
    resolveSvgPointerPositionMock.mockReturnValueOnce({ x: 500, y: 260 });

    const mapping = createSchematicPointerMapping({
      svgElement: null,
      resolveCamera: () => ({ scale: 2, translateX: 100, translateY: 20 })
    });

    const result = mapping.resolvePointer({ clientX: 1000, clientY: 720 });

    expect(result.svgPoint).toEqual({ x: 500, y: 260 });
    expect(result.canonicalPoint).toEqual({ x: 200, y: 120 });
  });

  it('reports failure when pointer mapping cannot resolve svg point', () => {
    const onFailure = vi.fn();
    resolveSvgPointerPositionMock.mockReturnValueOnce(null);

    const mapping = createSchematicPointerMapping({
      svgElement: null,
      onFailure
    });

    const result = mapping.resolvePointer({ clientX: 10, clientY: 20 });

    expect(result).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('returns null and reports failure for invalid screen coordinates', () => {
    const onFailure = vi.fn();
    const mapping = createSchematicPointerMapping({
      svgElement: null,
      onFailure
    });

    const result = mapping.resolvePointer({ clientX: Number.NaN, clientY: 20 });

    expect(result).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
