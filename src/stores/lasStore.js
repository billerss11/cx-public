import { markRaw } from 'vue';
import { defineStore } from 'pinia';
import { backendRequest, getBackendResultMeta, openLasCsvSaveDialog, openLasFileDialog } from '@/composables/useBackendClient.js';
import { normalizeLasTimeAxisSettings } from '@/utils/lasTimeAxis.js';

const LARGE_LAS_FILE_THRESHOLD_BYTES = 25 * 1024 * 1024;

function normalizeRequestMeta(rawMeta, fallbackTask) {
    if (!rawMeta || typeof rawMeta !== 'object') {
        return {
            task: fallbackTask,
            requestId: null,
            elapsedMs: null,
            taskVersion: null,
            resultModelVersion: null,
        };
    }

    const elapsedMs = Number.isFinite(Number(rawMeta.elapsedMs)) ? Number(rawMeta.elapsedMs) : null;
    return {
        task: rawMeta.task || fallbackTask,
        requestId: rawMeta.requestId ?? null,
        elapsedMs,
        taskVersion: rawMeta.taskVersion ?? null,
        resultModelVersion: rawMeta.resultModelVersion ?? null,
    };
}

function normalizeBackendError(err, fallbackMessage, fallbackTask) {
    return {
        message: err?.message || fallbackMessage,
        code: err?.code || null,
        details: err?.details ?? null,
        requestMeta: normalizeRequestMeta(
            {
                task: err?.task || fallbackTask,
                requestId: err?.requestId ?? null,
                elapsedMs: err?.elapsedMs ?? null,
                taskVersion: err?.taskVersion ?? null,
                resultModelVersion: err?.resultModelVersion ?? null,
            },
            fallbackTask
        ),
    };
}

function normalizeFileSizeBytes(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    return Math.trunc(numeric);
}

function formatFileSizeMb(bytes) {
    const safeBytes = normalizeFileSizeBytes(bytes);
    if (!Number.isFinite(safeBytes)) return null;
    const mb = safeBytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
}

function normalizeOptionalText(value) {
    const token = String(value ?? '').trim();
    return token || null;
}

function resolveLargeLasFileWarning(dialogResult = {}) {
    const fileSizeBytes = normalizeFileSizeBytes(dialogResult?.fileSizeBytes);
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= LARGE_LAS_FILE_THRESHOLD_BYTES) {
        return null;
    }

    const fileSizeLabel = formatFileSizeMb(fileSizeBytes) ?? 'unknown size';
    const thresholdLabel = formatFileSizeMb(LARGE_LAS_FILE_THRESHOLD_BYTES) ?? '25.0 MB';
    return {
        code: 'LAS_LARGE_FILE',
        message: `Large LAS file selected (${fileSizeLabel}). Import may take longer than usual (threshold: ${thresholdLabel}).`,
        filePath: normalizeOptionalText(dialogResult?.filePath),
        fileName: normalizeOptionalText(dialogResult?.fileName),
        fileSizeBytes,
        fileSizeLabel,
        thresholdBytes: LARGE_LAS_FILE_THRESHOLD_BYTES,
        thresholdLabel,
    };
}

function emitLargeLasFileWarningLog(warning = null) {
    if (!warning || typeof warning !== 'object') return;
    if (typeof window === 'undefined' || typeof window.cxApp?.appendSupportLog !== 'function') return;

    const payload = {
        feature: 'las.import',
        warningCode: warning.code,
        filePath: warning.filePath,
        fileName: warning.fileName,
        fileSizeBytes: warning.fileSizeBytes,
        fileSizeLabel: warning.fileSizeLabel,
        thresholdBytes: warning.thresholdBytes,
        thresholdLabel: warning.thresholdLabel,
        optimizationHint: 'Large LAS file; consider reducing requested curves/range or improving parse pipeline.'
    };

    Promise.resolve(
        window.cxApp.appendSupportLog({
            level: 'warn',
            event: 'las.large_file_warning',
            payload
        })
    ).catch(() => {
        // Do not block import flow on support-log transport errors.
    });
}

function normalizeCurveMnemonic(value) {
    const token = String(value ?? '').trim();
    return token || null;
}

function curveExistsInSession(session = {}, curveMnemonic = null) {
    const normalizedCurveMnemonic = normalizeCurveMnemonic(curveMnemonic);
    if (!normalizedCurveMnemonic) return false;

    const curves = Array.isArray(session?.curves) ? session.curves : null;
    if (!curves || curves.length === 0) return true;
    return curves.some((curve) => normalizeCurveMnemonic(curve?.mnemonic) === normalizedCurveMnemonic);
}

