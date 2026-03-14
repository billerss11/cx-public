import { describe, expect, it } from 'vitest';
import {
  getSelectionRowLocatorMeta,
  normalizeSelectableEntityType,
  resolveSelectionRowTarget
} from '@/app/selectionRowLocator.js';

describe('selectionRowLocator', () => {
  it('normalizes supported entity aliases', () => {
    expect(normalizeSelectableEntityType('lines')).toBe('line');
    expect(normalizeSelectableEntityType('drill-string')).toBe('drillString');
    expect(normalizeSelectableEntityType('topologyBreakouts')).toBe('topologyBreakout');
    expect(normalizeSelectableEntityType('topology_source')).toBe('topologySource');
    expect(normalizeSelectableEntityType('surfacePaths')).toBe('surfacePath');
    expect(normalizeSelectableEntityType('surfaceTransfers')).toBe('surfaceTransfer');
    expect(normalizeSelectableEntityType('surfaceOutlets')).toBe('surfaceOutlet');
  });

  it('returns domain metadata for normalized entity types', () => {
    expect(getSelectionRowLocatorMeta('lines')).toMatchObject({
      storeKey: 'horizontalLines',
      interactionType: 'line',
      canHighlight: true
    });
    expect(getSelectionRowLocatorMeta('topologyBreakouts')).toMatchObject({
      storeKey: 'topologySources',
      interactionType: null,
      canHighlight: false
    });
    expect(getSelectionRowLocatorMeta('surfaceTransfers')).toMatchObject({
      storeKey: 'surfaceTransfers',
      interactionType: null,
      canHighlight: false
    });
  });

  it('resolves row targets with topology source/breakout row filters', () => {
    const projectDataStore = {
      topologySources: [
        { rowId: 'src-1', sourceType: 'scenario', show: true },
        {
          rowId: 'br-1',
          sourceType: 'scenario',
          fromVolumeKey: 'ANNULUS_A',
          toVolumeKey: 'ANNULUS_B',
          show: true
        }
      ]
    };

    const sourceTarget = resolveSelectionRowTarget(projectDataStore, {
      entityType: 'topologySource',
      rowId: 'src-1'
    });
    expect(sourceTarget).toMatchObject({
      rowId: 'src-1',
      entityType: 'topologySource',
      storeKey: 'topologySources',
      canHighlight: false,
      domainRowIndex: 0,
      storeRowIndex: 0
    });

    expect(resolveSelectionRowTarget(projectDataStore, {
      entityType: 'topologySource',
      rowId: 'br-1'
    })).toBeNull();

    const breakoutTarget = resolveSelectionRowTarget(projectDataStore, {
      entityType: 'topologyBreakout',
      rowId: 'br-1'
    });
    expect(breakoutTarget).toMatchObject({
      rowId: 'br-1',
      entityType: 'topologyBreakout',
      storeKey: 'topologySources',
      canHighlight: false,
      domainRowIndex: 0,
      storeRowIndex: 1
    });
  });

  it('resolves top-level surface rows through their dedicated store arrays', () => {
    const projectDataStore = {
      surfacePaths: [
        { rowId: 'surface-path-1', channelKey: 'TUBING_INNER', label: 'Tubing Path', show: true }
      ],
      surfaceTransfers: [
        { rowId: 'surface-transfer-1', transferType: 'leak', label: 'Leak to A', show: true }
      ],
      surfaceOutlets: [
        { rowId: 'surface-outlet-1', label: 'Production Outlet', channelKey: 'TUBING_INNER', show: true }
      ]
    };

    expect(resolveSelectionRowTarget(projectDataStore, {
      entityType: 'surfacePath',
      rowId: 'surface-path-1'
    })).toMatchObject({
      rowId: 'surface-path-1',
      entityType: 'surfacePath',
      storeKey: 'surfacePaths'
    });

    expect(resolveSelectionRowTarget(projectDataStore, {
      entityType: 'surfaceTransfer',
      rowId: 'surface-transfer-1'
    })).toMatchObject({
      rowId: 'surface-transfer-1',
      entityType: 'surfaceTransfer',
      storeKey: 'surfaceTransfers'
    });

    expect(resolveSelectionRowTarget(projectDataStore, {
      entityType: 'surfaceOutlet',
      rowId: 'surface-outlet-1'
    })).toMatchObject({
      rowId: 'surface-outlet-1',
      entityType: 'surfaceOutlet',
      storeKey: 'surfaceOutlets'
    });
  });
});
