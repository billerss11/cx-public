import { normalizeRowId } from '@/utils/rowIdentity.js';
import { isScenarioBreakoutRow } from '@/topology/sourceRows.js';

const SELECTION_ROW_LOCATOR_META = Object.freeze({
  casing: Object.freeze({ storeKey: 'casingData', interactionType: 'casing', canHighlight: true }),
  tubing: Object.freeze({ storeKey: 'tubingData', interactionType: 'tubing', canHighlight: true }),
  drillString: Object.freeze({ storeKey: 'drillStringData', interactionType: 'drillString', canHighlight: true }),
  equipment: Object.freeze({ storeKey: 'equipmentData', interactionType: 'equipment', canHighlight: true }),
  line: Object.freeze({ storeKey: 'horizontalLines', interactionType: 'line', canHighlight: true }),
  plug: Object.freeze({ storeKey: 'cementPlugs', interactionType: 'plug', canHighlight: true }),
  fluid: Object.freeze({ storeKey: 'annulusFluids', interactionType: 'fluid', canHighlight: true }),
  marker: Object.freeze({ storeKey: 'markers', interactionType: 'marker', canHighlight: true }),
  box: Object.freeze({ storeKey: 'annotationBoxes', interactionType: 'box', canHighlight: true }),
  topologySource: Object.freeze({
    storeKey: 'topologySources',
    interactionType: null,
    canHighlight: false,
    filterRows: (rows) => rows.filter((row) => !isScenarioBreakoutRow(row))
  }),
  topologyBreakout: Object.freeze({
    storeKey: 'topologySources',
    interactionType: null,
    canHighlight: false,
    filterRows: (rows) => rows.filter((row) => isScenarioBreakoutRow(row))
  }),
  trajectory: Object.freeze({ storeKey: 'trajectory', interactionType: null, canHighlight: false })
});

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeSelectableEntityType(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (!token) return null;
  if (token === 'lines') return 'line';
  if (token === 'plugs') return 'plug';
  if (token === 'fluids') return 'fluid';
  if (token === 'markers') return 'marker';
  if (token === 'boxes') return 'box';
  if (token === 'topologysources' || token === 'topology-sources' || token === 'topology_sources') return 'topologySource';
  if (token === 'topologybreakouts' || token === 'topology-breakouts' || token === 'topology_breakouts') {
    return 'topologyBreakout';
  }
  if (token === 'drillstring' || token === 'drill-string' || token === 'drill_string') return 'drillString';
  if (token === 'topologysource' || token === 'topology-source' || token === 'topology_source') return 'topologySource';
  if (token === 'topologybreakout' || token === 'topology-breakout' || token === 'topology_breakout') {
    return 'topologyBreakout';
  }
  if (token in SELECTION_ROW_LOCATOR_META) {
    return token;
  }
  return null;
}

export function getSelectionRowLocatorMeta(entityType) {
  const normalized = normalizeSelectableEntityType(entityType);
  if (!normalized) return null;
  return SELECTION_ROW_LOCATOR_META[normalized] ?? null;
}

export function resolveSelectionRowTarget(projectDataStore, rowRef = {}) {
  const normalizedEntityType = normalizeSelectableEntityType(rowRef?.entityType);
  const normalizedRowId = normalizeRowId(rowRef?.rowId);
  if (!projectDataStore || !normalizedEntityType || !normalizedRowId) return null;

  const meta = getSelectionRowLocatorMeta(normalizedEntityType);
  if (!meta) return null;

  const rawRows = toSafeArray(projectDataStore[meta.storeKey]);
  const domainRows = typeof meta.filterRows === 'function'
    ? meta.filterRows(rawRows)
    : rawRows;
  const domainRowIndex = domainRows.findIndex((row) => normalizeRowId(row?.rowId) === normalizedRowId);
  if (domainRowIndex < 0) return null;

  const row = domainRows[domainRowIndex];
  const storeRowIndex = rawRows.findIndex((rawRow) => normalizeRowId(rawRow?.rowId) === normalizedRowId);

  return {
    row,
    rowId: normalizedRowId,
    entityType: normalizedEntityType,
    storeKey: meta.storeKey,
    interactionType: meta.interactionType,
    canHighlight: meta.canHighlight === true,
    domainRowIndex,
    storeRowIndex: storeRowIndex >= 0 ? storeRowIndex : domainRowIndex
  };
}
