const TIME_DISPLAY_MODES = Object.freeze({
  ELAPSED: 'elapsed',
  CLOCK: 'clock',
});

const TIMEZONE_MODES = Object.freeze({
  UTC: 'UTC',
  LOCAL: 'LOCAL',
});

const TIME_UNIT_TO_MS = Object.freeze({
  ns: 0.000001,
  us: 0.001,
  ms: 1,
  msec: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  min: 60000,
  mins: 60000,
  minute: 60000,
  minutes: 60000,
  h: 3600000,
  hr: 3600000,
  hrs: 3600000,
  hour: 3600000,
  hours: 3600000,
});

function normalizeText(value) {
  const token = String(value ?? '').trim();
  return token;
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function padNumber(value, width = 2) {
  return String(value).padStart(width, '0');
}

function resolveYearFromTwoDigits(yearTwoDigits) {
  if (yearTwoDigits >= 70) return 1900 + yearTwoDigits;
  return 2000 + yearTwoDigits;
}

function parseTimeOfDay(rawTimeText) {
  const text = normalizeText(rawTimeText);
  if (!text) return null;
  const match = text.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  const millisecond = Number(String(match[4] ?? '0').padEnd(3, '0'));
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;
  if (millisecond < 0 || millisecond > 999) return null;
  return { hour, minute, second, millisecond };
}

function parseDateWithHint(rawDateText, rawUnitHint) {
  const dateText = normalizeText(rawDateText);
  if (!dateText) return null;
  const unitHint = normalizeUpper(rawUnitHint).replace(/\s+/g, '');
  const slashMatch = dateText.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const third = Number(slashMatch[3]);

    if (unitHint.includes('YY/MM/DD')) {
      const year = third <= 99 ? resolveYearFromTwoDigits(third) : third;
      return { year, month: second, day: first };
    }
    if (unitHint.includes('DD/MM/YY') || unitHint.includes('DD/MM/YYYY')) {
      const year = third <= 99 ? resolveYearFromTwoDigits(third) : third;
      return { year, month: second, day: first };
    }
    if (unitHint.includes('MM/DD/YY') || unitHint.includes('MM/DD/YYYY')) {
      const year = third <= 99 ? resolveYearFromTwoDigits(third) : third;
      return { year, month: first, day: second };
    }
    if (unitHint.includes('YYYY/MM/DD')) {
      return { year: first, month: second, day: third };
    }

    if (first > 31) {
      return { year: first, month: second, day: third };
    }
    if (second > 12) {
      const year = third <= 99 ? resolveYearFromTwoDigits(third) : third;
      return { year, month: first, day: second };
    }
    if (first > 12) {
      const year = third <= 99 ? resolveYearFromTwoDigits(third) : third;
      return { year, month: second, day: first };
    }
    const year = third <= 99 ? resolveYearFromTwoDigits(third) : third;
    return { year, month: first, day: second };
  }

  const dashIsoMatch = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashIsoMatch) {
    return {
      year: Number(dashIsoMatch[1]),
      month: Number(dashIsoMatch[2]),
      day: Number(dashIsoMatch[3]),
    };
  }

  const parsedEpoch = Date.parse(dateText);
  if (!Number.isFinite(parsedEpoch)) return null;
  const date = new Date(parsedEpoch);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toEpochMsFromParts(parts) {
  if (!parts) return null;
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0,
  } = parts;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  if (!Number.isFinite(second) || second < 0 || second > 59) return null;
  if (!Number.isFinite(millisecond) || millisecond < 0 || millisecond > 999) return null;
  return Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
}

function parseFlexibleDateTime(rawValue) {
  const text = normalizeText(rawValue);
  if (!text) return null;
  const normalized = text.replace('T', ' ');
  const dateTimeMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?$/);
  if (dateTimeMatch) {
    return toEpochMsFromParts({
      year: Number(dateTimeMatch[1]),
      month: Number(dateTimeMatch[2]),
      day: Number(dateTimeMatch[3]),
      hour: Number(dateTimeMatch[4]),
      minute: Number(dateTimeMatch[5]),
      second: Number(dateTimeMatch[6] ?? '0'),
      millisecond: Number(String(dateTimeMatch[7] ?? '0').padEnd(3, '0')),
    });
  }

  const parsedEpoch = Date.parse(text);
  if (!Number.isFinite(parsedEpoch)) return null;
  return parsedEpoch;
}

