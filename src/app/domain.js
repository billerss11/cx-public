import { normalizeEnumInput } from './i18n.js';

function normalizeEnum(type, value, fallback) {
    const normalized = normalizeEnumInput(type, value);
    const token = String(normalized ?? '').trim();
    return token || fallback;
}

export function normalizePlugType(value) {
    return normalizeEnum('plugType', value, 'cement');
}

export function normalizeMarkerType(value) {
    return normalizeEnum('markerType', value, 'perforation');
}

export function normalizeMarkerSide(value) {
    return normalizeEnum('markerSide', value, 'both');
}

export function normalizeTargetMode(value) {
    return normalizeEnum('targetMode', value, 'inner');
}

export function normalizeLineStyle(value) {
    return normalizeEnum('lineStyle', value, 'solid');
}

export function normalizeLinerMode(value) {
    return normalizeEnum('linerMode', value, 'auto');
}

export function normalizeHatchStyle(value) {
    return normalizeEnum('hatchStyle', value, 'none');
}

export function isOpenHoleRow(row) {
    if (!row) return false;

    const grade = String(row.grade ?? '').toUpperCase();
    if (grade.includes('OH') || grade.includes('OPENHOLE')) return true;

    const label = String(row.label ?? '').trim().toUpperCase();
    return label.includes('OPEN HOLE') || label.includes('OPENHOLE');
}
