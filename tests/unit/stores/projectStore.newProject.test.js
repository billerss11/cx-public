import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

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
    surfacePaths: [],
    surfaceTransfers: [],
    surfaceOutlets: [],
    surfaceTemplate: {},
    trajectory: [],
    ...overrides
  };
}

describe('projectStore blank project creation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('creates a blank project with one blank well and clears file context', () => {
    const projectStore = useProjectStore();
    const viewConfigStore = useViewConfigStore();

    projectStore.loadProject({
      projectSchemaVersion: '3.0',
      projectName: 'Existing Project',
      projectAuthor: 'Existing Author',
      activeWellId: 'well-1',
      projectConfig: { defaultUnits: 'ft' },
      wells: [
        {
          id: 'well-1',
          name: 'Existing Well',
          data: createWellData({
            casingData: [{ top: 0, bottom: 1000, od: 9.625 }]
          }),
          config: {
            viewMode: 'directional'
          }
        },
        {
          id: 'well-2',
          name: 'Second Well',
          data: createWellData(),
          config: {}
        }
      ]
    });
    projectStore.setProjectFileContext({
      filePath: 'C:\\temp\\existing-project.json',
      fileName: 'existing-project.json'
    });
    viewConfigStore.setUseCameraTransform(true);
    viewConfigStore.setCameraTransformVertical(true);
    viewConfigStore.setCameraTransformDirectional(true);
    viewConfigStore.setVerticalCameraZoom(1.8);
    viewConfigStore.setVerticalCameraPan({ translateX: 25, translateY: -10 });
    viewConfigStore.setDirectionalCameraZoom(2.1);
    viewConfigStore.setDirectionalCameraPan({ translateX: -30, translateY: 14 });

    const result = projectStore.createBlankProject();

    expect(result?.ok).toBe(true);
    expect(projectStore.projectName).toBe('Project');
    expect(projectStore.projectAuthor).toBe('');
    expect(projectStore.wells).toHaveLength(1);
    expect(projectStore.activeWellId).toBe(projectStore.wells[0].id);
    expect(projectStore.activeWell?.name).toBe('Well 1');
    expect(projectStore.projectFilePath).toBe(null);
    expect(projectStore.projectFileName).toBe('');
    expect(projectStore.hasUnsavedChanges).toBe(true);
    expect(projectStore.activeWell?.data).toEqual(createWellData());
    expect(viewConfigStore.uiState.verticalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
    expect(viewConfigStore.uiState.directionalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  });
});
