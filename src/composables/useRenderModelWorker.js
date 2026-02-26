import { createWorkerRequestClient, isWorkerRequestCancelledError } from './workerRequestClient.js';

const renderModelWorkerClient = createWorkerRequestClient(() => (
    new Worker(new URL('../workers/renderModelWorker.js', import.meta.url), { type: 'module' })
));

export function buildVerticalRenderModelInWorker(stateSnapshot = {}) {
    return renderModelWorkerClient.run('build-vertical-render-model', { stateSnapshot });
}

export function buildDirectionalRenderModelInWorker(stateSnapshot = {}) {
    return renderModelWorkerClient.run('build-directional-render-model', { stateSnapshot });
}

export function cancelRenderModelWorkerJobs() {
    renderModelWorkerClient.cancelInFlight('Render model request superseded');
}

export function isRenderModelWorkerCancelledError(error) {
    return isWorkerRequestCancelledError(error);
}
