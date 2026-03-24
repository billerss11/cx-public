import { parseOptionalNumber } from '@/utils/general.js';

const DEFAULT_DEPTH_SLIDER_STEP = 0.1;

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolveRows(source, candidateKeys = []) {
  for (const key of candidateKeys) {
    const rows = source?.[key];
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

function addDepthValue(values, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  values.push(parsed);
}

function addIntervalRows(rows, topKey, bottomKey, minCandidates, maxCandidates) {
  toSafeArray(rows).forEach((row) => {
    const top = parseOptionalNumber(row?.[topKey]);
    const bottom = parseOptionalNumber(row?.[bottomKey]);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;
    minCandidates.push(top);
    maxCandidates.push(bottom);
  });
}

function normalizeSliderStep(step, fallback = DEFAULT_DEPTH_SLIDER_STEP) {
  const parsed = Number(step);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

function normalizeSliderConfig(min, max, step = DEFAULT_DEPTH_SLIDER_STEP) {
  const numericMin = Number(min);
  const numericMax = Number(max);
  if (!Number.isFinite(numericMin) || !Number.isFinite(numericMax) || numericMax <= numericMin) {
    return null;
  }

  return {
    min: numericMin,
    max: numericMax,
    step: normalizeSliderStep(step)
  };
}

export function collectWellDepthRange(source = {}) {
  const minCandidates = [];
  const maxCandidates = [];

  addIntervalRows(
    resolveRows(source, ['casingData', 'casingRows']),
    'top',
    'bottom',
    minCandidates,
    maxCandidates
  );
  addIntervalRows(
    resolveRows(source, ['tubingData', 'tubingRows']),
    'top',
    'bottom',
    minCandidates,
    maxCandidates
  );
  addIntervalRows(
    resolveRows(source, ['drillStringData', 'drillStringRows']),
    'top',
    'bottom',
    minCandidates,
    maxCandidates
  );
  addIntervalRows(
    resolveRows(source, ['annulusFluids', 'fluidRows']),
    'top',
    'bottom',
    minCandidates,
    maxCandidates
  );
  addIntervalRows(
    resolveRows(source, ['cementPlugs', 'plugRows']),
    'top',
    'bottom',
    minCandidates,
    maxCandidates
  );

  resolveRows(source, ['equipmentData', 'equipmentRows'])
    .forEach((row) => addDepthValue(maxCandidates, row?.depth));
  resolveRows(source, ['horizontalLines', 'lineRows'])
    .forEach((row) => addDepthValue(maxCandidates, row?.depth));
  resolveRows(source, ['markers', 'markerRows'])
    .forEach((row) => {
      addDepthValue(maxCandidates, row?.top);
      addDepthValue(maxCandidates, row?.bottom);
    });
  resolveRows(source, ['annotationBoxes', 'boxRows'])
    .forEach((row) => {
      addDepthValue(maxCandidates, row?.topDepth);
      addDepthValue(maxCandidates, row?.bottomDepth);
    });
  resolveRows(source, ['trajectory', 'trajectoryRows'])
    .forEach((row) => addDepthValue(maxCandidates, row?.md));

  const minDepth = minCandidates.length > 0 ? Math.min(...minCandidates) : 0;
  const maxDepth = maxCandidates.length > 0 ? Math.max(...maxCandidates) : minDepth + 1;
  if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth)) return null;
  if (maxDepth <= minDepth) {
    return {
      min: Math.min(0, minDepth),
      max: Math.max(1, minDepth + 1)
    };
  }

  return {
    min: Math.min(0, minDepth),
    max: maxDepth
  };
}

export function resolveGlobalDepthSliderRange(source = {}, step = DEFAULT_DEPTH_SLIDER_STEP) {
  const depthRange = collectWellDepthRange(source);
  return normalizeSliderConfig(depthRange?.min, depthRange?.max, step);
}

export function resolveRowDepthSliderRange(rowData = {}, options = {}) {
  const topKey = String(options?.topKey ?? 'top').trim() || 'top';
  const bottomKey = String(options?.bottomKey ?? 'bottom').trim() || 'bottom';
  const top = parseOptionalNumber(rowData?.[topKey]);
  const bottom = parseOptionalNumber(rowData?.[bottomKey]);
  return normalizeSliderConfig(top, bottom, options?.step);
}

export function resolveConstraintAwareDepthSlider(fieldName, rowData = {}, context = {}, options = {}) {
  const field = String(fieldName ?? '').trim();
  if (!field) return null;

  const globalRange = resolveGlobalDepthSliderRange(context, options?.step);
  if (!globalRange) return null;

  if (field === 'toc' || field === 'boc') {
    return normalizeSliderConfig(rowData?.top, rowData?.bottom, options?.step);
  }

  if (field === 'top' || field === 'topDepth') {
    const bottomField = field === 'topDepth' ? 'bottomDepth' : 'bottom';
    return normalizeSliderConfig(globalRange.min, rowData?.[bottomField], options?.step);
  }

  if (field === 'bottom' || field === 'bottomDepth') {
    const topField = field === 'bottomDepth' ? 'topDepth' : 'top';
    return normalizeSliderConfig(rowData?.[topField], globalRange.max, options?.step);
  }

  if (field === 'depth') {
    return globalRange;
  }

  return null;
}

export {
  DEFAULT_DEPTH_SLIDER_STEP
};
