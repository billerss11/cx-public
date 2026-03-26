import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { createRowId, getRowIdPrefixForKey } from '@/utils/rowIdentity.js';
import { resolveSelectionRowTarget } from '@/app/selectionRowLocator.js';
import {
  createHierarchyDefaultRow,
  getHierarchyDomainMeta,
  mergeHierarchyDomainRows,
  resolveHierarchyRowsForDomain
} from '@/workspace/hierarchyDomainMeta.js';
import {
  resolveCanonicalEntityTypeForDomain,
  resolveDomainKeyFromEntityType
} from '@/workspace/domainRegistry.js';
const DELETE_UNDO_STACK_MAX = 50;
const deleteUndoStack = [];

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeToken(value) {
  return String(value ?? '').trim();
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

function cloneRowSnapshot(row) {
  if (!row || typeof row !== 'object') return null;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(row);
    } catch (_error) {
      // Fallback to JSON clone below.
    }
  }
  try {
    return JSON.parse(JSON.stringify(row));
  } catch (_error) {
    return { ...row };
  }
}

function pushDeleteUndoEntry(entry) {
  if (!entry || typeof entry !== 'object') return;
  deleteUndoStack.push(entry);
  if (deleteUndoStack.length > DELETE_UNDO_STACK_MAX) {
    deleteUndoStack.splice(0, deleteUndoStack.length - DELETE_UNDO_STACK_MAX);
  }
}

export function clearDeleteUndoHistory() {
  deleteUndoStack.length = 0;
}

export function resolveEntityEditorDomainKey(entityType) {
  return resolveDomainKeyFromEntityType(entityType);
}

export function useEntityEditorActions() {
  const projectDataStore = useProjectDataStore();
  const projectStore = useProjectStore();

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
      canonicalEntityType: resolveCanonicalEntityTypeForDomain(domainKey) ?? domainKey
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

  function updateFields({ entityType, rowId, patch } = {}) {
    const target = resolveSelectionRowTarget(projectDataStore, {
      entityType,
      rowId
    });
    if (!target) return false;

    const sourceRow = target.row && typeof target.row === 'object' ? target.row : {};
    const entries = Object.entries(patch && typeof patch === 'object' ? patch : {});
    if (entries.length === 0) return false;

    const nextPatch = entries.reduce((accumulator, [field, value]) => {
      const normalizedField = normalizeToken(field);
      if (!normalizedField) return accumulator;

      const pathTokens = normalizedField
        .split('.')
        .map((token) => normalizeToken(token))
        .filter((token) => token.length > 0);
      if (pathTokens.length === 0) return accumulator;

      if (pathTokens.length === 1) {
        accumulator[pathTokens[0]] = value;
        return accumulator;
      }

      const rootField = pathTokens[0];
      const nestedTokens = pathTokens.slice(1);
      const rootSource = accumulator[rootField] && typeof accumulator[rootField] === 'object' && !Array.isArray(accumulator[rootField])
        ? accumulator[rootField]
        : (sourceRow[rootField] && typeof sourceRow[rootField] === 'object' && !Array.isArray(sourceRow[rootField])
          ? sourceRow[rootField]
          : {});
      accumulator[rootField] = setNestedValue(rootSource, nestedTokens, value);
      return accumulator;
    }, {});

    if (Object.keys(nextPatch).length === 0) return false;

    return projectDataStore.updateProjectRow(
      target.storeKey,
      target.storeRowIndex,
      nextPatch
    );
  }

  function updateField({ entityType, rowId, field, value }) {
    const normalizedField = normalizeToken(field);
    if (!normalizedField) return false;

    return updateFields({
      entityType,
      rowId,
      patch: {
        [normalizedField]: value
      }
    });
  }

  function addRow({ entityType, afterRowId = null, initialValues = null } = {}) {
    const context = resolveDomainContext(entityType);
    if (!context) return null;

    const defaultRow = createHierarchyDefaultRow(context.domainKey);
    const nextRow = {
      ...defaultRow,
      ...(initialValues && typeof initialValues === 'object' ? initialValues : {}),
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

    const targetRowId = normalizeToken(rowId);
    const deleteIndex = context.domainRows.findIndex((row) => normalizeToken(row?.rowId) === targetRowId);
    if (deleteIndex < 0) return false;

    const deletedRow = context.domainRows[deleteIndex];
    const nextRows = context.domainRows.slice();
    nextRows.splice(deleteIndex, 1);

    const committed = commitDomainRows(context, nextRows);
    if (!committed) return false;

    pushDeleteUndoEntry({
      wellId: normalizeToken(projectStore.activeWellId) || null,
      entityType: context.canonicalEntityType,
      domainIndex: deleteIndex,
      row: cloneRowSnapshot(deletedRow)
    });

    return true;
  }

  function undoLastDelete() {
    const lastEntry = deleteUndoStack.pop();
    if (!lastEntry) return null;

    const targetWellId = normalizeToken(lastEntry.wellId) || null;
    if (targetWellId) {
      const switched = projectStore.setActiveWell(targetWellId);
      const activeWellId = normalizeToken(projectStore.activeWellId) || null;
      if (!switched && activeWellId !== targetWellId) {
        return null;
      }
    }

    const context = resolveDomainContext(lastEntry.entityType);
    if (!context) return null;

    const restoredSourceRow = cloneRowSnapshot(lastEntry.row);
    if (!restoredSourceRow || typeof restoredSourceRow !== 'object') return null;

    const rows = context.domainRows.slice();
    let restoredRow = { ...restoredSourceRow };
    const existingRowId = normalizeToken(restoredRow.rowId);
    const hasRowIdConflict = existingRowId && rows.some((row) => normalizeToken(row?.rowId) === existingRowId);
    if (hasRowIdConflict) {
      restoredRow.rowId = createRowId(getRowIdPrefixForKey(context.domainMeta.storeKey));
    }

    const insertIndex = clampIndex(lastEntry.domainIndex, rows.length);
    rows.splice(insertIndex, 0, restoredRow);

    const committed = commitDomainRows(context, rows);
    if (!committed) {
      pushDeleteUndoEntry(lastEntry);
      return null;
    }

    const restoredRowId = normalizeToken(restoredRow.rowId);
    return {
      wellId: targetWellId || normalizeToken(projectStore.activeWellId) || null,
      entityType: context.canonicalEntityType,
      rowId: restoredRowId || null
    };
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
    updateFields,
    addRow,
    duplicateRow,
    deleteRow,
    undoLastDelete,
    clearDeleteUndoHistory,
    moveRow,
    moveRowToIndex,
    resolveEntityEditorDomainKey
  };
}
