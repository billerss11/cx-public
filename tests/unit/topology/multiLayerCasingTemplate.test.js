import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ensureProjectSchemaV7 } from '@/utils/migrations/v6_to_v7.js';
import { buildTopologyModel } from '@/topology/topologyCore.js';

function loadTemplateProject() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(currentDir, '../../../files/output/multi-layer-casing-test.json');
  return JSON.parse(readFileSync(templatePath, 'utf8'));
}

function buildActiveWellTopology(payload = {}) {
  const project = ensureProjectSchemaV7(payload);
  const activeWell = (project.wells ?? []).find((well) => well?.id === project.activeWellId);

  if (!activeWell) {
    throw new Error('Template project is missing its active well.');
  }

  return {
    project,
    activeWell,
    result: buildTopologyModel({
      ...activeWell.data,
      config: {
        topologyUseIllustrativeFluidSource: Boolean(activeWell?.config?.topologyUseIllustrativeFluidSource),
        topologyUseOpenHoleSource: activeWell?.config?.topologyUseOpenHoleSource
      },
      interaction: {}
    }, {
      requestId: 1,
      wellId: activeWell.id
    })
  };
}

describe('multi-layer casing template', () => {
  it('uses an English file and project naming convention', () => {
    const payload = loadTemplateProject();

    expect(payload.projectName).toBe('Multi-Layer Casing Test');
    expect(payload.wells?.[0]?.name).toBe('Multi-Layer Casing Test');
    expect(payload.wells?.[1]?.name).toBe('Multi-Layer Casing Test 2');
  });

  it('uses English marker types that topology can resolve', () => {
    const payload = loadTemplateProject();
    const markerTypes = (payload.wells ?? [])
      .flatMap((well) => well?.data?.markers ?? [])
      .map((marker) => marker?.type)
      .filter(Boolean);

    expect(markerTypes.length).toBeGreaterThan(0);
    expect(markerTypes.every((type) => type === 'Perforation' || type === 'Leak')).toBe(true);
  });

  it('produces active-flow nodes for the active well', () => {
    const { result } = buildActiveWellTopology(loadTemplateProject());

    expect(result.sourceEntities.length).toBeGreaterThan(0);
    expect(result.activeFlowNodeIds.length).toBeGreaterThan(0);
  });
});
