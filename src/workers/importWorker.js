import { parseStrictExcelProject, parseTrajectoryCSV } from '@/composables/useImporter.js';

self.onmessage = (event) => {
    const message = event?.data || {};
    const requestId = message.requestId;
    const task = String(message.task || '');
    const payload = message.payload || {};

    try {
        if (task === 'parse-excel-project') {
            const result = parseStrictExcelProject(payload.fileBuffer);
            self.postMessage({ requestId, status: 'success', result });
            return;
        }

        if (task === 'parse-trajectory-csv') {
            const result = parseTrajectoryCSV(String(payload.csvString || ''));
            self.postMessage({ requestId, status: 'success', result });
            return;
        }

        self.postMessage({
            requestId,
            status: 'error',
            error: `Unknown import worker task: ${task}`
        });
    } catch (error) {
        self.postMessage({
            requestId,
            status: 'error',
            error: error?.message || 'Import worker failed.'
        });
    }
};
