import { generateCasingId } from '@/utils/general.js';
import { normalizeRowId } from '@/utils/rowIdentity.js';

export const PIPE_HOST_TYPE_CASING = 'casing';
export const PIPE_HOST_TYPE_TUBING = 'tubing';

const SUPPORTED_PIPE_HOST_TYPES = new Set([
    PIPE_HOST_TYPE_CASING,
    PIPE_HOST_TYPE_TUBING
]);

function normalizeReferenceToken(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function buildLegacyPipeReferenceToken(row, index, hostType) {
    if (hostType === PIPE_HOST_TYPE_CASING) {
        return generateCasingId(row, index);
    }

    const safeIndex = Number.isFinite(index) ? index + 1 : '?';
    const label = String(row?.label ?? '').trim() || 'Tubing';
    const odValue = Number(row?.od);
    const odText = Number.isFinite(odValue) ? odValue.toFixed(3) : '?';
    return `#${safeIndex} ${label} (${odText}")`;
}

function collectReferenceTokens(row, index, hostType) {
    const tokens = new Set();
    const rowId = normalizeRowId(row?.rowId);
    const label = normalizeReferenceToken(row?.label);
    const indexToken = Number.isFinite(index) ? String(index + 1) : null;
    const hashIndexToken = indexToken ? `#${indexToken}` : null;

    if (rowId) tokens.add(rowId);
    if (label) tokens.add(label);
    if (indexToken) tokens.add(indexToken);
    if (hashIndexToken) tokens.add(hashIndexToken);

    const legacyToken = normalizeReferenceToken(buildLegacyPipeReferenceToken(row, index, hostType));
    if (legacyToken) tokens.add(legacyToken);

    return tokens;
}

function buildHostReferenceMap(rows = [], hostType) {
    const map = new Map();
    rows.forEach((row, index) => {
        collectReferenceTokens(row, index, hostType).forEach((token) => {
            map.set(token, row);
        });
    });
    return map;
}

function resolveReferenceInHost(pipeReferenceMap, hostType, reference, preferredId) {
    const hostMap = pipeReferenceMap?.mapsByHostType?.[hostType];
    if (!(hostMap instanceof Map)) return null;

    const preferredToken = normalizeRowId(preferredId);
    if (preferredToken && hostMap.has(preferredToken)) {
        return hostMap.get(preferredToken);
    }

    const referenceToken = normalizeReferenceToken(reference);
    if (!referenceToken) return null;
    return hostMap.get(referenceToken) ?? null;
}

export function normalizePipeHostType(value, fallback = PIPE_HOST_TYPE_CASING) {
    const token = String(value ?? '').trim().toLowerCase();
    if (SUPPORTED_PIPE_HOST_TYPES.has(token)) {
        return token;
    }
    return fallback;
}

export function buildPipeReferenceMap(casingRows = [], tubingRows = []) {
    const safeCasingRows = Array.isArray(casingRows) ? casingRows : [];
    const safeTubingRows = Array.isArray(tubingRows) ? tubingRows : [];

    return {
        rowsByHostType: {
            [PIPE_HOST_TYPE_CASING]: safeCasingRows,
            [PIPE_HOST_TYPE_TUBING]: safeTubingRows
        },
        mapsByHostType: {
            [PIPE_HOST_TYPE_CASING]: buildHostReferenceMap(safeCasingRows, PIPE_HOST_TYPE_CASING),
            [PIPE_HOST_TYPE_TUBING]: buildHostReferenceMap(safeTubingRows, PIPE_HOST_TYPE_TUBING)
        }
    };
}

export function resolvePipeHostReference(reference, pipeReferenceMap = {}, options = {}) {
    const preferredId = normalizeRowId(options?.preferredId);
    const requestedHostType = normalizePipeHostType(options?.hostType, null);

    if (requestedHostType) {
        const row = resolveReferenceInHost(pipeReferenceMap, requestedHostType, reference, preferredId);
        return row ? { row, hostType: requestedHostType } : null;
    }

    const fallbackOrder = options?.allowFallbackToAnyHost === true
        ? [PIPE_HOST_TYPE_CASING, PIPE_HOST_TYPE_TUBING]
        : [PIPE_HOST_TYPE_CASING];

    for (const hostType of fallbackOrder) {
        const row = resolveReferenceInHost(pipeReferenceMap, hostType, reference, preferredId);
        if (row) {
            return { row, hostType };
        }
    }

    return null;
}

export function buildPipeReferenceOptions(rows = [], hostType = PIPE_HOST_TYPE_CASING) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.map((row, index) => buildLegacyPipeReferenceToken(row, index, hostType));
}

