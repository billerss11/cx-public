import {
  filterScenarioBreakoutRows,
  isScenarioBreakoutRow
} from '@/topology/sourceRows.js';

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRowId(value) {
  const rowId = String(value ?? '').trim();
  return rowId.length > 0 ? rowId : null;
}

function createNavigationTarget(tabKey, tableType, rowIndex) {
  if (!tabKey || !tableType || !Number.isInteger(rowIndex) || rowIndex < 0) return null;
  return {
    tabKey,
    tableType,
    rowIndex
  };
}

function appendNavigationTargetsByRowId(navigationByRowId, rows, options = {}) {
  const tabKey = String(options?.tabKey ?? '').trim();
  const tableType = String(options?.tableType ?? '').trim();
  if (!tabKey || !tableType) return;

  toSafeArray(rows).forEach((row, rowIndex) => {
    const rowId = normalizeRowId(row?.rowId);
    if (!rowId) return;

    const navigationTarget = createNavigationTarget(tabKey, tableType, rowIndex);
    if (!navigationTarget) return;
    navigationByRowId.set(rowId, navigationTarget);
  });
}

export function buildTopologySourceNavigationByRowId(sourceRows = []) {
  const navigationByRowId = new Map();
  const normalizedRows = toSafeArray(sourceRows);

  normalizedRows.forEach((row, rowIndex) => {
    const rowId = normalizeRowId(row?.rowId);
    if (!rowId || isScenarioBreakoutRow(row)) return;

    const navigationTarget = createNavigationTarget('topologySources', 'topologySource', rowIndex);
    if (!navigationTarget) return;
    navigationByRowId.set(rowId, navigationTarget);
  });

  const breakoutRows = filterScenarioBreakoutRows(normalizedRows);
  breakoutRows.forEach((row, rowIndex) => {
    const rowId = normalizeRowId(row?.rowId);
    if (!rowId) return;

    const navigationTarget = createNavigationTarget('topologyBreakouts', 'topologyBreakout', rowIndex);
    if (!navigationTarget) return;
    navigationByRowId.set(rowId, navigationTarget);
  });

  return navigationByRowId;
}

export function buildTopologyWarningNavigationByRowId({
  sourceRows = [],
  equipmentRows = [],
  markerRows = []
} = {}) {
  const navigationByRowId = new Map();

  appendNavigationTargetsByRowId(navigationByRowId, equipmentRows, {
    tabKey: 'equipment',
    tableType: 'equipment'
  });

  appendNavigationTargetsByRowId(navigationByRowId, markerRows, {
    tabKey: 'markers',
    tableType: 'marker'
  });

  const sourceNavigationByRowId = buildTopologySourceNavigationByRowId(sourceRows);
  sourceNavigationByRowId.forEach((target, rowId) => {
    navigationByRowId.set(rowId, target);
  });

  return navigationByRowId;
}

export function resolveTopologyWarningRowNavigationTarget(rowId, navigationByRowId) {
  const normalizedRowId = normalizeRowId(rowId);
  if (!normalizedRowId || !(navigationByRowId instanceof Map)) return null;
  return navigationByRowId.get(normalizedRowId) ?? null;
}

export default {
  buildTopologySourceNavigationByRowId,
  buildTopologyWarningNavigationByRowId,
  resolveTopologyWarningRowNavigationTarget
};
