import { describe, expect, it } from 'vitest';
import {
  filterScenarioBreakoutRows,
  filterScenarioSourceRows,
  mergeScenarioBreakoutRows,
  mergeScenarioSourceRows
} from '@/topology/sourceRows.js';

describe('sourceRows breakout helpers', () => {
  it('filters only breakout rows from mixed topology source rows', () => {
    const rows = [
      {
        rowId: 'src-1',
        sourceType: 'formation_inflow',
        volumeKey: 'BORE',
        top: 1000,
        bottom: 1100
      },
      {
        rowId: 'br-1',
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        top: 1200,
        bottom: 1300
      },
      {
        rowId: 'br-2',
        fromVolumeKey: 'ANNULUS_B',
        top: 1400,
        bottom: 1500
      }
    ];

    const breakouts = filterScenarioBreakoutRows(rows);
    expect(breakouts.map((row) => row.rowId)).toEqual(['br-1', 'br-2']);
  });

  it('filters only explicit source rows from mixed topology source rows', () => {
    const rows = [
      {
        rowId: 'src-1',
        sourceType: 'formation_inflow',
        volumeKey: 'BORE',
        top: 1000,
        bottom: 1100
      },
      {
        rowId: 'br-1',
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        top: 1200,
        bottom: 1300
      },
      {
        rowId: 'src-2',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1400,
        bottom: 1500
      }
    ];

    const sources = filterScenarioSourceRows(rows);
    expect(sources.map((row) => row.rowId)).toEqual(['src-1', 'src-2']);
  });

  it('merges breakout editor rows without dropping non-breakout rows', () => {
    const baseRows = [
      {
        rowId: 'src-1',
        sourceType: 'formation_inflow',
        volumeKey: 'BORE',
        top: 1000,
        bottom: 1100
      },
      {
        rowId: 'br-1',
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        top: 1200,
        bottom: 1300
      },
      {
        rowId: 'src-2',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1600,
        bottom: 1700
      }
    ];

    const editorRows = [
      {
        rowId: 'br-1',
        fromVolumeKey: 'ANNULUS_B',
        toVolumeKey: 'ANNULUS_C',
        top: 1225,
        bottom: 1325
      },
      {
        rowId: 'br-new',
        fromVolumeKey: 'ANNULUS_C',
        toVolumeKey: 'ANNULUS_D',
        top: 1800,
        bottom: 1900
      }
    ];

    const merged = mergeScenarioBreakoutRows(baseRows, editorRows);
    expect(merged.map((row) => row.rowId)).toEqual(['src-1', 'br-1', 'src-2', 'br-new']);
    expect(merged[1].fromVolumeKey).toBe('ANNULUS_B');
    expect(merged[1].toVolumeKey).toBe('ANNULUS_C');
    expect(merged[2].rowId).toBe('src-2');
  });

  it('merges source editor rows without dropping breakout rows', () => {
    const baseRows = [
      {
        rowId: 'src-1',
        sourceType: 'formation_inflow',
        volumeKey: 'BORE',
        top: 1000,
        bottom: 1100
      },
      {
        rowId: 'br-1',
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        top: 1200,
        bottom: 1300
      },
      {
        rowId: 'src-2',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1600,
        bottom: 1700
      }
    ];

    const editorRows = [
      {
        rowId: 'src-1',
        sourceType: 'formation_inflow',
        volumeKey: 'FORMATION_ANNULUS',
        top: 1025,
        bottom: 1125
      },
      {
        rowId: 'src-new',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_C',
        top: 1800,
        bottom: 1900
      }
    ];

    const merged = mergeScenarioSourceRows(baseRows, editorRows);
    expect(merged.map((row) => row.rowId)).toEqual(['src-1', 'br-1', 'src-new']);
    expect(merged[0].volumeKey).toBe('FORMATION_ANNULUS');
    expect(merged[1].fromVolumeKey).toBe('ANNULUS_A');
    expect(merged[1].toVolumeKey).toBe('ANNULUS_B');
  });
});
