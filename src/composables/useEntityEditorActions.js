import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { createRowId, getRowIdPrefixForKey } from '@/utils/rowIdentity.js';
import { resolveSelectionRowTarget } from '@/app/selectionRowLocator.js';
import {
  createHierarchyDefaultRow,
  getHierarchyDomainMeta,
  mergeHierarchyDomainRows,
  resolveHierarchyRowsForDomain
} from '@/workspace/hierarchyDomainMeta.js';

const ENTITY_TYPE_TO_DOMAIN_KEY = Object.freeze({
  casing: 'casing',
  tubing: 'tubing',
  drillString: 'drillString',
  drillstring: 'drillString',
  equipment: 'equipment',
  line: 'lines',
  lines: 'lines',
  plug: 'plugs',
  plugs: 'plugs',
  fluid: 'fluids',
  fluids: 'fluids',
  marker: 'markers',
  markers: 'markers',
  box: 'boxes',
  boxes: 'boxes',
  topologySource: 'topologySources',
  topologysource: 'topologySources',
  topologySources: 'topologySources',
  topologyBreakout: 'topologyBreakouts',
  topologybreakout: 'topologyBreakouts',
  topologyBreakouts: 'topologyBreakouts',
  trajectory: 'trajectory'
});

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeToken(value) {
  return String(value ?? '').trim();
}

function getCanonicalEntityTypeForDomain(domainKey) {
  if (domainKey === 'lines') return 'line';
  if (domainKey === 'plugs') return 'plug';
  if (domainKey === 'fluids') return 'fluid';
  if (domainKey === 'markers') return 'marker';
  if (domainKey === 'boxes') return 'box';
  if (domainKey === 'topologySources') return 'topologySource';
  if (domainKey === 'topologyBreakouts') return 'topologyBreakout';
  return domainKey;
}

function setNestedValue(target = {}, pathTokens = [], value) {
  if (!Array.isArray(pathTokens) || pathTokens.length === 0) return target;
  const next = { ...target };
  let cursor = next;

  for (let index = 0; index < pathTokens.length - 1; index += 1) {
    const token = pathTokens[index];
    const current = cursor[token];
    cursor[token] = current && typeof current === 'object' && !Array.isArray(current)
      ? { ...current }
      : {};
    cursor = cursor[token];
  }

  const tailToken = pathTokens[pathTokens.length - 1];
  cursor[tailToken] = value;
  return next;
}

