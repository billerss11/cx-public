export const TOPOLOGY_EPSILON = 1e-6;

export const NODE_KIND_SURFACE = 'SURFACE';
export const NODE_KIND_TUBING_INNER = 'TUBING_INNER';
export const NODE_KIND_TUBING_ANNULUS = 'TUBING_ANNULUS';
export const NODE_KIND_LEGACY_BORE = 'BORE';

// Backward-compatible export alias used by existing modules.
export const NODE_KIND_BORE = NODE_KIND_TUBING_INNER;
const MODELED_ANNULUS_SUFFIXES = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);
const MAX_FORMATION_COMPATIBLE_CASING_ANNULUS_SLOT_INDEX = 2;

function createAnnulusKindToken(suffix = '') {
    const token = String(suffix ?? '').trim().toUpperCase();
    return token ? `ANNULUS_${token}` : null;
}

const MODELED_ANNULUS_KIND_BY_SUFFIX = Object.freeze(
    MODELED_ANNULUS_SUFFIXES.reduce((bySuffix, suffix) => {
        const kind = createAnnulusKindToken(suffix);
        if (!kind) return bySuffix;
        bySuffix[suffix] = kind;
        return bySuffix;
    }, {})
);

export const NODE_KIND_ANNULUS_A = MODELED_ANNULUS_KIND_BY_SUFFIX.A;
export const NODE_KIND_ANNULUS_B = MODELED_ANNULUS_KIND_BY_SUFFIX.B;
export const NODE_KIND_ANNULUS_C = MODELED_ANNULUS_KIND_BY_SUFFIX.C;
export const NODE_KIND_ANNULUS_D = MODELED_ANNULUS_KIND_BY_SUFFIX.D;
export const NODE_KIND_ANNULUS_E = MODELED_ANNULUS_KIND_BY_SUFFIX.E;
export const NODE_KIND_ANNULUS_F = MODELED_ANNULUS_KIND_BY_SUFFIX.F;
export const NODE_KIND_FORMATION_ANNULUS = 'FORMATION_ANNULUS';

export const MODELED_CASING_ANNULUS_KINDS = Object.freeze(
    MODELED_ANNULUS_SUFFIXES
        .map((suffix) => MODELED_ANNULUS_KIND_BY_SUFFIX[suffix])
        .filter(Boolean)
);
const MODELED_CASING_ANNULUS_KIND_SET = new Set(MODELED_CASING_ANNULUS_KINDS);

export const MODELED_ANNULUS_VOLUME_SLOTS = Object.freeze([
    ...MODELED_CASING_ANNULUS_KINDS.map((kind, slotIndex) => (
        Object.freeze({
            kind,
            slotIndex,
            allowFormationRepresentation: slotIndex <= MAX_FORMATION_COMPATIBLE_CASING_ANNULUS_SLOT_INDEX
        })
    ))
]);

export const MODELED_VOLUME_KINDS = Object.freeze([
    NODE_KIND_TUBING_INNER,
    NODE_KIND_TUBING_ANNULUS,
    ...MODELED_CASING_ANNULUS_KINDS
]);

export const TOPOLOGY_VOLUME_KINDS = Object.freeze([
    ...MODELED_VOLUME_KINDS,
    NODE_KIND_FORMATION_ANNULUS
]);

export const MAX_MODELED_ANNULUS_SLOT_INDEX = MODELED_ANNULUS_VOLUME_SLOTS[
    MODELED_ANNULUS_VOLUME_SLOTS.length - 1
].slotIndex;

export const EDGE_KIND_VERTICAL = 'vertical';
export const EDGE_KIND_RADIAL = 'radial';
export const EDGE_KIND_TERMINATION = 'termination';

export const TOPOLOGY_CONFIG_USE_ILLUSTRATIVE_FLUID_SOURCE = 'topologyUseIllustrativeFluidSource';
export const TOPOLOGY_CONFIG_USE_OPEN_HOLE_SOURCE = 'topologyUseOpenHoleSource';
export const SOURCE_POLICY_MODE_MARKER_DEFAULT = 'marker_default';
export const SOURCE_POLICY_MODE_FLUID_OPT_IN = 'fluid_opt_in';
export const SOURCE_POLICY_MODE_OPEN_HOLE_OPT_IN = 'open_hole_opt_in';
export const SOURCE_POLICY_MODE_SCENARIO_EXPLICIT = 'scenario_explicit';
export const SOURCE_KIND_PERFORATION = 'perforation';
export const SOURCE_KIND_LEAK = 'leak';
export const SOURCE_KIND_FORMATION_INFLOW = 'formation_inflow';
export const SOURCE_KIND_SCENARIO = 'scenario';

