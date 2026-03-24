import { applyTranslations, loadLanguagePreference, onLanguageChange, t } from '@/app/i18n.js';
import { loadSampleData } from '@/app/importWorkflows.js';
import { hasProjectDataContent } from '@/app/projectDataPresence.js';
import {
    applyLanguageUI,
    initializeCementColorSelect,
    syncPlotTitleForLanguage
} from '@/app/languageOrchestration.js';
import { syncSelectionIndicators } from '@/app/selection.js';
import { useProjectStore } from '@/stores/projectStore.js';

const SILENT_SAMPLE_LOAD_OPTIONS = Object.freeze({ silent: true });
const SAMPLE_LOAD_IDLE_TIMEOUT_MS = 350;

function resolveActiveWellData(projectStore) {
    const data = projectStore?.activeWell?.data;
    return data && typeof data === 'object' ? data : null;
}

function hasActiveWellDataRows(projectStore) {
    const activeWellData = resolveActiveWellData(projectStore);
    return hasProjectDataContent(activeWellData);
}

function scheduleDeferredTask(task) {
    if (typeof task !== 'function') return () => {};

    if (typeof requestIdleCallback === 'function') {
        const idleId = requestIdleCallback(task, { timeout: SAMPLE_LOAD_IDLE_TIMEOUT_MS });
        return () => {
            if (typeof cancelIdleCallback === 'function') {
                cancelIdleCallback(idleId);
            }
        };
    }

    const timeoutId = setTimeout(task, 0);
    return () => {
        clearTimeout(timeoutId);
    };
}

/**
 * Shared application bootstrap used by the Vue entry.
 * Keeps initialization behavior in one place for app startup.
 */
export function bootstrapApplication(viewConfigStore, interactionStore) {
    const projectStore = useProjectStore();

    loadLanguagePreference();
    applyTranslations();
    syncPlotTitleForLanguage();

    const stopLanguageChange = onLanguageChange(() => applyLanguageUI());

    console.log(t('log.loaded'));
    initializeCementColorSelect();
    viewConfigStore.setViewMode(viewConfigStore.config.viewMode);
    viewConfigStore.setXExaggeration(viewConfigStore.config.xExaggeration);
    viewConfigStore.setIntervalCalloutStandoffPx(viewConfigStore.config.intervalCalloutStandoffPx);
    viewConfigStore.setShowDepthCursor(viewConfigStore.config.showDepthCursor === true);
    viewConfigStore.setDepthCursorDirectionalMode(viewConfigStore.config.depthCursorDirectionalMode);
    viewConfigStore.setMagnifierZoomLevel(viewConfigStore.config.magnifierZoomLevel);
    viewConfigStore.setDirectionalCasingArrowMode(viewConfigStore.config.directionalCasingArrowMode);
    viewConfigStore.syncVerticalSectionControlsFromConfig();
    viewConfigStore.invalidateDirectionalDataAspectRatio();
    viewConfigStore.setDirectionalAutoFitSignature(null);
    viewConfigStore.setLockAspectRatioEnabled(viewConfigStore.config.lockAspectRatio !== false);
    viewConfigStore.reconcileCanvasWidthForCurrentViewMode();

    interactionStore.setAutoGenerate(true);
    projectStore.ensureInitialized();
    let cancelDeferredSampleLoad = null;
    if (!hasActiveWellDataRows(projectStore)) {
        cancelDeferredSampleLoad = scheduleDeferredTask(() => {
            if (hasActiveWellDataRows(projectStore)) return;
            loadSampleData(SILENT_SAMPLE_LOAD_OPTIONS);
            projectStore.syncActiveWellData();
            syncSelectionIndicators();
        });
    }

    return () => {
        stopLanguageChange?.();
        cancelDeferredSampleLoad?.();
        cancelDeferredSampleLoad = null;
    };
}
