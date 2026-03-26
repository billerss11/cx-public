import { describe, expect, it } from 'vitest';
import {
  resolveDirectionalReferenceHorizonDepthMeta,
  syncDirectionalReferenceHorizonRow
} from '@/utils/referenceHorizons.js';

const trajectoryPoints = [
  { md: 0, x: 0, tvd: 0 },
  { md: 1000, x: 700, tvd: 600 },
  { md: 2000, x: 1500, tvd: 1100 }
];

describe('referenceHorizons', () => {
  it('hydrates missing directional md/tvd pair from legacy depth', () => {
    const row = syncDirectionalReferenceHorizonRow(
      {
        depth: 1000,
        label: 'Landing'
      },
      trajectoryPoints
    );

    expect(row).toMatchObject({
      depth: 1000,
      directionalDepthMd: 1000,
      directionalDepthTvd: 600,
      directionalDepthMode: 'tvd'
    });
  });

  it('syncs directional tvd from md edits', () => {
    const row = syncDirectionalReferenceHorizonRow(
      {
        depth: 1000,
        directionalDepthMd: 2000,
        directionalDepthTvd: 600
      },
      trajectoryPoints,
      { sourceField: 'directionalDepthMd' }
    );

    expect(row).toMatchObject({
      directionalDepthMd: 2000,
      directionalDepthTvd: 1100,
      directionalDepthMode: 'md'
    });
  });

  it('syncs directional md from tvd edits', () => {
    const row = syncDirectionalReferenceHorizonRow(
      {
        depth: 1000,
        directionalDepthMd: 1000,
        directionalDepthTvd: 600
      },
      trajectoryPoints,
      { sourceField: 'directionalDepthTvd', sourceValue: 1100 }
    );

    expect(row.directionalDepthMd).toBeCloseTo(2000, 6);
    expect(row.directionalDepthTvd).toBe(1100);
    expect(row.directionalDepthMode).toBe('tvd');
  });

  it('resolves active directional horizon depth metadata by mode', () => {
    const row = {
      depth: 1000,
      directionalDepthMd: 1500,
      directionalDepthTvd: 850,
      directionalDepthMode: 'md'
    };

    expect(resolveDirectionalReferenceHorizonDepthMeta(row)).toEqual({
      mode: 'md',
      primaryDepth: 1500,
      secondaryDepth: 850,
      primaryLabel: 'MD',
      secondaryLabel: 'TVD'
    });

    expect(resolveDirectionalReferenceHorizonDepthMeta({
      ...row,
      directionalDepthMode: 'tvd'
    })).toEqual({
      mode: 'tvd',
      primaryDepth: 850,
      secondaryDepth: 1500,
      primaryLabel: 'TVD',
      secondaryLabel: 'MD'
    });
  });
});
