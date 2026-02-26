import { parseOptionalNumber } from '@/utils/general.js';
import {
    ACTUATION_CLOSED,
    ACTUATION_OPEN,
    ACTUATION_STATIC,
    INTEGRITY_FAILED_CLOSED,
    INTEGRITY_FAILED_OPEN,
    INTEGRITY_INTACT,
    INTEGRITY_LEAKING
} from '@/topology/equipmentDefinitions/constants.js';
import {
    normalizeEquipmentTypeKey,
    resolveEquipmentDefinitionByKey
} from '@/topology/equipmentDefinitions/index.js';
import {
    NODE_KIND_BORE,
    NODE_KIND_LEGACY_BORE,
    TOPOLOGY_VOLUME_KINDS,
    normalizeSourceVolumeKind
} from '@/topology/topologyTypes.js';
import {
    TOPOLOGY_WARNING_CODES,
    createTopologyValidationWarning
} from '@/topology/warningCatalog.js';

const SEAL_STATE_OPEN = 'open';
const SEAL_STATE_CLOSED_FAILABLE = 'closed_failable';
const EQUIPMENT_WARNING_UNKNOWN_TYPE = TOPOLOGY_WARNING_CODES.UNKNOWN_EQUIPMENT_TYPE;
const EQUIPMENT_WARNING_INVALID_ANNULAR_SEAL_OVERRIDE = TOPOLOGY_WARNING_CODES.INVALID_ANNULAR_SEAL_OVERRIDE;
const EQUIPMENT_WARNING_INVALID_BORE_SEAL_OVERRIDE = TOPOLOGY_WARNING_CODES.INVALID_BORE_SEAL_OVERRIDE;
const EQUIPMENT_WARNING_INVALID_VOLUME_SEAL_OVERRIDE_KEY = TOPOLOGY_WARNING_CODES.INVALID_VOLUME_SEAL_OVERRIDE_KEY;
const EQUIPMENT_WARNING_INVALID_VOLUME_SEAL_OVERRIDE_VALUE = TOPOLOGY_WARNING_CODES.INVALID_VOLUME_SEAL_OVERRIDE_VALUE;
const EQUIPMENT_WARNING_UNKNOWN_ACTUATION_STATE = TOPOLOGY_WARNING_CODES.UNKNOWN_ACTUATION_STATE;
const EQUIPMENT_WARNING_UNKNOWN_INTEGRITY_STATUS = TOPOLOGY_WARNING_CODES.UNKNOWN_INTEGRITY_STATUS;
const EQUIPMENT_WARNING_CONFLICT_CLOSED_WITH_OPEN_INTEGRITY = TOPOLOGY_WARNING_CODES.CONFLICT_CLOSED_WITH_OPEN_INTEGRITY;
const EQUIPMENT_WARNING_CONFLICT_OPEN_WITH_FAILED_CLOSED = TOPOLOGY_WARNING_CODES.CONFLICT_OPEN_WITH_FAILED_CLOSED;
const EQUIPMENT_WARNING_NO_SEAL_BEHAVIOR_AT_BOUNDARY = TOPOLOGY_WARNING_CODES.NO_SEAL_BEHAVIOR_AT_BOUNDARY;

function createDefaultSealByVolumeMap({ bore = false, annulus = false } = {}) {
    const byVolume = {};
    TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
        byVolume[volumeKey] = volumeKey === NODE_KIND_BORE
            ? Boolean(bore)
            : Boolean(annulus);
    });
    return byVolume;
}

const DEFAULT_RULE_FALLBACK = Object.freeze({
    sealByVolume: Object.freeze(createDefaultSealByVolumeMap({
        bore: false,
        annulus: false
    })),
    annularSeal: false,
    boreSeal: false,
    defaultActuationState: ACTUATION_STATIC,
    defaultIntegrityStatus: INTEGRITY_INTACT
});

function createFunctionKeyForVolume(volumeKey) {
    const normalizedVolume = String(volumeKey ?? '')
        .trim()
        .toLowerCase();
    if (!normalizedVolume) return 'boundary_seal';
    if (normalizedVolume === 'bore' || normalizedVolume === 'tubing_inner') return 'bore_seal';
    return `${normalizedVolume}_seal`;
}

