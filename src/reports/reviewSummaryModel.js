import { t } from '@/app/i18n.js';

function normalizeSnapshot(snapshot = {}) {
  return snapshot && typeof snapshot === 'object' ? snapshot : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDerivedState(derivedState = {}) {
  const statusToken = String(derivedState?.status ?? '').trim().toLowerCase();
  const status = statusToken === 'ready' || statusToken === 'error'
    ? statusToken
    : 'loading';

  return {
    status,
    error: status === 'error' ? String(derivedState?.error ?? '').trim() || t('common.none') : null,
    metrics: derivedState?.metrics && typeof derivedState.metrics === 'object'
      ? derivedState.metrics
      : null,
    warnings: normalizeArray(derivedState?.warnings)
  };
}

function toDisplayValue(value, fallback = t('common.none')) {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

function toReviewRowKey(row, fallbackPrefix, index) {
  const rowId = String(row?.rowId ?? '').trim();
  if (rowId) return rowId;
  return `${fallbackPrefix}-${index + 1}`;
}

function buildPipeSection(section = {}, fallbackTitle = '') {
  const rows = normalizeArray(section?.rows).map((row, index) => ({
    key: toReviewRowKey(row, section?.key || 'pipe', index),
    label: toDisplayValue(row?.label),
    od: toDisplayValue(row?.od),
    weight: toDisplayValue(row?.weight),
    grade: toDisplayValue(row?.grade),
    top: toDisplayValue(row?.top),
    bottom: toDisplayValue(row?.bottom)
  }));

  return {
    id: section?.key === 'casing' ? 'casing' : 'active-string',
    kind: 'table',
    modelKey: section?.key === 'casing' ? 'casing' : 'activeString',
    title: section?.titleKey ? t(section.titleKey) : fallbackTitle,
    columns: normalizeArray(section?.columns).map((column) => ({
      key: column?.key,
      label: column?.label ?? t(column?.labelKey)
    })),
    rows
  };
}

function buildEquipmentSection(section = {}) {
  const columns = [
    { key: 'depth', label: t('table.equipment.depth') },
    { key: 'type', label: t('table.equipment.type') },
    { key: 'label', label: t('table.equipment.label') },
    { key: 'attachTarget', label: t('ui.review_summary.metric.attach_target') }
  ];

  const rows = normalizeArray(section?.rows).map((row, index) => ({
    key: toReviewRowKey(row, 'equipment', index),
    depth: toDisplayValue(row?.depth),
    type: toDisplayValue(row?.type ?? row?.typeKey),
    label: toDisplayValue(row?.label),
    attachTarget: toDisplayValue(row?.attachToDisplay ?? row?.attachToRow)
  }));

  return {
    id: 'equipment',
    kind: 'table',
    modelKey: 'equipment',
    title: section?.titleKey ? t(section.titleKey) : t('ui.report.tables.equipment'),
    columns,
    rows
  };
}

function buildMetricSection(id, title, items = [], options = {}) {
  return {
    id,
    kind: 'metrics',
    modelKey: options.modelKey ?? id,
    title,
    status: options.status ?? 'ready',
    error: options.error ?? null,
    loadingText: options.loadingText ?? '',
    items
  };
}

function buildOverviewSection(snapshot = {}) {
  const project = snapshot?.project ?? {};
  const well = snapshot?.well ?? {};
  const config = snapshot?.config ?? {};
  const tables = snapshot?.tables ?? {};

  return buildMetricSection('overview', t('ui.review_summary.section.overview'), [
    { key: 'wellName', label: t('ui.review_summary.metric.well_name'), value: toDisplayValue(well?.name) },
    { key: 'viewMode', label: t('ui.review_summary.metric.view_mode'), value: t(`ui.view_mode.${String(config?.viewMode ?? '').trim()}`) },
    { key: 'operationPhase', label: t('ui.review_summary.metric.operation_phase'), value: t(`ui.operation_phase.${String(config?.operationPhase ?? '').trim()}`) },
    { key: 'units', label: t('ui.review_summary.metric.units'), value: t(`ui.units.${String(config?.units ?? '').trim()}`) },
    { key: 'snapshotTime', label: t('ui.review_summary.metric.snapshot_time'), value: toDisplayValue(project?.generatedAt) },
    { key: 'casingCount', label: t('ui.review_summary.metric.casing_count'), value: normalizeArray(tables?.casing?.rows).length },
    { key: 'activeStringCount', label: t('ui.review_summary.metric.active_string_count'), value: normalizeArray(tables?.activeString?.rows).length },
    { key: 'equipmentCount', label: t('ui.review_summary.metric.equipment_count'), value: normalizeArray(tables?.equipment?.rows).length }
  ]);
}

function buildEnteredDataCountsSection(snapshot = {}) {
  const stateSnapshot = snapshot?.stateSnapshot ?? {};
  return buildMetricSection('entered-data-counts', t('ui.review_summary.section.entered_data_counts'), [
    { key: 'markers', label: t('ui.review_summary.metric.markers'), value: normalizeArray(stateSnapshot?.markers).length },
    { key: 'horizons', label: t('ui.review_summary.metric.horizons'), value: normalizeArray(stateSnapshot?.horizontalLines).length },
    { key: 'intervalCallouts', label: t('ui.review_summary.metric.interval_callouts'), value: normalizeArray(stateSnapshot?.annotationBoxes).length },
    { key: 'cementPlugs', label: t('ui.review_summary.metric.cement_plugs'), value: normalizeArray(stateSnapshot?.cementPlugs).length },
    { key: 'annulusFluids', label: t('ui.review_summary.metric.annulus_fluids'), value: normalizeArray(stateSnapshot?.annulusFluids).length },
    { key: 'trajectoryPoints', label: t('ui.review_summary.metric.trajectory_points'), value: normalizeArray(stateSnapshot?.trajectory).length }
  ]);
}

function buildDerivedSummarySection(derivedState = {}) {
  if (derivedState.status === 'loading') {
    return buildMetricSection(
      'derived-summary',
      t('ui.review_summary.section.derived_summary'),
      [],
      {
        status: 'loading',
        loadingText: t('ui.review_summary.derived_loading')
      }
    );
  }

  if (derivedState.status === 'error') {
    return buildMetricSection(
      'derived-summary',
      t('ui.review_summary.section.derived_summary'),
      [],
      {
        status: 'error',
        error: derivedState.error
      }
    );
  }

  const metrics = derivedState.metrics ?? {};
  return buildMetricSection('derived-summary', t('ui.review_summary.section.derived_summary'), [
    { key: 'minFailureCost', label: t('ui.review_summary.metric.min_failure_cost'), value: toDisplayValue(metrics?.minFailureCost) },
    { key: 'warningCount', label: t('ui.review_summary.metric.warning_count'), value: toDisplayValue(metrics?.warningCount, 0) },
    { key: 'sourceCount', label: t('ui.review_summary.metric.source_count'), value: toDisplayValue(metrics?.sourceCount, 0) },
    { key: 'nodeCount', label: t('ui.review_summary.metric.node_count'), value: toDisplayValue(metrics?.nodeCount, 0) },
    { key: 'edgeCount', label: t('ui.review_summary.metric.edge_count'), value: toDisplayValue(metrics?.edgeCount, 0) }
  ]);
}

function buildWarningDigestSection(derivedState = {}) {
  if (derivedState.status === 'loading') {
    return {
      id: 'warning-digest',
      kind: 'warning-list',
      modelKey: 'warningDigest',
      title: t('ui.review_summary.section.warning_digest'),
      status: 'loading',
      rows: [],
      remainingCount: 0,
      moreLabel: '',
      error: null,
      loadingText: t('ui.review_summary.derived_loading')
    };
  }

  if (derivedState.status === 'error') {
    return {
      id: 'warning-digest',
      kind: 'warning-list',
      modelKey: 'warningDigest',
      title: t('ui.review_summary.section.warning_digest'),
      status: 'error',
      rows: [],
      remainingCount: 0,
      moreLabel: '',
      error: derivedState.error,
      loadingText: ''
    };
  }

  const allWarnings = normalizeArray(derivedState.warnings).map((warning, index) => ({
    key: String(warning?.key ?? '').trim() || `warning-${index + 1}`,
    code: String(warning?.code ?? '').trim(),
    message: toDisplayValue(warning?.message)
  }));
  const rows = allWarnings.slice(0, 5);
  const remainingCount = Math.max(0, allWarnings.length - rows.length);

  return {
    id: 'warning-digest',
    kind: 'warning-list',
    modelKey: 'warningDigest',
    title: t('ui.review_summary.section.warning_digest'),
    status: 'ready',
    rows,
    remainingCount,
    moreLabel: remainingCount > 0 ? t('ui.review_summary.warning_more', { count: remainingCount }) : '',
    error: null,
    loadingText: ''
  };
}

export function buildReviewSummaryModel(snapshot = {}, options = {}) {
  const safeSnapshot = normalizeSnapshot(snapshot);
  const derivedState = normalizeDerivedState(options?.derivedState);

  const overview = buildOverviewSection(safeSnapshot);
  const casing = buildPipeSection(safeSnapshot?.tables?.casing, t('ui.report.tables.casing'));
  const activeString = buildPipeSection(safeSnapshot?.tables?.activeString, t('ui.report.tables.tubing'));
  const equipment = buildEquipmentSection(safeSnapshot?.tables?.equipment);
  const enteredDataCounts = buildEnteredDataCountsSection(safeSnapshot);
  const derivedSummary = buildDerivedSummarySection(derivedState);
  const warningDigest = buildWarningDigestSection(derivedState);

  return {
    overview,
    casing,
    activeString,
    equipment,
    enteredDataCounts,
    derivedSummary,
    warningDigest,
    status: {
      snapshotGeneratedAt: safeSnapshot?.project?.generatedAt ?? null,
      derivedStatus: derivedState.status
    },
    sections: [
      { id: 'overview', kind: 'metrics', modelKey: 'overview' },
      { id: 'casing', kind: 'table', modelKey: 'casing' },
      { id: 'active-string', kind: 'table', modelKey: 'activeString' },
      { id: 'equipment', kind: 'table', modelKey: 'equipment' },
      { id: 'entered-data-counts', kind: 'metrics', modelKey: 'enteredDataCounts' },
      { id: 'derived-summary', kind: 'metrics', modelKey: 'derivedSummary' },
      { id: 'warning-digest', kind: 'warning-list', modelKey: 'warningDigest' }
    ]
  };
}
