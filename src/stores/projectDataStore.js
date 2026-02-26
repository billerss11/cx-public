import { defineStore } from 'pinia';
import { reactive, toRefs } from 'vue';
import { createRowId, ensureRowsHaveRowIds, normalizeRowId } from '@/utils/rowIdentity.js';
import { buildCasingReferenceMap, resolveCasingReference } from '@/utils/casingReference.js';
import { parseOptionalNumber } from '@/utils/general.js';
import {
    buildPipeReferenceMap,
    normalizePipeHostType,
    PIPE_HOST_TYPE_CASING,
    PIPE_HOST_TYPE_TUBING,
    resolvePipeHostReference
} from '@/utils/pipeReference.js';
import {
    buildEquipmentAttachOptions,
    findEquipmentAttachOptionByHostAndId,
    findEquipmentAttachOptionByValue,
    isPackerEquipmentType,
    normalizeEquipmentAttachHostType
} from '@/utils/equipmentAttachReference.js';

export const PROJECT_DATA_KEYS = new Set([
    'casingData',
    'tubingData',
    'drillStringData',
    'equipmentData',
    'horizontalLines',
    'annotationBoxes',
    'userAnnotations',
    'cementPlugs',
    'annulusFluids',
    'markers',
    'topologySources',
    'trajectory'
]);

export function createDefaultProjectDataState() {
    return {
        casingData: [],
        tubingData: [],
        drillStringData: [],
        equipmentData: [],
        horizontalLines: [],
        annotationBoxes: [],
        userAnnotations: [],
        cementPlugs: [],
        annulusFluids: [],
        markers: [],
        topologySources: [],
        physicsIntervals: [],
        trajectory: [
            { rowId: createRowId('trajectory'), md: 0, inc: 0, azi: 0, comment: 'Surface' }
        ]
    };
}

function normalizeCasingAttachReferenceRow(row, casingRefMap, casingRows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

    const attachToId = normalizeRowId(row.attachToId);
    const attachToRow = String(row.attachToRow ?? '').trim();

    // UI currently edits legacy attachToRow. Treat it as source of truth when present.
    if (attachToRow) {
        const target = resolveCasingReference(attachToRow, casingRefMap, casingRows, null);
        const resolvedRowId = normalizeRowId(target?.rowId);
        if (!resolvedRowId) return row;
        if (resolvedRowId === attachToId) return row;

        return {
            ...row,
            attachToId: resolvedRowId
        };
    }

    if (!attachToId) return row;
    const byId = resolveCasingReference('', casingRefMap, casingRows, attachToId);
    if (byId) return row;

    return {
        ...row,
        attachToId: null
    };
}

function normalizeMarkerAttachReferenceRow(row, pipeReferenceMap) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

    const attachToId = normalizeRowId(row.attachToId);
    const attachToRow = String(row.attachToRow ?? '').trim();
    const rawHostType = String(row.attachToHostType ?? '').trim();
    const hasHostType = rawHostType.length > 0;
    const normalizedHostType = hasHostType
        ? normalizePipeHostType(rawHostType, PIPE_HOST_TYPE_CASING)
        : null;
    const effectiveHostType = normalizedHostType ?? PIPE_HOST_TYPE_CASING;

    const resolvedHost = resolvePipeHostReference(attachToRow, pipeReferenceMap, {
        preferredId: attachToId,
        hostType: effectiveHostType
    });
    const resolvedRowId = normalizeRowId(resolvedHost?.row?.rowId);

    let nextRow = row;

    if (hasHostType && normalizedHostType !== rawHostType) {
        nextRow = {
            ...nextRow,
            attachToHostType: normalizedHostType
        };
    }

    if (attachToRow) {
        if (!resolvedRowId || resolvedRowId === attachToId) return nextRow;
        return {
            ...nextRow,
            attachToId: resolvedRowId
        };
    }

    if (!attachToId || resolvedRowId) return nextRow;

    return {
        ...nextRow,
        attachToId: null
    };
}

function resolveAttachOptionByRowId(options = [], rowId) {
    const normalizedRowId = normalizeRowId(rowId);
    if (!normalizedRowId) return null;

    const matches = (Array.isArray(options) ? options : []).filter((option) => option.rowId === normalizedRowId);
    if (matches.length !== 1) return null;
    return matches[0];
}

