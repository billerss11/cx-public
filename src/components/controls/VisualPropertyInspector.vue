<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import { onLanguageChange, t } from '@/app/i18n.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useSelectedVisualContext } from '@/composables/useSelectedVisualContext.js';
import {
  getVisualInspectorFields,
  VISUAL_INSPECTOR_CONTROL_TYPES
} from './visualInspectorSchema.js';

const ELEMENT_LABEL_KEYS = Object.freeze({
  casing: 'ui.visual_inspector.element.casing',
  tubing: 'ui.visual_inspector.element.tubing',
  drillString: 'ui.visual_inspector.element.drill_string',
  equipment: 'ui.tabs.equipment',
  line: 'ui.visual_inspector.element.line',
  plug: 'ui.visual_inspector.element.plug',
  fluid: 'ui.visual_inspector.element.fluid',
  marker: 'ui.visual_inspector.element.marker',
  box: 'ui.visual_inspector.element.box'
});
const ELEMENT_LABEL_FALLBACKS = Object.freeze({
  equipment: 'Equipment'
});

const projectDataStore = useProjectDataStore();
const { selectedVisualContext, hasSelectedVisualContext } = useSelectedVisualContext();
const languageTick = ref(0);
const formState = reactive({});
const SLIDER_COMMIT_INTERVAL_MS = 24;
const sliderCommitTimers = new Map();
const sliderPendingValues = new Map();
let unsubscribeLanguageChange = null;

const inspectorFields = computed(() => {
  void languageTick.value;
  const context = selectedVisualContext.value ?? null;
  const elementType = context?.elementType ?? null;
  return getVisualInspectorFields(elementType, context);
});
const inspectorFieldGroups = computed(() => {
  const fields = inspectorFields.value;
  if (fields.length === 0) return [];
  return [{
    key: 'default',
    labelKey: null,
    fields
  }];
});

const selectedElementLabelKey = computed(() => (
  ELEMENT_LABEL_KEYS[selectedVisualContext.value?.elementType] ?? null
));

const selectedElementLabel = computed(() => {
  void languageTick.value;
  const key = selectedElementLabelKey.value;
  if (!key) return '';
  const translated = t(key);
  if (translated !== key) return translated;
  const elementType = selectedVisualContext.value?.elementType ?? null;
  return ELEMENT_LABEL_FALLBACKS[elementType] ?? key;
});

