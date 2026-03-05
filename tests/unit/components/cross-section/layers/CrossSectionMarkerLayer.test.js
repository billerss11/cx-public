import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CrossSectionMarkerLayer from '@/components/cross-section/layers/CrossSectionMarkerLayer.vue';

function resolveLineCenterX(lineWrapper) {
  const x1 = Number(lineWrapper.attributes('x1'));
  const x2 = Number(lineWrapper.attributes('x2'));
  return (x1 + x2) / 2;
}

describe('CrossSectionMarkerLayer', () => {
  it('draws leak markers at the wall-center radius when provided', () => {
    const wrapper = mount(CrossSectionMarkerLayer, {
      props: {
        items: [
          {
            markerIndex: 0,
            type: 'leak',
            color: '#8B0000',
            scale: 1,
            baseRadius: 10,
            wallCenterRadius: 8,
            showLeft: true,
            showRight: false
          }
        ],
        scale: 1,
        activeEntity: null
      }
    });

    const lines = wrapper.findAll('line');
    expect(lines).toHaveLength(2);
    lines.forEach((line) => {
      expect(resolveLineCenterX(line)).toBeCloseTo(-8, 6);
    });
  });
});
