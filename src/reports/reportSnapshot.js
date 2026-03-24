import { cloneSnapshot } from '@/utils/general.js';

function normalizeProjectPayload(payload = {}) {
  return payload && typeof payload === 'object' ? payload : {};
}

function resolveActiveWell(projectPayload = {}) {
  const safePayload = normalizeProjectPayload(projectPayload);
  const wells = Array.isArray(safePayload.wells) ? safePayload.wells : [];
  const activeWellId = String(safePayload.activeWellId ?? '').trim();
  return wells.find((well) => String(well?.id ?? '').trim() === activeWellId) ?? wells[0] ?? null;
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? cloneSnapshot(rows) : [];
}

function normalizeConfig(config = {}, projectConfig = {}) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const safeProjectConfig = projectConfig && typeof projectConfig === 'object' ? projectConfig : {};
  return cloneSnapshot({
    ...safeProjectConfig,
    ...safeConfig
  });
}

function buildTableModel(key, rows, titleKey) {
  return {
    key,
    titleKey,
    columns: resolveTableColumns(key),
    rows: normalizeRows(rows)
  };
}

function resolveTableColumns(key) {
  switch (String(key ?? '').trim()) {
    case 'casing':
      return [
        { key: 'label', labelKey: 'table.casing.label' },
        { key: 'od', labelKey: 'table.casing.od_export' },
        { key: 'weight', labelKey: 'table.casing.weight_export' },
        { key: 'grade', labelKey: 'table.casing.grade' },
        { key: 'top', labelKey: 'table.casing.top' },
        { key: 'bottom', labelKey: 'table.casing.bottom' }
      ];
    case 'drillString':
      return [
        { key: 'label', labelKey: 'table.drill_string.label' },
        { key: 'od', labelKey: 'table.drill_string.od' },
        { key: 'weight', labelKey: 'table.drill_string.weight' },
        { key: 'grade', labelKey: 'table.drill_string.grade' },
        { key: 'top', labelKey: 'table.drill_string.top' },
        { key: 'bottom', labelKey: 'table.drill_string.bottom' }
      ];
    case 'tubing':
      return [
        { key: 'label', labelKey: 'table.tubing.label' },
        { key: 'od', labelKey: 'table.tubing.od' },
        { key: 'weight', labelKey: 'table.tubing.weight' },
        { key: 'grade', labelKey: 'table.tubing.grade' },
        { key: 'top', labelKey: 'table.tubing.top' },
        { key: 'bottom', labelKey: 'table.tubing.bottom' }
      ];
    case 'equipment':
      return [
        { key: 'depth', labelKey: 'table.equipment.depth' },
        { key: 'type', labelKey: 'table.equipment.type' },
        { key: 'label', labelKey: 'table.equipment.label' }
      ];
    default:
      return [];
  }
}

function resolveActiveStringConfig(config = {}, data = {}) {
  const operationPhase = String(config?.operationPhase ?? '').trim().toLowerCase() === 'drilling'
    ? 'drilling'
    : 'production';

  if (operationPhase === 'drilling') {
    return buildTableModel('drillString', data?.drillStringData, 'ui.report.tables.drill_string');
  }

  return buildTableModel('tubing', data?.tubingData, 'ui.report.tables.tubing');
}

export function buildActiveWellReportSnapshot(projectPayload = {}, options = {}) {
  const safePayload = normalizeProjectPayload(projectPayload);
  const activeWell = resolveActiveWell(safePayload);
  const wellData = cloneSnapshot(activeWell?.data ?? {});
  const config = normalizeConfig(activeWell?.config, safePayload.projectConfig);
  const generatedAt = String(options?.generatedAt ?? '').trim() || new Date().toISOString();
  const language = String(options?.language ?? 'zh').trim() || 'zh';

  return {
    project: {
      name: String(safePayload.projectName ?? '').trim() || 'Project',
      author: String(safePayload.projectAuthor ?? '').trim(),
      activeWellId: String(activeWell?.id ?? safePayload.activeWellId ?? '').trim() || null,
      generatedAt
    },
    well: {
      id: String(activeWell?.id ?? '').trim() || null,
      name: String(activeWell?.name ?? '').trim() || 'Well',
      data: wellData
    },
    config,
    locale: {
      language
    },
    tables: {
      casing: buildTableModel('casing', wellData?.casingData, 'ui.report.tables.casing'),
      activeString: resolveActiveStringConfig(config, wellData),
      equipment: buildTableModel('equipment', wellData?.equipmentData, 'ui.report.tables.equipment')
    },
    stateSnapshot: {
      casingData: normalizeRows(wellData?.casingData),
      tubingData: normalizeRows(wellData?.tubingData),
      drillStringData: normalizeRows(wellData?.drillStringData),
      equipmentData: normalizeRows(wellData?.equipmentData),
      horizontalLines: normalizeRows(wellData?.horizontalLines),
      annotationBoxes: normalizeRows(wellData?.annotationBoxes),
      userAnnotations: normalizeRows(wellData?.userAnnotations),
      cementPlugs: normalizeRows(wellData?.cementPlugs),
      annulusFluids: normalizeRows(wellData?.annulusFluids),
      markers: normalizeRows(wellData?.markers),
      topologySources: normalizeRows(wellData?.topologySources),
      surfaceComponents: normalizeRows(wellData?.surfaceComponents),
      surfacePaths: normalizeRows(wellData?.surfacePaths),
      surfaceTransfers: normalizeRows(wellData?.surfaceTransfers),
      surfaceOutlets: normalizeRows(wellData?.surfaceOutlets),
      surfaceTemplate: cloneSnapshot(wellData?.surfaceTemplate ?? {}),
      trajectory: normalizeRows(wellData?.trajectory),
      config: cloneSnapshot(config),
      interaction: {}
    }
  };
}

export function buildReportModel(snapshot = {}, options = {}) {
  const topology = options?.topology && typeof options.topology === 'object'
    ? options.topology
    : { status: 'idle' };
  const figures = options?.figures && typeof options.figures === 'object'
    ? options.figures
    : {};

  return {
    project: cloneSnapshot(snapshot?.project ?? {}),
    well: cloneSnapshot(snapshot?.well ?? {}),
    config: cloneSnapshot(snapshot?.config ?? {}),
    locale: cloneSnapshot(snapshot?.locale ?? {}),
    tables: cloneSnapshot(snapshot?.tables ?? {}),
    topology: cloneSnapshot(topology),
    figures: cloneSnapshot(figures),
    sections: [
      { id: 'summary' },
      { id: 'schematic' },
      { id: 'casing-table' },
      { id: 'active-string-table' },
      { id: 'equipment-table' },
      { id: 'topology-summary' },
      { id: 'topology-warnings' },
      { id: 'topology-graph' }
    ]
  };
}
