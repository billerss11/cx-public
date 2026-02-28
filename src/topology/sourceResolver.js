import { resolveFormationAnnulusLayer, resolveAnnulusSlotIndex } from '@/utils/physicsLayers.js';
import {
    resolveAnnulusLayerForVolumeKind,
    resolveMaxModeledAnnulusSlotIndexForStack
} from '@/topology/annulusVolumeMapping.js';
import {
    MODELED_CASING_ANNULUS_KINDS,
    MODELED_ANNULUS_VOLUME_SLOTS,
    NODE_KIND_FORMATION_ANNULUS,
    NODE_KIND_TUBING_INNER,
    NODE_KIND_TUBING_ANNULUS,
    SOURCE_POLICY_MODE_SCENARIO_EXPLICIT,
    SOURCE_POLICY_MODE_OPEN_HOLE_OPT_IN,
    SOURCE_POLICY_MODE_FLUID_OPT_IN,
    SOURCE_POLICY_MODE_MARKER_DEFAULT,
    TOPOLOGY_CONFIG_USE_ILLUSTRATIVE_FLUID_SOURCE,
    TOPOLOGY_CONFIG_USE_OPEN_HOLE_SOURCE,
    SOURCE_KIND_FORMATION_INFLOW,
    SOURCE_KIND_SCENARIO,
    normalizeSourceType,
    normalizeSourceVolumeKind
} from '@/topology/topologyTypes.js';
import {
    isSourceRowVisible,
    resolveSourceDepthRange,
    intervalIntersectsSourceRange,
    isScenarioBreakoutRow
} from '@/topology/sourceRows.js';
import {
    TOPOLOGY_WARNING_CODES,
    createTopologyValidationWarning
} from '@/topology/warningCatalog.js';

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

const SOURCE_WARNING_FLUID_ROWS_WITHOUT_MODELED_SOURCE_NODES = TOPOLOGY_WARNING_CODES.FLUID_ROWS_WITHOUT_MODELED_SOURCE_NODES;
const SOURCE_WARNING_FLUID_IN_UNMODELED_OUTER_ANNULUS = TOPOLOGY_WARNING_CODES.FLUID_IN_UNMODELED_OUTER_ANNULUS;
const SOURCE_WARNING_UNMAPPED_FORMATION_ANNULUS_FLUID = TOPOLOGY_WARNING_CODES.UNMAPPED_FORMATION_ANNULUS_FLUID;
const SOURCE_WARNING_SCENARIO_SOURCE_UNSUPPORTED_VOLUME = TOPOLOGY_WARNING_CODES.SCENARIO_SOURCE_UNSUPPORTED_VOLUME;
const SOURCE_WARNING_SCENARIO_SOURCE_MISSING_DEPTH_RANGE = TOPOLOGY_WARNING_CODES.SCENARIO_SOURCE_MISSING_DEPTH_RANGE;
const SOURCE_WARNING_SCENARIO_SOURCE_NO_RESOLVABLE_INTERVAL = TOPOLOGY_WARNING_CODES.SCENARIO_SOURCE_NO_RESOLVABLE_INTERVAL;
const SOURCE_WARNING_SCENARIO_ROWS_WITH_NO_RESOLVED_NODES = TOPOLOGY_WARNING_CODES.SCENARIO_ROWS_WITH_NO_RESOLVED_NODES;
const SUPPORTED_SOURCE_VOLUME_KINDS = Object.freeze([
    'TUBING_INNER',
    NODE_KIND_TUBING_ANNULUS,
    ...MODELED_CASING_ANNULUS_KINDS,
    NODE_KIND_FORMATION_ANNULUS
]);
const SUPPORTED_SOURCE_VOLUME_LIST = SUPPORTED_SOURCE_VOLUME_KINDS.join('/');
const SUPPORTED_SCENARIO_SOURCE_VOLUME_LIST = SUPPORTED_SOURCE_VOLUME_KINDS.join(', ');
const OUTERMOST_MODELED_ANNULUS_KIND = MODELED_CASING_ANNULUS_KINDS[
    MODELED_CASING_ANNULUS_KINDS.length - 1
] ?? 'ANNULUS_D';
const MODELED_ANNULUS_SOURCE_VOLUME_KINDS = Object.freeze([
    NODE_KIND_TUBING_ANNULUS,
    ...MODELED_ANNULUS_VOLUME_SLOTS.map((slot) => slot.kind)
]);

