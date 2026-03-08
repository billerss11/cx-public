import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { clearDeleteUndoHistory, useEntityEditorActions } from '@/composables/useEntityEditorActions.js';

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

describe('useEntityEditorActions cross-well undo safety (regression)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    clearDeleteUndoHistory();
  });

  it('does not restore a deleted row into another well when the source well no longer exists', () => {
    const projectStore = useProjectStore();
    const projectDataStore = useProjectDataStore();
    const { deleteRow, undoLastDelete } = useEntityEditorActions();

    projectStore.loadProject({
      projectSchemaVersion: '3.0',
      projectName: 'Cross Well Undo Project',
      projectAuthor: '',
      activeWellId: 'well-1',
      projectConfig: { defaultUnits: 'ft' },
      wells: [
        {
          id: 'well-1',
          name: 'Well 1',
          data: createWellData({
            horizontalLines: [
              { rowId: 'line-a', depth: 1000, label: 'A', show: true }
            ]
          }),
          config: {}
        },
        {
          id: 'well-2',
          name: 'Well 2',
          data: createWellData({
            horizontalLines: [
              { rowId: 'line-b', depth: 2000, label: 'B', show: true }
            ]
          }),
          config: {}
        }
      ]
    });

    const deleted = deleteRow({ entityType: 'lines', rowId: 'line-a' });
    expect(deleted).toBe(true);
    expect(projectDataStore.horizontalLines.map((row) => row.rowId)).toEqual([]);

    const deletedWellResult = projectStore.deleteWell('well-1');
    expect(deletedWellResult?.ok).toBe(true);
    expect(projectStore.activeWellId).toBe('well-2');
    expect(projectDataStore.horizontalLines.map((row) => row.rowId)).toEqual(['line-b']);

    const restoredRowRef = undoLastDelete();

    expect(restoredRowRef).toBeNull();
    expect(projectStore.activeWellId).toBe('well-2');
    expect(projectDataStore.horizontalLines.map((row) => row.rowId)).toEqual(['line-b']);
  });
});
