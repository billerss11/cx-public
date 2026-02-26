import { withDefaultPipeComponentType } from '@/utils/pipeRows.js';
import { ensureProjectSchemaV2, isProjectPayloadLike as isLegacyProjectPayloadLike } from '@/utils/migrations/v1_to_v2.js';
import {
    createDefaultProjectConfig,
    normalizeProjectUnits
} from '@/stores/viewConfigOwnership.js';

export const PROJECT_SCHEMA_VERSION_V3 = '3.0';

const PROJECT_DATA_KEYS = Object.freeze([
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

let generatedWellCounter = 0;

function toRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeDataRows(data = {}) {
    const source = toRecord(data);
    return {
        casingData: withDefaultPipeComponentType(toArray(source.casingData)),
        tubingData: withDefaultPipeComponentType(toArray(source.tubingData)),
        drillStringData: withDefaultPipeComponentType(toArray(source.drillStringData)),
        equipmentData: toArray(source.equipmentData),
        horizontalLines: toArray(source.horizontalLines),
        annotationBoxes: toArray(source.annotationBoxes),
        userAnnotations: toArray(source.userAnnotations),
        cementPlugs: toArray(source.cementPlugs),
        annulusFluids: toArray(source.annulusFluids),
        markers: toArray(source.markers),
        topologySources: toArray(source.topologySources),
        trajectory: toArray(source.trajectory)
    };
}

function normalizeWellName(value, fallback = 'Well') {
    const name = String(value ?? '').trim();
    return name || fallback;
}

function normalizeProjectName(value, fallback = 'Project') {
    const name = String(value ?? '').trim();
    return name || fallback;
}

function normalizeProjectAuthor(value, fallback = '') {
    const author = String(value ?? '').trim();
    return author || fallback;
}

function removeUnsupportedWellConfigKeys(config = {}) {
    const source = toRecord(config);
    const next = { ...source };
    delete next.units;
    return next;
}

function resolveTimestamp(payloadMeta = {}) {
    const timestamp = String(payloadMeta.timestamp ?? '').trim();
    return timestamp || new Date().toISOString();
}

function normalizeProjectMeta(meta = {}, fallbackAuthor = '') {
    const source = toRecord(meta);
    return {
        ...source,
        schemaVersion: PROJECT_SCHEMA_VERSION_V3,
        timestamp: resolveTimestamp(source),
        source: String(source.source ?? 'CasingSchematicPlotter').trim() || 'CasingSchematicPlotter',
        author: normalizeProjectAuthor(source.author, fallbackAuthor)
    };
}

function createGeneratedWellId(index = 0) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    generatedWellCounter += 1;
    const safeIndex = Number.isInteger(index) && index >= 0 ? index + 1 : generatedWellCounter;
    return `well-${Date.now()}-${safeIndex}-${generatedWellCounter}`;
}

function normalizeWellRecord(well, index = 0) {
    const source = toRecord(well);
    const id = String(source.id ?? '').trim() || createGeneratedWellId(index);
    const name = normalizeWellName(source.name, `Well ${index + 1}`);
    const data = normalizeDataRows(source.data);
    const config = removeUnsupportedWellConfigKeys(source.config);
    return { id, name, data, config };
}

function resolveProjectConfig(sourceProjectConfig = {}, fallbackConfig = {}) {
    const source = toRecord(sourceProjectConfig);
    const fallback = toRecord(fallbackConfig);
    return {
        ...createDefaultProjectConfig(),
        defaultUnits: normalizeProjectUnits(
            source.defaultUnits ?? fallback.defaultUnits ?? fallback.units
        )
    };
}

function normalizeV3ProjectPayload(payload = {}) {
    const source = toRecord(payload);
    const sourceWells = toArray(source.wells);
    const normalizedWells = sourceWells.map((well, index) => normalizeWellRecord(well, index));
    const ensuredWells = normalizedWells.length > 0
        ? normalizedWells
        : [normalizeWellRecord({}, 0)];

    const activeWellIdRaw = String(source.activeWellId ?? '').trim();
    const hasActiveWellId = ensuredWells.some((well) => well.id === activeWellIdRaw);
    const activeWellId = hasActiveWellId ? activeWellIdRaw : ensuredWells[0].id;

    const inferredUnitsFromWell = ensuredWells
        .map((well) => well?.config?.units)
        .find((units) => String(units ?? '').trim().length > 0);
    const projectConfig = resolveProjectConfig(source.projectConfig, {
        units: inferredUnitsFromWell
    });
    const projectAuthor = normalizeProjectAuthor(source.projectAuthor ?? source?.meta?.author, '');

    return {
        projectSchemaVersion: PROJECT_SCHEMA_VERSION_V3,
        projectName: normalizeProjectName(source.projectName, 'Project'),
        projectAuthor,
        activeWellId,
        projectConfig,
        wells: ensuredWells,
        meta: normalizeProjectMeta(source.meta, projectAuthor)
    };
}

export function isProjectPayloadV3(payload = {}) {
    const source = toRecord(payload);
    if (String(source.projectSchemaVersion ?? '').trim() !== PROJECT_SCHEMA_VERSION_V3) {
        return false;
    }
    return Array.isArray(source.wells);
}

export function detectProjectSchemaVersion(payload = {}) {
    const source = toRecord(payload);
    if (isProjectPayloadV3(source)) {
        return PROJECT_SCHEMA_VERSION_V3;
    }

    if (isLegacyProjectPayloadLike(source)) {
        return String(source?.meta?.schemaVersion ?? source?.meta?.version ?? '2.0').trim() || '2.0';
    }

    return null;
}

export function isProjectPayloadLike(payload = {}) {
    if (isProjectPayloadV3(payload)) return true;
    return isLegacyProjectPayloadLike(payload);
}

export function migrateProjectPayloadV2ToV3(payload = {}, options = {}) {
    const v2Project = ensureProjectSchemaV2(payload);
    const projectAuthor = normalizeProjectAuthor(
        options.projectAuthor ?? v2Project.projectAuthor ?? v2Project?.meta?.author,
        ''
    );
    const meta = normalizeProjectMeta(v2Project.meta, projectAuthor);
    const wellId = createGeneratedWellId(0);
    const sourceConfig = toRecord(v2Project.config);
    const sourceData = toRecord(v2Project.data);
    const wellName = normalizeWellName(
        options.wellName ?? sourceConfig.plotTitle ?? 'Well 1',
        'Well 1'
    );
    const projectName = normalizeProjectName(
        options.projectName ?? sourceConfig.plotTitle ?? v2Project.projectName,
        'Project'
    );
    const projectConfig = resolveProjectConfig(options.projectConfig, {
        units: sourceConfig.units
    });
    const wellConfig = removeUnsupportedWellConfigKeys(sourceConfig);

    return {
        projectSchemaVersion: PROJECT_SCHEMA_VERSION_V3,
        projectName,
        projectAuthor,
        activeWellId: wellId,
        projectConfig,
        wells: [
            {
                id: wellId,
                name: wellName,
                data: normalizeDataRows(sourceData),
                config: wellConfig
            }
        ],
        meta
    };
}

export function ensureProjectSchemaV3(payload = {}, options = {}) {
    if (isProjectPayloadV3(payload)) {
        return normalizeV3ProjectPayload(payload);
    }

    if (!isLegacyProjectPayloadLike(payload)) {
        throw new Error('Unsupported project payload');
    }

    return normalizeV3ProjectPayload(migrateProjectPayloadV2ToV3(payload, options));
}

export function createEmptyWellData() {
    return normalizeDataRows({});
}

export function getProjectDataKeys() {
    return [...PROJECT_DATA_KEYS];
}
