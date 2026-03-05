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

vi.mock('@/components/controls/visualInspectorSchema.js', () => {
  const controlTypes = Object.freeze({
    toggle: 'toggle',
    number: 'number',
    color: 'color',
    select: 'select'
  });

  return {
    VISUAL_INSPECTOR_CONTROL_TYPES: controlTypes,
    VISUAL_INSPECTOR_FIELD_GROUP_KEYS: Object.freeze({
      VISUAL: 'visual',
      ADVANCED_ENGINEERING: 'advanced_engineering'
    }),
    getVisualInspectorFields: () => [
      Object.freeze({
        field: 'manualLabelDepth',
        controlType: controlTypes.number,
        labelKey: 'table.casing.label_depth',
        defaultValue: null,
        min: null,
        max: null,
        step: 0.1,
        slider: Object.freeze({ min: 1000, max: 2000, step: 0.1 }),
        options: null,
        showWhen: null
      })
    ]
  };
});

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
  template: '<div data-testid="slider" :data-value="modelValue"></div>'
});

const InputNumberStub = defineComponent({
  name: 'InputNumber',
  props: {
    modelValue: {
      type: Number,
      default: null
    }
  },
  emits: ['update:model-value', 'blur'],
  template: '<input data-testid="input-number" :value="modelValue ?? \'\'" />'
});

const SelectStub = defineComponent({
  name: 'Select',
  template: '<div><slot name="value" /><slot name="option" /></div>'
});

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  template: '<button type="button" data-testid="toggle-switch"></button>'
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
              trajectory: [
                { rowId: 'trajectory-1', md: 0, inc: 0, azi: 0 }
              ]
            }
          }
        })
      ],
      stubs: {
        Card: CardStub,
        Slider: SliderStub,
        InputNumber: InputNumberStub,
        Select: SelectStub,
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

describe('VisualPropertyInspector slider commit behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('coalesces rapid slider updates into one store patch', async () => {
    const { wrapper, updateProjectRowSpy } = mountInspector();
    const slider = wrapper.getComponent(SliderStub);

    slider.vm.$emit('update:model-value', 1300);
    slider.vm.$emit('update:model-value', 1400);
    slider.vm.$emit('update:model-value', 1500);
    await nextTick();

    expect(updateProjectRowSpy).toHaveBeenCalledTimes(0);

    vi.runAllTimers();
    await nextTick();

    expect(updateProjectRowSpy).toHaveBeenCalledTimes(1);
    expect(updateProjectRowSpy).toHaveBeenLastCalledWith(
      'casingData',
      0,
      { manualLabelDepth: 1500 }
    );
  });

  it('commits continuously while dragging at the throttle interval', async () => {
    const { wrapper, updateProjectRowSpy } = mountInspector();
    const slider = wrapper.getComponent(SliderStub);

    slider.vm.$emit('update:model-value', 1300);
    await nextTick();
    expect(updateProjectRowSpy).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(24);
    await nextTick();
    expect(updateProjectRowSpy).toHaveBeenCalledTimes(1);
    expect(updateProjectRowSpy).toHaveBeenLastCalledWith(
      'casingData',
      0,
      { manualLabelDepth: 1300 }
    );

    slider.vm.$emit('update:model-value', 1400);
    slider.vm.$emit('update:model-value', 1500);
    await nextTick();
    expect(updateProjectRowSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(24);
    await nextTick();
    expect(updateProjectRowSpy).toHaveBeenCalledTimes(2);
    expect(updateProjectRowSpy).toHaveBeenLastCalledWith(
      'casingData',
      0,
      { manualLabelDepth: 1500 }
    );
  });

  it('flushes pending slider patch on slide end without extra delayed writes', async () => {
    const { wrapper, updateProjectRowSpy } = mountInspector();
    const slider = wrapper.getComponent(SliderStub);

    slider.vm.$emit('update:model-value', 1525);
    slider.vm.$emit('update:model-value', 1600);
    await nextTick();

    slider.vm.$emit('slideend', { value: 1600 });
    await nextTick();

    expect(updateProjectRowSpy).toHaveBeenCalledTimes(1);
    expect(updateProjectRowSpy).toHaveBeenLastCalledWith(
      'casingData',
      0,
      { manualLabelDepth: 1600 }
    );

    vi.runAllTimers();
    await nextTick();

    expect(updateProjectRowSpy).toHaveBeenCalledTimes(1);
  });
});
