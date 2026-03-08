import { cloneSnapshot } from '@/utils/general.js';
import { createRowId } from '@/utils/rowIdentity.js';
import {
  BOUNDARY_STATE_OPTIONS,
  DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY,
  DEVICE_STATE_OPTIONS,
  ENTITY_KIND_BOUNDARY,
  ENTITY_KIND_DEVICE,
  ENTITY_KIND_JUNCTION,
  ENTITY_KIND_TERMINATION,
  SURFACE_ASSEMBLY_FAMILY_DEFINITION_BY_KEY,
  TERMINATION_TYPE_DEFINITIONS,
  TYPE_LABEL_BY_KEY,
} from '@/utils/surfaceAssemblyFamilyRegistry.js';

export { DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY } from '@/utils/surfaceAssemblyFamilyRegistry.js';
export {
  ENTITY_KIND_BOUNDARY,
  ENTITY_KIND_DEVICE,
  ENTITY_KIND_JUNCTION,
  ENTITY_KIND_TERMINATION,
} from '@/utils/surfaceAssemblyFamilyRegistry.js';

export const SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE = 'simple-tree';

function toToken(value) {
  const token = String(value ?? '').trim();
  return token || null;
}

function findBySlotKey(items = [], slotKey) {
  const safeSlotKey = toToken(slotKey);
  if (!safeSlotKey) return null;
  return (Array.isArray(items) ? items : []).find((item) => item?.slotKey === safeSlotKey) ?? null;
}

function resolveStateOptions(entityKind) {
  if (entityKind === ENTITY_KIND_BOUNDARY) return BOUNDARY_STATE_OPTIONS;
  return DEVICE_STATE_OPTIONS;
}

function normalizeEntityState(nextState, allowedStates = []) {
  const token = String(nextState ?? '').trim().toLowerCase();
  const matched = allowedStates.find((option) => option.value === token);
  return matched?.value ?? allowedStates[0]?.value ?? null;
}

function normalizeEntityType(typeKey, allowedTypeKeys = [], fallbackTypeKey = null) {
  const token = toToken(typeKey);
  if (token && allowedTypeKeys.includes(token)) return token;
  if (fallbackTypeKey && allowedTypeKeys.includes(fallbackTypeKey)) return fallbackTypeKey;
  return allowedTypeKeys[0] ?? null;
}

function buildEntryPath(template) {
  return {
    pathId: createRowId('surface-path'),
    roleKey: template.roleKey,
    label: template.label,
    sourceVolumeKey: template.sourceVolumeKey,
  };
}

function buildJunction(template) {
  return {
    junctionId: createRowId('surface-junction'),
    junctionKey: template.junctionKey,
    label: template.label,
    pathRoleKey: template.pathRoleKey,
  };
}

function buildDevice(template) {
  return {
    deviceId: createRowId('surface-device'),
    slotKey: template.slotKey,
    label: template.label,
    typeKey: template.defaultTypeKey,
    pathRoleKey: template.pathRoleKey,
    state: template.defaultState,
  };
}

function buildBoundary(template) {
  return {
    boundaryId: createRowId('surface-boundary'),
    slotKey: template.slotKey,
    label: template.label,
    typeKey: template.defaultTypeKey,
    pathRoleKey: template.pathRoleKey,
    state: template.defaultState,
  };
}

function buildTermination(template) {
  return {
    terminationId: createRowId('surface-termination'),
    slotKey: template.slotKey,
    label: template.label,
    typeKey: template.defaultTypeKey,
    pathRoleKey: template.pathRoleKey,
  };
}

function buildAnchors(entryPaths = []) {
  return entryPaths.map((path) => ({
    anchorId: createRowId('surface-anchor'),
    pathRoleKey: path.roleKey,
    sourceVolumeKey: path.sourceVolumeKey,
  }));
}

function createNormalizedAssembly(definition) {
  const entryPaths = definition.entryPathTemplates.map(buildEntryPath);
  return {
    assemblyId: createRowId('surface-assembly'),
    familyKey: definition.familyKey,
    label: definition.label,
    entryPaths,
    junctions: definition.junctionTemplates.map(buildJunction),
    devices: definition.deviceSlots.map(buildDevice),
    boundaries: definition.boundarySlots.map(buildBoundary),
    terminations: definition.terminationSlots.map(buildTermination),
    anchors: buildAnchors(entryPaths),
  };
}

