const TERMINAL_EVENT_BY_STATUS = Object.freeze({
  succeeded: 'request_succeeded',
  failed: 'request_failed',
  cancelled: 'request_cancelled'
});

function toRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeWellId(value) {
  const token = String(value ?? '').trim();
  return token || null;
}

function normalizeRequestStatus(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'started') return 'started';
  if (token === 'succeeded') return 'succeeded';
  if (token === 'failed') return 'failed';
  if (token === 'cancelled') return 'cancelled';
  return 'started';
}

function normalizeGeometryStatus(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'pending') return 'pending';
  if (token === 'ready') return 'ready';
  if (token === 'not_required') return 'not_required';
  if (token === 'unknown') return 'unknown';
  return 'unknown';
}

function normalizeViewMode(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'vertical') return 'vertical';
  if (token === 'directional') return 'directional';
  return null;
}

function normalizeTimestamp(value) {
  const token = String(value ?? '').trim();
  if (!token) return null;
  const asDate = new Date(token);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString();
}

function toSafeRequestId(value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return null;
}

function toEventType(value) {
  const token = String(value ?? '').trim();
  return token || 'unknown';
}

function toWellFilterSet(wellIds = []) {
  const safeWellIds = new Set();
  toArray(wellIds).forEach((wellId) => {
    const normalized = normalizeWellId(wellId);
    if (normalized) safeWellIds.add(normalized);
  });
  return safeWellIds;
}

function shouldIncludeWell(wellId, filterSet = new Set()) {
  if (filterSet.size === 0) return true;
  return filterSet.has(wellId);
}

function normalizeReplayRecord(record = {}) {
  const source = toRecord(record);
  return {
    requestId: toSafeRequestId(source.requestId),
    status: normalizeRequestStatus(source.status),
    viewMode: normalizeViewMode(source.viewMode),
    geometryStatus: normalizeGeometryStatus(source.geometryStatus),
    geometryRequestId: toSafeRequestId(source.geometryRequestId),
    geometryReadyRequestId: toSafeRequestId(source.geometryReadyRequestId),
    startedAt: normalizeTimestamp(source.startedAt),
    completedAt: normalizeTimestamp(source.completedAt),
    error: String(source.error ?? '').trim() || null,
    events: toArray(source.events)
  };
}

function buildFallbackEventsForRecord(record = {}) {
  const events = [];
  if (record.startedAt) {
    events.push({
      type: 'request_started',
      at: record.startedAt
    });
  }
  const terminalEventType = TERMINAL_EVENT_BY_STATUS[record.status] ?? null;
  if (terminalEventType && record.completedAt) {
    events.push({
      type: terminalEventType,
      at: record.completedAt
    });
  }
  return events;
}

function normalizeReplayEvents(record = {}) {
  const sourceEvents = toArray(record.events);
  if (sourceEvents.length > 0) {
    return sourceEvents.map((event) => {
      const source = toRecord(event);
      return {
        type: toEventType(source.type),
        at: normalizeTimestamp(source.at),
        status: normalizeRequestStatus(source.status ?? record.status),
        geometryStatus: normalizeGeometryStatus(source.geometryStatus ?? record.geometryStatus),
        geometryRequestId: toSafeRequestId(source.geometryRequestId ?? record.geometryRequestId),
        geometryReadyRequestId: toSafeRequestId(source.geometryReadyRequestId ?? record.geometryReadyRequestId),
        resultRequestId: toSafeRequestId(source.resultRequestId),
        error: String(source.error ?? record.error ?? '').trim() || null
      };
    });
  }

  return buildFallbackEventsForRecord(record).map((event) => ({
    type: event.type,
    at: event.at,
    status: record.status,
    geometryStatus: record.geometryStatus,
    geometryRequestId: record.geometryRequestId,
    geometryReadyRequestId: record.geometryReadyRequestId,
    resultRequestId: null,
    error: record.error
  }));
}

