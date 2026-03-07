import { clamp } from '@/utils/general.js';

export const SMART_LABEL_INITIAL_GAP_PX = 6;
export const SMART_LABEL_SHRINK_STEP_PX = 0.5;
export const SMART_LABEL_MAX_MOVE_PASSES = 3;
export const SMART_LABEL_MAX_SHRINK_PASSES = 6;
export const SMART_LABEL_AUTO_SCALE_MIN = 0.85;
export const SMART_LABEL_AUTO_SCALE_MAX = 1.25;
export const SMART_LABEL_MIN_FONT_PX = 8;
export const SMART_LABEL_MAX_FONT_PX = 24;

function toFiniteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeBounds(bounds) {
  const top = toFiniteNumber(bounds?.top, 0);
  const bottom = toFiniteNumber(bounds?.bottom, top);
  const left = toFiniteNumber(bounds?.left, 0);
  const right = toFiniteNumber(bounds?.right, left);
  if (bottom <= top || right <= left) return null;
  return { top, bottom, left, right };
}

function normalizeSide(value) {
  const token = String(value ?? '').trim().toLowerCase();
  if (token === 'left') return 'left';
  if (token === 'right') return 'right';
  return 'center';
}

function normalizeCandidate(candidate, index, bounds) {
  const boxHeight = Math.max(1, toFiniteNumber(candidate?.boxHeight, 1));
  const boxWidth = Math.max(1, toFiniteNumber(candidate?.boxWidth, 1));
  const preferredCenterY = toFiniteNumber(candidate?.preferredCenterY, toFiniteNumber(candidate?.centerY, 0));
  const minCenter = bounds ? bounds.top + (boxHeight / 2) : Number.NEGATIVE_INFINITY;
  const maxCenter = bounds ? bounds.bottom - (boxHeight / 2) : Number.POSITIVE_INFINITY;
  const baseFontPx = Math.max(
    SMART_LABEL_MIN_FONT_PX,
    toFiniteNumber(candidate?.baseFontPx, toFiniteNumber(candidate?.fontSize, 11))
  );
  const fontSize = clamp(
    toFiniteNumber(candidate?.fontSize, baseFontPx),
    SMART_LABEL_MIN_FONT_PX,
    SMART_LABEL_MAX_FONT_PX
  );

  const next = {
    ...candidate,
    id: String(candidate?.id ?? `smart-label-${index}`),
    side: normalizeSide(candidate?.side),
    boxWidth,
    boxHeight,
    baseFontPx,
    fontSize,
    minFontPx: Math.max(
      SMART_LABEL_MIN_FONT_PX,
      toFiniteNumber(candidate?.minFontPx, SMART_LABEL_MIN_FONT_PX)
    ),
    maxFontPx: Math.max(
      SMART_LABEL_MIN_FONT_PX,
      toFiniteNumber(candidate?.maxFontPx, SMART_LABEL_MAX_FONT_PX)
    ),
    centerY: clamp(
      toFiniteNumber(candidate?.centerY, preferredCenterY),
      minCenter,
      maxCenter
    ),
    preferredCenterY: clamp(preferredCenterY, minCenter, maxCenter),
    boxX: toFiniteNumber(candidate?.boxX, 0),
    isPositionPinned: candidate?.isPositionPinned === true,
    canSwapSide: candidate?.canSwapSide === true
  };
  next.boxY = next.centerY - (next.boxHeight / 2);
  return next;
}

function overlapAmount(first, second, gap) {
  const firstBottom = first.centerY + (first.boxHeight / 2);
  const secondTop = second.centerY - (second.boxHeight / 2);
  return (firstBottom + gap) - secondTop;
}

