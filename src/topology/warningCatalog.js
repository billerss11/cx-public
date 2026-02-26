export const TOPOLOGY_WARNING_CODES = Object.freeze({
    UNKNOWN_EQUIPMENT_TYPE: 'unknown_type',
    INVALID_ANNULAR_SEAL_OVERRIDE: 'invalid_annular_seal_override',
    INVALID_BORE_SEAL_OVERRIDE: 'invalid_bore_seal_override',
    INVALID_VOLUME_SEAL_OVERRIDE_KEY: 'invalid_volume_seal_override_key',
    INVALID_VOLUME_SEAL_OVERRIDE_VALUE: 'invalid_volume_seal_override_value',
    UNKNOWN_ACTUATION_STATE: 'unknown_actuation_state',
    UNKNOWN_INTEGRITY_STATUS: 'unknown_integrity_status',
    CONFLICT_CLOSED_WITH_OPEN_INTEGRITY: 'conflict_closed_with_open_integrity',
    CONFLICT_OPEN_WITH_FAILED_CLOSED: 'conflict_open_with_failed_closed',
    NO_SEAL_BEHAVIOR_AT_BOUNDARY: 'no_seal_behavior_at_boundary',
    EQUIPMENT_MISSING_ATTACH_TARGET: 'equipment_missing_attach_target',
    EQUIPMENT_UNRESOLVED_ATTACH_TARGET: 'equipment_unresolved_attach_target',
    EQUIPMENT_INVALID_HOST_DEPTH: 'equipment_invalid_host_depth',

    MARKER_INVALID_DEPTH_RANGE: 'marker_invalid_depth_range',
    MARKER_UNRESOLVED_HOST_REFERENCE: 'marker_unresolved_host_reference',
    MARKER_INVALID_TUBING_HOST_AT_DEPTH: 'marker_invalid_tubing_host_at_depth',
    MARKER_NO_RESOLVABLE_INTERVAL_OVERLAP: 'marker_no_resolvable_interval_overlap',

    FLUID_ROWS_WITHOUT_MODELED_SOURCE_NODES: 'fluid_rows_without_modeled_source_nodes',
    FLUID_IN_UNMODELED_OUTER_ANNULUS: 'fluid_in_unmodeled_outer_annulus',
    UNMAPPED_FORMATION_ANNULUS_FLUID: 'unmapped_formation_annulus_fluid',
    SCENARIO_SOURCE_UNSUPPORTED_VOLUME: 'scenario_source_unsupported_volume',
    SCENARIO_SOURCE_MISSING_DEPTH_RANGE: 'scenario_source_missing_depth_range',
    SCENARIO_SOURCE_NO_RESOLVABLE_INTERVAL: 'scenario_source_no_resolvable_interval',
    SCENARIO_ROWS_WITH_NO_RESOLVED_NODES: 'scenario_rows_with_no_resolved_nodes',
    SCENARIO_BREAKOUT_MISSING_VOLUME_PAIR: 'scenario_breakout_missing_volume_pair',
    SCENARIO_BREAKOUT_UNSUPPORTED_VOLUME_PAIR: 'scenario_breakout_unsupported_volume_pair',
    SCENARIO_BREAKOUT_MISSING_DEPTH_RANGE: 'scenario_breakout_missing_depth_range',
    SCENARIO_BREAKOUT_NO_RESOLVABLE_INTERVAL: 'scenario_breakout_no_resolvable_interval',

    ILLUSTRATIVE_FLUID_SOURCE_MODE_ENABLED: 'illustrative_fluid_source_mode_enabled',
    EXPLICIT_SCENARIO_SOURCE_MODE_ACTIVE: 'explicit_scenario_source_mode_active'
});

export const TOPOLOGY_WARNING_CATEGORIES = Object.freeze({
    EQUIPMENT: 'equipment',
    MARKER: 'marker',
    SOURCE: 'source',
    POLICY: 'policy'
});

