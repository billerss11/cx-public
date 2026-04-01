import { getEnumOptions } from '@/app/i18n.js';
import { isOpenHoleRow } from '@/app/domain.js';
import { NAMED_COLORS } from '@/constants/index.js';
import { OPEN_HOLE_WAVE_DEFAULTS, OPEN_HOLE_WAVE_LIMITS } from '@/utils/openHoleWave.js';
import { resolveEquipmentInspectorFields } from '@/topology/equipmentDefinitions/index.js';
import {
    resolveGlobalDepthSliderRange,
    resolveRowDepthSliderRange
} from '@/utils/depthControlRanges.js';

export const VISUAL_INSPECTOR_CONTROL_TYPES = Object.freeze({
    toggle: 'toggle',
    number: 'number',
    color: 'color',
    select: 'select'
});
export const VISUAL_INSPECTOR_FIELD_GROUP_KEYS = Object.freeze({
    VISUAL: 'visual'
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

function createLabelXField(field, labelKey = 'table.casing.label_x') {
  return createField(field, VISUAL_INSPECTOR_CONTROL_TYPES.number, labelKey, {
    step: 0.1,
    slider: { min: -1, max: 1, step: 0.01 }
  });
}

function createCenterlineOffsetField(field, labelKey = 'table.directional.centerline_offset') {
  return createField(field, VISUAL_INSPECTOR_CONTROL_TYPES.number, labelKey, {
    step: 1
  });
}

function createDepthPositionField(field, labelKey, slider) {
  return createField(field, VISUAL_INSPECTOR_CONTROL_TYPES.number, labelKey, {
    step: 0.1,
    slider
  });
}

const CASING_BASE_FIELDS = Object.freeze([
  createField('showTop', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.casing.show_top', { defaultValue: true }),
  createField('showBottom', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.casing.show_bottom', { defaultValue: true }),
  createLabelXField('labelXPos'),
  createDepthPositionField('manualLabelDepth', 'table.casing.label_depth', ({ rowData }) => (
    resolveRowDepthSliderRange(rowData, { step: 0.1 })
  )),
  createLabelXField('directionalLabelXPos', 'table.directional.label_x'),
  createDepthPositionField('directionalManualLabelDepth', 'table.directional.label_depth', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  )),
  createDepthPositionField('directionalManualLabelTvd', 'table.directional.label_tvd', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  )),
  createLabelXField('topLabelXPos', 'table.casing.top_label_x'),
  createDepthPositionField('topManualLabelDepth', 'table.casing.top_label_depth', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  )),
  createLabelXField('bottomLabelXPos', 'table.casing.bottom_label_x'),
  createDepthPositionField('bottomManualLabelDepth', 'table.casing.bottom_label_depth', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  )),
  createLabelXField('directionalTopLabelXPos', 'table.directional.top_label_x'),
  createDepthPositionField('directionalTopManualLabelDepth', 'table.directional.top_label_depth', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  )),
  createLabelXField('directionalBottomLabelXPos', 'table.directional.bottom_label_x'),
  createDepthPositionField('directionalBottomManualLabelDepth', 'table.directional.bottom_label_depth', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  ))
]);

