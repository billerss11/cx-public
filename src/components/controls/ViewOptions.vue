<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';
import { handleEasterEggInput } from '@/app/easterEgg.js';
import { parseOptionalNumber } from '@/utils/general.js';

const viewConfigStore = useViewConfigStore();
const projectStore = useProjectStore();
const config = viewConfigStore.config;

const unitOptions = [
  { value: 'ft', label: 'ft', i18nKey: 'ui.units.ft' },
  { value: 'm', label: 'm', i18nKey: 'ui.units.m' }
];

const verticalSectionModeOptions = [
  { value: 'auto', label: 'Auto', i18nKey: 'ui.vs_mode.auto' },
  { value: 'north', label: 'North (0 deg)', i18nKey: 'ui.vs_mode.north' },
  { value: 'east', label: 'East (90 deg)', i18nKey: 'ui.vs_mode.east' },
  { value: 'manual', label: 'Custom', i18nKey: 'ui.vs_mode.manual' }
];

const isDirectionalView = computed(() => config.viewMode === 'directional');

function setConfigValue(key, value) {
  viewConfigStore.setConfigValue(key, value);
}

function triggerConfigPlot() {
  requestSchematicRender();
}

function toNumberOrFallback(rawValue, fallback) {
  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SLIDER_COMMIT_DELAY_MS = 80;
const sliderCommitTimers = new Map();

function readSliderValue(eventOrValue) {
  return eventOrValue?.value ?? eventOrValue;
}

function createBufferedNumberModel(getter) {
  const initialValue = toNumberOrFallback(getter(), 0);
  const model = ref(initialValue);

  watch(getter, (nextValue) => {
    const normalized = toNumberOrFallback(nextValue, model.value);
    if (!Object.is(model.value, normalized)) {
      model.value = normalized;
    }
  });

  return model;
}

function queueSliderCommit(key, callback) {
  const existingTimer = sliderCommitTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timerId = setTimeout(() => {
    sliderCommitTimers.delete(key);
    callback();
  }, SLIDER_COMMIT_DELAY_MS);
  sliderCommitTimers.set(key, timerId);
}

function flushSliderCommit(key, callback) {
  const existingTimer = sliderCommitTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
    sliderCommitTimers.delete(key);
  }
  callback();
}

function commitBufferedCustomSlider(commitKey, model, eventOrValue, commitFn, options = {}) {
  const nextValue = toNumberOrFallback(readSliderValue(eventOrValue), model.value);
  model.value = nextValue;
  const commit = () => {
    commitFn(nextValue);
  };

  if (options.immediate === true) {
    flushSliderCommit(commitKey, commit);
  } else {
    queueSliderCommit(commitKey, commit);
  }
}

const plotTitleModel = computed({
  get: () => config.plotTitle ?? '',
  set: (value) => {
    const nextValue = String(value ?? '');
    setConfigValue('plotTitle', nextValue);
    handleEasterEggInput(nextValue);
    triggerConfigPlot();
  }
});

const activeWellId = computed(() => projectStore.activeWellId ?? null);
const activeWellName = computed(() => String(projectStore.activeWell?.name ?? '').trim());
const activeWellNameModel = ref('');
const activeWellNameAttempted = ref(false);

const trimmedActiveWellName = computed(() => String(activeWellNameModel.value ?? '').trim());
const activeWellNamePresent = computed(() => trimmedActiveWellName.value.length > 0);
const activeWellNameUnique = computed(() => {
  if (!activeWellNamePresent.value) return false;
  return projectStore.isWellNameUnique(trimmedActiveWellName.value, activeWellId.value);
});

const activeWellNameValidationState = computed(() => {
  if (!activeWellNameAttempted.value) return '';
  if (!activeWellNamePresent.value) return 'required';
  if (!activeWellNameUnique.value) return 'duplicate';
  return '';
});

function syncActiveWellNameModel() {
  activeWellNameModel.value = activeWellName.value;
  activeWellNameAttempted.value = false;
}

function commitActiveWellName() {
  activeWellNameAttempted.value = true;
  if (!activeWellId.value) return;
  if (!activeWellNamePresent.value || !activeWellNameUnique.value) return;

  projectStore.renameWell(activeWellId.value, trimmedActiveWellName.value);
  syncActiveWellNameModel();
}

function revertActiveWellNameModel() {
  syncActiveWellNameModel();
}

const unitsModel = computed({
  get: () => (config.units === 'm' ? 'm' : 'ft'),
  set: (value) => {
    const normalized = value === 'm' ? 'm' : 'ft';
    setConfigValue('units', normalized);
    triggerConfigPlot();
  }
});

const datumDepthModel = computed({
  get: () => {
    const parsed = parseOptionalNumber(config.datumDepth);
    return Number.isFinite(parsed) ? parsed : null;
  },
  set: (value) => {
    setConfigValue('datumDepth', parseOptionalNumber(value));
    triggerConfigPlot();
  }
});

const verticalSectionAzimuthModel = createBufferedNumberModel(() => config.verticalSectionAzimuth);
const verticalSectionModeSelectionModel = ref(viewConfigStore.getVerticalSectionModeSelectionFromConfig());

watch(
  () => [config.verticalSectionMode, config.verticalSectionAzimuth],
  () => {
    const syncedSelection = viewConfigStore.getVerticalSectionModeSelectionFromConfig();
    if (verticalSectionModeSelectionModel.value !== syncedSelection) {
      verticalSectionModeSelectionModel.value = syncedSelection;
    }
  },
  { immediate: true }
);

watch(
  () => [activeWellId.value, activeWellName.value],
  () => {
    syncActiveWellNameModel();
  },
  { immediate: true }
);

