<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import Select from 'primevue/select';
import ToggleSwitch from 'primevue/toggleswitch';
import { onLanguageChange, t } from '@/app/i18n.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useSelectedVisualContext } from '@/composables/useSelectedVisualContext.js';
import {
  buildEquipmentAttachOptions,
  isPackerEquipmentType,
  resolveEquipmentAttachOption
} from '@/utils/equipmentAttachReference.js';
import {
  getVisualInspectorFields,
  VISUAL_INSPECTOR_CONTROL_TYPES,
  VISUAL_INSPECTOR_FIELD_GROUP_KEYS
} from './visualInspectorSchema.js';
import { getEquipmentRuleRowWarnings } from '@/topology/equipmentRules.js';

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
const INSPECTOR_GROUP_LABEL_KEYS = Object.freeze({
  [VISUAL_INSPECTOR_FIELD_GROUP_KEYS.VISUAL]: 'ui.visual_inspector.group.visual',
  [VISUAL_INSPECTOR_FIELD_GROUP_KEYS.ADVANCED_ENGINEERING]: 'ui.visual_inspector.group.advanced_engineering'
});
const INSPECTOR_GROUP_RENDER_ORDER = Object.freeze([
  VISUAL_INSPECTOR_FIELD_GROUP_KEYS.VISUAL,
  VISUAL_INSPECTOR_FIELD_GROUP_KEYS.ADVANCED_ENGINEERING
]);
const EQUIPMENT_ATTACH_WARNING_CODES = new Set([
  'equipment_missing_attach_target',
  'equipment_unresolved_attach_target',
  'equipment_invalid_host_depth'
]);

const projectDataStore = useProjectDataStore();
const { selectedVisualContext, hasSelectedVisualContext } = useSelectedVisualContext();
const languageTick = ref(0);
const formState = reactive({});
let unsubscribeLanguageChange = null;

