import { onBeforeUnmount } from 'vue';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

const MOBILE_LAYOUT_QUERY = '(max-width: 991px)';

export function useLeftDockResize(containerRef) {
  const workspaceStore = useWorkspaceStore();
  let detachDragListeners = null;

  function stopLeftDockResize() {
    detachDragListeners?.();
    detachDragListeners = null;
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('resizing');
    }
  }

  function startLeftDockResize(event) {
    if (typeof window === 'undefined') return;
    if (workspaceStore.leftDockVisible !== true) return;
    if (event?.button !== 0) return;
    if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return;

    const container = containerRef?.value;
    if (!container) return;

    event.preventDefault();
    stopLeftDockResize();
    document.documentElement.classList.add('resizing');

    const containerRect = container.getBoundingClientRect();
    const handlePointerMove = (moveEvent) => {
      const nextWidth = moveEvent.clientX - containerRect.left;
      workspaceStore.setLeftDockWidth(nextWidth);
    };
    const handlePointerUp = () => {
      stopLeftDockResize();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    detachDragListeners = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }

  onBeforeUnmount(() => {
    stopLeftDockResize();
  });

  return {
    startLeftDockResize,
    stopLeftDockResize
  };
}
