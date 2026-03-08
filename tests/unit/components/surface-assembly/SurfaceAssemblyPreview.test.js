import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SurfaceAssemblyPreview from '@/components/surface-assembly/SurfaceAssemblyPreview.vue';
import { createSurfaceAssemblyFromFamily } from '@/utils/surfaceAssemblyModel.js';

describe('SurfaceAssemblyPreview', () => {
  it('renders family-specific engineering slots for a vertical tree', () => {
    const assembly = createSurfaceAssemblyFromFamily('vertical-tree');

    const wrapper = mount(SurfaceAssemblyPreview, {
      props: {
        assembly,
        showLabels: true,
      },
    });

    expect(wrapper.findAll('[data-testid="surface-assembly-slot"]').length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('Vertical Tree');
    expect(wrapper.text()).toContain('Wing Branch');
  });

  it('emits selected engineering entity keys when the preview is interactive', async () => {
    const assembly = createSurfaceAssemblyFromFamily('horizontal-tree');

    const wrapper = mount(SurfaceAssemblyPreview, {
      props: {
        assembly,
        interactive: true,
      },
    });

    await wrapper.get('[data-entity-key="device:productionMasterValve"]').trigger('click');

    expect(wrapper.emitted('select-entity')).toEqual([['device:productionMasterValve']]);
  });
});