const WARNING_METADATA_BY_CODE = Object.freeze({
    [TOPOLOGY_WARNING_CODES.UNKNOWN_EQUIPMENT_TYPE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['type'],
        recommendation: 'Use a recognized equipment type (for MVP: Packer or Safety Valve), or set explicit bore/annular seal overrides.'
    }),
    [TOPOLOGY_WARNING_CODES.INVALID_ANNULAR_SEAL_OVERRIDE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['annularSeal'],
        recommendation: 'Set annular seal override to true, false, or leave it blank to inherit type defaults.'
    }),
    [TOPOLOGY_WARNING_CODES.INVALID_BORE_SEAL_OVERRIDE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['boreSeal'],
        recommendation: 'Set bore seal override to true, false, or leave it blank to inherit type defaults.'
    }),
    [TOPOLOGY_WARNING_CODES.INVALID_VOLUME_SEAL_OVERRIDE_KEY]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['sealByVolume'],
        recommendation: 'Use supported volume keys only: TUBING_INNER (legacy BORE), ANNULUS_A, ANNULUS_B, ANNULUS_C, ANNULUS_D, FORMATION_ANNULUS.'
    }),
    [TOPOLOGY_WARNING_CODES.INVALID_VOLUME_SEAL_OVERRIDE_VALUE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['sealByVolume'],
        recommendation: 'Use true/false values for per-volume seal overrides.'
    }),
    [TOPOLOGY_WARNING_CODES.UNKNOWN_ACTUATION_STATE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['actuationState'],
        recommendation: 'Use static, open, closed, or leave blank to inherit the equipment type default.'
    }),
    [TOPOLOGY_WARNING_CODES.UNKNOWN_INTEGRITY_STATUS]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['integrityStatus'],
        recommendation: 'Use intact, failed_open, failed_closed, leaking, or leave blank to inherit the equipment type default.'
    }),
    [TOPOLOGY_WARNING_CODES.CONFLICT_CLOSED_WITH_OPEN_INTEGRITY]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['actuationState', 'integrityStatus'],
        recommendation: 'If the barrier should block flow, use integrity intact/failed_closed. If communication is expected, use actuation open.'
    }),
    [TOPOLOGY_WARNING_CODES.CONFLICT_OPEN_WITH_FAILED_CLOSED]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['actuationState', 'integrityStatus'],
        recommendation: 'If communication is expected, avoid failed_closed integrity. If the barrier should block flow, use closed actuation.'
    }),
    [TOPOLOGY_WARNING_CODES.NO_SEAL_BEHAVIOR_AT_BOUNDARY]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['boreSeal', 'annularSeal', 'sealByVolume'],
        recommendation: 'Define at least one seal path for this equipment at the boundary (bore/annular/per-volume), or move/remove the row if it is non-sealing.'
    }),
    [TOPOLOGY_WARNING_CODES.EQUIPMENT_MISSING_ATTACH_TARGET]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['attachToDisplay', 'attachToHostType', 'attachToId'],
        recommendation: 'Select a valid Attach To target (Tubing or Casing) for this packer row.'
    }),
    [TOPOLOGY_WARNING_CODES.EQUIPMENT_UNRESOLVED_ATTACH_TARGET]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['attachToDisplay', 'attachToHostType', 'attachToId'],
        recommendation: 'Re-select Attach To so this packer references an existing host row.'
    }),
    [TOPOLOGY_WARNING_CODES.EQUIPMENT_INVALID_HOST_DEPTH]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.EQUIPMENT,
        fields: ['depth', 'attachToDisplay'],
        recommendation: 'Move the packer depth into the selected host interval, or choose a host that overlaps this depth.'
    }),

    [TOPOLOGY_WARNING_CODES.MARKER_INVALID_DEPTH_RANGE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.MARKER,
        recommendation: 'Set marker Top/Bottom so both values are numeric and Bottom is not shallower than Top.'
    }),
    [TOPOLOGY_WARNING_CODES.MARKER_UNRESOLVED_HOST_REFERENCE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.MARKER,
        recommendation: 'Re-select Attach To so the marker references a valid host row.'
    }),
    [TOPOLOGY_WARNING_CODES.MARKER_INVALID_TUBING_HOST_AT_DEPTH]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.MARKER,
        recommendation: 'Set host type to tubing and keep the leak marker depth range inside the selected tubing interval.'
    }),
    [TOPOLOGY_WARNING_CODES.MARKER_NO_RESOLVABLE_INTERVAL_OVERLAP]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.MARKER,
        recommendation: 'Adjust marker depth range and host selection so it intersects a modeled radial volume pair.'
    }),

    [TOPOLOGY_WARNING_CODES.FLUID_ROWS_WITHOUT_MODELED_SOURCE_NODES]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        recommendation: 'Use marker/default sources, explicit topology sources, or enable illustrative fluid-source mode intentionally.'
    }),
    [TOPOLOGY_WARNING_CODES.FLUID_IN_UNMODELED_OUTER_ANNULUS]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        recommendation: 'Move sources to modeled volumes or extend topology volume support for outer annulus slots beyond ANNULUS_D.'
    }),
    [TOPOLOGY_WARNING_CODES.UNMAPPED_FORMATION_ANNULUS_FLUID]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        recommendation: 'Check open-hole/formation annulus setup so FORMATION_ANNULUS nodes can be resolved for fluid intervals.'
    }),
    [TOPOLOGY_WARNING_CODES.SCENARIO_SOURCE_UNSUPPORTED_VOLUME]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        recommendation: 'Use supported MVP volume keys: TUBING_INNER (legacy BORE), ANNULUS_A, ANNULUS_B, ANNULUS_C, ANNULUS_D, FORMATION_ANNULUS.'
    }),
    [TOPOLOGY_WARNING_CODES.SCENARIO_SOURCE_MISSING_DEPTH_RANGE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        recommendation: 'Provide depth, or valid top/bottom values for the scenario source row.'
    }),
    [TOPOLOGY_WARNING_CODES.SCENARIO_SOURCE_NO_RESOLVABLE_INTERVAL]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        recommendation: 'Adjust scenario source depth range so it intersects at least one modeled topology interval.'
    }),
    [TOPOLOGY_WARNING_CODES.SCENARIO_ROWS_WITH_NO_RESOLVED_NODES]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        recommendation: 'Review scenario source rows for valid depth ranges and volume keys so they resolve to source nodes.'
    }),
    [TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_VOLUME_PAIR]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        fields: ['fromVolumeKey', 'toVolumeKey'],
        recommendation: 'Set both From Volume and To Volume for cross-annulus breakout scenario rows.'
    }),
    [TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_UNSUPPORTED_VOLUME_PAIR]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        fields: ['fromVolumeKey', 'toVolumeKey'],
        recommendation: 'Use supported volume keys for breakout pairs: TUBING_INNER (legacy BORE), ANNULUS_A, ANNULUS_B, ANNULUS_C, ANNULUS_D, FORMATION_ANNULUS.'
    }),
    [TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_DEPTH_RANGE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        fields: ['top', 'bottom'],
        recommendation: 'Provide depth, or valid top/bottom values for breakout scenario rows.'
    }),
    [TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_NO_RESOLVABLE_INTERVAL]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.SOURCE,
        fields: ['top', 'bottom', 'fromVolumeKey', 'toVolumeKey'],
        recommendation: 'Adjust breakout row depth range and volume pair so both volumes resolve in at least one interval.'
    }),

    [TOPOLOGY_WARNING_CODES.ILLUSTRATIVE_FLUID_SOURCE_MODE_ENABLED]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.POLICY,
        recommendation: 'Use this mode for exploratory analysis only; rely on explicit scenario/marker-driven sources for engineering decisions.'
    }),
    [TOPOLOGY_WARNING_CODES.EXPLICIT_SCENARIO_SOURCE_MODE_ACTIVE]: Object.freeze({
        category: TOPOLOGY_WARNING_CATEGORIES.POLICY,
        recommendation: 'When explicit scenario rows are active, marker/fluid fallback is disabled for this run.'
    })
});

