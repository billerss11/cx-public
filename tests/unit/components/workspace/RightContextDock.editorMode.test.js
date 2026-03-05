import { createTestingPinia } from '@pinia/testing';
import { shallowMount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import RightContextDock from '@/components/workspace/RightContextDock.vue';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

vi.mock('@/composables/useSelectedVisualContext.js', () => ({
  useSelectedVisualContext: () => ({
    hasSelectedVisualContext: ref(false),
    selectedVisualContext: ref(null)
  })
}));

vi.mock('@/components/controls/VisualPropertyInspector.vue', () => ({
  default: defineComponent({
    name: 'VisualPropertyInspector',
    template: '<div data-testid="visual-inspector-stub">Visual Property Inspector Stub</div>'
  })
}));

vi.mock('@/components/controls/AdvancedEntityEditor.vue', () => ({
  default: defineComponent({
    name: 'AdvancedEntityEditor',
    template: '<div data-testid="advanced-editor-stub">Advanced Entity Editor Stub</div>'
  })
}));

vi.mock('@/components/workspace/GlobalSettingsDockPanel.vue', () => ({
  default: defineComponent({
    name: 'GlobalSettingsDockPanel',
    template: '<div data-testid="global-settings-stub">Global Settings Dock Stub</div>'
  })
}));

describe('RightContextDock editor mode', () => {
  it('switches from common inspector to advanced editor', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,
      initialState: {
        workspace: {
          rightDockVisible: true,
          rightDockEditorMode: 'common',
          selectedHierarchyRef: {
            wellId: 'well-1',
            entityType: 'topologySource',
            rowId: 'src-1'
          }
        }
      }
    });

    const wrapper = shallowMount(RightContextDock, {
      global: {
        plugins: [pinia]
      }
    });

    const workspaceStore = useWorkspaceStore();
    expect(workspaceStore.rightDockEditorMode).toBe('common');
    expect(wrapper.text()).toContain('Visual Property Inspector');

    const advancedModeButton = wrapper.find('[data-testid="right-dock-mode-advanced"]');
    expect(advancedModeButton.exists()).toBe(true);
    await advancedModeButton.trigger('click');

    expect(workspaceStore.rightDockEditorMode).toBe('advanced');
    expect(wrapper.text()).toContain('Data Editor');
  });
});
