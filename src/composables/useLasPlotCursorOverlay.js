import { onBeforeUnmount, ref, unref, watch } from 'vue';
import { resolveCurveValueAtDepth } from '@/utils/lasCursorLookup.js';

const DEFAULT_POINTER_EPSILON = 0.25;

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toLocalPointer(container, clientX, clientY) {
  if (!container || typeof container.getBoundingClientRect !== 'function') return null;
  const rect = container.getBoundingClientRect();
  if (!rect) return null;

  const localX = Number(clientX) - Number(rect.left);
  const localY = Number(clientY) - Number(rect.top);
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) return null;
  return { x: localX, y: localY };
}

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function resolveDepthFromPointerY(pointerY, model) {
  const top = Number(model?.plotArea?.top);
  const bottom = Number(model?.plotArea?.bottom);
  const minDepth = Number(model?.depthRange?.minDepth);
  const maxDepth = Number(model?.depthRange?.maxDepth);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
  if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth)) return null;
  if (Math.abs(bottom - top) <= Number.EPSILON) return minDepth;

  const ratio = (pointerY - top) / (bottom - top);
  const safeRatio = clamp(ratio, 0, 1);
  return minDepth + ((maxDepth - minDepth) * safeRatio);
}

function resolveSampledRowsAtDepth(model, depth) {
  const tracks = Array.isArray(model?.tracks) ? model.tracks : [];
  return tracks.map((track) => {
    const sampled = resolveCurveValueAtDepth(track?.points ?? [], depth, { allowInterpolation: true });
    return {
      mnemonic: String(track?.mnemonic ?? ''),
      unit: String(track?.unit ?? ''),
      value: sampled.value,
      status: sampled.status,
      source: 'sampled'
    };
  });
}

function toExactRowsByMnemonic(payload) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const map = new Map();

  rows.forEach((row) => {
    const mnemonic = String(row?.mnemonic ?? '').trim();
    if (!mnemonic) return;
    const value = toFiniteNumber(row?.value);
    map.set(mnemonic, {
      value,
      status: String(row?.status ?? 'no_data'),
      source: 'exact'
    });
  });

  return map;
}

function mergeExactRows(sampledRows, exactRowsByMnemonic) {
  if (!(exactRowsByMnemonic instanceof Map) || exactRowsByMnemonic.size === 0) return sampledRows;
  return sampledRows.map((row) => {
    const exact = exactRowsByMnemonic.get(row.mnemonic);
    if (!exact) return row;
    return {
      ...row,
      value: exact.value,
      status: exact.status,
      source: 'exact'
    };
  });
}

