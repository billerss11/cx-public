import { onBeforeUnmount, ref } from 'vue';

const DEFAULT_DRAG_MOVEMENT_EPSILON = 0.5;

function zeroOffset() {
  return { x: 0, y: 0 };
}

export function useDiagramLabelDrag(options = {}) {
  const activePreviewId = ref(null);
  const previewOffset = ref(zeroOffset());
  const activeDrag = ref(null);
  const finishedDragClickGuardArmed = ref(false);
  const commitDrag = typeof options.commitDrag === 'function'
    ? options.commitDrag
    : () => {};
  const movementEpsilon = Number.isFinite(Number(options.movementEpsilon))
    ? Math.max(0, Number(options.movementEpsilon))
    : DEFAULT_DRAG_MOVEMENT_EPSILON;
  let finishedDragClickGuardTimer = null;

  function clearFinishedDragClickGuard() {
    finishedDragClickGuardArmed.value = false;
    if (finishedDragClickGuardTimer !== null) {
      clearTimeout(finishedDragClickGuardTimer);
      finishedDragClickGuardTimer = null;
    }
  }

  function armFinishedDragClickGuard() {
    clearFinishedDragClickGuard();
    finishedDragClickGuardArmed.value = true;
    finishedDragClickGuardTimer = setTimeout(() => {
      finishedDragClickGuardArmed.value = false;
      finishedDragClickGuardTimer = null;
    }, 0);
  }

  function consumeFinishedDragClick() {
    if (finishedDragClickGuardArmed.value !== true) return false;
    clearFinishedDragClickGuard();
    return true;
  }

  function clearDrag() {
    activeDrag.value = null;
    activePreviewId.value = null;
    previewOffset.value = zeroOffset();
  }

  function resolvePointer(event) {
    if (options.enabled === false || typeof options.resolvePointer !== 'function') return null;
    return options.resolvePointer(event);
  }

  function hasMeaningfulMovement(offset) {
    return Math.abs(Number(offset?.x ?? 0)) > movementEpsilon
      || Math.abs(Number(offset?.y ?? 0)) > movementEpsilon;
  }

  function startDrag(descriptor = {}, event) {
    const pointer = resolvePointer(event);
    if (!pointer) return false;
    clearFinishedDragClickGuard();

    activeDrag.value = {
      descriptor,
      startPointer: pointer
    };
    activePreviewId.value = String(descriptor?.previewId ?? '').trim() || null;
    previewOffset.value = zeroOffset();
    return true;
  }

  function updateDrag(event) {
    const drag = activeDrag.value;
    if (!drag) return false;

    const pointer = resolvePointer(event);
    if (!pointer) return false;

    previewOffset.value = {
      x: Number(pointer.x) - Number(drag.startPointer.x),
      y: Number(pointer.y) - Number(drag.startPointer.y)
    };
    return true;
  }

  function finishDrag(event) {
    const drag = activeDrag.value;
    if (!drag) return false;

    const pointer = resolvePointer(event);
    if (!pointer) {
      clearDrag();
      return false;
    }

    const finishOffset = {
      x: Number(pointer.x) - Number(drag.startPointer.x),
      y: Number(pointer.y) - Number(drag.startPointer.y)
    };

    if (!hasMeaningfulMovement(finishOffset)) {
      clearDrag();
      return true;
    }

    const patch = typeof drag.descriptor?.buildPatch === 'function'
      ? drag.descriptor.buildPatch({
        pointer,
        startPointer: drag.startPointer,
        previewOffset: finishOffset
      })
      : null;

    if (patch && typeof patch === 'object') {
      if (typeof drag.descriptor?.commitPatch === 'function') {
        drag.descriptor.commitPatch(patch);
      } else {
        commitDrag(patch);
      }
    }

    armFinishedDragClickGuard();
    clearDrag();
    return true;
  }

  onBeforeUnmount(() => {
    clearFinishedDragClickGuard();
    clearDrag();
  });

  return {
    activePreviewId,
    previewOffset,
    commitDrag,
    startDrag,
    updateDrag,
    finishDrag,
    clearDrag,
    consumeFinishedDragClick
  };
}

export default useDiagramLabelDrag;
