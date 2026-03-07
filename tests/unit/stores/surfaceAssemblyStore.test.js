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

  it('seeds a simple-tree draft when opening the composer without a committed assembly', () => {
    const { surfaceAssemblyStore } = setupStores();

    surfaceAssemblyStore.openComposer();

    expect(surfaceAssemblyStore.isComposerVisible).toBe(true);
    expect(surfaceAssemblyStore.committedAssemblyForActiveWell).toBe(null);
    expect(surfaceAssemblyStore.draftAssembly?.templateKey).toBe('simple-tree');
    expect(
      surfaceAssemblyStore.draftAssembly?.components.some((component) => component.typeKey === 'master-valve')
    ).toBe(true);
  });

  it('keeps committed assemblies isolated per well', () => {
    const { projectStore, surfaceAssemblyStore } = setupStores();
    const firstWellId = projectStore.activeWellId;

    surfaceAssemblyStore.openComposer();
    surfaceAssemblyStore.appendDraftTrunkComponent('spool');
    surfaceAssemblyStore.applyDraft();

    const firstWellComponentCount = surfaceAssemblyStore.committedAssemblyForActiveWell?.components.length;

    const createResult = projectStore.createNewWell('Well 2');
    expect(createResult.ok).toBe(true);
    expect(surfaceAssemblyStore.committedAssemblyForActiveWell).toBe(null);

    surfaceAssemblyStore.openComposer();
    expect(surfaceAssemblyStore.draftAssembly?.templateKey).toBe('simple-tree');

    projectStore.setActiveWell(firstWellId);

    expect(surfaceAssemblyStore.committedAssemblyForActiveWell?.components.length).toBe(firstWellComponentCount);
  });
});
