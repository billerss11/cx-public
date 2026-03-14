import { sortSurfaceChannelKeys } from '@/surface/model.js';

function toVisibleRows(rows = []) {
    return Array.isArray(rows) ? rows.filter((row) => row?.show !== false) : [];
}

export function resolveAvailableSurfaceChannels(projectData = {}) {
    const casingCount = toVisibleRows(projectData?.casingData).length;
    const tubingCount = toVisibleRows(projectData?.tubingData).length;
    const availableChannels = [];

    if (casingCount > 0 || tubingCount > 0) {
        availableChannels.push('TUBING_INNER');
    }

    const annulusCount = Math.max(0, casingCount - 1 + (tubingCount > 0 ? 1 : 0));
    if (annulusCount >= 1) availableChannels.push('ANNULUS_A');
    if (annulusCount >= 2) availableChannels.push('ANNULUS_B');
    if (annulusCount >= 3) availableChannels.push('ANNULUS_C');
    if (annulusCount >= 4) availableChannels.push('ANNULUS_D');
    if (annulusCount >= 5) availableChannels.push('ANNULUS_E');
    if (annulusCount >= 6) availableChannels.push('ANNULUS_F');

    return sortSurfaceChannelKeys(availableChannels);
}

export default {
    resolveAvailableSurfaceChannels
};
