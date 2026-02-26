import { clamp } from '@/utils/general.js';

const DEFAULT_BOUNDS_REFRESH_INTERVAL_MS = 120;

export function toFiniteNumber(value, fallback = NaN) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function toSafeSvgSize(value, fallback = 1) {
  const numeric = toFiniteNumber(value, fallback);
  return Math.max(1, numeric);
}

function resolveNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function createClientPointerResolver(options = {}) {
  const boundsRefreshIntervalMs = Number.isFinite(Number(options.boundsRefreshIntervalMs))
    ? Math.max(16, Number(options.boundsRefreshIntervalMs))
    : DEFAULT_BOUNDS_REFRESH_INTERVAL_MS;

  const snapshot = {
    hasRect: false,
    rectLeft: 0,
    rectTop: 0,
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 1,
    clientHeight: 1,
    scrollWidth: 1,
    scrollHeight: 1
  };
  let lastRectUpdateAt = 0;

  function syncFromContainer(container, settings = {}) {
    if (!container) {
      snapshot.hasRect = false;
      return false;
    }

    snapshot.scrollLeft = toFiniteNumber(container.scrollLeft, 0);
    snapshot.scrollTop = toFiniteNumber(container.scrollTop, 0);
    snapshot.clientWidth = toSafeSvgSize(container.clientWidth, snapshot.clientWidth);
    snapshot.clientHeight = toSafeSvgSize(container.clientHeight, snapshot.clientHeight);
    snapshot.scrollWidth = toSafeSvgSize(container.scrollWidth, snapshot.clientWidth);
    snapshot.scrollHeight = toSafeSvgSize(container.scrollHeight, snapshot.clientHeight);

    const skipRect = settings.skipRect === true;
    const forceRect = settings.forceRect === true;
    const now = resolveNow();
    const shouldReadRect = (
      !skipRect &&
      (forceRect || !snapshot.hasRect || ((now - lastRectUpdateAt) >= boundsRefreshIntervalMs))
    );

    if (shouldReadRect) {
      const rect = container.getBoundingClientRect();
      snapshot.rectLeft = toFiniteNumber(rect?.left, snapshot.rectLeft);
      snapshot.rectTop = toFiniteNumber(rect?.top, snapshot.rectTop);
      snapshot.hasRect = true;
      lastRectUpdateAt = now;
    }

    return snapshot.hasRect;
  }

  function invalidateRect() {
    snapshot.hasRect = false;
  }

  function resolveSvgWidth(value) {
    return toSafeSvgSize(value, snapshot.scrollWidth || snapshot.clientWidth || 1);
  }

  function resolveSvgHeight(value) {
    return toSafeSvgSize(value, snapshot.scrollHeight || snapshot.clientHeight || 1);
  }

  function resolveFromClient(clientX, clientY, svgWidth, svgHeight) {
    if (!snapshot.hasRect) return null;

    const safeClientX = toFiniteNumber(clientX);
    const safeClientY = toFiniteNumber(clientY);
    if (!Number.isFinite(safeClientX) || !Number.isFinite(safeClientY)) return null;

    const width = resolveSvgWidth(svgWidth);
    const height = resolveSvgHeight(svgHeight);
    const x = clamp(safeClientX - snapshot.rectLeft + snapshot.scrollLeft, 0, Math.max(0, width));
    const y = clamp(safeClientY - snapshot.rectTop + snapshot.scrollTop, 0, Math.max(0, height));
    return { x, y };
  }

  return {
    syncFromContainer,
    resolveFromClient,
    resolveSvgWidth,
    resolveSvgHeight,
    invalidateRect
  };
}