const CASING_FIELDS = Object.freeze([
    ...CASING_BASE_FIELDS,
    createField('casingLabelFontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'ui.casing_label_font_size', {
        defaultValue: 11,
        min: 8,
        max: 20,
        step: 1
    }),
    createField('depthLabelFontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'ui.depth_label_font_size', {
        defaultValue: 9,
        min: 8,
        max: 20,
        step: 1
    }),
    createField('depthLabelOffset', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'ui.depth_label_offset', {
        defaultValue: 35,
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
  createLabelXField('labelXPos'),
  createDepthPositionField('manualLabelDepth', 'table.casing.label_depth', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  )),
  createLabelXField('directionalLabelXPos', 'table.directional.label_x'),
  createDepthPositionField('directionalManualLabelDepth', 'table.directional.label_depth', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  )),
  createDepthPositionField('directionalManualLabelTvd', 'table.directional.label_tvd', ({ context }) => (
    resolveGlobalDepthSliderRange(context, 0.1)
  )),
  createField('labelFontSize', VISUAL_INSPECTOR_CONTROL_TYPES.number, 'table.boxes.font_size', {
    defaultValue: 11,
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
            defaultValue: 11,
            min: 6,
            max: 72,
            step: 1
        }),
        createField('lineStyle', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.lines.line_style', {
            options: () => buildEnumOptions('lineStyle')
        }),
        createLabelXField('labelXPos', 'table.lines.label_x'),
        createDepthPositionField('manualLabelDepth', 'table.lines.label_depth', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
        createCenterlineOffsetField('directionalCenterlineOffsetPx'),
        createDepthPositionField('directionalManualLabelDepth', 'table.directional.label_depth', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
        createField('show', VISUAL_INSPECTOR_CONTROL_TYPES.toggle, 'table.lines.show', { defaultValue: true })
    ]),
    plug: Object.freeze([
        createField('color', VISUAL_INSPECTOR_CONTROL_TYPES.color, 'table.plugs.color', {
            options: ({ currentValue }) => buildColorOptions(currentValue)
        }),
        createField('hatchStyle', VISUAL_INSPECTOR_CONTROL_TYPES.select, 'table.plugs.hatch', {
            options: () => buildEnumOptions('hatchStyle')
        }),
        createLabelXField('labelXPos', 'table.plugs.label_x'),
        createDepthPositionField('manualLabelDepth', 'table.plugs.label_depth', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
        createLabelXField('directionalLabelXPos', 'table.directional.label_x'),
        createDepthPositionField('directionalManualLabelDepth', 'table.directional.label_depth', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
        createDepthPositionField('directionalManualLabelTvd', 'table.directional.label_tvd', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
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
            defaultValue: 11,
            min: 6,
            max: 72,
            step: 1
        }),
        createLabelXField('labelXPos', 'table.fluids.label_x'),
        createDepthPositionField('manualDepth', 'table.fluids.label_depth', ({ rowData }) => resolveRowDepthSliderRange(rowData, { step: 0.1 })),
        createLabelXField('directionalLabelXPos', 'table.directional.label_x'),
        createDepthPositionField('directionalManualLabelDepth', 'table.directional.label_depth', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
        createDepthPositionField('directionalManualLabelTvd', 'table.directional.label_tvd', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
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
            defaultValue: 12,
            min: 6,
            max: 72,
            step: 1
        }),
        createLabelXField('labelXPos', 'table.boxes.label_x'),
        createDepthPositionField('manualLabelDepth', 'table.boxes.label_depth', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
        createCenterlineOffsetField('directionalCenterlineOffsetPx'),
        createDepthPositionField('directionalManualLabelDepth', 'table.directional.label_depth', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
        createDepthPositionField('directionalManualLabelTvd', 'table.directional.label_tvd', ({ context }) => resolveGlobalDepthSliderRange(context, 0.1)),
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

function normalizeFieldToken(value) {
    return String(value ?? '').trim();
}

function mergeInspectorFields(baseFields = [], extensionFields = []) {
    const merged = [];
    const fieldToIndexMap = new Map();
    const candidates = [...baseFields, ...extensionFields];
    candidates.forEach((fieldDefinition) => {
        if (!fieldDefinition || typeof fieldDefinition !== 'object') return;
        const fieldToken = normalizeFieldToken(fieldDefinition.field);
        if (!fieldToken) {
            merged.push(fieldDefinition);
            return;
        }

        const existingIndex = fieldToIndexMap.get(fieldToken);
        if (Number.isInteger(existingIndex)) {
            merged[existingIndex] = fieldDefinition;
            return;
        }

        fieldToIndexMap.set(fieldToken, merged.length);
        merged.push(fieldDefinition);
    });
    return merged;
}

export function getVisualInspectorFields(elementType, context = null) {
    const baseFields = VISUAL_INSPECTOR_SCHEMA[elementType] ?? [];
    if (elementType !== 'equipment') {
        return [...baseFields].filter((fieldDefinition) => shouldShowField(fieldDefinition, context));
    }

    const equipmentType = context?.rowData?.type ?? null;
    const extensionFields = resolveEquipmentInspectorFields(equipmentType, context);
    const mergedFields = mergeInspectorFields(baseFields, extensionFields);
    return mergedFields.filter((fieldDefinition) => shouldShowField(fieldDefinition, context));
}
