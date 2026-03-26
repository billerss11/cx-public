import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdvancedEntityEditor from '@/components/controls/AdvancedEntityEditor.vue';

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
      field: 'od',
      label: 'OD',
      controlType: 'number'
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

const InputNumberStub = defineComponent({
  name: 'InputNumber',
  props: {
    modelValue: {
      type: Number,
      default: null
    }
  },
  emits: ['update:model-value', 'input', 'blur', 'keydown.enter'],
  template: '<input data-testid="od-input" :value="modelValue ?? \'\'" />'
});

const InputTextStub = defineComponent({
  name: 'InputText',
  template: '<input data-testid="text-input" />'
});

const SelectStub = defineComponent({
  name: 'Select',
  template: '<div data-testid="select-stub"></div>'
});

const SliderStub = defineComponent({
  name: 'Slider',
  template: '<div data-testid="slider-stub"></div>'
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
  return mount(AdvancedEntityEditor, {
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
                entityType: 'casing',
                rowId: 'casing-1'
              }
            },
            interaction: {
              interaction: {
                lockedEntity: null,
                hoveredEntity: null
              }
            },
            projectData: {
              casingData: [
                {
                  rowId: 'casing-1',
                  label: 'Surface',
                  od: 9.625,
                  weight: 40,
                  top: 0,
                  bottom: 5000
                }
              ],
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
            }
          }
        })
      ],
      stubs: {
        Card: CardStub,
        InputNumber: InputNumberStub,
        InputText: InputTextStub,
        Select: SelectStub,
        Slider: SliderStub,
        Textarea: TextareaStub,
        ToggleSwitch: ToggleSwitchStub
      }
    }
  });
}

describe('AdvancedEntityEditor numeric blur commit ordering', () => {
  beforeEach(() => {
    updateFieldSpy.mockReset();
  });

  it('commits the typed numeric blur value when PrimeVue blur fires before model update', async () => {
    const wrapper = mountEditor();
    const input = wrapper.getComponent(InputNumberStub);

    input.vm.$emit('blur', { value: '8.5' });
    await nextTick();
    input.vm.$emit('update:model-value', 8.5);
    await nextTick();

    expect(updateFieldSpy).toHaveBeenCalledTimes(1);
    expect(updateFieldSpy).toHaveBeenLastCalledWith({
      entityType: 'casing',
      rowId: 'casing-1',
      field: 'od',
      value: 8.5
    });
  });
});
