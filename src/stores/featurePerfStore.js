import { defineStore } from 'pinia';

const DEFAULT_SAMPLE_RATE = 0.1;
const DEFAULT_MAX_RECORDS = 200;

function toFiniteNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeSampleRate(value, fallback = DEFAULT_SAMPLE_RATE) {
    const numeric = toFiniteNumber(value, fallback);
    if (!Number.isFinite(numeric)) return DEFAULT_SAMPLE_RATE;
    return Math.min(1, Math.max(0, numeric));
}

function normalizeMaxRecords(value, fallback = DEFAULT_MAX_RECORDS) {
    const numeric = Math.trunc(toFiniteNumber(value, fallback));
    if (!Number.isInteger(numeric) || numeric <= 0) return DEFAULT_MAX_RECORDS;
    return numeric;
}

function normalizeOptionalToken(value) {
    const token = String(value ?? '').trim();
    return token || null;
}

function normalizeTimingRecord(payload = {}) {
    const totalMs = Math.max(0, toFiniteNumber(payload.totalMs, 0));
    const backendMs = toFiniteNumber(payload.backendMs, null);
    const frontendMs = Number.isFinite(backendMs)
        ? Math.max(0, totalMs - backendMs)
        : toFiniteNumber(payload.frontendMs, null);

    return {
        feature: normalizeOptionalToken(payload.feature) || 'unknown.feature',
        status: normalizeOptionalToken(payload.status) || 'success',
        totalMs,
        backendMs,
        frontendMs,
        startedAt: normalizeOptionalToken(payload.startedAt),
        finishedAt: normalizeOptionalToken(payload.finishedAt),
        task: normalizeOptionalToken(payload.task),
        requestId: normalizeOptionalToken(payload.requestId),
        mode: normalizeOptionalToken(payload.mode)
    };
}

export const useFeaturePerfStore = defineStore('featurePerf', {
    state: () => ({
        enabled: true,
        sampleRate: DEFAULT_SAMPLE_RATE,
        maxRecords: DEFAULT_MAX_RECORDS,
        records: []
    }),

    actions: {
        configure(options = {}) {
            const config = options && typeof options === 'object' ? options : {};
            if (Object.prototype.hasOwnProperty.call(config, 'enabled')) {
                this.enabled = config.enabled !== false;
            }
            if (Object.prototype.hasOwnProperty.call(config, 'sampleRate')) {
                this.sampleRate = normalizeSampleRate(config.sampleRate, this.sampleRate);
            }
            if (Object.prototype.hasOwnProperty.call(config, 'maxRecords')) {
                this.maxRecords = normalizeMaxRecords(config.maxRecords, this.maxRecords);
                this.trimRecords();
            }
        },

        shouldSample(overrideSampleRate = null) {
            if (this.enabled !== true) return false;
            const sampleRate = normalizeSampleRate(overrideSampleRate, this.sampleRate);
            if (sampleRate >= 1) return true;
            if (sampleRate <= 0) return false;
            return Math.random() < sampleRate;
        },

        trimRecords() {
            const overflow = this.records.length - this.maxRecords;
            if (overflow <= 0) return;
            this.records.splice(0, overflow);
        },

        recordTiming(payload = {}) {
            const record = normalizeTimingRecord(payload);
            this.records.push(record);
            this.trimRecords();
            return record;
        },

        clearRecords() {
            this.records = [];
        }
    }
});
