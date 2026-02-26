const WORKER_FALLBACK_COUNTS = new Map();
export const WORKER_FALLBACK_EVENT = 'cx:worker-fallback';

function normalizeFallbackKey(value) {
    const token = String(value ?? '').trim();
    return token || 'unknown-worker-task';
}

function emitWorkerFallbackEvent(detail) {
    if (typeof window === 'undefined') return;
    if (typeof window.dispatchEvent !== 'function') return;
    if (typeof CustomEvent !== 'function') return;
    try {
        window.dispatchEvent(new CustomEvent(WORKER_FALLBACK_EVENT, { detail }));
    } catch {
        // Ignore browser/runtime event dispatch edge cases.
    }
}

export function getWorkerFallbackStats() {
    return Object.fromEntries(WORKER_FALLBACK_COUNTS.entries());
}

export function reportWorkerFallback({ key, context, error } = {}) {
    const fallbackKey = normalizeFallbackKey(key);
    const count = (WORKER_FALLBACK_COUNTS.get(fallbackKey) || 0) + 1;
    WORKER_FALLBACK_COUNTS.set(fallbackKey, count);

    const safeContext = String(context ?? fallbackKey).trim() || fallbackKey;
    const summary = `[worker-fallback:${fallbackKey}] ${safeContext} failed; using main-thread fallback (count=${count}).`;

    // Escalate the first fallback so misconfiguration is obvious during development.
    if (count === 1) {
        console.error(`${summary} Verify worker bundle loading and runtime configuration.`, error);
    } else {
        console.warn(summary, error);
    }

    emitWorkerFallbackEvent({
        key: fallbackKey,
        context: safeContext,
        count,
        message: error?.message || String(error ?? '')
    });

    return { key: fallbackKey, count };
}

export async function runWithWorkerFallback({
    key,
    context,
    runWorker,
    runFallback,
    isCancelledError
} = {}) {
    if (typeof runWorker !== 'function') {
        throw new Error('runWithWorkerFallback requires a runWorker function.');
    }
    if (typeof runFallback !== 'function') {
        throw new Error('runWithWorkerFallback requires a runFallback function.');
    }

    try {
        return await runWorker();
    } catch (error) {
        if (typeof isCancelledError === 'function' && isCancelledError(error)) {
            throw error;
        }
        const fallbackInfo = reportWorkerFallback({ key, context, error });
        return runFallback(error, fallbackInfo);
    }
}