export function normalizeStateSnapshot(stateSnapshot = {}) {
    const source = stateSnapshot && typeof stateSnapshot === 'object' ? stateSnapshot : {};
    return {
        casingData: toSafeArray(source.casingData),
        tubingData: toSafeArray(source.tubingData),
        drillStringData: toSafeArray(source.drillStringData),
        equipmentData: toSafeArray(source.equipmentData),
        horizontalLines: toSafeArray(source.horizontalLines),
        annotationBoxes: toSafeArray(source.annotationBoxes),
        userAnnotations: toSafeArray(source.userAnnotations),
        cementPlugs: toSafeArray(source.cementPlugs),
        annulusFluids: toSafeArray(source.annulusFluids),
        markers: toSafeArray(source.markers),
        topologySources: toSafeArray(source.topologySources),
        trajectory: toSafeArray(source.trajectory),
        config: source?.config && typeof source.config === 'object' ? source.config : {},
        interaction: source?.interaction && typeof source.interaction === 'object' ? source.interaction : {}
    };
}

function resolveModeledAnnulusKindBySlotIndex(slotIndex) {
    if (!Number.isInteger(slotIndex)) return null;
    const modeledSlot = MODELED_ANNULUS_VOLUME_SLOTS.find((candidate) => candidate.slotIndex === slotIndex);
    return modeledSlot?.kind ?? null;
}

function resolveFormationSourceNodeForInterval(interval, intervalNodeByKind) {
    const directFormationNode = intervalNodeByKind.get(
        `${interval.intervalIndex}|${NODE_KIND_FORMATION_ANNULUS}`
    ) ?? null;
    if (directFormationNode) return directFormationNode;

    const formationLayer = resolveFormationAnnulusLayer(interval?.stack ?? []);
    if (!formationLayer) return null;

    const slotIndex = resolveAnnulusSlotIndex(formationLayer);
    const modeledKind = resolveModeledAnnulusKindBySlotIndex(slotIndex);
    if (!modeledKind) return null;

    return intervalNodeByKind.get(`${interval.intervalIndex}|${modeledKind}`) ?? null;
}

function resolveSourceNodeForVolumeKind(interval, intervalNodeByKind, volumeKind) {
    if (volumeKind === NODE_KIND_FORMATION_ANNULUS) {
        return resolveFormationSourceNodeForInterval(interval, intervalNodeByKind);
    }
    return intervalNodeByKind.get(`${interval.intervalIndex}|${volumeKind}`) ?? null;
}

function isBlockedSourceNode(node) {
    return node?.meta?.isBlocked === true;
}

function isOpenHoleInterval(interval = {}) {
    const stack = Array.isArray(interval?.stack) ? interval.stack : [];
    return stack.some((layer) => (
        layer?.role === 'core-boundary'
        && layer?.isOpenHoleBoundary === true
    ));
}

function resolveOpenHoleSourceCandidate(interval, intervalNodeByKind) {
    const formationNode = resolveSourceNodeForVolumeKind(
        interval,
        intervalNodeByKind,
        NODE_KIND_FORMATION_ANNULUS
    );
    if (formationNode && !isBlockedSourceNode(formationNode)) {
        return {
            node: formationNode,
            volumeKey: NODE_KIND_FORMATION_ANNULUS
        };
    }

    const innerNode = resolveSourceNodeForVolumeKind(
        interval,
        intervalNodeByKind,
        NODE_KIND_TUBING_INNER
    );
    if (innerNode && !isBlockedSourceNode(innerNode)) {
        return {
            node: innerNode,
            volumeKey: NODE_KIND_TUBING_INNER
        };
    }

    return null;
}