function toDisplayText(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveSelectedElementName(context) {
  const rowData = context?.rowData;
  const elementType = context?.elementType;
  if (!rowData || typeof rowData !== 'object') return null;

  const preferredFieldsByType = {
    casing: ['label', 'idOverride', 'grade'],
    tubing: ['label', 'idOverride', 'componentType', 'grade'],
    drillString: ['label', 'idOverride', 'componentType', 'grade'],
    equipment: ['label', 'type'],
    line: ['label'],
    plug: ['label', 'type', 'attachToRow'],
    fluid: ['label', 'placement'],
    marker: ['label', 'type', 'attachToRow'],
    box: ['label', 'detail']
  };

  const preferredFields = preferredFieldsByType[elementType] ?? ['label', 'name', 'type'];
  for (const field of preferredFields) {
    const value = toDisplayText(rowData[field]);
    if (value) return value;
  }

  return null;
}

const selectedElementDescriptor = computed(() => {
  void languageTick.value;
  const context = selectedVisualContext.value;
  const typeLabel = selectedElementLabel.value;
  if (!context || !typeLabel) return '';

  const rowToken = `#${context.rowIndex + 1}`;
  const readableName = resolveSelectedElementName(context);
  if (!readableName) return `${typeLabel} ${rowToken}`;
  return `${readableName} (${typeLabel} ${rowToken})`;
});

function resolveFieldPathTokens(fieldName) {
  return String(fieldName ?? '')
    .split('.')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function resolveValueByPath(source, fieldName) {
  const tokens = resolveFieldPathTokens(fieldName);
  if (tokens.length === 0) return undefined;

  let cursor = source;
  for (const token of tokens) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = cursor[token];
  }
  return cursor;
}

function clearFormState() {
  Object.keys(formState).forEach((field) => {
    delete formState[field];
  });
}

function resolveContextFieldValue(context, fieldDefinition) {
  const rowValue = resolveValueByPath(context?.rowData ?? null, fieldDefinition.field);
  if (rowValue !== undefined && rowValue !== null) return rowValue;
  if (fieldDefinition.defaultValue !== undefined) return fieldDefinition.defaultValue;
  if (rowValue !== undefined) return rowValue;
  return fieldDefinition.defaultValue;
}

function syncFormStateFromContext(context) {
  clearFormState();
  if (!context) return;
  inspectorFields.value.forEach((fieldDefinition) => {
    formState[fieldDefinition.field] = resolveContextFieldValue(context, fieldDefinition);
  });
}

function getFieldValue(fieldDefinition) {
  return formState[fieldDefinition.field];
}

function getToggleValue(fieldDefinition) {
  const value = getFieldValue(fieldDefinition);
  if (value === undefined) {
    return fieldDefinition.defaultValue === true;
  }
  return value === true;
}

function getNumberValue(fieldDefinition) {
  return normalizeNumberValue(getFieldValue(fieldDefinition));
}

function getNumberInputValue(fieldDefinition) {
  const currentValue = getNumberValue(fieldDefinition);
  if (Number.isFinite(currentValue)) return currentValue;
  if (!hasSliderControl(fieldDefinition)) return null;
  return getSliderValue(fieldDefinition);
}

function getFieldOptions(fieldDefinition) {
  if (typeof fieldDefinition.options !== 'function') return [];
  return fieldDefinition.options({
    currentValue: getFieldValue(fieldDefinition),
    context: selectedVisualContext.value
  });
}

function getSelectedOption(fieldDefinition) {
  const value = getFieldValue(fieldDefinition);
  return getFieldOptions(fieldDefinition).find((option) => option.value === value) ?? null;
}

function getFieldInputId(field) {
  return `visual-inspector-${field}`;
}

function normalizeNumberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTextValue(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeFieldValue(fieldDefinition, value) {
  if (fieldDefinition.controlType === VISUAL_INSPECTOR_CONTROL_TYPES.toggle) {
    return value === true;
  }
  if (fieldDefinition.controlType === VISUAL_INSPECTOR_CONTROL_TYPES.number) {
    return normalizeNumberValue(value);
  }
  return normalizeTextValue(value);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSliderConfig(rawConfig, fieldDefinition) {
  if (!rawConfig || typeof rawConfig !== 'object') return null;
  const min = Number(rawConfig.min);
  const max = Number(rawConfig.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || Object.is(min, max)) return null;

  const normalizedMin = Math.min(min, max);
  const normalizedMax = Math.max(min, max);
  const fallbackStep = Number(fieldDefinition.step);
  const rawStep = Number(rawConfig.step);
  const normalizedStep = Number.isFinite(rawStep) && rawStep > 0
    ? rawStep
    : (Number.isFinite(fallbackStep) && fallbackStep > 0 ? fallbackStep : 0.1);

  return {
    min: normalizedMin,
    max: normalizedMax,
    step: normalizedStep
  };
}

function resolveBoundedSliderConfig(fieldDefinition) {
  const min = fieldDefinition.min;
  const max = fieldDefinition.max;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  return normalizeSliderConfig({
    min,
    max,
    step: fieldDefinition.step
  }, fieldDefinition);
}

function resolveSliderConfig(fieldDefinition, context) {
  const slider = fieldDefinition.slider;
  const boundedSliderConfig = resolveBoundedSliderConfig(fieldDefinition);
  if (!slider) return boundedSliderConfig;

  const sliderConfig = typeof slider === 'function'
    ? slider({
      context,
      rowData: context?.rowData ?? null,
      currentValue: getFieldValue(fieldDefinition)
    })
    : slider;

  return normalizeSliderConfig(sliderConfig, fieldDefinition) ?? boundedSliderConfig;
}

const sliderConfigsByField = computed(() => {
  const context = selectedVisualContext.value;
  const entries = new Map();
  inspectorFields.value.forEach((fieldDefinition) => {
    const config = resolveSliderConfig(fieldDefinition, context);
    if (config) {
      entries.set(fieldDefinition.field, config);
    }
  });
  return entries;
});

function getSliderConfig(fieldDefinition) {
  return sliderConfigsByField.value.get(fieldDefinition.field) ?? null;
}

function hasSliderControl(fieldDefinition) {
  return sliderConfigsByField.value.has(fieldDefinition.field);
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

function readSliderEventValue(eventOrValue) {
  return eventOrValue?.value ?? eventOrValue;
}

function resolveSliderCommitValue(fieldDefinition, eventOrValue) {
  const sliderConfig = getSliderConfig(fieldDefinition);
  if (!sliderConfig) return null;
  const numericValue = normalizeNumberValue(readSliderEventValue(eventOrValue));
  if (!Number.isFinite(numericValue)) return null;
  return clampNumber(numericValue, sliderConfig.min, sliderConfig.max);
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
    patchSelectedField(fieldDefinition, pendingValue);
  }, SLIDER_COMMIT_INTERVAL_MS);
  sliderCommitTimers.set(fieldKey, timerId);
}

function flushSliderFieldCommit(fieldDefinition, value) {
  const fieldKey = String(fieldDefinition?.field ?? '').trim();
  if (!fieldKey) return;
  const existingTimer = sliderCommitTimers.get(fieldKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    sliderCommitTimers.delete(fieldKey);
  }
  sliderPendingValues.delete(fieldKey);
  patchSelectedField(fieldDefinition, value);
}

function updateNumberFieldBySlider(fieldDefinition, eventOrValue) {
  const nextValue = resolveSliderCommitValue(fieldDefinition, eventOrValue);
  if (!Number.isFinite(nextValue)) return;
  formState[fieldDefinition.field] = nextValue;
  queueSliderFieldCommit(fieldDefinition, nextValue);
}

function commitNumberFieldBySlider(fieldDefinition, eventOrValue) {
  const nextValue = resolveSliderCommitValue(fieldDefinition, eventOrValue);
  if (Number.isFinite(nextValue)) {
    formState[fieldDefinition.field] = nextValue;
    flushSliderFieldCommit(fieldDefinition, nextValue);
    return;
  }
  flushSliderFieldCommit(fieldDefinition, getFieldValue(fieldDefinition));
}

function patchSelectedField(fieldDefinition, value) {
  const context = selectedVisualContext.value;
  if (!context) return;

  const nextValue = normalizeFieldValue(fieldDefinition, value);
  formState[fieldDefinition.field] = nextValue;

  const currentValue = resolveContextFieldValue(context, fieldDefinition);
  if (Object.is(currentValue, nextValue)) return;

  const fieldPathTokens = resolveFieldPathTokens(fieldDefinition.field);
  if (fieldPathTokens.length === 0) return;

  if (fieldPathTokens.length === 1) {
    projectDataStore.updateProjectRow(
      context.storeKey,
      context.rowIndex,
      { [fieldPathTokens[0]]: nextValue }
    );
    return;
  }

  const rootField = fieldPathTokens[0];
  const nestedField = fieldPathTokens[1];
  const currentRootValue = context?.rowData?.[rootField];
  const nextRootValue = currentRootValue && typeof currentRootValue === 'object' && !Array.isArray(currentRootValue)
    ? { ...currentRootValue }
    : {};

  if (nextValue === null) {
    delete nextRootValue[nestedField];
  } else {
    nextRootValue[nestedField] = nextValue;
  }

  projectDataStore.updateProjectRow(
    context.storeKey,
    context.rowIndex,
    { [rootField]: nextRootValue }
  );
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
  const digits = resolveStepFractionDigits(fieldDefinition.step);
  if (!Number.isInteger(digits) || digits <= 0) return undefined;
  return digits;
}

function getMaxFractionDigits(fieldDefinition) {
  const digits = resolveStepFractionDigits(fieldDefinition.step);
  if (!Number.isInteger(digits) || digits <= 0) return undefined;
  return Math.max(digits, 4);
}

function updateNumberFieldDraft(fieldDefinition, value) {
  formState[fieldDefinition.field] = normalizeNumberValue(value);
}
function commitNumberField(fieldDefinition) {
  clearSliderFieldCommit(fieldDefinition);
  patchSelectedField(fieldDefinition, getFieldValue(fieldDefinition));
}

watch(
  [selectedVisualContext, inspectorFields],
  ([context]) => {
    clearSliderCommitTimers();
    syncFormStateFromContext(context);
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
  <Card class="control-group visual-property-inspector">
    <template #content>
      <div class="section-title" data-i18n="ui.visual_inspector.title">Visual Property Inspector</div>
      <small class="control-helper" data-i18n="ui.visual_inspector.helper">
        Edit selected properties for the currently selected schematic element.
      </small>

      <div v-if="!hasSelectedVisualContext" class="visual-property-inspector__empty mt-2">
        <span data-i18n="ui.visual_inspector.empty">Select a locked visual element on the canvas to edit its style.</span>
      </div>

      <template v-else>
        <div class="visual-property-inspector__selection mt-2">
          <span data-i18n="ui.visual_inspector.selected">Selected:</span>
          <strong>{{ selectedElementDescriptor }}</strong>
        </div>

        <div v-if="inspectorFields.length === 0" class="visual-property-inspector__empty mt-2">
          <span data-i18n="ui.visual_inspector.no_fields">No editable visual properties are available for this element.</span>
        </div>

        <div v-else class="visual-property-inspector__fields mt-2">
          <section
            v-for="fieldGroup in inspectorFieldGroups"
            :key="fieldGroup.key"
            :class="[
              'visual-property-inspector__group',
              { 'visual-property-inspector__group--with-heading': Boolean(fieldGroup.labelKey) }
            ]"
          >
            <h4
              v-if="fieldGroup.labelKey"
              class="visual-property-inspector__group-title"
              :data-i18n="fieldGroup.labelKey"
            >
              {{ t(fieldGroup.labelKey) }}
            </h4>

            <div class="visual-property-inspector__group-fields">
              <div
                v-for="fieldDefinition in fieldGroup.fields"
                :key="fieldDefinition.field"
                class="visual-property-inspector__field"
              >
                <label
                  class="form-label mb-1"
                  :for="getFieldInputId(fieldDefinition.field)"
                  :data-i18n="fieldDefinition.labelKey"
                >
                  {{ t(fieldDefinition.labelKey) }}
                </label>

                <div v-if="fieldDefinition.controlType === VISUAL_INSPECTOR_CONTROL_TYPES.toggle" class="d-flex align-items-center gap-2">
                  <ToggleSwitch
                    :input-id="getFieldInputId(fieldDefinition.field)"
                    :model-value="getToggleValue(fieldDefinition)"
                    @update:model-value="patchSelectedField(fieldDefinition, $event)"
                  />
                </div>

                <div
                  v-else-if="fieldDefinition.controlType === VISUAL_INSPECTOR_CONTROL_TYPES.number"
                  class="visual-property-inspector__number-control"
                >
                  <InputNumber
                    :input-id="getFieldInputId(fieldDefinition.field)"
                    :model-value="getNumberInputValue(fieldDefinition)"
                    :min="fieldDefinition.min ?? undefined"
                    :max="fieldDefinition.max ?? undefined"
                    :step="fieldDefinition.step ?? undefined"
                    :min-fraction-digits="getMinFractionDigits(fieldDefinition)"
                    :max-fraction-digits="getMaxFractionDigits(fieldDefinition)"
                    :use-grouping="false"
                    class="w-100"
                    fluid
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
                    class="visual-property-inspector__number-slider"
                    @update:model-value="updateNumberFieldBySlider(fieldDefinition, $event)"
                    @slideend="commitNumberFieldBySlider(fieldDefinition, $event)"
                  />
                </div>

                <div v-else-if="fieldDefinition.controlType === VISUAL_INSPECTOR_CONTROL_TYPES.color" class="visual-property-inspector__color-row">
                  <span class="color-swatch" :style="{ backgroundColor: getFieldValue(fieldDefinition) || 'transparent' }"></span>
                  <Select
                    :input-id="getFieldInputId(fieldDefinition.field)"
                    :model-value="getFieldValue(fieldDefinition)"
                    :options="getFieldOptions(fieldDefinition)"
                    option-label="label"
                    option-value="value"
                    filter
                    editable
                    class="w-100"
                    @update:model-value="patchSelectedField(fieldDefinition, $event)"
                  >
                    <template #value="slotProps">
                      <span v-if="getSelectedOption(fieldDefinition)">
                        {{ getSelectedOption(fieldDefinition).label }}
                      </span>
                      <span v-else>{{ getFieldValue(fieldDefinition) || slotProps.placeholder }}</span>
                    </template>
                    <template #option="slotProps">
                      <span class="color-swatch" :style="{ backgroundColor: slotProps.option.value }"></span>
                      <span>{{ slotProps.option.label }}</span>
                    </template>
                  </Select>
                </div>

                <Select
                  v-else-if="fieldDefinition.controlType === VISUAL_INSPECTOR_CONTROL_TYPES.select"
                  :input-id="getFieldInputId(fieldDefinition.field)"
                  :model-value="getFieldValue(fieldDefinition)"
                  :options="getFieldOptions(fieldDefinition)"
                  option-label="label"
                  option-value="value"
                  class="w-100"
                  @update:model-value="patchSelectedField(fieldDefinition, $event)"
                >
                  <template #value="slotProps">
                    <span v-if="getSelectedOption(fieldDefinition)">
                      {{ getSelectedOption(fieldDefinition).label }}
                    </span>
                    <span v-else>{{ slotProps.placeholder }}</span>
                  </template>
                  <template #option="slotProps">
                    <span>{{ slotProps.option.label }}</span>
                  </template>
                </Select>
              </div>
            </div>
          </section>
        </div>
      </template>
    </template>
  </Card>
</template>

<style scoped>
.visual-property-inspector__selection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 0.84rem;
  color: var(--muted);
}

.visual-property-inspector__fields {
  display: grid;
  gap: 10px;
}

.visual-property-inspector__group {
  display: grid;
  gap: 10px;
}

.visual-property-inspector__group--with-heading {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 8px 10px;
}

.visual-property-inspector__group-title {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.visual-property-inspector__group-fields {
  display: grid;
  gap: 10px;
}

.visual-property-inspector__empty {
  border: 1px dashed var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 10px 12px;
  color: var(--muted);
  font-size: 0.84rem;
}

.visual-property-inspector__color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.visual-property-inspector__number-control {
  display: grid;
  gap: 6px;
}

.visual-property-inspector__number-slider {
  width: 100%;
}
</style>
