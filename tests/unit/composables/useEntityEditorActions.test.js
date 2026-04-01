import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useEntityEditorActions } from '@/composables/useEntityEditorActions.js';

describe('useEntityEditorActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updates selected row field and preserves rowId', () => {
    const projectDataStore = useProjectDataStore();
    projectDataStore.setCasingData([
      { rowId: 'csg-1', label: 'Surface', top: 0, bottom: 1000, od: 9.625, weight: 40 }
    ]);

    const { updateField } = useEntityEditorActions();
    const changed = updateField({
      entityType: 'casing',
      rowId: 'csg-1',
      field: 'label',
      value: 'Updated Surface'
    });

    expect(changed).toBe(true);
    expect(projectDataStore.casingData[0].label).toBe('Updated Surface');
    expect(projectDataStore.casingData[0].rowId).toBe('csg-1');
  });

  it('updates canonical equipment seal override fields and keeps compatibility fields synchronized', () => {
    const projectDataStore = useProjectDataStore();
    projectDataStore.setEquipmentData([
      {
        rowId: 'eq-1',
        type: 'Packer',
        depth: 1200,
        state: {
          actuationState: '',
          integrityStatus: ''
        },
        properties: {
          boreSeal: '',
          annularSeal: '',
          sealByVolume: {}
        },
        show: true
      }
    ]);

    const { updateField } = useEntityEditorActions();
    const changed = updateField({
      entityType: 'equipment',
      rowId: 'eq-1',
      field: 'properties.annularSeal',
      value: 'true'
    });

    expect(changed).toBe(true);
    expect(projectDataStore.equipmentData[0].properties.annularSeal).toBe('true');
    expect(projectDataStore.equipmentData[0].annularSeal).toBe('true');
  });

  it('updates multiple row fields by rowId in a single patch', () => {
    const projectDataStore = useProjectDataStore();
    projectDataStore.setHorizontalLines([
      {
        rowId: 'line-1',
        depth: 1000,
        label: 'Landing',
        labelXPos: 0.2,
        manualLabelDepth: null,
        directionalCenterlineOffsetPx: null,
        directionalManualLabelDepth: null,
        show: true
      }
    ]);

    const { updateFields } = useEntityEditorActions();
    const changed = updateFields({
      entityType: 'line',
      rowId: 'line-1',
      patch: {
        labelXPos: 0.45,
        manualLabelDepth: 1125,
        directionalCenterlineOffsetPx: 32,
        directionalManualLabelDepth: 1100
      }
    });

    expect(changed).toBe(true);
    expect(projectDataStore.horizontalLines[0]).toMatchObject({
      rowId: 'line-1',
      labelXPos: 0.45,
      manualLabelDepth: 1125,
      directionalCenterlineOffsetPx: 32,
      directionalManualLabelDepth: 1100
    });
  });

  it('adds, reorders, and deletes rows by rowId', () => {
    const projectDataStore = useProjectDataStore();
    projectDataStore.setHorizontalLines([
      { rowId: 'line-1', depth: 1000, label: 'A', show: true },
      { rowId: 'line-2', depth: 2000, label: 'B', show: true }
    ]);

    const { addRow, moveRow, deleteRow } = useEntityEditorActions();

    const addedRowId = addRow({ entityType: 'lines' });
    expect(typeof addedRowId).toBe('string');
    expect(projectDataStore.horizontalLines.some((row) => row.rowId === addedRowId)).toBe(true);

    const moved = moveRow({ entityType: 'lines', rowId: 'line-2', direction: 'up' });
    expect(moved).toBe(true);
    expect(projectDataStore.horizontalLines[0].rowId).toBe('line-2');

    const deleted = deleteRow({ entityType: 'lines', rowId: addedRowId });
    expect(deleted).toBe(true);
    expect(projectDataStore.horizontalLines.some((row) => row.rowId === addedRowId)).toBe(false);
  });

  it('restores last deleted row with undo and keeps original rowId ordering', () => {
    const projectDataStore = useProjectDataStore();
    projectDataStore.setHorizontalLines([
      { rowId: 'line-1', depth: 1000, label: 'A', show: true },
      { rowId: 'line-2', depth: 2000, label: 'B', show: true },
      { rowId: 'line-3', depth: 3000, label: 'C', show: true }
    ]);

    const { deleteRow, undoLastDelete } = useEntityEditorActions();

    const deleted = deleteRow({ entityType: 'lines', rowId: 'line-2' });
    expect(deleted).toBe(true);
    expect(projectDataStore.horizontalLines.map((row) => row.rowId)).toEqual([
      'line-1',
      'line-3'
    ]);

    const restoredRowRef = undoLastDelete();
    expect(restoredRowRef).toMatchObject({
      entityType: 'line',
      rowId: 'line-2'
    });
    expect(projectDataStore.horizontalLines.map((row) => row.rowId)).toEqual([
      'line-1',
      'line-2',
      'line-3'
    ]);
  });

  it('moves a row to an absolute target index', () => {
    const projectDataStore = useProjectDataStore();
    projectDataStore.setHorizontalLines([
      { rowId: 'line-1', depth: 1000, label: 'A', show: true },
      { rowId: 'line-2', depth: 2000, label: 'B', show: true },
      { rowId: 'line-3', depth: 3000, label: 'C', show: true }
    ]);

    const { moveRowToIndex } = useEntityEditorActions();
    const moved = moveRowToIndex({
      entityType: 'lines',
      rowId: 'line-3',
      targetIndex: 0
    });

    expect(moved).toBe(true);
    expect(projectDataStore.horizontalLines.map((row) => row.rowId)).toEqual([
      'line-3',
      'line-1',
      'line-2'
    ]);
  });
});
