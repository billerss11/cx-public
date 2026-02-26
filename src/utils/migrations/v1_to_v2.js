import { withDefaultPipeComponentType } from '@/utils/pipeRows.js';
const PROJECT_SCHEMA_VERSION_V2 = '2.0';
const DEFAULT_OPERATION_PHASE = 'production';
const PROJECT_DATA_KEYS = Object.freeze([
    'casingData',
    'tubingData',
    'drillStringData',
    'horizontalLines',
    'annotationBoxes',
    'userAnnotations',
    'cementPlugs',
    'annulusFluids',
    'markers',
    'topologySources',
    'trajectory'
]);
const PROJECT_DATA_KEY_SET = new Set(PROJECT_DATA_KEYS);
const LEGACY_CONFIG_KEYS = Object.freeze([
    'operationPhase',
    'viewMode',
    'units',
    'plotTitle',
    'figHeight',
    'widthMultiplier',
    'canvasWidthMultiplier'
]);

function toRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function hasAnyOwnKey(record, keys) {
    if (!record || typeof record !== 'object') return false;
    return keys.some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function hasAnyProjectDataArray(record) {
    if (!record || typeof record !== 'object') return false;
    return PROJECT_DATA_KEYS.some((key) => {
        if (!Object.prototype.hasOwnProperty.call(record, key)) return false;
        const value = record[key];
        return Array.isArray(value) || value === null;
    });
}

function extractLegacyConfigFromSource(source) {
    const legacyConfig = {};
    Object.entries(source).forEach(([key, value]) => {
        if (key === 'meta' || key === 'data' || key === 'config') return;
        if (PROJECT_DATA_KEY_SET.has(key)) return;
        legacyConfig[key] = value;
    });
    return legacyConfig;
}

function resolveDataSource(source) {
    const nestedData = toRecord(source.data);
    if (hasAnyProjectDataArray(nestedData)) {
        return nestedData;
    }
    if (hasAnyProjectDataArray(source)) {
        return source;
    }
    return null;
}

function resolveConfigSource(source) {
    const nestedConfig = toRecord(source.config);
    if (Object.keys(nestedConfig).length > 0) {
        return nestedConfig;
    }
    if (hasAnyOwnKey(source, LEGACY_CONFIG_KEYS)) {
        return extractLegacyConfigFromSource(source);
    }
    return {};
}

function normalizeOperationPhase(value) {
    return String(value ?? '').trim().toLowerCase() === 'drilling'
        ? 'drilling'
        : DEFAULT_OPERATION_PHASE;
}

function sanitizeConfigForV2(config = {}) {
    const nextConfig = { ...config };
    delete nextConfig.annulusMode;
    return nextConfig;
}

export function isProjectPayloadLike(payload = {}) {
    const source = toRecord(payload);
    if (Object.keys(source).length === 0) return false;
    return resolveDataSource(source) !== null;
}

export function migrateProjectPayloadToV2(payload = {}) {
    const source = toRecord(payload);
    const data = resolveDataSource(source) ?? {};
    const config = sanitizeConfigForV2(resolveConfigSource(source));
    const meta = toRecord(source.meta);

    const project = {
        ...source,
        meta: {
            ...meta,
            schemaVersion: PROJECT_SCHEMA_VERSION_V2
        },
        data: {
            ...data,
            casingData: withDefaultPipeComponentType(toArray(data.casingData)),
            tubingData: withDefaultPipeComponentType(toArray(data.tubingData)),
            drillStringData: withDefaultPipeComponentType(toArray(data.drillStringData)),
            horizontalLines: toArray(data.horizontalLines),
            annotationBoxes: toArray(data.annotationBoxes),
            userAnnotations: toArray(data.userAnnotations),
            cementPlugs: toArray(data.cementPlugs),
            annulusFluids: toArray(data.annulusFluids),
            markers: toArray(data.markers),
            topologySources: toArray(data.topologySources),
            trajectory: toArray(data.trajectory)
        },
        config: {
            ...config,
            operationPhase: normalizeOperationPhase(config.operationPhase)
        }
    };

    return {
        project,
        migrated: String(meta.schemaVersion ?? '').trim() !== PROJECT_SCHEMA_VERSION_V2
    };
}

export function ensureProjectSchemaV2(payload = {}) {
    return migrateProjectPayloadToV2(payload).project;
}
