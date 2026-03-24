import { sortSurfaceChannelKeys } from '@/surface/model.js';

function toVisibleRows(rows = []) {
    return Array.isArray(rows) ? rows.filter((row) => row?.show !== false) : [];
}

/**
 * Only casings whose top depth matches the wellhead (shallowest top)
 * form annuli at the surface. Liners and open-hole sections that
 * start deeper do not reach the wellhead.
 */
function countCasingsAtSurface(visibleCasings) {
    if (visibleCasings.length === 0) return 0;
    const tops = visibleCasings.map((r) => Number(r?.top)).filter(Number.isFinite);
    if (tops.length === 0) return visibleCasings.length;
    const wellheadDepth = Math.min(...tops);
    return visibleCasings.filter((r) => Number(r?.top) === wellheadDepth).length;
}

export function resolveAvailableSurfaceChannels(projectData = {}) {
    const visibleCasings = toVisibleRows(projectData?.casingData);
    const tubingCount = toVisibleRows(projectData?.tubingData).length;
    const surfaceCasingCount = countCasingsAtSurface(visibleCasings);
    const availableChannels = [];

    if (surfaceCasingCount > 0 || tubingCount > 0) {
        availableChannels.push('TUBING_INNER');
    }

    const annulusCount = Math.max(0, surfaceCasingCount - 1 + (tubingCount > 0 ? 1 : 0));
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
