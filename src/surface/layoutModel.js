import { sortSurfaceChannelKeys, toSurfaceChannelLabel } from '@/surface/model.js';

const LANE_HEIGHT = 40;
const PADDING = 24;
const MIN_BAND_HEIGHT = 44;

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

function toSafeRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function groupComponentsByChannel(components = []) {
    const byChannel = new Map();
    toSafeArray(components)
        .filter((row) => row?.show !== false)
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .forEach((row) => {
            const channelKey = String(row?.channelKey ?? '').trim();
            if (!channelKey) return;
            if (!byChannel.has(channelKey)) {
                byChannel.set(channelKey, []);
            }
            byChannel.get(channelKey).push(row);
        });
    return byChannel;
}

export function buildSurfaceLayoutModel(options = {}) {
    const surfaceComponents = toSafeArray(options?.surfaceComponents);
    const summaryByChannel = toSafeRecord(options?.surfaceSummary?.byChannel);

    const componentsByChannel = groupComponentsByChannel(surfaceComponents);
    const channelKeys = sortSurfaceChannelKeys([
        ...componentsByChannel.keys(),
        ...Object.keys(summaryByChannel)
    ]);

    const hasAuthoredContent = surfaceComponents.some((row) => row?.show !== false);
    const shouldShowAssumptionBand = !hasAuthoredContent && hasAssumptionSummary(summaryByChannel);

    const lanes = channelKeys.map((channelKey) => {
        const summaryEntry = summaryByChannel[channelKey] ?? {};
        const components = componentsByChannel.get(channelKey) ?? [];
        return {
            channelKey,
            label: toSurfaceChannelLabel(channelKey),
            components,
            summaryEntry,
            summaryLabel: resolveLaneSummaryLabel(summaryEntry)
        };
    });

    if (shouldShowAssumptionBand) {
        return {
            bandHeight: MIN_BAND_HEIGHT,
            displayMode: 'assumption',
            lanes
        };
    }

    if (hasAuthoredContent && lanes.length > 0) {
        const bandHeight = Math.max(MIN_BAND_HEIGHT, PADDING + (lanes.length * LANE_HEIGHT));
        return {
            bandHeight,
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
