import {
    MODELED_CASING_ANNULUS_KINDS,
    NODE_KIND_FORMATION_ANNULUS,
    NODE_KIND_TUBING_ANNULUS,
    NODE_KIND_TUBING_INNER
} from '@/topology/topologyTypes.js';
import { TOPOLOGY_WARNING_CODES } from '@/topology/warningCatalog.js';

const STRUCTURAL_RULE_ID_TUBING_ANNULUS_TRANSITION = 'tubing-annulus-transition';
const STRUCTURAL_RULE_ID_TUBING_END_TRANSFER = 'tubing-end-transfer';
const STRUCTURAL_RULE_ID_ANNULUS_FAMILY_TRANSITION = 'annulus-family-transition';
const STRUCTURAL_WARNING_TRANSITION_NOT_MODELED = TOPOLOGY_WARNING_CODES.STRUCTURAL_TRANSITION_NOT_MODELED;
const STRUCTURAL_WARNING_TUBING_END_TRANSFER_UNRESOLVED = TOPOLOGY_WARNING_CODES.TUBING_END_TRANSFER_UNRESOLVED;
const INNERMOST_CASING_ANNULUS_KIND = MODELED_CASING_ANNULUS_KINDS[0] ?? 'ANNULUS_A';
const INNER_CHANNEL_TUBING = 'tubing_inner';
const INNER_CHANNEL_WELLBORE = 'wellbore_inner';

const ANNULUS_FAMILY_SEQUENCE = Object.freeze([
    ...MODELED_CASING_ANNULUS_KINDS,
    NODE_KIND_FORMATION_ANNULUS
]);

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

export function createAdjacentAnnulusFamilyPairKeys(sequence = []) {
    const normalizedSequence = toSafeArray(sequence)
        .map((kind) => String(kind ?? '').trim())
        .filter(Boolean);
    const pairKeys = new Set();
    for (let index = 0; index < normalizedSequence.length - 1; index += 1) {
        const innerKind = normalizedSequence[index];
        const outerKind = normalizedSequence[index + 1];
        if (innerKind === outerKind) continue;
        pairKeys.add(`${innerKind}|${outerKind}`);
    }
    return pairKeys;
}

function mergeAnnulusFamilyPairKeys(...pairKeySets) {
    const merged = new Set();
    pairKeySets.forEach((pairKeys) => {
        [...new Set(pairKeys ?? [])].forEach((pairKey) => {
            const token = String(pairKey ?? '').trim();
            if (!token) return;
            merged.add(token);
        });
    });
    return merged;
}

function createFormationCompatibilityPairKeys(sequence = []) {
    const normalizedSequence = toSafeArray(sequence)
        .map((kind) => String(kind ?? '').trim())
        .filter(Boolean);
    if (normalizedSequence.length < 2) return new Set();

    const formationKind = normalizedSequence[normalizedSequence.length - 1];
    const formationPairKeys = new Set();
    for (let index = 0; index < normalizedSequence.length - 1; index += 1) {
        const innerKind = normalizedSequence[index];
        if (innerKind === formationKind) continue;
        formationPairKeys.add(`${innerKind}|${formationKind}`);
    }
    return formationPairKeys;
}

const EDGE_ENABLED_ANNULUS_FAMILY_PAIR_KEYS = Object.freeze(
    mergeAnnulusFamilyPairKeys(
        createAdjacentAnnulusFamilyPairKeys(ANNULUS_FAMILY_SEQUENCE),
        createFormationCompatibilityPairKeys(ANNULUS_FAMILY_SEQUENCE)
    )
);

function resolveBoundaryEquipmentEffectByVolumeKind(volumeKind, equipmentEffects = {}) {
    const byVolume = equipmentEffects?.byVolume && typeof equipmentEffects.byVolume === 'object'
        ? equipmentEffects.byVolume
        : {};
    return byVolume[volumeKind] ?? null;
}

function resolveIntervalNode(intervalNodeByKind, interval, kind) {
    const intervalIndex = Number(interval?.intervalIndex);
    if (!Number.isInteger(intervalIndex)) return null;
    return intervalNodeByKind.get(`${intervalIndex}|${kind}`) ?? null;
}

