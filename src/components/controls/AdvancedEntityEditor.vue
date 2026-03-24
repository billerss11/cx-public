<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Slider from 'primevue/slider';
import Textarea from 'primevue/textarea';
import ToggleSwitch from 'primevue/toggleswitch';
import { onLanguageChange, t } from '@/app/i18n.js';
import { useWorkspaceEditorMode } from '@/composables/useWorkspaceEditorMode.js';
import {
  useEntityEditorActions
} from '@/composables/useEntityEditorActions.js';
import { resolveSelectionRowTarget } from '@/app/selectionRowLocator.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { collectWellDepthRange } from '@/utils/depthControlRanges.js';
import {
  DATA_TAB_READ_ONLY_FIELDS_ENABLED,
  ENTITY_EDITOR_CONTROL_TYPES,
  resolveEntityEditorFieldDefinitions
} from '@/controls/entityEditor/entityFieldSchema.js';
import { resolveEquipmentRulePresentation } from '@/topology/equipmentRules.js';

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
const SLIDER_COMMIT_INTERVAL_MS = 24;
const sliderCommitTimers = new Map();
const sliderPendingValues = new Map();
const equipmentAdvancedOpen = ref(false);
const languageTick = ref(0);
let unsubscribeLanguageChange = null;

const EQUIPMENT_SECTION_LABEL_KEYS = Object.freeze({
  core: 'ui.equipment_editor.section.core',
  operating: 'ui.equipment_editor.section.operating',
  seal: 'ui.equipment_editor.section.seal'
});

const EQUIPMENT_SECTION_ORDER = Object.freeze(['core', 'operating', 'seal']);
const EQUIPMENT_PRESENTATION_NOTE_KEYS = Object.freeze({
  attach_resolution_controls_annulus_target: 'ui.equipment_editor.note.attach_resolution_controls_annulus_target',
  per_volume_override_supersedes_generic_annular: 'ui.equipment_editor.note.per_volume_override_supersedes_generic_annular',
  bridge_plug_is_bore_focused: 'ui.equipment_editor.note.bridge_plug_is_bore_focused'
});

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

const editorFieldContext = computed(() => ({
  casingRows: projectDataStore.casingData,
  tubingRows: projectDataStore.tubingData,
  drillStringRows: projectDataStore.drillStringData,
  equipmentRows: projectDataStore.equipmentData,
  horizontalLines: projectDataStore.horizontalLines,
  annotationBoxes: projectDataStore.annotationBoxes,
  cementPlugs: projectDataStore.cementPlugs,
  annulusFluids: projectDataStore.annulusFluids,
  markers: projectDataStore.markers,
  trajectory: projectDataStore.trajectory,
  depthRange: collectWellDepthRange(projectDataStore)
}));

const fieldDefinitions = computed(() => resolveEntityEditorFieldDefinitions({
  entityType: effectiveSelectionRef.value?.entityType,
  rowData: selectedRowTarget.value?.row ?? {},
  mode: props.mode,
  includeReadOnly: DATA_TAB_READ_ONLY_FIELDS_ENABLED,
  context: editorFieldContext.value
}));

const editableFieldDefinitions = computed(() => (
  fieldDefinitions.value.filter((fieldDefinition) => fieldDefinition.readOnly !== true)
));

const readOnlyFieldDefinitions = computed(() => (
  fieldDefinitions.value.filter((fieldDefinition) => fieldDefinition.readOnly === true)
));

const isEquipmentSelection = computed(() => (
  String(selectedRowTarget.value?.entityType ?? '').trim() === 'equipment'
));

const equipmentPresentation = computed(() => {
  if (!isEquipmentSelection.value) return null;
  return resolveEquipmentRulePresentation(selectedRowTarget.value?.row ?? {}, {
    casingRows: editorFieldContext.value.casingRows,
    tubingRows: editorFieldContext.value.tubingRows
  });
});

const equipmentVisibleFieldDefinitions = computed(() => (
  isEquipmentSelection.value
    ? editableFieldDefinitions.value.filter((fieldDefinition) => fieldDefinition.disclosureLevel !== 'advanced')
    : editableFieldDefinitions.value
));

const equipmentSectionGroups = computed(() => {
  if (!isEquipmentSelection.value) return [];

  return EQUIPMENT_SECTION_ORDER
    .map((sectionKey) => {
      const fields = equipmentVisibleFieldDefinitions.value.filter((fieldDefinition) => fieldDefinition.section === sectionKey);
      if (fields.length === 0) return null;
      return {
        key: sectionKey,
        label: t(EQUIPMENT_SECTION_LABEL_KEYS[sectionKey] ?? sectionKey),
        fields
      };
    })
    .filter(Boolean);
});

