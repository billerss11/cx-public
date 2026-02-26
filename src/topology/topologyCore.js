import { createContext as createPhysicsContext } from '@/physics/physicsCore.js';
import { buildTopologyNodes } from '@/topology/nodeBuilder.js';
import {
    buildVerticalEdges,
    buildRadialEdges,
    buildScenarioRadialEdges,
    buildTerminationEdges
} from '@/topology/edgeBuilder.js';
import {
    buildFluidSourceNodes,
    buildExplicitScenarioSourceNodes,
    normalizeStateSnapshot,
    resolveSourceChannels,
    shouldUseIllustrativeFluidSource
} from '@/topology/sourceResolver.js';
import {
    computeActiveFlowNodeIds,
    computeMinimumFailurePath,
    computeSpofEdgeIds,
    ACTIVE_FLOW_TRAVERSAL_POLICY,
    MINIMUM_FAILURE_TRAVERSAL_POLICY
} from '@/topology/pathAlgorithms.js';
import {
    buildSourcePolicyWarnings,
    buildTopologyValidationWarnings
} from '@/topology/warningBuilder.js';
import { evaluateBarrierEnvelopes } from '@/topology/envelopeEvaluator.js';
import { normalizeWellId } from '@/topology/topologyTypes.js';

function cloneTraversalPolicy(policy = {}) {
    return {
        allowCosts: Array.isArray(policy?.allowCosts) ? [...policy.allowCosts] : [],
        defaultEdgeDirection: String(policy?.defaultEdgeDirection ?? ''),
        edgeDirectionsByKind: policy?.edgeDirectionsByKind && typeof policy.edgeDirectionsByKind === 'object'
            ? { ...policy.edgeDirectionsByKind }
            : {},
        sinkNodeIds: Array.isArray(policy?.sinkNodeIds) ? [...policy.sinkNodeIds] : []
    };
}

export function buildTopologyModel(stateSnapshot = {}, options = {}) {
    const safeState = normalizeStateSnapshot(stateSnapshot);
    const physicsContext = createPhysicsContext(safeState);
    const { intervals, nodes, intervalNodeByKind } = buildTopologyNodes(physicsContext);
    const useIllustrativeFluidSource = shouldUseIllustrativeFluidSource(safeState);

    const vertical = buildVerticalEdges(intervals, intervalNodeByKind, physicsContext.equipment, {
        casingRows: physicsContext.casingRows,
        tubingRows: physicsContext.tubingRows
    });
    const radial = buildRadialEdges(safeState, intervals, intervalNodeByKind, physicsContext);
    const scenarioRadial = buildScenarioRadialEdges(safeState, intervals, intervalNodeByKind);
    const explicit = buildExplicitScenarioSourceNodes(safeState, intervals, intervalNodeByKind);
    const fluid = useIllustrativeFluidSource
        ? buildFluidSourceNodes(safeState, intervals, intervalNodeByKind)
        : { sourceNodeIds: [], sourceEntities: [], validationWarnings: [] };

    const sourceResolution = resolveSourceChannels({
        useIllustrativeFluidSource,
        radial,
        fluid,
        explicit
    });

    const policyWarnings = buildSourcePolicyWarnings({
        useIllustrativeFluidSource,
        hasVisibleFluidRows: safeState.annulusFluids.some((row) => row?.show !== false),
        hasExplicitScenarioRows: explicit.hasScenarioRows
    });

    const termination = buildTerminationEdges(intervals, intervalNodeByKind);

    const edges = [
        ...vertical.edges,
        ...radial.edges,
        ...scenarioRadial.edges,
        ...termination.edges
    ];
    const edgeById = new Map(edges.map((edge) => [edge.edgeId, edge]));
    const edgeReasons = {
        ...vertical.edgeReasons,
        ...radial.edgeReasons,
        ...scenarioRadial.edgeReasons,
        ...termination.edgeReasons
    };
    const sourceNodeIds = sourceResolution.sourceNodeIds;

    const activeFlowNodeIds = computeActiveFlowNodeIds(sourceNodeIds, edges, {
        traversalPolicy: ACTIVE_FLOW_TRAVERSAL_POLICY
    });
    const minimumPath = computeMinimumFailurePath(sourceNodeIds, 'node:SURFACE', edges, {
        traversalPolicy: MINIMUM_FAILURE_TRAVERSAL_POLICY
    });
    const spofEdgeIds = computeSpofEdgeIds(
        minimumPath.minFailureCostToSurface,
        minimumPath.minCostPathEdgeIds,
        edgeById
    );
    const barrierEnvelope = evaluateBarrierEnvelopes({
        edges,
        edgeReasons,
        sourceNodeIds,
        targetNodeId: 'node:SURFACE',
        primaryPathEdgeIds: minimumPath.minCostPathEdgeIds,
        primaryMinFailureCost: minimumPath.minFailureCostToSurface
    });

    return {
        requestId: Number.isInteger(options?.requestId) ? options.requestId : null,
        wellId: normalizeWellId(options?.wellId),
        nodes,
        edges,
        activeFlowNodeIds,
        minFailureCostToSurface: minimumPath.minFailureCostToSurface,
        minCostPathEdgeIds: minimumPath.minCostPathEdgeIds,
        spofEdgeIds,
        barrierEnvelope,
        traversalContracts: {
            activeFlow: cloneTraversalPolicy(ACTIVE_FLOW_TRAVERSAL_POLICY),
            minimumFailure: cloneTraversalPolicy(MINIMUM_FAILURE_TRAVERSAL_POLICY)
        },
        sourceEntities: sourceResolution.sourceEntities,
        sourcePolicy: sourceResolution.sourcePolicy,
        edgeReasons,
        validationWarnings: buildTopologyValidationWarnings({
            verticalWarnings: vertical.validationWarnings,
            radialWarnings: [
                ...radial.validationWarnings,
                ...scenarioRadial.validationWarnings
            ],
            explicitWarnings: explicit.validationWarnings,
            fluidWarnings: fluid.validationWarnings,
            sourceResolutionWarnings: sourceResolution.validationWarnings,
            policyWarnings
        })
    };
}

export default {
    buildTopologyModel
};
