import { estimateCasingID, parseOptionalNumber } from '@/utils/general.js';
import { normalizeHatchStyle, normalizeLinerMode, normalizeMarkerType, isOpenHoleRow } from '@/app/domain.js';
import {
    buildCasingReferenceMap,
    resolveCasingReference as resolveCasingReferenceByIdOrLegacy
} from '@/utils/casingReference.js';
import { normalizeRowId } from '@/utils/rowIdentity.js';
import {
    buildPipeReferenceMap,
    PIPE_HOST_TYPE_TUBING,
    resolvePipeHostReference
} from '@/utils/pipeReference.js';
import { isPackerEquipmentType, normalizeEquipmentAttachHostType } from '@/utils/equipmentAttachReference.js';
import {
    FLUID_PLACEMENT_AUTO_OPTIONS,
    FLUID_PLACEMENT_DEFAULT_OPTION,
    PHYSICS_CONSTANTS
} from '@/constants/index.js';

const defaultPhysicsState = Object.freeze({
    casingData: Object.freeze([]),
    tubingData: Object.freeze([]),
    drillStringData: Object.freeze([]),
    equipmentData: Object.freeze([]),
    horizontalLines: Object.freeze([]),
    annotationBoxes: Object.freeze([]),
    cementPlugs: Object.freeze([]),
    annulusFluids: Object.freeze([]),
    markers: Object.freeze([]),
    trajectory: Object.freeze([]),
    config: Object.freeze({}),
    interaction: Object.freeze({})
});

const EPSILON = 1e-6;
const BOUNDARY_TOLERANCE = PHYSICS_CONSTANTS.CONNECTION_BOUNDARY_TOLERANCE;
const OPERATION_PHASE_DRILLING = 'drilling';
const OPERATION_PHASE_PRODUCTION = 'production';
const PIPE_TYPE_CASING = 'casing';
const PIPE_TYPE_TUBING = 'tubing';
const PIPE_TYPE_DRILL_STRING = 'drillString';
const EQUIPMENT_WARNING_MISSING_ATTACH_TARGET = 'equipment_missing_attach_target';
const EQUIPMENT_WARNING_UNRESOLVED_ATTACH_TARGET = 'equipment_unresolved_attach_target';
const EQUIPMENT_WARNING_INVALID_HOST_DEPTH = 'equipment_invalid_host_depth';
const ANNULUS_NODE_KIND_BY_SLOT_INDEX = Object.freeze([
    'ANNULUS_A',
    'ANNULUS_B',
    'ANNULUS_C',
    'ANNULUS_D'
]);

const [AUTO_FORMATION_ANNULUS, AUTO_PRODUCTION_ANNULUS, AUTO_A_ANNULUS, AUTO_B_ANNULUS, AUTO_C_ANNULUS] = FLUID_PLACEMENT_AUTO_OPTIONS;

function isDepthWithin(depth, top, bottom) {
    if (!Number.isFinite(depth) || !Number.isFinite(top) || !Number.isFinite(bottom)) return false;
    return depth > top + EPSILON && depth < bottom - EPSILON;
}

export function isDepthWithinInclusive(depth, top, bottom) {
    if (!Number.isFinite(depth) || !Number.isFinite(top) || !Number.isFinite(bottom)) return false;
    return depth >= top - EPSILON && depth <= bottom + EPSILON;
}

export function resolveCasingReference(ref, casingRefMap = new Map(), casingRows = [], preferredId = null) {
    return resolveCasingReferenceByIdOrLegacy(ref, casingRefMap, casingRows, preferredId);
}

function normalizeFluidPlacementToken(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const compact = raw.replace(/[\s_-]+/g, '').toLowerCase();

    if (compact.includes('formation')) return AUTO_FORMATION_ANNULUS;
    if (compact.includes('production')) return AUTO_PRODUCTION_ANNULUS;
    if (compact.includes('aannulus') || compact === 'a') return AUTO_A_ANNULUS;
    if (compact.includes('bannulus') || compact === 'b') return AUTO_B_ANNULUS;
    if (compact.includes('cannulus') || compact === 'c') return AUTO_C_ANNULUS;

    if (raw.toLowerCase().startsWith('behind:')) {
        const casingRef = raw.slice(raw.indexOf(':') + 1).trim();
        return casingRef ? `Behind: ${casingRef}` : '';
    }

    return raw;
}

function isCenterReference(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (!token) return true;
    return token === 'none' ||
        token === 'none(center)' ||
        token === 'none (center)' ||
        token === 'none center' ||
        token === 'none/center' ||
        token === 'center';
}

function deriveFluidPlacementFromLegacyRow(row = {}) {
    const explicitPlacement = normalizeFluidPlacementToken(row?.placement ?? row?.Placement ?? row?.intent ?? row?.Intent);
    if (explicitPlacement) return explicitPlacement;

    const innerRef = String(row?.innerRef ?? row?.inner_ref ?? '').trim();
    if (innerRef && !isCenterReference(innerRef)) {
        return `Behind: ${innerRef}`;
    }

    return FLUID_PLACEMENT_DEFAULT_OPTION;
}

function normalizeOperationPhase(value) {
    const token = String(value ?? '').trim().toLowerCase();
    return token === OPERATION_PHASE_DRILLING
        ? OPERATION_PHASE_DRILLING
        : OPERATION_PHASE_PRODUCTION;
}

function normalizeComponentType(value) {
    const token = String(value ?? '').trim();
    return token || 'pipe';
}

function normalizePipeType(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (token === PIPE_TYPE_TUBING) return PIPE_TYPE_TUBING;
    if (token === 'drillstring' || token === 'drill-string' || token === 'drill_string') {
        return PIPE_TYPE_DRILL_STRING;
    }
    return PIPE_TYPE_CASING;
}

function normalizePipeRows(pipeRows = [], options = {}) {
    const {
        pipeType = 'casing',
        allowOpenHole = false,
        includeCement = false,
        includeManualHoleSize = false
    } = options;

    return pipeRows
        .map((row, index) => {
            const od = parseOptionalNumber(row?.od);
            const top = parseOptionalNumber(row?.top);
            const bottom = parseOptionalNumber(row?.bottom);
            if (!Number.isFinite(od) || od <= 0) return null;
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

            const openHole = allowOpenHole && isOpenHoleRow(row);
            const overrideId = parseOptionalNumber(row?.idOverride);
            const estimatedId = estimateCasingID(od, parseOptionalNumber(row?.weight) ?? 0);
            const innerDiameter = openHole
                ? od
                : (Number.isFinite(overrideId) && overrideId > 0 ? overrideId : estimatedId);
            let safeInnerDiameter = Number.isFinite(innerDiameter) && innerDiameter > 0
                ? Math.min(innerDiameter, od)
                : od * PHYSICS_CONSTANTS.DEFAULT_ID_RATIO;
            if (!openHole && safeInnerDiameter >= od) {
                safeInnerDiameter = od * PHYSICS_CONSTANTS.DEFAULT_ID_RATIO;
            }

            const toc = includeCement ? parseOptionalNumber(row?.toc) : null;
            const rawBoc = includeCement ? parseOptionalNumber(row?.boc) : null;
            const boc = Number.isFinite(rawBoc) ? rawBoc : bottom;
            const manualHoleSize = includeManualHoleSize ? parseOptionalNumber(row?.manualHoleSize) : null;

            return {
                ...row,
                __index: index,
                sourceIndex: index,
                pipeType,
                componentType: normalizeComponentType(row?.componentType),
                od,
                top,
                bottom,
                toc,
                boc,
                manualHoleSize,
                isOpenHole: openHole,
                innerDiameter: safeInnerDiameter,
                outerRadius: od / 2,
                innerRadius: safeInnerDiameter / 2,
                fallbackAnnulusOuterRadius: null
            };
        })
        .filter(Boolean);
}

function normalizeCasingRows(casingData = []) {
    const rows = normalizePipeRows(casingData, {
        pipeType: 'casing',
        allowOpenHole: true,
        includeCement: true,
        includeManualHoleSize: true
    });

    rows.forEach((row) => {
        const manualHoleSize = parseOptionalNumber(row.manualHoleSize);
        if (Number.isFinite(manualHoleSize) && manualHoleSize > row.od) {
            row.fallbackAnnulusOuterRadius = manualHoleSize / 2;
            return;
        }

        const probeDepth = row.top + EPSILON;
        const parent = rows
            .filter((candidate) =>
                candidate !== row &&
                Number.isFinite(candidate.od) &&
                candidate.od > row.od &&
                candidate.top <= probeDepth &&
                candidate.bottom > probeDepth
            )
            .sort((a, b) => a.od - b.od)[0] ?? null;

        if (!parent) return;
        row.fallbackAnnulusOuterRadius = parent.isOpenHole ? parent.outerRadius : parent.innerRadius;
    });

    return rows;
}

