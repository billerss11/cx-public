import { LAYOUT_CONSTANTS } from '@/constants/index.js';

function toFiniteNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function resolveClampedCenterY(centerY, halfHeight, highestAllowedY, lowestAllowedY) {
  const minCenterY = highestAllowedY + halfHeight;
  const maxCenterY = lowestAllowedY - halfHeight;
  if (minCenterY > maxCenterY) {
    return (highestAllowedY + lowestAllowedY) / 2;
  }
  return Math.min(maxCenterY, Math.max(minCenterY, centerY));
}

function sweepDown(entries, gapY) {
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    const minCenterY = previous.resolvedCenterY + previous.halfHeight + gapY + current.halfHeight;
    if (current.resolvedCenterY < minCenterY) {
      current.resolvedCenterY = minCenterY;
    }
  }
}

function sweepUp(entries, lowestAllowedY, gapY) {
  const lastIndex = entries.length - 1;
  const lastEntry = entries[lastIndex];
  const maxLastCenterY = lowestAllowedY - lastEntry.halfHeight;
  if (lastEntry.resolvedCenterY > maxLastCenterY) {
    lastEntry.resolvedCenterY = maxLastCenterY;
  }

  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const current = entries[index];
    const lower = entries[index + 1];
    const maxCenterY = lower.resolvedCenterY - lower.halfHeight - gapY - current.halfHeight;
    if (current.resolvedCenterY > maxCenterY) {
      current.resolvedCenterY = maxCenterY;
    }
  }
}

function enforceTopBoundary(entries, highestAllowedY, gapY) {
  const firstEntry = entries[0];
  const minFirstCenterY = highestAllowedY + firstEntry.halfHeight;
  if (firstEntry.resolvedCenterY < minFirstCenterY) {
    firstEntry.resolvedCenterY = minFirstCenterY;
  }
  sweepDown(entries, gapY);
}

function resolveEffectiveGapY(entries, gapY, highestAllowedY, lowestAllowedY) {
  if (entries.length <= 1) return gapY;

  const availableHeight = Math.max(0, lowestAllowedY - highestAllowedY);
  const totalLabelHeight = entries.reduce((sum, entry) => sum + (entry.halfHeight * 2), 0);
  const requiredHeight = totalLabelHeight + (gapY * (entries.length - 1));
  if (requiredHeight <= availableHeight) return gapY;

  // If labels cannot fit, reduce spacing deterministically (and allow overlap when unavoidable).
  return (availableHeight - totalLabelHeight) / (entries.length - 1);
}

function clampToRange(value, minValue, maxValue) {
  if (!Number.isFinite(value)) return minValue;
  if (maxValue <= minValue) return minValue;
  return Math.min(maxValue, Math.max(minValue, value));
}

function normalizeSide(value, fallback = 'right') {
  if (value === 'left') return 'left';
  if (value === 'right') return 'right';
  return fallback === 'left' ? 'left' : 'right';
}

