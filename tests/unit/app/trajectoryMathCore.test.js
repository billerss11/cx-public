import { describe, expect, it } from 'vitest';
import {
  buildProjectedTrajectory,
  hasTrajectoryDefinitionRows,
  resolveTrajectoryPointsFromRows
} from '@/app/trajectoryMathCore.mjs';

describe('trajectoryMathCore', () => {
  it('projects trajectory using manual vertical section azimuth', () => {
    const points = [
      { md: 0, tvd: 0, north: 0, east: 0 },
      { md: 100, tvd: 95, north: 0, east: 20 }
    ];

    const projected = buildProjectedTrajectory(points, {
      verticalSectionMode: 'manual',
      verticalSectionAzimuth: 90
    });

    expect(projected).toHaveLength(2);
    expect(projected[1].x).toBeCloseTo(20, 6);
  });

  it('resolves fallback synthetic surveys from casing depth when rows are empty', () => {
    const projected = resolveTrajectoryPointsFromRows(
      [],
      {
        units: 'ft',
        verticalSectionMode: 'manual',
        verticalSectionAzimuth: 0
      },
      {
        casingData: [{ top: 0, bottom: 1200 }]
      }
    );

    expect(projected).toHaveLength(2);
    expect(projected[0].md).toBe(0);
    expect(projected[1].md).toBe(1200);
    expect(projected[1].tvd).toBeCloseTo(1200, 6);
  });

  it('builds projected points from survey rows', () => {
    const projected = resolveTrajectoryPointsFromRows(
      [
        { md: 0, inc: 0, azi: 0 },
        { md: 1000, inc: 0, azi: 0 }
      ],
      {
        units: 'ft',
        verticalSectionMode: 'manual',
        verticalSectionAzimuth: 0
      }
    );

    expect(projected).toHaveLength(2);
    expect(projected[1].md).toBe(1000);
    expect(projected[1].tvd).toBeCloseTo(1000, 6);
    expect(projected[1].x).toBeCloseTo(0, 6);
  });

  it('detects when trajectory rows contain explicit trajectory definition', () => {
    expect(hasTrajectoryDefinitionRows([])).toBe(false);
    expect(hasTrajectoryDefinitionRows([{ md: 0, inc: 0, azi: 0 }])).toBe(false);
    expect(hasTrajectoryDefinitionRows([
      { md: 0, inc: 0, azi: 0 },
      { md: 1000, inc: 5, azi: 90 }
    ])).toBe(true);
  });

  it('detects legacy cartesian trajectory rows as explicit definition only when path is valid', () => {
    expect(hasTrajectoryDefinitionRows([
      { x: 0, tvd: 0 },
      { x: 100, tvd: 200 }
    ])).toBe(true);

    expect(hasTrajectoryDefinitionRows([
      { x: 0, tvd: 0 },
      { x: 0, tvd: 0 }
    ])).toBe(false);
  });
});
