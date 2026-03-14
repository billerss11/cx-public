import { describe, expect, it } from 'vitest';
import { createSurfaceModelFromTemplate } from '@/surface/templateCatalog.js';

describe('surface template catalog', () => {
  it('seeds a standard production tree for tubing and annulus access', () => {
    const model = createSurfaceModelFromTemplate({
      templateKey: 'standard-production-tree',
      availableChannels: ['TUBING_INNER', 'ANNULUS_A']
    });

    expect(model.surfaceTemplate).toMatchObject({
      templateKey: 'standard-production-tree',
      label: 'Standard Production Tree'
    });
    expect(model.surfacePaths.map((path) => path.channelKey)).toEqual(['TUBING_INNER', 'ANNULUS_A']);
    expect(model.surfacePaths[0].items.map((item) => item.label)).toEqual([
      'Lower Master Valve',
      'Upper Master Valve'
    ]);
    expect(model.surfaceOutlets.map((outlet) => outlet.label)).toEqual([
      'Production Outlet',
      'Annulus A Outlet'
    ]);
  });

  it('seeds one annulus path per available annulus channel in the standard template', () => {
    const model = createSurfaceModelFromTemplate({
      templateKey: 'standard-production-tree',
      availableChannels: ['TUBING_INNER', 'ANNULUS_A', 'ANNULUS_B', 'ANNULUS_C']
    });

    expect(model.surfacePaths.map((path) => path.channelKey)).toEqual([
      'TUBING_INNER',
      'ANNULUS_A',
      'ANNULUS_B',
      'ANNULUS_C'
    ]);
    expect(model.surfaceOutlets.map((outlet) => outlet.label)).toEqual([
      'Production Outlet',
      'Annulus A Outlet',
      'Annulus B Outlet',
      'Annulus C Outlet'
    ]);
  });
});