function createTubingAnnulusTransitionDefinition(fromNode, toNode, transitionType) {
    return {
        ruleId: STRUCTURAL_RULE_ID_TUBING_ANNULUS_TRANSITION,
        transitionType,
        edgeSuffix: `${STRUCTURAL_RULE_ID_TUBING_ANNULUS_TRANSITION}:${transitionType}`,
        primaryVolumeKind: NODE_KIND_TUBING_ANNULUS,
        equipmentVolumeKinds: [
            NODE_KIND_TUBING_ANNULUS,
            INNERMOST_CASING_ANNULUS_KIND
        ],
        fromNode,
        toNode,
        summaryWhenBlocked: 'Tubing-annulus to Annulus A transition at tubing boundary is blocked by interval content or equipment seal behavior.',
        summaryWhenOpen: 'Tubing-annulus to Annulus A transition is open across tubing boundary.'
    };
}

function resolveInnerChannelToken(node = {}) {
    const token = String(node?.meta?.innerChannel ?? '').trim().toLowerCase();
    if (token === INNER_CHANNEL_TUBING) return INNER_CHANNEL_TUBING;
    return INNER_CHANNEL_WELLBORE;
}

function createTubingEndTransferTransitionDefinition(fromNode, toNode, transitionType) {
    const boundaryLabel = transitionType === 'tubing_end_transfer_entry'
        ? 'tubing-entry'
        : 'tubing-end';
    return {
        ruleId: STRUCTURAL_RULE_ID_TUBING_END_TRANSFER,
        transitionType,
        edgeSuffix: `${STRUCTURAL_RULE_ID_TUBING_END_TRANSFER}:${transitionType}`,
        primaryVolumeKind: NODE_KIND_TUBING_INNER,
        equipmentVolumeKinds: [
            NODE_KIND_TUBING_INNER,
            NODE_KIND_TUBING_ANNULUS,
            INNERMOST_CASING_ANNULUS_KIND
        ],
        fromNode,
        toNode,
        summaryWhenBlocked: `Tubing-end transfer ${fromNode.kind} -> ${toNode.kind} at ${boundaryLabel} boundary is blocked by interval content or equipment seal behavior.`,
        summaryWhenOpen: `Tubing-end transfer ${fromNode.kind} -> ${toNode.kind} is open across ${boundaryLabel} boundary.`
    };
}

function createTubingEndTransferUnresolvedContract(fromNode, toNode, transitionType) {
    return {
        ruleId: STRUCTURAL_RULE_ID_TUBING_END_TRANSFER,
        transitionType,
        fromNode,
        toNode,
        emitsEdge: false,
        warningCode: STRUCTURAL_WARNING_TUBING_END_TRANSFER_UNRESOLVED,
        warningSummary: `Tubing-end transfer ${transitionType} is detected at boundary depth, but required ${INNERMOST_CASING_ANNULUS_KIND} endpoint is not resolved for explicit transfer edge modeling.`
    };
}

function createAnnulusFamilyTransitionContract(fromNode, toNode, transitionType) {
    const isEntryTransition = transitionType === 'annulus_family_shift_entry';
    const innerKind = isEntryTransition ? fromNode?.kind : toNode?.kind;
    const outerKind = isEntryTransition ? toNode?.kind : fromNode?.kind;
    const pairKey = `${String(innerKind ?? '').trim()}|${String(outerKind ?? '').trim()}`;

    if (EDGE_ENABLED_ANNULUS_FAMILY_PAIR_KEYS.has(pairKey)) {
        return {
            ruleId: STRUCTURAL_RULE_ID_ANNULUS_FAMILY_TRANSITION,
            transitionType,
            edgeSuffix: `${STRUCTURAL_RULE_ID_ANNULUS_FAMILY_TRANSITION}:${pairKey}:${transitionType}`,
            primaryVolumeKind: isEntryTransition ? outerKind : innerKind,
            equipmentVolumeKinds: [innerKind, outerKind],
            fromNode,
            toNode,
            emitsEdge: true,
            summaryWhenBlocked: `Annulus-family transition ${fromNode.kind} -> ${toNode.kind} is blocked by interval content or equipment seal behavior.`,
            summaryWhenOpen: `Annulus-family transition ${fromNode.kind} -> ${toNode.kind} is open across structural boundary.`
        };
    }

    return {
        ruleId: STRUCTURAL_RULE_ID_ANNULUS_FAMILY_TRANSITION,
        transitionType,
        fromNode,
        toNode,
        emitsEdge: false,
        warningCode: STRUCTURAL_WARNING_TRANSITION_NOT_MODELED,
        warningSummary: `Annulus-family structural transition ${fromNode.kind} -> ${toNode.kind} is detected at boundary depth but is not yet modeled as an explicit topology edge.`
    };
}

