import {
  SOURCE_KIND_SCENARIO,
  TOPOLOGY_VOLUME_KINDS
} from '@/topology/topologyTypes.js';
import {
  filterScenarioBreakoutRows,
  filterScenarioSourceRows,
  isScenarioBreakoutRow,
  mergeScenarioBreakoutRows,
  mergeScenarioSourceRows
} from '@/topology/sourceRows.js';

const DEFAULT_SOURCE_VOLUME_KEY = TOPOLOGY_VOLUME_KINDS[0] ?? null;
const DEFAULT_BREAKOUT_FROM_VOLUME_KEY = TOPOLOGY_VOLUME_KINDS[2] ?? TOPOLOGY_VOLUME_KINDS[0] ?? null;
const DEFAULT_BREAKOUT_TO_VOLUME_KEY = TOPOLOGY_VOLUME_KINDS[3] ?? TOPOLOGY_VOLUME_KINDS[1] ?? null;

function normalizeText(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDepth(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number.isInteger(numeric) ? `${numeric}` : `${numeric.toFixed(2)}`;
}

function resolveRowLabel(row, fallback) {
  return normalizeText(row?.label)
    ?? normalizeText(row?.name)
    ?? normalizeText(row?.comment)
    ?? fallback;
}

function resolveIntervalFallback(row, index) {
  const top = formatDepth(row?.top ?? row?.topDepth ?? row?.md);
  const bottom = formatDepth(row?.bottom ?? row?.bottomDepth);
  if (top && bottom) return `#${index + 1} (${top}-${bottom})`;
  if (top) return `#${index + 1} @ ${top}`;
  return `#${index + 1}`;
}

function resolveTrajectoryLabel(row, index) {
  const comment = normalizeText(row?.comment);
  if (comment) return comment;
  const md = formatDepth(row?.md);
  if (md) return `MD ${md}`;
  return `Station #${index + 1}`;
}

function resolveTopologySourceLabel(row, index) {
  const direct = resolveRowLabel(row, null);
  if (direct) return direct;
  const type = normalizeText(row?.sourceType);
  const interval = resolveIntervalFallback(row, index);
  return type ? `${type}: ${interval}` : interval;
}

function resolveTopologyBreakoutLabel(row, index) {
  const direct = resolveRowLabel(row, null);
  if (direct) return direct;
  const fromToken = normalizeText(row?.fromVolumeKey) ?? '?';
  const toToken = normalizeText(row?.toVolumeKey) ?? '?';
  return `${fromToken} -> ${toToken} (${resolveIntervalFallback(row, index)})`;
}

function isProductionPhase(operationPhase) {
  return String(operationPhase ?? '').trim().toLowerCase() !== 'drilling';
}

function isDirectionalView(viewMode) {
  return String(viewMode ?? '').trim().toLowerCase() === 'directional';
}

function cloneTopologyRows(rows) {
  return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
}

export const HIERARCHY_DOMAIN_META = Object.freeze({
  casing: Object.freeze({
    key: 'casing',
    labelKey: 'ui.tabs.casing',
    fallbackLabel: 'Casing',
    storeKey: 'casingData',
    entityType: 'casing',
    canHighlight: true,
    canReorder: true,
    commonFields: Object.freeze(['label', 'od', 'top', 'bottom', 'showTop', 'showBottom']),
    resolveRows: (wellData) => Array.isArray(wellData?.casingData) ? wellData.casingData : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, resolveIntervalFallback(row, index))
  }),
  tubing: Object.freeze({
    key: 'tubing',
    labelKey: 'ui.tabs.tubing',
    fallbackLabel: 'Tubing',
    storeKey: 'tubingData',
    entityType: 'tubing',
    canHighlight: true,
    canReorder: true,
    isVisible: ({ operationPhase }) => isProductionPhase(operationPhase),
    commonFields: Object.freeze(['label', 'od', 'top', 'bottom', 'showLabel']),
    resolveRows: (wellData) => Array.isArray(wellData?.tubingData) ? wellData.tubingData : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, resolveIntervalFallback(row, index))
  }),
  drillString: Object.freeze({
    key: 'drillString',
    labelKey: 'ui.tabs.drill_string',
    fallbackLabel: 'Drill String',
    storeKey: 'drillStringData',
    entityType: 'drillString',
    canHighlight: true,
    canReorder: true,
    isVisible: ({ operationPhase }) => !isProductionPhase(operationPhase),
    commonFields: Object.freeze(['label', 'componentType', 'od', 'top', 'bottom', 'showLabel']),
    resolveRows: (wellData) => Array.isArray(wellData?.drillStringData) ? wellData.drillStringData : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, resolveIntervalFallback(row, index))
  }),
  equipment: Object.freeze({
    key: 'equipment',
    labelKey: 'ui.tabs.equipment',
    fallbackLabel: 'Equipment',
    storeKey: 'equipmentData',
    entityType: 'equipment',
    canHighlight: true,
    canReorder: true,
    isVisible: ({ operationPhase }) => isProductionPhase(operationPhase),
    commonFields: Object.freeze(['type', 'depth', 'label', 'showLabel']),
    resolveRows: (wellData) => Array.isArray(wellData?.equipmentData) ? wellData.equipmentData : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, `Equipment ${resolveIntervalFallback(row, index)}`)
  }),
  lines: Object.freeze({
    key: 'lines',
    labelKey: 'ui.tabs.lines',
    fallbackLabel: 'Lines',
    storeKey: 'horizontalLines',
    entityType: 'line',
    canHighlight: true,
    canReorder: true,
    commonFields: Object.freeze(['label', 'depth', 'show']),
    resolveRows: (wellData) => Array.isArray(wellData?.horizontalLines) ? wellData.horizontalLines : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, resolveIntervalFallback(row, index))
  }),
  plugs: Object.freeze({
    key: 'plugs',
    labelKey: 'ui.tabs.plugs',
    fallbackLabel: 'Plugs',
    storeKey: 'cementPlugs',
    entityType: 'plug',
    canHighlight: true,
    canReorder: true,
    commonFields: Object.freeze(['label', 'top', 'bottom', 'show']),
    resolveRows: (wellData) => Array.isArray(wellData?.cementPlugs) ? wellData.cementPlugs : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, resolveIntervalFallback(row, index))
  }),
  fluids: Object.freeze({
    key: 'fluids',
    labelKey: 'ui.tabs.fluids',
    fallbackLabel: 'Fluids',
    storeKey: 'annulusFluids',
    entityType: 'fluid',
    canHighlight: true,
    canReorder: true,
    commonFields: Object.freeze(['label', 'placement', 'top', 'bottom', 'show']),
    resolveRows: (wellData) => Array.isArray(wellData?.annulusFluids) ? wellData.annulusFluids : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, resolveIntervalFallback(row, index))
  }),
  markers: Object.freeze({
    key: 'markers',
    labelKey: 'ui.tabs.markers',
    fallbackLabel: 'Markers',
    storeKey: 'markers',
    entityType: 'marker',
    canHighlight: true,
    canReorder: true,
    commonFields: Object.freeze(['label', 'type', 'top', 'bottom', 'show']),
    resolveRows: (wellData) => Array.isArray(wellData?.markers) ? wellData.markers : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, resolveIntervalFallback(row, index))
  }),
  topologySources: Object.freeze({
    key: 'topologySources',
    labelKey: 'ui.tabs.topology_sources',
    fallbackLabel: 'Inflow Points',
    storeKey: 'topologySources',
    entityType: 'topologySource',
    canHighlight: false,
    canReorder: true,
    commonFields: Object.freeze(['label', 'sourceType', 'top', 'bottom', 'volumeKey', 'show']),
    resolveRows: (wellData) => filterScenarioSourceRows(wellData?.topologySources),
    mergeRows: (allRows, rowsForDomain) => mergeScenarioSourceRows(allRows, rowsForDomain),
    resolveItemLabel: (row, index) => resolveTopologySourceLabel(row, index)
  }),
  topologyBreakouts: Object.freeze({
    key: 'topologyBreakouts',
    labelKey: 'ui.tabs.topology_breakouts',
    fallbackLabel: 'Crossflow Paths',
    storeKey: 'topologySources',
    entityType: 'topologyBreakout',
    canHighlight: false,
    canReorder: true,
    commonFields: Object.freeze(['label', 'fromVolumeKey', 'toVolumeKey', 'top', 'bottom', 'show']),
    resolveRows: (wellData) => filterScenarioBreakoutRows(wellData?.topologySources),
    mergeRows: (allRows, rowsForDomain) => mergeScenarioBreakoutRows(allRows, rowsForDomain),
    resolveItemLabel: (row, index) => resolveTopologyBreakoutLabel(row, index)
  }),
  boxes: Object.freeze({
    key: 'boxes',
    labelKey: 'ui.tabs.boxes',
    fallbackLabel: 'Boxes',
    storeKey: 'annotationBoxes',
    entityType: 'box',
    canHighlight: true,
    canReorder: true,
    commonFields: Object.freeze(['label', 'topDepth', 'bottomDepth', 'show']),
    resolveRows: (wellData) => Array.isArray(wellData?.annotationBoxes) ? wellData.annotationBoxes : [],
    resolveItemLabel: (row, index) => resolveRowLabel(row, resolveIntervalFallback(row, index))
  }),
  trajectory: Object.freeze({
    key: 'trajectory',
    labelKey: 'ui.tabs.trajectory',
    fallbackLabel: 'Well Trajectory',
    storeKey: 'trajectory',
    entityType: 'trajectory',
    canHighlight: false,
    canReorder: true,
    isVisible: ({ viewMode }) => isDirectionalView(viewMode),
    commonFields: Object.freeze(['md', 'inc', 'azi', 'comment']),
    resolveRows: (wellData) => Array.isArray(wellData?.trajectory) ? wellData.trajectory : [],
    resolveItemLabel: (row, index) => resolveTrajectoryLabel(row, index)
  })
});