function normalizeTubingRows(tubingData = []) {
    return normalizePipeRows(tubingData, {
        pipeType: 'tubing',
        allowOpenHole: false,
        includeCement: false,
        includeManualHoleSize: false
    });
}

function normalizeDrillStringRows(drillStringData = []) {
    return normalizePipeRows(drillStringData, {
        pipeType: 'drillString',
        allowOpenHole: false,
        includeCement: false,
        includeManualHoleSize: false
    });
}

function normalizeEquipmentRows(equipmentData = []) {
    return equipmentData
        .map((row, index) => {
            const depth = parseOptionalNumber(row?.depth);
            if (!Number.isFinite(depth)) return null;

            return {
                ...row,
                __index: index,
                sourceIndex: index,
                depth,
                type: String(row?.type ?? 'Packer').trim(),
                color: String(row?.color ?? '#000000').trim(),
                scale: parseOptionalNumber(row?.scale) ?? 1.0,
            };
        })
        .filter(Boolean);
}

function normalizeEquipmentType(type) {
    const normalized = String(type ?? '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'packer') return 'Packer';
    if (normalized === 'safety valve' || normalized === 'safety_valve' || normalized === 'safety-valve') {
        return 'Safety Valve';
    }
    return String(type ?? '').trim();
}

function normalizeFluidRows(fluidRows = []) {
    return fluidRows
        .map((row, index) => {
            if (row?.show === false) return null;

            const top = parseOptionalNumber(row?.top);
            const bottom = parseOptionalNumber(row?.bottom);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

            const placement = deriveFluidPlacementFromLegacyRow(row);
            const manualOD = parseOptionalNumber(row?.manualOD);

            return {
                ...row,
                __index: index,
                top,
                bottom,
                placement,
                manualOD: Number.isFinite(manualOD) ? manualOD : null,
                hatchStyle: normalizeHatchStyle(row?.hatchStyle)
            };
        })
        .filter(Boolean);
}

function normalizePlugRows(plugRows = []) {
    return plugRows
        .map((row, index) => {
            if (row?.show === false) return null;
            const top = parseOptionalNumber(row?.top);
            const bottom = parseOptionalNumber(row?.bottom);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
            return {
                ...row,
                __index: index,
                top,
                bottom,
                manualWidth: parseOptionalNumber(row?.manualWidth),
                hatchStyle: normalizeHatchStyle(row?.hatchStyle)
            };
        })
        .filter(Boolean);
}

function normalizePerforations(markers = [], casingRefMap = new Map(), casingRows = []) {
    return markers
        .map((row) => {
            if (row?.show === false) return null;
            const normalizedType = String(normalizeMarkerType(row?.type ?? '')).toLowerCase();
            const rawType = String(row?.type ?? '').toLowerCase();
            const isPerforation = normalizedType.includes('perf') || rawType.includes('perf');
            if (!isPerforation) return null;

            const top = parseOptionalNumber(row?.top);
            const bottom = parseOptionalNumber(row?.bottom);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom < top) return null;

            const attachToId = String(row?.attachToId ?? '').trim();
            const attachToRow = String(row?.attachToRow ?? '').trim();
            if (!attachToId && !attachToRow) return null;

            const casing = resolveCasingReference(attachToRow, casingRefMap, casingRows, attachToId);
            if (!casing) return null;

            return {
                casingIndex: casing.__index,
                top,
                bottom
            };
        })
        .filter(Boolean);
}

function resolveCrossoverEpsilon(options = {}) {
    const parsed = parseOptionalNumber(options?.crossoverEpsilon);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return PHYSICS_CONSTANTS.DEFAULT_CROSSOVER_EPSILON;
}

function isConnectionPathBlocked(parentRow, childRow, allRows, sizeTolerance = EPSILON) {
    const topDepth = parseOptionalNumber(parentRow?.bottom);
    const outerOD = parseOptionalNumber(parentRow?.od);
    const innerOD = parseOptionalNumber(childRow?.od);
    if (!Number.isFinite(topDepth) || !Number.isFinite(outerOD) || !Number.isFinite(innerOD)) {
        return false;
    }

    return allRows.some((row) => {
        if (row === parentRow || row === childRow) return false;
        if (!Number.isFinite(row?.top) || !Number.isFinite(row?.bottom) || !Number.isFinite(row?.od)) {
            return false;
        }
        const existsAtDepth = row.top < topDepth && row.bottom > topDepth;
        const isRadiallyBetween = row.od < (outerOD - sizeTolerance) && row.od > (innerOD + sizeTolerance);
        return existsAtDepth && isRadiallyBetween;
    });
}

function resolveRowInnerDiameter(row) {
    if (!row) return null;
    if (row.isOpenHole) {
        const openHoleOD = parseOptionalNumber(row.od);
        return Number.isFinite(openHoleOD) && openHoleOD > 0 ? openHoleOD : null;
    }

    const inner = parseOptionalNumber(row.innerDiameter);
    if (Number.isFinite(inner) && inner > 0) {
        return Math.min(inner, row.od);
    }

    const estimated = estimateCasingID(parseOptionalNumber(row.od), parseOptionalNumber(row.weight) ?? 0);
    if (!Number.isFinite(estimated) || estimated <= 0) return null;
    return Math.min(estimated, row.od);
}

function findParentRowAtDepth(row, allRows, depth) {
    return allRows
        .filter((candidate) =>
            candidate !== row &&
            Number.isFinite(candidate.od) &&
            Number.isFinite(candidate.top) &&
            Number.isFinite(candidate.bottom) &&
            candidate.od > row.od &&
            isDepthWithinInclusive(depth, candidate.top, candidate.bottom)
        )
        .sort((a, b) => a.od - b.od)[0] ?? null;
}

export function resolveConnections(pipeRows = [], options = {}) {
    const crossoverEpsilon = resolveCrossoverEpsilon(options);
    const sizeTolerance = parseOptionalNumber(options?.sizeTolerance) ?? EPSILON;
    const pipeType = normalizePipeType(options?.pipeType);
    const allowManualParent = options?.allowManualParent === true;
    const requireLargerParent = options?.requireLargerParent !== false;
    const connections = [];

    pipeRows.forEach((curr) => {
        if (!Number.isFinite(curr?.top) || !Number.isFinite(curr?.od)) return;
        let parent = null;

        const manualParentNumber = allowManualParent ? parseOptionalNumber(curr?.manualParent) : null;
        if (allowManualParent && Number.isFinite(manualParentNumber) && manualParentNumber > 0) {
            const manualIndex = Math.trunc(manualParentNumber) - 1;
            const manualCandidate = pipeRows.find((row) => row.__index === manualIndex) ?? null;
            const isWithinTolerance = manualCandidate
                ? Math.abs(curr.top - manualCandidate.bottom) <= crossoverEpsilon
                : false;
            const matchesSizeConstraint = !requireLargerParent || (
                Number.isFinite(manualCandidate?.od) &&
                manualCandidate.od > curr.od + sizeTolerance
            );
            const pathBlocked = requireLargerParent
                ? isConnectionPathBlocked(manualCandidate, curr, pipeRows, sizeTolerance)
                : false;

            if (manualCandidate &&
                manualCandidate !== curr &&
                matchesSizeConstraint &&
                isWithinTolerance &&
                !pathBlocked) {
                parent = manualCandidate;
            }
        }

        if (!parent) {
            const candidates = pipeRows.filter((candidate) => {
                if (candidate === curr) return false;
                if (!Number.isFinite(candidate.bottom) || !Number.isFinite(candidate.od)) return false;
                if (requireLargerParent && candidate.od <= curr.od + sizeTolerance) return false;
                if (Math.abs(curr.top - candidate.bottom) > crossoverEpsilon) return false;
                if (!requireLargerParent) return true;
                return !isConnectionPathBlocked(candidate, curr, pipeRows, sizeTolerance);
            });
            if (candidates.length === 0) return;

            candidates.sort((a, b) => {
                const depthDiff = Math.abs(curr.top - a.bottom) - Math.abs(curr.top - b.bottom);
                if (depthDiff !== 0) return depthDiff;
                return a.od - b.od;
            });
            parent = candidates[0] ?? null;
        }

        if (!parent) return;
        const depthTop = Math.min(parent.bottom, curr.top);
        const depthBottom = Math.max(parent.bottom, curr.top);
        const isTightJoin = Math.abs(parent.bottom - curr.top) <= BOUNDARY_TOLERANCE;

        connections.push({
            type: isTightJoin ? 'swage' : 'crossover',
            pipeType,
            upperIndex: parent.__index,
            lowerIndex: curr.__index,
            depthTop,
            depthBottom,
            isSealed: true
        });
    });

    return connections;
}

