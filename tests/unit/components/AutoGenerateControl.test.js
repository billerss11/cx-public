import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AutoGenerateControl from '@/components/AutoGenerateControl.vue';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';
import { useInteractionStore } from '@/stores/interactionStore.js';

vi.mock('@/composables/useSchematicRenderer.js', () => ({
  requestSchematicRender: vi.fn()
}));

vi.mock('@/app/i18n.js', () => ({
  onLanguageChange: () => () => {},
  t: (key) => key
}));

const ToggleSwitchStub = defineComponent({
  name: 'ToggleSwitch',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    inputId: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  template: `
    <button
      :id="inputId"
      type="button"
      data-testid="toggle-switch"
      @click="$emit('update:modelValue', !modelValue)"
    />
  `
});

function mountAutoGenerateControl(initialAutoGenerate = false) {
  return mount(AutoGenerateControl, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            interaction: {
              interaction: {
                autoGenerate: initialAutoGenerate
              }
            }
          }
        })
      ],
      stubs: {
        ToggleSwitch: ToggleSwitchStub
      }
    }
  });
}

describe('AutoGenerateControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables auto-generate and requests an immediate render', async () => {
    const wrapper = mountAutoGenerateControl(false);
    const interactionStore = useInteractionStore();

    await wrapper.get('[data-testid="toggle-switch"]').trigger('click');

    expect(interactionStore.interaction.autoGenerate).toBe(true);
    expect(requestSchematicRender).toHaveBeenCalledWith({ immediate: true });
    expect(requestSchematicRender).toHaveBeenCalledTimes(1);
  });

  it('does not request extra render when toggling auto-generate off', async () => {
    const wrapper = mountAutoGenerateControl(false);
    const interactionStore = useInteractionStore();

    await wrapper.get('[data-testid="toggle-switch"]').trigger('click');
    await wrapper.get('[data-testid="toggle-switch"]').trigger('click');

    expect(interactionStore.interaction.autoGenerate).toBe(false);
    expect(requestSchematicRender).toHaveBeenCalledTimes(1);
  });
});
