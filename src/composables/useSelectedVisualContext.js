import { computed } from 'vue';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { normalizeInteractionEntity } from '@/composables/useSchematicInteraction.js';
import { resolveDomainEntryByEntityType } from '@/workspace/domainRegistry.js';
import { collectWellDepthRange } from '@/utils/depthControlRanges.js';

function normalizeRowIndex(value) {
    if (value === null || value === undefined) return null;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '') return null;
    if (typeof normalized !== 'number' && typeof normalized !== 'string') return null;

    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
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

    const domainEntry = resolveDomainEntryByEntityType(lockedEntity.type);
    if (!domainEntry?.storeKey || domainEntry.canHighlight !== true) return null;

    return resolveRowContext(
        projectDataStore,
        lockedEntity.type,
        domainEntry.storeKey,
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
