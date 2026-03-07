import { cloneSnapshot } from '@/utils/general.js';
import { createRowId } from '@/utils/rowIdentity.js';

export const SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE = 'simple-tree';

const COMPONENT_DEFINITION_BY_TYPE = Object.freeze({
  'casing-spool': Object.freeze({
    typeKey: 'casing-spool',
    label: 'Casing Spool',
    ports: Object.freeze(['north', 'south']),
    preview: Object.freeze({ shape: 'spool', width: 88, height: 28 }),
  }),
  'tubing-head': Object.freeze({
    typeKey: 'tubing-head',
    label: 'Tubing Head',
    ports: Object.freeze(['north', 'south']),
    preview: Object.freeze({ shape: 'spool', width: 82, height: 28 }),
  }),
  'master-valve': Object.freeze({
    typeKey: 'master-valve',
    label: 'Master Valve',
    ports: Object.freeze(['north', 'south']),
    preview: Object.freeze({ shape: 'valve', width: 42, height: 42 }),
  }),
  'tree-cross': Object.freeze({
    typeKey: 'tree-cross',
    label: 'Tree Cross',
    ports: Object.freeze(['north', 'south', 'east']),
    preview: Object.freeze({ shape: 'cross', width: 86, height: 30 }),
  }),
  'swab-valve': Object.freeze({
    typeKey: 'swab-valve',
    label: 'Swab Valve',
    ports: Object.freeze(['north', 'south']),
    preview: Object.freeze({ shape: 'valve', width: 42, height: 42 }),
  }),
  'wing-valve': Object.freeze({
    typeKey: 'wing-valve',
    label: 'Wing Valve',
    ports: Object.freeze(['west', 'east']),
    preview: Object.freeze({ shape: 'valve', width: 42, height: 42 }),
  }),
  outlet: Object.freeze({
    typeKey: 'outlet',
    label: 'Outlet',
    ports: Object.freeze(['west']),
    preview: Object.freeze({ shape: 'outlet', width: 66, height: 18 }),
  }),
  spool: Object.freeze({
    typeKey: 'spool',
    label: 'Spool',
    ports: Object.freeze(['north', 'south']),
    preview: Object.freeze({ shape: 'spool', width: 76, height: 26 }),
  }),
  valve: Object.freeze({
    typeKey: 'valve',
    label: 'Valve',
    ports: Object.freeze(['north', 'south']),
    preview: Object.freeze({ shape: 'valve', width: 40, height: 40 }),
  }),
});

function createComponent(typeKey) {
  const definition = resolveSurfaceAssemblyComponentDefinition(typeKey);
  if (!definition) {
    throw new Error(`Unknown surface assembly component type: ${typeKey}`);
  }

  return {
    componentId: createRowId('surface-component'),
    typeKey: definition.typeKey,
    label: definition.label,
  };
}

function createConnection(fromComponentId, fromPortKey, toComponentId, toPortKey) {
  return {
    connectionId: createRowId('surface-connection'),
    fromComponentId,
    fromPortKey,
    toComponentId,
    toPortKey,
  };
}

function buildOutgoingConnectionMap(connections = []) {
  return new Map(
    (Array.isArray(connections) ? connections : []).map((connection) => [
      `${connection.fromComponentId}:${connection.fromPortKey}`,
      connection,
    ])
  );
}

function findBranchSourceComponentId(assembly) {
  const trunkComponentIds = getOrderedTrunkComponentIds(assembly);
  const outgoingByPort = buildOutgoingConnectionMap(assembly?.connections);

  return trunkComponentIds.find((componentId) => {
    const connection = outgoingByPort.get(`${componentId}:east`);
    return Boolean(connection?.toComponentId);
  }) ?? null;
}

export function resolveSurfaceAssemblyComponentDefinition(typeKey) {
  const normalizedTypeKey = String(typeKey ?? '').trim();
  if (!normalizedTypeKey) return null;
  return COMPONENT_DEFINITION_BY_TYPE[normalizedTypeKey] ?? null;
}

export function listSurfaceAssemblyPaletteTypes() {
  return Object.freeze([
    Object.freeze({ lane: 'trunk', typeKey: 'spool' }),
    Object.freeze({ lane: 'trunk', typeKey: 'valve' }),
    Object.freeze({ lane: 'right', typeKey: 'wing-valve' }),
    Object.freeze({ lane: 'right', typeKey: 'outlet' }),
  ]);
}

