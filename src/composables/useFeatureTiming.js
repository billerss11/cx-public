import { nextTick } from 'vue';
import { getActivePinia } from 'pinia';
import { useFeaturePerfStore } from '@/stores/featurePerfStore.js';

const DEFAULT_SLOW_LOG_THRESHOLD_MS = 180;
const FRONTEND_DOMINANT_MAX_RATIO = 0.3;
const BACKEND_DOMINANT_MIN_RATIO = 0.7;

function toFiniteNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function resolveNow() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function resolvePaintTimestamp(timestamp) {
    return toFiniteNumber(timestamp, resolveNow());
}

function waitForNextPaint() {
    if (typeof requestAnimationFrame === 'function') {
        return new Promise((resolve) => {
            requestAnimationFrame((timestamp) => resolve(resolvePaintTimestamp(timestamp)));
        });
    }
    return new Promise((resolve) => {
        setTimeout(() => resolve(resolveNow()), 0);
    });
}

function normalizeTimingMeta(meta = {}) {
    const source = meta && typeof meta === 'object' ? meta : {};
    return {
        backendMs: toFiniteNumber(source.backendMs, null),
        status: String(source.status ?? 'success').trim() || 'success',
        task: source.task ?? null,
        requestId: source.requestId ?? null,
        mode: source.mode ?? null,
    };
}

function resolveSlowThresholdMs(value) {
    const numeric = Math.trunc(toFiniteNumber(value, DEFAULT_SLOW_LOG_THRESHOLD_MS));
    return Number.isInteger(numeric) && numeric > 0 ? numeric : DEFAULT_SLOW_LOG_THRESHOLD_MS;
}

function roundToTenths(value) {
    const numeric = toFiniteNumber(value, null);
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 10) / 10;
}

function resolveDominantSegment(record) {
    const backendMs = toFiniteNumber(record?.backendMs, null);
    const totalMs = Math.max(0, toFiniteNumber(record?.totalMs, 0));
    if (!Number.isFinite(backendMs) || totalMs <= 0) {
        return {
            dominantSegment: 'unknown',
            backendRatio: null
        };
    }

    const backendRatio = Math.min(1, Math.max(0, backendMs / totalMs));
    if (backendRatio >= BACKEND_DOMINANT_MIN_RATIO) {
        return { dominantSegment: 'backend', backendRatio };
    }
    if (backendRatio <= FRONTEND_DOMINANT_MAX_RATIO) {
        return { dominantSegment: 'frontend', backendRatio };
    }
    return { dominantSegment: 'mixed', backendRatio };
}

function resolveOptimizationHint(dominantSegment) {
    if (dominantSegment === 'backend') {
        return 'Backend dominates; optimize task/IO/query path first.';
    }
    if (dominantSegment === 'frontend') {
        return 'Frontend dominates; optimize render/computation/update frequency.';
    }
    if (dominantSegment === 'mixed') {
        return 'Mixed bottleneck; optimize backend latency and frontend render cost.';
    }
    return 'Backend timing missing; add backendMs for precise split.';
}

function shouldEmitPerfLog(record, slowThresholdMs) {
    const status = String(record?.status ?? '').toLowerCase();
    if (status === 'error' || status === 'failed' || status === 'cancelled') {
        return { emit: true, trigger: status };
    }
    if (Math.max(0, toFiniteNumber(record?.totalMs, 0)) >= slowThresholdMs) {
        return { emit: true, trigger: 'slow' };
    }
    return { emit: false, trigger: 'normal' };
}

function resolveConsoleMethod(trigger) {
    if (trigger === 'error' || trigger === 'failed') return 'error';
    return 'warn';
}

function supportsSupportLogBridge() {
    return typeof window !== 'undefined' && typeof window.cxApp?.appendSupportLog === 'function';
}

