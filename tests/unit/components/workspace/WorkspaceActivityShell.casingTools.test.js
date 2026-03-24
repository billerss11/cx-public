import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceActivityShell from '@/components/workspace/WorkspaceActivityShell.vue';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

vi.mock('@/app/i18n.js', () => ({
  t: (key) => key,
  onLanguageChange: () => () => {}
}));

const passthroughStub = (name) => defineComponent({
  name,
  template: '<div><slot /></div>'
});

const ButtonStub = defineComponent({
  name: 'Button',
  props: {
    icon: { type: String, default: '' },
    label: { type: String, default: '' }
  },
  emits: ['click'],
  template: `
    <button type="button" class="button-stub" @click="$emit('click')">
      <span v-if="icon" class="button-stub__icon">{{ icon }}</span>
      <span v-if="label" class="button-stub__label">{{ label }}</span>
      <slot />
    </button>
  `
});

const DialogStub = defineComponent({
  name: 'CasingToolsDialog',
  props: {
    visible: { type: Boolean, default: false }
  },
  emits: ['update:visible'],
  template: `
    <section v-if="visible" class="casing-tools-dialog-stub">
      Casing tools dialog
    </section>
  `
});

function mountShell(statePatch = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const workspaceStore = useWorkspaceStore();
  workspaceStore.currentActivity = 'design';
  Object.assign(workspaceStore, statePatch);

  return mount(WorkspaceActivityShell, {
    slots: {
      default: '<div data-testid="workspace-main-content">Main</div>'
    },
    global: {
      plugins: [pinia],
      stubs: {
        Button: ButtonStub,
        WorkspaceProjectActions: passthroughStub('WorkspaceProjectActions'),
        WorkspaceViewStateControls: passthroughStub('WorkspaceViewStateControls'),
        CanvasInteractionToolbar: passthroughStub('CanvasInteractionToolbar'),
        LeftHierarchyDock: passthroughStub('LeftHierarchyDock'),
        RightContextDock: passthroughStub('RightContextDock'),
        ResizableBottomDock: passthroughStub('ResizableBottomDock'),
        Dialog: passthroughStub('Dialog'),
        CasingToolsDialog: DialogStub
      }
    }
  });
}

describe('WorkspaceActivityShell casing tools launcher', () => {
  it('shows a Design-only launcher and opens the floating casing tools dialog', async () => {
    const wrapper = mountShell({ currentActivity: 'design' });

    const launcher = wrapper.find('[data-test="design-casing-tools-launcher"]');
    expect(launcher.exists()).toBe(true);
    expect(wrapper.find('.casing-tools-dialog-stub').exists()).toBe(false);

    await launcher.trigger('click');

    expect(wrapper.find('.casing-tools-dialog-stub').exists()).toBe(true);
  });
});
