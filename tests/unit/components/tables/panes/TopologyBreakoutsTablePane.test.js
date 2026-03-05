import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TopologyBreakoutsTablePane from '@/components/tables/panes/TopologyBreakoutsTablePane.vue';

const mockState = vi.hoisted(() => ({
  tableDataRows: [
    {
      rowId: 'br-1',
      top: 1000,
      bottom: 1200,
      fromVolumeKey: 'ANNULUS_A',
      toVolumeKey: 'ANNULUS_B',
      show: true
    },
    {
      rowId: 'br-2',
      top: 1300,
      bottom: 1400,
      fromVolumeKey: 'ANNULUS_B',
      toVolumeKey: 'ANNULUS_C',
      show: true
    }
  ],
  activeWellTopologyValue: {
    result: {
      validationWarnings: [
        {
          code: 'scenario_breakout_no_resolvable_interval',
          rowId: 'br-2',
          message: 'Row does not resolve in modeled intervals.'
        }
      ]
    }
  },
  requestTableRowFocus: vi.fn(),
  setActiveTableTabKey: vi.fn(),
  setTablesAccordionOpen: vi.fn()
}));

const tableDataRef = ref(mockState.tableDataRows);
const activeWellTopologyRef = ref(mockState.activeWellTopologyValue);

vi.mock('@/composables/useTableController.js', () => ({
  useTableController: () => ({
    hotRef: ref(null),
    hotSettings: ref({}),
    tableData: tableDataRef,
    addRow: vi.fn(),
    deleteSelectedRow: vi.fn()
  })
}));

vi.mock('@/stores/topologyStore.js', () => ({
  useTopologyStore: () => ({
    activeWellTopology: activeWellTopologyRef
  })
}));

vi.mock('@/components/tables/panes/tablePaneState.js', () => ({
  requestTableRowFocus: mockState.requestTableRowFocus,
  setActiveTableTabKey: mockState.setActiveTableTabKey,
  setTablesAccordionOpen: mockState.setTablesAccordionOpen
}));

function mountPane() {
  return shallowMount(TopologyBreakoutsTablePane, {
    global: {
      stubs: {
        HotTable: {
          template: '<div class="hot-table-stub" />'
        },
        Button: {
          template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  });
}

describe('TopologyBreakoutsTablePane', () => {
  beforeEach(() => {
    mockState.requestTableRowFocus.mockReset();
    mockState.setActiveTableTabKey.mockReset();
    mockState.setTablesAccordionOpen.mockReset();
  });

  it('requests breakout row focus when warning row focus button is clicked', async () => {
    const wrapper = mountPane();
    const focusButtons = wrapper.findAll('.topology-breakouts-table-pane__warning-focus-button');
    expect(focusButtons.length).toBe(1);

    await focusButtons[0].trigger('click');

    expect(mockState.setTablesAccordionOpen).toHaveBeenCalledWith(true);
    expect(mockState.setActiveTableTabKey).toHaveBeenCalledWith('topologyBreakouts');
    expect(mockState.requestTableRowFocus).toHaveBeenCalledWith('topologyBreakout', 1);
  });
});
