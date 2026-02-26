import { onBeforeUnmount, ref } from 'vue';
import { clamp } from '@/utils/general.js';

export function useFloatingDialogResize(options = {}) {
  const minWidth = Number.isFinite(Number(options.minWidth)) ? Math.max(1, Number(options.minWidth)) : 320;
  const minHeight = Number.isFinite(Number(options.minHeight)) ? Math.max(1, Number(options.minHeight)) : 240;
  const defaultWidth = Number.isFinite(Number(options.defaultWidth))
    ? Math.max(minWidth, Number(options.defaultWidth))
    : minWidth;
  const defaultHeight = Number.isFinite(Number(options.defaultHeight))
    ? Math.max(minHeight, Number(options.defaultHeight))
    : minHeight;
  const maxViewportWidthRatio = Number.isFinite(Number(options.maxViewportWidthRatio))
    ? clamp(Number(options.maxViewportWidthRatio), 0.25, 1)
    : 0.96;
  const maxViewportHeightRatio = Number.isFinite(Number(options.maxViewportHeightRatio))
    ? clamp(Number(options.maxViewportHeightRatio), 0.25, 1)
    : 0.9;
  const cursorClass = String(options.cursorClass ?? '').trim();

  const dialogSize = ref({
    width: defaultWidth,
    height: defaultHeight
  });

  let detachResizeListeners = null;

  function clampDialogSize(width, height) {
    if (typeof window === 'undefined') {
      return {
        width: defaultWidth,
        height: defaultHeight
      };
    }

    const maxWidth = Math.max(minWidth, Math.floor(window.innerWidth * maxViewportWidthRatio));
    const maxHeight = Math.max(minHeight, Math.floor(window.innerHeight * maxViewportHeightRatio));
    return {
      width: clamp(Math.round(width), minWidth, maxWidth),
      height: clamp(Math.round(height), minHeight, maxHeight)
    };
  }

  function reconcileDialogSize() {
    const next = clampDialogSize(dialogSize.value.width, dialogSize.value.height);
    dialogSize.value = next;
  }

  function resizeDialogBy(deltaWidth = 0, deltaHeight = 0) {
    const widthDelta = Number(deltaWidth);
    const heightDelta = Number(deltaHeight);
    if (!Number.isFinite(widthDelta) || !Number.isFinite(heightDelta)) return;
    dialogSize.value = clampDialogSize(
      dialogSize.value.width + widthDelta,
      dialogSize.value.height + heightDelta
    );
  }

  function stopDialogResize() {
    detachResizeListeners?.();
    detachResizeListeners = null;
    if (cursorClass && typeof document !== 'undefined') {
      document.documentElement.classList.remove(cursorClass);
    }
  }

  function startDialogResize(event) {
    if (typeof window === 'undefined') return;
    if (event?.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    stopDialogResize();
    if (cursorClass) {
      document.documentElement.classList.add(cursorClass);
    }

    const originX = event.clientX;
    const originY = event.clientY;
    const startWidth = dialogSize.value.width;
    const startHeight = dialogSize.value.height;

    const handlePointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - originX;
      const deltaY = moveEvent.clientY - originY;
      dialogSize.value = clampDialogSize(startWidth + deltaX, startHeight + deltaY);
    };
    const handlePointerUp = () => {
      stopDialogResize();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    detachResizeListeners = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }

  onBeforeUnmount(() => {
    stopDialogResize();
  });

  return {
    dialogSize,
    reconcileDialogSize,
    resizeDialogBy,
    startDialogResize,
    stopDialogResize
  };
}