export function resolveHangers(casingRows = [], options = {}) {
    const connections = Array.isArray(options?.connections) ? options.connections : [];
    const connectedChildren = new Set(
        connections
            .map((connection) => parseOptionalNumber(connection?.lowerIndex))
            .filter(Number.isFinite)
            .map((index) => Math.trunc(index))
    );

    const barriers = [];
    casingRows.forEach((row) => {
        if (!Number.isFinite(row?.top) || !Number.isFinite(row?.od)) return;
        if (connectedChildren.has(row.__index)) return;

        const probeDepth = row.top + 1e-3;
        const parent = findParentRowAtDepth(row, casingRows, probeDepth);
        if (!parent) return;

        const linerMode = normalizeLinerMode(row?.linerMode);
        if (linerMode === 'no') return;
        if (linerMode !== 'yes' && row.top <= (parent.top + 0.5)) return;

        const parentInnerDiameter = resolveRowInnerDiameter(parent);
        if (!Number.isFinite(parentInnerDiameter) || parentInnerDiameter <= row.od) return;

        barriers.push({
            type: 'liner_packer',
            rowIndex: row.__index,
            parentIndex: parent.__index,
            depth: row.top,
            parentInnerDiameter,
            childOuterDiameter: row.od,
            isSealing: true
        });
    });

    return barriers;
}

function resolveModeledAnnulusKindBySlotIndex(slotIndex, isFormation = false) {
    if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < ANNULUS_NODE_KIND_BY_SLOT_INDEX.length) {
        return ANNULUS_NODE_KIND_BY_SLOT_INDEX[slotIndex];
    }
    return isFormation ? 'FORMATION_ANNULUS' : null;
}

function resolvePackerSealSlotForHost(depth, hostType, hostRow, options = {}) {
    if (!hostRow || !Number.isFinite(depth)) return null;

    const casingRows = Array.isArray(options?.casingRows) ? options.casingRows : [];
    const tubingRows = Array.isArray(options?.tubingRows) ? options.tubingRows : [];
    const drillStringRows = Array.isArray(options?.drillStringRows) ? options.drillStringRows : [];
    const operationPhase = normalizeOperationPhase(options?.operationPhase);

    const activeCasings = casingRows.filter((row) => isDepthWithinInclusive(depth, row.top, row.bottom));
    const activeCasingSteel = activeCasings
        .filter((row) => !row.isOpenHole)
        .sort((a, b) => a.od - b.od);
    const activeOpenHoles = activeCasings
        .filter((row) => row.isOpenHole)
        .sort((a, b) => a.od - b.od);
    const transientRows = operationPhase === OPERATION_PHASE_DRILLING
        ? drillStringRows
        : tubingRows;
    const activeTransientRows = transientRows.filter((row) => isDepthWithinInclusive(depth, row.top, row.bottom));
    const activeSteel = [...activeCasingSteel, ...activeTransientRows]
        .sort((a, b) => a.od - b.od);

    const outerEnvironmentRadius = resolveOuterEnvironmentRadius(activeSteel, activeOpenHoles, depth);
    const annuli = buildAnnulusSlots(activeSteel, outerEnvironmentRadius);
    if (annuli.length === 0) return null;

    const hostPipeType = hostType === PIPE_HOST_TYPE_TUBING
        ? PIPE_TYPE_TUBING
        : PIPE_TYPE_CASING;
    const hostRowId = normalizeRowId(hostRow?.rowId);
    const hostIndex = Number(hostRow?.__index);
    const sealSlot = annuli.find((slot) => {
        const innerPipe = slot?.innerPipe;
        if (!innerPipe || innerPipe.pipeType !== hostPipeType) return false;
        const innerRowId = normalizeRowId(innerPipe?.rowId);
        if (hostRowId && innerRowId) return innerRowId === hostRowId;
        const innerIndex = Number(innerPipe?.__index);
        if (!Number.isInteger(innerIndex) || !Number.isInteger(hostIndex)) return false;
        return innerIndex === hostIndex;
    }) ?? null;
    if (!sealSlot) return null;

    const sealSlotIndex = Number.isInteger(Number(sealSlot.index))
        ? Number(sealSlot.index)
        : null;
    const sealNodeKind = resolveModeledAnnulusKindBySlotIndex(sealSlotIndex, sealSlot?.isFormation === true);
    const sealInnerDiameter = Number.isFinite(sealSlot?.innerRadius)
        ? Number(sealSlot.innerRadius) * 2
        : null;
    const sealOuterDiameter = Number.isFinite(sealSlot?.outerRadius)
        ? Number(sealSlot.outerRadius) * 2
        : null;

    return {
        sealNodeKind,
        sealSlotIndex,
        sealInnerDiameter,
        sealOuterDiameter,
        sealSlot
    };
}

function createUnresolvedPackerResolution(warningCode, hostType = null, hostRow = null) {
    const hostIndex = Number(hostRow?.__index);
    return {
        hostType,
        hostIndex: Number.isInteger(hostIndex) ? hostIndex : null,
        hostRowId: normalizeRowId(hostRow?.rowId),
        parentCasingIndex: null,
        parentInnerDiameter: null,
        sealNodeKind: null,
        sealSlotIndex: null,
        sealInnerDiameter: null,
        sealOuterDiameter: null,
        isOrphaned: true,
        attachWarningCode: warningCode
    };
}

function resolvePackerAttachment(equip, depth, pipeReferenceMap, options = {}) {
    const hostType = normalizeEquipmentAttachHostType(equip?.attachToHostType);
    const attachToId = normalizeRowId(equip?.attachToId);
    const attachReference = String(equip?.attachToRow ?? equip?.attachToDisplay ?? '').trim();
    if (!hostType || !attachToId) {
        return createUnresolvedPackerResolution(EQUIPMENT_WARNING_MISSING_ATTACH_TARGET, hostType, null);
    }

    const resolvedHost = resolvePipeHostReference(attachReference, pipeReferenceMap, {
        preferredId: attachToId,
        hostType
    });
    if (!resolvedHost?.row) {
        return createUnresolvedPackerResolution(EQUIPMENT_WARNING_UNRESOLVED_ATTACH_TARGET, hostType, null);
    }

    const hostRow = resolvedHost.row;
    const hostTop = Number(hostRow?.top);
    const hostBottom = Number(hostRow?.bottom);
    if (!isDepthWithinInclusive(depth, hostTop, hostBottom)) {
        return createUnresolvedPackerResolution(EQUIPMENT_WARNING_INVALID_HOST_DEPTH, resolvedHost.hostType, hostRow);
    }

    const sealResolution = resolvePackerSealSlotForHost(depth, resolvedHost.hostType, hostRow, options);
    if (!sealResolution || !sealResolution.sealNodeKind) {
        return createUnresolvedPackerResolution(EQUIPMENT_WARNING_UNRESOLVED_ATTACH_TARGET, resolvedHost.hostType, hostRow);
    }

    const outerPipe = sealResolution.sealSlot?.outerPipe ?? null;
    const outerPipeIndex = Number(outerPipe?.__index);
    const outerPipeIsCasing = outerPipe?.pipeType === PIPE_TYPE_CASING;

    return {
        hostType: resolvedHost.hostType,
        hostIndex: Number.isInteger(Number(hostRow?.__index)) ? Number(hostRow.__index) : null,
        hostRowId: normalizeRowId(hostRow?.rowId),
        parentCasingIndex: outerPipeIsCasing && Number.isInteger(outerPipeIndex)
            ? outerPipeIndex
            : null,
        parentInnerDiameter: sealResolution.sealOuterDiameter,
        sealNodeKind: sealResolution.sealNodeKind,
        sealSlotIndex: sealResolution.sealSlotIndex,
        sealInnerDiameter: sealResolution.sealInnerDiameter,
        sealOuterDiameter: sealResolution.sealOuterDiameter,
        isOrphaned: false,
        attachWarningCode: null
    };
}

