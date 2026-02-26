import { onBeforeUnmount, unref, watch } from 'vue';
import { clamp } from '@/utils/general.js';

const LABEL_HEIGHT = 20;
const LABEL_MIN_WIDTH = 88;
const LABEL_MAX_WIDTH = 240;

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function setDisplay(element, visible) {
  if (!element) return;
  element.style.display = visible ? '' : 'none';
}

function setLineAttributes(line, x1, y1, x2, y2) {
  if (!line) return;
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
}

function setLabelAttributes(labelRect, labelText, x, y, width, text) {
  if (labelRect) {
    labelRect.setAttribute('x', String(x));
    labelRect.setAttribute('y', String(y));
    labelRect.setAttribute('width', String(width));
    labelRect.setAttribute('height', String(LABEL_HEIGHT));
  }

  if (labelText) {
    labelText.setAttribute('x', String(x + (width / 2)));
    labelText.setAttribute('y', String(y + (LABEL_HEIGHT / 2)));
    if (labelText.textContent !== text) {
      labelText.textContent = text;
    }
  }
}

export function useDepthCursorLayerDom(options = {}) {
  let animationFrameId = null;

  function applyLayout() {
    const group = unref(options.groupRef);
    const line = unref(options.lineRef);
    const labelRect = unref(options.labelRectRef);
    const labelText = unref(options.labelTextRef);

    if (!group || !line || !labelRect || !labelText) return;

    const visible = unref(options.visible) === true;
    if (!visible) {
      setDisplay(group, false);
      return;
    }

    const plotLeftX = toFiniteNumber(unref(options.plotLeftX), 0);
    const plotRightX = toFiniteNumber(unref(options.plotRightX), plotLeftX);
    const plotTopY = toFiniteNumber(unref(options.plotTopY), 0);
    const plotBottomY = toFiniteNumber(unref(options.plotBottomY), plotTopY);
    const safeLeftX = Math.min(plotLeftX, plotRightX);
    const safeRightX = Math.max(plotLeftX, plotRightX);
    const safeTopY = Math.min(plotTopY, plotBottomY);
    const safeBottomY = Math.max(plotTopY, plotBottomY);

    const cursorX = toFiniteNumber(unref(options.cursorX), safeLeftX);
    const cursorY = toFiniteNumber(unref(options.cursorY), safeTopY);
    const lineStartX = Number(unref(options.lineStartX));
    const lineStartY = Number(unref(options.lineStartY));
    const lineEndX = Number(unref(options.lineEndX));
    const lineEndY = Number(unref(options.lineEndY));
    const hasExplicitLine = (
      Number.isFinite(lineStartX) &&
      Number.isFinite(lineStartY) &&
      Number.isFinite(lineEndX) &&
      Number.isFinite(lineEndY)
    );

    setLineAttributes(
      line,
      hasExplicitLine ? lineStartX : safeLeftX,
      hasExplicitLine ? lineStartY : cursorY,
      hasExplicitLine ? lineEndX : safeRightX,
      hasExplicitLine ? lineEndY : cursorY
    );

    const labelValue = String(unref(options.label) ?? '').trim();
    const showLabel = unref(options.showLabel) !== false && labelValue.length > 0;

    if (!showLabel) {
      setDisplay(labelRect, false);
      setDisplay(labelText, false);
      setDisplay(group, true);
      return;
    }

    const labelWidth = Math.max(
      LABEL_MIN_WIDTH,
      Math.min(LABEL_MAX_WIDTH, (labelValue.length * 6.8) + 14)
    );
    const labelX = clamp(cursorX + 10, safeLeftX + 4, safeRightX - labelWidth - 4);
    const labelY = clamp(cursorY - LABEL_HEIGHT - 8, safeTopY + 4, safeBottomY - LABEL_HEIGHT - 4);

    setLabelAttributes(labelRect, labelText, labelX, labelY, labelWidth, labelValue);
    setDisplay(labelRect, true);
    setDisplay(labelText, true);
    setDisplay(group, true);
  }

  function scheduleLayout() {
    if (animationFrameId !== null) return;
    animationFrameId = requestAnimationFrame(() => {
      animationFrameId = null;
      applyLayout();
    });
  }

  function cancelScheduledLayout() {
    if (animationFrameId === null) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  watch(
    [
      () => unref(options.visible),
      () => unref(options.cursorX),
      () => unref(options.cursorY),
      () => unref(options.lineStartX),
      () => unref(options.lineStartY),
      () => unref(options.lineEndX),
      () => unref(options.lineEndY),
      () => unref(options.plotLeftX),
      () => unref(options.plotRightX),
      () => unref(options.plotTopY),
      () => unref(options.plotBottomY),
      () => unref(options.label),
      () => unref(options.showLabel),
      () => unref(options.groupRef),
      () => unref(options.lineRef),
      () => unref(options.labelRectRef),
      () => unref(options.labelTextRef)
    ],
    scheduleLayout,
    { immediate: true }
  );

  onBeforeUnmount(() => {
    cancelScheduledLayout();
  });

  return {
    refresh: scheduleLayout,
    refreshNow: applyLayout
  };
}

export default useDepthCursorLayerDom;
