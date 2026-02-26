function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeRowId(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function normalizeFunctionKey(value, fallback = 'boundary_seal') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    return normalized || fallback;
}

function deriveFunctionKey(contributor = {}, edge = {}) {
    const explicit = normalizeFunctionKey(contributor?.functionKey, '');
    if (explicit) return explicit;

    const volumeKey = String(edge?.meta?.volumeKey ?? '').trim().toUpperCase();
    if (!volumeKey) return 'boundary_seal';
    if (volumeKey === 'BORE' || volumeKey === 'TUBING_INNER') return 'bore_seal';
    return normalizeFunctionKey(`${volumeKey}_seal`, 'boundary_seal');
}

function createBarrierElementId(rowId, functionKey) {
    return `barrier:${rowId}:${functionKey}`;
}

function contributorBlocksPath(contributor = {}) {
    if (Number(contributor?.cost) >= 1) return true;

    const state = String(contributor?.state ?? '').trim().toLowerCase();
    return state.includes('closed');
}

function getEdgeContributors(edge = {}, edgeReasons = {}) {
    const edgeReason = edgeReasons?.[edge.edgeId] ?? null;
    const contributors = toSafeArray(edgeReason?.details?.equipmentContributors);

    return contributors
        .filter(contributorBlocksPath)
        .map((contributor) => {
            const rowId = normalizeRowId(contributor?.rowId);
            if (!rowId) return null;

            const functionKey = deriveFunctionKey(contributor, edge);
            return {
                rowId,
                functionKey,
                equipmentType: String(contributor?.equipmentType ?? '').trim() || null
            };
        })
        .filter(Boolean);
}

function buildBarrierElementMaps(edges = [], edgeReasons = {}) {
    const edgeElementIdsByEdgeId = new Map();
    const barrierElementById = new Map();

    toSafeArray(edges).forEach((edge) => {
        if (Number(edge?.cost) < 1) return;
        const contributors = getEdgeContributors(edge, edgeReasons);
        if (contributors.length === 0) return;

        const edgeElementIds = new Set();
        contributors.forEach((contributor) => {
            const elementId = createBarrierElementId(contributor.rowId, contributor.functionKey);
            edgeElementIds.add(elementId);

            if (!barrierElementById.has(elementId)) {
                barrierElementById.set(elementId, {
                    elementId,
                    rowId: contributor.rowId,
                    functionKey: contributor.functionKey,
                    equipmentTypes: new Set(),
                    edgeIds: new Set()
                });
            }

            const element = barrierElementById.get(elementId);
            if (contributor.equipmentType) {
                element.equipmentTypes.add(contributor.equipmentType);
            }
            element.edgeIds.add(edge.edgeId);
        });

        edgeElementIdsByEdgeId.set(edge.edgeId, edgeElementIds);
    });

    return { edgeElementIdsByEdgeId, barrierElementById };
}

function buildAdjacency(edges = [], excludedEdgeIds = new Set()) {
    const adjacency = new Map();

    const append = (from, to, edge) => {
        if (!adjacency.has(from)) adjacency.set(from, []);
        adjacency.get(from).push({
            nodeId: to,
            edgeId: edge.edgeId,
            cost: Number(edge.cost)
        });
    };

    toSafeArray(edges).forEach((edge) => {
        const edgeId = String(edge?.edgeId ?? '').trim();
        if (!edgeId || excludedEdgeIds.has(edgeId)) return;
        const cost = Number(edge?.cost);
        if (cost !== 0 && cost !== 1) return;

        append(edge.from, edge.to, edge);
        append(edge.to, edge.from, edge);
    });

    return adjacency;
}

