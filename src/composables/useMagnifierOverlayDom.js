import { onBeforeUnmount, unref, watch } from 'vue';
import { clamp } from '@/utils/general.js';
import {
  createClientPointerResolver,
  toFiniteNumber
} from '@/composables/useClientPointerResolver.js';

const DEFAULT_MOVEMENT_EPSILON = 0.5;

function resolveFiniteOptionNumber(source, fallback, { min = Number.NEGATIVE_INFINITY } = {}) {
  const numeric = Number(unref(source));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, numeric);
}

function setDisplay(element, visible) {
  if (!element) return;
  element.style.display = visible ? '' : 'none';
}

function setAttributeIfChanged(element, name, value) {
  if (!element) return;
  const nextValue = String(value);
  if (element.getAttribute(name) === nextValue) return;
  element.setAttribute(name, nextValue);
}

function setRectAttributes(rect, x, y, width, height) {
  if (!rect) return;
  setAttributeIfChanged(rect, 'x', x);
  setAttributeIfChanged(rect, 'y', y);
  setAttributeIfChanged(rect, 'width', width);
  setAttributeIfChanged(rect, 'height', height);
}

function resolveMagnifierWindowPosition(pointerX, pointerY, svgWidth, svgHeight, options) {
  const {
    windowWidth,
    windowHeight,
    margin,
    pointerGap,
    edgePadding
  } = options;

  const maxX = Math.max(edgePadding, svgWidth - windowWidth - edgePadding);
  const maxY = Math.max(edgePadding, svgHeight - windowHeight - edgePadding);

  let x = pointerX + pointerGap;
  if ((x + windowWidth) > (svgWidth - edgePadding)) {
    x = pointerX - windowWidth - pointerGap;
  }
  if (x < edgePadding) {
    x = clamp(pointerX - (windowWidth / 2), edgePadding, maxX);
  }

  const y = clamp(pointerY - (windowHeight / 2), edgePadding, maxY);
  const fallbackX = Math.max(edgePadding, svgWidth - windowWidth - margin);
  const fallbackY = margin;

  return {
    x: Number.isFinite(x) ? x : fallbackX,
    y: Number.isFinite(y) ? y : fallbackY
  };
}

