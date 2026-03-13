import {
    TOPOLOGY_WARNING_CODES,
    createTopologyValidationWarning
} from '@/topology/warningCatalog.js';

const POLICY_WARNING_ILLUSTRATIVE_FLUID_SOURCE_MODE_ENABLED = TOPOLOGY_WARNING_CODES.ILLUSTRATIVE_FLUID_SOURCE_MODE_ENABLED;

export function buildSourcePolicyWarnings({
    useIllustrativeFluidSource = false,
    hasVisibleFluidRows = false,
    hasManualOverrideSources = false
} = {}) {
    const warnings = [];

    if (useIllustrativeFluidSource && !hasManualOverrideSources && hasVisibleFluidRows) {
        warnings.push(createTopologyValidationWarning(
            POLICY_WARNING_ILLUSTRATIVE_FLUID_SOURCE_MODE_ENABLED,
            'Illustrative fluid-source mode is enabled. Use marker/open-hole driven scenarios for engineering decisions.'
        ));
    }

    return warnings;
}

export function buildTopologyValidationWarnings({
    verticalWarnings = [],
    radialWarnings = [],
    surfaceWarnings = [],
    terminationWarnings = [],
    explicitWarnings = [],
    fluidWarnings = [],
    sourceResolutionWarnings = [],
    policyWarnings = []
} = {}) {
    return [
        ...(Array.isArray(verticalWarnings) ? verticalWarnings : []),
        ...(Array.isArray(radialWarnings) ? radialWarnings : []),
        ...(Array.isArray(surfaceWarnings) ? surfaceWarnings : []),
        ...(Array.isArray(terminationWarnings) ? terminationWarnings : []),
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
