import { nextTick, onBeforeUnmount, watch } from 'vue';
import { mergeRenderInvalidation, normalizeRenderInvalidation } from '@/app/renderers/invalidation.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { pinia } from '@/stores/pinia.js';

const LEGACY_RENDER_DEBOUNCE_MS = 300;
const FULL_RENDER_INVALIDATION = normalizeRenderInvalidation({
    geometryDirty: true,
    stylingDirty: true,
    annotationDirty: true
});
const STYLE_RENDER_INVALIDATION = normalizeRenderInvalidation({
    geometryDirty: false,
    stylingDirty: true,
    annotationDirty: true
});

const projectDataStore = useProjectDataStore(pinia);
const interactionStore = useInteractionStore(pinia);

const renderListeners = new Set();
let renderTimer = null;
let queuedInvalidation = null;

function clearQueuedRender() {
    if (!renderTimer) return;
    clearTimeout(renderTimer);
    renderTimer = null;
}

function queueInvalidation(invalidation = null) {
    if (!invalidation) return;
    queuedInvalidation = queuedInvalidation
        ? mergeRenderInvalidation(queuedInvalidation, invalidation)
        : normalizeRenderInvalidation(invalidation);
}

function resolveQueuedInvalidation(fallback = null) {
    if (queuedInvalidation) {
        const pending = queuedInvalidation;
        queuedInvalidation = null;
        return pending;
    }
    if (fallback) {
        return normalizeRenderInvalidation(fallback);
    }
    return normalizeRenderInvalidation(FULL_RENDER_INVALIDATION);
}

function canRender(options = {}) {
    if (options.force === true) return true;
    if (interactionStore.interaction.autoGenerate !== true) return false;
    const casingCount = Array.isArray(projectDataStore.casingData) ? projectDataStore.casingData.length : 0;
    const tubingCount = Array.isArray(projectDataStore.tubingData) ? projectDataStore.tubingData.length : 0;
    const drillStringCount = Array.isArray(projectDataStore.drillStringData) ? projectDataStore.drillStringData.length : 0;
    const equipmentCount = Array.isArray(projectDataStore.equipmentData) ? projectDataStore.equipmentData.length : 0;
    return (casingCount + tubingCount + drillStringCount + equipmentCount) > 0;
}

function emitRender(options = {}) {
    if (!canRender(options)) return;
    const invalidation = resolveQueuedInvalidation(options.invalidation || FULL_RENDER_INVALIDATION);
    void nextTick(() => {
        renderListeners.forEach((listener) => {
            listener({
                invalidation,
                source: options.source || 'manual'
            });
        });
    });
}

function scheduleRender(options = {}) {
    clearQueuedRender();
    queueInvalidation(options.invalidation);
    renderTimer = setTimeout(() => {
        renderTimer = null;
        emitRender(options);
    }, LEGACY_RENDER_DEBOUNCE_MS);
}

export function requestSchematicRender(options = {}) {
    if (options.immediate === true) {
        clearQueuedRender();
        queueInvalidation(options.invalidation);
        emitRender(options);
        return;
    }
    scheduleRender(options);
}

export function subscribeSchematicRender(handler) {
    if (typeof handler !== 'function') return () => {};
    renderListeners.add(handler);
    return () => {
        renderListeners.delete(handler);
    };
}

export function useSchematicRenderer(options = {}) {
    const stopHandles = [];
    const dataSources = Array.isArray(options.dataSources) ? options.dataSources : [];
    const styleSources = Array.isArray(options.styleSources) ? options.styleSources : [];
    const deep = options.deep !== false;
    const flush = options.flush || 'post';

    if (typeof options.onRender === 'function') {
        stopHandles.push(subscribeSchematicRender(options.onRender));
    }

    if (dataSources.length > 0) {
        stopHandles.push(watch(
            dataSources,
            () => {
                requestSchematicRender({
                    source: 'data',
                    invalidation: FULL_RENDER_INVALIDATION
                });
            },
            { deep, flush }
        ));
    }

    if (styleSources.length > 0) {
        stopHandles.push(watch(
            styleSources,
            () => {
                requestSchematicRender({
                    source: 'style',
                    invalidation: STYLE_RENDER_INVALIDATION
                });
            },
            { deep, flush }
        ));
    }

    onBeforeUnmount(() => {
        stopHandles.forEach((stop) => {
            stop?.();
        });
    });

    return {
        forceRender(options = {}) {
            requestSchematicRender({
                source: options.source || 'manual',
                immediate: options.immediate !== false,
                force: true,
                invalidation: options.invalidation || FULL_RENDER_INVALIDATION
            });
        }
    };
}