function normalizeReplayWells(bundle = {}, options = {}) {
  const filterSet = toWellFilterSet(options.wellIds);
  return toArray(bundle.wells)
    .map((well) => {
      const source = toRecord(well);
      return {
        wellId: normalizeWellId(source.wellId),
        requestLineage: toArray(source.requestLineage).map(normalizeReplayRecord)
      };
    })
    .filter((well) => well.wellId && shouldIncludeWell(well.wellId, filterSet));
}

function compareReplayRows(left, right) {
  const leftTime = normalizeTimestamp(left?.eventAt);
  const rightTime = normalizeTimestamp(right?.eventAt);
  if (leftTime && rightTime && leftTime !== rightTime) {
    return leftTime.localeCompare(rightTime);
  }
  if (leftTime && !rightTime) return -1;
  if (!leftTime && rightTime) return 1;

  const leftWellId = normalizeWellId(left?.wellId) ?? '';
  const rightWellId = normalizeWellId(right?.wellId) ?? '';
  if (leftWellId !== rightWellId) return leftWellId.localeCompare(rightWellId);

  const leftRequestId = toSafeRequestId(left?.requestId) ?? Number.MAX_SAFE_INTEGER;
  const rightRequestId = toSafeRequestId(right?.requestId) ?? Number.MAX_SAFE_INTEGER;
  if (leftRequestId !== rightRequestId) return leftRequestId - rightRequestId;

  const leftIndex = Number.isInteger(left?.eventIndex) ? left.eventIndex : Number.MAX_SAFE_INTEGER;
  const rightIndex = Number.isInteger(right?.eventIndex) ? right.eventIndex : Number.MAX_SAFE_INTEGER;
  return leftIndex - rightIndex;
}

function createEmptyRequestStatusCounts() {
  return {
    started: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0
  };
}

function createEmptyEventTypeCounts() {
  return {
    request_started: 0,
    geometry_ready: 0,
    request_succeeded: 0,
    request_failed: 0,
    request_cancelled: 0
  };
}

function createEmptyAnomalyCounts() {
  return {
    outOfOrderEventCount: 0,
    missingStartEventCount: 0,
    missingTerminalEventCount: 0,
    directionalSucceededWithoutGeometryReadyCount: 0
  };
}

function hasOutOfOrderEvents(events = []) {
  let previous = null;
  for (const event of events) {
    const timestamp = normalizeTimestamp(event?.at);
    if (!timestamp) continue;
    if (previous && timestamp < previous) return true;
    previous = timestamp;
  }
  return false;
}

function hasStartEvent(events = []) {
  return toArray(events).some((event) => toEventType(event?.type) === 'request_started');
}

function hasTerminalEvent(events = [], status = 'started') {
  const terminalType = TERMINAL_EVENT_BY_STATUS[normalizeRequestStatus(status)];
  if (!terminalType) return false;
  return toArray(events).some((event) => toEventType(event?.type) === terminalType);
}

export function buildTopologyAuditReplayRows(bundle = {}, options = {}) {
  const wells = normalizeReplayWells(toRecord(bundle), options);
  const rows = [];

  wells.forEach((well) => {
    well.requestLineage.forEach((record) => {
      const events = normalizeReplayEvents(record);
      events.forEach((event, eventIndex) => {
        const eventType = toEventType(event.type);
        rows.push({
          rowId: `${well.wellId}:${record.requestId ?? 'unknown'}:${eventIndex}:${eventType}`,
          wellId: well.wellId,
          requestId: record.requestId,
          eventIndex,
          eventType,
          eventAt: normalizeTimestamp(event.at),
          requestStatus: normalizeRequestStatus(record.status),
          viewMode: normalizeViewMode(record.viewMode),
          geometryStatus: normalizeGeometryStatus(event.geometryStatus ?? record.geometryStatus),
          geometryRequestId: toSafeRequestId(event.geometryRequestId ?? record.geometryRequestId),
          geometryReadyRequestId: toSafeRequestId(event.geometryReadyRequestId ?? record.geometryReadyRequestId),
          resultRequestId: toSafeRequestId(event.resultRequestId),
          error: String(event.error ?? record.error ?? '').trim() || null
        });
      });
    });
  });

  return rows.sort(compareReplayRows);
}

