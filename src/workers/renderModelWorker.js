import * as Physics from '@/physics/physicsCore.js';
import { resolveTrajectoryPointsFromRows } from '@/app/trajectoryMathCore.mjs';

const EPSILON = 1e-6;

function createSafeStateSnapshot(stateSnapshot = {}) {
    const safeState = stateSnapshot && typeof stateSnapshot === 'object' ? stateSnapshot : {};
    const dataArrays = [
        'casingData',
        'tubingData',
        'drillStringData',
        'equipmentData',
        'horizontalLines',
        'annotationBoxes',
        'userAnnotations',
        'cementPlugs',
        'annulusFluids',
        'markers',
        'trajectory'
    ];

    dataArrays.forEach((key) => {
        if (!Array.isArray(safeState[key])) {
            safeState[key] = [];
        }
    });

    if (!safeState.config || typeof safeState.config !== 'object') {
        safeState.config = {};
    }
    if (String(safeState.config.operationPhase ?? '').trim().toLowerCase() !== 'drilling') {
        safeState.config.operationPhase = 'production';
    }
    if (!safeState.interaction || typeof safeState.interaction !== 'object') {
        safeState.interaction = {};
    }

    return safeState;
}

function buildVerticalRenderModel(stateSnapshot = {}) {
    const state = createSafeStateSnapshot(stateSnapshot);
    const physicsContext = Physics.createContext(state);
    const intervals = Physics.getIntervalsWithBoundaryReasons(physicsContext);
    const slices = intervals.map((interval) => ({
        ...interval,
        stack: Physics.getStackAtDepth(interval.midpoint, physicsContext)
    }));

    return {
        physicsContext,
        intervals,
        slices
    };
}

function buildDirectionalIntervals(physicsContext, maxMD) {
    const intervals = Physics.getIntervalsWithBoundaryReasons(physicsContext)
        .map((interval) => {
            const top = Math.max(0, Number(interval?.top));
            const bottom = Math.min(maxMD, Number(interval?.bottom));
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
            const midpoint = (top + bottom) / 2;
            return {
                ...interval,
                top,
                bottom,
                midpoint,
                stack: Physics.getStackAtDepth(midpoint, physicsContext)
            };
        })
        .filter(Boolean);

    if (intervals.length > 0) return intervals;
    if (!Number.isFinite(maxMD) || maxMD <= EPSILON) return [];
    return [{
        top: 0,
        bottom: maxMD,
        midpoint: maxMD / 2,
        startBoundaryReasons: [{ type: 'model', action: 'start', label: '', sourceIndex: null }],
        endBoundaryReasons: [{ type: 'model', action: 'end', label: '', sourceIndex: null }],
        stack: Physics.getStackAtDepth(maxMD / 2, physicsContext)
    }];
}

function buildDirectionalRenderModel(stateSnapshot = {}) {
    const state = createSafeStateSnapshot(stateSnapshot);
    const trajectory = resolveTrajectoryPointsFromRows(state.trajectory, state.config, {
        casingData: state.casingData
    });
    if (trajectory.length < 2) {
        return {
            trajectory: [],
            totalMD: 0,
            physicsContext: null,
            intervals: []
        };
    }

    const totalMD = Number(trajectory[trajectory.length - 1].md);
    const physicsContext = Physics.createContext(state);
    const intervals = buildDirectionalIntervals(physicsContext, totalMD);

    return {
        trajectory,
        totalMD,
        physicsContext,
        intervals
    };
}

self.onmessage = (event) => {
    const message = event?.data || {};
    const requestId = message.requestId;
    const task = String(message.task || '');
    const payload = message.payload || {};

    try {
        if (task === 'build-vertical-render-model') {
            const result = buildVerticalRenderModel(payload.stateSnapshot);
            self.postMessage({ requestId, status: 'success', result });
            return;
        }

        if (task === 'build-directional-render-model') {
            const result = buildDirectionalRenderModel(payload.stateSnapshot);
            self.postMessage({ requestId, status: 'success', result });
            return;
        }

        self.postMessage({
            requestId,
            status: 'error',
            error: `Unknown render-model worker task: ${task}`
        });
    } catch (error) {
        self.postMessage({
            requestId,
            status: 'error',
            error: error?.message || 'Render model worker failed.'
        });
    }
};
