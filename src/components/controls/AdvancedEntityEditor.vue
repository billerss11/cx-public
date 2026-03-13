<script setup>
import { computed, reactive, watch } from 'vue';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { useWorkspaceEditorMode } from '@/composables/useWorkspaceEditorMode.js';
import {
  useEntityEditorActions
} from '@/composables/useEntityEditorActions.js';
import { resolveSelectionRowTarget } from '@/app/selectionRowLocator.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import {
  DATA_TAB_READ_ONLY_FIELDS_ENABLED,
  ENTITY_EDITOR_CONTROL_TYPES,
  resolveEntityEditorFieldDefinitions
} from '@/controls/entityEditor/entityFieldSchema.js';

const props = defineProps({
  mode: {
    type: String,
    default: 'advanced'
  }
});

const projectStore = useProjectStore();
const projectDataStore = useProjectDataStore();
const { selectedHierarchyRef, selectedVisualContext } = useWorkspaceEditorMode();
const { updateField } = useEntityEditorActions();
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
  mode: props.mode,
  includeReadOnly: DATA_TAB_READ_ONLY_FIELDS_ENABLED,
  context: {
    casingRows: projectDataStore.casingData,
    tubingRows: projectDataStore.tubingData
  }
}));

const editableFieldDefinitions = computed(() => (
  fieldDefinitions.value.filter((fieldDefinition) => fieldDefinition.readOnly !== true)
));

const readOnlyFieldDefinitions = computed(() => (
  fieldDefinitions.value.filter((fieldDefinition) => fieldDefinition.readOnly === true)
));

function toFieldToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function getFieldTestId(fieldName) {
  return `advanced-field-${toFieldToken(fieldName)}`;
}

function getReadOnlyFieldTestId(fieldName) {
  return `advanced-readonly-${toFieldToken(fieldName)}`;
}

function getDraftValue(fieldDefinition) {
  return draftValues[fieldDefinition.field];
}

function setDraftValue(fieldDefinition, value) {
  draftValues[fieldDefinition.field] = value;
}

function getNestedFieldValue(source, fieldPath) {
  const target = source && typeof source === 'object' ? source : null;
  const pathTokens = String(fieldPath ?? '')
    .split('.')
    .map((token) => String(token ?? '').trim())
    .filter((token) => token.length > 0);
  if (!target || pathTokens.length === 0) return null;

  let cursor = target;
  for (const token of pathTokens) {
    if (!cursor || typeof cursor !== 'object' || !(token in cursor)) return null;
    cursor = cursor[token];
  }
  return cursor ?? null;
}

function normalizeCommittedValue(fieldDefinition, value) {
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.number) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.toggle) {
    return value === true;
  }
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.select) {
    if (value === null || value === undefined) return null;
    if (value === '') return '';
    return value;
  }
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.json) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    try {
      return JSON.parse(normalized);
    } catch (_error) {
      return getNestedFieldValue(selectedRowTarget.value?.row, fieldDefinition.field);
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

function getFieldOptions(fieldDefinition) {
  if (fieldDefinition.controlType !== ENTITY_EDITOR_CONTROL_TYPES.select) return [];
  return Array.isArray(fieldDefinition.options) ? fieldDefinition.options : [];
}

function resolveReadOnlySelectLabel(fieldDefinition, value) {
  const options = getFieldOptions(fieldDefinition);
  const matchedOption = options.find((option) => option.value === value);
  return String(matchedOption?.label ?? value ?? '').trim();
}

function getReadOnlyDisplayValue(fieldDefinition) {
  const rawValue = getNestedFieldValue(selectedRowTarget.value?.row, fieldDefinition.field);
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.select) {
    const label = resolveReadOnlySelectLabel(fieldDefinition, rawValue);
    return label || 'N/A';
  }
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.toggle) {
    return rawValue === true ? 'True' : 'False';
  }
  if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.json) {
    if (!rawValue || typeof rawValue !== 'object') return 'N/A';
    return JSON.stringify(rawValue, null, 2);
  }
  if (rawValue === null || rawValue === undefined || rawValue === '') return 'N/A';
  return String(rawValue);
}

watch(
  [selectedRowTarget, fieldDefinitions],
  ([rowTarget, nextFieldDefinitions]) => {
    nextFieldDefinitions.forEach((fieldDefinition) => {
      const currentValue = getNestedFieldValue(rowTarget?.row, fieldDefinition.field);
      if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.json) {
        draftValues[fieldDefinition.field] = currentValue ? JSON.stringify(currentValue, null, 2) : '';
        return;
      }
      if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.toggle) {
        draftValues[fieldDefinition.field] = currentValue === true;
        return;
      }
      if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.number) {
        draftValues[fieldDefinition.field] = currentValue ?? null;
        return;
      }
      if (fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.select) {
        draftValues[fieldDefinition.field] = currentValue ?? null;
        return;
      }
      draftValues[fieldDefinition.field] = currentValue ?? '';
    });
  },
  { immediate: true }
);
</script>

