import { describe, expect, it } from 'vitest';
import {
  getDomainRegistryEntry,
  listVisibleDomainTableEntries,
  resolveCanonicalEntityTypeForDomain,
  resolveDomainKeyFromEntityType,
  resolveDomainTableTarget
} from '@/workspace/domainRegistry.js';

describe('domainRegistry', () => {
  it('normalizes entity aliases to domain keys', () => {
    expect(resolveDomainKeyFromEntityType('lines')).toBe('lines');
    expect(resolveDomainKeyFromEntityType('line')).toBe('lines');
    expect(resolveDomainKeyFromEntityType('drill-string')).toBe('drillString');
    expect(resolveDomainKeyFromEntityType('topologyBreakouts')).toBe('topologyBreakouts');
    expect(resolveDomainKeyFromEntityType('topology_breakout')).toBe('topologyBreakouts');
  });

  it('resolves canonical entity types and table targets', () => {
    expect(resolveCanonicalEntityTypeForDomain('lines')).toBe('line');
    expect(resolveCanonicalEntityTypeForDomain('topologyBreakouts')).toBe('topologyBreakout');

    expect(resolveDomainTableTarget('marker')).toEqual({
      tabKey: 'markers',
      tableType: 'marker'
    });
    expect(resolveDomainTableTarget('topologyBreakout')).toEqual({
      tabKey: 'topologyBreakouts',
      tableType: 'topologyBreakout'
    });
  });

  it('applies visibility rules when listing table entries', () => {
    const productionVertical = listVisibleDomainTableEntries({
      operationPhase: 'production',
      viewMode: 'vertical'
    }).map((entry) => entry.key);
    expect(productionVertical).toContain('tubing');
    expect(productionVertical).toContain('equipment');
    expect(productionVertical).not.toContain('drillString');
    expect(productionVertical).not.toContain('trajectory');

    const drillingDirectional = listVisibleDomainTableEntries({
      operationPhase: 'drilling',
      viewMode: 'directional'
    }).map((entry) => entry.key);
    expect(drillingDirectional).toContain('drillString');
    expect(drillingDirectional).not.toContain('tubing');
    expect(drillingDirectional).not.toContain('equipment');
    expect(drillingDirectional).toContain('trajectory');
  });

  it('exposes selection locator metadata per domain', () => {
    const topologyBreakouts = getDomainRegistryEntry('topologyBreakouts');
    expect(topologyBreakouts?.storeKey).toBe('topologySources');
    expect(topologyBreakouts?.canHighlight).toBe(false);
    expect(typeof topologyBreakouts?.selectionFilterRows).toBe('function');
  });
});
