import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';

function createBaseState() {
  return {
    casingData: [
      { rowId: 'csg-outer', label: 'Outer', top: 0, bottom: 10000, od: 16, weight: 58, show: true },
      { rowId: 'csg-middle', label: 'Middle', top: 0, bottom: 10000, od: 13.375, weight: 54.5, show: true },
      { rowId: 'csg-inner', label: 'Inner', top: 0, bottom: 10000, od: 9.625, weight: 40, show: true }
    ],
    tubingData: [],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [],
    trajectory: [],
    config: {},
    interaction: {}
  };
}

describe('scenario cross-annulus failure entities', () => {
  it('builds explicit cross-annulus radial edges from scenario rows', () => {
    const state = createBaseState();
    state.topologySources = [
      {
        rowId: 'source-annulus-a',
        top: 6500,
        bottom: 6700,
        sourceType: 'formation_inflow',
        volumeKey: 'ANNULUS_A',
        show: true
      },
      {
        rowId: 'breakout-a-b',
        top: 6500,
        bottom: 6700,
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        sourceType: 'cross_annulus_failure',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 11, wellId: 'scenario-breakout' });
    const breakoutEdges = result.edges.filter((edge) => edge.kind === 'radial' && edge.meta?.scenarioBreakoutRowId === 'breakout-a-b');
    const breakoutWarning = result.validationWarnings.find((warning) => warning.code === 'scenario_breakout_unsupported_volume_pair');

    expect(breakoutEdges.length).toBeGreaterThan(0);
    expect(breakoutEdges.every((edge) => edge.meta?.fromVolumeKey === 'ANNULUS_A')).toBe(true);
    expect(breakoutEdges.every((edge) => edge.meta?.toVolumeKey === 'ANNULUS_B')).toBe(true);
    expect(breakoutWarning).toBeUndefined();
  });

  it('does not force explicit source mode when only breakout rows are present', () => {
    const state = createBaseState();
    state.topologySources = [
      {
        rowId: 'breakout-a-b-only',
        top: 6500,
        bottom: 6700,
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        sourceType: 'cross_annulus_failure',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 12, wellId: 'breakout-only' });
    const breakoutEdges = result.edges.filter((edge) => edge.kind === 'radial' && edge.meta?.scenarioBreakoutRowId === 'breakout-a-b-only');

    expect(breakoutEdges.length).toBeGreaterThan(0);
    expect(result.sourceEntities).toHaveLength(0);
    expect(result.sourcePolicy?.mode).toBe('marker_default');
  });

  it('emits deterministic warning when breakout pair is incomplete', () => {
    const state = createBaseState();
    state.topologySources = [
      {
        rowId: 'breakout-missing-target',
        top: 6500,
        bottom: 6700,
        fromVolumeKey: 'ANNULUS_A',
        sourceType: 'cross_annulus_failure',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 13, wellId: 'breakout-missing-target' });
    const warning = result.validationWarnings.find((candidate) => candidate.code === 'scenario_breakout_missing_volume_pair');

    expect(warning).toBeDefined();
    expect(result.sourcePolicy?.mode).toBe('marker_default');
  });

  it('falls back to marker-driven sources when explicit scenario rows resolve no nodes', () => {
    const state = createBaseState();
    state.markers = [
      {
        rowId: 'perf-fallback',
        type: 'Perforation',
        top: 6500,
        bottom: 6600,
        attachToId: 'csg-inner',
        attachToHostType: 'casing',
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'source-tbg-annulus-unresolved',
        top: 6500,
        bottom: 6700,
        sourceType: 'scenario',
        volumeKey: 'TUBING_ANNULUS',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 14, wellId: 'explicit-unresolved-fallback' });
    const warningCodes = new Set(result.validationWarnings.map((warning) => warning?.code));
    const perforationSource = result.sourceEntities.find((source) => source.rowId === 'perf-fallback');
    const scenarioSource = result.sourceEntities.find((source) => source.rowId === 'source-tbg-annulus-unresolved');

    expect(result.sourcePolicy?.mode).toBe('marker_default');
    expect(perforationSource?.origin).toBe('marker');
    expect(scenarioSource).toBeUndefined();
    expect(result.activeFlowNodeIds.length).toBeGreaterThan(0);
    expect(warningCodes.has('scenario_source_no_resolvable_interval')).toBe(true);
    expect(warningCodes.has('scenario_rows_with_no_resolved_nodes')).toBe(true);
    expect(warningCodes.has('explicit_scenario_source_mode_active')).toBe(false);
  });
});
