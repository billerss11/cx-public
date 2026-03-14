import { describe, expect, it } from 'vitest';
import {
  ENTITY_EDITOR_CONTROL_TYPES,
  resolveEntityEditorFieldDefinitions
} from '@/controls/entityEditor/entityFieldSchema.js';
import { getTableEditableDataFieldNames } from '@/controls/entityEditor/entityFieldContract.js';
import { getVisualInspectorFields } from '@/components/controls/visualInspectorSchema.js';
import { PIPE_HOST_TYPE_TUBING } from '@/utils/pipeReference.js';

describe('entityFieldSchema', () => {
  it('returns editable data fields plus read-only transparency fields for equipment data tab', () => {
    const definitions = resolveEntityEditorFieldDefinitions({
      entityType: 'equipment',
      mode: 'advanced',
      rowData: {
        rowId: 'eq-1',
        depth: 5000,
        type: 'Packer',
        attachToDisplay: 'Tubing | #1 (Tubing A)',
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        state: {
          actuationState: 'open',
          integrityStatus: 'intact'
        },
        properties: {
          boreSeal: 'true',
          annularSeal: 'false',
          sealByVolume: { ANNULUS_A: 'open' }
        },
        hostType: 'tubing',
        hostRowId: 'tbg-1',
        label: 'Packer 1',
        color: 'black',
        scale: 1,
        showLabel: true
      },
      context: {
        casingRows: [
          { rowId: 'csg-1', label: 'Casing A', top: 0, bottom: 7000, od: 9.625 }
        ],
        tubingRows: [
          { rowId: 'tbg-1', label: 'Tubing A', top: 0, bottom: 6500, od: 2.875 }
        ]
      }
    });

    const fieldNames = definitions.map((definition) => definition.field);
    expect(fieldNames).toEqual([
      'depth',
      'type',
      'attachToDisplay',
      'state.actuationState',
      'state.integrityStatus',
      'properties.boreSeal',
      'properties.annularSeal',
      'label',
      'rowId',
      'attachToHostType',
      'attachToId',
      'properties.sealByVolume'
    ]);
    expect(fieldNames).not.toContain('color');
    expect(fieldNames).not.toContain('scale');
    expect(fieldNames).not.toContain('showLabel');
    expect(fieldNames).not.toContain('hostType');
    expect(fieldNames).not.toContain('hostRowId');

    const attachToDefinition = definitions.find((definition) => definition.field === 'attachToDisplay');
    expect(attachToDefinition?.controlType).toBe(ENTITY_EDITOR_CONTROL_TYPES.select);
    expect(Array.isArray(attachToDefinition?.options)).toBe(true);
    expect(attachToDefinition.options.length).toBeGreaterThan(0);

    const actuationDefinition = definitions.find((definition) => definition.field === 'state.actuationState');
    expect(actuationDefinition?.controlType).toBe(ENTITY_EDITOR_CONTROL_TYPES.select);
    expect(Array.isArray(actuationDefinition?.options)).toBe(true);
    expect(actuationDefinition?.options.some((option) => option.value === '')).toBe(true);

    const readOnlyFields = definitions
      .filter((definition) => definition.readOnly === true)
      .map((definition) => definition.field);
    expect(readOnlyFields).toEqual(['rowId', 'attachToHostType', 'attachToId', 'properties.sealByVolume']);
  });

  it('can suppress read-only transparency fields when includeReadOnly is false', () => {
    const definitions = resolveEntityEditorFieldDefinitions({
      entityType: 'equipment',
      mode: 'advanced',
      includeReadOnly: false,
      rowData: {
        rowId: 'eq-1',
        depth: 5000,
        type: 'Packer',
        attachToDisplay: 'Tubing | #1 (Tubing A)',
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        state: {
          actuationState: 'open',
          integrityStatus: 'intact'
        },
        properties: {
          boreSeal: 'true',
          annularSeal: 'false',
          sealByVolume: { ANNULUS_A: 'open' }
        },
        label: 'Packer 1'
      }
    });

    const fieldNames = definitions.map((definition) => definition.field);
    expect(fieldNames).toEqual([
      'depth',
      'type',
      'attachToDisplay',
      'state.actuationState',
      'state.integrityStatus',
      'properties.boreSeal',
      'properties.annularSeal',
      'label'
    ]);
    expect(definitions.some((definition) => definition.readOnly === true)).toBe(false);
  });

  it('uses typed controls for equipment common fields', () => {
    const definitions = resolveEntityEditorFieldDefinitions({
      entityType: 'equipment',
      mode: 'common',
      rowData: {
        type: 'Packer',
        depth: 4200,
        label: 'Packer 2',
        showLabel: true
      }
    });

    expect(definitions.map((definition) => definition.field)).toEqual([
      'type',
      'depth',
      'label',
      'showLabel'
    ]);
    expect(definitions[0].controlType).toBe(ENTITY_EDITOR_CONTROL_TYPES.select);
    expect(definitions[1].controlType).toBe(ENTITY_EDITOR_CONTROL_TYPES.number);
    expect(definitions[3].controlType).toBe(ENTITY_EDITOR_CONTROL_TYPES.toggle);
  });

  it('builds marker attach options from selected host type', () => {
    const definitions = resolveEntityEditorFieldDefinitions({
      entityType: 'marker',
      mode: 'advanced',
      rowData: {
        type: 'Perforation',
        attachToHostType: PIPE_HOST_TYPE_TUBING
      },
      context: {
        casingRows: [
          { rowId: 'csg-1', label: 'Casing A', top: 0, bottom: 7000, od: 9.625 }
        ],
        tubingRows: [
          { rowId: 'tbg-1', label: 'Tubing A', top: 0, bottom: 6500, od: 2.875 }
        ]
      }
    });

    const attachToRowDefinition = definitions.find((definition) => definition.field === 'attachToRow');
    expect(attachToRowDefinition?.controlType).toBe(ENTITY_EDITOR_CONTROL_TYPES.select);
    expect(Array.isArray(attachToRowDefinition?.options)).toBe(true);
    expect(attachToRowDefinition.options.length).toBeGreaterThan(0);
  });

  it('keeps manualParent as table-only for casing and hides it from data tab', () => {
    const dataTabDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'casing',
      mode: 'advanced',
      rowData: {
        rowId: 'csg-1',
        label: 'Surface',
        od: 9.625,
        weight: 40,
        grade: 'L80',
        top: 0,
        bottom: 5000,
        manualParent: 2
      }
    });

    const dataTabFieldNames = dataTabDefinitions.map((definition) => definition.field);
    expect(dataTabFieldNames).not.toContain('manualParent');

    const tableEditableFields = getTableEditableDataFieldNames('casing');
    expect(tableEditableFields).toContain('manualParent');
  });

  it('keeps advanced data fields separate from visual inspector fields', () => {
    const context = {
      casingRows: [
        { rowId: 'csg-1', label: 'Casing A', top: 0, bottom: 7000, od: 9.625 }
      ],
      tubingRows: [
        { rowId: 'tbg-1', label: 'Tubing A', top: 0, bottom: 6500, od: 2.875 }
      ]
    };
    const domainCases = [
      {
        entityType: 'casing',
        visualType: 'casing',
        rowData: { label: 'Surface', top: 0, bottom: 1000, showTop: true, showBottom: true }
      },
      {
        entityType: 'tubing',
        visualType: 'tubing',
        rowData: { label: 'Tubing A', top: 0, bottom: 1000, showLabel: true }
      },
      {
        entityType: 'drillString',
        visualType: 'drillString',
        rowData: { label: 'DS', componentType: 'pipe', top: 0, bottom: 1000, showLabel: true }
      },
      {
        entityType: 'equipment',
        visualType: 'equipment',
        rowData: { depth: 5000, type: 'Packer', attachToDisplay: 'Tubing | #1 (Tubing A)', showLabel: true }
      },
      {
        entityType: 'line',
        visualType: 'line',
        rowData: { depth: 1200, label: 'Landing', show: true }
      },
      {
        entityType: 'plug',
        visualType: 'plug',
        rowData: { top: 3000, bottom: 3200, type: 'Cement', attachToRow: '#1', show: true }
      },
      {
        entityType: 'fluid',
        visualType: 'fluid',
        rowData: { placement: 'Auto', top: 100, bottom: 500, label: 'Mud', show: true }
      },
      {
        entityType: 'marker',
        visualType: 'marker',
        rowData: { top: 4200, bottom: 4200, type: 'Perforation', attachToHostType: 'casing', attachToRow: '#1', show: true }
      },
      {
        entityType: 'box',
        visualType: 'box',
        rowData: { topDepth: 500, bottomDepth: 800, label: 'Zone', detail: 'notes', show: true }
      }
    ];

    domainCases.forEach(({ entityType, visualType, rowData }) => {
      const advancedFields = resolveEntityEditorFieldDefinitions({
        entityType,
        mode: 'advanced',
        rowData,
        context
      }).map((definition) => definition.field);
      const visualFields = getVisualInspectorFields(visualType, {
        rowData,
        depthRange: { min: 0, max: 10000 }
      }).map((definition) => definition.field);

      const overlap = advancedFields.filter((field) => visualFields.includes(field));
      expect(overlap).toEqual([]);
    });
  });

  it('returns focused editable data fields for surface communication rows', () => {
    const pathDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'surfacePath',
      mode: 'advanced',
      rowData: {
        rowId: 'surface-path-1',
        channelKey: 'TUBING_INNER',
        label: 'Tubing Path',
        show: true
      }
    });
    expect(pathDefinitions.map((definition) => definition.field)).toEqual([
      'label',
      'channelKey',
      'show',
      'rowId'
    ]);

    const transferDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'surfaceTransfer',
      mode: 'advanced',
      rowData: {
        rowId: 'surface-transfer-1',
        transferType: 'leak',
        label: 'Leak to A',
        fromChannelKey: 'TUBING_INNER',
        toChannelKey: 'ANNULUS_A',
        direction: 'bidirectional',
        show: true
      }
    });
    expect(transferDefinitions.map((definition) => definition.field)).toEqual([
      'label',
      'transferType',
      'fromChannelKey',
      'toChannelKey',
      'direction',
      'show',
      'rowId'
    ]);
  });

});
