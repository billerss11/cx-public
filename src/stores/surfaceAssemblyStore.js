import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import { cloneSnapshot } from '@/utils/general.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import {
  buildSurfaceAssemblyEditorSections,
  createSurfaceAssemblyEntityKey,
  createSurfaceAssemblyFromFamily,
  normalizeSurfaceAssembly,
  resolveSurfaceAssemblyEntity,
  updateSurfaceAssemblyBoundaryState,
  updateSurfaceAssemblyDeviceState,
  updateSurfaceAssemblyFamily,
  updateSurfaceAssemblyTerminationType,
  validateSurfaceAssembly,
} from '@/utils/surfaceAssemblyModel.js';

function resolveDefaultSelectionKey(assembly) {
  const firstDevice = Array.isArray(assembly?.devices) ? assembly.devices[0] : null;
  if (firstDevice?.slotKey) {
    return createSurfaceAssemblyEntityKey('device', firstDevice.slotKey);
  }
  const firstTermination = Array.isArray(assembly?.terminations) ? assembly.terminations[0] : null;
  if (firstTermination?.slotKey) {
    return createSurfaceAssemblyEntityKey('termination', firstTermination.slotKey);
  }
  return null;
}

export const useSurfaceAssemblyStore = defineStore('surfaceAssembly', () => {
  const projectStore = useProjectStore();
  const projectDataStore = useProjectDataStore();

  const state = reactive({
    draftAssembly: null,
    isComposerVisible: false,
    selectedDraftEntityKey: null,
  });

  const committedAssemblyForActiveWell = computed(() => (
    normalizeSurfaceAssembly(projectDataStore.surfaceAssembly) ?? null
  ));

  const draftAssembly = computed(() => state.draftAssembly);
  const selectedDraftEntityKey = computed(() => state.selectedDraftEntityKey);
  const selectedDraftEntity = computed(() => (
    resolveSurfaceAssemblyEntity(state.draftAssembly, state.selectedDraftEntityKey)
  ));
  const draftEditorSections = computed(() => buildSurfaceAssemblyEditorSections(state.draftAssembly));
  const draftValidationWarnings = computed(() => validateSurfaceAssembly(state.draftAssembly));

  function clearDraftState() {
    state.draftAssembly = null;
    state.selectedDraftEntityKey = null;
  }

  function resolveDraftSeed() {
    if (committedAssemblyForActiveWell.value) {
      return cloneSnapshot(committedAssemblyForActiveWell.value);
    }
    return createSurfaceAssemblyFromFamily();
  }

  function openComposer() {
    projectStore.ensureInitialized();
    if (!projectStore.activeWellId) return false;

    state.draftAssembly = resolveDraftSeed();
    state.selectedDraftEntityKey = resolveDefaultSelectionKey(state.draftAssembly);
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
    if (!state.draftAssembly) return false;
    projectDataStore.setSurfaceAssembly(cloneSnapshot(state.draftAssembly));
    state.isComposerVisible = false;
    clearDraftState();
    return true;
  }

  function setDraftFamily(familyKey) {
    const nextAssembly = updateSurfaceAssemblyFamily(state.draftAssembly, familyKey);
    state.draftAssembly = nextAssembly;
    state.selectedDraftEntityKey = resolveDefaultSelectionKey(nextAssembly);
    return nextAssembly;
  }

  function setDraftDeviceState(slotKey, nextState) {
    if (!state.draftAssembly) return false;
    state.draftAssembly = updateSurfaceAssemblyDeviceState(state.draftAssembly, slotKey, nextState);
    return true;
  }

  function setDraftBoundaryState(slotKey, nextState) {
    if (!state.draftAssembly) return false;
    state.draftAssembly = updateSurfaceAssemblyBoundaryState(state.draftAssembly, slotKey, nextState);
    return true;
  }

  function setDraftTerminationType(slotKey, nextTypeKey) {
    if (!state.draftAssembly) return false;
    state.draftAssembly = updateSurfaceAssemblyTerminationType(state.draftAssembly, slotKey, nextTypeKey);
    return true;
  }

  function selectDraftEntity(entityKey) {
    state.selectedDraftEntityKey = entityKey || null;
    return state.selectedDraftEntityKey;
  }

  return {
    committedAssemblyForActiveWell,
    draftAssembly,
    draftEditorSections,
    draftValidationWarnings,
    isComposerVisible: computed(() => state.isComposerVisible),
    selectedDraftEntity,
    selectedDraftEntityKey,
    applyDraft,
    closeComposer,
    discardDraft,
    openComposer,
    selectDraftEntity,
    setDraftBoundaryState,
    setDraftDeviceState,
    setDraftFamily,
    setDraftTerminationType,
  };
});
