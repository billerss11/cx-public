const DEFAULT_INVALIDATION = Object.freeze({
    geometryDirty: true,
    stylingDirty: true,
    annotationDirty: true,
    selectionOnly: false,
    skipRender: false
});

const GEOMETRY_CONFIG_KEYS = new Set([
    'viewMode',
    'operationPhase',
    'widthMultiplier',
    'canvasWidthMultiplier',
    'figHeight',
    'datumDepth',
    'xExaggeration',
    'directionalCasingArrowMode',
    'verticalSectionMode',
    'verticalSectionAzimuth',
    'lockAspectRatio',
    'showCement',
    'crossoverEpsilon'
]);

const STYLING_CONFIG_KEYS = new Set([
    'colorPalette',
    'plotTitle',
    'cementColor',
    'cementHatchEnabled',
    'cementHatchStyle',
    'crossoverPixelHalfHeight',
    'units'
]);

const ANNOTATION_CONFIG_KEYS = new Set([
    'intervalCalloutStandoffPx'
]);

const DATA_GEOMETRY_SECTIONS = new Set([
    'casingData',
    'tubingData',
    'drillStringData',
    'equipmentData',
    'cementPlugs',
    'annulusFluids',
    'trajectory'
]);

const DATA_STYLE_SECTIONS = new Set([
    'horizontalLines',
    'markers'
]);

const DATA_ANNOTATION_SECTIONS = new Set([
    'annotationBoxes',
    'userAnnotations'
]);

const DATA_ANALYSIS_ONLY_SECTIONS = new Set([
    'topologySources'
]);

const INTERACTION_SELECTION_KEYS = new Set([
    'hoveredEntity',
    'lockedEntity'
]);

function normalizeKeys(keys = []) {
    if (!Array.isArray(keys)) return [];
    return keys.map((key) => String(key || '').trim()).filter(Boolean);
}

export function normalizeRenderInvalidation(invalidation = {}) {
    const normalized = {
        ...DEFAULT_INVALIDATION,
        ...(invalidation || {})
    };

    if (normalized.selectionOnly) {
        normalized.geometryDirty = false;
        normalized.stylingDirty = false;
        normalized.annotationDirty = false;
        normalized.skipRender = true;
    }

    if (!normalized.geometryDirty && !normalized.stylingDirty && !normalized.annotationDirty) {
        normalized.skipRender = true;
    }

    return normalized;
}

export function mergeRenderInvalidation(base = {}, next = {}) {
    const a = normalizeRenderInvalidation(base);
    const b = normalizeRenderInvalidation(next);

    if (a.selectionOnly && !b.selectionOnly) {
        return normalizeRenderInvalidation(b);
    }
    if (b.selectionOnly && !a.selectionOnly) {
        return normalizeRenderInvalidation(a);
    }

    return normalizeRenderInvalidation({
        geometryDirty: Boolean(a.geometryDirty || b.geometryDirty),
        stylingDirty: Boolean(a.stylingDirty || b.stylingDirty),
        annotationDirty: Boolean(a.annotationDirty || b.annotationDirty),
        selectionOnly: Boolean(a.selectionOnly && b.selectionOnly),
        skipRender: Boolean(a.skipRender && b.skipRender)
    });
}

export function classifyStoreMutation(meta = {}) {
    const section = String(meta?.section || '').trim();
    const keys = normalizeKeys(meta?.keys);
    const path = String(meta?.path || '').trim();

    if (!section) {
        return normalizeRenderInvalidation(DEFAULT_INVALIDATION);
    }

    if (section === 'interaction') {
        const interactionKeys = keys.length > 0
            ? keys
            : (path.startsWith('interaction.') ? [path.replace('interaction.', '')] : []);
        const isSelectionOnly = interactionKeys.length > 0 &&
            interactionKeys.every((key) => INTERACTION_SELECTION_KEYS.has(key));

        if (isSelectionOnly) {
            return normalizeRenderInvalidation({ selectionOnly: true });
        }
        return normalizeRenderInvalidation({ skipRender: true, geometryDirty: false, stylingDirty: false, annotationDirty: false });
    }

    if (section === 'config') {
        const configKeys = keys.length > 0
            ? keys
            : (path.startsWith('config.') ? [path.replace('config.', '')] : []);
        if (configKeys.length === 0) {
            return normalizeRenderInvalidation(DEFAULT_INVALIDATION);
        }

        const geometryDirty = configKeys.some((key) => GEOMETRY_CONFIG_KEYS.has(key));
        const stylingDirty = configKeys.some((key) => STYLING_CONFIG_KEYS.has(key));
        const annotationDirty = configKeys.some((key) => ANNOTATION_CONFIG_KEYS.has(key));

        if (!geometryDirty && !stylingDirty && !annotationDirty) {
            return normalizeRenderInvalidation({
                geometryDirty: false,
                stylingDirty: false,
                annotationDirty: false,
                skipRender: true
            });
        }

        return normalizeRenderInvalidation({
            geometryDirty,
            stylingDirty: stylingDirty || geometryDirty,
            annotationDirty: annotationDirty || geometryDirty
        });
    }

    if (DATA_GEOMETRY_SECTIONS.has(section)) {
        return normalizeRenderInvalidation({
            geometryDirty: true,
            stylingDirty: true,
            annotationDirty: true
        });
    }

    if (DATA_STYLE_SECTIONS.has(section)) {
        return normalizeRenderInvalidation({
            geometryDirty: false,
            stylingDirty: true,
            annotationDirty: false
        });
    }

    if (DATA_ANNOTATION_SECTIONS.has(section)) {
        return normalizeRenderInvalidation({
            geometryDirty: false,
            stylingDirty: true,
            annotationDirty: true
        });
    }

    if (DATA_ANALYSIS_ONLY_SECTIONS.has(section)) {
        return normalizeRenderInvalidation({
            geometryDirty: false,
            stylingDirty: false,
            annotationDirty: false,
            skipRender: true
        });
    }

    return normalizeRenderInvalidation(DEFAULT_INVALIDATION);
}

export function isSelectionOnlyInvalidation(invalidation = {}) {
    return normalizeRenderInvalidation(invalidation).selectionOnly === true;
}

export function shouldSkipRender(invalidation = {}) {
    return normalizeRenderInvalidation(invalidation).skipRender === true;
}

