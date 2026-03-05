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
});
