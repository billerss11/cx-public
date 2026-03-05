import { describe, expect, it } from 'vitest';
import { getEquipmentRuleRowWarnings } from '@/topology/equipmentRules.js';

describe('equipment attach warnings', () => {
  it('emits deterministic warning when packer attach target is missing', () => {
    const warnings = getEquipmentRuleRowWarnings({
      rowId: 'eq-missing',
      type: 'Packer',
      depth: 1200,
      attachToHostType: 'tubing',
      show: true
    });

    expect(warnings.some((warning) => warning.code === 'equipment_missing_attach_target')).toBe(true);
  });

  it('emits deterministic warning when selected host does not overlap packer depth', () => {
    const warnings = getEquipmentRuleRowWarnings(
      {
        rowId: 'eq-depth-invalid',
        type: 'Packer',
        depth: 2400,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        show: true
      },
      {
        tubingRows: [
          { rowId: 'tbg-1', top: 0, bottom: 1500, od: 4.5, weight: 12 }
        ],
        casingRows: []
      }
    );

    expect(warnings.some((warning) => warning.code === 'equipment_invalid_host_depth')).toBe(true);
  });

  it('emits deterministic warning when bridge plug attach target is missing', () => {
    const warnings = getEquipmentRuleRowWarnings({
      rowId: 'eq-bridge-missing',
      type: 'Bridge Plug',
      depth: 1200,
      attachToHostType: 'tubing',
      show: true
    });

    expect(warnings.some((warning) => warning.code === 'equipment_missing_attach_target')).toBe(true);
  });
});
