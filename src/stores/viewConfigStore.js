import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { parseOptionalNumber } from '@/utils/general.js';
import {
    USER_ANNOTATION_TOOL_MODE_ADD,
    USER_ANNOTATION_TOOL_MODE_SELECT
} from '@/utils/userAnnotations.js';
import {
    PHYSICS_CONSTANTS,
    LAYOUT_CONSTANTS,
    DEFAULT_MAGNIFIER_ZOOM_LEVEL,
    DEFAULT_VERTICAL_SECTION_MODE,
    DEFAULT_VERTICAL_SECTION_AZIMUTH,
    normalizeMagnifierZoomLevel
} from '@/constants/index.js';
import {
    DIRECTIONAL_MIN_FIGURE_HEIGHT,
    resolveDirectionalFigureHeightFromWidth,
    resolveDirectionalSvgWidthFromHeight,
    resolveDirectionalSvgWidthFromMultiplier,
    resolveDirectionalWidthMultiplierFromSvgWidth
} from '@/utils/directionalSizing.js';

const MIN_CANVAS_WIDTH_MULTIPLIER = 0.1;
const DEFAULT_CANVAS_WIDTH_MULTIPLIER = 1.0;
const DIRECTIONAL_DEFAULT_CANVAS_WIDTH_MULTIPLIER = 0.8;
const CANVAS_WIDTH_DEFAULT_EPSILON = 1e-6;
const MIN_X_EXAGGERATION = 0.1;
const MAX_X_EXAGGERATION = 1.0;
export const DEFAULT_X_EXAGGERATION = 1.0;
const MIN_INTERVAL_CALLOUT_STANDOFF_PX = LAYOUT_CONSTANTS.INTERVAL_CALLOUT_GLOBAL_STANDOFF_MIN_PX;
const MAX_INTERVAL_CALLOUT_STANDOFF_PX = LAYOUT_CONSTANTS.INTERVAL_CALLOUT_GLOBAL_STANDOFF_MAX_PX;
const DEFAULT_INTERVAL_CALLOUT_STANDOFF_PX = LAYOUT_CONSTANTS.INTERVAL_CALLOUT_GLOBAL_STANDOFF_DEFAULT_PX;
const DIRECTIONAL_CASING_ARROW_MODE_NORMAL_LOCKED = 'normal-locked';
const DIRECTIONAL_CASING_ARROW_MODE_DIRECT_TO_ANCHOR = 'direct-to-anchor';
const DEPTH_CURSOR_DIRECTIONAL_MODE_TVD = 'tvd';
const DEPTH_CURSOR_DIRECTIONAL_MODE_MD = 'md';
const OPERATION_PHASE_PRODUCTION = 'production';
const OPERATION_PHASE_DRILLING = 'drilling';

const VERTICAL_SECTION_PRESETS = Object.freeze({
    north: 0,
    east: 90
});
const VERTICAL_SECTION_PRESET_TOLERANCE = 0.05;
const VERTICAL_SECTION_MODE_AUTO = DEFAULT_VERTICAL_SECTION_MODE;
const VERTICAL_SECTION_MODE_MANUAL = 'manual';