function moveArrayItem(rows, fromIndex, toIndex) {
  const next = rows.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function clampIndex(index, maxInclusive) {
  if (!Number.isFinite(index)) return 0;
  const parsed = Math.trunc(index);
  if (parsed < 0) return 0;
  if (parsed > maxInclusive) return maxInclusive;
  return parsed;
}

export function resolveEntityEditorDomainKey(entityType) {
  const token = normalizeToken(entityType);
  if (!token) return null;
  return ENTITY_TYPE_TO_DOMAIN_KEY[token] ?? ENTITY_TYPE_TO_DOMAIN_KEY[token.toLowerCase()] ?? null;
}

export function useEntityEditorActions() {
  const projectDataStore = useProjectDataStore();

  function resolveDomainContext(entityType) {
    const domainKey = resolveEntityEditorDomainKey(entityType);
    if (!domainKey) return null;
    const domainMeta = getHierarchyDomainMeta(domainKey);
    if (!domainMeta) return null;
    const storeRows = toSafeArray(projectDataStore[domainMeta.storeKey]);
    const domainRows = resolveHierarchyRowsForDomain(domainKey, projectDataStore);
    return {
      domainKey,
      domainMeta,
      storeRows,
      domainRows,
      canonicalEntityType: getCanonicalEntityTypeForDomain(domainKey)
    };
  }

  function commitDomainRows(context, nextDomainRows) {
    const mergedRows = mergeHierarchyDomainRows(
      context.domainKey,
      context.storeRows,
      nextDomainRows
    );
    projectDataStore.setProjectData(context.domainMeta.storeKey, mergedRows);
    return true;
  }

  function updateField({ entityType, rowId, field, value }) {
    const normalizedField = normalizeToken(field);
    if (!normalizedField) return false;

    const target = resolveSelectionRowTarget(projectDataStore, {
      entityType,
      rowId
    });
    if (!target) return false;

    const pathTokens = normalizedField
      .split('.')
      .map((token) => normalizeToken(token))
      .filter((token) => token.length > 0);
    if (pathTokens.length === 0) return false;

    if (pathTokens.length === 1) {
      return projectDataStore.updateProjectRow(
        target.storeKey,
        target.storeRowIndex,
        { [pathTokens[0]]: value }
      );
    }

    const rootField = pathTokens[0];
    const nestedTokens = pathTokens.slice(1);
    const sourceRow = target.row && typeof target.row === 'object' ? target.row : {};
    const rootSource = sourceRow[rootField] && typeof sourceRow[rootField] === 'object' && !Array.isArray(sourceRow[rootField])
      ? sourceRow[rootField]
      : {};
    const nextRootValue = setNestedValue(rootSource, nestedTokens, value);

    return projectDataStore.updateProjectRow(
      target.storeKey,
      target.storeRowIndex,
      { [rootField]: nextRootValue }
    );
  }

  function addRow({ entityType, afterRowId = null } = {}) {
    const context = resolveDomainContext(entityType);
    if (!context) return null;

    const defaultRow = createHierarchyDefaultRow(context.domainKey);
    const nextRow = {
      ...defaultRow,
      rowId: createRowId(getRowIdPrefixForKey(context.domainMeta.storeKey))
    };

    const rows = context.domainRows.slice();
    if (afterRowId) {
      const anchorIndex = rows.findIndex((row) => normalizeToken(row?.rowId) === normalizeToken(afterRowId));
      const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : rows.length;
      rows.splice(insertIndex, 0, nextRow);
    } else {
      rows.push(nextRow);
    }

    commitDomainRows(context, rows);
    return nextRow.rowId;
  }

  function duplicateRow({ entityType, rowId } = {}) {
    const context = resolveDomainContext(entityType);
    if (!context) return null;

    const sourceIndex = context.domainRows.findIndex((row) => normalizeToken(row?.rowId) === normalizeToken(rowId));
    if (sourceIndex < 0) return null;

    const sourceRow = context.domainRows[sourceIndex];
    const duplicatedRow = {
      ...sourceRow,
      rowId: createRowId(getRowIdPrefixForKey(context.domainMeta.storeKey))
    };

    const rows = context.domainRows.slice();
    rows.splice(sourceIndex + 1, 0, duplicatedRow);
    commitDomainRows(context, rows);
    return duplicatedRow.rowId;
  }

  function deleteRow({ entityType, rowId } = {}) {
    const context = resolveDomainContext(entityType);
    if (!context) return false;

    const nextRows = context.domainRows.filter((row) => normalizeToken(row?.rowId) !== normalizeToken(rowId));
    if (nextRows.length === context.domainRows.length) return false;
    return commitDomainRows(context, nextRows);
  }

  function moveRow({ entityType, rowId, direction } = {}) {
    const context = resolveDomainContext(entityType);
    if (!context) return false;

    const currentIndex = context.domainRows.findIndex((row) => normalizeToken(row?.rowId) === normalizeToken(rowId));
    if (currentIndex < 0) return false;

    const normalizedDirection = normalizeToken(direction).toLowerCase();
    const nextIndex = normalizedDirection === 'up'
      ? currentIndex - 1
      : normalizedDirection === 'down'
        ? currentIndex + 1
        : currentIndex;
    if (nextIndex < 0 || nextIndex >= context.domainRows.length || nextIndex === currentIndex) return false;

    const reorderedRows = moveArrayItem(context.domainRows, currentIndex, nextIndex);
    return commitDomainRows(context, reorderedRows);
  }

  function moveRowToIndex({ entityType, rowId, targetIndex } = {}) {
    const context = resolveDomainContext(entityType);
    if (!context) return false;
    if (context.domainRows.length <= 1) return false;

    const currentIndex = context.domainRows.findIndex((row) => normalizeToken(row?.rowId) === normalizeToken(rowId));
    if (currentIndex < 0) return false;

    const boundedTargetIndex = clampIndex(targetIndex, context.domainRows.length - 1);
    if (boundedTargetIndex === currentIndex) return false;

    const reorderedRows = moveArrayItem(context.domainRows, currentIndex, boundedTargetIndex);
    return commitDomainRows(context, reorderedRows);
  }

  return {
    updateField,
    addRow,
    duplicateRow,
    deleteRow,
    moveRow,
    moveRowToIndex,
    resolveEntityEditorDomainKey
  };
}
