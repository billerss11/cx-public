import { setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import LeftHierarchyDock from '@/components/workspace/LeftHierarchyDock.vue';
import { pinia } from '@/stores/pinia.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';

function createWellData(lineRows = []) {
  return {
    casingData: [],
    tubingData: [],
    drillStringData: [],
    equipmentData: [],
    horizontalLines: lineRows,
    annotationBoxes: [],
    userAnnotations: [],
    cementPlugs: [],
    annulusFluids: [],
    markers: [],
    topologySources: [],
    trajectory: []
  };
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function findNodeByPredicate(nodes, predicate) {
  const queue = toSafeArray(nodes).slice();
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    if (predicate(node) === true) return node;
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }
  return null;
}

const TreeStub = defineComponent({
  name: 'Tree',
  props: {
    value: {
      type: Array,
      default: () => []
    },
    draggableNodes: {
      type: Boolean,
      default: false
    },
    droppableNodes: {
      type: Boolean,
      default: false
    },
    validateDrop: {
      type: Boolean,
      default: false
    }
  },
  emits: ['node-select'],
  setup(props, { emit }) {
    const seenDragDropProps = computed(
      () => `${String(props.draggableNodes)}|${String(props.droppableNodes)}|${String(props.validateDrop)}`
    );
    const lineRowOrder = computed(() => {
      const domainNode = findNodeByPredicate(
        props.value,
        (node) => node?.data?.kind === 'domain' && node?.data?.domainKey === 'lines'
      );
      if (!domainNode || !Array.isArray(domainNode.children)) return '';
      return domainNode.children
        .map((node) => String(node?.data?.rowId ?? '').trim())
        .filter((token) => token.length > 0)
        .join(',');
    });

    function emitSelect(rowId) {
      const target = findNodeByPredicate(
        props.value,
        (node) => node?.data?.kind === 'item' && node?.data?.domainKey === 'lines' && node?.data?.rowId === rowId
      );
      if (!target) return;
      emit('node-select', target);
    }

    return {
      seenDragDropProps,
      lineRowOrder,
      emitSelect
    };
  },
  template: `
    <div>
      <div data-testid="dragdrop-props">{{ seenDragDropProps }}</div>
      <div data-testid="tree-line-order">{{ lineRowOrder }}</div>
      <button type="button" data-testid="select-line-1" @click="emitSelect('line-1')">Select line 1</button>
      <button type="button" data-testid="select-line-2" @click="emitSelect('line-2')">Select line 2</button>
    </div>
  `
});

const ContextMenuStub = defineComponent({
  name: 'ContextMenu',
  setup(_props, { expose }) {
    expose({
      show: () => {}
    });
    return {};
  },
  template: '<div class="context-menu-stub" />'
});

const InputTextStub = defineComponent({
  name: 'InputText',
  props: {
    modelValue: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
});

const SectionActionsStub = defineComponent({
  name: 'LeftHierarchyDockSectionActions',
  props: {
    canAdd: {
      type: Boolean,
      default: false
    },
    canMoveUp: {
      type: Boolean,
      default: false
    },
    canMoveDown: {
      type: Boolean,
      default: false
    }
  },
  emits: ['add', 'move-up', 'move-down'],
  template: `
    <div>
      <button type="button" data-testid="action-add" :disabled="!canAdd" @click="$emit('add')">Add</button>
      <button type="button" data-testid="action-move-up" :disabled="!canMoveUp" @click="$emit('move-up')">Up</button>
      <button type="button" data-testid="action-move-down" :disabled="!canMoveDown" @click="$emit('move-down')">Down</button>
    </div>
  `
});

function mountDockWithLines(lineRows) {
  const projectStore = useProjectStore(pinia);
  projectStore.loadProject({
    projectSchemaVersion: '3.0',
    projectName: 'Hierarchy Actions Test',
    projectAuthor: '',
    activeWellId: 'well-1',
    projectConfig: { defaultUnits: 'ft' },
    wells: [
      {
        id: 'well-1',
        name: 'Well 1',
        data: createWellData(lineRows),
        config: {}
      }
    ]
  });

  return mount(LeftHierarchyDock, {
    global: {
      plugins: [pinia],
      stubs: {
        Tree: TreeStub,
        ContextMenu: ContextMenuStub,
        InputText: InputTextStub,
        LeftHierarchyDockSectionActions: SectionActionsStub
      }
    }
  });
}

describe('LeftHierarchyDock actions', () => {
  it('disables drag-drop and reorders with move up/down buttons', async () => {
    setActivePinia(pinia);

    const projectDataStore = useProjectDataStore(pinia);
    const wrapper = mountDockWithLines([
      { rowId: 'line-1', depth: 1000, label: 'A', show: true },
      { rowId: 'line-2', depth: 2000, label: 'B', show: true },
      { rowId: 'line-3', depth: 3000, label: 'C', show: true }
    ]);

    expect(wrapper.get('[data-testid="dragdrop-props"]').text()).toBe('false|false|false');
    expect(wrapper.get('[data-testid="tree-line-order"]').text()).toBe('line-1,line-2,line-3');

    await wrapper.get('[data-testid="select-line-2"]').trigger('click');
    await flushPromises();

    await wrapper.get('[data-testid="action-move-up"]').trigger('click');
    await flushPromises();
    expect(projectDataStore.horizontalLines.map((row) => row.rowId)).toEqual([
      'line-2',
      'line-1',
      'line-3'
    ]);

    await wrapper.get('[data-testid="action-move-down"]').trigger('click');
    await flushPromises();
    expect(projectDataStore.horizontalLines.map((row) => row.rowId)).toEqual([
      'line-1',
      'line-2',
      'line-3'
    ]);
  });

  it('adds to the end of selected domain even when first item is selected', async () => {
    setActivePinia(pinia);

    const projectDataStore = useProjectDataStore(pinia);
    const wrapper = mountDockWithLines([
      { rowId: 'line-1', depth: 1000, label: 'A', show: true },
      { rowId: 'line-2', depth: 2000, label: 'B', show: true },
      { rowId: 'line-3', depth: 3000, label: 'C', show: true }
    ]);

    await wrapper.get('[data-testid="select-line-1"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="action-add"]').trigger('click');
    await flushPromises();

    const rowIds = projectDataStore.horizontalLines.map((row) => row.rowId);
    expect(rowIds).toHaveLength(4);
    expect(rowIds.slice(0, 3)).toEqual(['line-1', 'line-2', 'line-3']);
    expect(rowIds[3]).not.toBe('line-1');
    expect(rowIds[3]).not.toBe('line-2');
    expect(rowIds[3]).not.toBe('line-3');
  });
});
