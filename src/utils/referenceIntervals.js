import { parseOptionalNumber } from '@/utils/general.js';
import {
  resolveMDFromTVD,
  resolveTrajectoryPointAtMD
} from '@/components/schematic/layers/directionalProjection.js';

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveTvdFromMd(md, trajectoryPoints = []) {
  return toFiniteNumber(resolveTrajectoryPointAtMD(md, trajectoryPoints)?.tvd);
}

function deriveMdFromTvd(tvd, trajectoryPoints = []) {
  return toFiniteNumber(resolveMDFromTVD(tvd, trajectoryPoints));
}

export function resolveDirectionalIntervalMode(value) {
  return String(value ?? '').trim().toLowerCase() === 'md' ? 'md' : 'tvd';
}

export function resolveDirectionalIntervalDepthMeta(row = {}, trajectoryPoints = []) {
  const mode = resolveDirectionalIntervalMode(row?.directionalDepthMode);
  const storedTopMd = parseOptionalNumber(row?.directionalTopDepthMd ?? row?.topDepth);
  const storedBottomMd = parseOptionalNumber(row?.directionalBottomDepthMd ?? row?.bottomDepth);
  const storedTopTvd = parseOptionalNumber(row?.directionalTopDepthTvd);
  const storedBottomTvd = parseOptionalNumber(row?.directionalBottomDepthTvd);

  const resolvedTopMd = mode === 'tvd'
    ? (Number.isFinite(storedTopTvd)
      ? deriveMdFromTvd(storedTopTvd, trajectoryPoints)
      : storedTopMd)
    : (Number.isFinite(storedTopMd)
      ? storedTopMd
      : (Number.isFinite(storedTopTvd) ? deriveMdFromTvd(storedTopTvd, trajectoryPoints) : null));
  const resolvedBottomMd = mode === 'tvd'
    ? (Number.isFinite(storedBottomTvd)
      ? deriveMdFromTvd(storedBottomTvd, trajectoryPoints)
      : storedBottomMd)
    : (Number.isFinite(storedBottomMd)
      ? storedBottomMd
      : (Number.isFinite(storedBottomTvd) ? deriveMdFromTvd(storedBottomTvd, trajectoryPoints) : null));
  const resolvedTopTvd = mode === 'md'
    ? (Number.isFinite(resolvedTopMd)
      ? deriveTvdFromMd(resolvedTopMd, trajectoryPoints)
      : storedTopTvd)
    : (Number.isFinite(storedTopTvd)
      ? storedTopTvd
      : (Number.isFinite(resolvedTopMd) ? deriveTvdFromMd(resolvedTopMd, trajectoryPoints) : null));
  const resolvedBottomTvd = mode === 'md'
    ? (Number.isFinite(resolvedBottomMd)
      ? deriveTvdFromMd(resolvedBottomMd, trajectoryPoints)
      : storedBottomTvd)
    : (Number.isFinite(storedBottomTvd)
      ? storedBottomTvd
      : (Number.isFinite(resolvedBottomMd) ? deriveTvdFromMd(resolvedBottomMd, trajectoryPoints) : null));

  return {
    mode,
    topMd: resolvedTopMd,
    bottomMd: resolvedBottomMd,
    topTvd: resolvedTopTvd,
    bottomTvd: resolvedBottomTvd,
    primaryTopDepth: mode === 'md' ? resolvedTopMd : resolvedTopTvd,
    primaryBottomDepth: mode === 'md' ? resolvedBottomMd : resolvedBottomTvd
  };
}

