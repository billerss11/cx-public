import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workflowState = vi.hoisted(() => {
  let deferredResolve = null;
  let deferredReject = null;

  const createDeferred = () => new Promise((resolve, reject) => {
    deferredResolve = resolve;
    deferredReject = reject;
  });

  return {
    snapshotIndex: 0,
    snapshots: [
      {
        project: { generatedAt: '2026-03-17T17:00:00.000Z' },
        well: { id: 'well-1', name: 'Well 1' }
      },
      {
        project: { generatedAt: '2026-03-17T17:30:00.000Z' },
        well: { id: 'well-1', name: 'Well 1 refreshed' }
      }
    ],
    buildCurrentReviewSummarySnapshot: vi.fn(() => {
      const snapshot = workflowState.snapshots[Math.min(workflowState.snapshotIndex, workflowState.snapshots.length - 1)];
      workflowState.snapshotIndex += 1;
      return snapshot;
    }),
    loadReviewSummaryDerivedSummary: vi.fn(() => createDeferred()),
    resolveDerived(value) {
      deferredResolve?.(value);
    },
    rejectDerived(error) {
      deferredReject?.(error);
    },
    reset() {
      workflowState.snapshotIndex = 0;
      workflowState.buildCurrentReviewSummarySnapshot.mockClear();
      workflowState.loadReviewSummaryDerivedSummary.mockClear();
      deferredResolve = null;
      deferredReject = null;
    }
  };
});

const modelBuilder = vi.hoisted(() => ({
  buildReviewSummaryModel: vi.fn((snapshot, options = {}) => {
    const derivedState = options?.derivedState ?? { status: 'loading' };
    const isReady = derivedState.status === 'ready';
    const hasError = derivedState.status === 'error';

    return {
      sections: [
        { id: 'overview', kind: 'metrics', modelKey: 'overview' },
        { id: 'casing', kind: 'table', modelKey: 'casing' },
        { id: 'active-string', kind: 'table', modelKey: 'activeString' },
        { id: 'equipment', kind: 'table', modelKey: 'equipment' },
        { id: 'entered-data-counts', kind: 'metrics', modelKey: 'enteredDataCounts' },
        { id: 'derived-summary', kind: 'metrics', modelKey: 'derivedSummary' },
        { id: 'warning-digest', kind: 'warning-list', modelKey: 'warningDigest' }
      ],
      overview: {
        title: 'Overview',
        items: [
          { key: 'wellName', label: 'Well name', value: snapshot.well.name },
          { key: 'snapshotTime', label: 'Snapshot time', value: snapshot.project.generatedAt }
        ]
      },
      casing: {
        title: 'Casing data',
        columns: [{ key: 'label', label: 'Label' }],
        rows: [{ key: 'csg-1', label: 'Surface casing' }]
      },
      activeString: {
        title: 'Tubing data',
        columns: [{ key: 'label', label: 'Label' }],
        rows: [{ key: 'tbg-1', label: 'Production tubing' }]
      },
      equipment: {
        title: 'Equipment list',
        columns: [{ key: 'label', label: 'Label' }],
        rows: [{ key: 'eq-1', label: 'Bridge plug' }]
      },
      enteredDataCounts: {
        title: 'Entered data counts',
        items: [{ key: 'markers', label: 'Markers', value: 1 }]
      },
      derivedSummary: {
        title: 'Derived summary',
        status: derivedState.status,
        error: hasError ? derivedState.error : null,
        items: isReady ? [{ key: 'warningCount', label: 'Warning count', value: 2 }] : []
      },
      warningDigest: {
        title: 'Warning digest',
        status: derivedState.status,
        rows: isReady ? [{ key: 'warning-1', code: 'W-1', message: 'Warning 1' }] : [],
        remainingCount: isReady ? 1 : 0,
        moreLabel: isReady ? 'and 1 more' : ''
      }
    };
  })
}));

vi.mock('@/reports/reviewSummary.js', () => ({
  buildCurrentReviewSummarySnapshot: workflowState.buildCurrentReviewSummarySnapshot,
  loadReviewSummaryDerivedSummary: workflowState.loadReviewSummaryDerivedSummary
}));

vi.mock('@/reports/reviewSummaryModel.js', () => ({
  buildReviewSummaryModel: modelBuilder.buildReviewSummaryModel
}));