export function resolveEquipment(equipmentRows = [], tubingRows = [], casingRows = [], options = {}) {
    const resolved = [];
    const normalizedCasingRows = normalizeCasingRows(casingRows);
    const normalizedTubingRows = normalizeTubingRows(tubingRows);
    const normalizedDrillStringRows = normalizeDrillStringRows(options?.drillStringRows ?? []);
    const normalizedOperationPhase = normalizeOperationPhase(options?.operationPhase);
    const pipeReferenceMap = buildPipeReferenceMap(normalizedCasingRows, normalizedTubingRows);

    equipmentRows.forEach((equip) => {
        const probeDepth = equip.depth; // Use exact depth, isDepthWithinInclusive handles tolerance.

        // Find the innermost tubing the equipment is inside
        const tubingParent = normalizedTubingRows
            .filter((candidate) =>
                Number.isFinite(candidate.od) &&
                isDepthWithinInclusive(probeDepth, candidate.top, candidate.bottom)
            )
            .sort((a, b) => a.od - b.od)[0] ?? null;

        const equipmentBase = {
            ...equip,
            type: normalizeEquipmentType(equip?.type),
            tubingParentIndex: tubingParent?.__index ?? null,
            tubingParentOD: tubingParent?.od ?? null,
            tubingParentID: tubingParent?.innerDiameter ?? null,
            hostType: null,
            hostIndex: null,
            hostRowId: null,
            parentCasingIndex: null,
            parentInnerDiameter: null,
            sealNodeKind: null,
            sealSlotIndex: null,
            sealInnerDiameter: null,
            sealOuterDiameter: null,
            isOrphaned: false,
            attachWarningCode: null
        };

        if (isPackerEquipmentType(equipmentBase.type)) {
            Object.assign(
                equipmentBase,
                resolvePackerAttachment(equipmentBase, probeDepth, pipeReferenceMap, {
                    casingRows: normalizedCasingRows,
                    tubingRows: normalizedTubingRows,
                    drillStringRows: normalizedDrillStringRows,
                    operationPhase: normalizedOperationPhase
                })
            );
        }

        resolved.push(equipmentBase);
    });

    return resolved;
}

export function createContext(state = defaultPhysicsState) {
    const casingRows = normalizeCasingRows(state?.casingData ?? []);
    const tubingRows = normalizeTubingRows(state?.tubingData ?? []);
    const drillStringRows = normalizeDrillStringRows(state?.drillStringData ?? []);
    const equipmentRows = normalizeEquipmentRows(state?.equipmentData ?? []);
    const operationPhase = normalizeOperationPhase(state?.config?.operationPhase);
    const casingRefMap = buildCasingReferenceMap(casingRows);

    const fluidRows = normalizeFluidRows(state?.annulusFluids ?? []);
    const plugRows = normalizePlugRows(state?.cementPlugs ?? []);
    const perforations = normalizePerforations(state?.markers ?? [], casingRefMap, casingRows);
    const casingConnections = resolveConnections(casingRows, {
        pipeType: PIPE_TYPE_CASING,
        allowManualParent: true,
        requireLargerParent: true,
        crossoverEpsilon: state?.config?.crossoverEpsilon
    });
    const tubingConnections = resolveConnections(tubingRows, {
        pipeType: PIPE_TYPE_TUBING,
        allowManualParent: false,
        requireLargerParent: false,
        crossoverEpsilon: state?.config?.crossoverEpsilon
    });
    const drillStringConnections = resolveConnections(drillStringRows, {
        pipeType: PIPE_TYPE_DRILL_STRING,
        allowManualParent: false,
        requireLargerParent: false,
        crossoverEpsilon: state?.config?.crossoverEpsilon
    });
    const connections = [
        ...casingConnections,
        ...tubingConnections,
        ...drillStringConnections
    ];
    const barriers = resolveHangers(casingRows, { connections: casingConnections });
    const equipment = resolveEquipment(equipmentRows, tubingRows, casingRows, {
        drillStringRows,
        operationPhase
    });
    const markerBoundaries = normalizeMarkerBoundaries(state?.markers ?? []);
    const pipeRows = [...casingRows, ...tubingRows, ...drillStringRows];

    return {
        __physicsContext: true,
        state,
        casingRows,
        tubingRows,
        drillStringRows,
        pipeRows,
        operationPhase,
        casingRefMap,
        fluidRows,
        plugRows,
        perforations,
        connections,
        barriers,
        equipment,
        markerBoundaries
    };
}

function resolveContext(input) {
    if (input?.__physicsContext) return input;
    return createContext(input ?? {});
}

function addDepthPoint(set, value) {
    const depth = parseOptionalNumber(value);
    if (Number.isFinite(depth)) {
        set.add(depth);
    }
}

function resolveConnectionJoinDepth(connection = {}) {
    const top = parseOptionalNumber(connection?.depthTop);
    const bottom = parseOptionalNumber(connection?.depthBottom);
    if (Number.isFinite(top) && Number.isFinite(bottom)) {
        return (top + bottom) / 2;
    }
    if (Number.isFinite(top)) return top;
    if (Number.isFinite(bottom)) return bottom;
    return null;
}

function buildPipeConnectionBoundaryLookup(connections = []) {
    const lookup = new Map();
    connections.forEach((connection) => {
        const pipeType = normalizePipeType(connection?.pipeType);
        const upperIndex = Number(connection?.upperIndex);
        const lowerIndex = Number(connection?.lowerIndex);
        if (!Number.isInteger(upperIndex) || !Number.isInteger(lowerIndex)) return;

        const joinDepth = resolveConnectionJoinDepth(connection);
        if (!Number.isFinite(joinDepth)) return;

        lookup.set(`${pipeType}:${upperIndex}:bottom`, joinDepth);
        lookup.set(`${pipeType}:${lowerIndex}:top`, joinDepth);
    });
    return lookup;
}

function resolveConnectedBoundaryDepth(boundaryLookup, pipeType, rowIndex, boundary, fallbackDepth) {
    const key = `${normalizePipeType(pipeType)}:${rowIndex}:${boundary}`;
    if (!boundaryLookup.has(key)) return fallbackDepth;
    return boundaryLookup.get(key);
}

function normalizeMarkerBoundaries(rows = []) {
    return rows
        .map((row, index) => {
            if (row?.show === false) return null;
            const top = parseOptionalNumber(row?.top);
            const bottom = parseOptionalNumber(row?.bottom);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom < top) return null;

            const markerType = String(normalizeMarkerType(row?.type ?? '')).toLowerCase();
            const type = markerType.includes('leak') ? 'tubingLeak' : 'marker';
            const fallbackLabel = type === 'tubingLeak' ? 'Tubing leak' : 'Marker';
            const label = resolveBoundaryRowLabel(row, fallbackLabel, index);

            return { index, top, bottom, type, label };
        })
        .filter(Boolean);
}

function getMarkerBoundaries(context) {
    if (Array.isArray(context?.markerBoundaries)) return context.markerBoundaries;
    const markerRows = Array.isArray(context?.state?.markers) ? context.state.markers : [];
    return normalizeMarkerBoundaries(markerRows);
}

function getMaximumDepthFromContext(context) {
    const depths = [];

    context.casingRows.forEach((row) => {
        depths.push(row.top, row.bottom);
        if (Number.isFinite(row.toc)) depths.push(row.toc);
        if (Number.isFinite(row.boc)) depths.push(row.boc);
    });
    (context.tubingRows ?? []).forEach((row) => {
        depths.push(row.top, row.bottom);
    });
    (context.drillStringRows ?? []).forEach((row) => {
        depths.push(row.top, row.bottom);
    });
    context.plugRows.forEach((row) => depths.push(row.top, row.bottom));
    context.fluidRows.forEach((row) => depths.push(row.top, row.bottom));
    (context.equipment ?? []).forEach((row) => depths.push(row.depth));
    getMarkerBoundaries(context).forEach((marker) => depths.push(marker.top, marker.bottom));

    const finite = depths.filter(Number.isFinite);
    if (finite.length === 0) return 1000;
    const maxDepth = Math.max(...finite);
    return maxDepth > 0 ? maxDepth : 1000;
}

