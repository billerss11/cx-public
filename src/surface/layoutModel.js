import { sortSurfaceChannelKeys, toSurfaceChannelLabel } from '@/surface/model.js';

const DETAIL_BAND_HEIGHT = 132;
const ASSUMPTION_BAND_HEIGHT = 44;
const CONDENSED_BAND_HEIGHT = 220;

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

function toSafeRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function countVisibleItems(surfacePaths = []) {
    return toSafeArray(surfacePaths).reduce((total, path) => (
        total + toSafeArray(path?.items).length
    ), 0);
}

function hasAssumptionSummary(summaryByChannel = {}) {
    return Object.values(toSafeRecord(summaryByChannel)).some((entry) => (
        String(entry?.routeStatus ?? '').trim() === 'assumed'
    ));
}

function resolveLaneSummaryLabel(summaryEntry = {}) {
    const routeStatus = String(summaryEntry?.routeStatus ?? '').trim();
    const currentState = String(summaryEntry?.currentState ?? '').trim();
    const outletLabels = toSafeArray(summaryEntry?.outletLabels).filter(Boolean);
    if (routeStatus === 'assumed') return 'Assumed surface path';
    if (currentState === 'blocked') return 'Blocked';
    if (outletLabels.length > 0) return outletLabels.join(', ');
    if (currentState === 'missing_outlet') return 'Missing outlet';
    return 'Surface route';
}

export function buildSurfaceLayoutModel(options = {}) {
    const surfacePaths = toSafeArray(options?.surfacePaths);
    const surfaceTransfers = toSafeArray(options?.surfaceTransfers);
    const surfaceOutlets = toSafeArray(options?.surfaceOutlets);
    const summaryByChannel = toSafeRecord(options?.surfaceSummary?.byChannel);
    const channelKeys = sortSurfaceChannelKeys([
        ...surfacePaths.map((path) => path?.channelKey),
        ...Object.keys(summaryByChannel)
    ]);

    const authoredLaneCount = surfacePaths.length;
    const visibleItemCount = countVisibleItems(surfacePaths);
    const transferCount = surfaceTransfers.length;
    const hasAuthoredContent = authoredLaneCount > 0 || surfaceOutlets.length > 0 || transferCount > 0;
    const shouldCondense = authoredLaneCount > 4 || visibleItemCount > 14 || transferCount > 4;
    const shouldShowAssumptionBand = !hasAuthoredContent && hasAssumptionSummary(summaryByChannel);

    const lanes = channelKeys.map((channelKey) => {
        const summaryEntry = summaryByChannel[channelKey] ?? {};
        const path = surfacePaths.find((candidate) => candidate?.channelKey === channelKey) ?? null;
        return {
            channelKey,
            label: toSurfaceChannelLabel(channelKey),
            path,
            items: toSafeArray(path?.items),
            summaryEntry,
            summaryLabel: resolveLaneSummaryLabel(summaryEntry)
        };
    });

    if (shouldCondense) {
        return {
            bandHeight: CONDENSED_BAND_HEIGHT,
            displayMode: 'condensed',
            lanes
        };
    }

    if (shouldShowAssumptionBand) {
        return {
            bandHeight: ASSUMPTION_BAND_HEIGHT,
            displayMode: 'assumption',
            lanes
        };
    }

    if (hasAuthoredContent) {
        return {
            bandHeight: DETAIL_BAND_HEIGHT,
            displayMode: 'detail',
            lanes
        };
    }

    return {
        bandHeight: 0,
        displayMode: 'hidden',
        lanes: []
    };
}

export default {
    buildSurfaceLayoutModel
};
