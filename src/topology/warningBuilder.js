import {
    TOPOLOGY_WARNING_CODES,
    createTopologyValidationWarning
} from '@/topology/warningCatalog.js';

const POLICY_WARNING_ILLUSTRATIVE_FLUID_SOURCE_MODE_ENABLED = TOPOLOGY_WARNING_CODES.ILLUSTRATIVE_FLUID_SOURCE_MODE_ENABLED;
const POLICY_WARNING_EXPLICIT_SCENARIO_SOURCE_MODE_ACTIVE = TOPOLOGY_WARNING_CODES.EXPLICIT_SCENARIO_SOURCE_MODE_ACTIVE;

export function buildSourcePolicyWarnings({
    useIllustrativeFluidSource = false,
    hasVisibleFluidRows = false,
    hasExplicitScenarioRows = false
} = {}) {
    const warnings = [];

    if (useIllustrativeFluidSource && !hasExplicitScenarioRows && hasVisibleFluidRows) {
        warnings.push(createTopologyValidationWarning(
            POLICY_WARNING_ILLUSTRATIVE_FLUID_SOURCE_MODE_ENABLED,
            'Illustrative fluid-source mode is enabled. Use marker/open-hole driven scenarios for engineering decisions.'
        ));
    }

    if (hasExplicitScenarioRows) {
        warnings.push(createTopologyValidationWarning(
            POLICY_WARNING_EXPLICIT_SCENARIO_SOURCE_MODE_ACTIVE,
            'Explicit scenario source rows are active. Marker/fluid inferred source fallback is disabled for this topology run.'
        ));
    }

    return warnings;
}

export function buildTopologyValidationWarnings({
    verticalWarnings = [],
    radialWarnings = [],
    explicitWarnings = [],
    fluidWarnings = [],
    sourceResolutionWarnings = [],
    policyWarnings = []
} = {}) {
    return [
        ...(Array.isArray(verticalWarnings) ? verticalWarnings : []),
        ...(Array.isArray(radialWarnings) ? radialWarnings : []),
        ...(Array.isArray(explicitWarnings) ? explicitWarnings : []),
        ...(Array.isArray(fluidWarnings) ? fluidWarnings : []),
        ...(Array.isArray(sourceResolutionWarnings) ? sourceResolutionWarnings : []),
        ...(Array.isArray(policyWarnings) ? policyWarnings : [])
    ];
}

export default {
    buildSourcePolicyWarnings,
    buildTopologyValidationWarnings
};
