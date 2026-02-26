import { normalizeRowId } from '@/utils/rowIdentity.js';
import {
    buildPipeReferenceOptions,
    normalizePipeHostType,
    PIPE_HOST_TYPE_CASING,
    PIPE_HOST_TYPE_TUBING
} from '@/utils/pipeReference.js';

const EQUIPMENT_ATTACH_PREFIX_BY_HOST_TYPE = Object.freeze({
    [PIPE_HOST_TYPE_TUBING]: 'Tubing',
    [PIPE_HOST_TYPE_CASING]: 'Casing'
});

function normalizeToken(value) {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
}

function buildHostAttachOptions(rows = [], hostType = PIPE_HOST_TYPE_CASING) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const references = buildPipeReferenceOptions(safeRows, hostType);
    const hostLabel = EQUIPMENT_ATTACH_PREFIX_BY_HOST_TYPE[hostType] ?? 'Host';

    return safeRows
        .map((row, index) => {
            const rowId = normalizeRowId(row?.rowId);
            if (!rowId) return null;

            const fallbackReference = `#${index + 1}`;
            const reference = normalizeToken(references[index]) ?? fallbackReference;
            const value = `${hostLabel} | ${reference}`;
            return Object.freeze({
                value,
                label: value,
                hostType,
                rowId,
                reference
            });
        })
        .filter(Boolean);
}

export function isPackerEquipmentType(typeValue) {
    const normalized = String(typeValue ?? '').trim().toLowerCase();
    return normalized.includes('packer');
}

export function normalizeEquipmentAttachHostType(hostTypeValue) {
    const raw = normalizeToken(hostTypeValue);
    if (!raw) return null;
    return normalizePipeHostType(raw, null);
}

export function buildEquipmentAttachOptions(casingRows = [], tubingRows = []) {
    return Object.freeze([
        ...buildHostAttachOptions(tubingRows, PIPE_HOST_TYPE_TUBING),
        ...buildHostAttachOptions(casingRows, PIPE_HOST_TYPE_CASING)
    ]);
}

export function findEquipmentAttachOptionByValue(displayValue, options = []) {
    const normalizedDisplay = normalizeToken(displayValue);
    if (!normalizedDisplay) return null;
    const safeOptions = Array.isArray(options) ? options : [];
    return safeOptions.find((option) => option.value === normalizedDisplay) ?? null;
}

export function findEquipmentAttachOptionByHostAndId(hostTypeValue, attachToId, options = []) {
    const normalizedHostType = normalizeEquipmentAttachHostType(hostTypeValue);
    const normalizedRowId = normalizeRowId(attachToId);
    if (!normalizedHostType || !normalizedRowId) return null;

    const safeOptions = Array.isArray(options) ? options : [];
    return safeOptions.find((option) => (
        option.hostType === normalizedHostType
        && option.rowId === normalizedRowId
    )) ?? null;
}

export function resolveEquipmentAttachOption(row = {}, options = []) {
    const byDisplay = findEquipmentAttachOptionByValue(row?.attachToDisplay, options);
    if (byDisplay) return byDisplay;
    return findEquipmentAttachOptionByHostAndId(row?.attachToHostType, row?.attachToId, options);
}

export default {
    isPackerEquipmentType,
    normalizeEquipmentAttachHostType,
    buildEquipmentAttachOptions,
    findEquipmentAttachOptionByValue,
    findEquipmentAttachOptionByHostAndId,
    resolveEquipmentAttachOption
};
