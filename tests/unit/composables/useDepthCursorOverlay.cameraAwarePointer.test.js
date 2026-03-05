import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useDepthCursorOverlay } from '@/composables/useDepthCursorOverlay.js';

function createContainer() {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 200 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 200 });
  Object.defineProperty(container, 'scrollWidth', { configurable: true, value: 200 });
  Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 200 });
  Object.defineProperty(container, 'scrollLeft', { configurable: true, writable: true, value: 0 });
  Object.defineProperty(container, 'scrollTop', { configurable: true, writable: true, value: 0 });
  container.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 200,
    bottom: 200,
    width: 200,
    height: 200
  });
  return container;
}

async function flushRafQueue() {
  vi.runAllTimers();
  await Promise.resolve();
}

describe('useDepthCursorOverlay camera-aware pointer resolution', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses resolvePointerFromClient override for overlay position and depth mapping', async () => {
    vi.useFakeTimers();
    const container = createContainer();
    const Harness = defineComponent({
      setup() {
        const overlay = useDepthCursorOverlay({
          enabled: ref(true),
          containerRef: ref(container),
          svgWidth: ref(200),
          svgHeight: ref(200),
          plotLeftX: ref(0),
          plotRightX: ref(200),
          plotTopY: ref(0),
          plotBottomY: ref(200),
          restrictXToPlot: false,
          resolveDepth: (pointer) => pointer.y,
          resolvePointerFromClient: ({ localPointer }) => ({
            x: localPointer.x + 11,
            y: localPointer.y + 17
          })
        });
        return { overlay };
      },
      render() {
        return h('div');
      }
    });
    const wrapper = mount(Harness);

    wrapper.vm.overlay.handleMouseMove({ clientX: 40, clientY: 50 });
    await flushRafQueue();

    expect(wrapper.vm.overlay.visible.value).toBe(true);
    expect(wrapper.vm.overlay.x.value).toBe(51);
    expect(wrapper.vm.overlay.y.value).toBe(67);
    expect(wrapper.vm.overlay.depth.value).toBe(67);

    wrapper.unmount();
  });

  it('falls back to local client-resolved pointer when override is not provided', async () => {
    vi.useFakeTimers();
    const container = createContainer();
    const Harness = defineComponent({
      setup() {
        const overlay = useDepthCursorOverlay({
          enabled: ref(true),
          containerRef: ref(container),
          svgWidth: ref(200),
          svgHeight: ref(200),
          plotLeftX: ref(0),
          plotRightX: ref(200),
          plotTopY: ref(0),
          plotBottomY: ref(200),
          restrictXToPlot: false,
          resolveDepth: (pointer) => pointer.y
        });
        return { overlay };
      },
      render() {
        return h('div');
      }
    });
    const wrapper = mount(Harness);

    wrapper.vm.overlay.handleMouseMove({ clientX: 40, clientY: 50 });
    await flushRafQueue();

    expect(wrapper.vm.overlay.visible.value).toBe(true);
    expect(wrapper.vm.overlay.x.value).toBe(40);
    expect(wrapper.vm.overlay.y.value).toBe(50);
    expect(wrapper.vm.overlay.depth.value).toBe(50);

    wrapper.unmount();
  });
});