export function buildOpenHoleSourceNodes(intervals, intervalNodeByKind) {
    const sourceNodeIds = new Set();
    const sourceEntities = [];

    intervals.forEach((interval) => {
        if (!isOpenHoleInterval(interval)) return;
        const candidate = resolveOpenHoleSourceCandidate(interval, intervalNodeByKind);
        if (!candidate?.node?.nodeId) return;

        sourceNodeIds.add(candidate.node.nodeId);
        sourceEntities.push({
            sourceId: `source:open-hole:${interval.intervalIndex}:${candidate.node.nodeId}`,
            sourceType: SOURCE_KIND_FORMATION_INFLOW,
            volumeKey: candidate.volumeKey,
            depthTop: interval.top,
            depthBottom: interval.bottom,
            rowId: null,
            origin: 'open-hole-default',
            nodeIds: [candidate.node.nodeId]
        });
    });

    return {
        sourceNodeIds: [...sourceNodeIds],
        sourceEntities,
        validationWarnings: []
    };
}

export function buildFluidSourceNodes(stateSnapshot, intervals, intervalNodeByKind) {
    const sourceNodeIds = new Set();
    const sourceEntities = [];
    const validationWarnings = [];
    const fluidRows = toSafeArray(stateSnapshot.annulusFluids)
        .filter((row) => row?.show !== false);

    let hasFluidOutsideModeledAnnuli = false;
    let hasUnmappedFormationFluid = false;

    intervals.forEach((interval) => {
        const stack = Array.isArray(interval?.stack) ? interval.stack : [];
        MODELED_ANNULUS_SOURCE_VOLUME_KINDS.forEach((kind) => {
            const annulusLayer = resolveAnnulusLayerForVolumeKind(stack, kind);
            const annulusNode = intervalNodeByKind.get(`${interval.intervalIndex}|${kind}`) ?? null;
            const annulusMaterial = String(annulusLayer?.material ?? '').trim().toLowerCase();
            if (!annulusLayer || !annulusNode || annulusMaterial !== 'fluid') return;

            sourceNodeIds.add(annulusNode.nodeId);
            sourceEntities.push({
                sourceId: `source:illustrative-fluid:${interval.intervalIndex}:${annulusNode.nodeId}`,
                sourceType: SOURCE_KIND_SCENARIO,
                volumeKey: kind,
                depthTop: interval.top,
                depthBottom: interval.bottom,
                rowId: null,
                origin: 'illustrative-fluid',
                nodeIds: [annulusNode.nodeId]
            });
        });

        const formationLayer = resolveFormationAnnulusLayer(stack);
        const formationMaterial = String(formationLayer?.material ?? '').trim().toLowerCase();
        const formationSlotIndex = resolveAnnulusSlotIndex(formationLayer);
        const formationModeledKind = resolveModeledAnnulusKindBySlotIndex(formationSlotIndex);
        const modeledFormationNode = formationModeledKind
            ? intervalNodeByKind.get(`${interval.intervalIndex}|${formationModeledKind}`) ?? null
            : null;
        const formationOutsideModeledSlots = Boolean(formationLayer) && !modeledFormationNode;

        if (formationOutsideModeledSlots && formationMaterial === 'fluid') {
            const formationNode = resolveFormationSourceNodeForInterval(interval, intervalNodeByKind);
            if (formationNode) {
                sourceNodeIds.add(formationNode.nodeId);
                sourceEntities.push({
                    sourceId: `source:illustrative-fluid:${interval.intervalIndex}:${formationNode.nodeId}`,
                    sourceType: SOURCE_KIND_SCENARIO,
                    volumeKey: NODE_KIND_FORMATION_ANNULUS,
                    depthTop: interval.top,
                    depthBottom: interval.bottom,
                    rowId: null,
                    origin: 'illustrative-fluid',
                    nodeIds: [formationNode.nodeId]
                });
            } else {
                hasUnmappedFormationFluid = true;
            }
        }

        const maxModeledSlotIndex = resolveMaxModeledAnnulusSlotIndexForStack(stack);
        const nonModeledFluidLayers = stack.filter((layer) => {
            if (layer?.role !== 'annulus') return false;
            const material = String(layer?.material ?? '').trim().toLowerCase();
            if (material !== 'fluid') return false;
            const slotIndex = resolveAnnulusSlotIndex(layer);
            if (!Number.isInteger(slotIndex) || slotIndex <= maxModeledSlotIndex) return false;
            return layer?.isFormation !== true;
        });
        if (nonModeledFluidLayers.length > 0) {
            hasFluidOutsideModeledAnnuli = true;
        }
    });

    if (fluidRows.length > 0 && sourceNodeIds.size === 0) {
        validationWarnings.push(createTopologyValidationWarning(
            SOURCE_WARNING_FLUID_ROWS_WITHOUT_MODELED_SOURCE_NODES,
            `Fluid intervals exist, but none currently map to ${SUPPORTED_SOURCE_VOLUME_LIST} sources in the topology MVP.`
        ));
    }

    if (hasFluidOutsideModeledAnnuli) {
        validationWarnings.push(createTopologyValidationWarning(
            SOURCE_WARNING_FLUID_IN_UNMODELED_OUTER_ANNULUS,
            `Fluid detected in non-formation annulus volumes beyond ${OUTERMOST_MODELED_ANNULUS_KIND}; those outer annulus volumes are not modeled in this topology MVP.`
        ));
    }

    if (hasUnmappedFormationFluid) {
        validationWarnings.push(createTopologyValidationWarning(
            SOURCE_WARNING_UNMAPPED_FORMATION_ANNULUS_FLUID,
            'Formation-annulus fluid was detected, but no resolvable FORMATION_ANNULUS node was created for at least one interval.'
        ));
    }

    return {
        sourceNodeIds: [...sourceNodeIds],
        sourceEntities,
        validationWarnings
    };
}

