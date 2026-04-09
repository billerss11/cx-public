import { describe, expect, it } from 'vitest';
import {
  createEquipmentDefinitionRegistry
} from '@/topology/equipmentDefinitions/index.js';
import { resolveBoundaryEquipmentEffects } from '@/topology/equipmentRules.js';
import { buildVerticalEdges } from '@/topology/edgeBuilder.js';

function createTestRegistry() {
  return createEquipmentDefinitionRegistry([
    Object.freeze({
      schema: Object.freeze({
        key: 'test-radial-port',
        label: 'Test Radial Port',
        matchTokens: Object.freeze(['test radial port'])
      }),
      defaults: Object.freeze({
        state: Object.freeze({}),
        properties: Object.freeze({})
      }),
      host: Object.freeze({
        allowedHostTypes: Object.freeze(['tubing'])
      }),
      engineering: Object.freeze({
        resolveConnections: () => ([
          Object.freeze({
            edgeKind: 'radial',
            direction: 'bidirectional',
            fromInterval: 'current',
            toInterval: 'current',
            fromVolumeKey: 'TUBING_INNER',
            toVolumeKey: 'ANNULUS_A',
            state: 'open',
            cost: 0,
            functionKey: 'radial_port',
            summary: 'Tool opens radial communication at the boundary.'
          })
        ])
      }),
      render: Object.freeze({
        family: 'unknown'
      }),
      ui: Object.freeze({
        inspectorFields: Object.freeze([]),
        editorFields: Object.freeze([])
      })
    }),
    Object.freeze({
      schema: Object.freeze({
        key: 'test-inline-check',
        label: 'Test Inline Check',
        matchTokens: Object.freeze(['test inline check'])
      }),
      defaults: Object.freeze({
        state: Object.freeze({}),
        properties: Object.freeze({})
      }),
      host: Object.freeze({
        allowedHostTypes: Object.freeze(['tubing'])
      }),
      engineering: Object.freeze({
        resolveConnections: () => ([
          Object.freeze({
            edgeKind: 'vertical',
            direction: 'forward',
            fromInterval: 'current',
            toInterval: 'next',
            fromVolumeKey: 'ANNULUS_A',
            toVolumeKey: 'TUBING_INNER',
            state: 'open',
            cost: 0,
            functionKey: 'inline_check',
            summary: 'Tool opens one-way transfer across the boundary.'
          })
        ])
      }),
      render: Object.freeze({
        family: 'inlineValve'
      }),
      ui: Object.freeze({
        inspectorFields: Object.freeze([]),
        editorFields: Object.freeze([])
      })
    })
  ]);
}

describe('equipment connection contributions', () => {
  it('collects definition-driven connection contributions from test registries', () => {
    const effects = resolveBoundaryEquipmentEffects(
      1000,
      [{
        rowId: 'eq-radial',
        type: 'Test Radial Port',
        depth: 1000,
        show: true
      }],
      {
        definitionRegistry: createTestRegistry()
      }
    );

    expect(effects.connectionContributions).toHaveLength(1);
    expect(effects.connectionContributions[0].edgeKind).toBe('radial');
    expect(effects.connectionContributions[0].direction).toBe('bidirectional');
    expect(effects.connectionContributions[0].fromVolumeKey).toBe('TUBING_INNER');
    expect(effects.connectionContributions[0].toVolumeKey).toBe('ANNULUS_A');
  });

  it('emits directed equipment connection edges from definition contributions', () => {
    const intervals = [
      { intervalIndex: 0, top: 0, bottom: 1000 },
      { intervalIndex: 1, top: 1000, bottom: 2000 }
    ];
    const intervalNodeByKind = new Map([
      ['0|TUBING_INNER', { nodeId: 'node:0:tbg', kind: 'TUBING_INNER', meta: {} }],
      ['0|ANNULUS_A', { nodeId: 'node:0:annulus-a', kind: 'ANNULUS_A', meta: {} }],
      ['1|TUBING_INNER', { nodeId: 'node:1:tbg', kind: 'TUBING_INNER', meta: {} }],
      ['1|ANNULUS_A', { nodeId: 'node:1:annulus-a', kind: 'ANNULUS_A', meta: {} }]
    ]);

    const result = buildVerticalEdges(
      intervals,
      intervalNodeByKind,
      [{
        rowId: 'eq-inline',
        type: 'Test Inline Check',
        depth: 1000,
        show: true
      }],
      {
        definitionRegistry: createTestRegistry()
      }
    );

    const contributionEdge = result.edges.find((edge) => (
      edge.meta?.transitionRuleId === 'equipment-connection'
    ));

    expect(contributionEdge).toBeTruthy();
    expect(contributionEdge?.kind).toBe('vertical');
    expect(contributionEdge?.direction).toBe('forward');
    expect(contributionEdge?.from).toBe('node:0:annulus-a');
    expect(contributionEdge?.to).toBe('node:1:tbg');
  });
});