import { createTopologyValidationWarning } from '@/topology/warningCatalog.js';
import { buildTerminationEdges, createEdgeId } from '@/topology/edgeBuilder.js';
import {
    computeActiveFlowNodeIds,
    computeMinimumFailurePath,
    ACTIVE_FLOW_TRAVERSAL_POLICY,
    MINIMUM_FAILURE_TRAVERSAL_POLICY
} from '@/topology/pathAlgorithms.js';
import {
    EDGE_KIND_TERMINATION,
    TOPOLOGY_VOLUME_KINDS
} from '@/topology/topologyTypes.js';

const SURFACE_EDGE_KIND = 'surface';
const SURFACE_ROUTE_STATUS_AUTHORED = 'authored';
const SURFACE_ROUTE_STATUS_ASSUMED = 'assumed';
const SURFACE_ROUTE_STATUS_NOT_PRESENT = 'not_present';
const SURFACE_STATE_OUTLET = 'outlet';
const SURFACE_STATE_BLOCKED = 'blocked';
const SURFACE_STATE_ASSUMED = 'assumed_surface';
const SURFACE_STATE_MISSING_OUTLET = 'missing_outlet';
const SURFACE_WARNING_CATEGORY = 'surface';

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

function toToken(value) {
    const token = String(value ?? '').trim();
    return token || null;
}

function normalizeDirection(value, fallback = 'bidirectional') {
    const token = String(value ?? '').trim().toLowerCase();
    if (token === 'forward' || token === 'reverse' || token === 'bidirectional') return token;
    return fallback;
}

function createSurfacePathNodeId(pathId, itemId) {
    return `node:SURFACE_PATH_ITEM:${pathId}:${itemId}`;
}

function createSurfaceOutletNodeId(outletId) {
    return `node:SURFACE_OUTLET:${outletId}`;
}

function appendEdge(edges, edgeReasons, edge) {
    edges.push(edge);
    if (edge?.edgeId && edge?.reason) {
        edgeReasons[edge.edgeId] = edge.reason;
    }
}

function createSurfaceSummaryEntry(channelKey, routeStatus = SURFACE_ROUTE_STATUS_NOT_PRESENT) {
    return {
        channelKey,
        routeStatus,
        currentState: routeStatus === SURFACE_ROUTE_STATUS_ASSUMED ? SURFACE_STATE_ASSUMED : null,
        outletLabels: [],
        barrierLabels: [],
        blockingBarrierLabels: [],
        transferLabels: [],
        warningMessages: []
    };
}

function resolveBarrierState(state = {}) {
    const actuationState = String(state?.actuationState ?? '').trim().toLowerCase();
    const integrityStatus = String(state?.integrityStatus ?? '').trim().toLowerCase();
    const leakedOpen = integrityStatus === 'leaking' || integrityStatus === 'failed_open';
    const blocked = integrityStatus === 'failed_closed' || actuationState === 'closed';

    if (leakedOpen) {
        return {
            cost: 0,
            state: 'open'
        };
    }

    if (blocked) {
        return {
            cost: 1,
            state: 'closed_failable'
        };
    }

    return {
        cost: 0,
        state: 'open'
    };
}

function buildTopIntervalNodeByKind(intervals = [], intervalNodeByKind = new Map()) {
    const topInterval = Array.isArray(intervals) && intervals.length > 0 ? intervals[0] : null;
    if (!topInterval) return new Map();

    return new Map(TOPOLOGY_VOLUME_KINDS
        .map((kind) => [kind, intervalNodeByKind.get(`${topInterval.intervalIndex}|${kind}`) ?? null])
        .filter(([, node]) => Boolean(node)));
}

function buildRouteSummaryMap(topNodeByKind = new Map()) {
    const byChannel = {};
    topNodeByKind.forEach((_node, kind) => {
        byChannel[kind] = createSurfaceSummaryEntry(kind);
    });
    return byChannel;
}

function createSurfaceWarning(message, options = {}) {
    return createTopologyValidationWarning(null, message, {
        category: SURFACE_WARNING_CATEGORY,
        rowId: options?.rowId,
        recommendation: options?.recommendation
    });
}

function collectVisiblePaths(rows = []) {
    return toSafeArray(rows)
        .filter((row) => row?.show !== false)
        .filter((row) => toToken(row?.rowId) && toToken(row?.channelKey));
}

function collectVisibleTransfers(rows = []) {
    return toSafeArray(rows)
        .filter((row) => row?.show !== false)
        .filter((row) => toToken(row?.rowId) && toToken(row?.fromChannelKey) && toToken(row?.toChannelKey));
}

