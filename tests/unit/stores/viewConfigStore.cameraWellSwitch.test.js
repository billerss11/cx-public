import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

describe('viewConfigStore camera well-switch reset behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('resets both vertical and directional camera views to identity', () => {
    const store = useViewConfigStore();

    store.setVerticalCameraZoom(1.8);
    store.setVerticalCameraPan({ translateX: 50, translateY: -25 });
    store.setDirectionalCameraZoom(2.2);
    store.setDirectionalCameraPan({ translateX: -40, translateY: 16 });

    store.resetCameraViewsForWellSwitch();

    expect(store.uiState.verticalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
    expect(store.uiState.directionalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  });

  it('preserves camera feature flags while resetting camera values', () => {
    const store = useViewConfigStore();

    store.setUseCameraTransform(true);
    store.setCameraTransformVertical(true);
    store.setCameraTransformDirectional(true);
    store.setVerticalCameraZoom(1.5);
    store.setVerticalCameraPan({ translateX: 10, translateY: 12 });
    store.setDirectionalCameraZoom(2.5);
    store.setDirectionalCameraPan({ translateX: -8, translateY: 30 });

    store.resetCameraViewsForWellSwitch();

    expect(store.uiState.useCameraTransform).toBe(true);
    expect(store.uiState.cameraTransformVertical).toBe(true);
    expect(store.uiState.cameraTransformDirectional).toBe(true);
    expect(store.uiState.verticalCamera.scale).toBe(1);
    expect(store.uiState.directionalCamera.scale).toBe(1);
  });
});