function mergeEntitiesWithDefinition(persistedItems = [], definitionItems = [], entityKind) {
  return definitionItems.map((definitionItem) => {
    const persisted = findBySlotKey(persistedItems, definitionItem.slotKey);
    const base = entityKind === ENTITY_KIND_DEVICE
      ? buildDevice(definitionItem)
      : entityKind === ENTITY_KIND_BOUNDARY
        ? buildBoundary(definitionItem)
        : buildTermination(definitionItem);

    if (!persisted) {
      return base;
    }

    const next = {
      ...base,
      ...cloneSnapshot(persisted),
      slotKey: definitionItem.slotKey,
      label: toToken(persisted?.label) ?? definitionItem.label,
      pathRoleKey: definitionItem.pathRoleKey,
    };

    next.typeKey = normalizeEntityType(
      persisted?.typeKey,
      definitionItem.allowedTypeKeys ?? [],
      definitionItem.defaultTypeKey
    );

    if (entityKind !== ENTITY_KIND_TERMINATION) {
      next.state = normalizeEntityState(
        persisted?.state,
        resolveStateOptions(entityKind)
      );
    }

    return next;
  });
}

function updateEntityList(assembly, listKey, slotKey, updater) {
  const normalized = normalizeSurfaceAssembly(assembly) ?? createSurfaceAssemblyFromFamily();
  const nextAssembly = cloneSnapshot(normalized);
  const targetIndex = nextAssembly[listKey].findIndex((item) => item?.slotKey === slotKey);
  if (targetIndex < 0) return nextAssembly;
  const nextItem = updater(nextAssembly[listKey][targetIndex], nextAssembly);
  nextAssembly[listKey] = nextAssembly[listKey].map((item, index) => (
    index === targetIndex ? nextItem : item
  ));
  return nextAssembly;
}

export function resolveSurfaceAssemblyFamilyDefinition(familyKey) {
  const safeFamilyKey = toToken(familyKey);
  if (!safeFamilyKey) return null;
  return SURFACE_ASSEMBLY_FAMILY_DEFINITION_BY_KEY[safeFamilyKey] ?? null;
}

export function listSurfaceAssemblyFamilies() {
  return Object.freeze(
    Object.values(SURFACE_ASSEMBLY_FAMILY_DEFINITION_BY_KEY).map((definition) => Object.freeze({
      familyKey: definition.familyKey,
      label: definition.label,
      description: definition.description,
      previewTitle: definition.previewTitle,
    }))
  );
}

export function createSurfaceAssemblyFromFamily(familyKey = DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY) {
  const definition = resolveSurfaceAssemblyFamilyDefinition(familyKey)
    ?? resolveSurfaceAssemblyFamilyDefinition(DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY);
  return createNormalizedAssembly(definition);
}

export function createSurfaceAssemblyFromTemplate(templateKey = SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE) {
  if (templateKey === SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE) {
    return createSurfaceAssemblyFromFamily('vertical-tree');
  }
  return createSurfaceAssemblyFromFamily(DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY);
}

export function normalizeSurfaceAssembly(surfaceAssembly = null) {
  if (!surfaceAssembly || typeof surfaceAssembly !== 'object' || Array.isArray(surfaceAssembly)) {
    return null;
  }

  const persisted = cloneSnapshot(surfaceAssembly);
  const definition = resolveSurfaceAssemblyFamilyDefinition(
    persisted.familyKey ?? DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY
  ) ?? resolveSurfaceAssemblyFamilyDefinition(DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY);
  const normalized = createNormalizedAssembly(definition);

  normalized.assemblyId = toToken(persisted.assemblyId) ?? normalized.assemblyId;
  normalized.label = toToken(persisted.label) ?? definition.label;
  normalized.entryPaths = normalized.entryPaths.map((entryPath) => {
    const persistedPath = (Array.isArray(persisted.entryPaths) ? persisted.entryPaths : []).find(
      (candidate) => candidate?.roleKey === entryPath.roleKey
    );
    return {
      ...entryPath,
      pathId: toToken(persistedPath?.pathId) ?? entryPath.pathId,
      label: toToken(persistedPath?.label) ?? entryPath.label,
      sourceVolumeKey: toToken(persistedPath?.sourceVolumeKey) ?? entryPath.sourceVolumeKey,
    };
  });
  normalized.junctions = normalized.junctions.map((junction) => {
    const persistedJunction = (Array.isArray(persisted.junctions) ? persisted.junctions : []).find(
      (candidate) => candidate?.junctionKey === junction.junctionKey
    );
    return {
      ...junction,
      junctionId: toToken(persistedJunction?.junctionId) ?? junction.junctionId,
      label: toToken(persistedJunction?.label) ?? junction.label,
    };
  });
  normalized.devices = mergeEntitiesWithDefinition(persisted.devices, definition.deviceSlots, ENTITY_KIND_DEVICE);
  normalized.boundaries = mergeEntitiesWithDefinition(persisted.boundaries, definition.boundarySlots, ENTITY_KIND_BOUNDARY);
  normalized.terminations = mergeEntitiesWithDefinition(persisted.terminations, definition.terminationSlots, ENTITY_KIND_TERMINATION);
  normalized.anchors = buildAnchors(normalized.entryPaths).map((anchor) => {
    const persistedAnchor = (Array.isArray(persisted.anchors) ? persisted.anchors : []).find(
      (candidate) => candidate?.pathRoleKey === anchor.pathRoleKey
    );
    return {
      ...anchor,
      anchorId: toToken(persistedAnchor?.anchorId) ?? anchor.anchorId,
      sourceVolumeKey: toToken(persistedAnchor?.sourceVolumeKey) ?? anchor.sourceVolumeKey,
    };
  });

  return normalized;
}