function getMinimumDepthFromContext(context) {
    const depths = [];

    context.casingRows.forEach((row) => {
        depths.push(row.top, row.bottom);
        if (Number.isFinite(row.toc)) depths.push(row.toc);
        if (Number.isFinite(row.boc)) depths.push(row.boc);
    });
    (context.tubingRows ?? []).forEach((row) => {
        depths.push(row.top, row.bottom);
    });
    (context.drillStringRows ?? []).forEach((row) => {
        depths.push(row.top, row.bottom);
    });
    context.plugRows.forEach((row) => depths.push(row.top, row.bottom));
    context.fluidRows.forEach((row) => depths.push(row.top, row.bottom));
    (context.equipment ?? []).forEach((row) => depths.push(row.depth));
    getMarkerBoundaries(context).forEach((marker) => depths.push(marker.top, marker.bottom));

    const finite = depths.filter(Number.isFinite);
    if (finite.length === 0) return 0;
    return Math.min(...finite);
}

export function getCriticalDepths(input) {
    const context = resolveContext(input);
    const depthSet = new Set();
    const boundaryLookup = buildPipeConnectionBoundaryLookup(context.connections);
    addDepthPoint(depthSet, getMinimumDepthFromContext(context));

    context.casingRows.forEach((row) => {
        const topDepth = resolveConnectedBoundaryDepth(
            boundaryLookup,
            PIPE_TYPE_CASING,
            row.__index,
            'top',
            row.top
        );
        const bottomDepth = resolveConnectedBoundaryDepth(
            boundaryLookup,
            PIPE_TYPE_CASING,
            row.__index,
            'bottom',
            row.bottom
        );
        addDepthPoint(depthSet, topDepth);
        addDepthPoint(depthSet, bottomDepth);
        addDepthPoint(depthSet, row.toc);
        addDepthPoint(depthSet, row.boc);
    });
    (context.tubingRows ?? []).forEach((row) => {
        const topDepth = resolveConnectedBoundaryDepth(
            boundaryLookup,
            PIPE_TYPE_TUBING,
            row.__index,
            'top',
            row.top
        );
        const bottomDepth = resolveConnectedBoundaryDepth(
            boundaryLookup,
            PIPE_TYPE_TUBING,
            row.__index,
            'bottom',
            row.bottom
        );
        addDepthPoint(depthSet, topDepth);
        addDepthPoint(depthSet, bottomDepth);
    });
    (context.drillStringRows ?? []).forEach((row) => {
        const topDepth = resolveConnectedBoundaryDepth(
            boundaryLookup,
            PIPE_TYPE_DRILL_STRING,
            row.__index,
            'top',
            row.top
        );
        const bottomDepth = resolveConnectedBoundaryDepth(
            boundaryLookup,
            PIPE_TYPE_DRILL_STRING,
            row.__index,
            'bottom',
            row.bottom
        );
        addDepthPoint(depthSet, topDepth);
        addDepthPoint(depthSet, bottomDepth);
    });

    context.plugRows.forEach((row) => {
        addDepthPoint(depthSet, row.top);
        addDepthPoint(depthSet, row.bottom);
    });

    context.fluidRows.forEach((row) => {
        addDepthPoint(depthSet, row.top);
        addDepthPoint(depthSet, row.bottom);
    });
    (context.equipment ?? []).forEach((row) => {
        addDepthPoint(depthSet, row.depth);
    });
    getMarkerBoundaries(context).forEach((marker) => {
        addDepthPoint(depthSet, marker.top);
        addDepthPoint(depthSet, marker.bottom);
    });

    const maxDepth = getMaximumDepthFromContext(context);
    addDepthPoint(depthSet, maxDepth);

    return Array.from(depthSet)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
}

export function getIntervals(input) {
    const depths = getCriticalDepths(input);
    const intervals = [];

    for (let i = 0; i < depths.length - 1; i += 1) {
        const top = depths[i];
        const bottom = depths[i + 1];
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) continue;
        intervals.push({
            top,
            bottom,
            midpoint: (top + bottom) / 2
        });
    }

    return intervals;
}

function isBoundaryDepth(depth, boundaryDepth, tolerance = EPSILON) {
    if (!Number.isFinite(depth) || !Number.isFinite(boundaryDepth)) return false;
    return Math.abs(depth - boundaryDepth) <= tolerance;
}

function resolveBoundaryRowLabel(row, fallbackLabel, index) {
    const explicit = String(row?.label ?? '').trim();
    if (explicit) return explicit;
    const safeIndex = Number.isInteger(index) && index >= 0 ? ` #${index + 1}` : '';
    return `${fallbackLabel}${safeIndex}`;
}

function addBoundaryReason(reasons, reason = {}) {
    const type = String(reason.type ?? '').trim() || 'depth';
    const action = String(reason.action ?? '').trim() || 'transition';
    const label = String(reason.label ?? '').trim();
    const sourceIndexRaw = Number(reason.sourceIndex);
    const sourceIndex = Number.isInteger(sourceIndexRaw) ? sourceIndexRaw : null;
    const signature = `${type}|${action}|${label}|${sourceIndex ?? ''}`;

    const alreadyExists = reasons.some((entry) => (
        `${entry.type}|${entry.action}|${entry.label}|${entry.sourceIndex ?? ''}` === signature
    ));
    if (alreadyExists) return;

    reasons.push({
        type,
        action,
        label,
        sourceIndex
    });
}

function collectCasingBoundaryReasons(depth, context, reasons) {
    context.casingRows.forEach((row) => {
        const rowLabel = resolveBoundaryRowLabel(row, row?.isOpenHole ? 'Open hole' : 'Casing', row?.__index);

        if (isBoundaryDepth(depth, row.top)) {
            addBoundaryReason(reasons, {
                type: 'casing',
                action: 'start',
                label: rowLabel,
                sourceIndex: row.__index
            });
        }

        if (isBoundaryDepth(depth, row.bottom)) {
            addBoundaryReason(reasons, {
                type: 'casing',
                action: 'end',
                label: rowLabel,
                sourceIndex: row.__index
            });
        }

        if (!Number.isFinite(row.toc)) return;
        const cementBottom = Number.isFinite(row.boc) ? row.boc : row.bottom;
        if (!Number.isFinite(cementBottom) || cementBottom <= row.toc + EPSILON) return;

        if (isBoundaryDepth(depth, row.toc)) {
            addBoundaryReason(reasons, {
                type: 'cement',
                action: 'start',
                label: rowLabel,
                sourceIndex: row.__index
            });
        }

        if (isBoundaryDepth(depth, cementBottom)) {
            addBoundaryReason(reasons, {
                type: 'cement',
                action: 'end',
                label: rowLabel,
                sourceIndex: row.__index
            });
        }
    });
}

function collectFluidBoundaryReasons(depth, context, reasons) {
    context.fluidRows.forEach((row) => {
        const rowLabel = resolveBoundaryRowLabel(row, 'Fluid', row?.__index);
        if (isBoundaryDepth(depth, row.top)) {
            addBoundaryReason(reasons, {
                type: 'fluid',
                action: 'start',
                label: rowLabel,
                sourceIndex: row.__index
            });
        }
        if (isBoundaryDepth(depth, row.bottom)) {
            addBoundaryReason(reasons, {
                type: 'fluid',
                action: 'end',
                label: rowLabel,
                sourceIndex: row.__index
            });
        }
    });
}

function collectPlugBoundaryReasons(depth, context, reasons) {
    context.plugRows.forEach((row) => {
        const rowLabel = resolveBoundaryRowLabel(row, 'Plug', row?.__index);
        if (isBoundaryDepth(depth, row.top)) {
            addBoundaryReason(reasons, {
                type: 'plug',
                action: 'start',
                label: rowLabel,
                sourceIndex: row.__index
            });
        }
        if (isBoundaryDepth(depth, row.bottom)) {
            addBoundaryReason(reasons, {
                type: 'plug',
                action: 'end',
                label: rowLabel,
                sourceIndex: row.__index
            });
        }
    });
}