function resolveInnermostHostRowAtDepth(rows = [], depth) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const hasDepth = Number.isFinite(depth);
    const candidates = safeRows.filter((row) => {
        const rowTop = Number(row?.top);
        const rowBottom = Number(row?.bottom);
        if (!Number.isFinite(rowTop) || !Number.isFinite(rowBottom) || rowBottom < rowTop) return false;
        if (!hasDepth) return true;
        return depth >= rowTop && depth <= rowBottom;
    });
    if (candidates.length === 0) return null;

    return candidates
        .slice()
        .sort((a, b) => {
            const aOd = Number(a?.od);
            const bOd = Number(b?.od);
            const safeA = Number.isFinite(aOd) ? aOd : Number.POSITIVE_INFINITY;
            const safeB = Number.isFinite(bOd) ? bOd : Number.POSITIVE_INFINITY;
            return safeA - safeB;
        })[0] ?? null;
}

function resolveLegacyPackerAttachOption(row, attachOptions, casingRows, tubingRows) {
    const depth = parseOptionalNumber(row?.depth);
    const preferredTubingRow = resolveInnermostHostRowAtDepth(tubingRows, depth);
    const preferredCasingRow = resolveInnermostHostRowAtDepth(casingRows, depth);
    const preferredHostType = preferredTubingRow
        ? PIPE_HOST_TYPE_TUBING
        : (preferredCasingRow ? PIPE_HOST_TYPE_CASING : null);
    const preferredRow = preferredTubingRow ?? preferredCasingRow;
    const preferredRowId = normalizeRowId(preferredRow?.rowId);
    if (!preferredHostType || !preferredRowId) return null;
    return findEquipmentAttachOptionByHostAndId(preferredHostType, preferredRowId, attachOptions);
}

function normalizeEquipmentAttachReferenceRow(row, pipeReferenceMap, casingRows, tubingRows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    if (!isPackerEquipmentType(row?.type)) return row;

    const attachOptions = buildEquipmentAttachOptions(casingRows, tubingRows);
    const attachToDisplay = String(row?.attachToDisplay ?? '').trim();
    const attachToRow = String(row?.attachToRow ?? '').trim();
    const attachToId = normalizeRowId(row?.attachToId);
    const normalizedHostType = normalizeEquipmentAttachHostType(row?.attachToHostType);

    let selectedOption = findEquipmentAttachOptionByValue(attachToDisplay, attachOptions);
    if (!selectedOption) {
        selectedOption = findEquipmentAttachOptionByHostAndId(normalizedHostType, attachToId, attachOptions);
    }
    if (!selectedOption && !normalizedHostType) {
        selectedOption = resolveAttachOptionByRowId(attachOptions, attachToId);
    }
    if (!selectedOption && attachToRow) {
        const resolvedHost = resolvePipeHostReference(attachToRow, pipeReferenceMap, {
            preferredId: attachToId,
            hostType: normalizedHostType,
            allowFallbackToAnyHost: !normalizedHostType
        });
        if (resolvedHost) {
            selectedOption = findEquipmentAttachOptionByHostAndId(
                resolvedHost.hostType,
                normalizeRowId(resolvedHost.row?.rowId),
                attachOptions
            );
        }
    }

    const hasAttachContractInput = Boolean(attachToDisplay || attachToId || normalizedHostType || attachToRow);
    if (!selectedOption && !hasAttachContractInput) {
        selectedOption = resolveLegacyPackerAttachOption(row, attachOptions, casingRows, tubingRows);
    }

    const nextHostType = selectedOption?.hostType ?? normalizedHostType ?? null;
    const nextAttachToId = selectedOption?.rowId ?? attachToId ?? null;
    const nextDisplay = selectedOption?.value
        ?? (attachToDisplay || null);

    if (
        row.attachToHostType === nextHostType
        && normalizeRowId(row.attachToId) === nextAttachToId
        && (String(row.attachToDisplay ?? '').trim() || null) === nextDisplay
    ) {
        return row;
    }

    return {
        ...row,
        attachToHostType: nextHostType,
        attachToId: nextAttachToId,
        attachToDisplay: nextDisplay
    };
}

function normalizePlacementReferenceRow(row, casingRefMap, casingRows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

    const placement = String(row.placement ?? '').trim();
    const isBehindPlacement = placement.toLowerCase().startsWith('behind:');
    const placementRefId = normalizeRowId(row.placementRefId);
    if (!isBehindPlacement) {
        if (!placementRefId) return row;
        return {
            ...row,
            placementRefId: null
        };
    }

    const placementRef = placement.slice(placement.indexOf(':') + 1).trim();
    if (placementRef) {
        const target = resolveCasingReference(placementRef, casingRefMap, casingRows, null);
        const resolvedRowId = normalizeRowId(target?.rowId);
        if (!resolvedRowId) return row;
        if (resolvedRowId === placementRefId) return row;

        return {
            ...row,
            placementRefId: resolvedRowId
        };
    }

    if (!placementRefId) return row;
    const byId = resolveCasingReference('', casingRefMap, casingRows, placementRefId);
    if (byId) return row;

    return {
        ...row,
        placementRefId: null
    };
}

