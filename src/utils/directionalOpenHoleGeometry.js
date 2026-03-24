const DIRECTIONAL_OPEN_HOLE_EPSILON = 1e-6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isFinitePoint(point) {
  return Array.isArray(point)
    && point.length >= 2
    && Number.isFinite(Number(point[0]))
    && Number.isFinite(Number(point[1]));
}

function buildDeterministicRandom(seed = 0) {
  let randomSeed = Number(seed) || 0;
  return () => {
    const next = Math.sin(randomSeed += 1) * 10000;
    return next - Math.floor(next);
  };
}

function resolveUnitOutwardVector(boundary, inner) {
  const vectorX = Number(boundary?.[0]) - Number(inner?.[0]);
  const vectorY = Number(boundary?.[1]) - Number(inner?.[1]);
  const length = Math.hypot(vectorX, vectorY);
  if (!Number.isFinite(length) || length <= DIRECTIONAL_OPEN_HOLE_EPSILON) {
    return { x: 1, y: 0 };
  }
  return {
    x: vectorX / length,
    y: vectorY / length
  };
}

function resolveBoundaryMetrics(boundaryPoints = []) {
  let pathLength = 0;
  let totalTurnRadians = 0;
  const cumulativeLengths = [0];

  for (let index = 1; index < boundaryPoints.length; index += 1) {
    const previous = boundaryPoints[index - 1];
    const current = boundaryPoints[index];
    const segmentLength = Math.hypot(
      Number(current[0]) - Number(previous[0]),
      Number(current[1]) - Number(previous[1])
    );
    pathLength += segmentLength;
    cumulativeLengths.push(pathLength);
  }

  for (let index = 1; index < boundaryPoints.length - 1; index += 1) {
    const previous = boundaryPoints[index - 1];
    const current = boundaryPoints[index];
    const next = boundaryPoints[index + 1];
    const leftVector = [
      Number(current[0]) - Number(previous[0]),
      Number(current[1]) - Number(previous[1])
    ];
    const rightVector = [
      Number(next[0]) - Number(current[0]),
      Number(next[1]) - Number(current[1])
    ];
    const leftLength = Math.hypot(leftVector[0], leftVector[1]);
    const rightLength = Math.hypot(rightVector[0], rightVector[1]);
    if (leftLength <= DIRECTIONAL_OPEN_HOLE_EPSILON || rightLength <= DIRECTIONAL_OPEN_HOLE_EPSILON) {
      continue;
    }

    const dot = clamp(
      ((leftVector[0] / leftLength) * (rightVector[0] / rightLength))
      + ((leftVector[1] / leftLength) * (rightVector[1] / rightLength)),
      -1,
      1
    );
    totalTurnRadians += Math.acos(dot);
  }

  return {
    pathLength,
    totalTurnRadians,
    cumulativeLengths
  };
}

export function buildDirectionalOpenHoleSideGeometry(sideSamples = [], waveConfig = {}, options = {}) {
  const normalizedSamples = (Array.isArray(sideSamples) ? sideSamples : [])
    .map((sample) => {
      const outer = sample?.outer;
      const inner = sample?.inner;
      if (!isFinitePoint(outer) || !isFinitePoint(inner)) return null;
      return { outer, inner };
    })
    .filter(Boolean);

  if (normalizedSamples.length < 2) return null;

  const boundaryPoints = normalizedSamples.map((sample) => sample.outer);
  const { pathLength, totalTurnRadians, cumulativeLengths } = resolveBoundaryMetrics(boundaryPoints);
  const baseAmplitude = Math.max(0, Number(waveConfig?.amplitude) || 0);
  const baseWavelength = Math.max(4, Number(waveConfig?.wavelength) || 24);
  const formationThicknessPx = Math.max(0, Number(options?.formationThicknessPx) || 0);
  const curvatureFactor = totalTurnRadians / Math.PI;
  const isTooShortForWave = pathLength < (baseWavelength * 1.6);
  const isTooCurvedForWave = curvatureFactor > 0.45;
  const effectiveAmplitude = (isTooShortForWave || isTooCurvedForWave)
    ? 0
    : (baseAmplitude * clamp(1 - (curvatureFactor * 0.75), 0.3, 1));
  const effectiveWavelength = effectiveAmplitude <= DIRECTIONAL_OPEN_HOLE_EPSILON
    ? baseWavelength
    : (baseWavelength * clamp(1 + (curvatureFactor * 1.5), 1, 2.5));
  const random = buildDeterministicRandom(options?.seed);

  const displayedBoundaryPoints = normalizedSamples.map((sample, index) => {
    const boundary = sample.outer;
    if (index === 0 || index === normalizedSamples.length - 1 || effectiveAmplitude <= DIRECTIONAL_OPEN_HOLE_EPSILON) {
      return [...boundary];
    }

    const outward = resolveUnitOutwardVector(boundary, sample.inner);
    const progress = cumulativeLengths[index] / Math.max(pathLength, DIRECTIONAL_OPEN_HOLE_EPSILON);
    const wavePhase = (progress * Math.PI * 2 * (pathLength / Math.max(effectiveWavelength, DIRECTIONAL_OPEN_HOLE_EPSILON)));
    const noise = Math.sin(wavePhase) * 0.65 + ((random() - 0.5) * 0.7);
    const displacement = effectiveAmplitude * noise;

    return [
      boundary[0] + (outward.x * displacement),
      boundary[1] + (outward.y * displacement)
    ];
  });

  const formationPoints = displayedBoundaryPoints.map((point, index) => {
    const outward = resolveUnitOutwardVector(normalizedSamples[index].outer, normalizedSamples[index].inner);
    return [
      point[0] + (outward.x * formationThicknessPx),
      point[1] + (outward.y * formationThicknessPx)
    ];
  });

  return {
    mode: effectiveAmplitude <= DIRECTIONAL_OPEN_HOLE_EPSILON ? 'smooth' : 'wavy',
    effectiveAmplitude,
    effectiveWavelength,
    boundaryPoints: displayedBoundaryPoints,
    formationPoints
  };
}
