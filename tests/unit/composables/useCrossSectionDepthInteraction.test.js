import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useCrossSectionDepthInteraction } from '@/composables/useCrossSectionDepthInteraction.js';

function createInteractionHarness(options) {
  let interactionApi = null;

  const Harness = defineComponent({
    name: 'CrossSectionDepthInteractionHarness',
    setup() {
      interactionApi = useCrossSectionDepthInteraction(options);
      return () => h('div');
    }
  });

  const wrapper = mount(Harness);
  return { interactionApi, wrapper };
}

describe('useCrossSectionDepthInteraction', () => {
  it('keeps depth locked on mouse leave but unlocks on second click', () => {
    const visible = ref(true);
    const currentDepth = ref(null);
    const setDepth = vi.fn((depth) => {
      currentDepth.value = depth;
    });
    const resolveDepthFromClient = vi.fn((_clientX, clientY) => clientY);

    const { interactionApi, wrapper } = createInteractionHarness({
      visible,
      currentDepth,
      resolveDepthFromClient,
      setDepth,
      unlockOnMouseLeave: false
    });

    expect(interactionApi.depthLocked.value).toBe(false);
    expect(interactionApi.lockDepthFromEvent({ clientX: 24, clientY: 1250 })).toBe(true);
    expect(interactionApi.depthLocked.value).toBe(true);
    expect(setDepth).toHaveBeenCalledTimes(1);
    expect(currentDepth.value).toBe(1250);

    interactionApi.handleMouseLeave();
    expect(interactionApi.depthLocked.value).toBe(true);

    interactionApi.lockDepthFromEvent({ clientX: 28, clientY: 1600 });
    expect(interactionApi.depthLocked.value).toBe(false);
    expect(setDepth).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('resets depth lock when cross-section visibility is turned off', async () => {
    const visible = ref(true);
    const currentDepth = ref(null);
    const setDepth = vi.fn((depth) => {
      currentDepth.value = depth;
    });
    const resolveDepthFromClient = vi.fn((_clientX, clientY) => clientY);

    const { interactionApi, wrapper } = createInteractionHarness({
      visible,
      currentDepth,
      resolveDepthFromClient,
      setDepth,
      unlockOnMouseLeave: false
    });

    interactionApi.lockDepthFromEvent({ clientX: 10, clientY: 900 });
    expect(interactionApi.depthLocked.value).toBe(true);

    visible.value = false;
    await nextTick();

    expect(interactionApi.depthLocked.value).toBe(false);
    wrapper.unmount();
  });
});
