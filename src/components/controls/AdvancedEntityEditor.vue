<script setup>
import { computed, reactive, watch } from 'vue';
import { useWorkspaceEditorMode } from '@/composables/useWorkspaceEditorMode.js';
import {
  resolveEntityEditorDomainKey,
  useEntityEditorActions
} from '@/composables/useEntityEditorActions.js';
import { resolveSelectionRowTarget } from '@/app/selectionRowLocator.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';
import {
  ENTITY_EDITOR_CONTROL_TYPES,
  resolveEntityEditorFieldDefinitions
} from '@/controls/entityEditor/entityFieldSchema.js';
import { resolveHierarchyRowsForDomain } from '@/workspace/hierarchyDomainMeta.js';

const props = defineProps({
  mode: {
    type: String,
    default: 'advanced'
  }
});

const workspaceStore = useWorkspaceStore();
const projectStore = useProjectStore();
const projectDataStore = useProjectDataStore();
const { selectedHierarchyRef, selectedVisualContext } = useWorkspaceEditorMode();
const { updateField, addRow, duplicateRow, deleteRow, moveRow } = useEntityEditorActions();
const draftValues = reactive({});

function normalizeRowRef(value) {
  if (!value || typeof value !== 'object') return null;
  const wellId = String(value.wellId ?? '').trim();
  const entityType = String(value.entityType ?? '').trim();
  const rowId = String(value.rowId ?? '').trim();
  if (!wellId || !entityType || !rowId) return null;
  return {
    wellId,
    entityType,
    rowId
  };
}

const effectiveSelectionRef = computed(() => {
  const hierarchyRef = normalizeRowRef(selectedHierarchyRef.value);
  if (hierarchyRef) return hierarchyRef;

  const visualContext = selectedVisualContext.value;
  const rowId = String(visualContext?.rowData?.rowId ?? '').trim();
  const entityType = String(visualContext?.elementType ?? '').trim();
  const wellId = String(projectStore.activeWellId ?? '').trim();
  if (!wellId || !entityType || !rowId) return null;
  return {
    wellId,
    entityType,
    rowId
  };
});

const selectedRowTarget = computed(() => {
  const selectionRef = effectiveSelectionRef.value;
  if (!selectionRef) return null;
  return resolveSelectionRowTarget(projectDataStore, selectionRef);
});

const fieldDefinitions = computed(() => resolveEntityEditorFieldDefinitions({
  entityType: effectiveSelectionRef.value?.entityType,
  rowData: selectedRowTarget.value?.row ?? {},
  mode: props.mode
}));

const selectedDomainRows = computed(() => {
  const selectionRef = effectiveSelectionRef.value;
  const domainKey = resolveEntityEditorDomainKey(selectionRef?.entityType);
  if (!domainKey) return [];
  return resolveHierarchyRowsForDomain(domainKey, projectDataStore);
});

const canMoveUp = computed(() => {
  const index = selectedRowTarget.value?.domainRowIndex;
  return Number.isInteger(index) && index > 0;
});

const canMoveDown = computed(() => {
  const index = selectedRowTarget.value?.domainRowIndex;
  if (!Number.isInteger(index)) return false;
  return index < selectedDomainRows.value.length - 1;
});

function getFieldTestId(fieldName) {
  const token = String(fieldName ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `advanced-field-${token}`;
}

function getDraftValue(fieldDefinition) {
  return draftValues[fieldDefinition.field];
}

function setDraftValue(fieldDefinition, value) {
  draftValues[fieldDefinition.field] = value;
}

function normalizeCommittedValue(fieldDefinition, value) {
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.number) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.toggle) {
    return value === true;
  }
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.json) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    try {
      return JSON.parse(normalized);
    } catch (_error) {
      return selectedRowTarget.value?.row?.[fieldDefinition.field] ?? null;
    }
  }
  return String(value ?? '');
}

function commitField(fieldDefinition) {
  const selectionRef = effectiveSelectionRef.value;
  if (!selectionRef) return;

  const nextValue = normalizeCommittedValue(fieldDefinition, getDraftValue(fieldDefinition));
  updateField({
    entityType: selectionRef.entityType,
    rowId: selectionRef.rowId,
    field: fieldDefinition.field,
    value: nextValue
  });
}

function handleAddRow() {
  const selectionRef = effectiveSelectionRef.value;
  const entityType = selectionRef?.entityType ?? 'casing';
  const nextRowId = addRow({
    entityType,
    afterRowId: selectionRef?.rowId ?? null
  });
  if (!nextRowId || !selectionRef?.wellId) return;
  workspaceStore.setSelectedHierarchyRef({
    wellId: selectionRef.wellId,
    entityType,
    rowId: nextRowId
  });
}