function resolveMillisecondsPerIndexUnit(unit) {
  const normalizedUnit = normalizeText(unit).toLowerCase();
  if (!normalizedUnit) return null;
  if (normalizedUnit in TIME_UNIT_TO_MS) return TIME_UNIT_TO_MS[normalizedUnit];
  return null;
}

function collectWellRows(session) {
  const sections = session?.wellInformation?.sections;
  if (!sections || typeof sections !== 'object') return [];
  return Object.values(sections)
    .flatMap((rows) => (Array.isArray(rows) ? rows : []))
    .filter((row) => row && typeof row === 'object');
}

function findWellRow(rows, mnemonic) {
  const target = normalizeUpper(mnemonic);
  return rows.find((row) => normalizeUpper(row?.mnemonic) === target) ?? null;
}

function buildWellInfoAnchor(session, millisecondsPerIndexUnit, fallbackAnchorIndexValue) {
  const rows = collectWellRows(session);
  if (rows.length === 0) return null;

  const dateRow = findWellRow(rows, 'DATE');
  const startTimeRow = findWellRow(rows, 'STRTTIME');
  if (!dateRow || !startTimeRow) return null;

  const dateParts = parseDateWithHint(dateRow.value, dateRow.unit);
  const timeParts = parseTimeOfDay(startTimeRow.value);
  if (!dateParts || !timeParts) return null;

  const anchorEpochMs = toEpochMsFromParts({
    ...dateParts,
    ...timeParts,
  });
  if (!Number.isFinite(anchorEpochMs)) return null;

  const strtRow = findWellRow(rows, 'STRT');
  const stopRow = findWellRow(rows, 'STOP');
  const stopTimeRow = findWellRow(rows, 'STOPTIME');

  let anchorIndexValue = fallbackAnchorIndexValue;
  const strtValue = toFiniteNumber(strtRow?.value);
  if (strtValue !== null) {
    const strtUnitMs = resolveMillisecondsPerIndexUnit(strtRow?.unit);
    if (strtUnitMs !== null && Number.isFinite(millisecondsPerIndexUnit) && millisecondsPerIndexUnit > 0) {
      anchorIndexValue = (strtValue * strtUnitMs) / millisecondsPerIndexUnit;
    } else {
      anchorIndexValue = strtValue;
    }
  }

  let confidence = 0.75;
  if (stopRow && stopTimeRow) {
    const stopValue = toFiniteNumber(stopRow?.value);
    const stopTime = parseTimeOfDay(stopTimeRow?.value);
    if (stopValue !== null && stopTime) {
      const stopEpochMs = toEpochMsFromParts({
        ...dateParts,
        ...stopTime,
      });
      if (Number.isFinite(stopEpochMs)) {
        const stopUnitMs = resolveMillisecondsPerIndexUnit(stopRow?.unit);
        const convertedStopValue = stopUnitMs !== null && Number.isFinite(millisecondsPerIndexUnit) && millisecondsPerIndexUnit > 0
          ? (stopValue * stopUnitMs) / millisecondsPerIndexUnit
          : stopValue;
        const predictedStopEpochMs = anchorEpochMs + ((convertedStopValue - anchorIndexValue) * millisecondsPerIndexUnit);
        const mismatchMs = Math.abs(predictedStopEpochMs - stopEpochMs);
        if (mismatchMs <= 2000) confidence = 0.9;
        else if (mismatchMs <= 8000) confidence = 0.82;
        else confidence = 0.6;
      }
    }
  }

  return {
    source: 'well-info',
    anchorEpochMs,
    anchorIso: formatClockDateTime(anchorEpochMs, TIMEZONE_MODES.UTC),
    anchorIndexValue,
    confidence,
    message: 'Using DATE + STRTTIME metadata as the absolute-time anchor.',
  };
}

