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

function mountShell(statePatch = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const workspaceStore = useWorkspaceStore();
  workspaceStore.leftDockVisible = true;
  workspaceStore.leftDockWidth = 320;
  workspaceStore.rightDockVisible = false;
  workspaceStore.rightDockWidth = 340;
  workspaceStore.bottomDockVisible = true;
  workspaceStore.bottomDockHeight = 280;
  workspaceStore.bottomDockMode = 'docked';
  Object.assign(workspaceStore, statePatch);

  return mount(WorkspaceActivityShell, {
    slots: {
      default: '<div data-testid="workspace-main-content">Main</div>'
    },
    global: {
      plugins: [pinia],
      stubs: {
        Button: passthroughStub('Button'),
        WorkspaceProjectActions: passthroughStub('WorkspaceProjectActions'),
        WorkspaceViewStateControls: passthroughStub('WorkspaceViewStateControls'),
        CanvasInteractionToolbar: passthroughStub('CanvasInteractionToolbar'),
        LeftHierarchyDock: passthroughStub('LeftHierarchyDock'),
        RightContextDock: passthroughStub('RightContextDock'),
        ResizableBottomDock: passthroughStub('ResizableBottomDock'),
        CasingToolsDialog: passthroughStub('CasingToolsDialog'),
        Dialog: passthroughStub('Dialog')
      }
    }
  });
}

describe('WorkspaceActivityShell layout', () => {
  it('shows left hierarchy dock and bottom tables dock when enabled', () => {
    const wrapper = mountShell({ bottomDockVisible: true });

    expect(wrapper.find('.workspace-activity-shell__left-dock').exists()).toBe(true);
    expect(wrapper.find('.workspace-activity-shell__bottom-dock').isVisible()).toBe(true);
  });
});
