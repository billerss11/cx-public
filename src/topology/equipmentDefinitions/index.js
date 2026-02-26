import {
    NODE_KIND_LEGACY_BORE,
    NODE_KIND_TUBING_INNER,
    TOPOLOGY_VOLUME_KINDS
} from '@/topology/topologyTypes.js';
import packerDefinition from './packer.definition.js';
import safetyValveDefinition from './safetyValve.definition.js';
import { normalizeToken } from './utils.js';

const EQUIPMENT_DEFINITIONS = Object.freeze([
    packerDefinition,
    safetyValveDefinition
]);

const EQUIPMENT_DEFINITION_BY_KEY = Object.freeze(
    EQUIPMENT_DEFINITIONS.reduce((accumulator, definition) => {
        const key = String(definition?.schema?.key ?? '').trim();
        if (key) accumulator[key] = definition;
        return accumulator;
    }, {})
);

export const EQUIPMENT_TYPE_OPTIONS = Object.freeze(
    EQUIPMENT_DEFINITIONS
        .map((definition) => String(definition?.schema?.label ?? '').trim())
        .filter((label) => label.length > 0)
);

export function listEquipmentDefinitions() {
    return EQUIPMENT_DEFINITIONS;
}

export function normalizeEquipmentTypeKey(value) {
    const token = normalizeToken(value);
    if (!token) return null;

    for (const definition of EQUIPMENT_DEFINITIONS) {
        const matchTokens = Array.isArray(definition?.schema?.matchTokens)
            ? definition.schema.matchTokens
            : [];
        if (matchTokens.some((matchToken) => token.includes(matchToken))) {
            return String(definition?.schema?.key ?? '').trim() || null;
        }
    }
    return token;
}

export function resolveEquipmentDefinitionByKey(typeKey) {
    const normalizedTypeKey = String(typeKey ?? '').trim();
    if (!normalizedTypeKey) return null;
    return EQUIPMENT_DEFINITION_BY_KEY[normalizedTypeKey] ?? null;
}

export function resolveEquipmentDefinition(typeValue) {
    const normalizedType = normalizeEquipmentTypeKey(typeValue);
    return resolveEquipmentDefinitionByKey(normalizedType);
}

export function resolveEquipmentTypeDefaults(typeValue) {
    const definition = resolveEquipmentDefinition(typeValue);
    return definition?.schema?.defaults ?? null;
}

export function resolveEquipmentTypeSealByVolume(typeValue) {
    const defaults = resolveEquipmentTypeDefaults(typeValue);
    const resolvedSealByVolume = defaults?.sealByVolume;
    if (!resolvedSealByVolume || typeof resolvedSealByVolume !== 'object') return null;

    const normalized = {};
    TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
        normalized[volumeKey] = Boolean(resolvedSealByVolume[volumeKey]);
    });
    normalized[NODE_KIND_LEGACY_BORE] = Boolean(normalized[NODE_KIND_TUBING_INNER]);
    return normalized;
}

export function resolveEquipmentInspectorFields(typeValue, context = null) {
    const definition = resolveEquipmentDefinition(typeValue);
    const uiConfig = definition?.ui;
    if (!uiConfig || typeof uiConfig !== 'object') return [];

    if (typeof uiConfig.resolveInspectorFields === 'function') {
        const resolvedFields = uiConfig.resolveInspectorFields(context);
        return Array.isArray(resolvedFields) ? resolvedFields.filter(Boolean) : [];
    }

    if (Array.isArray(uiConfig.inspectorFields)) {
        return uiConfig.inspectorFields.filter(Boolean);
    }

    return [];
}
