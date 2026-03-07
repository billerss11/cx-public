import { parseOptionalNumber } from '@/utils/general.js';
import { resolveBoundaryEquipmentEffects } from '@/topology/equipmentRules.js';
import {
    EDGE_KIND_RADIAL,
    EDGE_KIND_TERMINATION,
    EDGE_KIND_VERTICAL,
    MODELED_ANNULUS_VOLUME_SLOTS,
    NODE_KIND_ANNULUS_A,
    NODE_KIND_BORE,
    NODE_KIND_FORMATION_ANNULUS,
    NODE_KIND_TUBING_ANNULUS,
    TOPOLOGY_EPSILON,
    TOPOLOGY_VOLUME_KINDS,
    SOURCE_KIND_LEAK,
    SOURCE_KIND_PERFORATION,
    SOURCE_KIND_SCENARIO,
    normalizeMarkerType,
    normalizeSourceType
} from '@/topology/topologyTypes.js';
import {
    TOPOLOGY_WARNING_CODES,
    createTopologyValidationWarning
} from '@/topology/warningCatalog.js';
import {
    isSourceRowVisible,
    resolveSourceDepthRange,
    intervalIntersectsSourceRange,
    isScenarioBreakoutRow,
    resolveScenarioBreakoutVolumePair
} from '@/topology/sourceRows.js';
import {
    buildPipeReferenceMap,
    normalizePipeHostType,
    PIPE_HOST_TYPE_CASING,
    PIPE_HOST_TYPE_TUBING,
    resolvePipeHostReference
} from '@/utils/pipeReference.js';
import {
    resolveBoundaryStructuralTransitionDefinitions,
    resolveStructuralTransitionState
} from '@/topology/structuralTransitions.js';

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

const RADIAL_WARNING_MARKER_INVALID_DEPTH_RANGE = TOPOLOGY_WARNING_CODES.MARKER_INVALID_DEPTH_RANGE;
const RADIAL_WARNING_MARKER_UNRESOLVED_HOST_REFERENCE = TOPOLOGY_WARNING_CODES.MARKER_UNRESOLVED_HOST_REFERENCE;
const RADIAL_WARNING_MARKER_NO_RESOLVABLE_INTERVAL_OVERLAP = TOPOLOGY_WARNING_CODES.MARKER_NO_RESOLVABLE_INTERVAL_OVERLAP;
const RADIAL_WARNING_MARKER_INVALID_TUBING_HOST_AT_DEPTH = TOPOLOGY_WARNING_CODES.MARKER_INVALID_TUBING_HOST_AT_DEPTH;
const SCENARIO_WARNING_BREAKOUT_MISSING_VOLUME_PAIR = TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_VOLUME_PAIR;
const SCENARIO_WARNING_BREAKOUT_UNSUPPORTED_VOLUME_PAIR = TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_UNSUPPORTED_VOLUME_PAIR;
const SCENARIO_WARNING_BREAKOUT_MISSING_DEPTH_RANGE = TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_DEPTH_RANGE;
const SCENARIO_WARNING_BREAKOUT_NO_RESOLVABLE_INTERVAL = TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_NO_RESOLVABLE_INTERVAL;

export function createEdgeId(kind, fromNodeId, toNodeId, suffix = '') {
    const safeSuffix = String(suffix ?? '').trim();
    return safeSuffix
        ? `edge:${kind}:${fromNodeId}->${toNodeId}:${safeSuffix}`
        : `edge:${kind}:${fromNodeId}->${toNodeId}`;
}

function appendEdge(edges, edgeReasons, edge) {
    edges.push(edge);
    edgeReasons[edge.edgeId] = edge.reason;
}

function resolveBoundaryEquipmentEffectByVolumeKind(volumeKind, equipmentEffects = {}) {
    const byVolume = equipmentEffects?.byVolume && typeof equipmentEffects.byVolume === 'object'
        ? equipmentEffects.byVolume
        : {};
    return byVolume[volumeKind] ?? null;
}

