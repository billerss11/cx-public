import { describe, expect, it, vi } from 'vitest';
import { buildEquipmentTableSchema } from '@/composables/tableSchemas/equipmentSchema.js';

function createDomainState() {
  return {
    equipmentData: [],
    casingData: [
      { rowId: 'csg-1', label: 'Casing 1', top: 0, bottom: 5000, od: 9.625, weight: 40 }
    ],
    tubingData: [
      { rowId: 'tbg-1', label: 'Tubing 1', top: 0, bottom: 4500, od: 4.5, weight: 12 }
    ]
  };
}

describe('equipmentSchema', () => {
  it('builds attach-aware equipment schema with canonical defaults', () => {
    const schema = buildEquipmentTableSchema(createDomainState(), {
      t: (key) => key,
      tf: (_key, fallback) => fallback,
      colorRenderer: vi.fn()
    });

    const columns = schema.columns();
    expect(columns.some((column) => column?.data === 'attachToDisplay')).toBe(true);
    expect(columns.some((column) => column?.data === 'type')).toBe(true);
    expect(columns.some((column) => column?.data === 'labelXPos')).toBe(true);
    expect(columns.some((column) => column?.data === 'manualLabelDepth')).toBe(true);
    expect(columns.some((column) => column?.data === 'labelFontSize')).toBe(true);

    const defaultRow = schema.buildDefaultRow();
    expect(defaultRow.type).toBeTruthy();
    expect(defaultRow.attachToHostType).toBe('tubing');
    expect(defaultRow.attachToId).toBe('tbg-1');
  });

  it('resolves attach display tokens in prepared rows', () => {
    const schema = buildEquipmentTableSchema(createDomainState(), {
      t: (key) => key,
      tf: (_key, fallback) => fallback,
      colorRenderer: vi.fn()
    });

    const preparedRows = schema.prepareData([
      {
        rowId: 'eq-1',
        depth: 1000,
        type: 'Packer',
        attachToHostType: 'casing',
        attachToId: 'csg-1'
      }
    ]);

    expect(preparedRows).toHaveLength(1);
    expect(preparedRows[0].attachToDisplay).toContain('Casing');
  });
});
