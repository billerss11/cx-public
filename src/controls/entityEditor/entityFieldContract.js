import { getEnumOptions } from '@/app/i18n.js';
import { FLUID_PLACEMENT_AUTO_OPTIONS } from '@/constants/index.js';
import {
  EQUIPMENT_TYPE_OPTIONS
} from '@/topology/equipmentMetadata.js';
import {
  listEquipmentDefinitions,
  resolveEquipmentEditorFields
} from '@/topology/equipmentDefinitions/index.js';
import {
  SOURCE_KIND_FORMATION_INFLOW,
  SOURCE_KIND_LEAK,
  SOURCE_KIND_PERFORATION,
  SOURCE_KIND_SCENARIO,
  TOPOLOGY_VOLUME_KINDS
} from '@/topology/topologyTypes.js';
import { buildEquipmentAttachOptions } from '@/utils/equipmentAttachReference.js';
import { generateCasingId } from '@/utils/general.js';
import { resolveConstraintAwareDepthSlider } from '@/utils/depthControlRanges.js';
import {
  buildPipeReferenceOptions,
  normalizePipeHostType,
  PIPE_HOST_TYPE_CASING,
  PIPE_HOST_TYPE_TUBING
} from '@/utils/pipeReference.js';

export const ENTITY_EDITOR_CONTROL_TYPES = Object.freeze({
  text: 'text',
  number: 'number',
  toggle: 'toggle',
  select: 'select',
  json: 'json'
});

export const ENTITY_FIELD_ACCESS = Object.freeze({
  editable: 'editable',
  readOnly: 'readOnly',
  hidden: 'hidden'
});

// Set this to false to remove the transparency read-only section from the Data tab.
export const DATA_TAB_READ_ONLY_FIELDS_ENABLED = true;

const ENTITY_TYPE_TO_DOMAIN_KEY = Object.freeze({
  casing: 'casing',
  tubing: 'tubing',
  drillString: 'drillString',
  drillstring: 'drillString',
  equipment: 'equipment',
  line: 'lines',
  lines: 'lines',
  plug: 'plugs',
  plugs: 'plugs',
  fluid: 'fluids',
  fluids: 'fluids',
  marker: 'markers',
  markers: 'markers',
  box: 'boxes',
  boxes: 'boxes',
  topologySource: 'topologySources',
  topologysource: 'topologySources',
  topologySources: 'topologySources',
  topologyBreakout: 'topologyBreakouts',
  topologybreakout: 'topologyBreakouts',
  topologyBreakouts: 'topologyBreakouts',
  surfaceEquipment: 'surfaceEquipment',
  surfaceequipment: 'surfaceEquipment',
  surfaceComponent: 'surfaceEquipment',
  surfacecomponent: 'surfaceEquipment',
  surfaceComponents: 'surfaceEquipment',
  surfacePath: 'surfacePaths',
  surfacepath: 'surfacePaths',
  surfacePaths: 'surfacePaths',
  surfaceTransfer: 'surfaceTransfers',
  surfacetransfer: 'surfaceTransfers',
  surfaceTransfers: 'surfaceTransfers',
  surfaceOutlet: 'surfaceOutlets',
  surfaceoutlet: 'surfaceOutlets',
  surfaceOutlets: 'surfaceOutlets',
  trajectory: 'trajectory'
});

const PIPE_COMPONENT_TYPE_OPTIONS = Object.freeze(['pipe', 'packer', 'collar', 'stabilizer', 'bit']);
const TOPOLOGY_SOURCE_TYPE_OPTIONS = Object.freeze([
  SOURCE_KIND_FORMATION_INFLOW,
  SOURCE_KIND_PERFORATION,
  SOURCE_KIND_LEAK,
  SOURCE_KIND_SCENARIO
]);
const MARKER_HOST_TYPE_OPTIONS = Object.freeze([
  PIPE_HOST_TYPE_CASING,
  PIPE_HOST_TYPE_TUBING
]);
const SURFACE_TRANSFER_TYPE_OPTIONS = Object.freeze(['leak', 'crossover']);
const SURFACE_TRANSFER_DIRECTION_OPTIONS = Object.freeze(['bidirectional', 'forward', 'reverse']);