export function createDefaultViewConfig() {
    return {
        units: 'ft',
        operationPhase: OPERATION_PHASE_PRODUCTION,
        datumDepth: null,
        colorPalette: 'Tableau 10',
        showCement: true,
        showDepthCrossSection: false,
        cursorDepth: null,
        showDepthCursor: false,
        showMagnifier: false,
        magnifierZoomLevel: DEFAULT_MAGNIFIER_ZOOM_LEVEL,
        depthCursorDirectionalMode: DEPTH_CURSOR_DIRECTIONAL_MODE_TVD,
        showPhysicsDebug: false,
        cementColor: 'lightgray',
        cementHatchEnabled: false,
        cementHatchStyle: 'none',
        plotTitle: '',
        figHeight: 800,
        widthMultiplier: 3.5,
        canvasWidthMultiplier: 1.0,
        lockAspectRatio: true,
        viewMode: 'vertical',
        annotationToolMode: USER_ANNOTATION_TOOL_MODE_SELECT,
        xExaggeration: 1.0,
        intervalCalloutStandoffPx: DEFAULT_INTERVAL_CALLOUT_STANDOFF_PX,
        directionalCasingArrowMode: DIRECTIONAL_CASING_ARROW_MODE_NORMAL_LOCKED,
        verticalSectionMode: DEFAULT_VERTICAL_SECTION_MODE,
        verticalSectionAzimuth: DEFAULT_VERTICAL_SECTION_AZIMUTH,
        crossoverEpsilon: PHYSICS_CONSTANTS.DEFAULT_CROSSOVER_EPSILON,
        crossoverPixelHalfHeight: 5
    };
}

const SUPPORTED_VIEW_CONFIG_KEYS = new Set(Object.keys(createDefaultViewConfig()));

function normalizeDepthCursorDirectionalMode(value) {
    const token = String(value ?? '').trim().toLowerCase();
    return token === DEPTH_CURSOR_DIRECTIONAL_MODE_MD
        ? DEPTH_CURSOR_DIRECTIONAL_MODE_MD
        : DEPTH_CURSOR_DIRECTIONAL_MODE_TVD;
}

function normalizeOperationPhase(value) {
    const token = String(value ?? '').trim().toLowerCase();
    return token === OPERATION_PHASE_DRILLING
        ? OPERATION_PHASE_DRILLING
        : OPERATION_PHASE_PRODUCTION;
}

function normalizeAnnotationToolMode(value) {
    return String(value ?? '').trim().toLowerCase() === USER_ANNOTATION_TOOL_MODE_ADD
        ? USER_ANNOTATION_TOOL_MODE_ADD
        : USER_ANNOTATION_TOOL_MODE_SELECT;
}

function createDefaultViewUiState() {
    return {
        cachedDirectionalWidth: DIRECTIONAL_DEFAULT_CANVAS_WIDTH_MULTIPLIER,
        hasDirectionalWidthMemory: false,
        cachedDirectionalViewportConfig: null,
        hasDirectionalViewportMemory: false,
        hasDirectionalAspectRatioMeasurement: false,
        lastDirectionalAutoFitSignature: null,
        suppressNextDirectionalAutoFit: false,
        lastVsSelection: VERTICAL_SECTION_MODE_AUTO,
        directionalDataAspectRatio: 1
    };
}

export function normalizeViewMode(value) {
    return String(value ?? '').trim().toLowerCase() === 'directional'
        ? 'directional'
        : 'vertical';
}

function normalizeDirectionalCasingArrowMode(value) {
    return String(value ?? '').trim().toLowerCase() === DIRECTIONAL_CASING_ARROW_MODE_DIRECT_TO_ANCHOR
        ? DIRECTIONAL_CASING_ARROW_MODE_DIRECT_TO_ANCHOR
        : DIRECTIONAL_CASING_ARROW_MODE_NORMAL_LOCKED;
}

function normalizeVerticalSectionMode(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (token === VERTICAL_SECTION_MODE_MANUAL || token === 'north' || token === 'east') {
        return VERTICAL_SECTION_MODE_MANUAL;
    }
    return VERTICAL_SECTION_MODE_AUTO;
}

function normalizeDegrees(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_VERTICAL_SECTION_AZIMUTH;
    const normalized = numeric % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}

function angularDistanceDegrees(a, b) {
    const normalizedA = normalizeDegrees(a);
    const normalizedB = normalizeDegrees(b);
    const diff = Math.abs(normalizedA - normalizedB);
    return Math.min(diff, 360 - diff);
}

