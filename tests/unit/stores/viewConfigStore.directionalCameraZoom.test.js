import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

describe('viewConfigStore directional camera zoom controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('sets absolute directional zoom with clamping and ignores idempotent updates', () => {
    const store = useViewConfigStore();

    store.setDirectionalCameraZoom(1.7);
    const snapshotAfterFirstUpdate = { ...store.uiState.directionalCamera };
    store.setDirectionalCameraZoom(1.7);

    expect(store.uiState.directionalCamera.scale).toBe(1.7);
    expect(store.uiState.directionalCamera).toEqual(snapshotAfterFirstUpdate);

    store.setDirectionalCameraZoom(999);
    expect(store.uiState.directionalCamera.scale).toBe(4);

    store.setDirectionalCameraZoom(-999);
    expect(store.uiState.directionalCamera.scale).toBe(0.25);
  });

  it('applies directional delta-zoom updates and keeps pan offsets intact', () => {
    const store = useViewConfigStore();

    store.setDirectionalCameraPan({ translateX: 12, translateY: -8 });
    store.zoomDirectionalCameraBy(0.5);
    store.zoomDirectionalCameraBy(-0.25);

    expect(store.uiState.directionalCamera.scale).toBe(1.25);
    expect(store.uiState.directionalCamera.translateX).toBe(12);
    expect(store.uiState.directionalCamera.translateY).toBe(-8);
  });

  it('resets directional pan without mutating zoom and supports full-view reset', () => {
    const store = useViewConfigStore();

    store.setDirectionalCameraZoom(2.2);
    store.setDirectionalCameraPan({ translateX: 20, translateY: -6 });
    store.resetDirectionalCameraPan();

    expect(store.uiState.directionalCamera).toEqual({
      scale: 2.2,
      translateX: 0,
      translateY: 0
    });

    store.resetDirectionalCameraView();

    expect(store.uiState.directionalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  });
});
