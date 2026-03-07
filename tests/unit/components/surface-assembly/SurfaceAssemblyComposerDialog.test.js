import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SurfaceAssemblyComposerDialog from '@/components/surface-assembly/SurfaceAssemblyComposerDialog.vue';
import { useProjectStore } from '@/stores/projectStore.js';
import { useSurfaceAssemblyStore } from '@/stores/surfaceAssemblyStore.js';

vi.mock('@/app/i18n.js', () => ({
  t: (key) => key,
}));

const dialogStub = {
  props: ['visible'],
  emits: ['update:visible'],
  template: `
    <div v-if="visible" class="dialog-stub">
      <slot />
      <slot name="footer" />
    </div>
  `,
};

const buttonStub = {
  emits: ['click'],
  template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
};

function mountDialog() {
  const pinia = createPinia();
  setActivePinia(pinia);

  const projectStore = useProjectStore();
  projectStore.ensureInitialized();

  const surfaceAssemblyStore = useSurfaceAssemblyStore();

  return {
    surfaceAssemblyStore,
    wrapper: mount(SurfaceAssemblyComposerDialog, {
      global: {
        plugins: [pinia],
        stubs: {
          Dialog: dialogStub,
          Button: buttonStub,
        },
      },
    }),
  };
}

describe('SurfaceAssemblyComposerDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('adds trunk blocks to the draft assembly from the palette', async () => {
    const { surfaceAssemblyStore, wrapper } = mountDialog();
    surfaceAssemblyStore.openComposer();
    await nextTick();

    const beforeCount = surfaceAssemblyStore.draftAssembly.components.length;

    await wrapper.get('[data-testid="surface-assembly-add-trunk-valve"]').trigger('click');

    expect(surfaceAssemblyStore.draftAssembly.components.length).toBe(beforeCount + 1);
  });

  it('applies the draft assembly and closes the composer', async () => {
    const { surfaceAssemblyStore, wrapper } = mountDialog();
    surfaceAssemblyStore.openComposer();
    await nextTick();

    await wrapper.get('[data-testid="surface-assembly-add-right-outlet"]').trigger('click');
    await wrapper.get('[data-testid="surface-assembly-apply"]').trigger('click');

    expect(surfaceAssemblyStore.isComposerVisible).toBe(false);
    expect(surfaceAssemblyStore.committedAssemblyForActiveWell).not.toBe(null);
    expect(
      surfaceAssemblyStore.committedAssemblyForActiveWell.components.some((component) => component.typeKey === 'outlet')
    ).toBe(true);
  });
});