function createStructuralTransitionWarning(definition, boundaryDepth) {
    const fromVolumeKey = String(definition?.fromNode?.kind ?? '').trim();
    const toVolumeKey = String(definition?.toNode?.kind ?? '').trim();
    const warningCode = String(definition?.warningCode ?? '').trim()
        || TOPOLOGY_WARNING_CODES.STRUCTURAL_TRANSITION_NOT_MODELED;
    const warningMessage = String(definition?.warningSummary ?? '').trim()
        || `Structural transition ${fromVolumeKey} -> ${toVolumeKey} is detected but not yet modeled as an explicit topology edge.`;

    return createTopologyValidationWarning(
        warningCode,
        warningMessage,
        {
            depth: Number.isFinite(boundaryDepth) ? boundaryDepth : null
        }
    );
}

function appendStructuralTransitionEdges({
    edges,
    edgeReasons,
    validationWarnings,
    currentInterval,
    nextInterval,
    intervalNodeByKind,
    boundaryDepth,
    equipmentEffects
}) {
    const transitionDefinitions = resolveBoundaryStructuralTransitionDefinitions({
        currentInterval,
        nextInterval,
        intervalNodeByKind
    });

    transitionDefinitions.forEach((definition) => {
        if (definition?.emitsEdge === false) {
            validationWarnings.push(createStructuralTransitionWarning(definition, boundaryDepth));
            return;
        }

        const transitionState = resolveStructuralTransitionState(definition, equipmentEffects);
        const blocked = transitionState.blockedByMaterial || transitionState.blockedByEquipment;
        const transitionRuleId = String(definition?.ruleId ?? 'structural-transition').trim();
        const transitionType = String(definition?.transitionType ?? 'unknown').trim();
        const edgeSuffix = String(definition?.edgeSuffix ?? '').trim()
            || `${transitionRuleId}:${transitionType || 'unknown'}`;
        const edgeId = createEdgeId(
            EDGE_KIND_VERTICAL,
            definition.fromNode.nodeId,
            definition.toNode.nodeId,
            edgeSuffix
        );
        appendEdge(edges, edgeReasons, {
            edgeId,
            from: definition.fromNode.nodeId,
            to: definition.toNode.nodeId,
            kind: EDGE_KIND_VERTICAL,
            cost: transitionState.cost,
            state: blocked ? 'closed_failable' : 'open',
            meta: {
                volumeKey: definition?.primaryVolumeKind ?? null,
                fromVolumeKey: definition.fromNode.kind,
                toVolumeKey: definition.toNode.kind,
                transitionType,
                transitionRuleId
            },
            reason: {
                ruleId: transitionRuleId,
                summary: blocked
                    ? String(definition?.summaryWhenBlocked ?? '').trim()
                    : String(definition?.summaryWhenOpen ?? '').trim(),
                details: {
                    fromInterval: currentInterval.intervalIndex,
                    toInterval: nextInterval.intervalIndex,
                    boundaryDepth: Number.isFinite(boundaryDepth) ? boundaryDepth : null,
                    fromVolumeKey: definition.fromNode.kind,
                    toVolumeKey: definition.toNode.kind,
                    transitionType,
                    blockedByMaterial: transitionState.blockedByMaterial,
                    blockedByEquipment: transitionState.blockedByEquipment,
                    equipmentContributors: transitionState.equipmentContributors
                }
            }
        });
    });
}

