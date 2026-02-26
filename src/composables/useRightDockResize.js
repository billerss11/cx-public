import { onBeforeUnmount } from 'vue';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

const MOBILE_LAYOUT_QUERY = '(max-width: 991px)';

export function useRightDockResize(containerRef) {
    const workspaceStore = useWorkspaceStore();
    let detachDragListeners = null;

    function stopRightDockResize() {
        detachDragListeners?.();
        detachDragListeners = null;
        if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('resizing');
        }
    }

    function startRightDockResize(event) {
        if (typeof window === 'undefined') return;
        if (workspaceStore.rightDockVisible !== true) return;
        if (event?.button !== 0) return;
        if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return;

        const container = containerRef?.value;
        if (!container) return;

        event.preventDefault();
        stopRightDockResize();
        document.documentElement.classList.add('resizing');

        const containerRect = container.getBoundingClientRect();
        const handlePointerMove = (moveEvent) => {
            const nextWidth = containerRect.right - moveEvent.clientX;
            workspaceStore.setRightDockWidth(nextWidth);
        };
        const handlePointerUp = () => {
            stopRightDockResize();
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        detachDragListeners = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }

    onBeforeUnmount(() => {
        stopRightDockResize();
    });

    return {
        startRightDockResize,
        stopRightDockResize
    };
}
