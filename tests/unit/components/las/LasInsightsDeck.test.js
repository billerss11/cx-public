import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PrimeVue from 'primevue/config';
import LasInsightsDeck from '@/components/las/LasInsightsDeck.vue';

function mountInsightsDeck(props = {}) {
  return mount(LasInsightsDeck, {
    props: {
      activeInsightsTab: 'overview',
      curveRanges: [
        {
          curve: 'GR',
          unit: 'api',
          range: '20 - 120',
          dataPoints: 1200,
          description: 'Gamma Ray',
        },
      ],
      dataPreview: {
        shape: [3, 2],
        head: [{ DEPT: 1000, GR: 50 }],
      },
      hasStatistics: false,
      overview: {
        indexDtype: 'float64',
        indexMin: 1000,
        indexMax: 1200,
        indexRangeDisplay: '1000 - 1200 m',
      },
      previewColumns: ['DEPT', 'GR'],
      selectedWellSectionName: 'WELL',
      statisticsColumns: [],
      statisticsRows: [],
      wellSectionOptions: [{ value: 'WELL', label: 'WELL' }],
      wellSectionRows: [{ mnemonic: 'WELL', value: 'A-1', unit: '', description: 'Well name' }],
      ...props,
    },
    global: {
      plugins: [PrimeVue],
      stubs: {
        DataTable: {
          props: ['value', 'paginator', 'rows'],
          template: '<div class="data-table-stub" :data-paginator="String(Boolean(paginator))" :data-rows="String(rows)" :data-value-length="String(value?.length ?? 0)"><slot /></div>',
        },
        Column: {
          template: '<div class="column-stub"><slot /></div>',
        },
        Select: {
          template: '<div class="select-stub"><slot /></div>',
        },
      },
    },
  });
}

describe('LasInsightsDeck', () => {
  it('keeps the overview tab lightweight without rendering the full curve details table', () => {
    const wrapper = mountInsightsDeck({
      activeInsightsTab: 'overview',
    });

    expect(wrapper.text()).toContain('Dataset Overview');
    expect(wrapper.text()).not.toContain('Curve Details');
    expect(wrapper.findAll('.data-table-stub')).toHaveLength(0);
  });

  it('renders the curve catalog in a dedicated paginated tab', async () => {
    const wrapper = mountInsightsDeck({
      activeInsightsTab: 'curves',
    });

    expect(wrapper.text()).toContain('Curve Details');
    const tables = wrapper.findAll('.data-table-stub');
    expect(tables).toHaveLength(1);
    expect(tables[0].attributes('data-paginator')).toBe('true');
    expect(tables[0].attributes('data-rows')).toBe('12');
  });

  it('shows statistics in a bounded panel inside the analytics tab', () => {
    const wrapper = mountInsightsDeck({
      activeInsightsTab: 'analytics',
      hasStatistics: true,
      statisticsColumns: ['GR', 'RHOB', 'NPHI'],
      statisticsRows: [
        {
          metricLabel: 'Mean',
          values: { GR: '68.4', RHOB: '2.43', NPHI: '0.22' },
        },
      ],
    });

    expect(wrapper.findAll('.las-insights__panel')).toHaveLength(1);
    expect(wrapper.find('.data-table-stub').exists()).toBe(true);
  });

  it('limits preview rendering for wide datasets so the tab stays responsive', () => {
    const previewColumns = Array.from({ length: 18 }, (_, index) => `CURVE_${index + 1}`);
    const head = Array.from({ length: 20 }, (_, rowIndex) =>
      Object.fromEntries(previewColumns.map((columnName, columnIndex) => [columnName, rowIndex + columnIndex])),
    );

    const wrapper = mountInsightsDeck({
      activeInsightsTab: 'preview',
      dataPreview: {
        shape: [20, 18],
        head,
      },
      previewColumns,
    });

    expect(wrapper.text()).toContain('Showing 12 of 20 rows and 12 of 18 columns.');
    expect(wrapper.findAll('.column-stub')).toHaveLength(12);
    expect(wrapper.find('.data-table-stub').attributes('data-value-length')).toBe('12');
  });
});
