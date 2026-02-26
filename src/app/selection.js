import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { usePlotElementsStore } from '@/stores/plotElementsStore.js';
import { pinia } from '@/stores/pinia.js';
import { setTableHighlight } from './hot.js';
import {
    requestTableRowFocus,
    setActiveTableTabKey,
    setTablesAccordionOpen
} from '@/components/tables/panes/tablePaneState.js';
import {
    isPipeInteractionType,
    isSameInteractionEntity,
    normalizeInteractionEntity,
    normalizePipeType,
    resolveInteractionEntityFromPayload,
    resolveTopmostInteractionEntity,
    serializeInteractionEntity
} from '@/composables/useSchematicInteraction.js';

const projectDataStore = useProjectDataStore(pinia);
const interactionStore = useInteractionStore(pinia);
const plotElementsStore = usePlotElementsStore(pinia);
const state = {
    get casingData() {
        return projectDataStore.casingData ?? [];
    },
    get tubingData() {
        return projectDataStore.tubingData ?? [];
    },
    get drillStringData() {
        return projectDataStore.drillStringData ?? [];
    },
    get equipmentData() {
        return projectDataStore.equipmentData ?? [];
    },
    get horizontalLines() {
        return projectDataStore.horizontalLines ?? [];
    },
    get annotationBoxes() {
        return projectDataStore.annotationBoxes ?? [];
    },
    get cementPlugs() {
        return projectDataStore.cementPlugs ?? [];
    },
    get annulusFluids() {
        return projectDataStore.annulusFluids ?? [];
    },
    get markers() {
        return projectDataStore.markers ?? [];
    },
    get interaction() {
        return interactionStore.interaction ?? {};
    }
};

const getPlotElement = (...args) => plotElementsStore.getPlotElement(...args);
const PIPE_DATA_ATTR = 'data-pipe-key';
const CASING_INDEX_ATTR = 'data-casing-index';
const NON_PIPE_CONFIG = Object.freeze({
    line: {
        dataAttr: 'data-line-index',
        getTotal: () => state.horizontalLines.length
    },
    box: {
        dataAttr: 'data-box-index',
        getTotal: () => state.annotationBoxes.length
    },
    marker: {
        dataAttr: 'data-marker-index',
        getTotal: () => state.markers.length
    },
    plug: {
        dataAttr: 'data-plug-index',
        getTotal: () => state.cementPlugs.length
    },
    fluid: {
        dataAttr: 'data-fluid-index',
        getTotal: () => state.annulusFluids.length
    },
    equipment: {
        dataAttr: 'data-equipment-index',
        getTotal: () => state.equipmentData.length
    }
});
const PIPE_TABLE_TYPES = Object.freeze({
    casing: 'casing',
    tubing: 'tubing',
    drillString: 'drillString'
});
const INTERACTION_TABLE_TARGETS = Object.freeze({
    casing: { tableType: 'casing', tabKey: 'casing' },
    tubing: { tableType: 'tubing', tabKey: 'tubing' },
    drillString: { tableType: 'drillString', tabKey: 'drillString' },
    line: { tableType: 'line', tabKey: 'lines' },
    box: { tableType: 'box', tabKey: 'boxes' },
    marker: { tableType: 'marker', tabKey: 'markers' },
    plug: { tableType: 'plug', tabKey: 'plugs' },
    fluid: { tableType: 'fluid', tabKey: 'fluids' },
    equipment: { tableType: 'equipment', tabKey: 'equipment' }
});

