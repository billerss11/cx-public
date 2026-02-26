import { defineStore, storeToRefs } from 'pinia';
import { reactive, toRaw } from 'vue';
import {
    PROJECT_DATA_KEYS,
    createDefaultProjectDataState,
    useProjectDataStore
} from './projectDataStore.js';
import { createDefaultViewConfig, useViewConfigStore } from './viewConfigStore.js';
import { createDefaultInteractionState, useInteractionStore } from './interactionStore.js';
import { usePlotElementsStore } from './plotElementsStore.js';
import { cloneSnapshot } from '@/utils/general.js';

function splitPath(path) {
    if (typeof path !== 'string') return [];
    return path
        .split('.')
        .map((segment) => segment.trim())
        .filter(Boolean);
}

function getValueByPath(state, path) {
    return splitPath(path).reduce((current, key) => {
        if (current === null || current === undefined) return undefined;
        return current[key];
    }, state);
}

function getTargetByPath(state, path, options = {}) {
    const segments = splitPath(path);
    if (segments.length === 0) return null;

    const key = segments.pop();
    let target = state;

    for (const segment of segments) {
        if (target === null || target === undefined || typeof target !== 'object') {
            return null;
        }

        if (!(segment in target)) {
            if (!options.createMissing) {
                return null;
            }
            target[segment] = {};
        }

        target = target[segment];
    }

    if (target === null || target === undefined || typeof target !== 'object') {
        return null;
    }

    return { target, key };
}

export function createInitialAppState() {
    return {
        ...createDefaultProjectDataState(),
        config: createDefaultViewConfig(),
        interaction: createDefaultInteractionState()
    };
}

