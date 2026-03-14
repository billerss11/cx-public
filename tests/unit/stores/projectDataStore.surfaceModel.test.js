import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectDataStore } from '@/stores/projectDataStore.js';

function createStore() {
  setActivePinia(createPinia());
  return useProjectDataStore();
}

describe('projectDataStore surface communication model', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes surface communication state with empty collections', () => {
    const store = createStore();

    expect(store.surfacePaths).toEqual([]);
    expect(store.surfaceTransfers).toEqual([]);
    expect(store.surfaceOutlets).toEqual([]);
    expect(store.surfaceTemplate).toEqual({});
  });

  it('assigns stable row ids for surface paths and nested path items', () => {
    const store = createStore();

    store.setProjectData('surfacePaths', [
      {
        channelKey: 'TUBING_INNER',
        label: 'Tubing Path',
        show: true,
        items: [
          {
            itemType: 'barrier',
            label: 'Lower Master Valve',
            state: {
              actuationState: 'open',
              integrityStatus: 'intact'
            },
            show: true
          }
        ]
      }
    ]);

    expect(store.surfacePaths).toHaveLength(1);
    expect(store.surfacePaths[0].rowId).toMatch(/^surface-path-/);
    expect(store.surfacePaths[0].items).toHaveLength(1);
    expect(store.surfacePaths[0].items[0].rowId).toMatch(/^surface-path-item-/);
  });

  it('assigns stable row ids for transfers and outlets and stores surface template metadata', () => {
    const store = createStore();

    store.setProjectData('surfaceTransfers', [
      {
        transferType: 'crossover',
        label: 'Tubing to A',
        fromChannelKey: 'TUBING_INNER',
        toChannelKey: 'ANNULUS_A',
        direction: 'forward',
        show: true
      }
    ]);
    store.setProjectData('surfaceOutlets', [
      {
        outletKey: 'production-outlet',
        label: 'Production Outlet',
        channelKey: 'TUBING_INNER',
        kind: 'production',
        show: true
      }
    ]);
    store.setSurfaceTemplate({
      templateKey: 'standard-production-tree',
      label: 'Standard Production Tree'
    });

    expect(store.surfaceTransfers[0].rowId).toMatch(/^surface-transfer-/);
    expect(store.surfaceOutlets[0].rowId).toMatch(/^surface-outlet-/);
    expect(store.surfaceTemplate).toEqual({
      templateKey: 'standard-production-tree',
      label: 'Standard Production Tree'
    });
  });
});
