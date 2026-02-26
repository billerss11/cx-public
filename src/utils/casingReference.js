import { generateCasingId } from '@/utils/general.js';
import { normalizeRowId } from '@/utils/rowIdentity.js';

function normalizeReferenceValue(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function resolveByIndexToken(token, casingRows = []) {
    const rowMatch = token.match(/^#\s*(\d+)/);
    if (rowMatch) {
        const rowIndex = Number(rowMatch[1]) - 1;
        if (Number.isInteger(rowIndex) && rowIndex >= 0 && rowIndex < casingRows.length) {
            return casingRows[rowIndex];
        }
    }

    const numericRow = Number(token);
    if (Number.isInteger(numericRow) && numericRow > 0 && numericRow <= casingRows.length) {
        return casingRows[numericRow - 1];
    }

    return null;
}

export function buildCasingReferenceMap(casingRows = []) {
    const map = new Map();

    casingRows.forEach((row, index) => {
        const rowId = normalizeRowId(row?.rowId);
        if (rowId) {
            map.set(rowId, row);
        }

        map.set(generateCasingId(row, index), row);
    });

    return map;
}

export function resolveCasingReference(reference, casingRefMap = new Map(), casingRows = [], preferredId = null) {
    const referenceId = normalizeRowId(preferredId);
    if (referenceId) {
        if (casingRefMap.has(referenceId)) {
            return casingRefMap.get(referenceId);
        }

        const byRowId = casingRows.find((row) => normalizeRowId(row?.rowId) === referenceId);
        if (byRowId) return byRowId;
    }

    const token = normalizeReferenceValue(reference);
    if (!token) return null;

    if (casingRefMap.has(token)) {
        return casingRefMap.get(token);
    }

    const byIndex = resolveByIndexToken(token, casingRows);
    if (byIndex) return byIndex;

    return casingRows.find((row) => String(row?.label ?? '').trim() === token) ?? null;
}
