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

  it('initializes directional label scale with a persisted default and setter contract', () => {
    const store = useViewConfigStore();

    expect(store.config.directionalLabelScale).toBe(1);
    expect(store.setDirectionalLabelScale).toBeTypeOf('function');

    store.setDirectionalLabelScale(1.35);
    expect(store.config.directionalLabelScale).toBe(1.35);
  });

  it('initializes directional viewport fit mode with a persisted default and normalized setter contract', () => {
    const store = useViewConfigStore();

    expect(store.config.directionalViewportFitMode).toBe('contain');
    expect(store.setDirectionalViewportFitMode).toBeTypeOf('function');

    store.setDirectionalViewportFitMode('fill-width');
    expect(store.config.directionalViewportFitMode).toBe('fill-width');

    store.setDirectionalViewportFitMode('invalid-mode-token');
    expect(store.config.directionalViewportFitMode).toBe('contain');
  });

  it('normalizes directional viewport fit mode during patch updates', () => {
    const store = useViewConfigStore();

    store.updateConfig({ directionalViewportFitMode: 'fill-width' });
    expect(store.config.directionalViewportFitMode).toBe('fill-width');

    store.updateConfig({ directionalViewportFitMode: 'not-supported' });
    expect(store.config.directionalViewportFitMode).toBe('contain');
  });

  it('initializes vertical label scale with a persisted default and setter contract', () => {
    const store = useViewConfigStore();

    expect(store.config.verticalLabelScale).toBe(1);
    expect(store.setVerticalLabelScale).toBeTypeOf('function');

    store.setVerticalLabelScale(2.25);
    expect(store.config.verticalLabelScale).toBe(2.25);
    store.setVerticalLabelScale(5);
    expect(store.config.verticalLabelScale).toBe(3);
  });

  it('enables smart labels by default with a persisted setter contract', () => {
    const store = useViewConfigStore();

    expect(store.config.smartLabelsEnabled).toBe(true);
    expect(store.setSmartLabelsEnabled).toBeTypeOf('function');

    store.setSmartLabelsEnabled(false);
    expect(store.config.smartLabelsEnabled).toBe(false);
  });

  it('normalizes smart label hydration values without breaking existing projects', () => {
    const store = useViewConfigStore();

    store.updateConfig({ smartLabelsEnabled: false });
    expect(store.config.smartLabelsEnabled).toBe(false);

    store.updateConfig({ smartLabelsEnabled: undefined });
    expect(store.config.smartLabelsEnabled).toBe(false);

    store.updateConfig({ smartLabelsEnabled: null });
    expect(store.config.smartLabelsEnabled).toBe(false);

    store.updateConfig({ smartLabelsEnabled: true });
    expect(store.config.smartLabelsEnabled).toBe(true);
  });
});
