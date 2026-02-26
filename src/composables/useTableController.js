import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Handsontable from 'handsontable';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import {
    NAMED_COLORS,
    DEFAULT_LINE_COLOR,
    DEFAULT_BOX_COLOR,
    DEFAULT_BOX_FONT_COLOR,
    DEFAULT_CEMENT_COLOR,
    DEFAULT_CEMENT_PLUG_COLOR,
    CASING_NUMERIC_FIELDS,
    TUBING_NUMERIC_FIELDS,
    DRILL_STRING_NUMERIC_FIELDS,
    EQUIPMENT_NUMERIC_FIELDS,
    LINE_NUMERIC_FIELDS,
    BOX_NUMERIC_FIELDS,
    PLUG_NUMERIC_FIELDS,
    MARKER_NUMERIC_FIELDS,
    FLUID_NUMERIC_FIELDS,
    FLUID_PLACEMENT_AUTO_OPTIONS,
    FLUID_PLACEMENT_DEFAULT_OPTION
} from '@/constants/index.js';
import { generateCasingId } from '@/utils/general.js';
import { getLanguage, getEnumOptions, onLanguageChange, t, translateEnum } from '@/app/i18n.js';
import { refreshHotLayout } from '@/app/hot.js';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';
import {
    syncSelectionIndicators,
    clearCasingSelection,
    clearTubingSelection,
    clearDrillStringSelection,
    clearEquipmentSelection,
    clearLineSelection,
    clearBoxSelection,
    clearMarkerSelection,
    clearPlugSelection,
    clearFluidSelection,
    handleTableClick
} from '@/app/selection.js';
import {
    activeTableTabKey,
    clearPendingTableRowFocus,
    isTablesAccordionOpen,
    pendingTableRowFocus
} from '@/components/tables/panes/tablePaneState.js';
import { getHotTableInstance, setHotTableInstance } from '@/composables/useHotTableRegistry.js';
import { resolveTrajectoryPointsFromRows } from '@/app/trajectoryMathCore.mjs';
import {
    applyRowHeaderHighlight,
    applySampleKeyChanges,
    buildBaseHotSettings,
    buildColorRenderer,
    buildEnumRenderer,
    buildRequiredCells,
    cloneRows,
    ensureHandsontableModulesRegistered,
    focusHandsontableRow,
    normalizeHotChanges,
    syncBoxFontColor,
    syncLineFontColor
} from '@/composables/useTableHelpers.js';
import {
    isPipeInteractionType,
    normalizeInteractionEntity
} from '@/composables/useSchematicInteraction.js';
import {
    EQUIPMENT_TYPE_OPTIONS
} from '@/topology/equipmentMetadata.js';
import {
    SOURCE_KIND_FORMATION_INFLOW,
    SOURCE_KIND_LEAK,
    SOURCE_KIND_PERFORATION,
    SOURCE_KIND_SCENARIO,
    TOPOLOGY_VOLUME_KINDS
} from '@/topology/topologyTypes.js';
import {
    filterScenarioBreakoutRows,
    mergeScenarioBreakoutRows
} from '@/topology/sourceRows.js';
import {
    buildPipeReferenceOptions,
    normalizePipeHostType,
    PIPE_HOST_TYPE_CASING,
    PIPE_HOST_TYPE_TUBING
} from '@/utils/pipeReference.js';
import {
    buildEquipmentAttachOptions,
    resolveEquipmentAttachOption
} from '@/utils/equipmentAttachReference.js';

const TRAJECTORY_NUMERIC_FIELDS = new Set(['md', 'inc', 'azi']);
const TOPOLOGY_SOURCE_NUMERIC_FIELDS = new Set(['top', 'bottom']);
const TRAJECTORY_COMPUTED_FIELD_KEYS = Object.freeze(['calcTvd', 'calcNorth', 'calcEast', 'calcVs', 'calcDls']);
const TOPOLOGY_SOURCE_TYPE_OPTIONS = Object.freeze([
    SOURCE_KIND_FORMATION_INFLOW,
    SOURCE_KIND_PERFORATION,
    SOURCE_KIND_LEAK,
    SOURCE_KIND_SCENARIO
]);
const TOPOLOGY_SOURCE_VOLUME_OPTIONS = TOPOLOGY_VOLUME_KINDS;
const MARKER_HOST_TYPE_OPTIONS = Object.freeze([
    PIPE_HOST_TYPE_CASING,
    PIPE_HOST_TYPE_TUBING
]);

const TABLE_STATE_KEY_MAP = Object.freeze({
    casing: 'casingData',
    tubing: 'tubingData',
    drillString: 'drillStringData',
    equipment: 'equipmentData',
    line: 'horizontalLines',
    plug: 'cementPlugs',
    fluid: 'annulusFluids',
    marker: 'markers',
    topologySource: 'topologySources',
    topologyBreakout: 'topologySources',
    box: 'annotationBoxes',
    trajectory: 'trajectory'
});
const PIPE_COMPONENT_TYPE_OPTIONS = Object.freeze(['pipe', 'packer', 'collar', 'stabilizer', 'bit']);
const DROPDOWN_EDITOR_DEFAULTS = Object.freeze({
    visibleRows: 6,
    trimDropdown: false
});

function tf(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
}

function getRows(schema) {
    const rows = schema?.getData?.();
    return Array.isArray(rows) ? rows : [];
}

function toFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function buildTrajectoryKey(md, inc, azi) {
    if (!Number.isFinite(md) || !Number.isFinite(inc) || !Number.isFinite(azi)) return null;
    return `${md.toFixed(6)}|${inc.toFixed(6)}|${azi.toFixed(6)}`;
}

function stripTrajectoryComputedFields(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        const nextRow = { ...row };
        TRAJECTORY_COMPUTED_FIELD_KEYS.forEach((field) => {
            delete nextRow[field];
        });
        return nextRow;
    });
}

