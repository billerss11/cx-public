import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '@/stores/projectStore.js';
import { useSurfaceAssemblyStore } from '@/stores/surfaceAssemblyStore.js';

function setupStores() {
  const pinia = createPinia();
  setActivePinia(pinia);

  const projectStore = useProjectStore();
  projectStore.ensureInitialized();

  const surfaceAssemblyStore = useSurfaceAssemblyStore();

  return {
    projectStore,
    surfaceAssemblyStore,
  };
}

describe('surfaceAssemblyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('seeds a conventional wellhead draft when opening the composer without a committed assembly', () => {
    const { surfaceAssemblyStore } = setupStores();

    surfaceAssemblyStore.openComposer();

    expect(surfaceAssemblyStore.isComposerVisible).toBe(true);
    expect(surfaceAssemblyStore.committedAssemblyForActiveWell).toBe(null);
    expect(surfaceAssemblyStore.draftAssembly?.familyKey).toBe('conventional-wellhead-stack');
    expect(surfaceAssemblyStore.draftAssembly?.entryPaths.map((path) => path.roleKey)).toEqual(
      expect.arrayContaining(['TUBING_BORE', 'ANNULUS_A'])
    );
  });

  it('keeps committed assemblies isolated per well', () => {
    const { projectStore, surfaceAssemblyStore } = setupStores();
    const firstWellId = projectStore.activeWellId;

    surfaceAssemblyStore.openComposer();
    surfaceAssemblyStore.setDraftFamily('vertical-tree');
    surfaceAssemblyStore.applyDraft();

    const firstWellFamilyKey = surfaceAssemblyStore.committedAssemblyForActiveWell?.familyKey;

    const createResult = projectStore.createNewWell('Well 2');
    expect(createResult.ok).toBe(true);
    expect(surfaceAssemblyStore.committedAssemblyForActiveWell).toBe(null);

    surfaceAssemblyStore.openComposer();
    expect(surfaceAssemblyStore.draftAssembly?.familyKey).toBe('conventional-wellhead-stack');

    projectStore.setActiveWell(firstWellId);

    expect(surfaceAssemblyStore.committedAssemblyForActiveWell?.familyKey).toBe(firstWellFamilyKey);
  });
});
