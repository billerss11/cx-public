const TOPOLOGY_INSPECTOR_SCOPE_SET = new Set([
  'all',
  'min_path',
  'spof',
  'active_flow',
  'selected_barrier'
]);

export const TOPOLOGY_INSPECTOR_SCOPES = Object.freeze([...TOPOLOGY_INSPECTOR_SCOPE_SET]);

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toToken(value) {
  const token = String(value ?? '').trim();
  return token.length > 0 ? token : null;
}

function normalizeScope(scope) {
  const token = String(scope ?? '').trim().toLowerCase();
  return TOPOLOGY_INSPECTOR_SCOPE_SET.has(token) ? token : 'all';
}

function toEdgeIdSet(edgeIds = []) {
  const set = new Set();
  toSafeArray(edgeIds).forEach((edgeId) => {
    const safeEdgeId = toToken(edgeId);
    if (!safeEdgeId) return;
    set.add(safeEdgeId);
  });
  return set;
}

function resolveResultEdges(topologyResult = {}) {
  return toSafeArray(topologyResult?.edges);
}

function resolveResultNodes(topologyResult = {}) {
  return toSafeArray(topologyResult?.nodes);
}

function collectNodeIdsFromEdges(edgeIds = [], edgeById = new Map()) {
  const nodeIds = [];
  const seenNodeIds = new Set();

  edgeIds.forEach((edgeId) => {
    const edge = edgeById.get(edgeId);
    if (!edge) return;
    [edge.from, edge.to].forEach((nodeId) => {
      const safeNodeId = toToken(nodeId);
      if (!safeNodeId || seenNodeIds.has(safeNodeId)) return;
      seenNodeIds.add(safeNodeId);
      nodeIds.push(safeNodeId);
    });
  });

  return nodeIds;
}

function resolveScopeArrays(topologyResult = {}) {
  const edges = resolveResultEdges(topologyResult);
  return {
    edgeById: new Map(edges.map((edge) => [toToken(edge?.edgeId), edge]).filter(([edgeId]) => edgeId)),
    allEdgeIds: edges
      .map((edge) => toToken(edge?.edgeId))
      .filter(Boolean),
    minPathEdgeIds: toSafeArray(topologyResult?.minCostPathEdgeIds)
      .map((edgeId) => toToken(edgeId))
      .filter(Boolean),
    spofEdgeIds: toSafeArray(topologyResult?.spofEdgeIds)
      .map((edgeId) => toToken(edgeId))
      .filter(Boolean),
    activeFlowNodeIds: toSafeArray(topologyResult?.activeFlowNodeIds)
      .map((nodeId) => toToken(nodeId))
      .filter(Boolean)
  };
}

function resolveActiveFlowEdgeIds(edges = [], activeNodeIds = new Set()) {
  return edges
    .filter((edge) => {
      const fromNodeId = toToken(edge?.from);
      const toNodeId = toToken(edge?.to);
      return Boolean(fromNodeId && toNodeId && activeNodeIds.has(fromNodeId) && activeNodeIds.has(toNodeId));
    })
    .map((edge) => toToken(edge?.edgeId))
    .filter(Boolean);
}

function dedupeTokens(items = []) {
  const uniqueItems = [];
  const seenItems = new Set();
  items.forEach((item) => {
    const token = toToken(item);
    if (!token || seenItems.has(token)) return;
    seenItems.add(token);
    uniqueItems.push(token);
  });
  return uniqueItems;
}

function collectPathNodeIdSet(pathEdgeIds = [], edgeById = new Map()) {
  return new Set(collectNodeIdsFromEdges(pathEdgeIds, edgeById));
}

function collectSpofNodeIdSet(spofEdgeIds = [], edgeById = new Map()) {
  return new Set(collectNodeIdsFromEdges(spofEdgeIds, edgeById));
}

