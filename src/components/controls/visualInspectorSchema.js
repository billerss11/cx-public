import { getEnumOptions } from '@/app/i18n.js';
import { isOpenHoleRow } from '@/app/domain.js';
import { NAMED_COLORS } from '@/constants/index.js';
import { OPEN_HOLE_WAVE_DEFAULTS, OPEN_HOLE_WAVE_LIMITS } from '@/utils/openHoleWave.js';
import { parseOptionalNumber } from '@/utils/general.js';
import { buildEquipmentAttachOptions } from '@/utils/equipmentAttachReference.js';
import {
    EQUIPMENT_ACTUATION_STATE_OPTIONS,
    EQUIPMENT_INTEGRITY_STATUS_OPTIONS,
    EQUIPMENT_SEAL_OVERRIDE_OPTIONS
} from '@/topology/equipmentMetadata.js';
import { resolveEquipmentInspectorFields } from '@/topology/equipmentDefinitions/index.js';
import { NODE_KIND_BORE, TOPOLOGY_VOLUME_KINDS } from '@/topology/topologyTypes.js';

export const VISUAL_INSPECTOR_CONTROL_TYPES = Object.freeze({
    toggle: 'toggle',
    number: 'number',
    color: 'color',
    select: 'select'
});
export const VISUAL_INSPECTOR_FIELD_GROUP_KEYS = Object.freeze({
    VISUAL: 'visual',
    ADVANCED_ENGINEERING: 'advanced_engineering'
});

function buildEnumOptions(enumType) {
    return getEnumOptions(enumType).map((value) => ({
        label: value,
        value
    }));
}

function buildColorOptions(currentValue) {
    const normalized = String(currentValue ?? '').trim();
    if (!normalized) {
        return NAMED_COLORS.map((color) => ({ label: color, value: color }));
    }

    const hasCurrent = NAMED_COLORS.some((color) => color.toLowerCase() === normalized.toLowerCase());
    if (hasCurrent) {
        return NAMED_COLORS.map((color) => ({ label: color, value: color }));
    }

    return [
        { label: normalized, value: normalized },
        ...NAMED_COLORS.map((color) => ({ label: color, value: color }))
    ];
}

function createField(field, controlType, labelKey, options = {}) {
    return Object.freeze({
        field,
        controlType,
        labelKey,
        groupKey: options.groupKey ?? null,
        defaultValue: options.defaultValue,
        min: options.min ?? null,
        max: options.max ?? null,
        step: options.step ?? null,
        slider: options.slider ?? null,
        options: options.options ?? null,
        showWhen: options.showWhen ?? null
    });
}

function resolveDepthSliderRange(rowData, fallbackStep = 0.1) {
    const top = parseOptionalNumber(rowData?.top ?? rowData?.md);
    const bottom = parseOptionalNumber(rowData?.bottom ?? rowData?.bottomMd);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
    return {
        min: top,
        max: bottom,
        step: fallbackStep
    };
}

