const PROJECT_SCHEMA_VERSION_V3 = '3.0';
const DEFAULT_SOURCE = 'CasingSchematicPlotter';
const DEFAULT_PROJECT_NAME = 'Project';
const DEFAULT_PROJECT_AUTHOR = '';
const DEFAULT_PROJECT_CONFIG = Object.freeze({
    defaultUnits: 'ft'
});

function toRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeProjectUnits(value) {
    return String(value ?? '').trim().toLowerCase() === 'm' ? 'm' : 'ft';
}

function normalizeProjectAuthor(value, fallback = DEFAULT_PROJECT_AUTHOR) {
    const author = String(value ?? '').trim();
    return author || fallback;
}

function normalizeWellRecord(well, fallbackIndex = 0) {
    const source = toRecord(well);
    const fallbackName = `Well ${fallbackIndex + 1}`;
    const id = String(source.id ?? '').trim() || `well-${fallbackIndex + 1}`;
    const name = String(source.name ?? '').trim() || fallbackName;
    const data = toRecord(source.data);
    const config = toRecord(source.config);

    return { id, name, data, config };
}

export function buildProjectSavePayload(projectSnapshot = {}, options = {}) {
    const sourceSnapshot = toRecord(projectSnapshot);
    const timestamp = typeof options.timestamp === 'string' && options.timestamp.trim()
        ? options.timestamp
        : new Date().toISOString();
    const wells = toArray(sourceSnapshot.wells).map((well, index) => normalizeWellRecord(well, index));
    const activeWellIdFromSnapshot = String(sourceSnapshot.activeWellId ?? '').trim();
    const activeWellId = wells.some((well) => well.id === activeWellIdFromSnapshot)
        ? activeWellIdFromSnapshot
        : (wells[0]?.id ?? null);

    return {
        projectSchemaVersion: PROJECT_SCHEMA_VERSION_V3,
        projectName: String(sourceSnapshot.projectName ?? '').trim() || DEFAULT_PROJECT_NAME,
        projectAuthor: normalizeProjectAuthor(
            sourceSnapshot.projectAuthor ?? sourceSnapshot?.meta?.author
        ),
        activeWellId,
        projectConfig: {
            ...DEFAULT_PROJECT_CONFIG,
            ...toRecord(sourceSnapshot.projectConfig),
            defaultUnits: normalizeProjectUnits(sourceSnapshot?.projectConfig?.defaultUnits)
        },
        wells,
        meta: {
            ...toRecord(sourceSnapshot.meta),
            schemaVersion: PROJECT_SCHEMA_VERSION_V3,
            timestamp,
            source: String(sourceSnapshot?.meta?.source ?? options.source ?? DEFAULT_SOURCE).trim() || DEFAULT_SOURCE,
            author: normalizeProjectAuthor(
                sourceSnapshot?.meta?.author ?? sourceSnapshot.projectAuthor
            )
        }
    };
}
