import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

describe('viewConfigStore camera migration flags contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes camera flags and fit request counter with safe defaults', () => {
    const store = useViewConfigStore();

    expect(store.uiState.useCameraTransform).toBe(false);
    expect(store.uiState.cameraTransformVertical).toBe(false);
    expect(store.uiState.cameraTransformDirectional).toBe(false);
    expect(store.uiState.directionalFitToDataRequestCount).toBe(0);
  });

  it('updates camera flags and ignores idempotent updates', () => {
    const store = useViewConfigStore();

    store.setUseCameraTransform(true);
    store.setUseCameraTransform(true);
    store.setCameraTransformVertical(true);
    store.setCameraTransformDirectional(true);

    expect(store.uiState.useCameraTransform).toBe(true);
    expect(store.uiState.cameraTransformVertical).toBe(true);
    expect(store.uiState.cameraTransformDirectional).toBe(true);
  });

  it('tracks directional fit-to-data requests with normalized deltas', () => {
    const store = useViewConfigStore();

    store.requestDirectionalFitToData();
    store.requestDirectionalFitToData(2);
    store.requestDirectionalFitToData(1.6);
    store.requestDirectionalFitToData(-1);

    expect(store.uiState.directionalFitToDataRequestCount).toBe(5);
  });
});