function computeMinimumFailurePath(sourceNodeIds = [], targetNodeId = null, edges = [], excludedEdgeIds = new Set()) {
    const sources = [...new Set(toSafeArray(sourceNodeIds).filter(Boolean))];
    if (!targetNodeId || sources.length === 0) {
        return {
            minFailureCostToSurface: null,
            pathEdgeIds: []
        };
    }

    const adjacency = buildAdjacency(edges, excludedEdgeIds);
    const distanceByNode = new Map();
    const previousNodeByNode = new Map();
    const previousEdgeByNode = new Map();
    const deque = [];

    sources.forEach((nodeId) => {
        distanceByNode.set(nodeId, 0);
        deque.push(nodeId);
    });

    while (deque.length > 0) {
        const currentNodeId = deque.shift();
        const currentDistance = distanceByNode.get(currentNodeId);
        const neighbors = adjacency.get(currentNodeId) ?? [];

        neighbors.forEach((neighbor) => {
            const edgeCost = Number(neighbor?.cost);
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
            pathEdgeIds: []
        };
    }

    const pathEdgeIds = [];
    let cursor = targetNodeId;
    while (previousEdgeByNode.has(cursor)) {
        pathEdgeIds.push(previousEdgeByNode.get(cursor));
        cursor = previousNodeByNode.get(cursor);
    }
    pathEdgeIds.reverse();

    return {
        minFailureCostToSurface: distance,
        pathEdgeIds
    };
}

function collectElementIdsForPath(pathEdgeIds = [], edgeElementIdsByEdgeId = new Map()) {
    const elementIds = new Set();
    toSafeArray(pathEdgeIds).forEach((edgeId) => {
        const edgeElementIds = edgeElementIdsByEdgeId.get(edgeId);
        if (!edgeElementIds) return;
        edgeElementIds.forEach((elementId) => {
            elementIds.add(elementId);
        });
    });
    return elementIds;
}

function toSortedArray(valueSet) {
    return [...valueSet].sort((left, right) => String(left).localeCompare(String(right)));
}

function buildBarrierElementList(
    barrierElementById = new Map(),
    primaryElementIds = new Set(),
    secondaryElementIds = new Set()
) {
    return [...barrierElementById.values()]
        .map((element) => ({
            elementId: element.elementId,
            rowId: element.rowId,
            functionKey: element.functionKey,
            equipmentTypes: toSortedArray(element.equipmentTypes),
            edgeIds: toSortedArray(element.edgeIds),
            appearsOnPrimaryPath: primaryElementIds.has(element.elementId),
            appearsOnSecondaryPath: secondaryElementIds.has(element.elementId)
        }))
        .sort((left, right) => left.elementId.localeCompare(right.elementId));
}

function resolveIndependenceHeuristic(primaryElementIds = new Set(), secondaryElementIds = new Set(), overlapElementIds = new Set()) {
    if (primaryElementIds.size === 0) return 'no_barrier_elements';
    if (secondaryElementIds.size === 0) return 'single_path_only';
    if (overlapElementIds.size === 0) return 'distinct_envelopes';

    const minEnvelopeSize = Math.min(primaryElementIds.size, secondaryElementIds.size);
    if (overlapElementIds.size >= minEnvelopeSize) return 'fully_shared_envelopes';
    return 'partial_overlap_envelopes';
}

function toRatio(numerator, denominator) {
    if (denominator <= 0) return null;
    const ratio = Number(numerator) / Number(denominator);
    if (!Number.isFinite(ratio)) return null;
    return Number(ratio.toFixed(3));
}

export function evaluateBarrierEnvelopes({
    edges = [],
    edgeReasons = {},
    sourceNodeIds = [],
    targetNodeId = 'node:SURFACE',
    primaryPathEdgeIds = [],
    primaryMinFailureCost = null
} = {}) {
    const { edgeElementIdsByEdgeId, barrierElementById } = buildBarrierElementMaps(edges, edgeReasons);

    const primaryEdges = toSafeArray(primaryPathEdgeIds);
    const primaryElementIds = collectElementIdsForPath(primaryEdges, edgeElementIdsByEdgeId);

    const secondaryPath = computeMinimumFailurePath(
        sourceNodeIds,
        targetNodeId,
        edges,
        new Set(primaryEdges)
    );
    const secondaryElementIds = collectElementIdsForPath(
        secondaryPath.pathEdgeIds,
        edgeElementIdsByEdgeId
    );

    const overlapElementIds = new Set(
        [...primaryElementIds].filter((elementId) => secondaryElementIds.has(elementId))
    );

    const barrierElements = buildBarrierElementList(
        barrierElementById,
        primaryElementIds,
        secondaryElementIds
    );
    const independenceHeuristic = resolveIndependenceHeuristic(
        primaryElementIds,
        secondaryElementIds,
        overlapElementIds
    );

    return {
        mode: 'heuristic_alternative_path_excluding_primary_edges',
        primary: {
            minFailureCostToSurface: Number.isFinite(Number(primaryMinFailureCost))
                ? Number(primaryMinFailureCost)
                : null,
            pathEdgeIds: primaryEdges,
            elementIds: toSortedArray(primaryElementIds),
            elementCount: primaryElementIds.size
        },
        secondary: {
            minFailureCostToSurface: Number.isFinite(Number(secondaryPath.minFailureCostToSurface))
                ? Number(secondaryPath.minFailureCostToSurface)
                : null,
            pathEdgeIds: toSafeArray(secondaryPath.pathEdgeIds),
            elementIds: toSortedArray(secondaryElementIds),
            elementCount: secondaryElementIds.size
        },
        overlap: {
            elementIds: toSortedArray(overlapElementIds),
            elementCount: overlapElementIds.size,
            hasOverlap: overlapElementIds.size > 0
        },
        summary: {
            barrierElementCount: barrierElements.length,
            barrierEdgeCount: edgeElementIdsByEdgeId.size,
            independenceHeuristic,
            overlapRatioPrimary: toRatio(overlapElementIds.size, primaryElementIds.size),
            overlapRatioSecondary: toRatio(overlapElementIds.size, secondaryElementIds.size)
        },
        barrierElements
    };
}

export default {
    evaluateBarrierEnvelopes
};
