import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { buildEquipmentAttachOptions } from '@/utils/equipmentAttachReference.js';

function createStore() {
  setActivePinia(createPinia());
  return useProjectDataStore();
}

describe('projectDataStore equipment attach normalization', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('normalizes legacy packer rows to an explicit tubing host when tubing overlaps depth', () => {
    const store = createStore();

    store.setCasingData([
      { rowId: 'csg-1', label: 'Surface Casing', top: 0, bottom: 3000, od: 9.625, weight: 40 }
    ]);
    store.setTubingData([
      { rowId: 'tbg-1', label: 'Production Tubing', top: 0, bottom: 2500, od: 4.5, weight: 12 }
    ]);

    store.setEquipmentData([
      { rowId: 'eq-legacy', type: 'Packer', depth: 1200, show: true }
    ]);

    const row = store.equipmentData[0];
    expect(row.attachToHostType).toBe('tubing');
    expect(row.attachToId).toBe('tbg-1');
    expect(typeof row.attachToDisplay).toBe('string');
    expect(row.attachToDisplay.startsWith('Tubing |')).toBe(true);
  });

  it('resolves attachToDisplay into stable attachToHostType and attachToId', () => {
    const store = createStore();

    store.setCasingData([
      { rowId: 'csg-1', label: 'Surface Casing', top: 0, bottom: 3000, od: 9.625, weight: 40 }
    ]);
    store.setTubingData([
      { rowId: 'tbg-1', label: 'Production Tubing', top: 0, bottom: 2500, od: 4.5, weight: 12 }
    ]);

    const attachOptions = buildEquipmentAttachOptions(store.casingData, store.tubingData);
    const casingOption = attachOptions.find((option) => option.hostType === 'casing' && option.rowId === 'csg-1');
    expect(casingOption).toBeDefined();

    store.setEquipmentData([
      {
        rowId: 'eq-display',
        type: 'Packer',
        depth: 800,
        attachToDisplay: casingOption.value,
        show: true
      }
    ]);

    const row = store.equipmentData[0];
    expect(row.attachToHostType).toBe('casing');
    expect(row.attachToId).toBe('csg-1');
  });

  it('hydrates canonical equipment fields alongside legacy compatibility fields', () => {
    const store = createStore();

    store.setEquipmentData([
      {
        rowId: 'eq-canonical',
        type: 'Safety Valve',
        depth: 900,
        state: {
          actuationState: 'closed',
          integrityStatus: 'intact'
        },
        properties: {
          boreSeal: 'true',
          annularSeal: '',
          sealByVolume: {
            TUBING_INNER: true
          }
        },
        show: true
      }
    ]);

    const row = store.equipmentData[0];
    expect(row.typeKey).toBe('safety-valve');
    expect(row.variantKey).toBeNull();
    expect(row.state).toEqual({
      actuationState: 'closed',
      integrityStatus: 'intact'
    });
    expect(row.properties).toEqual({
      boreSeal: 'true',
      annularSeal: '',
      sealByVolume: {
        TUBING_INNER: true
      }
    });
    expect(row.type).toBe('Safety Valve');
    expect(row.actuationState).toBe('closed');
    expect(row.boreSeal).toBe('true');
  });

  it('re-syncs equipment typeKey from the edited display type during full-row commits', () => {
    const store = createStore();

    store.setEquipmentData([
      {
        rowId: 'eq-edited',
        type: 'Safety Valve',
        typeKey: 'packer',
        depth: 900,
        show: true
      }
    ]);

    const row = store.equipmentData[0];
    expect(row.type).toBe('Safety Valve');
    expect(row.typeKey).toBe('safety-valve');
  });
});
