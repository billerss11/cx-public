import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CrossSectionEquipmentLayer from '@/components/cross-section/layers/CrossSectionEquipmentLayer.vue';

describe('CrossSectionEquipmentLayer', () => {
  it('fills resolved packer ring annulus in black', () => {
    const wrapper = mount(CrossSectionEquipmentLayer, {
      props: {
        items: [
          {
            equipmentIndex: 0,
            type: 'Packer',
            color: 'black',
            scale: 1,
            isOrphaned: false,
            sealInnerRadius: 1.5,
            sealOuterRadius: 3.0
          }
        ],
        scale: 1,
        activeEntity: null
      }
    });

    const ring = wrapper.find('path.cross-section-equipment-layer__shape');
    expect(ring.exists()).toBe(true);
    expect(ring.attributes('fill')).toBe('black');
  });
});

