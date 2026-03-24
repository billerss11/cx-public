import { describe, expect, it } from 'vitest';
import { buildDirectionalOpenHoleSideGeometry } from '@/utils/directionalOpenHoleGeometry.js';

describe('directionalOpenHoleGeometry', () => {
  it('keeps long directional open-hole sides wavy while reusing the same displayed boundary samples for formation fill', () => {
    const sideSamples = [
      { outer: [0, 0], inner: [10, 0] },
      { outer: [0, 30], inner: [10, 30] },
      { outer: [0, 60], inner: [10, 60] },
      { outer: [0, 90], inner: [10, 90] }
    ];

    const geometry = buildDirectionalOpenHoleSideGeometry(sideSamples, { amplitude: 3, wavelength: 24 }, {
      seed: 7,
      formationThicknessPx: 18
    });

    expect(geometry.mode).toBe('wavy');
    expect(geometry.effectiveAmplitude).toBeGreaterThan(0.5);
    expect(geometry.boundaryPoints).toHaveLength(sideSamples.length);
    expect(geometry.formationPoints).toHaveLength(sideSamples.length);
    expect(geometry.formationPoints[1][0]).toBeLessThan(geometry.boundaryPoints[1][0]);
  });

  it('suppresses noisy waviness on short curved open-hole sides', () => {
    const sideSamples = [
      { outer: [0, 0], inner: [10, 0] },
      { outer: [-5, 8], inner: [5, 8] },
      { outer: [-2, 15], inner: [8, 15] }
    ];

    const geometry = buildDirectionalOpenHoleSideGeometry(sideSamples, { amplitude: 3, wavelength: 24 }, {
      seed: 3,
      formationThicknessPx: 18
    });

    expect(geometry.mode).toBe('smooth');
    expect(geometry.effectiveAmplitude).toBe(0);
    expect(geometry.boundaryPoints).toEqual(sideSamples.map((sample) => sample.outer));
  });
});
