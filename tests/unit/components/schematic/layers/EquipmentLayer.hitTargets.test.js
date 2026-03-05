import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EquipmentLayer from '@/components/schematic/layers/EquipmentLayer.vue';

function createLinearScale(multiplier = 1, offset = 0) {
  const scale = (value) => (Number(value) * multiplier) + offset;
  scale.range = () => [0, 1200];
  return scale;
}

describe('EquipmentLayer hit targets', () => {
  it('renders explicit hit targets for packer and safety valve wireframe shapes', async () => {
    const wrapper = mount(EquipmentLayer, {
      props: {
        equipment: [
          {
            sourceIndex: 0,
            type: 'packer',
            depth: 1000,
            scale: 1,
            color: '#123456',
            sealInnerDiameter: 6,
            sealOuterDiameter: 10,
          },
          {
            sourceIndex: 1,
            type: 'safety valve',
            depth: 1500,
            scale: 1,
            color: '#654321',
            tubingParentID: 4,
          },
        ],
        xScale: createLinearScale(8, 300),
        yScale: createLinearScale(1, 0),
        diameterScale: 1,
        xHalf: 30,
      },
    });

    const rectTargets = wrapper.findAll('.equipment-hit-target--rect');
    expect(rectTargets.length).toBeGreaterThan(0);
    expect(wrapper.findAll('.equipment-hit-target--ellipse').length).toBe(1);

    await rectTargets[0].trigger('click');
    const selectEvents = wrapper.emitted('select-equipment') || [];
    expect(selectEvents.length).toBeGreaterThan(0);
    expect(selectEvents[0]).toEqual([0]);
  });
});
