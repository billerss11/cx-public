import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isProxy, ref } from 'vue';

const { backendRequestMock, openLasFileDialogMock, getBackendResultMetaMock } = vi.hoisted(() => ({
  backendRequestMock: vi.fn(),
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
  openLasFileDialog: openLasFileDialogMock,
  getBackendResultMeta: getBackendResultMetaMock,
}));

import { useLasStore } from '@/stores/lasStore.js';

describe('lasStore IPC payload safety', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    backendRequestMock.mockReset();
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
