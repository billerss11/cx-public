import { describe, expect, it } from 'vitest';
import {
  buildTopologyAuditReplayRows,
  buildTopologyAuditReplaySummary,
  resolveTopologyAuditReplayRequest
} from '@/topology/requestLineageReplay.js';

const AUDIT_BUNDLE_FIXTURE = Object.freeze({
  schemaVersion: 'topology-request-lineage-v1',
  exportedAt: '2026-02-28T08:05:00.000Z',
  activeWellId: 'well-b',
  wells: [
    {
      wellId: 'well-a',
      requestLineage: [
        {
          requestId: 101,
          status: 'succeeded',
          viewMode: 'directional',
          geometryStatus: 'ready',
          startedAt: '2026-02-28T08:00:00.000Z',
          completedAt: '2026-02-28T08:00:02.000Z',
          events: [
            { type: 'request_succeeded', at: '2026-02-28T08:00:02.000Z' },
            { type: 'geometry_ready', at: '2026-02-28T08:00:01.000Z' },
            { type: 'request_started', at: '2026-02-28T08:00:00.000Z' }
          ]
        },
        {
          requestId: 102,
          status: 'failed',
          viewMode: 'vertical',
          geometryStatus: 'not_required',
          startedAt: '2026-02-28T08:01:00.000Z',
          completedAt: '2026-02-28T08:01:02.000Z',
          events: []
        }
      ]
    },
    {
      wellId: 'well-b',
      requestLineage: [
        {
          requestId: 201,
          status: 'succeeded',
          viewMode: 'directional',
          geometryStatus: 'pending',
          startedAt: '2026-02-28T08:02:00.000Z',
          completedAt: '2026-02-28T08:02:03.000Z',
          events: [
            { type: 'request_started', at: '2026-02-28T08:02:00.000Z' },
            { type: 'request_succeeded', at: '2026-02-28T08:02:03.000Z' }
          ]
        },
        {
          requestId: 202,
          status: 'cancelled',
          viewMode: 'vertical',
          geometryStatus: 'not_required',
          startedAt: '2026-02-28T08:03:00.000Z',
          completedAt: '2026-02-28T08:03:01.000Z',
          events: [
            { type: 'request_cancelled', at: '2026-02-28T08:03:01.000Z' }
          ]
        }
      ]
    }
  ]
});

describe('requestLineageReplay', () => {
  it('builds sorted replay rows and falls back for legacy records without events', () => {
    const rows = buildTopologyAuditReplayRows(AUDIT_BUNDLE_FIXTURE);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({
      wellId: 'well-a',
      requestId: 101,
      eventType: 'request_started',
      eventAt: '2026-02-28T08:00:00.000Z'
    });
    expect(rows[rows.length - 1]).toMatchObject({
      wellId: 'well-b',
      requestId: 202,
      eventType: 'request_cancelled',
      eventAt: '2026-02-28T08:03:01.000Z'
    });

    const fallbackRows = rows.filter((row) => row.wellId === 'well-a' && row.requestId === 102);
    expect(fallbackRows.map((row) => row.eventType)).toEqual([
      'request_started',
      'request_failed'
    ]);
  });

  it('summarizes replay counts and anomaly signals', () => {
    const summary = buildTopologyAuditReplaySummary(AUDIT_BUNDLE_FIXTURE);
    expect(summary).toMatchObject({
      wellCount: 2,
      requestCount: 4,
      eventCount: 8,
      requestStatusCounts: {
        started: 0,
        succeeded: 2,
        failed: 1,
        cancelled: 1
      },
      eventTypeCounts: {
        request_started: 3,
        geometry_ready: 1,
        request_succeeded: 2,
        request_failed: 1,
        request_cancelled: 1
      },
      anomalyCounts: {
        outOfOrderEventCount: 1,
        missingStartEventCount: 1,
        missingTerminalEventCount: 0,
        directionalSucceededWithoutGeometryReadyCount: 1
      }
    });
  });

  it('resolves replay timeline for a specific request and supports well filtering', () => {
    const requestReplay = resolveTopologyAuditReplayRequest(AUDIT_BUNDLE_FIXTURE, 'well-a', 101);
    expect(requestReplay).toMatchObject({
      wellId: 'well-a',
      requestId: 101,
      status: 'succeeded',
      viewMode: 'directional',
      hasStartEvent: true,
      hasTerminalEvent: true
    });
    expect(requestReplay.events.map((event) => event.type)).toEqual([
      'request_started',
      'geometry_ready',
      'request_succeeded'
    ]);

    const filteredRows = buildTopologyAuditReplayRows(AUDIT_BUNDLE_FIXTURE, {
      wellIds: ['well-b']
    });
    expect(filteredRows.every((row) => row.wellId === 'well-b')).toBe(true);
  });
});