export function buildVerticalEdges(intervals, intervalNodeByKind, equipmentRows = [], options = {}) {
    const edges = [];
    const edgeReasons = {};
    const validationWarnings = [];

    for (let index = 0; index < intervals.length - 1; index += 1) {
        const currentInterval = intervals[index];
        const nextInterval = intervals[index + 1];
        const boundaryDepth = Number(nextInterval?.top);
        const equipmentEffects = resolveBoundaryEquipmentEffects(boundaryDepth, equipmentRows, {
            epsilon: TOPOLOGY_EPSILON,
            casingRows: options?.casingRows,
            tubingRows: options?.tubingRows
        });
        validationWarnings.push(...toSafeArray(equipmentEffects?.validationWarnings));

        TOPOLOGY_VOLUME_KINDS.forEach((kind) => {
            const fromNode = intervalNodeByKind.get(`${currentInterval.intervalIndex}|${kind}`) ?? null;
            const toNode = intervalNodeByKind.get(`${nextInterval.intervalIndex}|${kind}`) ?? null;
            if (!fromNode || !toNode) return;

            const blockedByMaterial = fromNode?.meta?.isBlocked === true || toNode?.meta?.isBlocked === true;
            const equipmentEffect = resolveBoundaryEquipmentEffectByVolumeKind(kind, equipmentEffects);
            const blockedByEquipment = equipmentEffect?.blocked === true;
            const blocked = blockedByMaterial || blockedByEquipment;
            const cost = blocked
                ? Math.max(blockedByMaterial ? 1 : 0, Number(equipmentEffect?.cost ?? 0), 1)
                : 0;
            const edgeId = createEdgeId(EDGE_KIND_VERTICAL, fromNode.nodeId, toNode.nodeId, kind);
            appendEdge(edges, edgeReasons, {
                edgeId,
                from: fromNode.nodeId,
                to: toNode.nodeId,
                kind: EDGE_KIND_VERTICAL,
                cost,
                state: blocked ? 'closed_failable' : 'open',
                meta: {
                    volumeKey: kind
                },
                reason: {
                    ruleId: 'vertical-continuity',
                    summary: blocked
                        ? `Vertical continuity for ${kind} is blocked by interval content or equipment seal behavior.`
                        : `Vertical continuity for ${kind} is open.`,
                    details: {
                        fromInterval: currentInterval.intervalIndex,
                        toInterval: nextInterval.intervalIndex,
                        volumeKey: kind,
                        boundaryDepth: Number.isFinite(boundaryDepth) ? boundaryDepth : null,
                        blockedByMaterial,
                        blockedByEquipment,
                        equipmentContributors: toSafeArray(equipmentEffect?.contributors)
                    }
                }
            });
        });

        appendStructuralTransitionEdges({
            edges,
            edgeReasons,
            validationWarnings,
            currentInterval,
            nextInterval,
            intervalNodeByKind,
            boundaryDepth,
            equipmentEffects
        });
    }

    return { edges, edgeReasons, validationWarnings };
}

function intervalsOverlap(range, interval) {
    if (!range || !interval) return false;
    return range.bottom > interval.top + TOPOLOGY_EPSILON && range.top < interval.bottom - TOPOLOGY_EPSILON;
}

function isPointDepthRange(range) {
    if (!range) return false;
    const top = Number(range.top);
    const bottom = Number(range.bottom);
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) return false;
    return Math.abs(bottom - top) <= TOPOLOGY_EPSILON;
}

function pointRangeIntersectsInterval(range, interval) {
    if (!range || !interval) return false;
    const depth = Number(range.top);
    const intervalTop = Number(interval.top);
    const intervalBottom = Number(interval.bottom);
    if (!Number.isFinite(depth) || !Number.isFinite(intervalTop) || !Number.isFinite(intervalBottom)) return false;
    return depth >= intervalTop - TOPOLOGY_EPSILON && depth <= intervalBottom + TOPOLOGY_EPSILON;
}

function markerRangeIntersectsInterval(range, interval) {
    if (isPointDepthRange(range)) {
        return pointRangeIntersectsInterval(range, interval);
    }
    return intervalsOverlap(range, interval);
}

function rangeOverlapsHostRange(range, hostRange) {
    if (!range || !hostRange) return false;
    const rangeTop = Number(range?.top);
    const rangeBottom = Number(range?.bottom);
    const hostTop = Number(hostRange?.top);
    const hostBottom = Number(hostRange?.bottom);
    if (!Number.isFinite(rangeTop) || !Number.isFinite(rangeBottom) || !Number.isFinite(hostTop) || !Number.isFinite(hostBottom)) {
        return false;
    }
    if (hostBottom < hostTop || rangeBottom < rangeTop) return false;

    if (Math.abs(rangeBottom - rangeTop) <= TOPOLOGY_EPSILON) {
        return rangeTop >= hostTop - TOPOLOGY_EPSILON && rangeTop <= hostBottom + TOPOLOGY_EPSILON;
    }

    return rangeBottom > hostTop + TOPOLOGY_EPSILON && rangeTop < hostBottom - TOPOLOGY_EPSILON;
}

