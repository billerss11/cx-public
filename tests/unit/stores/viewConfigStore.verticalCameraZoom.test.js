import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

describe('viewConfigStore vertical camera zoom controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('sets absolute zoom with clamping and ignores idempotent updates', () => {
    const store = useViewConfigStore();

    store.setVerticalCameraZoom(1.8);
    const snapshotAfterFirstUpdate = { ...store.uiState.verticalCamera };
    store.setVerticalCameraZoom(1.8);

    expect(store.uiState.verticalCamera.scale).toBe(1.8);
    expect(store.uiState.verticalCamera).toEqual(snapshotAfterFirstUpdate);

    store.setVerticalCameraZoom(999);
    expect(store.uiState.verticalCamera.scale).toBe(4);

    store.setVerticalCameraZoom(-999);
    expect(store.uiState.verticalCamera.scale).toBe(0.25);
  });

  it('applies delta zoom updates and keeps pan offsets intact', () => {
    const store = useViewConfigStore();

    store.setVerticalCameraPan({ translateX: 15, translateY: -6 });
    store.zoomVerticalCameraBy(0.5);
    store.zoomVerticalCameraBy(-0.25);

    expect(store.uiState.verticalCamera.scale).toBe(1.25);
    expect(store.uiState.verticalCamera.translateX).toBe(15);
    expect(store.uiState.verticalCamera.translateY).toBe(-6);
  });

  it('resets full vertical camera view back to identity', () => {
    const store = useViewConfigStore();

    store.setVerticalCameraPan({ translateX: 32, translateY: -20 });
    store.setVerticalCameraZoom(2.2);
    store.resetVerticalCameraView();

    expect(store.uiState.verticalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  });
});