vi.mock('@/app/i18n.js', () => ({
  t: (key) => ({
    'ui.review_summary.title': 'Review Summary',
    'ui.review_summary.refresh': 'Refresh',
    'ui.review_summary.derived_loading': 'Derived summary updating...',
    'ui.review_summary.derived_error': 'Derived summary failed to update.'
  }[key] ?? key),
  onLanguageChange: vi.fn(() => () => {})
}));

const DialogStub = defineComponent({
  name: 'Dialog',
  props: {
    visible: { type: Boolean, default: false },
    style: { type: Object, default: () => ({}) }
  },
  emits: ['update:visible'],
  template: `
    <section v-if="visible" class="dialog-stub" :style="style">
      <header class="dialog-stub__header"><slot name="header" /></header>
      <div class="dialog-stub__body"><slot /></div>
    </section>
  `
});

const ButtonStub = defineComponent({
  name: 'Button',
  props: {
    disabled: { type: Boolean, default: false }
  },
  emits: ['click'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
});

const CardStub = defineComponent({
  name: 'Card',
  template: `
    <section class="card-stub">
      <header class="card-stub__title"><slot name="title" /></header>
      <div class="card-stub__content"><slot name="content" /><slot /></div>
    </section>
  `
});

const DataTableStub = defineComponent({
  name: 'DataTable',
  props: {
    value: { type: Array, default: () => [] }
  },
  template: `
    <div class="datatable-stub">
      <div class="datatable-stub__header"><slot name="header" /></div>
      <div class="datatable-stub__body">
        <slot />
        <div v-for="row in value" :key="row.key || row.label" class="datatable-stub__row">{{ JSON.stringify(row) }}</div>
      </div>
    </div>
  `
});

const ColumnStub = defineComponent({
  name: 'Column',
  template: '<div class="column-stub"><slot name="header" /></div>'
});

describe('ReviewSummaryDialog', () => {
  beforeEach(() => {
    workflowState.reset();
    modelBuilder.buildReviewSummaryModel.mockClear();
  });

  it('opens immediately with entered data, then fills in derived summary after async recompute', async () => {
    const { default: ReviewSummaryDialog } = await import('@/components/report/ReviewSummaryDialog.vue');

    const wrapper = mount(ReviewSummaryDialog, {
      props: {
        visible: true
      },
      global: {
        stubs: {
          Dialog: DialogStub,
          Button: ButtonStub,
          Card: CardStub,
          DataTable: DataTableStub,
          Column: ColumnStub
        }
      }
    });
    await flushPromises();

    expect(workflowState.buildCurrentReviewSummarySnapshot).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Well 1');
    expect(wrapper.text()).toContain('Surface casing');
    expect(wrapper.text()).toContain('Production tubing');
    expect(wrapper.text()).toContain('Bridge plug');
    expect(wrapper.text()).toContain('Derived summary updating...');

    workflowState.resolveDerived({
      status: 'ready',
      metrics: { warningCount: 2 },
      warnings: [{ key: 'warning-1', code: 'W-1', message: 'Warning 1' }]
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Warning 1');
    expect(wrapper.text()).toContain('and 1 more');
  });

  it('refreshes from current runtime state and keeps entered data visible on derived failure', async () => {
    const { default: ReviewSummaryDialog } = await import('@/components/report/ReviewSummaryDialog.vue');

    const wrapper = mount(ReviewSummaryDialog, {
      props: {
        visible: true
      },
      global: {
        stubs: {
          Dialog: DialogStub,
          Button: ButtonStub,
          Card: CardStub,
          DataTable: DataTableStub,
          Column: ColumnStub
        }
      }
    });
    await flushPromises();

    workflowState.resolveDerived({
      status: 'ready',
      metrics: { warningCount: 2 },
      warnings: [{ key: 'warning-1', code: 'W-1', message: 'Warning 1' }]
    });
    await flushPromises();

    await wrapper.find('[data-test="review-summary-refresh"]').trigger('click');
    await flushPromises();
    expect(workflowState.buildCurrentReviewSummarySnapshot).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('Well 1 refreshed');
    expect(wrapper.find('.review-summary-dialog__resizer').exists()).toBe(true);

    workflowState.rejectDerived(new Error('Topology worker failed.'));
    await flushPromises();

    expect(wrapper.text()).toContain('Derived summary failed to update.');
    expect(wrapper.text()).toContain('Surface casing');
    expect(wrapper.text()).not.toContain('Schematic figure');
    expect(wrapper.text()).not.toContain('Export Report PDF');
  });
});
