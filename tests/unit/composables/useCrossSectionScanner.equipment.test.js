import { describe, expect, it } from 'vitest';
import { scanCrossSectionAtDepth } from '@/composables/useCrossSectionScanner.js';

function createBaseState() {
  return {
    casingData: [
      { rowId: 'csg-outer', top: 0, bottom: 3000, od: 13.375, weight: 68, idOverride: 12.4 },
      { rowId: 'csg-inner', top: 0, bottom: 3000, od: 7.0, weight: 26, idOverride: 6.2 }
    ],
    tubingData: [
      { rowId: 'tbg-1', top: 0, bottom: 2500, od: 4.5, weight: 12, idOverride: 4.0 }
    ],
    drillStringData: [],
    markers: [],
    annulusFluids: [],
    cementPlugs: []
  };
}

describe('cross-section scanner equipment geometry', () => {
  it('uses resolved packer seal diameters for cross-section geometry', () => {
    const state = {
      ...createBaseState(),
      equipmentData: [{
        rowId: 'eq-tubing',
        type: 'Packer',
        depth: 1200,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        show: true
      }]
    };

    const scan = scanCrossSectionAtDepth(1200, state);
    expect(scan.equipment).toHaveLength(1);
    expect(scan.equipment[0].type).toBe('Packer');
    expect(scan.equipment[0].isOrphaned).toBe(false);
    expect(scan.equipment[0].sealInnerRadius).toBeCloseTo(2.25, 3);
    expect(scan.equipment[0].sealOuterRadius).toBeCloseTo(3.1, 3);
  });

  it('marks unresolved packer rows as orphaned without fallback seal geometry', () => {
    const state = {
      ...createBaseState(),
      equipmentData: [{
        rowId: 'eq-invalid',
        type: 'Packer',
        depth: 2800,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        show: true
      }]
    };

    const scan = scanCrossSectionAtDepth(2800, state);
    expect(scan.equipment).toHaveLength(1);
    expect(scan.equipment[0].isOrphaned).toBe(true);
    expect(scan.equipment[0].sealInnerRadius).toBeNull();
    expect(scan.equipment[0].sealOuterRadius).toBeNull();
  });

  it('uses resolved bridge plug seal diameters for cross-section geometry', () => {
    const state = {
      ...createBaseState(),
      equipmentData: [{
        rowId: 'eq-bridge',
        type: 'Bridge Plug',
        depth: 1200,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        show: true
      }]
    };

    const scan = scanCrossSectionAtDepth(1200, state);
    expect(scan.equipment).toHaveLength(1);
    expect(scan.equipment[0].type).toBe('Bridge Plug');
    expect(scan.equipment[0].isOrphaned).toBe(false);
    expect(scan.equipment[0].sealInnerRadius).toBeCloseTo(2.25, 3);
    expect(scan.equipment[0].sealOuterRadius).toBeCloseTo(3.1, 3);
  });
});
