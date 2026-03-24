import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/i18n.js', () => ({
  t: (key, vars = {}) => {
    const table = {
      'ui.report.tables.casing': 'Casing data',
      'ui.report.tables.tubing': 'Tubing data',
      'ui.report.tables.drill_string': 'Drill string data',
      'ui.report.tables.equipment': 'Equipment list',
      'ui.review_summary.section.entered_data_counts': 'Entered data counts',
      'ui.review_summary.section.derived_summary': 'Derived summary',
      'ui.review_summary.section.warning_digest': 'Warning digest',
      'ui.review_summary.metric.well_name': 'Well name',
      'ui.review_summary.metric.view_mode': 'View mode',
      'ui.review_summary.metric.operation_phase': 'Operation phase',
      'ui.review_summary.metric.units': 'Units',
      'ui.review_summary.metric.snapshot_time': 'Snapshot time',
      'ui.review_summary.metric.casing_count': 'Casing rows',
      'ui.review_summary.metric.active_string_count': 'Active string rows',
      'ui.review_summary.metric.equipment_count': 'Equipment rows',
      'ui.review_summary.metric.markers': 'Markers',
      'ui.review_summary.metric.horizons': 'Horizons',
      'ui.review_summary.metric.interval_callouts': 'Interval callouts',
      'ui.review_summary.metric.cement_plugs': 'Cement plugs',
      'ui.review_summary.metric.annulus_fluids': 'Annulus fluids',
      'ui.review_summary.metric.trajectory_points': 'Trajectory points',
      'ui.review_summary.metric.min_failure_cost': 'Min failure cost',
      'ui.review_summary.metric.warning_count': 'Warning count',
      'ui.review_summary.metric.source_count': 'Source count',
      'ui.review_summary.metric.node_count': 'Node count',
      'ui.review_summary.metric.edge_count': 'Edge count',
      'ui.review_summary.warning_more': `and ${vars.count} more`,
      'ui.view_mode.directional': 'directional',
      'ui.operation_phase.drilling': 'drilling',
      'ui.units.m': 'm'
    };
    return table[key] ?? key;
  }
}));

import { buildActiveWellReportSnapshot } from '@/reports/reportSnapshot.js';
import { buildReviewSummaryModel } from '@/reports/reviewSummaryModel.js';