export function createSurfaceAssemblyFromTemplate(templateKey = SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE) {
  const normalizedTemplateKey = String(templateKey ?? '').trim() || SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE;
  if (normalizedTemplateKey !== SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE) {
    throw new Error(`Unknown surface assembly template: ${normalizedTemplateKey}`);
  }

  const casingSpool = createComponent('casing-spool');
  const tubingHead = createComponent('tubing-head');
  const masterValve = createComponent('master-valve');
  const treeCross = createComponent('tree-cross');
  const swabValve = createComponent('swab-valve');
  const wingValve = createComponent('wing-valve');
  const outlet = createComponent('outlet');

  return {
    assemblyId: createRowId('surface-assembly'),
    templateKey: SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE,
    label: 'Simple Tree',
    components: [
      casingSpool,
      tubingHead,
      masterValve,
      treeCross,
      swabValve,
      wingValve,
      outlet,
    ],
    connections: [
      createConnection(casingSpool.componentId, 'north', tubingHead.componentId, 'south'),
      createConnection(tubingHead.componentId, 'north', masterValve.componentId, 'south'),
      createConnection(masterValve.componentId, 'north', treeCross.componentId, 'south'),
      createConnection(treeCross.componentId, 'north', swabValve.componentId, 'south'),
      createConnection(treeCross.componentId, 'east', wingValve.componentId, 'west'),
      createConnection(wingValve.componentId, 'east', outlet.componentId, 'west'),
    ],
    anchors: [
      {
        anchorId: createRowId('surface-anchor'),
        volumeKey: 'TUBING_INNER',
        componentId: casingSpool.componentId,
        portKey: 'south',
      },
    ],
  };
}

export function getOrderedTrunkComponentIds(assembly) {
  const anchor = Array.isArray(assembly?.anchors) ? assembly.anchors[0] : null;
  const rootComponentId = String(anchor?.componentId ?? '').trim();
  if (!rootComponentId) return [];

  const outgoingByPort = buildOutgoingConnectionMap(assembly?.connections);
  const ordered = [];
  const visited = new Set();

  let currentComponentId = rootComponentId;
  while (currentComponentId && !visited.has(currentComponentId)) {
    visited.add(currentComponentId);
    ordered.push(currentComponentId);
    const nextConnection = outgoingByPort.get(`${currentComponentId}:north`);
    currentComponentId = String(nextConnection?.toComponentId ?? '').trim() || null;
  }

  return ordered;
}

export function getOrderedRightBranchComponentIds(assembly) {
  const branchSourceComponentId = findBranchSourceComponentId(assembly);
  if (!branchSourceComponentId) return [];

  const outgoingByPort = buildOutgoingConnectionMap(assembly?.connections);
  const ordered = [];
  const visited = new Set([branchSourceComponentId]);
  let currentConnection = outgoingByPort.get(`${branchSourceComponentId}:east`) ?? null;

  while (currentConnection?.toComponentId) {
    const componentId = String(currentConnection.toComponentId).trim();
    if (!componentId || visited.has(componentId)) break;
    visited.add(componentId);
    ordered.push(componentId);
    currentConnection = outgoingByPort.get(`${componentId}:east`) ?? null;
  }

  return ordered;
}

export function appendSurfaceAssemblyTrunkComponent(assembly, typeKey) {
  const definition = resolveSurfaceAssemblyComponentDefinition(typeKey);
  if (!definition || !definition.ports.includes('south')) {
    return cloneSnapshot(assembly);
  }

  const nextAssembly = cloneSnapshot(assembly);
  const orderedTrunkComponentIds = getOrderedTrunkComponentIds(nextAssembly);
  const topComponentId = orderedTrunkComponentIds[orderedTrunkComponentIds.length - 1] ?? null;
  if (!topComponentId) return nextAssembly;

  const newComponent = createComponent(typeKey);
  nextAssembly.components.push(newComponent);
  nextAssembly.connections.push(createConnection(topComponentId, 'north', newComponent.componentId, 'south'));
  return nextAssembly;
}

export function appendSurfaceAssemblyRightBranchComponent(assembly, typeKey) {
  const definition = resolveSurfaceAssemblyComponentDefinition(typeKey);
  if (!definition || !definition.ports.includes('west')) {
    return cloneSnapshot(assembly);
  }

  const nextAssembly = cloneSnapshot(assembly);
  const orderedBranchComponentIds = getOrderedRightBranchComponentIds(nextAssembly);
  const connectionSourceComponentId = orderedBranchComponentIds[orderedBranchComponentIds.length - 1]
    ?? findBranchSourceComponentId(nextAssembly);

  if (!connectionSourceComponentId) {
    return nextAssembly;
  }

  const newComponent = createComponent(typeKey);
  nextAssembly.components.push(newComponent);
  nextAssembly.connections.push(
    createConnection(connectionSourceComponentId, 'east', newComponent.componentId, 'west')
  );
  return nextAssembly;
}

export default {
  SURFACE_ASSEMBLY_TEMPLATE_SIMPLE_TREE,
  resolveSurfaceAssemblyComponentDefinition,
  listSurfaceAssemblyPaletteTypes,
  createSurfaceAssemblyFromTemplate,
  getOrderedTrunkComponentIds,
  getOrderedRightBranchComponentIds,
  appendSurfaceAssemblyTrunkComponent,
  appendSurfaceAssemblyRightBranchComponent,
};
