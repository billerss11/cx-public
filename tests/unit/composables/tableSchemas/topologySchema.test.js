import { describe, expect, it } from 'vitest';
import {
  buildTopologyBreakoutSchema,
  buildTopologySourceSchema
} from '@/composables/tableSchemas/topologySchema.js';

function createDomainState() {
  return {
    topologySources: [
      {
        rowId: 'src-1',
        top: 1000,
        bottom: 1000,
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        show: true
      },
      {
        rowId: 'br-1',
        top: 1200,
        bottom: 1200,
        sourceType: 'scenario',
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        show: true
      }
    ]
  };
}

describe('topologySchema', () => {
  it('builds source schema that only exposes source rows and merges edits', () => {
    const domainState = createDomainState();
    const schema = buildTopologySourceSchema(domainState, {
      t: (key) => key,
      tf: (_key, fallback) => fallback
    });

    const sourceRows = schema.getData();
    expect(sourceRows).toHaveLength(1);
    expect(sourceRows[0].rowId).toBe('src-1');

    const mergedRows = schema.mapRowsForStore([
      {
        rowId: 'src-1',
        top: 900,
        bottom: 900,
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_B',
        show: true
      }
    ]);
    expect(mergedRows).toHaveLength(2);
    expect(mergedRows.find((row) => row.rowId === 'src-1')?.volumeKey).toBe('ANNULUS_B');
    expect(mergedRows.find((row) => row.rowId === 'br-1')).toBeTruthy();
  });

  it('builds breakout schema that only exposes breakout rows and merges edits', () => {
    const domainState = createDomainState();
    const schema = buildTopologyBreakoutSchema(domainState, {
      t: (key) => key,
      tf: (_key, fallback) => fallback
    });

    const breakoutRows = schema.getData();
    expect(breakoutRows).toHaveLength(1);
    expect(breakoutRows[0].rowId).toBe('br-1');

    const mergedRows = schema.mapRowsForStore([
      {
        rowId: 'br-1',
        top: 1300,
        bottom: 1300,
        sourceType: 'scenario',
        fromVolumeKey: 'ANNULUS_B',
        toVolumeKey: 'ANNULUS_C',
        show: true
      }
    ]);
    expect(mergedRows).toHaveLength(2);
    expect(mergedRows.find((row) => row.rowId === 'br-1')?.fromVolumeKey).toBe('ANNULUS_B');
    expect(mergedRows.find((row) => row.rowId === 'src-1')).toBeTruthy();
  });
});
