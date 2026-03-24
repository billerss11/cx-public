import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AnalysisWorkspace from '@/views/AnalysisWorkspace.vue';

const mockState = vi.hoisted(() => ({
  cancelTopologyWorkerJobs: vi.fn(),
  isTopologyWorkerCancelledError: vi.fn(() => false),
  requestTopologyModelInWorker: vi.fn(() => ({
    requestId: 301,
    promise: new Promise(() => {})
  })),
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
    topologySources: [],
    surfacePaths: [],
    surfaceTransfers: [],
    surfaceOutlets: [],
    surfaceTemplate: {},
    physicsIntervals: [],
    trajectory: []
  },
  viewConfigStore: {
    config: {
      viewMode: 'vertical',
      operationPhase: 'production',
      showPhysicsDebug: false,
      units: 'ft'
    },
    resetCameraViewsForWellSwitch: vi.fn()
  },
  topologyStore: {
    activeWellTopology: {
      result: {
        nodes: [],
        edges: [],
        sourceEntities: [],
        activeFlowNodeIds: [],
        minCostPathEdgeIds: [],
        spofEdgeIds: [],
        edgeReasons: {},
        validationWarnings: []
      }
    },
    setWellRequestStarted: vi.fn(),
    setWellTopologyResult: vi.fn(),
    setWellRequestCancelled: vi.fn(),
    setWellTopologyError: vi.fn(),
    setWellRequestGeometryReady: vi.fn()
  }
}));

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal();
  const vue = await import('vue');
  return {
    ...actual,
    storeToRefs: (store) => {
      const refs = {};
      Object.keys(store).forEach((key) => {
        const value = store[key];
        if (typeof value === 'function') return;
        refs[key] = vue.isRef(value) ? value : vue.ref(value);
      });
      return refs;
    }
  };
});

vi.mock('@/stores/projectDataStore.js', () => ({
  useProjectDataStore: () => mockState.projectDataStore
}));

vi.mock('@/stores/viewConfigStore.js', () => ({
  useViewConfigStore: () => mockState.viewConfigStore
}));

vi.mock('@/stores/projectStore.js', () => ({
  useProjectStore: () => ({
    activeWellId: 'well-test',
    projectConfig: { defaultUnits: 'ft' }
  })
}));

vi.mock('@/stores/workspaceStore.js', () => ({
  useWorkspaceStore: () => ({
    currentActivity: 'analysis'
  })
}));

vi.mock('@/stores/topologyStore.js', () => ({
  useTopologyStore: () => mockState.topologyStore
}));

vi.mock('@/components/tables/panes/tablePaneState.js', () => ({
  requestTableRowFocus: vi.fn(),
  setActiveTableTabKey: vi.fn(),
  setTablesAccordionOpen: vi.fn()
}));

vi.mock('@/composables/useTopologyWorker.js', () => ({
  cancelTopologyWorkerJobs: mockState.cancelTopologyWorkerJobs,
  isTopologyWorkerCancelledError: mockState.isTopologyWorkerCancelledError,
  requestTopologyModelInWorker: mockState.requestTopologyModelInWorker
}));

describe('AnalysisWorkspace annulus meaning', () => {
  it('renders a compact annulus meaning table in the left analysis controls instead of the canvas', () => {
    const wrapper = shallowMount(AnalysisWorkspace, {
      global: {
        stubs: {
          AnnulusMeaningCard: false,
          Button: { template: '<button type="button"><slot /></button>' },
          Checkbox: { template: '<input type="checkbox" />' },
          Select: { template: '<div class="select-stub"><slot /></div>' },
          Splitter: { template: '<div><slot /></div>' },
          SplitterPanel: { template: '<section><slot /></section>' },
          SchematicCanvas: { template: '<div class="schematic-canvas-stub" />' },
          DirectionalSchematicCanvas: { template: '<div class="directional-schematic-canvas-stub" />' },
          TopologySourcesTablePane: { template: '<div />' },
          TopologyGraphDebugDialog: { template: '<div />' },
          SurfaceFocusDialog: { template: '<div />' }
        }
      }
    });

    expect(wrapper.find('.analysis-workspace__controls .annulus-meaning-card').exists()).toBe(true);
    expect(wrapper.find('.analysis-workspace__canvas .annulus-meaning-card').exists()).toBe(false);
    expect(wrapper.text()).toContain('Annulus A');
    expect(wrapper.text()).toContain('Annulus B');
  });
});
