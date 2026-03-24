import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/i18n.js', () => ({
  t: (key) => ({
    'ui.report.title': 'Engineering review report',
    'ui.report.summary.title': 'Summary',
    'ui.report.schematic.title': 'Schematic figure',
    'ui.report.tables.casing': 'Casing data',
    'ui.report.tables.tubing': 'Tubing data',
    'ui.report.tables.drill_string': 'Drill string data',
    'ui.report.tables.equipment': 'Equipment list',
    'ui.report.topology.title': 'Topology summary',
    'ui.report.topology.warnings': 'Topology warnings',
    'ui.report.topology.graph': 'Topology graph appendix',
    'ui.report.topology.graph.empty': 'No topology graph data available for this export.',
    'ui.report.topology.error': 'Topology could not be computed for this export.',
    'ui.report.topology.metric.min_failure_cost': 'Min failure cost',
    'ui.report.topology.metric.warnings': 'Warnings',
    'ui.view_mode.directional': 'Directional view',
    'ui.operation_phase.drilling': 'Drilling phase',
    'ui.units.m': 'meters',
    'ui.lang.en': 'English',
    'ui.report.summary.project_name': 'Project name',
    'ui.report.summary.well_name': 'Well name',
    'ui.report.summary.generated_at': 'Generated at',
    'ui.report.summary.view_mode': 'View mode',
    'ui.report.summary.operation_phase': 'Operation phase',
    'ui.report.summary.units': 'Units',
    'ui.report.summary.author': 'Author',
    'ui.report.summary.language': 'Language',
    'common.none': 'N/A'
  }[key] ?? key)
}));

import { buildReportDocumentHtml } from '@/reports/reportDocument.js';

function createBaseModel() {
  return {
    project: {
      name: 'Engineering Review Project',
      author: 'Casey Engineer',
      activeWellId: 'well-1',
      generatedAt: '2026-03-17T09:30:00.000Z'
    },
    well: {
      id: 'well-1',
      name: 'Directional Well'
    },
    config: {
      viewMode: 'directional',
      operationPhase: 'drilling',
      units: 'm'
    },
    locale: {
      language: 'en'
    },
    tables: {
      casing: {
        key: 'casing',
        titleKey: 'ui.report.tables.casing',
        columns: [
          { key: 'label', label: 'Label' },
          { key: 'top', label: 'Top' },
          { key: 'bottom', label: 'Bottom' }
        ],
        rows: [{ rowId: 'csg-1', label: 'Intermediate casing', top: 0, bottom: 3200 }]
      },
      activeString: {
        key: 'drillString',
        titleKey: 'ui.report.tables.drill_string',
        columns: [
          { key: 'label', label: 'Label' },
          { key: 'top', label: 'Top' },
          { key: 'bottom', label: 'Bottom' }
        ],
        rows: [{ rowId: 'drs-1', label: 'Bottom hole assembly', top: 0, bottom: 2800 }]
      },
      equipment: {
        key: 'equipment',
        titleKey: 'ui.report.tables.equipment',
        columns: [
          { key: 'depth', label: 'Depth' },
          { key: 'type', label: 'Type' },
          { key: 'label', label: 'Label' }
        ],
        rows: [{ rowId: 'eq-1', label: 'Bridge plug', depth: 2600 }]
      }
    },
    topology: {
      status: 'ready',
      result: {
        minFailureCostToSurface: 1,
        validationWarnings: [{ key: 'warn-1', message: 'Barrier incomplete.' }]
      },
      graph: {
        nodeCount: 3,
        edgeCount: 2
      }
    },
    figures: {
      schematicSvg: '<svg id="schematic-figure"></svg>',
      topologyGraphSvg: '<svg id="topology-figure"></svg>'
    },
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

describe('reportDocument', () => {
  it('renders the core sections and respects the active tubing versus drill string section', () => {
    const html = buildReportDocumentHtml(createBaseModel());

    expect(html).toContain('Engineering review report');
    expect(html).toContain('Schematic figure');
    expect(html).toContain('Casing data');
    expect(html).toContain('Drill string data');
    expect(html).not.toContain('Tubing data');
    expect(html).toContain('Equipment list');
    expect(html).toContain('Topology summary');
    expect(html).toContain('Min failure cost');
    expect(html).toContain('Warnings');
    expect(html).toContain('Directional view');
    expect(html).toContain('Drilling phase');
    expect(html).toContain('meters');
    expect(html).toContain('English');
    expect(html).toContain('Topology graph appendix');
    expect(html).toContain('schematic-figure');
    expect(html).toContain('topology-figure');
  });

  it('renders topology fallbacks when the topology step fails or yields no graph figure', () => {
    const failureModel = createBaseModel();
    failureModel.topology = {
      status: 'error',
      error: 'Worker failed.'
    };
    failureModel.figures.topologyGraphSvg = '';

    const failureHtml = buildReportDocumentHtml(failureModel);
    expect(failureHtml).toContain('Topology could not be computed for this export.');
    expect(failureHtml).toContain('Worker failed.');
    expect(failureHtml).toContain('No topology graph data available for this export.');
  });
});