function resolveSessionIndexCurve(session = {}, explicitIndexCurve = null) {
    const explicit = normalizeCurveMnemonic(explicitIndexCurve);
    if (explicit && curveExistsInSession(session, explicit)) return explicit;

    const selected = normalizeCurveMnemonic(session?.selectedIndexCurve);
    if (selected && curveExistsInSession(session, selected)) return selected;

    const fallback = normalizeCurveMnemonic(session?.indexCurve);
    if (fallback && curveExistsInSession(session, fallback)) return fallback;
    return explicit || selected || fallback;
}

function hasIndexCurveOverride(session = {}, effectiveIndexCurve = null) {
    const normalizedEffective = normalizeCurveMnemonic(effectiveIndexCurve);
    const normalizedDefault = normalizeCurveMnemonic(session?.indexCurve);
    return Boolean(normalizedEffective && normalizedDefault && normalizedEffective !== normalizedDefault);
}

function normalizeTaskOptions(options = {}) {
    const source = options && typeof options === 'object' ? options : {};
    const next = { ...source };
    delete next.indexCurve;
    return next;
}

function resolveSessionTimeAxisSettings(session = {}) {
    return normalizeLasTimeAxisSettings(session?.timeAxisSettings);
}

function buildSafeCsvFileToken(value, fallback = 'las-curves') {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    const normalized = raw
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return normalized || fallback;
}

function buildCurveCsvDefaultFileName(session = {}, scope = 'selected') {
    const baseToken = buildSafeCsvFileToken(session?.wellName || session?.fileName, 'las-curves');
    const scopeToken = scope === 'all' ? 'all-curves' : 'selected-curves';
    return `${baseToken}-${scopeToken}.csv`;
}

