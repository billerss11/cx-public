import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AnalysisWorkspace from '@/views/AnalysisWorkspace.vue';

const mockState = vi.hoisted(() => ({
  cancelTopologyWorkerJobs: vi.fn(),
  isTopologyWorkerCancelledError: vi.fn(() => false),
  requestTopologyModelInWorker: vi.fn(() => ({
    requestId: 201,
    promise: new Promise(() => {})
  })),
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
      showPhysicsDebug: false
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
        validationWarnings: [],
        surfaceSummary: {
          byChannel: {
            TUBING_INNER: {
              channelKey: 'TUBING_INNER',
              routeStatus: 'authored',
              currentState: 'outlet',
              outletLabels: ['Production Outlet'],
              barrierLabels: ['Lower Master Valve', 'Upper Master Valve'],
              transferLabels: [],
              warningMessages: []
            },
            ANNULUS_A: {
              channelKey: 'ANNULUS_A',
              routeStatus: 'assumed',
              currentState: 'assumed_surface',
              outletLabels: [],
              barrierLabels: [],
              transferLabels: [],
              warningMessages: ['Surface path is assumed because no authored surface route exists for this channel.']
            }
          }
        }
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

describe('AnalysisWorkspace surface summary', () => {
  it('renders a plain-language channel summary for authored and assumed surface routes', () => {
    const wrapper = shallowMount(AnalysisWorkspace, {
      global: {
        stubs: {
          Button: { template: '<button type="button"><slot /></button>' },
          Checkbox: { template: '<input type="checkbox" />' },
          Select: { template: '<div class="select-stub"><slot /></div>' },
          Splitter: { template: '<div><slot /></div>' },
          SplitterPanel: { template: '<section><slot /></section>' },
          SchematicCanvas: { template: '<div />' },
          DirectionalSchematicCanvas: { template: '<div />' },
          TopologySourcesTablePane: { template: '<div />' },
          TopologyGraphDebugDialog: { template: '<div />' },
          SurfaceFocusDialog: { template: '<div />' }
        }
      }
    });

    expect(wrapper.text()).toContain('Production Outlet');
    expect(wrapper.text()).toContain('Lower Master Valve');
    expect(wrapper.text()).toContain('assumed');
  });
});