function createEffectVolumeSpec(volumeKey) {
    const normalizedVolume = String(volumeKey ?? '').trim();
    return Object.freeze({
        volumeKey: normalizedVolume,
        functionKey: createFunctionKeyForVolume(normalizedVolume)
    });
}

const EFFECT_VOLUME_SPECS = Object.freeze(
    TOPOLOGY_VOLUME_KINDS.map((volumeKey) => createEffectVolumeSpec(volumeKey))
);

function normalizeToken(value) {
    return String(value ?? '').trim().toLowerCase();
}

function normalizeWarningRowId(row = {}) {
    return String(row?.rowId ?? '').trim() || undefined;
}

function createValidationWarning(code, message, row = {}) {
    return createTopologyValidationWarning(code, message, {
        rowId: normalizeWarningRowId(row)
    });
}

function normalizeEquipmentType(value) {
    return normalizeEquipmentTypeKey(value);
}

function parseOptionalBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
        return null;
    }
    const token = normalizeToken(value);
    if (['true', 'yes', 'y', '1'].includes(token)) return true;
    if (['false', 'no', 'n', '0'].includes(token)) return false;
    return null;
}

function normalizeActuationState(value, fallback = ACTUATION_STATIC) {
    const token = normalizeToken(value);
    if (!token) {
        return {
            value: fallback,
            isRecognized: true
        };
    }
    if (token.includes('open')) {
        return {
            value: ACTUATION_OPEN,
            isRecognized: true
        };
    }
    if (token.includes('close')) {
        return {
            value: ACTUATION_CLOSED,
            isRecognized: true
        };
    }
    if (token.includes('static')) {
        return {
            value: ACTUATION_STATIC,
            isRecognized: true
        };
    }
    return {
        value: fallback,
        isRecognized: false
    };
}

function normalizeIntegrityStatus(value, fallback = INTEGRITY_INTACT) {
    const token = normalizeToken(value);
    if (!token) {
        return {
            value: fallback,
            isRecognized: true
        };
    }
    if (token.includes('leak')) {
        return {
            value: INTEGRITY_LEAKING,
            isRecognized: true
        };
    }
    if (token.includes('fail') && token.includes('open')) {
        return {
            value: INTEGRITY_FAILED_OPEN,
            isRecognized: true
        };
    }
    if (token.includes('fail') && token.includes('close')) {
        return {
            value: INTEGRITY_FAILED_CLOSED,
            isRecognized: true
        };
    }
    if (token.includes('intact')) {
        return {
            value: INTEGRITY_INTACT,
            isRecognized: true
        };
    }
    return {
        value: fallback,
        isRecognized: false
    };
}

function resolveSealByVolumeDefaults(baseRule = {}) {
    const fallbackMap = createDefaultSealByVolumeMap({
        bore: Boolean(baseRule?.boreSeal),
        annulus: Boolean(baseRule?.annularSeal)
    });

    const resolvedFromType = baseRule?.sealByVolume && typeof baseRule.sealByVolume === 'object'
        ? baseRule.sealByVolume
        : null;
    if (!resolvedFromType) return fallbackMap;

    const merged = {};
    TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
        const fallbackValue = fallbackMap[volumeKey];
        merged[volumeKey] = typeof resolvedFromType[volumeKey] === 'boolean'
            ? resolvedFromType[volumeKey]
            : fallbackValue;
    });
    return merged;
}

function resolvePerVolumeSealOverrides(row = {}) {
    const raw = row?.sealByVolume ?? row?.volumeSealOverrides ?? row?.volumeSeals;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            overrides: {},
            invalidKeys: [],
            invalidValues: []
        };
    }

    const overrides = {};
    const invalidKeys = [];
    const invalidValues = [];
    Object.entries(raw).forEach(([key, value]) => {
        const normalizedKey = normalizeSourceVolumeKind(key);
        if (!normalizedKey || !TOPOLOGY_VOLUME_KINDS.includes(normalizedKey)) {
            invalidKeys.push(String(key ?? ''));
            return;
        }

        if (value === null || value === undefined) return;
        if (typeof value === 'string' && value.trim().length === 0) return;
        const normalizedValue = parseOptionalBoolean(value);
        if (normalizedValue === null) {
            invalidValues.push({
                volumeKey: normalizedKey,
                rawValue: value
            });
            return;
        }
        overrides[normalizedKey] = normalizedValue;
    });

    return {
        overrides,
        invalidKeys,
        invalidValues
    };
}

