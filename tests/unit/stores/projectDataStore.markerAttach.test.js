import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { buildPipeReferenceOptions, PIPE_HOST_TYPE_CASING, PIPE_HOST_TYPE_TUBING } from '@/utils/pipeReference.js';

function createStore() {
  setActivePinia(createPinia());
  return useProjectDataStore();
}

describe('projectDataStore marker attach normalization', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('treats attachToRow as source-of-truth when stale attachToId points at another casing', () => {
    const store = createStore();

    store.setCasingData([
      { rowId: 'csg-1', label: 'Conductor', top: 0, bottom: 2000, od: 20, weight: 94 },
      { rowId: 'csg-2', label: 'Intermediate', top: 0, bottom: 9000, od: 9.625, weight: 40 }
    ]);

    const casingOptions = buildPipeReferenceOptions(store.casingData, PIPE_HOST_TYPE_CASING);
    expect(casingOptions).toHaveLength(2);

    store.setMarkers([
      {
        rowId: 'm-casing',
        top: 6500,
        bottom: 6500,
        type: 'Leak',
        attachToHostType: PIPE_HOST_TYPE_CASING,
        attachToRow: casingOptions[1],
        attachToId: 'csg-1',
        show: true
      }
    ]);

    expect(store.markers[0].attachToId).toBe('csg-2');
  });

  it('treats attachToRow as source-of-truth when stale attachToId points at another tubing row', () => {
    const store = createStore();

    store.setTubingData([
      { rowId: 'tbg-1', label: 'Primary Tubing', top: 0, bottom: 12000, od: 4.5, weight: 12 },
      { rowId: 'tbg-2', label: 'Inner Tubing', top: 0, bottom: 9000, od: 2.875, weight: 6.5 }
    ]);

    const tubingOptions = buildPipeReferenceOptions(store.tubingData, PIPE_HOST_TYPE_TUBING);
    expect(tubingOptions).toHaveLength(2);

    store.setMarkers([
      {
        rowId: 'm-tubing',
        top: 5000,
        bottom: 5000,
        type: 'Leak',
        attachToHostType: PIPE_HOST_TYPE_TUBING,
        attachToRow: tubingOptions[1],
        attachToId: 'tbg-1',
        show: true
      }
    ]);

    expect(store.markers[0].attachToId).toBe('tbg-2');
  });
});