export function resolveTopologyInspectorScopeEdgeIds(
  topologyResult = {},
  scope = 'all',
  selectedBarrierEdgeIds = []
) {
  const safeScope = normalizeScope(scope);
  const edges = resolveResultEdges(topologyResult);
  const scopedArrays = resolveScopeArrays(topologyResult);
  const activeFlowNodeSet = new Set(scopedArrays.activeFlowNodeIds);

  if (safeScope === 'min_path') return dedupeTokens(scopedArrays.minPathEdgeIds);
  if (safeScope === 'spof') return dedupeTokens(scopedArrays.spofEdgeIds);
  if (safeScope === 'selected_barrier') return dedupeTokens(selectedBarrierEdgeIds);
  if (safeScope === 'active_flow') return dedupeTokens(resolveActiveFlowEdgeIds(edges, activeFlowNodeSet));
  return dedupeTokens(scopedArrays.allEdgeIds);
}

export function createTopologyInspectorEdgeRows(topologyResult = {}, options = {}) {
  const scope = options?.scope ?? 'all';
  const selectedBarrierEdgeIds = options?.selectedBarrierEdgeIds ?? [];
  const scopeEdgeIds = resolveTopologyInspectorScopeEdgeIds(topologyResult, scope, selectedBarrierEdgeIds);
  const scopedArrays = resolveScopeArrays(topologyResult);
  const nodes = resolveResultNodes(topologyResult);
  const nodeById = new Map(nodes.map((node) => [toToken(node?.nodeId), node]).filter(([nodeId]) => nodeId));
  const minPathEdgeSet = toEdgeIdSet(scopedArrays.minPathEdgeIds);
  const spofEdgeSet = toEdgeIdSet(scopedArrays.spofEdgeIds);
  const edgeReasons = topologyResult?.edgeReasons && typeof topologyResult.edgeReasons === 'object'
    ? topologyResult.edgeReasons
    : {};

  return scopeEdgeIds
    .map((edgeId) => {
      const edge = scopedArrays.edgeById.get(edgeId);
      if (!edge) return null;
      const fromNodeId = toToken(edge?.from);
      const toNodeId = toToken(edge?.to);
      const fromNode = fromNodeId ? nodeById.get(fromNodeId) : null;
      const toNode = toNodeId ? nodeById.get(toNodeId) : null;
      const reason = edgeReasons[edgeId] ?? edge?.reason ?? null;
      return {
        key: edgeId,
        edgeId,
        kind: toToken(edge?.kind) ?? 'unknown',
        cost: Number.isFinite(Number(edge?.cost)) ? Number(edge.cost) : null,
        state: toToken(edge?.state),
        fromNodeId,
        toNodeId,
        fromKind: toToken(fromNode?.kind),
        toKind: toToken(toNode?.kind),
        ruleId: toToken(reason?.ruleId),
        reasonSummary: toToken(reason?.summary),
        isOnMinPath: minPathEdgeSet.has(edgeId),
        isSpof: spofEdgeSet.has(edgeId)
      };
    })
    .filter(Boolean);
}

export function createTopologyInspectorNodeRows(topologyResult = {}, options = {}) {
  const scope = options?.scope ?? 'all';
  const selectedBarrierEdgeIds = options?.selectedBarrierEdgeIds ?? [];
  const safeScope = normalizeScope(scope);
  const scopedArrays = resolveScopeArrays(topologyResult);
  const nodeById = new Map(
    resolveResultNodes(topologyResult)
      .map((node) => [toToken(node?.nodeId), node])
      .filter(([nodeId]) => nodeId)
  );
  const minPathNodeSet = collectPathNodeIdSet(scopedArrays.minPathEdgeIds, scopedArrays.edgeById);
  const spofNodeSet = collectSpofNodeIdSet(scopedArrays.spofEdgeIds, scopedArrays.edgeById);
  const activeFlowNodeSet = new Set(scopedArrays.activeFlowNodeIds);

  let scopedNodeIds = [];
  if (safeScope === 'all') {
    scopedNodeIds = [...nodeById.keys()];
  } else if (safeScope === 'active_flow') {
    scopedNodeIds = dedupeTokens(scopedArrays.activeFlowNodeIds);
  } else {
    const scopedEdgeIds = resolveTopologyInspectorScopeEdgeIds(
      topologyResult,
      safeScope,
      selectedBarrierEdgeIds
    );
    scopedNodeIds = collectNodeIdsFromEdges(scopedEdgeIds, scopedArrays.edgeById);
  }

  return scopedNodeIds
    .map((nodeId) => {
      const node = nodeById.get(nodeId);
      if (!node) return null;
      const depthTop = Number(node?.depthTop);
      const depthBottom = Number(node?.depthBottom);
      const hasDepthRange = Number.isFinite(depthTop) && Number.isFinite(depthBottom);
      return {
        key: nodeId,
        nodeId,
        kind: toToken(node?.kind) ?? 'unknown',
        depthTop: hasDepthRange ? depthTop : null,
        depthBottom: hasDepthRange ? depthBottom : null,
        span: hasDepthRange ? Math.max(0, depthBottom - depthTop) : null,
        isActiveFlow: activeFlowNodeSet.has(nodeId),
        isOnMinPath: minPathNodeSet.has(nodeId),
        isSpof: spofNodeSet.has(nodeId)
      };
    })
    .filter(Boolean);
}

