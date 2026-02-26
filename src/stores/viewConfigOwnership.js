import { createDefaultViewConfig } from '@/stores/viewConfigStore.js';

export const VIEW_CONFIG_OWNERSHIP_BUCKETS = Object.freeze({
    WELL_LEVEL: 'well-level',
    PROJECT_LEVEL: 'project-level',
    APPLICATION_LEVEL: 'application-level'
});

const VIEW_CONFIG_OWNERSHIP_MAP = Object.freeze({
    units: VIEW_CONFIG_OWNERSHIP_BUCKETS.PROJECT_LEVEL,
    operationPhase: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    datumDepth: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    colorPalette: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    showCement: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    showDepthCrossSection: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    cursorDepth: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    showDepthCursor: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    showMagnifier: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    magnifierZoomLevel: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    depthCursorDirectionalMode: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    showPhysicsDebug: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    cementColor: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    cementHatchEnabled: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    cementHatchStyle: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    plotTitle: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    figHeight: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    widthMultiplier: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    canvasWidthMultiplier: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    lockAspectRatio: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    viewMode: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    annotationToolMode: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    xExaggeration: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    intervalCalloutStandoffPx: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    directionalCasingArrowMode: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    verticalSectionMode: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    verticalSectionAzimuth: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    crossoverEpsilon: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL,
    crossoverPixelHalfHeight: VIEW_CONFIG_OWNERSHIP_BUCKETS.WELL_LEVEL
});

const PROJECT_CONFIG_KEYS = Object.freeze({
    defaultUnits: 'defaultUnits'
});

const DEFAULT_PROJECT_CONFIG = Object.freeze({
    [PROJECT_CONFIG_KEYS.defaultUnits]: 'ft'
});

export function normalizeProjectUnits(value, fallback = DEFAULT_PROJECT_CONFIG.defaultUnits) {
    return String(value ?? fallback).trim().toLowerCase() === 'm' ? 'm' : 'ft';
}

export function createDefaultProjectConfig() {
    return {
        [PROJECT_CONFIG_KEYS.defaultUnits]: DEFAULT_PROJECT_CONFIG.defaultUnits
    };
}

export function assertViewConfigOwnershipCoverage() {
    const runtimeKeys = Object.keys(createDefaultViewConfig());
    const mappedKeys = Object.keys(VIEW_CONFIG_OWNERSHIP_MAP);

    const missingKeys = runtimeKeys.filter((key) => !(key in VIEW_CONFIG_OWNERSHIP_MAP));
    if (missingKeys.length > 0) {
        throw new Error(`Missing ownership mapping for view config keys: ${missingKeys.join(', ')}`);
    }

    const staleKeys = mappedKeys.filter((key) => !runtimeKeys.includes(key));
    if (staleKeys.length > 0) {
        throw new Error(`Stale ownership mapping keys detected: ${staleKeys.join(', ')}`);
    }
}

export function splitRuntimeViewConfigByOwnership(runtimeConfig = {}) {
    const defaultConfig = createDefaultViewConfig();
    const source = {
        ...defaultConfig,
        ...(runtimeConfig && typeof runtimeConfig === 'object' ? runtimeConfig : {})
    };

    const wellConfig = {};
    const projectConfig = createDefaultProjectConfig();
    const applicationConfig = {};

    Object.entries(source).forEach(([key, value]) => {
        const bucket = VIEW_CONFIG_OWNERSHIP_MAP[key];
        if (bucket === VIEW_CONFIG_OWNERSHIP_BUCKETS.PROJECT_LEVEL) {
            if (key === 'units') {
                projectConfig[PROJECT_CONFIG_KEYS.defaultUnits] = normalizeProjectUnits(value, projectConfig.defaultUnits);
            }
            return;
        }
        if (bucket === VIEW_CONFIG_OWNERSHIP_BUCKETS.APPLICATION_LEVEL) {
            applicationConfig[key] = value;
            return;
        }
        wellConfig[key] = value;
    });

    return {
        wellConfig,
        projectConfig,
        applicationConfig
    };
}

export function composeRuntimeViewConfigForWell(wellConfig = {}, projectConfig = {}) {
    const defaults = createDefaultViewConfig();
    const nextWellConfig = wellConfig && typeof wellConfig === 'object' ? wellConfig : {};
    const nextProjectConfig = projectConfig && typeof projectConfig === 'object'
        ? projectConfig
        : createDefaultProjectConfig();

    const runtimeConfig = {
        ...defaults,
        ...nextWellConfig
    };

    runtimeConfig.units = normalizeProjectUnits(
        nextProjectConfig.defaultUnits ?? nextWellConfig.units ?? defaults.units,
        defaults.units
    );

    return runtimeConfig;
}

export function getViewConfigOwnershipMap() {
    return { ...VIEW_CONFIG_OWNERSHIP_MAP };
}

export function getProjectConfigKeys() {
    return { ...PROJECT_CONFIG_KEYS };
}
