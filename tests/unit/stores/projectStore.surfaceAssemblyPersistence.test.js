import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore.js';
import { useSurfaceAssemblyStore } from '@/stores/surfaceAssemblyStore.js';

function createStores() {
  const pinia = createPinia();
  setActivePinia(pinia);

  const projectStore = useProjectStore();
  projectStore.ensureInitialized();

  const surfaceAssemblyStore = useSurfaceAssemblyStore();
  return {
    pinia,
    projectStore,
    surfaceAssemblyStore,
  };
}

describe('projectStore surface assembly persistence', () => {
  it('round-trips committed surface assemblies through project serialization and load', () => {
    const initial = createStores();

    initial.surfaceAssemblyStore.openComposer();
    initial.surfaceAssemblyStore.setDraftFamily('unitized-wellhead');
    initial.surfaceAssemblyStore.setDraftTerminationType('productionOutlet', 'flowline');
    initial.surfaceAssemblyStore.applyDraft();

    const payload = initial.projectStore.serializeProjectPayload({
      timestamp: '2026-03-08T10:00:00.000Z',
    });

    const reloaded = createStores();
    reloaded.projectStore.loadProject(payload);

    expect(reloaded.surfaceAssemblyStore.committedAssemblyForActiveWell?.familyKey).toBe('unitized-wellhead');
    expect(
      reloaded.surfaceAssemblyStore.committedAssemblyForActiveWell?.terminations.find(
        (termination) => termination.slotKey === 'productionOutlet'
      )?.typeKey
    ).toBe('flowline');
  });
});
