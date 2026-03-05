import { shallowMount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspaceProjectActions from '@/components/workspace/WorkspaceProjectActions.vue';
import { resetData } from '@/app/importWorkflows.js';

const { undoLastDeleteMock, selectEntityByRowRefMock } = vi.hoisted(() => ({
  undoLastDeleteMock: vi.fn(() => null),
  selectEntityByRowRefMock: vi.fn()
}));

vi.mock('@/app/i18n.js', () => ({
  t: (key) => key,
  onLanguageChange: () => () => {}
}));

vi.mock('@/app/exportWorkflows.js', () => ({
  downloadEditedWorkbook: vi.fn(),
  downloadExcelTemplate: vi.fn(),
  saveProjectFileAs: vi.fn(),
  saveActiveWellProjectFile: vi.fn(),
  saveProjectFile: vi.fn()
}));

vi.mock('@/app/importWorkflows.js', () => ({
  appendSelectedWellsFromProjectPayload: vi.fn(),
  importProjectJsonContent: vi.fn(),
  importProjectJsonFile: vi.fn(),
  parseProjectJsonContentToV3: vi.fn(),
  parseProjectJsonFileToV3: vi.fn(),
  resetData: vi.fn()
}));

vi.mock('@/app/alerts.js', () => ({
  showAlert: vi.fn()
}));

vi.mock('@/app/selection.js', () => ({
  selectEntityByRowRef: selectEntityByRowRefMock
}));

vi.mock('@/composables/useEntityEditorActions.js', () => ({
  useEntityEditorActions: () => ({
    undoLastDelete: undoLastDeleteMock
  })
}));

const projectStoreMock = {
  ensureInitialized: vi.fn(),
  wellOptions: [{ label: 'Well 1', value: 'well-1' }],
  activeWell: { name: 'Well 1' },
  activeWellId: 'well-1',
  hasUnsavedChanges: false,
  projectName: 'Project',
  projectAuthor: '',
  setActiveWell: vi.fn(),
  isWellNameUnique: vi.fn(() => true),
  setProjectName: vi.fn(),
  setProjectAuthor: vi.fn(),
  renameWell: vi.fn(() => ({ ok: true })),
  createNewWell: vi.fn(() => ({ ok: true })),
  duplicateWell: vi.fn(() => ({ ok: true, name: 'Well 1 Copy' })),
  deleteWell: vi.fn(() => ({ ok: true, deletedWellName: 'Well 1' }))
};

vi.mock('@/stores/projectStore.js', () => ({
  useProjectStore: () => projectStoreMock
}));

const DialogStub = defineComponent({
  name: 'Dialog',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    header: {
      type: String,
      default: ''
    }
  },
  emits: ['update:visible'],
  template: `
    <section v-if="visible" :data-testid="'dialog-' + header">
      <header>{{ header }}</header>
      <slot />
      <slot name="footer" />
    </section>
  `
});

const ButtonStub = defineComponent({
  name: 'Button',
  props: {
    label: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click'],
  template: `
    <button :disabled="disabled" @click="$emit('click')">
      <slot />
      {{ label }}
    </button>
  `
});

const SplitButtonStub = defineComponent({
  name: 'SplitButton',
  props: {
    label: {
      type: String,
      default: ''
    },
    model: {
      type: Array,
      default: () => []
    }
  },
  emits: ['click'],
  template: `
    <div>
      <button type="button" @click="$emit('click')">{{ label }}</button>
      <button
        v-for="(item, index) in model"
        :key="index"
        type="button"
        :data-testid="'action-' + String(item.label)"
        @click="item.command && item.command()"
      >
        {{ item.label }}
      </button>
    </div>
  `
});

const passthroughStub = (name) => defineComponent({
  name,
  template: '<div><slot /></div>'
});

function mountWorkspaceActions() {
  return shallowMount(WorkspaceProjectActions, {
    global: {
      stubs: {
        Dialog: DialogStub,
        Button: ButtonStub,
        SplitButton: SplitButtonStub,
        Select: passthroughStub('Select'),
        SelectButton: passthroughStub('SelectButton'),
        InputText: passthroughStub('InputText'),
        MultiSelect: passthroughStub('MultiSelect'),
        DataManagementControls: passthroughStub('DataManagementControls')
      }
    }
  });
}

describe('WorkspaceProjectActions reset warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows reset warning dialog and only resets after confirmation', async () => {
    const wrapper = mountWorkspaceActions();
    const resetActionButton = wrapper.find('[data-testid="action-ui.reset"]');

    expect(resetActionButton.exists()).toBe(true);
    await resetActionButton.trigger('click');

    expect(resetData).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('ui.reset_confirm_body');

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('ui.confirm'));
    expect(confirmButton).toBeTruthy();
    await confirmButton.trigger('click');

    expect(resetData).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('handles Ctrl+Z by restoring last deleted row selection', async () => {
    undoLastDeleteMock.mockReturnValue({
      wellId: 'well-1',
      entityType: 'line',
      rowId: 'line-1'
    });

    const wrapper = mountWorkspaceActions();
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true
    }));

    expect(undoLastDeleteMock).toHaveBeenCalledTimes(1);
    expect(selectEntityByRowRefMock).toHaveBeenCalledWith({
      wellId: 'well-1',
      entityType: 'line',
      rowId: 'line-1'
    });

    wrapper.unmount();
  });
});
