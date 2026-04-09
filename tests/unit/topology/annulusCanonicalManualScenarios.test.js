import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';
import { buildTopologyDebugGraph } from '@/topology/topologyGraphDebug.js';
import { resolveEquipment } from '@/physics/physicsCore.js';
import { createContext, getIntervals, getStackAtDepth } from '@/physics/physicsCore.js';
import { resolveTrajectoryPointsFromRows } from '@/app/trajectoryMathCore.mjs';
import { buildDirectionalProjector } from '@/components/schematic/layers/directionalProjection.js';
import { buildDirectionalTopologyOverlayEntries } from '@/components/schematic/layers/directionalTopologyOverlayModel.js';

function loadFixtureCases() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.join(currentDir, 'fixtures', 'annulusCanonicalManualScenarios.json');
  const parsed = JSON.parse(readFileSync(fixturePath, 'utf8'));
  return Array.isArray(parsed?.cases) ? parsed.cases : [];
}

function getCaseById(cases, caseId) {
  const testCase = cases.find((candidate) => candidate?.id === caseId);
  if (!testCase) {
    throw new Error(`Missing test case in fixture: ${caseId}`);
  }
  return testCase;
}

function getWarningCodes(result = {}) {
  return new Set((result.validationWarnings ?? []).map((warning) => warning?.code).filter(Boolean));
}

function getNodeById(result = {}, nodeId = '') {
  return (result.nodes ?? []).find((node) => node?.nodeId === nodeId) ?? null;
}

function getSourceByRowId(result = {}, rowId = '') {
  return (result.sourceEntities ?? []).find((source) => source?.rowId === rowId) ?? null;
}

function getTransitionPairs(result = {}) {
  return (result.edges ?? [])
    .filter((edge) => edge?.reason?.ruleId === 'annulus-family-transition')
    .map((edge) => `${edge?.meta?.fromVolumeKey}->${edge?.meta?.toVolumeKey}`);
}

