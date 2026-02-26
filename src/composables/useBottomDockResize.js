import { onBeforeUnmount } from 'vue';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

const MOBILE_LAYOUT_QUERY = '(max-width: 991px)';

export function useBottomDockResize(containerRef) {
    const workspaceStore = useWorkspaceStore();
    let detachDragListeners = null;

    function stopBottomDockResize() {
        detachDragListeners?.();
        detachDragListeners = null;
        if (typeof document !== 'undefined') {
            document.documentElement.classList.remove('resizing-y');
        }
    }

    function startBottomDockResize(event) {
        if (typeof window === 'undefined') return;
        if (workspaceStore.bottomDockVisible !== true) return;
        if (event?.button !== 0) return;
        if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return;

        const container = containerRef?.value;
        if (!container) return;

        event.preventDefault();
        stopBottomDockResize();
        document.documentElement.classList.add('resizing-y');

        const containerRect = container.getBoundingClientRect();
        const handlePointerMove = (moveEvent) => {
            const nextHeight = containerRect.bottom - moveEvent.clientY;
            workspaceStore.setBottomDockHeight(nextHeight);
        };
        const handlePointerUp = () => {
            stopBottomDockResize();
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        detachDragListeners = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }

    onBeforeUnmount(() => {
        stopBottomDockResize();
    });

    return {
        startBottomDockResize,
        stopBottomDockResize
    };
}