const FIELD_LABEL_OVERRIDES = Object.freeze({
  azi: 'Azi (Dir)',
  actuationState: 'Actuation State',
  annularSeal: 'Annular Seal Override',
  'properties.annularSeal': 'Annular Seal Override',
  channelKey: 'Flow Channel',
  attachToDisplay: 'Attach To',
  attachToHostType: 'Attach Host Type',
  attachToId: 'Attach To ID',
  attachToRow: 'Attach To',
  boc: 'BOC',
  comment: 'Comments',
  componentKey: 'Component Type',
  componentType: 'Component Type',
  sectionKey: 'Section',
  boreSeal: 'Bore Seal Override',
  'properties.boreSeal': 'Bore Seal Override',
  fromVolumeKey: 'From volume',
  inc: 'Inc (Dev)',
  idOverride: 'ID (Optional)',
  integrityStatus: 'Integrity Status',
  'properties.volumeKey': 'Volume',
  'properties.direction': 'Direction',
  'properties.functionKey': 'Function Key',
  'properties.sinkRoleKey': 'Sink Role',
  'state.actuationState': 'Actuation State',
  'state.integrityStatus': 'Integrity Status',
  manualHoleSize: 'Hole Size',
  manualParent: 'Connect to Row #',
  manualDepth: 'Label Depth',
  manualOD: 'Manual OD',
  manualWidth: 'Manual Width',
  md: 'MD (Depth)',
  od: 'OD',
  parentEquipmentDisplay: 'Upstream Equipment',
  parentEquipmentId: 'Upstream Equipment ID',
  parentComponentDisplay: 'Upstream Component',
  parentComponentId: 'Upstream Component ID',
  pathId: 'Flow Path ID',
  placementRefId: 'Placement Ref ID',
  rowId: 'Row ID',
  roleKey: 'Role',
  transferType: 'Transfer Type',
  templateKey: 'Template',
  templateSlotKey: 'Template Slot',
  sourceVolumeKey: 'Source Volume',
  variantKey: 'Variant',
  sealByVolume: 'Seal By Volume',
  'properties.sealByVolume': 'Seal By Volume',
  showBottom: 'Show Bottom',
  showLabel: 'Show Label',
  showTop: 'Show Top',
  sourceType: 'Source type',
  toc: 'TOC',
  topDepth: 'Top',
  bottomDepth: 'Bottom',
  toVolumeKey: 'To volume',
  volumeKey: 'Volume',
  'state.operatingState': 'Operating State',
  'state.integrityState': 'Integrity State'
});

function normalizeToken(value) {
  return String(value ?? '').trim();
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createFieldContract(field, controlType, options = {}) {
  return Object.freeze({
    field,
    controlType,
    label: options.label ?? null,
    options: options.options ?? null,
    min: options.min ?? null,
    max: options.max ?? null,
    step: options.step ?? null,
    slider: options.slider ?? null,
    dataTabAccess: options.dataTabAccess ?? ENTITY_FIELD_ACCESS.editable,
    tableAccess: options.tableAccess ?? ENTITY_FIELD_ACCESS.editable,
    showWhen: options.showWhen ?? null,
    section: options.section ?? null,
    disclosureLevel: options.disclosureLevel ?? null,
    helperTextKey: options.helperTextKey ?? null
  });
}

function createDepthFieldContract(field, options = {}) {
  const step = Number(options?.step);
  const normalizedStep = Number.isFinite(step) && step > 0 ? step : 0.1;
  return createFieldContract(field, ENTITY_EDITOR_CONTROL_TYPES.number, {
    ...options,
    step: normalizedStep,
    slider: options?.slider ?? (({ rowData, context }) => (
      resolveConstraintAwareDepthSlider(field, rowData, context, { step: normalizedStep })
    ))
  });
}

const READ_ONLY_ROW_ID_FIELD = Object.freeze(
  createFieldContract('rowId', ENTITY_EDITOR_CONTROL_TYPES.text, {
    dataTabAccess: ENTITY_FIELD_ACCESS.readOnly,
    tableAccess: ENTITY_FIELD_ACCESS.hidden,
    section: 'transparency',
    disclosureLevel: 'advanced'
  })
);

const EQUIPMENT_COMMON_DATA_FIELD_CONTRACTS = Object.freeze([
  createFieldContract('type', ENTITY_EDITOR_CONTROL_TYPES.select, {
    options: () => EQUIPMENT_TYPE_OPTIONS,
    section: 'core',
    disclosureLevel: 'core'
  }),
  createDepthFieldContract('depth', {
    section: 'core',
    disclosureLevel: 'core'
  }),
  createFieldContract('attachToDisplay', ENTITY_EDITOR_CONTROL_TYPES.select, {
    options: ({ context }) => buildEquipmentAttachOptions(context?.casingRows, context?.tubingRows)
      .map((option) => option.value),
    section: 'core',
    disclosureLevel: 'core',
    helperTextKey: 'ui.equipment_editor.help.attach_to'
  }),
  createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text, {
    section: 'core',
    disclosureLevel: 'core'
  })
]);

