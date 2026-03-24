import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SchematicViewport from '@/components/schematic/SchematicViewport.vue';

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
  t: vi.fn((key) => ({
    'ui.review_summary.button': 'Review Summary'
  }[key] ?? key)),
  resizeApi: {
    dialogSize: { value: { width: 560, height: 680 } },
    reconcileDialogSize: vi.fn(),
    resizeDialogBy: vi.fn(),
    startDialogResize: vi.fn(),
    stopDialogResize: vi.fn()
  }
}));

vi.mock('@/app/exportWorkflows.js', () => ({
  downloadJPEG: vi.fn(),
  downloadPNG: vi.fn(),
  downloadSVG: vi.fn(),
  downloadWebP: vi.fn(),
  exportReportPdf: vi.fn()
}));

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
    props: ['visible'],
    template: '<div class="review-summary-dialog-stub" :data-visible="visible" />'
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

describe('SchematicViewport review summary', () => {
  it('opens the separate Review Summary dialog from a dedicated header button', async () => {
    const wrapper = shallowMount(SchematicViewport, {
      global: {
        stubs: {
          Button: { template: '<button type="button" @click="$emit(\'click\')"><slot /></button>' },
          Menu: { template: '<div class="menu-stub" />' },
          Dialog: { template: '<div><slot /><slot name="header" /></div>' }
        }
      }
    });

    expect(wrapper.text()).toContain('Review Summary');
    expect(wrapper.findComponent({ name: 'ReviewSummaryDialog' }).props('visible')).toBe(false);

    const reviewButton = wrapper.find('[data-test="review-summary-trigger"]');
    await reviewButton.trigger('click');

    expect(wrapper.findComponent({ name: 'ReviewSummaryDialog' }).props('visible')).toBe(true);
  });
});
