const DEPTH_UNITS = new Set([
  'm', 'ft', 'meter', 'meters', 'metre', 'metres', 'feet', 'dm', 'cm', 'km', 'in',
]);

const TIME_UNITS = new Set([
  's', 'ms', 'us', 'ns', 'sec', 'msec', 'seconds', 'microseconds',
]);

const DEPTH_MNEMONICS = new Set([
  'DEPT', 'DEPTH', 'MD', 'TVD', 'TVDSS', 'TVDSD', 'BPOS', 'TDEP', 'DME',
]);

const TIME_MNEMONICS = new Set([
  'TIME', 'TWT', 'TWTT', 'OWT', 'TIMS', 'STIME', 'ETIM', 'DTIME',
  // 'T' intentionally excluded -- too ambiguous (temperature collision)
]);

const INDEX_MNEMONICS = new Set([
  'INDEX', 'IDX', 'STEP', 'REC', 'SAMP',
]);

/**
 * Detects the index type of a LAS file based on the index curve mnemonic and unit.
 * Detection order: unit first (most reliable), mnemonic fallback, then unknown.
 *
 * @param {string|null} indexCurve - The index curve mnemonic (e.g. 'DEPT', 'TIME').
 * @param {string|null} depthUnit  - The unit string from the LAS header (e.g. 'm', 'ms').
 * @returns {'depth'|'time'|'index'|'unknown'}
 */
export function detectLasIndexType(indexCurve, depthUnit) {
  const unit = String(depthUnit || '').trim().toLowerCase();
  const mnemonic = String(indexCurve || '').trim().toUpperCase();

  if (unit && TIME_UNITS.has(unit))   return 'time';
  if (unit && DEPTH_UNITS.has(unit))  return 'depth';

  if (TIME_MNEMONICS.has(mnemonic))   return 'time';
  if (DEPTH_MNEMONICS.has(mnemonic))  return 'depth';
  if (INDEX_MNEMONICS.has(mnemonic))  return 'index';

  return 'unknown';
}

/**
 * Returns display metadata for a given index type.
 *
 * @param {'depth'|'time'|'index'|'unknown'} indexType
 * @returns {{ label: string, icon: string, rangeLabel: string }}
 */
export function getLasIndexTypeMeta(indexType) {
  switch (indexType) {
    case 'depth':   return { label: 'Depth-Indexed',  icon: 'pi pi-arrow-down', rangeLabel: 'Depth Range' };
    case 'time':    return { label: 'Time-Indexed',   icon: 'pi pi-clock',      rangeLabel: 'Time Range' };
    case 'index':   return { label: 'Index-Indexed',  icon: 'pi pi-hashtag',    rangeLabel: 'Index Range' };
    default:        return { label: 'Unknown Index',  icon: 'pi pi-question',   rangeLabel: 'Index Range' };
  }
}