function normalizeRowIdToken(value) {
    const token = String(value ?? '').trim();
    return token || null;
}

function isBlockedVolumeNode(node) {
    return node?.meta?.isBlocked === true;
}

function resolveMarkerHostReference({ attachToRow, attachToId, attachToHostType, pipeReferenceMap }) {
    const referenceToken = String(attachToRow ?? '').trim();
    const idToken = String(attachToId ?? '').trim();
    if (referenceToken) {
        const byReference = resolvePipeHostReference(referenceToken, pipeReferenceMap, {
            preferredId: null,
            hostType: attachToHostType
        });
        if (byReference) return byReference;
    }

    if (!idToken) return null;
    return resolvePipeHostReference('', pipeReferenceMap, {
        preferredId: idToken,
        hostType: attachToHostType
    });
}

function rowOverlapsInterval(row, interval) {
    const rowTop = Number(row?.top);
    const rowBottom = Number(row?.bottom);
    const intervalTop = Number(interval?.top);
    const intervalBottom = Number(interval?.bottom);
    if (!Number.isFinite(rowTop) || !Number.isFinite(rowBottom)) return false;
    if (!Number.isFinite(intervalTop) || !Number.isFinite(intervalBottom)) return false;
    if (rowBottom < rowTop || intervalBottom < intervalTop) return false;
    return rowBottom > intervalTop + TOPOLOGY_EPSILON && rowTop < intervalBottom - TOPOLOGY_EPSILON;
}

function sortCasingRowsInnerToOuter(leftRow, rightRow) {
    const leftOd = Number(leftRow?.od);
    const rightOd = Number(rightRow?.od);
    if (Number.isFinite(leftOd) && Number.isFinite(rightOd) && leftOd !== rightOd) {
        return leftOd - rightOd;
    }

    const leftTop = Number(leftRow?.top);
    const rightTop = Number(rightRow?.top);
    if (Number.isFinite(leftTop) && Number.isFinite(rightTop) && leftTop !== rightTop) {
        return leftTop - rightTop;
    }

    const leftBottom = Number(leftRow?.bottom);
    const rightBottom = Number(rightRow?.bottom);
    if (Number.isFinite(leftBottom) && Number.isFinite(rightBottom) && leftBottom !== rightBottom) {
        return rightBottom - leftBottom;
    }

    return String(leftRow?.rowId ?? '').localeCompare(String(rightRow?.rowId ?? ''));
}

function resolveModeledAnnulusKindBySlotIndex(slotIndex) {
    if (!Number.isInteger(slotIndex)) return null;
    const modeledSlot = MODELED_ANNULUS_VOLUME_SLOTS.find((candidate) => candidate.slotIndex === slotIndex);
    return modeledSlot?.kind ?? null;
}

function resolveVolumeKindForCasingBoundarySlot(slotIndex) {
    const annulusKind = resolveModeledAnnulusKindBySlotIndex(slotIndex);
    if (annulusKind) return annulusKind;
    if (Number.isInteger(slotIndex) && slotIndex >= MODELED_ANNULUS_VOLUME_SLOTS.length) {
        return NODE_KIND_FORMATION_ANNULUS;
    }
    return null;
}

function createDefaultRadialVolumePair(intervalNodeByKind, interval) {
    const tubingAnnulusNode = resolveIntervalNodeByVolumeKind(
        intervalNodeByKind,
        interval,
        NODE_KIND_TUBING_ANNULUS
    );
    if (tubingAnnulusNode) {
        return {
            innerVolumeKind: NODE_KIND_BORE,
            outerVolumeKind: NODE_KIND_TUBING_ANNULUS,
            pairSource: 'default_tubing_inner_tubing_annulus',
            hostCasingIndex: null
        };
    }

    return {
        innerVolumeKind: NODE_KIND_BORE,
        outerVolumeKind: NODE_KIND_ANNULUS_A,
        pairSource: 'default_bore_annulus_a',
        hostCasingIndex: null
    };
}

