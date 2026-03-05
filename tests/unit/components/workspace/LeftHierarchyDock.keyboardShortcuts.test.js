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
    }
  },
  setup(props) {
    const targetNode = computed(() => findNodeByPredicate(
      props.value,
      (node) => node?.data?.kind === 'item' && node?.data?.domainKey === 'lines'
    ));
    return {
      targetNode
    };
  },
  template: `
    <div>
      <slot v-if="targetNode" name="default" :node="targetNode" />
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
  template: '<input data-testid="rename-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
});

function mountDockWithOneLine() {
  const projectStore = useProjectStore(pinia);
  projectStore.loadProject({
    projectSchemaVersion: '3.0',
    projectName: 'Keyboard Shortcuts',
    projectAuthor: '',
    activeWellId: 'well-1',
    projectConfig: { defaultUnits: 'ft' },
    wells: [
      {
        id: 'well-1',
        name: 'Well 1',
        data: createWellData([
          { rowId: 'line-1', depth: 1200, label: 'Original Line', show: true }
        ]),
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
        LeftHierarchyDockSectionActions: defineComponent({
          name: 'LeftHierarchyDockSectionActions',
          template: '<div />'
        })
      }
    }
  });
}

describe('LeftHierarchyDock keyboard shortcuts', () => {
  it('deletes selected item with Delete key', async () => {
    setActivePinia(pinia);
    const projectDataStore = useProjectDataStore(pinia);
    const wrapper = mountDockWithOneLine();

    expect(projectDataStore.horizontalLines).toHaveLength(1);

    await wrapper.get('.left-hierarchy-dock__node-label').trigger('contextmenu');
    await flushPromises();

    await wrapper.get('.left-hierarchy-dock').trigger('keydown', { key: 'Delete' });
    await flushPromises();

    expect(projectDataStore.horizontalLines).toHaveLength(0);
  });

  it('starts inline rename on F2 key and commits with Enter', async () => {
    setActivePinia(pinia);
    const projectDataStore = useProjectDataStore(pinia);
    const wrapper = mountDockWithOneLine();

    await wrapper.get('.left-hierarchy-dock__node-label').trigger('contextmenu');
    await flushPromises();

    await wrapper.get('.left-hierarchy-dock').trigger('keydown', { key: 'F2' });
    await flushPromises();

    const renameInput = wrapper.get('[data-testid="rename-input"]');
    await renameInput.setValue('Renamed via F2');
    await renameInput.trigger('keydown.enter');
    await flushPromises();

    expect(projectDataStore.horizontalLines[0].label).toBe('Renamed via F2');
  });
});
