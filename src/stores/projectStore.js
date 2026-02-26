import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import { cloneSnapshot } from '@/utils/general.js';
import { withDefaultPipeComponentType } from '@/utils/pipeRows.js';
import { PROJECT_DATA_KEYS, useProjectDataStore } from '@/stores/projectDataStore.js';
import {
    DEFAULT_X_EXAGGERATION,
    normalizeViewMode,
    normalizeXExaggeration,
    useViewConfigStore
} from '@/stores/viewConfigStore.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { finishEditingAllHotTables } from '@/composables/useHotTableRegistry.js';
import { clearPendingTableRowFocus } from '@/components/tables/panes/tablePaneState.js';
import { clearSelection, hidePlotTooltip, syncSelectionIndicators } from '@/app/selection.js';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';
import {
    PROJECT_SCHEMA_VERSION_V3,
    createEmptyWellData,
    ensureProjectSchemaV3
} from '@/utils/migrations/v2_to_v3.js';
import {
    assertViewConfigOwnershipCoverage,
    composeRuntimeViewConfigForWell,
    createDefaultProjectConfig,
    normalizeProjectUnits,
    splitRuntimeViewConfigByOwnership
} from '@/stores/viewConfigOwnership.js';
import { ensureRowsHaveRowIds } from '@/utils/rowIdentity.js';

assertViewConfigOwnershipCoverage();

let generatedWellCounter = 0;

function createWellId(index = 0) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    generatedWellCounter += 1;
    const safeIndex = Number.isInteger(index) && index >= 0 ? index + 1 : generatedWellCounter;
    return `well-${Date.now()}-${safeIndex}-${generatedWellCounter}`;
}

function toRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeProjectName(value, fallback = 'Project') {
    const projectName = String(value ?? '').trim();
    return projectName || fallback;
}

function normalizeProjectAuthor(value, fallback = '') {
    const author = String(value ?? '').trim();
    if (!author) return fallback;
    return author;
}

function normalizeWellName(value, fallback = 'Well') {
    const name = String(value ?? '').trim();
    return name || fallback;
}

function normalizeProjectFilePath(value) {
    const filePath = String(value ?? '').trim();
    return filePath || '';
}

function normalizeProjectFileName(value, fallback = '') {
    const fileName = String(value ?? '').trim();
    return fileName || fallback;
}

function resolveFileNameFromPath(filePath) {
    const normalizedPath = normalizeProjectFilePath(filePath);
    if (!normalizedPath) return '';
    const segments = normalizedPath.split(/[\\/]/);
    return normalizeProjectFileName(segments[segments.length - 1] ?? '');
}

function normalizeWellData(data = {}) {
    const source = toRecord(data);
    const defaults = createEmptyWellData();
    const normalized = {};

    PROJECT_DATA_KEYS.forEach((key) => {
        const rows = Array.isArray(source[key]) ? source[key] : defaults[key];
        normalized[key] = ensureRowsHaveRowIds(cloneSnapshot(rows), { key });
    });

    normalized.casingData = withDefaultPipeComponentType(normalized.casingData);
    normalized.tubingData = withDefaultPipeComponentType(normalized.tubingData);
    normalized.drillStringData = withDefaultPipeComponentType(normalized.drillStringData);

    return normalized;
}

function normalizeWellConfig(config = {}) {
    const source = toRecord(config);
    const next = { ...source };
    delete next.units;
    return next;
}

function createDefaultWellConfig() {
    return splitRuntimeViewConfigByOwnership(composeRuntimeViewConfigForWell({}, createDefaultProjectConfig())).wellConfig;
}

function createWellRecord(payload = {}, index = 0) {
    const source = toRecord(payload);
    const id = String(source.id ?? '').trim() || createWellId(index);
    const name = normalizeWellName(source.name, `Well ${index + 1}`);
    const data = normalizeWellData(source.data);
    const config = normalizeWellConfig(source.config);
    return { id, name, data, config };
}

