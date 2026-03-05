import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DirectionalDecorationLayer from '@/components/schematic/layers/DirectionalDecorationLayer.vue';

function createIdentityScale() {
  return (value) => Number(value);
}

function resolveLineCenterX(lineWrapper) {
  const x1 = Number(lineWrapper.attributes('x1'));
  const x2 = Number(lineWrapper.attributes('x2'));
  return (x1 + x2) / 2;
}

function createStateSnapshot() {
  return {
    casingData: [
      {
        rowId: 'csg-1',
        top: 0,
        bottom: 2000,
        od: 10,
        idOverride: 8,
        weight: 40
      }
    ],
    tubingData: [],
    drillStringData: [],
    equipmentData: [],
    markers: [],
    annulusFluids: [],
    cementPlugs: [],
    horizontalLines: [],
    annotationBoxes: [],
    config: {}
  };
}

describe('DirectionalDecorationLayer leak placement', () => {
  it('centers leak X on wall thickness for attached casing hosts', () => {
    const wrapper = mount(DirectionalDecorationLayer, {
      props: {
        trajectoryPoints: [
          { md: 0, tvd: 0, x: 0 },
          { md: 2000, tvd: 2000, x: 0 }
        ],
        stateSnapshot: createStateSnapshot(),
        markers: [
          {
            top: 1000,
            bottom: 1000,
            type: 'Leak',
            side: 'Right',
            attachToHostType: 'casing',
            attachToId: 'csg-1',
            show: true,
            color: '#8B0000',
            scale: 1
          }
        ],
        xScale: createIdentityScale(),
        yScale: createIdentityScale(),
        totalMd: 2000,
        diameterScale: 1,
        maxProjectedRadius: 12,
        xExaggeration: 1,
        xOrigin: 0
      }
    });

    const leakLines = wrapper.findAll('line.directional-decoration-layer__marker-leak');
    expect(leakLines).toHaveLength(2);
    leakLines.forEach((line) => {
      const centerX = resolveLineCenterX(line);
      expect(Math.abs(centerX)).toBeCloseTo(4.5, 2);
    });
  });
});
