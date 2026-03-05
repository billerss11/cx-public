import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  runMock,
  cancelInFlightMock
} = vi.hoisted(() => ({
  runMock: vi.fn(),
  cancelInFlightMock: vi.fn()
}));

vi.mock('@/composables/workerRequestClient.js', () => ({
  createWorkerRequestClient: () => ({
    run: runMock,
    cancelInFlight: cancelInFlightMock
  }),
  isWorkerRequestCancelledError: (error) => Boolean(error?.__cancelled === true)
}));

import {
  buildDirectionalRenderModelInWorker,
  buildVerticalRenderModelInWorker,
  cancelRenderModelWorkerJobs,
  isRenderModelWorkerCancelledError
} from '@/composables/useRenderModelWorker.js';

describe('useRenderModelWorker camera request routing', () => {
  beforeEach(() => {
    runMock.mockReset();
    cancelInFlightMock.mockReset();
    runMock.mockResolvedValue({ ok: true });
  });

  it('submits directional worker jobs using the directional request key', async () => {
    const snapshot = { config: { viewMode: 'directional' } };

    await buildDirectionalRenderModelInWorker(snapshot);

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledWith('build-directional-render-model', { stateSnapshot: snapshot });
  });

  it('submits vertical worker jobs using the vertical request key', async () => {
    const snapshot = { config: { viewMode: 'vertical' } };

    await buildVerticalRenderModelInWorker(snapshot);

    expect(runMock).toHaveBeenCalledWith('build-vertical-render-model', { stateSnapshot: snapshot });
  });

  it('delegates cancel and cancelled error checks to worker client utilities', () => {
    cancelRenderModelWorkerJobs();
    expect(cancelInFlightMock).toHaveBeenCalledTimes(1);

    expect(isRenderModelWorkerCancelledError({ __cancelled: true })).toBe(true);
    expect(isRenderModelWorkerCancelledError({ __cancelled: false })).toBe(false);
  });
});