function normalizeArrayProjectRows(key, rows, casingRows = [], tubingRows = []) {
    if (!Array.isArray(rows)) return rows;

    let normalizedRows = ensureRowsHaveRowIds(rows, { key });
    if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) return normalizedRows;

    if (key !== 'markers' && key !== 'cementPlugs' && key !== 'annulusFluids' && key !== 'equipmentData') {
        return normalizedRows;
    }

    const resolvedCasingRows = ensureRowsHaveRowIds(casingRows, { key: 'casingData' });
    const resolvedTubingRows = ensureRowsHaveRowIds(tubingRows, { key: 'tubingData' });
    const casingRefMap = buildCasingReferenceMap(resolvedCasingRows);
    const pipeReferenceMap = buildPipeReferenceMap(resolvedCasingRows, resolvedTubingRows);
    let changed = false;

    const nextRows = normalizedRows.map((row) => {
        let nextRow = row;

        if (key === 'markers') {
            nextRow = normalizeMarkerAttachReferenceRow(nextRow, pipeReferenceMap);
        } else if (key === 'equipmentData') {
            nextRow = normalizeEquipmentAttachReferenceRow(nextRow, pipeReferenceMap, resolvedCasingRows, resolvedTubingRows);
        } else if (key === 'cementPlugs') {
            nextRow = normalizeCasingAttachReferenceRow(nextRow, casingRefMap, resolvedCasingRows);
        } else if (key === 'annulusFluids') {
            nextRow = normalizePlacementReferenceRow(nextRow, casingRefMap, resolvedCasingRows);
        }

        if (nextRow !== row) {
            changed = true;
        }
        return nextRow;
    });

    return changed ? nextRows : normalizedRows;
}

function normalizeBoundaryReason(reason = {}) {
    const type = String(reason?.type ?? '').trim() || 'depth';
    const action = String(reason?.action ?? '').trim() || 'transition';
    const label = String(reason?.label ?? '').trim();
    const sourceIndexRaw = Number(reason?.sourceIndex);
    const sourceIndex = Number.isInteger(sourceIndexRaw) ? sourceIndexRaw : null;
    return {
        type,
        action,
        label,
        sourceIndex
    };
}

function normalizeBoundaryReasonList(reasons) {
    const normalized = Array.isArray(reasons)
        ? reasons.map((reason) => normalizeBoundaryReason(reason))
        : [];
    const seen = new Set();

    return normalized.filter((reason) => {
        const signature = `${reason.type}|${reason.action}|${reason.label}|${reason.sourceIndex ?? ''}`;
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
    });
}

function areBoundaryReasonListsEqual(current = [], next = []) {
    if (current.length !== next.length) return false;
    return current.every((entry, index) => {
        const nextEntry = next[index];
        return nextEntry
            && entry.type === nextEntry.type
            && entry.action === nextEntry.action
            && entry.label === nextEntry.label
            && entry.sourceIndex === nextEntry.sourceIndex;
    });
}