function buildIndexNormalizationAnchor(session) {
  const normalization = session?.indexSelectionDiagnostics?.indexNormalization;
  if (!normalization || normalization.applied !== true) return null;
  const originIso = normalizeText(normalization.originIso);
  if (!originIso) return null;
  const anchorEpochMs = parseFlexibleDateTime(originIso);
  if (!Number.isFinite(anchorEpochMs)) return null;
  return {
    source: 'index-normalization',
    anchorEpochMs,
    anchorIso: formatClockDateTime(anchorEpochMs, TIMEZONE_MODES.UTC),
    anchorIndexValue: 0,
    confidence: 0.95,
    message: 'Using parsed datetime index values as the absolute-time anchor.',
  };
}

function buildManualAnchor(settings, fallbackAnchorIndexValue) {
  const manualStartIso = normalizeText(settings?.manualStartIso);
  if (!manualStartIso) return null;
  const anchorEpochMs = parseFlexibleDateTime(manualStartIso);
  if (!Number.isFinite(anchorEpochMs)) {
    return {
      source: 'manual',
      anchorEpochMs: null,
      anchorIso: '',
      anchorIndexValue: fallbackAnchorIndexValue,
      confidence: 0,
      message: 'Manual start time could not be parsed. Use YYYY-MM-DD HH:mm:ss.',
      parseFailed: true,
    };
  }
  return {
    source: 'manual',
    anchorEpochMs,
    anchorIso: formatClockDateTime(anchorEpochMs, TIMEZONE_MODES.UTC),
    anchorIndexValue: fallbackAnchorIndexValue,
    confidence: 1,
    message: 'Using manually specified start time.',
    parseFailed: false,
  };
}

function normalizeTimeDisplayMode(value) {
  const token = normalizeText(value).toLowerCase();
  if (token === TIME_DISPLAY_MODES.CLOCK) return TIME_DISPLAY_MODES.CLOCK;
  return TIME_DISPLAY_MODES.ELAPSED;
}

function normalizeTimezoneMode(value) {
  const token = normalizeUpper(value);
  if (token === TIMEZONE_MODES.LOCAL) return TIMEZONE_MODES.LOCAL;
  return TIMEZONE_MODES.UTC;
}

export function normalizeLasTimeAxisSettings(rawSettings = {}) {
  return {
    displayMode: normalizeTimeDisplayMode(rawSettings?.displayMode),
    timezone: normalizeTimezoneMode(rawSettings?.timezone),
    manualStartIso: normalizeText(rawSettings?.manualStartIso),
  };
}

export function buildLasTimeAxisContext(options = {}) {
  const session = options?.session ?? null;
  const curveData = options?.curveData ?? null;
  const indexType = normalizeText(options?.indexType).toLowerCase();
  const settings = normalizeLasTimeAxisSettings(options?.settings);
  const depthUnit = normalizeText(curveData?.depthRange?.depthUnit || session?.depthUnit);
  const millisecondsPerIndexUnit = resolveMillisecondsPerIndexUnit(depthUnit);
  const minIndexValue = toFiniteNumber(curveData?.depthRange?.minDepth) ?? 0;

  const baseContext = {
    enabled: indexType === 'time',
    mode: settings.displayMode,
    timezone: settings.timezone,
    unit: depthUnit,
    millisecondsPerIndexUnit,
    anchorEpochMs: null,
    anchorIndexValue: minIndexValue,
    anchorIso: '',
    source: 'none',
    confidence: 0,
    status: 'elapsed',
    message: '',
    manualStartIso: settings.manualStartIso,
  };

  if (baseContext.enabled !== true) return baseContext;
  if (!Number.isFinite(millisecondsPerIndexUnit) || millisecondsPerIndexUnit <= 0) {
    return {
      ...baseContext,
      status: 'unsupported-unit',
      message: `Unsupported time index unit: ${depthUnit || 'unknown'}.`,
    };
  }
  if (settings.displayMode !== TIME_DISPLAY_MODES.CLOCK) return baseContext;

  const manualAnchor = buildManualAnchor(settings, minIndexValue);
  if (manualAnchor?.parseFailed === true) {
    return {
      ...baseContext,
      source: 'manual',
      status: 'manual-parse-failed',
      message: manualAnchor.message,
    };
  }

  const selectedAnchor = manualAnchor
    || buildIndexNormalizationAnchor(session)
    || buildWellInfoAnchor(session, millisecondsPerIndexUnit, minIndexValue);

  if (!selectedAnchor || !Number.isFinite(selectedAnchor.anchorEpochMs)) {
    return {
      ...baseContext,
      status: 'anchor-missing',
      message: 'Clock-time display needs DATE/STRTTIME metadata or a manual start time.',
    };
  }

  return {
    ...baseContext,
    source: selectedAnchor.source,
    anchorEpochMs: selectedAnchor.anchorEpochMs,
    anchorIndexValue: toFiniteNumber(selectedAnchor.anchorIndexValue) ?? minIndexValue,
    anchorIso: selectedAnchor.anchorIso,
    confidence: Number.isFinite(selectedAnchor.confidence) ? selectedAnchor.confidence : 0,
    status: 'ready',
    message: selectedAnchor.message || '',
  };
}

