const EPSILON = 1e-6;

function toSafeStack(stack) {
    return Array.isArray(stack) ? stack : [];
}

function hasPositiveThickness(layer) {
    const innerRadius = Number(layer?.innerRadius);
    const outerRadius = Number(layer?.outerRadius);
    return Number.isFinite(innerRadius)
        && Number.isFinite(outerRadius)
        && outerRadius > innerRadius + EPSILON;
}

export function resolveBoreLayer(stack = []) {
    return toSafeStack(stack).find((layer) => (
        (layer?.material === 'wellbore' || layer?.role === 'core')
        && hasPositiveThickness(layer)
    )) ?? null;
}

export function resolveAnnulusSlotIndex(layer = {}) {
    const slotIndex = Number(layer?.slotIndex);
    if (Number.isInteger(slotIndex) && slotIndex >= 0) return slotIndex;

    const sourceAnnulusIndex = Number(layer?.source?.annulusIndex);
    if (Number.isInteger(sourceAnnulusIndex) && sourceAnnulusIndex >= 0) {
        return sourceAnnulusIndex;
    }

    return null;
}

export function resolveAnnulusLayerByIndex(stack = [], annulusIndex = 0) {
    const targetIndex = Number(annulusIndex);
    if (!Number.isInteger(targetIndex) || targetIndex < 0) return null;

    return toSafeStack(stack).find((layer) => (
        layer?.role === 'annulus'
        && resolveAnnulusSlotIndex(layer) === targetIndex
        && hasPositiveThickness(layer)
    )) ?? null;
}

export function resolveFormationAnnulusLayer(stack = []) {
    return toSafeStack(stack).find((layer) => (
        layer?.role === 'annulus'
        && layer?.isFormation === true
        && hasPositiveThickness(layer)
    )) ?? null;
}
