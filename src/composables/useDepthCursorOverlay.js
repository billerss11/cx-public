import { onBeforeUnmount, ref, unref, watch } from 'vue';
import {
  createClientPointerResolver,
  toFiniteNumber
} from '@/composables/useClientPointerResolver.js';

const DEFAULT_POINTER_EPSILON = 0.25;

export function useDepthCursorOverlay(options = {}) {
  const visible = ref(false);
  const x = ref(0);
  const y = ref(0);
  const depth = ref(null);
  const lastClientX = ref(null);
  const lastClientY = ref(null);
  const pointerEpsilon = Number.isFinite(Number(options.pointerEpsilon))
    ? Math.max(0, Number(options.pointerEpsilon))
    : DEFAULT_POINTER_EPSILON;
  const pointerResolver = createClientPointerResolver({
    boundsRefreshIntervalMs: options.boundsRefreshIntervalMs
  });

  let animationFrameId = null;
  let pendingPointer = null;

  function cancelScheduledUpdate() {
    if (animationFrameId === null) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  function hide() {
    cancelScheduledUpdate();
    pendingPointer = null;
    visible.value = false;
    depth.value = null;
    lastClientX.value = null;
    lastClientY.value = null;
  }

  function updateFromClientPointer(clientX, clientY) {
    const container = unref(options.containerRef);
    if (!pointerResolver.syncFromContainer(container)) {
      hide();
      return;
    }

    const svgWidth = pointerResolver.resolveSvgWidth(unref(options.svgWidth));
    const svgHeight = pointerResolver.resolveSvgHeight(unref(options.svgHeight));
    const pointer = pointerResolver.resolveFromClient(clientX, clientY, svgWidth, svgHeight);
    if (!pointer) {
      hide();
      return;
    }

    const restrictXToPlot = options.restrictXToPlot !== false;
    const left = toFiniteNumber(unref(options.plotLeftX), 0);
    const right = toFiniteNumber(unref(options.plotRightX), svgWidth);
    const top = toFiniteNumber(unref(options.plotTopY), 0);
    const bottom = toFiniteNumber(unref(options.plotBottomY), svgHeight);
    if (pointer.y < top || pointer.y > bottom) {
      hide();
      return;
    }
    if (restrictXToPlot && (pointer.x < left || pointer.x > right)) {
      hide();
      return;
    }

    const resolveDepth = options.resolveDepth;
    const resolveDepthAtPointer = options.resolveDepthAtPointer;
    const resolveDepthAtY = options.resolveDepthAtY;
    const nextDepth = Number(
      typeof resolveDepth === 'function'
        ? resolveDepth(pointer)
        : (typeof resolveDepthAtPointer === 'function'
            ? resolveDepthAtPointer(pointer)
            : (typeof resolveDepthAtY === 'function'
                ? resolveDepthAtY(pointer.y)
                : NaN))
    );
    if (!Number.isFinite(nextDepth)) {
      hide();
      return;
    }

    const hasSignificantMove = (
      Math.abs(x.value - pointer.x) > pointerEpsilon ||
      Math.abs(y.value - pointer.y) > pointerEpsilon
    );
    const hasDepthChange = (
      !Number.isFinite(depth.value) ||
      Math.abs(Number(depth.value) - nextDepth) > pointerEpsilon
    );
    if (visible.value && !hasSignificantMove && !hasDepthChange) return;

    x.value = pointer.x;
    y.value = pointer.y;
    depth.value = nextDepth;
    visible.value = true;
  }

  function flushPointerUpdate() {
    animationFrameId = null;
    if (unref(options.enabled) !== true) {
      pendingPointer = null;
      hide();
      return;
    }
    if (!pendingPointer) return;

    const pointer = pendingPointer;
    pendingPointer = null;
    updateFromClientPointer(pointer.clientX, pointer.clientY);

    if (pendingPointer && animationFrameId === null) {
      animationFrameId = requestAnimationFrame(flushPointerUpdate);
    }
  }

  function queuePointerUpdate(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    pendingPointer = { clientX, clientY };
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(flushPointerUpdate);
  }

  function handleMouseMove(event) {
    if (unref(options.enabled) !== true) {
      hide();
      return;
    }

    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      hide();
      return;
    }

    pointerResolver.syncFromContainer(unref(options.containerRef));
    lastClientX.value = clientX;
    lastClientY.value = clientY;
    queuePointerUpdate(clientX, clientY);
  }

  function handleScroll() {
    if (unref(options.enabled) !== true) {
      hide();
      return;
    }

    if (!Number.isFinite(lastClientX.value) || !Number.isFinite(lastClientY.value)) return;
    pointerResolver.syncFromContainer(unref(options.containerRef), { skipRect: true });
    queuePointerUpdate(lastClientX.value, lastClientY.value);
  }

  watch(
    [
      () => unref(options.containerRef),
      () => unref(options.svgWidth),
      () => unref(options.svgHeight)
    ],
    () => {
      pointerResolver.invalidateRect();
      pointerResolver.syncFromContainer(unref(options.containerRef), { forceRect: true });
    },
    { immediate: true }
  );

  watch(() => unref(options.enabled), (enabled) => {
    if (enabled !== true) {
      hide();
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    pointerResolver.invalidateRect();
    cancelScheduledUpdate();
  });

  return {
    visible,
    x,
    y,
    depth,
    hide,
    handleMouseMove,
    handleScroll
  };
}