function resolveCasingHostRadialVolumePair(interval, resolvedHost, pipeReferenceMap, intervalNodeByKind) {
    if (resolvedHost?.hostType !== PIPE_HOST_TYPE_CASING) return null;
    const casingRows = toSafeArray(pipeReferenceMap?.rowsByHostType?.[PIPE_HOST_TYPE_CASING]);
    const activeCasingRows = casingRows
        .filter((row) => rowOverlapsInterval(row, interval))
        .sort(sortCasingRowsInnerToOuter);

    const hostRowId = normalizeRowIdToken(resolvedHost?.row?.rowId);
    let hostCasingIndex = activeCasingRows.findIndex((row) => normalizeRowIdToken(row?.rowId) === hostRowId);
    if (hostCasingIndex < 0) {
        hostCasingIndex = activeCasingRows.findIndex((row) => row === resolvedHost?.row);
    }
    if (hostCasingIndex < 0) return null;

    const tubingAnnulusNode = resolveIntervalNodeByVolumeKind(
        intervalNodeByKind,
        interval,
        NODE_KIND_TUBING_ANNULUS
    );
    const innerVolumeKind = hostCasingIndex === 0
        ? (tubingAnnulusNode ? NODE_KIND_TUBING_ANNULUS : NODE_KIND_BORE)
        : resolveVolumeKindForCasingBoundarySlot(hostCasingIndex - 1);
    const outerVolumeKind = resolveVolumeKindForCasingBoundarySlot(hostCasingIndex);
    if (!innerVolumeKind || !outerVolumeKind || innerVolumeKind === outerVolumeKind) {
        return null;
    }

    return {
        innerVolumeKind,
        outerVolumeKind,
        pairSource: 'casing_host_adjacent_annuli',
        hostCasingIndex
    };
}

function resolveIntervalNodeByVolumeKind(intervalNodeByKind, interval, volumeKind) {
    return intervalNodeByKind.get(`${interval.intervalIndex}|${volumeKind}`) ?? null;
}

