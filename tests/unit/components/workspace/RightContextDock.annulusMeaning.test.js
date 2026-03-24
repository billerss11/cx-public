import { createTestingPinia } from '@pinia/testing';
import { shallowMount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
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

vi.mock('@/components/annulus/AnnulusMeaningCard.vue', () => ({
  default: defineComponent({
    name: 'AnnulusMeaningCard',
    props: ['rows'],
    template: '<div class="annulus-meaning-card">{{ Array.isArray(rows) ? rows.map((row) => row.label).join(\",\") : \"\" }}</div>'
  })
}));

describe('RightContextDock annulus meaning', () => {
  it('renders annulus meaning in the design right dock and keeps it out of non-design activities', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,
      initialState: {
        workspace: {
          currentActivity: 'design',
          rightDockVisible: true,
          rightDockEditorMode: 'common',
          selectedHierarchyRef: {
            wellId: 'well-1',
            entityType: 'topologySource',
            rowId: 'src-1'
          }
        },
        projectData: {
          casingData: [
            { rowId: 'csg-1', label: 'Surface casing', od: 13.375, weight: 54.5, top: 0, bottom: 4000, show: true },
            { rowId: 'csg-2', label: 'Intermediate casing', od: 9.625, weight: 40, top: 0, bottom: 4000, show: true }
          ],
          tubingData: [
            { rowId: 'tbg-1', label: 'Production tubing', od: 4.5, weight: 12.6, top: 0, bottom: 3000, show: true }
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
          physicsIntervals: [],
          trajectory: []
        },
        viewConfig: {
          config: {
            viewMode: 'vertical',
            operationPhase: 'production',
            units: 'ft'
          }
        }
      }
    });

    const wrapper = shallowMount(RightContextDock, {
      global: {
        plugins: [pinia],
        stubs: {
          AnnulusMeaningCard: false
        }
      }
    });
    const workspaceStore = useWorkspaceStore();

    expect(wrapper.find('.right-context-dock__annulus-meaning').exists()).toBe(true);
    expect(wrapper.text()).toContain('Annulus A');

    pinia.state.value.workspace.currentActivity = 'analysis';
    await nextTick();

    expect(wrapper.find('.right-context-dock__annulus-meaning').exists()).toBe(false);
  });
});