function createDefinitionHookContext(options = {}) {
    return Object.freeze({ options });
}

function resolveDefinitionValidationWarnings(definition, row = {}, hookContext = {}) {
    if (!definition || typeof definition.validate !== 'function') return [];
    const result = definition.validate(row, hookContext);
    if (Array.isArray(result)) return result.filter(Boolean);
    if (!Array.isArray(result?.warnings)) return [];
    return result.warnings.filter(Boolean);
}

function resolveDefinitionSealContext(definition, row = {}, hookContext = {}) {
    if (!definition || typeof definition.resolveSealContext !== 'function') return null;
    const result = definition.resolveSealContext(row, hookContext);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
    return result;
}

function resolveDefinitionNoSealSuppressionCodes(definition) {
    if (!definition || !Array.isArray(definition.suppressNoSealWarningCodes)) return [];
    return definition.suppressNoSealWarningCodes
        .map((code) => String(code ?? '').trim())
        .filter((code) => code.length > 0);
}

function resolveHookDefaultSealByVolume(defaultSealByVolume = {}, hookValue = null) {
    if (!hookValue || typeof hookValue !== 'object' || Array.isArray(hookValue)) {
        return defaultSealByVolume;
    }

    const normalized = {};
    TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
        if (typeof hookValue[volumeKey] === 'boolean') {
            normalized[volumeKey] = hookValue[volumeKey];
            return;
        }
        normalized[volumeKey] = Boolean(defaultSealByVolume[volumeKey]);
    });
    return normalized;
}

function buildResolvedSealByVolume({
    defaultSealByVolume = {},
    resolvedBoreSeal = false,
    resolvedAnnularSeal = false,
    applyAnnularOverride = false,
    volumeOverrides = {}
} = {}) {
    const sealByVolume = {};
    TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
        if (volumeKey === NODE_KIND_BORE) {
            sealByVolume[volumeKey] = Boolean(resolvedBoreSeal);
            return;
        }
        const defaultAnnulusValue = typeof defaultSealByVolume[volumeKey] === 'boolean'
            ? defaultSealByVolume[volumeKey]
            : false;
        sealByVolume[volumeKey] = applyAnnularOverride
            ? Boolean(resolvedAnnularSeal)
            : defaultAnnulusValue;
    });

    Object.entries(volumeOverrides).forEach(([volumeKey, overrideValue]) => {
        if (!TOPOLOGY_VOLUME_KINDS.includes(volumeKey)) return;
        if (typeof overrideValue !== 'boolean') return;
        sealByVolume[volumeKey] = overrideValue;
    });
    return sealByVolume;
}