export function buildRadialEdges(stateSnapshot, intervals, intervalNodeByKind, physicsContext) {
    const edges = [];
    const edgeReasons = {};
    const sourceNodeIds = new Set();
    const sourceEntities = [];
    const validationWarnings = [];
    const markers = toSafeArray(stateSnapshot?.markers);
    const pipeReferenceMap = buildPipeReferenceMap(
        physicsContext?.casingRows,
        physicsContext?.tubingRows
    );

    markers.forEach((marker, markerIndex) => {
        if (marker?.show === false) return;

        const markerType = normalizeMarkerType(marker?.type);
        if (!markerType) return;
        const markerCreatesSource = markerType === SOURCE_KIND_PERFORATION;

        const top = parseOptionalNumber(marker?.top);
        const bottom = parseOptionalNumber(marker?.bottom);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom < top) {
            validationWarnings.push(createTopologyValidationWarning(
                RADIAL_WARNING_MARKER_INVALID_DEPTH_RANGE,
                'Marker depth range is invalid for topology radial edge generation.',
                {
                    rowId: String(marker?.rowId ?? '').trim() || undefined,
                    depth: Number.isFinite(top) ? top : null
                }
            ));
            return;
        }

        const attachToId = String(marker?.attachToId ?? '').trim();
        const attachToRow = String(marker?.attachToRow ?? '').trim();
        const attachToHostType = normalizePipeHostType(marker?.attachToHostType, PIPE_HOST_TYPE_CASING);
        const resolvedHost = (attachToId || attachToRow)
            ? resolveMarkerHostReference({
                attachToRow,
                attachToId,
                attachToHostType,
                pipeReferenceMap
            })
            : null;
        if (attachToId || attachToRow) {
            if (!resolvedHost) {
                validationWarnings.push(createTopologyValidationWarning(
                    RADIAL_WARNING_MARKER_UNRESOLVED_HOST_REFERENCE,
                    'Marker host reference could not be resolved.',
                    {
                        rowId: String(marker?.rowId ?? '').trim() || undefined,
                        depth: top
                    }
                ));
                return;
            }
        }

        const markerRange = { top, bottom };
        const tubingHostLeak = markerType === SOURCE_KIND_LEAK && attachToHostType === PIPE_HOST_TYPE_TUBING;
        const hostDepthRange = {
            top: Number(resolvedHost?.row?.top),
            bottom: Number(resolvedHost?.row?.bottom)
        };
        if (tubingHostLeak) {
            const hostOverlapsMarker = rangeOverlapsHostRange(markerRange, hostDepthRange);
            if (!hostOverlapsMarker) {
                validationWarnings.push(createTopologyValidationWarning(
                    RADIAL_WARNING_MARKER_INVALID_TUBING_HOST_AT_DEPTH,
                    'Tubing-host leak marker does not overlap the selected tubing row at marker depth.',
                    {
                        rowId: String(marker?.rowId ?? '').trim() || undefined,
                        depth: top
                    }
                ));
                return;
            }
        }

        let connectedIntervalCount = 0;
        const markerSourceNodeIds = new Set();
        const markerVolumePairs = new Set();
        intervals.forEach((interval) => {
            if (!markerRangeIntersectsInterval(markerRange, interval)) return;
            if (tubingHostLeak && !intervalsOverlap(hostDepthRange, interval)) return;

            const fallbackVolumePair = createDefaultRadialVolumePair(intervalNodeByKind, interval);
            const casingHostVolumePair = resolveCasingHostRadialVolumePair(
                interval,
                resolvedHost,
                pipeReferenceMap,
                intervalNodeByKind
            );
            let radialVolumePair = tubingHostLeak
                ? fallbackVolumePair
                : (casingHostVolumePair ?? fallbackVolumePair);
            let innerNode = intervalNodeByKind.get(
                `${interval.intervalIndex}|${radialVolumePair.innerVolumeKind}`
            ) ?? null;
            let outerNode = intervalNodeByKind.get(
                `${interval.intervalIndex}|${radialVolumePair.outerVolumeKind}`
            ) ?? null;
            if ((!innerNode || !outerNode) && !tubingHostLeak) {
                radialVolumePair = fallbackVolumePair;
                innerNode = intervalNodeByKind.get(
                    `${interval.intervalIndex}|${radialVolumePair.innerVolumeKind}`
                ) ?? null;
                outerNode = intervalNodeByKind.get(
                    `${interval.intervalIndex}|${radialVolumePair.outerVolumeKind}`
                ) ?? null;
            }
            if (!innerNode || !outerNode) return;

            const blockedByMaterial = isBlockedVolumeNode(innerNode) || isBlockedVolumeNode(outerNode);
            const edgeCost = blockedByMaterial ? 1 : 0;
            const edgeState = blockedByMaterial ? 'closed_failable' : 'open';

            const edgeId = createEdgeId(
                EDGE_KIND_RADIAL,
                innerNode.nodeId,
                outerNode.nodeId,
                `${markerIndex}:${interval.intervalIndex}:${markerType}`
            );
            const radialSummary = tubingHostLeak
                ? 'Tubing-host leak marker creates a radial communication path where tubing exists.'
                : radialVolumePair.pairSource === 'casing_host_adjacent_annuli'
                    ? 'Casing-host marker creates a radial communication path across adjacent annulus volumes.'
                    : `${markerType} marker creates a radial communication path.`;
            const summary = blockedByMaterial
                ? `${radialSummary} The path is currently blocked by interval material content.`
                : radialSummary;

            appendEdge(edges, edgeReasons, {
                edgeId,
                from: innerNode.nodeId,
                to: outerNode.nodeId,
                kind: EDGE_KIND_RADIAL,
                cost: edgeCost,
                state: edgeState,
                meta: {
                    markerIndex,
                    markerRowId: String(marker?.rowId ?? '').trim() || null,
                    markerType,
                    markerHostType: attachToHostType,
                    markerHostRowId: String(resolvedHost?.row?.rowId ?? '').trim() || null,
                    fromVolumeKey: radialVolumePair.innerVolumeKind,
                    toVolumeKey: radialVolumePair.outerVolumeKind,
                    radialPairSource: radialVolumePair.pairSource,
                    markerHostCasingIndex: Number.isInteger(radialVolumePair.hostCasingIndex)
                        ? radialVolumePair.hostCasingIndex
                        : null
                },
                reason: {
                    ruleId: `marker-${markerType}`,
                    summary,
                    details: {
                        markerIndex,
                        intervalIndex: interval.intervalIndex,
                        markerHostType: attachToHostType,
                        markerHostRowId: String(resolvedHost?.row?.rowId ?? '').trim() || null,
                        fromVolumeKey: radialVolumePair.innerVolumeKind,
                        toVolumeKey: radialVolumePair.outerVolumeKind,
                        radialPairSource: radialVolumePair.pairSource,
                        blockedByMaterial
                    }
                }
            });

            connectedIntervalCount += 1;
            if (markerCreatesSource) {
                [innerNode, outerNode]
                    .filter((node) => !isBlockedVolumeNode(node))
                    .forEach((node) => {
                        sourceNodeIds.add(node.nodeId);
                        markerSourceNodeIds.add(node.nodeId);
                    });
            }
            markerVolumePairs.add(`${radialVolumePair.innerVolumeKind}+${radialVolumePair.outerVolumeKind}`);
        });

        if (connectedIntervalCount === 0) {
            validationWarnings.push(createTopologyValidationWarning(
                RADIAL_WARNING_MARKER_NO_RESOLVABLE_INTERVAL_OVERLAP,
                'Marker does not intersect a resolvable topology radial volume pair.',
                {
                    rowId: String(marker?.rowId ?? '').trim() || undefined,
                    depth: top
                }
            ));
            return;
        }

        if (!markerCreatesSource) return;
        if (markerSourceNodeIds.size === 0) return;

        sourceEntities.push({
            sourceId: `source:marker:${String(marker?.rowId ?? markerIndex)}`,
            sourceType: SOURCE_KIND_PERFORATION,
            volumeKey: markerVolumePairs.size === 1
                ? [...markerVolumePairs][0]
                : [...markerVolumePairs].sort((left, right) => left.localeCompare(right)).join('|'),
            depthTop: top,
            depthBottom: bottom,
            rowId: String(marker?.rowId ?? '').trim() || null,
            origin: 'marker',
            nodeIds: [...markerSourceNodeIds]
        });
    });

    return {
        edges,
        edgeReasons,
        sourceNodeIds: [...sourceNodeIds],
        sourceEntities,
        validationWarnings
    };
}

