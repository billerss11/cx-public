import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';
import { resolveTopologyOverlaySynchronizationState } from '@/topology/resultSynchronization.js';
import { createContext, getIntervals, getStackAtDepth } from '@/physics/physicsCore.js';
import { resolveTrajectoryPointsFromRows } from '@/app/trajectoryMathCore.mjs';
import { buildDirectionalProjector } from '@/components/schematic/layers/directionalProjection.js';
import { buildDirectionalTopologyOverlayEntries } from '@/components/schematic/layers/directionalTopologyOverlayModel.js';

function countEntriesByStyle(entries = []) {
  return entries.reduce((counts, entry) => {
    const key = `${entry.fill}|${entry.stroke}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function buildDirectionalOverlayInputs({
  includeTubing = true,
  sourceVolumeKey = includeTubing ? 'TUBING_ANNULUS' : 'ANNULUS_A'
} = {}) {
  const tubingRows = includeTubing
    ? [{ rowId: 'tbg-1', od: 4.5, weight: 12.6, top: 1500, bottom: 6500, show: true }]
    : [];
  const stateSnapshot = {
    casingData: [
      { rowId: 'csg-1', od: 13.375, weight: 54.5, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-2', od: 9.625, weight: 47, top: 0, bottom: 9500, show: true },
      { rowId: 'csg-3', od: 7, weight: 29, top: 0, bottom: 9000, show: true }
    ],
    tubingData: tubingRows,
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [
      {
        rowId: 'src-1',
        sourceType: 'scenario',
        volumeKey: sourceVolumeKey,
        top: 2200,
        bottom: 2600,
        show: true
      }
    ],
    trajectory: [
      { md: 0, inc: 0, azi: 0 },
      { md: 2000, inc: 18, azi: 35 },
      { md: 4500, inc: 42, azi: 70 },
      { md: 7500, inc: 50, azi: 95 },
      { md: 10000, inc: 58, azi: 120 }
    ],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {}
  };

  const topologyResult = buildTopologyModel(stateSnapshot, {
    requestId: 1,
    wellId: 'directional-tubing-transition'
  });
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    stateSnapshot.trajectory,
    stateSnapshot.config,
    { casingData: stateSnapshot.casingData }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context).map((interval) => {
    const top = Math.max(0, Number(interval?.top));
    const bottom = Math.min(totalMD, Number(interval?.bottom));
    const midpoint = (top + bottom) / 2;
    return {
      top,
      bottom,
      midpoint,
      stack: getStackAtDepth(midpoint, context)
    };
  });
  const projector = buildDirectionalProjector(
    trajectoryPoints,
    (value) => value,
    (value) => value,
    { xExaggeration: 1, xOrigin: 0 }
  );

  return {
    topologyResult,
    intervals,
    projector
  };
}

function buildDirectionalAnnulusFamilyTransitionInputs() {
  const stateSnapshot = {
    casingData: [
      { rowId: 'csg-outer', od: 13.375, weight: 54.5, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-middle', od: 9.625, weight: 47, top: 0, bottom: 9500, show: true },
      { rowId: 'csg-inner-liner', od: 7, weight: 29, top: 1500, bottom: 6500, show: true }
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
    topologySources: [
      {
        rowId: 'src-a',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 2200,
        bottom: 2600,
        show: true
      }
    ],
    trajectory: [
      { md: 0, inc: 0, azi: 0 },
      { md: 2000, inc: 18, azi: 35 },
      { md: 4500, inc: 42, azi: 70 },
      { md: 7500, inc: 50, azi: 95 },
      { md: 10000, inc: 58, azi: 120 }
    ],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {}
  };

  const topologyResult = buildTopologyModel(stateSnapshot, {
    requestId: 1,
    wellId: 'directional-annulus-family-transition'
  });
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    stateSnapshot.trajectory,
    stateSnapshot.config,
    { casingData: stateSnapshot.casingData }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context).map((interval) => {
    const top = Math.max(0, Number(interval?.top));
    const bottom = Math.min(totalMD, Number(interval?.bottom));
    const midpoint = (top + bottom) / 2;
    return {
      top,
      bottom,
      midpoint,
      stack: getStackAtDepth(midpoint, context)
    };
  });
  const projector = buildDirectionalProjector(
    trajectoryPoints,
    (value) => value,
    (value) => value,
    { xExaggeration: 1, xOrigin: 0 }
  );

  return {
    topologyResult,
    intervals,
    projector
  };
}

function buildDirectionalAnnulusFamilyBCTransitionInputs() {
  const stateSnapshot = {
    casingData: [
      { rowId: 'csg-outer', od: 16, weight: 65, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outer-middle', od: 13.375, weight: 54.5, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-middle', od: 9.625, weight: 47, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-inner-liner', od: 7, weight: 29, top: 1500, bottom: 6500, show: true }
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
    topologySources: [
      {
        rowId: 'src-c',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_C',
        top: 2200,
        bottom: 2600,
        show: true
      }
    ],
    trajectory: [
      { md: 0, inc: 0, azi: 0 },
      { md: 2000, inc: 18, azi: 35 },
      { md: 4500, inc: 42, azi: 70 },
      { md: 7500, inc: 50, azi: 95 },
      { md: 10000, inc: 58, azi: 120 }
    ],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {}
  };

  const topologyResult = buildTopologyModel(stateSnapshot, {
    requestId: 1,
    wellId: 'directional-annulus-family-bc-transition'
  });
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    stateSnapshot.trajectory,
    stateSnapshot.config,
    { casingData: stateSnapshot.casingData }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context).map((interval) => {
    const top = Math.max(0, Number(interval?.top));
    const bottom = Math.min(totalMD, Number(interval?.bottom));
    const midpoint = (top + bottom) / 2;
    return {
      top,
      bottom,
      midpoint,
      stack: getStackAtDepth(midpoint, context)
    };
  });
  const projector = buildDirectionalProjector(
    trajectoryPoints,
    (value) => value,
    (value) => value,
    { xExaggeration: 1, xOrigin: 0 }
  );

  return {
    topologyResult,
    intervals,
    projector
  };
}

function buildDirectionalAnnulusFamilyCDTransitionInputs() {
  const stateSnapshot = {
    casingData: [
      { rowId: 'csg-outermost', od: 20, weight: 94, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outer', od: 16, weight: 65, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outer-middle', od: 13.375, weight: 54.5, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-middle', od: 9.625, weight: 47, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-inner-liner', od: 7, weight: 29, top: 1500, bottom: 6500, show: true }
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
    topologySources: [
      {
        rowId: 'src-d',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_D',
        top: 2200,
        bottom: 2600,
        show: true
      }
    ],
    trajectory: [
      { md: 0, inc: 0, azi: 0 },
      { md: 2000, inc: 18, azi: 35 },
      { md: 4500, inc: 42, azi: 70 },
      { md: 7500, inc: 50, azi: 95 },
      { md: 10000, inc: 58, azi: 120 }
    ],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {}
  };

  const topologyResult = buildTopologyModel(stateSnapshot, {
    requestId: 1,
    wellId: 'directional-annulus-family-cd-transition'
  });
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    stateSnapshot.trajectory,
    stateSnapshot.config,
    { casingData: stateSnapshot.casingData }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context).map((interval) => {
    const top = Math.max(0, Number(interval?.top));
    const bottom = Math.min(totalMD, Number(interval?.bottom));
    const midpoint = (top + bottom) / 2;
    return {
      top,
      bottom,
      midpoint,
      stack: getStackAtDepth(midpoint, context)
    };
  });
  const projector = buildDirectionalProjector(
    trajectoryPoints,
    (value) => value,
    (value) => value,
    { xExaggeration: 1, xOrigin: 0 }
  );

  return {
    topologyResult,
    intervals,
    projector
  };
}

function buildDirectionalAnnulusFamilyDFTransitionInputs() {
  const stateSnapshot = {
    casingData: [
      {
        rowId: 'csg-outermost',
        od: 20,
        weight: 94,
        top: 0,
        bottom: 10000,
        show: true
      },
      { rowId: 'open-hole-1', od: 22, weight: 0, grade: 'OH', top: 4000, bottom: 10000, show: true },
      { rowId: 'csg-outer', od: 16, weight: 65, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outer-middle', od: 13.375, weight: 54.5, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-middle', od: 9.625, weight: 47, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-inner-liner', od: 7, weight: 29, top: 1500, bottom: 6500, show: true }
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
    topologySources: [
      {
        rowId: 'src-formation',
        sourceType: 'scenario',
        volumeKey: 'FORMATION_ANNULUS',
        top: 6200,
        bottom: 6400,
        show: true
      }
    ],
    trajectory: [
      { md: 0, inc: 0, azi: 0 },
      { md: 2000, inc: 18, azi: 35 },
      { md: 4500, inc: 42, azi: 70 },
      { md: 7500, inc: 50, azi: 95 },
      { md: 10000, inc: 58, azi: 120 }
    ],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {}
  };

  const topologyResult = buildTopologyModel(stateSnapshot, {
    requestId: 1,
    wellId: 'directional-annulus-family-df-transition'
  });
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    stateSnapshot.trajectory,
    stateSnapshot.config,
    { casingData: stateSnapshot.casingData }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context).map((interval) => {
    const top = Math.max(0, Number(interval?.top));
    const bottom = Math.min(totalMD, Number(interval?.bottom));
    const midpoint = (top + bottom) / 2;
    return {
      top,
      bottom,
      midpoint,
      stack: getStackAtDepth(midpoint, context)
    };
  });
  const projector = buildDirectionalProjector(
    trajectoryPoints,
    (value) => value,
    (value) => value,
    { xExaggeration: 1, xOrigin: 0 }
  );

  return {
    topologyResult,
    intervals,
    projector
  };
}

function buildDirectionalAnnulusFamilyDETransitionInputs() {
  const stateSnapshot = {
    casingData: [
      { rowId: 'csg-outermost', od: 20, weight: 94, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outer', od: 16, weight: 65, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outer-middle', od: 13.375, weight: 54.5, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-middle', od: 11.75, weight: 47, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-inner-middle', od: 9.625, weight: 40, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-inner-liner', od: 7, weight: 29, top: 1500, bottom: 6500, show: true }
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
    topologySources: [
      {
        rowId: 'src-e',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_E',
        top: 2200,
        bottom: 2600,
        show: true
      }
    ],
    trajectory: [
      { md: 0, inc: 0, azi: 0 },
      { md: 2000, inc: 18, azi: 35 },
      { md: 4500, inc: 42, azi: 70 },
      { md: 7500, inc: 50, azi: 95 },
      { md: 10000, inc: 58, azi: 120 }
    ],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {}
  };

  const topologyResult = buildTopologyModel(stateSnapshot, {
    requestId: 1,
    wellId: 'directional-annulus-family-de-transition'
  });
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    stateSnapshot.trajectory,
    stateSnapshot.config,
    { casingData: stateSnapshot.casingData }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context).map((interval) => {
    const top = Math.max(0, Number(interval?.top));
    const bottom = Math.min(totalMD, Number(interval?.bottom));
    const midpoint = (top + bottom) / 2;
    return {
      top,
      bottom,
      midpoint,
      stack: getStackAtDepth(midpoint, context)
    };
  });
  const projector = buildDirectionalProjector(
    trajectoryPoints,
    (value) => value,
    (value) => value,
    { xExaggeration: 1, xOrigin: 0 }
  );

  return {
    topologyResult,
    intervals,
    projector
  };
}

function buildDirectionalAnnulusFamilyEFTransitionInputs() {
  const stateSnapshot = {
    casingData: [
      { rowId: 'csg-outer-ultra', od: 24, weight: 118, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outermost', od: 20, weight: 94, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outer', od: 16, weight: 65, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-outer-middle', od: 13.375, weight: 54.5, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-middle', od: 11.75, weight: 47, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-inner-middle', od: 9.625, weight: 40, top: 0, bottom: 10000, show: true },
      { rowId: 'csg-inner-liner', od: 7, weight: 29, top: 1500, bottom: 6500, show: true }
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
    topologySources: [
      {
        rowId: 'src-f',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_F',
        top: 2200,
        bottom: 2600,
        show: true
      }
    ],
    trajectory: [
      { md: 0, inc: 0, azi: 0 },
      { md: 2000, inc: 18, azi: 35 },
      { md: 4500, inc: 42, azi: 70 },
      { md: 7500, inc: 50, azi: 95 },
      { md: 10000, inc: 58, azi: 120 }
    ],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {}
  };

  const topologyResult = buildTopologyModel(stateSnapshot, {
    requestId: 1,
    wellId: 'directional-annulus-family-ef-transition'
  });
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    stateSnapshot.trajectory,
    stateSnapshot.config,
    { casingData: stateSnapshot.casingData }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context).map((interval) => {
    const top = Math.max(0, Number(interval?.top));
    const bottom = Math.min(totalMD, Number(interval?.bottom));
    const midpoint = (top + bottom) / 2;
    return {
      top,
      bottom,
      midpoint,
      stack: getStackAtDepth(midpoint, context)
    };
  });
  const projector = buildDirectionalProjector(
    trajectoryPoints,
    (value) => value,
    (value) => value,
    { xExaggeration: 1, xOrigin: 0 }
  );

  return {
    topologyResult,
    intervals,
    projector
  };
}

function buildDirectionalStylePrecedenceInputs() {
  const stateSnapshot = {
    casingData: [
      { rowId: 'casing-outer', od: 9.625, weight: 40, top: 0, bottom: 10000, show: true },
      { rowId: 'casing-inner', od: 7, weight: 29, top: 0, bottom: 8000, show: true }
    ],
    tubingData: [],
    drillStringData: [],
    equipmentData: [
      {
        rowId: 'equipment-sv-1',
        depth: 5000,
        type: 'Safety Valve',
        actuationState: 'closed',
        integrityStatus: 'intact',
        boreSeal: true,
        annularSeal: true,
        show: true
      }
    ],
    horizontalLines: [],
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [
      {
        rowId: 'marker-perf-1',
        type: 'Perforation',
        top: 6500,
        bottom: 6700,
        attachToId: 'casing-inner',
        show: true
      }
    ],
    topologySources: [],
    trajectory: [
      { md: 0, inc: 0, azi: 0 },
      { md: 2000, inc: 18, azi: 35 },
      { md: 4500, inc: 42, azi: 70 },
      { md: 7500, inc: 50, azi: 95 },
      { md: 10000, inc: 58, azi: 120 }
    ],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {}
  };

  const topologyResult = buildTopologyModel(stateSnapshot, {
    requestId: 1,
    wellId: 'directional-style-precedence'
  });
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    stateSnapshot.trajectory,
    stateSnapshot.config,
    { casingData: stateSnapshot.casingData }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context).map((interval) => {
    const top = Math.max(0, Number(interval?.top));
    const bottom = Math.min(totalMD, Number(interval?.bottom));
    const midpoint = (top + bottom) / 2;
    return {
      top,
      bottom,
      midpoint,
      stack: getStackAtDepth(midpoint, context)
    };
  });
  const projector = buildDirectionalProjector(
    trajectoryPoints,
    (value) => value,
    (value) => value,
    { xExaggeration: 1, xOrigin: 0 }
  );

  return {
    topologyResult,
    intervals,
    projector
  };
}

describe('directionalTopologyOverlayModel', () => {
  it('includes mapped ANNULUS_A <-> ANNULUS_B non-tubing transitions in directional topology results', () => {
    const { topologyResult, intervals, projector } = buildDirectionalAnnulusFamilyTransitionInputs();
    const transitionPairs = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const warningCodes = new Set(
      topologyResult.validationWarnings.map((warning) => warning?.code)
    );

    expect(transitionPairs).toContain('ANNULUS_A->ANNULUS_B');
    expect(transitionPairs).toContain('ANNULUS_B->ANNULUS_A');
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    const kinds = new Set(overlayEntries.map((entry) => entry.nodeKind));
    expect(kinds.has('ANNULUS_A')).toBe(true);
    expect(kinds.has('ANNULUS_B')).toBe(true);
  });

  it('keeps ANNULUS_C directional source path at zero failure cost through mapped ANNULUS_C <-> ANNULUS_B transitions', () => {
    const { topologyResult, intervals, projector } = buildDirectionalAnnulusFamilyBCTransitionInputs();
    const transitionPairs = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const edgeById = new Map(topologyResult.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = topologyResult.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const warningCodes = new Set(
      topologyResult.validationWarnings.map((warning) => warning?.code)
    );

    expect(transitionPairs).toContain('ANNULUS_B->ANNULUS_C');
    expect(transitionPairs).toContain('ANNULUS_C->ANNULUS_B');
    expect(topologyResult.minFailureCostToSurface).toBe(0);
    expect(topologyResult.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs.some((pair) => (
      pair === 'ANNULUS_B->ANNULUS_C' || pair === 'ANNULUS_C->ANNULUS_B'
    ))).toBe(true);
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    const kinds = new Set(overlayEntries.map((entry) => entry.nodeKind));
    expect(kinds.has('ANNULUS_B')).toBe(true);
    expect(kinds.has('ANNULUS_C')).toBe(true);
  });

  it('keeps ANNULUS_D directional source path at zero failure cost through mapped ANNULUS_D <-> ANNULUS_C transitions', () => {
    const { topologyResult, intervals, projector } = buildDirectionalAnnulusFamilyCDTransitionInputs();
    const transitionPairs = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const edgeById = new Map(topologyResult.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = topologyResult.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const warningCodes = new Set(
      topologyResult.validationWarnings.map((warning) => warning?.code)
    );

    expect(transitionPairs).toContain('ANNULUS_C->ANNULUS_D');
    expect(transitionPairs).toContain('ANNULUS_D->ANNULUS_C');
    expect(topologyResult.minFailureCostToSurface).toBe(0);
    expect(topologyResult.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs.some((pair) => (
      pair === 'ANNULUS_C->ANNULUS_D' || pair === 'ANNULUS_D->ANNULUS_C'
    ))).toBe(true);
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    const kinds = new Set(overlayEntries.map((entry) => entry.nodeKind));
    expect(kinds.has('ANNULUS_C')).toBe(true);
    expect(kinds.has('ANNULUS_D')).toBe(true);
  });

  it('keeps FORMATION_ANNULUS directional source path at zero failure cost through mapped ANNULUS_D <-> FORMATION transitions', () => {
    const { topologyResult, intervals, projector } = buildDirectionalAnnulusFamilyDFTransitionInputs();
    const transitionPairs = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const edgeById = new Map(topologyResult.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = topologyResult.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const warningCodes = new Set(
      topologyResult.validationWarnings.map((warning) => warning?.code)
    );

    expect(transitionPairs).toContain('ANNULUS_D->FORMATION_ANNULUS');
    expect(topologyResult.minFailureCostToSurface).toBe(0);
    expect(topologyResult.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs).toContain('ANNULUS_D->FORMATION_ANNULUS');
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    const kinds = new Set(overlayEntries.map((entry) => entry.nodeKind));
    expect(kinds.has('ANNULUS_D')).toBe(true);
    expect(kinds.has('FORMATION_ANNULUS')).toBe(true);
  });

  it('keeps ANNULUS_E directional source path at zero failure cost through mapped ANNULUS_E <-> ANNULUS_D transitions', () => {
    const { topologyResult, intervals, projector } = buildDirectionalAnnulusFamilyDETransitionInputs();
    const transitionPairs = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const edgeById = new Map(topologyResult.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = topologyResult.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const warningCodes = new Set(
      topologyResult.validationWarnings.map((warning) => warning?.code)
    );

    expect(transitionPairs).toContain('ANNULUS_D->ANNULUS_E');
    expect(transitionPairs).toContain('ANNULUS_E->ANNULUS_D');
    expect(topologyResult.minFailureCostToSurface).toBe(0);
    expect(topologyResult.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs.some((pair) => (
      pair === 'ANNULUS_D->ANNULUS_E' || pair === 'ANNULUS_E->ANNULUS_D'
    ))).toBe(true);
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    const kinds = new Set(overlayEntries.map((entry) => entry.nodeKind));
    expect(kinds.has('ANNULUS_D')).toBe(true);
    expect(kinds.has('ANNULUS_E')).toBe(true);
  });

  it('keeps ANNULUS_F directional source path at zero failure cost through mapped ANNULUS_F <-> ANNULUS_E transitions', () => {
    const { topologyResult, intervals, projector } = buildDirectionalAnnulusFamilyEFTransitionInputs();
    const transitionPairs = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const edgeById = new Map(topologyResult.edges.map((edge) => [edge.edgeId, edge]));
    const minPathTransitionPairs = topologyResult.minCostPathEdgeIds
      .map((edgeId) => edgeById.get(edgeId))
      .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const warningCodes = new Set(
      topologyResult.validationWarnings.map((warning) => warning?.code)
    );

    expect(transitionPairs).toContain('ANNULUS_E->ANNULUS_F');
    expect(transitionPairs).toContain('ANNULUS_F->ANNULUS_E');
    expect(topologyResult.minFailureCostToSurface).toBe(0);
    expect(topologyResult.spofEdgeIds).toEqual([]);
    expect(minPathTransitionPairs.some((pair) => (
      pair === 'ANNULUS_E->ANNULUS_F' || pair === 'ANNULUS_F->ANNULUS_E'
    ))).toBe(true);
    expect(warningCodes.has('structural_transition_not_modeled')).toBe(false);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    const kinds = new Set(overlayEntries.map((entry) => entry.nodeKind));
    expect(kinds.has('ANNULUS_E')).toBe(true);
    expect(kinds.has('ANNULUS_F')).toBe(true);
  });

  it('keeps tubing-boundary transition semantics visible in directional overlay entries', () => {
    const { topologyResult, intervals, projector } = buildDirectionalOverlayInputs();
    const transitionEdgePairs = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'tubing-annulus-transition')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
    const tubingEndTransferPairs = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'tubing-end-transfer')
      .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);

    expect(transitionEdgePairs).toContain('ANNULUS_A->TUBING_ANNULUS');
    expect(transitionEdgePairs).toContain('TUBING_ANNULUS->ANNULUS_A');
    expect(tubingEndTransferPairs).toContain('ANNULUS_A->TUBING_INNER');
    expect(tubingEndTransferPairs).toContain('TUBING_INNER->ANNULUS_A');

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    const kinds = new Set(overlayEntries.map((entry) => entry.nodeKind));
    expect(kinds.has('TUBING_ANNULUS')).toBe(true);
    expect(kinds.has('ANNULUS_A')).toBe(true);
    expect(overlayEntries.length).toBeGreaterThan(0);
  });

  it('keeps directional overlay in ANNULUS_A only when tubing is absent', () => {
    const { topologyResult, intervals, projector } = buildDirectionalOverlayInputs({
      includeTubing: false,
      sourceVolumeKey: 'ANNULUS_A'
    });
    const transitionEdgeCount = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'tubing-annulus-transition')
      .length;
    const tubingEndTransferEdgeCount = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'tubing-end-transfer')
      .length;

    expect(transitionEdgeCount).toBe(0);
    expect(tubingEndTransferEdgeCount).toBe(0);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    const kinds = new Set(overlayEntries.map((entry) => entry.nodeKind));
    expect(kinds.has('ANNULUS_A')).toBe(true);
    expect(kinds.has('TUBING_ANNULUS')).toBe(false);
    expect(overlayEntries.length).toBeGreaterThan(0);
  });

  it('emits no-resolvable-interval warnings and no overlays for tubing-annulus source when tubing is absent', () => {
    const { topologyResult, intervals, projector } = buildDirectionalOverlayInputs({
      includeTubing: false,
      sourceVolumeKey: 'TUBING_ANNULUS'
    });
    const warningCodes = new Set(
      topologyResult.validationWarnings.map((warning) => warning?.code)
    );
    const transitionEdgeCount = topologyResult.edges
      .filter((edge) => edge?.reason?.ruleId === 'tubing-annulus-transition')
      .length;

    expect(warningCodes.has('scenario_source_no_resolvable_interval')).toBe(true);
    expect(warningCodes.has('scenario_rows_with_no_resolved_nodes')).toBe(true);
    expect(transitionEdgeCount).toBe(0);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: []
    });

    expect(overlayEntries).toEqual([]);
  });

  it('applies selected overlay style ahead of spof/path/active in directional highlights', () => {
    const { topologyResult, intervals, projector } = buildDirectionalStylePrecedenceInputs();
    const selectedNodeId = 'node:TUBING_INNER:0.000000:5000.000000';
    const edgeById = new Map(topologyResult.edges.map((edge) => [edge.edgeId, edge]));
    const spofNodeIds = new Set();
    topologyResult.spofEdgeIds.forEach((edgeId) => {
      const edge = edgeById.get(edgeId);
      if (!edge) return;
      spofNodeIds.add(edge.from);
      spofNodeIds.add(edge.to);
    });
    const pathNodeIds = new Set();
    topologyResult.minCostPathEdgeIds.forEach((edgeId) => {
      const edge = edgeById.get(edgeId);
      if (!edge) return;
      pathNodeIds.add(edge.from);
      pathNodeIds.add(edge.to);
    });

    expect(pathNodeIds.has(selectedNodeId)).toBe(true);
    expect(spofNodeIds.has(selectedNodeId)).toBe(true);

    const overlayEntries = buildDirectionalTopologyOverlayEntries({
      intervals,
      topologyResult,
      projector,
      diameterScale: 1,
      sampleStepMd: 40,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds: [selectedNodeId]
    });
    const styleCountByKey = countEntriesByStyle(overlayEntries);
    const selectedEntries = overlayEntries.filter((entry) => entry.nodeId === selectedNodeId);

    expect(selectedEntries.length).toBe(1);
    expect(styleCountByKey['var(--color-topology-overlay-selected-fill)|var(--color-topology-overlay-selected-stroke)']).toBe(1);
    expect(styleCountByKey['var(--color-topology-overlay-spof-fill)|var(--color-topology-overlay-spof-stroke)']).toBeGreaterThan(0);
    expect(styleCountByKey['var(--color-topology-overlay-path-fill)|var(--color-topology-overlay-path-stroke)']).toBeGreaterThan(0);
    expect(styleCountByKey['var(--color-topology-overlay-active-fill)|var(--color-topology-overlay-active-stroke)']).toBeGreaterThan(0);
  });

  it('gates directional overlay channels through showActiveFlow/showMinCostPath/showSpof toggles', () => {
    const { topologyResult, intervals, projector } = buildDirectionalStylePrecedenceInputs();
    const selectedNodeId = 'node:TUBING_INNER:0.000000:5000.000000';
    const cases = [
      {
        label: 'active_only',
        options: {
          showActiveFlow: true,
          showMinCostPath: false,
          showSpof: false,
          selectedNodeIds: []
        },
        expectedEntryCount: 4,
        expectedStyles: {
          'var(--color-topology-overlay-active-fill)|var(--color-topology-overlay-active-stroke)': 4
        }
      },
      {
        label: 'path_only',
        options: {
          showActiveFlow: false,
          showMinCostPath: true,
          showSpof: false,
          selectedNodeIds: []
        },
        expectedEntryCount: 1,
        expectedStyles: {
          'var(--color-topology-overlay-path-fill)|var(--color-topology-overlay-path-stroke)': 1
        }
      },
      {
        label: 'spof_only',
        options: {
          showActiveFlow: false,
          showMinCostPath: false,
          showSpof: true,
          selectedNodeIds: []
        },
        expectedEntryCount: 1,
        expectedStyles: {
          'var(--color-topology-overlay-spof-fill)|var(--color-topology-overlay-spof-stroke)': 1
        }
      },
      {
        label: 'selected_only',
        options: {
          showActiveFlow: false,
          showMinCostPath: false,
          showSpof: false,
          selectedNodeIds: [selectedNodeId]
        },
        expectedEntryCount: 1,
        expectedStyles: {
          'var(--color-topology-overlay-selected-fill)|var(--color-topology-overlay-selected-stroke)': 1
        }
      }
    ];

    cases.forEach((testCase) => {
      const overlayEntries = buildDirectionalTopologyOverlayEntries({
        intervals,
        topologyResult,
        projector,
        diameterScale: 1,
        sampleStepMd: 40,
        ...testCase.options
      });
      const styleCounts = countEntriesByStyle(overlayEntries);

      expect(overlayEntries.length, `${testCase.label}: entry count`).toBe(testCase.expectedEntryCount);
      expect(styleCounts, `${testCase.label}: style counts`).toEqual(testCase.expectedStyles);
    });
  });

  it('suppresses directional overlays for stale/pending/mismatch synchronization states regardless of channel toggles', () => {
    const { topologyResult, intervals, projector } = buildDirectionalStylePrecedenceInputs();
    const synchronizationCases = [
      {
        label: 'stale_result_active_only',
        topologyEntry: {
          latestRequestId: 2,
          loading: true,
          result: {
            ...topologyResult,
            requestId: 1
          }
        },
        synchronizationOptions: {
          requireExpectedRequestId: false
        },
        expectedReason: 'stale_result',
        overlayOptions: {
          showActiveFlow: true,
          showMinCostPath: false,
          showSpof: false,
          selectedNodeIds: []
        }
      },
      {
        label: 'geometry_pending_path_only',
        topologyEntry: {
          latestRequestId: 1,
          loading: false,
          result: {
            ...topologyResult,
            requestId: 1
          }
        },
        synchronizationOptions: {
          expectedRequestId: null,
          requireExpectedRequestId: true
        },
        expectedReason: 'expected_request_pending',
        overlayOptions: {
          showActiveFlow: false,
          showMinCostPath: true,
          showSpof: false,
          selectedNodeIds: []
        }
      },
      {
        label: 'request_mismatch_selected_only',
        topologyEntry: {
          latestRequestId: 1,
          loading: false,
          result: {
            ...topologyResult,
            requestId: 1
          }
        },
        synchronizationOptions: {
          expectedRequestId: 2,
          requireExpectedRequestId: true
        },
        expectedReason: 'request_mismatch',
        overlayOptions: {
          showActiveFlow: false,
          showMinCostPath: false,
          showSpof: false,
          selectedNodeIds: ['node:TUBING_INNER:0.000000:5000.000000']
        }
      }
    ];

    synchronizationCases.forEach((testCase) => {
      const syncState = resolveTopologyOverlaySynchronizationState(
        testCase.topologyEntry,
        testCase.synchronizationOptions
      );
      const topologyResultForOverlay = syncState.isSynchronized === true
        ? testCase.topologyEntry.result
        : null;
      const overlayEntries = buildDirectionalTopologyOverlayEntries({
        intervals,
        topologyResult: topologyResultForOverlay,
        projector,
        diameterScale: 1,
        sampleStepMd: 40,
        ...testCase.overlayOptions
      });

      expect(syncState.overlaySuppressed, `${testCase.label}: overlaySuppressed`).toBe(true);
      expect(syncState.reason, `${testCase.label}: reason`).toBe(testCase.expectedReason);
      expect(overlayEntries, `${testCase.label}: overlay entries`).toEqual([]);
    });
  });
});
