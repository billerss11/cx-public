import { getIntervalsWithBoundaryReasons, getStackAtDepth } from '@/physics/physicsCore.js';
import {
    resolveAnnulusLayerByIndex,
    resolveFormationAnnulusLayer,
    resolveAnnulusSlotIndex,
    resolveBoreLayer
} from '@/utils/physicsLayers.js';
import {
    MODELED_ANNULUS_VOLUME_SLOTS,
    NODE_KIND_BORE,
    NODE_KIND_FORMATION_ANNULUS,
    NODE_KIND_SURFACE,
    TOPOLOGY_EPSILON
} from '@/topology/topologyTypes.js';

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
                isBlocked: boreBlocked
            }
        });
    }

    MODELED_ANNULUS_VOLUME_SLOTS.forEach(({ kind, slotIndex, allowFormationRepresentation }) => {
        const annulusLayer = resolveAnnulusLayerByIndex(stack, slotIndex);
        if (!annulusLayer) return;
        if (annulusLayer?.isFormation === true && allowFormationRepresentation !== true) return;
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
