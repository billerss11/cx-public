import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const fixturesDir = path.join(projectRoot, 'tests', 'topology', 'fixtures');
const shouldUpdateFixtures = process.argv.includes('--update');

function summarizeTopologyResult(result = {}) {
    const validationWarnings = Array.isArray(result?.validationWarnings) ? result.validationWarnings : [];
    const validationWarningCodes = [...new Set(
        validationWarnings
            .map((warning) => String(warning?.code ?? '').trim())
            .filter((code) => code.length > 0)
    )].sort((left, right) => left.localeCompare(right));
    const validationWarningCodeCounts = validationWarnings
        .map((warning) => String(warning?.code ?? '').trim())
        .filter((code) => code.length > 0)
        .sort((left, right) => left.localeCompare(right))
        .reduce((counts, code) => {
            counts[code] = (counts[code] ?? 0) + 1;
            return counts;
        }, {});
    const codedWarningCount = Object.values(validationWarningCodeCounts)
        .reduce((total, count) => total + Number(count || 0), 0);
    const uncodedValidationWarningCount = Math.max(0, validationWarnings.length - codedWarningCount);

    return {
        nodeCount: Array.isArray(result?.nodes) ? result.nodes.length : 0,
        edgeCount: Array.isArray(result?.edges) ? result.edges.length : 0,
        activeFlowNodeCount: Array.isArray(result?.activeFlowNodeIds) ? result.activeFlowNodeIds.length : 0,
        sourceEntityCount: Array.isArray(result?.sourceEntities) ? result.sourceEntities.length : 0,
        sourcePolicyMode: String(result?.sourcePolicy?.mode ?? '') || null,
        minFailureCostToSurface: Number.isFinite(Number(result?.minFailureCostToSurface))
            ? Number(result.minFailureCostToSurface)
            : null,
        minCostPathLength: Array.isArray(result?.minCostPathEdgeIds) ? result.minCostPathEdgeIds.length : 0,
        spofEdgeCount: Array.isArray(result?.spofEdgeIds) ? result.spofEdgeIds.length : 0,
        validationWarningCount: validationWarnings.length,
        validationWarningCodes,
        validationWarningCodeCounts,
        uncodedValidationWarningCount,
        barrierPrimaryElementCount: Number(result?.barrierEnvelope?.primary?.elementCount ?? 0),
        barrierSecondaryElementCount: Number(result?.barrierEnvelope?.secondary?.elementCount ?? 0),
        barrierOverlapElementCount: Number(result?.barrierEnvelope?.overlap?.elementCount ?? 0)
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

async function loadTopologyFixtures() {
    const entries = await readdir(fixturesDir, { withFileTypes: true });
    const files = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));

    const fixtures = [];
    for (const fileName of files) {
        const fixturePath = path.join(fixturesDir, fileName);
        const raw = JSON.parse(await readFile(fixturePath, 'utf8'));
        fixtures.push(parseFixture(raw, fileName));
    }
    return fixtures;
}

async function updateFixtureFile(fileName, fixture) {
    const fixturePath = path.join(fixturesDir, fileName);
    const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
    await writeFile(fixturePath, serialized, 'utf8');
}

