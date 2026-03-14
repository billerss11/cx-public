import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useHierarchyTreeModel } from '@/composables/useHierarchyTreeModel.js';

function findNodeByKey(nodes, key) {
  const queue = Array.isArray(nodes) ? [...nodes] : [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    if (node.key === key) return node;
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }
  return null;
}

describe('useHierarchyTreeModel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('builds project > well > domain > item nodes with rowId keys', () => {
    const projectStore = useProjectStore();
    const projectDataStore = useProjectDataStore();
    projectStore.ensureInitialized();

    const firstWell = projectStore.wells[0];
    projectDataStore.setCasingData([
      { rowId: 'csg-1', label: 'Surface Casing', top: 0, bottom: 1000 }
    ]);
    projectDataStore.setTopologySources([
      { rowId: 'src-1', sourceType: 'scenario', label: 'Scenario Inflow', top: 900, bottom: 900 },
      { rowId: 'br-1', sourceType: 'scenario', fromVolumeKey: 'ANNULUS_A', toVolumeKey: 'ANNULUS_B', top: 1200, bottom: 1300 }
    ]);
    projectDataStore.setSurfacePaths([
      { rowId: 'surface-path-1', channelKey: 'TUBING_INNER', label: 'Tubing Path', items: [], show: true }
    ]);

    projectStore.appendWell({
      name: 'Well 2',
      data: {
        casingData: [{ rowId: 'csg-2', label: 'Second Casing', top: 0, bottom: 1200 }],
        tubingData: [],
        drillStringData: [],
        equipmentData: [],
        horizontalLines: [],
        annotationBoxes: [],
        userAnnotations: [],
        cementPlugs: [],
        annulusFluids: [],
        markers: [],
        topologySources: [],
        surfacePaths: [
          { rowId: 'surface-path-2', channelKey: 'TUBING_INNER', label: 'Tubing Path', items: [], show: true }
        ],
        surfaceTransfers: [],
        surfaceOutlets: [],
        surfaceTemplate: {},
        trajectory: []
      },
      config: { viewMode: 'directional' }
    }, { activate: false });

    const { treeNodes } = useHierarchyTreeModel();

    expect(Array.isArray(treeNodes.value)).toBe(true);
    expect(treeNodes.value).toHaveLength(1);

    const projectNode = treeNodes.value[0];
    expect(projectNode.data?.kind).toBe('project');
    expect(projectNode.children.length).toBe(2);

    const casingItemKey = `item:${firstWell.id}:casing:csg-1`;
    const casingDomainKey = `domain:${firstWell.id}:casing`;
    const sourceItemKey = `item:${firstWell.id}:topologySources:src-1`;
    const breakoutItemKey = `item:${firstWell.id}:topologyBreakouts:br-1`;
    const surfacePathItemKey = `item:${projectStore.activeWellId}:surfacePaths:surface-path-1`;

    const casingItemNode = findNodeByKey(treeNodes.value, casingItemKey);
    expect(casingItemNode).not.toBeNull();

    const casingDomainNode = findNodeByKey(treeNodes.value, casingDomainKey);
    expect(casingDomainNode).not.toBeNull();

    expect(findNodeByKey(treeNodes.value, sourceItemKey)).not.toBeNull();
    expect(findNodeByKey(treeNodes.value, breakoutItemKey)).not.toBeNull();
    expect(findNodeByKey(treeNodes.value, surfacePathItemKey)).not.toBeNull();
  });
});