function sweepGroup(group, gap, bounds) {
  if (!Array.isArray(group) || group.length <= 1) return;

  const minY = bounds.top;
  const maxY = bounds.bottom;

  group.sort((left, right) => left.centerY - right.centerY);

  for (let index = 0; index < group.length; index += 1) {
    const candidate = group[index];
    const minCenter = minY + (candidate.boxHeight / 2);
    const maxCenter = maxY - (candidate.boxHeight / 2);
    if (candidate.isPositionPinned) {
      candidate.centerY = clamp(candidate.centerY, minCenter, maxCenter);
      continue;
    }
    candidate.centerY = clamp(candidate.centerY, minCenter, maxCenter);
  }

  for (let index = 1; index < group.length; index += 1) {
    const previous = group[index - 1];
    const current = group[index];
    const requiredCenter = previous.centerY + (previous.boxHeight / 2) + gap + (current.boxHeight / 2);
    if (current.centerY >= requiredCenter) continue;
    if (current.isPositionPinned) continue;
    current.centerY = requiredCenter;
  }

  for (let index = group.length - 2; index >= 0; index -= 1) {
    const current = group[index];
    const lower = group[index + 1];
    const maxCenter = lower.centerY - (lower.boxHeight / 2) - gap - (current.boxHeight / 2);
    if (current.centerY <= maxCenter) continue;
    if (current.isPositionPinned) continue;
    current.centerY = maxCenter;
  }

  group.forEach((candidate) => {
    const minCenter = minY + (candidate.boxHeight / 2);
    const maxCenter = maxY - (candidate.boxHeight / 2);
    candidate.centerY = clamp(candidate.centerY, minCenter, maxCenter);
    candidate.boxY = candidate.centerY - (candidate.boxHeight / 2);
  });
}

function collectOverlaps(candidates, gap) {
  const groups = { left: [], right: [], center: [] };
  candidates.forEach((candidate) => {
    groups[candidate.side]?.push(candidate);
  });

  const overlaps = [];
  Object.values(groups).forEach((group) => {
    const sorted = [...group].sort((left, right) => left.centerY - right.centerY);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const amount = overlapAmount(previous, current, gap);
      if (amount > 0) {
        overlaps.push([previous, current, amount]);
      }
    }
  });
  return overlaps;
}

function maybeSwapSides(candidates, gap) {
  let swapped = false;
  const overlaps = collectOverlaps(candidates, gap);
  const overlapIds = new Set();
  overlaps.forEach(([left, right]) => {
    overlapIds.add(left.id);
    overlapIds.add(right.id);
  });

  candidates.forEach((candidate) => {
    if (!overlapIds.has(candidate.id)) return;
    if (candidate.isPositionPinned) return;
    if (candidate.canSwapSide !== true) return;
    if (candidate.side !== 'left' && candidate.side !== 'right') return;
    candidate.side = candidate.side === 'left' ? 'right' : 'left';
    swapped = true;
  });

  return swapped;
}

function shrinkOverlappedCandidates(candidates, gap, shrinkStep) {
  const overlaps = collectOverlaps(candidates, gap);
  if (overlaps.length === 0) return false;

  let changed = false;
  overlaps.forEach(([first, second]) => {
    const shrinkTargets = [first, second]
      .filter((candidate) => candidate.isPositionPinned !== true)
      .sort((left, right) => right.fontSize - left.fontSize);
    if (shrinkTargets.length === 0) return;

    const target = shrinkTargets[0];
    const nextFont = Math.max(target.minFontPx, target.fontSize - shrinkStep);
    if (nextFont >= target.fontSize) return;

    const ratio = nextFont / Math.max(1e-6, target.fontSize);
    target.fontSize = nextFont;
    target.boxHeight = Math.max(1, target.boxHeight * ratio);
    target.boxWidth = Math.max(1, target.boxWidth * ratio);
    changed = true;
  });
  return changed;
}

