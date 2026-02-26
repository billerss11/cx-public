import { onBeforeUnmount, ref, unref, watch } from 'vue';

const DEFAULT_HOVER_INTERVAL_MS = 33;
const DEFAULT_DEPTH_EPSILON = 1e-3;

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveClientPointer(event) {
  const x = Number(event?.clientX);
  const y = Number(event?.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function resolveNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function useCrossSectionDepthInteraction(options = {}) {
  const depthLocked = ref(false);
  const hoverIntervalMs = Number.isFinite(Number(options.hoverIntervalMs))
    ? Math.max(0, Number(options.hoverIntervalMs))
    : DEFAULT_HOVER_INTERVAL_MS;
  const depthEpsilon = Number.isFinite(Number(options.depthEpsilon))
    ? Math.max(0, Number(options.depthEpsilon))
    : DEFAULT_DEPTH_EPSILON;

  let animationFrameId = null;
  let pendingPointer = null;
  let lastCommittedDepth = null;
  let lastHoverCommitTime = 0;

  function cancelHoverFrame() {
    if (animationFrameId === null) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  function commitDepth(nextDepth) {
    const depth = toFiniteNumber(nextDepth);
    if (!Number.isFinite(depth)) return false;
    if (Number.isFinite(lastCommittedDepth) && Math.abs(lastCommittedDepth - depth) <= depthEpsilon) {
      return false;
    }

    if (typeof options.setDepth === 'function') {
      options.setDepth(depth);
    }
    lastCommittedDepth = depth;
    return true;
  }

  function resolveDepthFromPointer(pointer) {
    if (!pointer || typeof options.resolveDepthFromClient !== 'function') return null;
    return toFiniteNumber(options.resolveDepthFromClient(pointer.x, pointer.y));
  }

  function flushHoverDepth() {
    animationFrameId = null;
    if (unref(options.visible) !== true || depthLocked.value) {
      pendingPointer = null;
      return;
    }
    if (!pendingPointer) return;

    const now = resolveNow();
    if ((now - lastHoverCommitTime) < hoverIntervalMs) {
      animationFrameId = requestAnimationFrame(flushHoverDepth);
      return;
    }

    const pointer = pendingPointer;
    pendingPointer = null;
    const nextDepth = resolveDepthFromPointer(pointer);
    if (commitDepth(nextDepth)) {
      lastHoverCommitTime = now;
    }

    if (pendingPointer && animationFrameId === null) {
      animationFrameId = requestAnimationFrame(flushHoverDepth);
    }
  }

  function handleHover(event) {
    if (unref(options.visible) !== true || depthLocked.value) return;
    const pointer = resolveClientPointer(event);
    if (!pointer) return;
    pendingPointer = pointer;
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(flushHoverDepth);
  }

  function lockDepthFromEvent(event) {
    if (unref(options.visible) !== true) return false;
    const pointer = resolveClientPointer(event);
    if (!pointer) return false;
    cancelHoverFrame();
    pendingPointer = null;
    const nextDepth = resolveDepthFromPointer(pointer);
    if (!Number.isFinite(nextDepth)) return false;
    commitDepth(nextDepth);
    depthLocked.value = true;
    return true;
  }

  function unlockDepth() {
    depthLocked.value = false;
  }

  function handleMouseLeave() {
    cancelHoverFrame();
    pendingPointer = null;
    if (options.unlockOnMouseLeave !== false) {
      unlockDepth();
    }
  }

  watch(() => unref(options.visible), (visible) => {
    if (visible === true) return;
    handleMouseLeave();
    lastCommittedDepth = null;
  }, { immediate: true });

  watch(() => unref(options.currentDepth), (depth) => {
    const numeric = toFiniteNumber(depth);
    lastCommittedDepth = Number.isFinite(numeric) ? numeric : null;
  }, { immediate: true });

  onBeforeUnmount(() => {
    handleMouseLeave();
  });

  return {
    depthLocked,
    handleHover,
    lockDepthFromEvent,
    unlockDepth,
    handleMouseLeave
  };
}

export default useCrossSectionDepthInteraction;
