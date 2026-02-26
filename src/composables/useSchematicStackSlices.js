import { computed, unref } from 'vue';
import { createContext, getIntervals, getStackAtDepth } from './usePhysics.js';

const DATA_KEYS = Object.freeze([
    'casingData',
    'tubingData',
    'drillStringData',
    'horizontalLines',
    'annotationBoxes',
    'cementPlugs',
    'annulusFluids',
    'markers',
    'trajectory'
]);

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeStateSnapshot(stateInput = {}) {
    const snapshot = {};
    DATA_KEYS.forEach((key) => {
        snapshot[key] = toArray(stateInput?.[key]);
    });
    snapshot.config = stateInput?.config && typeof stateInput.config === 'object'
        ? stateInput.config
        : {};
    snapshot.interaction = stateInput?.interaction && typeof stateInput.interaction === 'object'
        ? stateInput.interaction
        : {};
    return snapshot;
}

export function createSchematicStackSlices(stateInput = {}) {
    const snapshot = normalizeStateSnapshot(stateInput);
    const context = createContext(snapshot);
    const intervals = getIntervals(context);

    return intervals
        .map((interval) => {
            const top = Number(interval?.top);
            const bottom = Number(interval?.bottom);
            const midpoint = Number(interval?.midpoint);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

            return {
                top,
                bottom,
                midpoint: Number.isFinite(midpoint) ? midpoint : (top + bottom) / 2,
                stack: getStackAtDepth(Number.isFinite(midpoint) ? midpoint : (top + bottom) / 2, context)
            };
        })
        .filter(Boolean);
}

export function useSchematicStackSlices(stateInputRef) {
    const slices = computed(() => createSchematicStackSlices(unref(stateInputRef)));
    return {
        slices
    };
}