<template>
  <Card class="control-group advanced-entity-editor">
    <template #content>
      <div class="section-title">Data Editor</div>
      <small class="control-helper">
        Select an item from the hierarchy to edit non-visual engineering data.
      </small>

      <div v-if="!selectedRowTarget" class="advanced-entity-editor__empty mt-2">
        No hierarchy item is selected.
      </div>

      <template v-else>
        <div v-if="editableFieldDefinitions.length > 0" class="advanced-entity-editor__fields mt-2">
          <div
            v-for="fieldDefinition in editableFieldDefinitions"
            :key="fieldDefinition.field"
            class="advanced-entity-editor__field"
          >
            <label class="form-label mb-1" :for="getFieldTestId(fieldDefinition.field)">
              {{ fieldDefinition.label }}
            </label>

            <InputText
              v-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.text"
              :id="getFieldTestId(fieldDefinition.field)"
              class="w-100"
              :data-testid="getFieldTestId(fieldDefinition.field)"
              :model-value="getDraftValue(fieldDefinition)"
              @update:model-value="setDraftValue(fieldDefinition, $event)"
              @blur="commitField(fieldDefinition)"
            />

            <InputNumber
              v-else-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.number"
              :input-id="getFieldTestId(fieldDefinition.field)"
              class="w-100"
              fluid
              :data-testid="getFieldTestId(fieldDefinition.field)"
              :model-value="getDraftValue(fieldDefinition)"
              :use-grouping="false"
              @update:model-value="setDraftValue(fieldDefinition, $event)"
              @blur="commitField(fieldDefinition)"
              @keydown.enter.prevent="commitField(fieldDefinition)"
            />

            <div
              v-else-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.toggle"
              class="d-flex align-items-center gap-2"
            >
              <ToggleSwitch
                :input-id="getFieldTestId(fieldDefinition.field)"
                :data-testid="getFieldTestId(fieldDefinition.field)"
                :model-value="getDraftValue(fieldDefinition) === true"
                @update:model-value="setDraftValue(fieldDefinition, $event); commitField(fieldDefinition)"
              />
            </div>

            <Select
              v-else-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.select"
              :input-id="getFieldTestId(fieldDefinition.field)"
              :model-value="getDraftValue(fieldDefinition)"
              :options="getFieldOptions(fieldDefinition)"
              option-label="label"
              option-value="value"
              class="w-100"
              :data-testid="getFieldTestId(fieldDefinition.field)"
              @update:model-value="setDraftValue(fieldDefinition, $event); commitField(fieldDefinition)"
            />

            <Textarea
              v-else
              :id="getFieldTestId(fieldDefinition.field)"
              class="w-100 advanced-entity-editor__textarea"
              rows="3"
              :data-testid="getFieldTestId(fieldDefinition.field)"
              :model-value="getDraftValue(fieldDefinition)"
              auto-resize
              @update:model-value="setDraftValue(fieldDefinition, $event)"
              @blur="commitField(fieldDefinition)"
            />
          </div>
        </div>

        <section v-if="readOnlyFieldDefinitions.length > 0" class="advanced-entity-editor__readonly mt-3">
          <header class="advanced-entity-editor__readonly-header">
            <span class="pi pi-lock advanced-entity-editor__readonly-icon" aria-hidden="true"></span>
            <span class="advanced-entity-editor__readonly-title">Read-only Transparency</span>
          </header>
          <small class="advanced-entity-editor__readonly-helper">
            Internal data is shown for inspection only.
          </small>

          <div class="advanced-entity-editor__readonly-fields mt-2">
            <div
              v-for="fieldDefinition in readOnlyFieldDefinitions"
              :key="fieldDefinition.field"
              class="advanced-entity-editor__field advanced-entity-editor__field--readonly"
            >
              <label class="form-label mb-1" :for="getReadOnlyFieldTestId(fieldDefinition.field)">
                {{ fieldDefinition.label }}
              </label>

              <pre
                v-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.json"
                :id="getReadOnlyFieldTestId(fieldDefinition.field)"
                class="advanced-entity-editor__readonly-json"
                :data-testid="getReadOnlyFieldTestId(fieldDefinition.field)"
              >{{ getReadOnlyDisplayValue(fieldDefinition) }}</pre>

              <div
                v-else
                :id="getReadOnlyFieldTestId(fieldDefinition.field)"
                class="advanced-entity-editor__readonly-value"
                :data-testid="getReadOnlyFieldTestId(fieldDefinition.field)"
              >
                {{ getReadOnlyDisplayValue(fieldDefinition) }}
              </div>
            </div>
          </div>
        </section>
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

.advanced-entity-editor__fields {
  display: grid;
  gap: 10px;
}

.advanced-entity-editor__textarea {
  min-height: 72px;
}

.advanced-entity-editor__readonly {
  border: 1px dashed color-mix(in srgb, var(--line) 75%, var(--ink) 25%);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-surface-elevated) 90%, black 10%);
  padding: 10px 12px;
}

.advanced-entity-editor__readonly-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.advanced-entity-editor__readonly-icon {
  font-size: 0.8rem;
  color: var(--muted);
}

.advanced-entity-editor__readonly-title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.advanced-entity-editor__readonly-helper {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.78rem;
}

.advanced-entity-editor__readonly-fields {
  display: grid;
  gap: 10px;
}

.advanced-entity-editor__field--readonly .form-label {
  color: var(--muted);
}

.advanced-entity-editor__readonly-value {
  border: 1px solid color-mix(in srgb, var(--line) 65%, var(--ink) 35%);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-surface-panel) 88%, black 12%);
  color: var(--ink);
  font-size: 0.84rem;
  line-height: 1.4;
  padding: 8px 10px;
  min-height: 38px;
  white-space: pre-wrap;
  word-break: break-word;
}

.advanced-entity-editor__readonly-json {
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--line) 65%, var(--ink) 35%);
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-surface-panel) 88%, black 12%);
  color: var(--ink);
  font-size: 0.84rem;
  line-height: 1.4;
  padding: 8px 10px;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