function normalizeVerticalSectionAzimuth(value, fallback = DEFAULT_VERTICAL_SECTION_AZIMUTH) {
    const parsed = parseOptionalNumber(value);
    const fallbackNumber = Number.isFinite(Number(fallback))
        ? Number(fallback)
        : DEFAULT_VERTICAL_SECTION_AZIMUTH;
    const base = Number.isFinite(parsed) ? parsed : fallbackNumber;
    return normalizeDegrees(base);
}

function resolveVerticalSectionModeSelection(mode, azimuth) {
    const normalizedMode = normalizeVerticalSectionMode(mode);
    if (normalizedMode === VERTICAL_SECTION_MODE_AUTO) return VERTICAL_SECTION_MODE_AUTO;
    const normalizedAzimuth = normalizeVerticalSectionAzimuth(azimuth, DEFAULT_VERTICAL_SECTION_AZIMUTH);
    if (angularDistanceDegrees(normalizedAzimuth, VERTICAL_SECTION_PRESETS.north) <= VERTICAL_SECTION_PRESET_TOLERANCE) {
        return 'north';
    }
    if (angularDistanceDegrees(normalizedAzimuth, VERTICAL_SECTION_PRESETS.east) <= VERTICAL_SECTION_PRESET_TOLERANCE) {
        return 'east';
    }
    return VERTICAL_SECTION_MODE_MANUAL;
}

function clampXExaggeration(value) {
    return Math.max(MIN_X_EXAGGERATION, Math.min(MAX_X_EXAGGERATION, value));
}

function clampIntervalCalloutStandoffPx(value) {
    return Math.max(
        MIN_INTERVAL_CALLOUT_STANDOFF_PX,
        Math.min(MAX_INTERVAL_CALLOUT_STANDOFF_PX, value)
    );
}

export function normalizeXExaggeration(value, fallback = DEFAULT_X_EXAGGERATION) {
    const parsed = parseOptionalNumber(value);
    const fallbackNumber = Number.isFinite(Number(fallback))
        ? Number(fallback)
        : DEFAULT_X_EXAGGERATION;
    const safeFallback = clampXExaggeration(fallbackNumber);
    if (!Number.isFinite(parsed)) {
        return safeFallback;
    }
    return clampXExaggeration(parsed);
}

export function normalizeIntervalCalloutStandoffPx(
    value,
    fallback = DEFAULT_INTERVAL_CALLOUT_STANDOFF_PX
) {
    const parsed = parseOptionalNumber(value);
    const fallbackNumber = Number.isFinite(Number(fallback))
        ? Number(fallback)
        : DEFAULT_INTERVAL_CALLOUT_STANDOFF_PX;
    const safeFallback = clampIntervalCalloutStandoffPx(Math.round(fallbackNumber));
    if (!Number.isFinite(parsed)) {
        return safeFallback;
    }
    return clampIntervalCalloutStandoffPx(Math.round(parsed));
}

function normalizeCanvasWidthMultiplier(value, fallback = DEFAULT_CANVAS_WIDTH_MULTIPLIER) {
    const parsed = parseOptionalNumber(value);
    if (!Number.isFinite(parsed)) {
        return Math.max(MIN_CANVAS_WIDTH_MULTIPLIER, fallback);
    }
    return Math.max(MIN_CANVAS_WIDTH_MULTIPLIER, parsed);
}

export function normalizeCanvasWidthMultiplierForMode(value, mode, fallback = DEFAULT_CANVAS_WIDTH_MULTIPLIER) {
    const normalized = normalizeCanvasWidthMultiplier(value, fallback);
    return normalizeViewMode(mode) === 'vertical'
        ? Math.max(DEFAULT_CANVAS_WIDTH_MULTIPLIER, normalized)
        : normalized;
}

