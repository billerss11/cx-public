import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendedSheets = [];
const writeFileMock = vi.fn();
const finishEditingAllHotTablesMock = vi.fn();
const showAlertMock = vi.fn();

const projectDataStoreMock = {
  casingData: [
    {
      label: 'Surface',
      od: 9.625,
      weight: 40,
      grade: 'L80',
      top: 0,
      bottom: 5000,
      labelXPos: -0.8,
      manualLabelDepth: 2500,
      directionalLabelXPos: 0.3,
      directionalManualLabelDepth: 2600,
      directionalManualLabelTvd: 2610,
      casingLabelFontSize: 11,
      depthLabelFontSize: 9,
      depthLabelOffset: 35,
      topLabelXPos: -0.6,
      topManualLabelDepth: 125,
      bottomLabelXPos: -0.55,
      bottomManualLabelDepth: 4900,
      directionalTopLabelXPos: 0.45,
      directionalTopManualLabelDepth: 150,
      directionalBottomLabelXPos: 0.4,
      directionalBottomManualLabelDepth: 4850,
      showTop: true,
      showBottom: true
    }
  ],
  tubingData: [],
  drillStringData: [],
  horizontalLines: [
    {
      depth: 2500,
      directionalDepthMode: 'md',
      directionalDepthMd: 2500,
      directionalDepthTvd: 2400,
      label: 'Landing',
      color: 'steelblue',
      fontColor: 'steelblue',
      fontSize: 11,
      lineStyle: 'Solid',
      labelXPos: 0.6,
      manualLabelDepth: 2550,
      directionalCenterlineOffsetPx: 32,
      directionalManualLabelDepth: 2525,
      show: true
    }
  ],
  annotationBoxes: [
    {
      topDepth: 1000,
      bottomDepth: 1800,
      directionalDepthMode: 'tvd',
      directionalTopDepthMd: 1100,
      directionalTopDepthTvd: 1000,
      directionalBottomDepthMd: 1900,
      directionalBottomDepthTvd: 1800,
      label: 'Zone',
      detail: 'Notes',
      color: 'lightsteelblue',
      fontColor: 'steelblue',
      fontSize: 12,
      labelXPos: -0.4,
      manualLabelDepth: 1450,
      directionalCenterlineOffsetPx: -80,
      directionalManualLabelDepth: 1500,
      directionalManualLabelTvd: 1400,
      bandWidth: 1.0,
      opacity: 0.35,
      showDetails: true,
      show: true
    }
  ],
  userAnnotations: [],
  cementPlugs: [],
  annulusFluids: [],
  markers: [],
  topologySources: [],
  physicsIntervals: [],
  trajectory: []
};

const projectStoreMock = {
  ensureInitialized: vi.fn(),
  syncActiveWellData: vi.fn(),
  serializeProjectPayload: vi.fn(() => ({
    projectName: 'Project',
    projectAuthor: '',
    activeWellId: 'well-1',
    projectConfig: {},
    wells: []
  })),
  projectFileName: '',
  projectFilePath: null,
  hasProjectFileTarget: false,
  setProjectFileContext: vi.fn(),
  markProjectSaved: vi.fn()
};

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    aoa_to_sheet: vi.fn((rows) => ({ rows })),
    book_append_sheet: vi.fn((_workbook, sheet, name) => {
      appendedSheets.push({ name, rows: sheet.rows });
    })
  },
  writeFile: writeFileMock
}));

vi.mock('@/stores/projectDataStore.js', () => ({
  useProjectDataStore: () => projectDataStoreMock
}));

vi.mock('@/stores/viewConfigStore.js', () => ({
  useViewConfigStore: () => ({ config: {} })
}));

vi.mock('@/stores/projectStore.js', () => ({
  useProjectStore: () => projectStoreMock
}));

vi.mock('@/stores/viewConfigOwnership.js', () => ({
  composeRuntimeViewConfigForWell: (wellConfig = {}) => ({ ...wellConfig })
}));

