import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectStoreMock = {
  ensureInitialized: vi.fn(),
  syncActiveWellData: vi.fn(),
  serializeProjectPayload: vi.fn(() => ({
    projectName: 'Engineering Review Project',
    projectAuthor: 'Casey Engineer',
    activeWellId: 'well-1',
    projectConfig: { defaultUnits: 'ft' },
    wells: [{
      id: 'well-1',
      name: 'Directional Well',
      config: {
        viewMode: 'directional',
        operationPhase: 'production',
        units: 'ft'
      },
      data: {
        casingData: [],
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
        surfacePaths: [],
        surfaceTransfers: [],
        surfaceOutlets: [],
        surfaceTemplate: {},
        trajectory: []
      }
    }]
  }))
};

const finishEditingAllHotTables = vi.fn();
const getLanguage = vi.fn(() => 'en');
const buildTopologyModelInWorker = vi.fn();

vi.mock('@/stores/projectStore.js', () => ({
  useProjectStore: () => projectStoreMock
}));

vi.mock('@/stores/pinia.js', () => ({
  pinia: {}
}));

vi.mock('@/composables/useHotTableRegistry.js', () => ({
  finishEditingAllHotTables
}));

vi.mock('@/app/i18n.js', () => ({
  getLanguage
}));

vi.mock('@/composables/useTopologyWorker.js', () => ({
  buildTopologyModelInWorker,
  isTopologyWorkerCancelledError: vi.fn(() => false)
}));

describe('reviewSummary workflow', () => {
  beforeEach(() => {
    projectStoreMock.ensureInitialized.mockClear();
    projectStoreMock.syncActiveWellData.mockClear();
    projectStoreMock.serializeProjectPayload.mockClear();
    finishEditingAllHotTables.mockClear();
    getLanguage.mockClear();
    buildTopologyModelInWorker.mockReset();
  });

  it('builds a fresh active-well preview snapshot from current runtime state', async () => {
    const { buildCurrentReviewSummarySnapshot } = await import('@/reports/reviewSummary.js');

    const snapshot = buildCurrentReviewSummarySnapshot();

    expect(finishEditingAllHotTables).toHaveBeenCalledTimes(1);
    expect(projectStoreMock.ensureInitialized).toHaveBeenCalledTimes(1);
    expect(projectStoreMock.syncActiveWellData).toHaveBeenCalledTimes(1);
    expect(projectStoreMock.serializeProjectPayload).toHaveBeenCalledTimes(1);
    expect(getLanguage).toHaveBeenCalledTimes(1);
    expect(snapshot.project.name).toBe('Engineering Review Project');
    expect(snapshot.well.name).toBe('Directional Well');
  });

  it('loads derived summary metrics and warning digest from a topology recompute', async () => {
    buildTopologyModelInWorker.mockResolvedValue({
      minFailureCostToSurface: 2,
      validationWarnings: [
        { key: 'w-1', code: 'W-1', message: 'Warning 1' },
        { key: 'w-2', code: 'W-2', message: 'Warning 2' }
      ],
      sourceEntities: [{}, {}, {}],
      nodes: [{}, {}, {}, {}],
      edges: [{}, {}, {}, {}, {}]
    });

    const { loadReviewSummaryDerivedSummary } = await import('@/reports/reviewSummary.js');

    const derived = await loadReviewSummaryDerivedSummary({
      well: { id: 'well-1' },
      stateSnapshot: {
        config: { units: 'ft' }
      }
    });

    expect(buildTopologyModelInWorker).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { units: 'ft' }
      }),
      expect.objectContaining({
        wellId: 'well-1'
      })
    );
    expect(derived).toEqual(expect.objectContaining({
      status: 'ready',
      metrics: expect.objectContaining({
        minFailureCost: 2,
        warningCount: 2,
        sourceCount: 3,
        nodeCount: 4,
        edgeCount: 5
      }),
      warnings: [
        expect.objectContaining({ message: 'Warning 1' }),
        expect.objectContaining({ message: 'Warning 2' })
      ]
    }));
  });

  it('returns an error state when derived summary recompute fails', async () => {
    buildTopologyModelInWorker.mockRejectedValue(new Error('Topology worker failed.'));

    const { loadReviewSummaryDerivedSummary } = await import('@/reports/reviewSummary.js');

    const derived = await loadReviewSummaryDerivedSummary({
      well: { id: 'well-1' },
      stateSnapshot: { config: {} }
    });

    expect(derived).toEqual({
      status: 'error',
      error: 'Topology worker failed.',
      metrics: null,
      warnings: []
    });
  });
});
