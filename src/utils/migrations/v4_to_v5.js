import { withDefaultPipeComponentType } from '@/utils/pipeRows.js';
import {
  createDefaultProjectConfig,
  normalizeProjectUnits,
} from '@/stores/viewConfigOwnership.js';
import {
  detectProjectSchemaVersion as detectProjectSchemaVersionV4,
  ensureProjectSchemaV4,
  isProjectPayloadLike as isProjectPayloadLikeV4,
} from '@/utils/migrations/v3_to_v4.js';

export const PROJECT_SCHEMA_VERSION_V5 = '5.0';

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
    schemaVersion: PROJECT_SCHEMA_VERSION_V5,
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
  return { id, name, data, config, loadWarnings: [] };
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

function normalizeV5ProjectPayload(payload = {}) {
  const source = toRecord(payload);
  const sourceWells = toArray(source.wells);
  const normalizedWellsWithWarnings = sourceWells.map((well, index) => normalizeWellRecord(well, index));
  const ensuredWellsWithWarnings = normalizedWellsWithWarnings.length > 0
    ? normalizedWellsWithWarnings
    : [normalizeWellRecord({}, 0)];
  const ensuredWells = ensuredWellsWithWarnings.map(({ loadWarnings, ...well }) => well);
  const loadWarnings = ensuredWellsWithWarnings.flatMap((well) => well.loadWarnings ?? []);

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
    projectSchemaVersion: PROJECT_SCHEMA_VERSION_V5,
    projectName: normalizeProjectName(source.projectName, 'Project'),
    projectAuthor,
    activeWellId,
    projectConfig,
    wells: ensuredWells,
    loadWarnings,
    meta: normalizeProjectMeta(source.meta, projectAuthor),
  };
}

function migrateV4ProjectPayloadToV5(payload = {}) {
  const v4Project = ensureProjectSchemaV4(payload);
  return normalizeV5ProjectPayload({
    ...v4Project,
    projectSchemaVersion: PROJECT_SCHEMA_VERSION_V5,
    meta: normalizeProjectMeta(v4Project.meta, v4Project.projectAuthor),
  });
}

export function createEmptyWellData() {
  return normalizeDataRows({});
}

export function getProjectDataKeys() {
  return [...PROJECT_DATA_KEYS];
}

export function isProjectPayloadV5(payload = {}) {
  const source = toRecord(payload);
  if (String(source.projectSchemaVersion ?? '').trim() !== PROJECT_SCHEMA_VERSION_V5) {
    return false;
  }
  return Array.isArray(source.wells);
}

export function detectProjectSchemaVersion(payload = {}) {
  if (isProjectPayloadV5(payload)) return PROJECT_SCHEMA_VERSION_V5;
  return detectProjectSchemaVersionV4(payload);
}

export function isProjectPayloadLike(payload = {}) {
  if (isProjectPayloadV5(payload)) return true;
  return isProjectPayloadLikeV4(payload);
}

export function ensureProjectSchemaV5(payload = {}) {
  if (isProjectPayloadV5(payload)) {
    return normalizeV5ProjectPayload(payload);
  }
  if (!isProjectPayloadLikeV4(payload)) {
    throw new Error('Unsupported project payload');
  }
  return migrateV4ProjectPayloadToV5(payload);
}

export default {
  PROJECT_SCHEMA_VERSION_V5,
  createEmptyWellData,
  detectProjectSchemaVersion,
  ensureProjectSchemaV5,
  getProjectDataKeys,
  isProjectPayloadLike,
  isProjectPayloadV5
};
