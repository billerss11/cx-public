import { describe, expect, it } from 'vitest';
import { buildAnnulusMeaningRows } from '@/annulus/meaningModel.js';
import sampleProject from '@/data/samples/defaultSampleProject.json';

function createBaseState(overrides = {}) {
  return {
    casingData: [],
    tubingData: [],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [],
    trajectory: [],
    config: {
      operationPhase: 'production',
      units: 'ft'
    },
    interaction: {},
    ...overrides
  };
}

describe('buildAnnulusMeaningRows', () => {
  it('describes a stable tubing-to-casing annulus as one merged segment', () => {
    const rows = buildAnnulusMeaningRows(createBaseState({
      casingData: [
        {
          rowId: 'csg-1',
          label: 'Production casing',
          od: 9.625,
          weight: 40,
          top: 0,
          bottom: 3000,
          show: true
        }
      ],
      tubingData: [
        {
          rowId: 'tbg-1',
          label: 'Production tubing',
          od: 4.5,
          weight: 12.6,
          top: 0,
          bottom: 2800,
          show: true
        }
      ]
    }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      channelKey: 'ANNULUS_A',
      label: 'Annulus A'
    });
    expect(rows[0].segments).toHaveLength(1);
    expect(rows[0].segments[0].description).toBe('between Production tubing and Production casing');
  });

  it('keeps annulus A in one row and splits segments when tubing passes into a liner', () => {
    const rows = buildAnnulusMeaningRows(createBaseState({
      casingData: [
        {
          rowId: 'csg-outer',
          label: 'Outer casing',
          od: 13.375,
          weight: 54.5,
          top: 0,
          bottom: 12000,
          show: true
        },
        {
          rowId: 'csg-inner',
          label: 'Intermediate casing',
          od: 9.625,
          weight: 47,
          top: 0,
          bottom: 12000,
          show: true
        },
        {
          rowId: 'liner-1',
          label: 'Production liner',
          od: 7,
          weight: 29,
          top: 5000,
          bottom: 11000,
          show: true
        }
      ],
      tubingData: [
        {
          rowId: 'tbg-1',
          label: 'Production tubing',
          od: 4.5,
          weight: 12.6,
          top: 0,
          bottom: 9000,
          show: true
        }
      ]
    }));

    const annulusARow = rows.find((row) => row.channelKey === 'ANNULUS_A');
    expect(annulusARow).toBeTruthy();
    expect(annulusARow.segments).toHaveLength(4);
    expect(annulusARow.segments.map((segment) => segment.description)).toEqual([
      'between Production tubing and Intermediate casing',
      'between Production tubing and Production liner',
      'between Production liner and Intermediate casing',
      'between Intermediate casing and Outer casing'
    ]);
  });

  it('maps annulus A to casing-to-casing when no tubing exists', () => {
    const rows = buildAnnulusMeaningRows(createBaseState({
      casingData: [
        {
          rowId: 'csg-outer',
          label: 'Surface casing',
          od: 13.375,
          weight: 54.5,
          top: 0,
          bottom: 4000,
          show: true
        },
        {
          rowId: 'csg-inner',
          label: 'Intermediate casing',
          od: 9.625,
          weight: 40,
          top: 0,
          bottom: 4000,
          show: true
        }
      ]
    }));

    expect(rows[0].channelKey).toBe('ANNULUS_A');
    expect(rows[0].segments[0].description).toBe('between Intermediate casing and Surface casing');
  });

  it('uses formation/open hole wording for open-hole outer boundaries', () => {
    const rows = buildAnnulusMeaningRows(createBaseState({
      casingData: [
        {
          rowId: 'csg-1',
          label: 'Surface casing',
          od: 13.375,
          weight: 54.5,
          top: 0,
          bottom: 8000,
          show: true
        },
        {
          rowId: 'open-hole-1',
          label: 'Open hole',
          od: 17.5,
          weight: 0,
          top: 6000,
          bottom: 8000,
          grade: 'OH',
          show: true
        }
      ]
    }));

    expect(rows.some((row) => row.segments.some((segment) => segment.description.includes('formation/open hole')))).toBe(true);
  });

  it('keeps bundled sample annulus meanings visible for A, B, and C', () => {
    const activeWell = sampleProject.wells.find((well) => well?.id === sampleProject.activeWellId) ?? sampleProject.wells[0];
    const rows = buildAnnulusMeaningRows({
      ...(activeWell?.data ?? {}),
      config: activeWell?.config ?? {},
      interaction: {}
    });

    const channelKeys = rows.map((row) => row.channelKey);
    expect(channelKeys).toEqual(expect.arrayContaining([
      'ANNULUS_A',
      'ANNULUS_B',
      'ANNULUS_C',
      'FORMATION_ANNULUS'
    ]));

    const annulusBRow = rows.find((row) => row.channelKey === 'ANNULUS_B');
    expect(annulusBRow).toBeTruthy();
    expect(annulusBRow.segments.map((segment) => segment.description)).toEqual([
      'between Intermediate casing and Surface casing'
    ]);
  });
});
