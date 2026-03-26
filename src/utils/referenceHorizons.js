import { parseOptionalNumber } from '@/utils/general.js';
import {
  resolveMDFromTVD,
  resolveTrajectoryPointAtMD
} from '@/components/schematic/layers/directionalProjection.js';

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveDirectionalReferenceHorizonMode(value) {
  return String(value ?? '').trim().toLowerCase() === 'md' ? 'md' : 'tvd';
}

export function resolveDirectionalReferenceHorizonDepthMeta(row = {}) {
  const resolvedMode = resolveDirectionalReferenceHorizonMode(row?.directionalDepthMode);
  const md = parseOptionalNumber(row?.directionalDepthMd);
  const tvd = parseOptionalNumber(row?.directionalDepthTvd);
  if (resolvedMode === 'md') {
    return {
      mode: 'md',
      primaryDepth: md,
      secondaryDepth: tvd,
      primaryLabel: 'MD',
      secondaryLabel: 'TVD'
    };
  }
  return {
    mode: 'tvd',
    primaryDepth: tvd,
    secondaryDepth: md,
    primaryLabel: 'TVD',
    secondaryLabel: 'MD'
  };
}

function deriveTvdFromMd(md, trajectoryPoints = []) {
  return toFiniteNumber(resolveTrajectoryPointAtMD(md, trajectoryPoints)?.tvd);
}

function deriveMdFromTvd(tvd, trajectoryPoints = []) {
  return toFiniteNumber(resolveMDFromTVD(tvd, trajectoryPoints));
}

export function syncDirectionalReferenceHorizonRow(row = {}, trajectoryPoints = [], options = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;

  const sourceField = String(options?.sourceField ?? '').trim();
  const hasSourceValue = Object.prototype.hasOwnProperty.call(options ?? {}, 'sourceValue');
  const nextRow = { ...row };

  if (hasSourceValue && sourceField) {
    nextRow[sourceField] = options.sourceValue;
  }

  const legacyDepth = parseOptionalNumber(nextRow.depth);
  let directionalDepthMd = parseOptionalNumber(nextRow.directionalDepthMd);
  let directionalDepthTvd = parseOptionalNumber(nextRow.directionalDepthTvd);
  let directionalDepthMode = resolveDirectionalReferenceHorizonMode(nextRow.directionalDepthMode);

  if (sourceField === 'depth' && Number.isFinite(legacyDepth)) {
    directionalDepthMd = legacyDepth;
    directionalDepthTvd = deriveTvdFromMd(directionalDepthMd, trajectoryPoints);
    directionalDepthMode = 'tvd';
  } else if (sourceField === 'directionalDepthMd' && Number.isFinite(directionalDepthMd)) {
    directionalDepthTvd = deriveTvdFromMd(directionalDepthMd, trajectoryPoints);
    directionalDepthMode = 'md';
  } else if (sourceField === 'directionalDepthTvd' && Number.isFinite(directionalDepthTvd)) {
    directionalDepthMd = deriveMdFromTvd(directionalDepthTvd, trajectoryPoints);
    directionalDepthMode = 'tvd';
  } else if (sourceField === 'directionalDepthMode') {
    directionalDepthMode = resolveDirectionalReferenceHorizonMode(nextRow.directionalDepthMode);
  } else if (options?.resyncFromMd === true && Number.isFinite(directionalDepthMd)) {
    directionalDepthTvd = deriveTvdFromMd(directionalDepthMd, trajectoryPoints);
  } else if (!Number.isFinite(directionalDepthMd) && Number.isFinite(legacyDepth)) {
    directionalDepthMd = legacyDepth;
    directionalDepthTvd = deriveTvdFromMd(directionalDepthMd, trajectoryPoints);
  } else if (Number.isFinite(directionalDepthMd) && !Number.isFinite(directionalDepthTvd)) {
    directionalDepthTvd = deriveTvdFromMd(directionalDepthMd, trajectoryPoints);
  } else if (!Number.isFinite(directionalDepthMd) && Number.isFinite(directionalDepthTvd)) {
    directionalDepthMd = deriveMdFromTvd(directionalDepthTvd, trajectoryPoints);
  }

  if (Number.isFinite(directionalDepthMd)) {
    nextRow.depth = directionalDepthMd;
    nextRow.directionalDepthMd = directionalDepthMd;
  } else {
    nextRow.directionalDepthMd = null;
  }

  nextRow.directionalDepthTvd = Number.isFinite(directionalDepthTvd)
    ? directionalDepthTvd
    : null;
  nextRow.directionalDepthMode = directionalDepthMode;

  return nextRow;
}

export function syncDirectionalReferenceHorizons(rows = [], trajectoryPoints = [], options = {}) {
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
    const nextRow = syncDirectionalReferenceHorizonRow(row, trajectoryPoints, {
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
  resolveDirectionalReferenceHorizonMode,
  resolveDirectionalReferenceHorizonDepthMeta,
  syncDirectionalReferenceHorizonRow,
  syncDirectionalReferenceHorizons
};
