import { isScenarioBreakoutRow } from '@/topology/sourceRows.js';

function normalizeToken(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeAliasToken(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  return normalized.toLowerCase().replace(/[\s_-]+/g, '');
}

function isProductionPhase(operationPhase) {
  return String(operationPhase ?? '').trim().toLowerCase() !== 'drilling';
}

function isDirectionalView(viewMode) {
  return String(viewMode ?? '').trim().toLowerCase() === 'directional';
}

function createDomainEntry(config = {}) {
  const key = normalizeToken(config?.key);
  if (!key) return null;

  const canonicalEntityType = normalizeToken(config?.canonicalEntityType) ?? key;
  const entityAliases = Array.isArray(config?.entityAliases)
    ? config.entityAliases.map((alias) => normalizeToken(alias)).filter(Boolean)
    : [];

  const tableConfig = config?.table && typeof config.table === 'object'
    ? {
      tabKey: normalizeToken(config.table.tabKey) ?? key,
      tableType: normalizeToken(config.table.tableType) ?? canonicalEntityType,
      labelKey: normalizeToken(config.table.labelKey) ?? '',
      fallbackLabel: normalizeToken(config.table.fallbackLabel) ?? key,
      tabId: normalizeToken(config.table.tabId) ?? null
    }
    : null;

  const entry = {
    key,
    storeKey: normalizeToken(config?.storeKey),
    canonicalEntityType,
    entityAliases: Object.freeze(entityAliases),
    interactionType: normalizeToken(config?.interactionType),
    canHighlight: config?.canHighlight === true,
    selectionFilterRows: typeof config?.selectionFilterRows === 'function'
      ? config.selectionFilterRows
      : null,
    isVisible: typeof config?.isVisible === 'function'
      ? config.isVisible
      : () => true,
    table: tableConfig
  };

  return Object.freeze(entry);
}

const DOMAIN_REGISTRY = Object.freeze({
  casing: createDomainEntry({
    key: 'casing',
    storeKey: 'casingData',
    canonicalEntityType: 'casing',
    entityAliases: ['casing'],
    interactionType: 'casing',
    canHighlight: true,
    table: {
      tabKey: 'casing',
      tableType: 'casing',
      labelKey: 'ui.tabs.casing',
      fallbackLabel: 'Casing',
      tabId: 'casing-tab'
    }
  }),
  tubing: createDomainEntry({
    key: 'tubing',
    storeKey: 'tubingData',
    canonicalEntityType: 'tubing',
    entityAliases: ['tubing'],
    interactionType: 'tubing',
    canHighlight: true,
    isVisible: ({ operationPhase }) => isProductionPhase(operationPhase),
    table: {
      tabKey: 'tubing',
      tableType: 'tubing',
      labelKey: 'ui.tabs.tubing',
      fallbackLabel: 'Tubing',
      tabId: 'tubing-tab'
    }
  }),
  drillString: createDomainEntry({
    key: 'drillString',
    storeKey: 'drillStringData',
    canonicalEntityType: 'drillString',
    entityAliases: ['drillString', 'drillstring', 'drill-string', 'drill_string'],
    interactionType: 'drillString',
    canHighlight: true,
    isVisible: ({ operationPhase }) => !isProductionPhase(operationPhase),
    table: {
      tabKey: 'drillString',
      tableType: 'drillString',
      labelKey: 'ui.tabs.drill_string',
      fallbackLabel: 'Drill String',
      tabId: 'drill-string-tab'
    }
  }),
  equipment: createDomainEntry({
    key: 'equipment',
    storeKey: 'equipmentData',
    canonicalEntityType: 'equipment',
    entityAliases: ['equipment'],
    interactionType: 'equipment',
    canHighlight: true,
    isVisible: ({ operationPhase }) => isProductionPhase(operationPhase),
    table: {
      tabKey: 'equipment',
      tableType: 'equipment',
      labelKey: 'ui.tabs.equipment',
      fallbackLabel: 'Equipment',
      tabId: 'equipment-tab'
    }
  }),
  lines: createDomainEntry({
    key: 'lines',
    storeKey: 'horizontalLines',
    canonicalEntityType: 'line',
    entityAliases: ['line', 'lines'],
    interactionType: 'line',
    canHighlight: true,
    table: {
      tabKey: 'lines',
      tableType: 'line',
      labelKey: 'ui.tabs.lines',
      fallbackLabel: 'Lines',
      tabId: 'lines-tab'
    }
  }),
  plugs: createDomainEntry({
    key: 'plugs',
    storeKey: 'cementPlugs',
    canonicalEntityType: 'plug',
    entityAliases: ['plug', 'plugs'],
    interactionType: 'plug',
    canHighlight: true,
    table: {
      tabKey: 'plugs',
      tableType: 'plug',
      labelKey: 'ui.tabs.plugs',
      fallbackLabel: 'Plugs',
      tabId: 'plugs-tab'
    }
  }),
  fluids: createDomainEntry({
    key: 'fluids',
    storeKey: 'annulusFluids',
    canonicalEntityType: 'fluid',
    entityAliases: ['fluid', 'fluids'],
    interactionType: 'fluid',
    canHighlight: true,
    table: {
      tabKey: 'fluids',
      tableType: 'fluid',
      labelKey: 'ui.tabs.fluids',
      fallbackLabel: 'Fluids',
      tabId: 'fluids-tab'
    }
  }),
  markers: createDomainEntry({
    key: 'markers',
    storeKey: 'markers',
    canonicalEntityType: 'marker',
    entityAliases: ['marker', 'markers'],
    interactionType: 'marker',
    canHighlight: true,
    table: {
      tabKey: 'markers',
      tableType: 'marker',
      labelKey: 'ui.tabs.markers',
      fallbackLabel: 'Markers',
      tabId: 'markers-tab'
    }
  }),
  topologySources: createDomainEntry({
    key: 'topologySources',
    storeKey: 'topologySources',
    canonicalEntityType: 'topologySource',
    entityAliases: ['topologySource', 'topologySources'],
    interactionType: null,
    canHighlight: false,
    selectionFilterRows: (rows) => rows.filter((row) => !isScenarioBreakoutRow(row)),
    table: {
      tabKey: 'topologySources',
      tableType: 'topologySource',
      labelKey: 'ui.tabs.topology_sources',
      fallbackLabel: 'Inflow Points',
      tabId: 'topology-sources-tab'
    }
  }),
  topologyBreakouts: createDomainEntry({
    key: 'topologyBreakouts',
    storeKey: 'topologySources',
    canonicalEntityType: 'topologyBreakout',
    entityAliases: ['topologyBreakout', 'topologyBreakouts'],
    interactionType: null,
    canHighlight: false,
    selectionFilterRows: (rows) => rows.filter((row) => isScenarioBreakoutRow(row)),
    table: {
      tabKey: 'topologyBreakouts',
      tableType: 'topologyBreakout',
      labelKey: 'ui.tabs.topology_breakouts',
      fallbackLabel: 'Crossflow Paths',
      tabId: 'topology-breakouts-tab'
    }
  }),
  surfacePaths: createDomainEntry({
    key: 'surfacePaths',
    storeKey: 'surfacePaths',
    canonicalEntityType: 'surfacePath',
    entityAliases: ['surfacePath', 'surfacePaths'],
    interactionType: null,
    canHighlight: false,
    table: null
  }),
  surfaceTransfers: createDomainEntry({
    key: 'surfaceTransfers',
    storeKey: 'surfaceTransfers',
    canonicalEntityType: 'surfaceTransfer',
    entityAliases: ['surfaceTransfer', 'surfaceTransfers'],
    interactionType: null,
    canHighlight: false,
    table: null
  }),
  surfaceOutlets: createDomainEntry({
    key: 'surfaceOutlets',
    storeKey: 'surfaceOutlets',
    canonicalEntityType: 'surfaceOutlet',
    entityAliases: ['surfaceOutlet', 'surfaceOutlets'],
    interactionType: null,
    canHighlight: false,
    table: null
  }),
  boxes: createDomainEntry({
    key: 'boxes',
    storeKey: 'annotationBoxes',
    canonicalEntityType: 'box',
    entityAliases: ['box', 'boxes'],
    interactionType: 'box',
    canHighlight: true,
    table: {
      tabKey: 'boxes',
      tableType: 'box',
      labelKey: 'ui.tabs.boxes',
      fallbackLabel: 'Boxes',
      tabId: 'boxes-tab'
    }
  }),
  trajectory: createDomainEntry({
    key: 'trajectory',
    storeKey: 'trajectory',
    canonicalEntityType: 'trajectory',
    entityAliases: ['trajectory'],
    interactionType: null,
    canHighlight: false,
    isVisible: ({ viewMode }) => isDirectionalView(viewMode),
    table: {
      tabKey: 'trajectory',
      tableType: 'trajectory',
      labelKey: 'ui.tabs.trajectory',
      fallbackLabel: 'Well Trajectory',
      tabId: 'trajectory-tab'
    }
  })
});

export const DOMAIN_REGISTRY_ORDER = Object.freeze([
  'casing',
  'tubing',
  'drillString',
  'equipment',
  'lines',
  'plugs',
  'fluids',
  'markers',
  'surfacePaths',
  'surfaceTransfers',
  'surfaceOutlets',
  'topologySources',
  'topologyBreakouts',
  'boxes',
  'trajectory'
]);

const DOMAIN_KEY_BY_ALIAS = Object.freeze(
  Object.keys(DOMAIN_REGISTRY).reduce((accumulator, domainKey) => {
    const entry = DOMAIN_REGISTRY[domainKey];
    if (!entry) return accumulator;

    const aliasTokens = [
      domainKey,
      entry.key,
      entry.canonicalEntityType,
      ...(entry.entityAliases ?? [])
    ];

    aliasTokens.forEach((alias) => {
      const token = normalizeAliasToken(alias);
      if (!token) return;
      accumulator[token] = domainKey;
    });

    return accumulator;
  }, {})
);

function resolveDomainEntryByInput(input) {
  const directKey = normalizeToken(input);
  if (directKey && DOMAIN_REGISTRY[directKey]) {
    return DOMAIN_REGISTRY[directKey];
  }

  const byEntityType = resolveDomainEntryByEntityType(input);
  return byEntityType ?? null;
}

export function getDomainRegistryEntry(domainKey) {
  const normalized = normalizeToken(domainKey);
  if (!normalized) return null;
  return DOMAIN_REGISTRY[normalized] ?? null;
}

export function resolveDomainKeyFromEntityType(entityType) {
  const normalizedAlias = normalizeAliasToken(entityType);
  if (!normalizedAlias) return null;
  return DOMAIN_KEY_BY_ALIAS[normalizedAlias] ?? null;
}

export function resolveDomainEntryByEntityType(entityType) {
  const domainKey = resolveDomainKeyFromEntityType(entityType);
  if (!domainKey) return null;
  return DOMAIN_REGISTRY[domainKey] ?? null;
}

export function resolveCanonicalEntityTypeForDomain(domainKey) {
  const entry = getDomainRegistryEntry(domainKey);
  return entry?.canonicalEntityType ?? null;
}

export function resolveDomainTableTarget(input) {
  const entry = resolveDomainEntryByInput(input);
  if (!entry?.table) return null;
  return {
    tabKey: entry.table.tabKey,
    tableType: entry.table.tableType
  };
}

export function listVisibleDomainTableEntries(context = {}) {
  return DOMAIN_REGISTRY_ORDER
    .map((domainKey) => DOMAIN_REGISTRY[domainKey] ?? null)
    .filter(Boolean)
    .filter((entry) => {
      if (typeof entry.isVisible !== 'function') return true;
      return entry.isVisible(context) === true;
    })
    .filter((entry) => Boolean(entry.table));
}

export default {
  DOMAIN_REGISTRY_ORDER,
  getDomainRegistryEntry,
  resolveDomainKeyFromEntityType,
  resolveDomainEntryByEntityType,
  resolveCanonicalEntityTypeForDomain,
  resolveDomainTableTarget,
  listVisibleDomainTableEntries
};
