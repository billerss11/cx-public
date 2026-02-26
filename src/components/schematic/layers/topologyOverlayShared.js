import {
  resolveAnnulusLayerByIndex,
  resolveBoreLayer,
  resolveFormationAnnulusLayer
} from '@/utils/physicsLayers.js';

export const TOPOLOGY_OVERLAY_EPSILON = 1e-4;
export const TRACKED_VOLUME_NODE_KINDS = Object.freeze([
  'TUBING_INNER',
  'BORE',
  'ANNULUS_A',
  'ANNULUS_B',
  'ANNULUS_C',
  'ANNULUS_D',
  'FORMATION_ANNULUS'
]);

const TOPOLOGY_OVERLAY_STYLE_BY_PRIORITY = Object.freeze({
  selected: Object.freeze({
    fill: 'var(--color-topology-overlay-selected-fill)',
    stroke: 'var(--color-topology-overlay-selected-stroke)'
  }),
  spof: Object.freeze({
    fill: 'var(--color-topology-overlay-spof-fill)',
    stroke: 'var(--color-topology-overlay-spof-stroke)'
  }),
  path: Object.freeze({
    fill: 'var(--color-topology-overlay-path-fill)',
    stroke: 'var(--color-topology-overlay-path-stroke)'
  }),
  active: Object.freeze({
    fill: 'var(--color-topology-overlay-active-fill)',
    stroke: 'var(--color-topology-overlay-active-stroke)'
  })
});

export function isFiniteRange(top, bottom) {
  const topValue = Number(top);
  const bottomValue = Number(bottom);
  return Number.isFinite(topValue) && Number.isFinite(bottomValue) && bottomValue > topValue;
}

export function nearlyEqual(left, right, epsilon = TOPOLOGY_OVERLAY_EPSILON) {
  return Math.abs(Number(left) - Number(right)) <= epsilon;
}

export function rangesOverlap(
  topA,
  bottomA,
  topB,
  bottomB,
  epsilon = TOPOLOGY_OVERLAY_EPSILON
) {
  if (!isFiniteRange(topA, bottomA) || !isFiniteRange(topB, bottomB)) return false;
  const overlapTop = Math.max(Number(topA), Number(topB));
  const overlapBottom = Math.min(Number(bottomA), Number(bottomB));
  return overlapBottom > overlapTop + epsilon;
}

export function buildHighlightNodeSets(topologyResult, selectedNodeIds = []) {
  const selectedNodes = new Set(Array.isArray(selectedNodeIds) ? selectedNodeIds : []);
  const activeNodeIds = new Set(Array.isArray(topologyResult?.activeFlowNodeIds) ? topologyResult.activeFlowNodeIds : []);
  const pathNodeIds = new Set();
  const spofNodeIds = new Set();
  const edges = Array.isArray(topologyResult?.edges) ? topologyResult.edges : [];
  const edgeById = new Map(edges.map((edge) => [edge?.edgeId, edge]));
  const pathEdges = Array.isArray(topologyResult?.minCostPathEdgeIds) ? topologyResult.minCostPathEdgeIds : [];
  const spofEdges = Array.isArray(topologyResult?.spofEdgeIds) ? topologyResult.spofEdgeIds : [];

  pathEdges.forEach((edgeId) => {
    const edge = edgeById.get(edgeId);
    if (!edge) return;
    pathNodeIds.add(edge.from);
    pathNodeIds.add(edge.to);
  });

  spofEdges.forEach((edgeId) => {
    const edge = edgeById.get(edgeId);
    if (!edge) return;
    spofNodeIds.add(edge.from);
    spofNodeIds.add(edge.to);
  });

  const highlightedNodeIds = new Set([...selectedNodes, ...activeNodeIds, ...pathNodeIds, ...spofNodeIds]);
  return { highlightedNodeIds, selectedNodeIds: selectedNodes, activeNodeIds, pathNodeIds, spofNodeIds };
}

export function resolveTopologyOverlayStyle({
  isSelected = false,
  isSpof = false,
  isPath = false,
  isActive = false
} = {}) {
  if (isSelected) return TOPOLOGY_OVERLAY_STYLE_BY_PRIORITY.selected;
  if (isSpof) return TOPOLOGY_OVERLAY_STYLE_BY_PRIORITY.spof;
  if (isPath) return TOPOLOGY_OVERLAY_STYLE_BY_PRIORITY.path;
  if (isActive) return TOPOLOGY_OVERLAY_STYLE_BY_PRIORITY.active;
  return null;
}

export function resolveNodeLayer(node, stack = []) {
  if (node?.kind === 'TUBING_INNER' || node?.kind === 'BORE') {
    return resolveBoreLayer(stack);
  }

  if (node?.kind === 'ANNULUS_A') {
    return resolveAnnulusLayerByIndex(stack, 0);
  }

  if (node?.kind === 'ANNULUS_B') {
    return resolveAnnulusLayerByIndex(stack, 1);
  }

  if (node?.kind === 'ANNULUS_C') {
    return resolveAnnulusLayerByIndex(stack, 2);
  }

  if (node?.kind === 'ANNULUS_D') {
    return resolveAnnulusLayerByIndex(stack, 3);
  }

  if (node?.kind === 'FORMATION_ANNULUS') {
    return resolveFormationAnnulusLayer(stack);
  }

  return null;
}

export function mergeContiguousDepthSpans(entries = [], resolveMergeKey, epsilon = TOPOLOGY_OVERLAY_EPSILON) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  if (typeof resolveMergeKey !== 'function') return [...entries];

  const mergedEntries = [];
  const mergeIndexByKey = new Map();
  const sortedEntries = [...entries]
    .map((entry) => ({
      ...entry,
      top: Number(entry?.top),
      bottom: Number(entry?.bottom)
    }))
    .filter((entry) => isFiniteRange(entry.top, entry.bottom))
    .sort((left, right) => (
      Number(left.top) - Number(right.top) || Number(left.bottom) - Number(right.bottom)
    ));

  sortedEntries.forEach((entry) => {
    const mergeKey = resolveMergeKey(entry);
    const existingIndex = mergeIndexByKey.get(mergeKey);
    const existingEntry = Number.isInteger(existingIndex) ? mergedEntries[existingIndex] : null;
    if (existingEntry && nearlyEqual(existingEntry.bottom, entry.top, epsilon)) {
      existingEntry.bottom = entry.bottom;
      return;
    }

    const nextIndex = mergedEntries.length;
    mergedEntries.push({ ...entry });
    mergeIndexByKey.set(mergeKey, nextIndex);
  });

  return mergedEntries;
}

