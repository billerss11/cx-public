import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { pinia } from '@/stores/pinia.js';
import {
    createContext as createPhysicsContextCore,
    resolveCasingReference as resolveCasingReferenceCore,
    resolveConnections as resolveConnectionsCore,
    resolveHangers as resolveHangersCore,
    isDepthWithinInclusive as isDepthWithinInclusiveCore,
    getCriticalDepths as getCriticalDepthsCore,
    getIntervals as getIntervalsCore,
    getIntervalsWithBoundaryReasons as getIntervalsWithBoundaryReasonsCore,
    getStackAtDepth as getStackAtDepthCore
} from '@/physics/physicsCore.js';

const defaultProjectDataStore = useProjectDataStore(pinia);
const defaultViewConfigStore = useViewConfigStore(pinia);
const defaultInteractionStore = useInteractionStore(pinia);

const defaultPhysicsState = {
    get casingData() {
        return defaultProjectDataStore.casingData ?? [];
    },
    get tubingData() {
        return defaultProjectDataStore.tubingData ?? [];
    },
    get drillStringData() {
        return defaultProjectDataStore.drillStringData ?? [];
    },
    get equipmentData() {
        return defaultProjectDataStore.equipmentData ?? [];
    },
    get horizontalLines() {
        return defaultProjectDataStore.horizontalLines ?? [];
    },
    get annotationBoxes() {
        return defaultProjectDataStore.annotationBoxes ?? [];
    },
    get cementPlugs() {
        return defaultProjectDataStore.cementPlugs ?? [];
    },
    get annulusFluids() {
        return defaultProjectDataStore.annulusFluids ?? [];
    },
    get markers() {
        return defaultProjectDataStore.markers ?? [];
    },
    get trajectory() {
        return defaultProjectDataStore.trajectory ?? [];
    },
    get config() {
        return defaultViewConfigStore.config ?? {};
    },
    get interaction() {
        return defaultInteractionStore.interaction ?? {};
    }
};

export function createContext(state = defaultPhysicsState) {
    return createPhysicsContextCore(state);
}

export function resolveConnections(pipeRows = [], options = {}) {
    return resolveConnectionsCore(pipeRows, options);
}

export function resolveCasingReference(ref, casingRefMap = new Map(), casingRows = [], preferredId = null) {
    return resolveCasingReferenceCore(ref, casingRefMap, casingRows, preferredId);
}

export function resolveHangers(casingRows = [], options = {}) {
    return resolveHangersCore(casingRows, options);
}

export function isDepthWithinInclusive(depth, top, bottom) {
    return isDepthWithinInclusiveCore(depth, top, bottom);
}

export function getCriticalDepths(input = defaultPhysicsState) {
    return getCriticalDepthsCore(input);
}

export function getIntervals(input = defaultPhysicsState) {
    return getIntervalsCore(input);
}

export function getIntervalsWithBoundaryReasons(input = defaultPhysicsState) {
    return getIntervalsWithBoundaryReasonsCore(input);
}

export function getStackAtDepth(depth, input = defaultPhysicsState) {
    return getStackAtDepthCore(depth, input);
}

export function usePhysics(state = defaultPhysicsState) {
    return {
        createContext: (input = state) => createContext(input),
        resolveCasingReference,
        resolveConnections,
        resolveHangers,
        isDepthWithinInclusive,
        getCriticalDepths: (input = state) => getCriticalDepths(input),
        getIntervals: (input = state) => getIntervals(input),
        getIntervalsWithBoundaryReasons: (input = state) => getIntervalsWithBoundaryReasons(input),
        getStackAtDepth: (depth, input = state) => getStackAtDepth(depth, input)
    };
}

export default {
    usePhysics,
    createContext,
    resolveCasingReference,
    resolveConnections,
    resolveHangers,
    isDepthWithinInclusive,
    getCriticalDepths,
    getIntervals,
    getIntervalsWithBoundaryReasons,
    getStackAtDepth
};
