function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

const EDGE_DIRECTION_BIDIRECTIONAL = 'bidirectional';
const EDGE_DIRECTION_FORWARD = 'forward';
const EDGE_DIRECTION_REVERSE = 'reverse';

export const ACTIVE_FLOW_TRAVERSAL_POLICY = Object.freeze({
    allowCosts: Object.freeze([0]),
    defaultEdgeDirection: EDGE_DIRECTION_BIDIRECTIONAL,
    edgeDirectionsByKind: Object.freeze({
        termination: EDGE_DIRECTION_FORWARD
    }),
    sinkNodeIds: Object.freeze(['node:SURFACE'])
});

export const MINIMUM_FAILURE_TRAVERSAL_POLICY = Object.freeze({
    allowCosts: Object.freeze([0, 1]),
    defaultEdgeDirection: EDGE_DIRECTION_BIDIRECTIONAL,
    edgeDirectionsByKind: Object.freeze({
        termination: EDGE_DIRECTION_FORWARD
    }),
    sinkNodeIds: Object.freeze([])
});

function normalizeTraversalDirection(value, fallbackDirection = EDGE_DIRECTION_BIDIRECTIONAL) {
    const token = String(value ?? '').trim().toLowerCase();
    if (token === EDGE_DIRECTION_FORWARD) return EDGE_DIRECTION_FORWARD;
    if (token === EDGE_DIRECTION_REVERSE) return EDGE_DIRECTION_REVERSE;
    if (token === EDGE_DIRECTION_BIDIRECTIONAL) return EDGE_DIRECTION_BIDIRECTIONAL;
    return fallbackDirection;
}

function normalizeDirectionMapByKind(directionMap = {}, fallbackDirection = EDGE_DIRECTION_BIDIRECTIONAL) {
    const normalizedMap = {};
    Object.entries(directionMap).forEach(([rawKind, rawDirection]) => {
        const kind = String(rawKind ?? '').trim().toLowerCase();
        if (!kind) return;
        normalizedMap[kind] = normalizeTraversalDirection(rawDirection, fallbackDirection);
    });
    return normalizedMap;
}

function resolveTraversalPolicy(options = {}, defaultPolicy = {}) {
    const overridePolicy = options?.traversalPolicy && typeof options.traversalPolicy === 'object'
        ? options.traversalPolicy
        : {};
    const defaultEdgeDirection = normalizeTraversalDirection(
        overridePolicy.defaultEdgeDirection ?? defaultPolicy.defaultEdgeDirection,
        EDGE_DIRECTION_BIDIRECTIONAL
    );
    const defaultDirectionMap = normalizeDirectionMapByKind(
        defaultPolicy.edgeDirectionsByKind,
        defaultEdgeDirection
    );
    const overrideDirectionMap = normalizeDirectionMapByKind(
        overridePolicy.edgeDirectionsByKind,
        defaultEdgeDirection
    );
    const allowCostsRaw = Array.isArray(overridePolicy.allowCosts)
        ? overridePolicy.allowCosts
        : toSafeArray(defaultPolicy.allowCosts);
    const allowCosts = new Set(allowCostsRaw
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value)));
    const sinkNodeIdsRaw = Array.isArray(overridePolicy.sinkNodeIds)
        ? overridePolicy.sinkNodeIds
        : toSafeArray(defaultPolicy.sinkNodeIds);

    return {
        allowCosts,
        defaultEdgeDirection,
        edgeDirectionsByKind: {
            ...defaultDirectionMap,
            ...overrideDirectionMap
        },
        sinkNodeIds: new Set(sinkNodeIdsRaw.filter(Boolean))
    };
}

function appendAdjacencyEdge(adjacency, fromNodeId, toNodeId, edge) {
    if (!fromNodeId || !toNodeId) return;
    if (!adjacency.has(fromNodeId)) {
        adjacency.set(fromNodeId, []);
    }
    adjacency.get(fromNodeId).push({
        nodeId: toNodeId,
        edgeId: edge.edgeId,
        cost: edge.cost
    });
}

function resolveEdgeDirection(edge, traversalPolicy) {
    const edgeKind = String(edge?.kind ?? '').trim().toLowerCase();
    return traversalPolicy.edgeDirectionsByKind[edgeKind]
        ?? traversalPolicy.defaultEdgeDirection;
}

function appendDirectionalEdges(adjacency, edge, edgeDirection) {
    if (edgeDirection === EDGE_DIRECTION_FORWARD || edgeDirection === EDGE_DIRECTION_BIDIRECTIONAL) {
        appendAdjacencyEdge(adjacency, edge.from, edge.to, edge);
    }
    if (edgeDirection === EDGE_DIRECTION_REVERSE || edgeDirection === EDGE_DIRECTION_BIDIRECTIONAL) {
        appendAdjacencyEdge(adjacency, edge.to, edge.from, edge);
    }
}

