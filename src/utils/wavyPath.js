import { line, curveBasis } from 'd3-shape';

/**
 * Generates a wavy SVG path string from a series of points.
 * @param {Array<[number, number]>} points - The array of [x, y] points for the path's backbone.
 * @param {object} options - Configuration for the waviness.
 * @param {number} [options.amplitude=2] - The maximum perpendicular distance of the wave from the backbone.
 * @param {number} [options.wavelength=20] - The approximate distance between wave crests.
 * @param {number} [options.seed=0] - A seed for the random number generator to ensure consistent waviness for the same input.
 * @returns {string} The SVG path data string.
 */
export function generateWavyPath(points, options = {}) {
  if (!points || points.length < 2) {
    return '';
  }

  const SEGMENT_EPSILON = 1e-6;
  const { amplitude = 2, wavelength = 20, seed = 0 } = options;

  // Simple pseudo-random number generator for deterministic results
  let randomSeed = seed;
  const pseudoRandom = () => {
    const x = Math.sin(randomSeed++) * 10000;
    return x - Math.floor(x);
  };

  const wavyPoints = [];
  let lastPoint = points[0];
  wavyPoints.push(lastPoint);

  for (let i = 1; i < points.length; i++) {
    const currentPoint = points[i];
    const segmentDx = currentPoint[0] - lastPoint[0];
    const segmentDy = currentPoint[1] - lastPoint[1];
    const segmentLength = Math.sqrt(segmentDx * segmentDx + segmentDy * segmentDy);
    if (!Number.isFinite(segmentLength) || segmentLength <= SEGMENT_EPSILON) {
      continue;
    }

    // Calculate the normal vector (perpendicular)
    const normal = { x: -segmentDy / segmentLength, y: segmentDx / segmentLength };

    const numSteps = Math.max(1, Math.ceil(segmentLength / wavelength));

    for (let j = 1; j <= numSteps; j++) {
      const stepT = j / numSteps;
      const pointOnLine = [
        lastPoint[0] + segmentDx * stepT,
        lastPoint[1] + segmentDy * stepT,
      ];

      // Add displacement only if it's not the very last point of the whole line
      let displacement = 0;
      if (i < points.length -1 || j < numSteps) {
        const randomFactor = (pseudoRandom() - 0.5) * 2; // -1 to 1
        displacement = randomFactor * amplitude;
      }

      const wavyPoint = [
        pointOnLine[0] + normal.x * displacement,
        pointOnLine[1] + normal.y * displacement,
      ];

      wavyPoints.push(wavyPoint);
    }
    lastPoint = currentPoint;
  }

  const pathGenerator = line().curve(curveBasis);
  return pathGenerator(wavyPoints);
}