function buildTrajectoryRowsWithComputed(rows, config) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const points = resolveTrajectoryPointsFromRows(sourceRows, config);
    const computedByKey = new Map();

    points.forEach((point) => {
        const key = buildTrajectoryKey(
            toFiniteNumber(point?.md),
            toFiniteNumber(point?.inc),
            toFiniteNumber(point?.azi)
        );
        if (!key) return;

        if (!computedByKey.has(key)) {
            computedByKey.set(key, []);
        }

        computedByKey.get(key).push({
            calcTvd: toFiniteNumber(point?.tvd),
            calcNorth: toFiniteNumber(point?.north),
            calcEast: toFiniteNumber(point?.east),
            calcVs: toFiniteNumber(point?.x),
            calcDls: toFiniteNumber(point?.dls)
        });
    });

    return sourceRows.map((row) => {
        const key = buildTrajectoryKey(
            toFiniteNumber(row?.md),
            toFiniteNumber(row?.inc),
            toFiniteNumber(row?.azi)
        );
        const queue = key ? computedByKey.get(key) : null;
        const computed = Array.isArray(queue) && queue.length > 0
            ? queue.shift()
            : {
                calcTvd: null,
                calcNorth: null,
                calcEast: null,
                calcVs: null,
                calcDls: null
            };

        return {
            ...row,
            ...computed
        };
    });
}

function resolvePipeSelectionIndex(type, interaction) {
    const lockedEntity = normalizeInteractionEntity(interaction?.lockedEntity);
    const hoveredEntity = normalizeInteractionEntity(interaction?.hoveredEntity);
    const activeEntity = lockedEntity ?? hoveredEntity;
    if (!activeEntity || !isPipeInteractionType(activeEntity.type)) return null;
    if (activeEntity.type !== type) return null;
    if (!Number.isInteger(activeEntity.id) || activeEntity.id < 0) return null;
    return activeEntity.id;
}

function resolveNonPipeSelectionIndex(type, interaction) {
    const lockedEntity = normalizeInteractionEntity(interaction?.lockedEntity);
    if (lockedEntity?.type === type && Number.isInteger(lockedEntity.id) && lockedEntity.id >= 0) {
        return lockedEntity.id;
    }

    const hoveredEntity = normalizeInteractionEntity(interaction?.hoveredEntity);
    if (hoveredEntity?.type === type && Number.isInteger(hoveredEntity.id) && hoveredEntity.id >= 0) {
        return hoveredEntity.id;
    }

    return null;
}

function getSelectedIndex(type, interaction) {
    if (type === 'casing' || type === 'tubing' || type === 'drillString') {
        return resolvePipeSelectionIndex(type, interaction);
    }
    if (type === 'line' || type === 'box' || type === 'marker' || type === 'plug' || type === 'fluid' || type === 'equipment') {
        return resolveNonPipeSelectionIndex(type, interaction);
    }
    return null;
}

const CLEAR_SELECTION_HANDLERS = Object.freeze({
    casing: clearCasingSelection,
    tubing: clearTubingSelection,
    drillString: clearDrillStringSelection,
    equipment: clearEquipmentSelection,
    line: clearLineSelection,
    box: clearBoxSelection,
    marker: clearMarkerSelection,
    plug: clearPlugSelection,
    fluid: clearFluidSelection
});