function createProjectPayload(overrides = {}) {
  return {
    projectName: 'Engineering Review Project',
    projectAuthor: 'Casey Engineer',
    activeWellId: 'well-2',
    projectConfig: {
      defaultUnits: 'ft'
    },
    wells: [
      {
        id: 'well-1',
        name: 'Vertical Well',
        config: {
          viewMode: 'vertical',
          operationPhase: 'production',
          units: 'ft'
        },
        data: {
          casingData: [],
          tubingData: [],
          drillStringData: [],
          equipmentData: [],
          horizontalLines: [],
          annotationBoxes: [],
          userAnnotations: [],
          cementPlugs: [],
          annulusFluids: [],
          markers: [],
          topologySources: [],
          trajectory: []
        }
      },
      {
        id: 'well-2',
        name: 'Directional Well',
        config: {
          viewMode: 'directional',
          operationPhase: 'drilling',
          units: 'm',
          plotTitle: 'Directional review'
        },
        data: {
          casingData: [
            { rowId: 'csg-1', label: 'Surface casing', od: 13.375, weight: 54.5, grade: 'J55', top: 0, bottom: 2000 },
            { rowId: 'csg-2', label: 'Intermediate casing', od: 9.625, weight: 40, grade: 'L80', top: 0, bottom: 3200 }
          ],
          tubingData: [{ rowId: 'tbg-1', label: 'Production tubing', od: 4.5, weight: 12.6, grade: 'P110', top: 0, bottom: 2800 }],
          drillStringData: [{ rowId: 'drs-1', label: 'Bottom hole assembly', od: 5, weight: 19.5, grade: 'S135', top: 0, bottom: 2800 }],
          equipmentData: [
            { rowId: 'eq-1', depth: 2500, type: 'bridgePlug', label: 'Bridge plug', attachToDisplay: 'Production tubing' }
          ],
          horizontalLines: [{ rowId: 'line-1', depth: 1500 }],
          annotationBoxes: [{ rowId: 'box-1', topDepth: 1000, bottomDepth: 1400 }],
          userAnnotations: [],
          cementPlugs: [{ rowId: 'plug-1', top: 2600, bottom: 2700 }],
          annulusFluids: [{ rowId: 'fluid-1', top: 0, bottom: 1500 }],
          markers: [{ rowId: 'marker-1', top: 2200 }],
          topologySources: [],
          trajectory: [
            { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
            { rowId: 'traj-2', md: 1000, inc: 5, azi: 45 }
          ]
        }
      }
    ],
    ...overrides
  };
}

describe('reviewSummaryModel', () => {
  it('builds overview, entered-data counts, and phase-aware active string sections', () => {
    const snapshot = buildActiveWellReportSnapshot(createProjectPayload(), {
      language: 'en',
      generatedAt: '2026-03-17T16:00:00.000Z'
    });

    const model = buildReviewSummaryModel(snapshot, {
      derivedState: { status: 'loading' }
    });

    expect(model.sections.map((section) => section.id)).toEqual([
      'overview',
      'casing',
      'active-string',
      'equipment',
      'entered-data-counts',
      'derived-summary',
      'warning-digest'
    ]);

    expect(model.overview.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'wellName', value: 'Directional Well' }),
      expect.objectContaining({ key: 'viewMode', value: 'directional' }),
      expect.objectContaining({ key: 'operationPhase', value: 'drilling' }),
      expect.objectContaining({ key: 'units', value: 'm' }),
      expect.objectContaining({ key: 'snapshotTime', value: '2026-03-17T16:00:00.000Z' }),
      expect.objectContaining({ key: 'casingCount', value: 2 }),
      expect.objectContaining({ key: 'activeStringCount', value: 1 }),
      expect.objectContaining({ key: 'equipmentCount', value: 1 })
    ]));

    expect(model.activeString.title).toBe('Drill string data');
    expect(model.activeString.rows).toEqual([
      expect.objectContaining({ label: 'Bottom hole assembly' })
    ]);
    expect(model.equipment.rows).toEqual([
      expect.objectContaining({ attachTarget: 'Production tubing' })
    ]);

    expect(model.enteredDataCounts.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'markers', value: 1 }),
      expect.objectContaining({ key: 'horizons', value: 1 }),
      expect.objectContaining({ key: 'intervalCallouts', value: 1 }),
      expect.objectContaining({ key: 'cementPlugs', value: 1 }),
      expect.objectContaining({ key: 'annulusFluids', value: 1 }),
      expect.objectContaining({ key: 'trajectoryPoints', value: 2 })
    ]));

    expect(model.derivedSummary.status).toBe('loading');
    expect(model.warningDigest.status).toBe('loading');
  });

  it('truncates warning digest rows and keeps a remaining warning count', () => {
    const snapshot = buildActiveWellReportSnapshot(createProjectPayload(), {
      language: 'en',
      generatedAt: '2026-03-17T16:00:00.000Z'
    });

    const warnings = Array.from({ length: 7 }, (_, index) => ({
      key: `warning-${index + 1}`,
      code: `W-${index + 1}`,
      message: `Warning ${index + 1}`
    }));

    const model = buildReviewSummaryModel(snapshot, {
      derivedState: {
        status: 'ready',
        metrics: {
          minFailureCost: 1,
          warningCount: warnings.length,
          sourceCount: 3,
          nodeCount: 12,
          edgeCount: 18
        },
        warnings
      }
    });

    expect(model.derivedSummary.status).toBe('ready');
    expect(model.derivedSummary.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'minFailureCost', value: 1 }),
      expect.objectContaining({ key: 'warningCount', value: 7 }),
      expect.objectContaining({ key: 'sourceCount', value: 3 }),
      expect.objectContaining({ key: 'nodeCount', value: 12 }),
      expect.objectContaining({ key: 'edgeCount', value: 18 })
    ]));
    expect(model.warningDigest.rows).toHaveLength(5);
    expect(model.warningDigest.rows[0]).toEqual(expect.objectContaining({
      code: 'W-1',
      message: 'Warning 1'
    }));
    expect(model.warningDigest.remainingCount).toBe(2);
    expect(model.warningDigest.moreLabel).toBe('and 2 more');
  });
});
