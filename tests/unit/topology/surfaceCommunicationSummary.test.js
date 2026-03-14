import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';

function createBaseState(overrides = {}) {
  return {
    casingData: [
      {
        rowId: 'csg-1',
        label: 'Surface Casing',
        top: 0,
        bottom: 3000,
        od: 9.625,
        weight: 40,
        show: true,
      },
    ],
    tubingData: [
      {
        rowId: 'tbg-1',
        label: 'Production Tubing',
        top: 0,
        bottom: 2800,
        od: 4.5,
        weight: 12.6,
        show: true,
      },
    ],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [],
    surfacePaths: [],
    surfaceTransfers: [],
    surfaceOutlets: [],
    surfaceTemplate: {},
    trajectory: [],
    config: {},
    interaction: {},
    ...overrides,
  };
}

function createTubingSurfaceState(barrierState = { actuationState: 'open', integrityStatus: 'intact' }) {
  return createBaseState({
    topologySources: [
      {
        rowId: 'src-1',
        sourceType: 'scenario',
        volumeKey: 'TUBING_INNER',
        top: 1500,
        bottom: 1520,
        show: true,
      },
    ],
    surfacePaths: [
      {
        rowId: 'path-tubing',
        channelKey: 'TUBING_INNER',
        label: 'Tubing Path',
        show: true,
        items: [
          {
            rowId: 'item-lmv',
            itemType: 'barrier',
            label: 'Lower Master Valve',
            state: barrierState,
            show: true,
          },
          {
            rowId: 'item-umv',
            itemType: 'barrier',
            label: 'Upper Master Valve',
            state: {
              actuationState: 'open',
              integrityStatus: 'intact',
            },
            show: true,
          },
        ],
      },
    ],
    surfaceOutlets: [
      {
        rowId: 'out-prod',
        outletKey: 'production-outlet',
        label: 'Production Outlet',
        channelKey: 'TUBING_INNER',
        pathId: 'path-tubing',
        anchorItemId: 'item-umv',
        kind: 'production',
        show: true,
      },
    ],
  });
}

function createAnnulusASurfaceState(barrierState = { actuationState: 'open', integrityStatus: 'intact' }) {
  return createBaseState({
    casingData: [
      {
        rowId: 'csg-outer',
        label: 'Outer Casing',
        top: 0,
        bottom: 3000,
        od: 13.375,
        weight: 54.5,
        show: true,
      },
      {
        rowId: 'csg-inner',
        label: 'Inner Casing',
        top: 0,
        bottom: 3000,
        od: 9.625,
        weight: 40,
        show: true,
      },
    ],
    tubingData: [],
    topologySources: [
      {
        rowId: 'src-ann-a',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1500,
        bottom: 1520,
        show: true,
      },
    ],
    surfacePaths: [
      {
        rowId: 'path-ann-a',
        channelKey: 'ANNULUS_A',
        label: 'Annulus A Path',
        show: true,
        items: [
          {
            rowId: 'item-ann-a-valve',
            itemType: 'barrier',
            label: 'Annulus A Valve',
            state: barrierState,
            show: true,
          },
        ],
      },
    ],
    surfaceOutlets: [
      {
        rowId: 'out-ann-a',
        outletKey: 'annulus-a-outlet',
        label: 'Annulus A Outlet',
        channelKey: 'ANNULUS_A',
        pathId: 'path-ann-a',
        anchorItemId: 'item-ann-a-valve',
        kind: 'annulus',
        show: true,
      },
    ],
  });
}

describe('surface communication summary integration', () => {
  it('summarizes an authored tubing route to a named outlet', () => {
    const result = buildTopologyModel(createTubingSurfaceState(), {
      requestId: 1,
      wellId: 'surface-summary-authored-tubing',
    });

    expect(result.minFailureCostToSurface).toBe(0);
    expect(result.surfaceSummary?.byChannel?.TUBING_INNER).toMatchObject({
      routeStatus: 'authored',
      currentState: 'outlet',
      outletLabels: ['Production Outlet'],
      barrierLabels: ['Lower Master Valve', 'Upper Master Valve'],
      warningMessages: [],
    });
  });

  it('treats a closed authored surface barrier as one failure to reach surface', () => {
    const result = buildTopologyModel(createAnnulusASurfaceState({
      actuationState: 'closed',
      integrityStatus: 'intact',
    }), {
      requestId: 2,
      wellId: 'surface-summary-closed-barrier',
    });

    expect(result.minFailureCostToSurface).toBe(1);
    expect(result.surfaceSummary?.byChannel?.ANNULUS_A).toMatchObject({
      routeStatus: 'authored',
      currentState: 'blocked',
      blockingBarrierLabels: ['Annulus A Valve'],
    });
  });

  it('uses authored transfers between channels and keeps fallback only for unmodeled channels', () => {
    const result = buildTopologyModel(createBaseState({
      casingData: [
        {
          rowId: 'csg-outer',
          label: 'Outer Casing',
          top: 0,
          bottom: 3000,
          od: 13.375,
          weight: 54.5,
          show: true,
        },
        {
          rowId: 'csg-inner',
          label: 'Inner Casing',
          top: 0,
          bottom: 3000,
          od: 9.625,
          weight: 40,
          show: true,
        },
      ],
      topologySources: [
        {
          rowId: 'src-ann-a',
          sourceType: 'scenario',
          volumeKey: 'ANNULUS_A',
          top: 1200,
          bottom: 1220,
          show: true,
        },
      ],
      surfacePaths: [
        {
          rowId: 'path-ann-a',
          channelKey: 'ANNULUS_A',
          label: 'Annulus A Path',
          show: true,
          items: [],
        },
        {
          rowId: 'path-ann-b',
          channelKey: 'ANNULUS_B',
          label: 'Annulus B Path',
          show: true,
          items: [
            {
              rowId: 'item-ann-b-valve',
              itemType: 'barrier',
              label: 'Annulus B Valve',
              state: {
                actuationState: 'open',
                integrityStatus: 'intact',
              },
              show: true,
            },
          ],
        },
      ],
      surfaceTransfers: [
        {
          rowId: 'transfer-a-b',
          transferType: 'leak',
          label: 'Annulus A leak to B',
          fromChannelKey: 'ANNULUS_A',
          toChannelKey: 'ANNULUS_B',
          direction: 'bidirectional',
          show: true,
        },
      ],
      surfaceOutlets: [
        {
          rowId: 'out-ann-b',
          outletKey: 'annulus-b-outlet',
          label: 'Annulus B Outlet',
          channelKey: 'ANNULUS_B',
          pathId: 'path-ann-b',
          anchorItemId: 'item-ann-b-valve',
          kind: 'annulus',
          show: true,
        },
      ],
    }), {
      requestId: 3,
      wellId: 'surface-summary-transfer',
    });

    expect(result.minFailureCostToSurface).toBe(0);
    expect(result.surfaceSummary?.byChannel?.ANNULUS_A).toMatchObject({
      routeStatus: 'authored',
      currentState: 'outlet',
      outletLabels: ['Annulus B Outlet'],
      transferLabels: ['Annulus A leak to B'],
    });
    expect(result.surfaceSummary?.byChannel?.TUBING_INNER).toMatchObject({
      routeStatus: 'assumed',
      currentState: 'assumed_surface',
    });
  });
});
