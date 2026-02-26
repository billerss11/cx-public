import { TOPOLOGY_WARNING_CODES } from '@/topology/warningCatalog.js';

const SCENARIO_BREAKOUT_WARNING_CODES = Object.freeze([
    TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_VOLUME_PAIR,
    TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_UNSUPPORTED_VOLUME_PAIR,
    TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_DEPTH_RANGE,
    TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_NO_RESOLVABLE_INTERVAL
]);

const BREAKOUT_WARNING_CODE_SET = new Set(SCENARIO_BREAKOUT_WARNING_CODES);

const BREAKOUT_WARNING_FIELDS_BY_CODE = Object.freeze({
    [TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_VOLUME_PAIR]: Object.freeze(['fromVolumeKey', 'toVolumeKey']),
    [TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_UNSUPPORTED_VOLUME_PAIR]: Object.freeze(['fromVolumeKey', 'toVolumeKey']),
    [TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_DEPTH_RANGE]: Object.freeze(['top', 'bottom']),
    [TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_NO_RESOLVABLE_INTERVAL]: Object.freeze(['top', 'bottom', 'fromVolumeKey', 'toVolumeKey'])
});

function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeToken(value) {
    const token = String(value ?? '').trim();
    return token.length > 0 ? token : null;
}

function normalizeWarningFields(fields) {
    return [...new Set(
        toSafeArray(fields)
            .map((field) => normalizeToken(field))
            .filter((field) => field !== null)
    )];
}

function buildBreakoutRowNumberById(breakoutRows = []) {
    const rowNumberById = new Map();
    toSafeArray(breakoutRows).forEach((row, rowIndex) => {
        const rowId = normalizeToken(row?.rowId);
        if (!rowId) return;
        rowNumberById.set(rowId, rowIndex + 1);
    });
    return rowNumberById;
}

export function isScenarioBreakoutWarningCode(code) {
    const normalizedCode = normalizeToken(code);
    return normalizedCode ? BREAKOUT_WARNING_CODE_SET.has(normalizedCode) : false;
}

export function resolveScenarioBreakoutWarningFields(warning = {}) {
    const explicitFields = normalizeWarningFields(warning?.fields);
    if (explicitFields.length > 0) return explicitFields;

    const warningCode = normalizeToken(warning?.code);
    if (!warningCode) return [];
    return normalizeWarningFields(BREAKOUT_WARNING_FIELDS_BY_CODE[warningCode]);
}

function createBreakoutWarningRow(warning, warningIndex, rowNumberById) {
    const warningCode = normalizeToken(warning?.code);
    if (!isScenarioBreakoutWarningCode(warningCode)) return null;

    const rowId = normalizeToken(warning?.rowId);
    if (!rowId) return null;

    const rowNumber = rowNumberById.get(rowId);
    if (!Number.isInteger(rowNumber)) return null;

    return {
        key: `${rowId}-${warningIndex}-${warningCode ?? 'warning'}`,
        rowId,
        rowNumber,
        rowIndex: rowNumber - 1,
        code: warningCode,
        message: String(warning?.message ?? '').trim() || '',
        recommendation: normalizeToken(warning?.recommendation),
        fields: resolveScenarioBreakoutWarningFields(warning)
    };
}

export function buildScenarioBreakoutWarningIndex(breakoutRows = [], validationWarnings = []) {
    const rowNumberById = buildBreakoutRowNumberById(breakoutRows);
    const warnings = [];
    const fieldMapByRowId = new Map();

    toSafeArray(validationWarnings).forEach((warning, warningIndex) => {
        const normalizedWarning = createBreakoutWarningRow(warning, warningIndex, rowNumberById);
        if (!normalizedWarning) return;

        warnings.push(normalizedWarning);
        if (normalizedWarning.fields.length === 0) return;

        const existingFields = fieldMapByRowId.get(normalizedWarning.rowId) ?? new Set();
        normalizedWarning.fields.forEach((field) => {
            existingFields.add(field);
        });
        fieldMapByRowId.set(normalizedWarning.rowId, existingFields);
    });

    return {
        warnings,
        fieldMapByRowId
    };
}

export default {
    isScenarioBreakoutWarningCode,
    resolveScenarioBreakoutWarningFields,
    buildScenarioBreakoutWarningIndex
};