export function buildExplicitScenarioSourceNodes(stateSnapshot, intervals, intervalNodeByKind) {
    const visibleSourceRows = toSafeArray(stateSnapshot.topologySources).filter(isSourceRowVisible);
    const sourceRows = visibleSourceRows.filter((sourceRow) => !isScenarioBreakoutRow(sourceRow));
    const sourceNodeIds = new Set();
    const sourceEntities = [];
    const validationWarnings = [];

    sourceRows.forEach((sourceRow, sourceIndex) => {
        const rowId = String(sourceRow?.rowId ?? '').trim() || null;
        const volumeKey = normalizeSourceVolumeKind(
            sourceRow?.volumeKey
            ?? sourceRow?.volume
            ?? sourceRow?.targetVolume
            ?? sourceRow?.targetVolumeKey
        );
        if (!volumeKey) {
            validationWarnings.push(createTopologyValidationWarning(
                SOURCE_WARNING_SCENARIO_SOURCE_UNSUPPORTED_VOLUME,
                `Scenario source row has an unsupported volume key. Use ${SUPPORTED_SCENARIO_SOURCE_VOLUME_LIST.replace('TUBING_INNER', 'TUBING_INNER (legacy BORE)')} for MVP (OPEN_HOLE maps to FORMATION_ANNULUS).`,
                {
                    rowId: rowId || undefined
                }
            ));
            return;
        }

        const depthRange = resolveSourceDepthRange(sourceRow);
        if (!depthRange) {
            validationWarnings.push(createTopologyValidationWarning(
                SOURCE_WARNING_SCENARIO_SOURCE_MISSING_DEPTH_RANGE,
                'Scenario source row is missing a valid depth/depth range.',
                {
                    rowId: rowId || undefined
                }
            ));
            return;
        }

        const matchedNodeIds = new Set();
        intervals.forEach((interval) => {
            if (!intervalIntersectsSourceRange(interval, depthRange)) return;
            const node = resolveSourceNodeForVolumeKind(interval, intervalNodeByKind, volumeKey);
            if (!node) return;

            sourceNodeIds.add(node.nodeId);
            matchedNodeIds.add(node.nodeId);
        });

        if (matchedNodeIds.size === 0) {
            validationWarnings.push(createTopologyValidationWarning(
                SOURCE_WARNING_SCENARIO_SOURCE_NO_RESOLVABLE_INTERVAL,
                'Scenario source row does not intersect a resolvable topology volume interval.',
                {
                    rowId: rowId || undefined,
                    depth: depthRange.top
                }
            ));
            return;
        }

        sourceEntities.push({
            sourceId: `source:scenario:${rowId ?? sourceIndex}`,
            sourceType: normalizeSourceType(sourceRow?.sourceType ?? sourceRow?.type ?? sourceRow?.eventType),
            volumeKey,
            depthTop: depthRange.top,
            depthBottom: depthRange.bottom,
            rowId,
            origin: 'scenario',
            nodeIds: [...matchedNodeIds]
        });
    });

    return {
        hasScenarioRows: sourceRows.length > 0,
        sourceNodeIds: [...sourceNodeIds],
        sourceEntities,
        validationWarnings
    };
}