const EQUIPMENT_TRAILING_DATA_FIELD_CONTRACTS = Object.freeze([
  READ_ONLY_ROW_ID_FIELD,
  createFieldContract('attachToHostType', ENTITY_EDITOR_CONTROL_TYPES.text, {
    dataTabAccess: ENTITY_FIELD_ACCESS.readOnly,
    tableAccess: ENTITY_FIELD_ACCESS.hidden,
    section: 'transparency',
    disclosureLevel: 'advanced',
    showWhen: ({ rowData }) => normalizeToken(rowData?.attachToHostType).length > 0
  }),
  createFieldContract('attachToId', ENTITY_EDITOR_CONTROL_TYPES.text, {
    dataTabAccess: ENTITY_FIELD_ACCESS.readOnly,
    tableAccess: ENTITY_FIELD_ACCESS.hidden,
    section: 'transparency',
    disclosureLevel: 'advanced',
    showWhen: ({ rowData }) => normalizeToken(rowData?.attachToId).length > 0
  })
]);

function mergeEquipmentEditorFieldContracts(fieldSets = []) {
  const merged = [];
  const fieldToIndexMap = new Map();

  toSafeArray(fieldSets).flat().forEach((fieldDefinition) => {
    if (!fieldDefinition || typeof fieldDefinition !== 'object') return;
    const field = normalizeToken(fieldDefinition.field);
    if (!field) return;

    const existingIndex = fieldToIndexMap.get(field);
    if (Number.isInteger(existingIndex)) {
      merged[existingIndex] = fieldDefinition;
      return;
    }

    fieldToIndexMap.set(field, merged.length);
    merged.push(fieldDefinition);
  });

  return merged;
}

const EQUIPMENT_FIELD_SECTION_ORDER = Object.freeze({
  core: 0,
  operating: 1,
  seal: 2,
  transparency: 3
});

const EQUIPMENT_FIELD_DISCLOSURE_ORDER = Object.freeze({
  core: 0,
  advanced: 1
});

function sortEquipmentFieldContracts(fieldContracts = []) {
  return [...fieldContracts].sort((left, right) => {
    const leftSectionOrder = EQUIPMENT_FIELD_SECTION_ORDER[left?.section] ?? 99;
    const rightSectionOrder = EQUIPMENT_FIELD_SECTION_ORDER[right?.section] ?? 99;
    if (leftSectionOrder !== rightSectionOrder) return leftSectionOrder - rightSectionOrder;

    const leftDisclosureOrder = EQUIPMENT_FIELD_DISCLOSURE_ORDER[left?.disclosureLevel] ?? 99;
    const rightDisclosureOrder = EQUIPMENT_FIELD_DISCLOSURE_ORDER[right?.disclosureLevel] ?? 99;
    if (leftDisclosureOrder !== rightDisclosureOrder) return leftDisclosureOrder - rightDisclosureOrder;

    return 0;
  });
}

function resolveEquipmentDomainFieldContracts(options = {}) {
  const rowData = options?.rowData ?? {};
  const definitionContext = {
    rowData,
    context: options?.context ?? null
  };
  const explicitEquipmentType = rowData?.typeKey ?? rowData?.type ?? null;
  const definitionFieldSets = explicitEquipmentType
    ? [resolveEquipmentEditorFields(explicitEquipmentType, definitionContext)]
    : listEquipmentDefinitions().map((definition) => (
      resolveEquipmentEditorFields(definition?.schema?.key ?? null, definitionContext)
    ));
  const dynamicFieldContracts = sortEquipmentFieldContracts(
    mergeEquipmentEditorFieldContracts(definitionFieldSets)
  );
  const trailingDynamicFields = dynamicFieldContracts.filter((fieldDefinition) => fieldDefinition?.field === 'properties.sealByVolume');
  const inlineDynamicFields = dynamicFieldContracts.filter((fieldDefinition) => fieldDefinition?.field !== 'properties.sealByVolume');

  return Object.freeze([
    ...EQUIPMENT_COMMON_DATA_FIELD_CONTRACTS,
    ...inlineDynamicFields,
    ...EQUIPMENT_TRAILING_DATA_FIELD_CONTRACTS,
    ...trailingDynamicFields
  ]);
}