function resolveGlobalDepthSliderRange(context, fallbackStep = 0.1) {
    const min = parseOptionalNumber(context?.depthRange?.min);
    const max = parseOptionalNumber(context?.depthRange?.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    return {
        min,
        max,
        step: fallbackStep
    };
}

function buildEquipmentOverrideOptions(optionValues = [], inheritLabel = 'Inherit') {
    const values = Array.isArray(optionValues) ? optionValues : [];
    return Object.freeze([
        Object.freeze({ label: inheritLabel, value: null }),
        ...values
            .filter((value) => String(value ?? '').trim().length > 0)
            .map((value) => Object.freeze({ label: String(value), value: String(value) }))
    ]);
}

const EQUIPMENT_ACTUATION_OPTIONS = buildEquipmentOverrideOptions(EQUIPMENT_ACTUATION_STATE_OPTIONS);
const EQUIPMENT_INTEGRITY_OPTIONS = buildEquipmentOverrideOptions(EQUIPMENT_INTEGRITY_STATUS_OPTIONS);
const EQUIPMENT_SEAL_OPTIONS = buildEquipmentOverrideOptions(EQUIPMENT_SEAL_OVERRIDE_OPTIONS);
const EQUIPMENT_VOLUME_OVERRIDE_KEYS = Object.freeze(
    TOPOLOGY_VOLUME_KINDS.filter((volumeKey) => volumeKey !== NODE_KIND_BORE)
);
const EQUIPMENT_SEAL_BY_VOLUME_FIELDS = Object.freeze(
    EQUIPMENT_VOLUME_OVERRIDE_KEYS.map((volumeKey) => (
        createField(
            `sealByVolume.${volumeKey}`,
            VISUAL_INSPECTOR_CONTROL_TYPES.select,
            `table.equipment.seal_by_volume_${String(volumeKey).trim().toLowerCase()}`,
            {
                options: () => EQUIPMENT_SEAL_OPTIONS,
                groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.ADVANCED_ENGINEERING
            }
        )
    ))
);

const CASING_BASE_FIELDS = Object.freeze([
    createField('showTop', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.casing.show_top', { defaultValue: true }),
    createField('showBottom', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.casing.show_bottom', { defaultValue: true }),
    createField('labelXPos', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.casing.label_x', {
        step: 0.1,
        slider: { min: -1, max: 1, step: 0.01 }
    }),
    createField('manualLabelDepth', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.casing.label_depth', {
        step: 0.1,
        slider: ({ rowData }) => resolveDepthSliderRange(rowData, 0.1)
    })
]);

const CASING_FIELDS = Object.freeze([
    ...CASING_BASE_FIELDS,
    createField('casingLabelFontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'ui.casing_label_font_size', {
        min: 8,
        max: 20,
        step: 1
    }),
    createField('depthLabelFontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'ui.depth_label_font_size', {
        min: 8,
        max: 20,
        step: 1
    }),
    createField('depthLabelOffset', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'ui.depth_label_offset', {
        min: -60,
        max: 120,
        step: 1
    }),
    createField('openHoleWaveAmplitude', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.casing.open_hole_wave_amplitude', {
        min: OPEN_HOLE_WAVE_LIMITS.minAmplitude,
        max: OPEN_HOLE_WAVE_LIMITS.maxAmplitude,
        step: 0.1,
        defaultValue: OPEN_HOLE_WAVE_DEFAULTS.amplitude,
        showWhen: ({ rowData }) => isOpenHoleRow(rowData)
    }),
    createField('openHoleWaveWavelength', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.casing.open_hole_wave_wavelength', {
        min: OPEN_HOLE_WAVE_LIMITS.minWavelength,
        max: OPEN_HOLE_WAVE_LIMITS.maxWavelength,
        step: 1,
        defaultValue: OPEN_HOLE_WAVE_DEFAULTS.wavelength,
        showWhen: ({ rowData }) => isOpenHoleRow(rowData)
    })
]);

const TRANSIENT_PIPE_FIELDS = Object.freeze([
    createField('showLabel', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.fluids.show', { defaultValue: true }),
    createField('labelXPos', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.casing.label_x', {
        step: 0.1,
        slider: { min: -1, max: 1, step: 0.01 }
    }),
    createField('manualLabelDepth', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.casing.label_depth', {
        step: 0.1,
        slider: ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)
    }),
    createField('labelFontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.boxes.font_size', {
        min: 8,
        max: 20,
        step: 1
    })
]);