const inspectorFields = computed(() => {
  void languageTick.value;
  const context = selectedVisualContext.value ?? null;
  const elementType = context?.elementType ?? null;
  return getVisualInspectorFields(elementType, context);
});
const inspectorFieldGroups = computed(() => {
  const fields = inspectorFields.value;
  const elementType = selectedVisualContext.value?.elementType ?? null;
  if (fields.length === 0) return [];

  if (elementType !== 'equipment') {
    return [{
      key: 'default',
      labelKey: null,
      fields
    }];
  }

  const groupedFields = new Map();
  fields.forEach((fieldDefinition) => {
    const rawGroupKey = String(fieldDefinition?.groupKey ?? '').trim();
    const groupKey = rawGroupKey || VISUAL_INSPECTOR_FIELD_GROUP_KEYS.VISUAL;
    if (!groupedFields.has(groupKey)) {
      groupedFields.set(groupKey, []);
    }
    groupedFields.get(groupKey).push(fieldDefinition);
  });

  const groups = [];
  INSPECTOR_GROUP_RENDER_ORDER.forEach((groupKey) => {
    const groupFieldDefinitions = groupedFields.get(groupKey) ?? [];
    if (groupFieldDefinitions.length === 0) return;
    groups.push({
      key: groupKey,
      labelKey: INSPECTOR_GROUP_LABEL_KEYS[groupKey] ?? null,
      fields: groupFieldDefinitions
    });
    groupedFields.delete(groupKey);
  });

  groupedFields.forEach((groupFieldDefinitions, groupKey) => {
    if (!Array.isArray(groupFieldDefinitions) || groupFieldDefinitions.length === 0) return;
    groups.push({
      key: groupKey,
      labelKey: INSPECTOR_GROUP_LABEL_KEYS[groupKey] ?? null,
      fields: groupFieldDefinitions
    });
  });

  return groups;
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

function normalizeDepthValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDepthInsideRange(depth, top, bottom, epsilon = 1e-6) {
  if (!Number.isFinite(depth) || !Number.isFinite(top) || !Number.isFinite(bottom)) return false;
  const minDepth = Math.min(top, bottom) - epsilon;
  const maxDepth = Math.max(top, bottom) + epsilon;
  return depth >= minDepth && depth <= maxDepth;
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

function normalizeRecommendationText(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

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

function expandWarningTargetFields(warning = {}, editableFieldNames = []) {
  if (!Array.isArray(warning?.fields) || warning.fields.length === 0) return [];

  const targets = new Set();
  editableFieldNames.forEach((editableFieldName) => {
    const matchesWarningField = warning.fields.some((warningField) => {
      const normalizedWarningField = String(warningField ?? '').trim();
      if (!normalizedWarningField) return false;
      return editableFieldName === normalizedWarningField
        || editableFieldName.startsWith(`${normalizedWarningField}.`);
    });
    if (matchesWarningField) {
      targets.add(editableFieldName);
    }
  });

  return [...targets];
}

const equipmentWarningState = computed(() => {
  const context = selectedVisualContext.value;
  if (!context || context.elementType !== 'equipment') {
    return {
      generalWarnings: [],
      warningsByField: new Map()
    };
  }

  const rowWarnings = getEquipmentRuleRowWarnings(context.rowData ?? {}, {
    casingRows: context?.casingRows,
    tubingRows: context?.tubingRows
  });
  const warningsByField = new Map();
  const generalWarnings = [];
  const editableFieldNames = inspectorFields.value.map((fieldDefinition) => fieldDefinition.field);

  rowWarnings.forEach((warning, warningIndex) => {
    const message = String(warning?.message ?? '').trim();
    if (!message) return;

    const warningItem = {
      key: `${warning?.code ?? 'equipment-warning'}-${warningIndex}-${message}`,
      code: String(warning?.code ?? '').trim() || null,
      message,
      recommendation: normalizeRecommendationText(warning?.recommendation)
    };

    const targetFields = expandWarningTargetFields(warning, editableFieldNames);

    if (targetFields.length === 0) {
      generalWarnings.push(warningItem);
      return;
    }

    targetFields.forEach((field) => {
      if (!warningsByField.has(field)) {
        warningsByField.set(field, []);
      }
      warningsByField.get(field).push(warningItem);
    });
  });

  return {
    generalWarnings,
    warningsByField
  };
});

const equipmentAttachReadout = computed(() => {
  const context = selectedVisualContext.value;
  if (!context || context.elementType !== 'equipment') return null;
  if (!isPackerEquipmentType(context?.rowData?.type)) return null;

  const attachOptions = buildEquipmentAttachOptions(context?.casingRows, context?.tubingRows);
  const selectedOption = resolveEquipmentAttachOption(context.rowData ?? {}, attachOptions);
  const hostType = selectedOption?.hostType
    ?? toDisplayText(context?.rowData?.attachToHostType);
  const hostRowId = selectedOption?.rowId
    ?? toDisplayText(context?.rowData?.attachToId);
  const attachDisplay = selectedOption?.value
    ?? toDisplayText(context?.rowData?.attachToDisplay);
  const hostRows = hostType === 'tubing'
    ? (Array.isArray(context?.tubingRows) ? context.tubingRows : [])
    : (hostType === 'casing' ? (Array.isArray(context?.casingRows) ? context.casingRows : []) : []);
  const hostRow = hostRows.find((row) => String(row?.rowId ?? '').trim() === hostRowId) ?? null;
  const hostLabel = toDisplayText(hostRow?.label);
  const depth = normalizeDepthValue(context?.rowData?.depth);
  const hostTop = normalizeDepthValue(hostRow?.top);
  const hostBottom = normalizeDepthValue(hostRow?.bottom);
  const overlapsDepth = hostRow
    ? isDepthInsideRange(depth, hostTop, hostBottom)
    : null;
  const attachWarnings = getEquipmentRuleRowWarnings(context.rowData ?? {}, {
    casingRows: context?.casingRows,
    tubingRows: context?.tubingRows
  }).filter((warning) => EQUIPMENT_ATTACH_WARNING_CODES.has(String(warning?.code ?? '').trim()));

  return {
    attachDisplay,
    hostType,
    hostRowId,
    hostLabel,
    overlapsDepth,
    warningText: attachWarnings[0]?.message ?? null
  };
});

function getEquipmentWarningsForField(fieldDefinition) {
  return equipmentWarningState.value.warningsByField.get(fieldDefinition.field) ?? [];
}

function hasEquipmentWarningsForField(fieldDefinition) {
  return getEquipmentWarningsForField(fieldDefinition).length > 0;
}

function clearFormState() {
  Object.keys(formState).forEach((field) => {
    delete formState[field];
  });
}

function resolveContextFieldValue(context, fieldDefinition) {
  const rowValue = resolveValueByPath(context?.rowData ?? null, fieldDefinition.field);
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

function updateNumberFieldBySlider(fieldDefinition, value) {
  const sliderConfig = getSliderConfig(fieldDefinition);
  if (!sliderConfig) return;

  const numericValue = normalizeNumberValue(value);
  if (!Number.isFinite(numericValue)) return;
  patchSelectedField(fieldDefinition, clampNumber(numericValue, sliderConfig.min, sliderConfig.max));
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
  patchSelectedField(fieldDefinition, getFieldValue(fieldDefinition));
}

watch(
  [selectedVisualContext, inspectorFields],
  ([context]) => {
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

        <div v-if="equipmentWarningState.generalWarnings.length > 0" class="visual-property-inspector__warnings mt-2">
          <p class="visual-property-inspector__warnings-title" data-i18n="ui.visual_inspector.equipment_warnings_title">
            Equipment engineering warnings:
          </p>
          <ul class="visual-property-inspector__warnings-list">
            <li
              v-for="warning in equipmentWarningState.generalWarnings"
              :key="warning.key"
              class="visual-property-inspector__warnings-item"
            >
              <span>{{ warning.message }}</span>
              <small v-if="warning.recommendation" class="visual-property-inspector__warning-recommendation">
                <strong data-i18n="ui.visual_inspector.recommendation_label">Recommendation:</strong>
                <span>{{ warning.recommendation }}</span>
              </small>
            </li>
          </ul>
        </div>

        <div v-if="equipmentAttachReadout" class="visual-property-inspector__attach-readout mt-2">
          <p class="visual-property-inspector__attach-title" data-i18n="ui.visual_inspector.attach_title">
            Packer attach target:
          </p>
          <dl class="visual-property-inspector__attach-list">
            <div class="visual-property-inspector__attach-row">
              <dt data-i18n="ui.visual_inspector.attach_to_label">Attach To:</dt>
              <dd>{{ equipmentAttachReadout.attachDisplay || '-' }}</dd>
            </div>
            <div class="visual-property-inspector__attach-row">
              <dt data-i18n="ui.visual_inspector.attach_host_type_label">Host type:</dt>
              <dd>{{ equipmentAttachReadout.hostType || '-' }}</dd>
            </div>
            <div class="visual-property-inspector__attach-row">
              <dt data-i18n="ui.visual_inspector.attach_host_row_label">Host row:</dt>
              <dd>{{ equipmentAttachReadout.hostLabel || equipmentAttachReadout.hostRowId || '-' }}</dd>
            </div>
            <div class="visual-property-inspector__attach-row">
              <dt data-i18n="ui.visual_inspector.attach_status_label">Status:</dt>
              <dd>
                <span
                  :class="[
                    'visual-property-inspector__attach-status',
                    equipmentAttachReadout.warningText
                      ? 'visual-property-inspector__attach-status--warning'
                      : 'visual-property-inspector__attach-status--ok'
                  ]"
                >
                  {{
                    equipmentAttachReadout.warningText
                      ? t('ui.visual_inspector.attach_status_unresolved')
                      : t('ui.visual_inspector.attach_status_resolved')
                  }}
                </span>
              </dd>
            </div>
          </dl>
          <p
            v-if="equipmentAttachReadout.warningText"
            class="visual-property-inspector__attach-warning"
          >
            {{ equipmentAttachReadout.warningText }}
          </p>
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

                <div
                  v-if="hasEquipmentWarningsForField(fieldDefinition)"
                  class="visual-property-inspector__field-warnings"
                >
                  <p
                    v-for="warning in getEquipmentWarningsForField(fieldDefinition)"
                    :key="warning.key"
                    class="visual-property-inspector__field-warning"
                  >
                    <span>{{ warning.message }}</span>
                    <small
                      v-if="warning.recommendation"
                      class="visual-property-inspector__field-warning-recommendation"
                    >
                      <strong data-i18n="ui.visual_inspector.recommendation_label">Recommendation:</strong>
                      <span>{{ warning.recommendation }}</span>
                    </small>
                  </p>
                </div>
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

.visual-property-inspector__warnings {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 8px 10px;
}

.visual-property-inspector__warnings-title {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: var(--muted);
}

.visual-property-inspector__warnings-list {
  margin: 0;
  padding-left: 16px;
}

.visual-property-inspector__warnings-item {
  font-size: 0.8rem;
  line-height: 1.35;
}

.visual-property-inspector__warning-recommendation {
  display: block;
  margin-top: 2px;
  color: var(--muted);
}

.visual-property-inspector__attach-readout {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--color-surface-elevated);
  padding: 8px 10px;
}

.visual-property-inspector__attach-title {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: var(--muted);
}

.visual-property-inspector__attach-list {
  margin: 0;
  display: grid;
  gap: 4px;
}

.visual-property-inspector__attach-row {
  display: grid;
  grid-template-columns: minmax(92px, auto) 1fr;
  gap: 8px;
  font-size: 0.8rem;
}

.visual-property-inspector__attach-row dt {
  margin: 0;
  color: var(--muted);
  font-weight: 600;
}

.visual-property-inspector__attach-row dd {
  margin: 0;
}

.visual-property-inspector__attach-status--ok {
  color: var(--color-text);
}

.visual-property-inspector__attach-status--warning {
  color: var(--p-red-500);
}

.visual-property-inspector__attach-warning {
  margin: 6px 0 0;
  font-size: 0.78rem;
  color: var(--p-red-500);
}

.visual-property-inspector__field-warnings {
  display: grid;
  gap: 4px;
  margin-top: 4px;
}

.visual-property-inspector__field-warning {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--color-text);
}

.visual-property-inspector__field-warning-recommendation {
  display: block;
  margin-top: 1px;
  color: var(--muted);
}
</style>
