import {
  getOrderedRightBranchComponentIds,
  getOrderedTrunkComponentIds,
  resolveSurfaceAssemblyComponentDefinition,
} from '@/utils/surfaceAssemblyModel.js';

const PREVIEW_WIDTH = 560;
const PREVIEW_HEIGHT = 340;
const CENTER_X = PREVIEW_WIDTH / 2;
const BOTTOM_Y = 284;
const TRUNK_VERTICAL_GAP = 62;
const RIGHT_BRANCH_HORIZONTAL_GAP = 94;

function buildComponentMap(components = []) {
  return new Map(
    (Array.isArray(components) ? components : []).map((component) => [component.componentId, component])
  );
}

export function buildSurfaceAssemblyLayout(assembly) {
  if (!assembly || !Array.isArray(assembly.components) || assembly.components.length === 0) {
    return {
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      centerX: CENTER_X,
      hasContent: false,
      components: [],
      trunkConnections: [],
      branchConnections: [],
    };
  }

  const componentById = buildComponentMap(assembly.components);
  const trunkComponentIds = getOrderedTrunkComponentIds(assembly);
  const rightBranchComponentIds = getOrderedRightBranchComponentIds(assembly);
  const positionedById = new Map();

  trunkComponentIds.forEach((componentId, index) => {
    positionedById.set(componentId, {
      x: CENTER_X,
      y: BOTTOM_Y - (index * TRUNK_VERTICAL_GAP),
    });
  });

  const branchSourceId = trunkComponentIds.find((componentId) => (
    assembly.connections.some((connection) => (
      connection.fromComponentId === componentId
      && connection.fromPortKey === 'east'
    ))
  )) ?? null;

  const branchSourcePosition = positionedById.get(branchSourceId) ?? null;
  rightBranchComponentIds.forEach((componentId, index) => {
    positionedById.set(componentId, {
      x: (branchSourcePosition?.x ?? CENTER_X) + ((index + 1) * RIGHT_BRANCH_HORIZONTAL_GAP),
      y: branchSourcePosition?.y ?? (BOTTOM_Y - (2 * TRUNK_VERTICAL_GAP)),
    });
  });

  const components = assembly.components
    .map((component) => {
      const definition = resolveSurfaceAssemblyComponentDefinition(component.typeKey);
      const position = positionedById.get(component.componentId) ?? null;
      if (!definition || !position) return null;

      return {
        componentId: component.componentId,
        typeKey: component.typeKey,
        label: String(component.label ?? definition.label).trim() || definition.label,
        preview: definition.preview,
        x: position.x,
        y: position.y,
      };
    })
    .filter(Boolean);

  const positionedComponentById = new Map(
    components.map((component) => [component.componentId, component])
  );

  const trunkConnections = trunkComponentIds
    .slice(0, -1)
    .map((componentId, index) => {
      const fromComponent = positionedComponentById.get(componentId);
      const toComponent = positionedComponentById.get(trunkComponentIds[index + 1]);
      if (!fromComponent || !toComponent) return null;
      return {
        key: `trunk-${fromComponent.componentId}-${toComponent.componentId}`,
        x1: fromComponent.x,
        y1: fromComponent.y - (fromComponent.preview.height / 2),
        x2: toComponent.x,
        y2: toComponent.y + (toComponent.preview.height / 2),
      };
    })
    .filter(Boolean);

  const branchConnections = [];
  if (branchSourceId && rightBranchComponentIds.length > 0) {
    const firstBranchComponent = positionedComponentById.get(rightBranchComponentIds[0]);
    const sourceComponent = positionedComponentById.get(branchSourceId);
    if (sourceComponent && firstBranchComponent) {
      branchConnections.push({
        key: `branch-${branchSourceId}-${firstBranchComponent.componentId}`,
        x1: sourceComponent.x + (sourceComponent.preview.width / 2),
        y1: sourceComponent.y,
        x2: firstBranchComponent.x - (firstBranchComponent.preview.width / 2),
        y2: firstBranchComponent.y,
      });
    }

    rightBranchComponentIds.slice(0, -1).forEach((componentId, index) => {
      const fromComponent = positionedComponentById.get(componentId);
      const toComponent = positionedComponentById.get(rightBranchComponentIds[index + 1]);
      if (!fromComponent || !toComponent) return;
      branchConnections.push({
        key: `branch-${fromComponent.componentId}-${toComponent.componentId}`,
        x1: fromComponent.x + (fromComponent.preview.width / 2),
        y1: fromComponent.y,
        x2: toComponent.x - (toComponent.preview.width / 2),
        y2: toComponent.y,
      });
    });
  }

  return {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    centerX: CENTER_X,
    hasContent: components.length > 0,
    components,
    trunkConnections,
    branchConnections,
  };
}

export default {
  buildSurfaceAssemblyLayout,
};