export function buildScenarioRadialEdges(stateSnapshot, intervals, intervalNodeByKind) {
    const edges = [];
    const edgeReasons = {};
    const validationWarnings = [];
    const scenarioRows = toSafeArray(stateSnapshot?.topologySources)
        .filter(isSourceRowVisible)
        .filter(isScenarioBreakoutRow);

    scenarioRows.forEach((sourceRow, sourceIndex) => {
        const rowId = String(sourceRow?.rowId ?? '').trim() || null;
        const breakoutPair = resolveScenarioBreakoutVolumePair(sourceRow);
        if (!breakoutPair.fromVolumeKey || !breakoutPair.toVolumeKey) {
            validationWarnings.push(createTopologyValidationWarning(
                SCENARIO_WARNING_BREAKOUT_MISSING_VOLUME_PAIR,
                'Scenario breakout row must include both fromVolume and toVolume keys.',
                {
                    rowId: rowId || undefined
                }
            ));
            return;
        }

        const fromVolumeKind = breakoutPair.fromKind;
        const toVolumeKind = breakoutPair.toKind;
        if (!fromVolumeKind || !toVolumeKind || fromVolumeKind === toVolumeKind) {
            validationWarnings.push(createTopologyValidationWarning(
                SCENARIO_WARNING_BREAKOUT_UNSUPPORTED_VOLUME_PAIR,
                'Scenario breakout row has an unsupported volume pair for radial connectivity.',
                {
                    rowId: rowId || undefined
                }
            ));
            return;
        }

        const depthRange = resolveSourceDepthRange(sourceRow);
        if (!depthRange) {
            validationWarnings.push(createTopologyValidationWarning(
                SCENARIO_WARNING_BREAKOUT_MISSING_DEPTH_RANGE,
                'Scenario breakout row is missing a valid depth/depth range.',
                {
                    rowId: rowId || undefined
                }
            ));
            return;
        }

        const sourceType = normalizeSourceType(sourceRow?.sourceType ?? sourceRow?.type ?? sourceRow?.eventType)
            || SOURCE_KIND_SCENARIO;
        let connectedIntervalCount = 0;
        intervals.forEach((interval) => {
            if (!intervalIntersectsSourceRange(interval, depthRange)) return;
            const fromNode = resolveIntervalNodeByVolumeKind(intervalNodeByKind, interval, fromVolumeKind);
            const toNode = resolveIntervalNodeByVolumeKind(intervalNodeByKind, interval, toVolumeKind);
            if (!fromNode || !toNode) return;

            const edgeId = createEdgeId(
                EDGE_KIND_RADIAL,
                fromNode.nodeId,
                toNode.nodeId,
                `scenario-breakout:${sourceIndex}:${interval.intervalIndex}:${fromVolumeKind}:${toVolumeKind}`
            );
            appendEdge(edges, edgeReasons, {
                edgeId,
                from: fromNode.nodeId,
                to: toNode.nodeId,
                kind: EDGE_KIND_RADIAL,
                cost: 0,
                state: 'open',
                meta: {
                    scenarioBreakoutRowId: rowId,
                    scenarioBreakoutSourceType: sourceType,
                    fromVolumeKey: fromVolumeKind,
                    toVolumeKey: toVolumeKind,
                    radialPairSource: 'scenario_cross_annulus_failure'
                },
                reason: {
                    ruleId: 'scenario-cross-annulus-failure',
                    summary: 'Scenario breakout row creates explicit cross-annulus radial connectivity.',
                    details: {
                        sourceIndex,
                        intervalIndex: interval.intervalIndex,
                        fromVolumeKey: fromVolumeKind,
                        toVolumeKey: toVolumeKind,
                        sourceType
                    }
                }
            });

            connectedIntervalCount += 1;
        });

        if (connectedIntervalCount === 0) {
            validationWarnings.push(createTopologyValidationWarning(
                SCENARIO_WARNING_BREAKOUT_NO_RESOLVABLE_INTERVAL,
                'Scenario breakout row does not intersect a resolvable interval with both configured volumes.',
                {
                    rowId: rowId || undefined,
                    depth: depthRange.top
                }
            ));
        }
    });

    return {
        edges,
        edgeReasons,
        validationWarnings
    };
}

