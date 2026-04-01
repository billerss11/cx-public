import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectDataStore } from '@/stores/projectDataStore.js';

function createStore() {
  setActivePinia(createPinia());
  return useProjectDataStore();
}

describe('projectDataStore annotation box directional sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('hydrates missing directional md/tvd pairs from legacy interval depths', () => {
    const store = createStore();

    store.setTrajectory([
      { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
      { rowId: 'traj-2', md: 1000, inc: 0, azi: 0 }
    ]);
    store.setProjectData('annotationBoxes', [
      { rowId: 'box-1', topDepth: 100, bottomDepth: 250, label: 'Zone', detail: 'Notes', show: true }
    ]);

    expect(store.annotationBoxes[0]).toMatchObject({
      topDepth: 100,
      bottomDepth: 250,
      directionalTopDepthMd: 100,
      directionalBottomDepthMd: 250,
      directionalTopDepthTvd: 100,
      directionalBottomDepthTvd: 250,
      directionalDepthMode: 'md'
    });
  });

  it('syncs md pair fields when directional interval tvd is edited directly', () => {
    const store = createStore();

    store.setTrajectory([
      { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
      { rowId: 'traj-2', md: 2000, inc: 0, azi: 0 }
    ]);
    store.setProjectData('annotationBoxes', [
      {
        rowId: 'box-1',
        topDepth: 400,
        bottomDepth: 800,
        directionalTopDepthMd: 400,
        directionalBottomDepthMd: 800,
        directionalTopDepthTvd: 400,
        directionalBottomDepthTvd: 800,
        label: 'Zone',
        detail: 'Notes',
        show: true
      }
    ]);

    store.updateProjectRow('annotationBoxes', 0, {
      directionalTopDepthTvd: 500,
      directionalBottomDepthTvd: 900
    });

    expect(store.annotationBoxes[0]).toMatchObject({
      directionalTopDepthMd: 500,
      directionalBottomDepthMd: 900,
      topDepth: 500,
      bottomDepth: 900,
      directionalTopDepthTvd: 500,
      directionalBottomDepthTvd: 900,
      directionalDepthMode: 'tvd'
    });
  });

  it('resyncs stored directional interval tvd values when trajectory changes', () => {
    const store = createStore();

    store.setTrajectory([
      { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
      { rowId: 'traj-2', md: 1000, inc: 0, azi: 0 }
    ]);
    store.setProjectData('annotationBoxes', [
      {
        rowId: 'box-1',
        topDepth: 200,
        bottomDepth: 400,
        directionalTopDepthMd: 200,
        directionalBottomDepthMd: 400,
        directionalTopDepthTvd: 200,
        directionalBottomDepthTvd: 400,
        label: 'Zone',
        detail: 'Notes',
        show: true
      }
    ]);

    store.setTrajectory([
      { rowId: 'traj-1', md: 0, inc: 0, azi: 0 },
      { rowId: 'traj-2', md: 1000, inc: 60, azi: 90 }
    ]);

    expect(store.annotationBoxes[0].directionalTopDepthMd).toBe(200);
    expect(store.annotationBoxes[0].directionalBottomDepthMd).toBe(400);
    expect(store.annotationBoxes[0].directionalTopDepthTvd).not.toBe(200);
    expect(store.annotationBoxes[0].directionalBottomDepthTvd).not.toBe(400);
  });
});