export function buildTopologyAuditReplaySummary(bundle = {}, options = {}) {
  const wells = normalizeReplayWells(toRecord(bundle), options);
  const rows = buildTopologyAuditReplayRows(bundle, options);
  const requestStatusCounts = createEmptyRequestStatusCounts();
  const eventTypeCounts = createEmptyEventTypeCounts();
  const anomalyCounts = createEmptyAnomalyCounts();

  wells.forEach((well) => {
    well.requestLineage.forEach((record) => {
      const status = normalizeRequestStatus(record.status);
      requestStatusCounts[status] += 1;

      const events = normalizeReplayEvents(record);
      if (hasOutOfOrderEvents(events)) {
        anomalyCounts.outOfOrderEventCount += 1;
      }
      if (!hasStartEvent(events)) {
        anomalyCounts.missingStartEventCount += 1;
      }
      const isTerminal = Boolean(TERMINAL_EVENT_BY_STATUS[status]);
      if (isTerminal && !hasTerminalEvent(events, status)) {
        anomalyCounts.missingTerminalEventCount += 1;
      }
      if (
        status === 'succeeded'
        && normalizeViewMode(record.viewMode) === 'directional'
        && normalizeGeometryStatus(record.geometryStatus) !== 'ready'
      ) {
        anomalyCounts.directionalSucceededWithoutGeometryReadyCount += 1;
      }
    });
  });

  rows.forEach((row) => {
    const eventType = toEventType(row.eventType);
    if (!Object.hasOwn(eventTypeCounts, eventType)) {
      eventTypeCounts[eventType] = 0;
    }
    eventTypeCounts[eventType] += 1;
  });

  return {
    wellCount: wells.length,
    requestCount: wells.reduce((count, well) => count + well.requestLineage.length, 0),
    eventCount: rows.length,
    requestStatusCounts,
    eventTypeCounts,
    anomalyCounts
  };
}

export function resolveTopologyAuditReplayRequest(bundle = {}, wellId, requestId) {
  const targetWellId = normalizeWellId(wellId);
  const targetRequestId = toSafeRequestId(requestId);
  if (!targetWellId || !targetRequestId) return null;

  const wells = normalizeReplayWells(toRecord(bundle), { wellIds: [targetWellId] });
  const targetWell = wells.find((well) => well.wellId === targetWellId) ?? null;
  if (!targetWell) return null;
  const targetRecord = targetWell.requestLineage.find((record) => record.requestId === targetRequestId) ?? null;
  if (!targetRecord) return null;

  const events = normalizeReplayEvents(targetRecord)
    .map((event) => ({
      type: toEventType(event.type),
      at: normalizeTimestamp(event.at),
      status: normalizeRequestStatus(event.status ?? targetRecord.status),
      geometryStatus: normalizeGeometryStatus(event.geometryStatus ?? targetRecord.geometryStatus),
      geometryRequestId: toSafeRequestId(event.geometryRequestId ?? targetRecord.geometryRequestId),
      geometryReadyRequestId: toSafeRequestId(event.geometryReadyRequestId ?? targetRecord.geometryReadyRequestId),
      resultRequestId: toSafeRequestId(event.resultRequestId),
      error: String(event.error ?? targetRecord.error ?? '').trim() || null
    }))
    .sort((left, right) => compareReplayRows(
      { wellId: targetWellId, requestId: targetRequestId, eventIndex: 0, eventAt: left.at },
      { wellId: targetWellId, requestId: targetRequestId, eventIndex: 0, eventAt: right.at }
    ));

  return {
    wellId: targetWellId,
    requestId: targetRequestId,
    status: normalizeRequestStatus(targetRecord.status),
    viewMode: normalizeViewMode(targetRecord.viewMode),
    geometryStatus: normalizeGeometryStatus(targetRecord.geometryStatus),
    hasStartEvent: hasStartEvent(events),
    hasTerminalEvent: hasTerminalEvent(events, targetRecord.status),
    events
  };
}

export default {
  buildTopologyAuditReplayRows,
  buildTopologyAuditReplaySummary,
  resolveTopologyAuditReplayRequest
};