export function resolveSourceChannels({
    useIllustrativeFluidSource,
    useOpenHoleSource,
    radial,
    fluid,
    openHole,
    explicit
} = {}) {
    const warnings = [];
    const explicitScenarioRowsPresent = explicit?.hasScenarioRows === true;
    const explicitSourceNodeIds = toSafeArray(explicit?.sourceNodeIds);
    const explicitSourceEntities = toSafeArray(explicit?.sourceEntities);
    const hasResolvedExplicitSourceNodes = explicitSourceNodeIds.length > 0;

    if (explicitScenarioRowsPresent && !hasResolvedExplicitSourceNodes) {
        warnings.push(createTopologyValidationWarning(
            SOURCE_WARNING_SCENARIO_ROWS_WITH_NO_RESOLVED_NODES,
            'Scenario source rows are present, but no source nodes were resolved for this run.'
        ));
    }

    if (explicitScenarioRowsPresent && hasResolvedExplicitSourceNodes) {
        return {
            sourceNodeIds: explicitSourceNodeIds,
            sourceEntities: explicitSourceEntities,
            sourcePolicy: {
                mode: SOURCE_POLICY_MODE_SCENARIO_EXPLICIT,
                markerDerived: false,
                illustrativeFluidDerived: false,
                explicitScenarioDerived: true
            },
            validationWarnings: warnings
        };
    }

    const markerSourceNodeIds = toSafeArray(radial?.sourceNodeIds);
    const illustrativeSourceNodeIds = useIllustrativeFluidSource
        ? toSafeArray(fluid?.sourceNodeIds)
        : [];
    const openHoleSourceNodeIds = useOpenHoleSource
        ? toSafeArray(openHole?.sourceNodeIds)
        : [];
    const sourceNodeIds = [...new Set([
        ...markerSourceNodeIds,
        ...illustrativeSourceNodeIds,
        ...openHoleSourceNodeIds
    ])];

    const sourceEntities = [
        ...toSafeArray(radial?.sourceEntities),
        ...(useIllustrativeFluidSource ? toSafeArray(fluid?.sourceEntities) : []),
        ...(useOpenHoleSource ? toSafeArray(openHole?.sourceEntities) : [])
    ];

    const fallbackSourcePolicyMode = useIllustrativeFluidSource
        ? SOURCE_POLICY_MODE_FLUID_OPT_IN
        : (useOpenHoleSource ? SOURCE_POLICY_MODE_OPEN_HOLE_OPT_IN : SOURCE_POLICY_MODE_MARKER_DEFAULT);

    return {
        sourceNodeIds,
        sourceEntities,
        sourcePolicy: {
            mode: fallbackSourcePolicyMode,
            markerDerived: true,
            illustrativeFluidDerived: useIllustrativeFluidSource,
            openHoleDerived: useOpenHoleSource,
            explicitScenarioDerived: false
        },
        validationWarnings: warnings
    };
}

export function shouldUseIllustrativeFluidSource(stateSnapshot = {}) {
    return stateSnapshot?.config?.[TOPOLOGY_CONFIG_USE_ILLUSTRATIVE_FLUID_SOURCE] === true;
}

export function shouldUseOpenHoleSource(stateSnapshot = {}) {
    return stateSnapshot?.config?.[TOPOLOGY_CONFIG_USE_OPEN_HOLE_SOURCE] === true;
}

export default {
    normalizeStateSnapshot,
    buildFluidSourceNodes,
    buildOpenHoleSourceNodes,
    buildExplicitScenarioSourceNodes,
    resolveSourceChannels,
    shouldUseIllustrativeFluidSource,
    shouldUseOpenHoleSource
};
