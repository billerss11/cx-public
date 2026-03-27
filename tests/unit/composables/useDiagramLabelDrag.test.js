import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useDiagramLabelDrag } from '@/composables/useDiagramLabelDrag.js';

let controller = null;

const Harness = defineComponent({
  name: 'UseDiagramLabelDragHarness',
  setup() {
    controller = useDiagramLabelDrag({
      enabled: true,
      resolvePointer: (event) => event?.pointer ?? null,
      commitDrag: vi.fn()
    });
    return () => h('div');
  }
});

describe('useDiagramLabelDrag', () => {
  it('keeps drag preview local until release and commits once on finish', async () => {
    const wrapper = mount(Harness);
    const commitDrag = controller.commitDrag;
    const buildPatch = vi.fn(() => ({ labelXPos: 0.4, manualLabelDepth: 1200 }));

    controller.startDrag({
      previewId: 'pipe-label-1',
      buildPatch
    }, {
      pointer: { x: 100, y: 200 }
    });

    expect(controller.activePreviewId.value).toBe('pipe-label-1');
    expect(controller.previewOffset.value).toEqual({ x: 0, y: 0 });
    expect(commitDrag).not.toHaveBeenCalled();

    controller.updateDrag({
      pointer: { x: 125, y: 235 }
    });

    expect(controller.previewOffset.value).toEqual({ x: 25, y: 35 });
    expect(commitDrag).not.toHaveBeenCalled();

    controller.finishDrag({
      pointer: { x: 125, y: 235 }
    });

    expect(buildPatch).toHaveBeenCalled();
    expect(commitDrag).toHaveBeenCalledWith({ labelXPos: 0.4, manualLabelDepth: 1200 });
    expect(controller.activePreviewId.value).toBeNull();
    expect(controller.previewOffset.value).toEqual({ x: 0, y: 0 });

    wrapper.unmount();
  });

  it('does not consume a plain click when the pointer never meaningfully moved', () => {
    const wrapper = mount(Harness);
    const commitDrag = controller.commitDrag;
    const buildPatch = vi.fn(() => ({ labelXPos: 0.55 }));

    controller.startDrag({
      previewId: 'pipe-label-click',
      buildPatch
    }, {
      pointer: { x: 140, y: 180 }
    });

    controller.finishDrag({
      pointer: { x: 140, y: 180 }
    });

    expect(buildPatch).not.toHaveBeenCalled();
    expect(commitDrag).not.toHaveBeenCalled();
    expect(controller.consumeFinishedDragClick()).toBe(false);

    wrapper.unmount();
  });

  it('suppresses the immediate background click after finishing a drag and expires the guard quickly', () => {
    vi.useFakeTimers();
    const wrapper = mount(Harness);

    controller.startDrag({
      previewId: 'pipe-label-2',
      buildPatch: () => ({ labelXPos: 0.6 })
    }, {
      pointer: { x: 80, y: 140 }
    });

    controller.finishDrag({
      pointer: { x: 92, y: 152 }
    });

    expect(controller.consumeFinishedDragClick()).toBe(true);
    expect(controller.consumeFinishedDragClick()).toBe(false);

    controller.startDrag({
      previewId: 'pipe-label-3',
      buildPatch: () => ({ labelXPos: 0.7 })
    }, {
      pointer: { x: 110, y: 160 }
    });

    controller.finishDrag({
      pointer: { x: 120, y: 172 }
    });

    vi.runAllTimers();

    expect(controller.consumeFinishedDragClick()).toBe(false);

    wrapper.unmount();
    vi.useRealTimers();
  });
});
