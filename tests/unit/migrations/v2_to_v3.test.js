import { describe, expect, it } from 'vitest';
import {
  createEmptyWellData,
  detectProjectSchemaVersion,
  ensureProjectSchemaV3,
  getProjectDataKeys,
  isProjectPayloadV3
} from '@/utils/migrations/v2_to_v3.js';

describe('v2_to_v3 migration', () => {
  it('migrates v2 project payload into v3 multi-well structure', () => {
    const v2Payload = {
      meta: {
        schemaVersion: '2.0',
        author: 'QA Engineer'
      },
      config: {
        plotTitle: 'Alpha Well',
        units: 'm'
      },
      data: {
        casingData: [{ od: 9.625, top: 0, bottom: 1000 }],
        tubingData: []
      }
    };

    const migrated = ensureProjectSchemaV3(v2Payload);

    expect(migrated.projectSchemaVersion).toBe('3.0');
    expect(migrated.projectConfig.defaultUnits).toBe('m');
    expect(migrated.wells).toHaveLength(1);
    expect(migrated.wells[0].name).toBe('Alpha Well');
    expect(migrated.wells[0].config.units).toBeUndefined();
    expect(migrated.wells[0].data.casingData[0].componentType).toBe('pipe');
  });

  it('detects schema versions for v3 and legacy payloads', () => {
    const v3Payload = {
      projectSchemaVersion: '3.0',
      wells: []
    };
    const legacyPayload = {
      meta: { schemaVersion: '2.0' },
      data: { casingData: [] }
    };

    expect(isProjectPayloadV3(v3Payload)).toBe(true);
    expect(detectProjectSchemaVersion(v3Payload)).toBe('3.0');
    expect(detectProjectSchemaVersion(legacyPayload)).toBe('2.0');
  });

  it('creates empty well data using all expected project data keys', () => {
    const keys = getProjectDataKeys();
    const emptyData = createEmptyWellData();

    keys.forEach((key) => {
      expect(Array.isArray(emptyData[key])).toBe(true);
    });
  });

  it('ignores optional legacy surface assembly payloads on v3 normalization', () => {
    const payload = ensureProjectSchemaV3({
      projectSchemaVersion: '3.0',
      projectName: 'Surface Project',
      activeWellId: 'well-1',
      wells: [
        {
          id: 'well-1',
          name: 'Well 1',
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
            trajectory: [],
            surfaceAssembly: {
              familyKey: 'legacy-family',
            },
          },
          config: {},
        },
      ],
      meta: {},
    });

    expect(payload.wells[0].data.surfaceAssembly).toBeUndefined();
  });

  it('throws on unsupported payload shapes', () => {
    expect(() => ensureProjectSchemaV3({})).toThrow('Unsupported project payload');
  });
});
