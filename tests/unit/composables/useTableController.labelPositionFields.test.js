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

  it('hides draggable label position columns from user-facing tables while keeping domain columns intact', async () => {
    const cases = [
      {
        type: 'casing',
        tabKey: 'casing',
        hiddenFields: [
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
        hiddenFields: [
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
        hiddenFields: [
          'labelXPos',
          'manualLabelDepth',
          'directionalCenterlineOffsetPx',
          'directionalManualLabelDepth'
        ]
      },
      {
        type: 'plug',
        tabKey: 'plugs',
        hiddenFields: [
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
        hiddenFields: [
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
        hiddenFields: [
          'labelXPos',
          'manualLabelDepth',
          'directionalCenterlineOffsetPx',
          'directionalManualLabelDepth',
          'directionalManualLabelTvd'
        ]
      }
    ];

    for (const testCase of cases) {
      await mountHarness(testCase.type, testCase.tabKey);
      const columnFields = resolveColumnFields();
      testCase.hiddenFields.forEach((field) => {
        expect(columnFields).not.toContain(field);
      });
      wrapper.unmount();
      wrapper = null;
      controllerApi = null;
    }
  });
});