function runPathAlgorithmUnitTests(pathAlgorithmsModule = {}) {
    const {
        computeActiveFlowNodeIds,
        computeMinimumFailurePath,
        computeSpofEdgeIds
    } = pathAlgorithmsModule;

    assert.equal(typeof computeActiveFlowNodeIds, 'function', 'computeActiveFlowNodeIds export is missing.');
    assert.equal(typeof computeMinimumFailurePath, 'function', 'computeMinimumFailurePath export is missing.');
    assert.equal(typeof computeSpofEdgeIds, 'function', 'computeSpofEdgeIds export is missing.');

    const openPathEdges = [
        { edgeId: 'edge:a-b', from: 'node:A', to: 'node:B', cost: 0 },
        { edgeId: 'edge:b-c', from: 'node:B', to: 'node:C', cost: 1 },
        { edgeId: 'edge:a-c', from: 'node:A', to: 'node:C', cost: 0 }
    ];
    const openActive = computeActiveFlowNodeIds(['node:A'], openPathEdges);
    assert.deepEqual(openActive, ['node:A', 'node:B', 'node:C']);

    const surfaceSinkEdges = [
        { edgeId: 'edge:a-surface', from: 'node:A', to: 'node:SURFACE', cost: 0, kind: 'termination' },
        { edgeId: 'edge:b-surface', from: 'node:B', to: 'node:SURFACE', cost: 0, kind: 'termination' }
    ];
    const surfaceSinkActive = computeActiveFlowNodeIds(['node:A'], surfaceSinkEdges);
    assert.deepEqual(surfaceSinkActive, ['node:A', 'node:SURFACE']);

    const openMinimum = computeMinimumFailurePath(['node:A'], 'node:C', openPathEdges);
    assert.equal(openMinimum.minFailureCostToSurface, 0);
    assert.deepEqual(openMinimum.minCostPathEdgeIds, ['edge:a-c']);
    assert.deepEqual(
        computeSpofEdgeIds(openMinimum.minFailureCostToSurface, openMinimum.minCostPathEdgeIds, new Map()),
        []
    );

    const sealedPathEdges = [
        { edgeId: 'edge:a-b', from: 'node:A', to: 'node:B', cost: 0 },
        { edgeId: 'edge:b-c', from: 'node:B', to: 'node:C', cost: 1 }
    ];
    const sealedMinimum = computeMinimumFailurePath(['node:A'], 'node:C', sealedPathEdges);
    assert.equal(sealedMinimum.minFailureCostToSurface, 1);
    assert.deepEqual(sealedMinimum.minCostPathEdgeIds, ['edge:a-b', 'edge:b-c']);
    assert.deepEqual(
        computeSpofEdgeIds(
            sealedMinimum.minFailureCostToSurface,
            sealedMinimum.minCostPathEdgeIds,
            new Map(sealedPathEdges.map((edge) => [edge.edgeId, edge]))
        ),
        ['edge:b-c']
    );

    const directedTerminationEdges = [
        { edgeId: 'edge:a-surface', from: 'node:A', to: 'node:SURFACE', cost: 0, kind: 'termination' }
    ];
    const directedTerminationDefault = computeMinimumFailurePath(
        ['node:SURFACE'],
        'node:A',
        directedTerminationEdges
    );
    assert.equal(directedTerminationDefault.minFailureCostToSurface, null);
    assert.deepEqual(directedTerminationDefault.minCostPathEdgeIds, []);

    const reversedDirectionOverrideEdges = [
        { edgeId: 'edge:a-b', from: 'node:A', to: 'node:B', cost: 0, kind: 'vertical' }
    ];
    const reversedDirectionOverride = computeMinimumFailurePath(
        ['node:A'],
        'node:B',
        reversedDirectionOverrideEdges,
        {
            traversalPolicy: {
                defaultEdgeDirection: 'reverse'
            }
        }
    );
    assert.equal(reversedDirectionOverride.minFailureCostToSurface, null);
    assert.deepEqual(reversedDirectionOverride.minCostPathEdgeIds, []);
}

async function run() {
    const viteServer = await createServer({
        root: projectRoot,
        logLevel: 'error',
        server: {
            middlewareMode: true
        }
    });

    try {
        const pathAlgorithmsModule = await viteServer.ssrLoadModule('/src/topology/pathAlgorithms.js');
        runPathAlgorithmUnitTests(pathAlgorithmsModule);

        const { buildTopologyModel } = await viteServer.ssrLoadModule('/src/topology/topologyCore.js');
        assert.equal(typeof buildTopologyModel, 'function', 'buildTopologyModel export is missing.');

        const fixtures = await loadTopologyFixtures();
        let updatedCount = 0;

        for (const { fileName, fixture } of fixtures) {
            const topologyResult = buildTopologyModel(fixture.input, {
                requestId: 1,
                wellId: fixture.name ?? fileName
            });
            const actualSummary = summarizeTopologyResult(topologyResult);
            assert.equal(
                actualSummary.uncodedValidationWarningCount,
                0,
                `Topology warnings must provide stable warning codes: ${fileName}`
            );

            if (shouldUpdateFixtures) {
                fixture.expected = actualSummary;
                await updateFixtureFile(fileName, fixture);
                updatedCount += 1;
                continue;
            }

            assert.deepEqual(
                actualSummary,
                fixture.expected,
                `Topology fixture mismatch: ${fileName}`
            );
        }

        if (shouldUpdateFixtures) {
            console.log(`Updated ${updatedCount} topology fixture(s).`);
            return;
        }

        console.log(`Topology tests passed: 6 path algorithm unit tests + ${fixtures.length} golden fixture(s).`);
    } finally {
        await viteServer.close();
    }
}

run().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
});
