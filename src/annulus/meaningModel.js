import { getIntervals, getStackAtDepth } from '@/physics/physicsCore.js';
import { toSurfaceChannelLabel } from '@/surface/model.js';
import {
    MODELED_ANNULUS_VOLUME_SLOTS,
    NODE_KIND_FORMATION_ANNULUS
} from '@/topology/topologyTypes.js';
import { formatDepthValue } from '@/utils/general.js';
import { resolveAnnulusSlotIndex } from '@/utils/physicsLayers.js';

const ANNULUS_ROW_ORDER = Object.freeze([
    ...MODELED_ANNULUS_VOLUME_SLOTS.map((slot) => slot.kind),
    NODE_KIND_FORMATION_ANNULUS
]);

const MODELED_KIND_BY_SLOT_INDEX = new Map(
    MODELED_ANNULUS_VOLUME_SLOTS.map((slot) => [slot.slotIndex, slot.kind])
);

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

function toToken(value) {
    const token = String(value ?? '').trim();
    return token || null;
}

function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function resolveUnitsLabel(stateSnapshot = {}, options = {}) {
    const explicitUnits = toToken(options?.unitsLabel);
    if (explicitUnits) return explicitUnits;
    const configUnits = toToken(stateSnapshot?.config?.units);
    return configUnits ?? 'ft';
}

function resolvePipeDisplayLabel(pipe = null) {
    const explicitLabel = toToken(pipe?.label);
    if (explicitLabel) return explicitLabel;

    const pipeType = String(pipe?.pipeType ?? '').trim().toLowerCase();
    if (pipeType === 'tubing') return 'Tubing';
    if (pipeType === 'drillstring' || pipeType === 'drill_string' || pipeType === 'drill-string') {
        return 'Drill string';
    }
    if (pipeType === 'casing') return 'Casing';
    return 'Pipe';
}

function nearlyEqual(left, right, epsilon = 1e-6) {
    return Math.abs(Number(left) - Number(right)) <= epsilon;
}

function resolvePipeRowsByType(stateSnapshot = {}, pipeType = '') {
    const normalizedType = String(pipeType ?? '').trim().toLowerCase();
    if (normalizedType === 'tubing') return toSafeArray(stateSnapshot?.tubingData);
    if (normalizedType === 'drillstring' || normalizedType === 'drill_string' || normalizedType === 'drill-string') {
        return toSafeArray(stateSnapshot?.drillStringData);
    }
    return toSafeArray(stateSnapshot?.casingData);
}

function resolvePipeDisplayLabelFromLayer(pipeLayer = null, stateSnapshot = {}) {
    const sourceIndex = Number(pipeLayer?.source?.sourceIndex ?? pipeLayer?.source?.index);
    const pipeType = String(pipeLayer?.pipeType ?? pipeLayer?.source?.pipeType ?? '').trim();
    const candidateRows = resolvePipeRowsByType(stateSnapshot, pipeType);
    if (Number.isInteger(sourceIndex) && sourceIndex >= 0) {
        const sourceRow = candidateRows[sourceIndex] ?? null;
        const sourceLabel = toToken(sourceRow?.label);
        if (sourceLabel) return sourceLabel;
    }

    return resolvePipeDisplayLabel({
        label: null,
        pipeType
    });
}

function resolvePipeIdentity(pipe = null) {
    const rowId = toToken(pipe?.rowId);
    if (rowId) return rowId;
    return resolvePipeDisplayLabel(pipe);
}

function resolveOuterBoundaryLabel(layer = {}, stack = [], stateSnapshot = {}) {
    if (layer?.isFormation === true) return 'formation/open hole';
    const outerRadius = toFiniteNumber(layer?.outerRadius);
    if (!Number.isFinite(outerRadius)) return 'Pipe';

    const outerPipeLayer = toSafeArray(stack).find((candidate) => (
        candidate?.role === 'pipe'
        && candidate?.material === 'steel'
        && nearlyEqual(candidate?.innerRadius, outerRadius)
    )) ?? null;
    if (outerPipeLayer) return resolvePipeDisplayLabelFromLayer(outerPipeLayer, stateSnapshot);

    return 'Pipe';
}

function resolveChannelKeyForAnnulusLayer(layer = {}) {
    if (layer?.role !== 'annulus') return null;

    if (layer?.isFormation === true) return NODE_KIND_FORMATION_ANNULUS;

    const slotIndex = resolveAnnulusSlotIndex(layer);
    if (Number.isInteger(slotIndex) && MODELED_KIND_BY_SLOT_INDEX.has(slotIndex)) {
        return MODELED_KIND_BY_SLOT_INDEX.get(slotIndex);
    }
    return null;
}

