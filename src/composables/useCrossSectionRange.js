import * as Physics from '@/composables/usePhysics.js';

const EPSILON = 1e-6;

export function getCrossSectionDepthRange(context) {
    const criticalDepths = Physics.getCriticalDepths(context).filter(Number.isFinite);
    if (criticalDepths.length === 0) return null;

    const minDepth = Math.min(...criticalDepths);
    const maxDepth = Math.max(...criticalDepths);
    if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth)) return null;

    if (maxDepth <= minDepth + EPSILON) {
        return { minDepth, maxDepth: minDepth + 1 };
    }
    return { minDepth, maxDepth };
}

export function resolveCrossSectionSliderStep(range) {
    if (!Number.isFinite(range) || range <= 0) return 0.1;
    if (range <= 20) return 0.01;
    if (range <= 500) return 0.05;
    return 0.1;
}

export default {
    getCrossSectionDepthRange,
    resolveCrossSectionSliderStep
};
