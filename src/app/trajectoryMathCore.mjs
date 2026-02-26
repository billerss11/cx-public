const EPSILON = 1e-6;
const COURSE_LENGTH_FT = 100;
const COURSE_LENGTH_M = 30;

function toFiniteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDegrees(value) {
    const normalized = Number(value) % 360;
    if (!Number.isFinite(normalized)) return 0;
    return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeVerticalSectionMode(value) {
    const token = String(value ?? '').trim().toLowerCase();
    if (token === 'manual' || token === 'north' || token === 'east') return 'manual';
    return 'auto';
}

function calculateBearingDegrees(fromNorth, fromEast, toNorth, toEast) {
    const dNorth = toNorth - fromNorth;
    const dEast = toEast - fromEast;
    if (Math.hypot(dNorth, dEast) <= EPSILON) return 0;
    const bearingRadians = Math.atan2(dEast, dNorth);
    return normalizeDegrees((bearingRadians * 180) / Math.PI);
}

function resolveVerticalSectionAzimuth(path = [], config = {}) {
    const mode = normalizeVerticalSectionMode(config?.verticalSectionMode);
    if (mode !== 'auto') {
        const configured = toFiniteNumber(config?.verticalSectionAzimuth);
        return normalizeDegrees(Number.isFinite(configured) ? configured : 0);
    }

    if (!Array.isArray(path) || path.length === 0) return 0;
    const first = path[0] || {};
    const last = path[path.length - 1] || {};
    const firstNorth = toFiniteNumber(first.north) ?? 0;
    const firstEast = toFiniteNumber(first.east) ?? 0;
    const lastNorth = toFiniteNumber(last.north) ?? 0;
    const lastEast = toFiniteNumber(last.east) ?? 0;

    if (Math.hypot(lastNorth - firstNorth, lastEast - firstEast) > EPSILON) {
        return calculateBearingDegrees(firstNorth, firstEast, lastNorth, lastEast);
    }

    for (let i = 1; i < path.length; i += 1) {
        const prev = path[i - 1] || {};
        const curr = path[i] || {};
        const prevNorth = toFiniteNumber(prev.north) ?? 0;
        const prevEast = toFiniteNumber(prev.east) ?? 0;
        const currNorth = toFiniteNumber(curr.north) ?? 0;
        const currEast = toFiniteNumber(curr.east) ?? 0;
        if (Math.hypot(currNorth - prevNorth, currEast - prevEast) > EPSILON) {
            return calculateBearingDegrees(prevNorth, prevEast, currNorth, currEast);
        }
    }

    return 0;
}

function normalizeSurveyRows(rows = []) {
    const surveys = [];
    rows.forEach((row) => {
        const md = toFiniteNumber(row?.md);
        const inc = toFiniteNumber(row?.inc);
        const azi = toFiniteNumber(row?.azi);
        if (!Number.isFinite(md) || !Number.isFinite(inc) || !Number.isFinite(azi)) return;
        surveys.push({
            md,
            inc,
            azi,
            comment: row?.comment === undefined || row?.comment === null ? '' : String(row.comment)
        });
    });
    return surveys;
}

function convertLegacyCartesianToSurveys(rows = []) {
    const legacyPoints = [];
    rows.forEach((row) => {
        const x = toFiniteNumber(row?.x);
        const tvd = toFiniteNumber(row?.tvd);
        if (!Number.isFinite(x) || !Number.isFinite(tvd)) return;
        legacyPoints.push({
            x,
            tvd,
            comment: row?.comment === undefined || row?.comment === null ? '' : String(row.comment)
        });
    });

    if (legacyPoints.length < 2) return [];

    const surveys = [{
        md: 0,
        inc: 0,
        azi: 0,
        comment: legacyPoints[0].comment
    }];
    let cumulativeMD = 0;

    for (let i = 1; i < legacyPoints.length; i += 1) {
        const prev = legacyPoints[i - 1];
        const curr = legacyPoints[i];
        const deltaX = curr.x - prev.x;
        const deltaTVD = curr.tvd - prev.tvd;
        const deltaMD = Math.hypot(deltaX, deltaTVD);
        if (!Number.isFinite(deltaMD) || deltaMD <= EPSILON) continue;

        cumulativeMD += deltaMD;
        const cosineInclination = Math.max(-1, Math.min(1, deltaTVD / deltaMD));
        const inclination = (Math.acos(cosineInclination) * 180) / Math.PI;
        const azimuth = Math.abs(deltaX) <= EPSILON
            ? surveys[surveys.length - 1].azi
            : (deltaX >= 0 ? 90 : 270);
        surveys.push({
            md: cumulativeMD,
            inc: inclination,
            azi: azimuth,
            comment: curr.comment
        });
    }

    return surveys.length >= 2 ? surveys : [];
}

function resolveFallbackMaxDepthFromCasing(casingData = []) {
    if (!Array.isArray(casingData)) return null;

    let maxDepth = null;
    casingData.forEach((row) => {
        const candidates = [
            toFiniteNumber(row?.top),
            toFiniteNumber(row?.bottom),
            toFiniteNumber(row?.toc),
            toFiniteNumber(row?.boc)
        ];
        candidates.forEach((value) => {
            if (!Number.isFinite(value) || value <= EPSILON) return;
            if (!Number.isFinite(maxDepth) || value > maxDepth) {
                maxDepth = value;
            }
        });
    });

    return maxDepth;
}

function buildSyntheticVerticalSurveys(maxDepth, config = {}) {
    const md = toFiniteNumber(maxDepth);
    if (!Number.isFinite(md) || md <= EPSILON) return [];

    const fallbackAzimuth = normalizeDegrees(toFiniteNumber(config?.verticalSectionAzimuth) ?? 0);
    return [
        { md: 0, inc: 0, azi: fallbackAzimuth, comment: '' },
        { md, inc: 0, azi: fallbackAzimuth, comment: '' }
    ];
}

function calculateMinCurveTrajectory(surveys, units = 'm') {
    const sourceRows = Array.isArray(surveys) ? surveys : [];
    const rows = sourceRows
        .map((row) => ({
            md: Number(row?.md),
            inc: Number(row?.inc),
            azi: Number(row?.azi)
        }))
        .filter((row) => Number.isFinite(row.md) && Number.isFinite(row.inc) && Number.isFinite(row.azi))
        .sort((a, b) => a.md - b.md);

    if (rows.length === 0) return [];

    const courseLength = units === 'ft' ? COURSE_LENGTH_FT : COURSE_LENGTH_M;
    const toRad = (degrees) => degrees * (Math.PI / 180);
    const points = [];

    if (rows[0].md > 0.01) {
        points.push({ md: 0, inc: 0, azi: 0, tvd: 0, north: 0, east: 0, dls: 0 });
    }

    if (points.length === 0) {
        points.push({
            md: rows[0].md,
            inc: rows[0].inc,
            azi: rows[0].azi,
            tvd: 0,
            north: 0,
            east: 0,
            dls: 0
        });
    }

    const startIndex = rows[0].md < 0.01 ? 1 : 0;
    for (let i = startIndex; i < rows.length; i += 1) {
        const previousPoint = points[points.length - 1];
        const currentRow = rows[i];
        const deltaMD = currentRow.md - previousPoint.md;
        if (deltaMD <= EPSILON) continue;

        const i1 = toRad(previousPoint.inc);
        const i2 = toRad(currentRow.inc);
        const a1 = toRad(previousPoint.azi);
        const a2 = toRad(currentRow.azi);
        const doglegTerm = Math.cos(i2 - i1) - (Math.sin(i1) * Math.sin(i2) * (1 - Math.cos(a2 - a1)));
        const safeDoglegTerm = Math.max(-1, Math.min(1, doglegTerm));
        const dogleg = Math.acos(safeDoglegTerm);
        const ratioFactor = dogleg < 1e-8 ? 1.0 : (2 / dogleg) * Math.tan(dogleg / 2);
        const halfMD = deltaMD / 2;

        const dNorth = halfMD * (Math.sin(i1) * Math.cos(a1) + Math.sin(i2) * Math.cos(a2)) * ratioFactor;
        const dEast = halfMD * (Math.sin(i1) * Math.sin(a1) + Math.sin(i2) * Math.sin(a2)) * ratioFactor;
        const dVertical = halfMD * (Math.cos(i1) + Math.cos(i2)) * ratioFactor;
        const dls = (dogleg * (180 / Math.PI) / deltaMD) * courseLength;

        points.push({
            md: currentRow.md,
            inc: currentRow.inc,
            azi: currentRow.azi,
            tvd: previousPoint.tvd + dVertical,
            north: previousPoint.north + dNorth,
            east: previousPoint.east + dEast,
            dls
        });
    }

    return points;
}

export function buildProjectedTrajectory(points3D = [], config = {}) {
    if (!Array.isArray(points3D) || points3D.length === 0) return [];
    const verticalSectionAzimuth = resolveVerticalSectionAzimuth(points3D, config);
    const vsRadians = (verticalSectionAzimuth * Math.PI) / 180;

    return points3D
        .map((point) => {
            const md = toFiniteNumber(point?.md);
            const tvd = toFiniteNumber(point?.tvd);
            const north = toFiniteNumber(point?.north) ?? 0;
            const east = toFiniteNumber(point?.east) ?? 0;
            if (!Number.isFinite(md) || !Number.isFinite(tvd)) return null;
            const verticalSection = (north * Math.cos(vsRadians)) + (east * Math.sin(vsRadians));
            return {
                md,
                inc: toFiniteNumber(point?.inc),
                azi: toFiniteNumber(point?.azi),
                x: verticalSection,
                tvd,
                north,
                east,
                dls: toFiniteNumber(point?.dls)
            };
        })
        .filter(Boolean);
}

export function resolveTrajectoryPointsFromRows(rows = [], config = {}, options = {}) {
    let surveys = normalizeSurveyRows(rows);
    if (surveys.length < 2) {
        surveys = convertLegacyCartesianToSurveys(rows);
    }
    if (surveys.length < 2) {
        const fallbackMaxDepth = resolveFallbackMaxDepthFromCasing(options?.casingData);
        surveys = buildSyntheticVerticalSurveys(fallbackMaxDepth, config);
    }
    if (surveys.length < 2) return [];

    const points3D = calculateMinCurveTrajectory(surveys, config?.units);
    return buildProjectedTrajectory(points3D, config);
}
