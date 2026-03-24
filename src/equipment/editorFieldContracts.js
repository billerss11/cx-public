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

export const EQUIPMENT_EDITOR_FIELD_SECTIONS = Object.freeze({
    core: 'core',
    operating: 'operating',
    seal: 'seal'
});

export const EQUIPMENT_EDITOR_DISCLOSURE_LEVELS = Object.freeze({
    core: 'core',
    advanced: 'advanced'
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
        showWhen: options.showWhen ?? null,
        section: options.section ?? null,
        disclosureLevel: options.disclosureLevel ?? EQUIPMENT_EDITOR_DISCLOSURE_LEVELS.core,
        helperTextKey: options.helperTextKey ?? null
    });
}

function applyFieldOverrides(fieldDefinition, fieldOverrides = {}) {
    const override = fieldOverrides[fieldDefinition.field];
    if (!override || typeof override !== 'object') return fieldDefinition;
    return Object.freeze({
        ...fieldDefinition,
        ...override
    });
}

export function buildDefaultEquipmentEditorFields(options = {}) {
    const fieldOverrides = options?.fieldOverrides && typeof options.fieldOverrides === 'object'
        ? options.fieldOverrides
        : {};
    const omittedFields = new Set(
        (Array.isArray(options?.omitFields) ? options.omitFields : [])
            .map((field) => String(field ?? '').trim())
            .filter((field) => field.length > 0)
    );
    const fields = [
        createFieldContract('state.actuationState', EQUIPMENT_EDITOR_CONTROL_TYPES.select, {
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            section: EQUIPMENT_EDITOR_FIELD_SECTIONS.operating,
            disclosureLevel: EQUIPMENT_EDITOR_DISCLOSURE_LEVELS.core,
            helperTextKey: 'ui.equipment_editor.help.actuation_state',
            options: () => buildEquipmentRuleOptions(
                EQUIPMENT_ACTUATION_STATE_OPTIONS,
                'Use equipment default'
            )
        }),
        createFieldContract('state.integrityStatus', EQUIPMENT_EDITOR_CONTROL_TYPES.select, {
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            section: EQUIPMENT_EDITOR_FIELD_SECTIONS.operating,
            disclosureLevel: EQUIPMENT_EDITOR_DISCLOSURE_LEVELS.core,
            helperTextKey: 'ui.equipment_editor.help.integrity_status',
            options: () => buildEquipmentRuleOptions(
                EQUIPMENT_INTEGRITY_STATUS_OPTIONS,
                'Use equipment default'
            )
        }),
        createFieldContract('properties.boreSeal', EQUIPMENT_EDITOR_CONTROL_TYPES.select, {
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            section: EQUIPMENT_EDITOR_FIELD_SECTIONS.seal,
            disclosureLevel: EQUIPMENT_EDITOR_DISCLOSURE_LEVELS.core,
            helperTextKey: 'ui.equipment_editor.help.bore_seal',
            options: () => buildEquipmentRuleOptions(
                EQUIPMENT_SEAL_OVERRIDE_OPTIONS,
                'Use equipment default'
            )
        }),
        createFieldContract('properties.annularSeal', EQUIPMENT_EDITOR_CONTROL_TYPES.select, {
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            section: EQUIPMENT_EDITOR_FIELD_SECTIONS.seal,
            disclosureLevel: EQUIPMENT_EDITOR_DISCLOSURE_LEVELS.core,
            helperTextKey: 'ui.equipment_editor.help.annular_seal',
            options: () => buildEquipmentRuleOptions(
                EQUIPMENT_SEAL_OVERRIDE_OPTIONS,
                'Use equipment default'
            )
        }),
        createFieldContract('properties.sealByVolume', EQUIPMENT_EDITOR_CONTROL_TYPES.json, {
            dataTabAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.readOnly,
            tableAccess: EQUIPMENT_EDITOR_FIELD_ACCESS.hidden,
            section: EQUIPMENT_EDITOR_FIELD_SECTIONS.seal,
            disclosureLevel: EQUIPMENT_EDITOR_DISCLOSURE_LEVELS.advanced,
            helperTextKey: 'ui.equipment_editor.help.seal_by_volume',
            showWhen: ({ rowData }) => rowData?.properties?.sealByVolume && typeof rowData.properties.sealByVolume === 'object'
        })
    ];

    return Object.freeze(
        fields
            .filter((fieldDefinition) => !omittedFields.has(fieldDefinition.field))
            .map((fieldDefinition) => applyFieldOverrides(fieldDefinition, fieldOverrides))
    );
}
