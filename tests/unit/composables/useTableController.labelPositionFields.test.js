import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { useTableController } from '@/composables/useTableController.js';

vi.mock('@/app/hot.js', () => ({
  refreshHotLayout: vi.fn()
}));

vi.mock('@/composables/useSchematicRenderer.js', () => ({
  requestSchematicRender: vi.fn()
}));

vi.mock('@/app/selection.js', () => ({
  syncSelectionIndicators: vi.fn(),
  clearSelection: vi.fn(),
  clearCasingSelection: vi.fn(),
  clearTubingSelection: vi.fn(),
  clearDrillStringSelection: vi.fn(),
  clearEquipmentSelection: vi.fn(),
  clearLineSelection: vi.fn(),
  clearBoxSelection: vi.fn(),
  clearMarkerSelection: vi.fn(),
  clearPlugSelection: vi.fn(),
  clearFluidSelection: vi.fn(),
  handleTableClick: vi.fn()
}));

function createHotInstanceStub() {
  return {
    loadData: vi.fn(),
    getSourceData: vi.fn(() => []),
    getSelectedLast: vi.fn(() => null),
    countRows: vi.fn(() => 0),
    countCols: vi.fn(() => 0),
    selectCell: vi.fn(),
    scrollViewportTo: vi.fn(),
    render: vi.fn()
  };
}

let wrapper = null;
let controllerApi = null;

function createHarness(type, tabKey) {
  return defineComponent({
    name: `UseTableController${type}Harness`,
    setup() {
      controllerApi = useTableController(type, tabKey);
      return () => h('div');
    }
  });
}

async function mountHarness(type, tabKey) {
  const pinia = createPinia();
  setActivePinia(pinia);

  wrapper = mount(createHarness(type, tabKey), {
    global: {
      plugins: [pinia]
    }
  });

  controllerApi.hotRef.value = { hotInstance: createHotInstanceStub() };
  await nextTick();
}

function resolveColumnFields() {
  return controllerApi.hotSettings.value.columns
    .map((column) => column?.data)
    .filter(Boolean);
}

describe('useTableController label position fields', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    controllerApi = null;
  });

  it('exposes draggable label position columns for scoped engineering domains', async () => {
    const cases = [
      {
        type: 'casing',
        tabKey: 'casing',
        expectedFields: [
          'labelXPos',
          'manualLabelDepth',
          'directionalLabelXPos',
          'directionalManualLabelDepth',
          'directionalManualLabelTvd',
          'topLabelXPos',
          'topManualLabelDepth',
          'bottomLabelXPos',
          'bottomManualLabelDepth',
          'directionalTopLabelXPos',
          'directionalTopManualLabelDepth',
          'directionalBottomLabelXPos',
          'directionalBottomManualLabelDepth'
        ]
      },
      {
        type: 'equipment',
        tabKey: 'equipment',
        expectedFields: [
          'labelXPos',
          'manualLabelDepth',
          'directionalLabelXPos',
          'directionalManualLabelDepth',
          'directionalManualLabelTvd'
        ]
      },
      {
        type: 'line',
        tabKey: 'lines',
        expectedFields: [
          'depth',
          'directionalDepthMode',
          'directionalDepthMd',
          'directionalDepthTvd',
          'labelXPos',
          'manualLabelDepth',
          'directionalLabelXPos',
          'directionalManualLabelDepth'
        ]
      },
      {
        type: 'plug',
        tabKey: 'plugs',
        expectedFields: [
          'labelXPos',
          'manualLabelDepth',
          'directionalLabelXPos',
          'directionalManualLabelDepth',
          'directionalManualLabelTvd'
        ]
      },
      {
        type: 'fluid',
        tabKey: 'fluids',
        expectedFields: [
          'labelXPos',
          'manualDepth',
          'directionalLabelXPos',
          'directionalManualLabelDepth',
          'directionalManualLabelTvd'
        ]
      },
      {
        type: 'box',
        tabKey: 'boxes',
        expectedFields: [
          'labelXPos',
          'manualLabelDepth',
          'directionalLabelXPos',
          'directionalManualLabelDepth',
          'directionalManualLabelTvd'
        ]
      }
    ];

    for (const testCase of cases) {
      await mountHarness(testCase.type, testCase.tabKey);
      const columnFields = resolveColumnFields();
      expect(columnFields).toEqual(expect.arrayContaining(testCase.expectedFields));
      wrapper.unmount();
      wrapper = null;
      controllerApi = null;
    }
  });
});
