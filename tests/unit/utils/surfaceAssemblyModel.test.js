import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY,
  createSurfaceAssemblyFromFamily,
  listSurfaceAssemblyFamilies,
  updateSurfaceAssemblyDeviceState,
  updateSurfaceAssemblyTerminationType,
  validateSurfaceAssembly,
} from '@/utils/surfaceAssemblyModel.js';

describe('surfaceAssemblyModel', () => {
  it('defines the supported engineer-facing surface families', () => {
    const families = listSurfaceAssemblyFamilies();

    expect(families.map((family) => family.familyKey)).toEqual([
      'conventional-wellhead-stack',
      'unitized-wellhead',
      'vertical-tree',
      'horizontal-tree',
    ]);
    expect(DEFAULT_SURFACE_ASSEMBLY_FAMILY_KEY).toBe('conventional-wellhead-stack');
  });

  it('creates normalized family assemblies with typed paths and engineering slots', () => {
    const assembly = createSurfaceAssemblyFromFamily('vertical-tree');

    expect(assembly.familyKey).toBe('vertical-tree');
    expect(assembly.entryPaths.map((path) => path.roleKey)).toEqual(
      expect.arrayContaining(['TUBING_BORE', 'ANNULUS_A'])
    );
    expect(assembly.devices.some((device) => device.slotKey === 'wingValve')).toBe(true);
    expect(assembly.boundaries.some((boundary) => boundary.slotKey === 'tubingHangerSeal')).toBe(true);
    expect(assembly.terminations.some((termination) => termination.slotKey === 'productionOutlet')).toBe(true);
    expect(assembly.anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceVolumeKey: 'TUBING_INNER', pathRoleKey: 'TUBING_BORE' }),
      ])
    );
  });

  it('validates missing required terminations after guided edits', () => {
    const assembly = createSurfaceAssemblyFromFamily('conventional-wellhead-stack');
    const withoutProductionTermination = updateSurfaceAssemblyTerminationType(
      assembly,
      'productionOutlet',
      'none'
    );

    const warnings = validateSurfaceAssembly(withoutProductionTermination);

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_termination',
          slotKey: 'productionOutlet',
        }),
      ])
    );
  });

  it('keeps slot updates immutable and scoped to the selected engineering element', () => {
    const assembly = createSurfaceAssemblyFromFamily('horizontal-tree');

    const nextAssembly = updateSurfaceAssemblyDeviceState(assembly, 'productionMasterValve', 'closed');

    expect(assembly.devices.find((device) => device.slotKey === 'productionMasterValve')?.state).toBe('open');
    expect(nextAssembly.devices.find((device) => device.slotKey === 'productionMasterValve')?.state).toBe('closed');
    expect(nextAssembly.familyKey).toBe('horizontal-tree');
  });
});
