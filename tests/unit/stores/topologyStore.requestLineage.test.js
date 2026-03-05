import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTopologyStore } from '@/stores/topologyStore.js';

function createStore() {
  setActivePinia(createPinia());
  return useTopologyStore();
}

describe('topologyStore request lineage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('tracks started and succeeded lifecycle with geometry metadata and result summary', () => {
    const store = createStore();

    store.setWellRequestStarted('well-1', 101, {
      geometryRequestId: 88,
      geometryReadyRequestId: null,
      viewMode: 'directional'
    });
    store.setWellTopologyResult('well-1', {
      requestId: 101,
      nodes: [{ nodeId: 'n1' }, { nodeId: 'n2' }],
      edges: [{ edgeId: 'e1' }],
      validationWarnings: [{ code: 'warning-1' }],
      sourceEntities: [{ sourceId: 'source-1' }]
    }, 101, {
      geometryReadyRequestId: 88
    });

    const wellEntry = store.getWellEntry('well-1');
    expect(Array.isArray(wellEntry?.requestLineage)).toBe(true);
    expect(wellEntry.requestLineage).toHaveLength(1);
    expect(wellEntry.requestLineage[0]).toMatchObject({
      requestId: 101,
      status: 'succeeded',
      geometryRequestId: 88,
      geometryReadyRequestId: 88,
      geometryStatus: 'ready',
      viewMode: 'directional',
      resultSummary: {
        nodeCount: 2,
        edgeCount: 1,
        warningCount: 1,
        sourceCount: 1
      }
    });
    expect(Array.isArray(wellEntry.requestLineage[0].events)).toBe(true);
    expect(wellEntry.requestLineage[0].events.map((event) => event.type)).toEqual([
      'request_started',
      'request_succeeded'
    ]);
    expect(typeof wellEntry.requestLineage[0].startedAt).toBe('string');
    expect(typeof wellEntry.requestLineage[0].completedAt).toBe('string');
  });

  it('records a geometry-ready event in directional request lineage', () => {
    const store = createStore();

    store.setWellRequestStarted('well-geometry', 401, {
      geometryRequestId: 401,
      geometryReadyRequestId: null,
      viewMode: 'directional'
    });
    store.setWellRequestGeometryReady('well-geometry', 401, 401);
    store.setWellTopologyResult('well-geometry', {
      requestId: 401,
      nodes: [{ nodeId: 'n1' }],
      edges: [],
      validationWarnings: [],
      sourceEntities: []
    }, 401);

    const record = store.getWellEntry('well-geometry')?.requestLineage?.[0];
    expect(record).toMatchObject({
      requestId: 401,
      status: 'succeeded',
      geometryRequestId: 401,
      geometryReadyRequestId: 401,
      geometryStatus: 'ready'
    });
    expect(record.events.map((event) => event.type)).toEqual([
      'request_started',
      'geometry_ready',
      'request_succeeded'
    ]);
  });

  it('tracks cancelled and failed request statuses independently', () => {
    const store = createStore();

    store.setWellRequestStarted('well-2', 201, { viewMode: 'vertical' });
    store.setWellRequestCancelled('well-2', 201);

    store.setWellRequestStarted('well-2', 202, { viewMode: 'vertical' });
    store.setWellTopologyError('well-2', new Error('worker failed'), 202);

    const lineage = store.getWellEntry('well-2')?.requestLineage ?? [];
    expect(lineage).toHaveLength(2);
    expect(lineage[0]).toMatchObject({
      requestId: 201,
      status: 'cancelled'
    });
    expect(lineage[1]).toMatchObject({
      requestId: 202,
      status: 'failed',
      error: 'worker failed'
    });
  });

  it('exports a stable lineage payload for replay/audit', () => {
    const store = createStore();

    store.setWellRequestStarted('well-3', 301, {
      geometryRequestId: 301,
      viewMode: 'vertical'
    });
    store.setWellTopologyResult('well-3', {
      requestId: 301,
      nodes: [{ nodeId: 'n1' }],
      edges: [{ edgeId: 'e1' }, { edgeId: 'e2' }],
      validationWarnings: [],
      sourceEntities: []
    }, 301);

    const exported = store.exportWellTopologyLineage('well-3');
    expect(exported).toMatchObject({
      wellId: 'well-3',
      latestRequestId: 301,
      loading: false,
      error: null,
      resultRequestId: 301
    });
    expect(exported.resultSummary).toMatchObject({
      nodeCount: 1,
      edgeCount: 2,
      warningCount: 0,
      sourceCount: 0
    });
    expect(Array.isArray(exported.requestLineage)).toBe(true);
    expect(exported.requestLineage).toHaveLength(1);
  });

  it('exports a multi-well topology audit bundle with lineage summary counts', () => {
    const store = createStore();

    store.setWellRequestStarted('well-a', 501, {
      geometryRequestId: 501,
      viewMode: 'vertical'
    });
    store.setWellTopologyResult('well-a', {
      requestId: 501,
      nodes: [{ nodeId: 'a1' }],
      edges: [],
      validationWarnings: [],
      sourceEntities: []
    }, 501);

    store.setWellRequestStarted('well-b', 601, {
      geometryRequestId: 601,
      geometryReadyRequestId: null,
      viewMode: 'directional'
    });
    store.setWellRequestCancelled('well-b', 601);

    const bundle = store.exportTopologyAuditBundle();
    expect(bundle).toMatchObject({
      schemaVersion: 'topology-request-lineage-v1'
    });
    expect(bundle.summary).toMatchObject({
      wellCount: 2,
      requestCount: 2,
      statusCounts: {
        started: 0,
        succeeded: 1,
        failed: 0,
        cancelled: 1
      },
      geometryStatusCounts: {
        not_required: 1,
        pending: 1,
        ready: 0,
        unknown: 0
      }
    });
    expect(Array.isArray(bundle.wells)).toBe(true);
    expect(bundle.wells).toHaveLength(2);

    const filtered = store.exportTopologyAuditBundle({ wellIds: ['well-b'] });
    expect(filtered.wells).toHaveLength(1);
    expect(filtered.wells[0].wellId).toBe('well-b');
    expect(filtered.summary).toMatchObject({
      wellCount: 1,
      requestCount: 1
    });
  });
});