const DOMAIN_FIELD_CONTRACTS = Object.freeze({
  casing: Object.freeze([
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('od', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('weight', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('grade', ENTITY_EDITOR_CONTROL_TYPES.text),
    createDepthFieldContract('top'),
    createDepthFieldContract('bottom'),
    createDepthFieldContract('toc'),
    createDepthFieldContract('boc'),
    createFieldContract('linerMode', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => getEnumOptions('linerMode')
    }),
    createFieldContract('manualParent', ENTITY_EDITOR_CONTROL_TYPES.number, {
      dataTabAccess: ENTITY_FIELD_ACCESS.hidden
    }),
    createFieldContract('idOverride', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('manualHoleSize', ENTITY_EDITOR_CONTROL_TYPES.number),
    READ_ONLY_ROW_ID_FIELD
  ]),
  tubing: Object.freeze([
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('od', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('weight', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('grade', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('idOverride', ENTITY_EDITOR_CONTROL_TYPES.number),
    createDepthFieldContract('top'),
    createDepthFieldContract('bottom'),
    READ_ONLY_ROW_ID_FIELD
  ]),
  drillString: Object.freeze([
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('componentType', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => PIPE_COMPONENT_TYPE_OPTIONS
    }),
    createFieldContract('od', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('weight', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('grade', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('idOverride', ENTITY_EDITOR_CONTROL_TYPES.number),
    createDepthFieldContract('top'),
    createDepthFieldContract('bottom'),
    READ_ONLY_ROW_ID_FIELD
  ]),
  lines: Object.freeze([
    createDepthFieldContract('depth'),
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    READ_ONLY_ROW_ID_FIELD
  ]),
  plugs: Object.freeze([
    createDepthFieldContract('top'),
    createDepthFieldContract('bottom'),
    createFieldContract('type', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => getEnumOptions('plugType')
    }),
    createFieldContract('attachToRow', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: ({ context }) => toSafeArray(context?.casingRows)
        .map((row, index) => generateCasingId(row, index))
    }),
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('manualWidth', ENTITY_EDITOR_CONTROL_TYPES.number),
    READ_ONLY_ROW_ID_FIELD,
    createFieldContract('attachToId', ENTITY_EDITOR_CONTROL_TYPES.text, {
      dataTabAccess: ENTITY_FIELD_ACCESS.readOnly,
      tableAccess: ENTITY_FIELD_ACCESS.hidden,
      showWhen: ({ rowData }) => normalizeToken(rowData?.attachToId).length > 0
    })
  ]),
  fluids: Object.freeze([
    createFieldContract('placement', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: ({ context }) => [
        ...FLUID_PLACEMENT_AUTO_OPTIONS,
        ...toSafeArray(context?.casingRows).map((row, index) => `Behind: ${generateCasingId(row, index)}`)
      ]
    }),
    createFieldContract('manualOD', ENTITY_EDITOR_CONTROL_TYPES.number),
    createDepthFieldContract('top'),
    createDepthFieldContract('bottom'),
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    READ_ONLY_ROW_ID_FIELD,
    createFieldContract('placementRefId', ENTITY_EDITOR_CONTROL_TYPES.text, {
      dataTabAccess: ENTITY_FIELD_ACCESS.readOnly,
      tableAccess: ENTITY_FIELD_ACCESS.hidden,
      showWhen: ({ rowData }) => normalizeToken(rowData?.placementRefId).length > 0
    })
  ]),
  markers: Object.freeze([
    createDepthFieldContract('top'),
    createDepthFieldContract('bottom'),
    createFieldContract('type', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => getEnumOptions('markerType')
    }),
    createFieldContract('attachToHostType', ENTITY_EDITOR_CONTROL_TYPES.select, {
      label: 'Target mode',
      options: () => MARKER_HOST_TYPE_OPTIONS
    }),
    createFieldContract('attachToRow', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: ({ rowData, context }) => {
        const hostType = normalizePipeHostType(rowData?.attachToHostType, PIPE_HOST_TYPE_CASING);
        const hostRows = hostType === PIPE_HOST_TYPE_TUBING
          ? context?.tubingRows
          : context?.casingRows;
        return buildPipeReferenceOptions(hostRows, hostType);
      }
    }),
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    READ_ONLY_ROW_ID_FIELD,
    createFieldContract('attachToId', ENTITY_EDITOR_CONTROL_TYPES.text, {
      dataTabAccess: ENTITY_FIELD_ACCESS.readOnly,
      tableAccess: ENTITY_FIELD_ACCESS.hidden,
      showWhen: ({ rowData }) => normalizeToken(rowData?.attachToId).length > 0
    })
  ]),
  topologySources: Object.freeze([
    createFieldContract('top', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('bottom', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('sourceType', ENTITY_EDITOR_CONTROL_TYPES.text, {
      dataTabAccess: ENTITY_FIELD_ACCESS.hidden,
      tableAccess: ENTITY_FIELD_ACCESS.hidden,
      showWhen: ({ rowData }) => normalizeToken(rowData?.sourceType).length > 0
    }),
    createFieldContract('volumeKey', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS
    }),
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('show', ENTITY_EDITOR_CONTROL_TYPES.toggle, {
      dataTabAccess: ENTITY_FIELD_ACCESS.hidden,
      tableAccess: ENTITY_FIELD_ACCESS.hidden
    }),
    READ_ONLY_ROW_ID_FIELD
  ]),
  topologyBreakouts: Object.freeze([
    createFieldContract('top', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('bottom', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('fromVolumeKey', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS
    }),
    createFieldContract('toVolumeKey', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS
    }),
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('show', ENTITY_EDITOR_CONTROL_TYPES.toggle),
    READ_ONLY_ROW_ID_FIELD,
    createFieldContract('sourceType', ENTITY_EDITOR_CONTROL_TYPES.text, {
      dataTabAccess: ENTITY_FIELD_ACCESS.readOnly,
      tableAccess: ENTITY_FIELD_ACCESS.hidden,
      showWhen: ({ rowData }) => normalizeToken(rowData?.sourceType).length > 0
    }),
    createFieldContract('volumeKey', ENTITY_EDITOR_CONTROL_TYPES.text, {
      dataTabAccess: ENTITY_FIELD_ACCESS.readOnly,
      tableAccess: ENTITY_FIELD_ACCESS.hidden,
      showWhen: ({ rowData }) => normalizeToken(rowData?.volumeKey).length > 0
    })
  ]),
  boxes: Object.freeze([
    createDepthFieldContract('topDepth'),
    createDepthFieldContract('bottomDepth'),
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('detail', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('bandWidth', ENTITY_EDITOR_CONTROL_TYPES.number),
    READ_ONLY_ROW_ID_FIELD
  ]),
  trajectory: Object.freeze([
    createFieldContract('md', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('inc', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('azi', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('comment', ENTITY_EDITOR_CONTROL_TYPES.text),
    READ_ONLY_ROW_ID_FIELD
  ]),
  surfaceEquipment: Object.freeze([
    createFieldContract('channelDisplay', ENTITY_EDITOR_CONTROL_TYPES.text, {
      tableAccess: ENTITY_FIELD_ACCESS.editable,
      dataTabAccess: ENTITY_FIELD_ACCESS.hidden
    }),
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('channelKey', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS,
      tableAccess: ENTITY_FIELD_ACCESS.hidden
    }),
    createFieldContract('componentType', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => ['valve', 'outlet', 'crossover']
    }),
    createFieldContract('status', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => ['open', 'closed', 'failed_open', 'failed_closed', 'leaking']
    }),
    createFieldContract('sequence', ENTITY_EDITOR_CONTROL_TYPES.number),
    createFieldContract('connectedToDisplay', ENTITY_EDITOR_CONTROL_TYPES.text, {
      tableAccess: ENTITY_FIELD_ACCESS.editable,
      dataTabAccess: ENTITY_FIELD_ACCESS.hidden
    }),
    createFieldContract('connectedTo', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS,
      tableAccess: ENTITY_FIELD_ACCESS.hidden
    }),
    createFieldContract('crossoverDirection', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => SURFACE_TRANSFER_DIRECTION_OPTIONS
    }),
    createFieldContract('show', ENTITY_EDITOR_CONTROL_TYPES.toggle),
    READ_ONLY_ROW_ID_FIELD
  ]),
  surfacePaths: Object.freeze([
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('channelKey', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS
    }),
    createFieldContract('show', ENTITY_EDITOR_CONTROL_TYPES.toggle),
    READ_ONLY_ROW_ID_FIELD
  ]),
  surfaceTransfers: Object.freeze([
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('transferType', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => SURFACE_TRANSFER_TYPE_OPTIONS
    }),
    createFieldContract('fromChannelKey', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS
    }),
    createFieldContract('toChannelKey', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS
    }),
    createFieldContract('direction', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => SURFACE_TRANSFER_DIRECTION_OPTIONS
    }),
    createFieldContract('show', ENTITY_EDITOR_CONTROL_TYPES.toggle),
    READ_ONLY_ROW_ID_FIELD
  ]),
  surfaceOutlets: Object.freeze([
    createFieldContract('label', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('channelKey', ENTITY_EDITOR_CONTROL_TYPES.select, {
      options: () => TOPOLOGY_VOLUME_KINDS
    }),
    createFieldContract('kind', ENTITY_EDITOR_CONTROL_TYPES.text),
    createFieldContract('show', ENTITY_EDITOR_CONTROL_TYPES.toggle),
    READ_ONLY_ROW_ID_FIELD
  ])
});

