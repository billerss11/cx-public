import { describe, expect, it } from 'vitest';
import {
  isPackerLikeEquipmentType,
  isSafetyValveEquipmentType,
  resolveEquipmentTypeSemantics
} from '@/components/schematic/layers/equipmentModelShared.js';

describe('equipmentModelShared', () => {
  it('resolves canonical semantics for supported equipment type variants', () => {
    const packer = resolveEquipmentTypeSemantics('packer');
    expect(packer.typeKey).toBe('packer');
    expect(packer.label).toBe('Packer');
    expect(packer.isPackerLike).toBe(true);
    expect(packer.isSafetyValve).toBe(false);

    const bridgePlug = resolveEquipmentTypeSemantics('bridge_plug');
    expect(bridgePlug.typeKey).toBe('bridge-plug');
    expect(bridgePlug.label).toBe('Bridge Plug');
    expect(bridgePlug.isPackerLike).toBe(true);
    expect(bridgePlug.isSafetyValve).toBe(false);

    const safetyValve = resolveEquipmentTypeSemantics('Safety valve');
    expect(safetyValve.typeKey).toBe('safety-valve');
    expect(safetyValve.label).toBe('Safety Valve');
    expect(safetyValve.isPackerLike).toBe(false);
    expect(safetyValve.isSafetyValve).toBe(true);
  });

  it('keeps unknown equipment labels while exposing normalized keys', () => {
    const custom = resolveEquipmentTypeSemantics('Custom Tool');
    expect(custom.typeKey).toBe('custom tool');
    expect(custom.label).toBe('Custom Tool');
    expect(custom.isPackerLike).toBe(false);
    expect(custom.isSafetyValve).toBe(false);
  });

  it('exposes convenience type guards', () => {
    expect(isPackerLikeEquipmentType('Packer')).toBe(true);
    expect(isPackerLikeEquipmentType('bridge-plug')).toBe(true);
    expect(isPackerLikeEquipmentType('Safety Valve')).toBe(false);

    expect(isSafetyValveEquipmentType('safety_valve')).toBe(true);
    expect(isSafetyValveEquipmentType('packer')).toBe(false);
  });
});
