import {
  EQUIPMENT_NUMERIC_FIELDS,
  NAMED_COLORS
} from '@/constants/index.js';
import { EQUIPMENT_TYPE_OPTIONS } from '@/topology/equipmentMetadata.js';
import {
  buildEquipmentAttachOptions,
  resolveEquipmentAttachOption
} from '@/utils/equipmentAttachReference.js';

function resolveTranslator(t) {
  return typeof t === 'function' ? t : (key) => key;
}

function resolveFallbackTranslator(tf) {
  return typeof tf === 'function'
    ? tf
    : (_key, fallback) => fallback;
}

export function buildEquipmentTableSchema(domainState, options = {}) {
  const t = resolveTranslator(options?.t);
  const tf = resolveFallbackTranslator(options?.tf);
  const colorRenderer = options?.colorRenderer;

  return {
    getData: () => domainState.equipmentData,
    prepareData: (rows) => {
      const attachOptions = buildEquipmentAttachOptions(domainState.casingData, domainState.tubingData);
      return rows.map((row) => {
        const selectedOption = resolveEquipmentAttachOption(row, attachOptions);
        const attachToDisplay = selectedOption?.value
          ?? (String(row?.attachToDisplay ?? '').trim() || null);
        return {
          ...row,
          attachToDisplay
        };
      });
    },
    colHeaders: () => [
      tf('table.equipment.depth', 'Depth'),
      tf('table.equipment.type', 'Type'),
      tf('table.equipment.attach_to', 'Attach To'),
      tf('table.equipment.color', 'Color'),
      tf('table.equipment.scale', 'Scale'),
      tf('table.equipment.label', 'Label'),
      tf('table.casing.label_x', 'Label X'),
      tf('table.casing.label_depth', 'Label depth'),
      tf('table.boxes.font_size', 'Font Size'),
      tf('table.equipment.show_label', 'Show label')
    ],
    columns: () => {
      const attachSource = (_query, process) => {
        const values = buildEquipmentAttachOptions(domainState.casingData, domainState.tubingData)
          .map((option) => option.value);
        if (typeof process === 'function') {
          process(values);
        }
        return values;
      };

      return [
        { data: 'depth', type: 'numeric' },
        {
          data: 'type',
          type: 'dropdown',
          source: EQUIPMENT_TYPE_OPTIONS,
          strict: true
        },
        {
          data: 'attachToDisplay',
          type: 'dropdown',
          source: attachSource,
          strict: false,
          allowInvalid: true
        },
        {
          data: 'color',
          type: 'dropdown',
          source: NAMED_COLORS,
          strict: false,
          allowInvalid: true,
          renderer: colorRenderer
        },
        { data: 'scale', type: 'numeric' },
        { data: 'label', type: 'text' },
        { data: 'labelXPos', type: 'numeric' },
        { data: 'manualLabelDepth', type: 'numeric' },
        { data: 'labelFontSize', type: 'numeric' },
        { data: 'showLabel', type: 'checkbox', className: 'htCenter' }
      ];
    },
    requiredFields: ['depth', 'type', 'attachToDisplay'],
    numericFields: EQUIPMENT_NUMERIC_FIELDS,
    sampleKeyFields: ['label'],
    afterChangeIgnoreSources: ['loadData', 'normalize'],
    buildDefaultRow: () => {
      const defaultAttachOption = buildEquipmentAttachOptions(domainState.casingData, domainState.tubingData)[0] ?? null;
      return {
        depth: 5000,
        type: EQUIPMENT_TYPE_OPTIONS[0] ?? 'Packer',
        attachToDisplay: defaultAttachOption?.value ?? null,
        attachToHostType: defaultAttachOption?.hostType ?? null,
        attachToId: defaultAttachOption?.rowId ?? null,
        actuationState: '',
        integrityStatus: '',
        boreSeal: '',
        annularSeal: '',
        sealByVolume: {},
        color: 'black',
        scale: 1.0,
        label: t('defaults.new_equipment'),
        labelXPos: null,
        manualLabelDepth: null,
        labelFontSize: null,
        showLabel: true
      };
    }
  };
}

export default {
  buildEquipmentTableSchema
};
