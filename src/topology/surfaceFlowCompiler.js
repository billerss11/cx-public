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
import { sortSurfaceChannelKeys } from '@/surface/model.js';

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

function createSurfaceComponentNodeId(rowId) {
    return `node:SURFACE_COMPONENT:${rowId}`;
}

function createSurfaceOutletNodeId(rowId) {
    return `node:SURFACE_OUTLET:${rowId}`;
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

function resolveComponentBarrierState(status) {
    const normalized = String(status ?? '').trim().toLowerCase();
    if (normalized === 'leaking' || normalized === 'failed_open') {
        return { cost: 0, state: 'open' };
    }
    if (normalized === 'closed' || normalized === 'failed_closed') {
        return { cost: 1, state: 'closed_failable' };
    }
    return { cost: 0, state: 'open' };
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

function groupComponentsByChannel(components = []) {
    const byChannel = new Map();
    toSafeArray(components)
        .filter((row) => row?.show !== false)
        .filter((row) => toToken(row?.rowId) && toToken(row?.channelKey))
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .forEach((row) => {
            const channelKey = toToken(row.channelKey);
            if (!byChannel.has(channelKey)) {
                byChannel.set(channelKey, []);
            }
            byChannel.get(channelKey).push(row);
        });
    return byChannel;
}

export function buildSurfaceCommunicationTopology(stateSnapshot = {}, intervals = [], intervalNodeByKind = new Map()) {
    const topNodeByKind = buildTopIntervalNodeByKind(intervals, intervalNodeByKind);
    const summaryByChannel = buildRouteSummaryMap(topNodeByKind);

    const surfaceComponents = toSafeArray(stateSnapshot?.surfaceComponents);
    const hasAuthoredSurface = surfaceComponents.some((row) => row?.show !== false);

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
    const componentsByChannel = groupComponentsByChannel(surfaceComponents);
    const anchorNodeIdByChannel = new Map();
    const outletLabelByNodeId = new Map();
    const routeHasOutletByChannel = new Map();
    const routeHasReachableStructureByChannel = new Map();
    const authoredChannels = new Set();

    componentsByChannel.forEach((channelComponents, channelKey) => {
        authoredChannels.add(channelKey);
        const rootNode = topNodeByKind.get(channelKey) ?? null;
        const summaryEntry = summaryByChannel[channelKey] ?? createSurfaceSummaryEntry(channelKey, SURFACE_ROUTE_STATUS_AUTHORED);
        summaryEntry.routeStatus = SURFACE_ROUTE_STATUS_AUTHORED;
        summaryByChannel[channelKey] = summaryEntry;

        if (!rootNode) {
            summaryEntry.warningMessages.push('This surface path does not match a modeled channel at the top of the well.');
            validationWarnings.push(createSurfaceWarning(
                'This surface path does not match a modeled channel at the top of the well.',
                { rowId: channelKey }
            ));
            return;
        }

        let previousNodeId = rootNode.nodeId;
        anchorNodeIdByChannel.set(channelKey, previousNodeId);
        routeHasReachableStructureByChannel.set(channelKey, false);

        channelComponents.forEach((component) => {
            const rowId = toToken(component.rowId);
            if (!rowId) return;

            const componentType = toToken(component.componentType) ?? 'valve';

            if (componentType === 'valve') {
                const nodeId = createSurfaceComponentNodeId(rowId);
                nodes.push({
                    nodeId,
                    kind: 'SURFACE_PATH_ITEM',
                    depthTop: null,
                    depthBottom: null,
                    volumeKey: channelKey,
                    meta: {
                        itemId: rowId,
                        itemType: 'barrier',
                        label: toToken(component.label) ?? rowId
                    }
                });

                const barrierState = resolveComponentBarrierState(component.status);
                const edgeId = createEdgeId(SURFACE_EDGE_KIND, previousNodeId, nodeId, rowId);
                appendEdge(edges, edgeReasons, {
                    edgeId,
                    from: previousNodeId,
                    to: nodeId,
                    kind: SURFACE_EDGE_KIND,
                    direction: 'forward',
                    cost: barrierState.cost,
                    state: barrierState.state,
                    meta: { channelKey, itemId: rowId },
                    reason: {
                        ruleId: 'surface-path-barrier',
                        summary: `${toToken(component.label) ?? 'Surface valve'} carries ${channelKey} toward surface outlet.`,
                        details: { channelKey, itemId: rowId }
                    }
                });
                previousNodeId = nodeId;
                anchorNodeIdByChannel.set(channelKey, previousNodeId);
                routeHasReachableStructureByChannel.set(channelKey, true);
                summaryEntry.barrierLabels.push(toToken(component.label) ?? rowId);
                if (barrierState.cost === 1) {
                    summaryEntry.blockingBarrierLabels.push(toToken(component.label) ?? rowId);
                }
            }

            if (componentType === 'outlet') {
                const outletNodeId = createSurfaceOutletNodeId(rowId);
                nodes.push({
                    nodeId: outletNodeId,
                    kind: 'SURFACE_OUTLET',
                    depthTop: null,
                    depthBottom: null,
                    volumeKey: channelKey,
                    meta: {
                        outletId: rowId,
                        label: toToken(component.label) ?? rowId,
                        channelKey
                    }
                });
                outletLabelByNodeId.set(outletNodeId, toToken(component.label) ?? rowId);
                routeHasOutletByChannel.set(channelKey, true);

                const routeEdgeId = createEdgeId(SURFACE_EDGE_KIND, previousNodeId, outletNodeId, rowId);
                appendEdge(edges, edgeReasons, {
                    edgeId: routeEdgeId,
                    from: previousNodeId,
                    to: outletNodeId,
                    kind: SURFACE_EDGE_KIND,
                    direction: 'forward',
                    cost: 0,
                    state: 'open',
                    meta: { channelKey, outletId: rowId },
                    reason: {
                        ruleId: 'surface-path-outlet',
                        summary: `${channelKey} reaches ${toToken(component.label) ?? rowId}.`,
                        details: { channelKey, outletId: rowId }
                    }
                });

                const sinkEdgeId = createEdgeId(EDGE_KIND_TERMINATION, outletNodeId, 'node:SURFACE', rowId);
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
                        outletId: rowId,
                        outletLabel: toToken(component.label) ?? rowId
                    },
                    reason: {
                        ruleId: 'surface-outlet-termination',
                        summary: `${toToken(component.label) ?? rowId} connects to surface sink.`,
                        details: { channelKey, outletId: rowId }
                    }
                });
                previousNodeId = outletNodeId;
                anchorNodeIdByChannel.set(channelKey, previousNodeId);
            }

            if (componentType === 'crossover') {
                const toChannelKey = toToken(component.connectedTo);
                if (!toChannelKey) return;

                const fromNodeId = anchorNodeIdByChannel.get(channelKey) ?? topNodeByKind.get(channelKey)?.nodeId ?? null;
                const toNodeId = anchorNodeIdByChannel.get(toChannelKey) ?? topNodeByKind.get(toChannelKey)?.nodeId ?? null;
                if (!fromNodeId || !toNodeId) {
                    validationWarnings.push(createSurfaceWarning(
                        'This surface crossover does not connect to modeled source and target channels.',
                        { rowId }
                    ));
                    return;
                }

                const edgeId = createEdgeId(SURFACE_EDGE_KIND, fromNodeId, toNodeId, rowId);
                appendEdge(edges, edgeReasons, {
                    edgeId,
                    from: fromNodeId,
                    to: toNodeId,
                    kind: SURFACE_EDGE_KIND,
                    direction: normalizeDirection(component.crossoverDirection, 'bidirectional'),
                    cost: 0,
                    state: 'open',
                    meta: {
                        fromChannelKey: channelKey,
                        toChannelKey,
                        transferId: rowId,
                        transferType: 'crossover'
                    },
                    reason: {
                        ruleId: 'surface-channel-transfer',
                        summary: `${toToken(component.label) ?? rowId} allows communication from ${channelKey} to ${toChannelKey}.`,
                        details: { fromChannelKey: channelKey, toChannelKey, transferId: rowId }
                    }
                });

                summaryEntry.transferLabels.push(toToken(component.label) ?? rowId);
            }
        });
    });

    const missingChannelKinds = [...topNodeByKind.keys()].filter((channelKey) => !authoredChannels.has(channelKey));
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
                { rowId: channelKey }
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
