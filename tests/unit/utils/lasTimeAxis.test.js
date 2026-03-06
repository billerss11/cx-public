import { describe, expect, it } from 'vitest';
import {
  buildLasTimeAxisContext,
  formatTimeIndexValue,
  normalizeLasTimeAxisSettings,
} from '@/utils/lasTimeAxis.js';

describe('lasTimeAxis', () => {
  it('builds a ready clock-time context from index-normalization metadata', () => {
    const context = buildLasTimeAxisContext({
      session: {
        indexSelectionDiagnostics: {
          indexNormalization: {
            applied: true,
            originIso: '2015-08-03T00:00:05',
          },
        },
      },
      curveData: {
        depthRange: {
          minDepth: 0,
          maxDepth: 20000,
          depthUnit: 'ms',
        },
      },
      indexType: 'time',
      settings: {
        displayMode: 'clock',
        timezone: 'UTC',
      },
    });

    expect(context.status).toBe('ready');
    expect(context.source).toBe('index-normalization');
    expect(context.anchorIndexValue).toBe(0);
    expect(formatTimeIndexValue(5000, context)).toBe('2015-08-03 00:00:10');
  });

  it('uses DATE/STRTTIME metadata and converts STRT units to the index unit', () => {
    const context = buildLasTimeAxisContext({
      session: {
        wellInformation: {
          sections: {
            Well: [
              { mnemonic: 'DATE', value: '13/06/10', unit: 'YY/MM/DD' },
              { mnemonic: 'STRTTIME', value: '07:14:05', unit: 'HH/MM/SS' },
              { mnemonic: 'STRT', value: 0.3, unit: 's' },
            ],
          },
        },
      },
      curveData: {
        depthRange: {
          minDepth: 300,
          maxDepth: 1500,
          depthUnit: 'ms',
        },
      },
      indexType: 'time',
      settings: {
        displayMode: 'clock',
        timezone: 'UTC',
      },
    });

    expect(context.status).toBe('ready');
    expect(context.source).toBe('well-info');
    expect(context.anchorIndexValue).toBe(300);
    expect(formatTimeIndexValue(1300, context)).toBe('2010-06-13 07:14:06');
  });

  it('reports manual parse failure when a manual start override is invalid', () => {
    const context = buildLasTimeAxisContext({
      session: {},
      curveData: {
        depthRange: {
          minDepth: 0,
          maxDepth: 1000,
          depthUnit: 'ms',
        },
      },
      indexType: 'time',
      settings: {
        displayMode: 'clock',
        timezone: 'UTC',
        manualStartIso: 'not-a-date',
      },
    });

    expect(context.status).toBe('manual-parse-failed');
    expect(context.message).toContain('Manual start time could not be parsed');
  });

  it('normalizes settings and formats elapsed fallback values', () => {
    const settings = normalizeLasTimeAxisSettings({
      displayMode: 'ELAPSED',
      timezone: 'local',
      manualStartIso: ' 2026-03-05 10:00:00 ',
    });
    expect(settings).toEqual({
      displayMode: 'elapsed',
      timezone: 'LOCAL',
      manualStartIso: '2026-03-05 10:00:00',
    });

    expect(formatTimeIndexValue(12.3456, {
      mode: 'elapsed',
      unit: 's',
    })).toBe('12.346 s');
  });
});
