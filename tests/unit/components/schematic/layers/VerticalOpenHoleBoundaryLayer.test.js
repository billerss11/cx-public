import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import VerticalOpenHoleBoundaryLayer from '@/components/schematic/layers/VerticalOpenHoleBoundaryLayer.vue';
import { getIntervals, getStackAtDepth } from '@/physics/physicsCore.js';
import defaultSampleProject from '@/data/samples/defaultSampleProject.json';

function createLinearScale(multiplier = 1, offset = 0) {
  const scale = (value) => (Number(value) * multiplier) + offset;
  scale.range = () => [0, 1200];
  return scale;
}

describe('VerticalOpenHoleBoundaryLayer', () => {
  it('renders manual-hole open-hole boundaries and emits casing selection events', async () => {
    const wrapper = mount(VerticalOpenHoleBoundaryLayer, {
      props: {
        slices: [
          {
            top: 1000,
            bottom: 1200,
            stack: [
              {
                role: 'annulus',
                material: 'mud',
                innerRadius: 4,
                outerRadius: 6,
                isOpenHoleBoundary: true,
                source: { type: 'pipe', pipeType: 'casing', index: 0, sourceIndex: 0 }
              }
            ]
          }
        ],
        casingData: [
          {
            label: '9 5/8" Casing',
            od: 9.625,
            weight: 47,
            top: 1000,
            bottom: 1200,
            manualHoleSize: 12.25
          }
        ],
        xScale: createLinearScale(10, 300),
        yScale: createLinearScale(1, 0),
        diameterScale: 1
      }
    });

    expect(wrapper.findAll('.vertical-open-hole-boundary-layer__formation-fill')).toHaveLength(0);
    expect(wrapper.find('#vertical-open-hole-formation-dots').exists()).toBe(false);
    expect(wrapper.findAll('.vertical-open-hole-boundary-layer__wall')).toHaveLength(2);

    const firstHitTarget = wrapper.find('.vertical-open-hole-boundary-layer__hit-target');
    expect(firstHitTarget.attributes('data-casing-index')).toBe('0');
    await firstHitTarget.trigger('click');

    const selectEvents = wrapper.emitted('select-pipe') ?? [];
    expect(selectEvents).toHaveLength(1);
    expect(selectEvents[0]).toEqual([{ pipeType: 'casing', rowIndex: 0 }]);
  });

  it('skips boundaries sourced from explicit open-hole rows to avoid duplicate rendering', () => {
    const wrapper = mount(VerticalOpenHoleBoundaryLayer, {
      props: {
        slices: [
          {
            top: 500,
            bottom: 700,
            stack: [
              {
                role: 'annulus',
                material: 'mud',
                innerRadius: 4,
                outerRadius: 6,
                isOpenHoleBoundary: true,
                source: { type: 'pipe', pipeType: 'casing', index: 0, sourceIndex: 0 }
              }
            ]
          }
        ],
        casingData: [
          {
            label: 'Open Hole',
            od: 12.25,
            weight: null,
            top: 500,
            bottom: 700
          }
        ],
        xScale: createLinearScale(10, 300),
        yScale: createLinearScale(1, 0),
        diameterScale: 1
      }
    });

    expect(wrapper.findAll('.vertical-open-hole-boundary-layer__wall')).toHaveLength(0);
    expect(wrapper.findAll('.vertical-open-hole-boundary-layer__formation-fill')).toHaveLength(0);
  });

  it('renders open-hole boundaries for sample production liner when manual hole size is set', () => {
    const sampleWell = defaultSampleProject?.wells?.[0];
    const baseData = sampleWell?.data ?? {};
    const casingData = Array.isArray(baseData.casingData)
      ? baseData.casingData.map((row) => ({ ...row }))
      : [];
    const productionLinerIndex = casingData.findIndex((row) => String(row?.label ?? '').trim() === 'Production liner');
    expect(productionLinerIndex).toBeGreaterThanOrEqual(0);
    casingData[productionLinerIndex].manualHoleSize = 10;

    const state = {
      casingData,
      tubingData: Array.isArray(baseData.tubingData) ? baseData.tubingData : [],
      drillStringData: Array.isArray(baseData.drillStringData) ? baseData.drillStringData : [],
      equipmentData: Array.isArray(baseData.equipmentData) ? baseData.equipmentData : [],
      horizontalLines: Array.isArray(baseData.horizontalLines) ? baseData.horizontalLines : [],
      cementPlugs: Array.isArray(baseData.cementPlugs) ? baseData.cementPlugs : [],
      annulusFluids: Array.isArray(baseData.annulusFluids) ? baseData.annulusFluids : [],
      markers: Array.isArray(baseData.markers) ? baseData.markers : [],
      trajectory: Array.isArray(baseData.trajectory) ? baseData.trajectory : [],
      config: { ...(sampleWell?.config ?? {}), viewMode: 'vertical', operationPhase: 'production' },
      interaction: {}
    };

    const slices = getIntervals(state)
      .map((interval) => {
        const top = Number(interval?.top);
        const bottom = Number(interval?.bottom);
        const midpoint = Number(interval?.midpoint);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null;
        const sampleDepth = Number.isFinite(midpoint) ? midpoint : ((top + bottom) / 2);
        return {
          top,
          bottom,
          midpoint: sampleDepth,
          stack: getStackAtDepth(sampleDepth, state)
        };
      })
      .filter(Boolean);

    const openHoleBoundaryLayers = slices.flatMap((slice) => (
      (Array.isArray(slice.stack) ? slice.stack : []).filter((layer) => layer?.isOpenHoleBoundary === true)
    ));
    expect(openHoleBoundaryLayers.length).toBeGreaterThan(0);
    const boundarySourceIndices = openHoleBoundaryLayers
      .map((layer) => Number(layer?.source?.sourceIndex ?? layer?.source?.index))
      .filter((index) => Number.isInteger(index));
    expect(boundarySourceIndices.length).toBeGreaterThan(0);
    expect(boundarySourceIndices).toContain(productionLinerIndex);

    const wrapper = mount(VerticalOpenHoleBoundaryLayer, {
      props: {
        slices,
        casingData,
        xScale: createLinearScale(10, 300),
        yScale: createLinearScale(0.05, 0),
        diameterScale: 1
      }
    });

    const walls = wrapper.findAll('.vertical-open-hole-boundary-layer__wall');
    expect(walls.length).toBeGreaterThan(0);
  });
});