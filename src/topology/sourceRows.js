import { parseOptionalNumber } from '@/utils/general.js';
import {
    TOPOLOGY_EPSILON,
    normalizeSourceVolumeKind
} from '@/topology/topologyTypes.js';

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

export function isSourceRowVisible(sourceRow) {
    return sourceRow?.show !== false && sourceRow?.enabled !== false;
}

export function resolveSourceDepthRange(sourceRow = {}) {
    const explicitTop = parseOptionalNumber(sourceRow?.top ?? sourceRow?.depthTop ?? sourceRow?.startDepth);
    const explicitBottom = parseOptionalNumber(sourceRow?.bottom ?? sourceRow?.depthBottom ?? sourceRow?.endDepth);
    const pointDepth = parseOptionalNumber(sourceRow?.depth ?? sourceRow?.md);

    if (Number.isFinite(explicitTop) && Number.isFinite(explicitBottom)) {
        if (explicitBottom < explicitTop) return null;
        return {
            top: explicitTop,
            bottom: explicitBottom,
            isPoint: Math.abs(explicitBottom - explicitTop) <= TOPOLOGY_EPSILON
        };
    }

    if (Number.isFinite(explicitTop)) {
        return {
            top: explicitTop,
            bottom: explicitTop,
            isPoint: true
        };
    }

    if (Number.isFinite(explicitBottom)) {
        return {
            top: explicitBottom,
            bottom: explicitBottom,
            isPoint: true
        };
    }

    if (!Number.isFinite(pointDepth)) return null;
    return {
        top: pointDepth,
        bottom: pointDepth,
        isPoint: true
    };
}

function rangesOverlap(range, interval) {
    if (!range || !interval) return false;
    return range.bottom > interval.top + TOPOLOGY_EPSILON && range.top < interval.bottom - TOPOLOGY_EPSILON;
}

export function intervalIntersectsSourceRange(interval, depthRange) {
    if (!interval || !depthRange) return false;
    if (depthRange.isPoint) {
        return depthRange.top >= interval.top - TOPOLOGY_EPSILON
            && depthRange.top <= interval.bottom + TOPOLOGY_EPSILON;
    }
    return rangesOverlap(depthRange, interval);
}

function resolveVolumeToken(value) {
    const token = String(value ?? '').trim();
    return token || null;
}

export function resolveScenarioBreakoutVolumePair(sourceRow = {}) {
    const fromToken = resolveVolumeToken(sourceRow?.fromVolumeKey ?? sourceRow?.fromVolume);
    const toToken = resolveVolumeToken(sourceRow?.toVolumeKey ?? sourceRow?.toVolume);
    return {
        fromVolumeKey: fromToken,
        toVolumeKey: toToken,
        fromKind: normalizeSourceVolumeKind(fromToken),
        toKind: normalizeSourceVolumeKind(toToken)
    };
}

export function isScenarioBreakoutRow(sourceRow = {}) {
    const pair = resolveScenarioBreakoutVolumePair(sourceRow);
    return Boolean(pair.fromVolumeKey || pair.toVolumeKey);
}

export function filterScenarioBreakoutRows(sourceRows = []) {
    return toSafeArray(sourceRows).filter((sourceRow) => isScenarioBreakoutRow(sourceRow));
}

export function mergeScenarioBreakoutRows(sourceRows = [], breakoutRows = []) {
    const baseRows = toSafeArray(sourceRows);
    const breakoutEditorRows = filterScenarioBreakoutRows(breakoutRows);
    const breakoutByRowId = new Map();
    const breakoutRowsWithoutStableId = [];

    breakoutEditorRows.forEach((row) => {
        const rowId = String(row?.rowId ?? '').trim();
        if (rowId) {
            breakoutByRowId.set(rowId, row);
            return;
        }
        breakoutRowsWithoutStableId.push(row);
    });

    const mergedRows = [];
    baseRows.forEach((row) => {
        if (!isScenarioBreakoutRow(row)) {
            mergedRows.push(row);
            return;
        }

        const rowId = String(row?.rowId ?? '').trim();
        if (!rowId || !breakoutByRowId.has(rowId)) return;

        mergedRows.push(breakoutByRowId.get(rowId));
        breakoutByRowId.delete(rowId);
    });

    breakoutByRowId.forEach((row) => {
        mergedRows.push(row);
    });

    breakoutRowsWithoutStableId.forEach((row) => {
        mergedRows.push(row);
    });

    return mergedRows;
}

export default {
    isSourceRowVisible,
    resolveSourceDepthRange,
    intervalIntersectsSourceRange,
    resolveScenarioBreakoutVolumePair,
    isScenarioBreakoutRow,
    filterScenarioBreakoutRows,
    mergeScenarioBreakoutRows
};
