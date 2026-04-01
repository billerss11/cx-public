export const DEFAULT_DIRECTIONAL_LINE_LABEL_GAP_PX = 6;

function toFiniteNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveDirectionalLineUnitVectors(segment = {}) {
  const x1 = toFiniteNumber(segment?.x1);
  const y1 = toFiniteNumber(segment?.y1);
  const x2 = toFiniteNumber(segment?.x2);
  const y2 = toFiniteNumber(segment?.y2);
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    return null;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 1e-6) return null;

  const tangentX = dx / length;
  const tangentY = dy / length;
  const firstNormal = { x: -tangentY, y: tangentX };
  const secondNormal = { x: tangentY, y: -tangentX };
  const normal = firstNormal.y < secondNormal.y
    ? firstNormal
    : secondNormal.y < firstNormal.y
      ? secondNormal
      : (firstNormal.x >= secondNormal.x ? firstNormal : secondNormal);

  return {
    tangentX,
    tangentY,
    normalX: normal.x,
    normalY: normal.y
  };
}

export function resolveDirectionalLineLabelAnchorTangentOffset(boxWidth, textAnchor) {
  const width = Math.max(1, toFiniteNumber(boxWidth, 1));
  const inset = Math.min(width / 2, 5);
  const normalizedAnchor = String(textAnchor ?? '').trim().toLowerCase();
  if (normalizedAnchor === 'end') return (width / 2) - inset;
  if (normalizedAnchor === 'start') return -((width / 2) - inset);
  return 0;
}

export function resolveDirectionalLineLabelPlacement(options = {}) {
  const segment = options.segment ?? null;
  const vectors = resolveDirectionalLineUnitVectors(segment);
  if (!vectors) return null;

  const anchorX = toFiniteNumber(options.anchorX);
  const anchorY = toFiniteNumber(options.anchorY);
  const boxWidth = Math.max(1, toFiniteNumber(options.boxWidth, 1));
  const boxHeight = Math.max(1, toFiniteNumber(options.boxHeight, 1));
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return null;

  const tangentOffset = resolveDirectionalLineLabelAnchorTangentOffset(boxWidth, options.textAnchor);
  const explicitNormalOffset = toFiniteNumber(options.normalOffsetPx, null);
  const normalOffset = Number.isFinite(explicitNormalOffset)
    ? explicitNormalOffset
    : ((boxHeight / 2) + Math.max(0, toFiniteNumber(options.gapPx, DEFAULT_DIRECTIONAL_LINE_LABEL_GAP_PX)));
  const centerX = anchorX - (vectors.tangentX * tangentOffset) + (vectors.normalX * normalOffset);
  const centerY = anchorY - (vectors.tangentY * tangentOffset) + (vectors.normalY * normalOffset);

  return {
    anchorX,
    anchorY,
    centerX,
    centerY,
    boxX: centerX - (boxWidth / 2),
    boxY: centerY - (boxHeight / 2),
    tangentX: vectors.tangentX,
    tangentY: vectors.tangentY,
    normalX: vectors.normalX,
    normalY: vectors.normalY
  };
}

export function resolveDirectionalLineProjectedDelta(segment = {}, delta = {}) {
  const vectors = resolveDirectionalLineUnitVectors(segment);
  if (!vectors) return null;

  const deltaX = toFiniteNumber(delta?.x);
  const deltaY = toFiniteNumber(delta?.y);
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return null;

  return (deltaX * vectors.tangentX) + (deltaY * vectors.tangentY);
}

export function resolveDirectionalLinePointFromOffset(center = {}, segment = {}, offset = 0) {
  const vectors = resolveDirectionalLineUnitVectors(segment);
  if (!vectors) return null;

  const centerX = toFiniteNumber(center?.x);
  const centerY = toFiniteNumber(center?.y);
  const signedOffset = toFiniteNumber(offset);
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(signedOffset)) return null;

  return {
    x: centerX + (vectors.tangentX * signedOffset),
    y: centerY + (vectors.tangentY * signedOffset)
  };
}

export function resolveDirectionalLineOffsetFromPoints(center = {}, point = {}, segment = {}) {
  const vectors = resolveDirectionalLineUnitVectors(segment);
  if (!vectors) return null;

  const centerX = toFiniteNumber(center?.x);
  const centerY = toFiniteNumber(center?.y);
  const pointX = toFiniteNumber(point?.x);
  const pointY = toFiniteNumber(point?.y);
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(pointX) || !Number.isFinite(pointY)) {
    return null;
  }

  const deltaX = pointX - centerX;
  const deltaY = pointY - centerY;
  return (deltaX * vectors.tangentX) + (deltaY * vectors.tangentY);
}

export default {
  DEFAULT_DIRECTIONAL_LINE_LABEL_GAP_PX,
  resolveDirectionalLineUnitVectors,
  resolveDirectionalLineLabelAnchorTangentOffset,
  resolveDirectionalLineLabelPlacement,
  resolveDirectionalLineProjectedDelta,
  resolveDirectionalLinePointFromOffset,
  resolveDirectionalLineOffsetFromPoints
};
