const LABEL_SCALE_DIAGNOSTIC_STORAGE_KEY = 'cx:diag:label-scale';
const LABEL_SCALE_DIAGNOSTIC_QUERY_PARAM = 'diagLabelScale';
const LABEL_SCALE_DIAGNOSTIC_GLOBAL_KEY = '__CX_LABEL_SCALE_DIAGNOSTICS__';
const ENABLED_TOKENS = new Set(['1', 'true', 'yes', 'on', 'enabled']);

function normalizeToken(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isEnabledToken(value) {
  return ENABLED_TOKENS.has(normalizeToken(value));
}

function isDevEnvironment() {
  try {
    return import.meta?.env?.DEV === true;
  } catch {
    return false;
  }
}

function readDiagnosticsFlagFromQuery() {
  if (typeof window === 'undefined') return false;
  try {
    const search = String(window.location?.search ?? '');
    if (!search) return false;
    const params = new URLSearchParams(search);
    const token = params.get(LABEL_SCALE_DIAGNOSTIC_QUERY_PARAM);
    return isEnabledToken(token);
  } catch {
    return false;
  }
}

function readDiagnosticsFlagFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return isEnabledToken(window.localStorage.getItem(LABEL_SCALE_DIAGNOSTIC_STORAGE_KEY));
  } catch {
    return false;
  }
}

function readDiagnosticsFlagFromGlobal() {
  if (typeof window === 'undefined') return false;
  return window[LABEL_SCALE_DIAGNOSTIC_GLOBAL_KEY] === true;
}

export function isLabelScaleDiagnosticsEnabled() {
  if (!isDevEnvironment()) return false;
  return (
    readDiagnosticsFlagFromQuery() ||
    readDiagnosticsFlagFromStorage() ||
    readDiagnosticsFlagFromGlobal()
  );
}

export function logLabelScaleDiagnostic(eventName, payload = {}) {
  if (!isLabelScaleDiagnosticsEnabled()) return false;
  const eventToken = String(eventName ?? '').trim() || 'event';
  // eslint-disable-next-line no-console
  console.debug(`[diag][label-scale] ${eventToken}`, payload);
  return true;
}

export function enableLabelScaleDiagnosticsForSession() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(LABEL_SCALE_DIAGNOSTIC_STORAGE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function disableLabelScaleDiagnosticsForSession() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.removeItem(LABEL_SCALE_DIAGNOSTIC_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
