import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

describe('viewConfigStore directional camera pan controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes directional camera state with identity defaults', () => {
    const store = useViewConfigStore();

    expect(store.uiState.directionalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  });

  it('sets absolute directional pan values and ignores idempotent updates', () => {
    const store = useViewConfigStore();

    store.setDirectionalCameraPan({ translateX: -18, translateY: 42 });
    const snapshotAfterFirstUpdate = { ...store.uiState.directionalCamera };
    store.setDirectionalCameraPan({ translateX: -18, translateY: 42 });

    expect(store.uiState.directionalCamera.translateX).toBe(-18);
    expect(store.uiState.directionalCamera.translateY).toBe(42);
    expect(store.uiState.directionalCamera).toEqual(snapshotAfterFirstUpdate);
  });

  it('applies directional pan deltas and resets back to identity', () => {
    const store = useViewConfigStore();

    store.panDirectionalCameraBy(9, -3);
    store.panDirectionalCameraBy(-4, 10);

    expect(store.uiState.directionalCamera.translateX).toBe(5);
    expect(store.uiState.directionalCamera.translateY).toBe(7);

    store.resetDirectionalCameraPan();

    expect(store.uiState.directionalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  });

  it('ignores zero-value directional pan deltas', () => {
    const store = useViewConfigStore();

    store.setDirectionalCameraPan({ translateX: 11, translateY: 5 });
    store.panDirectionalCameraBy(0, 0);

    expect(store.uiState.directionalCamera.translateX).toBe(11);
    expect(store.uiState.directionalCamera.translateY).toBe(5);
  });
});
