import { cloneSnapshot } from '@/utils/general.js';

const TOPOLOGY_WORKER_CANCELLED_ERROR_CODE = 'TOPOLOGY_WORKER_REQUEST_CANCELLED';

let topologyWorker = null;
let requestSequence = 0;
const pendingRequests = new Map();

function createTopologyWorkerCancelledError(reason = 'Topology worker request cancelled') {
    const error = new Error(reason);
    error.code = TOPOLOGY_WORKER_CANCELLED_ERROR_CODE;
    return error;
}

function ensureTopologyWorker() {
    if (topologyWorker) return topologyWorker;

    topologyWorker = new Worker(
        new URL('../workers/topologyWorker.js', import.meta.url),
        { type: 'module' }
    );
    topologyWorker.addEventListener('message', handleTopologyWorkerMessage);
    topologyWorker.addEventListener('error', handleTopologyWorkerError);
    return topologyWorker;
}

function terminateTopologyWorker() {
    if (!topologyWorker) return;
    try {
        topologyWorker.removeEventListener('message', handleTopologyWorkerMessage);
        topologyWorker.removeEventListener('error', handleTopologyWorkerError);
        topologyWorker.terminate();
    } catch {
        // Ignore worker cleanup errors.
    }
    topologyWorker = null;
}

function rejectPendingRequests(error) {
    pendingRequests.forEach((pending) => {
        pending.reject(error);
    });
    pendingRequests.clear();
}

function cancelPendingRequests(reason = 'Topology request superseded') {
    if (pendingRequests.size === 0) return;
    rejectPendingRequests(createTopologyWorkerCancelledError(reason));
}

function handleTopologyWorkerMessage(event) {
    const message = event?.data || {};
    const requestId = Number(message?.requestId);
    if (!Number.isInteger(requestId)) return;

    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);

    if (message?.status === 'success') {
        pending.resolve(message?.result);
        return;
    }

    pending.reject(new Error(message?.error || 'Topology worker request failed.'));
}

function handleTopologyWorkerError(event) {
    const message = event?.message || 'Topology worker crashed.';
    rejectPendingRequests(new Error(message));
    terminateTopologyWorker();
}

function postTopologyRequest(task, payload = {}, options = {}) {
    const worker = ensureTopologyWorker();
    if (options.supersedeInFlight !== false) {
        cancelPendingRequests(options.supersedeReason || 'Topology request superseded');
    }

    const requestId = ++requestSequence;
    const promise = new Promise((resolve, reject) => {
        pendingRequests.set(requestId, { resolve, reject });

        try {
            const workerSafePayload = cloneSnapshot(payload);
            worker.postMessage({
                requestId,
                task,
                payload: workerSafePayload
            });
        } catch (error) {
            pendingRequests.delete(requestId);
            reject(error);
        }
    });

    return { requestId, promise };
}

export function requestTopologyModelInWorker(stateSnapshot = {}, options = {}) {
    return postTopologyRequest('build-topology-model', {
        stateSnapshot,
        wellId: String(options?.wellId ?? '').trim() || null
    }, options);
}

export function buildTopologyModelInWorker(stateSnapshot = {}, options = {}) {
    return requestTopologyModelInWorker(stateSnapshot, options).promise;
}

export function cancelTopologyWorkerJobs(reason = 'Topology request cancelled') {
    cancelPendingRequests(reason);
}

export function disposeTopologyWorker(reason = 'Topology worker disposed') {
    cancelPendingRequests(reason);
    terminateTopologyWorker();
}

export function isTopologyWorkerCancelledError(error) {
    return String(error?.code || '') === TOPOLOGY_WORKER_CANCELLED_ERROR_CODE;
}
