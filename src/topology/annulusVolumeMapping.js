import {
    resolveAnnulusLayerByIndex,
    resolveAnnulusSlotIndex
} from '@/utils/physicsLayers.js';
import {
    MAX_MODELED_ANNULUS_SLOT_INDEX,
    MODELED_ANNULUS_VOLUME_SLOTS,
    NODE_KIND_TUBING_ANNULUS
} from '@/topology/topologyTypes.js';

const PIPE_TYPE_TUBING = 'tubing';

function isTubingPipeType(value) {
    return String(value ?? '').trim().toLowerCase() === PIPE_TYPE_TUBING;
}

function resolveModeledAnnulusSlotByKind(kind) {
    return MODELED_ANNULUS_VOLUME_SLOTS.find((slot) => slot.kind === kind) ?? null;
}

function resolveModeledAnnulusSlotByIndex(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;
    return MODELED_ANNULUS_VOLUME_SLOTS.find((slot) => slot.slotIndex === slotIndex) ?? null;
}

export function hasTubingAnnulusLayer(stack = []) {
    const slotZeroLayer = resolveAnnulusLayerByIndex(stack, 0);
    if (!slotZeroLayer || slotZeroLayer?.role !== 'annulus') return false;
    return isTubingPipeType(slotZeroLayer?.innerPipe?.pipeType);
}

export function resolvePhysicalSlotIndexForCasingAnnulusKind(kind, stack = []) {
    const modeledSlot = resolveModeledAnnulusSlotByKind(kind);
    if (!modeledSlot) return null;
    return modeledSlot.slotIndex + (hasTubingAnnulusLayer(stack) ? 1 : 0);
}

export function resolveAnnulusLayerForVolumeKind(stack = [], volumeKind = '') {
    if (volumeKind === NODE_KIND_TUBING_ANNULUS) {
        if (!hasTubingAnnulusLayer(stack)) return null;
        return resolveAnnulusLayerByIndex(stack, 0);
    }

    const physicalSlotIndex = resolvePhysicalSlotIndexForCasingAnnulusKind(volumeKind, stack);
    if (!Number.isInteger(physicalSlotIndex)) return null;
    return resolveAnnulusLayerByIndex(stack, physicalSlotIndex);
}

export function resolveVolumeKindForAnnulusLayer(stack = [], annulusLayer = null) {
    if (!annulusLayer || annulusLayer?.role !== 'annulus') return null;

    const slotIndex = resolveAnnulusSlotIndex(annulusLayer);
    if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;

    if (hasTubingAnnulusLayer(stack)) {
        if (slotIndex === 0 && isTubingPipeType(annulusLayer?.innerPipe?.pipeType)) {
            return NODE_KIND_TUBING_ANNULUS;
        }
        const casingSlot = resolveModeledAnnulusSlotByIndex(slotIndex - 1);
        return casingSlot?.kind ?? null;
    }

    const casingSlot = resolveModeledAnnulusSlotByIndex(slotIndex);
    return casingSlot?.kind ?? null;
}

export function resolveMaxModeledAnnulusSlotIndexForStack(stack = []) {
    return MAX_MODELED_ANNULUS_SLOT_INDEX + (hasTubingAnnulusLayer(stack) ? 1 : 0);
}

export default {
    hasTubingAnnulusLayer,
    resolvePhysicalSlotIndexForCasingAnnulusKind,
    resolveAnnulusLayerForVolumeKind,
    resolveVolumeKindForAnnulusLayer,
    resolveMaxModeledAnnulusSlotIndexForStack
};
