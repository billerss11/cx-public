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
    annotationBoxes: [],
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

describe('topology tubing-annulus volume semantics', () => {
  it('treats TUBING_ANNULUS as a first-class source volume key', () => {
    expect(normalizeSourceVolumeKind('TUBING_ANNULUS')).toBe('TUBING_ANNULUS');
    expect(normalizeSourceVolumeKind('tubing annulus')).toBe('TUBING_ANNULUS');
    expect(normalizeSourceVolumeKind('PRIMARY_ANNULUS')).toBe('TUBING_ANNULUS');
    expect(normalizeSourceVolumeKind('PRODUCTION_ANNULUS')).toBe('TUBING_ANNULUS');
    expect(normalizeSourceVolumeKind('CASING_ANNULUS_A')).toBe('ANNULUS_A');
    expect(normalizeSourceVolumeKind('ANNULUS_E')).toBe('ANNULUS_E');
    expect(normalizeSourceVolumeKind('ANNULUS_F')).toBe('ANNULUS_F');
    expect(normalizeSourceVolumeKind('OPEN_HOLE')).toBe('FORMATION_ANNULUS');
    expect(normalizeSourceVolumeKind('open hole')).toBe('FORMATION_ANNULUS');
  });

  it('resolves TUBING_ANNULUS sources only where tubing-annulus nodes exist', () => {
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
        rowId: 'src-tbg-annulus',
        sourceType: 'scenario',
        volumeKey: 'TUBING_ANNULUS',
        top: 1200,
        bottom: 1300,
        show: true
      }
    ];

    const withTubing = buildTopologyModel(stateWithTubing, { requestId: 1, wellId: 'with-tubing-annulus' });
    const tubingAnnulusSource = withTubing.sourceEntities.find((source) => source.rowId === 'src-tbg-annulus');
    const noIntervalWarningWithTubing = withTubing.validationWarnings.find(
      (warning) => warning.code === 'scenario_source_no_resolvable_interval'
    );

    expect(withTubing.nodes.some((node) => node.kind === 'TUBING_ANNULUS')).toBe(true);
    expect(withTubing.nodes.some((node) => node.kind === 'ANNULUS_A')).toBe(true);
    expect(tubingAnnulusSource?.volumeKey).toBe('TUBING_ANNULUS');
    expect(tubingAnnulusSource?.nodeIds.every((nodeId) => nodeId.includes('TUBING_ANNULUS'))).toBe(true);
    expect(noIntervalWarningWithTubing).toBeUndefined();

    const stateWithoutTubing = createBaseState();
    stateWithoutTubing.topologySources = [
      {
        rowId: 'src-tbg-annulus',
        sourceType: 'scenario',
        volumeKey: 'TUBING_ANNULUS',
        top: 1200,
        bottom: 1300,
        show: true
      }
    ];

    const withoutTubing = buildTopologyModel(stateWithoutTubing, { requestId: 2, wellId: 'without-tubing-annulus' });
    const noIntervalWarningWithoutTubing = withoutTubing.validationWarnings.find(
      (warning) => warning.code === 'scenario_source_no_resolvable_interval'
    );
    const unsupportedVolumeWarning = withoutTubing.validationWarnings.find(
      (warning) => warning.code === 'scenario_source_unsupported_volume'
    );

    expect(withoutTubing.sourceEntities).toHaveLength(0);
    expect(noIntervalWarningWithoutTubing).toBeDefined();
    expect(unsupportedVolumeWarning).toBeUndefined();
  });

  it('creates explicit ANNULUS_A <-> TUBING_ANNULUS transition edges at tubing boundaries', () => {
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
    const nodeKindById = new Map(result.nodes.map((node) => [node.nodeId, node.kind]));
    const transitionEdges = result.edges.filter((edge) => edge.reason?.ruleId === 'tubing-annulus-transition');

    const edgePairs = transitionEdges.map((edge) => (
      `${nodeKindById.get(edge.from)}->${nodeKindById.get(edge.to)}`
    ));

    expect(transitionEdges.length).toBeGreaterThanOrEqual(2);
    expect(edgePairs).toContain('ANNULUS_A->TUBING_ANNULUS');
    expect(edgePairs).toContain('TUBING_ANNULUS->ANNULUS_A');
  });

  it('creates explicit tubing-end transfer edges between TUBING_INNER and ANNULUS_A at tubing boundaries', () => {
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
    const edgePairs = transferEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));
    const transitionKinds = new Set(transferEdges.map((edge) => edge.meta?.transitionType));

    expect(transitionKinds.has('tubing_end_transfer_entry')).toBe(true);
    expect(transitionKinds.has('tubing_end_transfer_exit')).toBe(true);
    expect(edgePairs).toContain('ANNULUS_A->TUBING_INNER');
    expect(edgePairs).toContain('TUBING_INNER->ANNULUS_A');
  });

  it('marks tubing-end transfer exit edge as closed_failable when tubing-host packer seals boundary annulus', () => {
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
    expect(transferExitEdge?.state).toBe('closed_failable');
    expect(transferExitEdge?.cost).toBe(1);
    expect(transferExitEdge?.reason?.details?.blockedByEquipment).toBe(true);
  });

  it('keeps below-packer tubing annulus active when tubing-end transfer to ANNULUS_A is material-blocked', () => {
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
    const transitionPairs = transferExitEdges.map((edge) => (
      `${edge.meta?.fromVolumeKey}->${edge.meta?.toVolumeKey}`
    ));
    const blockedAnnulusATransfer = transferExitEdges.find((edge) => (
      edge.meta?.toVolumeKey === 'ANNULUS_A'
    ));
    const localTubingAnnulusTransfer = transferExitEdges.find((edge) => (
      edge.meta?.toVolumeKey === 'TUBING_ANNULUS'
    ));
    const belowPackerTubingAnnulusNode = result.nodes.find((node) => (
      node?.kind === 'TUBING_ANNULUS'
      && Number(node?.depthTop) >= 9431 - 1e-6
      && Number(node?.depthBottom) >= 10000 - 1e-6
    ));
    const activeNodeIdSet = new Set(result.activeFlowNodeIds);

    expect(transitionPairs).toContain('TUBING_INNER->ANNULUS_A');
    expect(transitionPairs).toContain('TUBING_INNER->TUBING_ANNULUS');
    expect(blockedAnnulusATransfer?.state).toBe('closed_failable');
    expect(localTubingAnnulusTransfer?.state).toBe('open');
    expect(localTubingAnnulusTransfer?.cost).toBe(0);
    expect(belowPackerTubingAnnulusNode).toBeDefined();
    expect(activeNodeIdSet.has(belowPackerTubingAnnulusNode?.nodeId)).toBe(true);
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