export function resolveTopologyInspectorOverlayNodeIds({
  topologyResult = {},
  selectedBarrierNodeIds = [],
  selectedInspectorNodeId = null,
  selectedInspectorEdgeId = null
} = {}) {
  const selectedNodeSet = new Set(dedupeTokens(selectedBarrierNodeIds));
  const safeSelectedInspectorNodeId = toToken(selectedInspectorNodeId);
  if (safeSelectedInspectorNodeId) {
    selectedNodeSet.add(safeSelectedInspectorNodeId);
  }

  const safeSelectedInspectorEdgeId = toToken(selectedInspectorEdgeId);
  if (!safeSelectedInspectorEdgeId) return [...selectedNodeSet];

  const edgeById = resolveScopeArrays(topologyResult).edgeById;
  const selectedEdge = edgeById.get(safeSelectedInspectorEdgeId);
  if (!selectedEdge) return [...selectedNodeSet];

  const fromNodeId = toToken(selectedEdge?.from);
  const toNodeId = toToken(selectedEdge?.to);
  if (fromNodeId) selectedNodeSet.add(fromNodeId);
  if (toNodeId) selectedNodeSet.add(toNodeId);
  return [...selectedNodeSet];
}

export function createTopologyPathEdgeSummaryRows(topologyResult = {}, options = {}) {
  const explicitEdgeIds = options?.edgeIds;
  const edgeIds = dedupeTokens(
    Array.isArray(explicitEdgeIds)
      ? explicitEdgeIds
      : toSafeArray(topologyResult?.minCostPathEdgeIds)
  );
  if (edgeIds.length === 0) return [];

  const scopedArrays = resolveScopeArrays(topologyResult);
  const nodeById = new Map(
    resolveResultNodes(topologyResult)
      .map((node) => [toToken(node?.nodeId), node])
      .filter(([nodeId]) => nodeId)
  );
  const edgeReasons = topologyResult?.edgeReasons && typeof topologyResult.edgeReasons === 'object'
    ? topologyResult.edgeReasons
    : {};

  return edgeIds
    .map((edgeId, index) => {
      const edge = scopedArrays.edgeById.get(edgeId);
      if (!edge) return null;
      const fromNodeId = toToken(edge?.from);
      const toNodeId = toToken(edge?.to);
      const fromNode = fromNodeId ? nodeById.get(fromNodeId) : null;
      const toNode = toNodeId ? nodeById.get(toNodeId) : null;
      const reason = edgeReasons[edgeId] ?? edge?.reason ?? null;
      return {
        key: `path-step-${index}-${edgeId}`,
        step: index + 1,
        edgeId,
        kind: toToken(edge?.kind) ?? 'unknown',
        cost: Number.isFinite(Number(edge?.cost)) ? Number(edge.cost) : null,
        fromNodeId,
        toNodeId,
        fromKind: toToken(fromNode?.kind),
        toKind: toToken(toNode?.kind),
        ruleId: toToken(reason?.ruleId),
        reasonSummary: toToken(reason?.summary)
      };
    })
    .filter(Boolean);
}