export function createSurfaceAssemblyEntityKey(entityKind, slotKey) {
  const safeEntityKind = toToken(entityKind);
  const safeSlotKey = toToken(slotKey);
  if (!safeEntityKind || !safeSlotKey) return null;
  return `${safeEntityKind}:${safeSlotKey}`;
}

export function resolveSurfaceAssemblyEntity(assembly, entityKey) {
  const safeEntityKey = toToken(entityKey);
  if (!safeEntityKey) return null;
  const [entityKind, entityToken] = safeEntityKey.split(':');
  if (entityKind === ENTITY_KIND_DEVICE) return findBySlotKey(assembly?.devices, entityToken);
  if (entityKind === ENTITY_KIND_BOUNDARY) return findBySlotKey(assembly?.boundaries, entityToken);
  if (entityKind === ENTITY_KIND_TERMINATION) return findBySlotKey(assembly?.terminations, entityToken);
  if (entityKind === ENTITY_KIND_JUNCTION) {
    return (Array.isArray(assembly?.junctions) ? assembly.junctions : []).find((junction) => (
      junction?.junctionKey === entityToken
    )) ?? null;
  }
  return null;
}

export function updateSurfaceAssemblyFamily(assembly, familyKey) {
  const nextDefinition = resolveSurfaceAssemblyFamilyDefinition(familyKey)
    ?? resolveSurfaceAssemblyFamilyDefinition(DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY);
  const nextAssembly = createNormalizedAssembly(nextDefinition);
  const currentLabel = toToken(assembly?.label);
  if (currentLabel) {
    nextAssembly.label = currentLabel;
  }
  return nextAssembly;
}

export function updateSurfaceAssemblyDeviceState(assembly, slotKey, nextState) {
  return updateEntityList(assembly, 'devices', slotKey, (device) => ({
    ...device,
    state: normalizeEntityState(nextState, DEVICE_STATE_OPTIONS),
  }));
}

export function updateSurfaceAssemblyBoundaryState(assembly, slotKey, nextState) {
  return updateEntityList(assembly, 'boundaries', slotKey, (boundary) => ({
    ...boundary,
    state: normalizeEntityState(nextState, BOUNDARY_STATE_OPTIONS),
  }));
}

export function updateSurfaceAssemblyDeviceType(assembly, slotKey, nextTypeKey) {
  const normalized = normalizeSurfaceAssembly(assembly) ?? createSurfaceAssemblyFromFamily();
  const definition = resolveSurfaceAssemblyFamilyDefinition(normalized.familyKey);
  const deviceDefinition = definition?.deviceSlots.find((slot) => slot.slotKey === slotKey) ?? null;
  return updateEntityList(normalized, 'devices', slotKey, (device) => ({
    ...device,
    typeKey: normalizeEntityType(
      nextTypeKey,
      deviceDefinition?.allowedTypeKeys ?? [],
      deviceDefinition?.defaultTypeKey ?? device?.typeKey
    ),
  }));
}

export function updateSurfaceAssemblyTerminationType(assembly, slotKey, nextTypeKey) {
  const normalized = normalizeSurfaceAssembly(assembly) ?? createSurfaceAssemblyFromFamily();
  const definition = resolveSurfaceAssemblyFamilyDefinition(normalized.familyKey);
  const terminationDefinition = definition?.terminationSlots.find((slot) => slot.slotKey === slotKey) ?? null;
  return updateEntityList(normalized, 'terminations', slotKey, (termination) => ({
    ...termination,
    typeKey: normalizeEntityType(
      nextTypeKey,
      terminationDefinition?.allowedTypeKeys ?? [],
      terminationDefinition?.defaultTypeKey ?? termination?.typeKey
    ),
  }));
}

export function getSurfaceAssemblyTerminationDefinition(typeKey) {
  return TERMINATION_TYPE_DEFINITIONS[toToken(typeKey)] ?? TERMINATION_TYPE_DEFINITIONS.none;
}

export function getSurfaceAssemblyTopologyRoutes(assembly) {
  const normalized = normalizeSurfaceAssembly(assembly);
  if (!normalized) return [];
  const definition = resolveSurfaceAssemblyFamilyDefinition(normalized.familyKey);
  return Array.isArray(definition?.topologyRoutes) ? definition.topologyRoutes : [];
}