const VISUAL_INSPECTOR_SCHEMA = Object.freeze({
    casing: CASING_FIELDS,
    tubing: TRANSIENT_PIPE_FIELDS,
    drillString: TRANSIENT_PIPE_FIELDS,
    equipment: Object.freeze([
        ...TRANSIENT_PIPE_FIELDS.map((fieldDefinition) => (
            Object.freeze({
                ...fieldDefinition,
                groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.VISUAL
            })
        )),
        createField('attachToDisplay', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.equipment.attach_to', {
            options: ({ context }) => buildEquipmentAttachOptions(
                context?.casingRows,
                context?.tubingRows
            ),
            groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.ADVANCED_ENGINEERING
        }),
        createField('actuationState', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.equipment.actuation_state', {
            options: () => EQUIPMENT_ACTUATION_OPTIONS,
            groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.ADVANCED_ENGINEERING
        }),
        createField('integrityStatus', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.equipment.integrity_status', {
            options: () => EQUIPMENT_INTEGRITY_OPTIONS,
            groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.ADVANCED_ENGINEERING
        }),
        createField('boreSeal', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.equipment.bore_seal', {
            options: () => EQUIPMENT_SEAL_OPTIONS,
            groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.ADVANCED_ENGINEERING
        }),
        createField('annularSeal', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.equipment.annular_seal', {
            options: () => EQUIPMENT_SEAL_OPTIONS,
            groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.ADVANCED_ENGINEERING
        }),
        ...EQUIPMENT_SEAL_BY_VOLUME_FIELDS,
        createField('color', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.markers.color', {
            options: ({ currentValue }) => buildColorOptions(currentValue),
            groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.VISUAL
        }),
        createField('scale', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.markers.scale', {
            min: 0.1,
            max: 10,
            step: 0.1,
            groupKey: VISUAL_INSPECTOR_FIELD_GROUP_KEYS.VISUAL
        })
    ]),
    line: Object.freeze([
        createField('color', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.lines.line_color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('fontColor', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.lines.font_color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('fontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.lines.font_size', {
            min: 6,
            max: 72,
            step: 1
        }),
        createField('lineStyle', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.lines.line_style', {
            options: () => buildEnumOptions('lineStyle')
        }),
        createField('labelXPos', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.lines.label_x', {
            step: 0.1,
            slider: { min: -1, max: 1, step: 0.01 }
        }),
        createField('show', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.lines.show', { defaultValue: true })
    ]),
    plug: Object.freeze([
        createField('color', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.plugs.color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('hatchStyle', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.plugs.hatch', {
            options: () => buildEnumOptions('hatchStyle')
        }),
        createField('show', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.plugs.show', { defaultValue: true })
    ]),
    fluid: Object.freeze([
        createField('color', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.fluids.fill_color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('hatchStyle', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.fluids.hatch_style', {
            options: () => buildEnumOptions('hatchStyle')
        }),
        createField('textColor', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.fluids.text_color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('fontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.fluids.font_size', {
            min: 6,
            max: 72,
            step: 1
        }),
        createField('labelXPos', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.fluids.label_x', {
            step: 0.1,
            slider: { min: -1, max: 1, step: 0.01 }
        }),
        createField('manualDepth', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.fluids.label_depth', {
            step: 0.1,
            slider: ({ rowData }) => resolveDepthSliderRange(rowData, 0.1)
        }),
        createField('show', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.fluids.show', { defaultValue: true })
    ]),
    marker: Object.freeze([
        createField('color', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.markers.color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('scale', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.markers.scale', {
            min: 0.1,
            max: 10,
            step: 0.1
        }),
        createField('side', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.markers.side', {
            options: () => buildEnumOptions('markerSide')
        }),
        createField('show', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.markers.show', { defaultValue: true })
    ]),
    box: Object.freeze([
        createField('color', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.boxes.fill_color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('fontColor', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.boxes.font_color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('fontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.boxes.font_size', {
            min: 6,
            max: 72,
            step: 1
        }),
        createField('labelXPos', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.boxes.label_x', {
            step: 0.1,
            slider: { min: -1, max: 1, step: 0.01 }
        }),
        createField('opacity', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.boxes.opacity', {
            min: 0,
            max: 1,
            step: 0.05
        }),
        createField('showDetails', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.boxes.show_details', { defaultValue: false }),
        createField('show', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.boxes.show', { defaultValue: true })
    ])
});

function shouldShowField(fieldDefinition, context) {
    if (typeof fieldDefinition?.showWhen !== 'function') return true;
    return fieldDefinition.showWhen({
        context,
        rowData: context?.rowData ?? null
    }) === true;
}

export function getVisualInspectorFields(elementType, context = null) {
    const baseFields = VISUAL_INSPECTOR_SCHEMA[elementType] ?? [];
    const extensionFields = elementType === 'equipment'
        ? resolveEquipmentInspectorFields(context?.rowData?.type, context)
        : [];

    return [...baseFields, ...extensionFields]
        .filter((fieldDefinition) => shouldShowField(fieldDefinition, context));
}
