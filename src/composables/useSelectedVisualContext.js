import { computed } from 'vue';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { normalizeInteractionEntity } from '@/composables/useSchematicInteraction.js';

const ENTITY_TYPE_TO_STORE_KEY = Object.freeze({
    casing: 'casingData',
    tubing: 'tubingData',
    drillString: 'drillStringData',
    equipment: 'equipmentData',
    line: 'horizontalLines',
    plug: 'cementPlugs',
    fluid: 'annulusFluids',
    marker: 'markers',
    box: 'annotationBoxes'
});

function normalizeRowIndex(value) {
    if (value === null || value === undefined) return null;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '') return null;
    if (typeof normalized !== 'number' && typeof normalized !== 'string') return null;

    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function addDepthValue(values, value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    values.push(parsed);
}

function collectWellDepthRange(store) {
    const minCandidates = [];
    const maxCandidates = [];

    const addIntervalRows = (rows, topKey, bottomKey) => {
        if (!Array.isArray(rows)) return;
        rows.forEach((row) => {
            const top = Number(row?.[topKey]);
            const bottom = Number(row?.[bottomKey]);
            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return;
            minCandidates.push(top);
            maxCandidates.push(bottom);
        });
    };

    addIntervalRows(store?.casingData, 'top', 'bottom');
    addIntervalRows(store?.tubingData, 'top', 'bottom');
    addIntervalRows(store?.drillStringData, 'top', 'bottom');
    addIntervalRows(store?.annulusFluids, 'top', 'bottom');
    addIntervalRows(store?.cementPlugs, 'top', 'bottom');

    if (Array.isArray(store?.equipmentData)) {
        store.equipmentData.forEach((row) => addDepthValue(maxCandidates, row?.depth));
    }
    if (Array.isArray(store?.horizontalLines)) {
        store.horizontalLines.forEach((row) => addDepthValue(maxCandidates, row?.depth));
    }
    if (Array.isArray(store?.markers)) {
        store.markers.forEach((row) => {
            addDepthValue(maxCandidates, row?.top);
            addDepthValue(maxCandidates, row?.bottom);
        });
    }
    if (Array.isArray(store?.annotationBoxes)) {
        store.annotationBoxes.forEach((row) => {
            addDepthValue(maxCandidates, row?.topDepth);
            addDepthValue(maxCandidates, row?.bottomDepth);
        });
    }
    if (Array.isArray(store?.trajectory)) {
        store.trajectory.forEach((row) => addDepthValue(maxCandidates, row?.md));
    }

    const minDepth = minCandidates.length > 0 ? Math.min(...minCandidates) : 0;
    const maxDepth = maxCandidates.length > 0 ? Math.max(...maxCandidates) : minDepth + 1;
    if (!Number.isFinite(minDepth) || !Number.isFinite(maxDepth)) return null;
    if (maxDepth <= minDepth) {
        return {
            min: Math.min(0, minDepth),
            max: Math.max(1, minDepth + 1)
        };
    }
    return {
        min: Math.min(0, minDepth),
        max: maxDepth
    };
}

function resolveRowContext(store, elementType, storeKey, rowIndex) {
    if (!storeKey) return null;
    const normalizedRowIndex = normalizeRowIndex(rowIndex);
    if (normalizedRowIndex === null) return null;

    const rows = store[storeKey];
    if (!Array.isArray(rows) || normalizedRowIndex >= rows.length) return null;

    const rowData = rows[normalizedRowIndex];
    if (!rowData || typeof rowData !== 'object') return null;

    return {
        elementType,
        storeKey,
        rowIndex: normalizedRowIndex,
        rowData,
        depthRange: collectWellDepthRange(store),
        casingRows: Array.isArray(store?.casingData) ? store.casingData : [],
        tubingRows: Array.isArray(store?.tubingData) ? store.tubingData : []
    };
}

function resolveSelectedVisualContext(interaction, projectDataStore) {
    const lockedEntity = normalizeInteractionEntity(interaction?.lockedEntity);
    if (!lockedEntity) return null;

    const storeKey = ENTITY_TYPE_TO_STORE_KEY[lockedEntity.type];
    if (!storeKey) return null;

    return resolveRowContext(
        projectDataStore,
        lockedEntity.type,
        storeKey,
        lockedEntity.id
    );
}

export function useSelectedVisualContext() {
    const interactionStore = useInteractionStore();
    const projectDataStore = useProjectDataStore();

    const selectedVisualContext = computed(() => (
        resolveSelectedVisualContext(interactionStore.interaction, projectDataStore)
    ));

    const hasSelectedVisualContext = computed(() => selectedVisualContext.value !== null);

    return {
        selectedVisualContext,
        hasSelectedVisualContext
    };
}
