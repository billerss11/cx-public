import { defineComponent, h } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import SchematicViewport from '@/components/schematic/SchematicViewport.vue';

const exportWorkflows = vi.hoisted(() => ({
  downloadJPEG: vi.fn(),
  downloadPNG: vi.fn(),
  downloadSVG: vi.fn(),
  downloadWebP: vi.fn(),
  exportReportPdf: vi.fn()
}));

const mockState = vi.hoisted(() => ({
  projectDataStore: {
    casingData: [],
    tubingData: [],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: [],
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    physicsIntervals: [],
    trajectory: [],
    surfacePaths: [],
    surfaceTransfers: [],
    surfaceOutlets: [],
    surfaceTemplate: {},
    setPhysicsIntervals: vi.fn()
  },
  viewConfigStore: {
    config: {
      viewMode: 'vertical',
      operationPhase: 'production',
      units: 'ft'
    },
    setShowDepthCrossSection: vi.fn()
  },
  plotElementsStore: {
    setPlotElement: vi.fn()
  },
  useSchematicRenderer: vi.fn(),
  syncSelectionIndicators: vi.fn(),
  getIntervalsWithBoundaryReasons: vi.fn(() => []),
  onLanguageChange: vi.fn(() => () => {}),
  t: vi.fn((key) => key),
  resizeApi: {
    dialogSize: { value: { width: 560, height: 680 } },
    reconcileDialogSize: vi.fn(),
    resizeDialogBy: vi.fn(),
    startDialogResize: vi.fn(),
    stopDialogResize: vi.fn()
  }
}));

vi.mock('@/app/exportWorkflows.js', () => exportWorkflows);

vi.mock('@/stores/projectDataStore.js', () => ({
  useProjectDataStore: () => mockState.projectDataStore
}));

vi.mock('@/stores/viewConfigStore.js', () => ({
  useViewConfigStore: () => mockState.viewConfigStore
}));

vi.mock('@/stores/plotElementsStore.js', () => ({
  usePlotElementsStore: () => mockState.plotElementsStore
}));

vi.mock('@/components/cross-section/CrossSectionPanel.vue', () => ({
  default: {
    name: 'CrossSectionPanel',
    template: '<div class="cross-section-panel-stub" />'
  }
}));

vi.mock('@/components/schematic/SchematicCanvas.vue', () => ({
  default: {
    name: 'SchematicCanvas',
    template: '<div class="schematic-canvas-stub" />'
  }
}));

vi.mock('@/components/schematic/DirectionalSchematicCanvas.vue', () => ({
  default: {
    name: 'DirectionalSchematicCanvas',
    template: '<div class="directional-schematic-canvas-stub" />'
  }
}));

vi.mock('@/components/surface/SurfaceFocusDialog.vue', () => ({
  default: {
    name: 'SurfaceFocusDialog',
    template: '<div class="surface-focus-dialog-stub" />'
  }
}));

vi.mock('@/components/report/ReviewSummaryDialog.vue', () => ({
  default: {
    name: 'ReviewSummaryDialog',
    template: '<div class="review-summary-dialog-stub" />'
  }
}));

vi.mock('@/app/selection.js', () => ({
  syncSelectionIndicators: mockState.syncSelectionIndicators
}));

vi.mock('@/composables/usePhysics.js', () => ({
  getIntervalsWithBoundaryReasons: mockState.getIntervalsWithBoundaryReasons
}));

vi.mock('@/composables/useSchematicRenderer.js', () => ({
  useSchematicRenderer: mockState.useSchematicRenderer
}));

vi.mock('@/composables/useFloatingDialogResize.js', () => ({
  useFloatingDialogResize: () => mockState.resizeApi
}));

vi.mock('@/app/i18n.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    onLanguageChange: mockState.onLanguageChange,
    t: mockState.t
  };
});

const MenuStub = defineComponent({
  name: 'Menu',
  props: {
    model: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    return () => h('div', { class: 'menu-stub' }, props.model
      .filter((item) => !item?.separator)
      .map((item) => h('button', {
        type: 'button',
        class: 'menu-stub__item',
        'data-test': item.label,
        onClick: () => item.command?.()
      }, item.label)));
  }
});

describe('SchematicViewport report export', () => {
  it('adds an Export Report PDF action to the plot download menu', async () => {
    const wrapper = shallowMount(SchematicViewport, {
      global: {
        stubs: {
          Button: { template: '<button type="button"><slot /></button>' },
          Menu: MenuStub,
          Dialog: { template: '<div><slot /><slot name="header" /></div>' }
        }
      }
    });

    const reportButton = wrapper.find('[data-test="ui.download_report_pdf"]');
    expect(reportButton.exists()).toBe(true);

    await reportButton.trigger('click');
    expect(exportWorkflows.exportReportPdf).toHaveBeenCalledTimes(1);
  });
});
