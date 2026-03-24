import { describe, expect, it } from 'vitest';
import {
  buildDirectionalProjector,
  resolveProjectedDepthBounds
} from '@/components/schematic/layers/directionalProjection.js';

describe('directionalProjection projected depth bounds', () => {
  it('projects casing MD bounds into TVD space and clamps to the trajectory extent', () => {
    const trajectoryPoints = [
      { md: 0, x: 0, tvd: 0 },
      { md: 1000, x: 500, tvd: 800 },
      { md: 2000, x: 1000, tvd: 1400 }
    ];

    const bounds = resolveProjectedDepthBounds(
      [
        { top: 500, bottom: 1500 },
        { top: 1600, bottom: 2600 }
      ],
      trajectoryPoints,
      {
        topKey: 'top',
        bottomKey: 'bottom'
      }
    );

    expect(bounds).not.toBeNull();
    expect(bounds.min).toBeCloseTo(400, 6);
    expect(bounds.max).toBeCloseTo(1400, 6);
    expect(bounds.max).not.toBe(2600);
  });

  it('returns null when no valid projected depth rows are available', () => {
    const bounds = resolveProjectedDepthBounds(
      [{ top: 1000, bottom: 1000 }],
      [{ md: 0, x: 0, tvd: 0 }]
    );

    expect(bounds).toBeNull();
  });

  it('treats directional offsets as presentation pixels instead of x-domain units', () => {
    const projector = buildDirectionalProjector(
      [
        { md: 0, x: 0, tvd: 0 },
        { md: 100, x: 0, tvd: 100 }
      ],
      (value) => 100 + (Number(value) * 10),
      (value) => 200 + (Number(value) * 10),
      { xExaggeration: 1, xOrigin: 0 }
    );

    const center = projector(50, 0);
    const offset = projector(50, 5);
    const distance = Math.hypot(offset[0] - center[0], offset[1] - center[1]);

    expect(distance).toBeCloseTo(5, 6);
  });
});