export const useViewConfigStore = defineStore('viewConfig', () => {
    const config = reactive(createDefaultViewConfig());
    const uiState = reactive(createDefaultViewUiState());

    function setColorPalette(value) {
        return setConfigValue('colorPalette', value);
    }

    function setShowCement(value) {
        return setConfigValue('showCement', value === true);
    }

    function setShowDepthCrossSection(value) {
        const nextVisible = value === true;
        const changedVisibility = setConfigValue('showDepthCrossSection', nextVisible);
        if (nextVisible) {
            return changedVisibility;
        }
        const changedDepth = setConfigValue('cursorDepth', null);
        return changedVisibility || changedDepth;
    }

    function setCursorDepth(value) {
        const numeric = Number(value);
        const next = Number.isFinite(numeric) ? numeric : null;
        return setConfigValue('cursorDepth', next);
    }

    function setShowPhysicsDebug(value) {
        return setConfigValue('showPhysicsDebug', value === true);
    }

    function setShowDepthCursor(value) {
        return setConfigValue('showDepthCursor', value === true);
    }

    function setDepthCursorDirectionalMode(value) {
        return setConfigValue('depthCursorDirectionalMode', normalizeDepthCursorDirectionalMode(value));
    }

    function setShowMagnifier(value) {
        return setConfigValue('showMagnifier', value === true);
    }

    function setMagnifierZoomLevel(value) {
        return setConfigValue(
            'magnifierZoomLevel',
            normalizeMagnifierZoomLevel(value, config.magnifierZoomLevel)
        );
    }

    function setOperationPhase(value) {
        return setConfigValue('operationPhase', normalizeOperationPhase(value));
    }

    function setAnnotationToolMode(value) {
        return setConfigValue('annotationToolMode', normalizeAnnotationToolMode(value));
    }

    function setCementColor(value) {
        return setConfigValue('cementColor', value);
    }

    function setCementHatchEnabled(value) {
        return setConfigValue('cementHatchEnabled', value === true);
    }

    function setCementHatchStyle(value) {
        return setConfigValue('cementHatchStyle', value);
    }

    function setConfigValue(key, value) {
        if (!key || !SUPPORTED_VIEW_CONFIG_KEYS.has(key)) return false;
        if (Object.is(config[key], value)) return false;
        config[key] = value;
        return true;
    }

    function updateConfig(patch) {
        if (!patch || typeof patch !== 'object') return [];

        const changedKeys = [];
        Object.entries(patch).forEach(([key, value]) => {
            if (!SUPPORTED_VIEW_CONFIG_KEYS.has(key)) return;
            if (Object.is(config[key], value)) return;
            config[key] = value;
            changedKeys.push(key);
        });

        return changedKeys;
    }

    function rememberVerticalSectionSelection(selection, azimuth = config.verticalSectionAzimuth) {
        const token = String(selection ?? '').trim().toLowerCase();
        if (token === VERTICAL_SECTION_MODE_AUTO) {
            uiState.lastVsSelection = VERTICAL_SECTION_MODE_AUTO;
            return uiState.lastVsSelection;
        }
        if (token === VERTICAL_SECTION_MODE_MANUAL) {
            uiState.lastVsSelection = VERTICAL_SECTION_MODE_MANUAL;
            return uiState.lastVsSelection;
        }

        const normalizedAzimuth = normalizeVerticalSectionAzimuth(azimuth, config.verticalSectionAzimuth);
        if (token === 'north' &&
            angularDistanceDegrees(normalizedAzimuth, VERTICAL_SECTION_PRESETS.north) <= VERTICAL_SECTION_PRESET_TOLERANCE) {
            uiState.lastVsSelection = 'north';
            return uiState.lastVsSelection;
        }
        if (token === 'east' &&
            angularDistanceDegrees(normalizedAzimuth, VERTICAL_SECTION_PRESETS.east) <= VERTICAL_SECTION_PRESET_TOLERANCE) {
            uiState.lastVsSelection = 'east';
            return uiState.lastVsSelection;
        }

        uiState.lastVsSelection = VERTICAL_SECTION_MODE_MANUAL;
        return uiState.lastVsSelection;
    }

    function getVerticalSectionModeSelectionFromConfig() {
        const normalizedMode = normalizeVerticalSectionMode(config.verticalSectionMode);
        if (normalizedMode === VERTICAL_SECTION_MODE_AUTO) {
            return rememberVerticalSectionSelection(VERTICAL_SECTION_MODE_AUTO, config.verticalSectionAzimuth);
        }

        if (uiState.lastVsSelection === VERTICAL_SECTION_MODE_MANUAL) {
            return VERTICAL_SECTION_MODE_MANUAL;
        }
        if (uiState.lastVsSelection === 'north' &&
            angularDistanceDegrees(config.verticalSectionAzimuth, VERTICAL_SECTION_PRESETS.north) <= VERTICAL_SECTION_PRESET_TOLERANCE) {
            return 'north';
        }
        if (uiState.lastVsSelection === 'east' &&
            angularDistanceDegrees(config.verticalSectionAzimuth, VERTICAL_SECTION_PRESETS.east) <= VERTICAL_SECTION_PRESET_TOLERANCE) {
            return 'east';
        }

        const selection = resolveVerticalSectionModeSelection(
            normalizedMode,
            config.verticalSectionAzimuth
        );
        return rememberVerticalSectionSelection(selection, config.verticalSectionAzimuth);
    }

    function setVerticalSectionSelection(selection) {
        const token = String(selection ?? '').trim().toLowerCase();
        if (token === VERTICAL_SECTION_MODE_AUTO) {
            updateConfig({
                verticalSectionMode: VERTICAL_SECTION_MODE_AUTO
            });
            rememberVerticalSectionSelection(token, config.verticalSectionAzimuth);
            return getVerticalSectionModeSelectionFromConfig();
        }

        const presetAzimuth = VERTICAL_SECTION_PRESETS[token];
        const azimuth = Number.isFinite(presetAzimuth)
            ? presetAzimuth
            : config.verticalSectionAzimuth;
        const normalizedAzimuth = normalizeVerticalSectionAzimuth(azimuth, config.verticalSectionAzimuth);

        updateConfig({
            verticalSectionMode: VERTICAL_SECTION_MODE_MANUAL,
            verticalSectionAzimuth: normalizedAzimuth
        });
        rememberVerticalSectionSelection(token, normalizedAzimuth);
        return getVerticalSectionModeSelectionFromConfig();
    }

    function setVerticalSectionAzimuth(value) {
        const normalized = normalizeVerticalSectionAzimuth(value, config.verticalSectionAzimuth);
        updateConfig({
            verticalSectionMode: VERTICAL_SECTION_MODE_MANUAL,
            verticalSectionAzimuth: normalized
        });
        rememberVerticalSectionSelection(VERTICAL_SECTION_MODE_MANUAL, normalized);
        return normalized;
    }

    function syncVerticalSectionControlsFromConfig() {
        const normalizedMode = normalizeVerticalSectionMode(config.verticalSectionMode);
        const normalizedAzimuth = normalizeVerticalSectionAzimuth(
            config.verticalSectionAzimuth,
            DEFAULT_VERTICAL_SECTION_AZIMUTH
        );

        updateConfig({
            verticalSectionMode: normalizedMode,
            verticalSectionAzimuth: normalizedAzimuth
        });

        const selection = resolveVerticalSectionModeSelection(
            config.verticalSectionMode,
            config.verticalSectionAzimuth
        );

        rememberVerticalSectionSelection(selection, config.verticalSectionAzimuth);
        return getVerticalSectionModeSelectionFromConfig();
    }

    function rememberDirectionalCanvasWidth(value) {
        const normalized = normalizeCanvasWidthMultiplierForMode(
            value,
            'directional',
            DIRECTIONAL_DEFAULT_CANVAS_WIDTH_MULTIPLIER
        );
        uiState.cachedDirectionalWidth = normalized;
        uiState.hasDirectionalWidthMemory = true;
        return normalized;
    }

    function rememberDirectionalViewportConfig(source = config) {
        const parsedFigureHeight = parseOptionalNumber(source?.figHeight);
        const fallbackFigureHeight = Number.isFinite(Number(config.figHeight))
            ? Number(config.figHeight)
            : DIRECTIONAL_MIN_FIGURE_HEIGHT;
        const figHeight = Math.max(
            DIRECTIONAL_MIN_FIGURE_HEIGHT,
            Math.round(Number.isFinite(parsedFigureHeight) ? parsedFigureHeight : fallbackFigureHeight)
        );
        const canvasWidthMultiplier = normalizeCanvasWidthMultiplierForMode(
            source?.canvasWidthMultiplier,
            'directional',
            config.canvasWidthMultiplier
        );
        const xExaggeration = normalizeXExaggeration(source?.xExaggeration, config.xExaggeration);
        const lockAspectRatio = source?.lockAspectRatio === true;

        uiState.cachedDirectionalViewportConfig = {
            figHeight,
            canvasWidthMultiplier,
            xExaggeration,
            lockAspectRatio
        };
        uiState.hasDirectionalViewportMemory = true;
        return uiState.cachedDirectionalViewportConfig;
    }

    function restoreDirectionalViewportConfig() {
        if (uiState.hasDirectionalViewportMemory !== true || !uiState.cachedDirectionalViewportConfig) {
            return false;
        }

        const snapshot = uiState.cachedDirectionalViewportConfig;
        updateConfig({
            figHeight: snapshot.figHeight,
            canvasWidthMultiplier: snapshot.canvasWidthMultiplier,
            xExaggeration: snapshot.xExaggeration,
            lockAspectRatio: snapshot.lockAspectRatio
        });
        return true;
    }

    function resolveDirectionalDataAspectRatio() {
        const numeric = Number(uiState.directionalDataAspectRatio);
        if (!Number.isFinite(numeric) || numeric <= 0) return 1;
        return numeric;
    }

    function invalidateDirectionalDataAspectRatio() {
        uiState.hasDirectionalAspectRatioMeasurement = false;
        uiState.directionalDataAspectRatio = 1;
    }

    function setDirectionalAutoFitSignature(signature) {
        const normalized = typeof signature === 'string' && signature.length > 0
            ? signature
            : null;
        uiState.lastDirectionalAutoFitSignature = normalized;
        return uiState.lastDirectionalAutoFitSignature;
    }

    function suppressNextDirectionalAutoFit() {
        uiState.suppressNextDirectionalAutoFit = true;
        return true;
    }

    function consumeDirectionalAutoFitSuppression() {
        if (uiState.suppressNextDirectionalAutoFit !== true) return false;
        uiState.suppressNextDirectionalAutoFit = false;
        return true;
    }

    function syncDirectionalCanvasWidthFromFigureHeight() {
        if (normalizeViewMode(config.viewMode) !== 'directional' || config.lockAspectRatio !== true) return;
        if (uiState.hasDirectionalAspectRatioMeasurement !== true) return;
        const svgWidth = resolveDirectionalSvgWidthFromHeight(
            config.figHeight,
            resolveDirectionalDataAspectRatio()
        );
        const rawMultiplier = Math.max(
            MIN_CANVAS_WIDTH_MULTIPLIER,
            resolveDirectionalWidthMultiplierFromSvgWidth(svgWidth)
        );
        const multiplier = Math.round(rawMultiplier * 100) / 100;
        setConfigValue('canvasWidthMultiplier', multiplier);
        rememberDirectionalCanvasWidth(multiplier);
    }

    function setCanvasWidthForMode(mode, value, fallback = config.canvasWidthMultiplier) {
        const normalized = normalizeCanvasWidthMultiplierForMode(value, mode, fallback);
        setConfigValue('canvasWidthMultiplier', normalized);
        return config.canvasWidthMultiplier;
    }

    function maybeApplyDirectionalCanvasWidthDefault(previousMode, nextMode) {
        const fromMode = normalizeViewMode(previousMode);
        const toMode = normalizeViewMode(nextMode);

        const current = normalizeCanvasWidthMultiplier(
            config.canvasWidthMultiplier,
            config.canvasWidthMultiplier
        );

        if (fromMode === 'directional') {
            rememberDirectionalCanvasWidth(current);
        }

        if (toMode === 'vertical') {
            setCanvasWidthForMode('vertical', current, DEFAULT_CANVAS_WIDTH_MULTIPLIER);
            return;
        }

        if (toMode !== 'directional') {
            setCanvasWidthForMode(toMode, current, current);
            return;
        }

        if (fromMode === 'directional') {
            setCanvasWidthForMode('directional', current, current);
            return;
        }

        if (uiState.hasDirectionalWidthMemory) {
            setCanvasWidthForMode('directional', uiState.cachedDirectionalWidth, DIRECTIONAL_DEFAULT_CANVAS_WIDTH_MULTIPLIER);
            return;
        }

        if (Math.abs(current - DEFAULT_CANVAS_WIDTH_MULTIPLIER) <= CANVAS_WIDTH_DEFAULT_EPSILON) {
            const directionalDefault = rememberDirectionalCanvasWidth(DIRECTIONAL_DEFAULT_CANVAS_WIDTH_MULTIPLIER);
            setCanvasWidthForMode('directional', directionalDefault, directionalDefault);
            return;
        }

        const remembered = rememberDirectionalCanvasWidth(current);
        setCanvasWidthForMode('directional', remembered, remembered);
    }

    function setViewMode(value) {
        const previousMode = normalizeViewMode(config.viewMode);
        const nextMode = normalizeViewMode(value);

        if (previousMode === 'directional') {
            rememberDirectionalViewportConfig(config);
        }

        setConfigValue('viewMode', nextMode);
        maybeApplyDirectionalCanvasWidthDefault(previousMode, nextMode);

        if (previousMode !== 'directional' && nextMode === 'directional' && restoreDirectionalViewportConfig()) {
            suppressNextDirectionalAutoFit();
        }
        return config.viewMode;
    }

    function setXExaggeration(value) {
        const normalized = normalizeXExaggeration(value, config.xExaggeration);
        setConfigValue('xExaggeration', normalized);
        return normalized;
    }

    function setIntervalCalloutStandoffPx(value) {
        const normalized = normalizeIntervalCalloutStandoffPx(
            value,
            config.intervalCalloutStandoffPx
        );
        setConfigValue('intervalCalloutStandoffPx', normalized);
        return normalized;
    }

    function setDirectionalCasingArrowMode(value) {
        const normalized = normalizeDirectionalCasingArrowMode(value);
        setConfigValue('directionalCasingArrowMode', normalized);
        return normalized;
    }

    function setDirectionalDataAspectRatio(value) {
        const numeric = Number(value);
        const safeAspectRatio = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
        uiState.hasDirectionalAspectRatioMeasurement = true;
        if (Object.is(uiState.directionalDataAspectRatio, safeAspectRatio)) return safeAspectRatio;
        uiState.directionalDataAspectRatio = safeAspectRatio;
        syncDirectionalCanvasWidthFromFigureHeight();
        return safeAspectRatio;
    }

    function setFigureHeightFromControl(value) {
        const parsed = parseOptionalNumber(value);
        const fallback = Number.isFinite(Number(config.figHeight))
            ? Number(config.figHeight)
            : DIRECTIONAL_MIN_FIGURE_HEIGHT;
        const nextFigureHeight = Math.max(
            DIRECTIONAL_MIN_FIGURE_HEIGHT,
            Math.round(Number.isFinite(parsed) ? parsed : fallback)
        );
        setConfigValue('figHeight', nextFigureHeight);
        syncDirectionalCanvasWidthFromFigureHeight();
        return config.figHeight;
    }

    function setLockAspectRatioEnabled(value) {
        const normalized = Boolean(value);
        setConfigValue('lockAspectRatio', normalized);
        if (normalized) {
            syncDirectionalCanvasWidthFromFigureHeight();
        }
        return normalized;
    }

    function setCanvasWidthMultiplierFromControl(value) {
        const mode = normalizeViewMode(config.viewMode);
        const normalized = normalizeCanvasWidthMultiplierForMode(
            value,
            mode,
            config.canvasWidthMultiplier
        );

        if (mode === 'directional' && config.lockAspectRatio === true) {
            setConfigValue('canvasWidthMultiplier', normalized);
            rememberDirectionalCanvasWidth(normalized);
            const targetSvgWidth = resolveDirectionalSvgWidthFromMultiplier(normalized);
            const nextFigureHeight = resolveDirectionalFigureHeightFromWidth(
                targetSvgWidth,
                resolveDirectionalDataAspectRatio()
            );
            setConfigValue('figHeight', nextFigureHeight);
            return normalized;
        }

        setConfigValue('canvasWidthMultiplier', normalized);
        if (mode === 'directional') {
            rememberDirectionalCanvasWidth(normalized);
        }
        return normalized;
    }

    function reconcileCanvasWidthForCurrentViewMode() {
        setConfigValue('canvasWidthMultiplier', normalizeCanvasWidthMultiplierForMode(
            config.canvasWidthMultiplier,
            config.viewMode,
            DEFAULT_CANVAS_WIDTH_MULTIPLIER
        ));

        if (config.viewMode === 'directional' &&
            Math.abs(config.canvasWidthMultiplier - DEFAULT_CANVAS_WIDTH_MULTIPLIER) <= CANVAS_WIDTH_DEFAULT_EPSILON) {
            setConfigValue('canvasWidthMultiplier', DIRECTIONAL_DEFAULT_CANVAS_WIDTH_MULTIPLIER);
        }

        if (config.viewMode === 'directional') {
            rememberDirectionalCanvasWidth(config.canvasWidthMultiplier);
        } else {
            uiState.hasDirectionalWidthMemory = false;
        }

        setConfigValue('canvasWidthMultiplier', setCanvasWidthForMode(
            config.viewMode,
            config.canvasWidthMultiplier,
            DEFAULT_CANVAS_WIDTH_MULTIPLIER
        ));

        syncDirectionalCanvasWidthFromFigureHeight();

        return config.canvasWidthMultiplier;
    }

    return {
        config,
        uiState,
        setColorPalette,
        setShowCement,
        setShowDepthCrossSection,
        setCursorDepth,
        setShowPhysicsDebug,
        setShowDepthCursor,
        setDepthCursorDirectionalMode,
        setShowMagnifier,
        setMagnifierZoomLevel,
        setOperationPhase,
        setAnnotationToolMode,
        setCementColor,
        setCementHatchEnabled,
        setCementHatchStyle,
        setConfigValue,
        updateConfig,
        getVerticalSectionModeSelectionFromConfig,
        reconcileCanvasWidthForCurrentViewMode,
        setCanvasWidthMultiplierFromControl,
        setDirectionalDataAspectRatio,
        invalidateDirectionalDataAspectRatio,
        setDirectionalAutoFitSignature,
        suppressNextDirectionalAutoFit,
        consumeDirectionalAutoFitSuppression,
        setFigureHeightFromControl,
        setLockAspectRatioEnabled,
        setVerticalSectionAzimuth,
        setVerticalSectionSelection,
        setViewMode,
        setXExaggeration,
        setIntervalCalloutStandoffPx,
        setDirectionalCasingArrowMode,
        syncVerticalSectionControlsFromConfig
    };
});