const verticalSectionModeModel = computed({
  get: () => verticalSectionModeSelectionModel.value,
  set: (value) => {
    const nextSelection = viewConfigStore.setVerticalSectionSelection(value);
    verticalSectionModeSelectionModel.value = nextSelection;
    requestSchematicRender({ immediate: true });
  }
});

const isVerticalSectionManual = computed(() => verticalSectionModeSelectionModel.value === 'manual');

function handleVerticalSectionAzimuthChange(eventOrValue) {
  commitBufferedCustomSlider(
    'verticalSectionAzimuth',
    verticalSectionAzimuthModel,
    eventOrValue,
    (nextValue) => {
      viewConfigStore.setVerticalSectionAzimuth(nextValue);
      requestSchematicRender();
    }
  );
}

function handleVerticalSectionAzimuthCommit(eventOrValue) {
  commitBufferedCustomSlider(
    'verticalSectionAzimuth',
    verticalSectionAzimuthModel,
    eventOrValue,
    (nextValue) => {
      viewConfigStore.setVerticalSectionAzimuth(nextValue);
      requestSchematicRender({ immediate: true });
    },
    { immediate: true }
  );
}

onBeforeUnmount(() => {
  sliderCommitTimers.forEach((timerId) => {
    clearTimeout(timerId);
  });
  sliderCommitTimers.clear();
});
</script>

<template>
  <Card class="control-group">
    <template #content>
      <div class="section-title" data-i18n="ui.plot_config">Assumptions & View Geometry</div>
      <small class="control-helper" data-i18n="ui.view_options_helper">Define units, projection mode, and directional assumptions before rendering.</small>

      <div class="mb-3">
        <label class="form-label" data-i18n="ui.plot_title_label">Plot Title:</label>
        <InputText input-id="plotTitle" v-model="plotTitleModel" class="w-100" />
      </div>

      <div class="mb-3">
        <label class="form-label" data-i18n="ui.active_well_name_label">Active well name:</label>
        <InputText
          input-id="activeWellName"
          v-model="activeWellNameModel"
          class="w-100"
          :disabled="!activeWellId"
          :invalid="Boolean(activeWellNameValidationState)"
          @blur="commitActiveWellName"
          @keydown.enter.prevent="commitActiveWellName"
          @keydown.esc.prevent="revertActiveWellNameModel"
        />
        <small class="control-helper d-block mt-1" data-i18n="ui.project_metadata_export_hint">
          Heads up: well name, project name, and author name are exported to project JSON.
        </small>
        <small
          v-if="activeWellNameValidationState === 'required'"
          class="control-error d-block"
          data-i18n="ui.project_details_error_well_required"
        >
          Well name is required.
        </small>
        <small
          v-else-if="activeWellNameValidationState === 'duplicate'"
          class="control-error d-block"
          data-i18n="ui.project_details_error_well_duplicate"
        >
          Well name must be unique.
        </small>
      </div>

      <div class="mb-3">
        <label class="form-label" data-i18n="ui.display_units">Display Units:</label>
        <div class="d-flex gap-3">
          <div v-for="option in unitOptions" :key="option.value" class="d-flex align-items-center gap-2">
            <RadioButton v-model="unitsModel" name="units" :input-id="option.value === 'ft' ? 'unitsFeet' : 'unitsMeters'" :value="option.value" />
            <label :for="option.value === 'ft' ? 'unitsFeet' : 'unitsMeters'" :data-i18n="option.i18nKey">{{ option.label }}</label>
          </div>
        </div>
      </div>

      <div class="mb-0">
        <label class="form-label" data-i18n="ui.datum_depth">Datum Depth (Optional):</label>
        <InputNumber input-id="datumDepth" v-model="datumDepthModel" class="w-100" :step="0.1" fluid />
      </div>

      <div class="mt-3" v-show="isDirectionalView">
        <label class="form-label" data-i18n="ui.vs_heading">Vertical Section Azimuth:</label>
        <div class="d-flex flex-wrap gap-3" role="group" aria-label="Vertical Section Mode">
          <div v-for="option in verticalSectionModeOptions" :key="option.value" class="d-flex align-items-center gap-2">
            <RadioButton
              v-model="verticalSectionModeModel"
              data-vue-owned="true"
              name="vsMode"
              :input-id="`vsMode-${option.value}`"
              :value="option.value"
            />
            <label :for="`vsMode-${option.value}`" :data-i18n="option.i18nKey">{{ option.label }}</label>
          </div>
        </div>
        <div class="mt-2">
          <label class="form-label mb-1" data-i18n="ui.vs_azimuth">Azimuth (deg):</label>
          <div id="vsAzimuthControls" class="d-flex flex-wrap align-items-center gap-2" :class="{ 'range-control-disabled': !isVerticalSectionManual }">
            <Slider
              v-model="verticalSectionAzimuthModel"
              data-vue-owned="true"
              :disabled="!isVerticalSectionManual"
              :min="0"
              :max="360"
              :step="0.1"
              class="flex-grow-1"
              @change="handleVerticalSectionAzimuthChange"
              @slideend="handleVerticalSectionAzimuthCommit"
            />
            <div class="d-flex align-items-center gap-1 vs-azimuth-input">
              <InputNumber
                input-id="vsAzimuthInput"
                v-model="verticalSectionAzimuthModel"
                data-vue-owned="true"
                :disabled="!isVerticalSectionManual"
                :min="0"
                :max="360"
                :step="0.1"
                :min-fraction-digits="1"
                :max-fraction-digits="1"
                @value-change="handleVerticalSectionAzimuthCommit"
              />
              <span class="text-muted">&deg;</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.control-error {
  color: var(--p-red-500, #b42318);
}
</style>
