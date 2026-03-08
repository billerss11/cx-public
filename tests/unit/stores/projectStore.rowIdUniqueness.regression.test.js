import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';

function createWellData(overrides = {}) {
  return {
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
    ...overrides
  };
}

function collectNormalizedRowIds(rows = []) {
  return rows
    .map((row) => String(row?.rowId ?? '').trim())
    .filter((rowId) => rowId.length > 0);
}

describe('projectStore rowId uniqueness contract (regression)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('rewrites duplicate casing rowIds on project load so row references remain unambiguous', () => {
    const projectStore = useProjectStore();
    const projectDataStore = useProjectDataStore();

    projectStore.loadProject({
      projectSchemaVersion: '3.0',
      projectName: 'Duplicate Row ID Project',
      projectAuthor: '',
      activeWellId: 'well-1',
      projectConfig: { defaultUnits: 'ft' },
      wells: [
        {
          id: 'well-1',
          name: 'Well 1',
          data: createWellData({
            casingData: [
              { rowId: 'csg-dup-1', label: 'Surface', top: 0, bottom: 1000, od: 13.375, weight: 54.5 },
              { rowId: 'csg-dup-1', label: 'Intermediate', top: 0, bottom: 3000, od: 9.625, weight: 40 }
            ]
          }),
          config: {}
        }
      ]
    });

    const persistedIds = collectNormalizedRowIds(projectStore.activeWell?.data?.casingData ?? []);
    const runtimeIds = collectNormalizedRowIds(projectDataStore.casingData ?? []);

    expect(new Set(persistedIds).size).toBe(persistedIds.length);
    expect(new Set(runtimeIds).size).toBe(runtimeIds.length);
  });
});
