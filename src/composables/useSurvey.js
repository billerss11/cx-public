import { SURVEY_CONSTANTS } from '@/constants/index.js';

/**
 * Calculates trajectory using Minimum Curvature Method.
 * Ported from wellpathpy (mincurve.py) with adaptations for schematic plotting.
 * * Logic validated against standard industry workflows:
 * - Uses correct Minimum Curvature formulas (Ratio Factor, Dogleg).
 * - Handles station pairing correctly (Previous -> Current).
 * - Automatically handles 'Surface Tie-In' (assumes vertical from surface if data starts deeper).
 * - Supports Metric (30m) and Imperial (100ft) DLS scaling.
 * * @param {Array} surveys - Array of {md, inc, azi} objects
 * @param {String} units - 'm' or 'ft' (determines DLS reference standard)
 * @returns {Array} Array of calculated points {md, tvd, north, east, dls, ...}
 */
export function calculateMinCurveTrajectory(surveys, units = 'm') {
    // 1. Validate, Parse, and Sort Input
    // We sort by MD to ensure we calculate the wellbore from top to bottom.
    const s = [...surveys]
        .map(row => ({
            md: parseFloat(row.md),
            inc: parseFloat(row.inc),
            azi: parseFloat(row.azi)
        }))
        .filter(r => Number.isFinite(r.md) && Number.isFinite(r.inc) && Number.isFinite(r.azi))
        .sort((a, b) => a.md - b.md);

    if (s.length === 0) return [];

    // 2. Setup Constants
    // DLS Standard: 30m for Metric, 100ft for Imperial
    const courseLength = units === 'ft'
        ? SURVEY_CONSTANTS.COURSE_LENGTH_FT
        : SURVEY_CONSTANTS.COURSE_LENGTH_M;
    const toRad = (deg) => deg * (Math.PI / 180);
    const PI = Math.PI;

    // 3. Initialize Calculation Array
    const points = [];

    // --- SURFACE TIE-IN LOGIC ---
    // If the first user survey is NOT at surface (MD > 0), we must anchor the well.
    // We assume the well is VERTICAL from Surface (0,0,0) to the first survey point.
    // This prevents the "Floating Well" problem where depth is compressed.
    if (s[0].md > 0.01) {
        points.push({
            md: 0,
            inc: 0,
            azi: 0,
            tvd: 0,
            north: 0,
            east: 0,
            dls: 0
        });
    }

    // Initialize the start of our calculation chain.
    // If we added a tie-in above, 'previousPoint' is (0,0,0).
    // If we didn't (user data starts at 0), we will push the first user point as the origin.
    if (points.length === 0) {
        points.push({
            md: s[0].md,
            inc: s[0].inc,
            azi: s[0].azi,
            tvd: 0, // MD=0 implies TVD=0 at origin
            north: 0,
            east: 0,
            dls: 0
        });
    }

    // 4. Main Calculation Loop
    // We maintain a 'running tip' of the wellbore (previousPoint).
    // We iterate through the raw survey data to calculate the next interval.
    
    // Determine where to start looping in the raw data.
    // If s[0] was used as the origin (MD=0), we start calculating to s[1].
    // If s[0] was deep (MD=1000), we start calculating from Synthetic(0) to s[0].
    let startIndex = (s[0].md < 0.01) ? 1 : 0; 

    // We use the last calculated point as the reference for the next interval
    // Note: points[points.length - 1] updates dynamically as we push new points.
    
    for (let i = startIndex; i < s.length; i++) {
        const previousPoint = points[points.length - 1];
        const currRaw = s[i];
        
        // --- GUARD CLAUSE (The Reviewer's Fix) ---
        // Ensure strictly positive progress. 
        // Handles duplicates (delta=0) and sorting errors (delta<0).
        const deltaMD = currRaw.md - previousPoint.md;
        if (deltaMD <= 1e-6) continue;

        // Convert angles to Radians
        const I1 = toRad(previousPoint.inc);
        const I2 = toRad(currRaw.inc);
        const A1 = toRad(previousPoint.azi);
        const A2 = toRad(currRaw.azi);

        // --- Minimum Curvature Algorithm ---
        // Source: wellpathpy/mincurve.py
        
        // 1. Calculate Dogleg Angle (theta)
        // Uses the spherical law of cosines
        const dlTerm = Math.cos(I2 - I1) - (Math.sin(I1) * Math.sin(I2) * (1 - Math.cos(A2 - A1)));
        
        // Clamp value to [-1, 1] to prevent NaN from floating point noise
        const safeDlTerm = Math.max(-1, Math.min(1, dlTerm));
        const dogleg = Math.acos(safeDlTerm);

        // 2. Calculate Ratio Factor (RF)
        // Handles the limit as dogleg approaches 0 (straight hole)
        const rf = (dogleg < 1e-8) ? 1.0 : (2 / dogleg) * Math.tan(dogleg / 2);

        // 3. Calculate Deltas
        const halfMD = deltaMD / 2;
        const dN = halfMD * (Math.sin(I1) * Math.cos(A1) + Math.sin(I2) * Math.cos(A2)) * rf;
        const dE = halfMD * (Math.sin(I1) * Math.sin(A1) + Math.sin(I2) * Math.sin(A2)) * rf;
        const dV = halfMD * (Math.cos(I1) + Math.cos(I2)) * rf;

        // 4. Calculate DLS for this interval
        // Normalized to courseLength (30m or 100ft)
        const currentDLS = (dogleg * (180 / PI) / deltaMD) * courseLength;

        // Push new calculated point
        points.push({
            md: currRaw.md,
            inc: currRaw.inc,
            azi: currRaw.azi,
            tvd: previousPoint.tvd + dV,
            north: previousPoint.north + dN,
            east: previousPoint.east + dE,
            dls: currentDLS
        });
    }

    return points;
}

export function useSurvey() {
    return {
        calculateMinCurveTrajectory
    };
}

export default {
    useSurvey,
    calculateMinCurveTrajectory
};
