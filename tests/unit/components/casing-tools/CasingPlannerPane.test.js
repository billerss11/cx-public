import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import CasingPlannerPane from '@/components/casing-tools/CasingPlannerPane.vue';

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

const SelectButtonStub = defineComponent({
  name: 'SelectButton',
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] }
  },
  emits: ['update:modelValue'],
  template: `
    <div class="select-button-stub">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="select-button-stub__option"
        :data-value="option.value"
        @click="$emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  `
});

const MessageStub = defineComponent({
  name: 'Message',
  template: '<div class="message-stub"><slot /></div>'
});

function mountPane() {
  return mount(CasingPlannerPane, {
    global: {
      stubs: {
        Select: SelectStub,
        SelectButton: SelectButtonStub,
        Message: MessageStub
      }
    }
  });
}

describe('CasingPlannerPane', () => {
  it('offers a broader maximum-stage range from the selected start casing instead of collapsing to the current target only', async () => {
    const wrapper = mountPane();

    await wrapper.find('[data-test="casing-planner-start"] .select-stub').setValue('24');

    const stageOptions = wrapper.findAll('[data-test="casing-planner-max-stages"] .select-stub option');
    const stageValues = stageOptions.map((option) => option.element.value);

    expect(stageValues).toContain('1');
    expect(stageValues).toContain('2');
  });

  it('renders stage-based planner results and prioritizes exact stage matches', async () => {
    const wrapper = mountPane();

    await wrapper.find('[data-test="casing-planner-start"] .select-stub').setValue('24');
    await wrapper.find('[data-test="casing-planner-target-type"] [data-value="casing"]').trigger('click');
    await wrapper.find('[data-test="casing-planner-target"] .select-stub').setValue('14');
    await wrapper.find('[data-test="casing-planner-max-stages"] .select-stub').setValue('3');

    const results = wrapper.find('[data-test="casing-planner-results"]');
    expect(results.text()).toContain('Start: 24 | 20 (16) x 14 1/2 (14)');
    expect(results.text()).toContain('Start: 24 | 17 1/2 (14)');
    expect(results.text().toLowerCase()).toContain('low clearance');
    expect(results.text()).toContain('3 stage(s)');
  });

  it('renders a final open-hole stage without mixing raw casing-hole chains', async () => {
    const wrapper = mountPane();

    await wrapper.find('[data-test="casing-planner-start"] .select-stub').setValue('24');
    await wrapper.find('[data-test="casing-planner-target-type"] [data-value="hole"]').trigger('click');
    await wrapper.find('[data-test="casing-planner-target"] .select-stub').setValue('14 1/2');
    await wrapper.find('[data-test="casing-planner-max-stages"] .select-stub').setValue('3');

    const results = wrapper.find('[data-test="casing-planner-results"]');
    expect(results.text()).toContain('Start: 24 | 20 (16) x 14 1/2');
    expect(results.text()).not.toContain('24 -> 20 -> 16 -> 14 1/2');
    expect(results.text()).toContain('3 stage(s)');
  });

  it('renders a separate start-hole compatibility line only when the start casing has accepted hole options', async () => {
    const wrapper = mountPane();

    await wrapper.find('[data-test="casing-planner-start"] .select-stub').setValue('20');
    await wrapper.find('[data-test="casing-planner-target-type"] [data-value="hole"]').trigger('click');
    await wrapper.find('[data-test="casing-planner-target"] .select-stub').setValue('17 1/2');
    await wrapper.find('[data-test="casing-planner-max-stages"] .select-stub').setValue('2');

    const results = wrapper.find('[data-test="casing-planner-results"]');
    expect(results.text()).toContain('Start hole options: 26 (standard), 24 (low clearance)');

    await wrapper.find('[data-test="casing-planner-start"] .select-stub').setValue('48');
    await wrapper.find('[data-test="casing-planner-target"] .select-stub').setValue('42');

    expect(wrapper.find('[data-test="casing-planner-start-hole-options"]').exists()).toBe(false);
  });
});
