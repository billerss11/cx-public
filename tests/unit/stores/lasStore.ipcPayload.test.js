import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isProxy, ref } from 'vue';

const { backendRequestMock, openLasCsvSaveDialogMock, openLasFileDialogMock, getBackendResultMetaMock } = vi.hoisted(() => ({
  backendRequestMock: vi.fn(),
  openLasCsvSaveDialogMock: vi.fn(),
  openLasFileDialogMock: vi.fn(),
  getBackendResultMetaMock: vi.fn(() => ({
    requestId: 'req-1',
    elapsedMs: 5,
    taskVersion: '1.0',
    resultModelVersion: '1.0',
  })),
}));

vi.mock('@/composables/useBackendClient.js', () => ({
  backendRequest: backendRequestMock,
  openLasCsvSaveDialog: openLasCsvSaveDialogMock,
  openLasFileDialog: openLasFileDialogMock,
  getBackendResultMeta: getBackendResultMetaMock,
}));

import { useLasStore } from '@/stores/lasStore.js';

describe('lasStore IPC payload safety', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    backendRequestMock.mockReset();
    openLasCsvSaveDialogMock.mockReset();
    openLasFileDialogMock.mockReset();
    getBackendResultMetaMock.mockClear();
    if (typeof window !== 'undefined') {
      window.cxApp = undefined;
    }
  });

  it('sends a plain array for curveMnemonics when source selection is reactive', async () => {
    backendRequestMock.mockResolvedValue({
      series: [],
      depthRange: { minDepth: 0, maxDepth: 0, totalPoints: 0, returnedPoints: 0, samplingStep: 1 },
    });

    const store = useLasStore();
    store.sessions['session-1'] = {
      sessionId: 'session-1',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-1';

    const selectedCurveNames = ref(['GR', 'RHOB']);
    expect(isProxy(selectedCurveNames.value)).toBe(true);

    await store.fetchCurveData(selectedCurveNames.value);

    expect(backendRequestMock).toHaveBeenCalledTimes(1);
    const [task, payload] = backendRequestMock.mock.calls[0];
    expect(task).toBe('las.get_curve_data');
    expect(payload.curveMnemonics).toEqual(['GR', 'RHOB']);
    expect(isProxy(payload.curveMnemonics)).toBe(false);
  });

  it('filters out index curve before requesting backend data', async () => {
    backendRequestMock.mockResolvedValue({
      series: [
        {
          mnemonic: 'GR',
          points: [[1000, 80], [1001, 81]],
        },
      ],
      depthRange: { minDepth: 0, maxDepth: 0, totalPoints: 0, returnedPoints: 0, samplingStep: 1 },
    });

    const store = useLasStore();
    store.sessions['session-2'] = {
      sessionId: 'session-2',
      indexCurve: 'DEPT',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-2';

    await store.fetchCurveData(['DEPT', 'GR']);

    const [, payload] = backendRequestMock.mock.calls[0];
    expect(payload.curveMnemonics).toEqual(['GR']);
    expect(store.sessions['session-2'].selectedCurves).toEqual(['GR']);
    expect(isProxy(store.activeCurveData)).toBe(false);
    expect(isProxy(store.activeCurveData.series)).toBe(false);
  });

  it('supports manual session index-curve overrides for payload filtering', async () => {
    backendRequestMock.mockResolvedValue({
      series: [
        {
          mnemonic: 'GR',
          points: [[0.0, 80], [1.0, 81]],
        },
      ],
      depthRange: { minDepth: 0, maxDepth: 1, totalPoints: 2, returnedPoints: 2, samplingStep: 1 },
    });

    const store = useLasStore();
    store.sessions['session-override'] = {
      sessionId: 'session-override',
      indexCurve: 'DEPT',
      selectedIndexCurve: 'DEPT',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-override';

    store.setSessionIndexCurve('BDTI');
    await store.fetchCurveData(['DEPT', 'BDTI', 'GR']);

    const [, payload] = backendRequestMock.mock.calls[0];
    expect(payload.indexCurve).toBe('BDTI');
    expect(payload.curveMnemonics).toEqual(['DEPT', 'GR']);
    expect(store.sessions['session-override'].selectedIndexCurve).toBe('BDTI');
    expect(store.sessions['session-override'].selectedCurves).toEqual(['DEPT', 'GR']);
  });

  it('sends plain curve arrays for statistics task payloads', async () => {
    backendRequestMock.mockResolvedValue({
      sessionId: 'session-3',
      columns: ['GR'],
      metrics: [],
    });

    const store = useLasStore();
    store.sessions['session-3'] = {
      sessionId: 'session-3',
      indexCurve: 'DEPT',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-3';

    const selectedCurveNames = ref(['DEPT', 'GR']);
    await store.fetchCurveStatistics(selectedCurveNames.value);

    expect(backendRequestMock).toHaveBeenCalledTimes(1);
    const [task, payload] = backendRequestMock.mock.calls[0];
    expect(task).toBe('las.get_curve_statistics');
    expect(payload.curveMnemonics).toEqual(['GR']);
    expect(isProxy(payload.curveMnemonics)).toBe(false);
  });

  it('sends depth query payload for authoritative depth value lookup', async () => {
    backendRequestMock.mockResolvedValue({
      sessionId: 'session-depth',
      depth: 1010,
      rows: [
        { mnemonic: 'GR', value: 90, status: 'exact' },
      ],
    });

    const store = useLasStore();
    store.sessions['session-depth'] = {
      sessionId: 'session-depth',
      indexCurve: 'DEPT',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-depth';

    await store.fetchCurveValuesAtDepth(1010, ['DEPT', 'GR']);

    expect(backendRequestMock).toHaveBeenCalledTimes(1);
    const [task, payload] = backendRequestMock.mock.calls[0];
    expect(task).toBe('las.get_curve_values_at_depth');
    expect(payload.depth).toBe(1010);
    expect(payload.curveMnemonics).toEqual(['GR']);
    expect(isProxy(payload.curveMnemonics)).toBe(false);
  });

  it('uses manual session index-curve override for depth lookup payloads', async () => {
    backendRequestMock.mockResolvedValue({
      sessionId: 'session-depth-override',
      depth: 1010,
      rows: [
        { mnemonic: 'GR', value: 90, status: 'exact' },
      ],
    });

    const store = useLasStore();
    store.sessions['session-depth-override'] = {
      sessionId: 'session-depth-override',
      indexCurve: 'DEPT',
      selectedIndexCurve: 'DEPT',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-depth-override';

    store.setSessionIndexCurve('BDTI');
    await store.fetchCurveValuesAtDepth(1010, ['BDTI', 'GR']);

    const [, payload] = backendRequestMock.mock.calls[0];
    expect(payload.indexCurve).toBe('BDTI');
    expect(payload.curveMnemonics).toEqual(['GR']);
  });

  it('sends plain curve arrays for correlation task payloads', async () => {
    backendRequestMock.mockResolvedValue({
      sessionId: 'session-4',
      curves: ['GR', 'RHOB'],
      matrix: [[1, 0.5], [0.5, 1]],
    });

    const store = useLasStore();
    store.sessions['session-4'] = {
      sessionId: 'session-4',
      indexCurve: 'DEPT',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-4';

    const selectedCurveNames = ref(['GR', 'RHOB']);
    await store.fetchCorrelationMatrix(selectedCurveNames.value);

    expect(backendRequestMock).toHaveBeenCalledTimes(1);
    const [task, payload] = backendRequestMock.mock.calls[0];
    expect(task).toBe('las.get_correlation_matrix');
    expect(payload.curveMnemonics).toEqual(['GR', 'RHOB']);
    expect(isProxy(payload.curveMnemonics)).toBe(false);
  });

  it('exports selected curves to CSV via backend task after resolving save path', async () => {
    openLasCsvSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: 'C:/exports/well-a-selected.csv',
      fileName: 'well-a-selected.csv',
    });
    backendRequestMock.mockResolvedValue({
      outputFilePath: 'C:/exports/well-a-selected.csv',
      fileName: 'well-a-selected.csv',
      curveMnemonics: ['GR', 'RHOB'],
    });

    const store = useLasStore();
    store.sessions['session-export'] = {
      sessionId: 'session-export',
      wellName: 'Well A',
      fileName: 'well-a.las',
      indexCurve: 'DEPT',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-export';

    const result = await store.exportCurveDataCsv(['DEPT', 'GR', 'RHOB'], { scope: 'selected' });

    expect(openLasCsvSaveDialogMock).toHaveBeenCalledTimes(1);
    expect(backendRequestMock).toHaveBeenCalledWith('las.export_curve_data_csv', {
      sessionId: 'session-export',
      curveMnemonics: ['GR', 'RHOB'],
      outputFilePath: 'C:/exports/well-a-selected.csv',
    });
    expect(result).toMatchObject({
      canceled: false,
      outputFilePath: 'C:/exports/well-a-selected.csv',
      fileName: 'well-a-selected.csv',
    });
  });

  it('does not call backend export task when CSV save dialog is canceled', async () => {
    openLasCsvSaveDialogMock.mockResolvedValue({ canceled: true });

    const store = useLasStore();
    store.sessions['session-export-cancel'] = {
      sessionId: 'session-export-cancel',
      wellName: 'Well A',
      fileName: 'well-a.las',
      indexCurve: 'DEPT',
      selectedCurves: [],
    };
    store.activeSessionId = 'session-export-cancel';

    const result = await store.exportCurveDataCsv(['GR'], { scope: 'selected' });

    expect(openLasCsvSaveDialogMock).toHaveBeenCalledTimes(1);
    expect(backendRequestMock).not.toHaveBeenCalled();
    expect(result).toEqual({ canceled: true });
  });

  it('sets a large-file warning when selected LAS file is bigger than 25MB', async () => {
    openLasFileDialogMock.mockResolvedValue({
      canceled: false,
      filePath: 'C:/files/big.las',
      fileSizeBytes: 30 * 1024 * 1024,
    });
    backendRequestMock.mockResolvedValue({
      sessionId: 'session-big',
      curves: [],
      curveCount: 0,
      rowCount: 0,
    });

    const appendSupportLog = vi.fn().mockResolvedValue({ ok: true });
    window.cxApp = { appendSupportLog };
    const store = useLasStore();

    await store.openAndParseFile();
    await Promise.resolve();

    expect(store.warning).toMatchObject({
      code: 'LAS_LARGE_FILE',
      fileSizeBytes: 30 * 1024 * 1024,
      thresholdBytes: 25 * 1024 * 1024,
    });
    expect(store.warning?.message).toContain('30.0 MB');
    expect(store.warning?.message).toContain('25.0 MB');
    expect(backendRequestMock).toHaveBeenCalledWith('las.parse_file', { filePath: 'C:/files/big.las' });
    expect(appendSupportLog).toHaveBeenCalledWith(expect.objectContaining({
      event: 'las.large_file_warning',
      level: 'warn',
    }));
  });

  it('clears any existing large-file warning when selected LAS file is at or below 25MB', async () => {
    openLasFileDialogMock.mockResolvedValue({
      canceled: false,
      filePath: 'C:/files/normal.las',
      fileSizeBytes: 25 * 1024 * 1024,
    });
    backendRequestMock.mockResolvedValue({
      sessionId: 'session-normal',
      curves: [],
      curveCount: 0,
      rowCount: 0,
    });

    const store = useLasStore();
    store.warning = {
      code: 'LAS_LARGE_FILE',
      message: 'old warning',
    };

    await store.openAndParseFile();

    expect(store.warning).toBeNull();
  });
});