vi.mock('@/stores/plotElementsStore.js', () => ({
  usePlotElementsStore: () => ({ getPlotElement: vi.fn() })
}));

vi.mock('@/stores/pinia.js', () => ({
  pinia: {}
}));

vi.mock('@/app/i18n.js', () => ({
  t: (key) => key,
  translateEnum: (_group, value) => value
}));

vi.mock('@/app/alerts.js', () => ({
  showAlert: showAlertMock
}));

vi.mock('@/app/exportPayload.mjs', () => ({
  buildProjectSavePayload: (payload) => payload
}));

vi.mock('@/composables/useHotTableRegistry.js', () => ({
  finishEditingAllHotTables: finishEditingAllHotTablesMock,
  getHotTableInstance: vi.fn(() => null)
}));

function findSheet(name) {
  return appendedSheets.find((entry) => entry.name === name);
}

describe('exports workbook label position columns', () => {
  beforeEach(() => {
    appendedSheets.length = 0;
    writeFileMock.mockClear();
    finishEditingAllHotTablesMock.mockClear();
    showAlertMock.mockClear();
  });

  it('exports extended label position columns in the edited workbook', async () => {
    const { downloadEditedWorkbook } = await import('@/app/exports.js');

    downloadEditedWorkbook();

    const casingSheet = findSheet('Casing');
    const linesSheet = findSheet('Horizons');
    const calloutsSheet = findSheet('Callouts');

    expect(casingSheet?.rows[0]).toEqual(expect.arrayContaining([
      'Directional Label X',
      'Directional Label Depth',
      'Directional Label TVD',
      'Top Label X',
      'Top Label Depth',
      'Bottom Label X',
      'Bottom Label Depth',
      'Directional Top Label X',
      'Directional Top Label Depth',
      'Directional Bottom Label X',
      'Directional Bottom Label Depth'
    ]));
    expect(linesSheet?.rows[0]).toEqual(expect.arrayContaining([
      'Directional Depth Mode',
      'Directional Depth MD',
      'Directional Depth TVD',
      'Label Depth',
      'Directional Centerline Offset',
      'Directional Label Depth'
    ]));
    expect(calloutsSheet?.rows[0]).toEqual(expect.arrayContaining([
      'Directional Depth Mode',
      'Directional Top MD',
      'Directional Top TVD',
      'Directional Bottom MD',
      'Directional Bottom TVD',
      'Label Depth',
      'Directional Centerline Offset',
      'Directional Label Depth',
      'Directional Label TVD'
    ]));
  });

  it('includes the new label position columns in the Excel template', async () => {
    const { downloadExcelTemplate } = await import('@/app/exports.js');

    downloadExcelTemplate();

    const casingSheet = findSheet('Casing');
    const linesSheet = findSheet('Horizons');
    const calloutsSheet = findSheet('Callouts');

    expect(casingSheet?.rows[0]).toEqual(expect.arrayContaining([
      'Directional Label X',
      'Directional Label Depth',
      'Directional Label TVD',
      'Top Label X',
      'Top Label Depth',
      'Bottom Label X',
      'Bottom Label Depth',
      'Directional Top Label X',
      'Directional Top Label Depth',
      'Directional Bottom Label X',
      'Directional Bottom Label Depth'
    ]));
    expect(linesSheet?.rows[0]).toEqual(expect.arrayContaining([
      'Directional Depth Mode',
      'Directional Depth MD',
      'Directional Depth TVD',
      'Label Depth',
      'Directional Centerline Offset',
      'Directional Label Depth'
    ]));
    expect(calloutsSheet?.rows[0]).toEqual(expect.arrayContaining([
      'Directional Depth Mode',
      'Directional Top MD',
      'Directional Top TVD',
      'Directional Bottom MD',
      'Directional Bottom TVD',
      'Label Depth',
      'Directional Centerline Offset',
      'Directional Label Depth',
      'Directional Label TVD'
    ]));
  });
});