export function syncDirectionalIntervalRow(row = {}, trajectoryPoints = [], options = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

  const sourceField = String(options?.sourceField ?? '').trim();
  const hasSourceValue = Object.prototype.hasOwnProperty.call(options ?? {}, 'sourceValue');
  const nextRow = { ...row };
  if (hasSourceValue && sourceField) {
    nextRow[sourceField] = options.sourceValue;
  }

  let topDepth = parseOptionalNumber(nextRow.topDepth);
  let bottomDepth = parseOptionalNumber(nextRow.bottomDepth);
  let topMd = parseOptionalNumber(nextRow.directionalTopDepthMd);
  let bottomMd = parseOptionalNumber(nextRow.directionalBottomDepthMd);
  let topTvd = parseOptionalNumber(nextRow.directionalTopDepthTvd);
  let bottomTvd = parseOptionalNumber(nextRow.directionalBottomDepthTvd);
  let mode = resolveDirectionalIntervalMode(nextRow.directionalDepthMode);

  if (sourceField === 'topDepth' && Number.isFinite(topDepth)) {
    topMd = topDepth;
    topTvd = deriveTvdFromMd(topMd, trajectoryPoints);
    mode = 'md';
  } else if (sourceField === 'bottomDepth' && Number.isFinite(bottomDepth)) {
    bottomMd = bottomDepth;
    bottomTvd = deriveTvdFromMd(bottomMd, trajectoryPoints);
    mode = 'md';
  } else if (sourceField === 'directionalTopDepthMd' && Number.isFinite(topMd)) {
    topTvd = deriveTvdFromMd(topMd, trajectoryPoints);
    mode = 'md';
  } else if (sourceField === 'directionalBottomDepthMd' && Number.isFinite(bottomMd)) {
    bottomTvd = deriveTvdFromMd(bottomMd, trajectoryPoints);
    mode = 'md';
  } else if (sourceField === 'directionalTopDepthTvd' && Number.isFinite(topTvd)) {
    topMd = deriveMdFromTvd(topTvd, trajectoryPoints);
    mode = 'tvd';
  } else if (sourceField === 'directionalBottomDepthTvd' && Number.isFinite(bottomTvd)) {
    bottomMd = deriveMdFromTvd(bottomTvd, trajectoryPoints);
    mode = 'tvd';
  } else if (sourceField === 'directionalDepthMode') {
    mode = resolveDirectionalIntervalMode(nextRow.directionalDepthMode);
  } else if (sourceField === 'directionalManualLabelDepth') {
    const manualDepth = parseOptionalNumber(nextRow.directionalManualLabelDepth);
    nextRow.directionalManualLabelTvd = Number.isFinite(manualDepth)
      ? deriveTvdFromMd(manualDepth, trajectoryPoints)
      : null;
  } else if (sourceField === 'directionalManualLabelTvd') {
    const manualTvd = parseOptionalNumber(nextRow.directionalManualLabelTvd);
    nextRow.directionalManualLabelDepth = Number.isFinite(manualTvd)
      ? deriveMdFromTvd(manualTvd, trajectoryPoints)
      : null;
  } else if (options?.resyncFromMd === true) {
    if (Number.isFinite(topMd)) topTvd = deriveTvdFromMd(topMd, trajectoryPoints);
    if (Number.isFinite(bottomMd)) bottomTvd = deriveTvdFromMd(bottomMd, trajectoryPoints);
    const manualDepth = parseOptionalNumber(nextRow.directionalManualLabelDepth);
    nextRow.directionalManualLabelTvd = Number.isFinite(manualDepth)
      ? deriveTvdFromMd(manualDepth, trajectoryPoints)
      : parseOptionalNumber(nextRow.directionalManualLabelTvd);
  }

  if (!Number.isFinite(topMd) && Number.isFinite(topDepth)) {
    topMd = topDepth;
    topTvd = deriveTvdFromMd(topMd, trajectoryPoints);
    if (!sourceField) mode = 'md';
  }
  if (!Number.isFinite(bottomMd) && Number.isFinite(bottomDepth)) {
    bottomMd = bottomDepth;
    bottomTvd = deriveTvdFromMd(bottomMd, trajectoryPoints);
    if (!sourceField) mode = 'md';
  }
  if (!Number.isFinite(topMd) && Number.isFinite(topTvd)) topMd = deriveMdFromTvd(topTvd, trajectoryPoints);
  if (!Number.isFinite(bottomMd) && Number.isFinite(bottomTvd)) bottomMd = deriveMdFromTvd(bottomTvd, trajectoryPoints);
  if (Number.isFinite(topMd) && !Number.isFinite(topTvd)) topTvd = deriveTvdFromMd(topMd, trajectoryPoints);
  if (Number.isFinite(bottomMd) && !Number.isFinite(bottomTvd)) bottomTvd = deriveTvdFromMd(bottomMd, trajectoryPoints);

  if (!Number.isFinite(nextRow.directionalManualLabelDepth) && Number.isFinite(nextRow.directionalManualLabelTvd)) {
    nextRow.directionalManualLabelDepth = deriveMdFromTvd(nextRow.directionalManualLabelTvd, trajectoryPoints);
  } else if (Number.isFinite(nextRow.directionalManualLabelDepth) && !Number.isFinite(nextRow.directionalManualLabelTvd)) {
    nextRow.directionalManualLabelTvd = deriveTvdFromMd(nextRow.directionalManualLabelDepth, trajectoryPoints);
  }

  nextRow.topDepth = Number.isFinite(topMd) ? topMd : null;
  nextRow.bottomDepth = Number.isFinite(bottomMd) ? bottomMd : null;
  nextRow.directionalTopDepthMd = Number.isFinite(topMd) ? topMd : null;
  nextRow.directionalBottomDepthMd = Number.isFinite(bottomMd) ? bottomMd : null;
  nextRow.directionalTopDepthTvd = Number.isFinite(topTvd) ? topTvd : null;
  nextRow.directionalBottomDepthTvd = Number.isFinite(bottomTvd) ? bottomTvd : null;
  nextRow.directionalDepthMode = mode;

  return nextRow;
}

export function syncDirectionalIntervals(rows = [], trajectoryPoints = [], options = {}) {
  if (!Array.isArray(rows)) return rows;

  const sourceFieldByRowId = options?.sourceFieldByRowId instanceof Map
    ? options.sourceFieldByRowId
    : null;
  const sourceValueByRowId = options?.sourceValueByRowId instanceof Map
    ? options.sourceValueByRowId
    : null;

  let changed = false;
  const nextRows = rows.map((row) => {
    const rowId = String(row?.rowId ?? '').trim();
    const nextRow = syncDirectionalIntervalRow(row, trajectoryPoints, {
      sourceField: rowId && sourceFieldByRowId ? sourceFieldByRowId.get(rowId) : null,
      resyncFromMd: options?.resyncFromMd === true,
      ...(rowId && sourceValueByRowId && sourceValueByRowId.has(rowId)
        ? { sourceValue: sourceValueByRowId.get(rowId) }
        : {})
    });
    if (nextRow !== row || JSON.stringify(nextRow) !== JSON.stringify(row)) {
      changed = true;
    }
    return nextRow;
  });

  return changed ? nextRows : rows;
}

export default {
  resolveDirectionalIntervalMode,
  resolveDirectionalIntervalDepthMeta,
  syncDirectionalIntervalRow,
  syncDirectionalIntervals
};
