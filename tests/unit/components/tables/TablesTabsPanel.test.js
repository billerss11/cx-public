import { createTestingPinia } from '@pinia/testing';
import { shallowMount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TablesTabsPanel from '@/components/tables/TablesTabsPanel.vue';
import { activeTableTabKey } from '@/components/tables/panes/tablePaneState.js';

const passthroughStub = (name) => defineComponent({
  name,
  template: '<div><slot /></div>'
});

function mountTabsPanel({ viewMode = 'vertical' } = {}) {
  return shallowMount(TablesTabsPanel, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            viewConfig: {
              config: {
                viewMode,
                operationPhase: 'production',
                showPhysicsDebug: false
              }
            }
          }
        })
      ],
      stubs: {
        Tabs: passthroughStub('Tabs'),
        TabList: passthroughStub('TabList'),
        Tab: passthroughStub('Tab'),
        TabPanels: passthroughStub('TabPanels'),
        TabPanel: passthroughStub('TabPanel')
      }
    }
  });
}

describe('TablesTabsPanel', () => {
  beforeEach(() => {
    activeTableTabKey.value = 'casing';
  });

  it('renders topology breakouts tab in production mode', () => {
    const wrapper = mountTabsPanel();
    expect(wrapper.find('#topology-breakouts-tab').exists()).toBe(true);
  });

  it('renders topology breakouts tab in directional mode', () => {
    const wrapper = mountTabsPanel({ viewMode: 'directional' });
    expect(wrapper.find('#topology-breakouts-tab').exists()).toBe(true);
  });
});
