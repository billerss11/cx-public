import { ref, toValue } from 'vue';

function resolveCameraPanPoint(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  return { x: clientX, y: clientY };
}

function resolvePointerId(event) {
  const pointerId = Number(event?.pointerId);
  return Number.isFinite(pointerId) ? pointerId : null;
}

export function useCameraPanSession(options = {}) {
  const pointerId = ref(null);
  const lastClientPoint = ref(null);
  const isPanActive = ref(false);
  const hasMoved = ref(false);

  function resetPan() {
    pointerId.value = null;
    lastClientPoint.value = null;
    isPanActive.value = false;
    hasMoved.value = false;
  }

  function matchesPointer(event) {
    const eventPointerId = resolvePointerId(event);
    if (pointerId.value === null || eventPointerId === null) return true;
    return eventPointerId === pointerId.value;
  }

  function startPan(event) {
    if (toValue(options.enabled) !== true) return false;
    if (Number(event?.button) !== 0) return false;

    const point = resolveCameraPanPoint(event);
    if (!point) return false;

    pointerId.value = resolvePointerId(event);
    lastClientPoint.value = point;
    isPanActive.value = true;
    hasMoved.value = false;

    if (pointerId.value !== null && typeof event?.currentTarget?.setPointerCapture === 'function') {
      try {
        event.currentTarget.setPointerCapture(pointerId.value);
      } catch {
        resetPan();
        return false;
      }
    }

    return true;
  }

  function updatePan(event) {
    if (!isPanActive.value || toValue(options.enabled) !== true) return false;
    if (!matchesPointer(event)) return false;

    const nextPoint = resolveCameraPanPoint(event);
    if (!nextPoint) return false;

    const previousPoint = lastClientPoint.value;
    lastClientPoint.value = nextPoint;
    if (!previousPoint) return false;

    const deltaX = nextPoint.x - previousPoint.x;
    const deltaY = nextPoint.y - previousPoint.y;
    if (deltaX === 0 && deltaY === 0) return false;

    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }

    hasMoved.value = true;
    if (typeof options.panBy === 'function') {
      options.panBy(deltaX, deltaY);
    }
    return true;
  }

  function finishPan(event) {
    updatePan(event);
    if (!matchesPointer(event)) {
      return { handled: false, shouldProcessClick: false };
    }

    if (pointerId.value !== null && typeof event?.currentTarget?.releasePointerCapture === 'function') {
      try {
        event.currentTarget.releasePointerCapture(pointerId.value);
      } catch {
        // Ignore release errors during cancellation and teardown.
      }
    }

    const handled = isPanActive.value;
    const shouldProcessClick = handled && hasMoved.value !== true;
    resetPan();
    return { handled, shouldProcessClick };
  }

  return {
    isPanActive,
    startPan,
    updatePan,
    finishPan,
    resetPan
  };
}
