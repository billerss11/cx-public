<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import SelectButton from 'primevue/selectbutton';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { LAYOUT_CONSTANTS } from '@/constants/index.js';
import { requestSchematicRender } from '@/composables/useSchematicRenderer.js';

const viewConfigStore = useViewConfigStore();
const config = viewConfigStore.config;

const isDirectionalView = computed(() => config.viewMode === 'directional');
const canvasWidthMin = computed(() => (isDirectionalView.value ? 0.1 : 1.0));

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

function commitBufferedConfigSlider(configKey, model, eventOrValue, options = {}) {
  const nextValue = toNumberOrFallback(readSliderValue(eventOrValue), config[configKey]);
  model.value = nextValue;
  const commit = () => {
    setConfigValue(configKey, nextValue);
    triggerConfigPlot();
  };

  if (options.immediate === true) {
    flushSliderCommit(configKey, commit);
  } else {
    queueSliderCommit(configKey, commit);
  }
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

const figHeightModel = createBufferedNumberModel(() => config.figHeight);
const widthMultiplierModel = createBufferedNumberModel(() => config.widthMultiplier);
const crossoverEpsilonModel = createBufferedNumberModel(() => config.crossoverEpsilon);
const crossoverHeightModel = createBufferedNumberModel(() => config.crossoverPixelHalfHeight);
const canvasWidthModel = createBufferedNumberModel(() => config.canvasWidthMultiplier);
const xExaggerationModel = createBufferedNumberModel(() => config.xExaggeration);
const intervalCalloutStandoffModel = createBufferedNumberModel(() => config.intervalCalloutStandoffPx);
const directionalCasingArrowModeOptions = Object.freeze([
  {
    value: 'normal-locked',
    label: 'Normal-Locked',
    i18nKey: 'ui.directional_casing_arrow_mode.normal_locked'
  },
  {
    value: 'direct-to-anchor',
    label: 'Direct-to-Anchor',
    i18nKey: 'ui.directional_casing_arrow_mode.direct_to_anchor'
  }
]);

const lockAspectRatioModel = computed({
  get: () => config.lockAspectRatio === true,
  set: (value) => {
    viewConfigStore.setLockAspectRatioEnabled(value);
    requestSchematicRender({ immediate: true });
  }
});

const directionalCasingArrowModeModel = computed({
  get: () => (
    config.directionalCasingArrowMode === 'direct-to-anchor'
      ? 'direct-to-anchor'
      : 'normal-locked'
  ),
  set: (value) => {
    viewConfigStore.setDirectionalCasingArrowMode(value);
    requestSchematicRender({ immediate: true });
  }
});

function handleFigHeightSliderChange(eventOrValue) {
  commitBufferedCustomSlider('figHeight', figHeightModel, eventOrValue, (nextValue) => {
    viewConfigStore.setFigureHeightFromControl(nextValue);
    requestSchematicRender();
  });
}

function handleFigHeightSliderCommit(eventOrValue) {
  commitBufferedCustomSlider('figHeight', figHeightModel, eventOrValue, (nextValue) => {
    viewConfigStore.setFigureHeightFromControl(nextValue);
    requestSchematicRender({ immediate: true });
  }, { immediate: true });
}

function handleWidthMultiplierSliderChange(eventOrValue) {
  commitBufferedConfigSlider('widthMultiplier', widthMultiplierModel, eventOrValue);
}

function handleWidthMultiplierSliderCommit(eventOrValue) {
  commitBufferedConfigSlider('widthMultiplier', widthMultiplierModel, eventOrValue, { immediate: true });
}

function handleCanvasWidthSliderChange(eventOrValue) {
  commitBufferedCustomSlider('canvasWidthMultiplier', canvasWidthModel, eventOrValue, (nextValue) => {
    viewConfigStore.setCanvasWidthMultiplierFromControl(nextValue);
    requestSchematicRender();
  });
}

function handleCanvasWidthSliderCommit(eventOrValue) {
  commitBufferedCustomSlider('canvasWidthMultiplier', canvasWidthModel, eventOrValue, (nextValue) => {
    viewConfigStore.setCanvasWidthMultiplierFromControl(nextValue);
    requestSchematicRender({ immediate: true });
  }, { immediate: true });
}

function handleXExaggerationSliderChange(eventOrValue) {
  commitBufferedCustomSlider('xExaggeration', xExaggerationModel, eventOrValue, (nextValue) => {
    viewConfigStore.setXExaggeration(nextValue);
    requestSchematicRender();
  });
}

function handleXExaggerationSliderCommit(eventOrValue) {
  commitBufferedCustomSlider('xExaggeration', xExaggerationModel, eventOrValue, (nextValue) => {
    viewConfigStore.setXExaggeration(nextValue);
    requestSchematicRender({ immediate: true });
  }, { immediate: true });
}

function handleIntervalCalloutStandoffSliderChange(eventOrValue) {
  commitBufferedCustomSlider('intervalCalloutStandoffPx', intervalCalloutStandoffModel, eventOrValue, (nextValue) => {
    viewConfigStore.setIntervalCalloutStandoffPx(nextValue);
    requestSchematicRender();
  });
}

function handleIntervalCalloutStandoffSliderCommit(eventOrValue) {
  commitBufferedCustomSlider('intervalCalloutStandoffPx', intervalCalloutStandoffModel, eventOrValue, (nextValue) => {
    viewConfigStore.setIntervalCalloutStandoffPx(nextValue);
    requestSchematicRender({ immediate: true });
  }, { immediate: true });
}

function handleCrossoverEpsilonSliderChange(eventOrValue) {
  commitBufferedConfigSlider('crossoverEpsilon', crossoverEpsilonModel, eventOrValue);
}

function handleCrossoverEpsilonSliderCommit(eventOrValue) {
  commitBufferedConfigSlider('crossoverEpsilon', crossoverEpsilonModel, eventOrValue, { immediate: true });
}

function handleCrossoverHeightSliderChange(eventOrValue) {
  commitBufferedConfigSlider('crossoverPixelHalfHeight', crossoverHeightModel, eventOrValue);
}

function handleCrossoverHeightSliderCommit(eventOrValue) {
  commitBufferedConfigSlider('crossoverPixelHalfHeight', crossoverHeightModel, eventOrValue, { immediate: true });
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
      <div class="section-title" data-i18n="ui.depth_annotations">Results & Sensitivity Tuning</div>
      <small class="control-helper" data-i18n="ui.plot_settings_helper">Presentation-only controls for annotation clarity and viewport ergonomics.</small>
      <div class="slider-grid">
        <div class="mb-2">
          <label class="form-label">
            <span data-i18n="ui.fig_height">Figure Height:</span><span>{{ figHeightModel }}</span><span data-i18n="unit.px">px</span>
          </label>
          <Slider
            v-model="figHeightModel"
            :min="600"
            :max="4000"
            :step="50"
            class="w-100"
            @change="handleFigHeightSliderChange"
            @slideend="handleFigHeightSliderCommit"
          />
        </div>

        <div class="mb-2 d-flex align-items-center gap-2" v-show="isDirectionalView">
          <Checkbox input-id="lockAspectRatio" v-model="lockAspectRatioModel" data-vue-owned="true" binary />
          <label for="lockAspectRatio" data-i18n="ui.lock_aspect_ratio">
            Auto-Fit Width (Lock Aspect Ratio)
          </label>
        </div>

        <div v-if="!isDirectionalView" class="mb-2">
          <label class="form-label">
            <span data-i18n="ui.width_mult">Width Multiplier:</span><span>{{ widthMultiplierModel }}</span>
          </label>
          <Slider
            v-model="widthMultiplierModel"
            :min="1.5"
            :max="10"
            :step="0.5"
            class="w-100"
            @change="handleWidthMultiplierSliderChange"
            @slideend="handleWidthMultiplierSliderCommit"
          />
        </div>

        <div class="mb-2">
          <label class="form-label">
            <span data-i18n="ui.canvas_width">Canvas Width:</span><span>{{ canvasWidthModel }}</span><span data-i18n="unit.multiplier">x</span>
          </label>
          <Slider
            v-model="canvasWidthModel"
            data-vue-owned="true"
            :min="canvasWidthMin"
            :max="3.0"
            :step="0.1"
            class="w-100"
            @change="handleCanvasWidthSliderChange"
            @slideend="handleCanvasWidthSliderCommit"
          />
        </div>

        <div class="mb-2">
          <label class="form-label">
            <span data-i18n="ui.interval_callout_standoff">Interval Callout Standoff:</span><span>{{ intervalCalloutStandoffModel }}</span><span data-i18n="unit.px">px</span>
          </label>
          <small class="input-hint" data-i18n="ui.interval_callout_standoff_hint">Global distance between interval callout boxes and the wellbore anchor in both vertical and directional views.</small>
          <Slider
            v-model="intervalCalloutStandoffModel"
            data-vue-owned="true"
            :min="LAYOUT_CONSTANTS.INTERVAL_CALLOUT_GLOBAL_STANDOFF_MIN_PX"
            :max="LAYOUT_CONSTANTS.INTERVAL_CALLOUT_GLOBAL_STANDOFF_MAX_PX"
            :step="1"
            class="w-100"
            @change="handleIntervalCalloutStandoffSliderChange"
            @slideend="handleIntervalCalloutStandoffSliderCommit"
          />
        </div>

        <div v-if="isDirectionalView" class="mb-2">
          <label class="form-label">
            <span data-i18n="ui.x_exaggeration">X Exaggeration</span>:<span>{{ xExaggerationModel }}</span><span data-i18n="unit.multiplier">x</span>
          </label>
          <small class="input-hint" data-i18n="ui.x_exaggeration_hint">Sensitivity control for horizontal spread in directional mode.</small>
          <Slider
            v-model="xExaggerationModel"
            data-vue-owned="true"
            :min="0.1"
            :max="1.0"
            :step="0.01"
            class="w-100"
            @change="handleXExaggerationSliderChange"
            @slideend="handleXExaggerationSliderCommit"
          />
        </div>

        <div v-if="isDirectionalView" class="mb-2">
          <label class="form-label">
            <span data-i18n="ui.directional_casing_arrow_mode">Casing Arrow Mode:</span>
          </label>
          <small class="input-hint" data-i18n="ui.directional_casing_arrow_mode_hint">Switch between directional-locked arrows and direct box-to-anchor arrows for dense sections.</small>
          <SelectButton
            v-model="directionalCasingArrowModeModel"
            :options="directionalCasingArrowModeOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-100"
            aria-label="Casing arrow mode"
          >
            <template #option="slotProps">
              <span :data-i18n="slotProps.option.i18nKey">{{ slotProps.option.label }}</span>
            </template>
          </SelectButton>
        </div>

        <div class="mb-2">
          <label class="form-label">
            <span data-i18n="ui.crossover_epsilon">Crossover Epsilon:</span><span>{{ crossoverEpsilonModel }}</span>
          </label>
          <Slider
            v-model="crossoverEpsilonModel"
            :min="0"
            :max="500"
            :step="0.1"
            class="w-100"
            @change="handleCrossoverEpsilonSliderChange"
            @slideend="handleCrossoverEpsilonSliderCommit"
          />
        </div>

        <div class="mb-0">
          <label class="form-label">
            <span data-i18n="ui.crossover_height">Crossover Height:</span><span>{{ crossoverHeightModel }}</span><span data-i18n="unit.px">px</span>
          </label>
          <Slider
            v-model="crossoverHeightModel"
            :min="0"
            :max="20"
            :step="1"
            class="w-100"
            @change="handleCrossoverHeightSliderChange"
            @slideend="handleCrossoverHeightSliderCommit"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
