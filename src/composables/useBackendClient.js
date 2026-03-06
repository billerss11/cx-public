const BACKEND_ERROR_CODE = 'BACKEND_REQUEST_ERROR';
const BACKEND_META_KEY = '__backendMeta';

function isElectronEnvironment() {
    return typeof window !== 'undefined' && typeof window.cxApp?.backendRequest === 'function';
}

function normalizeElapsedMs(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
}

function attachBackendResultMeta(result, metadata) {
    if (!result || typeof result !== 'object') {
        return result;
    }

    Object.defineProperty(result, BACKEND_META_KEY, {
        value: metadata,
        enumerable: false,
        configurable: true,
    });
    return result;
}

export function getBackendResultMeta(result) {
    if (!result || typeof result !== 'object') return null;
    return result[BACKEND_META_KEY] ?? null;
}

export function createBackendRequestError(message, code = BACKEND_ERROR_CODE, metadata = {}) {
    const error = new Error(message);
    error.code = code;
    error.task = metadata.task ?? null;
    error.requestId = metadata.requestId ?? null;
    error.elapsedMs = normalizeElapsedMs(metadata.elapsedMs);
    error.details = metadata.details ?? null;
    error.taskVersion = metadata.taskVersion ?? null;
    error.resultModelVersion = metadata.resultModelVersion ?? null;
    if (metadata.cause) {
        error.cause = metadata.cause;
    }
    return error;
}

export function isBackendRequestError(error) {
    return typeof error?.code === 'string' && error.code !== '';
}

export async function backendRequest(task, payload = {}) {
    if (!isElectronEnvironment()) {
        throw createBackendRequestError(
            'Backend is only available in the Electron desktop app.',
            'NOT_ELECTRON',
            { task }
        );
    }

    let response = null;
    try {
        response = await window.cxApp.backendRequest(task, payload);
    } catch (error) {
        throw createBackendRequestError(
            error?.message || 'Backend transport request failed.',
            error?.code || BACKEND_ERROR_CODE,
            {
                task: error?.task || task,
                requestId: error?.requestId ?? null,
                elapsedMs: error?.elapsedMs ?? null,
                details: error?.details ?? null,
                cause: error,
            }
        );
    }

    if (!response || typeof response !== 'object') {
        throw createBackendRequestError('Backend returned an invalid response shape.', 'BACKEND_INVALID_RESPONSE', {
            task,
        });
    }

    if (!response?.ok) {
        const msg = response?.error?.message || 'Backend request failed.';
        throw createBackendRequestError(msg, response?.error?.code || BACKEND_ERROR_CODE, {
            task: response?.task || task,
            requestId: response?.requestId ?? null,
            elapsedMs: response?.metrics?.elapsedMs ?? null,
            details: response?.error?.details ?? null,
            taskVersion: response?.taskVersion ?? null,
            resultModelVersion: response?.resultModelVersion ?? null,
        });
    }

    return attachBackendResultMeta(response.result, {
        task: response?.task || task,
        requestId: response?.requestId ?? null,
        elapsedMs: normalizeElapsedMs(response?.metrics?.elapsedMs),
        taskVersion: response?.taskVersion ?? null,
        resultModelVersion: response?.resultModelVersion ?? null,
    });
}

export async function openLasFileDialog() {
    if (!isElectronEnvironment()) {
        throw createBackendRequestError(
            'File dialogs are only available in the Electron desktop app.',
            'NOT_ELECTRON'
        );
    }

    return window.cxApp.openLasFileDialog();
}

export async function openLasCsvSaveDialog(options = {}) {
    if (!isElectronEnvironment()) {
        throw createBackendRequestError(
            'File dialogs are only available in the Electron desktop app.',
            'NOT_ELECTRON'
        );
    }

    return window.cxApp.openLasCsvSaveDialog(options);
}