export const useMainStore = defineStore('main', () => {
    const projectDataStore = useProjectDataStore();
    const viewConfigStore = useViewConfigStore();
    const interactionStore = useInteractionStore();
    const plotElementsStore = usePlotElementsStore();

    const projectDataRefs = storeToRefs(projectDataStore);
    const viewConfigRefs = storeToRefs(viewConfigStore);
    const interactionRefs = storeToRefs(interactionStore);

    const stateRefs = {
        casingData: projectDataRefs.casingData,
        tubingData: projectDataRefs.tubingData,
        drillStringData: projectDataRefs.drillStringData,
        equipmentData: projectDataRefs.equipmentData,
        horizontalLines: projectDataRefs.horizontalLines,
        annotationBoxes: projectDataRefs.annotationBoxes,
        userAnnotations: projectDataRefs.userAnnotations,
        cementPlugs: projectDataRefs.cementPlugs,
        annulusFluids: projectDataRefs.annulusFluids,
        markers: projectDataRefs.markers,
        topologySources: projectDataRefs.topologySources,
        physicsIntervals: projectDataRefs.physicsIntervals,
        trajectory: projectDataRefs.trajectory,
        config: viewConfigRefs.config,
        interaction: interactionRefs.interaction
    };

    const stateTree = reactive({
        casingData: stateRefs.casingData,
        tubingData: stateRefs.tubingData,
        drillStringData: stateRefs.drillStringData,
        equipmentData: stateRefs.equipmentData,
        horizontalLines: stateRefs.horizontalLines,
        annotationBoxes: stateRefs.annotationBoxes,
        userAnnotations: stateRefs.userAnnotations,
        cementPlugs: stateRefs.cementPlugs,
        annulusFluids: stateRefs.annulusFluids,
        markers: stateRefs.markers,
        topologySources: stateRefs.topologySources,
        physicsIntervals: stateRefs.physicsIntervals,
        trajectory: stateRefs.trajectory,
        config: stateRefs.config,
        interaction: stateRefs.interaction
    });
    const listeners = new Set();

    function buildRawStateSnapshot() {
        return {
            casingData: toRaw(stateRefs.casingData.value),
            tubingData: toRaw(stateRefs.tubingData.value),
            drillStringData: toRaw(stateRefs.drillStringData.value),
            equipmentData: toRaw(stateRefs.equipmentData.value),
            horizontalLines: toRaw(stateRefs.horizontalLines.value),
            annotationBoxes: toRaw(stateRefs.annotationBoxes.value),
            userAnnotations: toRaw(stateRefs.userAnnotations.value),
            cementPlugs: toRaw(stateRefs.cementPlugs.value),
            annulusFluids: toRaw(stateRefs.annulusFluids.value),
            markers: toRaw(stateRefs.markers.value),
            topologySources: toRaw(stateRefs.topologySources.value),
            physicsIntervals: toRaw(stateRefs.physicsIntervals.value),
            trajectory: toRaw(stateRefs.trajectory.value),
            config: toRaw(stateRefs.config.value),
            interaction: toRaw(stateRefs.interaction.value)
        };
    }

    function notify(meta = {}) {
        if (listeners.size === 0) return;
        const snapshot = buildRawStateSnapshot();
        listeners.forEach((listener) => listener(snapshot, meta));
    }

    function getReactiveState() {
        return stateTree;
    }

    function getExportSnapshot() {
        return cloneSnapshot(buildRawStateSnapshot());
    }

    function getState() {
        return getReactiveState();
    }

    function getByPath(path, fallback = undefined) {
        const value = getValueByPath(stateTree, path);
        return value === undefined ? fallback : value;
    }

    function setByPath(path, value, options = {}) {
        const resolved = getTargetByPath(stateTree, path, { createMissing: true });
        if (!resolved) return false;

        const { target, key } = resolved;
        if (Object.is(target[key], value)) return false;

        target[key] = value;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setByPath',
                path,
                section: splitPath(path)[0] ?? null,
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function setData(key, value, options = {}) {
        if (!key) return false;

        if (!PROJECT_DATA_KEYS.has(key)) {
            return setByPath(key, value, {
                ...options,
                type: options.type ?? 'setData'
            });
        }

        let changed = false;
        if (key === 'casingData') changed = projectDataStore.setCasingData(value);
        else if (key === 'tubingData') changed = projectDataStore.setTubingData(value);
        else if (key === 'drillStringData') changed = projectDataStore.setDrillStringData(value);
        else if (key === 'equipmentData') changed = projectDataStore.setEquipmentData(value);
        else if (key === 'horizontalLines') changed = projectDataStore.setHorizontalLines(value);
        else if (key === 'annotationBoxes') changed = projectDataStore.setAnnotationBoxes(value);
        else if (key === 'userAnnotations') changed = projectDataStore.setUserAnnotations(value);
        else if (key === 'cementPlugs') changed = projectDataStore.setCementPlugs(value);
        else if (key === 'annulusFluids') changed = projectDataStore.setAnnulusFluids(value);
        else if (key === 'markers') changed = projectDataStore.setMarkers(value);
        else if (key === 'topologySources') changed = projectDataStore.setTopologySources(value);
        else if (key === 'trajectory') changed = projectDataStore.setTrajectory(value);
        else changed = projectDataStore.setProjectData(key, value);

        if (!changed) return false;

        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setData',
                path: key,
                section: key,
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function setCasingData(rows, options = {}) {
        return setData('casingData', rows, { source: options.source ?? 'store', ...options });
    }

    function setTubingData(rows, options = {}) {
        return setData('tubingData', rows, { source: options.source ?? 'store', ...options });
    }

    function setDrillStringData(rows, options = {}) {
        return setData('drillStringData', rows, { source: options.source ?? 'store', ...options });
    }

    function setEquipmentData(rows, options = {}) {
        return setData('equipmentData', rows, { source: options.source ?? 'store', ...options });
    }

    function setHorizontalLines(rows, options = {}) {
        return setData('horizontalLines', rows, { source: options.source ?? 'store', ...options });
    }

    function setAnnotationBoxes(rows, options = {}) {
        return setData('annotationBoxes', rows, { source: options.source ?? 'store', ...options });
    }

    function setUserAnnotations(rows, options = {}) {
        return setData('userAnnotations', rows, { source: options.source ?? 'store', ...options });
    }

    function setCementPlugs(rows, options = {}) {
        return setData('cementPlugs', rows, { source: options.source ?? 'store', ...options });
    }

    function setAnnulusFluids(rows, options = {}) {
        return setData('annulusFluids', rows, { source: options.source ?? 'store', ...options });
    }

    function setMarkers(rows, options = {}) {
        return setData('markers', rows, { source: options.source ?? 'store', ...options });
    }

    function setTopologySources(rows, options = {}) {
        return setData('topologySources', rows, { source: options.source ?? 'store', ...options });
    }

    function setTrajectory(rows, options = {}) {
        return setData('trajectory', rows, { source: options.source ?? 'store', ...options });
    }

    function updateRow(key, index, patch, options = {}) {
        if (!key || !Number.isInteger(index)) return false;

        const changed = projectDataStore.updateProjectRow(key, index, patch);
        if (!changed) return false;

        if (options.silent !== true) {
            notify({
                type: options.type ?? 'updateRow',
                section: key,
                path: key,
                index,
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function setPhysicsIntervals(intervals, options = {}) {
        const changed = projectDataStore.setPhysicsIntervals(intervals);
        if (!changed) return false;

        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setPhysicsIntervals',
                section: 'physicsIntervals',
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function setConfigValue(key, value, options = {}) {
        if (!key) return false;

        const changed = viewConfigStore.setConfigValue(key, value);
        if (!changed) return false;

        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: `config.${key}`,
                keys: [key],
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function setColorPalette(value, options = {}) {
        const changed = viewConfigStore.setColorPalette(value);
        if (!changed) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: 'config.colorPalette',
                keys: ['colorPalette'],
                source: options.source ?? 'store'
            });
        }
        return true;
    }

    function setShowCement(value, options = {}) {
        const changed = viewConfigStore.setShowCement(value);
        if (!changed) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: 'config.showCement',
                keys: ['showCement'],
                source: options.source ?? 'store'
            });
        }
        return true;
    }

    function setShowDepthCrossSection(value, options = {}) {
        const changed = viewConfigStore.setShowDepthCrossSection(value);
        if (!changed) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: 'config.showDepthCrossSection',
                keys: ['showDepthCrossSection'],
                source: options.source ?? 'store'
            });
        }
        return true;
    }

    function setCursorDepth(value, options = {}) {
        const changed = viewConfigStore.setCursorDepth(value);
        if (!changed) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: 'config.cursorDepth',
                keys: ['cursorDepth'],
                source: options.source ?? 'store'
            });
        }
        return true;
    }

    function setShowPhysicsDebug(value, options = {}) {
        const changed = viewConfigStore.setShowPhysicsDebug(value);
        if (!changed) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: 'config.showPhysicsDebug',
                keys: ['showPhysicsDebug'],
                source: options.source ?? 'store'
            });
        }
        return true;
    }

    function setCementColor(value, options = {}) {
        const changed = viewConfigStore.setCementColor(value);
        if (!changed) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: 'config.cementColor',
                keys: ['cementColor'],
                source: options.source ?? 'store'
            });
        }
        return true;
    }

    function setCementHatchEnabled(value, options = {}) {
        const changed = viewConfigStore.setCementHatchEnabled(value);
        if (!changed) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: 'config.cementHatchEnabled',
                keys: ['cementHatchEnabled'],
                source: options.source ?? 'store'
            });
        }
        return true;
    }

    function setCementHatchStyle(value, options = {}) {
        const changed = viewConfigStore.setCementHatchStyle(value);
        if (!changed) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setConfigValue',
                section: 'config',
                path: 'config.cementHatchStyle',
                keys: ['cementHatchStyle'],
                source: options.source ?? 'store'
            });
        }
        return true;
    }

    function updateConfig(patch, options = {}) {
        const changedKeys = viewConfigStore.updateConfig(patch);

        if (changedKeys.length === 0) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'updateConfig',
                section: 'config',
                keys: changedKeys,
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function setInteractionValue(key, value, options = {}) {
        if (!key) return false;

        const changed = interactionStore.setInteractionValue(key, value);
        if (!changed) return false;

        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setInteractionValue',
                section: 'interaction',
                path: `interaction.${key}`,
                keys: [key],
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function setAutoGenerate(value, options = {}) {
        const changed = interactionStore.setAutoGenerate(value);
        if (!changed) return false;

        if (options.silent !== true) {
            notify({
                type: options.type ?? 'setInteractionValue',
                section: 'interaction',
                path: 'interaction.autoGenerate',
                keys: ['autoGenerate'],
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function updateInteraction(patch, options = {}) {
        const changedKeys = interactionStore.updateInteraction(patch);

        if (changedKeys.length === 0) return false;
        if (options.silent !== true) {
            notify({
                type: options.type ?? 'updateInteraction',
                section: 'interaction',
                keys: changedKeys,
                source: options.source ?? 'store'
            });
        }

        return true;
    }

    function subscribe(callback) {
        if (typeof callback !== 'function') return () => {};
        listeners.add(callback);
        return () => listeners.delete(callback);
    }

    function setPlotElement(key, element) {
        plotElementsStore.setPlotElement(key, element ?? null);
    }

    function getPlotElement(key) {
        return plotElementsStore.getPlotElement(key);
    }

    return {
        ...stateRefs,
        getReactiveState,
        getState,
        getExportSnapshot,
        getByPath,
        setByPath,
        setData,
        setCasingData,
        setTubingData,
        setDrillStringData,
        setEquipmentData,
        setHorizontalLines,
        setAnnotationBoxes,
        setUserAnnotations,
        setCementPlugs,
        setAnnulusFluids,
        setMarkers,
        setTopologySources,
        setTrajectory,
        updateRow,
        setPhysicsIntervals,
        setColorPalette,
        setShowCement,
        setShowDepthCrossSection,
        setCursorDepth,
        setShowPhysicsDebug,
        setCementColor,
        setCementHatchEnabled,
        setCementHatchStyle,
        setConfigValue,
        updateConfig,
        setAutoGenerate,
        setInteractionValue,
        updateInteraction,
        notify,
        subscribe,
        setPlotElement,
        getPlotElement
    };
});
