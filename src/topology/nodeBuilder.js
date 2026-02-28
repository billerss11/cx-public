import { getIntervalsWithBoundaryReasons, getStackAtDepth } from '@/physics/physicsCore.js';
import {
    resolveFormationAnnulusLayer,
    resolveAnnulusSlotIndex,
    resolveBoreLayer
} from '@/utils/physicsLayers.js';
import { resolveAnnulusLayerForVolumeKind } from '@/topology/annulusVolumeMapping.js';
import {
    MODELED_ANNULUS_VOLUME_SLOTS,
    NODE_KIND_BORE,
    NODE_KIND_FORMATION_ANNULUS,
    NODE_KIND_SURFACE,
    NODE_KIND_TUBING_ANNULUS,
    TOPOLOGY_EPSILON
} from '@/topology/topologyTypes.js';

const INNER_CHANNEL_TUBING = 'tubing_inner';
const INNER_CHANNEL_WELLBORE = 'wellbore_inner';

function createIntervalKey(top, bottom) {
    return `${Number(top).toFixed(6)}:${Number(bottom).toFixed(6)}`;
}

export function createNodeId(kind, top, bottom) {
    return `node:${kind}:${createIntervalKey(top, bottom)}`;
}

export function createSurfaceNode() {
    return {
        nodeId: 'node:SURFACE',
        kind: NODE_KIND_SURFACE,
        depthTop: null,
        depthBottom: null,
        volumeKey: NODE_KIND_SURFACE,
        meta: {}
    };
}

function resolveModeledAnnulusKindBySlotIndex(slotIndex) {
    if (!Number.isInteger(slotIndex)) return null;
    const modeledSlot = MODELED_ANNULUS_VOLUME_SLOTS.find((candidate) => candidate.slotIndex === slotIndex);
    return modeledSlot?.kind ?? null;
}

function shouldAllowFormationRepresentationForAnnulusKind(kind) {
    const modeledSlot = MODELED_ANNULUS_VOLUME_SLOTS.find((candidate) => candidate.kind === kind);
    return modeledSlot?.allowFormationRepresentation === true;
}

function createAnnulusNode(kind, top, bottom, annulusLayer) {
    const material = String(annulusLayer?.material ?? '').trim().toLowerCase();
    const annulusBlocked = material === 'cement' || material === 'plug';
    return {
        nodeId: createNodeId(kind, top, bottom),
        kind,
        depthTop: top,
        depthBottom: bottom,
        volumeKey: kind,
        meta: {
            isBlocked: annulusBlocked,
            material,
            annulusIndex: resolveAnnulusSlotIndex(annulusLayer)
        }
    };
}

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

function resolveInnermostPipeLayer(stack = []) {
    const pipeLayers = toSafeArray(stack)
        .filter((layer) => layer?.role === 'pipe' && layer?.material === 'steel');
    if (pipeLayers.length === 0) return null;

    return pipeLayers.reduce((innermost, layer) => {
        const candidateOuterRadius = Number(layer?.outerRadius);
        const currentOuterRadius = Number(innermost?.outerRadius);
        if (!Number.isFinite(candidateOuterRadius)) return innermost;
        if (!Number.isFinite(currentOuterRadius) || candidateOuterRadius < currentOuterRadius) {
            return layer;
        }
        return innermost;
    }, null);
}

function resolveInnerChannelForBoreNode(stack = []) {
    const innermostPipeLayer = resolveInnermostPipeLayer(stack);
    if (innermostPipeLayer?.pipeType === 'tubing') return INNER_CHANNEL_TUBING;
    return INNER_CHANNEL_WELLBORE;
}

function createVolumeNodesForInterval(interval, stack = []) {
    const top = Number(interval?.top);
    const bottom = Number(interval?.bottom);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) {
        return [];
    }

    const nodes = [];
    const boreLayer = resolveBoreLayer(stack);
    if (boreLayer) {
        const boreBlocked = stack.some((layer) => (
            layer?.material === 'plug'
            && Number(layer?.innerRadius) <= TOPOLOGY_EPSILON
            && Number(layer?.outerRadius) > TOPOLOGY_EPSILON
        ));
        nodes.push({
            nodeId: createNodeId(NODE_KIND_BORE, top, bottom),
            kind: NODE_KIND_BORE,
            depthTop: top,
            depthBottom: bottom,
            volumeKey: NODE_KIND_BORE,
            meta: {
                isBlocked: boreBlocked,
                innerChannel: resolveInnerChannelForBoreNode(stack)
            }
        });
    }

    const modeledAnnulusKinds = [
        NODE_KIND_TUBING_ANNULUS,
        ...MODELED_ANNULUS_VOLUME_SLOTS.map((slot) => slot.kind)
    ];

    modeledAnnulusKinds.forEach((kind) => {
        const annulusLayer = resolveAnnulusLayerForVolumeKind(stack, kind);
        if (!annulusLayer) return;
        if (annulusLayer?.isFormation === true) {
            if (kind === NODE_KIND_TUBING_ANNULUS) return;
            if (!shouldAllowFormationRepresentationForAnnulusKind(kind)) return;
        }
        nodes.push(createAnnulusNode(kind, top, bottom, annulusLayer));
    });

    const formationAnnulusLayer = resolveFormationAnnulusLayer(stack);
    const formationSlotIndex = resolveAnnulusSlotIndex(formationAnnulusLayer);
    const hasModeledNodeForFormationSlot = nodes.some((node) => (
        node?.kind !== NODE_KIND_FORMATION_ANNULUS
        && Number(node?.meta?.annulusIndex) === formationSlotIndex
    ));
    const shouldCreateFormationNode = Boolean(formationAnnulusLayer) && !hasModeledNodeForFormationSlot;
    if (shouldCreateFormationNode) {
        nodes.push(createAnnulusNode(
            NODE_KIND_FORMATION_ANNULUS,
            top,
            bottom,
            formationAnnulusLayer
        ));
    }

    return nodes;
}

export function buildTopologyNodes(physicsContext) {
    const intervals = getIntervalsWithBoundaryReasons(physicsContext)
        .map((interval, intervalIndex) => {
            const top = Number(interval?.top);
            const bottom = Number(interval?.bottom);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
            const midpoint = (top + bottom) / 2;
            const stack = getStackAtDepth(midpoint, physicsContext);
            return {
                intervalIndex,
                top,
                bottom,
                midpoint,
                stack
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.top - right.top);

    const nodes = [createSurfaceNode()];
    const intervalNodeByKind = new Map();
    intervals.forEach((interval) => {
        const volumeNodes = createVolumeNodesForInterval(interval, interval.stack);
        volumeNodes.forEach((node) => {
            nodes.push(node);
            intervalNodeByKind.set(`${interval.intervalIndex}|${node.kind}`, node);
        });
    });

    return {
        intervals,
        nodes,
        intervalNodeByKind
    };
}

export default {
    buildTopologyNodes,
    createNodeId,
    createSurfaceNode
};