function handleDuplicateRow() {
  const selectionRef = effectiveSelectionRef.value;
  if (!selectionRef) return;
  const nextRowId = duplicateRow({
    entityType: selectionRef.entityType,
    rowId: selectionRef.rowId
  });
  if (!nextRowId) return;
  workspaceStore.setSelectedHierarchyRef({
    wellId: selectionRef.wellId,
    entityType: selectionRef.entityType,
    rowId: nextRowId
  });
}

function handleDeleteRow() {
  const selectionRef = effectiveSelectionRef.value;
  if (!selectionRef) return;
  const didDelete = deleteRow({
    entityType: selectionRef.entityType,
    rowId: selectionRef.rowId
  });
  if (!didDelete) return;
  workspaceStore.clearSelectedHierarchyRef();
}

function handleMove(direction) {
  const selectionRef = effectiveSelectionRef.value;
  if (!selectionRef) return;
  moveRow({
    entityType: selectionRef.entityType,
    rowId: selectionRef.rowId,
    direction
  });
}

watch(
  [selectedRowTarget, fieldDefinitions],
  ([rowTarget, nextFieldDefinitions]) => {
    nextFieldDefinitions.forEach((fieldDefinition) => {
      const currentValue = rowTarget?.row?.[fieldDefinition.field];
      if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.json) {
        draftValues[fieldDefinition.field] = currentValue ? JSON.stringify(currentValue, null, 2) : '';
        return;
      }
      draftValues[fieldDefinition.field] = currentValue ?? (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.toggle ? false : '');
    });
  },
  { immediate: true }
);
</script>

<template>
  <Card class="control-group advanced-entity-editor">
    <template #content>
      <div class="section-title">{{ props.mode === 'advanced' ? 'Advanced Entity Editor' : 'Entity Editor' }}</div>
      <small class="control-helper">Select an item from the hierarchy to edit its fields.</small>

      <div v-if="!selectedRowTarget" class="advanced-entity-editor__empty mt-2">
        No hierarchy item is selected.
      </div>

      <template v-else>
        <div class="advanced-entity-editor__actions mt-2">
          <Button type="button" size="small" icon="pi pi-plus" label="Add" @click="handleAddRow" />
          <Button type="button" size="small" icon="pi pi-copy" label="Duplicate" @click="handleDuplicateRow" />
          <Button type="button" size="small" icon="pi pi-arrow-up" label="Up" :disabled="!canMoveUp" @click="handleMove('up')" />
          <Button type="button" size="small" icon="pi pi-arrow-down" label="Down" :disabled="!canMoveDown" @click="handleMove('down')" />
          <Button type="button" size="small" severity="danger" icon="pi pi-trash" label="Delete" @click="handleDeleteRow" />
        </div>

        <div class="advanced-entity-editor__fields mt-2">
          <div
            v-for="fieldDefinition in fieldDefinitions"
            :key="fieldDefinition.field"
            class="advanced-entity-editor__field"
          >
            <label class="form-label mb-1" :for="getFieldTestId(fieldDefinition.field)">
              {{ fieldDefinition.label }}
            </label>

            <input
              v-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.text"
              :id="getFieldTestId(fieldDefinition.field)"
              class="form-control"
              :data-testid="getFieldTestId(fieldDefinition.field)"
              :value="getDraftValue(fieldDefinition)"
              @input="setDraftValue(fieldDefinition, $event.target.value)"
              @blur="commitField(fieldDefinition)"
            />

            <input
              v-else-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.number"
              :id="getFieldTestId(fieldDefinition.field)"
              class="form-control"
              type="number"
              :data-testid="getFieldTestId(fieldDefinition.field)"
              :value="getDraftValue(fieldDefinition)"
              @input="setDraftValue(fieldDefinition, $event.target.value)"
              @blur="commitField(fieldDefinition)"
            />

            <input
              v-else-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.toggle"
              :id="getFieldTestId(fieldDefinition.field)"
              type="checkbox"
              class="form-check-input"
              :data-testid="getFieldTestId(fieldDefinition.field)"
              :checked="getDraftValue(fieldDefinition) === true"
              @change="setDraftValue(fieldDefinition, $event.target.checked); commitField(fieldDefinition)"
            />

            <textarea
              v-else
              :id="getFieldTestId(fieldDefinition.field)"
              class="form-control"
              rows="3"
              :data-testid="getFieldTestId(fieldDefinition.field)"
              :value="getDraftValue(fieldDefinition)"
              @input="setDraftValue(fieldDefinition, $event.target.value)"
              @blur="commitField(fieldDefinition)"
            ></textarea>
          </div>
        </div>
      </template>
    </template>
  </Card>
</template>

<style scoped>
.advanced-entity-editor__empty {
  border: 1px dashed var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 10px 12px;
  color: var(--muted);
  font-size: 0.84rem;
}

.advanced-entity-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.advanced-entity-editor__fields {
  display: grid;
  gap: 10px;
}
</style>
