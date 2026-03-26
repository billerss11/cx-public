import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectDataStore } from '@/stores/projectDataStore.js';

function createStore() {
  setActivePinia(createPinia());
  return useProjectDataStore();
}

describe('projectDataStore reference horizon directional sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('hydrates missing directional md/tvd pair from legacy horizon depth', () => {
    const store = createStore();

    store.setTrajectory([
      { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
      { rowId: 'traj-2', md: 1000, inc: 0, azi: 0 }
    ]);
    store.setHorizontalLines([
      { rowId: 'line-1', depth: 500, label: 'Landing', show: true }
    ]);

    expect(store.horizontalLines[0]).toMatchObject({
      depth: 500,
      directionalDepthMd: 500,
      directionalDepthTvd: 500,
      directionalDepthMode: 'tvd'
    });
  });

  it('syncs md pair fields when directional tvd is edited directly', () => {
    const store = createStore();

    store.setTrajectory([
      { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
      { rowId: 'traj-2', md: 2000, inc: 0, azi: 0 }
    ]);
    store.setHorizontalLines([
      {
        rowId: 'line-1',
        depth: 1000,
        directionalDepthMd: 1000,
        directionalDepthTvd: 1000,
        label: 'Landing',
        show: true
      }
    ]);

    store.updateProjectRow('horizontalLines', 0, { directionalDepthTvd: 1500 });

    expect(store.horizontalLines[0].directionalDepthMd).toBeCloseTo(1500, 3);
    expect(store.horizontalLines[0].depth).toBeCloseTo(1500, 3);
    expect(store.horizontalLines[0].directionalDepthTvd).toBeCloseTo(1500, 3);
    expect(store.horizontalLines[0].directionalDepthMode).toBe('tvd');
  });

  it('resyncs stored directional tvd values when trajectory changes', () => {
    const store = createStore();

    store.setTrajectory([
      { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
      { rowId: 'traj-2', md: 1000, inc: 0, azi: 0 }
    ]);
    store.setHorizontalLines([
      { rowId: 'line-1', depth: 500, directionalDepthMd: 500, directionalDepthTvd: 500, label: 'Landing', show: true }
    ]);

    store.setTrajectory([
      { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
      { rowId: 'traj-2', md: 1000, inc: 60, azi: 90 }
    ]);

    expect(store.horizontalLines[0].directionalDepthMd).toBe(500);
    expect(store.horizontalLines[0].directionalDepthTvd).not.toBe(500);
    expect(store.horizontalLines[0].directionalDepthMode).toBe('tvd');
  });
});