function collectMarkerBoundaryReasons(depth, context, reasons) {
    getMarkerBoundaries(context).forEach((marker) => {
        const isPointMarker = Math.abs(marker.bottom - marker.top) <= EPSILON;

        if (isPointMarker && isBoundaryDepth(depth, marker.top)) {
            addBoundaryReason(reasons, {
                type: marker.type,
                action: 'point',
                label: marker.label,
                sourceIndex: marker.index
            });
            return;
        }

        if (isBoundaryDepth(depth, marker.top)) {
            addBoundaryReason(reasons, {
                type: marker.type,
                action: 'start',
                label: marker.label,
                sourceIndex: marker.index
            });
        }

        if (isBoundaryDepth(depth, marker.bottom)) {
            addBoundaryReason(reasons, {
                type: marker.type,
                action: 'end',
                label: marker.label,
                sourceIndex: marker.index
            });
        }
    });
}

function createPipeRowIndexMap(rows = []) {
    const byIndex = new Map();
    rows.forEach((row) => {
        if (Number.isInteger(row?.__index)) {
            byIndex.set(row.__index, row);
        }
    });
    return byIndex;
}

function resolvePipeRowMapByType(context, pipeType) {
    const normalizedType = normalizePipeType(pipeType);
    if (normalizedType === PIPE_TYPE_TUBING) {
        return createPipeRowIndexMap(context.tubingRows);
    }
    if (normalizedType === PIPE_TYPE_DRILL_STRING) {
        return createPipeRowIndexMap(context.drillStringRows);
    }
    return createPipeRowIndexMap(context.casingRows);
}

function collectConnectionBoundaryReasons(depth, context, reasons) {
    context.connections.forEach((connection, index) => {
        const pipeType = normalizePipeType(connection?.pipeType);
        const rowMap = resolvePipeRowMapByType(context, pipeType);
        const upper = rowMap.get(connection.upperIndex) ?? null;
        const lower = rowMap.get(connection.lowerIndex) ?? null;
        const pipeLabelPrefix = pipeType === PIPE_TYPE_TUBING
            ? 'Tubing'
            : (pipeType === PIPE_TYPE_DRILL_STRING ? 'Drill string' : 'Casing');
        const upperLabel = resolveBoundaryRowLabel(upper, `Upper ${pipeLabelPrefix.toLowerCase()}`, connection.upperIndex);
        const lowerLabel = resolveBoundaryRowLabel(lower, `Lower ${pipeLabelPrefix.toLowerCase()}`, connection.lowerIndex);
        const connectionType = connection?.type === 'swage' ? 'Swage' : 'Crossover';
        const label = `${connectionType} (${pipeLabelPrefix}): ${upperLabel} -> ${lowerLabel}`;
        const joinDepth = resolveConnectionJoinDepth(connection);
        const hitsConnectionBoundary = (
            isBoundaryDepth(depth, connection?.depthTop) ||
            isBoundaryDepth(depth, connection?.depthBottom) ||
            isBoundaryDepth(depth, joinDepth)
        );

        if (hitsConnectionBoundary) {
            addBoundaryReason(reasons, {
                type: 'connection',
                action: 'transition',
                label,
                sourceIndex: index
            });
        }
    });
}

function collectBarrierBoundaryReasons(depth, context, reasons) {
    const casingByIndex = createPipeRowIndexMap(context.casingRows);

    context.barriers.forEach((barrier, index) => {
        if (!isBoundaryDepth(depth, barrier?.depth)) return;
        const child = casingByIndex.get(barrier.rowIndex) ?? null;
        const parent = casingByIndex.get(barrier.parentIndex) ?? null;
        const childLabel = resolveBoundaryRowLabel(child, 'Child casing', barrier.rowIndex);
        const parentLabel = resolveBoundaryRowLabel(parent, 'Parent casing', barrier.parentIndex);
        const label = `Liner packer: ${childLabel} in ${parentLabel}`;

        addBoundaryReason(reasons, {
            type: 'barrier',
            action: 'transition',
            label,
            sourceIndex: index
        });
    });
}

function collectEquipmentBoundaryReasons(depth, context, reasons) {
    (context.equipment ?? []).forEach((row) => {
        if (!isBoundaryDepth(depth, row?.depth)) return;
        const normalizedType = normalizeEquipmentType(row?.type);
        const fallbackLabel = normalizedType || 'Equipment';
        const rowLabel = resolveBoundaryRowLabel(row, fallbackLabel, row?.sourceIndex ?? row?.__index);

        addBoundaryReason(reasons, {
            type: 'equipment',
            action: 'transition',
            label: rowLabel,
            sourceIndex: row?.sourceIndex ?? row?.__index
        });
    });
}

function collectIntervalBoundaryReasons(depth, context, options = {}) {
    const reasons = [];
    if (!Number.isFinite(depth) || !context) return reasons;

    if (options.includeModelStart === true) {
        addBoundaryReason(reasons, {
            type: 'model',
            action: 'start'
        });
    }

    if (options.includeModelEnd === true) {
        addBoundaryReason(reasons, {
            type: 'model',
            action: 'end'
        });
    }

    collectCasingBoundaryReasons(depth, context, reasons);
    collectFluidBoundaryReasons(depth, context, reasons);
    collectPlugBoundaryReasons(depth, context, reasons);
    collectMarkerBoundaryReasons(depth, context, reasons);
    collectConnectionBoundaryReasons(depth, context, reasons);
    collectBarrierBoundaryReasons(depth, context, reasons);
    collectEquipmentBoundaryReasons(depth, context, reasons);

    if (reasons.length === 0) {
        addBoundaryReason(reasons, {
            type: 'depth',
            action: 'transition'
        });
    }

    return reasons;
}

export function getIntervalsWithBoundaryReasons(input) {
    const context = resolveContext(input);
    const intervals = getIntervals(context);
    const lastIndex = intervals.length - 1;

    return intervals
        .map((interval, index) => {
            const top = Number(interval?.top);
            const bottom = Number(interval?.bottom);
            const midpoint = Number(interval?.midpoint);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

            return {
                top,
                bottom,
                midpoint: Number.isFinite(midpoint) ? midpoint : (top + bottom) / 2,
                startBoundaryReasons: collectIntervalBoundaryReasons(top, context, {
                    includeModelStart: index === 0
                }),
                endBoundaryReasons: collectIntervalBoundaryReasons(bottom, context, {
                    includeModelEnd: index === lastIndex
                })
            };
        })
        .filter(Boolean);
}

function hasCementAtDepth(innerPipe, depth) {
    if (!innerPipe) return false;
    if (!Number.isFinite(innerPipe.toc)) return false;
    const cementBottom = Number.isFinite(innerPipe.boc) ? innerPipe.boc : innerPipe.bottom;
    if (!Number.isFinite(cementBottom) || cementBottom <= innerPipe.toc + EPSILON) return false;
    return isDepthWithinInclusive(depth, innerPipe.toc, cementBottom);
}

function hasInheritedCementAtDepth(layer, depth, depthContext) {
    const innerPipe = layer?.innerPipe;
    if (!innerPipe || !Number.isFinite(depth)) return false;

    const context = depthContext?.context;
    const activeSteel = Array.isArray(depthContext?.activeSteel) ? depthContext.activeSteel : [];
    const casingRows = Array.isArray(context?.casingRows) ? context.casingRows : [];

    return casingRows.some((row) => {
        if (!Number.isFinite(row?.toc)) return false;
        const cementBottom = Number.isFinite(row?.boc) ? row.boc : row?.bottom;
        if (!Number.isFinite(cementBottom) || cementBottom <= row.toc + EPSILON) return false;
        if (!isDepthWithinInclusive(depth, row.toc, cementBottom)) return false;

        // If the cementing casing is already active at this depth, regular annulus logic handles it.
        if (depth >= row.top - EPSILON) return false;

        const rowOD = Number(row?.od);
        if (!Number.isFinite(rowOD) || rowOD <= 0) return false;
        const inheritedParent = activeSteel.find((candidate) => Number(candidate?.od) > rowOD + EPSILON) || null;
        if (!inheritedParent) return false;

        return inheritedParent.__index === innerPipe.__index;
    });
}

