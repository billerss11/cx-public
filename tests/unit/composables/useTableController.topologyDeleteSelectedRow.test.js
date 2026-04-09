import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useTableController } from '@/composables/useTableController.js';

const selectionMocks = vi.hoisted(() => ({
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

vi.mock('@/app/hot.js', () => ({
  refreshHotLayout: vi.fn()
}));

vi.mock('@/composables/useSchematicRenderer.js', () => ({
  requestSchematicRender: vi.fn()
}));

vi.mock('@/app/selection.js', () => selectionMocks);

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

function createTopologySourceRow(id = 'src-1') {
  return {
    rowId: id,
    top: 1000,
    bottom: 1000,
    sourceType: 'formation_inflow',
    volumeKey: 'ANNULUS_A',
    show: true
  };
}

function createTopologyBreakoutRow(id = 'br-1') {
  return {
    rowId: id,
    top: 1200,
    bottom: 1200,
    sourceType: 'scenario',
    fromVolumeKey: 'ANNULUS_A',
    toVolumeKey: 'ANNULUS_B',
    show: true
  };
}

let controllerApi = null;
let wrapper = null;

async function mountHarness(tableType, tabKey) {
  const Harness = defineComponent({
    name: `UseTableControllerHarness_${tableType}`,
    setup() {
      controllerApi = useTableController(tableType, tabKey);
      return () => h('div');
    }
  });

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

describe('useTableController topology delete selected row', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    controllerApi = null;
    Object.values(selectionMocks).forEach((mockFn) => {
      if (typeof mockFn?.mockReset === 'function') {
        mockFn.mockReset();
      }
    });
  });

  it('deletes selected topology source row using cached selection when hot selection is unavailable', async () => {
    await mountHarness('topologySource', 'topologySources');
    const projectDataStore = useProjectDataStore();

    projectDataStore.topologySources = [
      createTopologySourceRow('src-1'),
      createTopologyBreakoutRow('br-1')
    ];

    await nextTick();
    controllerApi.hotSettings.value.afterSelectionEnd(0, 0, 0, 0);
    controllerApi.deleteSelectedRow();
    await nextTick();

    expect(projectDataStore.topologySources).toHaveLength(1);
    expect(projectDataStore.topologySources[0].rowId).toBe('br-1');
    expect(selectionMocks.clearSelection).toHaveBeenCalledWith('topologySource');
  });

  it('deletes selected topology breakout row using cached selection when hot selection is unavailable', async () => {
    await mountHarness('topologyBreakout', 'topologyBreakouts');
    const projectDataStore = useProjectDataStore();

    projectDataStore.topologySources = [
      createTopologySourceRow('src-1'),
      createTopologyBreakoutRow('br-1')
    ];

    await nextTick();
    controllerApi.hotSettings.value.afterSelectionEnd(0, 0, 0, 0);
    controllerApi.deleteSelectedRow();
    await nextTick();

    expect(projectDataStore.topologySources).toHaveLength(1);
    expect(projectDataStore.topologySources[0].rowId).toBe('src-1');
    expect(selectionMocks.clearSelection).toHaveBeenCalledWith('topologyBreakout');
  });
});