export const useProjectDataStore = defineStore('projectData', () => {
    const state = reactive(createDefaultProjectDataState());
    const stateRefs = toRefs(state);

    function setArrayProjectData(key, rows) {
        if (!PROJECT_DATA_KEYS.has(key) || !Array.isArray(rows)) return false;
        if (Object.is(state[key], rows)) return false;

        const casingRows = key === 'casingData'
            ? rows
            : (Array.isArray(state.casingData) ? state.casingData : []);
        const tubingRows = key === 'tubingData'
            ? rows
            : (Array.isArray(state.tubingData) ? state.tubingData : []);
        const normalizedRows = normalizeArrayProjectRows(key, rows, casingRows, tubingRows);
        state[key] = normalizedRows;

        if (key === 'casingData') {
            state.markers = normalizeArrayProjectRows(
                'markers',
                state.markers,
                normalizedRows,
                Array.isArray(state.tubingData) ? state.tubingData : []
            );
            state.equipmentData = normalizeArrayProjectRows(
                'equipmentData',
                state.equipmentData,
                normalizedRows,
                Array.isArray(state.tubingData) ? state.tubingData : []
            );
            state.cementPlugs = normalizeArrayProjectRows('cementPlugs', state.cementPlugs, normalizedRows);
            state.annulusFluids = normalizeArrayProjectRows('annulusFluids', state.annulusFluids, normalizedRows);
        } else if (key === 'tubingData') {
            state.markers = normalizeArrayProjectRows(
                'markers',
                state.markers,
                Array.isArray(state.casingData) ? state.casingData : [],
                normalizedRows
            );
            state.equipmentData = normalizeArrayProjectRows(
                'equipmentData',
                state.equipmentData,
                Array.isArray(state.casingData) ? state.casingData : [],
                normalizedRows
            );
        }

        return true;
    }

    function setCasingData(rows) {
        return setArrayProjectData('casingData', rows);
    }

    function setTubingData(rows) {
        return setArrayProjectData('tubingData', rows);
    }

    function setDrillStringData(rows) {
        return setArrayProjectData('drillStringData', rows);
    }

    function setEquipmentData(rows) {
        return setArrayProjectData('equipmentData', rows);
    }

    function setHorizontalLines(rows) {
        return setArrayProjectData('horizontalLines', rows);
    }

    function setAnnotationBoxes(rows) {
        return setArrayProjectData('annotationBoxes', rows);
    }

    function setUserAnnotations(rows) {
        return setArrayProjectData('userAnnotations', rows);
    }

    function setCementPlugs(rows) {
        return setArrayProjectData('cementPlugs', rows);
    }

    function setAnnulusFluids(rows) {
        return setArrayProjectData('annulusFluids', rows);
    }

    function setMarkers(rows) {
        return setArrayProjectData('markers', rows);
    }

    function setTopologySources(rows) {
        return setArrayProjectData('topologySources', rows);
    }

    function setTrajectory(rows) {
        return setArrayProjectData('trajectory', rows);
    }

    function setProjectData(key, value) {
        return setArrayProjectData(key, value);
    }

    function updateProjectRow(key, index, patch) {
        if (!PROJECT_DATA_KEYS.has(key) || !Number.isInteger(index)) return false;
        if (!patch || typeof patch !== 'object') return false;

        const rows = state[key];
        if (!Array.isArray(rows) || !rows[index]) return false;

        const nextRows = rows.map((row, rowIndex) => (
            rowIndex === index ? { ...row, ...patch } : row
        ));
        return setArrayProjectData(key, nextRows);
    }

    function setPhysicsIntervals(intervals) {
        const normalized = Array.isArray(intervals)
            ? intervals
                .map((interval) => {
                    const top = Number(interval?.top);
                    const bottom = Number(interval?.bottom);
                    const midpoint = Number(interval?.midpoint);
                    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
                    const startBoundaryReasons = normalizeBoundaryReasonList(interval?.startBoundaryReasons);
                    const endBoundaryReasons = normalizeBoundaryReasonList(interval?.endBoundaryReasons);
                    return {
                        top,
                        bottom,
                        midpoint: Number.isFinite(midpoint) ? midpoint : (top + bottom) / 2,
                        startBoundaryReasons,
                        endBoundaryReasons
                    };
                })
                .filter(Boolean)
            : [];

        const current = Array.isArray(state.physicsIntervals) ? state.physicsIntervals : [];
        const unchanged = current.length === normalized.length
            && current.every((entry, index) => {
                const nextEntry = normalized[index];
                return nextEntry
                    && Object.is(entry.top, nextEntry.top)
                    && Object.is(entry.bottom, nextEntry.bottom)
                    && Object.is(entry.midpoint, nextEntry.midpoint)
                    && areBoundaryReasonListsEqual(entry.startBoundaryReasons, nextEntry.startBoundaryReasons)
                    && areBoundaryReasonListsEqual(entry.endBoundaryReasons, nextEntry.endBoundaryReasons);
            });

        if (unchanged) return false;
        state.physicsIntervals = normalized;
        return true;
    }

    return {
        ...stateRefs,
        setCasingData,
        setTubingData,
        setDrillStringData,
        setEquipmentData,
        setHorizontalLines,
        setAnnotationBoxes,
        setUserAnnotations,
        setCementPlugs,
        setAnnulusFluids,
        setMarkers,
        setTopologySources,
        setTrajectory,
        setProjectData,
        updateProjectRow,
        setPhysicsIntervals
    };
});
