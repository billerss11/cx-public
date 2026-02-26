import {
    getHotTableInstance,
    setHotTableHighlight
} from '@/composables/useHotTableRegistry.js';

export function refreshHotLayout(type) {
    const instance = getHotTableInstance(type);
    if (!instance) return;
    instance.refreshDimensions();
    instance.render();
}

export function setTableHighlight(type, activeIndex) {
    setHotTableHighlight(type, activeIndex);
    const instance = getHotTableInstance(type);
    if (instance) {
        instance.render();
    }
}
