import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

describe('workspaceStore left dock state', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('persists left dock visibility and width', () => {
    const store = useWorkspaceStore();
    store.setLeftDockVisibility(false);
    store.setLeftDockWidth(320);

    setActivePinia(createPinia());
    const reloadedStore = useWorkspaceStore();

    expect(reloadedStore.leftDockVisible).toBe(false);
    expect(reloadedStore.leftDockWidth).toBe(320);
  });
});
