import { describe, expect, it } from 'vitest';
import {
  getIntervals,
  getStackAtDepth,
  isDepthWithinInclusive,
  resolveConnections,
  resolveEquipment
} from '@/physics/physicsCore.js';

describe('physicsCore', () => {
  it('treats interval boundaries as inclusive', () => {
    expect(isDepthWithinInclusive(0, 0, 100)).toBe(true);
    expect(isDepthWithinInclusive(100, 0, 100)).toBe(true);
    expect(isDepthWithinInclusive(101, 0, 100)).toBe(false);
  });

  it('resolves a sealed swage connection when child top meets parent bottom', () => {
    const connections = resolveConnections([
      { __index: 0, top: 0, bottom: 1000, od: 10 },
      { __index: 1, top: 1000, bottom: 2000, od: 8 }
    ]);

    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      type: 'swage',
      upperIndex: 0,
      lowerIndex: 1,
      pipeType: 'casing',
      isSealed: true
    });
  });

  it('does not create a connection when parent is not larger than child', () => {
    const connections = resolveConnections([
      { __index: 0, top: 0, bottom: 1000, od: 8 },
      { __index: 1, top: 1000, bottom: 2000, od: 8 }
    ]);

    expect(connections).toHaveLength(0);
  });

  it('returns a steel layer at depth for a simple casing interval', () => {
    const input = {
      casingData: [{ od: 10, weight: 40, top: 0, bottom: 1500 }],
      tubingData: [],
      drillStringData: [],
      equipmentData: [],
      horizontalLines: [],
      annotationBoxes: [],
      cementPlugs: [],
      annulusFluids: [],
      markers: [],
      trajectory: [],
      config: {},
      interaction: {}
    };

    const stack = getStackAtDepth(800, input);
    const steelLayer = stack.find((layer) => layer.material === 'steel');

    expect(steelLayer).toBeDefined();
    expect(steelLayer?.source).toMatchObject({
      type: 'pipe',
      pipeType: 'casing',
      index: 0
    });
  });

  it('returns non-empty model intervals for valid casing input', () => {
    const intervals = getIntervals({
      casingData: [{ od: 10, weight: 40, top: 0, bottom: 1500 }]
    });

    expect(intervals.length).toBeGreaterThan(0);
    expect(intervals[0].top).toBe(0);
    expect(intervals[intervals.length - 1].bottom).toBe(1500);
  });

  it('does not infer packer host when explicit attach target is missing', () => {
    const equipment = [{ rowId: 'eq-1', type: 'Packer', depth: 1200, od: 4.5, show: true }];
    const tubing = [];
    const casing = [{ __index: 0, rowId: 'csg-1', top: 0, bottom: 2000, od: 9.625, weight: 40, idOverride: 8.5 }];

    const resolved = resolveEquipment(equipment, tubing, casing);

    expect(resolved[0].tubingParentIndex).toBeNull();
    expect(resolved[0].parentCasingIndex).toBeNull();
    expect(resolved[0].parentInnerDiameter).toBeNull();
    expect(resolved[0].isOrphaned).toBe(true);
    expect(resolved[0].attachWarningCode).toBe('equipment_missing_attach_target');
  });
});
