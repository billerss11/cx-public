import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MarkerLayer from '@/components/schematic/layers/MarkerLayer.vue';

function createIdentityScale() {
  return (value) => Number(value);
}

function resolveLineCenterX(lineWrapper) {
  const x1 = Number(lineWrapper.attributes('x1'));
  const x2 = Number(lineWrapper.attributes('x2'));
  return (x1 + x2) / 2;
}

describe('MarkerLayer leak placement', () => {
  it('centers leak X on the host casing wall thickness band', () => {
    const wrapper = mount(MarkerLayer, {
      props: {
        markers: [
          {
            top: 1000,
            bottom: 1000,
            type: 'Leak',
            side: 'Left',
            color: '#8B0000',
            scale: 1,
            show: true
          }
        ],
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
        xScale: createIdentityScale(),
        yScale: createIdentityScale(),
        diameterScale: 1
      }
    });

    const leakLines = wrapper.findAll('line.marker-layer__leak');
    expect(leakLines).toHaveLength(2);
    leakLines.forEach((line) => {
      expect(resolveLineCenterX(line)).toBeCloseTo(-4.5, 6);
    });
  });
});
