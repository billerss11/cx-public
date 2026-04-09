import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('interval callout removal contract', () => {
  it('removes the boxes table and standoff control surfaces', () => {
    const tabsSource = readSource('src/components/tables/TablesTabsPanel.vue');
    const plotSettingsSource = readSource('src/components/controls/PlotSettings.vue');

    expect(tabsSource).not.toContain('value="boxes"');
    expect(tabsSource).not.toContain('BoxesTablePane');
    expect(plotSettingsSource).not.toContain('intervalCalloutStandoff');
    expect(plotSettingsSource).not.toContain('ui.interval_callout_standoff');
  });

  it('removes interval-callout rendering while preserving user annotation rendering', () => {
    const verticalCanvasSource = readSource('src/components/schematic/SchematicCanvas.vue');
    const directionalCanvasSource = readSource('src/components/schematic/DirectionalSchematicCanvas.vue');

    expect(verticalCanvasSource).not.toContain("import AnnotationLayer from './layers/AnnotationLayer.vue';");
    expect(verticalCanvasSource).not.toContain('<AnnotationLayer');
    expect(verticalCanvasSource).toContain('UserAnnotationLayer');
    expect(directionalCanvasSource).not.toContain('annotationBoxes');
  });

  it('removes interval-callout state from the project and view config stores', () => {
    const projectDataStoreSource = readSource('src/stores/projectDataStore.js');
    const viewConfigStoreSource = readSource('src/stores/viewConfigStore.js');

    expect(projectDataStoreSource).not.toContain('annotationBoxes');
    expect(projectDataStoreSource).not.toContain('setAnnotationBoxes');
    expect(viewConfigStoreSource).not.toContain('intervalCalloutStandoffPx');
    expect(viewConfigStoreSource).not.toContain('setIntervalCalloutStandoffPx');
  });
});
