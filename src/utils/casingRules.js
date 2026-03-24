import casingRulesQuerySource from '../../files/restructured_json/casing_rules_query_source.json';

const SIZE_CATALOG = Object.freeze(casingRulesQuerySource?.size_catalog ?? {});
const QUERY_BY_CASING = Object.freeze(casingRulesQuerySource?.query_views?.by_casing ?? {});
const QUERY_BY_HOLE = Object.freeze(casingRulesQuerySource?.query_views?.by_hole ?? {});
const SIZE_ENTRIES = Object.freeze(
  Object.values(SIZE_CATALOG)
    .filter((entry) => entry && typeof entry === 'object' && String(entry.label ?? '').trim().length > 0)
);
const DECIMAL_LABEL_MAP = new Map(
  SIZE_ENTRIES.map((entry) => [Number(entry.decimal), entry.label])
);
const CASING_LABELS = Object.freeze(Object.keys(QUERY_BY_CASING));
const HOLE_LABELS = Object.freeze(Object.keys(QUERY_BY_HOLE));
const EIGHTH_DENOMINATOR = 8;
const EQUALITY_EPSILON = 1e-9;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function compareByDecimalAsc(left, right) {
  const leftDecimal = Number(left?.decimal);
  const rightDecimal = Number(right?.decimal);
  if (Number.isFinite(leftDecimal) && Number.isFinite(rightDecimal) && leftDecimal !== rightDecimal) {
    return leftDecimal - rightDecimal;
  }
  return String(left?.label ?? '').localeCompare(String(right?.label ?? ''));
}

function comparePrograms(left, right) {
  return (
    Number(left?.stageCount ?? 0) - Number(right?.stageCount ?? 0)
    || Number(left?.lowClearanceCount ?? 0) - Number(right?.lowClearanceCount ?? 0)
    || String(left?.displayText ?? '').localeCompare(String(right?.displayText ?? ''))
  );
}

function compareProgramsWithMaxStages(left, right, maxStages) {
  const exactLeft = Number(left?.stageCount ?? 0) === maxStages ? 0 : 1;
  const exactRight = Number(right?.stageCount ?? 0) === maxStages ? 0 : 1;
  return (
    exactLeft - exactRight
    || Number(right?.stageCount ?? 0) - Number(left?.stageCount ?? 0)
    || Number(left?.lowClearanceCount ?? 0) - Number(right?.lowClearanceCount ?? 0)
    || String(left?.displayText ?? '').localeCompare(String(right?.displayText ?? ''))
  );
}

function findCatalogEntryByLabel(label) {
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedLabel) return null;
  return SIZE_CATALOG[normalizedLabel] ?? null;
}

function findCatalogEntryByDecimal(decimal) {
  if (!isFiniteNumber(decimal)) return null;
  const exactLabel = DECIMAL_LABEL_MAP.get(decimal);
  if (exactLabel) return findCatalogEntryByLabel(exactLabel);
  return (
    SIZE_ENTRIES.find((entry) => Math.abs(Number(entry.decimal) - decimal) <= EQUALITY_EPSILON)
    ?? null
  );
}

function formatTrimmedDecimal(decimal) {
  if (!isFiniteNumber(decimal)) return '';
  return String(Number(decimal.toFixed(6)));
}

function formatEighthFractionLabel(decimal) {
  if (!isFiniteNumber(decimal)) return '';
  const normalizedValue = decimal * EIGHTH_DENOMINATOR;
  const rounded = Math.round(normalizedValue);
  if (Math.abs(normalizedValue - rounded) > EQUALITY_EPSILON) return '';

  const whole = Math.trunc(rounded / EIGHTH_DENOMINATOR);
  const remainder = Math.abs(rounded % EIGHTH_DENOMINATOR);
  if (remainder === 0) return String(whole);

  const gcd = remainder === 4 ? 4 : remainder === 2 || remainder === 6 ? 2 : 1;
  const numerator = remainder / gcd;
  const denominator = EIGHTH_DENOMINATOR / gcd;
  if (whole === 0) {
    return `${numerator}/${denominator}`;
  }
  return `${whole} ${numerator}/${denominator}`;
}

