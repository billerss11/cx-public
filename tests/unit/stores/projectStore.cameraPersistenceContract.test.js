import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

function createWellData() {
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
    trajectory: []
  };
}

const CAMERA_UI_STATE_KEYS = [
  'useCameraTransform',
  'cameraTransformVertical',
  'cameraTransformDirectional',
  'directionalFitToDataRequestCount',
  'verticalCamera',
  'directionalCamera'
];

describe('projectStore camera persistence contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('keeps camera ui-state transient when syncing active well and serializing project payload', () => {
    const projectStore = useProjectStore();
    const viewConfigStore = useViewConfigStore();

    projectStore.ensureInitialized();

    viewConfigStore.setUseCameraTransform(true);
    viewConfigStore.setCameraTransformVertical(true);
    viewConfigStore.setCameraTransformDirectional(true);
    viewConfigStore.setVerticalCameraZoom(1.7);
    viewConfigStore.setVerticalCameraPan({ translateX: 42, translateY: -18 });
    viewConfigStore.setDirectionalCameraZoom(2.1);
    viewConfigStore.setDirectionalCameraPan({ translateX: -36, translateY: 24 });
    viewConfigStore.requestDirectionalFitToData();

    const synced = projectStore.syncActiveWellData();
    expect(synced).toBe(true);

    const activeWellConfig = projectStore.activeWell?.config ?? {};
    CAMERA_UI_STATE_KEYS.forEach((key) => {
      expect(activeWellConfig).not.toHaveProperty(key);
    });

    const payload = projectStore.serializeProjectPayload();
    expect(Array.isArray(payload.wells)).toBe(true);
    expect(payload.wells).toHaveLength(1);

    const payloadConfig = payload.wells[0]?.config ?? {};
    CAMERA_UI_STATE_KEYS.forEach((key) => {
      expect(payloadConfig).not.toHaveProperty(key);
    });
    expect(payloadConfig).toHaveProperty('viewMode');
  });

  it('resets camera views when switching active well through project store action', () => {
    const projectStore = useProjectStore();
    const viewConfigStore = useViewConfigStore();

    projectStore.loadProject({
      projectSchemaVersion: '3.0',
      projectName: 'Camera Switch Contract',
      projectAuthor: '',
      activeWellId: 'well-1',
      projectConfig: { defaultUnits: 'ft' },
      wells: [
        { id: 'well-1', name: 'Well 1', data: createWellData(), config: {} },
        { id: 'well-2', name: 'Well 2', data: createWellData(), config: {} }
      ]
    });

    viewConfigStore.setUseCameraTransform(true);
    viewConfigStore.setCameraTransformVertical(true);
    viewConfigStore.setCameraTransformDirectional(true);
    viewConfigStore.setVerticalCameraZoom(1.8);
    viewConfigStore.setVerticalCameraPan({ translateX: 20, translateY: -12 });
    viewConfigStore.setDirectionalCameraZoom(2.4);
    viewConfigStore.setDirectionalCameraPan({ translateX: -28, translateY: 14 });

    const changed = projectStore.setActiveWell('well-2');
    expect(changed).toBe(true);
    expect(projectStore.activeWellId).toBe('well-2');

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
    expect(viewConfigStore.uiState.useCameraTransform).toBe(true);
    expect(viewConfigStore.uiState.cameraTransformVertical).toBe(true);
    expect(viewConfigStore.uiState.cameraTransformDirectional).toBe(true);
  });

  it('resets camera views when loading a project payload', () => {
    const projectStore = useProjectStore();
    const viewConfigStore = useViewConfigStore();

    projectStore.ensureInitialized();

    viewConfigStore.setUseCameraTransform(true);
    viewConfigStore.setCameraTransformVertical(true);
    viewConfigStore.setCameraTransformDirectional(true);
    viewConfigStore.setVerticalCameraZoom(2.2);
    viewConfigStore.setVerticalCameraPan({ translateX: 60, translateY: -20 });
    viewConfigStore.setDirectionalCameraZoom(1.6);
    viewConfigStore.setDirectionalCameraPan({ translateX: -14, translateY: 32 });

    projectStore.loadProject({
      projectSchemaVersion: '3.0',
      projectName: 'Imported Camera Reset Contract',
      projectAuthor: '',
      activeWellId: 'well-import-1',
      projectConfig: { defaultUnits: 'ft' },
      wells: [
        { id: 'well-import-1', name: 'Imported Well', data: createWellData(), config: {} }
      ]
    });

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
    expect(viewConfigStore.uiState.useCameraTransform).toBe(true);
    expect(viewConfigStore.uiState.cameraTransformVertical).toBe(true);
    expect(viewConfigStore.uiState.cameraTransformDirectional).toBe(true);
  });

  it('resets camera views when replacing active well content', () => {
    const projectStore = useProjectStore();
    const viewConfigStore = useViewConfigStore();

    projectStore.ensureInitialized();

    viewConfigStore.setUseCameraTransform(true);
    viewConfigStore.setCameraTransformVertical(true);
    viewConfigStore.setCameraTransformDirectional(true);
    viewConfigStore.setVerticalCameraZoom(1.9);
    viewConfigStore.setVerticalCameraPan({ translateX: 44, translateY: -11 });
    viewConfigStore.setDirectionalCameraZoom(2.6);
    viewConfigStore.setDirectionalCameraPan({ translateX: -22, translateY: 19 });

    const replaced = projectStore.replaceActiveWellContent(
      { data: createWellData(), config: {} },
      { requestRender: false }
    );
    expect(replaced).toBe(true);

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
    expect(viewConfigStore.uiState.useCameraTransform).toBe(true);
    expect(viewConfigStore.uiState.cameraTransformVertical).toBe(true);
    expect(viewConfigStore.uiState.cameraTransformDirectional).toBe(true);
  });
});
