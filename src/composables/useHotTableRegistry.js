export const TABLE_TYPES = Object.freeze([
    'casing',
    'tubing',
    'drillString',
    'equipment',
    'line',
    'box',
    'plug',
    'marker',
    'fluid',
    'trajectory'
]);

function createRegistry() {
    return TABLE_TYPES.reduce((registry, type) => {
        registry[type] = null;
        return registry;
    }, {});
}

const hotTableInstances = createRegistry();
const hotTableHighlightState = createRegistry();

export function setHotTableInstance(type, instance) {
    if (!(type in hotTableInstances)) return;
    hotTableInstances[type] = instance ?? null;
}

export function getHotTableInstance(type) {
    if (!(type in hotTableInstances)) return null;
    return hotTableInstances[type] ?? null;
}

export function getHotTableInstances() {
    return hotTableInstances;
}

export function finishEditingAllHotTables() {
    TABLE_TYPES.forEach((type) => {
        const instance = getHotTableInstance(type);
        if (!instance || typeof instance.getActiveEditor !== 'function') return;
        instance.getActiveEditor()?.finishEditing?.();
    });
}

export function setHotTableHighlight(type, activeIndex) {
    if (!(type in hotTableHighlightState)) return;
    hotTableHighlightState[type] = activeIndex ?? null;
}

export function getHotTableHighlight(type) {
    if (!(type in hotTableHighlightState)) return null;
    return hotTableHighlightState[type] ?? null;
}
