import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import CasingRuleExplorerPane from '@/components/casing-tools/CasingRuleExplorerPane.vue';

const SelectStub = defineComponent({
  name: 'Select',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },
    optionLabel: { type: String, default: 'label' },
    optionValue: { type: String, default: 'value' }
  },
  emits: ['update:modelValue'],
  template: `
    <select class="select-stub" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option
        v-for="option in options"
        :key="option[optionValue]"
        :value="option[optionValue]"
      >
        {{ option[optionLabel] }}
      </option>
    </select>
  `
});

const MessageStub = defineComponent({
  name: 'Message',
  template: '<div class="message-stub"><slot /></div>'
});

function mountPane() {
  return mount(CasingRuleExplorerPane, {
    global: {
      stubs: {
        Select: SelectStub,
        Message: MessageStub
      }
    }
  });
}

describe('CasingRuleExplorerPane', () => {
  it('shows both casing-role and hole-role relationships for overlapping labels', async () => {
    const wrapper = mountPane();

    await wrapper.find('[data-test="casing-rule-explorer-select"] .select-stub').setValue('16');

    expect(wrapper.text()).toContain('Accepted in holes');
    expect(wrapper.text()).toContain('Drillable holes');
    expect(wrapper.text()).toContain('Settable casing');
    expect(wrapper.text()).toContain('Reachable from casing');
    expect(wrapper.text()).toContain('17 1/2');
    expect(wrapper.text()).toContain('13 3/8');
  });
});