export const useProjectStore = defineStore('project', () => {
    const projectDataStore = useProjectDataStore();
    const viewConfigStore = useViewConfigStore();
    const interactionStore = useInteractionStore();

    const state = reactive({
        projectName: 'Project',
        projectAuthor: '',
        projectConfig: createDefaultProjectConfig(),
        wells: [],
        activeWellId: null,
        projectFilePath: null,
        projectFileName: '',
        hasUnsavedChanges: false
    });
    let dirtyTrackingInitialized = false;
    let dirtyTrackingSuspendCount = 0;

    const activeWell = computed(() => {
        if (!Array.isArray(state.wells) || state.wells.length === 0) return null;
        return state.wells.find((well) => well.id === state.activeWellId) ?? state.wells[0] ?? null;
    });

    const wellOptions = computed(() => {
        return state.wells.map((well) => ({
            label: well.name,
            value: well.id
        }));
    });

    const projectFilePath = computed(() => state.projectFilePath);
    const projectFileName = computed(() => state.projectFileName);
    const hasProjectFileTarget = computed(() => Boolean(state.projectFilePath));
    const hasUnsavedChanges = computed(() => state.hasUnsavedChanges === true);

    function findWellById(wellId) {
        const normalizedId = String(wellId ?? '').trim();
        if (!normalizedId) return null;
        return state.wells.find((well) => well.id === normalizedId) ?? null;
    }

    function isWellNameUnique(name, excludeWellId = null) {
        const normalizedName = normalizeWellName(name, '').trim().toLowerCase();
        if (!normalizedName) return false;

        return state.wells.every((well) => {
            if (excludeWellId && well.id === excludeWellId) return true;
            return String(well.name ?? '').trim().toLowerCase() !== normalizedName;
        });
    }

    function isWellIdUnique(id, excludeWellId = null) {
        const normalizedId = String(id ?? '').trim();
        if (!normalizedId) return false;

        return state.wells.every((well) => {
            if (excludeWellId && well.id === excludeWellId) return true;
            return well.id !== normalizedId;
        });
    }

    function createUniqueWellName(baseName = 'Well') {
        const normalizedBase = normalizeWellName(baseName, 'Well');
        if (isWellNameUnique(normalizedBase)) return normalizedBase;

        let suffix = 2;
        let candidate = `${normalizedBase} ${suffix}`;
        while (!isWellNameUnique(candidate)) {
            suffix += 1;
            candidate = `${normalizedBase} ${suffix}`;
        }
        return candidate;
    }

    function validateWellName(name, options = {}) {
        const normalizedName = normalizeWellName(name, '');
        if (!normalizedName) {
            return { ok: false, error: 'empty_name' };
        }
        if (!isWellNameUnique(normalizedName, options.excludeWellId ?? null)) {
            return { ok: false, error: 'duplicate_name' };
        }
        return { ok: true, normalizedName };
    }

    function captureRuntimeWellData() {
        const snapshot = {};
        PROJECT_DATA_KEYS.forEach((key) => {
            snapshot[key] = cloneSnapshot(projectDataStore[key] ?? []);
        });
        return snapshot;
    }

    function isRuntimeWellDataEmpty() {
        return Array.from(PROJECT_DATA_KEYS).every((key) => {
            const rows = projectDataStore[key];
            return !Array.isArray(rows) || rows.length === 0;
        });
    }

    function hydrateRuntimeWellData(data = {}) {
        const normalizedData = normalizeWellData(data);
        PROJECT_DATA_KEYS.forEach((key) => {
            projectDataStore.setProjectData(key, cloneSnapshot(normalizedData[key]));
        });
        projectDataStore.setPhysicsIntervals([]);
    }

    function hydrateRuntimeWellConfig(config = {}) {
        const runtimeConfig = composeRuntimeViewConfigForWell(config, state.projectConfig);

        viewConfigStore.invalidateDirectionalDataAspectRatio();
        viewConfigStore.suppressNextDirectionalAutoFit();
        viewConfigStore.setDirectionalAutoFitSignature(null);
        viewConfigStore.updateConfig(cloneSnapshot(runtimeConfig));
        viewConfigStore.setConfigValue('viewMode', normalizeViewMode(viewConfigStore.config.viewMode));
        viewConfigStore.reconcileCanvasWidthForCurrentViewMode();
        viewConfigStore.setConfigValue(
            'xExaggeration',
            normalizeXExaggeration(viewConfigStore.config.xExaggeration, DEFAULT_X_EXAGGERATION)
        );
        viewConfigStore.setIntervalCalloutStandoffPx(viewConfigStore.config.intervalCalloutStandoffPx);
        viewConfigStore.setConfigValue('lockAspectRatio', viewConfigStore.config.lockAspectRatio !== false);
        viewConfigStore.setShowDepthCursor(viewConfigStore.config.showDepthCursor === true);
        viewConfigStore.setOperationPhase(viewConfigStore.config.operationPhase);
        viewConfigStore.setDepthCursorDirectionalMode(viewConfigStore.config.depthCursorDirectionalMode);
        viewConfigStore.setMagnifierZoomLevel(viewConfigStore.config.magnifierZoomLevel);
        viewConfigStore.setDirectionalCasingArrowMode(viewConfigStore.config.directionalCasingArrowMode);
        viewConfigStore.setAnnotationToolMode(viewConfigStore.config.annotationToolMode);
        viewConfigStore.syncVerticalSectionControlsFromConfig();
    }

    function hydrateRuntimeFromWell(well = null) {
        const targetWell = well ?? activeWell.value;
        if (!targetWell) return false;

        hydrateRuntimeWellData(targetWell.data);
        hydrateRuntimeWellConfig(targetWell.config);
        return true;
    }

    function resetTransientStateForWellSwitch() {
        interactionStore.setSelectedUserAnnotationId(null);
        clearPendingTableRowFocus();
        clearSelection('all', { deferSync: true });
        hidePlotTooltip();
        syncSelectionIndicators();
    }

    function isDirtyTrackingSuspended() {
        return dirtyTrackingSuspendCount > 0;
    }

    function withDirtyTrackingSuspended(callback) {
        dirtyTrackingSuspendCount += 1;
        try {
            return callback();
        } finally {
            dirtyTrackingSuspendCount = Math.max(0, dirtyTrackingSuspendCount - 1);
        }
    }

    function markProjectDirty() {
        if (!dirtyTrackingInitialized || isDirtyTrackingSuspended()) return false;
        if (state.hasUnsavedChanges) return false;
        state.hasUnsavedChanges = true;
        return true;
    }

    function markProjectSaved() {
        if (!state.hasUnsavedChanges) return false;
        state.hasUnsavedChanges = false;
        return true;
    }

    function ensureDirtyTrackingInitialized() {
        if (dirtyTrackingInitialized) return;
        projectDataStore.$subscribe(() => {
            markProjectDirty();
        }, { detached: true });
        viewConfigStore.$subscribe(() => {
            markProjectDirty();
        }, { detached: true });
        dirtyTrackingInitialized = true;
    }

    function ensureInitialized(options = {}) {
        ensureDirtyTrackingInitialized();

        if (state.wells.length > 0) {
            if (!state.activeWellId) {
                state.activeWellId = state.wells[0].id;
            }
            const shouldHydrateExisting = options.forceHydrate === true
                || (options.hydrateIfRuntimeEmpty !== false && isRuntimeWellDataEmpty());
            if (shouldHydrateExisting) {
                withDirtyTrackingSuspended(() => {
                    hydrateRuntimeFromWell();
                });
            }
            return activeWell.value;
        }

        const firstWell = createWellRecord({
            name: normalizeWellName(options.defaultWellName, 'Well 1'),
            data: createEmptyWellData(),
            config: createDefaultWellConfig()
        }, 0);

        state.projectName = normalizeProjectName(options.projectName, 'Project');
        state.projectAuthor = normalizeProjectAuthor(options.projectAuthor, '');
        state.projectConfig = {
            ...createDefaultProjectConfig(),
            defaultUnits: normalizeProjectUnits(options.defaultUnits)
        };
        state.wells = [firstWell];
        state.activeWellId = firstWell.id;

        withDirtyTrackingSuspended(() => {
            hydrateRuntimeFromWell(firstWell);
        });
        state.hasUnsavedChanges = false;
        return firstWell;
    }

    function syncActiveWellData() {
        const currentWell = activeWell.value;
        if (!currentWell) return false;

        const runtimeData = captureRuntimeWellData();
        const {
            wellConfig,
            projectConfig
        } = splitRuntimeViewConfigByOwnership(cloneSnapshot(viewConfigStore.config));

        currentWell.data = runtimeData;
        currentWell.config = normalizeWellConfig(wellConfig);
        state.projectConfig = {
            ...createDefaultProjectConfig(),
            ...state.projectConfig,
            ...projectConfig,
            defaultUnits: normalizeProjectUnits(projectConfig.defaultUnits ?? state.projectConfig.defaultUnits)
        };
        return true;
    }

    function loadProject(payloadV3) {
        ensureDirtyTrackingInitialized();
        const normalized = ensureProjectSchemaV3(payloadV3);

        withDirtyTrackingSuspended(() => {
            finishEditingAllHotTables();
            resetTransientStateForWellSwitch();

            state.projectName = normalizeProjectName(normalized.projectName, 'Project');
            state.projectAuthor = normalizeProjectAuthor(normalized.projectAuthor, '');
            state.projectConfig = {
                ...createDefaultProjectConfig(),
                ...normalized.projectConfig,
                defaultUnits: normalizeProjectUnits(normalized?.projectConfig?.defaultUnits)
            };
            const usedWellIds = new Set();
            state.wells = normalized.wells.map((well, index) => {
                const nextRecord = createWellRecord(well, index);
                while (usedWellIds.has(nextRecord.id)) {
                    nextRecord.id = createWellId(index);
                }
                usedWellIds.add(nextRecord.id);
                return nextRecord;
            });
            state.activeWellId = normalized.activeWellId;

            if (!findWellById(state.activeWellId) && state.wells.length > 0) {
                state.activeWellId = state.wells[0].id;
            }
            hydrateRuntimeFromWell();
        });
        state.hasUnsavedChanges = false;
        requestSchematicRender({ immediate: true });
        return true;
    }

    function setProjectName(name) {
        const nextName = normalizeProjectName(name, state.projectName || 'Project');
        if (nextName === state.projectName) return false;
        state.projectName = nextName;
        markProjectDirty();
        return true;
    }

    function setProjectAuthor(author) {
        const nextAuthor = normalizeProjectAuthor(author, '');
        if (nextAuthor === state.projectAuthor) return false;
        state.projectAuthor = nextAuthor;
        markProjectDirty();
        return true;
    }

    function setProjectFileContext(fileContext = {}) {
        const filePath = normalizeProjectFilePath(fileContext.filePath);
        const explicitName = normalizeProjectFileName(fileContext.fileName);
        const fileName = explicitName || resolveFileNameFromPath(filePath);

        state.projectFilePath = filePath || null;
        state.projectFileName = fileName;
        return filePath.length > 0;
    }

    function clearProjectFileContext() {
        state.projectFilePath = null;
        state.projectFileName = '';
    }

    function setActiveWell(wellId) {
        const nextWell = findWellById(wellId);
        if (!nextWell) return false;
        if (state.activeWellId === nextWell.id) return false;

        withDirtyTrackingSuspended(() => {
            finishEditingAllHotTables();
            syncActiveWellData();
            resetTransientStateForWellSwitch();

            state.activeWellId = nextWell.id;
            hydrateRuntimeFromWell(nextWell);
        });
        requestSchematicRender({ immediate: true });
        return true;
    }

    function appendWell(wellPayload = {}, options = {}) {
        ensureDirtyTrackingInitialized();
        const nextRecord = createWellRecord({
            ...wellPayload,
            name: normalizeWellName(
                wellPayload.name,
                `Well ${state.wells.length + 1}`
            )
        }, state.wells.length);

        if (options.ensureUniqueName === true) {
            nextRecord.name = createUniqueWellName(nextRecord.name);
        }

        while (!isWellIdUnique(nextRecord.id)) {
            nextRecord.id = createWellId(state.wells.length);
        }

        state.wells = [...state.wells, nextRecord];

        if (!state.activeWellId) {
            withDirtyTrackingSuspended(() => {
                state.activeWellId = nextRecord.id;
                hydrateRuntimeFromWell(nextRecord);
            });
        }

        if (options.activate === true) {
            setActiveWell(nextRecord.id);
        }

        markProjectDirty();
        return nextRecord.id;
    }

    function createNewWell(name) {
        ensureInitialized();
        const nameValidation = validateWellName(name);
        if (!nameValidation.ok) return nameValidation;

        finishEditingAllHotTables();
        syncActiveWellData();

        const wellId = appendWell({
            name: nameValidation.normalizedName,
            data: createEmptyWellData(),
            config: createDefaultWellConfig()
        }, { activate: false });

        setActiveWell(wellId);
        return { ok: true, wellId };
    }

    function duplicateWell(sourceWellId, options = {}) {
        ensureInitialized();
        const sourceId = String(sourceWellId ?? state.activeWellId ?? '').trim();
        const sourceWell = findWellById(sourceId);
        if (!sourceWell) {
            return { ok: false, error: 'well_not_found' };
        }

        finishEditingAllHotTables();
        syncActiveWellData();

        const sourceSnapshot = findWellById(sourceWell.id) ?? sourceWell;
        const duplicateBaseName = `${normalizeWellName(sourceSnapshot?.name, 'Well')} Copy`;
        const duplicateWellId = appendWell({
            name: duplicateBaseName,
            data: cloneSnapshot(sourceSnapshot?.data ?? createEmptyWellData()),
            config: cloneSnapshot(sourceSnapshot?.config ?? createDefaultWellConfig())
        }, { activate: false, ensureUniqueName: true });
        if (!duplicateWellId) {
            return { ok: false, error: 'append_failed' };
        }

        const shouldActivateDuplicate = options.activate !== false;
        if (shouldActivateDuplicate) {
            setActiveWell(duplicateWellId);
        }

        const duplicatedWell = findWellById(duplicateWellId);
        return {
            ok: true,
            sourceWellId: sourceWell.id,
            wellId: duplicateWellId,
            name: String(duplicatedWell?.name ?? duplicateBaseName)
        };
    }

    function deleteWell(wellId, options = {}) {
        ensureInitialized();
        const targetWellId = String(wellId ?? state.activeWellId ?? '').trim();
        const targetWell = findWellById(targetWellId);
        if (!targetWell) {
            return { ok: false, error: 'well_not_found' };
        }
        if (state.wells.length <= 1) {
            return { ok: false, error: 'last_well' };
        }

        const targetIndex = state.wells.findIndex((well) => well.id === targetWell.id);
        if (targetIndex < 0) {
            return { ok: false, error: 'well_not_found' };
        }

        const deletingActiveWell = state.activeWellId === targetWell.id;
        finishEditingAllHotTables();
        syncActiveWellData();

        if (deletingActiveWell) {
            withDirtyTrackingSuspended(() => {
                resetTransientStateForWellSwitch();
                const remainingWells = state.wells.filter((well) => well.id !== targetWell.id);
                state.wells = remainingWells;

                const fallbackIndex = Math.min(targetIndex, remainingWells.length - 1);
                const nextActiveWell = remainingWells[fallbackIndex] ?? remainingWells[0] ?? null;
                state.activeWellId = nextActiveWell?.id ?? null;
                if (nextActiveWell) {
                    hydrateRuntimeFromWell(nextActiveWell);
                }
            });
            requestSchematicRender({ immediate: true });
        } else {
            state.wells = state.wells.filter((well) => well.id !== targetWell.id);
            if (!findWellById(state.activeWellId) && state.wells.length > 0) {
                withDirtyTrackingSuspended(() => {
                    state.activeWellId = state.wells[0].id;
                    hydrateRuntimeFromWell(state.wells[0]);
                });
                requestSchematicRender({ immediate: true });
            }
        }

        if (options.markDirty !== false) {
            markProjectDirty();
        }

        return {
            ok: true,
            deletedWellId: targetWell.id,
            deletedWellName: String(targetWell.name ?? ''),
            activeWellId: state.activeWellId
        };
    }

    function renameWell(wellId, name) {
        ensureInitialized();
        const targetWell = findWellById(wellId);
        if (!targetWell) {
            return { ok: false, error: 'well_not_found' };
        }

        const nameValidation = validateWellName(name, { excludeWellId: targetWell.id });
        if (!nameValidation.ok) return nameValidation;

        if (targetWell.name === nameValidation.normalizedName) {
            return { ok: true, changed: false };
        }

        targetWell.name = nameValidation.normalizedName;
        markProjectDirty();
        return { ok: true, changed: true };
    }

    function replaceActiveWellContent(payload = {}, options = {}) {
        ensureInitialized();
        const currentWell = activeWell.value;
        if (!currentWell) return false;

        const data = normalizeWellData(payload.data);
        const config = normalizeWellConfig(payload.config);

        finishEditingAllHotTables();
        resetTransientStateForWellSwitch();
        hydrateRuntimeWellData(data);
        hydrateRuntimeWellConfig(config);
        syncActiveWellData();

        if (options.requestRender !== false) {
            requestSchematicRender({ immediate: true });
        }
        return true;
    }

    function serializeProjectPayload(options = {}) {
        ensureInitialized();

        const timestamp = String(options.timestamp ?? '').trim() || new Date().toISOString();
        const payloadWells = state.wells.map((well, index) => createWellRecord(well, index));
        const activeId = findWellById(state.activeWellId)?.id ?? payloadWells[0]?.id ?? null;

        return {
            projectSchemaVersion: PROJECT_SCHEMA_VERSION_V3,
            projectName: normalizeProjectName(state.projectName, 'Project'),
            projectAuthor: normalizeProjectAuthor(state.projectAuthor, ''),
            activeWellId: activeId,
            projectConfig: {
                ...createDefaultProjectConfig(),
                ...cloneSnapshot(state.projectConfig),
                defaultUnits: normalizeProjectUnits(state?.projectConfig?.defaultUnits)
            },
            wells: payloadWells,
            meta: {
                schemaVersion: PROJECT_SCHEMA_VERSION_V3,
                timestamp,
                source: 'CasingSchematicPlotter',
                author: normalizeProjectAuthor(state.projectAuthor, '')
            }
        };
    }

    return {
        projectName: computed(() => state.projectName),
        projectAuthor: computed(() => state.projectAuthor),
        projectConfig: computed(() => state.projectConfig),
        wells: computed(() => state.wells),
        activeWellId: computed(() => state.activeWellId),
        projectFilePath,
        projectFileName,
        hasProjectFileTarget,
        hasUnsavedChanges,
        activeWell,
        wellOptions,
        ensureInitialized,
        isWellNameUnique,
        createUniqueWellName,
        appendWell,
        setProjectAuthor,
        setProjectName,
        setProjectFileContext,
        clearProjectFileContext,
        markProjectSaved,
        loadProject,
        setActiveWell,
        syncActiveWellData,
        createNewWell,
        duplicateWell,
        deleteWell,
        renameWell,
        replaceActiveWellContent,
        serializeProjectPayload
    };
});
