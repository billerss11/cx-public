import { describe, expect, it } from 'vitest';
import {
  PROJECT_SCHEMA_VERSION_V7,
  createEmptyWellData,
  ensureProjectSchemaV7,
} from '@/utils/migrations/v6_to_v7.js';

describe('v6_to_v7 surface communication migration', () => {
  it('creates empty well data with empty surface communication fields', () => {
    const emptyData = createEmptyWellData();

    expect(emptyData.surfacePaths).toEqual([]);
    expect(emptyData.surfaceTransfers).toEqual([]);
    expect(emptyData.surfaceOutlets).toEqual([]);
    expect(emptyData.surfaceTemplate).toEqual({});
    expect(emptyData.surfaceAssemblyData).toBeUndefined();
    expect(emptyData.surfaceFlowPathData).toBeUndefined();
  });

  it('adds empty surface communication fields while ignoring removed experimental payloads', () => {
    const payload = ensureProjectSchemaV7({
      projectSchemaVersion: '6.0',
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
            trajectory: [],
            surfaceAssemblyData: [{ rowId: 'sa-1', label: 'Removed', show: true }],
            surfaceFlowPathData: [{ rowId: 'path-1', channelKey: 'TUBING_INNER', show: true }],
          },
          config: {},
        },
      ],
      meta: {},
    });

    expect(payload.projectSchemaVersion).toBe(PROJECT_SCHEMA_VERSION_V7);
    expect(payload.wells[0].data.surfacePaths).toEqual([]);
    expect(payload.wells[0].data.surfaceTransfers).toEqual([]);
    expect(payload.wells[0].data.surfaceOutlets).toEqual([]);
    expect(payload.wells[0].data.surfaceTemplate).toEqual({});
    expect(payload.wells[0].data.surfaceAssemblyData).toBeUndefined();
    expect(payload.wells[0].data.surfaceFlowPathData).toBeUndefined();
    expect(payload.loadWarnings).toEqual([]);
  });
});
