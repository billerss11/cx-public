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
});