export function resolveSmartLabelAutoScale({
  totalPreferredLabelHeight = 0,
  availableTrackHeight = 0
} = {}) {
  const preferred = Math.max(0, toFiniteNumber(totalPreferredLabelHeight, 0));
  const available = Math.max(0, toFiniteNumber(availableTrackHeight, 0));
  if (preferred <= 0 || available <= 0) return 1;
  const densityRatio = preferred / available;
  if (!Number.isFinite(densityRatio) || densityRatio <= 0) return 1;
  return clamp(
    1 / densityRatio,
    SMART_LABEL_AUTO_SCALE_MIN,
    SMART_LABEL_AUTO_SCALE_MAX
  );
}

export function resolveSmartLabelFontSize(baseFontPx, options = {}) {
  const base = Math.max(
    SMART_LABEL_MIN_FONT_PX,
    toFiniteNumber(baseFontPx, 11)
  );
  const manualScale = Math.max(0.01, toFiniteNumber(options.manualScale, 1));
  const autoScale = Math.max(0.01, toFiniteNumber(options.autoScale, 1));
  const minPx = Math.max(
    SMART_LABEL_MIN_FONT_PX,
    toFiniteNumber(options.minPx, SMART_LABEL_MIN_FONT_PX)
  );
  const maxPx = Math.max(
    minPx,
    toFiniteNumber(options.maxPx, SMART_LABEL_MAX_FONT_PX)
  );
  return clamp(base * manualScale * autoScale, minPx, maxPx);
}

export function estimatePreferredLabelHeight(candidates) {
  const source = Array.isArray(candidates) ? candidates : [];
  return source.reduce((sum, candidate) => (
    sum + Math.max(0, toFiniteNumber(candidate?.boxHeight, 0))
  ), 0);
}

export function applyDeterministicSmartLabelLayout(candidates, options = {}) {
  const source = Array.isArray(candidates) ? candidates : [];
  if (source.length === 0) return [];

  const bounds = normalizeBounds(options.bounds);
  if (!bounds) return source.map((candidate) => ({ ...candidate }));

  const initialGap = Math.max(0, toFiniteNumber(options.initialGap, SMART_LABEL_INITIAL_GAP_PX));
  const shrinkStep = Math.max(0.1, toFiniteNumber(options.shrinkStep, SMART_LABEL_SHRINK_STEP_PX));
  const maxMovePasses = Math.max(1, Math.round(toFiniteNumber(options.maxMovePasses, SMART_LABEL_MAX_MOVE_PASSES)));
  const maxShrinkPasses = Math.max(1, Math.round(toFiniteNumber(options.maxShrinkPasses, SMART_LABEL_MAX_SHRINK_PASSES)));

  const working = source.map((candidate, index) => normalizeCandidate(candidate, index, bounds));

  for (let pass = 0; pass < maxMovePasses; pass += 1) {
    const grouped = {
      left: [],
      right: [],
      center: []
    };
    working.forEach((candidate) => {
      grouped[candidate.side].push(candidate);
    });
    sweepGroup(grouped.left, initialGap, bounds);
    sweepGroup(grouped.right, initialGap, bounds);
    sweepGroup(grouped.center, initialGap, bounds);
    const overlaps = collectOverlaps(working, initialGap);
    if (overlaps.length === 0) break;
    if (!maybeSwapSides(working, initialGap)) continue;
  }

  for (let pass = 0; pass < maxShrinkPasses; pass += 1) {
    const overlaps = collectOverlaps(working, initialGap);
    if (overlaps.length === 0) break;
    const changed = shrinkOverlappedCandidates(working, initialGap, shrinkStep);
    if (!changed) break;

    const grouped = {
      left: [],
      right: [],
      center: []
    };
    working.forEach((candidate) => {
      grouped[candidate.side].push(candidate);
    });
    sweepGroup(grouped.left, initialGap, bounds);
    sweepGroup(grouped.right, initialGap, bounds);
    sweepGroup(grouped.center, initialGap, bounds);
  }

  return working.map((candidate) => ({
    ...candidate,
    boxY: candidate.centerY - (candidate.boxHeight / 2)
  }));
}
