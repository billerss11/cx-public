import { describe, expect, it } from 'vitest';
import { buildLineTooltipModel } from '@/composables/useDeclarativePlotTooltip.js';

describe('useDeclarativePlotTooltip reference horizons', () => {
  it('renders mode-aware directional horizon tooltip wording with paired depth reference', () => {
    const model = buildLineTooltipModel(
      {
        depth: 1200,
        label: 'Landing'
      },
      'ft',
      {
        directionalReferenceHorizonMode: 'md',
        primaryDepth: 1500,
        secondaryDepth: 900
      }
    );

    expect(model?.lines.some((line) => String(line).includes('MD'))).toBe(true);
    expect(model?.lines.some((line) => String(line).includes('TVD'))).toBe(true);
  });
});
