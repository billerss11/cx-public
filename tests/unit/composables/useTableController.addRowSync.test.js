import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { useTableController } from '@/composables/useTableController.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';

vi.mock('@/app/hot.js', () => ({
  refreshHotLayout: vi.fn()
}));

vi.mock('@/composables/useSchematicRenderer.js', () => ({
  requestSchematicRender: vi.fn()
}));

vi.mock('@/app/selection.js', () => ({
  syncSelectionIndicators: vi.fn(),
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
    selectCell: vi.fn(),
    scrollViewportTo: vi.fn(),
    render: vi.fn()
  };
}

let controllerApi = null;
let wrapper = null;

const Harness = defineComponent({
  name: 'UseTableControllerHarness',
  setup() {
    controllerApi = useTableController('casing', 'casing');
    return () => h('div');
  }
});

async function mountHarnessWithHotInstance() {
  const pinia = createPinia();
  setActivePinia(pinia);

  wrapper = mount(Harness, {
    global: {
      plugins: [pinia]
    }
  });

  const hotInstance = createHotInstanceStub();
  controllerApi.hotRef.value = { hotInstance };
  await nextTick();
  return { hotInstance };
}

describe('useTableController add row synchronization', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    controllerApi = null;
  });

  it('reloads Handsontable rows after addRow updates the store', async () => {
    const { hotInstance } = await mountHarnessWithHotInstance();
    const projectDataStore = useProjectDataStore();

    expect(projectDataStore.casingData).toHaveLength(0);
    hotInstance.loadData.mockClear();

    controllerApi.addRow();
    await nextTick();
    await nextTick();

    expect(projectDataStore.casingData).toHaveLength(1);
    expect(hotInstance.loadData).toHaveBeenCalledTimes(1);
    expect(hotInstance.loadData.mock.calls[0][0]).toHaveLength(1);
  });
});

