const DEFAULT_DEPTH_EPSILON = 1e-9;

function toFinitePoint(point, index) {
  const depth = Number(point?.[0]);
  if (!Number.isFinite(depth)) return null;

  const rawValue = point?.[1];
  const hasExplicitNull = rawValue === null || rawValue === undefined || rawValue === '';
  const value = hasExplicitNull ? NaN : Number(rawValue);
  const hasFiniteValue = !hasExplicitNull && Number.isFinite(value);
  return {
    index,
    depth,
    value: hasFiniteValue ? value : null,
    hasFiniteValue
  };
}

export function normalizeCurvePoints(points) {
  if (!Array.isArray(points)) return [];

  const normalized = points
    .map((point, index) => toFinitePoint(point, index))
    .filter(Boolean);

  normalized.sort((left, right) => {
    if (left.depth === right.depth) return left.index - right.index;
    return left.depth - right.depth;
  });

  return normalized;
}

function findInsertionIndex(points, depth) {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (points[middle].depth < depth) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function findExactCandidates(points, depth, depthEpsilon) {
  const insertionIndex = findInsertionIndex(points, depth);
  if (points.length === 0) return [];

  let left = Math.max(0, insertionIndex - 1);
  while (left > 0 && Math.abs(points[left - 1].depth - depth) <= depthEpsilon) {
    left -= 1;
  }

  const matches = [];
  for (let index = left; index < points.length; index += 1) {
    const candidate = points[index];
    if (Math.abs(candidate.depth - depth) <= depthEpsilon) {
      matches.push(index);
      continue;
    }
    if (candidate.depth > (depth + depthEpsilon)) break;
  }
  return matches;
}

function findFiniteLeft(points, fromIndex) {
  for (let index = fromIndex; index >= 0; index -= 1) {
    const point = points[index];
    if (point?.hasFiniteValue) return point;
  }
  return null;
}

function findFiniteRight(points, fromIndex) {
  for (let index = fromIndex; index < points.length; index += 1) {
    const point = points[index];
    if (point?.hasFiniteValue) return point;
  }
  return null;
}

function interpolateValue(depth, left, right) {
  if (!left || !right) return null;
  const span = right.depth - left.depth;
  if (!Number.isFinite(span) || Math.abs(span) <= Number.EPSILON) return left.value;
  const ratio = (depth - left.depth) / span;
  return left.value + ((right.value - left.value) * ratio);
}

function resolveNearestFiniteValue(depth, left, right) {
  if (!left && !right) return null;
  if (!left) return { value: right.value, status: 'nearest', sourceDepth: right.depth };
  if (!right) return { value: left.value, status: 'nearest', sourceDepth: left.depth };

  const leftDistance = Math.abs(depth - left.depth);
  const rightDistance = Math.abs(right.depth - depth);
  if (leftDistance <= rightDistance) {
    return { value: left.value, status: 'nearest', sourceDepth: left.depth };
  }
  return { value: right.value, status: 'nearest', sourceDepth: right.depth };
}

export function resolveCurveValueAtDepth(rawPoints, depth, options = {}) {
  const targetDepth = Number(depth);
  if (!Number.isFinite(targetDepth)) {
    return {
      value: null,
      status: 'no_data',
      depth: null,
      sourceDepth: null,
      leftDepth: null,
      rightDepth: null
    };
  }

  const points = normalizeCurvePoints(rawPoints);
  if (points.length === 0) {
    return {
      value: null,
      status: 'no_data',
      depth: targetDepth,
      sourceDepth: null,
      leftDepth: null,
      rightDepth: null
    };
  }

  const depthEpsilon = Number.isFinite(Number(options.depthEpsilon))
    ? Math.max(0, Number(options.depthEpsilon))
    : DEFAULT_DEPTH_EPSILON;
  const allowInterpolation = options.allowInterpolation !== false;

  const minDepth = points[0].depth;
  const maxDepth = points[points.length - 1].depth;
  if ((targetDepth + depthEpsilon) < minDepth || (targetDepth - depthEpsilon) > maxDepth) {
    return {
      value: null,
      status: 'out_of_range',
      depth: targetDepth,
      sourceDepth: null,
      leftDepth: minDepth,
      rightDepth: maxDepth
    };
  }

  const exactIndexes = findExactCandidates(points, targetDepth, depthEpsilon);
  if (exactIndexes.length > 0) {
    const finiteExactIndex = exactIndexes.find((index) => points[index]?.hasFiniteValue);
    const exactPoint = Number.isInteger(finiteExactIndex)
      ? points[finiteExactIndex]
      : points[exactIndexes[0]];
    if (exactPoint?.hasFiniteValue) {
      return {
        value: exactPoint.value,
        status: 'exact',
        depth: targetDepth,
        sourceDepth: exactPoint.depth,
        leftDepth: exactPoint.depth,
        rightDepth: exactPoint.depth
      };
    }
    return {
      value: null,
      status: 'no_data',
      depth: targetDepth,
      sourceDepth: exactPoint.depth,
      leftDepth: exactPoint.depth,
      rightDepth: exactPoint.depth
    };
  }

  const insertionIndex = findInsertionIndex(points, targetDepth);
  const finiteLeft = findFiniteLeft(points, insertionIndex - 1);
  const finiteRight = findFiniteRight(points, insertionIndex);

  if (allowInterpolation && finiteLeft && finiteRight) {
    return {
      value: interpolateValue(targetDepth, finiteLeft, finiteRight),
      status: 'interpolated',
      depth: targetDepth,
      sourceDepth: null,
      leftDepth: finiteLeft.depth,
      rightDepth: finiteRight.depth
    };
  }

  const nearest = resolveNearestFiniteValue(targetDepth, finiteLeft, finiteRight);
  if (!nearest) {
    return {
      value: null,
      status: 'no_data',
      depth: targetDepth,
      sourceDepth: null,
      leftDepth: finiteLeft?.depth ?? null,
      rightDepth: finiteRight?.depth ?? null
    };
  }

  return {
    value: nearest.value,
    status: nearest.status,
    depth: targetDepth,
    sourceDepth: nearest.sourceDepth,
    leftDepth: finiteLeft?.depth ?? null,
    rightDepth: finiteRight?.depth ?? null
  };
}

export default resolveCurveValueAtDepth;
