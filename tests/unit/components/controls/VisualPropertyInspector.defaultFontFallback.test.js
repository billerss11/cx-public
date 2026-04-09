import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import VisualPropertyInspector from '@/components/controls/VisualPropertyInspector.vue';

vi.mock('@/app/i18n.js', () => ({
  getEnumOptions: () => [],
  onLanguageChange: () => () => {},
  t: (key) => key
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
  template: '<div data-testid="slider" :data-value="modelValue"></div>'
});

const InputNumberStub = defineComponent({
  name: 'InputNumber',
  props: {
    inputId: {
      type: String,
      default: ''
    },
    modelValue: {
      type: Number,
      default: null
    }
  },
  template: `
    <input
      data-testid="input-number"
      :data-input-id="inputId"
      :value="modelValue ?? ''"
    />
  `
});

const SelectStub = defineComponent({
  name: 'Select',
  template: '<div></div>'
});

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  template: '<button type="button"></button>'
});

function mountInspectorWithCasingRow(rowOverrides = {}) {
  return mount(VisualPropertyInspector, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            interaction: {
              interaction: {
                lockedEntity: { type: 'casing', id: 0 },
                hoveredEntity: { type: 'casing', id: 0 },
                selectedUserAnnotationId: null
              }
            },
            projectData: {
              casingData: [
                {
                  rowId: 'casing-1',
                  label: 'Surface casing',
                  od: 13.375,
                  weight: 54.5,
                  grade: 'J55',
                  top: 1400,
                  bottom: 3500,
                  labelXPos: null,
                  manualLabelDepth: null,
                  casingLabelFontSize: null,
                  depthLabelFontSize: null,
                  depthLabelOffset: null,
                  showTop: true,
                  showBottom: true,
                  ...rowOverrides
                }
              ],
              tubingData: [],
              drillStringData: [],
              equipmentData: [],
              horizontalLines: [],
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
}

function findInputValue(wrapper, inputId) {
  return wrapper.get(`[data-input-id="${inputId}"]`).element.value;
}

describe('VisualPropertyInspector default font fallbacks', () => {
  it('shows casing label and depth label rendered defaults when row values are null', async () => {
    const wrapper = mountInspectorWithCasingRow();

    await nextTick();

    expect(findInputValue(wrapper, 'visual-inspector-casingLabelFontSize')).toBe('11');
    expect(findInputValue(wrapper, 'visual-inspector-depthLabelFontSize')).toBe('9');
  });

  it('preserves explicit row font sizes instead of replacing them with defaults', async () => {
    const wrapper = mountInspectorWithCasingRow({
      casingLabelFontSize: 15,
      depthLabelFontSize: 12
    });

    await nextTick();

    expect(findInputValue(wrapper, 'visual-inspector-casingLabelFontSize')).toBe('15');
    expect(findInputValue(wrapper, 'visual-inspector-depthLabelFontSize')).toBe('12');
  });
});