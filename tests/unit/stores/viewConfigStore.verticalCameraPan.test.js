import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

describe('viewConfigStore vertical camera pan controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes vertical camera state with identity defaults', () => {
    const store = useViewConfigStore();

    expect(store.uiState.verticalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  });

  it('sets absolute pan values and ignores idempotent updates', () => {
    const store = useViewConfigStore();

    store.setVerticalCameraPan({ translateX: 30, translateY: -12 });
    const snapshotAfterFirstUpdate = { ...store.uiState.verticalCamera };
    store.setVerticalCameraPan({ translateX: 30, translateY: -12 });

    expect(store.uiState.verticalCamera.translateX).toBe(30);
    expect(store.uiState.verticalCamera.translateY).toBe(-12);
    expect(store.uiState.verticalCamera).toEqual(snapshotAfterFirstUpdate);
  });

  it('applies pan deltas and resets back to identity', () => {
    const store = useViewConfigStore();

    store.panVerticalCameraBy(12, -5);
    store.panVerticalCameraBy(-2, 8);

    expect(store.uiState.verticalCamera.translateX).toBe(10);
    expect(store.uiState.verticalCamera.translateY).toBe(3);

    store.resetVerticalCameraPan();

    expect(store.uiState.verticalCamera).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0
    });
  });
});