export function useMagnifierOverlayDom(options = {}) {
  const defaultWindowWidth = resolveFiniteOptionNumber(options.windowWidth, 240, { min: 1 });
  const defaultWindowHeight = resolveFiniteOptionNumber(options.windowHeight, 170, { min: 1 });
  const defaultScale = resolveFiniteOptionNumber(options.scale, 2.4, { min: 0.1 });
  const defaultMargin = resolveFiniteOptionNumber(options.margin, 14, { min: 0 });
  const defaultPointerGap = resolveFiniteOptionNumber(options.pointerGap, 20, { min: 0 });
  const defaultEdgePadding = resolveFiniteOptionNumber(options.edgePadding, 8, { min: 0 });
  const movementEpsilon = Number.isFinite(Number(options.movementEpsilon))
    ? Math.max(0, Number(options.movementEpsilon))
    : DEFAULT_MOVEMENT_EPSILON;
  const pointerResolver = createClientPointerResolver({
    boundsRefreshIntervalMs: options.boundsRefreshIntervalMs
  });

  let animationFrameId = null;
  let pendingClient = null;
  let lastClient = null;
  let pointerX = NaN;
  let pointerY = NaN;
  let pointerVisible = false;

  function hideOverlay() {
    const overlayGroup = unref(options.overlayGroupRef);
    const frameGroup = unref(options.frameGroupRef);
    setDisplay(overlayGroup, false);
    setDisplay(frameGroup, false);
  }

  function commitPointerFromClient(client) {
    const container = unref(options.containerRef);
    if (!pointerResolver.syncFromContainer(container)) {
      pointerVisible = false;
      return;
    }

    const localPointer = pointerResolver.resolveFromClient(
      toFiniteNumber(client?.x),
      toFiniteNumber(client?.y),
      unref(options.svgWidth),
      unref(options.svgHeight)
    );
    if (!localPointer) {
      pointerVisible = false;
      return;
    }

    const hasSignificantMove = (
      Math.abs(pointerX - localPointer.x) > movementEpsilon ||
      Math.abs(pointerY - localPointer.y) > movementEpsilon
    );
    if (pointerVisible && !hasSignificantMove) return;

    pointerX = localPointer.x;
    pointerY = localPointer.y;
    pointerVisible = true;
  }

  function applyLayout() {
    const enabled = unref(options.enabled) === true;
    if (!enabled) {
      pointerVisible = false;
      hideOverlay();
      return;
    }

    if (!pointerVisible || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      hideOverlay();
      return;
    }

    const overlayGroup = unref(options.overlayGroupRef);
    const frameGroup = unref(options.frameGroupRef);
    const transformGroup = unref(options.transformGroupRef);
    const clipRect = unref(options.clipRectRef);
    const glassRect = unref(options.glassRectRef);
    const frameRect = unref(options.frameRectRef);

    if (!overlayGroup || !frameGroup || !transformGroup || !clipRect || !glassRect || !frameRect) {
      return;
    }

    const svgWidth = pointerResolver.resolveSvgWidth(unref(options.svgWidth));
    const svgHeight = pointerResolver.resolveSvgHeight(unref(options.svgHeight));
    const windowWidth = resolveFiniteOptionNumber(options.windowWidth, defaultWindowWidth, { min: 1 });
    const windowHeight = resolveFiniteOptionNumber(options.windowHeight, defaultWindowHeight, { min: 1 });
    const margin = resolveFiniteOptionNumber(options.margin, defaultMargin, { min: 0 });
    const pointerGap = resolveFiniteOptionNumber(options.pointerGap, defaultPointerGap, { min: 0 });
    const edgePadding = resolveFiniteOptionNumber(options.edgePadding, defaultEdgePadding, { min: 0 });
    const scale = resolveFiniteOptionNumber(options.scale, defaultScale, { min: 0.1 });
    const windowPosition = resolveMagnifierWindowPosition(pointerX, pointerY, svgWidth, svgHeight, {
      windowWidth,
      windowHeight,
      margin,
      pointerGap,
      edgePadding
    });
    const centerX = windowPosition.x + (windowWidth / 2);
    const centerY = windowPosition.y + (windowHeight / 2);
    const translateX = centerX - (scale * pointerX);
    const translateY = centerY - (scale * pointerY);

    setRectAttributes(clipRect, windowPosition.x, windowPosition.y, windowWidth, windowHeight);
    setRectAttributes(glassRect, windowPosition.x, windowPosition.y, windowWidth, windowHeight);
    setRectAttributes(frameRect, windowPosition.x, windowPosition.y, windowWidth, windowHeight);
    setAttributeIfChanged(
      transformGroup,
      'transform',
      `translate(${translateX} ${translateY}) scale(${scale})`
    );

    setDisplay(overlayGroup, true);
    setDisplay(frameGroup, true);
  }

  function flushFrame() {
    animationFrameId = null;

    if (pendingClient) {
      const client = pendingClient;
      pendingClient = null;
      commitPointerFromClient(client);
    }

    applyLayout();

    if (pendingClient && animationFrameId === null) {
      animationFrameId = requestAnimationFrame(flushFrame);
    }
  }

  function scheduleFrame() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(flushFrame);
  }

  function queueClientPointer(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    const client = { x: clientX, y: clientY };
    lastClient = client;
    pendingClient = client;
    scheduleFrame();
  }

  function handleMouseMove(event) {
    if (unref(options.enabled) !== true) {
      handleMouseLeave();
      return;
    }
    pointerResolver.syncFromContainer(unref(options.containerRef));
    queueClientPointer(toFiniteNumber(event?.clientX), toFiniteNumber(event?.clientY));
  }

  function handleScroll() {
    if (unref(options.enabled) !== true || !lastClient) return;
    pointerResolver.syncFromContainer(unref(options.containerRef), { skipRect: true });
    queueClientPointer(toFiniteNumber(lastClient.x), toFiniteNumber(lastClient.y));
  }

  function refresh() {
    pointerResolver.syncFromContainer(unref(options.containerRef), { forceRect: true });
    scheduleFrame();
  }

  function handleMouseLeave() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    pendingClient = null;
    lastClient = null;
    pointerVisible = false;
    pointerResolver.invalidateRect();
    hideOverlay();
  }

  watch(
    [
      () => unref(options.enabled),
      () => unref(options.containerRef),
      () => unref(options.svgWidth),
      () => unref(options.svgHeight),
      () => unref(options.windowWidth),
      () => unref(options.windowHeight),
      () => unref(options.scale),
      () => unref(options.margin),
      () => unref(options.pointerGap),
      () => unref(options.edgePadding),
      () => unref(options.overlayGroupRef),
      () => unref(options.frameGroupRef),
      () => unref(options.transformGroupRef),
      () => unref(options.clipRectRef),
      () => unref(options.glassRectRef),
      () => unref(options.frameRectRef)
    ],
    () => {
      pointerResolver.invalidateRect();
      pointerResolver.syncFromContainer(unref(options.containerRef), { forceRect: true });
      scheduleFrame();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    handleMouseLeave();
  });

  return {
    handleMouseMove,
    handleScroll,
    handleMouseLeave,
    refresh
  };
}

export default useMagnifierOverlayDom;
