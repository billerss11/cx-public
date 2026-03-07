import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import { cloneSnapshot } from '@/utils/general.js';
import { useProjectStore } from '@/stores/projectStore.js';
import {
  appendSurfaceAssemblyRightBranchComponent,
  appendSurfaceAssemblyTrunkComponent,
  createSurfaceAssemblyFromTemplate,
} from '@/utils/surfaceAssemblyModel.js';

export const useSurfaceAssemblyStore = defineStore('surfaceAssembly', () => {
  const projectStore = useProjectStore();

  const state = reactive({
    committedAssemblyByWellId: {},
    draftAssembly: null,
    isComposerVisible: false,
    selectedDraftComponentId: null,
  });

  const activeWellId = computed(() => {
    const resolvedWellId = String(projectStore.activeWellId ?? '').trim();
    return resolvedWellId || null;
  });

  const committedAssemblyForActiveWell = computed(() => {
    if (!activeWellId.value) return null;
    return state.committedAssemblyByWellId[activeWellId.value] ?? null;
  });

  const selectedDraftComponent = computed(() => {
    if (!state.draftAssembly || !state.selectedDraftComponentId) return null;
    return state.draftAssembly.components.find((component) => (
      component.componentId === state.selectedDraftComponentId
    )) ?? null;
  });

  function clearDraftState() {
    state.draftAssembly = null;
    state.selectedDraftComponentId = null;
  }

  function resolveDraftSeed() {
    if (committedAssemblyForActiveWell.value) {
      return cloneSnapshot(committedAssemblyForActiveWell.value);
    }
    return createSurfaceAssemblyFromTemplate();
  }

  function openComposer() {
    projectStore.ensureInitialized();
    if (!activeWellId.value) return false;

    state.draftAssembly = resolveDraftSeed();
    state.selectedDraftComponentId = state.draftAssembly.components[0]?.componentId ?? null;
    state.isComposerVisible = true;
    return true;
  }

  function closeComposer() {
    state.isComposerVisible = false;
    clearDraftState();
    return true;
  }

  function discardDraft() {
    return closeComposer();
  }

  function applyDraft() {
    if (!activeWellId.value || !state.draftAssembly) return false;

    state.committedAssemblyByWellId[activeWellId.value] = cloneSnapshot(state.draftAssembly);
    state.isComposerVisible = false;
    clearDraftState();
    return true;
  }

  function setDraftTemplate(templateKey) {
    state.draftAssembly = createSurfaceAssemblyFromTemplate(templateKey);
    state.selectedDraftComponentId = state.draftAssembly.components[0]?.componentId ?? null;
    return state.draftAssembly;
  }

  function appendDraftTrunkComponent(typeKey) {
    if (!state.draftAssembly) return false;
    const nextAssembly = appendSurfaceAssemblyTrunkComponent(state.draftAssembly, typeKey);
    state.draftAssembly = nextAssembly;
    state.selectedDraftComponentId = state.draftAssembly.components[state.draftAssembly.components.length - 1]?.componentId ?? null;
    return true;
  }

  function appendDraftRightBranchComponent(typeKey) {
    if (!state.draftAssembly) return false;
    const nextAssembly = appendSurfaceAssemblyRightBranchComponent(state.draftAssembly, typeKey);
    state.draftAssembly = nextAssembly;
    state.selectedDraftComponentId = state.draftAssembly.components[state.draftAssembly.components.length - 1]?.componentId ?? null;
    return true;
  }

  function selectDraftComponent(componentId) {
    const normalizedComponentId = String(componentId ?? '').trim();
    state.selectedDraftComponentId = normalizedComponentId || null;
    return state.selectedDraftComponentId;
  }

  return {
    draftAssembly: computed(() => state.draftAssembly),
    isComposerVisible: computed(() => state.isComposerVisible),
    committedAssemblyForActiveWell,
    selectedDraftComponent,
    selectedDraftComponentId: computed(() => state.selectedDraftComponentId),
    openComposer,
    closeComposer,
    discardDraft,
    applyDraft,
    setDraftTemplate,
    appendDraftTrunkComponent,
    appendDraftRightBranchComponent,
    selectDraftComponent,
  };
});
