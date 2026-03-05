import { describe, expect, it } from 'vitest';
import { buildVerticalEdges } from '@/topology/edgeBuilder.js';
import {
  createAdjacentAnnulusFamilyPairKeys,
  resolveBoundaryStructuralTransitionDefinitions,
  resolveStructuralTransitionState
} from '@/topology/structuralTransitions.js';
import { TOPOLOGY_WARNING_CODES } from '@/topology/warningCatalog.js';

function createIntervalNodeByKind(entries = []) {
  const map = new Map();
  entries.forEach((entry) => {
    const intervalIndex = Number(entry?.intervalIndex);
    const kind = String(entry?.kind ?? '').trim();
    if (!Number.isInteger(intervalIndex) || !kind) return;
    map.set(`${intervalIndex}|${kind}`, {
      nodeId: String(entry?.nodeId ?? `node:${kind}:${intervalIndex}`),
      kind,
      meta: entry?.meta && typeof entry.meta === 'object' ? { ...entry.meta } : {}
    });
  });
  return map;
}

describe('structuralTransitions', () => {
  it('builds adjacent annulus-family pair keys from sequence tokens', () => {
    const pairKeys = createAdjacentAnnulusFamilyPairKeys([
      'ANNULUS_A',
      '',
      null,
      'ANNULUS_B',
      'ANNULUS_C'
    ]);

    expect([...pairKeys]).toEqual([
      'ANNULUS_A|ANNULUS_B',
      'ANNULUS_B|ANNULUS_C'
    ]);
  });

  it('resolves tubing-annulus entry transition definitions at tubing top boundaries', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:0'
      },
      {
        intervalIndex: 1,
        kind: 'TUBING_ANNULUS',
        nodeId: 'node:TUBING_ANNULUS:1'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 0 },
      nextInterval: { intervalIndex: 1 },
      intervalNodeByKind
    });

    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      ruleId: 'tubing-annulus-transition',
      transitionType: 'tubing_annulus_entry',
      primaryVolumeKind: 'TUBING_ANNULUS'
    });
    expect(definitions[0].fromNode.kind).toBe('ANNULUS_A');
    expect(definitions[0].toNode.kind).toBe('TUBING_ANNULUS');
  });

  it('resolves tubing-annulus exit transition definitions at tubing bottom boundaries', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 3,
        kind: 'TUBING_ANNULUS',
        nodeId: 'node:TUBING_ANNULUS:3'
      },
      {
        intervalIndex: 4,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:4'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 3 },
      nextInterval: { intervalIndex: 4 },
      intervalNodeByKind
    });

    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      ruleId: 'tubing-annulus-transition',
      transitionType: 'tubing_annulus_exit',
      primaryVolumeKind: 'TUBING_ANNULUS'
    });
    expect(definitions[0].fromNode.kind).toBe('TUBING_ANNULUS');
    expect(definitions[0].toNode.kind).toBe('ANNULUS_A');
  });

  it('resolves tubing-end transfer exit transitions from TUBING_INNER to ANNULUS_A when inner channel shifts out of tubing', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 3,
        kind: 'TUBING_INNER',
        nodeId: 'node:TUBING_INNER:3',
        meta: { innerChannel: 'tubing_inner' }
      },
      {
        intervalIndex: 3,
        kind: 'TUBING_ANNULUS',
        nodeId: 'node:TUBING_ANNULUS:3'
      },
      {
        intervalIndex: 4,
        kind: 'TUBING_INNER',
        nodeId: 'node:TUBING_INNER:4',
        meta: { innerChannel: 'wellbore_inner' }
      },
      {
        intervalIndex: 4,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:4'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 3 },
      nextInterval: { intervalIndex: 4 },
      intervalNodeByKind
    });

    const transferDefinitions = definitions.filter((definition) => (
      definition?.ruleId === 'tubing-end-transfer'
      && definition?.transitionType === 'tubing_end_transfer_exit'
    ));
    const transferTargets = new Set(transferDefinitions.map((definition) => definition?.toNode?.kind));

    expect(transferDefinitions.length).toBeGreaterThanOrEqual(2);
    expect(transferDefinitions.every((definition) => definition?.fromNode?.kind === 'TUBING_INNER')).toBe(true);
    expect(transferTargets.has('TUBING_ANNULUS')).toBe(true);
    expect(transferTargets.has('ANNULUS_A')).toBe(true);
  });

  it('emits unresolved tubing-end transfer warning when annulus endpoint is missing at a channel shift boundary', () => {
    const intervals = [
      { intervalIndex: 0, top: 0, bottom: 100 },
      { intervalIndex: 1, top: 100, bottom: 200 }
    ];
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'TUBING_INNER',
        nodeId: 'node:TUBING_INNER:0',
        meta: { innerChannel: 'tubing_inner' }
      },
      {
        intervalIndex: 0,
        kind: 'TUBING_ANNULUS',
        nodeId: 'node:TUBING_ANNULUS:0'
      },
      {
        intervalIndex: 1,
        kind: 'TUBING_INNER',
        nodeId: 'node:TUBING_INNER:1',
        meta: { innerChannel: 'wellbore_inner' }
      }
    ]);

    const result = buildVerticalEdges(intervals, intervalNodeByKind, []);
    const unresolvedWarning = result.validationWarnings.find(
      (warning) => warning.code === 'tubing_end_transfer_unresolved'
    );

    expect(unresolvedWarning).toBeDefined();
  });

  it('resolves ANNULUS_A -> ANNULUS_B annulus-family entry as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:0'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:1'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:1'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 0 },
      nextInterval: { intervalIndex: 1 },
      intervalNodeByKind
    });

    const entryDefinition = definitions.find((definition) => definition.ruleId === 'annulus-family-transition');
    expect(entryDefinition).toBeDefined();
    expect(entryDefinition).toMatchObject({
      ruleId: 'annulus-family-transition',
      transitionType: 'annulus_family_shift_entry',
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_B'
    });
    expect(entryDefinition.fromNode.kind).toBe('ANNULUS_A');
    expect(entryDefinition.toNode.kind).toBe('ANNULUS_B');
  });

  it('resolves ANNULUS_B -> ANNULUS_A annulus-family exit as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 4,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:4'
      },
      {
        intervalIndex: 4,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:4'
      },
      {
        intervalIndex: 5,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:5'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 4 },
      nextInterval: { intervalIndex: 5 },
      intervalNodeByKind
    });

    const exitDefinition = definitions.find((definition) => definition.ruleId === 'annulus-family-transition');
    expect(exitDefinition).toBeDefined();
    expect(exitDefinition).toMatchObject({
      ruleId: 'annulus-family-transition',
      transitionType: 'annulus_family_shift_exit',
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_A'
    });
    expect(exitDefinition.fromNode.kind).toBe('ANNULUS_B');
    expect(exitDefinition.toNode.kind).toBe('ANNULUS_A');
  });

  it('resolves ANNULUS_B -> ANNULUS_C annulus-family entry as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 7,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:7'
      },
      {
        intervalIndex: 8,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:8'
      },
      {
        intervalIndex: 8,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:8'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 7 },
      nextInterval: { intervalIndex: 8 },
      intervalNodeByKind
    });

    const entryDefinition = definitions.find((definition) => (
      definition.ruleId === 'annulus-family-transition'
      && definition.transitionType === 'annulus_family_shift_entry'
      && definition.fromNode.kind === 'ANNULUS_B'
      && definition.toNode.kind === 'ANNULUS_C'
    ));
    expect(entryDefinition).toBeDefined();
    expect(entryDefinition).toMatchObject({
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_C'
    });
  });

  it('resolves ANNULUS_C -> ANNULUS_B annulus-family exit as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 10,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:10'
      },
      {
        intervalIndex: 10,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:10'
      },
      {
        intervalIndex: 11,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:11'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 10 },
      nextInterval: { intervalIndex: 11 },
      intervalNodeByKind
    });

    const exitDefinition = definitions.find((definition) => (
      definition.ruleId === 'annulus-family-transition'
      && definition.transitionType === 'annulus_family_shift_exit'
      && definition.fromNode.kind === 'ANNULUS_C'
      && definition.toNode.kind === 'ANNULUS_B'
    ));
    expect(exitDefinition).toBeDefined();
    expect(exitDefinition).toMatchObject({
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_B'
    });
  });

  it('resolves ANNULUS_C -> ANNULUS_D annulus-family entry as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 12,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:12'
      },
      {
        intervalIndex: 13,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:13'
      },
      {
        intervalIndex: 13,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:13'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 12 },
      nextInterval: { intervalIndex: 13 },
      intervalNodeByKind
    });

    const entryDefinition = definitions.find((definition) => (
      definition.ruleId === 'annulus-family-transition'
      && definition.transitionType === 'annulus_family_shift_entry'
      && definition.fromNode.kind === 'ANNULUS_C'
      && definition.toNode.kind === 'ANNULUS_D'
    ));
    expect(entryDefinition).toBeDefined();
    expect(entryDefinition).toMatchObject({
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_D'
    });
  });

  it('resolves ANNULUS_D -> ANNULUS_C annulus-family exit as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 14,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:14'
      },
      {
        intervalIndex: 14,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:14'
      },
      {
        intervalIndex: 15,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:15'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 14 },
      nextInterval: { intervalIndex: 15 },
      intervalNodeByKind
    });

    const exitDefinition = definitions.find((definition) => (
      definition.ruleId === 'annulus-family-transition'
      && definition.transitionType === 'annulus_family_shift_exit'
      && definition.fromNode.kind === 'ANNULUS_D'
      && definition.toNode.kind === 'ANNULUS_C'
    ));
    expect(exitDefinition).toBeDefined();
    expect(exitDefinition).toMatchObject({
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_C'
    });
  });

  it('resolves ANNULUS_D -> ANNULUS_E annulus-family entry as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 16,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:16'
      },
      {
        intervalIndex: 17,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:17'
      },
      {
        intervalIndex: 17,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:17'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 16 },
      nextInterval: { intervalIndex: 17 },
      intervalNodeByKind
    });

    const entryDefinition = definitions.find((definition) => (
      definition.ruleId === 'annulus-family-transition'
      && definition.transitionType === 'annulus_family_shift_entry'
      && definition.fromNode.kind === 'ANNULUS_D'
      && definition.toNode.kind === 'ANNULUS_E'
    ));
    expect(entryDefinition).toBeDefined();
    expect(entryDefinition).toMatchObject({
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_E'
    });
  });

  it('resolves ANNULUS_E -> ANNULUS_D annulus-family exit as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 18,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:18'
      },
      {
        intervalIndex: 18,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:18'
      },
      {
        intervalIndex: 19,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:19'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 18 },
      nextInterval: { intervalIndex: 19 },
      intervalNodeByKind
    });

    const exitDefinition = definitions.find((definition) => (
      definition.ruleId === 'annulus-family-transition'
      && definition.transitionType === 'annulus_family_shift_exit'
      && definition.fromNode.kind === 'ANNULUS_E'
      && definition.toNode.kind === 'ANNULUS_D'
    ));
    expect(exitDefinition).toBeDefined();
    expect(exitDefinition).toMatchObject({
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_D'
    });
  });

  it('resolves ANNULUS_E -> ANNULUS_F annulus-family entry as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 20,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:20'
      },
      {
        intervalIndex: 21,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:21'
      },
      {
        intervalIndex: 21,
        kind: 'ANNULUS_F',
        nodeId: 'node:ANNULUS_F:21'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 20 },
      nextInterval: { intervalIndex: 21 },
      intervalNodeByKind
    });

    const entryDefinition = definitions.find((definition) => (
      definition.ruleId === 'annulus-family-transition'
      && definition.transitionType === 'annulus_family_shift_entry'
      && definition.fromNode.kind === 'ANNULUS_E'
      && definition.toNode.kind === 'ANNULUS_F'
    ));
    expect(entryDefinition).toBeDefined();
    expect(entryDefinition).toMatchObject({
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_F'
    });
  });

  it('resolves ANNULUS_F -> ANNULUS_E annulus-family exit as an edge-enabled transition', () => {
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 22,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:22'
      },
      {
        intervalIndex: 22,
        kind: 'ANNULUS_F',
        nodeId: 'node:ANNULUS_F:22'
      },
      {
        intervalIndex: 23,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:23'
      }
    ]);

    const definitions = resolveBoundaryStructuralTransitionDefinitions({
      currentInterval: { intervalIndex: 22 },
      nextInterval: { intervalIndex: 23 },
      intervalNodeByKind
    });

    const exitDefinition = definitions.find((definition) => (
      definition.ruleId === 'annulus-family-transition'
      && definition.transitionType === 'annulus_family_shift_exit'
      && definition.fromNode.kind === 'ANNULUS_F'
      && definition.toNode.kind === 'ANNULUS_E'
    ));
    expect(exitDefinition).toBeDefined();
    expect(exitDefinition).toMatchObject({
      emitsEdge: true,
      primaryVolumeKind: 'ANNULUS_E'
    });
  });

  it('emits ANNULUS_A <-> ANNULUS_B transition edges without structural warnings for mapped pair', () => {
    const intervals = [
      { intervalIndex: 0, top: 0, bottom: 100 },
      { intervalIndex: 1, top: 100, bottom: 200 }
    ];
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:0'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_A',
        nodeId: 'node:ANNULUS_A:1'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:1'
      }
    ]);

    const result = buildVerticalEdges(intervals, intervalNodeByKind, []);
    const structuralWarning = result.validationWarnings.find(
      (warning) => warning.code === TOPOLOGY_WARNING_CODES.STRUCTURAL_TRANSITION_NOT_MODELED
    );
    const annulusTransitionEdges = result.edges.filter(
      (edge) => edge.reason?.ruleId === 'annulus-family-transition'
    );
    const transitionPairs = annulusTransitionEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));

    expect(structuralWarning).toBeUndefined();
    expect(transitionPairs).toContain('ANNULUS_A->ANNULUS_B');
  });

  it('emits ANNULUS_B <-> ANNULUS_C transition edges without structural warnings for mapped pair', () => {
    const intervals = [
      { intervalIndex: 0, top: 0, bottom: 100 },
      { intervalIndex: 1, top: 100, bottom: 200 }
    ];
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:0'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_B',
        nodeId: 'node:ANNULUS_B:1'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:1'
      }
    ]);

    const result = buildVerticalEdges(intervals, intervalNodeByKind, []);
    const structuralWarning = result.validationWarnings.find(
      (warning) => warning.code === TOPOLOGY_WARNING_CODES.STRUCTURAL_TRANSITION_NOT_MODELED
    );
    const annulusTransitionEdges = result.edges.filter(
      (edge) => edge.reason?.ruleId === 'annulus-family-transition'
    );
    const transitionPairs = annulusTransitionEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));

    expect(structuralWarning).toBeUndefined();
    expect(transitionPairs).toContain('ANNULUS_B->ANNULUS_C');
  });

  it('emits ANNULUS_C <-> ANNULUS_D transition edges without structural warnings for mapped pair', () => {
    const intervals = [
      { intervalIndex: 0, top: 0, bottom: 100 },
      { intervalIndex: 1, top: 100, bottom: 200 }
    ];
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:0'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_C',
        nodeId: 'node:ANNULUS_C:1'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:1'
      }
    ]);

    const result = buildVerticalEdges(intervals, intervalNodeByKind, []);
    const structuralWarning = result.validationWarnings.find(
      (warning) => warning.code === TOPOLOGY_WARNING_CODES.STRUCTURAL_TRANSITION_NOT_MODELED
    );
    const annulusTransitionEdges = result.edges.filter(
      (edge) => edge.reason?.ruleId === 'annulus-family-transition'
    );
    const transitionPairs = annulusTransitionEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));

    expect(structuralWarning).toBeUndefined();
    expect(transitionPairs).toContain('ANNULUS_C->ANNULUS_D');
  });

  it('emits ANNULUS_D <-> FORMATION transition edges without structural warnings for mapped pair', () => {
    const intervals = [
      { intervalIndex: 0, top: 0, bottom: 100 },
      { intervalIndex: 1, top: 100, bottom: 200 }
    ];
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:0'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:1'
      },
      {
        intervalIndex: 1,
        kind: 'FORMATION_ANNULUS',
        nodeId: 'node:FORMATION_ANNULUS:1'
      }
    ]);

    const result = buildVerticalEdges(intervals, intervalNodeByKind, []);
    const structuralWarning = result.validationWarnings.find(
      (warning) => warning.code === TOPOLOGY_WARNING_CODES.STRUCTURAL_TRANSITION_NOT_MODELED
    );
    const annulusTransitionEdges = result.edges.filter(
      (edge) => edge.reason?.ruleId === 'annulus-family-transition'
    );
    const transitionPairs = annulusTransitionEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));

    expect(structuralWarning).toBeUndefined();
    expect(transitionPairs).toContain('ANNULUS_D->FORMATION_ANNULUS');
  });

  it('emits ANNULUS_D <-> ANNULUS_E transition edges without structural warnings for mapped pair', () => {
    const intervals = [
      { intervalIndex: 0, top: 0, bottom: 100 },
      { intervalIndex: 1, top: 100, bottom: 200 }
    ];
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:0'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_D',
        nodeId: 'node:ANNULUS_D:1'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:1'
      }
    ]);

    const result = buildVerticalEdges(intervals, intervalNodeByKind, []);
    const structuralWarning = result.validationWarnings.find(
      (warning) => warning.code === TOPOLOGY_WARNING_CODES.STRUCTURAL_TRANSITION_NOT_MODELED
    );
    const annulusTransitionEdges = result.edges.filter(
      (edge) => edge.reason?.ruleId === 'annulus-family-transition'
    );
    const transitionPairs = annulusTransitionEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));

    expect(structuralWarning).toBeUndefined();
    expect(transitionPairs).toContain('ANNULUS_D->ANNULUS_E');
  });

  it('emits ANNULUS_E <-> ANNULUS_F transition edges without structural warnings for mapped pair', () => {
    const intervals = [
      { intervalIndex: 0, top: 0, bottom: 100 },
      { intervalIndex: 1, top: 100, bottom: 200 }
    ];
    const intervalNodeByKind = createIntervalNodeByKind([
      {
        intervalIndex: 0,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:0'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_E',
        nodeId: 'node:ANNULUS_E:1'
      },
      {
        intervalIndex: 1,
        kind: 'ANNULUS_F',
        nodeId: 'node:ANNULUS_F:1'
      }
    ]);

    const result = buildVerticalEdges(intervals, intervalNodeByKind, []);
    const structuralWarning = result.validationWarnings.find(
      (warning) => warning.code === TOPOLOGY_WARNING_CODES.STRUCTURAL_TRANSITION_NOT_MODELED
    );
    const annulusTransitionEdges = result.edges.filter(
      (edge) => edge.reason?.ruleId === 'annulus-family-transition'
    );
    const transitionPairs = annulusTransitionEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));

    expect(structuralWarning).toBeUndefined();
    expect(transitionPairs).toContain('ANNULUS_E->ANNULUS_F');
  });

  it('computes transition cost/blocking from material and per-volume equipment effects', () => {
    const definition = {
      fromNode: {
        nodeId: 'node:ANNULUS_A:0',
        kind: 'ANNULUS_A',
        meta: { isBlocked: false }
      },
      toNode: {
        nodeId: 'node:TUBING_ANNULUS:1',
        kind: 'TUBING_ANNULUS',
        meta: { isBlocked: false }
      },
      equipmentVolumeKinds: ['TUBING_ANNULUS', 'ANNULUS_A']
    };

    const equipmentBlockedState = resolveStructuralTransitionState(definition, {
      byVolume: {
        TUBING_ANNULUS: {
          blocked: false,
          cost: 0,
          contributors: [{ rowId: 'eq-tbg', reason: 'observer' }]
        },
        ANNULUS_A: {
          blocked: true,
          cost: 1,
          contributors: [{ rowId: 'eq-ann-a', reason: 'sealed' }]
        }
      }
    });

    expect(equipmentBlockedState.blockedByMaterial).toBe(false);
    expect(equipmentBlockedState.blockedByEquipment).toBe(true);
    expect(equipmentBlockedState.cost).toBe(1);
    expect(equipmentBlockedState.equipmentContributors).toEqual([
      { rowId: 'eq-tbg', reason: 'observer' },
      { rowId: 'eq-ann-a', reason: 'sealed' }
    ]);

    const materialBlockedState = resolveStructuralTransitionState({
      ...definition,
      fromNode: {
        ...definition.fromNode,
        meta: { isBlocked: true }
      }
    });

    expect(materialBlockedState.blockedByMaterial).toBe(true);
    expect(materialBlockedState.blockedByEquipment).toBe(false);
    expect(materialBlockedState.cost).toBe(1);
  });
});
