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
