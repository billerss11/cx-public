import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AnnulusMeaningCard from '@/components/annulus/AnnulusMeaningCard.vue';

describe('AnnulusMeaningCard', () => {
  it('renders compact annulus rows and depth-tagged segments', () => {
    const wrapper = mount(AnnulusMeaningCard, {
      props: {
        rows: [
          {
            channelKey: 'ANNULUS_A',
            label: 'Annulus A',
            segments: [
              {
                top: 0,
                bottom: 5000,
                depthLabel: '0-5,000 ft MD',
                description: 'between Production tubing and Intermediate casing'
              },
              {
                top: 5000,
                bottom: 9000,
                depthLabel: '5,000-9,000 ft MD',
                description: 'between Production tubing and Production liner'
              }
            ]
          },
          {
            channelKey: 'ANNULUS_B',
            label: 'Annulus B',
            segments: [
              {
                top: 0,
                bottom: 9000,
                depthLabel: '0-9,000 ft MD',
                description: 'between Intermediate casing and Surface casing'
              }
            ]
          },
          {
            channelKey: 'ANNULUS_C',
            label: 'Annulus C',
            segments: [
              {
                top: 8000,
                bottom: 12500,
                depthLabel: '8,000-12,500 ft MD',
                description: 'between Production liner and formation/open hole'
              }
            ]
          }
        ]
      }
    });

    expect(wrapper.find('.annulus-meaning-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('Annulus Meaning');
    expect(wrapper.text()).toContain('Annulus A');
    expect(wrapper.text()).toContain('Annulus B');
    expect(wrapper.text()).toContain('Annulus C');
    expect(wrapper.text()).toContain('0-5,000 ft MD');
    expect(wrapper.text()).toContain('between Production tubing and Production liner');
    expect(wrapper.text()).toContain('between Intermediate casing and Surface casing');
  });
});
