import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';
import { normalizeSourceVolumeKind } from '@/topology/topologyTypes.js';

function createBaseState() {
  return {
    casingData: [
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 9.625,
        weight: 40,
        grade: 'L80',
        top: 0,
        bottom: 5000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner',
        label: 'Inner Casing',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 0,
        bottom: 4500,
        toc: null,
        boc: null,
        show: true
      }
    ],
    tubingData: [],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [],
    trajectory: [],
    config: {
      operationPhase: 'production'
    },
    interaction: {}
  };
}

describe('topology canonical first-annulus volume semantics', () => {
  it('accepts canonical annulus source keys and rejects removed tubing-annulus aliases', () => {
    expect(normalizeSourceVolumeKind('TUBING_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('tubing annulus')).toBe(null);
    expect(normalizeSourceVolumeKind('PRIMARY_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('PRODUCTION_ANNULUS')).toBe(null);
    expect(normalizeSourceVolumeKind('CASING_ANNULUS_A')).toBe('ANNULUS_A');
    expect(normalizeSourceVolumeKind('ANNULUS_E')).toBe('ANNULUS_E');
    expect(normalizeSourceVolumeKind('ANNULUS_F')).toBe('ANNULUS_F');
    expect(normalizeSourceVolumeKind('OPEN_HOLE')).toBe('FORMATION_ANNULUS');
    expect(normalizeSourceVolumeKind('open hole')).toBe('FORMATION_ANNULUS');
  });

  it('resolves ANNULUS_A as first annulus in both tubing-present and tubing-absent states', () => {
    const stateWithTubing = createBaseState();
    stateWithTubing.tubingData = [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        od: 4.5,
        weight: 12.6,
        top: 0,
        bottom: 3500,
        show: true
      }
    ];
    stateWithTubing.topologySources = [
      {
        rowId: 'src-annulus-a',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1200,
        bottom: 1300,
        show: true
      }
    ];

    const withTubing = buildTopologyModel(stateWithTubing, { requestId: 1, wellId: 'with-tubing-annulus' });
    const annulusASourceWithTubing = withTubing.sourceEntities.find((source) => source.rowId === 'src-annulus-a');
    const noIntervalWarningWithTubing = withTubing.validationWarnings.find(
      (warning) => warning.code === 'scenario_source_no_resolvable_interval'
    );

    expect(withTubing.nodes.some((node) => node.kind === 'TUBING_ANNULUS')).toBe(false);
    expect(withTubing.nodes.some((node) => node.kind === 'ANNULUS_A')).toBe(true);
    expect(annulusASourceWithTubing?.volumeKey).toBe('ANNULUS_A');
    expect((annulusASourceWithTubing?.nodeIds?.length ?? 0) > 0).toBe(true);
    expect(noIntervalWarningWithTubing).toBeUndefined();

    const stateWithoutTubing = createBaseState();
    stateWithoutTubing.topologySources = [
      {
        rowId: 'src-annulus-a',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1200,
        bottom: 1300,
        show: true
      }
    ];

    const withoutTubing = buildTopologyModel(stateWithoutTubing, { requestId: 2, wellId: 'without-tubing-annulus' });
    const annulusASourceWithoutTubing = withoutTubing.sourceEntities.find((source) => source.rowId === 'src-annulus-a');
    const noIntervalWarningWithoutTubing = withoutTubing.validationWarnings.find(
      (warning) => warning.code === 'scenario_source_no_resolvable_interval'
    );

    expect(annulusASourceWithoutTubing?.volumeKey).toBe('ANNULUS_A');
    expect((annulusASourceWithoutTubing?.nodeIds?.length ?? 0) > 0).toBe(true);
    expect(noIntervalWarningWithoutTubing).toBeUndefined();
  });

  it('does not emit legacy tubing-annulus transition edges after canonical annulus mapping', () => {
    const state = createBaseState();
    state.tubingData = [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        od: 4.5,
        weight: 12.6,
        top: 1000,
        bottom: 2000,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 3, wellId: 'tubing-boundary-transition' });
    const legacyTransitionEdges = result.edges.filter((edge) => edge.reason?.ruleId === 'tubing-annulus-transition');

    expect(legacyTransitionEdges).toHaveLength(0);
    expect(result.nodes.some((node) => node.kind === 'TUBING_ANNULUS')).toBe(false);
  });

  it('emits deterministic tubing-end-transfer edges with canonical annulus mapping', () => {
    const state = createBaseState();
    state.tubingData = [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        od: 4.5,
        weight: 12.6,
        top: 1000,
        bottom: 2000,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 31, wellId: 'tubing-end-transfer-transition' });
    const transferEdges = result.edges.filter((edge) => edge.reason?.ruleId === 'tubing-end-transfer');
    const transitionTypes = new Set(transferEdges.map((edge) => edge.meta?.transitionType));

    expect(transferEdges).toHaveLength(3);
    expect(transitionTypes.has('tubing_end_transfer_entry')).toBe(true);
    expect(transitionTypes.has('tubing_end_transfer_exit')).toBe(true);
    expect(transferEdges.some((edge) => (
      edge.meta?.fromVolumeKey === 'TUBING_INNER' && edge.meta?.toVolumeKey === 'ANNULUS_A'
    ))).toBe(true);
  });

  it('emits blocked tubing-end transfer exit edge for tubing-host packer with canonical annulus mapping', () => {
    const state = createBaseState();
    state.tubingData = [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        od: 4.5,
        weight: 12.6,
        top: 1000,
        bottom: 2000,
        show: true
      }
    ];
    state.equipmentData = [
      {
        rowId: 'eq-packer-end',
        type: 'Packer',
        depth: 2000,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        actuationState: 'static',
        integrityStatus: 'intact',
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 32, wellId: 'tubing-end-transfer-packer-sealed' });
    const transferExitEdge = result.edges.find((edge) => (
      edge.reason?.ruleId === 'tubing-end-transfer'
      && edge.meta?.transitionType === 'tubing_end_transfer_exit'
    ));

    expect(transferExitEdge).toBeDefined();
    expect(transferExitEdge?.meta?.toVolumeKey).toBe('ANNULUS_A');
    expect(transferExitEdge?.cost).toBe(1);
  });

  it('keeps deterministic tubing-end transfer exit edges for below-packer scenario', () => {
    const state = createBaseState();
    state.casingData = [
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 13.375,
        weight: 54.5,
        grade: 'L80',
        top: 0,
        bottom: 12000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner',
        label: 'Inner Liner',
        od: 9.625,
        weight: 40,
        grade: 'L80',
        top: 0,
        bottom: 12000,
        toc: 8000,
        boc: null,
        show: true
      }
    ];
    state.tubingData = [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        od: 4.5,
        weight: 12.6,
        top: 0,
        bottom: 10000,
        show: true
      }
    ];
    state.equipmentData = [
      {
        rowId: 'eq-packer-lower',
        type: 'Packer',
        depth: 9431,
        attachToHostType: 'tubing',
        attachToId: 'tbg-1',
        actuationState: 'static',
        integrityStatus: 'intact',
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'src-tbg-inner',
        sourceType: 'scenario',
        volumeKey: 'TUBING_INNER',
        top: 8500,
        bottom: 8600,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 33, wellId: 'tubing-end-transfer-local-annulus' });
    const transferExitEdges = result.edges.filter((edge) => (
      edge.reason?.ruleId === 'tubing-end-transfer'
      && edge.meta?.transitionType === 'tubing_end_transfer_exit'
    ));
    expect(transferExitEdges).toHaveLength(2);
    expect(transferExitEdges.every((edge) => edge.meta?.toVolumeKey === 'ANNULUS_A')).toBe(true);
  });

  it('creates explicit ANNULUS_A <-> ANNULUS_B structural transitions for mapped non-tubing casing-family boundaries', () => {
    const state = createBaseState();
    state.casingData = [
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 13.375,
        weight: 54.5,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-middle',
        label: 'Middle Casing',
        od: 9.625,
        weight: 47,
        grade: 'L80',
        top: 0,
        bottom: 9500,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner-liner',
        label: 'Inner Liner',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 1000,
        bottom: 2000,
        toc: null,
        boc: null,
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'src-annulus-a',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1200,
        bottom: 1300,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 4, wellId: 'annulus-family-structural-transition' });
    const annulusFamilyTransitionEdges = result.edges.filter(
      (edge) => edge.reason?.ruleId === 'annulus-family-transition'
    );
    const edgePairs = annulusFamilyTransitionEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));
    const warningCodes = new Set(
      result.validationWarnings.map((warning) => warning?.code)
    );

    expect(edgePairs).toContain('ANNULUS_A->ANNULUS_B');
    expect(edgePairs).toContain('ANNULUS_B->ANNULUS_A');
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);
  });

  it('keeps ANNULUS_C source path to surface at zero failure cost through mapped ANNULUS_C <-> ANNULUS_B transitions', () => {
    const state = createBaseState();
    state.casingData = [
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 16,
        weight: 65,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer-middle',
        label: 'Outer Middle Casing',
        od: 13.375,
        weight: 54.5,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-middle',
        label: 'Middle Casing',
        od: 9.625,
        weight: 47,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner-liner',
        label: 'Inner Liner',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 1500,
        bottom: 6500,
        toc: null,
        boc: null,
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'src-annulus-c',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_C',
        top: 2200,
        bottom: 2400,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 5, wellId: 'annulus-c-transition-path' });
    const edgeById = new Map(result.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = result.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`);

    expect(result.minFailureCostToSurface).toBe(0);
    expect(result.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs.some((pair) => (
      pair === 'ANNULUS_B->ANNULUS_C' || pair === 'ANNULUS_C->ANNULUS_B'
    ))).toBe(true);
  });

  it('keeps ANNULUS_D source path to surface at zero failure cost through mapped ANNULUS_D <-> ANNULUS_C transitions', () => {
    const state = createBaseState();
    state.casingData = [
      {
        rowId: 'csg-outermost',
        label: 'Outermost Casing',
        od: 20,
        weight: 94,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 16,
        weight: 65,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer-middle',
        label: 'Outer Middle Casing',
        od: 13.375,
        weight: 54.5,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-middle',
        label: 'Middle Casing',
        od: 9.625,
        weight: 47,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner-liner',
        label: 'Inner Liner',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 1500,
        bottom: 6500,
        toc: null,
        boc: null,
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'src-annulus-d',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_D',
        top: 2200,
        bottom: 2400,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 6, wellId: 'annulus-d-transition-path' });
    const edgeById = new Map(result.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = result.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`);

    expect(result.minFailureCostToSurface).toBe(0);
    expect(result.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs.some((pair) => (
      pair === 'ANNULUS_C->ANNULUS_D' || pair === 'ANNULUS_D->ANNULUS_C'
    ))).toBe(true);
  });

  it('keeps FORMATION_ANNULUS source path to surface at zero failure cost through mapped ANNULUS_D <-> FORMATION transitions', () => {
    const state = createBaseState();
    state.casingData = [
      {
        rowId: 'csg-outermost',
        label: 'Outermost Casing',
        od: 20,
        weight: 94,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'open-hole-1',
        label: 'Open Hole',
        od: 22,
        weight: 0,
        grade: 'OH',
        top: 4000,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 16,
        weight: 65,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer-middle',
        label: 'Outer Middle Casing',
        od: 13.375,
        weight: 54.5,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-middle',
        label: 'Middle Casing',
        od: 9.625,
        weight: 47,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner-liner',
        label: 'Inner Liner',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 1500,
        bottom: 6500,
        toc: null,
        boc: null,
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'src-formation-annulus',
        sourceType: 'scenario',
        volumeKey: 'FORMATION_ANNULUS',
        top: 6200,
        bottom: 6400,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 7, wellId: 'formation-transition-path' });
    const edgeById = new Map(result.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = result.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`);
    const warningCodes = new Set(result.validationWarnings.map((warning) => warning?.code));

    expect(result.minFailureCostToSurface).toBe(0);
    expect(result.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs).toContain('ANNULUS_D->FORMATION_ANNULUS');
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);
  });

  it('keeps ANNULUS_E source path to surface at zero failure cost through mapped ANNULUS_E <-> ANNULUS_D transitions', () => {
    const state = createBaseState();
    state.casingData = [
      {
        rowId: 'csg-outermost',
        label: 'Outermost Casing',
        od: 20,
        weight: 94,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 16,
        weight: 65,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer-middle',
        label: 'Outer Middle Casing',
        od: 13.375,
        weight: 54.5,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-middle',
        label: 'Middle Casing',
        od: 11.75,
        weight: 47,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner-middle',
        label: 'Inner Middle Casing',
        od: 9.625,
        weight: 40,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner-liner',
        label: 'Inner Liner',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 1500,
        bottom: 6500,
        toc: null,
        boc: null,
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'src-annulus-e',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_E',
        top: 2200,
        bottom: 2400,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 8, wellId: 'annulus-e-transition-path' });
    const edgeById = new Map(result.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = result.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`);
    const warningCodes = new Set(result.validationWarnings.map((warning) => warning?.code));

    expect(result.minFailureCostToSurface).toBe(0);
    expect(result.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs.some((pair) => (
      pair === 'ANNULUS_D->ANNULUS_E' || pair === 'ANNULUS_E->ANNULUS_D'
    ))).toBe(true);
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);
  });

  it('keeps ANNULUS_F source path to surface at zero failure cost through mapped ANNULUS_F <-> ANNULUS_E transitions', () => {
    const state = createBaseState();
    state.casingData = [
      {
        rowId: 'csg-outer-ultra',
        label: 'Ultra Outer Casing',
        od: 24,
        weight: 118,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outermost',
        label: 'Outermost Casing',
        od: 20,
        weight: 94,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        od: 16,
        weight: 65,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-outer-middle',
        label: 'Outer Middle Casing',
        od: 13.375,
        weight: 54.5,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-middle',
        label: 'Middle Casing',
        od: 11.75,
        weight: 47,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner-middle',
        label: 'Inner Middle Casing',
        od: 9.625,
        weight: 40,
        grade: 'L80',
        top: 0,
        bottom: 10000,
        toc: null,
        boc: null,
        show: true
      },
      {
        rowId: 'csg-inner-liner',
        label: 'Inner Liner',
        od: 7,
        weight: 29,
        grade: 'L80',
        top: 1500,
        bottom: 6500,
        toc: null,
        boc: null,
        show: true
      }
    ];
    state.topologySources = [
      {
        rowId: 'src-annulus-f',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_F',
        top: 2200,
        bottom: 2400,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 9, wellId: 'annulus-f-transition-path' });
    const edgeById = new Map(result.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = result.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`);
    const warningCodes = new Set(result.validationWarnings.map((warning) => warning?.code));

    expect(result.minFailureCostToSurface).toBe(0);
    expect(result.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs.some((pair) => (
      pair === 'ANNULUS_E->ANNULUS_F' || pair === 'ANNULUS_F->ANNULUS_E'
    ))).toBe(true);
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);
  });
});