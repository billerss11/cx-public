import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import ResizableBottomDock from '@/components/workspace/ResizableBottomDock.vue';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';
import { isTablesAccordionOpen, setTablesAccordionOpen } from '@/components/tables/panes/tablePaneState.js';

const ButtonStub = defineComponent({
  name: 'Button',
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
});

const TablesTabsPanelStub = defineComponent({
  name: 'TablesTabsPanel',
  template: '<div class="tables-tabs-panel-stub" />'
});

describe('ResizableBottomDock', () => {
  it('opens table pane visibility contract on mount and closes on close action', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const workspaceStore = useWorkspaceStore();
    workspaceStore.setBottomDockVisibility(true);
    setTablesAccordionOpen(false);
    expect(isTablesAccordionOpen.value).toBe(false);

    const wrapper = mount(ResizableBottomDock, {
      global: {
        plugins: [pinia],
        stubs: {
          Button: ButtonStub,
          TablesTabsPanel: TablesTabsPanelStub
        }
      }
    });

    expect(isTablesAccordionOpen.value).toBe(true);

    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    await buttons[buttons.length - 1].trigger('click');

    expect(workspaceStore.bottomDockVisible).toBe(false);
    expect(isTablesAccordionOpen.value).toBe(false);
  });
});
