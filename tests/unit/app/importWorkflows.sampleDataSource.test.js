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

describe('importWorkflows sample source', () => {
  beforeEach(() => {
    projectStoreMock.ensureInitialized.mockClear();
    projectStoreMock.replaceActiveWellContent.mockClear();
    projectStoreMock.syncActiveWellData.mockClear();
    projectStoreMock.activeWell = { config: {} };
  });

  it('loads sample data from project fixture payload with tubing and equipment rows', async () => {
    const { loadSampleData } = await import('@/app/importWorkflows.js');

    loadSampleData({ silent: true });

    expect(projectStoreMock.replaceActiveWellContent).toHaveBeenCalledTimes(1);
    const [{ data }] = projectStoreMock.replaceActiveWellContent.mock.calls[0];
    expect(Array.isArray(data.tubingData)).toBe(true);
    expect(Array.isArray(data.equipmentData)).toBe(true);
    expect(data.tubingData.length).toBe(1);
    expect(data.equipmentData.length).toBe(3);
    expect(data.markers.length).toBe(3);
  });

  it('resets active well to sample project fixture content', async () => {
    const { resetData } = await import('@/app/importWorkflows.js');

    resetData();

    expect(projectStoreMock.replaceActiveWellContent).toHaveBeenCalledTimes(1);
    const [{ data }] = projectStoreMock.replaceActiveWellContent.mock.calls[0];
    expect(data.tubingData.length).toBe(1);
    expect(data.equipmentData.length).toBe(3);
    expect(data.markers.length).toBe(3);
  });
});
