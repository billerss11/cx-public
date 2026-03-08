import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPlotSettingsSource() {
  return readFileSync(resolve(process.cwd(), 'src/components/controls/PlotSettings.vue'), 'utf8');
}

describe('PlotSettings camera-control precedence contract', () => {
  it('derives current-view camera activation from global and mode-scoped flags', () => {
    const source = readPlotSettingsSource();

    expect(source).toContain('const isCameraTransformEnabledForCurrentView = computed(() => (');
    expect(source).toContain('viewConfigStore.uiState?.useCameraTransform === true');
    expect(source).toContain("config.viewMode === 'directional'");
    expect(source).toContain('viewConfigStore.uiState?.cameraTransformDirectional === true');
    expect(source).toContain('viewConfigStore.uiState?.cameraTransformVertical === true');
  });

  it('locks legacy size/exaggeration controls while camera transform is active for current view', () => {
    const source = readPlotSettingsSource();

    expect(source).toContain(':disabled="isCameraTransformEnabledForCurrentView"');
    expect(source).toContain('<Checkbox input-id="lockAspectRatio" v-model="lockAspectRatioModel" data-vue-owned="true" binary :disabled="isCameraTransformEnabledForCurrentView" />');
    expect(source).toContain('v-model="figHeightModel"');
    expect(source).toContain('v-model="widthMultiplierModel"');
    expect(source).toContain('v-model="canvasWidthModel"');
    expect(source).toContain('v-model="xExaggerationModel"');
  });

  it('exposes a directional-only label scale control backed by the view config store', () => {
    const source = readPlotSettingsSource();

    expect(source).toContain('const directionalLabelScaleModel = createBufferedNumberModel(() => config.directionalLabelScale);');
    expect(source).toContain('function handleDirectionalLabelScaleSliderChange(eventOrValue) {');
    expect(source).toContain('function handleDirectionalLabelScaleSliderCommit(eventOrValue) {');
    expect(source).toContain('viewConfigStore.setDirectionalLabelScale(nextValue);');
    expect(source).toContain('v-model="directionalLabelScaleModel"');
    expect(source).toContain('data-i18n="ui.directional_label_scale"');
    expect(source).toContain('data-i18n="ui.directional_label_scale_hint"');
  });

  it('exposes a directional viewport fit control backed by the view config store', () => {
    const source = readPlotSettingsSource();

    expect(source).toContain('const directionalViewportFitModeOptions = Object.freeze([');
    expect(source).toContain("value: 'contain'");
    expect(source).toContain("value: 'fill-width'");
    expect(source).toContain('const directionalViewportFitModeModel = computed({');
    expect(source).toContain('viewConfigStore.setDirectionalViewportFitMode(value);');
    expect(source).toContain('v-model="directionalViewportFitModeModel"');
    expect(source).toContain('data-i18n="ui.directional_viewport_fit"');
    expect(source).toContain('data-i18n="ui.directional_viewport_fit_hint"');
    expect(source).toContain(':disabled="isCameraTransformEnabledForCurrentView"');
  });

  it('exposes a vertical-only label scale control backed by the view config store', () => {
    const source = readPlotSettingsSource();

    expect(source).toContain('const verticalLabelScaleModel = createBufferedNumberModel(() => config.verticalLabelScale);');
    expect(source).toContain('function handleVerticalLabelScaleSliderChange(eventOrValue) {');
    expect(source).toContain('function handleVerticalLabelScaleSliderCommit(eventOrValue) {');
    expect(source).toContain('viewConfigStore.setVerticalLabelScale(nextValue);');
    expect(source).toContain('v-model="verticalLabelScaleModel"');
    expect(source).toContain('data-i18n="ui.vertical_label_scale"');
    expect(source).toContain('data-i18n="ui.vertical_label_scale_hint"');
  });

  it('exposes a smart-labels toggle for both view modes', () => {
    const source = readPlotSettingsSource();

    expect(source).toContain('const smartLabelsEnabledModel = computed({');
    expect(source).toContain('viewConfigStore.setSmartLabelsEnabled(value);');
    expect(source).toContain('data-i18n="ui.smart_labels_enabled"');
    expect(source).toContain('data-i18n="ui.smart_labels_enabled_hint"');
  });
});
