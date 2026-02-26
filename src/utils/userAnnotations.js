import { clamp, parseOptionalNumber } from '@/utils/general.js';

export const USER_ANNOTATION_TOOL_MODE_SELECT = 'select';
export const USER_ANNOTATION_TOOL_MODE_ADD = 'add';
export const USER_ANNOTATION_DEFAULT_TEXT = 'New note';

export const USER_ANNOTATION_DEFAULT_STYLE = Object.freeze({
    fontSize: 14,
    fontColor: '#ff3b30',
    arrowColor: '#ff3b30',
    arrowSize: 2
});

function resolveColor(value, fallback) {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizePoint(point = {}, fallbackDepth = 0, fallbackXValue = 0) {
    const depth = parseOptionalNumber(point?.depth);
    const xValue = parseOptionalNumber(point?.xValue);
    return {
        depth: Number.isFinite(depth) ? depth : fallbackDepth,
        xValue: Number.isFinite(xValue) ? xValue : fallbackXValue
    };
}

function normalizeStyle(style = {}) {
    const fontSize = parseOptionalNumber(style?.fontSize);
    const arrowSize = parseOptionalNumber(style?.arrowSize);

    return {
        fontSize: clamp(Number.isFinite(fontSize) ? fontSize : USER_ANNOTATION_DEFAULT_STYLE.fontSize, 8, 48),
        fontColor: resolveColor(style?.fontColor, USER_ANNOTATION_DEFAULT_STYLE.fontColor),
        arrowColor: resolveColor(style?.arrowColor, USER_ANNOTATION_DEFAULT_STYLE.arrowColor),
        arrowSize: clamp(Number.isFinite(arrowSize) ? arrowSize : USER_ANNOTATION_DEFAULT_STYLE.arrowSize, 1, 8)
    };
}

export function createUserAnnotationId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    return `annotation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeUserAnnotation(row = {}, options = {}) {
    if (!row || typeof row !== 'object') return null;

    const fallbackDepth = Number.isFinite(Number(options.fallbackDepth)) ? Number(options.fallbackDepth) : 0;
    const fallbackXValue = Number.isFinite(Number(options.fallbackXValue)) ? Number(options.fallbackXValue) : 0;
    const id = String(row.id ?? '').trim() || createUserAnnotationId();

    const anchor = normalizePoint(row.anchor, fallbackDepth, fallbackXValue);
    const labelPosFallbackDepth = anchor.depth - 120;
    const labelPosFallbackX = anchor.xValue + 12;
    const labelPos = normalizePoint(row.labelPos, labelPosFallbackDepth, labelPosFallbackX);

    const rawText = String(row.text ?? '').trim();
    const text = rawText || USER_ANNOTATION_DEFAULT_TEXT;
    const style = normalizeStyle(row.style);

    return {
        id,
        anchor,
        labelPos,
        text,
        style
    };
}

export function normalizeUserAnnotations(rows = [], options = {}) {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => normalizeUserAnnotation(row, options))
        .filter(Boolean);
}

function clampToDepthBounds(value, minDepth, maxDepth) {
    if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth)) return value;
    return clamp(value, Math.min(minDepth, maxDepth), Math.max(minDepth, maxDepth));
}

function clampToXBounds(value, xHalf) {
    if (!Number.isFinite(xHalf) || xHalf <= 0) return value;
    return clamp(value, -xHalf, xHalf);
}

export function createUserAnnotation(anchor = {}, options = {}) {
    const minDepth = Number(options.minDepth);
    const maxDepth = Number(options.maxDepth);
    const xHalf = Number(options.xHalf);
    const depthOffset = Number.isFinite(Number(options.depthOffset)) ? Number(options.depthOffset) : 120;
    const xOffset = Number.isFinite(Number(options.xOffset)) ? Number(options.xOffset) : 12;
    const fallbackDepth = Number.isFinite(minDepth) ? minDepth : 0;

    const normalizedAnchor = normalizePoint(anchor, fallbackDepth, 0);
    normalizedAnchor.depth = clampToDepthBounds(normalizedAnchor.depth, minDepth, maxDepth);
    normalizedAnchor.xValue = clampToXBounds(normalizedAnchor.xValue, xHalf);

    const labelPos = {
        depth: clampToDepthBounds(normalizedAnchor.depth - depthOffset, minDepth, maxDepth),
        xValue: clampToXBounds(normalizedAnchor.xValue + xOffset, xHalf)
    };

    return normalizeUserAnnotation({
        id: String(options.id ?? '').trim() || createUserAnnotationId(),
        anchor: normalizedAnchor,
        labelPos,
        text: options.text ?? USER_ANNOTATION_DEFAULT_TEXT,
        style: options.style ?? USER_ANNOTATION_DEFAULT_STYLE
    }, {
        fallbackDepth: normalizedAnchor.depth,
        fallbackXValue: normalizedAnchor.xValue
    });
}

export function normalizeUserAnnotationId(value) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
}

function resolveFallbackAnnotationIndex(id) {
    const match = /^user-annotation-index-(\d+)$/.exec(id ?? '');
    if (!match) return null;
    const index = Number(match[1]);
    return Number.isInteger(index) && index >= 0 ? index : null;
}

export function findUserAnnotationContextById(rows = [], id) {
    if (!Array.isArray(rows)) return null;

    const normalizedId = normalizeUserAnnotationId(id);
    if (!normalizedId) return null;

    const rowIndex = rows.findIndex((row) => (
        normalizeUserAnnotationId(row?.id) === normalizedId
    ));
    if (rowIndex >= 0) {
        return {
            id: normalizedId,
            index: rowIndex,
            row: rows[rowIndex]
        };
    }

    const fallbackIndex = resolveFallbackAnnotationIndex(normalizedId);
    if (fallbackIndex === null || fallbackIndex >= rows.length) return null;
    return {
        id: normalizedId,
        index: fallbackIndex,
        row: rows[fallbackIndex]
    };
}

export function removeUserAnnotationById(rows = [], id) {
    if (!Array.isArray(rows)) {
        return {
            removed: false,
            removedIndex: null,
            nextRows: []
        };
    }

    const context = findUserAnnotationContextById(rows, id);
    if (!context) {
        return {
            removed: false,
            removedIndex: null,
            nextRows: rows
        };
    }

    return {
        removed: true,
        removedIndex: context.index,
        nextRows: rows.filter((_row, rowIndex) => rowIndex !== context.index)
    };
}
