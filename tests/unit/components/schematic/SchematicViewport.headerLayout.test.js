import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  t: vi.fn((key) => key),
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

describe('SchematicViewport header layout', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  let resizeObserverCallback = null;

  beforeEach(() => {
    mockState.viewConfigStore.config.viewMode = 'vertical';
    resizeObserverCallback = null;
    globalThis.ResizeObserver = class ResizeObserverMock {
      constructor(callback) {
        resizeObserverCallback = callback;
      }

      observe() {}

      disconnect() {}
    };
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it.each(['vertical', 'directional'])(
    'stacks the header actions when the %s schematic panel is narrower than the content needs',
    async (viewMode) => {
      mockState.viewConfigStore.config.viewMode = viewMode;

      const wrapper = mount(SchematicViewport, {
        attachTo: document.body,
        global: {
          stubs: {
            Button: { template: '<button type="button"><slot /></button>' },
            Menu: { template: '<div class="menu-stub" />' },
            Dialog: { template: '<div><slot /><slot name="header" /></div>' }
          }
        }
      });

      const header = wrapper.get('.plot-container__header').element;
      const copy = wrapper.get('.plot-container__copy').element;
      const actions = wrapper.get('.plot-container__actions').element;

      Object.defineProperty(header, 'clientWidth', {
        configurable: true,
        value: 440
      });
      Object.defineProperty(copy, 'scrollWidth', {
        configurable: true,
        value: 300
      });
      Object.defineProperty(actions, 'scrollWidth', {
        configurable: true,
        value: 220
      });

      expect(typeof resizeObserverCallback).toBe('function');
      resizeObserverCallback();
      await wrapper.vm.$nextTick();

      expect(wrapper.get('.plot-container__header').classes()).toContain('plot-container__header--stacked');
      expect(wrapper.get('.plot-container__actions').classes()).toContain('plot-container__actions--stacked');
    }
  );

  it.each(['vertical', 'directional'])(
    'keeps the %s header actions inline when only the helper copy is long',
    async (viewMode) => {
      mockState.viewConfigStore.config.viewMode = viewMode;

      const wrapper = mount(SchematicViewport, {
        attachTo: document.body,
        global: {
          stubs: {
            Button: { template: '<button type="button"><slot /></button>' },
            Menu: { template: '<div class="menu-stub" />' },
            Dialog: { template: '<div><slot /><slot name="header" /></div>' }
          }
        }
      });

      const header = wrapper.get('.plot-container__header').element;
      const copy = wrapper.get('.plot-container__copy').element;
      const actions = wrapper.get('.plot-container__actions').element;

      Object.defineProperty(header, 'clientWidth', {
        configurable: true,
        value: 760
      });
      Object.defineProperty(copy, 'scrollWidth', {
        configurable: true,
        value: 620
      });
      Object.defineProperty(actions, 'scrollWidth', {
        configurable: true,
        value: 220
      });

      expect(typeof resizeObserverCallback).toBe('function');
      resizeObserverCallback();
      await wrapper.vm.$nextTick();

      expect(wrapper.get('.plot-container__header').classes()).not.toContain('plot-container__header--stacked');
      expect(wrapper.get('.plot-container__actions').classes()).not.toContain('plot-container__actions--stacked');
    }
  );
});
