import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

const loadSampleDataMock = vi.fn();
const applyTranslationsMock = vi.fn();
const loadLanguagePreferenceMock = vi.fn();
const onLanguageChangeMock = vi.fn(() => () => {});
const tMock = vi.fn((key) => key);
const applyLanguageUIMock = vi.fn();
const initializeCementColorSelectMock = vi.fn();
const syncPlotTitleForLanguageMock = vi.fn();
const syncSelectionIndicatorsMock = vi.fn();
const useProjectStoreMock = vi.fn();

const projectStoreMock = {
  ensureInitialized: vi.fn(),
  syncActiveWellData: vi.fn(),
  activeWell: {
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
  }
};

vi.mock('@/app/i18n.js', () => ({
  applyTranslations: applyTranslationsMock,
  loadLanguagePreference: loadLanguagePreferenceMock,
  onLanguageChange: onLanguageChangeMock,
  t: tMock
}));

vi.mock('@/app/importWorkflows.js', () => ({
  loadSampleData: loadSampleDataMock
}));

vi.mock('@/app/languageOrchestration.js', () => ({
  applyLanguageUI: applyLanguageUIMock,
  initializeCementColorSelect: initializeCementColorSelectMock,
  syncPlotTitleForLanguage: syncPlotTitleForLanguageMock
}));

vi.mock('@/app/selection.js', () => ({
  syncSelectionIndicators: syncSelectionIndicatorsMock
}));

vi.mock('@/stores/projectStore.js', () => ({
  useProjectStore: useProjectStoreMock
}));

function createViewConfigStoreMock() {
  return {
    config: {
      viewMode: 'vertical',
      xExaggeration: 1,
      intervalCalloutStandoffPx: 8,
      showDepthCursor: false,
      depthCursorDirectionalMode: 'md',
      magnifierZoomLevel: 2,
      directionalCasingArrowMode: 'off',
      lockAspectRatio: true
    },
    setViewMode: vi.fn(),
    setXExaggeration: vi.fn(),
    setIntervalCalloutStandoffPx: vi.fn(),
    setShowDepthCursor: vi.fn(),
    setDepthCursorDirectionalMode: vi.fn(),
    setMagnifierZoomLevel: vi.fn(),
    setDirectionalCasingArrowMode: vi.fn(),
    syncVerticalSectionControlsFromConfig: vi.fn(),
    invalidateDirectionalDataAspectRatio: vi.fn(),
    setDirectionalAutoFitSignature: vi.fn(),
    setLockAspectRatioEnabled: vi.fn(),
    reconcileCanvasWidthForCurrentViewMode: vi.fn()
  };
}

describe('bootstrapApplication deferred sample loading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
    useProjectStoreMock.mockReturnValue(projectStoreMock);
    projectStoreMock.activeWell = {
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
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not load sample data synchronously during bootstrap', async () => {
    const { bootstrapApplication } = await import('@/app/bootstrap.js');
    const viewConfigStore = createViewConfigStoreMock();
    const interactionStore = { setAutoGenerate: vi.fn() };

    bootstrapApplication(viewConfigStore, interactionStore);

    expect(loadSampleDataMock).not.toHaveBeenCalled();
  });

  it('loads sample data asynchronously when active well is empty', async () => {
    const { bootstrapApplication } = await import('@/app/bootstrap.js');
    const viewConfigStore = createViewConfigStoreMock();
    const interactionStore = { setAutoGenerate: vi.fn() };

    bootstrapApplication(viewConfigStore, interactionStore);
    vi.runOnlyPendingTimers();

    expect(loadSampleDataMock).toHaveBeenCalledWith({ silent: true });
  });

  it('skips auto sample load when active well already has data', async () => {
    projectStoreMock.activeWell = {
      data: {
        casingData: [{ rowId: 'casing-1' }],
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
    };

    const { bootstrapApplication } = await import('@/app/bootstrap.js');
    const viewConfigStore = createViewConfigStoreMock();
    const interactionStore = { setAutoGenerate: vi.fn() };

    bootstrapApplication(viewConfigStore, interactionStore);
    vi.runOnlyPendingTimers();

    expect(loadSampleDataMock).not.toHaveBeenCalled();
  });

  it('skips auto sample load when active well already has surface path data', async () => {
    projectStoreMock.activeWell = {
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
        surfacePaths: [{ rowId: 'surface-path-1' }],
        surfaceTransfers: [],
        surfaceOutlets: [],
        surfaceTemplate: {},
        trajectory: []
      }
    };

    const { bootstrapApplication } = await import('@/app/bootstrap.js');
    const viewConfigStore = createViewConfigStoreMock();
    const interactionStore = { setAutoGenerate: vi.fn() };

    bootstrapApplication(viewConfigStore, interactionStore);
    vi.runOnlyPendingTimers();

    expect(loadSampleDataMock).not.toHaveBeenCalled();
  });

  it('skips auto sample load when active well already has surface template data', async () => {
    projectStoreMock.activeWell = {
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
        surfaceTemplate: {
          templateId: 'surface-template-1'
        },
        trajectory: []
      }
    };

    const { bootstrapApplication } = await import('@/app/bootstrap.js');
    const viewConfigStore = createViewConfigStoreMock();
    const interactionStore = { setAutoGenerate: vi.fn() };

    bootstrapApplication(viewConfigStore, interactionStore);
    vi.runOnlyPendingTimers();

    expect(loadSampleDataMock).not.toHaveBeenCalled();
  });
});
