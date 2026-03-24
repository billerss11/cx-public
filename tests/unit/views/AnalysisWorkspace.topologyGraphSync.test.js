import { shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalysisWorkspace from '@/views/AnalysisWorkspace.vue';

const mockState = vi.hoisted(() => ({
  cancelTopologyWorkerJobs: vi.fn(),
  isTopologyWorkerCancelledError: vi.fn(() => false),
  requestTopologyModelInWorker: vi.fn(() => ({
    requestId: 101,
    promise: new Promise(() => {})
  })),
  requestTableRowFocus: vi.fn(),
  setActiveTableTabKey: vi.fn(),
  setTablesAccordionOpen: vi.fn(),
  viewConfigStore: {
    config: {
      viewMode: 'vertical',
      operationPhase: 'production',
      showPhysicsDebug: false
    },
    resetCameraViewsForWellSwitch: vi.fn()
  },
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
    physicsIntervals: [],
    trajectory: []
  },
  topologyStore: {
    activeWellTopology: {
      result: {
        requestId: 5,
        wellId: 'well-test',
        nodes: [
          { nodeId: 'node:SURFACE', kind: 'SURFACE', depthTop: null, depthBottom: null },
          { nodeId: 'node:ANNULUS_A:0:1000', kind: 'ANNULUS_A', depthTop: 0, depthBottom: 1000 },
          { nodeId: 'node:ANNULUS_A:1000:2000', kind: 'ANNULUS_A', depthTop: 1000, depthBottom: 2000 }
        ],
        edges: [
          {
            edgeId: 'edge:vertical:a0-a1',
            kind: 'vertical',
            cost: 0,
            from: 'node:ANNULUS_A:0:1000',
            to: 'node:ANNULUS_A:1000:2000'
          }
        ],
        sourceEntities: [],
        activeFlowNodeIds: [],
        minCostPathEdgeIds: ['edge:vertical:a0-a1'],
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
    projectConfig: {
      defaultUnits: 'ft'
    }
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
  requestTableRowFocus: mockState.requestTableRowFocus,
  setActiveTableTabKey: mockState.setActiveTableTabKey,
  setTablesAccordionOpen: mockState.setTablesAccordionOpen
}));

vi.mock('@/composables/useTopologyWorker.js', () => ({
  cancelTopologyWorkerJobs: mockState.cancelTopologyWorkerJobs,
  isTopologyWorkerCancelledError: mockState.isTopologyWorkerCancelledError,
  requestTopologyModelInWorker: mockState.requestTopologyModelInWorker
}));

function mountAnalysisWorkspace() {
  return shallowMount(AnalysisWorkspace, {
    global: {
      stubs: {
        Button: {
          template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
        },
        Checkbox: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<input type="checkbox" :checked="Boolean(modelValue)" @change="$emit(\'update:modelValue\', $event.target.checked)" />'
        },
        Select: {
          template: '<div class="select-stub"><slot /></div>'
        },
        Splitter: {
          template: '<div class="analysis-splitter-stub"><slot /></div>'
        },
        SplitterPanel: {
          template: '<section class="analysis-splitter-panel-stub"><slot /></section>'
        },
        SchematicCanvas: {
          props: ['topologyOverlaySelection'],
          template: '<div class="schematic-canvas-stub" :data-selected-node-ids="JSON.stringify(topologyOverlaySelection?.selectedNodeIds || [])" />'
        },
        DirectionalSchematicCanvas: {
          props: ['topologyOverlaySelection'],
          template: '<div class="directional-schematic-canvas-stub" :data-selected-node-ids="JSON.stringify(topologyOverlaySelection?.selectedNodeIds || [])" />'
        },
        TopologySourcesTablePane: {
          template: '<div class="topology-sources-table-pane-stub" />'
        },
        TopologyGraphDebugDialog: {
          props: ['scope'],
          emits: ['node-click', 'edge-click', 'update:visible', 'update:scope'],
          template: `
            <div class="topology-graph-dialog-stub" :data-scope="scope">
              <button type="button" class="emit-node-click" @click="$emit('node-click', 'node:ANNULUS_A:0:1000')">node</button>
              <button type="button" class="emit-edge-click" @click="$emit('edge-click', 'edge:vertical:a0-a1')">edge</button>
            </div>
          `
        },
        SurfaceFocusDialog: {
          template: '<div class="surface-focus-dialog-stub" />'
        }
      }
    }
  });
}

describe('AnalysisWorkspace topology graph sync', () => {
  beforeEach(() => {
    mockState.viewConfigStore.config.viewMode = 'vertical';
  });

  it('syncs graph node selection into the vertical overlay selection', async () => {
    const wrapper = mountAnalysisWorkspace();

    await wrapper.find('.emit-node-click').trigger('click');

    expect(wrapper.find('.schematic-canvas-stub').attributes('data-selected-node-ids')).toBe(
      JSON.stringify(['node:ANNULUS_A:0:1000'])
    );
  });

  it('defaults the topology graph dialog to all-topology scope', () => {
    const wrapper = mountAnalysisWorkspace();

    expect(wrapper.find('.topology-graph-dialog-stub').attributes('data-scope')).toBe('all');
  });

  it('syncs graph edge selection into the directional overlay selection', async () => {
    mockState.viewConfigStore.config.viewMode = 'directional';
    const wrapper = mountAnalysisWorkspace();

    await wrapper.find('.emit-edge-click').trigger('click');

    const selectedNodeIds = JSON.parse(
      wrapper.find('.directional-schematic-canvas-stub').attributes('data-selected-node-ids')
    );
    expect(selectedNodeIds).toEqual(expect.arrayContaining([
      'node:ANNULUS_A:0:1000',
      'node:ANNULUS_A:1000:2000'
    ]));
  });
});
