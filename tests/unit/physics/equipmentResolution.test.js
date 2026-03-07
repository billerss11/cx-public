import { describe, expect, it } from 'vitest';
import { resolveEquipment } from '@/physics/physicsCore.js';

function buildCasingRows() {
  return [
    { __index: 0, rowId: 'csg-outer', label: 'Outer', top: 0, bottom: 3000, od: 13.375, weight: 68 },
    { __index: 1, rowId: 'csg-middle', label: 'Middle', top: 0, bottom: 3000, od: 9.625, weight: 40 },
    { __index: 2, rowId: 'csg-inner', label: 'Inner', top: 0, bottom: 3000, od: 7.0, weight: 26, idOverride: 6.2 }
  ];
}

function buildTubingRows() {
  return [
    { __index: 0, rowId: 'tbg-1', label: 'Tubing', top: 0, bottom: 2500, od: 4.5, innerDiameter: 4.0 }
  ];
}

describe('equipment resolution (explicit packer host)', () => {
  it('resolves tubing-mounted packer to TUBING_ANNULUS with explicit host', () => {
    const resolved = resolveEquipment(
      [{
        rowId: 'eq-tbg',
        type: 'Packer',
        depth: 1200,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        show: true
      }],
      buildTubingRows(),
      buildCasingRows(),
      { operationPhase: 'production' }
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].isOrphaned).toBe(false);
    expect(resolved[0].hostType).toBe('tubing');
    expect(resolved[0].hostRowId).toBe('tbg-1');
    expect(resolved[0].sealNodeKind).toBe('TUBING_ANNULUS');
    expect(resolved[0].sealSlotIndex).toBe(0);
    expect(resolved[0].sealInnerDiameter).toBeCloseTo(4.5, 3);
    expect(resolved[0].sealOuterDiameter).toBeCloseTo(6.2, 3);
  });

  it('resolves casing-mounted packer to the first casing annulus by selected host', () => {
    const resolved = resolveEquipment(
      [{
        rowId: 'eq-csg',
        type: 'Packer',
        depth: 1200,
        attachToHostType: 'casing',
        attachToId: 'csg-inner',
        show: true
      }],
      buildTubingRows(),
      buildCasingRows(),
      { operationPhase: 'production' }
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].isOrphaned).toBe(false);
    expect(resolved[0].hostType).toBe('casing');
    expect(resolved[0].hostRowId).toBe('csg-inner');
    expect(resolved[0].sealNodeKind).toBe('ANNULUS_A');
    expect(resolved[0].sealSlotIndex).toBe(1);
  });

  it('does not fallback when selected host is invalid at depth', () => {
    const resolved = resolveEquipment(
      [{
        rowId: 'eq-invalid-depth',
        type: 'Packer',
        depth: 2800,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        show: true
      }],
      buildTubingRows(),
      buildCasingRows(),
      { operationPhase: 'production' }
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].isOrphaned).toBe(true);
    expect(resolved[0].sealNodeKind).toBeNull();
    expect(resolved[0].attachWarningCode).toBe('equipment_invalid_host_depth');
  });

  it('resolves tubing-mounted bridge plug with explicit host geometry', () => {
    const resolved = resolveEquipment(
      [{
        rowId: 'eq-bridge-tbg',
        type: 'Bridge Plug',
        depth: 1200,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        show: true
      }],
      buildTubingRows(),
      buildCasingRows(),
      { operationPhase: 'production' }
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].type).toBe('Bridge Plug');
    expect(resolved[0].isOrphaned).toBe(false);
    expect(resolved[0].hostType).toBe('tubing');
    expect(resolved[0].hostRowId).toBe('tbg-1');
    expect(resolved[0].sealNodeKind).toBe('TUBING_ANNULUS');
    expect(resolved[0].sealSlotIndex).toBe(0);
    expect(resolved[0].sealInnerDiameter).toBeCloseTo(4.5, 3);
    expect(resolved[0].sealOuterDiameter).toBeCloseTo(6.2, 3);
  });
});