function resolveRowRule(row = {}, options = {}) {
    const normalizedType = normalizeEquipmentType(row?.type);
    const definition = resolveEquipmentDefinitionByKey(normalizedType);
    const baseRule = definition?.schema?.defaults ?? DEFAULT_RULE_FALLBACK;
    const hookContext = createDefinitionHookContext(options);
    const validationWarnings = [];
    const defaultSealByVolume = resolveSealByVolumeDefaults(baseRule);

    const annularSealOverride = parseOptionalBoolean(row?.annularSeal ?? row?.annulusSeal);
    const boreSealOverride = parseOptionalBoolean(row?.boreSeal);
    const hasRawAnnularSeal = normalizeToken(row?.annularSeal ?? row?.annulusSeal).length > 0;
    const hasRawBoreSeal = normalizeToken(row?.boreSeal).length > 0;
    const annularSeal = annularSealOverride === null
        ? Boolean(baseRule.annularSeal)
        : annularSealOverride;
    const boreSeal = boreSealOverride === null
        ? Boolean(baseRule.boreSeal)
        : boreSealOverride;
    const actuationResult = normalizeActuationState(row?.actuationState, baseRule.defaultActuationState);
    const integrityResult = normalizeIntegrityStatus(row?.integrityStatus, baseRule.defaultIntegrityStatus);
    const volumeOverrideResult = resolvePerVolumeSealOverrides(row);

    if (!definition) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_UNKNOWN_TYPE,
            'Equipment type is not recognized by topology rules; default no-seal behavior is applied.',
            row
        ));
    }
    if (hasRawAnnularSeal && annularSealOverride === null) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_INVALID_ANNULAR_SEAL_OVERRIDE,
            'Annular seal override value is invalid. Expected true/false or blank.',
            row
        ));
    }
    if (hasRawBoreSeal && boreSealOverride === null) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_INVALID_BORE_SEAL_OVERRIDE,
            'Bore seal override value is invalid. Expected true/false or blank.',
            row
        ));
    }
    if (!actuationResult.isRecognized && normalizeToken(row?.actuationState).length > 0) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_UNKNOWN_ACTUATION_STATE,
            'Actuation state is not recognized. Expected static/open/closed or blank.',
            row
        ));
    }
    if (!integrityResult.isRecognized && normalizeToken(row?.integrityStatus).length > 0) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_UNKNOWN_INTEGRITY_STATUS,
            'Integrity status is not recognized. Expected intact/failed_open/failed_closed/leaking or blank.',
            row
        ));
    }
    if (volumeOverrideResult.invalidKeys.length > 0) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_INVALID_VOLUME_SEAL_OVERRIDE_KEY,
            `Per-volume seal override contains unsupported keys: ${volumeOverrideResult.invalidKeys.join(', ')}.`,
            row
        ));
    }
    if (volumeOverrideResult.invalidValues.length > 0) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_INVALID_VOLUME_SEAL_OVERRIDE_VALUE,
            'Per-volume seal override values must be true/false (or 1/0/yes/no).',
            row
        ));
    }
    if (
        actuationResult.value === ACTUATION_CLOSED
        && (integrityResult.value === INTEGRITY_FAILED_OPEN || integrityResult.value === INTEGRITY_LEAKING)
    ) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_CONFLICT_CLOSED_WITH_OPEN_INTEGRITY,
            'Integrity status implies open/leaking behavior and overrides a closed actuation state.',
            row
        ));
    }
    if (actuationResult.value === ACTUATION_OPEN && integrityResult.value === INTEGRITY_FAILED_CLOSED) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_CONFLICT_OPEN_WITH_FAILED_CLOSED,
            'Integrity status implies failed-closed behavior and overrides an open actuation state.',
            row
        ));
    }

    validationWarnings.push(...resolveDefinitionValidationWarnings(definition, row, hookContext));

    const definitionSealContext = resolveDefinitionSealContext(definition, row, hookContext);
    const effectiveDefaultSealByVolume = resolveHookDefaultSealByVolume(
        defaultSealByVolume,
        definitionSealContext?.defaultSealByVolume
    );
    const resolvedBoreSeal = typeof definitionSealContext?.resolvedBoreSeal === 'boolean'
        ? definitionSealContext.resolvedBoreSeal
        : boreSeal;
    const resolvedAnnularSeal = typeof definitionSealContext?.resolvedAnnularSeal === 'boolean'
        ? definitionSealContext.resolvedAnnularSeal
        : annularSeal;
    const applyAnnularOverride = typeof definitionSealContext?.applyAnnularOverride === 'boolean'
        ? definitionSealContext.applyAnnularOverride
        : annularSealOverride !== null;
    const suppressNoSealWarningCodes = resolveDefinitionNoSealSuppressionCodes(definition);

    const sealByVolume = buildResolvedSealByVolume({
        defaultSealByVolume: effectiveDefaultSealByVolume,
        resolvedBoreSeal,
        resolvedAnnularSeal,
        applyAnnularOverride,
        volumeOverrides: volumeOverrideResult.overrides
    });

    return {
        type: normalizedType,
        sealByVolume,
        annularSeal,
        boreSeal,
        actuationState: actuationResult.value,
        integrityStatus: integrityResult.value,
        validationWarnings,
        suppressNoSealWarningCodes
    };
}

export function getEquipmentRuleRowWarnings(row = {}, options = {}) {
    const rule = resolveRowRule(row, options);
    return Array.isArray(rule?.validationWarnings) ? rule.validationWarnings : [];
}