function buildTableSchema(type, domainState) {
    const colorRenderer = buildColorRenderer();

    if (type === 'casing') {
        return {
            getData: () => domainState.casingData,
            colHeaders: () => [
                t('table.casing.label'),
                t('table.casing.od'),
                t('table.casing.weight'),
                t('table.casing.grade'),
                t('table.casing.top'),
                t('table.casing.bottom'),
                t('table.casing.toc'),
                t('table.casing.boc'),
                tf('table.casing.liner_mode', 'Liner Mode'),
                tf('table.casing.manual_parent', 'Connect to Row #'),
                tf('table.casing.id_override', 'ID (Optional)'),
                tf('table.casing.manual_hole_size', 'Hole Size'),
                t('table.casing.label_x'),
                t('table.casing.label_depth'),
                t('ui.casing_label_font_size'),
                t('ui.depth_label_font_size'),
                t('ui.depth_label_offset'),
                t('table.casing.show_top'),
                t('table.casing.show_bottom')
            ],
            columns: () => [
                { data: 'label', type: 'text' },
                { data: 'od', type: 'numeric' },
                { data: 'weight', type: 'numeric' },
                { data: 'grade', type: 'text' },
                { data: 'top', type: 'numeric' },
                { data: 'bottom', type: 'numeric' },
                { data: 'toc', type: 'numeric' },
                { data: 'boc', type: 'numeric' },
                {
                    data: 'linerMode',
                    type: 'dropdown',
                    source: getEnumOptions('linerMode'),
                    strict: true,
                    renderer: buildEnumRenderer('linerMode'),
                    className: 'htCenter',
                    width: 80
                },
                { data: 'manualParent', type: 'numeric' },
                { data: 'idOverride', type: 'numeric' },
                { data: 'manualHoleSize', type: 'numeric' },
                { data: 'labelXPos', type: 'numeric' },
                { data: 'manualLabelDepth', type: 'numeric' },
                { data: 'casingLabelFontSize', type: 'numeric' },
                { data: 'depthLabelFontSize', type: 'numeric' },
                { data: 'depthLabelOffset', type: 'numeric' },
                { data: 'showTop', type: 'checkbox', className: 'htCenter' },
                { data: 'showBottom', type: 'checkbox', className: 'htCenter' }
            ],
            requiredFields: ['label', 'od', 'weight', 'grade', 'top', 'bottom'],
            numericFields: CASING_NUMERIC_FIELDS,
            sampleKeyFields: ['label'],
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            buildDefaultRow: () => ({
                label: t('defaults.new_casing'),
                od: 9.625,
                weight: 40,
                idOverride: null,
                manualHoleSize: null,
                linerMode: translateEnum('linerMode', 'Auto'),
                manualParent: null,
                grade: 'L80',
                top: 0,
                bottom: 5000,
                toc: null,
                boc: null,
                labelXPos: null,
                manualLabelDepth: null,
                casingLabelFontSize: null,
                depthLabelFontSize: null,
                depthLabelOffset: null,
                showTop: true,
                showBottom: true
            })
        };
    }

    if (type === 'tubing') {
        return {
            getData: () => domainState.tubingData,
            colHeaders: () => [
                tf('table.tubing.label', 'Label'),
                tf('table.tubing.od', 'OD'),
                tf('table.tubing.weight', 'Weight'),
                tf('table.tubing.grade', 'Grade'),
                tf('table.tubing.id_override', 'ID (Optional)'),
                tf('table.tubing.top', 'Top'),
                tf('table.tubing.bottom', 'Bottom'),
                t('table.casing.label_x'),
                t('table.casing.label_depth'),
                t('table.boxes.font_size'),
                t('table.fluids.show')
            ],
            columns: () => [
                { data: 'label', type: 'text' },
                { data: 'od', type: 'numeric' },
                { data: 'weight', type: 'numeric' },
                { data: 'grade', type: 'text' },
                { data: 'idOverride', type: 'numeric' },
                { data: 'top', type: 'numeric' },
                { data: 'bottom', type: 'numeric' },
                { data: 'labelXPos', type: 'numeric' },
                { data: 'manualLabelDepth', type: 'numeric' },
                { data: 'labelFontSize', type: 'numeric' },
                { data: 'showLabel', type: 'checkbox', className: 'htCenter' }
            ],
            requiredFields: ['label', 'od', 'top', 'bottom'],
            numericFields: TUBING_NUMERIC_FIELDS,
            sampleKeyFields: ['label'],
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            buildDefaultRow: () => ({
                label: t('defaults.new_tubing'),
                od: 2.875,
                weight: 6.5,
                grade: 'L80',
                idOverride: null,
                top: 0,
                bottom: 10000,
                labelXPos: null,
                manualLabelDepth: null,
                labelFontSize: null,
                showLabel: true
            })
        };
    }

    if (type === 'drillString') {
        return {
            getData: () => domainState.drillStringData,
            colHeaders: () => [
                tf('table.drill_string.label', 'Label'),
                tf('table.drill_string.component_type', 'Component Type'),
                tf('table.drill_string.od', 'OD'),
                tf('table.drill_string.weight', 'Weight'),
                tf('table.drill_string.grade', 'Grade'),
                tf('table.drill_string.id_override', 'ID (Optional)'),
                tf('table.drill_string.top', 'Top'),
                tf('table.drill_string.bottom', 'Bottom'),
                t('table.casing.label_x'),
                t('table.casing.label_depth'),
                t('table.boxes.font_size'),
                t('table.fluids.show')
            ],
            columns: () => [
                { data: 'label', type: 'text' },
                {
                    data: 'componentType',
                    type: 'dropdown',
                    source: PIPE_COMPONENT_TYPE_OPTIONS,
                    strict: false,
                    allowInvalid: true
                },
                { data: 'od', type: 'numeric' },
                { data: 'weight', type: 'numeric' },
                { data: 'grade', type: 'text' },
                { data: 'idOverride', type: 'numeric' },
                { data: 'top', type: 'numeric' },
                { data: 'bottom', type: 'numeric' },
                { data: 'labelXPos', type: 'numeric' },
                { data: 'manualLabelDepth', type: 'numeric' },
                { data: 'labelFontSize', type: 'numeric' },
                { data: 'showLabel', type: 'checkbox', className: 'htCenter' }
            ],
            requiredFields: ['label', 'od', 'top', 'bottom'],
            numericFields: DRILL_STRING_NUMERIC_FIELDS,
            sampleKeyFields: ['label'],
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            buildDefaultRow: () => ({
                label: t('defaults.new_drill_string'),
                componentType: 'pipe',
                od: 5.0,
                weight: 19.5,
                grade: 'S-135',
                idOverride: null,
                top: 0,
                bottom: 10000,
                labelXPos: null,
                manualLabelDepth: null,
                labelFontSize: null,
                showLabel: true
            })
        };
    }

    if (type === 'equipment') {
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
                tf('table.equipment.show_label', 'Show label')
            ],
            columns: () => {
                const attachSource = (query, process) => {
                    const options = buildEquipmentAttachOptions(domainState.casingData, domainState.tubingData)
                        .map((option) => option.value);
                    if (typeof process === 'function') {
                        process(options);
                    }
                    return options;
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

    if (type === 'line') {
        return {
            getData: () => domainState.horizontalLines,
            prepareData: (rows) => rows.map((row) => ({ ...row })),
            colHeaders: () => [
                t('table.lines.depth'),
                t('table.lines.label'),
                t('table.lines.line_color'),
                t('table.lines.font_color'),
                t('table.lines.font_size'),
                t('table.lines.line_style'),
                t('table.lines.label_x'),
                t('table.lines.show')
            ],
            columns: () => [
                { data: 'depth', type: 'numeric' },
                { data: 'label', type: 'text' },
                {
                    data: 'color',
                    type: 'dropdown',
                    source: NAMED_COLORS,
                    strict: false,
                    allowInvalid: true,
                    renderer: colorRenderer
                },
                {
                    data: 'fontColor',
                    type: 'dropdown',
                    source: NAMED_COLORS,
                    strict: false,
                    allowInvalid: true,
                    renderer: colorRenderer
                },
                { data: 'fontSize', type: 'numeric' },
                {
                    data: 'lineStyle',
                    type: 'dropdown',
                    source: getEnumOptions('lineStyle'),
                    strict: true,
                    renderer: buildEnumRenderer('lineStyle')
                },
                { data: 'labelXPos', type: 'numeric' },
                { data: 'show', type: 'checkbox', className: 'htCenter' }
            ],
            requiredFields: ['depth', 'label'],
            numericFields: LINE_NUMERIC_FIELDS,
            sampleKeyFields: ['label'],
            afterChangeIgnoreSources: ['loadData', 'normalize', 'colorSync'],
            afterChangeExtra: (instance, changes) => syncLineFontColor(instance, changes),
            buildDefaultRow: () => ({
                depth: 1000,
                label: t('defaults.new_line'),
                color: DEFAULT_LINE_COLOR,
                fontColor: DEFAULT_LINE_COLOR,
                fontSize: 11,
                lineStyle: translateEnum('lineStyle', 'Solid'),
                labelXPos: null,
                show: true
            })
        };
    }

    if (type === 'plug') {
        return {
            getData: () => domainState.cementPlugs,
            prepareData: (rows) => rows.map((row) => ({
                ...row,
                show: row?.show !== false
            })),
            colHeaders: () => [
                t('table.plugs.top'),
                t('table.plugs.bottom'),
                t('table.plugs.type'),
                tf('table.plugs.attach_to', 'Attach To'),
                t('table.plugs.label'),
                t('table.plugs.color'),
                t('table.plugs.hatch'),
                t('table.plugs.manual_width'),
                tf('table.plugs.show', 'Show')
            ],
            columns: () => {
                const attachSource = (query, process) => {
                    const options = domainState.casingData.map((row, index) => generateCasingId(row, index));
                    if (typeof process === 'function') {
                        process(options);
                    }
                    return options;
                };
                return [
                    { data: 'top', type: 'numeric' },
                    { data: 'bottom', type: 'numeric' },
                    {
                        data: 'type',
                        type: 'dropdown',
                        source: getEnumOptions('plugType'),
                        strict: true,
                        renderer: buildEnumRenderer('plugType')
                    },
                    {
                        data: 'attachToRow',
                        type: 'dropdown',
                        source: attachSource,
                        strict: false,
                        allowInvalid: true
                    },
                    { data: 'label', type: 'text' },
                    {
                        data: 'color',
                        type: 'dropdown',
                        source: NAMED_COLORS,
                        strict: false,
                        allowInvalid: true,
                        renderer: colorRenderer
                    },
                    {
                        data: 'hatchStyle',
                        type: 'dropdown',
                        source: getEnumOptions('hatchStyle'),
                        strict: true,
                        renderer: buildEnumRenderer('hatchStyle')
                    },
                    { data: 'manualWidth', type: 'numeric' },
                    { data: 'show', type: 'checkbox', className: 'htCenter' }
                ];
            },
            requiredFields: ['top', 'bottom', 'type', 'attachToRow', 'label'],
            numericFields: PLUG_NUMERIC_FIELDS,
            sampleKeyFields: ['label'],
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            buildDefaultRow: () => {
                const defaultAttachTo = domainState.casingData.length > 0
                    ? generateCasingId(domainState.casingData[0], 0)
                    : null;
                return {
                    top: 1000,
                    bottom: 1500,
                    type: translateEnum('plugType', 'Cement'),
                    targetMode: translateEnum('targetMode', 'Auto (innermost)'),
                    attachToRow: defaultAttachTo,
                    label: '',
                    color: DEFAULT_CEMENT_PLUG_COLOR,
                    hatchStyle: translateEnum('hatchStyle', 'None'),
                    manualWidth: null,
                    show: true
                };
            }
        };
    }

    if (type === 'fluid') {
        return {
            getData: () => domainState.annulusFluids,
            prepareData: (rows) => rows.map((row) => ({ ...row })),
            colHeaders: () => [
                tf('table.fluids.placement', 'Placement'),
                t('table.fluids.manual_od'),
                t('table.fluids.top'),
                t('table.fluids.bottom'),
                t('table.fluids.label'),
                t('table.fluids.fill_color'),
                t('table.fluids.hatch_style'),
                t('table.fluids.text_color'),
                t('table.fluids.font_size'),
                t('table.fluids.label_x'),
                t('table.fluids.label_depth'),
                t('table.fluids.show')
            ],
            columns: () => {
                const placementSource = (query, process) => {
                    const behindOptions = domainState.casingData
                        .map((row, index) => `Behind: ${generateCasingId(row, index)}`);
                    const options = [
                        ...FLUID_PLACEMENT_AUTO_OPTIONS,
                        ...behindOptions
                    ];
                    if (typeof process === 'function') {
                        process(options);
                    }
                    return options;
                };

                return [
                    {
                        data: 'placement',
                        type: 'dropdown',
                        source: placementSource,
                        strict: false,
                        allowInvalid: true
                    },
                    { data: 'manualOD', type: 'numeric' },
                    { data: 'top', type: 'numeric' },
                    { data: 'bottom', type: 'numeric' },
                    { data: 'label', type: 'text' },
                    {
                        data: 'color',
                        type: 'dropdown',
                        source: NAMED_COLORS,
                        strict: false,
                        allowInvalid: true,
                        renderer: colorRenderer
                    },
                    {
                        data: 'hatchStyle',
                        type: 'dropdown',
                        source: getEnumOptions('hatchStyle'),
                        strict: true,
                        renderer: buildEnumRenderer('hatchStyle')
                    },
                    {
                        data: 'textColor',
                        type: 'dropdown',
                        source: NAMED_COLORS,
                        strict: false,
                        allowInvalid: true,
                        renderer: colorRenderer
                    },
                    { data: 'fontSize', type: 'numeric' },
                    { data: 'labelXPos', type: 'numeric' },
                    { data: 'manualDepth', type: 'numeric' },
                    { data: 'show', type: 'checkbox', className: 'htCenter' }
                ];
            },
            requiredFields: ['placement', 'top', 'bottom', 'label'],
            numericFields: FLUID_NUMERIC_FIELDS,
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            buildDefaultRow: () => ({
                placement: FLUID_PLACEMENT_DEFAULT_OPTION,
                manualOD: null,
                top: 1000,
                bottom: 1500,
                label: t('defaults.new_fluid'),
                color: DEFAULT_CEMENT_COLOR,
                hatchStyle: translateEnum('hatchStyle', 'None'),
                textColor: 'black',
                fontSize: 11,
                labelXPos: null,
                manualDepth: null,
                show: true
            })
        };
    }

    if (type === 'marker') {
        return {
            getData: () => domainState.markers,
            prepareData: (rows) => rows.map((row) => ({
                ...row,
                attachToHostType: normalizePipeHostType(row?.attachToHostType, PIPE_HOST_TYPE_CASING),
                show: row?.show !== false
            })),
            colHeaders: () => [
                t('table.markers.top'),
                t('table.markers.bottom'),
                t('table.markers.type'),
                tf('table.markers.target_mode', 'Target mode'),
                tf('table.markers.attach_to', 'Attach To'),
                t('table.markers.side'),
                t('table.markers.color'),
                t('table.markers.scale'),
                t('table.markers.label'),
                tf('table.markers.show', 'Show')
            ],
            columns: () => {
                const attachSource = function (query, process) {
                    const rowIndex = Number(this?.row);
                    const tableRow = typeof this?.instance?.getSourceDataAtRow === 'function'
                        ? this.instance.getSourceDataAtRow(rowIndex)
                        : null;
                    const hostType = normalizePipeHostType(tableRow?.attachToHostType, PIPE_HOST_TYPE_CASING);
                    const hostRows = hostType === PIPE_HOST_TYPE_TUBING
                        ? domainState.tubingData
                        : domainState.casingData;
                    const options = buildPipeReferenceOptions(hostRows, hostType);
                    if (typeof process === 'function') {
                        process(options);
                    }
                    return options;
                };
                return [
                    { data: 'top', type: 'numeric' },
                    { data: 'bottom', type: 'numeric' },
                    {
                        data: 'type',
                        type: 'dropdown',
                        source: getEnumOptions('markerType'),
                        strict: true,
                        renderer: buildEnumRenderer('markerType')
                    },
                    {
                        data: 'attachToHostType',
                        type: 'dropdown',
                        source: MARKER_HOST_TYPE_OPTIONS,
                        strict: true
                    },
                    {
                        data: 'attachToRow',
                        type: 'dropdown',
                        source: attachSource,
                        strict: false,
                        allowInvalid: true
                    },
                    {
                        data: 'side',
                        type: 'dropdown',
                        source: getEnumOptions('markerSide'),
                        strict: true,
                        renderer: buildEnumRenderer('markerSide')
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
                    { data: 'show', type: 'checkbox', className: 'htCenter' }
                ];
            },
            requiredFields: ['top', 'bottom', 'type', 'attachToHostType', 'attachToRow'],
            numericFields: MARKER_NUMERIC_FIELDS,
            sampleKeyFields: ['label'],
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            buildDefaultRow: () => {
                const defaultAttachTo = domainState.casingData.length > 0
                    ? buildPipeReferenceOptions(domainState.casingData, PIPE_HOST_TYPE_CASING)[0]
                    : null;
                return {
                    top: 9000,
                    bottom: 9500,
                    type: translateEnum('markerType', 'Perforation'),
                    attachToHostType: PIPE_HOST_TYPE_CASING,
                    attachToRow: defaultAttachTo,
                    side: translateEnum('markerSide', 'Both sides'),
                    color: 'black',
                    scale: 1.0,
                    label: t('defaults.new_marker'),
                    show: true
                };
            }
        };
    }

    if (type === 'topologySource') {
        return {
            getData: () => domainState.topologySources,
            prepareData: (rows) => rows.map((row) => ({
                ...row,
                show: row?.show !== false
            })),
            colHeaders: () => [
                tf('table.topology_sources.top', 'Top'),
                tf('table.topology_sources.bottom', 'Bottom'),
                tf('table.topology_sources.source_type', 'Source type'),
                tf('table.topology_sources.volume_key', 'Volume'),
                tf('table.topology_sources.from_volume_key', 'From volume'),
                tf('table.topology_sources.to_volume_key', 'To volume'),
                tf('table.topology_sources.label', 'Label'),
                tf('table.topology_sources.show', 'Show')
            ],
            columns: () => [
                { data: 'top', type: 'numeric' },
                { data: 'bottom', type: 'numeric' },
                {
                    data: 'sourceType',
                    type: 'dropdown',
                    source: TOPOLOGY_SOURCE_TYPE_OPTIONS,
                    strict: false,
                    allowInvalid: true
                },
                {
                    data: 'volumeKey',
                    type: 'dropdown',
                    source: TOPOLOGY_SOURCE_VOLUME_OPTIONS,
                    strict: false,
                    allowInvalid: true
                },
                {
                    data: 'fromVolumeKey',
                    type: 'dropdown',
                    source: TOPOLOGY_SOURCE_VOLUME_OPTIONS,
                    strict: false,
                    allowInvalid: true
                },
                {
                    data: 'toVolumeKey',
                    type: 'dropdown',
                    source: TOPOLOGY_SOURCE_VOLUME_OPTIONS,
                    strict: false,
                    allowInvalid: true
                },
                { data: 'label', type: 'text' },
                { data: 'show', type: 'checkbox', className: 'htCenter' }
            ],
            requiredFields: ['top', 'bottom', 'sourceType'],
            numericFields: TOPOLOGY_SOURCE_NUMERIC_FIELDS,
            sampleKeyFields: ['label'],
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            triggersSchematicRender: false,
            enableRowSelection: false,
            buildDefaultRow: () => ({
                top: 9000,
                bottom: 9000,
                sourceType: 'formation_inflow',
                volumeKey: TOPOLOGY_SOURCE_VOLUME_OPTIONS[0] ?? 'TUBING_INNER',
                fromVolumeKey: null,
                toVolumeKey: null,
                label: t('defaults.new_topology_source'),
                show: true
            })
        };
    }

    if (type === 'topologyBreakout') {
        return {
            getData: () => filterScenarioBreakoutRows(domainState.topologySources),
            prepareData: (rows) => rows.map((row) => ({
                ...row,
                show: row?.show !== false
            })),
            colHeaders: () => [
                tf('table.topology_sources.top', 'Top'),
                tf('table.topology_sources.bottom', 'Bottom'),
                tf('table.topology_sources.from_volume_key', 'From volume'),
                tf('table.topology_sources.to_volume_key', 'To volume'),
                tf('table.topology_sources.label', 'Label'),
                tf('table.topology_sources.show', 'Show')
            ],
            columns: () => [
                { data: 'top', type: 'numeric' },
                { data: 'bottom', type: 'numeric' },
                {
                    data: 'fromVolumeKey',
                    type: 'dropdown',
                    source: TOPOLOGY_SOURCE_VOLUME_OPTIONS,
                    strict: false,
                    allowInvalid: true
                },
                {
                    data: 'toVolumeKey',
                    type: 'dropdown',
                    source: TOPOLOGY_SOURCE_VOLUME_OPTIONS,
                    strict: false,
                    allowInvalid: true
                },
                { data: 'label', type: 'text' },
                { data: 'show', type: 'checkbox', className: 'htCenter' }
            ],
            requiredFields: ['top', 'bottom', 'fromVolumeKey', 'toVolumeKey'],
            numericFields: TOPOLOGY_SOURCE_NUMERIC_FIELDS,
            sampleKeyFields: ['label'],
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            triggersSchematicRender: false,
            enableRowSelection: false,
            mapRowsForStore: (rows) => mergeScenarioBreakoutRows(domainState.topologySources, rows),
            buildDefaultRow: () => ({
                top: 9000,
                bottom: 9000,
                sourceType: SOURCE_KIND_SCENARIO,
                volumeKey: null,
                fromVolumeKey: 'ANNULUS_A',
                toVolumeKey: 'ANNULUS_B',
                label: t('defaults.new_topology_breakout'),
                show: true
            })
        };
    }

    if (type === 'box') {
        return {
            getData: () => domainState.annotationBoxes,
            prepareData: (rows) => rows.map((row) => ({ ...row })),
            colHeaders: () => [
                t('table.boxes.top'),
                t('table.boxes.bottom'),
                t('table.boxes.label'),
                t('table.boxes.detail'),
                t('table.boxes.fill_color'),
                t('table.boxes.font_color'),
                t('table.boxes.font_size'),
                t('table.boxes.label_x'),
                t('table.boxes.band_width'),
                t('table.boxes.opacity'),
                t('table.boxes.show_details'),
                t('table.boxes.show')
            ],
            columns: () => [
                { data: 'topDepth', type: 'numeric' },
                { data: 'bottomDepth', type: 'numeric' },
                { data: 'label', type: 'text' },
                {
                    data: 'detail',
                    type: 'text',
                    editor: Handsontable.editors.TextAreaEditor,
                    className: 'htLeft htWrap'
                },
                {
                    data: 'color',
                    type: 'dropdown',
                    source: NAMED_COLORS,
                    strict: false,
                    allowInvalid: true,
                    renderer: colorRenderer
                },
                {
                    data: 'fontColor',
                    type: 'dropdown',
                    source: NAMED_COLORS,
                    strict: false,
                    allowInvalid: true,
                    renderer: colorRenderer
                },
                { data: 'fontSize', type: 'numeric' },
                { data: 'labelXPos', type: 'numeric' },
                { data: 'bandWidth', type: 'numeric' },
                { data: 'opacity', type: 'numeric' },
                { data: 'showDetails', type: 'checkbox', className: 'htCenter' },
                { data: 'show', type: 'checkbox', className: 'htCenter' }
            ],
            requiredFields: ['topDepth', 'bottomDepth', 'label', 'detail'],
            numericFields: BOX_NUMERIC_FIELDS,
            sampleKeyFields: ['label', 'detail'],
            afterChangeIgnoreSources: ['loadData', 'normalize', 'colorSync'],
            afterChangeExtra: (instance, changes) => syncBoxFontColor(instance, changes),
            buildDefaultRow: () => ({
                topDepth: 1000,
                bottomDepth: 2000,
                label: t('defaults.new_box'),
                color: DEFAULT_BOX_COLOR,
                fontColor: DEFAULT_BOX_FONT_COLOR,
                fontSize: 12,
                labelXPos: null,
                bandWidth: 1.0,
                opacity: 0.35,
                detail: '',
                showDetails: false,
                show: true
            })
        };
    }

    if (type === 'trajectory') {
        return {
            getData: () => domainState.trajectory,
            prepareData: (rows) => buildTrajectoryRowsWithComputed(rows, domainState.config),
            colHeaders: () => [
                tf('table.trajectory.md', 'MD (Depth)'),
                tf('table.trajectory.inc', 'Inc (Dev)'),
                tf('table.trajectory.azi', 'Azi (Dir)'),
                tf('table.trajectory.comment', 'Comments'),
                tf('table.trajectory.tvd', 'TVD'),
                tf('table.trajectory.northing', 'Northing'),
                tf('table.trajectory.easting', 'Easting'),
                tf('table.trajectory.vs', 'Vertical Section'),
                tf('table.trajectory.dls', 'DLS')
            ],
            columns: () => [
                {
                    data: 'md',
                    type: 'numeric',
                    numericFormat: { pattern: '0.00' }
                },
                {
                    data: 'inc',
                    type: 'numeric',
                    numericFormat: { pattern: '0.00' }
                },
                {
                    data: 'azi',
                    type: 'numeric',
                    numericFormat: { pattern: '0.00' }
                },
                { data: 'comment', type: 'text' },
                {
                    data: 'calcTvd',
                    type: 'numeric',
                    numericFormat: { pattern: '0.00' },
                    className: 'trajectory-computed-cell',
                    readOnly: true
                },
                {
                    data: 'calcNorth',
                    type: 'numeric',
                    numericFormat: { pattern: '0.00' },
                    className: 'trajectory-computed-cell',
                    readOnly: true
                },
                {
                    data: 'calcEast',
                    type: 'numeric',
                    numericFormat: { pattern: '0.00' },
                    className: 'trajectory-computed-cell',
                    readOnly: true
                },
                {
                    data: 'calcVs',
                    type: 'numeric',
                    numericFormat: { pattern: '0.00' },
                    className: 'trajectory-computed-cell',
                    readOnly: true
                },
                {
                    data: 'calcDls',
                    type: 'numeric',
                    numericFormat: { pattern: '0.00' },
                    className: 'trajectory-computed-cell',
                    readOnly: true
                }
            ],
            requiredFields: ['md', 'inc', 'azi'],
            numericFields: TRAJECTORY_NUMERIC_FIELDS,
            afterChangeIgnoreSources: ['loadData', 'normalize'],
            enableRowSelection: false,
            afterChangeExtra: () => {
                if (domainState.config.viewMode === 'directional') {
                    requestSchematicRender();
                }
            },
            buildDefaultRow: () => ({
                md: null,
                inc: null,
                azi: null,
                comment: ''
            })
        };
    }

    return null;
}

export function useTableController(tableType, tabKey = tableType) {
    ensureHandsontableModulesRegistered();

    const projectDataStore = useProjectDataStore();
    const viewConfigStore = useViewConfigStore();
    const interactionStore = useInteractionStore();
    const domainState = {
        get casingData() {
            return projectDataStore.casingData;
        },
        get tubingData() {
            return projectDataStore.tubingData;
        },
        get drillStringData() {
            return projectDataStore.drillStringData;
        },
        get equipmentData() {
            return projectDataStore.equipmentData;
        },
        get horizontalLines() {
            return projectDataStore.horizontalLines;
        },
        get annotationBoxes() {
            return projectDataStore.annotationBoxes;
        },
        get cementPlugs() {
            return projectDataStore.cementPlugs;
        },
        get annulusFluids() {
            return projectDataStore.annulusFluids;
        },
        get markers() {
            return projectDataStore.markers;
        },
        get topologySources() {
            return projectDataStore.topologySources;
        },
        get trajectory() {
            return projectDataStore.trajectory;
        },
        get config() {
            return viewConfigStore.config;
        },
        get interaction() {
            return interactionStore.interaction;
        }
    };
    const hotRef = ref(null);
    const languageToken = ref(getLanguage());
    let isInternalStoreSync = false;
    let stopLanguageChange = null;

    const schema = computed(() => {
        languageToken.value;
        return buildTableSchema(tableType, domainState);
    });

    const tableData = computed(() => {
        const currentSchema = schema.value;
        if (!currentSchema) return [];
        const sourceRows = getRows(currentSchema);
        const preparedRows = currentSchema.prepareData
            ? currentSchema.prepareData(sourceRows)
            : sourceRows;
        return cloneRows(preparedRows);
    });

    function getHotInstance() {
        return hotRef.value?.hotInstance ?? getHotTableInstance(tableType);
    }

    function getAddRowSource() {
        return `table:${tableType}:add`;
    }

    function isAddRowSource(source) {
        return source === getAddRowSource();
    }

    function buildRowPropChanges(targetRow, rowData) {
        return Object.entries(rowData).map(([field, value]) => [targetRow, field, value]);
    }

    function buildRowsForStore(currentSchema, rows) {
        const rawRows = tableType === 'trajectory'
            ? stripTrajectoryComputedFields(rows)
            : rows;
        if (typeof currentSchema?.mapRowsForStore !== 'function') return rawRows;
        return currentSchema.mapRowsForStore(rawRows);
    }

    function commitRowsToStore(currentSchema, key, rows, options = {}) {
        const shouldSuppressHotReload = options.suppressHotReload !== false;
        const rowsForStore = buildRowsForStore(currentSchema, rows);
        if (!shouldSuppressHotReload) {
            isInternalStoreSync = false;
            projectDataStore.setProjectData(key, rowsForStore);
            return;
        }

        isInternalStoreSync = true;
        projectDataStore.setProjectData(key, rowsForStore);
        nextTick(() => {
            isInternalStoreSync = false;
        });
    }

    function commitTableData() {
        const key = TABLE_STATE_KEY_MAP[tableType];
        const instance = getHotInstance();
        if (!key || !instance) return;
        const currentSchema = schema.value;
        const source = cloneRows(instance.getSourceData?.() ?? []);
        commitRowsToStore(currentSchema, key, source);
    }

    function handleAfterChange(changes, source) {
        if (!Array.isArray(changes) || changes.length === 0) return;
        if (source === 'loadData') return;
        if (isAddRowSource(source)) return;

        const currentSchema = schema.value;
        if (!currentSchema) return;

        const shouldProcess = !currentSchema.afterChangeIgnoreSources?.includes(source);
        if (shouldProcess) {
            const instance = getHotInstance();
            if (instance) {
                const liveRows = instance.getSourceData?.() ?? [];
                applySampleKeyChanges(liveRows, changes, currentSchema.sampleKeyFields);
                normalizeHotChanges(instance, changes, currentSchema.numericFields);
                currentSchema.afterChangeExtra?.(instance, changes, source);
            }
        }

        commitTableData();
        if (currentSchema.triggersSchematicRender !== false) {
            requestSchematicRender();
        }
    }

    function handleAfterCreateRow(index, amount, source) {
        if (source === 'loadData') return;
        if (isAddRowSource(source)) return;
        const currentSchema = schema.value;
        syncSelectionIndicators();
        commitTableData();
        if (currentSchema?.triggersSchematicRender !== false) {
            requestSchematicRender();
        }
    }

    function handleAfterRemoveRow(index, amount, source) {
        if (source === 'loadData') return;
        const currentSchema = schema.value;
        syncSelectionIndicators();
        commitTableData();
        if (currentSchema?.triggersSchematicRender !== false) {
            requestSchematicRender();
        }
    }

    function handleAfterOnCellMouseDown(event, coords) {
        const currentSchema = schema.value;
        if (!currentSchema || currentSchema.enableRowSelection === false) return;
        if (coords?.row < 0 || coords?.col !== -1) return;
        const instance = getHotInstance();
        if (!instance) return;
        handleTableClick(tableType, coords.row, event, instance);
    }

    function refreshIfVisible() {
        if (activeTableTabKey.value !== tabKey) return;
        if (!isTablesAccordionOpen.value) return;
        refreshHotLayout(tableType);
    }

    function focusHotRow(rowIndex) {
        const instance = getHotInstance();
        return focusHandsontableRow(instance, rowIndex);
    }

    function consumePendingRowFocus() {
        const request = pendingTableRowFocus.value;
        if (!request || request.tableType !== tableType) return;
        if (activeTableTabKey.value !== tabKey || !isTablesAccordionOpen.value) return;

        nextTick(() => {
            const latest = pendingTableRowFocus.value;
            if (!latest || latest.requestId !== request.requestId) return;

            const didFocus = focusHotRow(latest.rowIndex);
            if (didFocus) {
                clearPendingTableRowFocus(latest.requestId);
                return;
            }

            const instance = getHotInstance();
            const totalRows = Number(instance?.countRows?.() ?? 0);
            if (Number.isInteger(totalRows) && latest.rowIndex >= totalRows) {
                clearPendingTableRowFocus(latest.requestId);
            }
        });
    }

    watch(tableData, (rows) => {
        if (isInternalStoreSync) return;
        const instance = getHotInstance();
        if (!instance) return;
        instance.loadData(cloneRows(rows));
        consumePendingRowFocus();
    });

    watch(
        () => hotRef.value?.hotInstance ?? null,
        (instance) => {
            setHotTableInstance(tableType, instance);
            if (instance) {
                refreshIfVisible();
                consumePendingRowFocus();
            }
        },
        { immediate: true }
    );

    watch(
        activeTableTabKey,
        (currentTabKey) => {
            if (currentTabKey === tabKey) {
                refreshIfVisible();
                consumePendingRowFocus();
            }
        },
        { immediate: true }
    );

    watch(isTablesAccordionOpen, (isOpen) => {
        if (isOpen) {
            refreshIfVisible();
            consumePendingRowFocus();
        }
    });

    watch(pendingTableRowFocus, () => {
        consumePendingRowFocus();
    });

    onMounted(() => {
        stopLanguageChange = onLanguageChange((lang) => {
            if (languageToken.value !== lang) {
                languageToken.value = lang;
            }
        });
    });

    onBeforeUnmount(() => {
        stopLanguageChange?.();
        stopLanguageChange = null;
        setHotTableInstance(tableType, null);
    });

    const hotSettings = computed(() => {
        const currentSchema = schema.value;
        const sourceRows = getRows(currentSchema);
        const rowCount = Array.isArray(sourceRows) ? sourceRows.length : 0;
        if (!currentSchema) {
            return buildBaseHotSettings(rowCount);
        }

        const rawColumns = currentSchema.columns();
        const normalizedColumns = Array.isArray(rawColumns)
            ? rawColumns.map((column) => {
                if (!column || typeof column !== 'object') return column;
                if (column.type !== 'dropdown') return column;
                return {
                    ...DROPDOWN_EDITOR_DEFAULTS,
                    ...column
                };
            })
            : rawColumns;

        return {
            ...buildBaseHotSettings(rowCount),
            colHeaders: currentSchema.colHeaders(),
            columns: normalizedColumns,
            cells: buildRequiredCells(currentSchema.requiredFields ?? [], currentSchema.cellsExtra),
            afterGetRowHeader: (row, TH) => applyRowHeaderHighlight(tableType, row, TH),
            afterChange: handleAfterChange,
            afterCreateRow: handleAfterCreateRow,
            afterRemoveRow: handleAfterRemoveRow,
            afterOnCellMouseDown: handleAfterOnCellMouseDown
        };
    });

    function addRow() {
        const currentSchema = schema.value;
        const key = TABLE_STATE_KEY_MAP[tableType];
        if (!currentSchema?.buildDefaultRow || !key) return;
        const nextRows = [...getRows(currentSchema), currentSchema.buildDefaultRow()];
        commitRowsToStore(currentSchema, key, nextRows, { suppressHotReload: false });
        syncSelectionIndicators();
        if (currentSchema.triggersSchematicRender !== false) {
            requestSchematicRender({ immediate: true });
        }
    }

    function deleteRow(index) {
        if (!Number.isInteger(index) || index < 0) return;
        const currentSchema = schema.value;
        const key = TABLE_STATE_KEY_MAP[tableType];
        if (!currentSchema || !key) return;
        const rows = getRows(currentSchema);
        if (index >= rows.length) return;
        const nextRows = rows.slice();
        nextRows.splice(index, 1);
        commitRowsToStore(currentSchema, key, nextRows, { suppressHotReload: false });
        syncSelectionIndicators();
        if (currentSchema.triggersSchematicRender !== false) {
            requestSchematicRender({ immediate: true });
        }
    }

    function deleteSelectedRow() {
        let index = getSelectedIndex(tableType, interactionStore.interaction);
        if (index === null || index === undefined) {
            const instance = getHotInstance();
            const selection = instance?.getSelectedLast?.();
            if (Array.isArray(selection) && selection.length >= 1) {
                const startRow = Number(selection[0]);
                const endRow = Number(selection[2] ?? selection[0]);
                if (Number.isInteger(startRow) && Number.isInteger(endRow)) {
                    index = Math.max(0, Math.min(startRow, endRow));
                }
            }
        }
        if (index === null || index === undefined) return;
        deleteRow(index);
        CLEAR_SELECTION_HANDLERS[tableType]?.();
    }

    function deleteSelectedTrajectoryRow() {
        const instance = getHotInstance();
        if (!instance) return;

        const selection = instance.getSelectedLast?.();
        if (!Array.isArray(selection) || selection.length < 1) return;

        const startRow = Number(selection[0]);
        const endRow = Number(selection[2] ?? selection[0]);
        if (!Number.isInteger(startRow) || !Number.isInteger(endRow)) return;

        const top = Math.max(0, Math.min(startRow, endRow));
        const bottom = Math.min(Math.max(startRow, endRow), instance.countRows() - 1);
        const removeAmount = bottom - top + 1;
        if (removeAmount <= 0) return;

        instance.alter('remove_row', top, removeAmount, 'table:trajectory:deleteSelected');
        commitTableData();
        syncSelectionIndicators();
        requestSchematicRender();
    }

    return {
        hotRef,
        hotSettings,
        tableData,
        addRow,
        deleteRow,
        deleteSelectedRow,
        deleteSelectedTrajectoryRow
    };
}
