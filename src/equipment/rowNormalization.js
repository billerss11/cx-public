import {
    resolveEquipmentDefinition,
    normalizeEquipmentTypeKey,
    resolveEquipmentTypeLabel
} from '@/equipment/definitions/index.js';
import { normalizeStringOrNull, toPlainObject } from '@/equipment/definitions/utils.js';

function cloneSealByVolume(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return { ...value };
}

function resolveState(row = {}) {
    const canonical = row?.state && typeof row.state === 'object' && !Array.isArray(row.state)
        ? row.state
        : null;
    return {
        actuationState: canonical?.actuationState ?? row?.actuationState ?? '',
        integrityStatus: canonical?.integrityStatus ?? row?.integrityStatus ?? ''
    };
}

function resolveProperties(row = {}) {
    const canonical = row?.properties && typeof row.properties === 'object' && !Array.isArray(row.properties)
        ? row.properties
        : null;
    return {
        boreSeal: canonical?.boreSeal ?? row?.boreSeal ?? '',
        annularSeal: canonical?.annularSeal ?? row?.annularSeal ?? row?.annulusSeal ?? '',
        sealByVolume: cloneSealByVolume(canonical?.sealByVolume ?? row?.sealByVolume)
    };
}

export function resolveLegacyEquipmentRowFields(row = {}) {
    const state = resolveState(row);
    const properties = resolveProperties(row);
    const typeLabel = resolveEquipmentTypeLabel(
        row?.typeKey ?? row?.type,
        row?.type ?? row?.typeKey ?? ''
    );

    return {
        type: typeLabel,
        actuationState: state.actuationState,
        integrityStatus: state.integrityStatus,
        boreSeal: properties.boreSeal,
        annularSeal: properties.annularSeal,
        sealByVolume: properties.sealByVolume
    };
}

export function synchronizeRecognizedEquipmentTypeFields(row = {}) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

    const rawType = normalizeStringOrNull(row.type);
    if (!rawType) return row;

    const definition = resolveEquipmentDefinition(rawType);
    if (!definition) return row;

    const nextTypeKey = normalizeStringOrNull(definition?.schema?.key) ?? normalizeEquipmentTypeKey(rawType);
    const nextTypeLabel = resolveEquipmentTypeLabel(nextTypeKey, rawType);
    const currentTypeKey = normalizeStringOrNull(row.typeKey);

    if (currentTypeKey === nextTypeKey && row.type === nextTypeLabel) {
        return row;
    }

    return {
        ...row,
        type: nextTypeLabel,
        typeKey: nextTypeKey
    };
}

export function normalizeEquipmentRow(row = {}) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

    const explicitTypeKey = normalizeStringOrNull(row.typeKey);
    const normalizedTypeKey = explicitTypeKey ?? normalizeEquipmentTypeKey(row.type);
    const variantKey = normalizeStringOrNull(row.variantKey);
    const state = resolveState(row);
    const properties = resolveProperties(row);
    const legacyFields = resolveLegacyEquipmentRowFields({
        ...row,
        typeKey: normalizedTypeKey,
        state,
        properties
    });

    return {
        ...row,
        typeKey: normalizedTypeKey,
        variantKey,
        state,
        properties,
        ...legacyFields
    };
}

export function normalizeEquipmentRows(rows = []) {
    return Array.isArray(rows) ? rows.map((row) => normalizeEquipmentRow(row)) : [];
}

export function normalizeEquipmentCompatPayload(row = {}) {
    return {
        ...row,
        ...resolveLegacyEquipmentRowFields(row),
        state: toPlainObject(row?.state),
        properties: {
            boreSeal: row?.properties?.boreSeal ?? '',
            annularSeal: row?.properties?.annularSeal ?? '',
            sealByVolume: cloneSealByVolume(row?.properties?.sealByVolume)
        }
    };
}
