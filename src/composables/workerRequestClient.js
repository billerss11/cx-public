const WORKER_CANCELLED_ERROR_CODE = 'WORKER_REQUEST_CANCELLED';

function createWorkerCancelledError(reason = 'Worker request cancelled') {
    const error = new Error(reason);
    error.code = WORKER_CANCELLED_ERROR_CODE;
    return error;
}

export function isWorkerRequestCancelledError(error) {
    return String(error?.code || '') === WORKER_CANCELLED_ERROR_CODE;
}

export function createWorkerRequestClient(createWorker) {
    let worker = null;
    let requestSequence = 0;
    let inFlight = null;

    function ensureWorker() {
        if (!worker) {
            worker = createWorker();
        }
        return worker;
    }

    function terminateWorker() {
        if (!worker) return;
        try {
            worker.terminate();
        } catch {
            // Ignore termination errors during cleanup.
        }
        worker = null;
    }

    function clearInFlight() {
        if (!inFlight) return;
        const { workerRef, onMessage, onError } = inFlight;
        workerRef.removeEventListener('message', onMessage);
        workerRef.removeEventListener('error', onError);
        inFlight = null;
    }

    function cancelInFlight(reason = 'Worker request superseded') {
        if (!inFlight) {
            terminateWorker();
            return;
        }

        const pendingReject = inFlight.reject;
        clearInFlight();
        terminateWorker();
        pendingReject(createWorkerCancelledError(reason));
    }

    function run(task, payload = {}, options = {}) {
        cancelInFlight();
        const workerRef = ensureWorker();
        const requestId = ++requestSequence;
        const transferables = Array.isArray(options.transferables) ? options.transferables : [];

        return new Promise((resolve, reject) => {
            const onMessage = (event) => {
                const message = event?.data || {};
                if (message.requestId !== requestId) return;
                clearInFlight();
                if (message.status === 'success') {
                    resolve(message.result);
                    return;
                }
                reject(new Error(message.error || 'Worker request failed.'));
            };

            const onError = (event) => {
                clearInFlight();
                reject(new Error(event?.message || 'Worker request crashed.'));
            };

            inFlight = { requestId, reject, workerRef, onMessage, onError };
            workerRef.addEventListener('message', onMessage);
            workerRef.addEventListener('error', onError);

            try {
                workerRef.postMessage({ requestId, task, payload }, transferables);
            } catch (error) {
                clearInFlight();
                reject(error);
            }
        });
    }

    function dispose() {
        cancelInFlight('Worker client disposed');
        terminateWorker();
    }

    return {
        run,
        cancelInFlight,
        dispose
    };
}
