import { clamp } from '@/utils/general.js';

export const DIRECTIONAL_EPSILON = 1e-6;
const MIN_X_EXAGGERATION = 0.1;
const MAX_X_EXAGGERATION = 1.0;
const DEFAULT_X_EXAGGERATION = 1.0;

export function toFiniteNumber(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeXExaggeration(value) {
  const parsed = toFiniteNumber(value, DEFAULT_X_EXAGGERATION);
  return clamp(parsed, MIN_X_EXAGGERATION, MAX_X_EXAGGERATION);
}

export function isFinitePoint(point) {
  return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

export function buildMDSamples(top, bottom, step = 20) {
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return [];
  const sampleStep = Number.isFinite(step) && step > 0 ? step : 20;
  const values = [top];
  for (let md = top + sampleStep; md < bottom - DIRECTIONAL_EPSILON; md += sampleStep) {
    values.push(md);
  }
  values.push(bottom);
  return values;
}

function resolveSegmentAtMD(targetMD, points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  if (points.length === 1) {
    return { startIndex: 0, endIndex: 0, t: 0 };
  }

  const first = points[0];
  const lastIndex = points.length - 1;
  const last = points[lastIndex];
  if (targetMD <= first.md) return { startIndex: 0, endIndex: 1, t: 0 };
  if (targetMD >= last.md) return { startIndex: lastIndex - 1, endIndex: lastIndex, t: 1 };

  let low = 0;
  let high = lastIndex;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].md <= targetMD) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const start = points[low];
  const end = points[low + 1];
  const span = Math.max(DIRECTIONAL_EPSILON, end.md - start.md);
  const t = clamp((targetMD - start.md) / span, 0, 1);
  return { startIndex: low, endIndex: low + 1, t };
}

function resolveTangent(startPoint, endPoint) {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.tvd - startPoint.tvd;
  const len = Math.hypot(dx, dy);
  if (len <= DIRECTIONAL_EPSILON) return { tx: 1, ty: 0 };
  return { tx: dx / len, ty: dy / len };
}

function getPointAtMD(targetMD, points) {
  const segment = resolveSegmentAtMD(targetMD, points);
  if (!segment) return null;
  const startPoint = points[segment.startIndex];
  const endPoint = points[segment.endIndex];
  const { tx, ty } = resolveTangent(startPoint, endPoint);
  return {
    x: startPoint.x + ((endPoint.x - startPoint.x) * segment.t),
    tvd: startPoint.tvd + ((endPoint.tvd - startPoint.tvd) * segment.t),
    tx,
    ty
  };
}

function exaggerateX(value, factor, origin) {
  return origin + ((value - origin) * factor);
}

function normalizeVector(x, y, fallback = { x: 1, y: 0 }) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= DIRECTIONAL_EPSILON) {
    return { x: fallback.x, y: fallback.y };
  }
  return { x: x / length, y: y / length };
}

export function buildDirectionalProjector(trajectoryPoints, xScale, yScale, options = {}) {
  const xExaggeration = normalizeXExaggeration(options?.xExaggeration);
  const xOrigin = toFiniteNumber(options?.xOrigin, 0);

  return (md, offsetRadius) => {
    const point = getPointAtMD(md, trajectoryPoints);
    if (!point) return [NaN, NaN];

    const baseDisplayX = exaggerateX(point.x, xExaggeration, xOrigin);
    const screenX = xScale(baseDisplayX);
    const screenY = yScale(point.tvd);
    if (!Number.isFinite(offsetRadius) || Math.abs(offsetRadius) <= DIRECTIONAL_EPSILON) {
      return [screenX, screenY];
    }

    // Build the normal from a tangent already mapped to screen space so thickness
    // stays visually constant under non-uniform x/y scaling.
    const tangentDisplayX = exaggerateX(point.x + point.tx, xExaggeration, xOrigin);
    const tangentScreenX = xScale(tangentDisplayX);
    const tangentScreenY = yScale(point.tvd + point.ty);
    const tangentScreen = normalizeVector(
      tangentScreenX - screenX,
      tangentScreenY - screenY
    );

    const normalScreenX = -tangentScreen.y;
    const normalScreenY = tangentScreen.x;
    const radiusMagnitude = Math.abs(offsetRadius);
    const radiusDisplayX = exaggerateX(point.x + radiusMagnitude, xExaggeration, xOrigin);
    const radiusPixels = Math.abs(xScale(radiusDisplayX) - screenX);
    const sign = offsetRadius < 0 ? -1 : 1;

    return [
      screenX + (normalScreenX * radiusPixels * sign),
      screenY + (normalScreenY * radiusPixels * sign)
    ];
  };
}

export function resolveScreenFrameAtMD(md, context = {}) {
  const project = context?.project;
  const totalMD = Number(context?.totalMD);
  if (typeof project !== 'function' || !Number.isFinite(totalMD)) return null;

  const center = project(md, 0);
  if (!isFinitePoint(center)) return null;

  const delta = Math.max(0.5, Math.min(8, totalMD / 400));
  const prevMD = clamp(md - delta, 0, totalMD);
  const nextMD = clamp(md + delta, 0, totalMD);
  const prev = project(prevMD, 0);
  const next = project(nextMD, 0);

  const tangent = normalizeVector(
    (next?.[0] ?? center[0]) - (prev?.[0] ?? center[0]),
    (next?.[1] ?? center[1]) - (prev?.[1] ?? center[1])
  );

  const diameterScale = Number(context?.diameterScale);
  const maxProjectedRadius = Number(context?.maxProjectedRadius);
  const normalProbe = Math.max(
    1,
    Number.isFinite(diameterScale) ? diameterScale * 2 : 1,
    Number.isFinite(maxProjectedRadius) ? maxProjectedRadius * 0.2 : 1
  );
  const rightPoint = project(md, normalProbe);
  let normal = normalizeVector(
    (rightPoint?.[0] ?? center[0]) - center[0],
    (rightPoint?.[1] ?? center[1]) - center[1],
    { x: -tangent.y, y: tangent.x }
  );

  const dot = (tangent.x * normal.x) + (tangent.y * normal.y);
  if (Math.abs(dot) > 0.5) {
    normal = { x: -tangent.y, y: tangent.x };
  }

  return { center, tangent, normal };
}
