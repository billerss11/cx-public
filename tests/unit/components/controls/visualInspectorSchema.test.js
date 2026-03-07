import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveEquipmentInspectorFieldsMock } = vi.hoisted(() => ({
  resolveEquipmentInspectorFieldsMock: vi.fn()
}));

vi.mock('@/topology/equipmentDefinitions/index.js', () => ({
  resolveEquipmentInspectorFields: (...args) => resolveEquipmentInspectorFieldsMock(...args)
}));

let getVisualInspectorFields;
let VISUAL_INSPECTOR_CONTROL_TYPES;

describe('visualInspectorSchema equipment extension merge', () => {
  beforeAll(async () => {
    const module = await import('@/components/controls/visualInspectorSchema.js');
    getVisualInspectorFields = module.getVisualInspectorFields;
    VISUAL_INSPECTOR_CONTROL_TYPES = module.VISUAL_INSPECTOR_CONTROL_TYPES;
  });

  beforeEach(() => {
    resolveEquipmentInspectorFieldsMock.mockReset();
  });

  it('merges per-type equipment inspector fields for equipment context', () => {
    const context = {
      rowData: {
        type: 'Landing Nipple'
      },
      depthRange: {
        min: 0,
        max: 10000
      }
    };

    resolveEquipmentInspectorFieldsMock.mockReturnValue([
      Object.freeze({
        field: 'toolConfig.insertMode',
        controlType: VISUAL_INSPECTOR_CONTROL_TYPES.select,
        labelKey: 'table.equipment.insert_mode',
        options: () => ([
          { label: 'None', value: 'none' },
          { label: 'Solid Plug', value: 'solid_plug' }
        ]),
        showWhen: null
      })
    ]);

    const fields = getVisualInspectorFields('equipment', context);
    expect(resolveEquipmentInspectorFieldsMock).toHaveBeenCalledWith('Landing Nipple', context);
    expect(fields.some((fieldDefinition) => fieldDefinition.field === 'toolConfig.insertMode')).toBe(true);
  });

  it('lets per-type extension fields override base fields by field name', () => {
    resolveEquipmentInspectorFieldsMock.mockReturnValue([
      Object.freeze({
        field: 'scale',
        controlType: VISUAL_INSPECTOR_CONTROL_TYPES.number,
        labelKey: 'table.equipment.scale_custom',
        min: 0.5,
        max: 3,
        step: 0.1,
        showWhen: null
      })
    ]);

    const fields = getVisualInspectorFields('equipment', { rowData: { type: 'Landing Nipple' } });
    const scaleFields = fields.filter((fieldDefinition) => fieldDefinition.field === 'scale');
    expect(scaleFields).toHaveLength(1);
    expect(scaleFields[0].labelKey).toBe('table.equipment.scale_custom');
  });

  it('applies showWhen filtering to extension fields with the same rules as base fields', () => {
    resolveEquipmentInspectorFieldsMock.mockReturnValue([
      Object.freeze({
        field: 'toolConfig.checkValveDirection',
        controlType: VISUAL_INSPECTOR_CONTROL_TYPES.select,
        labelKey: 'table.equipment.check_valve_direction',
        showWhen: ({ rowData }) => String(rowData?.type ?? '').trim() === 'Landing Nipple'
      })
    ]);

    const hiddenFields = getVisualInspectorFields('equipment', { rowData: { type: 'Packer' } });
    expect(hiddenFields.some((fieldDefinition) => fieldDefinition.field === 'toolConfig.checkValveDirection')).toBe(false);

    const visibleFields = getVisualInspectorFields('equipment', { rowData: { type: 'Landing Nipple' } });
    expect(visibleFields.some((fieldDefinition) => fieldDefinition.field === 'toolConfig.checkValveDirection')).toBe(true);
  });

  it('does not invoke equipment extension resolver for non-equipment element types', () => {
    const casingFields = getVisualInspectorFields('casing', {
      rowData: {
        type: 'Packer',
        top: 0,
        bottom: 1000
      }
    });

    expect(resolveEquipmentInspectorFieldsMock).not.toHaveBeenCalled();
    expect(Array.isArray(casingFields)).toBe(true);
    expect(casingFields.length).toBeGreaterThan(0);
  });
});
