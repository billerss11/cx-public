import { createWorkerRequestClient, isWorkerRequestCancelledError } from './workerRequestClient.js';

const importerWorkerClient = createWorkerRequestClient(() => (
    new Worker(new URL('../workers/importWorker.js', import.meta.url), { type: 'module' })
));

export function parseStrictExcelProjectInWorker(fileBuffer) {
    const safeBuffer = fileBuffer instanceof ArrayBuffer ? fileBuffer : new ArrayBuffer(0);
    return importerWorkerClient.run(
        'parse-excel-project',
        { fileBuffer: safeBuffer },
        { transferables: [safeBuffer] }
    );
}

export function parseTrajectoryCsvInWorker(csvString) {
    return importerWorkerClient.run('parse-trajectory-csv', { csvString: String(csvString ?? '') });
}

export function cancelImporterWorkerJobs() {
    importerWorkerClient.cancelInFlight('Importer request superseded');
}

export function isImporterWorkerCancelledError(error) {
    return isWorkerRequestCancelledError(error);
}