function normalizeRelationshipItem(item, fieldName) {
  const label = String(item?.[fieldName] ?? '').trim();
  const catalogEntry = findCatalogEntryByLabel(label);
  return {
    label,
    decimal: Number(catalogEntry?.decimal ?? NaN),
    clearance: String(item?.clearance ?? '').trim(),
    isLowClearance: String(item?.clearance ?? '').trim() === 'low_clearance'
  };
}

function normalizeRelationshipList(items = [], fieldName) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => normalizeRelationshipItem(item, fieldName))
    .filter((item) => item.label.length > 0)
    .sort(compareByDecimalAsc);
}

function compareStartHoleOptions(left, right) {
  const leftPenalty = left?.isLowClearance === true ? 1 : 0;
  const rightPenalty = right?.isLowClearance === true ? 1 : 0;
  return (
    leftPenalty - rightPenalty
    || Number(right?.decimal ?? 0) - Number(left?.decimal ?? 0)
    || String(left?.label ?? '').localeCompare(String(right?.label ?? ''))
  );
}

function getNextTransitions(type, label) {
  if (type === 'casing') {
    return normalizeRelationshipList(QUERY_BY_CASING[label]?.drillable_holes ?? [], 'hole').map((item) => ({
      fromType: 'casing',
      fromLabel: label,
      toType: 'hole',
      toLabel: item.label,
      clearance: item.clearance,
      isLowClearance: item.isLowClearance
    }));
  }

  if (type === 'hole') {
    return normalizeRelationshipList(QUERY_BY_HOLE[label]?.settable_casing ?? [], 'casing').map((item) => ({
      fromType: 'hole',
      fromLabel: label,
      toType: 'casing',
      toLabel: item.label,
      clearance: item.clearance,
      isLowClearance: item.isLowClearance
    }));
  }

  return [];
}

function normalizeMaxStages(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function buildProgramStageLabels(sequence) {
  const stageLabels = [];
  let index = 1;

  while (index < sequence.length) {
    const currentHole = sequence[index];
    const nextCasing = sequence[index + 1] ?? null;

    if (currentHole?.type !== 'hole') {
      index += 1;
      continue;
    }

    if (nextCasing?.type === 'casing') {
      stageLabels.push(`${currentHole.label} (${nextCasing.label})`);
      index += 2;
      continue;
    }

    stageLabels.push(currentHole.label);
    index += 1;
  }

  return stageLabels;
}

function buildProgramStageCount(sequence) {
  return 1 + buildProgramStageLabels(sequence).length;
}

function buildProgram(sequence, steps, maxStages = null) {
  const sequenceLabels = sequence.map((item) => item.label);
  const stageLabels = buildProgramStageLabels(sequence);
  const lowClearanceCount = steps.filter((step) => step.isLowClearance === true).length;
  const sectionCount = stageLabels.length;
  const stageCount = 1 + sectionCount;
  const startLabel = sequence[0]?.label ?? '';
  const startHoleOptions = getAcceptedHoleOptionsForCasingLabel(startLabel);
  const displayText = stageLabels.length > 0
    ? `Start: ${startLabel} | ${stageLabels.join(' x ')}`
    : `Start: ${startLabel}`;
  return {
    sequence,
    steps,
    sequenceLabels,
    stageLabels,
    startLabel,
    startHoleOptions,
    displayText,
    lowClearanceCount,
    sectionCount,
    stageCount,
    exactStageMatch: maxStages !== null && stageCount === maxStages
  };
}

export function parseEngineeringSizeInput(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) return null;
    return {
      decimal: rawValue,
      label: formatEngineeringSizeLabel(rawValue),
      original: rawValue
    };
  }

  const trimmed = String(rawValue).trim();
  if (!trimmed) return null;

  const decimalMatch = trimmed.match(/^\d+(?:\.\d+)?$/);
  if (decimalMatch) {
    const decimal = Number(trimmed);
    if (!Number.isFinite(decimal)) return null;
    return {
      decimal,
      label: formatEngineeringSizeLabel(decimal),
      original: rawValue
    };
  }

  const mixedFractionMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFractionMatch) {
    const whole = Number(mixedFractionMatch[1]);
    const numerator = Number(mixedFractionMatch[2]);
    const denominator = Number(mixedFractionMatch[3]);
    if (!Number.isFinite(whole) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    const decimal = whole + (numerator / denominator);
    return {
      decimal,
      label: formatEngineeringSizeLabel(decimal),
      original: rawValue
    };
  }

  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    const decimal = numerator / denominator;
    return {
      decimal,
      label: formatEngineeringSizeLabel(decimal),
      original: rawValue
    };
  }

  return null;
}

