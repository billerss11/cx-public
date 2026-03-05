import { describe, expect, it } from 'vitest';
import { buildTopologyModel } from '@/topology/topologyCore.js';
import { normalizeSourceVolumeKind } from '@/topology/topologyTypes.js';

function buildBaseState() {
  return {
    casingData: [
      {
        rowId: 'casing-1',
        label: 'Surface Casing',
        od: 9.625,
        weight: 40,
        top: 0,
        bottom: 5000,
        toc: null,
        boc: null,
        show: true
      }
    ],
    tubingData: [
      {
        rowId: 'tubing-1',
        label: 'Production Tubing',
        od: 4.5,
        weight: 12.6,
        top: 0,
        bottom: 4000,
        show: true
      }
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
    trajectory: [],
    config: {
      operationPhase: 'production'
    },
    interaction: {}
  };
}

describe('topology tubing-inner volume split', () => {
  it('maps legacy BORE source tokens to TUBING_INNER', () => {
    expect(normalizeSourceVolumeKind('BORE')).toBe('TUBING_INNER');
    expect(normalizeSourceVolumeKind('tubing_inner')).toBe('TUBING_INNER');
  });

  it('builds tubing-aware inner core nodes and preserves legacy scenario source compatibility', () => {
    const state = buildBaseState();
    state.topologySources = [
      {
        rowId: 'src-legacy-bore',
        sourceType: 'formation_inflow',
        volumeKey: 'BORE',
        top: 1200,
        bottom: 1300,
        show: true
      }
    ];

    const result = buildTopologyModel(state, { requestId: 1, wellId: 'well-tubing-volume' });
    const sourceEntity = result.sourceEntities.find((entity) => entity.rowId === 'src-legacy-bore');

    expect(result.nodes.some((node) => node.kind === 'TUBING_INNER')).toBe(true);
    expect(result.nodes.some((node) => node.kind === 'BORE')).toBe(false);
    expect(sourceEntity?.volumeKey).toBe('TUBING_INNER');
  });
});
