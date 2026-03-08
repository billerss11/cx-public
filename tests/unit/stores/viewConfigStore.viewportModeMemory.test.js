import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';

describe('viewConfigStore viewport mode memory', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('restores the previous vertical viewport sizing after returning from directional mode', () => {
    const store = useViewConfigStore();

    store.updateConfig({
      figHeight: 950,
      canvasWidthMultiplier: 1.4,
      widthMultiplier: 4.5,
      lockAspectRatio: true
    });

    store.setViewMode('directional');
    store.updateConfig({
      figHeight: 1520,
      canvasWidthMultiplier: 1.9
    });

    store.setViewMode('vertical');

    expect(store.config.viewMode).toBe('vertical');
    expect(store.config.figHeight).toBe(950);
    expect(store.config.canvasWidthMultiplier).toBe(1.4);
    expect(store.config.widthMultiplier).toBe(4.5);
  });

  it('restores the last directional viewport sizing when switching back to directional mode again', () => {
    const store = useViewConfigStore();

    store.updateConfig({
      figHeight: 900,
      canvasWidthMultiplier: 1.2,
      lockAspectRatio: true
    });

    store.setViewMode('directional');
    store.updateConfig({
      figHeight: 1480,
      canvasWidthMultiplier: 1.7,
      xExaggeration: 0.65,
      directionalViewportFitMode: 'fill-width'
    });

    store.setViewMode('vertical');
    store.setViewMode('directional');

    expect(store.config.viewMode).toBe('directional');
    expect(store.config.figHeight).toBe(1480);
    expect(store.config.canvasWidthMultiplier).toBe(1.7);
    expect(store.config.xExaggeration).toBe(0.65);
    expect(store.config.directionalViewportFitMode).toBe('fill-width');
  });
});