function resolveOuterEnvironmentRadius(activeSteel, activeOpenHoles, depth) {
    const candidateRadii = [];
    if (activeSteel.length > 0) {
        candidateRadii.push(activeSteel[activeSteel.length - 1].outerRadius);
    }
    activeOpenHoles.forEach((row) => {
        candidateRadii.push(row.outerRadius);
    });
    activeSteel.forEach((row) => {
        const holeSize = parseOptionalNumber(row.manualHoleSize);
        if (Number.isFinite(holeSize) && holeSize > row.od && isDepthWithin(depth, row.top, row.bottom)) {
            candidateRadii.push(holeSize / 2);
        }
    });
    if (candidateRadii.length === 0) return 0;
    return Math.max(...candidateRadii);
}

function resolveAutoPlugRadius(activeSteel) {
    if (activeSteel.length > 0) {
        return activeSteel[0].innerRadius;
    }
    return null;
}

function resolvePlugAtDepth(depth, context, activeSteel) {
    const activePlugs = context.plugRows.filter((row) => isDepthWithin(depth, row.top, row.bottom));
    if (activePlugs.length === 0) return null;

    let chosen = null;
    activePlugs.forEach((plug) => {
        let radius = null;
        if (Number.isFinite(plug.manualWidth) && plug.manualWidth > 0) {
            radius = plug.manualWidth / 2;
        } else {
            const attachToId = String(plug.attachToId ?? '').trim();
            const attachToRow = String(plug.attachToRow ?? '').trim();
            if (attachToId || attachToRow) {
                const target = resolveCasingReference(
                    attachToRow,
                    context.casingRefMap,
                    context.casingRows,
                    attachToId
                );
                if (target) {
                    radius = target.isOpenHole ? target.outerRadius : target.innerRadius;
                }
            }
            if (!Number.isFinite(radius) || radius <= 0) {
                radius = resolveAutoPlugRadius(activeSteel);
            }
        }

        if (!Number.isFinite(radius) || radius <= 0) return;
        if (!chosen || radius > chosen.radius) {
            chosen = { plug, radius };
        }
    });

    return chosen;
}

function applyPlugOverlayToStack(stack, plugMatch) {
    if (!plugMatch || !Number.isFinite(plugMatch.radius) || plugMatch.radius <= EPSILON) {
        return stack;
    }

    const baseStack = Array.isArray(stack) ? stack : [];
    const maxOuter = baseStack.reduce((max, layer) => {
        const outer = Number(layer?.outerRadius);
        return Number.isFinite(outer) ? Math.max(max, outer) : max;
    }, 0);

    let plugOuter = Number(plugMatch.radius);
    if (!Number.isFinite(plugOuter) || plugOuter <= EPSILON) return baseStack;
    if (maxOuter > EPSILON) {
        plugOuter = Math.min(plugOuter, maxOuter);
    }
    if (plugOuter <= EPSILON) return baseStack;

    const trimmed = [];
    baseStack.forEach((layer) => {
        const inner = Number(layer?.innerRadius);
        const outer = Number(layer?.outerRadius);
        if (!Number.isFinite(inner) || !Number.isFinite(outer) || outer <= inner + EPSILON) {
            return;
        }

        // A plug occupies fluid/void space only. Preserve steel walls so nested casings remain visible.
        const isSteelLayer = layer?.material === 'steel' || layer?.role === 'pipe';
        if (isSteelLayer) {
            trimmed.push(layer);
            return;
        }

        if (outer <= plugOuter + EPSILON) {
            return;
        }
        if (inner < plugOuter - EPSILON) {
            trimmed.push({ ...layer, innerRadius: plugOuter });
            return;
        }
        trimmed.push(layer);
    });

    return [{
        role: 'core',
        material: 'plug',
        innerRadius: 0,
        outerRadius: plugOuter,
        source: { type: 'plug', index: plugMatch.plug.__index },
        label: plugMatch.plug.label,
        color: plugMatch.plug.color,
        hatchStyle: plugMatch.plug.hatchStyle
    }, ...trimmed];
}

function isPerforated(casingIndex, depth, context) {
    if (!Number.isInteger(casingIndex)) return false;
    return context.perforations.some((item) =>
        item.casingIndex === casingIndex && isDepthWithinInclusive(depth, item.top, item.bottom)
    );
}

function buildAnnulusSlots(activeSteel, outerEnvironmentRadius) {
    const annuli = [];

    for (let i = 0; i < activeSteel.length; i += 1) {
        const pipe = activeSteel[i];
        const nextPipe = activeSteel[i + 1] ?? null;

        const annulusInner = pipe.outerRadius;
        let annulusOuter = nextPipe ? nextPipe.innerRadius : outerEnvironmentRadius;
        const fallbackOuter = parseOptionalNumber(pipe.fallbackAnnulusOuterRadius);
        if ((!nextPipe || annulusOuter <= annulusInner + EPSILON) &&
            Number.isFinite(fallbackOuter) &&
            fallbackOuter > annulusInner + EPSILON) {
            annulusOuter = Math.max(annulusOuter, fallbackOuter);
        }

        if (!Number.isFinite(annulusOuter) || annulusOuter <= annulusInner + EPSILON) continue;

        annuli.push({
            index: i,
            innerRadius: annulusInner,
            outerRadius: annulusOuter,
            innerPipe: pipe,
            outerPipe: nextPipe,
            isFormation: !nextPipe
        });
    }

    return annuli;
}

function resolveAnnulusIndexForPlacement(placement, annuli, context, placementRefId = null) {
    if (!placement || annuli.length === 0) return null;
    if (placement === AUTO_FORMATION_ANNULUS) {
        return annuli[annuli.length - 1]?.index ?? null;
    }
    if (placement === AUTO_PRODUCTION_ANNULUS || placement === AUTO_A_ANNULUS) {
        return annuli[0]?.index ?? null;
    }
    if (placement === AUTO_B_ANNULUS) {
        return annuli[1]?.index ?? null;
    }
    if (placement === AUTO_C_ANNULUS) {
        return annuli[2]?.index ?? null;
    }
    if (placement.toLowerCase().startsWith('behind:')) {
        const casingRef = placement.slice(placement.indexOf(':') + 1).trim();
        if (!casingRef) return null;
        const casing = resolveCasingReference(casingRef, context.casingRefMap, context.casingRows, placementRefId);
        if (!casing) return null;
        const slot = annuli.find((item) => (
            item.innerPipe?.pipeType === PIPE_TYPE_CASING &&
            item.innerPipe.__index === casing.__index
        ));
        return slot?.index ?? null;
    }

    return null;
}

function resolveFluidIntent(row, annuli, context) {
    const placement = normalizeFluidPlacementToken(row?.placement);
    if (!placement) return null;
    if (annuli.length === 0) return null;

    const placementRefId = String(row?.placementRefId ?? '').trim() || null;
    const annulusIndex = resolveAnnulusIndexForPlacement(placement, annuli, context, placementRefId);
    if (!Number.isInteger(annulusIndex)) return null;
    const manualOD = parseOptionalNumber(row?.manualOD);

    return {
        kind: 'annulus',
        annulusIndex,
        manualOD: Number.isFinite(manualOD) && manualOD > 0 ? manualOD : null
    };
}

function resolveFluidAssignmentsAtDepth(depth, context, annuli) {
    const slotMatches = new Map();

    const activeRows = context.fluidRows.filter((row) => isDepthWithin(depth, row.top, row.bottom));
    activeRows.forEach((row) => {
        const intent = resolveFluidIntent(row, annuli, context);
        if (!intent) return;

        // Deterministic collision rule: the last active row in table order wins a slot.
        slotMatches.set(intent.annulusIndex, {
            row,
            manualOD: intent.manualOD
        });
    });

    return { slotMatches };
}

