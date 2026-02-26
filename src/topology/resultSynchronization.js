function toSafeRequestId(value) {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric > 0) return numeric;
    return null;
}

function resolveTopologyResult(topologyEntry = {}) {
    const result = topologyEntry?.result;
    if (!result || typeof result !== 'object') return null;
    return result;
}

export function isTopologyResultSynchronized(topologyEntry = {}) {
    const result = resolveTopologyResult(topologyEntry);
    if (!result) return false;

    const latestRequestId = toSafeRequestId(topologyEntry?.latestRequestId);
    const resultRequestId = toSafeRequestId(result?.requestId);
    if (resultRequestId !== null) {
        if (latestRequestId === null) {
            return topologyEntry?.loading !== true;
        }
        return resultRequestId === latestRequestId;
    }

    return topologyEntry?.loading !== true && latestRequestId === null;
}

export function resolveSynchronizedTopologyResult(topologyEntry = {}) {
    if (!isTopologyResultSynchronized(topologyEntry)) return null;
    return resolveTopologyResult(topologyEntry);
}

export function resolveTopologyOverlaySynchronizationState(topologyEntry = {}, options = {}) {
    const result = resolveTopologyResult(topologyEntry);
    const latestRequestId = toSafeRequestId(topologyEntry?.latestRequestId);
    const resultRequestId = toSafeRequestId(result?.requestId);
    const expectedRequestId = toSafeRequestId(options?.expectedRequestId);
    const requireExpectedRequestId = options?.requireExpectedRequestId === true;
    const isLoading = topologyEntry?.loading === true;
    const hasResult = Boolean(result);
    const topologySynchronized = isTopologyResultSynchronized(topologyEntry);

    let matchesExpectedRequest = true;
    if (requireExpectedRequestId && expectedRequestId === null) {
        matchesExpectedRequest = false;
    } else if (expectedRequestId !== null) {
        matchesExpectedRequest = resultRequestId !== null && resultRequestId === expectedRequestId;
    }

    const isSynchronized = topologySynchronized && matchesExpectedRequest;

    let reason = 'synchronized';
    if (!hasResult) {
        reason = isLoading ? 'loading_no_result' : 'no_result';
    } else if (!topologySynchronized) {
        if (
            resultRequestId !== null
            && latestRequestId !== null
            && resultRequestId < latestRequestId
        ) {
            reason = 'stale_result';
        } else if (isLoading) {
            reason = 'loading_unsynchronized';
        } else {
            reason = 'unsynchronized';
        }
    } else if (!matchesExpectedRequest) {
        reason = requireExpectedRequestId && expectedRequestId === null
            ? 'expected_request_pending'
            : 'request_mismatch';
    }

    const overlaySuppressed = hasResult ? !isSynchronized : isLoading;
    return {
        latestRequestId,
        resultRequestId,
        expectedRequestId,
        requireExpectedRequestId,
        isLoading,
        hasResult,
        topologySynchronized,
        matchesExpectedRequest,
        isSynchronized,
        overlaySuppressed,
        reason
    };
}

export default {
    isTopologyResultSynchronized,
    resolveSynchronizedTopologyResult,
    resolveTopologyOverlaySynchronizationState
};
