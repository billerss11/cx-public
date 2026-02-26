import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import { useProjectStore } from '@/stores/projectStore.js';

function normalizeWellId(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function createDefaultWellTopologyEntry() {
    return {
        latestRequestId: 0,
        loading: false,
        error: null,
        result: null,
        updatedAt: null
    };
}

function toSafeRequestId(value, fallback = null) {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric > 0) return numeric;
    return fallback;
}

export const useTopologyStore = defineStore('topology', () => {
    const projectStore = useProjectStore();
    const state = reactive({
        byWellId: {}
    });

    function ensureWellEntry(wellId) {
        const normalizedWellId = normalizeWellId(wellId);
        if (!normalizedWellId) return null;
        if (!state.byWellId[normalizedWellId]) {
            state.byWellId[normalizedWellId] = createDefaultWellTopologyEntry();
        }
        return state.byWellId[normalizedWellId];
    }

    function getWellEntry(wellId) {
        const normalizedWellId = normalizeWellId(wellId);
        if (!normalizedWellId) return null;
        return state.byWellId[normalizedWellId] ?? null;
    }

    function setWellRequestStarted(wellId, requestId) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const safeRequestId = toSafeRequestId(requestId, entry.latestRequestId + 1);
        entry.latestRequestId = safeRequestId;
        entry.loading = true;
        entry.error = null;
        return true;
    }

    function setWellTopologyResult(wellId, result, requestId = null) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const resultRequestId = toSafeRequestId(requestId, toSafeRequestId(result?.requestId, entry.latestRequestId));
        if (resultRequestId < entry.latestRequestId) return false;

        entry.latestRequestId = resultRequestId;
        entry.loading = false;
        entry.error = null;
        entry.result = result && typeof result === 'object' ? result : null;
        entry.updatedAt = new Date().toISOString();
        return true;
    }

    function setWellTopologyError(wellId, error, requestId = null) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const errorRequestId = toSafeRequestId(requestId, entry.latestRequestId);
        if (errorRequestId < entry.latestRequestId) return false;

        entry.latestRequestId = errorRequestId;
        entry.loading = false;
        entry.error = String(error?.message || error || 'Topology request failed.');
        return true;
    }

    function setWellRequestCancelled(wellId, requestId = null) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const cancelledRequestId = toSafeRequestId(requestId, entry.latestRequestId);
        if (cancelledRequestId < entry.latestRequestId) return false;

        entry.latestRequestId = cancelledRequestId;
        entry.loading = false;
        return true;
    }

    function clearWellTopology(wellId) {
        const normalizedWellId = normalizeWellId(wellId);
        if (!normalizedWellId) return false;
        if (!state.byWellId[normalizedWellId]) return false;
        delete state.byWellId[normalizedWellId];
        return true;
    }

    const activeWellTopology = computed(() => {
        const activeWellId = normalizeWellId(projectStore.activeWellId);
        if (!activeWellId) return null;
        return state.byWellId[activeWellId] ?? null;
    });

    return {
        byWellId: state.byWellId,
        activeWellTopology,
        getWellEntry,
        setWellRequestStarted,
        setWellTopologyResult,
        setWellTopologyError,
        setWellRequestCancelled,
        clearWellTopology
    };
});
