import {
    EQUIPMENT_ACTUATION_STATE_OPTIONS,
    EQUIPMENT_INTEGRITY_STATUS_OPTIONS,
    EQUIPMENT_SEAL_OVERRIDE_OPTIONS
} from '@/equipment/definitions/constants.js';

export const EQUIPMENT_EDITOR_CONTROL_TYPES = Object.freeze({
    text: 'text',
    number: 'number',
    toggle: 'toggle',
    select: 'select',
    json: 'json'
});

export const EQUIPMENT_EDITOR_FIELD_ACCESS = Object.freeze({
    editable: 'editable',
    readOnly: 'readOnly',
    hidden: 'hidden'
});

function toTitleCaseLabel(value) {
    return String(value ?? '')
        .trim()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildEquipmentRuleOptions(sourceOptions, defaultLabel) {
    const options = Array.isArray(sourceOptions) ? sourceOptions : [];
    const uniqueValues = [...new Set(options.map((option) => String(option ?? '').trim()))];
    const values = uniqueValues.filter((value) => value.length > 0);
    return [
        { label: defaultLabel, value: '' },
        ...values.map((value) => ({
            label: toTitleCaseLabel(value),
            value
        }))
    ];
}

function createFieldContract(field, controlType, options = {}) {
    return Object.freeze({
        field,
        controlType,
        label: options.label ?? null,
        options: options.options ?? null,
        dataTabAccess: options.dataTabAccess ?? EQUIPMENT_EDITOR_FIELD_ACCESS.editable,
        tableAccess: options.tableAccess ?? EQUIPMENT_EDITOR_FIELD_ACCESS.editable,
        showWhen: options.showWhen ?? null
    });
}

export function buildDefaultEquipmentEditorFields() {
    return Object.freeze([
        createFieldContract('state.actuationState', EQUIPMENT_EDITOR_CONTROL_TYPES.select, {
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            options: () => buildEquipmentRuleOptions(
                EQUIPMENT_ACTUATION_STATE_OPTIONS,
                'Use equipment default'
            )
        }),
        createFieldContract('state.integrityStatus', EQUIPMENT_EDITOR_CONTROL_TYPES.select, {
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            options: () => buildEquipmentRuleOptions(
                EQUIPMENT_INTEGRITY_STATUS_OPTIONS,
                'Use equipment default'
            )
        }),
        createFieldContract('properties.boreSeal', EQUIPMENT_EDITOR_CONTROL_TYPES.select, {
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            options: () => buildEquipmentRuleOptions(
                EQUIPMENT_SEAL_OVERRIDE_OPTIONS,
                'Use equipment default'
            )
        }),
        createFieldContract('properties.annularSeal', EQUIPMENT_EDITOR_CONTROL_TYPES.select, {
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            options: () => buildEquipmentRuleOptions(
                EQUIPMENT_SEAL_OVERRIDE_OPTIONS,
                'Use equipment default'
            )
        }),
        createFieldContract('properties.sealByVolume', EQUIPMENT_EDITOR_CONTROL_TYPES.json, {
            dataTabAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.readOnly,
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            showWhen: ({ rowData }) => rowData?.properties?.sealByVolume && typeof rowData.properties.sealByVolume === 'object'
        })
    ]);
}
