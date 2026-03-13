import { shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import AnalysisWorkspace from '@/views/AnalysisWorkspace.vue';

const mockState = vi.hoisted(() => ({
  requestTableRowFocus: vi.fn(),
  setActiveTableTabKey: vi.fn(),
  setTablesAccordionOpen: vi.fn(),
  cancelTopologyWorkerJobs: vi.fn(),
  isTopologyWorkerCancelledError: vi.fn(() => false),
  requestTopologyModelInWorker: vi.fn(() => ({
    requestId: 99,
    promise: new Promise(() => {})
  })),
  viewConfigStore: {
    config: {
      viewMode: 'vertical',
      operationPhase: 'production',
      showPhysicsDebug: false
    }
  },
  projectDataStore: {
    casingData: [],
    tubingData: [],
    drillStringData: [],
    equipmentData: [
      {
        rowId: 'equipment-1',
        type: 'Packer',
        depth: 1250,
        show: true
      }
    ],
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
        nodes: [],
        edges: [],
        sourceEntities: [],
        activeFlow: { nodeIds: [] },
        minimumFailurePath: { nodeIds: [], edgeIds: [], cost: null },
        spof: { edgeIds: [] },
        validationWarnings: [
          {
            code: 'unknown_type',
            category: 'equipment',
            rowId: 'equipment-1',
            message: 'Equipment type is unknown.'
          }
        ]
      }
    },
    setWellRequestStarted: vi.fn(),
    setWellTopologyResult: vi.fn(),
    setWellRequestCancelled: vi.fn(),
    setWellTopologyError: vi.fn()
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
    activeWellId: 'well-test'
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

function mountAnalysisWorkspace(options = {}) {
  const attachToDocument = options?.attachToDocument === true;
  const stubSelect = options?.stubSelect !== false;

  const stubs = {
    Button: {
      template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
    },
    Checkbox: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input type="checkbox" :checked="Boolean(modelValue)" @change="$emit(\'update:modelValue\', $event.target.checked)" />'
    },
    Splitter: {
      template: '<div class="analysis-splitter-stub"><slot /></div>'
    },
    SplitterPanel: {
      template: '<section class="analysis-splitter-panel-stub"><slot /></section>'
    },
    SchematicCanvas: {
      props: ['topologyOverlaySelection', 'topologyResult', 'readonly', 'allowReadonlySelection'],
      template: `
        <div
          class="schematic-canvas-stub"
          :data-selected-node-ids="JSON.stringify(topologyOverlaySelection?.selectedNodeIds || [])"
          :data-has-topology-result="String(Boolean(topologyResult))"
          :data-readonly="String(Boolean(readonly))"
          :data-allow-readonly-selection="String(Boolean(allowReadonlySelection))"
        />
      `
    },
    DirectionalSchematicCanvas: {
      props: ['topologyOverlaySelection', 'topologyResult'],
      template: `
        <div
          class="directional-schematic-canvas-stub"
          :data-selected-node-ids="JSON.stringify(topologyOverlaySelection?.selectedNodeIds || [])"
          :data-has-topology-result="String(Boolean(topologyResult))"
        />
      `
    },
    TopologySourcesTablePane: {
      template: '<div class="topology-sources-table-pane-stub" />'
    },
    ...(options?.stubs ?? {})
  };

  if (stubSelect) {
    stubs.Select = {
      template: '<div><slot /></div>'
    };
  }

  return shallowMount(AnalysisWorkspace, {
    attachTo: attachToDocument ? document.body : undefined,
    global: {
      stubs
    }
  });
}

function configureWarningContext({
  equipmentRows = [],
  sourceRows = [],
  markerRows = [],
  warning = null,
  warnings = null
} = {}) {
  mockState.projectDataStore.equipmentData = equipmentRows;
  mockState.projectDataStore.topologySources = sourceRows;
  mockState.projectDataStore.markers = markerRows;
  const validationWarnings = Array.isArray(warnings)
    ? warnings
    : (warning ? [warning] : []);
  mockState.topologyStore.activeWellTopology = {
    result: {
      requestId: 5,
      wellId: 'well-test',
      nodes: [],
      edges: [],
      sourceEntities: [],
      activeFlow: { nodeIds: [] },
      minimumFailurePath: { nodeIds: [], edgeIds: [], cost: null },
      spof: { edgeIds: [] },
      validationWarnings
    }
  };
}

function createMixedWarningContext() {
  return {
    equipmentRows: [
      {
        rowId: 'equipment-1',
        type: 'Packer',
        depth: 1250,
        show: true
      }
    ],
    sourceRows: [
      {
        rowId: 'src-1',
        sourceType: 'formation_inflow',
        volumeKey: 'BORE',
        top: 900,
        bottom: 1000,
        show: true
      }
    ],
    markerRows: [
      {
        rowId: 'marker-1',
        type: 'Leak',
        top: 1200,
        bottom: 1250,
        attachToRow: '#1 Surface Casing',
        show: true
      }
    ],
    warnings: [
      {
        code: 'unknown_type',
        category: 'equipment',
        rowId: 'equipment-1',
        message: 'Equipment type is unknown.'
      },
      {
        code: 'marker_invalid_depth_range',
        category: 'marker',
        rowId: 'marker-1',
        message: 'Marker depth range is invalid for topology radial edge generation.'
      },
      {
        code: 'scenario_source_no_resolvable_interval',
        category: 'source',
        rowId: 'src-1',
        message: 'Source row does not resolve.'
      },
      {
        code: 'unknown_type',
        category: 'equipment',
        rowId: 'equipment-1',
        message: 'Equipment type is unknown in alternate branch.'
      }
    ]
  };
}

function configureInspectorContext() {
  mockState.topologyStore.activeWellTopology = {
    result: {
      requestId: 5,
      wellId: 'well-test',
      nodes: [
        { nodeId: 'node:SURFACE', kind: 'SURFACE', depthTop: null, depthBottom: null },
        { nodeId: 'node:ANNULUS_A:0:1000', kind: 'ANNULUS_A', depthTop: 0, depthBottom: 1000 },
        { nodeId: 'node:ANNULUS_A:1000:2000', kind: 'ANNULUS_A', depthTop: 1000, depthBottom: 2000 },
        { nodeId: 'node:ANNULUS_B:1000:2000', kind: 'ANNULUS_B', depthTop: 1000, depthBottom: 2000 }
      ],
      edges: [
        {
          edgeId: 'edge:vertical:a0-a1',
          kind: 'vertical',
          cost: 0,
          from: 'node:ANNULUS_A:0:1000',
          to: 'node:ANNULUS_A:1000:2000'
        },
        {
          edgeId: 'edge:radial:a1-b1',
          kind: 'radial',
          cost: 1,
          from: 'node:ANNULUS_A:1000:2000',
          to: 'node:ANNULUS_B:1000:2000'
        },
        {
          edgeId: 'edge:termination:a0-surface',
          kind: 'termination',
          cost: 0,
          from: 'node:ANNULUS_A:0:1000',
          to: 'node:SURFACE'
        }
      ],
      activeFlowNodeIds: ['node:ANNULUS_A:0:1000', 'node:ANNULUS_A:1000:2000', 'node:SURFACE'],
      minCostPathEdgeIds: ['edge:vertical:a0-a1', 'edge:termination:a0-surface'],
      spofEdgeIds: ['edge:radial:a1-b1'],
      barrierEnvelope: {
        barrierElements: []
      },
      edgeReasons: {},
      sourceEntities: [],
      validationWarnings: []
    }
  };
}

function configureOverlaySynchronizationContext({
  latestRequestId = null,
  resultRequestId = null,
  loading = false,
  includeResult = true
} = {}) {
  const safeResultRequestId = Number.isInteger(Number(resultRequestId)) ? Number(resultRequestId) : 5;
  const safeLatestRequestId = Number.isInteger(Number(latestRequestId))
    ? Number(latestRequestId)
    : safeResultRequestId;
  const topologyResult = includeResult
    ? {
      requestId: safeResultRequestId,
      wellId: 'well-test',
      nodes: [],
      edges: [],
      sourceEntities: [],
      activeFlow: { nodeIds: [] },
      minimumFailurePath: { nodeIds: [], edgeIds: [], cost: null },
      spof: { edgeIds: [] },
      validationWarnings: []
    }
    : null;
  mockState.topologyStore.activeWellTopology = {
    latestRequestId: safeLatestRequestId,
    loading: loading === true,
    result: topologyResult
  };
}

describe('AnalysisWorkspace warning navigation', () => {
  beforeEach(() => {
    mockState.viewConfigStore.config = reactive({
      viewMode: 'vertical',
      operationPhase: 'production',
      showPhysicsDebug: false,
      figHeight: 800,
      topologyUseIllustrativeFluidSource: false,
      topologyUseOpenHoleSource: false
    });
    mockState.requestTopologyModelInWorker.mockReset();
    mockState.requestTopologyModelInWorker.mockImplementation(() => ({
      requestId: 99,
      promise: new Promise(() => {})
    }));
    mockState.setTablesAccordionOpen.mockReset();
    mockState.setActiveTableTabKey.mockReset();
    mockState.requestTableRowFocus.mockReset();
  });

  it('summarizes flow starts in plain language', () => {
    mockState.topologyStore.activeWellTopology = {
      result: {
        requestId: 7,
        wellId: 'well-test',
        nodes: [],
        edges: [],
        sourceEntities: [
          { origin: 'marker' },
          { origin: 'open-hole-default' },
          { origin: 'manual-override' },
          { origin: 'manual-override' }
        ],
        sourcePolicy: {
          mode: 'open_hole_opt_in',
          markerDerived: true,
          openHoleDerived: true,
          manualOverrideDerived: true,
          illustrativeFluidDerived: false
        },
        activeFlow: { nodeIds: [] },
        minimumFailurePath: { nodeIds: [], edgeIds: [], cost: null },
        spof: { edgeIds: [] },
        validationWarnings: []
      }
    };

    const wrapper = mountAnalysisWorkspace();

    expect(wrapper.vm.topologySourceSummaryText).toBe('Flow starts from perforations, open hole, and 2 manual overrides.');
  });

  it('does not trigger topology recompute for non-topology view config changes', async () => {
    const wrapper = mountAnalysisWorkspace();
    await wrapper.vm.$nextTick();

    expect(mockState.requestTopologyModelInWorker).toHaveBeenCalledTimes(1);

    wrapper.vm.viewConfigStore.config.figHeight = 920;
    await wrapper.vm.$nextTick();

    expect(mockState.requestTopologyModelInWorker).toHaveBeenCalledTimes(1);
  });

  it('triggers topology recompute when topology source-policy config changes', async () => {
    const wrapper = mountAnalysisWorkspace();
    await wrapper.vm.$nextTick();

    expect(mockState.requestTopologyModelInWorker).toHaveBeenCalledTimes(1);

    wrapper.vm.viewConfigStore.config.topologyUseIllustrativeFluidSource = true;
    await wrapper.vm.$nextTick();

    expect(mockState.requestTopologyModelInWorker).toHaveBeenCalledTimes(2);
  });

  it('renders PrimeVue Select controls for envelope filter and sort', async () => {
    const wrapper = mountAnalysisWorkspace({ stubSelect: false });

    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.analysis-splitter-panel-stub').length).toBe(2);

    const envelopeSelectControls = wrapper.findAll('.analysis-topology__envelope-controls select-stub');
    expect(envelopeSelectControls.length).toBe(2);
  });

  it('keeps vertical analysis canvas read-only while allowing selection sync', () => {
    mockState.viewConfigStore.config.viewMode = 'vertical';
    const wrapper = mountAnalysisWorkspace();

    const canvasStub = wrapper.find('.schematic-canvas-stub');
    expect(canvasStub.exists()).toBe(true);
    expect(canvasStub.attributes('data-readonly')).toBe('true');
    expect(canvasStub.attributes('data-allow-readonly-selection')).toBe('true');
  });

  it('renders canonical annulus guidance text without legacy tubing-annulus terminology', async () => {
    const wrapper = mountAnalysisWorkspace();

    await wrapper.vm.$nextTick();

    const volumeGuide = wrapper.find('[data-i18n="ui.analysis.topology.source_policy.volume_guide"]');
    const volumeSemantics = wrapper.find('[data-i18n="ui.analysis.topology.notes.volume_semantics"]');

    expect(volumeGuide.exists()).toBe(true);
    expect(volumeSemantics.exists()).toBe(true);

    expect(volumeGuide.text()).toContain('ANNULUS_A');
    expect(volumeGuide.text()).toContain('ANNULUS_B');
    expect(volumeGuide.text()).not.toContain('TUBING_ANNULUS');

    expect(volumeSemantics.text()).toContain('ANNULUS_A');
    expect(volumeSemantics.text()).toContain('ANNULUS_B');
    expect(volumeSemantics.text()).not.toContain('TUBING_ANNULUS');
  });

  it('projects inspector row selection into schematic overlay node ids', async () => {
    configureInspectorContext();
    const wrapper = mountAnalysisWorkspace();

    const canvasStub = wrapper.find('.schematic-canvas-stub');
    expect(canvasStub.exists()).toBe(true);
    expect(JSON.parse(canvasStub.attributes('data-selected-node-ids') ?? '[]')).toEqual([]);

    wrapper.vm.handleInspectorEdgeRowClick({ data: { edgeId: 'edge:radial:a1-b1' } });
    await wrapper.vm.$nextTick();
    expect(JSON.parse(canvasStub.attributes('data-selected-node-ids') ?? '[]')).toEqual([
      'node:ANNULUS_A:1000:2000',
      'node:ANNULUS_B:1000:2000'
    ]);

    wrapper.vm.handleInspectorNodeRowClick({ data: { nodeId: 'node:SURFACE' } });
    await wrapper.vm.$nextTick();
    expect(JSON.parse(canvasStub.attributes('data-selected-node-ids') ?? '[]')).toEqual([
      'node:SURFACE'
    ]);

    wrapper.vm.clearInspectorSelection();
    await wrapper.vm.$nextTick();
    expect(JSON.parse(canvasStub.attributes('data-selected-node-ids') ?? '[]')).toEqual([]);
  });

  it('projects inspector row selection into directional overlay node ids', async () => {
    configureInspectorContext();
    mockState.viewConfigStore.config.viewMode = 'directional';

    const wrapper = mountAnalysisWorkspace();
    const directionalCanvasStub = wrapper.find('.directional-schematic-canvas-stub');
    expect(directionalCanvasStub.exists()).toBe(true);

    wrapper.vm.handleInspectorEdgeRowClick({ data: { edgeId: 'edge:radial:a1-b1' } });
    await wrapper.vm.$nextTick();
    expect(JSON.parse(directionalCanvasStub.attributes('data-selected-node-ids') ?? '[]')).toEqual([
      'node:ANNULUS_A:1000:2000',
      'node:ANNULUS_B:1000:2000'
    ]);
  });

  it('maps directional synchronization suppression reasons to stable overlay hint keys and keeps directional overlay gated', async () => {
    const testCases = [
      {
        analysisRequestId: 41,
        topologyEntry: {
          latestRequestId: 2,
          resultRequestId: 1,
          loading: true
        },
        expectedReason: 'stale_result',
        expectedHintKey: 'ui.analysis.topology.overlay_sync.stale_result',
        expectedHintDetail: 'overlay_request=1 | latest_request=2'
      },
      {
        analysisRequestId: 42,
        topologyEntry: {
          latestRequestId: 5,
          resultRequestId: 5,
          loading: false
        },
        expectedReason: 'expected_request_pending',
        expectedHintKey: 'ui.analysis.topology.overlay_sync.geometry_pending',
        expectedHintDetail: 'overlay_request=5 | geometry_request=pending | latest_request=5'
      },
      {
        analysisRequestId: 43,
        topologyEntry: {
          latestRequestId: 6,
          resultRequestId: 6,
          loading: false
        },
        geometryReadyRequestId: 43,
        expectedReason: 'request_mismatch',
        expectedHintKey: 'ui.analysis.topology.overlay_sync.request_mismatch',
        expectedHintDetail: 'overlay_request=6 | geometry_request=43 | latest_request=6'
      }
    ];

    for (const testCase of testCases) {
      mockState.viewConfigStore.config.viewMode = 'directional';
      configureOverlaySynchronizationContext(testCase.topologyEntry);
      mockState.requestTopologyModelInWorker.mockImplementation(() => ({
        requestId: testCase.analysisRequestId,
        promise: new Promise(() => {})
      }));

      const wrapper = mountAnalysisWorkspace();
      await wrapper.vm.$nextTick();

      if (Number.isInteger(testCase.geometryReadyRequestId)) {
        wrapper.vm.handleDirectionalGeometryReady(testCase.geometryReadyRequestId);
        await wrapper.vm.$nextTick();
      }

      expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe(testCase.expectedReason);
      expect(wrapper.vm.topologyOverlayUpdatingHintKey).toBe(testCase.expectedHintKey);
      expect(wrapper.vm.topologyOverlayUpdatingHintDetail).toBe(testCase.expectedHintDetail);
      expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(true);
      expect(wrapper.vm.synchronizedTopologyResult).toBeNull();

      const syncNoteMessage = wrapper.find('.analysis-topology__sync-note > span');
      expect(syncNoteMessage.exists()).toBe(true);
      expect(syncNoteMessage.attributes('data-i18n')).toBe(testCase.expectedHintKey);
      expect(wrapper.find('.analysis-topology__sync-note-detail').text()).toBe(testCase.expectedHintDetail);

      const directionalCanvasStub = wrapper.find('.directional-schematic-canvas-stub');
      expect(directionalCanvasStub.exists()).toBe(true);
      expect(directionalCanvasStub.attributes('data-has-topology-result')).toBe('false');

      wrapper.unmount();
    }
  });

  it('recovers directional overlay synchronization after geometry-ready handshake and removes sync hint', async () => {
    mockState.viewConfigStore.config.viewMode = 'directional';
    configureOverlaySynchronizationContext({
      latestRequestId: 5,
      resultRequestId: 5,
      loading: false
    });
    mockState.requestTopologyModelInWorker.mockImplementation(() => ({
      requestId: 5,
      promise: new Promise(() => {})
    }));

    const wrapper = mountAnalysisWorkspace();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe('expected_request_pending');
    expect(wrapper.vm.topologyOverlayUpdatingHintDetail).toBe('overlay_request=5 | geometry_request=pending | latest_request=5');
    expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(true);
    expect(wrapper.vm.synchronizedTopologyResult).toBeNull();

    const preReadyCanvasStub = wrapper.find('.directional-schematic-canvas-stub');
    expect(preReadyCanvasStub.exists()).toBe(true);
    expect(preReadyCanvasStub.attributes('data-has-topology-result')).toBe('false');
    expect(wrapper.find('.analysis-topology__sync-note').exists()).toBe(true);

    wrapper.vm.handleDirectionalGeometryReady(5);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe('synchronized');
    expect(wrapper.vm.topologyOverlaySynchronization.isSynchronized).toBe(true);
    expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(false);
    expect(wrapper.vm.synchronizedTopologyResult?.requestId).toBe(5);

    const postReadyCanvasStub = wrapper.find('.directional-schematic-canvas-stub');
    expect(postReadyCanvasStub.attributes('data-has-topology-result')).toBe('true');
    expect(wrapper.find('.analysis-topology__sync-note').exists()).toBe(false);
  });

  it('recovers directional overlay from request mismatch after topology result catches up to geometry request', async () => {
    mockState.viewConfigStore.config.viewMode = 'directional';
    configureOverlaySynchronizationContext({
      latestRequestId: 5,
      resultRequestId: 5,
      loading: false
    });
    mockState.requestTopologyModelInWorker.mockImplementation(() => ({
      requestId: 6,
      promise: new Promise(() => {})
    }));

    const wrapper = mountAnalysisWorkspace();
    await wrapper.vm.$nextTick();

    wrapper.vm.handleDirectionalGeometryReady(6);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe('request_mismatch');
    expect(wrapper.vm.topologyOverlayUpdatingHintDetail).toBe('overlay_request=5 | geometry_request=6 | latest_request=5');
    expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(true);
    expect(wrapper.vm.synchronizedTopologyResult).toBeNull();
    expect(wrapper.find('.directional-schematic-canvas-stub').attributes('data-has-topology-result')).toBe('false');

    wrapper.vm.activeWellTopology.latestRequestId = 6;
    wrapper.vm.activeWellTopology.result.requestId = 6;
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe('synchronized');
    expect(wrapper.vm.topologyOverlaySynchronization.isSynchronized).toBe(true);
    expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(false);
    expect(wrapper.vm.synchronizedTopologyResult?.requestId).toBe(6);
    expect(wrapper.find('.directional-schematic-canvas-stub').attributes('data-has-topology-result')).toBe('true');
    expect(wrapper.find('.analysis-topology__sync-note').exists()).toBe(false);
  });

  it('keeps vertical synchronization diagnostics stable without directional geometry handshake', async () => {
    mockState.viewConfigStore.config.viewMode = 'vertical';
    configureOverlaySynchronizationContext({
      latestRequestId: 2,
      resultRequestId: 1,
      loading: true
    });
    mockState.requestTopologyModelInWorker.mockImplementation(() => ({
      requestId: 2,
      promise: new Promise(() => {})
    }));

    const wrapper = mountAnalysisWorkspace();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe('stale_result');
    expect(wrapper.vm.topologyOverlaySynchronization.requireExpectedRequestId).toBe(false);
    expect(wrapper.vm.topologyOverlayUpdatingHintKey).toBe('ui.analysis.topology.overlay_sync.stale_result');
    expect(wrapper.vm.topologyOverlayUpdatingHintDetail).toBe('overlay_request=1 | geometry_request=2 | latest_request=2');
    expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(true);
    expect(wrapper.vm.synchronizedTopologyResult).toBeNull();

    const verticalCanvasStub = wrapper.find('.schematic-canvas-stub');
    expect(verticalCanvasStub.exists()).toBe(true);
    expect(verticalCanvasStub.attributes('data-has-topology-result')).toBe('false');

    const syncNoteMessage = wrapper.find('.analysis-topology__sync-note > span');
    expect(syncNoteMessage.exists()).toBe(true);
    expect(syncNoteMessage.attributes('data-i18n')).toBe('ui.analysis.topology.overlay_sync.stale_result');
    expect(wrapper.find('.analysis-topology__sync-note-detail').text()).toBe(
      'overlay_request=1 | geometry_request=2 | latest_request=2'
    );
  });

  it('keeps sync-updating hint hidden for idle no-result state while overlays remain empty', async () => {
    mockState.viewConfigStore.config.viewMode = 'vertical';
    configureOverlaySynchronizationContext({
      latestRequestId: 7,
      loading: false,
      includeResult: false
    });
    mockState.requestTopologyModelInWorker.mockImplementation(() => ({
      requestId: 7,
      promise: new Promise(() => {})
    }));

    const wrapper = mountAnalysisWorkspace();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe('no_result');
    expect(wrapper.vm.topologyOverlaySynchronization.overlaySuppressed).toBe(false);
    expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(false);
    expect(wrapper.vm.synchronizedTopologyResult).toBeNull();

    const verticalCanvasStub = wrapper.find('.schematic-canvas-stub');
    expect(verticalCanvasStub.exists()).toBe(true);
    expect(verticalCanvasStub.attributes('data-has-topology-result')).toBe('false');
    expect(wrapper.find('.analysis-topology__sync-note').exists()).toBe(false);
  });

  it('keeps directional no-result state unsuppressed before and after geometry handshake', async () => {
    mockState.viewConfigStore.config.viewMode = 'directional';
    configureOverlaySynchronizationContext({
      latestRequestId: 7,
      loading: false,
      includeResult: false
    });
    mockState.requestTopologyModelInWorker.mockImplementation(() => ({
      requestId: 7,
      promise: new Promise(() => {})
    }));

    const wrapper = mountAnalysisWorkspace();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe('no_result');
    expect(wrapper.vm.topologyOverlaySynchronization.requireExpectedRequestId).toBe(true);
    expect(wrapper.vm.topologyOverlaySynchronization.expectedRequestId).toBeNull();
    expect(wrapper.vm.topologyOverlaySynchronization.overlaySuppressed).toBe(false);
    expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(false);
    expect(wrapper.vm.topologyOverlayUpdatingHintDetail).toBe('');
    expect(wrapper.vm.synchronizedTopologyResult).toBeNull();
    expect(wrapper.find('.directional-schematic-canvas-stub').attributes('data-has-topology-result')).toBe('false');
    expect(wrapper.find('.analysis-topology__sync-note').exists()).toBe(false);

    wrapper.vm.handleDirectionalGeometryReady(7);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.topologyOverlaySynchronization.reason).toBe('no_result');
    expect(wrapper.vm.topologyOverlaySynchronization.expectedRequestId).toBe(7);
    expect(wrapper.vm.topologyOverlaySynchronization.overlaySuppressed).toBe(false);
    expect(wrapper.vm.shouldShowOverlayUpdatingHint).toBe(false);
    expect(wrapper.vm.topologyOverlayUpdatingHintDetail).toBe('');
    expect(wrapper.vm.synchronizedTopologyResult).toBeNull();
    expect(wrapper.find('.directional-schematic-canvas-stub').attributes('data-has-topology-result')).toBe('false');
    expect(wrapper.find('.analysis-topology__sync-note').exists()).toBe(false);
  });

  it('renders selected-path summary and allows step click to drive overlay selection', async () => {
    configureInspectorContext();
    const wrapper = mountAnalysisWorkspace();

    const pathSummaryButtons = wrapper.findAll('.analysis-topology__path-summary-button');
    expect(pathSummaryButtons.length).toBe(2);
    expect(pathSummaryButtons[0].text()).toContain('vertical');
    expect(pathSummaryButtons[0].text()).toContain('node:ANNULUS_A:0:1000');

    await pathSummaryButtons[1].trigger('click');
    await wrapper.vm.$nextTick();

    const canvasStub = wrapper.find('.schematic-canvas-stub');
    expect(JSON.parse(canvasStub.attributes('data-selected-node-ids') ?? '[]')).toEqual([
      'node:ANNULUS_A:0:1000',
      'node:SURFACE'
    ]);
  });

  it('keeps graph scope focused on min-path/spof/selected-barrier and syncs graph clicks to overlay', async () => {
    configureInspectorContext();
    const wrapper = mountAnalysisWorkspace();

    expect(wrapper.vm.topologyGraphScopeOptions.map((option) => option.value)).toEqual([
      'min_path',
      'spof',
      'active_flow',
      'selected_barrier'
    ]);

    wrapper.vm.handleTopologyGraphEdgeClick({
      edge: 'edge:radial:a1-b1',
      edges: ['edge:radial:a1-b1']
    });
    await wrapper.vm.$nextTick();

    const canvasStub = wrapper.find('.schematic-canvas-stub');
    expect(JSON.parse(canvasStub.attributes('data-selected-node-ids') ?? '[]')).toEqual([
      'node:ANNULUS_A:1000:2000',
      'node:ANNULUS_B:1000:2000'
    ]);

    wrapper.vm.handleTopologyGraphNodeClick({ node: 'node:SURFACE' });
    await wrapper.vm.$nextTick();

    expect(JSON.parse(canvasStub.attributes('data-selected-node-ids') ?? '[]')).toEqual([
      'node:SURFACE'
    ]);
  });

  it('renders lane headers and keeps edge detail text in a stable click-driven overlay', async () => {
    configureInspectorContext();
    mockState.topologyStore.activeWellTopology.result.edgeReasons = {
      'edge:vertical:a0-a1': {
        ruleId: 'interval-continuity',
        summary: 'Representative continuity across stacked annulus intervals.'
      }
    };

    const wrapper = mountAnalysisWorkspace();
    await wrapper.vm.$nextTick();

    const laneHeaders = wrapper.vm.topologyDebugGraph?.laneHeaders ?? [];
    expect(laneHeaders.some((lane) => String(lane?.label ?? '').includes('Annulus A'))).toBe(true);

    const edge = wrapper.vm.topologyDebugGraph?.edges?.['edge:vertical:a0-a1'] ?? null;
    const wrappedLines = wrapper.vm.resolveTopologyGraphEdgeTooltipLines(edge);
    expect(wrappedLines.some(
      (line) => String(line ?? '').startsWith('Path:') && String(line ?? '').includes('Annulus A')
    )).toBe(true);

    wrapper.vm.handleTopologyGraphEdgeClick({ edge: 'edge:vertical:a0-a1' });
    await wrapper.vm.$nextTick();

    expect((wrapper.vm.selectedTopologyGraphEdgeTooltipLines ?? []).join(' ')).toContain(
      'Representative continuity across stacked annulus intervals.'
    );

    wrapper.vm.handleTopologyGraphEdgeClick({ edge: 'edge:vertical:a0-a1' });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.selectedTopologyGraphEdgeTooltipLines).toEqual([]);
  });

  it('navigates to equipment table row when warning row link is clicked', async () => {
    configureWarningContext({
      equipmentRows: [
        {
          rowId: 'equipment-1',
          type: 'Packer',
          depth: 1250,
          show: true
        }
      ],
      warning: {
        code: 'unknown_type',
        category: 'equipment',
        rowId: 'equipment-1',
        message: 'Equipment type is unknown.'
      }
    });

    const wrapper = mountAnalysisWorkspace();
    const rowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(rowLinks.length).toBe(1);

    await rowLinks[0].trigger('click');

    expect(mockState.setTablesAccordionOpen).toHaveBeenCalledWith(true);
    expect(mockState.setActiveTableTabKey).toHaveBeenCalledWith('equipment');
    expect(mockState.requestTableRowFocus).toHaveBeenCalledWith('equipment', 0);
  });

  it('navigates to topology sources row when source warning row link is clicked', async () => {
    configureWarningContext({
      sourceRows: [
        {
          rowId: 'src-1',
          sourceType: 'formation_inflow',
          volumeKey: 'BORE',
          top: 900,
          bottom: 1000,
          show: true
        }
      ],
      warning: {
        code: 'scenario_source_no_resolvable_interval',
        category: 'source',
        rowId: 'src-1',
        message: 'Source row does not resolve.'
      }
    });

    const wrapper = mountAnalysisWorkspace();
    const rowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(rowLinks.length).toBe(1);

    await rowLinks[0].trigger('click');

    expect(wrapper.vm.manualSourceOverridesOpen).toBe(true);
    expect(mockState.setActiveTableTabKey).not.toHaveBeenCalledWith('topologySources');
  });

  it('navigates to topology breakouts row when breakout warning row link is clicked', async () => {
    configureWarningContext({
      sourceRows: [
        {
          rowId: 'br-1',
          sourceType: 'scenario',
          fromVolumeKey: 'ANNULUS_A',
          toVolumeKey: 'ANNULUS_B',
          top: 1100,
          bottom: 1200,
          show: true
        }
      ],
      warning: {
        code: 'scenario_breakout_no_resolvable_interval',
        category: 'source',
        rowId: 'br-1',
        message: 'Breakout row does not resolve.'
      }
    });

    const wrapper = mountAnalysisWorkspace();
    const rowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(rowLinks.length).toBe(1);

    await rowLinks[0].trigger('click');

    expect(mockState.setTablesAccordionOpen).toHaveBeenCalledWith(true);
    expect(mockState.setActiveTableTabKey).toHaveBeenCalledWith('topologyBreakouts');
    expect(mockState.requestTableRowFocus).toHaveBeenCalledWith('topologyBreakout', 0);
  });

  it('navigates to markers table row when marker warning row link is clicked', async () => {
    configureWarningContext({
      markerRows: [
        {
          rowId: 'marker-1',
          type: 'Leak',
          top: 1200,
          bottom: 1250,
          attachToRow: '#1 Surface Casing',
          show: true
        }
      ],
      warning: {
        code: 'marker_invalid_depth_range',
        category: 'marker',
        rowId: 'marker-1',
        message: 'Marker depth range is invalid for topology radial edge generation.'
      }
    });

    const wrapper = mountAnalysisWorkspace();
    const rowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(rowLinks.length).toBe(1);

    await rowLinks[0].trigger('click');

    expect(mockState.setTablesAccordionOpen).toHaveBeenCalledWith(true);
    expect(mockState.setActiveTableTabKey).toHaveBeenCalledWith('markers');
    expect(mockState.requestTableRowFocus).toHaveBeenCalledWith('marker', 0);
  });

  it('filters mixed warning rows by category/code chips and keeps row-link navigation', async () => {
    configureWarningContext(createMixedWarningContext());

    const wrapper = mountAnalysisWorkspace();
    expect(wrapper.findAll('.analysis-topology__warning-item').length).toBe(4);

    const warningChipLists = wrapper.findAll('.analysis-topology__warning-chip-list');
    expect(warningChipLists.length).toBeGreaterThanOrEqual(2);

    const categoryChips = warningChipLists[0].findAll('button.analysis-topology__warning-chip');
    const markerCategoryChip = categoryChips.find((chip) => chip.text().includes('Marker'));
    expect(markerCategoryChip).toBeTruthy();
    expect(typeof wrapper.vm.handleWarningCategoryChipClick).toBe('function');

    wrapper.vm.handleWarningCategoryChipClick('marker');
    await wrapper.vm.$nextTick();

    const categoryFilteredRows = wrapper.findAll('.analysis-topology__warning-item');
    expect(categoryFilteredRows.length).toBe(1);

    const categoryFilteredLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(categoryFilteredLinks.length).toBe(1);
    expect(categoryFilteredLinks[0].text()).toContain('#marker-1');

    await categoryFilteredLinks[0].trigger('click');

    expect(mockState.setTablesAccordionOpen).toHaveBeenCalledWith(true);
    expect(mockState.setActiveTableTabKey).toHaveBeenLastCalledWith('markers');
    expect(mockState.requestTableRowFocus).toHaveBeenLastCalledWith('marker', 0);

    wrapper.vm.handleWarningCategoryChipClick('marker');
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.analysis-topology__warning-item').length).toBe(4);

    const refreshedCodeChips = wrapper.findAll('.analysis-topology__warning-chip-list')[1]
      .findAll('button.analysis-topology__warning-chip');
    const unknownTypeCodeChip = refreshedCodeChips.find((chip) => chip.text().includes('unknown_type'));
    expect(unknownTypeCodeChip).toBeTruthy();

    expect(typeof wrapper.vm.handleWarningCodeChipClick).toBe('function');
    wrapper.vm.handleWarningCodeChipClick('unknown_type', 'equipment');
    await wrapper.vm.$nextTick();

    const codeFilteredRows = wrapper.findAll('.analysis-topology__warning-item');
    expect(codeFilteredRows.length).toBe(2);
    const codeFilteredLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(codeFilteredLinks.length).toBe(2);

    await codeFilteredLinks[0].trigger('click');
    expect(mockState.setActiveTableTabKey).toHaveBeenLastCalledWith('equipment');
    expect(mockState.requestTableRowFocus).toHaveBeenLastCalledWith('equipment', 0);
  });

  it('supports keyboard chip navigation and escape reset for warning correction flow', async () => {
    configureWarningContext(createMixedWarningContext());

    const wrapper = mountAnalysisWorkspace({ attachToDocument: true });
    const warningChipLists = wrapper.findAll('.analysis-topology__warning-chip-list');
    expect(warningChipLists.length).toBeGreaterThanOrEqual(2);

    const categoryChipButtons = warningChipLists[0].findAll('button.analysis-topology__warning-chip');
    expect(categoryChipButtons.length).toBeGreaterThanOrEqual(3);

    categoryChipButtons[0].element.focus();
    expect(document.activeElement).toBe(categoryChipButtons[0].element);

    await categoryChipButtons[0].trigger('keydown', { key: 'ArrowRight' });
    expect(document.activeElement).toBe(categoryChipButtons[1].element);

    await categoryChipButtons[1].trigger('keydown', { key: 'End' });
    expect(document.activeElement).toBe(categoryChipButtons[categoryChipButtons.length - 1].element);

    await categoryChipButtons[categoryChipButtons.length - 1].trigger('keydown', { key: 'Home' });
    expect(document.activeElement).toBe(categoryChipButtons[0].element);

    expect(typeof wrapper.vm.handleWarningCategoryChipClick).toBe('function');
    wrapper.vm.handleWarningCategoryChipClick('marker');
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.analysis-topology__warning-item').length).toBe(1);

    await categoryChipButtons[0].trigger('keydown', { key: 'Escape' });
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.analysis-topology__warning-item').length).toBe(4);

    const rowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    const sourceRowLink = rowLinks.find((link) => link.text().includes('#src-1'));
    expect(sourceRowLink).toBeTruthy();

    await sourceRowLink.trigger('click');

    expect(wrapper.vm.manualSourceOverridesOpen).toBe(true);

    wrapper.unmount();
  });

  it('supports select-style category/code filter updates for warning row navigation', async () => {
    configureWarningContext(createMixedWarningContext());

    const wrapper = mountAnalysisWorkspace();
    expect(wrapper.findAll('.analysis-topology__warning-item').length).toBe(4);
    expect(wrapper.vm.warningTableControls.categoryFilter).toBe('all');
    expect(wrapper.vm.warningTableControls.codeFilter).toBe('all');

    wrapper.vm.warningTableControls.categoryFilter = 'source';
    wrapper.vm.warningTableControls.codeFilter = 'scenario_source_no_resolvable_interval';
    await wrapper.vm.$nextTick();

    const filteredRows = wrapper.findAll('.analysis-topology__warning-item');
    expect(filteredRows.length).toBe(1);

    const filteredLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(filteredLinks.length).toBe(1);
    expect(filteredLinks[0].text()).toContain('#src-1');

    await filteredLinks[0].trigger('click');
    expect(wrapper.vm.manualSourceOverridesOpen).toBe(true);

    wrapper.vm.warningTableControls.categoryFilter = 'marker';
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.warningTableControls.categoryFilter).toBe('marker');
    expect(wrapper.vm.warningTableControls.codeFilter).toBe('all');
    expect(wrapper.findAll('.analysis-topology__warning-item').length).toBe(1);

    const markerLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(markerLinks.length).toBe(1);
    expect(markerLinks[0].text()).toContain('#marker-1');

    await markerLinks[0].trigger('click');
    expect(mockState.setActiveTableTabKey).toHaveBeenLastCalledWith('markers');
    expect(mockState.requestTableRowFocus).toHaveBeenLastCalledWith('marker', 0);
  });

  it('keeps filter constraints coherent when alternating chip and select control flows', async () => {
    configureWarningContext(createMixedWarningContext());

    const wrapper = mountAnalysisWorkspace();
    expect(wrapper.findAll('.analysis-topology__warning-item').length).toBe(4);

    wrapper.vm.handleWarningCategoryChipClick('marker');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.warningTableControls.categoryFilter).toBe('marker');
    expect(wrapper.vm.warningTableControls.codeFilter).toBe('all');

    let visibleRowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(visibleRowLinks.length).toBe(1);
    expect(visibleRowLinks[0].text()).toContain('#marker-1');

    await visibleRowLinks[0].trigger('click');
    expect(mockState.setActiveTableTabKey).toHaveBeenLastCalledWith('markers');
    expect(mockState.requestTableRowFocus).toHaveBeenLastCalledWith('marker', 0);

    wrapper.vm.warningTableControls.categoryFilter = 'source';
    wrapper.vm.warningTableControls.codeFilter = 'scenario_source_no_resolvable_interval';
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.warningTableControls.categoryFilter).toBe('source');
    expect(wrapper.vm.warningTableControls.codeFilter).toBe('scenario_source_no_resolvable_interval');

    visibleRowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(visibleRowLinks.length).toBe(1);
    expect(visibleRowLinks[0].text()).toContain('#src-1');

    await visibleRowLinks[0].trigger('click');
    expect(wrapper.vm.manualSourceOverridesOpen).toBe(true);

    wrapper.vm.handleWarningCodeChipClick('unknown_type', 'equipment');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.warningTableControls.categoryFilter).toBe('equipment');
    expect(wrapper.vm.warningTableControls.codeFilter).toBe('unknown_type');

    visibleRowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(visibleRowLinks.length).toBe(2);
    expect(visibleRowLinks[0].text()).toContain('#equipment-1');
    expect(visibleRowLinks[1].text()).toContain('#equipment-1');

    await visibleRowLinks[0].trigger('click');
    expect(mockState.setActiveTableTabKey).toHaveBeenLastCalledWith('equipment');
    expect(mockState.requestTableRowFocus).toHaveBeenLastCalledWith('equipment', 0);

    wrapper.vm.warningTableControls.categoryFilter = 'marker';
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.warningTableControls.categoryFilter).toBe('marker');
    expect(wrapper.vm.warningTableControls.codeFilter).toBe('all');

    visibleRowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(visibleRowLinks.length).toBe(1);
    expect(visibleRowLinks[0].text()).toContain('#marker-1');

    await visibleRowLinks[0].trigger('click');
    expect(mockState.setActiveTableTabKey).toHaveBeenLastCalledWith('markers');
    expect(mockState.requestTableRowFocus).toHaveBeenLastCalledWith('marker', 0);
  });

  it('keeps deterministic warning ordering with six-row truncation under active filters', async () => {
    const equipmentRows = Array.from({ length: 8 }, (_, index) => ({
      rowId: `equipment-${index + 1}`,
      type: 'Packer',
      depth: 1200 + (index * 10),
      show: true
    }));
    const warnings = equipmentRows.map((row, index) => ({
      code: 'unknown_type',
      category: 'equipment',
      rowId: row.rowId,
      message: `Equipment warning ${index + 1}`
    }));

    configureWarningContext({
      equipmentRows,
      warnings
    });

    const wrapper = mountAnalysisWorkspace();

    const expectedVisibleRowTokens = [
      '#equipment-1',
      '#equipment-2',
      '#equipment-3',
      '#equipment-4',
      '#equipment-5',
      '#equipment-6'
    ];

    const initialWarningRows = wrapper.findAll('.analysis-topology__warning-item');
    expect(initialWarningRows.length).toBe(6);

    const initialRowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(initialRowLinks.length).toBe(6);
    expect(initialRowLinks.map((link) => link.text().trim())).toEqual(expectedVisibleRowTokens);

    wrapper.vm.warningTableControls.categoryFilter = 'equipment';
    wrapper.vm.warningTableControls.codeFilter = 'unknown_type';
    await wrapper.vm.$nextTick();

    const filteredWarningRows = wrapper.findAll('.analysis-topology__warning-item');
    expect(filteredWarningRows.length).toBe(6);

    const filteredRowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    expect(filteredRowLinks.length).toBe(6);
    expect(filteredRowLinks.map((link) => link.text().trim())).toEqual(expectedVisibleRowTokens);

    await filteredRowLinks[5].trigger('click');

    expect(mockState.setTablesAccordionOpen).toHaveBeenCalledWith(true);
    expect(mockState.setActiveTableTabKey).toHaveBeenLastCalledWith('equipment');
    expect(mockState.requestTableRowFocus).toHaveBeenLastCalledWith('equipment', 5);
  });

  it('keeps unresolved row warnings non-clickable in filtered truncated lists', async () => {
    const equipmentRows = Array.from({ length: 6 }, (_, index) => ({
      rowId: `equipment-${index + 1}`,
      type: 'Packer',
      depth: 1200 + (index * 10),
      show: true
    }));

    configureWarningContext({
      equipmentRows,
      warnings: [
        {
          code: 'unknown_type',
          category: 'equipment',
          rowId: 'equipment-1',
          message: 'Equipment warning 1'
        },
        {
          code: 'unknown_type',
          category: 'equipment',
          rowId: 'missing-a',
          message: 'Equipment warning missing A'
        },
        {
          code: 'unknown_type',
          category: 'equipment',
          rowId: 'equipment-2',
          message: 'Equipment warning 2'
        },
        {
          code: 'unknown_type',
          category: 'equipment',
          rowId: 'missing-b',
          message: 'Equipment warning missing B'
        },
        {
          code: 'unknown_type',
          category: 'equipment',
          rowId: 'equipment-3',
          message: 'Equipment warning 3'
        },
        {
          code: 'unknown_type',
          category: 'equipment',
          rowId: 'equipment-4',
          message: 'Equipment warning 4'
        },
        {
          code: 'unknown_type',
          category: 'equipment',
          rowId: 'missing-c',
          message: 'Equipment warning missing C'
        },
        {
          code: 'unknown_type',
          category: 'equipment',
          rowId: 'equipment-5',
          message: 'Equipment warning 5'
        }
      ]
    });

    const wrapper = mountAnalysisWorkspace();

    wrapper.vm.warningTableControls.categoryFilter = 'equipment';
    wrapper.vm.warningTableControls.codeFilter = 'unknown_type';
    await wrapper.vm.$nextTick();

    const warningRows = wrapper.findAll('.analysis-topology__warning-item');
    expect(warningRows.length).toBe(6);

    const rowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    const rowIdTokens = wrapper.findAll('.analysis-topology__warning-row-id');

    expect(rowLinks.length).toBe(4);
    expect(rowIdTokens.length).toBe(2);
    expect(rowIdTokens.map((token) => token.text().trim())).toEqual(['#missing-a', '#missing-b']);

    await rowLinks[0].trigger('click');

    expect(mockState.setTablesAccordionOpen).toHaveBeenCalledWith(true);
    expect(mockState.setActiveTableTabKey).toHaveBeenLastCalledWith('equipment');
    expect(mockState.requestTableRowFocus).toHaveBeenLastCalledWith('equipment', 0);
  });

  it('renders row id text without navigation link when warning rowId is not resolvable', () => {
    configureWarningContext({
      equipmentRows: [],
      sourceRows: [],
      warning: {
        code: 'unknown_type',
        category: 'equipment',
        rowId: 'missing-row',
        message: 'Warning row cannot be resolved in current tables.'
      }
    });

    const wrapper = mountAnalysisWorkspace();
    const rowLinks = wrapper.findAll('.analysis-topology__warning-row-link');
    const rowIdTokens = wrapper.findAll('.analysis-topology__warning-row-id');

    expect(rowLinks.length).toBe(0);
    expect(rowIdTokens.length).toBe(1);
    expect(rowIdTokens[0].text()).toContain('#missing-row');
    expect(mockState.setTablesAccordionOpen).not.toHaveBeenCalled();
    expect(mockState.setActiveTableTabKey).not.toHaveBeenCalled();
    expect(mockState.requestTableRowFocus).not.toHaveBeenCalled();
  });
});
