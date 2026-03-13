import { describe, expect, it } from 'vitest';
import {
  buildTopologyBreakoutSchema,
  buildTopologySourceSchema
} from '@/composables/tableSchemas/topologySchema.js';
import {
  TOPOLOGY_SOURCE_VOLUME_CELL_LABELS,
  TOPOLOGY_SOURCE_VOLUME_OPTIONS
} from '@/composables/tableSchemas/baseSchemaUtils.js';

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
  it('uses canonical topology source volume labels and options', () => {
    expect(TOPOLOGY_SOURCE_VOLUME_OPTIONS).not.toContain('TUBING_ANNULUS');
    expect(Object.prototype.hasOwnProperty.call(TOPOLOGY_SOURCE_VOLUME_CELL_LABELS, 'TUBING_ANNULUS')).toBe(false);
    expect(TOPOLOGY_SOURCE_VOLUME_CELL_LABELS.ANNULUS_A).toContain('first annulus');
    expect(TOPOLOGY_SOURCE_VOLUME_CELL_LABELS.ANNULUS_A).not.toContain('first casing-to-casing');
  });

  it('builds source schema that only exposes source rows and merges edits', () => {
    const domainState = createDomainState();
    const schema = buildTopologySourceSchema(domainState, {
      t: (key) => key,
      tf: (_key, fallback) => fallback
    });

    const sourceRows = schema.getData();
    expect(sourceRows).toHaveLength(1);
    expect(sourceRows[0].rowId).toBe('src-1');
    expect(schema.enableRowSelection).toBe(true);
    expect(schema.columns().map((column) => column.data)).toEqual([
      'top',
      'bottom',
      'volumeKey',
      'label'
    ]);

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
    expect(schema.enableRowSelection).toBe(true);

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
