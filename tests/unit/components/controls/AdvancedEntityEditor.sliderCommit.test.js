import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdvancedEntityEditor from '@/components/controls/AdvancedEntityEditor.vue';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

const updateFieldSpy = vi.hoisted(() => vi.fn());

vi.mock('@/composables/useEntityEditorActions.js', () => ({
  useEntityEditorActions: () => ({
    updateField: updateFieldSpy
  })
}));

vi.mock('@/controls/entityEditor/entityFieldSchema.js', () => ({
  DATA_TAB_READ_ONLY_FIELDS_ENABLED: true,
  ENTITY_EDITOR_CONTROL_TYPES: {
    text: 'text',
    number: 'number',
    toggle: 'toggle',
    select: 'select',
    json: 'json'
  },
  resolveEntityEditorFieldDefinitions: () => ([
    {
      field: 'depth',
      label: 'Depth',
      controlType: 'number',
      min: 0,
      max: 5000,
      step: 0.1,
      slider: Object.freeze({ min: 0, max: 5000, step: 0.1 })
    },
    {
      field: 'rowId',
      label: 'Row ID',
      controlType: 'text',
      readOnly: true
    }
  ])
}));

const CardStub = defineComponent({
  name: 'Card',
  template: '<div><slot name="content" /></div>'
});

const SliderStub = defineComponent({
  name: 'Slider',
  props: {
    modelValue: {
      type: Number,
      default: null
    }
  },
  emits: ['update:model-value', 'slideend'],
  template: '<div data-testid="depth-slider" :data-value="modelValue"></div>'
});

const InputNumberStub = defineComponent({
  name: 'InputNumber',
  props: {
    modelValue: {
      type: Number,
      default: null
    }
  },
  emits: ['update:model-value', 'blur', 'keydown.enter'],
  template: '<input data-testid="depth-input" :value="modelValue ?? \'\'" />'
});

const InputTextStub = defineComponent({
  name: 'InputText',
  template: '<input data-testid="text-input" />'
});

const SelectStub = defineComponent({
  name: 'Select',
  template: '<div data-testid="select-stub"></div>'
});

const TextareaStub = defineComponent({
  name: 'Textarea',
  template: '<textarea data-testid="textarea-stub"></textarea>'
});

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  template: '<button type="button" data-testid="toggle-stub"></button>'
});

function mountEditor() {
  const wrapper = mount(AdvancedEntityEditor, {
    props: {
      mode: 'advanced'
    },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            workspace: {
              rightDockEditorMode: 'advanced',
              selectedHierarchyRef: {
                wellId: 'well-1',
                entityType: 'lines',
                rowId: 'line-1'
              }
            },
            interaction: {
              interaction: {
                lockedEntity: null,
                hoveredEntity: null
              }
            },
            projectData: {
              horizontalLines: [
                { rowId: 'line-1', depth: 1000, label: 'Line 1', show: true },
                { rowId: 'line-2', depth: 2000, label: 'Line 2', show: true }
              ],
              casingData: [],
              tubingData: [],
              drillStringData: [],
              equipmentData: [],
              annotationBoxes: [],
              userAnnotations: [],
              cementPlugs: [],
              annulusFluids: [],
              markers: [],
              topologySources: [],
              trajectory: []
            }
          }
        })
      ],
      stubs: {
        Card: CardStub,
        Slider: SliderStub,
        InputNumber: InputNumberStub,
        InputText: InputTextStub,
        Select: SelectStub,
        Textarea: TextareaStub,
        ToggleSwitch: ToggleSwitchStub
      }
    }
  });

  return {
    wrapper,
    workspaceStore: useWorkspaceStore()
  };
}

describe('AdvancedEntityEditor slider commit behavior', () => {
  beforeEach(() => {
    updateFieldSpy.mockReset();
    vi.useFakeTimers();
  });

  it('coalesces rapid slider updates into one buffered field commit', async () => {
    const { wrapper } = mountEditor();
    const slider = wrapper.getComponent(SliderStub);

    slider.vm.$emit('update:model-value', 1200);
    slider.vm.$emit('update:model-value', 1300);
    slider.vm.$emit('update:model-value', 1400);
    await nextTick();

    expect(updateFieldSpy).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(24);
    await nextTick();

    expect(updateFieldSpy).toHaveBeenCalledTimes(1);
    expect(updateFieldSpy).toHaveBeenLastCalledWith({
      entityType: 'lines',
      rowId: 'line-1',
      field: 'depth',
      value: 1400
    });
  });

  it('flushes the pending slider value on slide end without leaving extra delayed commits', async () => {
    const { wrapper } = mountEditor();
    const slider = wrapper.getComponent(SliderStub);

    slider.vm.$emit('update:model-value', 1550);
    slider.vm.$emit('update:model-value', 1600);
    await nextTick();

    slider.vm.$emit('slideend', { value: 1600 });
    await nextTick();

    expect(updateFieldSpy).toHaveBeenCalledTimes(1);
    expect(updateFieldSpy).toHaveBeenLastCalledWith({
      entityType: 'lines',
      rowId: 'line-1',
      field: 'depth',
      value: 1600
    });

    vi.runAllTimers();
    await nextTick();

    expect(updateFieldSpy).toHaveBeenCalledTimes(1);
  });

  it('flushes a pending slider value when the number input blurs', async () => {
    const { wrapper } = mountEditor();
    const slider = wrapper.getComponent(SliderStub);
    const input = wrapper.getComponent(InputNumberStub);

    slider.vm.$emit('update:model-value', 1700);
    await nextTick();

    input.vm.$emit('blur');
    await nextTick();

    expect(updateFieldSpy).toHaveBeenCalledTimes(1);
    expect(updateFieldSpy).toHaveBeenLastCalledWith({
      entityType: 'lines',
      rowId: 'line-1',
      field: 'depth',
      value: 1700
    });

    vi.runAllTimers();
    await nextTick();

    expect(updateFieldSpy).toHaveBeenCalledTimes(1);
  });

  it('clears pending slider commits when the selected row changes', async () => {
    const { wrapper, workspaceStore } = mountEditor();
    const slider = wrapper.getComponent(SliderStub);

    slider.vm.$emit('update:model-value', 1450);
    await nextTick();

    workspaceStore.setSelectedHierarchyRef({
      wellId: 'well-1',
      entityType: 'lines',
      rowId: 'line-2'
    });
    await nextTick();

    vi.runAllTimers();
    await nextTick();

    expect(updateFieldSpy).toHaveBeenCalledTimes(0);
    wrapper.unmount();
  });

  it('clears pending slider commits on unmount', async () => {
    const { wrapper } = mountEditor();
    const slider = wrapper.getComponent(SliderStub);

    slider.vm.$emit('update:model-value', 1900);
    await nextTick();

    wrapper.unmount();
    vi.runAllTimers();

    expect(updateFieldSpy).toHaveBeenCalledTimes(0);
  });
});