function resolveSealState(hasSeal, actuationState, integrityStatus) {
    if (!hasSeal) {
        return {
            blocked: false,
            cost: 0,
            state: SEAL_STATE_OPEN
        };
    }

    if (integrityStatus === INTEGRITY_FAILED_OPEN || integrityStatus === INTEGRITY_LEAKING) {
        return {
            blocked: false,
            cost: 0,
            state: integrityStatus
        };
    }

    if (integrityStatus === INTEGRITY_FAILED_CLOSED) {
        return {
            blocked: true,
            cost: 1,
            state: INTEGRITY_FAILED_CLOSED
        };
    }

    if (actuationState === ACTUATION_OPEN) {
        return {
            blocked: false,
            cost: 0,
            state: SEAL_STATE_OPEN
        };
    }

    return {
        blocked: true,
        cost: 1,
        state: SEAL_STATE_CLOSED_FAILABLE
    };
}

function createEmptyBoundaryEffects() {
    const byVolume = {};
    EFFECT_VOLUME_SPECS.forEach((spec) => {
        byVolume[spec.volumeKey] = {
            blocked: false,
            cost: 0,
            state: SEAL_STATE_OPEN,
            contributors: []
        };
    });
    byVolume[NODE_KIND_LEGACY_BORE] = byVolume[NODE_KIND_BORE];

    return {
        byVolume,
        validationWarnings: []
    };
}

function appendContributor(target, sourceRow, type, sealResult, functionKey) {
    target.contributors.push({
        rowId: String(sourceRow?.rowId ?? '').trim() || null,
        equipmentType: String(type ?? sourceRow?.type ?? '').trim() || null,
        state: sealResult.state,
        cost: sealResult.cost,
        functionKey: String(functionKey ?? '').trim() || null
    });
}

function resolveBoundaryDepth(row = {}) {
    return parseOptionalNumber(row?.depth ?? row?.md ?? row?.measuredDepth);
}

export function resolveBoundaryEquipmentEffects(boundaryDepth, equipmentRows = [], options = {}) {
    const effects = createEmptyBoundaryEffects();
    const depth = Number(boundaryDepth);
    if (!Number.isFinite(depth)) return effects;

    const epsilon = Number.isFinite(Number(options?.epsilon))
        ? Math.max(1e-6, Number(options.epsilon))
        : 1e-3;
    const rows = Array.isArray(equipmentRows) ? equipmentRows : [];

    rows.forEach((row) => {
        if (!row || row.show === false) return;
        const rowDepth = resolveBoundaryDepth(row);
        if (!Number.isFinite(rowDepth) || Math.abs(rowDepth - depth) > epsilon) return;

        const rule = resolveRowRule(row, options);
        if (Array.isArray(rule.validationWarnings) && rule.validationWarnings.length > 0) {
            effects.validationWarnings.push(...rule.validationWarnings.map((warning) => ({
                ...warning,
                depth
            })));
        }
        const suppressionWarningCodes = new Set(
            (Array.isArray(rule?.suppressNoSealWarningCodes) ? rule.suppressNoSealWarningCodes : [])
                .map((code) => String(code ?? '').trim())
                .filter((code) => code.length > 0)
        );
        const hasDefinitionSuppressionWarning = rule.validationWarnings
            .some((warning) => suppressionWarningCodes.has(String(warning?.code ?? '').trim()));
        const hasAnySealPath = EFFECT_VOLUME_SPECS.some((spec) => (
            Boolean(rule?.sealByVolume?.[spec.volumeKey])
        ));

        EFFECT_VOLUME_SPECS.forEach((spec) => {
            const hasSealPath = Boolean(rule?.sealByVolume?.[spec.volumeKey]);
            const sealResult = resolveSealState(hasSealPath, rule.actuationState, rule.integrityStatus);
            if (!hasSealPath) return;

            const targetEffect = effects.byVolume[spec.volumeKey];
            if (!targetEffect) return;
            if (sealResult.blocked) {
                targetEffect.blocked = true;
                targetEffect.cost = Math.max(targetEffect.cost, sealResult.cost);
                targetEffect.state = sealResult.state;
            }
            appendContributor(targetEffect, row, rule.type, sealResult, spec.functionKey);
        });

        if (!hasAnySealPath && !hasDefinitionSuppressionWarning) {
            effects.validationWarnings.push({
                ...createValidationWarning(
                    EQUIPMENT_WARNING_NO_SEAL_BEHAVIOR_AT_BOUNDARY,
                    'Equipment row is present at a topology boundary but does not define bore/annulus seal behavior.',
                    row
                ),
                depth
            });
        }
    });

    return effects;
}

export default {
    getEquipmentRuleRowWarnings,
    resolveBoundaryEquipmentEffects
};
