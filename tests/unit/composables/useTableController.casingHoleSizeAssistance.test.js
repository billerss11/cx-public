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

function createCasingRow(overrides = {}) {
  return {
    label: 'Test casing',
    od: 9.625,
    weight: 40,
    grade: 'L80',
    top: 0,
    bottom: 5000,
    toc: null,
    boc: null,
    linerMode: 'Auto',
    manualParent: null,
    idOverride: null,
    manualHoleSize: null,
    labelXPos: null,
    manualLabelDepth: null,
    casingLabelFontSize: null,
    depthLabelFontSize: null,
    depthLabelOffset: null,
    showTop: true,
    showBottom: true,
    ...overrides
  };
}

function createHotInstanceStub(rows = []) {
  return {
    _rows: rows,
    loadData: vi.fn(),
    getSourceData: vi.fn(() => rows),
    getSelectedLast: vi.fn(() => null),
    countRows: vi.fn(() => rows.length),
    countCols: vi.fn(() => 19),
    selectCell: vi.fn(),
    scrollViewportTo: vi.fn(),
    render: vi.fn(),
    getDataAtRowProp: vi.fn((row, prop) => rows[row]?.[prop]),
    setDataAtRowProp: vi.fn((row, prop, value) => {
      if (!rows[row]) rows[row] = {};
      rows[row][prop] = value;
    })
  };
}

let controllerApi = null;
let wrapper = null;

const Harness = defineComponent({
  name: 'UseTableControllerCasingHoleSizeHarness',
  setup() {
    controllerApi = useTableController('casing', 'casing');
    return () => h('div');
  }
});

async function mountHarness(rows = []) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const projectDataStore = useProjectDataStore();
  projectDataStore.setCasingData(rows);

  wrapper = mount(Harness, {
    global: {
      plugins: [pinia]
    }
  });

  const hotRows = projectDataStore.casingData.map((row) => ({ ...row }));
  const hotInstance = createHotInstanceStub(hotRows);
  controllerApi.hotRef.value = { hotInstance };
  await nextTick();

  const manualHoleSizeColumnIndex = controllerApi.hotSettings.value.columns.findIndex(
    (column) => column?.data === 'manualHoleSize'
  );

  return {
    hotInstance,
    manualHoleSizeColumnIndex,
    projectDataStore
  };
}

describe('useTableController casing hole-size assistance', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    controllerApi = null;
  });

  it('offers engineering-size autocomplete suggestions when the casing OD matches the catalog', async () => {
    const { manualHoleSizeColumnIndex } = await mountHarness([createCasingRow()]);

    const cellProps = controllerApi.hotSettings.value.cells(0, manualHoleSizeColumnIndex, 'manualHoleSize');

    expect(cellProps.type).toBe('autocomplete');
    expect(cellProps.source).toEqual(['7 7/8', '8 1/2', '8 3/4']);
  });

  it('normalizes fraction text to numeric storage for manual hole size values', async () => {
    const { hotInstance, projectDataStore } = await mountHarness([createCasingRow()]);

    controllerApi.hotSettings.value.afterChange([[0, 'manualHoleSize', null, '8 1/2']], 'edit');
    await nextTick();

    expect(hotInstance.getDataAtRowProp(0, 'manualHoleSize')).toBe(8.5);
    expect(projectDataStore.casingData[0].manualHoleSize).toBe(8.5);
  });

  it('applies warning classes for unmatched casing, custom hole sizes, and incompatible catalog hole sizes', async () => {
    const rows = [
      createCasingRow({ od: 9.62, manualHoleSize: 8.5 }),
      createCasingRow({ od: 9.625, manualHoleSize: 8.4 }),
      createCasingRow({ od: 9.625, manualHoleSize: 12.25 })
    ];
    const { manualHoleSizeColumnIndex } = await mountHarness(rows);

    const noMatchCell = controllerApi.hotSettings.value.cells(0, manualHoleSizeColumnIndex, 'manualHoleSize');
    const customHoleCell = controllerApi.hotSettings.value.cells(1, manualHoleSizeColumnIndex, 'manualHoleSize');
    const incompatibleHoleCell = controllerApi.hotSettings.value.cells(2, manualHoleSizeColumnIndex, 'manualHoleSize');

    expect(noMatchCell.className).toContain('casing-hole-size-cell--warning-no-casing-match');
    expect(customHoleCell.className).toContain('casing-hole-size-cell--warning-custom-hole');
    expect(incompatibleHoleCell.className).toContain('casing-hole-size-cell--warning-incompatible-hole');
  });

  it('rejects non-parsable hole-size text as invalid input', async () => {
    const { manualHoleSizeColumnIndex } = await mountHarness([createCasingRow()]);

    const cellProps = controllerApi.hotSettings.value.cells(0, manualHoleSizeColumnIndex, 'manualHoleSize');
    const validity = await new Promise((resolve) => {
      cellProps.validator('not-a-size', resolve);
    });

    expect(validity).toBe(false);
  });
});
