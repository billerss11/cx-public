import { describe, expect, it } from 'vitest';
import { evaluateBarrierEnvelopes } from '@/topology/envelopeEvaluator.js';

describe('envelopeEvaluator direction awareness', () => {
  it('respects explicit edge direction when computing alternative paths', () => {
    const edges = [
      {
        edgeId: 'edge:source-a',
        from: 'node:SOURCE',
        to: 'node:A',
        cost: 0,
        direction: 'forward'
      },
      {
        edgeId: 'edge:a-surface',
        from: 'node:A',
        to: 'node:SURFACE',
        cost: 1,
        direction: 'forward'
      },
      {
        edgeId: 'edge:surface-b',
        from: 'node:SURFACE',
        to: 'node:B',
        cost: 0,
        direction: 'forward'
      }
    ];

    const result = evaluateBarrierEnvelopes({
      edges,
      edgeReasons: {
        'edge:a-surface': {
          details: {
            equipmentContributors: [
              {
                rowId: 'eq-1',
                functionKey: 'inline_check',
                cost: 1,
                state: 'closed_failable',
                equipmentType: 'Test Inline Check'
              }
            ]
          }
        }
      },
      sourceNodeIds: ['node:SOURCE'],
      targetNodeId: 'node:SURFACE',
      primaryPathEdgeIds: ['edge:source-a', 'edge:a-surface'],
      primaryMinFailureCost: 1
    });

    expect(result.secondary.minFailureCostToSurface).toBe(null);
    expect(result.secondary.pathEdgeIds).toEqual([]);
  });
});