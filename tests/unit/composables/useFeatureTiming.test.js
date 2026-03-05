import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useFeatureTiming } from '@/composables/useFeatureTiming.js';
import { useFeaturePerfStore } from '@/stores/featurePerfStore.js';

function installTimingHarness(startAt = 100) {
  let now = startAt;

  vi.stubGlobal('performance', {
    now: vi.fn(() => now),
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
    now += 16;
    callback(now);
    return 1;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  return {
    setNow(value) {
      now = Number(value);
    },
    getNow() {
      return now;
    },
  };
}

describe('useFeatureTiming', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    if (typeof window !== 'undefined') {
      window.cxApp = undefined;
    }
  });

  it('records sampled timing with backend/frontend split', async () => {
    const harness = installTimingHarness(100);
    const perfStore = useFeaturePerfStore();
    perfStore.configure({ enabled: true, sampleRate: 1, maxRecords: 200 });

    const { startFeatureTimer } = useFeatureTiming();
    const timer = startFeatureTimer('las.fetch_curve_data');
    harness.setNow(150);

    const record = await timer.end({
      backendMs: 40,
      status: 'success',
      task: 'las.get_curve_data',
      requestId: 'req-1',
      mode: 'las',
    });

    expect(record).toMatchObject({
      feature: 'las.fetch_curve_data',
      status: 'success',
      backendMs: 40,
      frontendMs: 26,
      totalMs: 66,
      task: 'las.get_curve_data',
      requestId: 'req-1',
      mode: 'las',
    });
    expect(perfStore.records).toHaveLength(1);
  });

  it('does not record when sampling is disabled for the timer', async () => {
    installTimingHarness(200);
    const perfStore = useFeaturePerfStore();
    perfStore.configure({ enabled: true, sampleRate: 0, maxRecords: 200 });

    const { startFeatureTimer } = useFeatureTiming();
    const timer = startFeatureTimer('analysis.topology.recompute');
    const record = await timer.end({ status: 'success' });

    expect(timer.sampled).toBe(false);
    expect(record).toBeNull();
    expect(perfStore.records).toHaveLength(0);
  });

  it('keeps only the latest maxRecords entries', async () => {
    installTimingHarness(300);
    const perfStore = useFeaturePerfStore();
    perfStore.configure({ enabled: true, sampleRate: 1, maxRecords: 2 });
    const { startFeatureTimer } = useFeatureTiming();

    const timerA = startFeatureTimer('feature-A');
    await timerA.end({ status: 'success' });
    const timerB = startFeatureTimer('feature-B');
    await timerB.end({ status: 'success' });
    const timerC = startFeatureTimer('feature-C');
    await timerC.end({ status: 'success' });

    expect(perfStore.records).toHaveLength(2);
    expect(perfStore.records[0].feature).toBe('feature-B');
    expect(perfStore.records[1].feature).toBe('feature-C');
  });

  it('timeFeature records error status and rethrows', async () => {
    installTimingHarness(500);
    const perfStore = useFeaturePerfStore();
    perfStore.configure({ enabled: true, sampleRate: 1, maxRecords: 200 });
    const { timeFeature } = useFeatureTiming();

    await expect(timeFeature(
      'las.fetch_curve_statistics',
      async () => {
        throw new Error('boom');
      },
      {
        resolveErrorMeta: () => ({
          backendMs: 12,
          task: 'las.get_curve_statistics',
          mode: 'las',
        }),
      }
    )).rejects.toThrow('boom');

    await Promise.resolve();
    await Promise.resolve();
    expect(perfStore.records).toHaveLength(1);
    expect(perfStore.records[0]).toMatchObject({
      feature: 'las.fetch_curve_statistics',
      status: 'error',
      backendMs: 12,
      task: 'las.get_curve_statistics',
      mode: 'las',
    });
  });

  it('emits detailed slow-log to console and support log bridge', async () => {
    const harness = installTimingHarness(1000);
    const perfStore = useFeaturePerfStore();
    perfStore.configure({ enabled: true, sampleRate: 1, maxRecords: 200 });

    const appendSupportLog = vi.fn().mockResolvedValue({ ok: true });
    window.cxApp = { appendSupportLog };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { startFeatureTimer } = useFeatureTiming();
    const timer = startFeatureTimer('analysis.topology.recompute');
    harness.setNow(1300);

    const record = await timer.end({
      status: 'success',
      backendMs: 60,
      mode: 'directional',
      task: 'topology.build_model',
      requestId: 'analysis-22'
    });

    expect(record).not.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('[perf][slow]');
    expect(appendSupportLog).toHaveBeenCalledTimes(1);
    expect(appendSupportLog).toHaveBeenCalledWith(expect.objectContaining({
      event: 'frontend.feature_performance',
      level: 'warn'
    }));
    expect(appendSupportLog.mock.calls[0][0].payload).toMatchObject({
      feature: 'analysis.topology.recompute',
      dominantSegment: 'frontend',
      mode: 'directional',
      task: 'topology.build_model',
      requestId: 'analysis-22'
    });
  });

  it('does not log fast successful samples', async () => {
    const harness = installTimingHarness(2000);
    const perfStore = useFeaturePerfStore();
    perfStore.configure({ enabled: true, sampleRate: 1, maxRecords: 200 });

    const appendSupportLog = vi.fn().mockResolvedValue({ ok: true });
    window.cxApp = { appendSupportLog };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { startFeatureTimer } = useFeatureTiming();
    const timer = startFeatureTimer('las.fetch_curve_data');
    harness.setNow(2020);
    await timer.end({
      status: 'success',
      backendMs: 10,
      mode: 'las',
      task: 'las.get_curve_data',
      requestId: 'req-fast'
    });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(appendSupportLog).not.toHaveBeenCalled();
  });
});