export function useLasPlotCursorOverlay(options = {}) {
  const visible = ref(false);
  const locked = ref(false);
  const x = ref(0);
  const y = ref(0);
  const depth = ref(null);
  const rows = ref([]);
  const exactPending = ref(false);

  const pointerEpsilon = Number.isFinite(Number(options.pointerEpsilon))
    ? Math.max(0, Number(options.pointerEpsilon))
    : DEFAULT_POINTER_EPSILON;

  let animationFrameId = null;
  let pendingPointer = null;
  let requestToken = 0;
  let exactRowsByMnemonic = new Map();
  let lastClientX = null;
  let lastClientY = null;

  function cancelScheduledUpdate() {
    if (animationFrameId === null) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  function clearExactValues() {
    exactRowsByMnemonic = new Map();
    exactPending.value = false;
  }

  function hide(force = false) {
    if (locked.value && !force) return;
    cancelScheduledUpdate();
    pendingPointer = null;
    visible.value = false;
    depth.value = null;
    rows.value = [];
    lastClientX = null;
    lastClientY = null;
    clearExactValues();
  }

  function applyCursorAtLocalPointer(pointer) {
    const model = unref(options.plotModelRef);
    const container = unref(options.containerRef);
    if (!model || !container) {
      hide();
      return;
    }

    const left = Number(model?.plotArea?.left);
    const right = Number(model?.plotArea?.right);
    const top = Number(model?.plotArea?.top);
    const bottom = Number(model?.plotArea?.bottom);
    if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) {
      hide();
      return;
    }

    if (pointer.y < top || pointer.y > bottom) {
      hide();
      return;
    }

    if (pointer.x < left || pointer.x > right) {
      hide();
      return;
    }

    const nextDepth = resolveDepthFromPointerY(pointer.y, model);
    if (!Number.isFinite(nextDepth)) {
      hide();
      return;
    }

    const hasSignificantMove = (
      Math.abs(x.value - pointer.x) > pointerEpsilon ||
      Math.abs(y.value - pointer.y) > pointerEpsilon
    );
    const hasDepthChange = !Number.isFinite(depth.value) || Math.abs(Number(depth.value) - nextDepth) > pointerEpsilon;
    if (visible.value && !hasSignificantMove && !hasDepthChange) return;

    x.value = pointer.x;
    y.value = pointer.y;
    depth.value = nextDepth;

    const sampledRows = resolveSampledRowsAtDepth(model, nextDepth);
    rows.value = mergeExactRows(sampledRows, exactRowsByMnemonic);
    visible.value = true;
  }

  function updateFromClientPointer(clientX, clientY) {
    const container = unref(options.containerRef);
    const pointer = toLocalPointer(container, clientX, clientY);
    if (!pointer) {
      hide();
      return;
    }

    applyCursorAtLocalPointer(pointer);
  }

  function flushPointerUpdate() {
    animationFrameId = null;

    if (locked.value) {
      pendingPointer = null;
      return;
    }

    if (unref(options.enabled) === false) {
      pendingPointer = null;
      hide(true);
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

  async function resolveExactValuesAtDepth() {
    const resolver = options.resolveExactValuesAtDepth;
    if (typeof resolver !== 'function') return;
    if (!Number.isFinite(Number(depth.value))) return;

    const model = unref(options.plotModelRef);
    const curveNames = rows.value.map((row) => row.mnemonic).filter((name) => name.length > 0);
    if (curveNames.length === 0) return;

    const token = ++requestToken;
    exactPending.value = true;
    try {
      const result = await resolver({
        depth: Number(depth.value),
        curveNames,
        indexCurve: model?.depthRange?.indexCurve ?? null
      });
      if (!locked.value || token !== requestToken) return;
      exactRowsByMnemonic = toExactRowsByMnemonic(result);
      rows.value = mergeExactRows(resolveSampledRowsAtDepth(model, Number(depth.value)), exactRowsByMnemonic);
    } catch {
      // Keep sampled rows if exact resolve fails.
    } finally {
      if (token === requestToken) {
        exactPending.value = false;
      }
    }
  }

  function handlePointerMove(event) {
    if (locked.value) return;
    if (unref(options.enabled) === false) {
      hide(true);
      return;
    }

    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      hide();
      return;
    }

    lastClientX = clientX;
    lastClientY = clientY;
    queuePointerUpdate(clientX, clientY);
  }

  function handlePointerLeave() {
    if (locked.value) return;
    hide();
  }

  function unlock() {
    locked.value = false;
    requestToken += 1;
    clearExactValues();
  }

  async function handlePointerDown(event) {
    const button = Number(event?.button);
    if (button !== 0) return;
    if (visible.value !== true) {
      const clientX = Number(event?.clientX);
      const clientY = Number(event?.clientY);
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        updateFromClientPointer(clientX, clientY);
      }
    }
    if (visible.value !== true) return;

    if (locked.value) {
      unlock();
      if (Number.isFinite(lastClientX) && Number.isFinite(lastClientY)) {
        queuePointerUpdate(lastClientX, lastClientY);
      }
      return;
    }

    locked.value = true;
    cancelScheduledUpdate();
    pendingPointer = null;
    await resolveExactValuesAtDepth();
  }

  watch(() => unref(options.enabled), (enabled) => {
    if (enabled === false) {
      unlock();
      hide(true);
    }
  }, { immediate: true });

  watch(() => unref(options.plotModelRef), (model) => {
    if (!model) {
      unlock();
      hide(true);
      return;
    }
    if (locked.value && Number.isFinite(Number(depth.value))) {
      rows.value = mergeExactRows(
        resolveSampledRowsAtDepth(model, Number(depth.value)),
        exactRowsByMnemonic
      );
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    unlock();
    hide(true);
    cancelScheduledUpdate();
  });

  return {
    visible,
    locked,
    x,
    y,
    depth,
    rows,
    exactPending,
    hide,
    unlock,
    handlePointerMove,
    handlePointerLeave,
    handlePointerDown
  };
}

export default useLasPlotCursorOverlay;
