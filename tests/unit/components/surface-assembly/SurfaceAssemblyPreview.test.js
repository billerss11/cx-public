import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SurfaceAssemblyPreview from '@/components/surface-assembly/SurfaceAssemblyPreview.vue';
import { createSurfaceAssemblyFromTemplate } from '@/utils/surfaceAssemblyModel.js';

describe('SurfaceAssemblyPreview', () => {
  it('renders trunk and branch components from a simple-tree assembly', () => {
    const assembly = createSurfaceAssemblyFromTemplate('simple-tree');

    const wrapper = mount(SurfaceAssemblyPreview, {
      props: {
        assembly,
        showLabels: true,
      },
    });

    expect(wrapper.findAll('[data-testid="surface-assembly-component"]').length).toBe(assembly.components.length);
    expect(wrapper.text()).toContain('Master Valve');
    expect(wrapper.text()).toContain('Wing Valve');
  });

  it('emits selected component ids when the preview is interactive', async () => {
    const assembly = createSurfaceAssemblyFromTemplate('simple-tree');
    const selectedComponent = assembly.components.find((component) => component.typeKey === 'master-valve');

    const wrapper = mount(SurfaceAssemblyPreview, {
      props: {
        assembly,
        interactive: true,
      },
    });

    await wrapper.get(`[data-component-id="${selectedComponent.componentId}"]`).trigger('click');

    expect(wrapper.emitted('select-component')).toEqual([[selectedComponent.componentId]]);
  });
});