export const HIERARCHY_DOMAIN_ORDER = Object.freeze([
  'casing',
  'tubing',
  'drillString',
  'equipment',
  'lines',
  'plugs',
  'fluids',
  'markers',
  'topologySources',
  'topologyBreakouts',
  'boxes',
  'trajectory'
]);

export function getHierarchyDomainMeta(domainKey) {
  return HIERARCHY_DOMAIN_META[String(domainKey ?? '').trim()] ?? null;
}

export function getVisibleHierarchyDomainKeys(context = {}) {
  return HIERARCHY_DOMAIN_ORDER.filter((domainKey) => {
    const domainMeta = getHierarchyDomainMeta(domainKey);
    if (!domainMeta) return false;
    if (typeof domainMeta.isVisible !== 'function') return true;
    return domainMeta.isVisible(context) === true;
  });
}

export function resolveHierarchyRowsForDomain(domainKey, wellData) {
  const domainMeta = getHierarchyDomainMeta(domainKey);
  if (!domainMeta || typeof domainMeta.resolveRows !== 'function') return [];
  return domainMeta.resolveRows(wellData);
}

export function mergeHierarchyDomainRows(domainKey, allRows, rowsForDomain) {
  const domainMeta = getHierarchyDomainMeta(domainKey);
  if (!domainMeta || typeof domainMeta.mergeRows !== 'function') {
    return Array.isArray(rowsForDomain) ? rowsForDomain : [];
  }
  const safeAllRows = cloneTopologyRows(allRows);
  const safeRowsForDomain = cloneTopologyRows(rowsForDomain);
  return domainMeta.mergeRows(safeAllRows, safeRowsForDomain);
}