function emitPerfLog(record, options = {}) {
    if (!record || typeof record !== 'object') return;

    const slowThresholdMs = resolveSlowThresholdMs(options?.slowLogThresholdMs);
    const emitDecision = shouldEmitPerfLog(record, slowThresholdMs);
    if (!emitDecision.emit) return;

    const dominant = resolveDominantSegment(record);
    const detail = {
        feature: record.feature,
        status: record.status,
        mode: record.mode ?? null,
        task: record.task ?? null,
        requestId: record.requestId ?? null,
        totalMs: roundToTenths(record.totalMs),
        backendMs: roundToTenths(record.backendMs),
        frontendMs: roundToTenths(record.frontendMs),
        backendRatio: roundToTenths(
            Number.isFinite(dominant.backendRatio) ? dominant.backendRatio * 100 : null
        ),
        dominantSegment: dominant.dominantSegment,
        trigger: emitDecision.trigger,
        thresholdMs: slowThresholdMs,
        optimizationHint: resolveOptimizationHint(dominant.dominantSegment),
        startedAt: record.startedAt ?? null,
        finishedAt: record.finishedAt ?? null
    };

    const consoleMethod = resolveConsoleMethod(emitDecision.trigger);
    const summary = [
        `[perf][${detail.trigger}]`,
        `feature=${detail.feature}`,
        `total=${detail.totalMs}ms`,
        detail.backendMs === null ? 'backend=n/a' : `backend=${detail.backendMs}ms`,
        detail.frontendMs === null ? 'frontend=n/a' : `frontend=${detail.frontendMs}ms`,
        `dominant=${detail.dominantSegment}`,
        `hint="${detail.optimizationHint}"`
    ].join(' | ');

    try {
        if (typeof console?.[consoleMethod] === 'function') {
            console[consoleMethod](summary, detail);
        } else if (typeof console?.log === 'function') {
            console.log(summary, detail);
        }
    } catch {
        // Ignore console transport failures.
    }

    if (!supportsSupportLogBridge()) return;

    Promise.resolve(
        window.cxApp.appendSupportLog({
            level: consoleMethod,
            event: 'frontend.feature_performance',
            payload: detail
        })
    ).catch(() => {
        // Ignore support log transport failures to keep UX unaffected.
    });
}

export function useFeatureTiming() {
    function resolveFeaturePerfStore() {
        if (!getActivePinia()) return null;
        return useFeaturePerfStore();
    }

    function startFeatureTimer(feature, options = {}) {
        const featurePerfStore = resolveFeaturePerfStore();
        const featureName = String(feature ?? '').trim() || 'unknown.feature';
        const sampled = featurePerfStore
            ? featurePerfStore.shouldSample(options?.sampleRate ?? null)
            : false;
        const startedAt = new Date().toISOString();
        const startedAtMs = resolveNow();

        let ended = false;
        let finalRecord = null;

        async function end(meta = {}) {
            if (ended) return finalRecord;
            ended = true;
            if (!sampled) return null;
            if (!featurePerfStore) return null;

            await nextTick();
            const paintTimestamp = await waitForNextPaint();
            const totalMs = Math.max(0, paintTimestamp - startedAtMs);
            const normalizedMeta = normalizeTimingMeta(meta);
            finalRecord = featurePerfStore.recordTiming({
                feature: featureName,
                startedAt,
                finishedAt: new Date().toISOString(),
                totalMs,
                backendMs: normalizedMeta.backendMs,
                status: normalizedMeta.status,
                task: normalizedMeta.task,
                requestId: normalizedMeta.requestId,
                mode: normalizedMeta.mode,
            });
            emitPerfLog(finalRecord, options);
            return finalRecord;
        }

        return {
            sampled,
            end,
        };
    }

    async function timeFeature(feature, execute, options = {}) {
        const timer = startFeatureTimer(feature, options);
        try {
            const result = await execute();
            const successMeta = typeof options.resolveMeta === 'function'
                ? options.resolveMeta(result)
                : options.meta;
            void timer.end({
                ...successMeta,
                status: options?.successStatus ?? 'success',
            });
            return result;
        } catch (error) {
            const errorMeta = typeof options.resolveErrorMeta === 'function'
                ? options.resolveErrorMeta(error)
                : options.errorMeta;
            void timer.end({
                ...errorMeta,
                status: options?.errorStatus ?? 'error',
            });
            throw error;
        }
    }

    return {
        startFeatureTimer,
        timeFeature,
    };
}

export default useFeatureTiming;