export function buildTerminationEdges(intervals, intervalNodeByKind) {
    if (!Array.isArray(intervals) || intervals.length === 0) {
        return { edges: [], edgeReasons: {} };
    }

    const edges = [];
    const edgeReasons = {};
    const topInterval = intervals[0];
    const surfaceNodeId = 'node:SURFACE';

    TOPOLOGY_VOLUME_KINDS.forEach((kind) => {
        const sourceNode = intervalNodeByKind.get(`${topInterval.intervalIndex}|${kind}`) ?? null;
        if (!sourceNode) return;

        const edgeId = createEdgeId(EDGE_KIND_TERMINATION, sourceNode.nodeId, surfaceNodeId, kind);
        appendEdge(edges, edgeReasons, {
            edgeId,
            from: sourceNode.nodeId,
            to: surfaceNodeId,
            kind: EDGE_KIND_TERMINATION,
            cost: 0,
            state: 'open',
            meta: {
                volumeKey: kind
            },
            reason: {
                ruleId: 'surface-termination',
                summary: `${kind} top interval connects to surface sink.`,
                details: {
                    intervalIndex: topInterval.intervalIndex
                }
            }
        });
    });

    return { edges, edgeReasons };
}

export default {
    buildVerticalEdges,
    buildRadialEdges,
    buildScenarioRadialEdges,
    buildTerminationEdges,
    createEdgeId
};
