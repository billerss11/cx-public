import { describe, expect, it } from 'vitest';

import {
  buildActiveWellReportSnapshot,
  buildReportModel
} from '@/reports/reportSnapshot.js';

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
          casingData: [{ rowId: 'csg-1', label: 'Surface casing', top: 0, bottom: 2000, od: 13.375 }],
          tubingData: [{ rowId: 'tbg-1', label: 'Production tubing', top: 0, bottom: 1800, od: 4.5 }],
          drillStringData: [],
          equipmentData: [{ rowId: 'eq-1', type: 'packer', label: 'Packer', depth: 1700 }],
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
          casingData: [{ rowId: 'csg-2', label: 'Intermediate casing', top: 0, bottom: 3200, od: 9.625 }],
          tubingData: [{ rowId: 'tbg-2', label: 'Production tubing', top: 0, bottom: 2800, od: 4.5 }],
          drillStringData: [{ rowId: 'drs-1', label: 'Bottom hole assembly', top: 0, bottom: 2800, od: 5 }],
          equipmentData: [{ rowId: 'eq-2', type: 'bridgePlug', label: 'Bridge plug', depth: 2600 }],
          horizontalLines: [],
          annotationBoxes: [],
          userAnnotations: [],
          cementPlugs: [],
          annulusFluids: [],
          markers: [],
          topologySources: [],
          trajectory: [{ rowId: 'traj-1', md: 0, inc: 0, azi: 0 }]
        }
      }
    ],
    ...overrides
  };
}

describe('reportSnapshot', () => {
  it('builds an immutable active-well report snapshot from the current runtime payload', () => {
    const projectPayload = createProjectPayload();

    const snapshot = buildActiveWellReportSnapshot(projectPayload, {
      language: 'en',
      generatedAt: '2026-03-17T09:30:00.000Z'
    });

    expect(snapshot.project).toEqual({
      name: 'Engineering Review Project',
      author: 'Casey Engineer',
      activeWellId: 'well-2',
      generatedAt: '2026-03-17T09:30:00.000Z'
    });
    expect(snapshot.well).toEqual(expect.objectContaining({
      id: 'well-2',
      name: 'Directional Well'
    }));
    expect(snapshot.config).toEqual(expect.objectContaining({
      viewMode: 'directional',
      operationPhase: 'drilling',
      units: 'm',
      plotTitle: 'Directional review'
    }));
    expect(snapshot.locale).toEqual({
      language: 'en'
    });
    expect(snapshot.tables.casing.rows).toEqual(projectPayload.wells[1].data.casingData);
    expect(snapshot.tables.casing.columns.map((column) => column.key)).toEqual([
      'label',
      'od',
      'weight',
      'grade',
      'top',
      'bottom'
    ]);
    expect(snapshot.tables.activeString.key).toBe('drillString');
    expect(snapshot.tables.activeString.rows).toEqual(projectPayload.wells[1].data.drillStringData);
    expect(snapshot.tables.activeString.columns.map((column) => column.key)).toEqual([
      'label',
      'od',
      'weight',
      'grade',
      'top',
      'bottom'
    ]);
    expect(snapshot.tables.equipment.rows).toEqual(projectPayload.wells[1].data.equipmentData);
    expect(snapshot.tables.equipment.columns.map((column) => column.key)).toEqual([
      'depth',
      'type',
      'label'
    ]);
    expect(snapshot.stateSnapshot.trajectory).toEqual(projectPayload.wells[1].data.trajectory);
    expect(snapshot.well.data).not.toBe(projectPayload.wells[1].data);
  });

  it('builds a section-driven report model with stable ordering and topology payload slots', () => {
    const snapshot = buildActiveWellReportSnapshot(createProjectPayload(), {
      language: 'en',
      generatedAt: '2026-03-17T09:30:00.000Z'
    });

    const model = buildReportModel(snapshot, {
      topology: {
        status: 'ready',
        result: {
          minFailureCostToSurface: 1,
          validationWarnings: [{ key: 'warning-1', message: 'Barrier incomplete.' }]
        },
        graph: {
          nodeCount: 2,
          edgeCount: 1
        }
      },
      figures: {
        schematicSvg: '<svg id="schematic"></svg>',
        topologyGraphSvg: '<svg id="graph"></svg>'
      }
    });

    expect(model.project.name).toBe('Engineering Review Project');
    expect(model.topology.status).toBe('ready');
    expect(model.figures.schematicSvg).toContain('schematic');
    expect(model.sections.map((section) => section.id)).toEqual([
      'summary',
      'schematic',
      'casing-table',
      'active-string-table',
      'equipment-table',
      'topology-summary',
      'topology-warnings',
      'topology-graph'
    ]);
  });
});
