import { withDefaultPipeComponentType } from '@/utils/pipeRows.js';
import {
  createDefaultProjectConfig,
  normalizeProjectUnits,
} from '@/stores/viewConfigOwnership.js';
import {
  detectProjectSchemaVersion as detectProjectSchemaVersionV6,
  ensureProjectSchemaV6,
  isProjectPayloadLike as isProjectPayloadLikeV6,
} from '@/utils/migrations/v5_to_v6.js';

export const PROJECT_SCHEMA_VERSION_V7 = '7.0';

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
  'surfacePaths',
  'surfaceTransfers',
  'surfaceOutlets',
  'trajectory',
]);

function toRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProjectAuthor(value, fallback = '') {
  const author = String(value ?? '').trim();
  return author || fallback;
}

function normalizeProjectName(value, fallback = 'Project') {
  const projectName = String(value ?? '').trim();
  return projectName || fallback;
}

function normalizeWellName(value, fallback = 'Well') {
  const name = String(value ?? '').trim();
  return name || fallback;
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
    schemaVersion: PROJECT_SCHEMA_VERSION_V7,
    timestamp: resolveTimestamp(source),
    source: String(source.source ?? 'CasingSchematicPlotter').trim() || 'CasingSchematicPlotter',
    author: normalizeProjectAuthor(source.author, fallbackAuthor),
  };
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
    surfacePaths: toArray(source.surfacePaths),
    surfaceTransfers: toArray(source.surfaceTransfers),
    surfaceOutlets: toArray(source.surfaceOutlets),
    surfaceTemplate: toRecord(source.surfaceTemplate),
    trajectory: toArray(source.trajectory),
  };
}

function createGeneratedWellId(index = 0) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `well-${Date.now()}-${index + 1}`;
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
    ),
  };
}

function normalizeV7ProjectPayload(payload = {}) {
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
    units: inferredUnitsFromWell,
  });
  const projectAuthor = normalizeProjectAuthor(source.projectAuthor ?? source?.meta?.author, '');

  return {
    projectSchemaVersion: PROJECT_SCHEMA_VERSION_V7,
    projectName: normalizeProjectName(source.projectName, 'Project'),
    projectAuthor,
    activeWellId,
    projectConfig,
    wells: ensuredWells,
    loadWarnings: [],
    meta: normalizeProjectMeta(source.meta, projectAuthor),
  };
}

function migrateV6ProjectPayloadToV7(payload = {}) {
  const v6Project = ensureProjectSchemaV6(payload);
  return normalizeV7ProjectPayload({
    ...v6Project,
    projectSchemaVersion: PROJECT_SCHEMA_VERSION_V7,
    meta: normalizeProjectMeta(v6Project.meta, v6Project.projectAuthor),
  });
}

export function createEmptyWellData() {
  return normalizeDataRows({});
}

export function getProjectDataKeys() {
  return [...PROJECT_DATA_KEYS];
}

export function isProjectPayloadV7(payload = {}) {
  const source = toRecord(payload);
  if (String(source.projectSchemaVersion ?? '').trim() !== PROJECT_SCHEMA_VERSION_V7) {
    return false;
  }
  return Array.isArray(source.wells);
}

export function detectProjectSchemaVersion(payload = {}) {
  if (isProjectPayloadV7(payload)) return PROJECT_SCHEMA_VERSION_V7;
  return detectProjectSchemaVersionV6(payload);
}

export function isProjectPayloadLike(payload = {}) {
  if (isProjectPayloadV7(payload)) return true;
  return isProjectPayloadLikeV6(payload);
}

export function ensureProjectSchemaV7(payload = {}) {
  if (isProjectPayloadV7(payload)) {
    return normalizeV7ProjectPayload(payload);
  }
  if (!isProjectPayloadLikeV6(payload)) {
    throw new Error('Unsupported project payload');
  }
  return migrateV6ProjectPayloadToV7(payload);
}

export default {
  PROJECT_SCHEMA_VERSION_V7,
  createEmptyWellData,
  detectProjectSchemaVersion,
  ensureProjectSchemaV7,
  getProjectDataKeys,
  isProjectPayloadLike,
  isProjectPayloadV7,
};
