import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrimeVue from 'primevue/config';
import SurfaceFocusPanel from '@/components/surface/SurfaceFocusPanel.vue';

vi.mock('@/app/i18n.js', () => ({
  t: (_key, fallback) => fallback ?? _key
}));

describe('SurfaceFocusPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds the standard template when the surface model is empty', async () => {
    const wrapper = mount(SurfaceFocusPanel, {
      global: {
        plugins: [
          PrimeVue,
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: false,
            initialState: {
              project: {
                activeWellId: 'well-1'
              },
              projectData: {
                casingData: [
                  { rowId: 'csg-1', top: 0, bottom: 3000, od: 9.625, weight: 40, show: true }
                ],
                tubingData: [
                  { rowId: 'tbg-1', top: 0, bottom: 2800, od: 4.5, weight: 12.6, show: true }
                ],
                drillStringData: [],
                equipmentData: [],
                horizontalLines: [],
                annotationBoxes: [],
                userAnnotations: [],
                cementPlugs: [],
                annulusFluids: [],
                markers: [],
                topologySources: [],
                surfacePaths: [],
                surfaceTransfers: [],
                surfaceOutlets: [],
                surfaceTemplate: {},
                trajectory: []
              }
            }
          })
        ]
      }
    });

    expect(wrapper.text()).toContain('Start from a standard production tree');

    await wrapper.get('[data-testid="surface-template-use-standard"]').trigger('click');

    expect(wrapper.text()).toContain('Tubing Path');
    expect(wrapper.text()).toContain('Production Outlet');
  });

  it('seeds all available annulus paths for a multi-annulus sample well', async () => {
    const wrapper = mount(SurfaceFocusPanel, {
      global: {
        plugins: [
          PrimeVue,
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: false,
            initialState: {
              project: {
                activeWellId: 'well-1'
              },
              projectData: {
                casingData: [
                  { rowId: 'csg-1', top: 0, bottom: 3000, od: 18.625, weight: 68, show: true },
                  { rowId: 'csg-2', top: 0, bottom: 3000, od: 13.375, weight: 54.5, show: true },
                  { rowId: 'csg-3', top: 0, bottom: 3000, od: 9.625, weight: 40, show: true }
                ],
                tubingData: [
                  { rowId: 'tbg-1', top: 0, bottom: 2800, od: 4.5, weight: 12.6, show: true }
                ],
                drillStringData: [],
                equipmentData: [],
                horizontalLines: [],
                annotationBoxes: [],
                userAnnotations: [],
                cementPlugs: [],
                annulusFluids: [],
                markers: [],
                topologySources: [],
                surfacePaths: [],
                surfaceTransfers: [],
                surfaceOutlets: [],
                surfaceTemplate: {},
                trajectory: []
              }
            }
          })
        ]
      }
    });

    await wrapper.get('[data-testid="surface-template-use-standard"]').trigger('click');

    expect(wrapper.text()).toContain('Annulus A Path');
    expect(wrapper.text()).toContain('Annulus B Path');
    expect(wrapper.text()).toContain('Annulus C Path');
  });
});