function resolveDepthContext(depth, input) {
    const context = resolveContext(input);
    if (!Number.isFinite(depth)) {
        return { context, depth, activeSteel: [], activeOpenHoles: [], annuli: [], slotMatches: new Map(), plugMatch: null, outerEnvironmentRadius: 0, maxActiveOpenHoleRadius: 0 };
    }

    const activeCasings = context.casingRows.filter((row) => isDepthWithinInclusive(depth, row.top, row.bottom));
    const activeCasingSteel = activeCasings
        .filter((row) => !row.isOpenHole)
        .sort((a, b) => a.od - b.od);
    const transientRows = context.operationPhase === OPERATION_PHASE_DRILLING
        ? (context.drillStringRows ?? [])
        : (context.tubingRows ?? []);
    const activeTransientRows = transientRows.filter((row) => isDepthWithinInclusive(depth, row.top, row.bottom));
    const activeSteel = [...activeCasingSteel, ...activeTransientRows]
        .sort((a, b) => a.od - b.od);
    const activeOpenHoles = activeCasings
        .filter((row) => row.isOpenHole)
        .sort((a, b) => a.od - b.od);
    const maxActiveOpenHoleRadius = activeOpenHoles.reduce((maxRadius, row) => {
        const radius = parseOptionalNumber(row?.outerRadius);
        return Number.isFinite(radius) ? Math.max(maxRadius, radius) : maxRadius;
    }, 0);

    for (let i = 1; i < activeSteel.length; i += 1) {
        if (Math.abs(activeSteel[i].od - activeSteel[i - 1].od) <= BOUNDARY_TOLERANCE) {
            console.warn('Physics warning: duplicate active pipe OD at depth', depth, activeSteel[i].od);
        }
    }

    const outerEnvironmentRadius = resolveOuterEnvironmentRadius(activeSteel, activeOpenHoles, depth);
    const annuli = buildAnnulusSlots(activeSteel, outerEnvironmentRadius);
    const { slotMatches } = resolveFluidAssignmentsAtDepth(depth, context, annuli);
    const plugMatch = resolvePlugAtDepth(depth, context, activeSteel);

    return {
        context,
        depth,
        activeSteel,
        activeOpenHoles,
        maxActiveOpenHoleRadius,
        outerEnvironmentRadius,
        annuli,
        slotMatches,
        plugMatch
    };
}

function generateGeometrySkeleton(depthContext) {
    const {
        depth,
        context,
        activeSteel,
        activeOpenHoles,
        maxActiveOpenHoleRadius,
        annuli,
        outerEnvironmentRadius
    } = depthContext;

    const layers = [];
    const annulusByIndex = new Map(annuli.map((slot) => [slot.index, slot]));
    const outermostOpenHole = activeOpenHoles[activeOpenHoles.length - 1] ?? null;

    if (activeSteel.length > 0) {
        const innermost = activeSteel[0];
        if (innermost.innerRadius > EPSILON) {
            layers.push({
                role: 'core',
                material: 'wellbore',
                innerRadius: 0,
                outerRadius: innermost.innerRadius
            });
        }
    } else {
        if (outerEnvironmentRadius > EPSILON) {
            layers.push({
                role: 'core',
                material: 'wellbore',
                innerRadius: 0,
                outerRadius: outerEnvironmentRadius
            });
        }
        if (activeOpenHoles.length > 0 && outerEnvironmentRadius > EPSILON) {
            layers.push({
                role: 'core-boundary',
                material: 'void',
                innerRadius: 0,
                outerRadius: outerEnvironmentRadius,
                isOpenHoleBoundary: true,
                source: outermostOpenHole
                    ? {
                        type: 'pipe',
                        pipeType: PIPE_TYPE_CASING,
                        index: outermostOpenHole.__index,
                        sourceIndex: outermostOpenHole.sourceIndex ?? outermostOpenHole.__index
                    }
                    : null
            });
        }
    }

    for (let i = 0; i < activeSteel.length; i += 1) {
        const pipe = activeSteel[i];

        if (pipe.outerRadius > pipe.innerRadius + EPSILON) {
            layers.push({
                role: 'pipe',
                material: 'steel',
                innerRadius: pipe.innerRadius,
                outerRadius: pipe.outerRadius,
                source: {
                    type: 'pipe',
                    pipeType: pipe.pipeType,
                    index: pipe.__index,
                    sourceIndex: pipe.sourceIndex ?? pipe.__index
                },
                pipeType: pipe.pipeType,
                componentType: pipe.componentType,
                isPerforated: pipe.pipeType === 'casing'
                    ? isPerforated(pipe.__index, depth, context)
                    : false
            });
        }

        const annulusSlot = annulusByIndex.get(i) ?? null;
        if (!annulusSlot) continue;

        const manualHoleSize = parseOptionalNumber(pipe.manualHoleSize);
        const touchesFormation = annulusSlot.isFormation && (
            maxActiveOpenHoleRadius > annulusSlot.innerRadius + EPSILON ||
            (Number.isFinite(manualHoleSize) && manualHoleSize > pipe.od + EPSILON)
        );
        const interactionSourcePipe = touchesFormation && outermostOpenHole
            ? outermostOpenHole
            : pipe;

        layers.push({
            role: 'annulus',
            material: 'unresolved',
            innerRadius: annulusSlot.innerRadius,
            outerRadius: annulusSlot.outerRadius,
            source: {
                type: 'pipe',
                pipeType: interactionSourcePipe.pipeType,
                index: interactionSourcePipe.__index,
                sourceIndex: interactionSourcePipe.sourceIndex ?? interactionSourcePipe.__index
            },
            slotIndex: annulusSlot.index,
            innerPipe: annulusSlot.innerPipe,
            isFormation: annulusSlot.isFormation,
            isOpenHoleBoundary: touchesFormation
        });
    }

    return layers;
}

function resolveAnnulusMaterials(layers, depthContext) {
    const { depth, slotMatches } = depthContext;
    return layers.map((layer) => {
        if (layer.role !== 'annulus') return layer;

        const fluidAssignment = slotMatches.get(layer.slotIndex) || null;
        if (fluidAssignment) {
            const fluidRow = fluidAssignment.row;
            const manualODOverride = resolveManualFluidOverrideForAnnulus(layer, fluidAssignment.manualOD);
            return {
                ...layer,
                material: 'fluid',
                outerRadius: manualODOverride?.appliedOuterRadius ?? layer.outerRadius,
                manualODOverride,
                source: { type: 'fluid', index: fluidRow.__index },
                label: fluidRow.label,
                color: fluidRow.color,
                hatchStyle: fluidRow.hatchStyle,
                textColor: fluidRow.textColor,
                fontSize: fluidRow.fontSize,
                placement: fluidRow.placement
            };
        }

        if (hasCementAtDepth(layer.innerPipe, depth) || hasInheritedCementAtDepth(layer, depth, depthContext)) {
            return {
                ...layer,
                material: 'cement',
                source: { type: 'casing', index: layer.innerPipe?.__index }
            };
        }

        return {
            ...layer,
            material: 'mud'
        };
    });
}

function resolveManualFluidOverrideForAnnulus(layer, manualOD) {
    const requestedOD = parseOptionalNumber(manualOD);
    if (!Number.isFinite(requestedOD) || requestedOD <= 0) return null;

    const innerRadius = parseOptionalNumber(layer?.innerRadius);
    const outerRadius = parseOptionalNumber(layer?.outerRadius);
    if (!Number.isFinite(innerRadius) || !Number.isFinite(outerRadius) || outerRadius <= innerRadius + EPSILON) {
        return null;
    }

    const requestedOuterRadius = requestedOD / 2;
    const minimumOuterRadius = innerRadius + EPSILON;
    const maximumOuterRadius = outerRadius;
    const appliedOuterRadius = Math.min(Math.max(requestedOuterRadius, minimumOuterRadius), maximumOuterRadius);
    if (!Number.isFinite(appliedOuterRadius) || appliedOuterRadius <= innerRadius + EPSILON) {
        return null;
    }

    return {
        requestedOD,
        requestedOuterRadius,
        minimumOD: minimumOuterRadius * 2,
        maximumOD: maximumOuterRadius * 2,
        appliedOD: appliedOuterRadius * 2,
        appliedOuterRadius,
        wasClamped: Math.abs(appliedOuterRadius - requestedOuterRadius) > EPSILON
    };
}

function applyToolOverlays(layers, depthContext) {
    const { plugMatch } = depthContext;
    const baseLayers = Array.isArray(layers) ? layers : [];
    return applyPlugOverlayToStack(baseLayers, plugMatch);
}

export function getStackAtDepth(depth, input) {
    const depthContext = resolveDepthContext(depth, input);
    if (!Number.isFinite(depthContext.depth)) return [];

    let layers = generateGeometrySkeleton(depthContext);
    layers = resolveAnnulusMaterials(layers, depthContext);
    layers = applyToolOverlays(layers, depthContext);

    return layers;
}

export default {
    defaultPhysicsState,
    createContext,
    resolveConnections,
    resolveHangers,
    getCriticalDepths,
    getIntervals,
    getIntervalsWithBoundaryReasons,
    getStackAtDepth
};