function normalizeSelectOptions(sourceOptions = []) {
  const seen = new Set();
  return toSafeArray(sourceOptions)
    .map((option) => {
      if (option && typeof option === 'object' && 'value' in option) {
        const value = option.value;
        return {
          label: String(option.label ?? value ?? ''),
          value
        };
      }
      return {
        label: String(option ?? ''),
        value: option
      };
    })
    .filter((option) => option.label.length > 0 || option.value === 0 || option.value === false || option.value === null)
    .filter((option) => {
      const key = `${typeof option.value}:${String(option.value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function resolveSelectOptions(optionSource, rowData, context) {
  if (!optionSource) return [];
  const source = typeof optionSource === 'function'
    ? optionSource({ rowData, context })
    : optionSource;
  return normalizeSelectOptions(source);
}

function resolveControlConfigValue(configValue, rowData, context) {
  if (typeof configValue === 'function') {
    return configValue({ rowData, context });
  }
  return configValue;
}

function normalizeFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeControlStep(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeSliderConfig(sliderConfig, fallbackStep) {
  if (!sliderConfig || typeof sliderConfig !== 'object') return null;

  const min = normalizeFiniteNumber(sliderConfig.min);
  const max = normalizeFiniteNumber(sliderConfig.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;

  const resolvedStep = normalizeControlStep(sliderConfig.step)
    ?? normalizeControlStep(fallbackStep)
    ?? 0.1;

  return {
    min,
    max,
    step: resolvedStep
  };
}

function resolveNumericControlConfig(configDefinition, sourceRow, context) {
  const configuredMin = normalizeFiniteNumber(resolveControlConfigValue(configDefinition?.min, sourceRow, context));
  const configuredMax = normalizeFiniteNumber(resolveControlConfigValue(configDefinition?.max, sourceRow, context));
  const configuredStep = normalizeControlStep(resolveControlConfigValue(configDefinition?.step, sourceRow, context));
  const sliderSource = resolveControlConfigValue(configDefinition?.slider, sourceRow, context);
  const slider = normalizeSliderConfig(sliderSource, configuredStep);

  const min = configuredMin ?? slider?.min ?? null;
  const max = configuredMax ?? slider?.max ?? null;
  const step = configuredStep ?? slider?.step ?? null;

  return {
    min,
    max,
    step,
    slider
  };
}

export function resolveControlType(value) {
  if (typeof value === 'boolean') return ENTITY_EDITOR_CONTROL_TYPES.toggle;
  if (typeof value === 'number') return ENTITY_EDITOR_CONTROL_TYPES.number;
  if (value && typeof value === 'object') return ENTITY_EDITOR_CONTROL_TYPES.json;
  return ENTITY_EDITOR_CONTROL_TYPES.text;
}

export function resolveFieldLabel(field) {
  const token = normalizeToken(field);
  if (!token) return '';
  const override = FIELD_LABEL_OVERRIDES[token];
  if (override) return override;
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

export function resolveEntityEditorDomainKey(entityType) {
  const token = normalizeToken(entityType);
  if (!token) return null;
  return ENTITY_TYPE_TO_DOMAIN_KEY[token] ?? ENTITY_TYPE_TO_DOMAIN_KEY[token.toLowerCase()] ?? null;
}

export function resolveDomainFieldContracts(domainKey, options = {}) {
  const normalizedDomainKey = normalizeToken(domainKey);
  if (normalizedDomainKey === 'equipment') {
    return resolveEquipmentDomainFieldContracts(options);
  }
  return DOMAIN_FIELD_CONTRACTS[normalizedDomainKey] ?? [];
}

function shouldIncludeDataTabField(definition, sourceRow, context, includeReadOnly) {
  const access = definition?.dataTabAccess ?? ENTITY_FIELD_ACCESS.editable;
  if (access === ENTITY_FIELD_ACCESS.hidden) return false;
  if (access === ENTITY_FIELD_ACCESS.readOnly && includeReadOnly !== true) return false;
  if (typeof definition?.showWhen === 'function') {
    return definition.showWhen({
      rowData: sourceRow,
      context
    }) === true;
  }
  return true;
}

export function resolveFieldDefinitionFromContract(configDefinition, sourceRow, context) {
  const field = normalizeToken(configDefinition?.field);
  if (!field) return null;

  const controlType = configDefinition?.controlType ?? resolveControlType(sourceRow?.[field]);
  const options = controlType === ENTITY_EDITOR_CONTROL_TYPES.select
    ? resolveSelectOptions(configDefinition?.options, sourceRow, context)
    : null;
  const numericControlConfig = controlType === ENTITY_EDITOR_CONTROL_TYPES.number
    ? resolveNumericControlConfig(configDefinition, sourceRow, context)
    : { min: null, max: null, step: null, slider: null };

  return {
    field,
    label: configDefinition?.label ?? resolveFieldLabel(field),
    controlType,
    options,
    min: numericControlConfig.min,
    max: numericControlConfig.max,
    step: numericControlConfig.step,
    slider: numericControlConfig.slider,
    readOnly: (configDefinition?.dataTabAccess ?? ENTITY_FIELD_ACCESS.editable) === ENTITY_FIELD_ACCESS.readOnly,
    section: configDefinition?.section ?? null,
    disclosureLevel: configDefinition?.disclosureLevel ?? null,
    helperTextKey: configDefinition?.helperTextKey ?? null
  };
}

export function resolveDataTabFieldDefinitions({
  entityType,
  rowData = {},
  context = null,
  includeReadOnly = DATA_TAB_READ_ONLY_FIELDS_ENABLED
} = {}) {
  const sourceRow = rowData && typeof rowData === 'object' ? rowData : {};
  const domainKey = resolveEntityEditorDomainKey(entityType);
  const domainContracts = resolveDomainFieldContracts(domainKey, {
    rowData: sourceRow,
    context
  });

  return domainContracts
    .filter((definition) => shouldIncludeDataTabField(definition, sourceRow, context, includeReadOnly))
    .map((definition) => resolveFieldDefinitionFromContract(definition, sourceRow, context))
    .filter(Boolean);
}

export function getTableEditableDataFieldNames(entityType) {
  const domainKey = resolveEntityEditorDomainKey(entityType);
  return resolveDomainFieldContracts(domainKey)
    .filter((definition) => (definition?.tableAccess ?? ENTITY_FIELD_ACCESS.editable) === ENTITY_FIELD_ACCESS.editable)
    .map((definition) => normalizeToken(definition?.field))
    .filter((field) => field.length > 0);
}

export function getTableHiddenDataFieldNames(entityType) {
  const domainKey = resolveEntityEditorDomainKey(entityType);
  return resolveDomainFieldContracts(domainKey)
    .filter((definition) => (definition?.tableAccess ?? ENTITY_FIELD_ACCESS.editable) === ENTITY_FIELD_ACCESS.hidden)
    .map((definition) => normalizeToken(definition?.field))
    .filter((field) => field.length > 0);
}
