import { setActivePinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import LeftHierarchyDock from '@/components/workspace/LeftHierarchyDock.vue';
import { pinia } from '@/stores/pinia.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useInteractionStore } from '@/stores/interactionStore.js';

function createWellData(casingRows = []) {
  return {
    casingData: casingRows,
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
    trajectory: []
  };
}

const TreeStub = defineComponent({
  name: 'Tree',
  props: {
    value: {
      type: Array,
      default: () => []
    }
  },
  emits: ['node-select'],
  setup(props, { emit }) {
    const targetNode = computed(() => {
      const queue = Array.isArray(props.value) ? [...props.value] : [];
      while (queue.length > 0) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        if (node?.data?.kind === 'item' && node?.data?.wellId === 'well-2' && node?.data?.entityType === 'casing') {
          return node;
        }
        if (Array.isArray(node.children)) {
          queue.push(...node.children);
        }
      }
      return null;
    });

    function emitTargetSelection() {
      if (!targetNode.value) return;
      emit('node-select', targetNode.value);
    }

    return {
      targetNode,
      emitTargetSelection
    };
  },
  template: `
    <div>
      <button type="button" data-testid="tree-select-target" @click="emitTargetSelection">Select target</button>
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

const DialogStub = defineComponent({
  name: 'Dialog',
  template: '<div class="dialog-stub"><slot /><slot name="footer" /></div>'
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

describe('LeftHierarchyDock selection sync', () => {
  it('auto-switches well and updates lockedEntity on node click', async () => {
    setActivePinia(pinia);

    const projectStore = useProjectStore(pinia);
    const interactionStore = useInteractionStore(pinia);

    projectStore.loadProject({
      projectSchemaVersion: '3.0',
      projectName: 'Selection Sync',
      projectAuthor: '',
      activeWellId: 'well-1',
      projectConfig: { defaultUnits: 'ft' },
      wells: [
        {
          id: 'well-1',
          name: 'Well 1',
          data: createWellData([
            { rowId: 'well-1-csg', label: 'W1 Casing', top: 0, bottom: 1200, od: 9.625, weight: 40 }
          ]),
          config: {}
        },
        {
          id: 'well-2',
          name: 'Well 2',
          data: createWellData([
            { rowId: 'well-2-csg', label: 'W2 Casing', top: 0, bottom: 1400, od: 9.625, weight: 40 }
          ]),
          config: {}
        }
      ]
    });

    const wrapper = mount(LeftHierarchyDock, {
      global: {
        plugins: [pinia],
        stubs: {
          Tree: TreeStub,
          ContextMenu: ContextMenuStub,
          Dialog: DialogStub,
          InputText: InputTextStub,
          LeftHierarchyDockSectionActions: defineComponent({
            name: 'LeftHierarchyDockSectionActions',
            template: '<div />'
          })
        }
      }
    });

    expect(projectStore.activeWellId).toBe('well-1');

    await wrapper.get('[data-testid="tree-select-target"]').trigger('click');
    await flushPromises();

    expect(projectStore.activeWellId).toBe('well-2');
    expect(interactionStore.interaction.lockedEntity).toEqual({
      type: 'casing',
      id: 0
    });
  });
});