export function formatEngineeringSizeLabel(decimal) {
  if (!isFiniteNumber(decimal)) return '';
  const catalogEntry = findCatalogEntryByDecimal(decimal);
  if (catalogEntry?.label) return catalogEntry.label;
  return formatEighthFractionLabel(decimal) || formatTrimmedDecimal(decimal);
}

export function matchCatalogCasingFromOd(odNumber) {
  if (!isFiniteNumber(odNumber)) return null;
  const entry = findCatalogEntryByDecimal(odNumber);
  if (!entry) return null;
  return CASING_LABELS.includes(entry.label) ? entry : null;
}

export function matchCatalogHoleFromDecimal(decimal) {
  if (!isFiniteNumber(decimal)) return null;
  const entry = findCatalogEntryByDecimal(decimal);
  if (!entry) return null;
  return HOLE_LABELS.includes(entry.label) ? entry : null;
}

export function getHoleOptionsForCasingLabel(casingLabel) {
  const normalizedLabel = String(casingLabel ?? '').trim();
  if (!normalizedLabel || !QUERY_BY_CASING[normalizedLabel]) return [];
  return normalizeRelationshipList(QUERY_BY_CASING[normalizedLabel].drillable_holes ?? [], 'hole');
}

export function getAcceptedHoleOptionsForCasingLabel(casingLabel) {
  const normalizedLabel = String(casingLabel ?? '').trim();
  if (!normalizedLabel || !QUERY_BY_CASING[normalizedLabel]) return [];
  return normalizeRelationshipList(QUERY_BY_CASING[normalizedLabel].accepted_in_holes ?? [], 'hole')
    .sort(compareStartHoleOptions);
}

export function getHoleOptionsForCasingOd(odNumber) {
  const casingMatch = matchCatalogCasingFromOd(odNumber);
  return {
    casingMatch,
    options: casingMatch ? getHoleOptionsForCasingLabel(casingMatch.label) : []
  };
}

export function getHoleSizeAssistance(row = {}) {
  const { casingMatch, options } = getHoleOptionsForCasingOd(Number(row?.od));
  const currentValue = parseEngineeringSizeInput(row?.manualHoleSize);
  const currentHoleMatch = currentValue ? matchCatalogHoleFromDecimal(currentValue.decimal) : null;

  let warningCode = null;
  if (!casingMatch) {
    warningCode = 'no_casing_catalog_match';
  } else if (currentValue && !currentHoleMatch) {
    warningCode = 'custom_hole_size';
  } else if (
    casingMatch
    && currentHoleMatch
    && !options.some((option) => option.label === currentHoleMatch.label)
  ) {
    warningCode = 'incompatible_catalog_hole';
  }

  return {
    casingMatch,
    options,
    currentValue,
    currentHoleMatch,
    warningCode,
    displayValue: currentValue ? formatEngineeringSizeLabel(currentValue.decimal) : ''
  };
}

export function getRuleExplorerDetails(sizeLabel) {
  const normalizedLabel = String(sizeLabel ?? '').trim();
  if (!normalizedLabel) return null;

  return {
    label: normalizedLabel,
    catalogEntry: findCatalogEntryByLabel(normalizedLabel),
    casingRole: QUERY_BY_CASING[normalizedLabel]
      ? {
          acceptedInHoles: normalizeRelationshipList(QUERY_BY_CASING[normalizedLabel].accepted_in_holes ?? [], 'hole'),
          drillableHoles: normalizeRelationshipList(QUERY_BY_CASING[normalizedLabel].drillable_holes ?? [], 'hole')
        }
      : null,
    holeRole: QUERY_BY_HOLE[normalizedLabel]
      ? {
          settableCasing: normalizeRelationshipList(QUERY_BY_HOLE[normalizedLabel].settable_casing ?? [], 'casing'),
          reachableFromCasing: normalizeRelationshipList(QUERY_BY_HOLE[normalizedLabel].reachable_from_casing ?? [], 'casing')
        }
      : null
  };
}

