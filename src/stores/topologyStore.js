import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import { useProjectStore } from '@/stores/projectStore.js';

const REQUEST_LINEAGE_STATUS_STARTED = 'started';
const REQUEST_LINEAGE_STATUS_SUCCEEDED = 'succeeded';
const REQUEST_LINEAGE_STATUS_FAILED = 'failed';
const REQUEST_LINEAGE_STATUS_CANCELLED = 'cancelled';
const MAX_REQUEST_LINEAGE_ENTRIES_PER_WELL = 60;

function normalizeWellId(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function normalizeViewMode(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (token === 'vertical' || token === 'directional') return token;
    return null;
}

function normalizeTimestamp(value, fallback = null) {
    const token = String(value ?? '').trim();
    if (!token) return fallback;
    const asDate = new Date(token);
    if (Number.isNaN(asDate.getTime())) return fallback;
    return asDate.toISOString();
}

function createNowTimestamp() {
    return new Date().toISOString();
}

function createDefaultWellTopologyEntry() {
    return {
        latestRequestId: 0,
        loading: false,
        error: null,
        result: null,
        updatedAt: null,
        requestLineage: []
    };
}

function toSafeRequestId(value, fallback = null) {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric > 0) return numeric;
    return fallback;
}

function createTopologyResultSummary(result) {
    const safeResult = result && typeof result === 'object' ? result : null;
    return {
        nodeCount: Array.isArray(safeResult?.nodes) ? safeResult.nodes.length : 0,
        edgeCount: Array.isArray(safeResult?.edges) ? safeResult.edges.length : 0,
        warningCount: Array.isArray(safeResult?.validationWarnings) ? safeResult.validationWarnings.length : 0,
        sourceCount: Array.isArray(safeResult?.sourceEntities) ? safeResult.sourceEntities.length : 0
    };
}

function normalizeLineageMeta(meta = {}) {
    const source = meta && typeof meta === 'object' ? meta : {};
    return {
        geometryRequestId: toSafeRequestId(source?.geometryRequestId, null),
        geometryReadyRequestId: toSafeRequestId(source?.geometryReadyRequestId, null),
        viewMode: normalizeViewMode(source?.viewMode)
    };
}

function ensureWellRequestLineageArray(entry) {
    if (!Array.isArray(entry?.requestLineage)) {
        entry.requestLineage = [];
    }
    return entry.requestLineage;
}

function trimWellRequestLineage(entry) {
    if (!Array.isArray(entry?.requestLineage)) return;
    if (entry.requestLineage.length <= MAX_REQUEST_LINEAGE_ENTRIES_PER_WELL) return;
    entry.requestLineage = entry.requestLineage.slice(
        entry.requestLineage.length - MAX_REQUEST_LINEAGE_ENTRIES_PER_WELL
    );
}

function ensureRequestLineageRecord(entry, wellId, requestId, options = {}) {
    const records = ensureWellRequestLineageArray(entry);
    let record = records.find((candidate) => candidate?.requestId === requestId) ?? null;
    if (!record) {
        const startedAt = normalizeTimestamp(options?.startedAt, createNowTimestamp());
        record = {
            requestId,
            wellId,
            status: REQUEST_LINEAGE_STATUS_STARTED,
            startedAt,
            completedAt: null,
            error: null,
            resultRequestId: null,
            resultSummary: null,
            geometryRequestId: null,
            geometryReadyRequestId: null,
            viewMode: null
        };
        records.push(record);
        trimWellRequestLineage(entry);
    }
    return record;
}

function applyLineageMeta(record, meta = {}) {
    const normalized = normalizeLineageMeta(meta);
    if (normalized.geometryRequestId !== null) {
        record.geometryRequestId = normalized.geometryRequestId;
    } else if (!Number.isInteger(record?.geometryRequestId)) {
        record.geometryRequestId = toSafeRequestId(record?.requestId, null);
    }
    if (normalized.geometryReadyRequestId !== null) {
        record.geometryReadyRequestId = normalized.geometryReadyRequestId;
    }
    if (normalized.viewMode) {
        record.viewMode = normalized.viewMode;
    }
}

