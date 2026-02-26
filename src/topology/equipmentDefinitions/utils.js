import { NODE_KIND_BORE, TOPOLOGY_VOLUME_KINDS } from '@/topology/topologyTypes.js';

export function buildSealByVolumeDefaults({ bore = false, annulus = false } = {}) {
    const defaults = {};
    TOPOLOGY_VOLUME_KINDS.forEach((volumeKey) => {
        defaults[volumeKey] = volumeKey === NODE_KIND_BORE
            ? Boolean(bore)
            : Boolean(annulus);
    });
    return defaults;
}

export function normalizeToken(value) {
    return String(value ?? '').trim().toLowerCase();
}

