import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useCameraPanSession } from '@/composables/useCameraPanSession.js';

function createPointerEvent(overrides = {}) {
  return {
    button: 0,
    pointerId: 7,
    clientX: 120,
    clientY: 240,
    preventDefault: vi.fn(),
    currentTarget: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn()
    },
    ...overrides
  };
}

function mountHarness(options = {}) {
  const enabled = ref(options.enabled ?? true);
  const panBy = vi.fn();
  let session = null;

  const Harness = defineComponent({
    name: 'CameraPanSessionHarness',
    setup() {
      session = useCameraPanSession({
        enabled,
        panBy
      });
      return () => h('div');
    }
  });

  const wrapper = mount(Harness);
  return {
    wrapper,
    session,
    panBy,
    enabled
  };
}

describe('useCameraPanSession', () => {
  it('keeps a blank-space pointer session clickable when camera mode is enabled but no drag occurs', () => {
    const { wrapper, session, panBy } = mountHarness();
    const pointerDownEvent = createPointerEvent();
    const pointerUpEvent = createPointerEvent({
      currentTarget: pointerDownEvent.currentTarget
    });

    expect(session.startPan(pointerDownEvent)).toBe(true);
    expect(session.isPanActive.value).toBe(true);

    const result = session.finishPan(pointerUpEvent);

    expect(result).toEqual({
      handled: true,
      shouldProcessClick: true
    });
    expect(panBy).not.toHaveBeenCalled();
    expect(pointerDownEvent.currentTarget.setPointerCapture).toHaveBeenCalledWith(7);
    expect(pointerDownEvent.currentTarget.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(session.isPanActive.value).toBe(false);

    wrapper.unmount();
  });

  it('marks the session as a drag after movement and suppresses click recovery on pointerup', () => {
    const { wrapper, session, panBy } = mountHarness();
    const pointerTarget = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn()
    };

    expect(session.startPan(createPointerEvent({ currentTarget: pointerTarget }))).toBe(true);

    session.updatePan(createPointerEvent({
      clientX: 138,
      clientY: 268,
      currentTarget: pointerTarget
    }));

    const result = session.finishPan(createPointerEvent({
      clientX: 138,
      clientY: 268,
      currentTarget: pointerTarget
    }));

    expect(panBy).toHaveBeenCalledWith(18, 28);
    expect(result).toEqual({
      handled: true,
      shouldProcessClick: false
    });

    wrapper.unmount();
  });
});