function normalizeCode(value) {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
}

function normalizeFields(value) {
    if (!Array.isArray(value)) return undefined;
    const fields = value
        .map((field) => String(field ?? '').trim())
        .filter((field) => field.length > 0);
    return fields.length > 0 ? [...new Set(fields)] : undefined;
}

function normalizeCategory(value) {
    const category = String(value ?? '').trim().toLowerCase();
    return category.length > 0 ? category : undefined;
}

function normalizeRecommendation(value) {
    const recommendation = String(value ?? '').trim();
    return recommendation.length > 0 ? recommendation : undefined;
}

function normalizeRowId(value) {
    const rowId = String(value ?? '').trim();
    return rowId.length > 0 ? rowId : undefined;
}

function normalizeDepth(value) {
    if (!Number.isFinite(Number(value))) return null;
    return Number(value);
}

export function resolveWarningMetadata(code) {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) return null;
    return WARNING_METADATA_BY_CODE[normalizedCode] ?? null;
}

export function resolveWarningCategory(code) {
    return normalizeCategory(resolveWarningMetadata(code)?.category) ?? null;
}

export function createTopologyValidationWarning(code, message, options = {}) {
    const normalizedCode = normalizeCode(code);
    const normalizedMessage = String(message ?? '').trim();
    const metadata = resolveWarningMetadata(normalizedCode);

    const warning = {
        level: 'warning',
        code: normalizedCode ?? null,
        message: normalizedMessage,
        depth: normalizeDepth(options?.depth)
    };

    const rowId = normalizeRowId(options?.rowId);
    if (rowId) {
        warning.rowId = rowId;
    }

    const fields = normalizeFields(options?.fields) ?? normalizeFields(metadata?.fields);
    if (fields) {
        warning.fields = fields;
    }

    const category = normalizeCategory(options?.category) ?? normalizeCategory(metadata?.category);
    if (category) {
        warning.category = category;
    }

    const recommendation = normalizeRecommendation(options?.recommendation)
        ?? normalizeRecommendation(metadata?.recommendation);
    if (recommendation) {
        warning.recommendation = recommendation;
    }

    return warning;
}

export default {
    TOPOLOGY_WARNING_CODES,
    TOPOLOGY_WARNING_CATEGORIES,
    resolveWarningMetadata,
    resolveWarningCategory,
    createTopologyValidationWarning
};
