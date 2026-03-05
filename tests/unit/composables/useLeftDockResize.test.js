import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';
import { useLeftDockResize } from '@/composables/useLeftDockResize.js';

function createPointerEvent(overrides = {}) {
  return {
    button: 0,
    preventDefault: vi.fn(),
    ...overrides
  };
}

describe('useLeftDockResize', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updates left dock width on pointer move', () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const workspaceStore = useWorkspaceStore();
    workspaceStore.setLeftDockVisibility(true);

    const containerRef = {
      value: {
        getBoundingClientRect: () => ({ left: 120 })
      }
    };

    const listeners = new Map();
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      listeners.set(type, handler);
    });
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));

    let composableApi = null;
    const Harness = defineComponent({
      name: 'LeftDockResizeHarness',
      setup() {
        composableApi = useLeftDockResize(containerRef);
        return () => h('div');
      }
    });
    const wrapper = mount(Harness, {
      global: {
        plugins: [pinia]
      }
    });

    composableApi.startLeftDockResize(createPointerEvent({ clientX: 300 }));

    const pointerMove = listeners.get('pointermove');
    expect(typeof pointerMove).toBe('function');

    pointerMove({ clientX: 420 });
    expect(workspaceStore.leftDockWidth).toBe(300);

    const pointerUp = listeners.get('pointerup');
    expect(typeof pointerUp).toBe('function');
    pointerUp();

    expect(addEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));

    wrapper.unmount();
  });
});