function buildDepthLabel(top, bottom, unitsLabel = 'ft') {
    return `${formatDepthValue(top)}-${formatDepthValue(bottom)} ${unitsLabel} MD`;
}

function buildSegment(interval = {}, layer = {}, stack = [], stateSnapshot = {}, unitsLabel = 'ft') {
    const top = toFiniteNumber(interval?.top);
    const bottom = toFiniteNumber(interval?.bottom);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;

    const innerPipeLabel = resolvePipeDisplayLabel(layer?.innerPipe ?? null);
    const innerPipeIdentity = resolvePipeIdentity(layer?.innerPipe ?? null);
    const outerPipeLabel = resolveOuterBoundaryLabel(layer, stack, stateSnapshot);
    const outerRadius = toFiniteNumber(layer?.outerRadius);
    const outerPipeLayer = toSafeArray(stack).find((candidate) => (
        candidate?.role === 'pipe'
        && candidate?.material === 'steel'
        && nearlyEqual(candidate?.innerRadius, outerRadius)
    )) ?? null;
    const outerPipeIdentity = outerPipeLayer
        ? resolvePipeIdentity(outerPipeLayer)
        : outerPipeLabel;
    return {
        top,
        bottom,
        depthLabel: buildDepthLabel(top, bottom, unitsLabel),
        description: `between ${innerPipeLabel} and ${outerPipeLabel}`,
        innerPipeLabel,
        innerPipeIdentity,
        outerPipeLabel,
        outerPipeIdentity,
        isFormation: layer?.isFormation === true
    };
}

function canMergeSegments(current = null, next = null, epsilon = 1e-6) {
    if (!current || !next) return false;
    if (!Number.isFinite(current.bottom) || !Number.isFinite(next.top)) return false;
    return Math.abs(current.bottom - next.top) <= epsilon
        && current.description === next.description
        && current.innerPipeLabel === next.innerPipeLabel
        && current.outerPipeLabel === next.outerPipeLabel
        && current.isFormation === next.isFormation;
}

function appendSegment(row, segment, unitsLabel = 'ft') {
    const segments = toSafeArray(row?.segments);
    const previousSegment = segments[segments.length - 1] ?? null;
    if (canMergeSegments(previousSegment, segment)) {
        previousSegment.bottom = segment.bottom;
        previousSegment.depthLabel = buildDepthLabel(previousSegment.top, previousSegment.bottom, unitsLabel);
        return;
    }

    segments.push(segment);
    row.segments = segments;
}

export function buildAnnulusMeaningRows(stateSnapshot = {}, options = {}) {
    const unitsLabel = resolveUnitsLabel(stateSnapshot, options);
    const rowsByChannelKey = new Map();
    const intervals = toSafeArray(getIntervals(stateSnapshot))
        .map((interval) => {
            const top = toFiniteNumber(interval?.top);
            const bottom = toFiniteNumber(interval?.bottom);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
            return {
                top,
                bottom,
                midpoint: (top + bottom) / 2
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.top - right.top);

    intervals.forEach((interval) => {
        const stack = toSafeArray(getStackAtDepth(interval.midpoint, stateSnapshot));
        stack.forEach((layer) => {
            const channelKey = resolveChannelKeyForAnnulusLayer(layer);
            if (!channelKey) return;

            const segment = buildSegment(interval, layer, stack, stateSnapshot, unitsLabel);
            if (!segment) return;

            if (!rowsByChannelKey.has(channelKey)) {
                rowsByChannelKey.set(channelKey, {
                    channelKey,
                    label: toSurfaceChannelLabel(channelKey),
                    segments: []
                });
            }
            const row = rowsByChannelKey.get(channelKey);
            const usesFixedSurfacePair = channelKey !== 'ANNULUS_A' && channelKey !== NODE_KIND_FORMATION_ANNULUS;
            if (usesFixedSurfacePair) {
                const pairIdentity = `${segment.innerPipeIdentity}|${segment.outerPipeIdentity}`;
                if (!row.canonicalPairIdentity) {
                    row.canonicalPairIdentity = pairIdentity;
                }
                if (row.canonicalPairIdentity !== pairIdentity) {
                    return;
                }
            }
            appendSegment(row, segment, unitsLabel);
        });
    });

    return ANNULUS_ROW_ORDER
        .map((channelKey) => {
            const row = rowsByChannelKey.get(channelKey) ?? null;
            if (!row) return null;
            return {
                channelKey: row.channelKey,
                label: row.label,
                segments: row.segments
            };
        })
        .filter((row) => row && toSafeArray(row.segments).length > 0);
}

export default {
    buildAnnulusMeaningRows
};
