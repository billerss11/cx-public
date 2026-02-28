import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import { useProjectStore } from '@/stores/projectStore.js';

const REQUEST_LINEAGE_STATUS_STARTED = 'started';
const REQUEST_LINEAGE_STATUS_SUCCEEDED = 'succeeded';
const REQUEST_LINEAGE_STATUS_FAILED = 'failed';
const REQUEST_LINEAGE_STATUS_CANCELLED = 'cancelled';
const REQUEST_LINEAGE_EVENT_REQUEST_STARTED = 'request_started';
const REQUEST_LINEAGE_EVENT_REQUEST_SUCCEEDED = 'request_succeeded';
const REQUEST_LINEAGE_EVENT_REQUEST_FAILED = 'request_failed';
const REQUEST_LINEAGE_EVENT_REQUEST_CANCELLED = 'request_cancelled';
const REQUEST_LINEAGE_EVENT_GEOMETRY_READY = 'geometry_ready';
const REQUEST_LINEAGE_GEOMETRY_STATUS_PENDING = 'pending';
const REQUEST_LINEAGE_GEOMETRY_STATUS_READY = 'ready';
const REQUEST_LINEAGE_GEOMETRY_STATUS_NOT_REQUIRED = 'not_required';
const REQUEST_LINEAGE_GEOMETRY_STATUS_UNKNOWN = 'unknown';
const TOPOLOGY_REQUEST_LINEAGE_SCHEMA_VERSION = 'topology-request-lineage-v1';
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

function normalizeLineageStatus(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (token === REQUEST_LINEAGE_STATUS_STARTED) return REQUEST_LINEAGE_STATUS_STARTED;
    if (token === REQUEST_LINEAGE_STATUS_SUCCEEDED) return REQUEST_LINEAGE_STATUS_SUCCEEDED;
    if (token === REQUEST_LINEAGE_STATUS_FAILED) return REQUEST_LINEAGE_STATUS_FAILED;
    if (token === REQUEST_LINEAGE_STATUS_CANCELLED) return REQUEST_LINEAGE_STATUS_CANCELLED;
    return REQUEST_LINEAGE_STATUS_STARTED;
}

function normalizeGeometryStatus(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (token === REQUEST_LINEAGE_GEOMETRY_STATUS_PENDING) return REQUEST_LINEAGE_GEOMETRY_STATUS_PENDING;
    if (token === REQUEST_LINEAGE_GEOMETRY_STATUS_READY) return REQUEST_LINEAGE_GEOMETRY_STATUS_READY;
    if (token === REQUEST_LINEAGE_GEOMETRY_STATUS_NOT_REQUIRED) return REQUEST_LINEAGE_GEOMETRY_STATUS_NOT_REQUIRED;
    if (token === REQUEST_LINEAGE_GEOMETRY_STATUS_UNKNOWN) return REQUEST_LINEAGE_GEOMETRY_STATUS_UNKNOWN;
    return REQUEST_LINEAGE_GEOMETRY_STATUS_UNKNOWN;
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

function ensureRequestLineageEvents(record) {
    if (!Array.isArray(record?.events)) {
        record.events = [];
    }
    return record.events;
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
            geometryStatus: REQUEST_LINEAGE_GEOMETRY_STATUS_UNKNOWN,
            viewMode: null,
            events: []
        };
        records.push(record);
        trimWellRequestLineage(entry);
    }
    return record;
}

function resolveRecordGeometryStatus(record = {}) {
    const viewMode = normalizeViewMode(record?.viewMode);
    if (viewMode === 'vertical') {
        return REQUEST_LINEAGE_GEOMETRY_STATUS_NOT_REQUIRED;
    }
    if (viewMode !== 'directional') {
        return REQUEST_LINEAGE_GEOMETRY_STATUS_UNKNOWN;
    }

    const geometryRequestId = toSafeRequestId(record?.geometryRequestId, null);
    const geometryReadyRequestId = toSafeRequestId(record?.geometryReadyRequestId, null);
    if (geometryReadyRequestId !== null && (
        geometryRequestId === null
        || geometryReadyRequestId >= geometryRequestId
    )) {
        return REQUEST_LINEAGE_GEOMETRY_STATUS_READY;
    }
    if (geometryRequestId !== null || viewMode === 'directional') {
        return REQUEST_LINEAGE_GEOMETRY_STATUS_PENDING;
    }
    return REQUEST_LINEAGE_GEOMETRY_STATUS_UNKNOWN;
}

function refreshRecordGeometryStatus(record = {}) {
    record.geometryStatus = resolveRecordGeometryStatus(record);
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
    refreshRecordGeometryStatus(record);
}

function createRequestLineageEvent(record, type, options = {}) {
    const at = normalizeTimestamp(options?.at, createNowTimestamp());
    const safeType = String(type ?? '').trim() || REQUEST_LINEAGE_EVENT_REQUEST_STARTED;
    const event = {
        type: safeType,
        at,
        requestId: toSafeRequestId(record?.requestId, null),
        status: normalizeLineageStatus(record?.status),
        geometryRequestId: toSafeRequestId(record?.geometryRequestId, null),
        geometryReadyRequestId: toSafeRequestId(record?.geometryReadyRequestId, null),
        geometryStatus: normalizeGeometryStatus(record?.geometryStatus),
        resultRequestId: toSafeRequestId(record?.resultRequestId, null),
        error: record?.error ? String(record.error) : null
    };
    if (record?.resultSummary && typeof record.resultSummary === 'object') {
        event.resultSummary = { ...record.resultSummary };
    }
    return event;
}

