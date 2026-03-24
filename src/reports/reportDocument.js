import { t } from '@/app/i18n.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toDisplayValue(value) {
  if (value === null || value === undefined || value === '') {
    return t('common.none');
  }
  return String(value);
}

function toTitleCase(token) {
  return String(token ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function resolveTableColumns(rows = []) {
  const columnKeys = new Set();
  rows.forEach((row) => {
    Object.keys(row ?? {}).forEach((key) => {
      if (key === 'rowId') return;
      columnKeys.add(key);
    });
  });
  return Array.from(columnKeys);
}

function resolveConfiguredTableColumns(table = {}, rows = []) {
  const configuredColumns = Array.isArray(table?.columns) ? table.columns : [];
  if (configuredColumns.length > 0) return configuredColumns;
  return resolveTableColumns(rows).map((key) => ({ key }));
}

function renderSummaryTable(model = {}) {
  const localizedViewMode = t(`ui.view_mode.${String(model?.config?.viewMode ?? '').trim()}`);
  const localizedOperationPhase = t(`ui.operation_phase.${String(model?.config?.operationPhase ?? '').trim()}`);
  const localizedUnits = t(`ui.units.${String(model?.config?.units ?? '').trim()}`);
  const localizedLanguage = t(`ui.lang.${String(model?.locale?.language ?? '').trim()}`);
  const summaryRows = [
    [t('ui.report.summary.project_name'), model?.project?.name],
    [t('ui.report.summary.well_name'), model?.well?.name],
    [t('ui.report.summary.author'), model?.project?.author],
    [t('ui.report.summary.generated_at'), model?.project?.generatedAt],
    [t('ui.report.summary.view_mode'), localizedViewMode],
    [t('ui.report.summary.operation_phase'), localizedOperationPhase],
    [t('ui.report.summary.units'), localizedUnits],
    [t('ui.report.summary.language'), localizedLanguage]
  ];

  return `
    <section class="report-section report-section--summary">
      <h2>${escapeHtml(t('ui.report.summary.title'))}</h2>
      <table class="report-table report-table--summary">
        <tbody>
          ${summaryRows.map(([label, value]) => `
            <tr>
              <th>${escapeHtml(label)}</th>
              <td>${escapeHtml(toDisplayValue(value))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderFigureSection(title, svgMarkup) {
  return `
    <section class="report-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="report-figure">
        ${svgMarkup || `<p class="report-empty">${escapeHtml(t('common.none'))}</p>`}
      </div>
    </section>
  `;
}

function renderDataTable(title, rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const columns = resolveConfiguredTableColumns({ rows: safeRows }, safeRows);
  return renderConfiguredDataTable(title, safeRows, columns);
}

function renderConfiguredDataTable(title, rows = [], columns = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];

  return `
    <section class="report-section">
      <h2>${escapeHtml(title)}</h2>
      ${safeRows.length > 0 ? `
        <table class="report-table">
          <thead>
            <tr>${safeColumns.map((column) => `<th>${escapeHtml(
              column?.label ?? t(column?.labelKey) ?? toTitleCase(column?.key)
            )}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${safeRows.map((row) => `
              <tr>${safeColumns.map((column) => `<td>${escapeHtml(toDisplayValue(row?.[column?.key]))}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      ` : `<p class="report-empty">${escapeHtml(t('common.none'))}</p>`}
    </section>
  `;
}

function renderTopologySummary(model = {}) {
  const topology = model?.topology ?? {};
  if (topology.status === 'error') {
    return `
      <section class="report-section">
        <h2>${escapeHtml(t('ui.report.topology.title'))}</h2>
        <div class="report-error">
          <strong>${escapeHtml(t('ui.report.topology.error'))}</strong>
          <p>${escapeHtml(toDisplayValue(topology.error))}</p>
        </div>
      </section>
    `;
  }

  const warningCount = Array.isArray(topology?.result?.validationWarnings)
    ? topology.result.validationWarnings.length
    : 0;

  return `
    <section class="report-section">
      <h2>${escapeHtml(t('ui.report.topology.title'))}</h2>
      <table class="report-table report-table--summary">
        <tbody>
          <tr>
            <th>${escapeHtml(t('ui.report.topology.metric.min_failure_cost'))}</th>
            <td>${escapeHtml(toDisplayValue(topology?.result?.minFailureCostToSurface))}</td>
          </tr>
          <tr>
            <th>${escapeHtml(t('ui.report.topology.metric.warnings'))}</th>
            <td>${escapeHtml(String(warningCount))}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderTopologyWarnings(model = {}) {
  const warnings = Array.isArray(model?.topology?.result?.validationWarnings)
    ? model.topology.result.validationWarnings
    : [];

  return `
    <section class="report-section">
      <h2>${escapeHtml(t('ui.report.topology.warnings'))}</h2>
      ${warnings.length > 0 ? `
        <ul class="report-warning-list">
          ${warnings.map((warning) => `<li>${escapeHtml(toDisplayValue(warning?.message))}</li>`).join('')}
        </ul>
      ` : `<p class="report-empty">${escapeHtml(t('common.none'))}</p>`}
    </section>
  `;
}

function renderTopologyGraph(model = {}) {
  const graphSvg = String(model?.figures?.topologyGraphSvg ?? '').trim();
  return `
    <section class="report-section">
      <h2>${escapeHtml(t('ui.report.topology.graph'))}</h2>
      ${graphSvg
        ? `<div class="report-figure">${graphSvg}</div>`
        : `<p class="report-empty">${escapeHtml(t('ui.report.topology.graph.empty'))}</p>`}
    </section>
  `;
}

export function buildReportDocumentHtml(model = {}) {
  const sections = Array.isArray(model?.sections) ? model.sections : [];
  const schematicSvg = String(model?.figures?.schematicSvg ?? '').trim();

  const sectionHtml = sections.map((section) => {
    switch (section?.id) {
      case 'summary':
        return renderSummaryTable(model);
      case 'schematic':
        return renderFigureSection(t('ui.report.schematic.title'), schematicSvg);
      case 'casing-table':
        return renderConfiguredDataTable(
          t(model?.tables?.casing?.titleKey),
          model?.tables?.casing?.rows,
          model?.tables?.casing?.columns
        );
      case 'active-string-table':
        return renderConfiguredDataTable(
          t(model?.tables?.activeString?.titleKey),
          model?.tables?.activeString?.rows,
          model?.tables?.activeString?.columns
        );
      case 'equipment-table':
        return renderConfiguredDataTable(
          t(model?.tables?.equipment?.titleKey),
          model?.tables?.equipment?.rows,
          model?.tables?.equipment?.columns
        );
      case 'topology-summary':
        return renderTopologySummary(model);
      case 'topology-warnings':
        return renderTopologyWarnings(model);
      case 'topology-graph':
        return renderTopologyGraph(model);
      default:
        return '';
    }
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="${escapeHtml(model?.locale?.language ?? 'en')}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(t('ui.report.title'))}</title>
        <style>
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            color: #1f2933;
            margin: 24px;
          }

          .report-header {
            margin-bottom: 24px;
          }

          .report-section {
            break-inside: avoid;
            margin-bottom: 24px;
          }

          .report-table {
            width: 100%;
            border-collapse: collapse;
          }

          .report-table th,
          .report-table td {
            border: 1px solid #d2d6dc;
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
          }

          .report-table th {
            background: #f5f7fa;
            font-weight: 700;
          }

          .report-figure svg {
            width: 100%;
            height: auto;
          }

          .report-empty,
          .report-error p {
            margin: 0;
          }

          .report-error {
            border: 1px solid #ef9a9a;
            background: #fff4f4;
            padding: 12px;
          }

          .report-warning-list {
            margin: 0;
            padding-left: 20px;
          }
        </style>
      </head>
      <body>
        <header class="report-header">
          <h1>${escapeHtml(t('ui.report.title'))}</h1>
        </header>
        ${sectionHtml}
      </body>
    </html>
  `;
}
