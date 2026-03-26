import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VisualPropertyInspector from '@/components/controls/VisualPropertyInspector.vue';
import { useProjectDataStore } from '@/stores/projectDataStore.js';

vi.mock('@/app/i18n.js', () => ({
  onLanguageChange: () => () => {},
  t: (key) => key
}));

vi.mock('@/components/controls/visualInspectorSchema.js', () => ({
  VISUAL_INSPECTOR_CONTROL_TYPES: Object.freeze({
    toggle: 'toggle',
    number: 'number',
    color: 'color',
    select: 'select'
  }),
  getVisualInspectorFields: () => ([
    Object.freeze({
      field: 'manualLabelDepth',
      controlType: 'number',
      labelKey: 'table.casing.label_depth',
      defaultValue: null,
      min: null,
      max: null,
      step: 0.1,
      slider: null,
      options: null,
      showWhen: null
    })
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
  emits: ['update:model-value', 'input', 'blur'],
  template: '<input data-testid="manual-label-depth-input" :value="modelValue ?? \'\'" />'
});

const SelectStub = defineComponent({
  name: 'Select',
  template: '<div data-testid="select-stub"></div>'
});

const SliderStub = defineComponent({
  name: 'Slider',
  template: '<div data-testid="slider-stub"></div>'
});

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  template: '<button type="button" data-testid="toggle-stub"></button>'
});

function mountInspector() {
  const wrapper = mount(VisualPropertyInspector, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            interaction: {
              interaction: {
                lockedEntity: { type: 'casing', id: 0 }
              }
            },
            projectData: {
              casingData: [
                {
                  rowId: 'casing-1',
                  label: 'Surface',
                  top: 1000,
                  bottom: 2000,
                  manualLabelDepth: 1200
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
        Select: SelectStub,
        Slider: SliderStub,
        ToggleSwitch: ToggleSwitchStub
      }
    }
  });

  const projectDataStore = useProjectDataStore();
  return {
    wrapper,
    updateProjectRowSpy: vi.spyOn(projectDataStore, 'updateProjectRow')
  };
}

describe('VisualPropertyInspector numeric blur commit ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits the typed numeric blur value when PrimeVue blur fires before model update', async () => {
    const { wrapper, updateProjectRowSpy } = mountInspector();
    const input = wrapper.getComponent(InputNumberStub);

    input.vm.$emit('blur', { value: '1450' });
    await nextTick();
    input.vm.$emit('update:model-value', 1450);
    await nextTick();

    expect(updateProjectRowSpy).toHaveBeenCalledTimes(1);
    expect(updateProjectRowSpy).toHaveBeenLastCalledWith(
      'casingData',
      0,
      { manualLabelDepth: 1450 }
    );
  });
});
