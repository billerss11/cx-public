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
      'type',
      'depth',
      'attachToDisplay',
      'label',
      'state.actuationState',
      'state.integrityStatus',
      'properties.annularSeal',
      'properties.boreSeal',
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

    const equipmentUiMetadata = definitions
      .filter((definition) => definition.readOnly !== true)
      .map((definition) => ({
        field: definition.field,
        section: definition.section,
        disclosureLevel: definition.disclosureLevel
      }));
    expect(equipmentUiMetadata).toEqual([
      { field: 'type', section: 'core', disclosureLevel: 'core' },
      { field: 'depth', section: 'core', disclosureLevel: 'core' },
      { field: 'attachToDisplay', section: 'core', disclosureLevel: 'core' },
      { field: 'label', section: 'core', disclosureLevel: 'core' },
      { field: 'state.actuationState', section: 'operating', disclosureLevel: 'core' },
      { field: 'state.integrityStatus', section: 'operating', disclosureLevel: 'core' },
      { field: 'properties.annularSeal', section: 'seal', disclosureLevel: 'core' },
      { field: 'properties.boreSeal', section: 'seal', disclosureLevel: 'advanced' }
    ]);

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
      'type',
      'depth',
      'attachToDisplay',
      'label',
      'state.actuationState',
      'state.integrityStatus',
      'properties.annularSeal',
      'properties.boreSeal'
    ]);
    expect(definitions.some((definition) => definition.readOnly === true)).toBe(false);
  });

  it('makes safety valve bore controls primary and annular controls advanced', () => {
    const definitions = resolveEntityEditorFieldDefinitions({
      entityType: 'equipment',
      mode: 'advanced',
      rowData: {
        rowId: 'eq-safety',
        depth: 5000,
        type: 'Safety Valve',
        attachToDisplay: 'Tubing | #1 (Tubing A)',
        state: {
          actuationState: 'closed',
          integrityStatus: 'intact'
        },
        properties: {
          boreSeal: '',
          annularSeal: '',
          sealByVolume: {}
        },
        label: 'Safety Valve 1'
      }
    });

    const editableFields = definitions
      .filter((definition) => definition.readOnly !== true)
      .map((definition) => ({
        field: definition.field,
        section: definition.section,
        disclosureLevel: definition.disclosureLevel
      }));

    expect(editableFields).toContainEqual({
      field: 'properties.boreSeal',
      section: 'seal',
      disclosureLevel: 'core'
    });
    expect(editableFields).toContainEqual({
      field: 'properties.annularSeal',
      section: 'seal',
      disclosureLevel: 'advanced'
    });
  });

  it('hides generic bridge plug seal overrides from editable equipment fields', () => {
    const definitions = resolveEntityEditorFieldDefinitions({
      entityType: 'equipment',
      mode: 'advanced',
      rowData: {
        rowId: 'eq-bridge',
        depth: 5000,
        type: 'Bridge Plug',
        attachToDisplay: 'Tubing | #1 (Tubing A)',
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        state: {
          actuationState: 'static',
          integrityStatus: 'intact'
        },
        properties: {
          boreSeal: '',
          annularSeal: '',
          sealByVolume: {
            ANNULUS_A: true
          }
        },
        label: 'Bridge Plug 1'
      }
    });

    const editableFieldNames = definitions
      .filter((definition) => definition.readOnly !== true)
      .map((definition) => definition.field);
    expect(editableFieldNames).not.toContain('properties.boreSeal');
    expect(editableFieldNames).not.toContain('properties.annularSeal');

    const readOnlyFieldNames = definitions
      .filter((definition) => definition.readOnly === true)
      .map((definition) => definition.field);
    expect(readOnlyFieldNames).toContain('properties.sealByVolume');
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

  it('adds constraint-aware slider metadata for canvas-linked depth fields', () => {
    const casingDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'casing',
      mode: 'advanced',
      rowData: {
        rowId: 'csg-1',
        label: 'Surface',
        top: 100,
        bottom: 5000,
        toc: 1200,
        boc: 1800
      },
      context: {
        casingRows: [
          { rowId: 'csg-1', label: 'Surface', top: 100, bottom: 5000, toc: 1200, boc: 1800 },
          { rowId: 'csg-2', label: 'Liner', top: 5000, bottom: 9000, toc: null, boc: null }
        ],
        tubingRows: [
          { rowId: 'tbg-1', label: 'Tubing', top: 200, bottom: 8500 }
        ],
        drillStringRows: [],
        equipmentRows: [
          { rowId: 'eq-1', depth: 4100 }
        ],
        horizontalLines: [
          { rowId: 'line-1', depth: 2500, label: 'Landing', show: true }
        ],
        annotationBoxes: [
          { rowId: 'box-1', topDepth: 400, bottomDepth: 900, label: 'Zone', detail: 'Notes', show: true }
        ],
        cementPlugs: [
          { rowId: 'plug-1', top: 3200, bottom: 3400 }
        ],
        annulusFluids: [
          { rowId: 'fluid-1', top: 150, bottom: 3000 }
        ],
        markers: [
          { rowId: 'marker-1', top: 3600, bottom: 3650 }
        ],
        trajectory: [
          { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
          { rowId: 'traj-2', md: 9100, inc: 0, azi: 0 }
        ]
      }
    });

    const topDefinition = casingDefinitions.find((definition) => definition.field === 'top');
    const bottomDefinition = casingDefinitions.find((definition) => definition.field === 'bottom');
    const tocDefinition = casingDefinitions.find((definition) => definition.field === 'toc');
    const bocDefinition = casingDefinitions.find((definition) => definition.field === 'boc');

    expect(topDefinition?.controlType).toBe(ENTITY_EDITOR_CONTROL_TYPES.number);
    expect(topDefinition?.slider).toEqual({ min: 0, max: 5000, step: 0.1 });
    expect(bottomDefinition?.slider).toEqual({ min: 100, max: 9100, step: 0.1 });
    expect(tocDefinition?.slider).toEqual({ min: 100, max: 5000, step: 0.1 });
    expect(bocDefinition?.slider).toEqual({ min: 100, max: 5000, step: 0.1 });

    const equipmentDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'equipment',
      mode: 'advanced',
      rowData: {
        rowId: 'eq-1',
        depth: 4100,
        type: 'Packer',
        attachToDisplay: 'Tubing | #1 (Tubing A)',
        label: 'Packer'
      },
      context: {
        casingRows: [
          { rowId: 'csg-1', label: 'Surface', top: 100, bottom: 5000, od: 9.625 }
        ],
        tubingRows: [
          { rowId: 'tbg-1', label: 'Tubing A', top: 200, bottom: 8500, od: 2.875 }
        ],
        equipmentRows: [
          { rowId: 'eq-1', depth: 4100 }
        ],
        horizontalLines: [
          { rowId: 'line-1', depth: 2500, label: 'Landing', show: true }
        ],
        markers: [
          { rowId: 'marker-1', top: 3600, bottom: 3650 }
        ],
        annotationBoxes: [
          { rowId: 'box-1', topDepth: 400, bottomDepth: 900, label: 'Zone', detail: 'Notes', show: true }
        ],
        cementPlugs: [
          { rowId: 'plug-1', top: 3200, bottom: 3400 }
        ],
        annulusFluids: [
          { rowId: 'fluid-1', top: 150, bottom: 3000 }
        ],
        trajectory: [
          { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
          { rowId: 'traj-2', md: 9100, inc: 0, azi: 0 }
        ]
      }
    });
    const equipmentDepthDefinition = equipmentDefinitions.find((definition) => definition.field === 'depth');
    expect(equipmentDepthDefinition?.slider).toEqual({ min: 0, max: 9100, step: 0.1 });

    const markerDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'marker',
      mode: 'advanced',
      rowData: {
        rowId: 'marker-1',
        top: 3600,
        bottom: 3650,
        type: 'Perforation',
        attachToHostType: 'casing',
        attachToRow: '#1'
      },
      context: {
        casingRows: [
          { rowId: 'csg-1', label: 'Surface', top: 100, bottom: 5000, od: 9.625 }
        ],
        tubingRows: [
          { rowId: 'tbg-1', label: 'Tubing A', top: 200, bottom: 8500, od: 2.875 }
        ],
        markers: [
          { rowId: 'marker-1', top: 3600, bottom: 3650 }
        ],
        trajectory: [
          { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
          { rowId: 'traj-2', md: 9100, inc: 0, azi: 0 }
        ]
      }
    });
    expect(markerDefinitions.find((definition) => definition.field === 'top')?.slider).toEqual({
      min: 0,
      max: 3650,
      step: 0.1
    });
    expect(markerDefinitions.find((definition) => definition.field === 'bottom')?.slider).toEqual({
      min: 3600,
      max: 9100,
      step: 0.1
    });

    const boxDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'box',
      mode: 'advanced',
      rowData: {
        rowId: 'box-1',
        topDepth: 400,
        bottomDepth: 900,
        label: 'Zone',
        detail: 'notes',
        show: true
      },
      context: {
        annotationBoxes: [
          { rowId: 'box-1', topDepth: 400, bottomDepth: 900, label: 'Zone', detail: 'Notes', show: true }
        ],
        trajectory: [
          { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
          { rowId: 'traj-2', md: 9100, inc: 0, azi: 0 }
        ]
      }
    });
    expect(boxDefinitions.find((definition) => definition.field === 'topDepth')?.slider).toEqual({
      min: 0,
      max: 900,
      step: 0.1
    });
    expect(boxDefinitions.find((definition) => definition.field === 'bottomDepth')?.slider).toEqual({
      min: 400,
      max: 9100,
      step: 0.1
    });
  });

  it('keeps topology and trajectory depth fields out of the new slider feature', () => {
    const topologyDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'topologySource',
      mode: 'advanced',
      rowData: {
        rowId: 'source-1',
        top: 9000,
        bottom: 9000,
        volumeKey: 'FORMATION_ANNULUS',
        label: 'Source'
      }
    });
    expect(topologyDefinitions.find((definition) => definition.field === 'top')?.slider ?? null).toBe(null);
    expect(topologyDefinitions.find((definition) => definition.field === 'bottom')?.slider ?? null).toBe(null);

    const trajectoryDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'trajectory',
      mode: 'advanced',
      rowData: {
        rowId: 'traj-1',
        md: 1200,
        inc: 5,
        azi: 90,
        comment: 'Kickoff'
      }
    });
    expect(trajectoryDefinitions.find((definition) => definition.field === 'md')?.slider ?? null).toBe(null);
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

  it('exposes directional md/tvd fields for reference horizon data editing without leaking them into visual-only controls', () => {
    const dataTabDefinitions = resolveEntityEditorFieldDefinitions({
      entityType: 'line',
      mode: 'advanced',
      rowData: {
        rowId: 'line-1',
        depth: 1200,
        directionalDepthMd: 1200,
        directionalDepthTvd: 1100,
        label: 'Landing',
        show: true
      }
    });

    const fieldNames = dataTabDefinitions.map((definition) => definition.field);
    expect(fieldNames).toEqual(expect.arrayContaining([
      'depth',
      'directionalDepthMode',
      'directionalDepthMd',
      'directionalDepthTvd',
      'label',
      'rowId'
    ]));

    const visualFields = getVisualInspectorFields('line', {
      rowData: {
        depth: 1200,
        directionalDepthMd: 1200,
        directionalDepthTvd: 1100,
        label: 'Landing',
        show: true
      },
      depthRange: { min: 0, max: 10000 }
    }).map((definition) => definition.field);

    expect(visualFields).not.toContain('directionalDepthMd');
    expect(visualFields).not.toContain('directionalDepthTvd');
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
