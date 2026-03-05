import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia } from 'pinia';
import { pinia } from '@/stores/pinia.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';
import { clearSelection, selectEntityByRowRef } from '@/app/selection.js';

function createWellData(casingRows = []) {
  return {
    casingData: casingRows,
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
  };
}

describe('selectEntityByRowRef', () => {
  beforeEach(() => {
    setActivePinia(pinia);
  });

  it('switches well and locks entity by rowId', async () => {
    const projectStore = useProjectStore(pinia);
    const interactionStore = useInteractionStore(pinia);

    projectStore.loadProject({
      projectSchemaVersion: '3.0',
      projectName: 'Selection Test Project',
      projectAuthor: '',
      activeWellId: 'well-1',
      projectConfig: { defaultUnits: 'ft' },
      wells: [
        {
          id: 'well-1',
          name: 'Well 1',
          data: createWellData([
            { rowId: 'csg-1', label: 'Well 1 Casing', top: 0, bottom: 1200, od: 9.625, weight: 40 }
          ]),
          config: {}
        },
        {
          id: 'well-2',
          name: 'Well 2',
          data: createWellData([
            { rowId: 'csg-2-a', label: 'Outer', top: 0, bottom: 1500, od: 13.375, weight: 54.5 },
            { rowId: 'row-123', label: 'Target', top: 0, bottom: 1400, od: 9.625, weight: 40 }
          ]),
          config: {}
        }
      ]
    });

    await selectEntityByRowRef({
      wellId: 'well-2',
      entityType: 'casing',
      rowId: 'row-123'
    });

    expect(projectStore.activeWellId).toBe('well-2');
    expect(interactionStore.interaction.lockedEntity).toEqual({
      type: 'casing',
      id: 1
    });
  });

  it('clears hierarchy selection when clearing all visual selections', () => {
    const workspaceStore = useWorkspaceStore(pinia);
    const interactionStore = useInteractionStore(pinia);

    workspaceStore.setSelectedHierarchyRef({
      wellId: 'well-1',
      entityType: 'casing',
      rowId: 'row-1'
    });
    interactionStore.updateInteraction({
      lockedEntity: { type: 'casing', id: 0 },
      hoveredEntity: { type: 'casing', id: 0 }
    });

    clearSelection('all');

    expect(interactionStore.interaction.lockedEntity).toBeNull();
    expect(interactionStore.interaction.hoveredEntity).toBeNull();
    expect(workspaceStore.selectedHierarchyRef).toBeNull();
  });
});
