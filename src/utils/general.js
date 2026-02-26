import { RELATIVE_POS_THRESHOLD, PHYSICS_CONSTANTS, LAYOUT_CONSTANTS } from '@/constants/index.js';
import { t, normalizeEnumInput } from '@/app/i18n.js';

export function cloneSnapshot(state) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(state);
        } catch {
            // Fall through to JSON clone.
        }
    }

    try {
        return JSON.parse(JSON.stringify(state));
    } catch {
        return state;
    }
}

export function resolveXPosition(value, boundaryWidth) {
    if (value === undefined || value === null || value === '') return null;
    let numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return null;
    if (numeric >= -RELATIVE_POS_THRESHOLD && numeric <= RELATIVE_POS_THRESHOLD) {
        return numeric * boundaryWidth;
    }
    return numeric;
}

export function parseOptionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().replace(/,/g, '').replace(/\s+/g, '');
        if (!normalized) return null;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

export function wrapTextToLines(text, maxWidth, fontSize) {
    const safeText = String(text ?? '').trim();
    if (!safeText) return [''];
    const avgCharWidth = fontSize * 0.6;
    const maxChars = Math.max(4, Math.floor(maxWidth / avgCharWidth));
    const baseLines = safeText.split(/\r?\n/);
    const lines = [];

    baseLines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            lines.push('');
            return;
        }
        const hasSpaces = /\s/.test(trimmed);
        if (!hasSpaces) {
            for (let i = 0; i < trimmed.length; i += maxChars) {
                lines.push(trimmed.slice(i, i + maxChars));
            }
            return;
        }
        const words = trimmed.split(/\s+/);
        let current = '';
        words.forEach((word) => {
            const next = current ? `${current} ${word}` : word;
            if (next.length > maxChars && current) {
                lines.push(current);
                current = word;
            } else {
                current = next;
            }
        });
        if (current) lines.push(current);
    });

    return lines.length > 0 ? lines : [''];
}

export function getLineStyle(style) {
    const lineStyleKey = String(normalizeEnumInput('lineStyle', style) || '').toLowerCase();
    if (lineStyleKey === 'dashdot') {
        return '10,5,2,5';
    }
    if (lineStyleKey === 'dashed') {
        return '10,5';
    }
    if (lineStyleKey === 'dotted') {
        return '2,3';
    }
    return '0';
}

export function normalizeAlignment(value, fallback = 'left') {
    const fallbackToken = String(normalizeEnumInput('alignment', fallback) || 'left').trim() || 'left';
    if (value === undefined || value === null || value === '') return fallbackToken;
    const normalized = normalizeEnumInput('alignment', value);
    const token = String(normalized ?? '').trim();
    return token || fallbackToken;
}

export function toBoolean(value, defaultValue = false) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined || value === '') return defaultValue;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', 'yes', '1', 'y'].includes(normalized)) return true;
        if (['false', 'no', '0', 'n'].includes(normalized)) return false;
    }
    if (typeof value === 'number') return value !== 0;
    return defaultValue;
}

export function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

export function getHorizontalAnchor(xValue, boundaryHalfWidth, fallback = 'start') {
    if (xValue === null || xValue === undefined || !Number.isFinite(xValue)) {
        return fallback;
    }
    const threshold = boundaryHalfWidth * LAYOUT_CONSTANTS.HORIZONTAL_ANCHOR_CENTER_THRESHOLD_RATIO;
    if (Math.abs(xValue) <= threshold) {
        return 'middle';
    }
    return xValue > 0 ? 'start' : 'end';
}

export function formatDepthValue(value, fixedDecimalPlaces = null) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return t('common.none');

    const decimalPlaces = Number(fixedDecimalPlaces);
    if (Number.isInteger(decimalPlaces) && decimalPlaces >= 0) {
        return numeric.toLocaleString(undefined, {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        });
    }

    return numeric.toLocaleString();
}

export function estimateCasingID(od, weight) {
    if (!weight || weight <= 0 || od <= 0) {
        return od * PHYSICS_CONSTANTS.DEFAULT_ID_RATIO;
    }

    let wallThickness = weight / (od * PHYSICS_CONSTANTS.STEEL_DENSITY_FACTOR_IMPERIAL);
    wallThickness = Math.max(
        od * PHYSICS_CONSTANTS.MIN_WALL_RATIO,
        Math.min(wallThickness, od * PHYSICS_CONSTANTS.MAX_WALL_RATIO)
    );

    return od - 2 * wallThickness;
}

export function generateCasingId(row, index) {
    const safeIndex = Number.isFinite(index) ? index + 1 : '?';
    const label = row?.label ? row.label : t('common.unnamed_casing');
    const odValue = Number(row?.od);
    const odText = Number.isFinite(odValue) ? odValue.toFixed(3) : '?';
    return `#${safeIndex} ${label} (${odText}")`;
}
