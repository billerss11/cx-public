import { describe, expect, it } from 'vitest';
import {
  buildScenarioBreakoutWarningIndex,
  isScenarioBreakoutWarningCode,
  resolveScenarioBreakoutWarningFields
} from '@/topology/breakoutWarnings.js';
import { TOPOLOGY_WARNING_CODES } from '@/topology/warningCatalog.js';

describe('breakoutWarnings helpers', () => {
  it('recognizes scenario breakout warning codes only', () => {
    expect(isScenarioBreakoutWarningCode(TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_VOLUME_PAIR)).toBe(true);
    expect(isScenarioBreakoutWarningCode(TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_DEPTH_RANGE)).toBe(true);
    expect(isScenarioBreakoutWarningCode(TOPOLOGY_WARNING_CODES.SCENARIO_SOURCE_UNSUPPORTED_VOLUME)).toBe(false);
    expect(isScenarioBreakoutWarningCode('')).toBe(false);
  });

  it('resolves warning fields from explicit metadata or code fallback', () => {
    expect(resolveScenarioBreakoutWarningFields({
      code: TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_DEPTH_RANGE,
      fields: ['top']
    })).toEqual(['top']);

    expect(resolveScenarioBreakoutWarningFields({
      code: TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_UNSUPPORTED_VOLUME_PAIR
    })).toEqual(['fromVolumeKey', 'toVolumeKey']);
  });

  it('maps breakout warnings to visible breakout rows with row and field index', () => {
    const breakoutRows = [
      {
        rowId: 'br-1',
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        top: 1000,
        bottom: 1200
      },
      {
        rowId: 'br-2',
        fromVolumeKey: 'ANNULUS_B',
        toVolumeKey: 'ANNULUS_C',
        top: 1300,
        bottom: 1400
      }
    ];

    const validationWarnings = [
      {
        code: TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_UNSUPPORTED_VOLUME_PAIR,
        rowId: 'br-1',
        message: 'Unsupported pair.'
      },
      {
        code: TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_MISSING_DEPTH_RANGE,
        rowId: 'br-2',
        message: 'Missing depth range.',
        fields: ['top']
      },
      {
        code: TOPOLOGY_WARNING_CODES.SCENARIO_SOURCE_UNSUPPORTED_VOLUME,
        rowId: 'br-2',
        message: 'Not breakout warning.'
      },
      {
        code: TOPOLOGY_WARNING_CODES.SCENARIO_BREAKOUT_NO_RESOLVABLE_INTERVAL,
        rowId: 'missing-row',
        message: 'Row no longer exists.'
      }
    ];

    const warningIndex = buildScenarioBreakoutWarningIndex(breakoutRows, validationWarnings);

    expect(warningIndex.warnings).toHaveLength(2);
    expect(warningIndex.warnings[0].rowNumber).toBe(1);
    expect(warningIndex.warnings[1].rowNumber).toBe(2);
    expect([...warningIndex.fieldMapByRowId.get('br-1')]).toEqual(['fromVolumeKey', 'toVolumeKey']);
    expect([...warningIndex.fieldMapByRowId.get('br-2')]).toEqual(['top']);
    expect(warningIndex.fieldMapByRowId.has('missing-row')).toBe(false);
  });
});

