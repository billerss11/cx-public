import { parseOptionalNumber } from '@/utils/general.js';

export const OPEN_HOLE_WAVE_DEFAULTS = Object.freeze({
    amplitude: 2,
    wavelength: 25
});

export const OPEN_HOLE_WAVE_LIMITS = Object.freeze({
    minAmplitude: 0,
    maxAmplitude: 10,
    minWavelength: 4,
    maxWavelength: 120
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function resolveClampedValue(rawValue, fallback, min, max) {
    const parsed = parseOptionalNumber(rawValue);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(parsed, min, max);
}

export function resolveOpenHoleWaveConfig(rowData) {
    return {
        amplitude: resolveClampedValue(
            rowData?.openHoleWaveAmplitude,
            OPEN_HOLE_WAVE_DEFAULTS.amplitude,
            OPEN_HOLE_WAVE_LIMITS.minAmplitude,
            OPEN_HOLE_WAVE_LIMITS.maxAmplitude
        ),
        wavelength: resolveClampedValue(
            rowData?.openHoleWaveWavelength,
            OPEN_HOLE_WAVE_DEFAULTS.wavelength,
            OPEN_HOLE_WAVE_LIMITS.minWavelength,
            OPEN_HOLE_WAVE_LIMITS.maxWavelength
        )
    };
}
