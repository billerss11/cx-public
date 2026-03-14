import { describe, expect, it } from 'vitest';
import { buildSurfaceLayoutModel } from '@/surface/layoutModel.js';

describe('surface layout model', () => {
  it('keeps a stable channel order and expands the authored surface band', () => {
    const layout = buildSurfaceLayoutModel({
      surfacePaths: [
        {
          rowId: 'path-b',
          channelKey: 'ANNULUS_B',
          label: 'Annulus B Path',
          items: []
        },
        {
          rowId: 'path-t',
          channelKey: 'TUBING_INNER',
          label: 'Tubing Path',
          items: [{ rowId: 'item-lmv', itemType: 'barrier', label: 'Lower Master Valve' }]
        },
        {
          rowId: 'path-a',
          channelKey: 'ANNULUS_A',
          label: 'Annulus A Path',
          items: []
        }
      ],
      surfaceTransfers: [],
      surfaceOutlets: [],
      surfaceSummary: {
        byChannel: {
          TUBING_INNER: { routeStatus: 'authored', currentState: 'outlet', outletLabels: ['Production Outlet'] },
          ANNULUS_A: { routeStatus: 'authored', currentState: 'outlet', outletLabels: ['Annulus A Outlet'] },
          ANNULUS_B: { routeStatus: 'authored', currentState: 'blocked', outletLabels: [] }
        }
      }
    });

    expect(layout.bandHeight).toBe(132);
    expect(layout.displayMode).toBe('detail');
    expect(layout.lanes.map((lane) => lane.channelKey)).toEqual(['TUBING_INNER', 'ANNULUS_A', 'ANNULUS_B']);
  });

  it('keeps a compact assumption band when only fallback surface summaries exist', () => {
    const layout = buildSurfaceLayoutModel({
      surfacePaths: [],
      surfaceTransfers: [],
      surfaceOutlets: [],
      surfaceSummary: {
        byChannel: {
          TUBING_INNER: {
            routeStatus: 'assumed',
            currentState: 'assumed_surface',
            warningMessages: ['Surface path is assumed because no authored surface route exists for this channel.']
          }
        }
      }
    });

    expect(layout.bandHeight).toBe(44);
    expect(layout.displayMode).toBe('assumption');
    expect(layout.lanes).toHaveLength(1);
  });

  it('switches the inline band into condensed mode when the surface is crowded', () => {
    const layout = buildSurfaceLayoutModel({
      surfacePaths: [
        { rowId: 'path-t', channelKey: 'TUBING_INNER', items: [{ rowId: '1' }, { rowId: '2' }, { rowId: '3' }, { rowId: '4' }] },
        { rowId: 'path-a', channelKey: 'ANNULUS_A', items: [{ rowId: '5' }, { rowId: '6' }, { rowId: '7' }, { rowId: '8' }] },
        { rowId: 'path-b', channelKey: 'ANNULUS_B', items: [{ rowId: '9' }, { rowId: '10' }, { rowId: '11' }, { rowId: '12' }] },
        { rowId: 'path-c', channelKey: 'ANNULUS_C', items: [{ rowId: '13' }, { rowId: '14' }, { rowId: '15' }] },
      ],
      surfaceTransfers: [
        { rowId: 'tr-1' },
        { rowId: 'tr-2' },
        { rowId: 'tr-3' },
        { rowId: 'tr-4' },
        { rowId: 'tr-5' }
      ],
      surfaceOutlets: [],
      surfaceSummary: {
        byChannel: {
          TUBING_INNER: { routeStatus: 'authored', currentState: 'outlet', outletLabels: ['Production Outlet'] },
          ANNULUS_A: { routeStatus: 'authored', currentState: 'outlet', outletLabels: ['Annulus A Outlet'] },
          ANNULUS_B: { routeStatus: 'authored', currentState: 'outlet', outletLabels: ['Annulus B Outlet'] },
          ANNULUS_C: { routeStatus: 'authored', currentState: 'blocked', outletLabels: [] }
        }
      }
    });

    expect(layout.bandHeight).toBe(220);
    expect(layout.displayMode).toBe('condensed');
    expect(layout.lanes.every((lane) => typeof lane.summaryLabel === 'string')).toBe(true);
  });
});