const equipmentAdvancedFieldDefinitions = computed(() => (
  isEquipmentSelection.value
    ? editableFieldDefinitions.value.filter((fieldDefinition) => fieldDefinition.disclosureLevel === 'advanced')
    : []
));

function formatEquipmentToken(value, emptyKey = 'ui.equipment_editor.summary.inherit_default') {
  const normalized = String(value ?? '').trim();
  if (!normalized) return t(emptyKey);
  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPresentationVolumeKey(volumeKey) {
  const normalized = String(volumeKey ?? '').trim();
  return normalized === 'TUBING_INNER' ? 'BORE' : normalized;
}

const equipmentSummaryVolumesLabel = computed(() => {
  void languageTick.value;
  const sealedVolumeKeys = Array.isArray(equipmentPresentation.value?.summary?.sealedVolumeKeys)
    ? equipmentPresentation.value.summary.sealedVolumeKeys
    : [];
  if (sealedVolumeKeys.length === 0) {
    return t('ui.equipment_editor.summary.no_seal_paths');
  }
  return sealedVolumeKeys.map((volumeKey) => formatPresentationVolumeKey(volumeKey)).join(', ');
});

function resolvePrimaryBehaviorKey(summary = {}) {
  const primaryBehavior = String(summary?.primaryBehavior ?? '').trim();
  const behaviorState = String(summary?.behaviorState ?? '').trim();
  if (primaryBehavior === 'blocking' && behaviorState === 'failed_closed') {
    return 'ui.equipment_editor.summary.behavior.failed_closed';
  }
  if (primaryBehavior === 'communicating' && behaviorState === 'leaking') {
    return 'ui.equipment_editor.summary.behavior.leaking';
  }
  if (primaryBehavior === 'blocking') {
    return 'ui.equipment_editor.summary.behavior.blocking';
  }
  if (primaryBehavior === 'communicating') {
    return 'ui.equipment_editor.summary.behavior.communicating';
  }
  return 'ui.equipment_editor.summary.behavior.no_barrier';
}

const equipmentSummaryBehaviorLabel = computed(() => {
  void languageTick.value;
  return t(resolvePrimaryBehaviorKey(equipmentPresentation.value?.summary ?? {}));
});

const equipmentSummaryStateLabel = computed(() => {
  void languageTick.value;
  if (!equipmentPresentation.value) return '';
  return t('ui.equipment_editor.summary.state', {
    actuation: formatEquipmentToken(equipmentPresentation.value.effectiveActuationState),
    integrity: formatEquipmentToken(equipmentPresentation.value.effectiveIntegrityStatus)
  });
});

const equipmentSummaryNotes = computed(() => {
  void languageTick.value;
  const notes = Array.isArray(equipmentPresentation.value?.summary?.notes)
    ? equipmentPresentation.value.summary.notes
    : [];
  return notes
    .map((note) => t(EQUIPMENT_PRESENTATION_NOTE_KEYS[note] ?? note))
    .filter((message) => String(message ?? '').trim().length > 0);
});

const equipmentPerVolumeOverrides = computed(() => {
  const sealBehaviorByVolume = equipmentPresentation.value?.sealBehaviorByVolume ?? {};
  return Object.entries(sealBehaviorByVolume)
    .filter(([, behavior]) => behavior?.source === 'per_volume_override')
    .map(([volumeKey, behavior]) => ({
      volumeKey: formatPresentationVolumeKey(volumeKey),
      state: behavior?.hasSealPath === true ? 'sealed' : 'open'
    }));
});

const showEquipmentAdvancedToggle = computed(() => (
  isEquipmentSelection.value && (
    equipmentAdvancedFieldDefinitions.value.length > 0
    || equipmentPerVolumeOverrides.value.length > 0
  )
));

const equipmentAdvancedToggleLabel = computed(() => (
  equipmentAdvancedOpen.value
    ? t('ui.equipment_editor.advanced.hide')
    : t('ui.equipment_editor.advanced.show')
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

function normalizeNumberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
    return normalizeNumberValue(value);
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

function normalizeSliderConfig(fieldDefinition) {
  const sliderConfig = fieldDefinition?.slider;
  if (!sliderConfig || typeof sliderConfig !== 'object') return null;

  const min = normalizeNumberValue(sliderConfig.min);
  const max = normalizeNumberValue(sliderConfig.max);
  const step = normalizeNumberValue(sliderConfig.step);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;

  return {
    min,
    max,
    step: Number.isFinite(step) && step > 0 ? step : 0.1
  };
}

function hasSliderControl(fieldDefinition) {
  return normalizeSliderConfig(fieldDefinition) !== null;
}

function getSliderConfig(fieldDefinition) {
  return normalizeSliderConfig(fieldDefinition);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getNumberValue(fieldDefinition) {
  return normalizeNumberValue(getDraftValue(fieldDefinition));
}

function getSliderValue(fieldDefinition) {
  const sliderConfig = getSliderConfig(fieldDefinition);
  if (!sliderConfig) return null;

  const currentValue = getNumberValue(fieldDefinition);
  if (Number.isFinite(currentValue)) {
    return clampNumber(currentValue, sliderConfig.min, sliderConfig.max);
  }

  return (sliderConfig.min + sliderConfig.max) / 2;
}

function clearSliderFieldCommit(fieldDefinition) {
  const fieldKey = String(fieldDefinition?.field ?? '').trim();
  if (!fieldKey) return;
  const existingTimer = sliderCommitTimers.get(fieldKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    sliderCommitTimers.delete(fieldKey);
  }
  sliderPendingValues.delete(fieldKey);
}

function clearSliderCommitTimers() {
  sliderCommitTimers.forEach((timerId) => {
    clearTimeout(timerId);
  });
  sliderCommitTimers.clear();
  sliderPendingValues.clear();
}

function queueSliderFieldCommit(fieldDefinition, value) {
  const fieldKey = String(fieldDefinition?.field ?? '').trim();
  if (!fieldKey) return;

  sliderPendingValues.set(fieldKey, value);
  if (sliderCommitTimers.has(fieldKey)) return;

  const timerId = setTimeout(() => {
    sliderCommitTimers.delete(fieldKey);
    const pendingValue = sliderPendingValues.get(fieldKey);
    sliderPendingValues.delete(fieldKey);
    if (!Number.isFinite(normalizeNumberValue(pendingValue))) return;
    commitField(fieldDefinition);
  }, SLIDER_COMMIT_INTERVAL_MS);

  sliderCommitTimers.set(fieldKey, timerId);
}

function flushSliderFieldCommit(fieldDefinition) {
  const fieldKey = String(fieldDefinition?.field ?? '').trim();
  if (!fieldKey) return;

  const existingTimer = sliderCommitTimers.get(fieldKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    sliderCommitTimers.delete(fieldKey);
  }
  sliderPendingValues.delete(fieldKey);
  commitField(fieldDefinition);
}

function resolveSliderCommitValue(fieldDefinition, eventOrValue) {
  const sliderConfig = getSliderConfig(fieldDefinition);
  if (!sliderConfig) return null;
  const nextValue = normalizeNumberValue(eventOrValue?.value ?? eventOrValue);
  if (!Number.isFinite(nextValue)) return null;
  return clampNumber(nextValue, sliderConfig.min, sliderConfig.max);
}

function updateNumberFieldDraft(fieldDefinition, value) {
  setDraftValue(fieldDefinition, normalizeNumberValue(value));
}

function updateNumberFieldBySlider(fieldDefinition, eventOrValue) {
  const nextValue = resolveSliderCommitValue(fieldDefinition, eventOrValue);
  if (!Number.isFinite(nextValue)) return;
  setDraftValue(fieldDefinition, nextValue);
  queueSliderFieldCommit(fieldDefinition, nextValue);
}

function commitNumberFieldBySlider(fieldDefinition, eventOrValue) {
  const nextValue = resolveSliderCommitValue(fieldDefinition, eventOrValue);
  if (Number.isFinite(nextValue)) {
    setDraftValue(fieldDefinition, nextValue);
  }
  flushSliderFieldCommit(fieldDefinition);
}

function commitNumberField(fieldDefinition) {
  clearSliderFieldCommit(fieldDefinition);
  commitField(fieldDefinition);
}

function resolveStepFractionDigits(step) {
  const normalizedStep = Number(step);
  if (!Number.isFinite(normalizedStep) || normalizedStep <= 0) return null;
  if (Number.isInteger(normalizedStep)) return 0;

  let scaled = normalizedStep;
  let digits = 0;
  while (digits < 6 && Math.abs(Math.round(scaled) - scaled) > 1e-8) {
    scaled *= 10;
    digits += 1;
  }
  return digits > 0 ? digits : null;
}

function getMinFractionDigits(fieldDefinition) {
  const digits = resolveStepFractionDigits(fieldDefinition?.step);
  if (!Number.isInteger(digits) || digits <= 0) return undefined;
  return digits;
}

function getMaxFractionDigits(fieldDefinition) {
  const digits = resolveStepFractionDigits(fieldDefinition?.step);
  if (!Number.isInteger(digits) || digits <= 0) return undefined;
  return Math.max(digits, 4);
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

function getEquipmentFieldHelperMessages(fieldDefinition) {
  void languageTick.value;
  if (!isEquipmentSelection.value || !fieldDefinition) return [];

  const messages = [];
  if (fieldDefinition.helperTextKey) {
    messages.push(t(fieldDefinition.helperTextKey));
  }

  const fieldBehavior = equipmentPresentation.value?.fieldBehavior?.[fieldDefinition.field];
  if (fieldBehavior?.hasSupersededVolumes) {
    messages.push(t('ui.equipment_editor.help.generic_override_superseded', {
      volumes: fieldBehavior.supersededVolumeKeys.map((volumeKey) => formatPresentationVolumeKey(volumeKey)).join(', ')
    }));
  }

  return messages.filter((message, index, source) => (
    String(message ?? '').trim().length > 0 && source.indexOf(message) === index
  ));
}

watch(
  [selectedRowTarget, fieldDefinitions],
  ([rowTarget, nextFieldDefinitions]) => {
    clearSliderCommitTimers();
    equipmentAdvancedOpen.value = false;
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

onMounted(() => {
  unsubscribeLanguageChange = onLanguageChange(() => {
    languageTick.value += 1;
  });
});

onBeforeUnmount(() => {
  clearSliderCommitTimers();
  unsubscribeLanguageChange?.();
  unsubscribeLanguageChange = null;
});
</script>

<template>
  <Card class="control-group advanced-entity-editor">
    <template #content>
      <div class="section-title">{{ t('ui.advanced_editor.title') }}</div>
      <small class="control-helper">
        {{ t('ui.advanced_editor.helper') }}
      </small>

      <div v-if="!selectedRowTarget" class="advanced-entity-editor__empty mt-2">
        {{ t('ui.advanced_editor.empty') }}
      </div>

      <template v-else>
        <section
          v-if="isEquipmentSelection && equipmentPresentation"
          class="advanced-entity-editor__summary mt-2"
          data-testid="equipment-summary-card"
        >
          <header class="advanced-entity-editor__summary-header">
            <span class="advanced-entity-editor__summary-title">
              {{ t('ui.equipment_editor.summary.title') }}
            </span>
          </header>

          <div class="advanced-entity-editor__summary-body">
            <p class="advanced-entity-editor__summary-line" data-testid="equipment-summary-volumes">
              {{ t('ui.equipment_editor.summary.sealed_volumes', { volumes: equipmentSummaryVolumesLabel }) }}
            </p>
            <p class="advanced-entity-editor__summary-line" data-testid="equipment-summary-behavior">
              {{ t('ui.equipment_editor.summary.behavior_label', { behavior: equipmentSummaryBehaviorLabel }) }}
            </p>
            <p class="advanced-entity-editor__summary-line">
              {{ equipmentSummaryStateLabel }}
            </p>
            <p class="advanced-entity-editor__summary-precedence">
              {{ t('ui.equipment_editor.summary.precedence') }}
            </p>

            <div
              v-if="equipmentPerVolumeOverrides.length > 0"
              class="advanced-entity-editor__override-chips"
            >
              <span class="advanced-entity-editor__override-label">
                {{ t('ui.equipment_editor.summary.override_label') }}
              </span>
              <span
                v-for="entry in equipmentPerVolumeOverrides"
                :key="entry.volumeKey"
                class="advanced-entity-editor__override-chip"
              >
                {{ entry.volumeKey }}: {{ t(`ui.equipment_editor.override_state.${entry.state}`) }}
              </span>
            </div>

            <ul
              v-if="equipmentSummaryNotes.length > 0"
              class="advanced-entity-editor__summary-notes"
              data-testid="equipment-summary-notes"
            >
              <li
                v-for="note in equipmentSummaryNotes"
                :key="note"
                class="advanced-entity-editor__summary-note"
              >
                {{ note }}
              </li>
            </ul>
          </div>
        </section>

        <div v-if="!isEquipmentSelection && editableFieldDefinitions.length > 0" class="advanced-entity-editor__fields mt-2">
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

            <div
              v-else-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.number"
              class="advanced-entity-editor__number-control"
            >
              <InputNumber
                :input-id="getFieldTestId(fieldDefinition.field)"
                class="w-100"
                fluid
                :data-testid="getFieldTestId(fieldDefinition.field)"
                :model-value="getDraftValue(fieldDefinition)"
                :min="fieldDefinition.min ?? undefined"
                :max="fieldDefinition.max ?? undefined"
                :step="fieldDefinition.step ?? undefined"
                :min-fraction-digits="getMinFractionDigits(fieldDefinition)"
                :max-fraction-digits="getMaxFractionDigits(fieldDefinition)"
                :use-grouping="false"
                @update:model-value="updateNumberFieldDraft(fieldDefinition, $event)"
                @blur="commitNumberField(fieldDefinition)"
                @keydown.enter.prevent="commitNumberField(fieldDefinition)"
              />

              <Slider
                v-if="hasSliderControl(fieldDefinition)"
                :model-value="getSliderValue(fieldDefinition)"
                :min="getSliderConfig(fieldDefinition)?.min"
                :max="getSliderConfig(fieldDefinition)?.max"
                :step="getSliderConfig(fieldDefinition)?.step"
                class="advanced-entity-editor__number-slider"
                @update:model-value="updateNumberFieldBySlider(fieldDefinition, $event)"
                @slideend="commitNumberFieldBySlider(fieldDefinition, $event)"
              />
            </div>

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

        <div v-if="isEquipmentSelection && equipmentSectionGroups.length > 0" class="advanced-entity-editor__equipment-groups mt-2">
          <section
            v-for="sectionGroup in equipmentSectionGroups"
            :key="sectionGroup.key"
            class="advanced-entity-editor__equipment-group"
          >
            <h4 class="advanced-entity-editor__equipment-group-title">
              {{ sectionGroup.label }}
            </h4>

            <div class="advanced-entity-editor__fields">
              <div
                v-for="fieldDefinition in sectionGroup.fields"
                :key="fieldDefinition.field"
                class="advanced-entity-editor__field"
              >
                <label class="form-label mb-1" :for="getFieldTestId(fieldDefinition.field)">
                  {{ fieldDefinition.label }}
                </label>

                <small
                  v-for="helperMessage in getEquipmentFieldHelperMessages(fieldDefinition)"
                  :key="`${fieldDefinition.field}-${helperMessage}`"
                  class="advanced-entity-editor__field-helper"
                >
                  {{ helperMessage }}
                </small>

                <InputText
                  v-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.text"
                  :id="getFieldTestId(fieldDefinition.field)"
                  class="w-100"
                  :data-testid="getFieldTestId(fieldDefinition.field)"
                  :model-value="getDraftValue(fieldDefinition)"
                  @update:model-value="setDraftValue(fieldDefinition, $event)"
                  @blur="commitField(fieldDefinition)"
                />

                <div
                  v-else-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.number"
                  class="advanced-entity-editor__number-control"
                >
                  <InputNumber
                    :input-id="getFieldTestId(fieldDefinition.field)"
                    class="w-100"
                    fluid
                    :data-testid="getFieldTestId(fieldDefinition.field)"
                    :model-value="getDraftValue(fieldDefinition)"
                    :min="fieldDefinition.min ?? undefined"
                    :max="fieldDefinition.max ?? undefined"
                    :step="fieldDefinition.step ?? undefined"
                    :min-fraction-digits="getMinFractionDigits(fieldDefinition)"
                    :max-fraction-digits="getMaxFractionDigits(fieldDefinition)"
                    :use-grouping="false"
                    @update:model-value="updateNumberFieldDraft(fieldDefinition, $event)"
                    @blur="commitNumberField(fieldDefinition)"
                    @keydown.enter.prevent="commitNumberField(fieldDefinition)"
                  />

                  <Slider
                    v-if="hasSliderControl(fieldDefinition)"
                    :model-value="getSliderValue(fieldDefinition)"
                    :min="getSliderConfig(fieldDefinition)?.min"
                    :max="getSliderConfig(fieldDefinition)?.max"
                    :step="getSliderConfig(fieldDefinition)?.step"
                    class="advanced-entity-editor__number-slider"
                    @update:model-value="updateNumberFieldBySlider(fieldDefinition, $event)"
                    @slideend="commitNumberFieldBySlider(fieldDefinition, $event)"
                  />
                </div>

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
          </section>

          <section v-if="showEquipmentAdvancedToggle" class="advanced-entity-editor__advanced mt-2">
            <Button
              type="button"
              size="small"
              text
              :label="equipmentAdvancedToggleLabel"
              data-testid="equipment-advanced-toggle"
              @click="equipmentAdvancedOpen = !equipmentAdvancedOpen"
            />

            <div
              v-if="equipmentAdvancedOpen"
              class="advanced-entity-editor__advanced-panel"
              data-testid="equipment-advanced-panel"
            >
              <div v-if="equipmentAdvancedFieldDefinitions.length > 0" class="advanced-entity-editor__fields">
                <div
                  v-for="fieldDefinition in equipmentAdvancedFieldDefinitions"
                  :key="fieldDefinition.field"
                  class="advanced-entity-editor__field"
                >
                  <label class="form-label mb-1" :for="getFieldTestId(fieldDefinition.field)">
                    {{ fieldDefinition.label }}
                  </label>

                  <small
                    v-for="helperMessage in getEquipmentFieldHelperMessages(fieldDefinition)"
                    :key="`${fieldDefinition.field}-${helperMessage}`"
                    class="advanced-entity-editor__field-helper"
                  >
                    {{ helperMessage }}
                  </small>

                  <Select
                    v-if="fieldDefinition.controlType === ENTITY_EDITOR_CONTROL_TYPES.select"
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

              <div
                v-if="equipmentPerVolumeOverrides.length > 0"
                class="advanced-entity-editor__advanced-summary"
              >
                <span class="advanced-entity-editor__advanced-summary-title">
                  {{ t('ui.equipment_editor.advanced.override_summary') }}
                </span>
                <div class="advanced-entity-editor__override-chips">
                  <span
                    v-for="entry in equipmentPerVolumeOverrides"
                    :key="`advanced-${entry.volumeKey}`"
                    class="advanced-entity-editor__override-chip"
                  >
                    {{ entry.volumeKey }}: {{ t(`ui.equipment_editor.override_state.${entry.state}`) }}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section v-if="readOnlyFieldDefinitions.length > 0" class="advanced-entity-editor__readonly mt-3">
          <header class="advanced-entity-editor__readonly-header">
            <span class="pi pi-lock advanced-entity-editor__readonly-icon" aria-hidden="true"></span>
            <span class="advanced-entity-editor__readonly-title">{{ t('ui.advanced_editor.read_only.title') }}</span>
          </header>
          <small class="advanced-entity-editor__readonly-helper">
            {{ t('ui.advanced_editor.read_only.helper') }}
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

.advanced-entity-editor__equipment-groups {
  display: grid;
  gap: 12px;
}

.advanced-entity-editor__equipment-group {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 10px 12px;
}

.advanced-entity-editor__equipment-group-title {
  margin: 0 0 10px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.advanced-entity-editor__field-helper {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.advanced-entity-editor__number-control {
  display: grid;
  gap: 6px;
}

.advanced-entity-editor__number-slider {
  width: 100%;
}

.advanced-entity-editor__textarea {
  min-height: 72px;
}

.advanced-entity-editor__summary {
  border: 1px solid color-mix(in srgb, var(--line) 85%, var(--ink) 15%);
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, var(--color-surface-subtle), var(--color-surface-elevated));
  padding: 10px 12px;
}

.advanced-entity-editor__summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.advanced-entity-editor__summary-title {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink);
}

.advanced-entity-editor__summary-body {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.advanced-entity-editor__summary-line,
.advanced-entity-editor__summary-precedence {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.4;
}

.advanced-entity-editor__summary-precedence {
  color: var(--muted);
}

.advanced-entity-editor__summary-notes {
  margin: 2px 0 0;
  padding-left: 16px;
}

.advanced-entity-editor__summary-note {
  font-size: 0.82rem;
  line-height: 1.35;
}

.advanced-entity-editor__advanced {
  display: grid;
  gap: 8px;
}

.advanced-entity-editor__advanced-panel {
  border: 1px dashed var(--line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-surface-panel) 92%, var(--color-surface-elevated) 8%);
  padding: 10px 12px;
}

.advanced-entity-editor__advanced-summary {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.advanced-entity-editor__advanced-summary-title,
.advanced-entity-editor__override-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--muted);
}

.advanced-entity-editor__override-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.advanced-entity-editor__override-chip {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-surface-panel) 78%, var(--ink) 22%);
  padding: 3px 8px;
  font-size: 0.78rem;
  line-height: 1.25;
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