function formatDateParts(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  };
}

function formatDatePartsLocal(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    millisecond: date.getMilliseconds(),
  };
}

export function formatClockDateTime(epochMs, timezone = TIMEZONE_MODES.UTC, options = {}) {
  const numericEpoch = toFiniteNumber(epochMs);
  if (numericEpoch === null) return '-';
  const includeMilliseconds = options?.includeMilliseconds === true;
  const date = new Date(numericEpoch);
  const parts = timezone === TIMEZONE_MODES.LOCAL
    ? formatDatePartsLocal(date)
    : formatDateParts(date);
  const base = `${padNumber(parts.year, 4)}-${padNumber(parts.month)}-${padNumber(parts.day)} `
    + `${padNumber(parts.hour)}:${padNumber(parts.minute)}:${padNumber(parts.second)}`;
  if (!includeMilliseconds) return base;
  return `${base}.${padNumber(parts.millisecond, 3)}`;
}

export function formatTimeIndexValue(indexValue, timeAxisContext = null, options = {}) {
  const numericIndex = toFiniteNumber(indexValue);
  if (numericIndex === null) return '-';

  const mode = normalizeTimeDisplayMode(timeAxisContext?.mode);
  if (mode !== TIME_DISPLAY_MODES.CLOCK) {
    const unit = normalizeText(timeAxisContext?.unit || options?.unit);
    const fractionDigits = Number.isFinite(Number(options?.fractionDigits))
      ? Math.max(0, Number(options.fractionDigits))
      : 3;
    const valueText = numericIndex.toFixed(fractionDigits);
    return unit ? `${valueText} ${unit}` : valueText;
  }

  const millisecondsPerIndexUnit = toFiniteNumber(timeAxisContext?.millisecondsPerIndexUnit);
  const anchorEpochMs = toFiniteNumber(timeAxisContext?.anchorEpochMs);
  const anchorIndexValue = toFiniteNumber(timeAxisContext?.anchorIndexValue) ?? 0;
  if (
    millisecondsPerIndexUnit === null
    || anchorEpochMs === null
    || !Number.isFinite(millisecondsPerIndexUnit)
  ) {
    const fallbackUnit = normalizeText(timeAxisContext?.unit || options?.unit);
    return fallbackUnit ? `${numericIndex.toFixed(3)} ${fallbackUnit}` : numericIndex.toFixed(3);
  }

  const timezone = normalizeTimezoneMode(timeAxisContext?.timezone);
  const includeMilliseconds = options?.includeMilliseconds === true;
  const epochMs = anchorEpochMs + ((numericIndex - anchorIndexValue) * millisecondsPerIndexUnit);
  return formatClockDateTime(epochMs, timezone, { includeMilliseconds });
}

export function getLasTimeAxisDisplayMeta(timeAxisContext = null) {
  const normalized = normalizeLasTimeAxisSettings(timeAxisContext);
  const modeLabel = normalized.displayMode === TIME_DISPLAY_MODES.CLOCK ? 'Clock Time' : 'Elapsed';
  const timezoneLabel = normalized.timezone === TIMEZONE_MODES.LOCAL ? 'Local' : 'UTC';
  return { modeLabel, timezoneLabel };
}

export {
  TIME_DISPLAY_MODES,
  TIMEZONE_MODES,
  TIME_UNIT_TO_MS,
  resolveMillisecondsPerIndexUnit,
};
