export const TOPOLOGY_EPSILON = 1e-6;

export const NODE_KIND_SURFACE = 'SURFACE';
export const NODE_KIND_TUBING_INNER = 'TUBING_INNER';
export const NODE_KIND_TUBING_ANNULUS = 'TUBING_ANNULUS';
export const NODE_KIND_LEGACY_BORE = 'BORE';

// Backward-compatible export alias used by existing modules.
export const NODE_KIND_BORE = NODE_KIND_TUBING_INNER;
export const NODE_KIND_ANNULUS_A = 'ANNULUS_A';
export const NODE_KIND_ANNULUS_B = 'ANNULUS_B';
export const NODE_KIND_ANNULUS_C = 'ANNULUS_C';
export const NODE_KIND_ANNULUS_D = 'ANNULUS_D';
export const NODE_KIND_FORMATION_ANNULUS = 'FORMATION_ANNULUS';

export const MODELED_ANNULUS_VOLUME_SLOTS = Object.freeze([
    Object.freeze({ kind: NODE_KIND_ANNULUS_A, slotIndex: 0, allowFormationRepresentation: true }),
    Object.freeze({ kind: NODE_KIND_ANNULUS_B, slotIndex: 1, allowFormationRepresentation: true }),
    Object.freeze({ kind: NODE_KIND_ANNULUS_C, slotIndex: 2, allowFormationRepresentation: true }),
    Object.freeze({ kind: NODE_KIND_ANNULUS_D, slotIndex: 3, allowFormationRepresentation: false })
]);

export const MODELED_VOLUME_KINDS = Object.freeze([
    NODE_KIND_TUBING_INNER,
    ...MODELED_ANNULUS_VOLUME_SLOTS.map((annulusSlot) => annulusSlot.kind)
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
export const SOURCE_POLICY_MODE_MARKER_DEFAULT = 'marker_default';
export const SOURCE_POLICY_MODE_FLUID_OPT_IN = 'fluid_opt_in';
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
        || token.includes('TUBING_ANNULUS')
    ) {
        return NODE_KIND_ANNULUS_A;
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
        || token.includes('FORMATION_ANNULUS')
    ) {
        return NODE_KIND_FORMATION_ANNULUS;
    }
    if (
        token === NODE_KIND_ANNULUS_A
        || token === 'ANNULUSA'
        || token === 'A_ANNULUS'
        || token === 'A_ANNULUS_A'
        || token.includes('ANNULUS_A')
    ) {
        return NODE_KIND_ANNULUS_A;
    }
    if (
        token === NODE_KIND_ANNULUS_B
        || token === 'ANNULUSB'
        || token === 'B_ANNULUS'
        || token === 'B_ANNULUS_B'
        || token.includes('ANNULUS_B')
    ) {
        return NODE_KIND_ANNULUS_B;
    }
    if (
        token === NODE_KIND_ANNULUS_C
        || token === 'ANNULUSC'
        || token === 'C_ANNULUS'
        || token === 'C_ANNULUS_C'
        || token.includes('ANNULUS_C')
    ) {
        return NODE_KIND_ANNULUS_C;
    }
    if (
        token === NODE_KIND_ANNULUS_D
        || token === 'ANNULUSD'
        || token === 'D_ANNULUS'
        || token === 'D_ANNULUS_D'
        || token.includes('ANNULUS_D')
    ) {
        return NODE_KIND_ANNULUS_D;
    }
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
    NODE_KIND_FORMATION_ANNULUS,
    MODELED_ANNULUS_VOLUME_SLOTS,
    MODELED_VOLUME_KINDS,
    TOPOLOGY_VOLUME_KINDS,
    MAX_MODELED_ANNULUS_SLOT_INDEX,
    EDGE_KIND_VERTICAL,
    EDGE_KIND_RADIAL,
    EDGE_KIND_TERMINATION,
    TOPOLOGY_CONFIG_USE_ILLUSTRATIVE_FLUID_SOURCE,
    SOURCE_POLICY_MODE_MARKER_DEFAULT,
    SOURCE_POLICY_MODE_FLUID_OPT_IN,
    SOURCE_POLICY_MODE_SCENARIO_EXPLICIT,
    SOURCE_KIND_PERFORATION,
    SOURCE_KIND_LEAK,
    SOURCE_KIND_FORMATION_INFLOW,
    SOURCE_KIND_SCENARIO,
    normalizeWellId,
    normalizeMarkerType,
    normalizeSourceType,
    normalizeSourceVolumeKind
};
