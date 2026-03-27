import { clamp } from '@/utils/general.js';

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampIfFinite(value, range) {
  if (!Number.isFinite(value)) return null;
  const min = toFiniteNumber(range?.min);
  const max = toFiniteNumber(range?.max);
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return clamp(value, min, max);
  }
  if (Number.isFinite(min) && value < min) return min;
  if (Number.isFinite(max) && value > max) return max;
  return value;
}

function resolveDirectionalRatioFromBounds(pointerX, bounds) {
  const left = Number(bounds?.left);
  const right = Number(bounds?.right);
  const width = Math.max(1, Number(bounds?.width) || (right - left));
  if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(width)) return null;

  const clampedX = clamp(Number(pointerX), Math.min(left, right), Math.max(left, right));
  return clamp((((clampedX - left) / width) * 2) - 1, -1, 1);
}

function clampDelta(rawDelta, entries = []) {
  let minDelta = Number.NEGATIVE_INFINITY;
  let maxDelta = Number.POSITIVE_INFINITY;

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const value = toFiniteNumber(entry?.value);
    if (!Number.isFinite(value)) return;

    const min = toFiniteNumber(entry?.min);
    const max = toFiniteNumber(entry?.max);
    if (Number.isFinite(min)) {
      minDelta = Math.max(minDelta, min - value);
    }
    if (Number.isFinite(max)) {
      maxDelta = Math.min(maxDelta, max - value);
    }
  });

  return clamp(rawDelta, minDelta, maxDelta);
}

function resolveDepthShiftPatch(rawDelta, entries = []) {
  if (!Number.isFinite(rawDelta)) return null;
  const constrainedDelta = clampDelta(rawDelta, entries);
  const patch = {};

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const field = String(entry?.field ?? '').trim();
    const value = toFiniteNumber(entry?.value);
    if (!field || !Number.isFinite(value)) return;
    patch[field] = value + constrainedDelta;
  });

  return Object.keys(patch).length > 0 ? patch : null;
}

export function resolveVerticalLabelDragPatch(options = {}) {
  const pointer = options.pointer;
  const xScale = options.xScale;
  const yScale = options.yScale;
  if (!pointer || typeof xScale?.invert !== 'function' || typeof yScale?.invert !== 'function') {
    return null;
  }

  const xValue = clampIfFinite(Number(xScale.invert(pointer.x)), options.xRange);
  const depthValue = clampIfFinite(Number(yScale.invert(pointer.y)), options.depthRange);
  if (!Number.isFinite(xValue) || !Number.isFinite(depthValue)) return null;

  return {
    [String(options.xField || 'labelXPos')]: xValue,
    [String(options.yField || 'manualLabelDepth')]: depthValue
  };
}

export function resolveVerticalDepthShiftPatch(options = {}) {
  const yScale = options.yScale;
  if (typeof yScale?.invert !== 'function') return null;

  const startY = toFiniteNumber(options?.startPointer?.y);
  const currentY = toFiniteNumber(options?.pointer?.y);
  if (!Number.isFinite(startY) || !Number.isFinite(currentY)) return null;

  const startDepth = toFiniteNumber(yScale.invert(startY));
  const currentDepth = toFiniteNumber(yScale.invert(currentY));
  if (!Number.isFinite(startDepth) || !Number.isFinite(currentDepth)) return null;

  return resolveDepthShiftPatch(currentDepth - startDepth, options.entries);
}

export function resolveDirectionalLabelDragPatch(options = {}) {
  const pointer = options.pointer;
  const bounds = options.bounds;
  const resolveDepthFromPoint = options.resolveDepthFromPoint;
  if (!pointer || !bounds || typeof resolveDepthFromPoint !== 'function') return null;

  const ratio = resolveDirectionalRatioFromBounds(pointer.x, bounds);
  const depth = clampIfFinite(Number(resolveDepthFromPoint(pointer)), options.depthRange);
  if (!Number.isFinite(ratio) || !Number.isFinite(depth)) return null;

  return {
    [String(options.xField || 'directionalLabelXPos')]: ratio,
    [String(options.yField || 'directionalManualLabelDepth')]: depth
  };
}

export function resolveDirectionalLineLabelSlidePatch(options = {}) {
  const pointer = options.pointer;
  const bounds = options.bounds;
  if (!pointer || !bounds) return null;

  const ratio = resolveDirectionalRatioFromBounds(pointer.x, bounds);
  if (!Number.isFinite(ratio)) return null;

  const patch = {
    [String(options.xField || 'directionalLabelXPos')]: ratio
  };

  const clearYField = String(options.clearYField ?? '').trim();
  if (clearYField) {
    patch[clearYField] = null;
  }

  return patch;
}

export function resolveDirectionalDepthShiftPatch(options = {}) {
  if (typeof options.resolveDepthFromPoint !== 'function') return null;

  const startPointer = options.startPointer && typeof options.startPointer === 'object'
    ? { ...options.startPointer }
    : null;
  const currentPointer = options.pointer && typeof options.pointer === 'object'
    ? { ...options.pointer }
    : null;
  if (!startPointer || !currentPointer) return null;

  if (options.lockXToStart === true && Number.isFinite(toFiniteNumber(startPointer.x))) {
    currentPointer.x = startPointer.x;
  }

  const startDepth = toFiniteNumber(options.resolveDepthFromPoint(startPointer));
  const currentDepth = toFiniteNumber(options.resolveDepthFromPoint(currentPointer));
  if (!Number.isFinite(startDepth) || !Number.isFinite(currentDepth)) return null;

  return resolveDepthShiftPatch(currentDepth - startDepth, options.entries);
}

export default {
  resolveVerticalDepthShiftPatch,
  resolveVerticalLabelDragPatch,
  resolveDirectionalDepthShiftPatch,
  resolveDirectionalLabelDragPatch,
  resolveDirectionalLineLabelSlidePatch
};