export function resolveHierarchyItemLabel(domainKey, row, index) {
  const domainMeta = getHierarchyDomainMeta(domainKey);
  if (!domainMeta || typeof domainMeta.resolveItemLabel !== 'function') {
    return `#${Number(index) + 1}`;
  }
  return domainMeta.resolveItemLabel(row, index);
}

export function resolveHierarchyRenameField(domainKey, row = {}) {
  const normalizedDomainKey = String(domainKey ?? '').trim();
  if (normalizedDomainKey === 'trajectory') return 'comment';

  const renameCandidates = ['label', 'name', 'comment'];
  const populatedField = renameCandidates.find((field) => normalizeText(row?.[field]));
  if (populatedField) return populatedField;

  return 'label';
}

export function createHierarchyDefaultRow(domainKey) {
  if (domainKey === 'casing') {
    return { label: 'New Casing', od: 9.625, weight: 40, grade: 'L80', top: 0, bottom: 5000, showTop: true, showBottom: true };
  }
  if (domainKey === 'tubing') {
    return { label: 'New Tubing', od: 2.875, weight: 6.5, grade: 'L80', top: 0, bottom: 10000, showLabel: true };
  }
  if (domainKey === 'drillString') {
    return { label: 'New Drill String', componentType: 'pipe', od: 5.0, weight: 19.5, grade: 'S-135', top: 0, bottom: 10000, showLabel: true };
  }
  if (domainKey === 'equipment') {
    return { depth: 3000, type: 'Packer', color: 'black', scale: 1, label: 'New Equipment', showLabel: true };
  }
  if (domainKey === 'lines') {
    return { depth: 1000, label: 'New Line', color: 'gray', lineStyle: 'dashed', show: true };
  }
  if (domainKey === 'plugs') {
    return { top: 4000, bottom: 4500, type: 'Cement', color: 'darkgray', show: true };
  }
  if (domainKey === 'fluids') {
    return { label: 'New Fluid', top: 0, bottom: 5000, placement: 'Auto', color: 'lightblue', show: true };
  }
  if (domainKey === 'markers') {
    return { top: 4500, bottom: 4500, type: 'Perforation', side: 'Both', color: 'orange', scale: 1, label: 'New Marker', show: true };
  }
  if (domainKey === 'topologySources') {
    return { top: 9000, bottom: 9000, sourceType: SOURCE_KIND_SCENARIO, volumeKey: DEFAULT_SOURCE_VOLUME_KEY, label: 'New Inflow Point', show: true };
  }
  if (domainKey === 'topologyBreakouts') {
    return {
      top: 9000,
      bottom: 9000,
      sourceType: SOURCE_KIND_SCENARIO,
      volumeKey: null,
      fromVolumeKey: DEFAULT_BREAKOUT_FROM_VOLUME_KEY,
      toVolumeKey: DEFAULT_BREAKOUT_TO_VOLUME_KEY,
      label: 'New Crossflow Path',
      show: true
    };
  }
  if (domainKey === 'boxes') {
    return { topDepth: 1000, bottomDepth: 2000, label: 'New Box', detail: '', showDetails: false, show: true };
  }
  if (domainKey === 'trajectory') {
    return { md: null, inc: null, azi: null, comment: '' };
  }
  return {};
}

export function isHierarchyDomainHighlightable(domainKey) {
  const domainMeta = getHierarchyDomainMeta(domainKey);
  return domainMeta?.canHighlight === true;
}

export function isHierarchyDomainRow(row, domainKey) {
  if (domainKey === 'topologySources') return !isScenarioBreakoutRow(row);
  if (domainKey === 'topologyBreakouts') return isScenarioBreakoutRow(row);
  return true;
}
