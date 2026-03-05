import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { computed, defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import LeftHierarchyDock from '@/components/workspace/LeftHierarchyDock.vue';
import { useProjectStore } from '@/stores/projectStore.js';

function flattenTreeNodes(nodes = []) {
  const queue = Array.isArray(nodes) ? [...nodes] : [];
  const result = [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    result.push(node);
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }
  return result;
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
    const flatNodes = computed(() => flattenTreeNodes(props.value));
    return {
      flatNodes
    };
  },
  template: `
    <div class="tree-stub">
      <div v-for="node in flatNodes" :key="node.key" class="tree-stub__node">
        <slot :node="node" />
      </div>
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
  template: '<div class="section-actions-stub" />'
});

describe('LeftHierarchyDock well node highlight', () => {
  it('applies a shared highlight class only to level-2 well nodes', () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const projectStore = useProjectStore();
    projectStore.ensureInitialized({ projectName: 'Color Project', defaultWellName: 'Well A' });
    projectStore.appendWell({ name: 'Well B' }, { activate: false });
    projectStore.appendWell({ name: 'Well C' }, { activate: false });

    const wrapper = mount(LeftHierarchyDock, {
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

    const allLabels = wrapper.findAll('.left-hierarchy-dock__node-label');
    const wellLabels = wrapper.findAll('.left-hierarchy-dock__node-label--well');

    expect(allLabels.length).toBeGreaterThan(3);
    expect(wellLabels).toHaveLength(3);
  });
});