function collectVisibleOutlets(rows = []) {
    return toSafeArray(rows)
        .filter((row) => row?.show !== false)
        .filter((row) => toToken(row?.rowId) && toToken(row?.channelKey));
}

export function buildSurfaceCommunicationTopology(stateSnapshot = {}, intervals = [], intervalNodeByKind = new Map()) {
    const topNodeByKind = buildTopIntervalNodeByKind(intervals, intervalNodeByKind);
    const summaryByChannel = buildRouteSummaryMap(topNodeByKind);
    const visiblePaths = collectVisiblePaths(stateSnapshot?.surfacePaths);
    const visibleTransfers = collectVisibleTransfers(stateSnapshot?.surfaceTransfers);
    const visibleOutlets = collectVisibleOutlets(stateSnapshot?.surfaceOutlets);
    const hasAuthoredSurface = visiblePaths.length > 0 || visibleTransfers.length > 0 || visibleOutlets.length > 0;

    if (!hasAuthoredSurface) {
        const fallback = buildTerminationEdges(intervals, intervalNodeByKind);
        Object.keys(summaryByChannel).forEach((channelKey) => {
            summaryByChannel[channelKey] = {
                ...summaryByChannel[channelKey],
                routeStatus: SURFACE_ROUTE_STATUS_ASSUMED,
                currentState: SURFACE_STATE_ASSUMED,
                warningMessages: ['Surface path is assumed because no authored surface route exists for this channel.']
            };
        });
        return {
            nodes: fallback.nodes,
            edges: fallback.edges,
            edgeReasons: fallback.edgeReasons,
            validationWarnings: [],
            surfaceSummary: {
                hasAuthoredSurface: false,
                byChannel: summaryByChannel
            }
        };
    }

    const nodes = [];
    const edges = [];
    const edgeReasons = {};
    const validationWarnings = [];
    const pathByChannel = new Map();
    const anchorNodeIdByChannel = new Map();
    const outletLabelByNodeId = new Map();
    const routeHasOutletByChannel = new Map();
    const routeHasReachableStructureByChannel = new Map();

    visiblePaths.forEach((path) => {
        const channelKey = toToken(path.channelKey);
        if (!channelKey || pathByChannel.has(channelKey)) return;
        pathByChannel.set(channelKey, path);
        if (!summaryByChannel[channelKey]) {
            summaryByChannel[channelKey] = createSurfaceSummaryEntry(channelKey, SURFACE_ROUTE_STATUS_AUTHORED);
        } else {
            summaryByChannel[channelKey].routeStatus = SURFACE_ROUTE_STATUS_AUTHORED;
        }
    });

    pathByChannel.forEach((path, channelKey) => {
        const rootNode = topNodeByKind.get(channelKey) ?? null;
        const summaryEntry = summaryByChannel[channelKey] ?? createSurfaceSummaryEntry(channelKey, SURFACE_ROUTE_STATUS_AUTHORED);
        summaryEntry.routeStatus = SURFACE_ROUTE_STATUS_AUTHORED;
        summaryByChannel[channelKey] = summaryEntry;

        if (!rootNode) {
            summaryEntry.warningMessages.push('This surface path does not match a modeled channel at the top of the well.');
            validationWarnings.push(createSurfaceWarning(
                'This surface path does not match a modeled channel at the top of the well.',
                { rowId: toToken(path?.rowId) ?? channelKey }
            ));
            return;
        }

        let previousNodeId = rootNode.nodeId;
        anchorNodeIdByChannel.set(channelKey, previousNodeId);
        routeHasReachableStructureByChannel.set(channelKey, false);

        toSafeArray(path?.items)
            .filter((item) => item?.show !== false)
            .forEach((item) => {
                const itemId = toToken(item?.rowId);
                if (!itemId) return;
                const itemNodeId = createSurfacePathNodeId(path.rowId, itemId);
                nodes.push({
                    nodeId: itemNodeId,
                    kind: 'SURFACE_PATH_ITEM',
                    depthTop: null,
                    depthBottom: null,
                    volumeKey: channelKey,
                    meta: {
                        pathId: path.rowId,
                        itemId,
                        itemType: toToken(item?.itemType) ?? 'continuation',
                        label: toToken(item?.label) ?? itemId
                    }
                });

                const barrierState = resolveBarrierState(item?.state);
                const edgeId = createEdgeId(SURFACE_EDGE_KIND, previousNodeId, itemNodeId, itemId);
                appendEdge(edges, edgeReasons, {
                    edgeId,
                    from: previousNodeId,
                    to: itemNodeId,
                    kind: SURFACE_EDGE_KIND,
                    direction: 'forward',
                    cost: barrierState.cost,
                    state: barrierState.state,
                    meta: {
                        channelKey,
                        pathId: path.rowId,
                        itemId
                    },
                    reason: {
                        ruleId: item?.itemType === 'barrier'
                            ? 'surface-path-barrier'
                            : 'surface-path-continuation',
                        summary: `${toToken(item?.label) ?? 'Surface item'} carries ${channelKey} toward surface outlet.`,
                        details: {
                            channelKey,
                            pathId: path.rowId,
                            itemId
                        }
                    }
                });
                previousNodeId = itemNodeId;
                anchorNodeIdByChannel.set(channelKey, previousNodeId);
                routeHasReachableStructureByChannel.set(channelKey, true);

                if (item?.itemType === 'barrier') {
                    summaryEntry.barrierLabels.push(toToken(item?.label) ?? itemId);
                    if (barrierState.cost === 1) {
                        summaryEntry.blockingBarrierLabels.push(toToken(item?.label) ?? itemId);
                    }
                }
            });
    });

    visibleOutlets.forEach((outlet) => {
        const channelKey = toToken(outlet?.channelKey);
        const path = pathByChannel.get(channelKey) ?? null;
        const summaryEntry = summaryByChannel[channelKey] ?? null;
        if (!path || !summaryEntry) return;

        const anchorNodeId = toToken(outlet?.anchorItemId)
            ? createSurfacePathNodeId(path.rowId, outlet.anchorItemId)
            : (anchorNodeIdByChannel.get(channelKey) ?? null);
        if (!anchorNodeId) return;

        const outletNodeId = createSurfaceOutletNodeId(outlet.rowId);
        nodes.push({
            nodeId: outletNodeId,
            kind: 'SURFACE_OUTLET',
            depthTop: null,
            depthBottom: null,
            volumeKey: channelKey,
            meta: {
                outletId: outlet.rowId,
                outletKey: toToken(outlet?.outletKey),
                label: toToken(outlet?.label) ?? outlet.rowId,
                channelKey
            }
        });
        outletLabelByNodeId.set(outletNodeId, toToken(outlet?.label) ?? outlet.rowId);
        routeHasOutletByChannel.set(channelKey, true);

        const routeEdgeId = createEdgeId(SURFACE_EDGE_KIND, anchorNodeId, outletNodeId, outlet.rowId);
        appendEdge(edges, edgeReasons, {
            edgeId: routeEdgeId,
            from: anchorNodeId,
            to: outletNodeId,
            kind: SURFACE_EDGE_KIND,
            direction: 'forward',
            cost: 0,
            state: 'open',
            meta: {
                channelKey,
                outletId: outlet.rowId
            },
            reason: {
                ruleId: 'surface-path-outlet',
                summary: `${channelKey} reaches ${toToken(outlet?.label) ?? outlet.rowId}.`,
                details: {
                    channelKey,
                    outletId: outlet.rowId
                }
            }
        });

        const sinkEdgeId = createEdgeId(EDGE_KIND_TERMINATION, outletNodeId, 'node:SURFACE', outlet.rowId);
        appendEdge(edges, edgeReasons, {
            edgeId: sinkEdgeId,
            from: outletNodeId,
            to: 'node:SURFACE',
            kind: EDGE_KIND_TERMINATION,
            direction: 'forward',
            cost: 0,
            state: 'open',
            meta: {
                channelKey,
                outletId: outlet.rowId,
                outletLabel: toToken(outlet?.label) ?? outlet.rowId
            },
            reason: {
                ruleId: 'surface-outlet-termination',
                summary: `${toToken(outlet?.label) ?? outlet.rowId} connects to surface sink.`,
                details: {
                    channelKey,
                    outletId: outlet.rowId
                }
            }
        });
    });

    visibleTransfers.forEach((transfer) => {
        const fromChannelKey = toToken(transfer?.fromChannelKey);
        const toChannelKey = toToken(transfer?.toChannelKey);
        const fromNodeId = anchorNodeIdByChannel.get(fromChannelKey) ?? topNodeByKind.get(fromChannelKey)?.nodeId ?? null;
        const toNodeId = anchorNodeIdByChannel.get(toChannelKey) ?? topNodeByKind.get(toChannelKey)?.nodeId ?? null;
        if (!fromNodeId || !toNodeId) {
            validationWarnings.push(createSurfaceWarning(
                'This surface transfer does not connect to modeled source and target channels.',
                { rowId: toToken(transfer?.rowId) ?? undefined }
            ));
            return;
        }

        const transferState = resolveBarrierState(transfer?.state);
        const edgeId = createEdgeId(SURFACE_EDGE_KIND, fromNodeId, toNodeId, transfer.rowId);
        appendEdge(edges, edgeReasons, {
            edgeId,
            from: fromNodeId,
            to: toNodeId,
            kind: SURFACE_EDGE_KIND,
            direction: normalizeDirection(transfer?.direction, 'bidirectional'),
            cost: transfer?.transferType === 'leak' && !transfer?.state
                ? 0
                : transferState.cost,
            state: transferState.state,
            meta: {
                fromChannelKey,
                toChannelKey,
                transferId: transfer.rowId,
                transferType: toToken(transfer?.transferType)
            },
            reason: {
                ruleId: 'surface-channel-transfer',
                summary: `${toToken(transfer?.label) ?? transfer.rowId} allows communication from ${fromChannelKey} to ${toChannelKey}.`,
                details: {
                    fromChannelKey,
                    toChannelKey,
                    transferId: transfer.rowId
                }
            }
        });

        if (summaryByChannel[fromChannelKey]) {
            summaryByChannel[fromChannelKey].transferLabels.push(toToken(transfer?.label) ?? transfer.rowId);
        }
    });

    const missingChannelKinds = [...topNodeByKind.keys()].filter((channelKey) => !pathByChannel.has(channelKey));
    const fallback = buildTerminationEdges(intervals, intervalNodeByKind, {
        includeVolumeKinds: missingChannelKinds
    });
    fallback.edges.forEach((edge) => edges.push(edge));
    Object.assign(edgeReasons, fallback.edgeReasons);
    validationWarnings.push(...fallback.validationWarnings);

    missingChannelKinds.forEach((channelKey) => {
        const summaryEntry = summaryByChannel[channelKey] ?? createSurfaceSummaryEntry(channelKey, SURFACE_ROUTE_STATUS_ASSUMED);
        summaryEntry.routeStatus = SURFACE_ROUTE_STATUS_ASSUMED;
        summaryEntry.currentState = SURFACE_STATE_ASSUMED;
        summaryEntry.warningMessages.push('Surface path is assumed because no authored surface route exists for this channel.');
        summaryByChannel[channelKey] = summaryEntry;
    });

    Object.entries(summaryByChannel).forEach(([channelKey, summaryEntry]) => {
        if (summaryEntry.routeStatus !== SURFACE_ROUTE_STATUS_AUTHORED) return;

        const startNodeId = topNodeByKind.get(channelKey)?.nodeId ?? null;
        if (!startNodeId) return;

        const reachableNodeIds = computeActiveFlowNodeIds([startNodeId], edges, {
            traversalPolicy: ACTIVE_FLOW_TRAVERSAL_POLICY
        });
        const reachableOutletLabels = reachableNodeIds
            .map((nodeId) => outletLabelByNodeId.get(nodeId) ?? null)
            .filter(Boolean);
        const minimumPath = computeMinimumFailurePath([startNodeId], 'node:SURFACE', edges, {
            traversalPolicy: MINIMUM_FAILURE_TRAVERSAL_POLICY
        });

        summaryEntry.outletLabels = [...new Set(reachableOutletLabels)];
        if (summaryEntry.outletLabels.length > 0) {
            summaryEntry.currentState = SURFACE_STATE_OUTLET;
            return;
        }

        if (minimumPath.minFailureCostToSurface === 1) {
            summaryEntry.currentState = SURFACE_STATE_BLOCKED;
            return;
        }

        if (routeHasOutletByChannel.get(channelKey) !== true) {
            summaryEntry.currentState = SURFACE_STATE_MISSING_OUTLET;
            summaryEntry.warningMessages.push('This authored surface path does not end at a named outlet.');
            validationWarnings.push(createSurfaceWarning(
                'This authored surface path does not end at a named outlet.',
                { rowId: pathByChannel.get(channelKey)?.rowId }
            ));
            return;
        }

        if (routeHasReachableStructureByChannel.get(channelKey) !== true) {
            summaryEntry.currentState = SURFACE_STATE_MISSING_OUTLET;
        }
    });

    return {
        nodes,
        edges,
        edgeReasons,
        validationWarnings,
        surfaceSummary: {
            hasAuthoredSurface: true,
            byChannel: summaryByChannel
        }
    };
}

export default {
    buildSurfaceCommunicationTopology
};
