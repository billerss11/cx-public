import { describe, expect, it } from 'vitest';
import {
  buildTopologyWarningNavigationByRowId,
  buildTopologySourceNavigationByRowId,
  resolveTopologyWarningRowNavigationTarget
} from '@/topology/warningNavigation.js';

describe('warningNavigation helpers', () => {
  it('maps source rows and breakout rows to their table navigation targets', () => {
    const sourceRows = [
      {
        rowId: 'src-1',
        sourceType: 'formation_inflow',
        volumeKey: 'BORE',
        top: 1000,
        bottom: 1200
      },
      {
        rowId: 'br-1',
        fromVolumeKey: 'ANNULUS_A',
        toVolumeKey: 'ANNULUS_B',
        top: 1300,
        bottom: 1400
      },
      {
        rowId: 'src-2',
        sourceType: 'scenario',
        volumeKey: 'ANNULUS_A',
        top: 1500,
        bottom: 1600
      },
      {
        rowId: 'br-2',
        fromVolumeKey: 'ANNULUS_B',
        toVolumeKey: 'ANNULUS_C',
        top: 1700,
        bottom: 1800
      }
    ];

    const navigationByRowId = buildTopologySourceNavigationByRowId(sourceRows);

    expect(navigationByRowId.get('src-1')).toEqual({
      tabKey: 'topologySources',
      tableType: 'topologySource',
      rowIndex: 0
    });
    expect(navigationByRowId.get('src-2')).toEqual({
      tabKey: 'topologySources',
      tableType: 'topologySource',
      rowIndex: 2
    });
    expect(navigationByRowId.get('br-1')).toEqual({
      tabKey: 'topologyBreakouts',
      tableType: 'topologyBreakout',
      rowIndex: 0
    });
    expect(navigationByRowId.get('br-2')).toEqual({
      tabKey: 'topologyBreakouts',
      tableType: 'topologyBreakout',
      rowIndex: 1
    });
  });

  it('resolves warning row navigation target by rowId safely', () => {
    const navigationByRowId = buildTopologySourceNavigationByRowId([
      {
        rowId: 'src-1',
        sourceType: 'formation_inflow',
        volumeKey: 'BORE',
        top: 1000,
        bottom: 1200
      }
    ]);

    expect(resolveTopologyWarningRowNavigationTarget('src-1', navigationByRowId)).toEqual({
      tabKey: 'topologySources',
      tableType: 'topologySource',
      rowIndex: 0
    });
    expect(resolveTopologyWarningRowNavigationTarget('missing', navigationByRowId)).toBeNull();
    expect(resolveTopologyWarningRowNavigationTarget('src-1', null)).toBeNull();
  });

  it('adds equipment row navigation targets for warning correction flow', () => {
    const warningNavigation = buildTopologyWarningNavigationByRowId({
      equipmentRows: [
        {
          rowId: 'equipment-1',
          type: 'Packer',
          depth: 1200,
          show: true
        },
        {
          rowId: 'equipment-2',
          type: 'Safety Valve',
          depth: 2100,
          show: true
        }
      ],
      sourceRows: [
        {
          rowId: 'src-1',
          sourceType: 'formation_inflow',
          volumeKey: 'BORE',
          top: 1000,
          bottom: 1200
        },
        {
          rowId: 'br-1',
          fromVolumeKey: 'ANNULUS_A',
          toVolumeKey: 'ANNULUS_B',
          top: 1300,
          bottom: 1400
        }
      ]
    });

    expect(resolveTopologyWarningRowNavigationTarget('equipment-1', warningNavigation)).toEqual({
      tabKey: 'equipment',
      tableType: 'equipment',
      rowIndex: 0
    });
    expect(resolveTopologyWarningRowNavigationTarget('equipment-2', warningNavigation)).toEqual({
      tabKey: 'equipment',
      tableType: 'equipment',
      rowIndex: 1
    });
    expect(resolveTopologyWarningRowNavigationTarget('src-1', warningNavigation)).toEqual({
      tabKey: 'topologySources',
      tableType: 'topologySource',
      rowIndex: 0
    });
    expect(resolveTopologyWarningRowNavigationTarget('br-1', warningNavigation)).toEqual({
      tabKey: 'topologyBreakouts',
      tableType: 'topologyBreakout',
      rowIndex: 0
    });
  });

  it('adds marker row navigation targets for warning correction flow', () => {
    const warningNavigation = buildTopologyWarningNavigationByRowId({
      markerRows: [
        {
          rowId: 'marker-1',
          type: 'Leak',
          top: 2200,
          bottom: 2250,
          show: true
        },
        {
          rowId: 'marker-2',
          type: 'Perforation',
          top: 2500,
          bottom: 2550,
          show: true
        }
      ]
    });

    expect(resolveTopologyWarningRowNavigationTarget('marker-1', warningNavigation)).toEqual({
      tabKey: 'markers',
      tableType: 'marker',
      rowIndex: 0
    });
    expect(resolveTopologyWarningRowNavigationTarget('marker-2', warningNavigation)).toEqual({
      tabKey: 'markers',
      tableType: 'marker',
      rowIndex: 1
    });
  });
});
