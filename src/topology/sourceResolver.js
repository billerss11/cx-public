import { resolveAnnulusLayerByIndex, resolveFormationAnnulusLayer, resolveAnnulusSlotIndex } from '@/utils/physicsLayers.js';
import {
    MAX_MODELED_ANNULUS_SLOT_INDEX,
    MODELED_ANNULUS_VOLUME_SLOTS,
    NODE_KIND_FORMATION_ANNULUS,
    SOURCE_POLICY_MODE_SCENARIO_EXPLICIT,
    SOURCE_POLICY_MODE_FLUID_OPT_IN,
    SOURCE_POLICY_MODE_MARKER_DEFAULT,
    TOPOLOGY_CONFIG_USE_ILLUSTRATIVE_FLUID_SOURCE,
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
        MODELED_ANNULUS_VOLUME_SLOTS.forEach(({ kind, slotIndex }) => {
            const annulusLayer = resolveAnnulusLayerByIndex(stack, slotIndex);
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

        const nonModeledFluidLayers = stack.filter((layer) => {
            if (layer?.role !== 'annulus') return false;
            const material = String(layer?.material ?? '').trim().toLowerCase();
            if (material !== 'fluid') return false;
            const slotIndex = resolveAnnulusSlotIndex(layer);
            if (!Number.isInteger(slotIndex) || slotIndex <= MAX_MODELED_ANNULUS_SLOT_INDEX) return false;
            return layer?.isFormation !== true;
        });
        if (nonModeledFluidLayers.length > 0) {
            hasFluidOutsideModeledAnnuli = true;
        }
    });

    if (fluidRows.length > 0 && sourceNodeIds.size === 0) {
        validationWarnings.push(createTopologyValidationWarning(
            SOURCE_WARNING_FLUID_ROWS_WITHOUT_MODELED_SOURCE_NODES,
            'Fluid intervals exist, but none currently map to ANNULUS_A/ANNULUS_B/ANNULUS_C/ANNULUS_D/FORMATION_ANNULUS sources in the topology MVP.'
        ));
    }

    if (hasFluidOutsideModeledAnnuli) {
        validationWarnings.push(createTopologyValidationWarning(
            SOURCE_WARNING_FLUID_IN_UNMODELED_OUTER_ANNULUS,
            'Fluid detected in non-formation annulus volumes beyond ANNULUS_D; those outer annulus volumes are not modeled in this topology MVP.'
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
                'Scenario source row has an unsupported volume key. Use TUBING_INNER (legacy BORE), ANNULUS_A, ANNULUS_B, ANNULUS_C, ANNULUS_D, or FORMATION_ANNULUS for MVP.',
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
    radial,
    fluid,
    explicit
} = {}) {
    const warnings = [];

    if (explicit?.hasScenarioRows) {
        if ((explicit?.sourceNodeIds?.length ?? 0) === 0) {
            warnings.push(createTopologyValidationWarning(
                SOURCE_WARNING_SCENARIO_ROWS_WITH_NO_RESOLVED_NODES,
                'Scenario source rows are present, but no source nodes were resolved for this run.'
            ));
        }

        return {
            sourceNodeIds: toSafeArray(explicit?.sourceNodeIds),
            sourceEntities: toSafeArray(explicit?.sourceEntities),
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
    const sourceNodeIds = [...new Set([
        ...markerSourceNodeIds,
        ...illustrativeSourceNodeIds
    ])];

    const sourceEntities = [
        ...toSafeArray(radial?.sourceEntities),
        ...(useIllustrativeFluidSource ? toSafeArray(fluid?.sourceEntities) : [])
    ];

    return {
        sourceNodeIds,
        sourceEntities,
        sourcePolicy: {
            mode: useIllustrativeFluidSource ? SOURCE_POLICY_MODE_FLUID_OPT_IN : SOURCE_POLICY_MODE_MARKER_DEFAULT,
            markerDerived: true,
            illustrativeFluidDerived: useIllustrativeFluidSource,
            explicitScenarioDerived: false
        },
        validationWarnings: warnings
    };
}

export function shouldUseIllustrativeFluidSource(stateSnapshot = {}) {
    return stateSnapshot?.config?.[TOPOLOGY_CONFIG_USE_ILLUSTRATIVE_FLUID_SOURCE] === true;
}

export default {
    normalizeStateSnapshot,
    buildFluidSourceNodes,
    buildExplicitScenarioSourceNodes,
    resolveSourceChannels,
    shouldUseIllustrativeFluidSource
};
