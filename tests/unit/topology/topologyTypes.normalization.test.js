import { describe, expect, it } from 'vitest';
import {
  TOPOLOGY_VOLUME_KINDS,
  normalizeSourceVolumeKind
} from '@/topology/topologyTypes.js';

describe('topologyTypes canonical volume normalization', () => {
  it('exposes canonical topology volume kinds without TUBING_ANNULUS', () => {
    expect(TOPOLOGY_VOLUME_KINDS).toEqual([
      'TUBING_INNER',
      'ANNULUS_A',
      'ANNULUS_B',
      'ANNULUS_C',
      'ANNULUS_D',
      'ANNULUS_E',
      'ANNULUS_F',
      'FORMATION_ANNULUS'
    ]);
  });

  it('rejects removed tubing annulus aliases', () => {
    expect(normalizeSourceVolumeKind('TUBING_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('PRIMARY_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('PRODUCTION_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('PROD_ANNULUS')).toBe(null);
  });

  it('still normalizes supported legacy and canonical volume aliases', () => {
    expect(normalizeSourceVolumeKind('TUBING_INNER')).toBe('TUBING_INNER');
    expect(normalizeSourceVolumeKind('BORE')).toBe('TUBING_INNER');
    expect(normalizeSourceVolumeKind('ANNULUS_A')).toBe('ANNULUS_A');
    expect(normalizeSourceVolumeKind('CASING_ANNULUS_B')).toBe('ANNULUS_B');
    expect(normalizeSourceVolumeKind('OPEN_HOLE')).toBe('FORMATION_ANNULUS');
  });
});