export function findFeasiblePrograms({
  startCasingLabel,
  targetType,
  targetLabel,
  maxStages
} = {}) {
  const normalizedStart = String(startCasingLabel ?? '').trim();
  const normalizedTargetType = String(targetType ?? '').trim() === 'hole' ? 'hole' : 'casing';
  const normalizedTargetLabel = String(targetLabel ?? '').trim();
  const normalizedMaxStages = normalizeMaxStages(maxStages);

  if (!normalizedStart || !normalizedTargetLabel) return [];
  if (!QUERY_BY_CASING[normalizedStart]) return [];
  if (normalizedTargetType === 'casing' && !QUERY_BY_CASING[normalizedTargetLabel]) return [];
  if (normalizedTargetType === 'hole' && !QUERY_BY_HOLE[normalizedTargetLabel]) return [];

  if (normalizedTargetType === 'casing' && normalizedStart === normalizedTargetLabel) {
    return [buildProgram([{ type: 'casing', label: normalizedStart }], [], normalizedMaxStages)];
  }

  const results = [];

  function visit(currentType, currentLabel, sequence, steps, visitedTypedNodes) {
    const transitions = getNextTransitions(currentType, currentLabel);
    for (const transition of transitions) {
      const typedNodeKey = `${transition.toType}:${transition.toLabel}`;
      if (visitedTypedNodes.has(typedNodeKey)) continue;

      const nextSequence = [...sequence, { type: transition.toType, label: transition.toLabel }];
      const nextSteps = [...steps, transition];
      const nextVisited = new Set(visitedTypedNodes);
      nextVisited.add(typedNodeKey);
      const nextProgramStageCount = buildProgramStageCount(nextSequence);

      if (normalizedMaxStages !== null && nextProgramStageCount > normalizedMaxStages) {
        continue;
      }

      if (transition.toType === normalizedTargetType && transition.toLabel === normalizedTargetLabel) {
        results.push(buildProgram(nextSequence, nextSteps, normalizedMaxStages));
        continue;
      }

      visit(transition.toType, transition.toLabel, nextSequence, nextSteps, nextVisited);
    }
  }

  visit(
    'casing',
    normalizedStart,
    [{ type: 'casing', label: normalizedStart }],
    [],
    new Set([`casing:${normalizedStart}`])
  );

  return results.sort((left, right) => (
    normalizedMaxStages !== null
      ? compareProgramsWithMaxStages(left, right, normalizedMaxStages)
      : comparePrograms(left, right)
  ));
}

export function getPlannerStageRange({
  startCasingLabel,
  targetType
} = {}) {
  const normalizedStart = String(startCasingLabel ?? '').trim();
  const normalizedTargetType = String(targetType ?? '').trim() === 'hole' ? 'hole' : 'casing';

  if (!normalizedStart || !QUERY_BY_CASING[normalizedStart]) {
    return ['1'];
  }

  const targetLabels = normalizedTargetType === 'hole' ? HOLE_LABELS : CASING_LABELS;
  let highestStageCount = 1;

  targetLabels.forEach((targetLabel) => {
    const programs = findFeasiblePrograms({
      startCasingLabel: normalizedStart,
      targetType: normalizedTargetType,
      targetLabel
    });

    programs.forEach((program) => {
      const stageCount = Number(program?.stageCount ?? 0);
      if (Number.isFinite(stageCount) && stageCount > highestStageCount) {
        highestStageCount = stageCount;
      }
    });
  });

  return Array.from({ length: highestStageCount }, (_, index) => String(index + 1));
}

export function getAllCasingSizeOptions() {
  return CASING_LABELS
    .map((label) => findCatalogEntryByLabel(label))
    .filter(Boolean)
    .sort((left, right) => compareByDecimalAsc(right, left));
}

export function getAllHoleSizeOptions() {
  return HOLE_LABELS
    .map((label) => findCatalogEntryByLabel(label))
    .filter(Boolean)
    .sort((left, right) => compareByDecimalAsc(right, left));
}

export function getAllRuleExplorerSizeOptions() {
  const entriesByLabel = new Map();
  [...getAllCasingSizeOptions(), ...getAllHoleSizeOptions()].forEach((entry) => {
    if (!entry?.label) return;
    if (!entriesByLabel.has(entry.label)) {
      entriesByLabel.set(entry.label, entry);
    }
  });
  return Array.from(entriesByLabel.values()).sort((left, right) => compareByDecimalAsc(right, left));
}
