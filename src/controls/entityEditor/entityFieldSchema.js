import { getHierarchyDomainMeta } from '@/workspace/hierarchyDomainMeta.js';

export const ENTITY_EDITOR_CONTROL_TYPES = Object.freeze({
  text: 'text',
  number: 'number',
  toggle: 'toggle',
  json: 'json'
});

const ENTITY_TYPE_TO_DOMAIN_KEY = Object.freeze({
  casing: 'casing',
  tubing: 'tubing',
  drillString: 'drillString',
  drillstring: 'drillString',
  equipment: 'equipment',
  line: 'lines',
  lines: 'lines',
  plug: 'plugs',
  plugs: 'plugs',
  fluid: 'fluids',
  fluids: 'fluids',
  marker: 'markers',
  markers: 'markers',
  box: 'boxes',
  boxes: 'boxes',
  topologySource: 'topologySources',
  topologysource: 'topologySources',
  topologySources: 'topologySources',
  topologyBreakout: 'topologyBreakouts',
  topologybreakout: 'topologyBreakouts',
  topologyBreakouts: 'topologyBreakouts',
  trajectory: 'trajectory'
});

function normalizeToken(value) {
  return String(value ?? '').trim();
}

function resolveDomainKey(entityType) {
  const token = normalizeToken(entityType);
  if (!token) return null;
  return ENTITY_TYPE_TO_DOMAIN_KEY[token] ?? ENTITY_TYPE_TO_DOMAIN_KEY[token.toLowerCase()] ?? null;
}

function resolveControlType(value) {
  if (typeof value === 'boolean') return ENTITY_EDITOR_CONTROL_TYPES.toggle;
  if (typeof value === 'number') return ENTITY_EDITOR_CONTROL_TYPES.number;
  if (value && typeof value === 'object') return ENTITY_EDITOR_CONTROL_TYPES.json;
  return ENTITY_EDITOR_CONTROL_TYPES.text;
}

function resolveFieldLabel(field) {
  return normalizeToken(field)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function resolveAdvancedFieldNames(rowData = {}) {
  return Object.keys(rowData).filter((field) => field !== 'rowId');
}

function resolveCommonFieldNames(domainMeta, rowData = {}) {
  const configured = Array.isArray(domainMeta?.commonFields) ? domainMeta.commonFields : [];
  if (configured.length > 0) return configured;
  return resolveAdvancedFieldNames(rowData);
}

export function resolveEntityEditorFieldDefinitions({
  entityType,
  rowData = {},
  mode = 'advanced'
} = {}) {
  const domainKey = resolveDomainKey(entityType);
  const domainMeta = getHierarchyDomainMeta(domainKey);
  const sourceRow = rowData && typeof rowData === 'object' ? rowData : {};
  const fieldNames = mode === 'common'
    ? resolveCommonFieldNames(domainMeta, sourceRow)
    : resolveAdvancedFieldNames(sourceRow);

  return fieldNames.map((field) => ({
    field,
    label: resolveFieldLabel(field),
    controlType: resolveControlType(sourceRow[field])
  }));
}
