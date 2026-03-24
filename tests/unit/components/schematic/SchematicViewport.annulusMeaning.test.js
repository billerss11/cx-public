import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SchematicViewport from '@/components/schematic/SchematicViewport.vue';

const mockState = vi.hoisted(() => ({
  projectDataStore: {
    casingData: [
      { rowId: 'csg-1', label: 'Surface casing', od: 13.375, weight: 54.5, top: 0, bottom: 4000, show: true },
      { rowId: 'csg-2', label: 'Intermediate casing', od: 9.625, weight: 40, top: 0, bottom: 4000, show: true },
      { rowId: 'csg-3', label: 'Production liner', od: 7, weight: 29, top: 2200, bottom: 4000, show: true }
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

vi.mock('@/stores/projectDataStore.js', () => ({
  useProjectDataStore: () => mockState.projectDataStore
}));

vi.mock('@/stores/viewConfigStore.js', () => ({
  useViewConfigStore: () => mockState.viewConfigStore
}));

vi.mock('@/stores/plotElementsStore.js', () => ({
  usePlotElementsStore: () => mockState.plotElementsStore
}));

vi.mock('@/components/annulus/AnnulusMeaningCard.vue', () => ({
  default: {
    name: 'AnnulusMeaningCard',
    props: ['rows'],
    template: '<div class="annulus-meaning-card">{{ Array.isArray(rows) ? rows.map((row) => row.label).join(\",\") : \"\" }}</div>'
  }
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

describe('SchematicViewport annulus meaning', () => {
  it('does not render the annulus meaning card inside the plot viewport', () => {
    const wrapper = shallowMount(SchematicViewport, {
      global: {
        stubs: {
          AnnulusMeaningCard: false,
          Button: { template: '<button type="button"><slot /></button>' },
          Menu: { template: '<div class="menu-stub" />' },
          Dialog: { template: '<div><slot /><slot name="header" /></div>' }
        }
      }
    });

    expect(wrapper.find('.annulus-meaning-card').exists()).toBe(false);
  });
});