function createIntervalAnnulusNodeByKind(intervalNodeByKind, interval) {
    const nodesByKind = new Map();
    ANNULUS_FAMILY_SEQUENCE.forEach((kind) => {
        const node = resolveIntervalNode(intervalNodeByKind, interval, kind);
        if (!node) return;
        nodesByKind.set(kind, node);
    });
    return nodesByKind;
}

function resolveAnnulusFamilyTransitionContracts(currentAnnulusNodesByKind, nextAnnulusNodesByKind) {
    const contracts = [];
    const contractKeySet = new Set();

    const appendContract = (definition) => {
        if (!definition?.fromNode?.kind || !definition?.toNode?.kind || !definition?.transitionType) return;
        const contractKey = `${definition.fromNode.kind}|${definition.toNode.kind}|${definition.transitionType}`;
        if (contractKeySet.has(contractKey)) return;
        contractKeySet.add(contractKey);
        contracts.push(definition);
    };

    const isIntermediateOuterKindsAbsentAcrossBoundary = (innerIndex, outerIndex) => {
        for (let index = innerIndex + 1; index < outerIndex; index += 1) {
            const intermediateKind = ANNULUS_FAMILY_SEQUENCE[index];
            if (currentAnnulusNodesByKind.get(intermediateKind) || nextAnnulusNodesByKind.get(intermediateKind)) {
                return false;
            }
        }
        return true;
    };

    for (let innerIndex = 0; innerIndex < ANNULUS_FAMILY_SEQUENCE.length - 1; innerIndex += 1) {
        const innerKind = ANNULUS_FAMILY_SEQUENCE[innerIndex];
        const currentInnerNode = currentAnnulusNodesByKind.get(innerKind) ?? null;
        const nextInnerNode = nextAnnulusNodesByKind.get(innerKind) ?? null;
        if (!currentInnerNode || !nextInnerNode) continue;

        for (let outerIndex = innerIndex + 1; outerIndex < ANNULUS_FAMILY_SEQUENCE.length; outerIndex += 1) {
            if (!isIntermediateOuterKindsAbsentAcrossBoundary(innerIndex, outerIndex)) continue;

            const outerKind = ANNULUS_FAMILY_SEQUENCE[outerIndex];
            const currentOuterNode = currentAnnulusNodesByKind.get(outerKind) ?? null;
            const nextOuterNode = nextAnnulusNodesByKind.get(outerKind) ?? null;

            if (!currentOuterNode && nextOuterNode) {
                appendContract(createAnnulusFamilyTransitionContract(
                    currentInnerNode,
                    nextOuterNode,
                    'annulus_family_shift_entry'
                ));
            }

            if (currentOuterNode && !nextOuterNode) {
                appendContract(createAnnulusFamilyTransitionContract(
                    currentOuterNode,
                    nextInnerNode,
                    'annulus_family_shift_exit'
                ));
            }
        }
    }

    return contracts;
}

