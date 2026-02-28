import { computed, watch } from 'vue';
import { useSelectedVisualContext } from '@/composables/useSelectedVisualContext.js';
import { RIGHT_DOCK_EDITOR_MODES, useWorkspaceStore } from '@/stores/workspaceStore.js';

function normalizeEditorMode(value) {
  return value === RIGHT_DOCK_EDITOR_MODES.advanced
    ? RIGHT_DOCK_EDITOR_MODES.advanced
    : RIGHT_DOCK_EDITOR_MODES.common;
}

export function useWorkspaceEditorMode() {
  const workspaceStore = useWorkspaceStore();
  const { selectedVisualContext, hasSelectedVisualContext } = useSelectedVisualContext();

  const selectedHierarchyRef = computed(() => {
    const ref = workspaceStore.selectedHierarchyRef;
    if (!ref || typeof ref !== 'object') return null;
    const wellId = String(ref.wellId ?? '').trim();
    const entityType = String(ref.entityType ?? '').trim();
    const rowId = String(ref.rowId ?? '').trim();
    if (!wellId || !entityType || !rowId) return null;
    return {
      wellId,
      entityType,
      rowId
    };
  });

  const hasHierarchySelection = computed(() => selectedHierarchyRef.value !== null);
  const hasAnySelection = computed(() => hasSelectedVisualContext.value || hasHierarchySelection.value);

  const editorMode = computed({
    get: () => normalizeEditorMode(workspaceStore.rightDockEditorMode),
    set: (mode) => {
      workspaceStore.setRightDockEditorMode(normalizeEditorMode(mode));
    }
  });

  const activePanelKind = computed(() => {
    if (!hasAnySelection.value) return 'global';
    if (editorMode.value === RIGHT_DOCK_EDITOR_MODES.advanced) return 'advanced';
    if (hasSelectedVisualContext.value) return 'common-visual';
    return 'common-advanced';
  });

  const isAdvancedMode = computed(() => editorMode.value === RIGHT_DOCK_EDITOR_MODES.advanced);
  const isCommonMode = computed(() => !isAdvancedMode.value);
  const showEditorModeSwitch = computed(() => hasAnySelection.value);

  function setEditorMode(mode) {
    editorMode.value = mode;
  }

  watch(hasAnySelection, (hasSelection) => {
    if (hasSelection) return;
    workspaceStore.setRightDockEditorMode(RIGHT_DOCK_EDITOR_MODES.common);
  });

  return {
    editorMode,
    setEditorMode,
    isAdvancedMode,
    isCommonMode,
    showEditorModeSwitch,
    hasAnySelection,
    hasHierarchySelection,
    hasSelectedVisualContext,
    selectedVisualContext,
    selectedHierarchyRef,
    activePanelKind
  };
}
