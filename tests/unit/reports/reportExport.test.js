import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSnapshot = {
  project: {
    name: 'Engineering Review Project',
    author: 'Casey Engineer',
    activeWellId: 'well-1',
    generatedAt: '2026-03-17T11:00:00.000Z'
  },
  well: {
    id: 'well-1',
    name: 'Directional Well'
  },
  config: {
    units: 'ft',
    viewMode: 'directional',
    operationPhase: 'production'
  },
  locale: {
    language: 'en'
  },
  tables: {
    casing: { rows: [] },
    activeString: { rows: [] },
    equipment: { rows: [] }
  },
  stateSnapshot: {
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
    trajectory: [],
    config: {
      units: 'ft',
      viewMode: 'directional',
      operationPhase: 'production'
    },
    interaction: {}
  }
};

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
        units: 'ft',
        viewMode: 'directional',
        operationPhase: 'production'
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
const buildActiveWellReportSnapshot = vi.fn(() => mockSnapshot);
const buildReportModel = vi.fn((snapshot, extras) => ({
  ...snapshot,
  topology: extras.topology,
  figures: extras.figures
}));
const buildReportDocumentHtml = vi.fn((model) => `
  <html data-topology-status="${model.topology.status}" data-topology-error="${model.topology.error ?? ''}">
    ${model.figures.schematicSvg}
  </html>
`);
const buildTopologyModelInWorker = vi.fn();
const buildTopologyDebugGraph = vi.fn(() => ({ nodeCount: 3, edgeCount: 2 }));
const renderReportFigures = vi.fn();
const getLanguage = vi.fn(() => 'en');

vi.mock('@/stores/projectStore.js', () => ({
  useProjectStore: () => projectStoreMock
}));

vi.mock('@/stores/pinia.js', () => ({
  pinia: {}
}));

vi.mock('@/composables/useHotTableRegistry.js', () => ({
  finishEditingAllHotTables
}));

vi.mock('@/reports/reportSnapshot.js', () => ({
  buildActiveWellReportSnapshot,
  buildReportModel
}));

vi.mock('@/reports/reportDocument.js', () => ({
  buildReportDocumentHtml
}));

vi.mock('@/composables/useTopologyWorker.js', () => ({
  buildTopologyModelInWorker
}));

vi.mock('@/topology/topologyGraphDebug.js', () => ({
  buildTopologyDebugGraph
}));

vi.mock('@/reports/reportFigureRenderer.js', () => ({
  renderReportFigures
}));

vi.mock('@/app/i18n.js', () => ({
  getLanguage,
  t: (key) => key
}));

describe('reportExport', () => {
  const writeMock = vi.fn();
  const closeMock = vi.fn();
  const focusMock = vi.fn();
  const printMock = vi.fn();
  const openMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    projectStoreMock.ensureInitialized.mockClear();
    projectStoreMock.syncActiveWellData.mockClear();
    projectStoreMock.serializeProjectPayload.mockClear();
    finishEditingAllHotTables.mockClear();
    buildActiveWellReportSnapshot.mockClear();
    buildReportModel.mockClear();
    buildReportDocumentHtml.mockClear();
    buildTopologyModelInWorker.mockReset();
    buildTopologyDebugGraph.mockClear();
    renderReportFigures.mockReset();
    getLanguage.mockClear();
    writeMock.mockClear();
    closeMock.mockClear();
    focusMock.mockClear();
    printMock.mockClear();
    openMock.mockReset();

    openMock.mockReturnValue({
      document: {
        write: writeMock,
        close: closeMock
      },
      focus: focusMock,
      print: printMock
    });
    Object.defineProperty(window, 'open', {
      configurable: true,
      writable: true,
      value: openMock
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recomputes topology from a fresh snapshot and opens a print window with the assembled report html', async () => {
    buildTopologyModelInWorker.mockResolvedValue({
      validationWarnings: []
    });
    renderReportFigures.mockResolvedValue({
      schematicSvg: '<svg id="schematic-report-figure"></svg>',
      topologyGraphSvg: '<svg id="topology-report-figure"></svg>'
    });

    const { exportReportPdf } = await import('@/reports/reportExport.js');

    await exportReportPdf();
    await vi.runAllTimersAsync();

    expect(finishEditingAllHotTables).toHaveBeenCalledTimes(1);
    expect(projectStoreMock.ensureInitialized).toHaveBeenCalledTimes(1);
    expect(projectStoreMock.syncActiveWellData).toHaveBeenCalledTimes(1);
    expect(buildActiveWellReportSnapshot).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ language: 'en' })
    );
    expect(buildTopologyModelInWorker).toHaveBeenCalledWith(
      mockSnapshot.stateSnapshot,
      expect.objectContaining({
        wellId: 'well-1',
        supersedeInFlight: false
      })
    );
    expect(buildTopologyDebugGraph).toHaveBeenCalledTimes(1);
    expect(renderReportFigures).toHaveBeenCalledWith(expect.objectContaining({
      snapshot: mockSnapshot,
      topologyGraph: { nodeCount: 3, edgeCount: 2 }
    }));
    expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('schematic-report-figure'));
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(openMock).toHaveBeenCalledWith('about:blank', '_blank');
    expect(focusMock).toHaveBeenCalledTimes(1);
    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it('still exports a partial report when topology recomputation fails', async () => {
    buildTopologyModelInWorker.mockRejectedValue(new Error('Topology worker failed.'));
    renderReportFigures.mockResolvedValue({
      schematicSvg: '<svg id="schematic-only-report"></svg>',
      topologyGraphSvg: ''
    });

    const { exportReportPdf } = await import('@/reports/reportExport.js');

    await exportReportPdf();
    await vi.runAllTimersAsync();

    expect(buildTopologyDebugGraph).not.toHaveBeenCalled();
    expect(renderReportFigures).toHaveBeenCalledWith(expect.objectContaining({
      snapshot: mockSnapshot,
      topologyResult: null,
      topologyGraph: null
    }));
    expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('data-topology-status="error"'));
    expect(writeMock).toHaveBeenCalledWith(expect.stringContaining('Topology worker failed.'));
    expect(printMock).toHaveBeenCalledTimes(1);
  });
});