export function resolveBoundaryStructuralTransitionDefinitions({
    currentInterval,
    nextInterval,
    intervalNodeByKind
}) {
    const currentTubingInnerNode = resolveIntervalNode(
        intervalNodeByKind,
        currentInterval,
        NODE_KIND_TUBING_INNER
    );
    const nextTubingInnerNode = resolveIntervalNode(
        intervalNodeByKind,
        nextInterval,
        NODE_KIND_TUBING_INNER
    );
    const currentTubingAnnulusNode = resolveIntervalNode(
        intervalNodeByKind,
        currentInterval,
        NODE_KIND_TUBING_ANNULUS
    );
    const nextTubingAnnulusNode = resolveIntervalNode(
        intervalNodeByKind,
        nextInterval,
        NODE_KIND_TUBING_ANNULUS
    );
    const currentAnnulusANode = resolveIntervalNode(
        intervalNodeByKind,
        currentInterval,
        INNERMOST_CASING_ANNULUS_KIND
    );
    const nextAnnulusANode = resolveIntervalNode(
        intervalNodeByKind,
        nextInterval,
        INNERMOST_CASING_ANNULUS_KIND
    );

    const transitionDefinitions = [];

    if (currentAnnulusANode && !currentTubingAnnulusNode && nextTubingAnnulusNode) {
        transitionDefinitions.push(
            createTubingAnnulusTransitionDefinition(
                currentAnnulusANode,
                nextTubingAnnulusNode,
                'tubing_annulus_entry'
            )
        );
    }

    if (currentTubingAnnulusNode && !nextTubingAnnulusNode && nextAnnulusANode) {
        transitionDefinitions.push(
            createTubingAnnulusTransitionDefinition(
                currentTubingAnnulusNode,
                nextAnnulusANode,
                'tubing_annulus_exit'
            )
        );
    }

    const currentInnerChannel = resolveInnerChannelToken(currentTubingInnerNode);
    const nextInnerChannel = resolveInnerChannelToken(nextTubingInnerNode);
    const innerChannelShiftsAtBoundary = Boolean(currentTubingInnerNode && nextTubingInnerNode)
        && currentInnerChannel !== nextInnerChannel;
    if (innerChannelShiftsAtBoundary) {
        const shiftsIntoTubing = currentInnerChannel === INNER_CHANNEL_WELLBORE
            && nextInnerChannel === INNER_CHANNEL_TUBING
            && !currentTubingAnnulusNode
            && Boolean(nextTubingAnnulusNode);
        if (shiftsIntoTubing) {
            if (currentAnnulusANode) {
                transitionDefinitions.push(
                    createTubingEndTransferTransitionDefinition(
                        currentAnnulusANode,
                        nextTubingInnerNode,
                        'tubing_end_transfer_entry'
                    )
                );
            } else {
                transitionDefinitions.push(
                    createTubingEndTransferUnresolvedContract(
                        currentTubingInnerNode,
                        nextTubingInnerNode,
                        'tubing_end_transfer_entry'
                    )
                );
            }
        }

        const shiftsOutOfTubing = currentInnerChannel === INNER_CHANNEL_TUBING
            && nextInnerChannel === INNER_CHANNEL_WELLBORE
            && Boolean(currentTubingAnnulusNode)
            && !nextTubingAnnulusNode;
        if (shiftsOutOfTubing) {
            transitionDefinitions.push(
                createTubingEndTransferTransitionDefinition(
                    currentTubingInnerNode,
                    currentTubingAnnulusNode,
                    'tubing_end_transfer_exit'
                )
            );

            if (nextAnnulusANode) {
                transitionDefinitions.push(
                    createTubingEndTransferTransitionDefinition(
                        currentTubingInnerNode,
                        nextAnnulusANode,
                        'tubing_end_transfer_exit'
                    )
                );
            } else {
                transitionDefinitions.push(
                    createTubingEndTransferUnresolvedContract(
                        currentTubingInnerNode,
                        nextTubingInnerNode,
                        'tubing_end_transfer_exit'
                    )
                );
            }
        }
    }

    const currentAnnulusNodesByKind = createIntervalAnnulusNodeByKind(
        intervalNodeByKind,
        currentInterval
    );
    const nextAnnulusNodesByKind = createIntervalAnnulusNodeByKind(
        intervalNodeByKind,
        nextInterval
    );
    transitionDefinitions.push(
        ...resolveAnnulusFamilyTransitionContracts(
            currentAnnulusNodesByKind,
            nextAnnulusNodesByKind
        )
    );

    return transitionDefinitions;
}

export function resolveStructuralTransitionState(definition = {}, equipmentEffects = {}) {
    const blockedByMaterial = definition?.fromNode?.meta?.isBlocked === true
        || definition?.toNode?.meta?.isBlocked === true;

    const equipmentVolumeKinds = toSafeArray(definition?.equipmentVolumeKinds);
    const equipmentEffectsByVolume = equipmentVolumeKinds.map((volumeKind) => (
        resolveBoundaryEquipmentEffectByVolumeKind(volumeKind, equipmentEffects)
    ));
    const blockedByEquipment = equipmentEffectsByVolume.some((effect) => effect?.blocked === true);
    const equipmentContributors = equipmentEffectsByVolume.flatMap((effect) => (
        toSafeArray(effect?.contributors)
    ));
    const maxEquipmentCost = equipmentEffectsByVolume.reduce((maxCost, effect) => (
        Math.max(maxCost, Number(effect?.cost ?? 0))
    ), 0);

    const blocked = blockedByMaterial || blockedByEquipment;
    const cost = blocked
        ? Math.max(blockedByMaterial ? 1 : 0, maxEquipmentCost, 1)
        : 0;

    return {
        blockedByMaterial,
        blockedByEquipment,
        cost,
        equipmentContributors
    };
}

export default {
    createAdjacentAnnulusFamilyPairKeys,
    resolveBoundaryStructuralTransitionDefinitions,
    resolveStructuralTransitionState
};
