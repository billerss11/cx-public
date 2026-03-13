import { describe, expect, it } from 'vitest';
import {
  PROJECT_SCHEMA_VERSION_V6,
  createEmptyWellData,
  ensureProjectSchemaV6,
} from '@/utils/migrations/v5_to_v6.js';

describe('v5_to_v6 surface removal migration', () => {
  it('creates empty well data without removed surface keys', () => {
    const emptyData = createEmptyWellData();

    expect(emptyData.surfaceEquipmentData).toBeUndefined();
    expect(emptyData.surfaceFlowPathData).toBeUndefined();
    expect(emptyData.surfaceFlowComponentData).toBeUndefined();
    expect(emptyData.surfaceAssemblyData).toBeUndefined();
    expect(emptyData.surfaceAssemblyInspectionData).toBeUndefined();
  });

  it('silently strips removed surface payloads while keeping downhole data', () => {
    const payload = ensureProjectSchemaV6({
      projectSchemaVersion: '5.0',
      projectName: 'Legacy Surface Project',
      activeWellId: 'well-1',
      wells: [
        {
          id: 'well-1',
          name: 'Well 1',
          data: {
            casingData: [{ rowId: 'csg-1', top: 0, bottom: 1000, od: 9.625, show: true }],
            tubingData: [{ rowId: 'tbg-1', top: 0, bottom: 900, od: 4.5, show: true }],
            drillStringData: [],
            equipmentData: [],
            horizontalLines: [],
            annotationBoxes: [],
            userAnnotations: [],
            cementPlugs: [],
            annulusFluids: [],
            markers: [],
            topologySources: [],
            surfaceEquipmentData: [{ rowId: 'se-1', label: 'Tree', show: true }],
            surfaceFlowPathData: [{ rowId: 'path-1', channelKey: 'TUBING_INNER', show: true }],
            surfaceFlowComponentData: [{ rowId: 'comp-1', pathId: 'path-1', show: true }],
            surfaceAssemblyData: [{ rowId: 'sa-1', label: 'Compiled Tree', show: true }],
            surfaceAssemblyInspectionData: { sections: [{ key: 'main' }] },
            trajectory: [],
          },
          config: {},
        },
      ],
      meta: {},
    });

    expect(payload.projectSchemaVersion).toBe(PROJECT_SCHEMA_VERSION_V6);
    expect(payload.wells[0].data.casingData).toHaveLength(1);
    expect(payload.wells[0].data.tubingData).toHaveLength(1);
    expect(payload.wells[0].data.surfaceEquipmentData).toBeUndefined();
    expect(payload.wells[0].data.surfaceFlowPathData).toBeUndefined();
    expect(payload.wells[0].data.surfaceFlowComponentData).toBeUndefined();
    expect(payload.wells[0].data.surfaceAssemblyData).toBeUndefined();
    expect(payload.wells[0].data.surfaceAssemblyInspectionData).toBeUndefined();
    expect(payload.loadWarnings).toEqual([]);
  });
});
