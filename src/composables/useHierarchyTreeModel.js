import { computed } from 'vue';
import { t } from '@/app/i18n.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { normalizeRowId } from '@/utils/rowIdentity.js';
import {
  getHierarchyDomainMeta,
  getVisibleHierarchyDomainKeys,
  resolveHierarchyItemLabel,
  resolveHierarchyRowsForDomain
} from '@/workspace/hierarchyDomainMeta.js';

const PROJECT_NODE_KEY = 'project';

function translateLabel(labelKey, fallbackLabel) {
  const translated = t(labelKey);
  if (translated && translated !== labelKey) return translated;
  return fallbackLabel;
}

function resolveWellContext(well, activeWellId, runtimeViewConfig) {
  const isActiveWell = well?.id === activeWellId;
  const wellConfig = well?.config && typeof well.config === 'object' ? well.config : {};
  return {
    viewMode: isActiveWell
      ? runtimeViewConfig?.viewMode
      : (wellConfig.viewMode ?? runtimeViewConfig?.viewMode),
    operationPhase: isActiveWell
      ? runtimeViewConfig?.operationPhase
      : (wellConfig.operationPhase ?? runtimeViewConfig?.operationPhase)
  };
}

function resolveItemRowId(row, index) {
  return normalizeRowId(row?.rowId) ?? `index-${index}`;
}

export function createHierarchyProjectNodeKey() {
  return PROJECT_NODE_KEY;
}

export function createHierarchyWellNodeKey(wellId) {
  return `well:${String(wellId ?? '').trim()}`;
}

export function createHierarchyDomainNodeKey(wellId, domainKey) {
  return `domain:${String(wellId ?? '').trim()}:${String(domainKey ?? '').trim()}`;
}

export function createHierarchyItemNodeKey(wellId, domainKey, rowId) {
  return `item:${String(wellId ?? '').trim()}:${String(domainKey ?? '').trim()}:${String(rowId ?? '').trim()}`;
}

export function useHierarchyTreeModel() {
  const projectStore = useProjectStore();
  const projectDataStore = useProjectDataStore();
  const viewConfigStore = useViewConfigStore();

  const treeNodes = computed(() => {
    const wells = Array.isArray(projectStore.wells) ? projectStore.wells : [];
    const activeWellId = String(projectStore.activeWellId ?? '').trim() || null;
    const runtimeViewConfig = viewConfigStore.config ?? {};

    const wellNodes = wells.map((well) => {
      const wellId = String(well?.id ?? '').trim();
      const wellName = String(well?.name ?? '').trim() || 'Well';
      const wellData = wellId === activeWellId
        ? projectDataStore
        : (well?.data ?? {});
      const wellContext = resolveWellContext(well, activeWellId, runtimeViewConfig);
      const domainKeys = getVisibleHierarchyDomainKeys(wellContext);

      const domainNodes = domainKeys.map((domainKey) => {
        const domainMeta = getHierarchyDomainMeta(domainKey);
        const rows = resolveHierarchyRowsForDomain(domainKey, wellData);
        const domainLabel = translateLabel(domainMeta.labelKey, domainMeta.fallbackLabel);

        const itemNodes = rows.map((row, rowIndex) => {
          const rowId = resolveItemRowId(row, rowIndex);
          return {
            key: createHierarchyItemNodeKey(wellId, domainKey, rowId),
            label: resolveHierarchyItemLabel(domainKey, row, rowIndex),
            leaf: true,
            data: {
              kind: 'item',
              wellId,
              domainKey,
              rowId,
              rowIndex,
              storeKey: domainMeta.storeKey,
              entityType: domainMeta.entityType,
              canHighlight: domainMeta.canHighlight === true
            }
          };
        });

        return {
          key: createHierarchyDomainNodeKey(wellId, domainKey),
          label: domainLabel,
          children: itemNodes,
          data: {
            kind: 'domain',
            wellId,
            domainKey
          }
        };
      });

      return {
        key: createHierarchyWellNodeKey(wellId),
        label: wellName,
        children: domainNodes,
        data: {
          kind: 'well',
          wellId
        }
      };
    });

    return [{
      key: createHierarchyProjectNodeKey(),
      label: String(projectStore.projectName ?? '').trim() || 'Project',
      children: wellNodes,
      data: {
        kind: 'project'
      }
    }];
  });

  return {
    treeNodes
  };
}
