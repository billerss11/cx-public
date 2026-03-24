import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DirectionalBandLayer from '@/components/schematic/layers/DirectionalBandLayer.vue';

function createIdentityScale() {
  const scale = (value) => Number(value);
  scale.range = () => [0, 1000];
  return scale;
}

describe('DirectionalBandLayer render policy', () => {
  it('hides default mud annulus bands while still rendering explicit fluid layers', () => {
    const wrapper = mount(DirectionalBandLayer, {
      props: {
        intervals: [
          {
            top: 0,
            bottom: 100,
            stack: [
              {
                material: 'wellbore',
                role: 'core',
                innerRadius: 0,
                outerRadius: 4
              },
              {
                material: 'mud',
                role: 'annulus',
                innerRadius: 4,
                outerRadius: 6,
                source: { type: 'pipe', pipeType: 'casing', index: 0, sourceIndex: 0 }
              },
              {
                material: 'fluid',
                role: 'annulus',
                innerRadius: 6,
                outerRadius: 8,
                source: { type: 'fluid', index: 0 },
                color: '#00aacc'
              }
            ]
          }
        ],
        trajectoryPoints: [
          { md: 0, x: 0, tvd: 0 },
          { md: 100, x: 0, tvd: 100 }
        ],
        casingData: [],
        xScale: createIdentityScale(),
        yScale: createIdentityScale(),
        visualSizing: {
          physicalRadii: [0, 4, 6, 8],
          visualRadii: [0, 12, 18, 24],
          boundaryRadiiByKey: {
            '0.000000': 0,
            '4.000000': 12,
            '6.000000': 18,
            '8.000000': 24
          },
          pipeGeometryByKey: {}
        },
        diameterScale: 1,
        xExaggeration: 1,
        xOrigin: 0
      }
    });

    const fills = wrapper.findAll('.directional-band-layer__band').map((node) => node.attributes('fill'));
    expect(fills).toContain('var(--color-cross-core-fill)');
    expect(fills).toContain('#00aacc');
    expect(fills).not.toContain('var(--color-cross-annulus-fill)');
  });
});