export const useLasStore = defineStore('las', {
    state: () => ({
        sessions: {},
        activeSessionId: null,
        curveData: {},
        curveStatistics: {},
        correlationMatrix: {},
        loading: false,
        error: null,
        errorCode: null,
        errorDetails: null,
        warning: null,
        lastRequestMeta: null,
    }),

    getters: {
        activeSession(state) {
            if (!state.activeSessionId) return null;
            return state.sessions[state.activeSessionId] ?? null;
        },
        sessionList(state) {
            return Object.values(state.sessions);
        },
        activeCurves(state) {
            const session = this.activeSession;
            if (!session) return [];
            return session.curves ?? [];
        },
        activeSelectedCurves(state) {
            const session = this.activeSession;
            if (!session) return [];
            return session.selectedCurves ?? [];
        },
        activeCurveData(state) {
            if (!state.activeSessionId) return null;
            return state.curveData[state.activeSessionId] ?? null;
        },
        activeCurveStatistics(state) {
            if (!state.activeSessionId) return null;
            return state.curveStatistics[state.activeSessionId] ?? null;
        },
        activeCorrelationMatrix(state) {
            if (!state.activeSessionId) return null;
            return state.correlationMatrix[state.activeSessionId] ?? null;
        },
    },

    actions: {
        clearBackendStatus() {
            this.error = null;
            this.errorCode = null;
            this.errorDetails = null;
        },

        clearWarning() {
            this.warning = null;
        },

        applyBackendError(err, fallbackMessage, fallbackTask) {
            const normalized = normalizeBackendError(err, fallbackMessage, fallbackTask);
            this.error = normalized.message;
            this.errorCode = normalized.code;
            this.errorDetails = normalized.details;
            this.lastRequestMeta = normalized.requestMeta;
        },

        setLastRequestMetaFromResult(result, fallbackTask) {
            this.lastRequestMeta = normalizeRequestMeta(getBackendResultMeta(result), fallbackTask);
        },

        async openAndParseFile() {
            const dialogResult = await openLasFileDialog();
            if (dialogResult.canceled) return null;
            this.warning = resolveLargeLasFileWarning(dialogResult);
            emitLargeLasFileWarningLog(this.warning);
            return this.parseFile(dialogResult.filePath);
        },

        async parseFile(filePath) {
            this.loading = true;
            this.clearBackendStatus();
            try {
                const result = await backendRequest('las.parse_file', { filePath });
                const sessionId = result.sessionId;

                this.sessions[sessionId] = {
                    ...result,
                    filePath,
                    timeAxisSettings: resolveSessionTimeAxisSettings(result),
                    selectedIndexCurve: resolveSessionIndexCurve(result, result?.indexCurve),
                    selectedCurves: [],
                };
                this.activeSessionId = sessionId;
                this.setLastRequestMetaFromResult(result, 'las.parse_file');
                return sessionId;
            } catch (err) {
                this.applyBackendError(err, 'Failed to parse LAS file.', 'las.parse_file');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async fetchCurveData(curveNames, options = {}) {
            const session = this.activeSession;
            if (!session) throw new Error('No active LAS session.');
            const indexCurve = resolveSessionIndexCurve(session, options?.indexCurve);
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, indexCurve);
            if (!selectedCurveNames.length) {
                throw new Error('Select at least one non-index curve.');
            }

            this.loading = true;
            this.clearBackendStatus();
            try {
                const payloadOptions = normalizeTaskOptions(options);
                const payload = {
                    sessionId: session.sessionId,
                    curveMnemonics: [...selectedCurveNames],
                    ...payloadOptions,
                };
                if (hasIndexCurveOverride(session, indexCurve)) {
                    payload.indexCurve = indexCurve;
                }
                const result = await backendRequest('las.get_curve_data', payload);
                this.curveData[session.sessionId] = markRaw(result);
                this.setLastRequestMetaFromResult(result, 'las.get_curve_data');

                this.sessions[session.sessionId] = {
                    ...this.sessions[session.sessionId],
                    selectedIndexCurve: indexCurve ?? resolveSessionIndexCurve(session),
                    selectedCurves: [...selectedCurveNames],
                };

                return result;
            } catch (err) {
                this.applyBackendError(err, 'Failed to fetch curve data.', 'las.get_curve_data');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async fetchCurveValuesAtDepth(depth, curveNames, options = {}) {
            const session = this.activeSession;
            if (!session) throw new Error('No active LAS session.');
            const indexCurve = resolveSessionIndexCurve(session, options?.indexCurve);
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, indexCurve);
            if (!selectedCurveNames.length) {
                throw new Error('Select at least one non-index curve.');
            }

            const numericDepth = Number(depth);
            if (!Number.isFinite(numericDepth)) {
                throw new Error('Depth must be a finite number.');
            }

            this.clearBackendStatus();
            try {
                const payloadOptions = normalizeTaskOptions(options);
                const payload = {
                    sessionId: session.sessionId,
                    depth: numericDepth,
                    curveMnemonics: [...selectedCurveNames],
                    ...payloadOptions,
                };
                if (hasIndexCurveOverride(session, indexCurve)) {
                    payload.indexCurve = indexCurve;
                }
                const result = await backendRequest('las.get_curve_values_at_depth', payload);
                this.setLastRequestMetaFromResult(result, 'las.get_curve_values_at_depth');
                return result;
            } catch (err) {
                this.applyBackendError(err, 'Failed to fetch curve values at depth.', 'las.get_curve_values_at_depth');
                throw err;
            }
        },

        async fetchCurveStatistics(curveNames) {
            const session = this.activeSession;
            if (!session) throw new Error('No active LAS session.');
            const indexCurve = resolveSessionIndexCurve(session);
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, indexCurve);
            if (!selectedCurveNames.length) {
                throw new Error('Select at least one non-index curve.');
            }

            this.loading = true;
            this.clearBackendStatus();
            try {
                const payload = {
                    sessionId: session.sessionId,
                    curveMnemonics: [...selectedCurveNames],
                };
                const result = await backendRequest('las.get_curve_statistics', payload);
                this.curveStatistics[session.sessionId] = result;
                this.setLastRequestMetaFromResult(result, 'las.get_curve_statistics');
                return result;
            } catch (err) {
                this.applyBackendError(err, 'Failed to calculate curve statistics.', 'las.get_curve_statistics');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async fetchCorrelationMatrix(curveNames, options = {}) {
            const session = this.activeSession;
            if (!session) throw new Error('No active LAS session.');
            const indexCurve = resolveSessionIndexCurve(session);
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, indexCurve);
            if (selectedCurveNames.length < 2) {
                throw new Error('Select at least two non-index curves.');
            }

            this.loading = true;
            this.clearBackendStatus();
            try {
                const payload = {
                    sessionId: session.sessionId,
                    curveMnemonics: [...selectedCurveNames],
                    ...options,
                };
                const result = await backendRequest('las.get_correlation_matrix', payload);
                this.correlationMatrix[session.sessionId] = result;
                this.setLastRequestMetaFromResult(result, 'las.get_correlation_matrix');
                return result;
            } catch (err) {
                this.applyBackendError(err, 'Failed to calculate correlation matrix.', 'las.get_correlation_matrix');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async exportCurveDataCsv(curveNames, options = {}) {
            const session = this.activeSession;
            if (!session) throw new Error('No active LAS session.');
            const indexCurve = resolveSessionIndexCurve(session, options?.indexCurve);
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, indexCurve);
            if (!selectedCurveNames.length) {
                throw new Error('Select at least one non-index curve.');
            }

            this.loading = true;
            this.clearBackendStatus();
            try {
                const scope = String(options?.scope || 'selected').trim().toLowerCase() === 'all'
                    ? 'all'
                    : 'selected';
                const dialogResult = await openLasCsvSaveDialog({
                    defaultFileName: buildCurveCsvDefaultFileName(session, scope),
                });
                if (dialogResult?.canceled) return { canceled: true };

                const filePath = String(dialogResult?.filePath ?? '').trim();
                if (!filePath) {
                    throw new Error('Failed to resolve CSV export path.');
                }

                const payload = {
                    sessionId: session.sessionId,
                    curveMnemonics: [...selectedCurveNames],
                    outputFilePath: filePath,
                };
                if (hasIndexCurveOverride(session, indexCurve)) {
                    payload.indexCurve = indexCurve;
                }
                const result = await backendRequest('las.export_curve_data_csv', payload);
                this.setLastRequestMetaFromResult(result, 'las.export_curve_data_csv');
                return {
                    canceled: false,
                    ...result,
                    outputFilePath: result?.outputFilePath ?? filePath,
                    fileName: result?.fileName ?? dialogResult?.fileName ?? null,
                };
            } catch (err) {
                this.applyBackendError(err, 'Failed to export curve CSV.', 'las.export_curve_data_csv');
                throw err;
            } finally {
                this.loading = false;
            }
        },

        async deleteSession(sessionId) {
            const id = sessionId || this.activeSessionId;
            if (!id) return;

            try {
                await backendRequest('las.delete_session', { sessionId: id });
            } catch {
                // best-effort cleanup
            }

            delete this.sessions[id];
            delete this.curveData[id];
            delete this.curveStatistics[id];
            delete this.correlationMatrix[id];

            if (this.activeSessionId === id) {
                const remaining = Object.keys(this.sessions);
                this.activeSessionId = remaining.length > 0 ? remaining[0] : null;
            }
        },

        setActiveSession(sessionId) {
            if (sessionId in this.sessions) {
                this.activeSessionId = sessionId;
            }
        },

        setSelectedCurves(curveNames) {
            if (!this.activeSessionId || !this.sessions[this.activeSessionId]) return;
            const session = this.sessions[this.activeSessionId];
            const indexCurve = resolveSessionIndexCurve(session);
            const selectedCurveNames = normalizeRequestedCurveNames(curveNames, indexCurve);
            this.sessions[this.activeSessionId] = {
                ...session,
                selectedCurves: [...selectedCurveNames],
            };
        },

        setSessionIndexCurve(indexCurve, sessionId = null) {
            const id = sessionId || this.activeSessionId;
            if (!id || !this.sessions[id]) return null;

            const session = this.sessions[id];
            const resolvedIndexCurve = resolveSessionIndexCurve(session, indexCurve);
            if (!resolvedIndexCurve) return null;

            const selectedCurves = normalizeRequestedCurveNames(session.selectedCurves, resolvedIndexCurve);
            this.sessions[id] = {
                ...session,
                selectedIndexCurve: resolvedIndexCurve,
                selectedCurves: [...selectedCurves],
            };

            return resolvedIndexCurve;
        },

        setSessionTimeAxisSettings(patch = {}, sessionId = null) {
            const id = sessionId || this.activeSessionId;
            if (!id || !this.sessions[id]) return null;

            const session = this.sessions[id];
            const nextSettings = normalizeLasTimeAxisSettings({
                ...resolveSessionTimeAxisSettings(session),
                ...(patch && typeof patch === 'object' ? patch : {}),
            });
            this.sessions[id] = {
                ...session,
                timeAxisSettings: nextSettings,
            };
            return nextSettings;
        },

        clearError() {
            this.clearBackendStatus();
        },
    },
});

function normalizeRequestedCurveNames(curveNames, indexCurve) {
    const requestedCurveNames = Array.isArray(curveNames)
        ? curveNames
            .map((curve) => normalizeCurveMnemonic(curve))
            .filter((curve) => Boolean(curve))
        : [];
    const uniqueCurveNames = [...new Set(requestedCurveNames)];
    const normalizedIndexCurve = normalizeCurveMnemonic(indexCurve);
    if (!normalizedIndexCurve) return uniqueCurveNames;
    return uniqueCurveNames.filter((curve) => curve !== normalizedIndexCurve);
}