function buildAdjacency(edges = [], traversalPolicy) {
    const adjacency = new Map();
    edges.forEach((edge) => {
        const cost = Number(edge?.cost);
        if (!Number.isFinite(cost)) return;
        if (!traversalPolicy.allowCosts.has(cost)) return;
        const edgeDirection = resolveEdgeDirection(edge, traversalPolicy);
        appendDirectionalEdges(adjacency, edge, edgeDirection);
    });
    return adjacency;
}

export function computeActiveFlowNodeIds(sourceNodeIds = [], edges = [], options = {}) {
    const startNodes = toSafeArray(sourceNodeIds).filter(Boolean);
    if (startNodes.length === 0) return [];

    const traversalPolicy = resolveTraversalPolicy(options, ACTIVE_FLOW_TRAVERSAL_POLICY);
    const adjacency = buildAdjacency(edges, traversalPolicy);
    const visited = new Set(startNodes);
    const queue = [...startNodes];

    while (queue.length > 0) {
        const current = queue.shift();
        if (traversalPolicy.sinkNodeIds.has(current)) {
            continue;
        }
        const neighbors = adjacency.get(current) ?? [];
        neighbors.forEach((neighbor) => {
            if (visited.has(neighbor.nodeId)) return;
            visited.add(neighbor.nodeId);
            queue.push(neighbor.nodeId);
        });
    }

    return [...visited].sort();
}

export function computeMinimumFailurePath(sourceNodeIds = [], targetNodeId, edges = [], options = {}) {
    if (!targetNodeId) {
        return {
            minFailureCostToSurface: null,
            minCostPathEdgeIds: []
        };
    }

    const startNodes = toSafeArray(sourceNodeIds).filter(Boolean);
    if (startNodes.length === 0) {
        return {
            minFailureCostToSurface: null,
            minCostPathEdgeIds: []
        };
    }

    const traversalPolicy = resolveTraversalPolicy(options, MINIMUM_FAILURE_TRAVERSAL_POLICY);
    const adjacency = buildAdjacency(edges, traversalPolicy);
    const distanceByNode = new Map();
    const previousNodeByNode = new Map();
    const previousEdgeByNode = new Map();
    const deque = [];

    startNodes.forEach((nodeId) => {
        distanceByNode.set(nodeId, 0);
        deque.push(nodeId);
    });

    while (deque.length > 0) {
        const currentNodeId = deque.shift();
        const currentDistance = distanceByNode.get(currentNodeId);
        const neighbors = adjacency.get(currentNodeId) ?? [];

        neighbors.forEach((neighbor) => {
            const edgeCost = Number(neighbor.cost);
            if (edgeCost !== 0 && edgeCost !== 1) return;

            const nextDistance = currentDistance + edgeCost;
            const previousDistance = distanceByNode.get(neighbor.nodeId);
            if (Number.isFinite(previousDistance) && previousDistance <= nextDistance) return;

            distanceByNode.set(neighbor.nodeId, nextDistance);
            previousNodeByNode.set(neighbor.nodeId, currentNodeId);
            previousEdgeByNode.set(neighbor.nodeId, neighbor.edgeId);

            if (edgeCost === 0) {
                deque.unshift(neighbor.nodeId);
                return;
            }
            deque.push(neighbor.nodeId);
        });
    }

    const distance = distanceByNode.get(targetNodeId);
    if (!Number.isFinite(distance)) {
        return {
            minFailureCostToSurface: null,
            minCostPathEdgeIds: []
        };
    }

    const minCostPathEdgeIds = [];
    let cursor = targetNodeId;
    while (previousEdgeByNode.has(cursor)) {
        minCostPathEdgeIds.push(previousEdgeByNode.get(cursor));
        cursor = previousNodeByNode.get(cursor);
    }
    minCostPathEdgeIds.reverse();

    return {
        minFailureCostToSurface: distance,
        minCostPathEdgeIds
    };
}

export function computeSpofEdgeIds(minFailureCostToSurface, minCostPathEdgeIds = [], edgeById = new Map()) {
    if (minFailureCostToSurface !== 1) return [];

    return minCostPathEdgeIds.filter((edgeId) => {
        const edge = edgeById.get(edgeId);
        return Number(edge?.cost) === 1;
    });
}

export default {
    computeActiveFlowNodeIds,
    computeMinimumFailurePath,
    computeSpofEdgeIds
};