function cloneRequestLineage(records = []) {
    if (!Array.isArray(records)) return [];
    return records.map((record) => ({
        ...record,
        resultSummary: record?.resultSummary && typeof record.resultSummary === 'object'
            ? { ...record.resultSummary }
            : null
    }));
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

    function setWellRequestStarted(wellId, requestId, meta = {}) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const safeRequestId = toSafeRequestId(requestId, entry.latestRequestId + 1);
        entry.latestRequestId = safeRequestId;
        entry.loading = true;
        entry.error = null;
        const record = ensureRequestLineageRecord(entry, normalizeWellId(wellId), safeRequestId, {
            startedAt: meta?.startedAt
        });
        record.status = REQUEST_LINEAGE_STATUS_STARTED;
        record.completedAt = null;
        record.error = null;
        record.resultRequestId = null;
        record.resultSummary = null;
        applyLineageMeta(record, meta);
        return true;
    }

    function setWellTopologyResult(wellId, result, requestId = null, meta = {}) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const resultRequestId = toSafeRequestId(requestId, toSafeRequestId(result?.requestId, entry.latestRequestId));
        if (resultRequestId < entry.latestRequestId) return false;

        entry.latestRequestId = resultRequestId;
        entry.loading = false;
        entry.error = null;
        entry.result = result && typeof result === 'object' ? result : null;
        entry.updatedAt = new Date().toISOString();
        const record = ensureRequestLineageRecord(entry, normalizeWellId(wellId), resultRequestId, {
            startedAt: meta?.startedAt
        });
        record.status = REQUEST_LINEAGE_STATUS_SUCCEEDED;
        record.completedAt = normalizeTimestamp(meta?.completedAt, createNowTimestamp());
        record.error = null;
        record.resultRequestId = toSafeRequestId(result?.requestId, resultRequestId);
        record.resultSummary = createTopologyResultSummary(entry.result);
        applyLineageMeta(record, meta);
        return true;
    }

    function setWellTopologyError(wellId, error, requestId = null, meta = {}) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const errorRequestId = toSafeRequestId(requestId, entry.latestRequestId);
        if (errorRequestId < entry.latestRequestId) return false;

        entry.latestRequestId = errorRequestId;
        entry.loading = false;
        entry.error = String(error?.message || error || 'Topology request failed.');
        const record = ensureRequestLineageRecord(entry, normalizeWellId(wellId), errorRequestId, {
            startedAt: meta?.startedAt
        });
        record.status = REQUEST_LINEAGE_STATUS_FAILED;
        record.completedAt = normalizeTimestamp(meta?.completedAt, createNowTimestamp());
        record.error = entry.error;
        record.resultRequestId = null;
        record.resultSummary = null;
        applyLineageMeta(record, meta);
        return true;
    }

    function setWellRequestCancelled(wellId, requestId = null, meta = {}) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const cancelledRequestId = toSafeRequestId(requestId, entry.latestRequestId);
        if (cancelledRequestId < entry.latestRequestId) return false;

        entry.latestRequestId = cancelledRequestId;
        entry.loading = false;
        const record = ensureRequestLineageRecord(entry, normalizeWellId(wellId), cancelledRequestId, {
            startedAt: meta?.startedAt
        });
        record.status = REQUEST_LINEAGE_STATUS_CANCELLED;
        record.completedAt = normalizeTimestamp(meta?.completedAt, createNowTimestamp());
        record.error = null;
        record.resultRequestId = null;
        record.resultSummary = null;
        applyLineageMeta(record, meta);
        return true;
    }

    function setWellRequestGeometryReady(wellId, requestId, geometryReadyRequestId = requestId) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const safeRequestId = toSafeRequestId(requestId, null);
        if (!safeRequestId) return false;
        const safeGeometryReadyRequestId = toSafeRequestId(geometryReadyRequestId, safeRequestId);
        const record = ensureRequestLineageRecord(entry, normalizeWellId(wellId), safeRequestId);
        record.geometryReadyRequestId = safeGeometryReadyRequestId;
        return true;
    }

    function exportWellTopologyLineage(wellId) {
        const normalizedWellId = normalizeWellId(wellId);
        const entry = getWellEntry(normalizedWellId);
        const result = entry?.result && typeof entry.result === 'object' ? entry.result : null;

        return {
            exportedAt: createNowTimestamp(),
            wellId: normalizedWellId,
            latestRequestId: entry ? toSafeRequestId(entry.latestRequestId, null) : null,
            loading: entry?.loading === true,
            error: entry?.error ? String(entry.error) : null,
            updatedAt: entry?.updatedAt ?? null,
            resultRequestId: toSafeRequestId(result?.requestId, null),
            resultSummary: createTopologyResultSummary(result),
            requestLineage: cloneRequestLineage(entry?.requestLineage)
        };
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
        setWellRequestGeometryReady,
        exportWellTopologyLineage,
        clearWellTopology
    };
});
