import { getHierarchyDomainMeta } from '@/workspace/hierarchyDomainMeta.js';
import {
  DATA_TAB_READ_ONLY_FIELDS_ENABLED,
  ENTITY_EDITOR_CONTROL_TYPES,
  resolveControlType,
  resolveDataTabFieldDefinitions,
  resolveDomainFieldContracts,
  resolveEntityEditorDomainKey,
  resolveFieldDefinitionFromContract,
  resolveFieldLabel
} from '@/controls/entityEditor/entityFieldContract.js';

export {
  DATA_TAB_READ_ONLY_FIELDS_ENABLED,
  ENTITY_EDITOR_CONTROL_TYPES
};

function normalizeToken(value) {
  return String(value ?? '').trim();
}

function resolveAdvancedFieldNames(rowData = {}) {
  return Object.keys(rowData).filter((field) => field !== 'rowId');
}

function resolveCommonFieldNames(domainMeta, rowData = {}) {
  const configured = Array.isArray(domainMeta?.commonFields) ? domainMeta.commonFields : [];
  if (configured.length > 0) return configured;
  return resolveAdvancedFieldNames(rowData);
}

function resolveFallbackFieldDefinition(field, sourceRow) {
  const normalizedField = normalizeToken(field);
  return {
    field: normalizedField,
    label: resolveFieldLabel(normalizedField),
    controlType: resolveControlType(sourceRow?.[normalizedField]),
    options: null,
    min: null,
    max: null,
    step: null,
    slider: null,
    readOnly: false
  };
}

function resolveDefinitionByFieldName(definitions = [], fieldName) {
  return definitions.find((definition) => normalizeToken(definition?.field) === normalizeToken(fieldName)) ?? null;
}

export function resolveEntityEditorFieldDefinitions({
  entityType,
  rowData = {},
  mode = 'advanced',
  context = null,
  includeReadOnly = DATA_TAB_READ_ONLY_FIELDS_ENABLED
} = {}) {
  const domainKey = resolveEntityEditorDomainKey(entityType);
  const domainMeta = getHierarchyDomainMeta(domainKey);
  const sourceRow = rowData && typeof rowData === 'object' ? rowData : {};
  const domainContracts = resolveDomainFieldContracts(domainKey);

  if (mode === 'common') {
    const commonFieldNames = resolveCommonFieldNames(domainMeta, sourceRow);
    return commonFieldNames.map((fieldName) => {
      const configured = resolveDefinitionByFieldName(domainContracts, fieldName);
      if (configured) {
        return resolveFieldDefinitionFromContract(configured, sourceRow, context);
      }
      return resolveFallbackFieldDefinition(fieldName, sourceRow);
    }).filter(Boolean);
  }

  const dataTabDefinitions = resolveDataTabFieldDefinitions({
    entityType,
    rowData: sourceRow,
    context,
    includeReadOnly
  });
  if (dataTabDefinitions.length > 0) return dataTabDefinitions;

  return resolveAdvancedFieldNames(sourceRow).map((fieldName) => (
    resolveFallbackFieldDefinition(fieldName, sourceRow)
  ));
}
