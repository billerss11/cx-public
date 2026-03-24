import { describe, expect, it } from 'vitest';
import {
  matchCatalogCasingFromOd,
  parseEngineeringSizeInput,
  formatEngineeringSizeLabel,
  getHoleOptionsForCasingOd,
  getRuleExplorerDetails,
  findFeasiblePrograms
} from '@/utils/casingRules.js';

describe('casingRules utilities', () => {
  it('matches exact catalog casing OD values and rejects near misses', () => {
    expect(matchCatalogCasingFromOd(9.625)?.label).toBe('9 5/8');
    expect(matchCatalogCasingFromOd(9.62)).toBeNull();
  });

  it('parses engineering fractions and decimals', () => {
    expect(parseEngineeringSizeInput('8 1/2')?.decimal).toBe(8.5);
    expect(parseEngineeringSizeInput('14.75')?.decimal).toBe(14.75);
    expect(parseEngineeringSizeInput('not-a-size')).toBeNull();
  });

  it('formats numeric sizes as engineering labels when possible', () => {
    expect(formatEngineeringSizeLabel(9.625)).toBe('9 5/8');
    expect(formatEngineeringSizeLabel(8.4)).toBe('8.4');
  });

  it('returns drillable hole options for a matched casing OD', () => {
    expect(getHoleOptionsForCasingOd(9.625)).toEqual({
      casingMatch: expect.objectContaining({ label: '9 5/8' }),
      options: [
        expect.objectContaining({ label: '7 7/8', clearance: 'standard' }),
        expect.objectContaining({ label: '8 1/2', clearance: 'low_clearance' }),
        expect.objectContaining({ label: '8 3/4', clearance: 'low_clearance' })
      ]
    });
  });

  it('returns both casing and hole role details for overlapping labels', () => {
    const details = getRuleExplorerDetails('16');

    expect(details.catalogEntry).toEqual(expect.objectContaining({ label: '16' }));
    expect(details.casingRole?.acceptedInHoles).toEqual([
      expect.objectContaining({ label: '17 1/2' }),
      expect.objectContaining({ label: '20' }),
      expect.objectContaining({ label: '24' })
    ]);
    expect(details.holeRole?.settableCasing).toEqual([
      expect.objectContaining({ label: '11 3/4' }),
      expect.objectContaining({ label: '11 7/8' }),
      expect.objectContaining({ label: '13 3/8' }),
      expect.objectContaining({ label: '14' })
    ]);
  });

  it('ranks feasible programs by shorter length and then fewer low-clearance steps', () => {
    const programs = findFeasiblePrograms({
      startCasingLabel: '24',
      targetType: 'casing',
      targetLabel: '16'
    });

    expect(programs[0]).toEqual(expect.objectContaining({
      sequenceLabels: ['24', '20', '16'],
      lowClearanceCount: 0,
      stageCount: 2
    }));
    expect(programs[1]).toEqual(expect.objectContaining({
      sequenceLabels: ['24', '17 1/2', '16'],
      lowClearanceCount: 1,
      stageCount: 2
    }));
  });

  it('formats planner results as stage blocks and counts the start casing as stage one', () => {
    const programs = findFeasiblePrograms({
      startCasingLabel: '24',
      targetType: 'hole',
      targetLabel: '14 1/2',
      maxStages: 3
    });

    expect(programs[0]).toEqual(expect.objectContaining({
      displayText: 'Start: 24 | 20 (16) x 14 1/2',
      stageLabels: ['20 (16)', '14 1/2'],
      stageCount: 3,
      exactStageMatch: true
    }));
  });

  it('treats max stages as inclusive and sorts exact stage matches before shorter valid programs', () => {
    const programs = findFeasiblePrograms({
      startCasingLabel: '24',
      targetType: 'casing',
      targetLabel: '14',
      maxStages: 3
    });

    expect(programs[0]).toEqual(expect.objectContaining({
      displayText: expect.stringMatching(/^Start: 24 \| .+ x .+$/),
      stageCount: 3,
      exactStageMatch: true
    }));

    expect(programs.some((program) => program.displayText === 'Start: 24 | 17 1/2 (14)')).toBe(true);
    expect(programs.findIndex((program) => program.displayText === 'Start: 24 | 17 1/2 (14)')).toBeGreaterThan(0);
  });

  it('includes separate start-hole compatibility metadata for the start casing', () => {
    const programs = findFeasiblePrograms({
      startCasingLabel: '20',
      targetType: 'hole',
      targetLabel: '17 1/2',
      maxStages: 2
    });

    expect(programs[0]).toEqual(expect.objectContaining({
      startHoleOptions: [
        expect.objectContaining({ label: '26', isLowClearance: false }),
        expect.objectContaining({ label: '24', isLowClearance: true })
      ]
    }));
  });
});