export function normalizeWellId(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

export function normalizeMarkerType(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (!token) return null;
    if (token.includes('perf')) return SOURCE_KIND_PERFORATION;
    if (token.includes('leak')) return SOURCE_KIND_LEAK;
    return null;
}

export function normalizeSourceType(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (!token) return SOURCE_KIND_SCENARIO;
    if (token.includes('perf')) return SOURCE_KIND_PERFORATION;
    if (token.includes('leak')) return SOURCE_KIND_LEAK;
    if (token.includes('formation') || token.includes('inflow')) return SOURCE_KIND_FORMATION_INFLOW;
    return token.replace(/\s+/g, '_');
}

function resolveModeledAnnulusKindFromToken(token) {
    for (const kind of MODELED_CASING_ANNULUS_KINDS) {
        const suffix = kind.replace('ANNULUS_', '');
        const compactKind = kind.replace(/_/g, '');
        const compactToken = token.replace(/_/g, '');
        if (
            token === kind
            || token === compactKind
            || token === `CASING_ANNULUS_${suffix}`
            || token === `${suffix}_ANNULUS`
            || token === `${suffix}_ANNULUS_${suffix}`
            || token.includes(kind)
        ) {
            return kind;
        }
        if (compactToken.includes(compactKind)) {
            return kind;
        }
    }
    return null;
}

export function isModeledCasingAnnulusKind(value) {
    const token = String(value ?? '').trim().toUpperCase();
    if (!token) return false;
    return MODELED_CASING_ANNULUS_KIND_SET.has(token);
}

export function normalizeSourceVolumeKind(value) {
    const token = String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[-\s]+/g, '_');
    if (!token) return null;

    if (
        token === NODE_KIND_TUBING_INNER
        || token === 'TUBINGINNER'
        || token.includes('TUBING_INNER')
    ) {
        return NODE_KIND_TUBING_INNER;
    }
    if (
        token === NODE_KIND_TUBING_ANNULUS
        || token === 'TUBINGANNULUS'
        || token === 'TBG_ANNULUS'
        || token === 'PRIMARY_ANNULUS'
        || token === 'PRODUCTION_ANNULUS'
        || token === 'PROD_ANNULUS'
        || token.includes('TUBING_ANNULUS')
        || token.includes('PRIMARY_ANNULUS')
    ) {
        return NODE_KIND_TUBING_ANNULUS;
    }
    if (
        token === NODE_KIND_LEGACY_BORE
        || token.includes('BORE')
    ) {
        return NODE_KIND_TUBING_INNER;
    }
    if (
        token === NODE_KIND_FORMATION_ANNULUS
        || token === 'FORMATIONANNULUS'
        || token === 'FORMATION'
        || token === 'OPEN_HOLE'
        || token === 'OPENHOLE'
        || token.includes('OPEN_HOLE')
        || token.includes('OPENHOLE')
        || token.includes('FORMATION_ANNULUS')
    ) {
        return NODE_KIND_FORMATION_ANNULUS;
    }
    const modeledAnnulusKind = resolveModeledAnnulusKindFromToken(token);
    if (modeledAnnulusKind) return modeledAnnulusKind;
    return null;
}

export default {
    TOPOLOGY_EPSILON,
    NODE_KIND_SURFACE,
    NODE_KIND_TUBING_INNER,
    NODE_KIND_TUBING_ANNULUS,
    NODE_KIND_LEGACY_BORE,
    NODE_KIND_BORE,
    NODE_KIND_ANNULUS_A,
    NODE_KIND_ANNULUS_B,
    NODE_KIND_ANNULUS_C,
    NODE_KIND_ANNULUS_D,
    NODE_KIND_ANNULUS_E,
    NODE_KIND_ANNULUS_F,
    NODE_KIND_FORMATION_ANNULUS,
    MODELED_CASING_ANNULUS_KINDS,
    MODELED_ANNULUS_VOLUME_SLOTS,
    MODELED_VOLUME_KINDS,
    TOPOLOGY_VOLUME_KINDS,
    MAX_MODELED_ANNULUS_SLOT_INDEX,
    EDGE_KIND_VERTICAL,
    EDGE_KIND_RADIAL,
    EDGE_KIND_TERMINATION,
    TOPOLOGY_CONFIG_USE_ILLUSTRATIVE_FLUID_SOURCE,
    TOPOLOGY_CONFIG_USE_OPEN_HOLE_SOURCE,
    SOURCE_POLICY_MODE_MARKER_DEFAULT,
    SOURCE_POLICY_MODE_FLUID_OPT_IN,
    SOURCE_POLICY_MODE_OPEN_HOLE_OPT_IN,
    SOURCE_POLICY_MODE_SCENARIO_EXPLICIT,
    SOURCE_KIND_PERFORATION,
    SOURCE_KIND_LEAK,
    SOURCE_KIND_FORMATION_INFLOW,
    SOURCE_KIND_SCENARIO,
    isModeledCasingAnnulusKind,
    normalizeWellId,
    normalizeMarkerType,
    normalizeSourceType,
    normalizeSourceVolumeKind
};
