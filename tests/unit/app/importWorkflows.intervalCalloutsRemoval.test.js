import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectStoreMock = {
  ensureInitialized: vi.fn(),
  activeWell: { config: {} },
  replaceActiveWellContent: vi.fn(),
  syncActiveWellData: vi.fn()
};

vi.mock('@/stores/projectStore.js', () => ({
  useProjectStore: () => projectStoreMock
}));

vi.mock('@/stores/pinia.js', () => ({
  pinia: {}
}));

vi.mock('@/app/i18n.js', () => ({
  t: (key) => key,
  translateEnum: (_group, value) => value
}));

vi.mock('@/app/alerts.js', () => ({
  showAlert: vi.fn()
}));

vi.mock('@/app/selection.js', () => ({
  clearSelection: vi.fn(),
  hidePlotTooltip: vi.fn(),
  syncSelectionIndicators: vi.fn()
}));

vi.mock('@/composables/useSchematicRenderer.js', () => ({
  requestSchematicRender: vi.fn()
}));

vi.mock('@/app/languageOrchestration.js', () => ({
  applySampleTranslations: vi.fn(),
  translateEnumValuesInState: vi.fn()
}));

vi.mock('@/app/runtime/context.js', () => ({
  getImporterModule: vi.fn(),
  getImporterWorkerModule: vi.fn()
}));

describe('importWorkflows interval callout removal compatibility', () => {
  beforeEach(() => {
    projectStoreMock.ensureInitialized.mockClear();
    projectStoreMock.replaceActiveWellContent.mockClear();
    projectStoreMock.syncActiveWellData.mockClear();
    projectStoreMock.activeWell = { config: {} };
  });

  it('drops legacy annotationBoxes from imported project payloads while preserving user annotations', async () => {
    const { parseProjectJsonContentToV3 } = await import('@/app/importWorkflows.js');

    const parsed = parseProjectJsonContentToV3(JSON.stringify({
      projectSchemaVersion: '7.0',
      projectName: 'Compatibility Project',
      projectAuthor: 'Engineer',
      activeWellId: 'well-1',
      projectConfig: {},
      wells: [
        {
          id: 'well-1',
          name: 'Well 1',
          config: {
            viewMode: 'vertical',
            operationPhase: 'production',
            units: 'ft'
          },
          data: {
            casingData: [],
            tubingData: [],
            drillStringData: [],
            equipmentData: [],
            horizontalLines: [],
            annotationBoxes: [
              {
                rowId: 'box-1',
                topDepth: 1000,
                bottomDepth: 1400,
                label: 'Legacy callout'
              }
            ],
            userAnnotations: [
              {
                id: 'annotation-1',
                text: 'Keep me',
                anchor: { depth: 900, xValue: 0 },
                labelPos: { depth: 850, xValue: 10 }
              }
            ],
            cementPlugs: [],
            annulusFluids: [],
            markers: [],
            topologySources: [],
            trajectory: []
          }
        }
      ]
    }));

    expect(parsed.wells[0].data.annotationBoxes).toBeUndefined();
    expect(parsed.wells[0].data.userAnnotations).toHaveLength(1);
    expect(parsed.wells[0].data.userAnnotations[0]).toMatchObject({
      id: 'annotation-1',
      text: 'Keep me'
    });
  });
});
