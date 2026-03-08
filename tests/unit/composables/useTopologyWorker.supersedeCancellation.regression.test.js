import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockWorker {
  static instances = [];

  static reset() {
    MockWorker.instances = [];
  }

  constructor() {
    this.terminated = false;
    this.postedMessages = [];
    this.listeners = {
      message: new Set(),
      error: new Set()
    };
    MockWorker.instances.push(this);
  }

  addEventListener(type, handler) {
    this.listeners[type]?.add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners[type]?.delete(handler);
  }

  postMessage(message) {
    this.postedMessages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emitMessage(payload) {
    this.listeners.message.forEach((handler) => handler({ data: payload }));
  }
}

describe('useTopologyWorker supersede cancellation contract (regression)', () => {
  let originalWorker;

  beforeEach(() => {
    vi.resetModules();
    MockWorker.reset();
    originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker;
  });

  afterEach(async () => {
    const module = await import('@/composables/useTopologyWorker.js');
    module.disposeTopologyWorker('test cleanup');

    if (originalWorker === undefined) {
      delete globalThis.Worker;
    } else {
      globalThis.Worker = originalWorker;
    }
  });

  it('terminates stale worker execution when superseding an in-flight topology request', async () => {
    const {
      requestTopologyModelInWorker,
      isTopologyWorkerCancelledError
    } = await import('@/composables/useTopologyWorker.js');

    const first = requestTopologyModelInWorker({ casingData: [] }, { wellId: 'well-1' });
    const firstWorker = MockWorker.instances[0];
    expect(firstWorker).toBeDefined();

    const second = requestTopologyModelInWorker({ casingData: [{ rowId: 'csg-2' }] }, { wellId: 'well-1' });

    const firstError = await first.promise.catch((error) => error);
    expect(isTopologyWorkerCancelledError(firstError)).toBe(true);

    const latestWorker = MockWorker.instances[MockWorker.instances.length - 1];
    latestWorker.emitMessage({
      requestId: second.requestId,
      status: 'success',
      result: { requestId: second.requestId, nodes: [], edges: [] }
    });

    await expect(second.promise).resolves.toMatchObject({
      requestId: second.requestId
    });

    // Expected contract: superseding should tear down the stale worker so old jobs cannot continue.
    expect(firstWorker.terminated).toBe(true);
    expect(MockWorker.instances.length).toBe(2);
  });
});
