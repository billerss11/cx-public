export const SURFACE_CHANNEL_ORDER = Object.freeze([
    'TUBING_INNER',
    'ANNULUS_A',
    'ANNULUS_B',
    'ANNULUS_C',
    'ANNULUS_D',
    'ANNULUS_E',
    'ANNULUS_F',
    'FORMATION_ANNULUS'
]);

export const SURFACE_CHANNEL_LABELS = Object.freeze({
    TUBING_INNER: 'Tubing',
    ANNULUS_A: 'Annulus A',
    ANNULUS_B: 'Annulus B',
    ANNULUS_C: 'Annulus C',
    ANNULUS_D: 'Annulus D',
    ANNULUS_E: 'Annulus E',
    ANNULUS_F: 'Annulus F',
    FORMATION_ANNULUS: 'Formation Annulus'
});

export const SURFACE_COMPONENT_TYPES = Object.freeze(['valve', 'outlet', 'crossover']);

export const SURFACE_COMPONENT_TYPE_LABELS = Object.freeze({
    valve: 'Valve',
    outlet: 'Outlet',
    crossover: 'Crossover'
});

export const SURFACE_STATUS_OPTIONS = Object.freeze([
    'open', 'closed', 'failed_open', 'failed_closed', 'leaking'
]);

export const SURFACE_STATUS_LABELS = Object.freeze({
    open: 'Open',
    closed: 'Closed',
    failed_open: 'Failed Open',
    failed_closed: 'Failed Closed',
    leaking: 'Leaking'
});

export const SURFACE_CROSSOVER_DIRECTION_OPTIONS = Object.freeze([
    'bidirectional', 'forward', 'reverse'
]);

export const SURFACE_CROSSOVER_DIRECTION_LABELS = Object.freeze({
    bidirectional: 'Bidirectional',
    forward: 'Forward',
    reverse: 'Reverse'
});

export function toSurfaceChannelLabel(channelKey) {
    return SURFACE_CHANNEL_LABELS[String(channelKey ?? '').trim()] ?? String(channelKey ?? '').trim();
}

export function sortSurfaceChannelKeys(channelKeys = []) {
    const orderByKey = new Map(SURFACE_CHANNEL_ORDER.map((channelKey, index) => [channelKey, index]));
    return [...new Set(channelKeys.filter(Boolean))].sort((left, right) => {
        const leftOrder = orderByKey.get(left);
        const rightOrder = orderByKey.get(right);
        if (Number.isInteger(leftOrder) && Number.isInteger(rightOrder)) {
            return leftOrder - rightOrder;
        }
        if (Number.isInteger(leftOrder)) return -1;
        if (Number.isInteger(rightOrder)) return 1;
        return String(left).localeCompare(String(right));
    });
}

export function toSurfaceStatusLabel(status) {
    return SURFACE_STATUS_LABELS[String(status ?? '').trim()] ?? String(status ?? '').trim();
}

export function toSurfaceComponentTypeLabel(componentType) {
    return SURFACE_COMPONENT_TYPE_LABELS[String(componentType ?? '').trim()] ?? String(componentType ?? '').trim();
}

export function sortSurfaceComponentsByChannel(components = []) {
    const orderByKey = new Map(SURFACE_CHANNEL_ORDER.map((key, index) => [key, index]));
    return [...components].sort((a, b) => {
        const aOrder = orderByKey.get(a.channelKey) ?? 999;
        const bOrder = orderByKey.get(b.channelKey) ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.sequence ?? 0) - (b.sequence ?? 0);
    });
}
