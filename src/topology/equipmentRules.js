import { parseOptionalNumber } from '@/utils/general.js';
import {
    ACTUATION_CLOSED,
    ACTUATION_OPEN,
    ACTUATION_STATIC,
    INTEGRITY_FAILED_CLOSED,
    INTEGRITY_FAILED_OPEN,
    INTEGRITY_INTACT,
    INTEGRITY_LEAKING,
    NORMALIZED_EQUIPMENT_TYPE_BRIDGE_PLUG,
    NORMALIZED_EQUIPMENT_TYPE_PACKER,
    NORMALIZED_EQUIPMENT_TYPE_SAFETY_VALVE
} from '@/topology/equipmentDefinitions/constants.js';
import equipmentDefinitionRegistry, {
    normalizeEquipmentTypeKey
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
import { normalizeEquipmentRow } from '@/equipment/rowNormalization.js';

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

function normalizeEquipmentType(value, registry = equipmentDefinitionRegistry) {
    if (registry && typeof registry.normalizeTypeKey === 'function') {
        return registry.normalizeTypeKey(value);
    }
    return normalizeEquipmentTypeKey(value);
}

function resolveDefinitionRegistry(options = {}) {
    const registry = options?.definitionRegistry;
    if (registry && typeof registry.resolveDefinitionByKey === 'function') {
        return registry;
    }
    return equipmentDefinitionRegistry;
}

function resolveDefinitionEngineering(definition) {
    if (definition?.engineering && typeof definition.engineering === 'object') {
        return definition.engineering;
    }
    return definition ?? null;
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
    const engineering = resolveDefinitionEngineering(definition);
    if (!engineering || typeof engineering.validate !== 'function') return [];
    const result = engineering.validate(row, hookContext);
    if (Array.isArray(result)) return result.filter(Boolean);
    if (!Array.isArray(result?.warnings)) return [];
    return result.warnings.filter(Boolean);
}

function resolveDefinitionSealContext(definition, row = {}, hookContext = {}) {
    const engineering = resolveDefinitionEngineering(definition);
    if (!engineering || typeof engineering.resolveSealContext !== 'function') return null;
    const result = engineering.resolveSealContext(row, hookContext);
    if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
    return result;
}

function resolveDefinitionNoSealSuppressionCodes(definition) {
    const engineering = resolveDefinitionEngineering(definition);
    const suppressCodes = Array.isArray(engineering?.suppressNoSealWarningCodes)
        ? engineering.suppressNoSealWarningCodes
        : [];
    return suppressCodes
        .map((code) => String(code ?? '').trim())
        .filter((code) => code.length > 0);
}

function resolveDefinitionConnectionContributions(definition, row = {}, hookContext = {}) {
    const engineering = resolveDefinitionEngineering(definition);
    if (!engineering || typeof engineering.resolveConnections !== 'function') return [];
    const result = engineering.resolveConnections(row, hookContext);
    return Array.isArray(result) ? result.filter(Boolean) : [];
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
    annularOverrideVolumeKeys = null,
    volumeOverrides = {}
} = {}) {
    const sealByVolume = {};
    const targetedOverrideVolumeSet = Array.isArray(annularOverrideVolumeKeys)
        ? new Set(annularOverrideVolumeKeys.filter((volumeKey) => TOPOLOGY_VOLUME_KINDS.includes(volumeKey) && volumeKey !== NODE_KIND_BORE))
        : null;
    TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
        if (volumeKey === NODE_KIND_BORE) {
            sealByVolume[volumeKey] = Boolean(resolvedBoreSeal);
            return;
        }
        const defaultAnnulusValue = typeof defaultSealByVolume[volumeKey] === 'boolean'
            ? defaultSealByVolume[volumeKey]
            : false;
        const shouldApplyAnnularOverride = targetedOverrideVolumeSet
            ? targetedOverrideVolumeSet.has(volumeKey)
            : true;
        sealByVolume[volumeKey] = applyAnnularOverride
            ? (shouldApplyAnnularOverride ? Boolean(resolvedAnnularSeal) : defaultAnnulusValue)
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
    const normalizedRow = normalizeEquipmentRow(row);
    const definitionRegistry = resolveDefinitionRegistry(options);
    const normalizedType = normalizeEquipmentType(
        normalizedRow?.typeKey ?? normalizedRow?.type,
        definitionRegistry
    );
    const definition = definitionRegistry.resolveDefinitionByKey(normalizedType);
    const baseRule = definition?.defaults ?? definition?.schema?.defaults ?? DEFAULT_RULE_FALLBACK;
    const hookContext = createDefinitionHookContext(options);
    const validationWarnings = [];
    const defaultSealByVolume = resolveSealByVolumeDefaults(baseRule);

    const annularSealOverride = parseOptionalBoolean(normalizedRow?.annularSeal ?? normalizedRow?.annulusSeal);
    const boreSealOverride = parseOptionalBoolean(normalizedRow?.boreSeal);
    const hasRawAnnularSeal = normalizeToken(normalizedRow?.annularSeal ?? normalizedRow?.annulusSeal).length > 0;
    const hasRawBoreSeal = normalizeToken(normalizedRow?.boreSeal).length > 0;
    const annularSeal = annularSealOverride === null
        ? Boolean(baseRule.annularSeal)
        : annularSealOverride;
    const boreSeal = boreSealOverride === null
        ? Boolean(baseRule.boreSeal)
        : boreSealOverride;
    const actuationResult = normalizeActuationState(normalizedRow?.actuationState, baseRule.defaultActuationState);
    const integrityResult = normalizeIntegrityStatus(normalizedRow?.integrityStatus, baseRule.defaultIntegrityStatus);
    const volumeOverrideResult = resolvePerVolumeSealOverrides(normalizedRow);

    if (!definition) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_UNKNOWN_TYPE,
            'Equipment type is not recognized by topology rules; default no-seal behavior is applied.',
            normalizedRow
        ));
    }
    if (hasRawAnnularSeal && annularSealOverride === null) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_INVALID_ANNULAR_SEAL_OVERRIDE,
            'Annular seal override value is invalid. Expected true/false or blank.',
            normalizedRow
        ));
    }
    if (hasRawBoreSeal && boreSealOverride === null) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_INVALID_BORE_SEAL_OVERRIDE,
            'Bore seal override value is invalid. Expected true/false or blank.',
            normalizedRow
        ));
    }
    if (!actuationResult.isRecognized && normalizeToken(normalizedRow?.actuationState).length > 0) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_UNKNOWN_ACTUATION_STATE,
            'Actuation state is not recognized. Expected static/open/closed or blank.',
            normalizedRow
        ));
    }
    if (!integrityResult.isRecognized && normalizeToken(normalizedRow?.integrityStatus).length > 0) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_UNKNOWN_INTEGRITY_STATUS,
            'Integrity status is not recognized. Expected intact/failed_open/failed_closed/leaking or blank.',
            normalizedRow
        ));
    }
    if (volumeOverrideResult.invalidKeys.length > 0) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_INVALID_VOLUME_SEAL_OVERRIDE_KEY,
            `Per-volume seal override contains unsupported keys: ${volumeOverrideResult.invalidKeys.join(', ')}.`,
            normalizedRow
        ));
    }
    if (volumeOverrideResult.invalidValues.length > 0) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_INVALID_VOLUME_SEAL_OVERRIDE_VALUE,
            'Per-volume seal override values must be true/false (or 1/0/yes/no).',
            normalizedRow
        ));
    }
    if (
        actuationResult.value === ACTUATION_CLOSED
        && (integrityResult.value === INTEGRITY_FAILED_OPEN || integrityResult.value === INTEGRITY_LEAKING)
    ) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_CONFLICT_CLOSED_WITH_OPEN_INTEGRITY,
            'Integrity status implies open/leaking behavior and overrides a closed actuation state.',
            normalizedRow
        ));
    }
    if (actuationResult.value === ACTUATION_OPEN && integrityResult.value === INTEGRITY_FAILED_CLOSED) {
        validationWarnings.push(createValidationWarning(
            EQUIPMENT_WARNING_CONFLICT_OPEN_WITH_FAILED_CLOSED,
            'Integrity status implies failed-closed behavior and overrides an open actuation state.',
            normalizedRow
        ));
    }

    validationWarnings.push(...resolveDefinitionValidationWarnings(definition, normalizedRow, hookContext));

    const definitionSealContext = resolveDefinitionSealContext(definition, normalizedRow, hookContext);
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
    const annularOverrideVolumeKeys = Array.isArray(definitionSealContext?.annularOverrideVolumeKeys)
        ? definitionSealContext.annularOverrideVolumeKeys
        : null;
    const suppressNoSealWarningCodes = resolveDefinitionNoSealSuppressionCodes(definition);

    const sealByVolume = buildResolvedSealByVolume({
        defaultSealByVolume: effectiveDefaultSealByVolume,
        resolvedBoreSeal,
        resolvedAnnularSeal,
        applyAnnularOverride,
        annularOverrideVolumeKeys,
        volumeOverrides: volumeOverrideResult.overrides
    });

    return {
        row: normalizedRow,
        definition,
        hookContext,
        type: normalizedType,
        baseRule,
        definitionSealContext,
        effectiveDefaultSealByVolume,
        sealByVolume,
        annularSeal,
        boreSeal,
        annularSealOverride,
        boreSealOverride,
        volumeOverrides: volumeOverrideResult.overrides,
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

function resolveBehaviorSummary(sealedVolumeKeys = [], actuationState, integrityStatus) {
    const sealResult = resolveSealState(sealedVolumeKeys.length > 0, actuationState, integrityStatus);
    if (sealedVolumeKeys.length === 0) {
        return {
            primaryBehavior: 'no_barrier',
            behaviorState: sealResult.state
        };
    }
    if (sealResult.blocked) {
        return {
            primaryBehavior: 'blocking',
            behaviorState: sealResult.state
        };
    }
    return {
        primaryBehavior: 'communicating',
        behaviorState: sealResult.state
    };
}

function resolveSealBehaviorSource(volumeKey, rule = {}) {
    if (typeof rule?.volumeOverrides?.[volumeKey] === 'boolean') {
        return 'per_volume_override';
    }

    if (volumeKey === NODE_KIND_BORE) {
        if (rule?.type === NORMALIZED_EQUIPMENT_TYPE_BRIDGE_PLUG) {
            return 'definition_context';
        }
        if (rule?.boreSealOverride !== null) {
            return 'bore_override';
        }
        if (Boolean(rule?.sealByVolume?.[volumeKey])) {
            return 'type_default';
        }
        return 'none';
    }

    const targetedOverrideVolumeKeys = Array.isArray(rule?.definitionSealContext?.annularOverrideVolumeKeys)
        ? rule.definitionSealContext.annularOverrideVolumeKeys
        : null;
    const genericAnnularTargetsVolume = targetedOverrideVolumeKeys
        ? targetedOverrideVolumeKeys.includes(volumeKey)
        : true;
    if (rule?.annularSealOverride !== null && genericAnnularTargetsVolume) {
        return 'annular_override';
    }
    if (Boolean(rule?.definitionSealContext?.defaultSealByVolume?.[volumeKey])) {
        return 'definition_context';
    }
    if (Boolean(rule?.effectiveDefaultSealByVolume?.[volumeKey])) {
        return 'type_default';
    }
    return 'none';
}

function createFieldBehavior({ emphasis, isRelevant, supersededVolumeKeys = [], notes = [] }) {
    return {
        emphasis,
        isRelevant,
        hasSupersededVolumes: supersededVolumeKeys.length > 0,
        supersededVolumeKeys,
        notes
    };
}

function resolveFieldBehavior(rule = {}, sealBehaviorByVolume = {}) {
    const annularOverrideVolumes = Object.entries(sealBehaviorByVolume)
        .filter(([volumeKey, behavior]) => (
            volumeKey !== NODE_KIND_BORE
            && behavior?.source === 'per_volume_override'
            && rule?.annularSealOverride !== null
        ))
        .map(([volumeKey]) => volumeKey);
    const notes = [];
    if (annularOverrideVolumes.length > 0) {
        notes.push('per_volume_override_supersedes_generic_annular');
    }

    if (rule?.type === NORMALIZED_EQUIPMENT_TYPE_PACKER) {
        return {
            'properties.boreSeal': createFieldBehavior({
                emphasis: 'advanced',
                isRelevant: true
            }),
            'properties.annularSeal': createFieldBehavior({
                emphasis: 'primary',
                isRelevant: true,
                supersededVolumeKeys: annularOverrideVolumes,
                notes
            }),
            'properties.sealByVolume': createFieldBehavior({
                emphasis: 'advanced',
                isRelevant: true
            })
        };
    }

    if (rule?.type === NORMALIZED_EQUIPMENT_TYPE_SAFETY_VALVE) {
        return {
            'properties.boreSeal': createFieldBehavior({
                emphasis: 'primary',
                isRelevant: true
            }),
            'properties.annularSeal': createFieldBehavior({
                emphasis: 'advanced',
                isRelevant: true,
                supersededVolumeKeys: annularOverrideVolumes,
                notes
            }),
            'properties.sealByVolume': createFieldBehavior({
                emphasis: 'advanced',
                isRelevant: true
            })
        };
    }

    if (rule?.type === NORMALIZED_EQUIPMENT_TYPE_BRIDGE_PLUG) {
        return {
            'properties.boreSeal': createFieldBehavior({
                emphasis: 'read_only',
                isRelevant: false
            }),
            'properties.annularSeal': createFieldBehavior({
                emphasis: 'advanced',
                isRelevant: false,
                supersededVolumeKeys: annularOverrideVolumes,
                notes
            }),
            'properties.sealByVolume': createFieldBehavior({
                emphasis: 'advanced',
                isRelevant: true
            })
        };
    }

    return {
        'properties.boreSeal': createFieldBehavior({
            emphasis: 'advanced',
            isRelevant: true
        }),
        'properties.annularSeal': createFieldBehavior({
            emphasis: 'advanced',
            isRelevant: true,
            supersededVolumeKeys: annularOverrideVolumes,
            notes
        }),
        'properties.sealByVolume': createFieldBehavior({
            emphasis: 'advanced',
            isRelevant: true
        })
    };
}

function buildPresentationNotes(rule = {}, fieldBehavior = {}) {
    const notes = new Set();
    if (
        rule?.definition?.host?.usesAttachReference === true
        && normalizeSourceVolumeKind(rule?.row?.sealNodeKind)
    ) {
        notes.add('attach_resolution_controls_annulus_target');
    }

    Object.values(fieldBehavior).forEach((behavior) => {
        (Array.isArray(behavior?.notes) ? behavior.notes : []).forEach((note) => {
            if (String(note ?? '').trim()) {
                notes.add(note);
            }
        });
    });

    if (rule?.type === NORMALIZED_EQUIPMENT_TYPE_BRIDGE_PLUG) {
        notes.add('bridge_plug_seals_host_bore_and_annulus');
    }

    return [...notes];
}

function toPresentationVolumeKey(volumeKey) {
    return volumeKey === NODE_KIND_BORE ? NODE_KIND_LEGACY_BORE : volumeKey;
}

export function resolveEquipmentRulePresentation(row = {}, options = {}) {
    const rule = resolveRowRule(row, options);
    const sealBehaviorByVolume = {};

    EFFECT_VOLUME_SPECS.forEach((spec) => {
        const hasSealPath = Boolean(rule?.sealByVolume?.[spec.volumeKey]);
        const sealResult = resolveSealState(hasSealPath, rule.actuationState, rule.integrityStatus);
        sealBehaviorByVolume[spec.volumeKey] = {
            hasSealPath,
            blocked: sealResult.blocked,
            state: sealResult.state,
            source: resolveSealBehaviorSource(spec.volumeKey, rule)
        };
    });

    const sealedVolumeKeys = EFFECT_VOLUME_SPECS
        .map((spec) => spec.volumeKey)
        .filter((volumeKey) => Boolean(sealBehaviorByVolume[volumeKey]?.hasSealPath));
    const fieldBehavior = resolveFieldBehavior(rule, sealBehaviorByVolume);
    const behaviorSummary = resolveBehaviorSummary(
        sealedVolumeKeys,
        rule.actuationState,
        rule.integrityStatus
    );

    return {
        type: rule.type,
        row: rule.row,
        effectiveActuationState: rule.actuationState,
        effectiveIntegrityStatus: rule.integrityStatus,
        sealBehaviorByVolume,
        fieldBehavior,
        summary: {
            sealedVolumeKeys: sealedVolumeKeys.map((volumeKey) => toPresentationVolumeKey(volumeKey)),
            primaryBehavior: behaviorSummary.primaryBehavior,
            behaviorState: behaviorSummary.behaviorState,
            notes: buildPresentationNotes(rule, fieldBehavior)
        }
    };
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
        connectionContributions: [],
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

function normalizeConnectionContribution(rawContribution = {}, row = {}, type = null) {
    const edgeKind = normalizeToken(rawContribution?.edgeKind);
    if (edgeKind !== 'vertical' && edgeKind !== 'radial') return null;

    const directionToken = normalizeToken(rawContribution?.direction);
    const direction = directionToken === 'forward' || directionToken === 'reverse'
        ? directionToken
        : 'bidirectional';
    const fromInterval = normalizeToken(rawContribution?.fromInterval) === 'next'
        ? 'next'
        : 'current';
    const toInterval = normalizeToken(rawContribution?.toInterval) === 'next'
        ? 'next'
        : 'current';
    const fromVolumeKey = normalizeSourceVolumeKind(rawContribution?.fromVolumeKey);
    const toVolumeKey = normalizeSourceVolumeKind(rawContribution?.toVolumeKey);
    if (!fromVolumeKey || !toVolumeKey) return null;

    const parsedCost = Number(rawContribution?.cost);
    const cost = Number.isFinite(parsedCost) ? parsedCost : 0;
    return {
        edgeKind,
        direction,
        fromInterval,
        toInterval,
        fromVolumeKey,
        toVolumeKey,
        state: String(rawContribution?.state ?? 'open').trim() || 'open',
        cost,
        functionKey: String(rawContribution?.functionKey ?? 'equipment_connection').trim() || 'equipment_connection',
        summary: String(rawContribution?.summary ?? '').trim(),
        rowId: String(row?.rowId ?? '').trim() || null,
        equipmentType: String(type ?? row?.type ?? '').trim() || null
    };
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
                    rule.row
                ),
                depth
            });
        }

        resolveDefinitionConnectionContributions(rule.definition, rule.row, rule.hookContext)
            .forEach((connectionContribution) => {
                const normalizedContribution = normalizeConnectionContribution(
                    connectionContribution,
                    rule.row,
                    rule.type
                );
                if (!normalizedContribution) return;
                effects.connectionContributions.push(normalizedContribution);
            });
    });

    return effects;
}

export default {
    getEquipmentRuleRowWarnings,
    resolveBoundaryEquipmentEffects,
    resolveEquipmentRulePresentation
};
