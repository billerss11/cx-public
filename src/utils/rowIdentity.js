const ROW_ID_PREFIX_BY_KEY = Object.freeze({
    casingData: 'casing',
    tubingData: 'tubing',
    drillStringData: 'drill-string',
    equipmentData: 'equipment',
    horizontalLines: 'line',
    annotationBoxes: 'annotation-box',
    userAnnotations: 'annotation',
    cementPlugs: 'plug',
    annulusFluids: 'fluid',
    markers: 'marker',
    topologySources: 'topology-source',
    surfaceComponents: 'surface-component',
    surfacePaths: 'surface-path',
    surfaceTransfers: 'surface-transfer',
    surfaceOutlets: 'surface-outlet',
    trajectory: 'trajectory'
});

let generatedRowCounter = 0;

export function normalizeRowId(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

export function getRowIdPrefixForKey(key, fallback = 'row') {
    const normalizedFallback = String(fallback ?? '').trim();
    return ROW_ID_PREFIX_BY_KEY[key] ?? (normalizedFallback || 'row');
}

export function createRowId(prefix = 'row') {
    const safePrefix = getRowIdPrefixForKey(null, prefix);

    if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
        return `${safePrefix}-${globalThis.crypto.randomUUID()}`;
    }

    generatedRowCounter += 1;
    return `${safePrefix}-${Date.now()}-${generatedRowCounter}`;
}

export function ensureRowHasRowId(row, options = {}) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

    const existing = normalizeRowId(row.rowId);
    if (existing) return row;

    const prefix = getRowIdPrefixForKey(options.key, options.prefix);
    return {
        ...row,
        rowId: createRowId(prefix)
    };
}

export function ensureRowsHaveRowIds(rows = [], options = {}) {
    if (!Array.isArray(rows)) return [];

    const prefix = getRowIdPrefixForKey(options.key, options.prefix);
    const usedRowIds = new Set();
    let changed = false;
    const normalized = rows.map((row) => {
        const withRowId = ensureRowHasRowId(row, options);
        const normalizedRowId = normalizeRowId(withRowId?.rowId);

        if (withRowId !== row) changed = true;

        if (!normalizedRowId || usedRowIds.has(normalizedRowId)) {
            if (!withRowId || typeof withRowId !== 'object' || Array.isArray(withRowId)) {
                return withRowId;
            }

            let nextRowId = createRowId(prefix);
            while (usedRowIds.has(nextRowId)) {
                nextRowId = createRowId(prefix);
            }
            changed = true;
            usedRowIds.add(nextRowId);
            return {
                ...withRowId,
                rowId: nextRowId
            };
        }

        usedRowIds.add(normalizedRowId);
        return withRowId;
    });

    return changed ? normalized : rows;
}
