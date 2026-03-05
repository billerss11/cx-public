import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { useProjectStore } from '@/stores/projectStore.js';
import LeftHierarchyDock from '@/components/workspace/LeftHierarchyDock.vue';

const TreeStub = defineComponent({
  name: 'Tree',
  props: {
    value: {
      type: Array,
      default: () => []
    }
  },
  template: `
    <div class="tree-stub">
      <span v-for="node in value" :key="node.key" class="tree-node-label">{{ node.label }}</span>
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

describe('LeftHierarchyDock', () => {
  it('renders project root', () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const projectStore = useProjectStore();
    projectStore.ensureInitialized({ projectName: 'Project' });

    const wrapper = mount(LeftHierarchyDock, {
      global: {
        plugins: [pinia],
        stubs: {
          Tree: TreeStub,
          ContextMenu: ContextMenuStub,
          Dialog: DialogStub,
          InputText: InputTextStub
        }
      }
    });

    expect(wrapper.text()).toContain('Project');
  });
});