function normalizeSelectionType(type) {
    const normalized = String(type ?? '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'pipe') return 'pipe';
    if (normalized === 'drillstring' || normalized === 'drill-string' || normalized === 'drill_string') {
        return 'drillString';
    }
    if (normalized === 'casing') return 'casing';
    if (normalized === 'tubing') return 'tubing';
    if (normalized === 'line') return 'line';
    if (normalized === 'box') return 'box';
    if (normalized === 'marker') return 'marker';
    if (normalized === 'plug') return 'plug';
    if (normalized === 'fluid') return 'fluid';
    if (normalized === 'equipment') return 'equipment';
    return null;
}

function normalizeInteractionAction(action) {
    const normalized = String(action ?? '').trim().toLowerCase();
    if (normalized === 'hover') return 'hover';
    if (normalized === 'select') return 'select';
    if (normalized === 'leave') return 'leave';
    return null;
}

function resolveEntityByTypeAndValue(type, value) {
    const normalizedType = normalizeSelectionType(type);
    if (!normalizedType) return null;
    return resolveInteractionEntityFromPayload(normalizedType, value);
}

function resolveEntityFromDispatchPayload(payload) {
    if (payload === null || payload === undefined) return null;

    if (typeof payload === 'object') {
        if ('entity' in payload) {
            return normalizeInteractionEntity(payload.entity);
        }

        const payloadType = payload.type;
        const payloadValue = payload.id ?? payload.index ?? payload.rowIndex ?? payload.value ?? payload.entity;
        if (payloadType !== undefined) {
            return resolveInteractionEntityFromPayload(payloadType, payloadValue);
        }
    }

    return normalizeInteractionEntity(payload);
}

function shouldPreferPayloadEntity(payload) {
    return Boolean(
        payload &&
        typeof payload === 'object' &&
        payload.preferPayload === true
    );
}

function resolveDispatchFallbackType(payload, entity = null) {
    if (entity?.type) return entity.type;

    if (typeof payload === 'string') {
        return normalizeSelectionType(payload);
    }

    if (payload && typeof payload === 'object') {
        if ('type' in payload) {
            return normalizeSelectionType(payload.type);
        }
        if ('entity' in payload) {
            const nested = normalizeInteractionEntity(payload.entity);
            return nested?.type ?? null;
        }
    }

    return null;
}

function resolvePipeTypeByTableType(type) {
    if (type === 'casing') return 'casing';
    if (type === 'tubing') return 'tubing';
    if (type === 'drillString') return 'drillString';
    return null;
}

function resolveEntityTotal(type) {
    const normalizedType = normalizeSelectionType(type);
    if (!normalizedType) return 0;
    if (normalizedType === 'casing') return state.casingData.length;
    if (normalizedType === 'tubing') return state.tubingData.length;
    if (normalizedType === 'drillString') return state.drillStringData.length;
    const cfg = NON_PIPE_CONFIG[normalizedType];
    if (!cfg) return 0;
    return cfg.getTotal();
}

function getSchematicSvgElement() {
    return getPlotElement('schematicSvg');
}

function getPlotTooltipElement() {
    return getPlotElement('plotTooltip');
}

function resolveActiveEntity() {
    const locked = normalizeInteractionEntity(state.interaction.lockedEntity);
    if (locked) return locked;
    return normalizeInteractionEntity(state.interaction.hoveredEntity);
}

function focusTableForEntity(entity) {
    const normalizedEntity = normalizeInteractionEntity(entity);
    if (!normalizedEntity) return;

    const target = INTERACTION_TABLE_TARGETS[normalizedEntity.type];
    if (!target) return;

    setTablesAccordionOpen(true);
    setActiveTableTabKey(target.tabKey);
    requestTableRowFocus(target.tableType, normalizedEntity.id);
}

function ensureEntityWithinBounds(key) {
    const rawEntity = state.interaction[key];
    if (rawEntity === null || rawEntity === undefined) return;

    const normalized = normalizeInteractionEntity(rawEntity);
    if (!normalized) {
        state.interaction[key] = null;
        return;
    }

    const total = resolveEntityTotal(normalized.type);
    if (!Number.isInteger(total) || normalized.id < 0 || normalized.id >= total) {
        state.interaction[key] = null;
        return;
    }

    if (!isSameInteractionEntity(rawEntity, normalized)) {
        state.interaction[key] = normalized;
    }
}

function ensureSelectionWithinBounds() {
    ensureEntityWithinBounds('lockedEntity');
    ensureEntityWithinBounds('hoveredEntity');
}

function updateTableHighlights(type, activeIndex) {
    setTableHighlight(type, activeIndex);
}

function updatePlotHighlightsForType(attributeName, activeIndex) {
    const svg = getSchematicSvgElement();
    if (!svg || !attributeName) return;

    if (activeIndex === null || activeIndex === undefined) {
        svg.querySelectorAll(`[${attributeName}]`).forEach((el) => {
            el.classList.remove('plot-highlight');
        });
        return;
    }

    const parsedActiveIndex = Number(activeIndex);
    const hasActiveIndex = Number.isInteger(parsedActiveIndex) && parsedActiveIndex >= 0;

    svg.querySelectorAll(`[${attributeName}]`).forEach((el) => {
        const nodeIndex = Number(el.getAttribute(attributeName));
        const isActive = Number.isInteger(nodeIndex) && hasActiveIndex && nodeIndex === parsedActiveIndex;
        el.classList.toggle('plot-highlight', isActive);
    });
}

function updatePipeTableHighlights(activeEntity) {
    const casingIndex = activeEntity?.type === 'casing' ? activeEntity.id : null;
    const tubingIndex = activeEntity?.type === 'tubing' ? activeEntity.id : null;
    const drillStringIndex = activeEntity?.type === 'drillString' ? activeEntity.id : null;

    updateTableHighlights(PIPE_TABLE_TYPES.casing, casingIndex);
    updateTableHighlights(PIPE_TABLE_TYPES.tubing, tubingIndex);
    updateTableHighlights(PIPE_TABLE_TYPES.drillString, drillStringIndex);
}

function updatePipePlotHighlights(activeEntity) {
    const svg = getSchematicSvgElement();
    if (!svg) return;

    const activeKey = isPipeInteractionType(activeEntity?.type)
        ? serializeInteractionEntity(activeEntity)
        : null;

    svg.querySelectorAll(`[${PIPE_DATA_ATTR}]`).forEach((el) => {
        // Directional hit-target paths are interaction-only; highlighting them creates
        // misleading glow that looks like unrelated pipe segments are selected.
        if (el.classList.contains('directional-band-layer__hit-target')) {
            el.classList.remove('plot-highlight');
            return;
        }
        const isActive = Boolean(activeKey) && el.getAttribute(PIPE_DATA_ATTR) === activeKey;
        el.classList.toggle('plot-highlight', isActive);
    });
}

function updateCasingPlotHighlights(activeEntity) {
    const activeCasingIndex = activeEntity?.type === 'casing' ? activeEntity.id : null;
    updatePlotHighlightsForType(CASING_INDEX_ATTR, activeCasingIndex);
}

function updateNonPipeHighlights(activeEntity) {
    Object.entries(NON_PIPE_CONFIG).forEach(([type, cfg]) => {
        const activeIndex = activeEntity?.type === type ? activeEntity.id : null;
        updateTableHighlights(type, activeIndex);
        updatePlotHighlightsForType(cfg.dataAttr, activeIndex);
    });
}

function isSelectionLocked(type) {
    const locked = normalizeInteractionEntity(state.interaction.lockedEntity);
    if (!locked) return false;

    const normalizedType = normalizeSelectionType(type);
    if (!normalizedType) return false;
    if (normalizedType === 'pipe') {
        return isPipeInteractionType(locked.type);
    }
    return locked.type === normalizedType;
}

function clearSelectionByPredicate(predicate) {
    let changed = false;
    ['lockedEntity', 'hoveredEntity'].forEach((key) => {
        const entity = normalizeInteractionEntity(state.interaction[key]);
        if (!entity || predicate(entity) !== true) return;
        state.interaction[key] = null;
        changed = true;
    });
    return changed;
}

function clearPipeSelectionByType(pipeType, options = {}) {
    const normalizedPipeType = normalizePipeType(pipeType);
    if (!normalizedPipeType) return;
    clearSelection(normalizedPipeType, options);
}

export function syncSelectionIndicators() {
    ensureSelectionWithinBounds();

    const activeEntity = resolveActiveEntity();
    updatePipeTableHighlights(activeEntity);
    updatePipePlotHighlights(activeEntity);
    updateCasingPlotHighlights(activeEntity);
    updateNonPipeHighlights(activeEntity);
}

export function setHovered(type, index) {
    const normalizedType = normalizeSelectionType(type);
    if (!normalizedType) return;

    const wantsClear = index === null || index === undefined;
    const nextEntity = resolveEntityByTypeAndValue(normalizedType, index);
    if (!wantsClear && !nextEntity) return;
    if (isSameInteractionEntity(state.interaction.hoveredEntity, nextEntity)) return;

    state.interaction.hoveredEntity = nextEntity;
    if (!isSelectionLocked(normalizedType)) {
        syncSelectionIndicators();
    }
}

export function toggleLock(type, index) {
    const normalizedType = normalizeSelectionType(type);
    if (!normalizedType) return;

    const nextEntity = resolveEntityByTypeAndValue(normalizedType, index);
    if (!nextEntity) {
        clearSelection(normalizedType);
        return;
    }

    const lockedEntity = normalizeInteractionEntity(state.interaction.lockedEntity);
    if (isSameInteractionEntity(lockedEntity, nextEntity)) {
        state.interaction.lockedEntity = null;
    } else {
        state.interaction.lockedEntity = nextEntity;
        state.interaction.hoveredEntity = nextEntity;
    }
    syncSelectionIndicators();
}

export function clearSelection(type, options = {}) {
    const normalizedRawType = String(type ?? '').trim().toLowerCase();
    const shouldClearAll = !normalizedRawType || normalizedRawType === 'all';

    if (shouldClearAll) {
        state.interaction.lockedEntity = null;
        state.interaction.hoveredEntity = null;
        hidePlotTooltip();
        if (!options.deferSync) {
            syncSelectionIndicators();
        }
        return;
    }

    const normalizedType = normalizeSelectionType(type);
    if (!normalizedType) return;

    if (normalizedType === 'pipe') {
        clearSelectionByPredicate((entity) => isPipeInteractionType(entity.type));
    } else {
        clearSelectionByPredicate((entity) => entity.type === normalizedType);
    }

    hidePlotTooltip();
    if (!options.deferSync) {
        syncSelectionIndicators();
    }
}

export function clearPipeSelection(options = {}) {
    clearSelection('pipe', options);
}

export function clearCasingSelection(options = {}) {
    clearPipeSelectionByType('casing', options);
}

export function clearTubingSelection(options = {}) {
    clearPipeSelectionByType('tubing', options);
}

export function clearDrillStringSelection(options = {}) {
    clearPipeSelectionByType('drillString', options);
}

export function clearLineSelection(options = {}) {
    clearSelection('line', options);
}

export function clearBoxSelection(options = {}) {
    clearSelection('box', options);
}

export function clearMarkerSelection(options = {}) {
    clearSelection('marker', options);
}

export function clearPlugSelection(options = {}) {
    clearSelection('plug', options);
}

export function clearFluidSelection(options = {}) {
    clearSelection('fluid', options);
}

export function clearEquipmentSelection(options = {}) {
    clearSelection('equipment', options);
}

export function handlePlotLeave(type) {
    hidePlotTooltip();
    const normalizedType = normalizeSelectionType(type);
    if (!normalizedType || isSelectionLocked(normalizedType)) return;

    const hoveredEntity = normalizeInteractionEntity(state.interaction.hoveredEntity);
    if (!hoveredEntity) return;

    if (normalizedType === 'pipe' && isPipeInteractionType(hoveredEntity.type)) {
        setHovered('pipe', null);
        return;
    }

    if (hoveredEntity.type === normalizedType) {
        setHovered(normalizedType, null);
    }
}

export function handlePlotClick(type, index) {
    toggleLock(type, index);
}

export function dispatchSchematicInteraction(action, payload, event = null) {
    const normalizedAction = normalizeInteractionAction(action);
    if (!normalizedAction) return;

    const payloadEntity = resolveEntityFromDispatchPayload(payload);
    const preferPayloadEntity = shouldPreferPayloadEntity(payload);
    const topmostEntity = event && !preferPayloadEntity
        ? resolveTopmostInteractionEntity(event, event?.target)
        : null;
    const winningEntity = preferPayloadEntity
        ? (payloadEntity ?? topmostEntity)
        : (topmostEntity ?? payloadEntity);

    if (normalizedAction === 'hover') {
        if (winningEntity) {
            setHovered(winningEntity.type, winningEntity.id);
            return;
        }
        const leaveType = resolveDispatchFallbackType(payload, payloadEntity);
        if (leaveType) {
            handlePlotLeave(leaveType);
        }
        return;
    }

    if (normalizedAction === 'select') {
        if (!winningEntity) return;
        toggleLock(winningEntity.type, winningEntity.id);
        const lockedEntity = normalizeInteractionEntity(state.interaction.lockedEntity);
        if (isSameInteractionEntity(lockedEntity, winningEntity)) {
            focusTableForEntity(lockedEntity);
        }
        return;
    }

    const leaveType = resolveDispatchFallbackType(payload, winningEntity);
    if (leaveType) {
        handlePlotLeave(leaveType);
    }
}

export function hidePlotTooltip() {
    const tooltip = getPlotTooltipElement();
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

export function handleTableClick(type, rowIndex, event) {
    const parsedRowIndex = Number(rowIndex);
    if (!Number.isInteger(parsedRowIndex) || parsedRowIndex < 0) return;

    const pipeType = resolvePipeTypeByTableType(type);
    const entityType = pipeType ?? normalizeSelectionType(type);
    if (!entityType || entityType === 'pipe') return;

    const nextEntity = resolveInteractionEntityFromPayload(entityType, parsedRowIndex);
    if (!nextEntity) return;

    const isModified = event?.shiftKey || event?.ctrlKey || event?.metaKey;
    const currentLocked = normalizeInteractionEntity(state.interaction.lockedEntity);
    if (!isModified && isSameInteractionEntity(currentLocked, nextEntity)) {
        clearSelection(entityType);
        return;
    }

    state.interaction.lockedEntity = nextEntity;
    state.interaction.hoveredEntity = nextEntity;
    syncSelectionIndicators();
}
