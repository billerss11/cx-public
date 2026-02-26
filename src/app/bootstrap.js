import { applyTranslations, loadLanguagePreference, onLanguageChange, t } from '@/app/i18n.js';
import { loadSampleData } from '@/app/importWorkflows.js';
import {
    applyLanguageUI,
    initializeCementColorSelect,
    syncPlotTitleForLanguage
} from '@/app/languageOrchestration.js';
import { syncSelectionIndicators } from '@/app/selection.js';
import { useProjectStore } from '@/stores/projectStore.js';

/**
 * Shared bootstrap for both Vue entry and legacy lifecycle shim.
 * Keeps initialization behavior in one place during hold-point migration.
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
    loadSampleData({ silent: true });
    projectStore.syncActiveWellData();
    syncSelectionIndicators();

    return () => {
        stopLanguageChange?.();
    };
}