export function buildSurfaceAssemblyEditorSections(assembly) {
  const normalized = normalizeSurfaceAssembly(assembly);
  if (!normalized) return [];
  const definition = resolveSurfaceAssemblyFamilyDefinition(normalized.familyKey);
  if (!definition) return [];

  return definition.editorSections.map((section) => ({
    sectionKey: section.sectionKey,
    title: section.title,
    description: section.description,
    rows: section.entityRefs.map((entityRef) => {
      const [entityKind, entityToken] = String(entityRef).split(':');
      if (entityKind === ENTITY_KIND_JUNCTION) {
        const junction = normalized.junctions.find((item) => item.junctionKey === entityToken);
        return {
          entityKey: entityRef,
          entityKind,
          slotKey: entityToken,
          label: junction?.label ?? entityToken,
          description: 'Branch point managed by the selected family.',
          typeOptions: [],
          stateOptions: [],
          editable: false,
        };
      }

      const entity = resolveSurfaceAssemblyEntity(normalized, entityRef);
      const slotDefinition = entityKind === ENTITY_KIND_DEVICE
        ? definition.deviceSlots.find((slot) => slot.slotKey === entityToken)
        : entityKind === ENTITY_KIND_BOUNDARY
          ? definition.boundarySlots.find((slot) => slot.slotKey === entityToken)
          : definition.terminationSlots.find((slot) => slot.slotKey === entityToken);
      return {
        entityKey: entityRef,
        entityKind,
        slotKey: entityToken,
        label: entity?.label ?? slotDefinition?.label ?? entityToken,
        currentTypeKey: entity?.typeKey ?? null,
        currentTypeLabel: TYPE_LABEL_BY_KEY[entity?.typeKey] ?? entity?.typeKey ?? null,
        currentState: entity?.state ?? null,
        typeOptions: (slotDefinition?.allowedTypeKeys ?? [])
          .map((typeKey) => ({ value: typeKey, label: TYPE_LABEL_BY_KEY[typeKey] ?? typeKey })),
        stateOptions: entityKind === ENTITY_KIND_TERMINATION ? [] : resolveStateOptions(entityKind),
        editable: true,
      };
    }),
  }));
}

export function validateSurfaceAssembly(assembly) {
  const normalized = normalizeSurfaceAssembly(assembly);
  if (!normalized) return [];
  const definition = resolveSurfaceAssemblyFamilyDefinition(normalized.familyKey);
  if (!definition) {
    return [{
      code: 'unknown_family',
      message: 'Surface assembly family is not supported.',
    }];
  }

  const warnings = [];
  definition.terminationSlots.forEach((slot) => {
    const termination = findBySlotKey(normalized.terminations, slot.slotKey);
    if (!termination || termination.typeKey === 'none') {
      warnings.push({
        code: 'missing_termination',
        entityKind: ENTITY_KIND_TERMINATION,
        slotKey: slot.slotKey,
        message: `${slot.label} is not defined.`,
      });
    }
  });
  definition.entryPathTemplates.forEach((pathTemplate) => {
    const anchor = normalized.anchors.find((candidate) => candidate.pathRoleKey === pathTemplate.roleKey);
    if (!anchor?.sourceVolumeKey) {
      warnings.push({
        code: 'missing_anchor',
        entityKind: 'anchor',
        slotKey: pathTemplate.roleKey,
        message: `${pathTemplate.label} is missing a surface anchor.`,
      });
    }
  });

  return warnings;
}

export function getSurfaceAssemblyFamilySummary(assembly) {
  const normalized = normalizeSurfaceAssembly(assembly);
  if (!normalized) return null;
  const definition = resolveSurfaceAssemblyFamilyDefinition(normalized.familyKey);
  return {
    familyKey: normalized.familyKey,
    label: definition?.label ?? normalized.label,
    description: definition?.description ?? '',
    previewTitle: definition?.previewTitle ?? normalized.label,
  };
}

export default {
  DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY,
  SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE,
  buildSurfaceAssemblyEditorSections,
  createSurfaceAssemblyEntityKey,
  createSurfaceAssemblyFromFamily,
  createSurfaceAssemblyFromTemplate,
  getSurfaceAssemblyFamilySummary,
  getSurfaceAssemblyTerminationDefinition,
  getSurfaceAssemblyTopologyRoutes,
  listSurfaceAssemblyFamilies,
  normalizeSurfaceAssembly,
  resolveSurfaceAssemblyEntity,
  resolveSurfaceAssemblyFamilyDefinition,
  updateSurfaceAssemblyBoundaryState,
  updateSurfaceAssemblyDeviceState,
  updateSurfaceAssemblyDeviceType,
  updateSurfaceAssemblyFamily,
  updateSurfaceAssemblyTerminationType,
  validateSurfaceAssembly,
};