function appendRequestLineageEvent(record, type, options = {}) {
    const events = ensureRequestLineageEvents(record);
    events.push(createRequestLineageEvent(record, type, options));
}

function cloneRequestLineageEvents(events = []) {
    if (!Array.isArray(events)) return [];
    return events.map((event) => {
        if (!event || typeof event !== 'object') return event;
        return {
            ...event,
            resultSummary: event?.resultSummary && typeof event.resultSummary === 'object'
                ? { ...event.resultSummary }
                : null
        };
    });
}

function cloneRequestLineage(records = []) {
    if (!Array.isArray(records)) return [];
    return records.map((record) => ({
        ...record,
        resultSummary: record?.resultSummary && typeof record.resultSummary === 'object'
            ? { ...record.resultSummary }
            : null,
        events: cloneRequestLineageEvents(record?.events)
    }));
}

function createEmptyStatusCounts() {
    return {
        started: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0
    };
}

function createEmptyGeometryStatusCounts() {
    return {
        pending: 0,
        ready: 0,
        not_required: 0,
        unknown: 0
    };
}

function normalizeAuditWellIds(wellIds = []) {
    if (!Array.isArray(wellIds)) return [];
    const unique = new Set();
    wellIds.forEach((wellId) => {
        const normalized = normalizeWellId(wellId);
        if (!normalized) return;
        unique.add(normalized);
    });
    return Array.from(unique);
}

function summarizeTopologyAuditLineage(wellExports = []) {
    const summary = {
        wellCount: Array.isArray(wellExports) ? wellExports.length : 0,
        requestCount: 0,
        statusCounts: createEmptyStatusCounts(),
        geometryStatusCounts: createEmptyGeometryStatusCounts(),
        latestCompletedAt: null
    };
    if (!Array.isArray(wellExports)) return summary;

    wellExports.forEach((wellExport) => {
        const lineage = Array.isArray(wellExport?.requestLineage) ? wellExport.requestLineage : [];
        summary.requestCount += lineage.length;
        lineage.forEach((record) => {
            const status = normalizeLineageStatus(record?.status);
            summary.statusCounts[status] = Number(summary.statusCounts[status] ?? 0) + 1;

            const geometryStatus = normalizeGeometryStatus(record?.geometryStatus);
            summary.geometryStatusCounts[geometryStatus] = Number(summary.geometryStatusCounts[geometryStatus] ?? 0) + 1;

            const completedAt = normalizeTimestamp(record?.completedAt, null);
            if (!completedAt) return;
            if (!summary.latestCompletedAt || completedAt > summary.latestCompletedAt) {
                summary.latestCompletedAt = completedAt;
            }
        });
    });
    return summary;
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
        appendRequestLineageEvent(record, REQUEST_LINEAGE_EVENT_REQUEST_STARTED, {
            at: record.startedAt
        });
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
        appendRequestLineageEvent(record, REQUEST_LINEAGE_EVENT_REQUEST_SUCCEEDED, {
            at: record.completedAt
        });
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
        appendRequestLineageEvent(record, REQUEST_LINEAGE_EVENT_REQUEST_FAILED, {
            at: record.completedAt
        });
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
        appendRequestLineageEvent(record, REQUEST_LINEAGE_EVENT_REQUEST_CANCELLED, {
            at: record.completedAt
        });
        return true;
    }

    function setWellRequestGeometryReady(wellId, requestId, geometryReadyRequestId = requestId) {
        const entry = ensureWellEntry(wellId);
        if (!entry) return false;

        const safeRequestId = toSafeRequestId(requestId, null);
        if (!safeRequestId) return false;
        const safeGeometryReadyRequestId = toSafeRequestId(geometryReadyRequestId, safeRequestId);
        const record = ensureRequestLineageRecord(entry, normalizeWellId(wellId), safeRequestId);
        const previousReadyRequestId = toSafeRequestId(record?.geometryReadyRequestId, null);
        record.geometryReadyRequestId = safeGeometryReadyRequestId;
        refreshRecordGeometryStatus(record);
        if (previousReadyRequestId !== safeGeometryReadyRequestId) {
            appendRequestLineageEvent(record, REQUEST_LINEAGE_EVENT_GEOMETRY_READY);
        }
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

    function exportTopologyAuditBundle(options = {}) {
        const providedWellIds = normalizeAuditWellIds(options?.wellIds);
        const wellIds = providedWellIds.length > 0
            ? providedWellIds
            : normalizeAuditWellIds(Object.keys(state.byWellId));
        const wells = wellIds.map((wellId) => exportWellTopologyLineage(wellId));
        return {
            exportedAt: createNowTimestamp(),
            schemaVersion: TOPOLOGY_REQUEST_LINEAGE_SCHEMA_VERSION,
            activeWellId: normalizeWellId(projectStore.activeWellId),
            wells,
            summary: summarizeTopologyAuditLineage(wells)
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
        exportTopologyAuditBundle,
        clearWellTopology
    };
});
