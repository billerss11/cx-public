import { defineStore } from 'pinia';
import { reactive } from 'vue';

export function createDefaultInteractionState() {
    return {
        autoGenerate: false,
        selectedUserAnnotationId: null,
        hoveredEntity: null,
        lockedEntity: null
    };
}

export const useInteractionStore = defineStore('interaction', () => {
    const interaction = reactive(createDefaultInteractionState());

    function setAutoGenerate(status) {
        return setInteractionValue('autoGenerate', status === true);
    }

    function setSelectedUserAnnotationId(id) {
        const normalized = id === null || id === undefined
            ? null
            : String(id).trim() || null;
        return setInteractionValue('selectedUserAnnotationId', normalized);
    }

    function setInteractionValue(key, value) {
        if (!key) return false;
        if (Object.is(interaction[key], value)) return false;
        interaction[key] = value;
        return true;
    }

    function updateInteraction(patch) {
        if (!patch || typeof patch !== 'object') return [];

        const changedKeys = [];
        Object.entries(patch).forEach(([key, value]) => {
            if (Object.is(interaction[key], value)) return;
            interaction[key] = value;
            changedKeys.push(key);
        });

        return changedKeys;
    }

    return {
        interaction,
        setAutoGenerate,
        setSelectedUserAnnotationId,
        setInteractionValue,
        updateInteraction
    };
});