function buildAnchoredCalloutCandidate(options, side) {
  const anchorLeftX = toFiniteNumber(options.anchorLeftX, null);
  const anchorRightX = toFiniteNumber(options.anchorRightX, null);
  const anchorX = side === 'right' ? anchorRightX : anchorLeftX;
  if (!Number.isFinite(anchorX)) return null;

  const boxWidth = Math.max(1, toFiniteNumber(options.boxWidth, 1));
  const boundsLeft = toFiniteNumber(options.boundsLeft, 0);
  const boundsRight = toFiniteNumber(options.boundsRight, boundsLeft + boxWidth + 10);
  const minBoxPadding = Math.max(0, toFiniteNumber(options.minBoxPadding, 5));
  const minBoxX = boundsLeft + minBoxPadding;
  const maxBoxX = Math.max(minBoxX, boundsRight - boxWidth - minBoxPadding);
  const standoffPx = Math.max(0, toFiniteNumber(options.standoffPx, 0));
  const nudgePx = toFiniteNumber(options.nudgePx, 0);

  const rawBoxX = side === 'right'
    ? anchorX + standoffPx + nudgePx
    : anchorX - standoffPx - boxWidth + nudgePx;
  const clampedRawBoxX = clampToRange(rawBoxX, minBoxX, maxBoxX);
  let boxX = clampedRawBoxX;
  let arrowStartX = side === 'right' ? boxX : boxX + boxWidth;

  const minConnectorLength = Math.max(0, toFiniteNumber(options.minConnectorLength, 0));
  let connectorLength = Math.abs(anchorX - arrowStartX);
  if (minConnectorLength > 0 && connectorLength < minConnectorLength) {
    const extension = minConnectorLength - connectorLength;
    const shiftedBoxX = side === 'right' ? boxX + extension : boxX - extension;
    boxX = clampToRange(shiftedBoxX, minBoxX, maxBoxX);
    arrowStartX = side === 'right' ? boxX : boxX + boxWidth;
    connectorLength = Math.abs(anchorX - arrowStartX);
  }

  const centerX = toFiniteNumber(options.centerX, (anchorLeftX + anchorRightX) / 2);
  const boxCenterX = boxX + (boxWidth / 2);
  const sideMismatchPenalty = side === 'right'
    ? Math.max(0, centerX - boxCenterX)
    : Math.max(0, boxCenterX - centerX);
  const overflowPenalty = Math.abs(rawBoxX - clampedRawBoxX);
  const score = (overflowPenalty * 20) + (sideMismatchPenalty * 8) + connectorLength;

  return {
    side,
    anchorX,
    boxX,
    arrowStartX,
    textAnchor: side === 'right' ? 'start' : 'end',
    score
  };
}

export function resolveAnchoredHorizontalCallout(options = {}) {
  const preferredSide = normalizeSide(options.preferredSide, 'right');
  const sideOrder = preferredSide === 'right'
    ? ['right', 'left']
    : ['left', 'right'];

  const candidates = sideOrder
    .map((side) => buildAnchoredCalloutCandidate(options, side))
    .filter(Boolean);
  if (candidates.length === 0) return null;

  return candidates.reduce((best, candidate) => (
    !best || candidate.score < best.score ? candidate : best
  ), null);
}

export function resolveConfiguredIntervalCalloutStandoffPx(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return clampToRange(
    parsed,
    LAYOUT_CONSTANTS.INTERVAL_CALLOUT_GLOBAL_STANDOFF_MIN_PX,
    LAYOUT_CONSTANTS.INTERVAL_CALLOUT_GLOBAL_STANDOFF_MAX_PX
  );
}

export function resolveVerticalLabelCollisions(labels, options = {}) {
  const source = Array.isArray(labels) ? labels : [];
  if (source.length === 0) return [];

  const highestAllowedY = toFiniteNumber(options.top, 0) + Math.max(0, toFiniteNumber(options.paddingY, 0));
  const lowestAllowedY = toFiniteNumber(options.bottom, 0) - Math.max(0, toFiniteNumber(options.paddingY, 0));
  const gapY = Math.max(0, toFiniteNumber(options.gapY, 0));

  if (!Number.isFinite(highestAllowedY) || !Number.isFinite(lowestAllowedY) || lowestAllowedY <= highestAllowedY) {
    return source.map((label) => toFiniteNumber(label?.idealCenterY, 0));
  }

  const entries = source
    .map((label, index) => {
      const halfHeight = Math.max(0.5, toFiniteNumber(label?.boxHeight, 0) / 2);
      const idealCenterY = toFiniteNumber(label?.idealCenterY, highestAllowedY + halfHeight);
      return {
        index,
        halfHeight,
        idealCenterY,
        resolvedCenterY: resolveClampedCenterY(idealCenterY, halfHeight, highestAllowedY, lowestAllowedY)
      };
    })
    .sort((a, b) => a.idealCenterY - b.idealCenterY);

  const effectiveGapY = resolveEffectiveGapY(entries, gapY, highestAllowedY, lowestAllowedY);
  sweepDown(entries, effectiveGapY);
  sweepUp(entries, lowestAllowedY, effectiveGapY);
  enforceTopBoundary(entries, highestAllowedY, effectiveGapY);
  sweepUp(entries, lowestAllowedY, effectiveGapY);

  const resolvedCentersByIndex = Array.from({ length: source.length }, (_, index) => (
    toFiniteNumber(source[index]?.idealCenterY, 0)
  ));
  entries.forEach((entry) => {
    resolvedCentersByIndex[entry.index] = entry.resolvedCenterY;
  });
  return resolvedCentersByIndex;
}
