import { buildTopologyModel } from '@/topology/topologyCore.js';

self.onmessage = (event) => {
    const message = event?.data || {};
    const requestId = Number(message?.requestId);
    const task = String(message?.task || '');
    const payload = message?.payload || {};

    if (!Number.isInteger(requestId)) {
        self.postMessage({
            requestId: null,
            status: 'error',
            error: 'Topology worker request is missing a valid requestId.'
        });
        return;
    }

    try {
        if (task !== 'build-topology-model') {
            self.postMessage({
                requestId,
                status: 'error',
                error: `Unknown topology worker task: ${task}`
            });
            return;
        }

        const result = buildTopologyModel(payload?.stateSnapshot, {
            requestId,
            wellId: payload?.wellId
        });
        self.postMessage({
            requestId,
            status: 'success',
            result
        });
    } catch (error) {
        self.postMessage({
            requestId,
            status: 'error',
            error: error?.message || 'Topology worker failed.'
        });
    }
};
