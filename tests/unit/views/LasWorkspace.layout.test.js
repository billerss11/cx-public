import { shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LasWorkspace from '@/views/LasWorkspace.vue';
import { defineComponent } from 'vue';

const mockState = vi.hoisted(() => {
  const store = {
    sessions: {
      'session-1': {
        sessionId: 'session-1',
        fileName: 'demo.las',
        wellName: 'Well-A',
        indexCurve: 'DEPT',
        depthUnit: 'm',
        rowCount: 1200,
        curveCount: 4,
        fileSizeDisplay: '1.2 MB',
        selectedCurves: ['GR', 'RHOB'],
        curves: [
          { mnemonic: 'DEPT', unit: 'm', description: 'Depth' },
          { mnemonic: 'GR', unit: 'api', description: 'Gamma Ray' },
          { mnemonic: 'RHOB', unit: 'g/cc', description: 'Bulk Density' },
          { mnemonic: 'NPHI', unit: 'v/v', description: 'Neutron Porosity' },
        ],
        validCurves: ['GR', 'RHOB', 'NPHI'],
        overview: {
          dataPoints: 4800,
          indexRangeDisplay: '1000 - 2200 m',
          indexDtype: 'float',
          indexMin: 1000,
          indexMax: 2200,
        },
        curveRanges: [
          { curve: 'GR', unit: 'api', range: '20 - 120', dataPoints: 1200, description: 'Gamma Ray' },
        ],
        dataPreview: {
          shape: [5, 3],
          head: [{ DEPT: 1000, GR: 50, RHOB: 2.4 }],
        },
        wellInformation: {
          sections: {
            WELL: [{ mnemonic: 'WELL', value: 'Well-A', unit: '', description: 'Well name' }],
          },
        },
      },
    },
    activeSessionId: 'session-1',
    curveData: {
      'session-1': {
        indexCurve: 'DEPT',
        depthRange: { minDepth: 1000, maxDepth: 2200, depthUnit: 'm' },
        series: [],
      },
    },
    curveStatistics: {
      'session-1': {
        columns: ['GR', 'RHOB'],
        metrics: [{ metricLabel: 'Mean', values: { GR: 68.4, RHOB: 2.43 } }],
      },
    },
    correlationMatrix: {
      'session-1': {
        curves: ['GR', 'RHOB'],
        matrix: [[1, 0.42], [0.42, 1]],
        sampleSize: 1200,
      },
    },
    loading: false,
    error: null,
    errorCode: null,
    errorDetails: null,
    warning: null,
    lastRequestMeta: { task: 'las.get_curve_data', requestId: 'req-1', elapsedMs: 12 },
    get activeSession() {
      return this.sessions[this.activeSessionId] ?? null;
    },
    get sessionList() {
      return Object.values(this.sessions);
    },
    get activeCurveData() {
      return this.curveData[this.activeSessionId] ?? null;
    },
    get activeCurveStatistics() {
      return this.curveStatistics[this.activeSessionId] ?? null;
    },
    get activeCorrelationMatrix() {
      return this.correlationMatrix[this.activeSessionId] ?? null;
    },
    openAndParseFile: vi.fn(),
    fetchCurveData: vi.fn().mockResolvedValue({}),
    fetchCurveStatistics: vi.fn().mockResolvedValue({}),
    fetchCorrelationMatrix: vi.fn().mockResolvedValue({}),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    setActiveSession: vi.fn(),
    clearWarning: vi.fn(),
    clearError: vi.fn(),
  };

  return { store };
});

vi.mock('@/stores/lasStore.js', () => ({
  useLasStore: () => mockState.store,
}));

vi.mock('@/composables/useFeatureTiming.js', () => ({
  useFeatureTiming: () => ({
    timeFeature: async (_featureKey, executor) => executor(),
  }),
}));

function mountWorkspace() {
  return shallowMount(LasWorkspace, {
    global: {
      stubs: {
        Button: defineComponent({
          name: 'Button',
          emits: ['click'],
          template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
        }),
        Checkbox: true,
        Column: true,
        DataTable: true,
        Dialog: defineComponent({
          name: 'Dialog',
          props: {
            visible: {
              type: Boolean,
              default: false,
            },
          },
          template: `
            <div v-if="visible" class="dialog-stub">
              <div class="dialog-stub__header"><slot name="header" /></div>
              <div class="dialog-stub__content"><slot /></div>
            </div>
          `,
        }),
        InputText: true,
        Message: defineComponent({
          name: 'Message',
          template: '<div class="message-stub"><slot /></div>',
        }),
        ProgressSpinner: true,
        Select: true,
        Splitter: {
          template: '<div class="splitter-stub"><slot /></div>',
        },
        SplitterPanel: {
          template: '<div class="splitter-panel-stub"><slot /></div>',
        },
        Tabs: true,
        Tab: true,
        TabList: true,
        TabPanel: true,
        TabPanels: true,
        LasWorkspaceHeader: {
          name: 'LasWorkspaceHeader',
          template: '<div data-testid="las-workspace-header" />',
        },
        LasCurveLibraryPanel: {
          name: 'LasCurveLibraryPanel',
          emits: ['update:selectedCurveNames', 'plot-selected', 'show-statistics', 'show-correlation'],
          template: `
            <div data-testid="las-curve-library">
              <button class="curve-library-update" @click="$emit('update:selectedCurveNames', ['GR', 'RHOB'])">update</button>
              <button class="curve-library-plot" @click="$emit('plot-selected')">plot</button>
              <button class="curve-library-stats" @click="$emit('show-statistics')">stats</button>
              <button class="curve-library-correlation" @click="$emit('show-correlation')">corr</button>
            </div>
          `,
        },
        LasPlotStage: {
          name: 'LasPlotStage',
          props: ['selectedCurveCount'],
          emits: ['toggle-library'],
          template: `
            <div data-testid="las-plot-stage" :data-selected-count="String(selectedCurveCount)">
              <button class="plot-stage-toggle-library" @click="$emit('toggle-library')">toggle library</button>
            </div>
          `,
        },
        LasInsightsDeck: {
          name: 'LasInsightsDeck',
          props: ['activeInsightsTab'],
          template: '<div data-testid="las-insights-deck" :data-active-tab="activeInsightsTab" />',
        },
      },
    },
  });
}

describe('LasWorkspace redesigned layout', () => {
  beforeEach(() => {
    mockState.store.openAndParseFile.mockReset();
    mockState.store.fetchCurveData.mockClear();
    mockState.store.fetchCurveStatistics.mockClear();
    mockState.store.fetchCorrelationMatrix.mockClear();
    mockState.store.deleteSession.mockClear();
    mockState.store.setActiveSession.mockClear();
    mockState.store.clearWarning.mockClear();
    mockState.store.clearError.mockClear();
    mockState.store.warning = null;
  });

  it('renders the plot-first workspace structure for an active session', () => {
    const wrapper = mountWorkspace();

    expect(wrapper.find('[data-testid="las-workspace-shell"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-workspace-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-left-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-right-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-left-panel"] [data-testid="las-curve-library"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-plot-shell"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-plot-shell"] [data-testid="las-plot-stage"]').attributes('data-selected-count')).toBe('2');
    expect(wrapper.find('[data-testid="las-right-panel"] [data-testid="las-insights-deck"]').attributes('data-active-tab')).toBe('overview');
  });

  it('supports undock and dock-back for both side panels', async () => {
    const wrapper = mountWorkspace();

    await wrapper.get('[data-testid="las-left-panel-undock"]').trigger('click');
    expect(wrapper.find('[data-testid="las-left-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="las-left-floating-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-plot-shell"] [data-testid="las-plot-stage"]').exists()).toBe(true);

    await wrapper.get('[data-testid="las-left-panel-dock"]').trigger('click');
    expect(wrapper.find('[data-testid="las-left-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-left-floating-panel"]').exists()).toBe(false);

    await wrapper.get('[data-testid="las-right-panel-undock"]').trigger('click');
    expect(wrapper.find('[data-testid="las-right-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="las-right-floating-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-plot-shell"] [data-testid="las-plot-stage"]').exists()).toBe(true);

    await wrapper.get('[data-testid="las-right-panel-dock"]').trigger('click');
    expect(wrapper.find('[data-testid="las-right-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="las-right-floating-panel"]').exists()).toBe(false);
  });

  it('routes curve library actions through the las store and switches the insights deck', async () => {
    const wrapper = mountWorkspace();

    await wrapper.get('.curve-library-update').trigger('click');
    await wrapper.get('.curve-library-plot').trigger('click');
    expect(mockState.store.fetchCurveData).toHaveBeenCalledWith(['GR', 'RHOB']);

    await wrapper.get('.curve-library-stats').trigger('click');
    await Promise.resolve();
    await wrapper.vm.$nextTick();
    expect(mockState.store.fetchCurveStatistics).toHaveBeenCalledWith(['GR', 'RHOB']);
    expect(wrapper.find('[data-testid="las-insights-deck"]').attributes('data-active-tab')).toBe('analytics');

    await wrapper.get('.curve-library-correlation').trigger('click');
    await Promise.resolve();
    await wrapper.vm.$nextTick();
    expect(mockState.store.fetchCorrelationMatrix).toHaveBeenCalledWith(['GR', 'RHOB']);
    expect(wrapper.find('[data-testid="las-insights-deck"]').attributes('data-active-tab')).toBe('analytics');
  });

  it('keeps the curve library mounted across hide and show toggles', async () => {
    const wrapper = mountWorkspace();

    expect(wrapper.find('[data-testid="las-curve-library"]').exists()).toBe(true);

    await wrapper.get('.plot-stage-toggle-library').trigger('click');
    expect(wrapper.find('[data-testid="las-curve-library"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="las-curve-library"]').attributes('style')).toContain('display: none;');

    await wrapper.get('.plot-stage-toggle-library').trigger('click');
    expect(wrapper.find('[data-testid="las-curve-library"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="las-curve-library"]').attributes('style') || '').not.toContain('display: none;');
  });

  it('shows large-file warning message when store warning exists', () => {
    mockState.store.warning = {
      code: 'LAS_LARGE_FILE',
      message: 'Large LAS file selected (30.0 MB). Import may take longer than usual.',
    };

    const wrapper = mountWorkspace();
    expect(wrapper.find('[data-testid="las-large-file-warning"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Large LAS file selected');
  });
});
