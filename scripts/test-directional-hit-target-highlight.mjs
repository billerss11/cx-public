import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const fixturesDir = path.join(projectRoot, 'tests', 'directional', 'fixtures');
const shouldUpdateFixtures = process.argv.includes('--update');

function hashSignatureValue(seed, text) {
  let hash = seed >>> 0;
  const normalized = String(text ?? '');
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toSortedCountObject(values = []) {
  const counts = new Map();
  values.forEach((value) => {
    const key = String(value ?? '').trim();
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .reduce((result, [key, count]) => {
      result[key] = count;
      return result;
    }, {});
}

function normalizePolygonPoints(points, digits = 3) {
  const rawTokens = String(points ?? '').trim().split(/\s+/).filter(Boolean);
  return rawTokens.map((token) => {
    const [rawX, rawY] = token.split(',');
    const x = Number(rawX);
    const y = Number(rawY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return token;
    return `${x.toFixed(digits)},${y.toFixed(digits)}`;
  }).join(' ');
}

function computePolygonChecksum(polygons = []) {
  const signatures = polygons.map((polygon) => ([
    String(polygon?.nodeKind ?? ''),
    String(polygon?.fill ?? ''),
    String(polygon?.stroke ?? ''),
    normalizePolygonPoints(polygon?.points)
  ].join('|'))).sort((left, right) => left.localeCompare(right));

  let hash = 2166136261;
  signatures.forEach((signature) => {
    hash = hashSignatureValue(hash, signature);
    hash = hashSignatureValue(hash, ';');
  });
  return hash >>> 0;
}

function summarizeDirectionalOverlayResult(topologyResult = {}, overlayEntries = [], overlayPolygons = []) {
  const transitionEdges = (Array.isArray(topologyResult?.edges) ? topologyResult.edges : [])
    .filter((edge) => edge?.reason?.ruleId === 'tubing-annulus-transition');

  const transitionEdgePairs = transitionEdges
    .map((edge) => `${edge?.meta?.fromVolumeKey ?? ''}->${edge?.meta?.toVolumeKey ?? ''}`)
    .sort((left, right) => left.localeCompare(right));
  const transitionBoundaryDepths = [...new Set(transitionEdges
    .map((edge) => Number(edge?.reason?.details?.boundaryDepth))
    .filter((depth) => Number.isFinite(depth))
    .map((depth) => depth.toFixed(3)))]
    .sort((left, right) => Number(left) - Number(right));
  const warningCodes = (Array.isArray(topologyResult?.validationWarnings) ? topologyResult.validationWarnings : [])
    .map((warning) => String(warning?.code ?? '').trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const overlayEntryStyleCounts = toSortedCountObject(
    overlayEntries.map((entry) => `${String(entry?.fill ?? '')}|${String(entry?.stroke ?? '')}`)
  );
  const overlayPolygonStyleCounts = toSortedCountObject(
    overlayPolygons.map((polygon) => `${String(polygon?.fill ?? '')}|${String(polygon?.stroke ?? '')}`)
  );

  return {
    transitionEdgeCount: transitionEdges.length,
    transitionEdgePairs,
    transitionBoundaryDepths,
    topologyWarningCodes: warningCodes,
    overlayEntryCount: overlayEntries.length,
    overlayEntryKindCounts: toSortedCountObject(overlayEntries.map((entry) => entry?.nodeKind)),
    overlayEntryStyleCounts,
    overlayPolygonCount: overlayPolygons.length,
    overlayPolygonKindCounts: toSortedCountObject(overlayPolygons.map((polygon) => polygon?.nodeKind)),
    overlayPolygonStyleCounts,
    overlayPolygonChecksum: computePolygonChecksum(overlayPolygons)
  };
}

function parseFixture(rawFixture, fileName) {
  if (!rawFixture || typeof rawFixture !== 'object') {
    throw new Error(`Fixture ${fileName} must be a JSON object.`);
  }
  if (!rawFixture.input || typeof rawFixture.input !== 'object') {
    throw new Error(`Fixture ${fileName} is missing an object "input" field.`);
  }
  return {
    fileName,
    fixture: rawFixture
  };
}

async function loadDirectionalFixtures() {
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const fixtureByFileName = new Map();
  for (const fileName of files) {
    const fixturePath = path.join(fixturesDir, fileName);
    const rawFixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    fixtureByFileName.set(fileName, rawFixture);
  }

  const fixtureByName = new Map();
  fixtureByFileName.forEach((rawFixture, fileName) => {
    const fixtureName = String(rawFixture?.name ?? '').trim();
    if (!fixtureName) return;
    if (!fixtureByName.has(fixtureName)) {
      fixtureByName.set(fixtureName, { fileName, rawFixture });
    }
  });

  const resolvedByFileName = new Map();
  function resolveFixture(fileName, ancestry = []) {
    if (resolvedByFileName.has(fileName)) {
      return resolvedByFileName.get(fileName);
    }
    if (ancestry.includes(fileName)) {
      throw new Error(`Fixture inheritance cycle detected: ${[...ancestry, fileName].join(' -> ')}`);
    }

    const rawFixture = fixtureByFileName.get(fileName);
    if (!rawFixture || typeof rawFixture !== 'object') {
      throw new Error(`Fixture ${fileName} must be a JSON object.`);
    }

    const baseRef = String(rawFixture?.extendsFixture ?? '').trim();
    if (!baseRef) {
      const resolved = parseFixture(rawFixture, fileName);
      resolvedByFileName.set(fileName, resolved);
      return resolved;
    }

    let baseFileName = null;
    if (fixtureByFileName.has(baseRef)) {
      baseFileName = baseRef;
    } else if (fixtureByName.has(baseRef)) {
      baseFileName = fixtureByName.get(baseRef)?.fileName ?? null;
    }
    if (!baseFileName) {
      throw new Error(`Fixture ${fileName} extends unknown fixture "${baseRef}".`);
    }

    const baseResolved = resolveFixture(baseFileName, [...ancestry, fileName]);
    const mergedFixture = {
      ...baseResolved.fixture,
      ...rawFixture,
      input: rawFixture.input ?? baseResolved.fixture.input,
      overlayOptions: {
        ...(baseResolved.fixture.overlayOptions ?? {}),
        ...(rawFixture.overlayOptions ?? {})
      },
      synchronization: {
        ...(baseResolved.fixture.synchronization ?? {}),
        ...(rawFixture.synchronization ?? {})
      }
    };
    delete mergedFixture.extendsFixture;

    const resolved = parseFixture(mergedFixture, fileName);
    resolvedByFileName.set(fileName, resolved);
    return resolved;
  }

  return files.map((fileName) => ({
    ...resolveFixture(fileName),
    rawFixture: fixtureByFileName.get(fileName)
  }));
}

async function updateFixtureFile(fileName, fixture) {
  const fixturePath = path.join(fixturesDir, fileName);
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
}

function buildDirectionalIntervals(stateSnapshot, trajectoryPoints, physicsCoreModule) {
  const { createContext, getIntervals, getStackAtDepth } = physicsCoreModule;
  const context = createContext(stateSnapshot);
  const totalMD = Number(trajectoryPoints[trajectoryPoints.length - 1]?.md);
  if (!Number.isFinite(totalMD) || totalMD <= 0) return [];

  const intervals = getIntervals(context)
    .map((interval) => {
      const top = Math.max(0, Number(interval?.top));
      const bottom = Math.min(totalMD, Number(interval?.bottom));
      if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
      const midpoint = (top + bottom) / 2;
      return {
        top,
        bottom,
        midpoint,
        stack: getStackAtDepth(midpoint, context)
      };
    })
    .filter(Boolean);

  if (intervals.length > 0) return intervals;
  return [{
    top: 0,
    bottom: totalMD,
    midpoint: totalMD / 2,
    stack: getStackAtDepth(totalMD / 2, context)
  }];
}

async function runDirectionalHitTargetHighlightRegressionSuite() {
  const selectionSourcePath = new URL('../src/app/selection.js', import.meta.url);
  const selectionSource = await readFile(selectionSourcePath, 'utf8');

  assert.ok(
    selectionSource.includes('directional-band-layer__hit-target'),
    'Pipe highlight sync should explicitly exclude directional hit-target paths from visual highlight class application.'
  );

  const viteServer = await createServer({
    root: projectRoot,
    logLevel: 'error',
    server: {
      middlewareMode: true
    }
  });

  try {
    const [
      { buildTopologyModel },
      physicsCoreModule,
      trajectoryCoreModule,
      projectionModule,
      overlayModule,
      synchronizationModule
    ] = await Promise.all([
      viteServer.ssrLoadModule('/src/topology/topologyCore.js'),
      viteServer.ssrLoadModule('/src/physics/physicsCore.js'),
      viteServer.ssrLoadModule('/src/app/trajectoryMathCore.mjs'),
      viteServer.ssrLoadModule('/src/components/schematic/layers/directionalProjection.js'),
      viteServer.ssrLoadModule('/src/components/schematic/layers/directionalTopologyOverlayModel.js'),
      viteServer.ssrLoadModule('/src/topology/resultSynchronization.js')
    ]);

    const { resolveTrajectoryPointsFromRows } = trajectoryCoreModule;
    const { buildDirectionalProjector } = projectionModule;
    const {
      buildDirectionalTopologyOverlayEntries,
      buildDirectionalTopologyOverlayPolygons
    } = overlayModule;
    const { resolveTopologyOverlaySynchronizationState } = synchronizationModule;
    const fixtures = await loadDirectionalFixtures();
    let updatedCount = 0;

    for (const { fileName, fixture, rawFixture } of fixtures) {
      const computedTopologyResult = buildTopologyModel(fixture.input, {
        requestId: 1,
        wellId: fixture.name ?? fileName
      });
      const synchronization = fixture.synchronization && typeof fixture.synchronization === 'object'
        ? fixture.synchronization
        : null;
      const computedResultRequestId = Number(computedTopologyResult?.requestId);
      const resultRequestId = Number.isInteger(Number(synchronization?.resultRequestId))
        ? Number(synchronization.resultRequestId)
        : (Number.isInteger(computedResultRequestId) ? computedResultRequestId : 1);
      const topologyResult = {
        ...computedTopologyResult,
        requestId: resultRequestId
      };
      const topologyEntry = {
        latestRequestId: Number.isInteger(Number(synchronization?.latestRequestId))
          ? Number(synchronization.latestRequestId)
          : resultRequestId,
        loading: synchronization?.loading === true,
        result: synchronization?.includeResult === false ? null : topologyResult
      };
      const overlaySynchronizationState = synchronization
        ? resolveTopologyOverlaySynchronizationState(topologyEntry, {
          expectedRequestId: synchronization?.expectedRequestId,
          requireExpectedRequestId: synchronization?.requireExpectedRequestId === true
        })
        : null;
      const topologyResultForOverlay = overlaySynchronizationState
        ? (overlaySynchronizationState.isSynchronized ? topologyResult : null)
        : topologyResult;

      const trajectoryPoints = resolveTrajectoryPointsFromRows(
        fixture.input?.trajectory,
        fixture.input?.config ?? {},
        { casingData: fixture.input?.casingData ?? [] }
      );
      const intervals = buildDirectionalIntervals(fixture.input, trajectoryPoints, physicsCoreModule);
      const projector = buildDirectionalProjector(
        trajectoryPoints,
        (value) => value,
        (value) => value,
        { xExaggeration: 1, xOrigin: 0 }
      );
      const overlayOptions = fixture.overlayOptions && typeof fixture.overlayOptions === 'object'
        ? fixture.overlayOptions
        : {};
      const modelOptions = {
        intervals,
        topologyResult: topologyResultForOverlay,
        projector,
        diameterScale: Number(overlayOptions?.diameterScale) || 1,
        sampleStepMd: Number(overlayOptions?.sampleStepMd) || 20,
        showActiveFlow: overlayOptions?.showActiveFlow !== false,
        showMinCostPath: overlayOptions?.showMinCostPath !== false,
        showSpof: overlayOptions?.showSpof !== false,
        selectedNodeIds: Array.isArray(overlayOptions?.selectedNodeIds) ? overlayOptions.selectedNodeIds : []
      };
      const overlayEntries = buildDirectionalTopologyOverlayEntries(modelOptions);
      const overlayPolygons = buildDirectionalTopologyOverlayPolygons(modelOptions);
      const actualSummary = summarizeDirectionalOverlayResult(topologyResult, overlayEntries, overlayPolygons);
      if (overlaySynchronizationState) {
        actualSummary.overlaySynchronization = {
          isSynchronized: overlaySynchronizationState.isSynchronized,
          overlaySuppressed: overlaySynchronizationState.overlaySuppressed,
          reason: overlaySynchronizationState.reason
        };
      }

      if (shouldUpdateFixtures) {
        const fixtureToPersist = {
          ...(rawFixture && typeof rawFixture === 'object' ? rawFixture : fixture),
          expected: actualSummary
        };
        await updateFixtureFile(fileName, fixtureToPersist);
        updatedCount += 1;
        continue;
      }

      assert.deepEqual(
        actualSummary,
        fixture.expected,
        `Directional fixture mismatch: ${fileName}`
      );
    }

    if (shouldUpdateFixtures) {
      console.log(`Updated ${updatedCount} directional fixture(s).`);
      return;
    }

    console.log(`Directional regression checks passed: ${fixtures.length} fixture(s).`);
  } finally {
    await viteServer.close();
  }
}

runDirectionalHitTargetHighlightRegressionSuite().catch((error) => {
  console.error('Directional regression checks failed.');
  console.error(error);
  process.exit(1);
});
