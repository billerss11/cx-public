import { describe, expect, it } from 'vitest';
import { resolveBoundaryEquipmentEffects } from '@/topology/equipmentRules.js';

describe('topology equipment resolved seal effects', () => {
  it('blocks the first modeled annulus when tubing-host packer resolves to ANNULUS_A', () => {
    const effects = resolveBoundaryEquipmentEffects(
      1200,
      [{
        rowId: 'eq-tubing',
        type: 'Packer',
        depth: 1200,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        sealNodeKind: 'ANNULUS_A',
        sealSlotIndex: 0,
        show: true
      }],
      {
        tubingRows: [{ rowId: 'tbg-1', top: 0, bottom: 3000 }]
      }
    );

    expect(effects.byVolume.BORE.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_A.blocked).toBe(true);
    expect(effects.byVolume.ANNULUS_B.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_C.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_D.blocked).toBe(false);
    expect(effects.byVolume.FORMATION_ANNULUS.blocked).toBe(false);
    expect(effects.validationWarnings).toHaveLength(0);
  });

  it('blocks only the resolved annulus volume for packer rows', () => {
    const effects = resolveBoundaryEquipmentEffects(
      1200,
      [{
        rowId: 'eq-casing',
        type: 'Packer',
        depth: 1200,
        attachToHostType: 'casing',
        attachToId: 'csg-inner',
        sealNodeKind: 'ANNULUS_B',
        sealSlotIndex: 1,
        show: true
      }],
      {
        casingRows: [{ rowId: 'csg-inner', top: 0, bottom: 3000 }]
      }
    );

    expect(effects.byVolume.BORE.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_A.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_B.blocked).toBe(true);
    expect(effects.byVolume.ANNULUS_C.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_D.blocked).toBe(false);
    expect(effects.byVolume.FORMATION_ANNULUS.blocked).toBe(false);
    expect(effects.validationWarnings).toHaveLength(0);
  });

  it('applies canonical packer bore and annular seal overrides to boundary effects', () => {
    const effects = resolveBoundaryEquipmentEffects(
      1200,
      [{
        rowId: 'eq-packer-override',
        type: 'Packer',
        depth: 1200,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        sealNodeKind: 'ANNULUS_A',
        sealSlotIndex: 0,
        properties: {
          boreSeal: 'true',
          annularSeal: 'false',
          sealByVolume: {}
        },
        show: true
      }],
      {
        tubingRows: [{ rowId: 'tbg-1', top: 0, bottom: 3000 }]
      }
    );

    expect(effects.byVolume.BORE.blocked).toBe(true);
    expect(effects.byVolume.ANNULUS_A.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_B.blocked).toBe(false);
    expect(effects.validationWarnings).toHaveLength(0);
  });

  it('emits deterministic attach warning and does not block when packer resolution is orphaned', () => {
    const effects = resolveBoundaryEquipmentEffects(1200, [{
      rowId: 'eq-orphaned',
      type: 'Packer',
      depth: 1200,
      attachWarningCode: 'equipment_invalid_host_depth',
      show: true
    }]);

    const blockedVolumes = Object.values(effects.byVolume).filter((item) => item?.blocked === true);
    expect(blockedVolumes).toHaveLength(0);
    expect(effects.validationWarnings.some((warning) => warning.code === 'equipment_invalid_host_depth')).toBe(true);
    expect(effects.validationWarnings.some((warning) => warning.code === 'no_seal_behavior_at_boundary')).toBe(false);
  });

  it('blocks bore only for bridge plug rows at a boundary', () => {
    const effects = resolveBoundaryEquipmentEffects(
      1200,
      [{
        rowId: 'eq-bridge',
        type: 'Bridge Plug',
        depth: 1200,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        sealNodeKind: 'ANNULUS_A',
        sealSlotIndex: 0,
        show: true
      }],
      {
        tubingRows: [{ rowId: 'tbg-1', top: 0, bottom: 3000 }]
      }
    );

    expect(effects.byVolume.BORE.blocked).toBe(true);
    expect(effects.byVolume.ANNULUS_A.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_B.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_C.blocked).toBe(false);
    expect(effects.byVolume.ANNULUS_D.blocked).toBe(false);
    expect(effects.byVolume.FORMATION_ANNULUS.blocked).toBe(false);
    expect(effects.validationWarnings).toHaveLength(0);
  });
});