function buildDirectionalIntervals(stateSnapshot = {}) {
  const context = createContext(stateSnapshot);
  const intervals = getIntervals(context);
  const trajectoryRows = Array.isArray(stateSnapshot?.trajectory) ? stateSnapshot.trajectory : [];
  const trajectoryPoints = resolveTrajectoryPointsFromRows(
    trajectoryRows,
    stateSnapshot?.config ?? {},
    { casingData: stateSnapshot?.casingData ?? [] }
  );
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  const boundedIntervals = intervals.map((interval) => {
    const top = Number(interval?.top);
    const bottom = Number(interval?.bottom);
    const boundedTop = Number.isFinite(totalMD) ? Math.max(0, top) : top;
    const boundedBottom = Number.isFinite(totalMD) ? Math.min(totalMD, bottom) : bottom;
    const midpoint = (boundedTop + boundedBottom) / 2;

    return {
      top: boundedTop,
      bottom: boundedBottom,
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
    intervals: boundedIntervals,
    projector
  };
}

describe('manual acceptance scenarios from JSON fixture', () => {
  const fixtureCases = loadFixtureCases();

  it('verifies canonical first-annulus behavior with no tubing', () => {
    const testCase = getCaseById(fixtureCases, 'no_tubing_annulus_a_valid_depth');
    const result = buildTopologyModel(testCase.input, { requestId: 1, wellId: testCase.id });
    const expected = testCase.expected ?? {};
    const warningCodes = getWarningCodes(result);

    (expected.warningsAbsent ?? []).forEach((warningCode) => {
      expect(warningCodes.has(warningCode)).toBe(false);
    });
    (expected.nodeKindsInclude ?? []).forEach((kind) => {
      expect(result.nodes.some((node) => node?.kind === kind)).toBe(true);
    });
    (expected.nodeKindsExclude ?? []).forEach((kind) => {
      expect(result.nodes.some((node) => node?.kind === kind)).toBe(false);
    });
    (expected.resolvedSourceRowIds ?? []).forEach((rowId) => {
      const source = getSourceByRowId(result, rowId);
      expect(source).toBeDefined();
      expect((source?.nodeIds?.length ?? 0) > 0).toBe(true);
    });
  });

  it('verifies canonical first-annulus behavior with tubing present', () => {
    const testCase = getCaseById(fixtureCases, 'with_tubing_annulus_a_b_mapping');
    const result = buildTopologyModel(testCase.input, { requestId: 2, wellId: testCase.id });
    const expected = testCase.expected ?? {};
    const warningCodes = getWarningCodes(result);

    (expected.warningsAbsent ?? []).forEach((warningCode) => {
      expect(warningCodes.has(warningCode)).toBe(false);
    });
    (expected.resolvedSourceRowIds ?? []).forEach((rowId) => {
      const source = getSourceByRowId(result, rowId);
      expect(source).toBeDefined();
      expect((source?.nodeIds?.length ?? 0) > 0).toBe(true);
    });

    (expected.sourceChannelAssertions ?? []).forEach((assertion) => {
      const source = getSourceByRowId(result, assertion.rowId);
      expect(source).toBeDefined();
      const sourceNodes = (source?.nodeIds ?? []).map((nodeId) => getNodeById(result, nodeId)).filter(Boolean);
      expect(sourceNodes.length > 0).toBe(true);
      sourceNodes.forEach((node) => {
        expect(node?.kind).toBe(assertion.expectedKind);
      });
      expect(sourceNodes.some((node) => node?.meta?.innerPipeType === assertion.expectedInnerPipeType)).toBe(true);
    });
  });

  it('verifies tubing boundary transition semantics and topology debug lane cleanup', () => {
    const testCase = getCaseById(fixtureCases, 'tubing_boundary_transitions');
    const result = buildTopologyModel(testCase.input, { requestId: 3, wellId: testCase.id });
    const expected = testCase.expected ?? {};
    const transitionPairs = getTransitionPairs(result);

    (expected.requiredTransitionPairs ?? []).forEach((pair) => {
      expect(transitionPairs).toContain(pair);
    });
    (expected.nodeKindsExclude ?? []).forEach((kind) => {
      expect(result.nodes.some((node) => node?.kind === kind)).toBe(false);
    });

    const graph = buildTopologyDebugGraph(result, { scope: 'active_flow', depthUnitsLabel: 'ft' });
    const laneKinds = new Set((graph?.laneHeaders ?? []).map((lane) => lane?.kind).filter(Boolean));
    const laneLabels = (graph?.laneHeaders ?? []).map((lane) => String(lane?.label ?? ''));

    (expected.graphLaneKindsExclude ?? []).forEach((kind) => {
      expect(laneKinds.has(kind)).toBe(false);
    });
    (expected.graphLaneLabelExcludes ?? []).forEach((token) => {
      expect(laneLabels.some((label) => label.includes(token))).toBe(false);
    });
  });

  it('verifies tubing-host packer seal mapping to ANNULUS_A', () => {
    const testCase = getCaseById(fixtureCases, 'tubing_host_packer_maps_to_annulus_a');
    const expected = testCase.expected ?? {};
    const input = testCase.input ?? {};
    const equipment = resolveEquipment(
      input.equipmentData ?? [],
      input.tubingData ?? [],
      input.casingData ?? [],
      { operationPhase: input?.config?.operationPhase ?? 'production' }
    );

    Object.entries(expected.equipmentSealByRow ?? {}).forEach(([rowId, sealNodeKind]) => {
      const row = equipment.find((item) => item?.rowId === rowId);
      expect(row).toBeDefined();
      expect(row?.sealNodeKind).toBe(sealNodeKind);
    });

    const result = buildTopologyModel(testCase.input, { requestId: 4, wellId: testCase.id });
    const contributorFunctionKeys = (result.edges ?? [])
      .flatMap((edge) => edge?.reason?.details?.equipmentContributors ?? [])
      .map((contributor) => contributor?.functionKey)
      .filter(Boolean);

    (expected.requiredEquipmentFunctionKeys ?? []).forEach((functionKey) => {
      expect(contributorFunctionKeys).toContain(functionKey);
    });
  });

  it('verifies directional parity for tubing-boundary canonical behavior', () => {
    const testCase = getCaseById(fixtureCases, 'directional_parity_tubing_boundary');
    const expected = testCase.expected ?? {};
    const result = buildTopologyModel(testCase.input, { requestId: 5, wellId: testCase.id });
    const transitionPairs = getTransitionPairs(result);

    (expected.requiredTransitionPairs ?? []).forEach((pair) => {
      expect(transitionPairs).toContain(pair);
    });
    (expected.nodeKindsInclude ?? []).forEach((kind) => {
      expect(result.nodes.some((node) => node?.kind === kind)).toBe(true);
    });
    (expected.nodeKindsExclude ?? []).forEach((kind) => {
      expect(result.nodes.some((node) => node?.kind === kind)).toBe(false);
    });

    const { intervals, projector } = buildDirectionalIntervals(testCase.input);
    const selectedNodeIds = (result.sourceEntities ?? []).flatMap((source) => source?.nodeIds ?? []);
    const directionalEntries = buildDirectionalTopologyOverlayEntries({
      topologyResult: result,
      intervals,
      projector,
      diameterScale: 1,
      showActiveFlow: true,
      showMinCostPath: true,
      showSpof: true,
      selectedNodeIds
    });
    const directionalExpected = expected.directionalOverlay ?? {};

    expect(directionalEntries.length).toBeGreaterThanOrEqual(Number(directionalExpected.minEntryCount ?? 0));
    (directionalExpected.nodeKindsExclude ?? []).forEach((kind) => {
      expect(directionalEntries.some((entry) => entry?.nodeKind === kind)).toBe(false);
    });
  });
});