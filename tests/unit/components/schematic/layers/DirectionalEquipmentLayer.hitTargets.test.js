import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DirectionalEquipmentLayer from '@/components/schematic/layers/DirectionalEquipmentLayer.vue';

function createLinearProjector() {
  return (md, offset = 0) => [100 + (Number(md) * 0.1) + (Number(offset) * 8), 200 + (Number(md) * 0.05)];
}

describe('DirectionalEquipmentLayer hit targets', () => {
  it('renders hit targets for packer and safety valve and emits selection events', async () => {
    const wrapper = mount(DirectionalEquipmentLayer, {
      props: {
        equipment: [
          {
            sourceIndex: 0,
            type: 'bridge_plug',
            depth: 500,
            scale: 1,
            color: '#123456',
            sealInnerDiameter: 6,
            sealOuterDiameter: 10
          },
          {
            sourceIndex: 1,
            type: 'safety_valve',
            depth: 700,
            scale: 1,
            color: '#654321',
            tubingParentID: 4
          }
        ],
        projector: createLinearProjector(),
        totalMd: 2000,
        diameterScale: 1
      }
    });

    const polygonTargets = wrapper.findAll('.equipment-hit-target--polygon');
    const ellipseTargets = wrapper.findAll('.equipment-hit-target--ellipse');
    expect(polygonTargets.length).toBeGreaterThan(0);
    expect(ellipseTargets.length).toBe(1);

    await polygonTargets[0].trigger('click');
    const selectEvents = wrapper.emitted('select-equipment') || [];
    expect(selectEvents.length).toBeGreaterThan(0);
    expect(selectEvents[0]).toEqual([0]);
  });
});
