<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import ContextMenu from 'primevue/contextmenu';
import InputText from 'primevue/inputtext';
import { clearSelection, selectEntityByRowRef } from '@/app/selection.js';
import {
  useEntityEditorActions
} from '@/composables/useEntityEditorActions.js';
import { normalizeInteractionEntity } from '@/composables/useSchematicInteraction.js';
import {
  createHierarchyItemNodeKey,
  useHierarchyTreeModel
} from '@/composables/useHierarchyTreeModel.js';
import { useInteractionStore } from '@/stores/interactionStore.js';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';
import { normalizeRowId } from '@/utils/rowIdentity.js';
import {
  getHierarchyDomainMeta,
  resolveHierarchyRenameField,
  resolveHierarchyRowsForDomain
} from '@/workspace/hierarchyDomainMeta.js';
import LeftHierarchyDockSectionActions from '@/components/workspace/LeftHierarchyDockSectionActions.vue';

const ENTITY_TYPE_TO_DOMAIN_KEY = Object.freeze({
  casing: 'casing',
  tubing: 'tubing',
  drillString: 'drillString',
  equipment: 'equipment',
  line: 'lines',
  plug: 'plugs',
  fluid: 'fluids',
  marker: 'markers',
  box: 'boxes'
});

const { treeNodes } = useHierarchyTreeModel();
const workspaceStore = useWorkspaceStore();
const projectStore = useProjectStore();
const interactionStore = useInteractionStore();
const {
  addRow,
  duplicateRow,
  deleteRow,
  moveRow,
  updateField
} = useEntityEditorActions();

const selectionKeys = ref({});
const expandedKeys = ref({
  ...workspaceStore.leftTreeExpandedKeys
});
const contextMenuRef = ref(null);
const contextMenuNode = ref(null);
const editingNodeKey = ref('');
const renameTargetNode = ref(null);
const renameDraft = ref('');
const renameInputRef = ref(null);
const projectDataStore = useProjectDataStore();

function getSelectedNodeKey() {
  return Object.keys(selectionKeys.value ?? {}).find((key) => selectionKeys.value[key] === true) ?? null;
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolveNodePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload?.data?.kind) return payload;
  if (payload.node && typeof payload.node === 'object') return payload.node;
  return null;
}

function resolveNodeKind(node) {
  return String(node?.data?.kind ?? '').trim();
}

function isRenamableNode(node) {
  const kind = resolveNodeKind(node);
  return kind === 'well' || kind === 'item';
}

function resolveNodeLabel(node) {
  return String(node?.label ?? '').trim();
}

function findNodeByKey(nodes, nodeKey) {
  const queue = toSafeArray(nodes).slice();
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    if (node.key === nodeKey) return node;
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }
  return null;
}

function expandAncestorNodesFromKey(nodeKey) {
  const tokens = String(nodeKey ?? '').split(':');
  if (tokens[0] !== 'item' || tokens.length < 4) return;
  const wellId = tokens[1];
  const domainKey = tokens[2];
  expandedKeys.value = {
    ...expandedKeys.value,
    project: true,
    [`well:${wellId}`]: true,
    [`domain:${wellId}:${domainKey}`]: true
  };
}

function setSelectionByKey(nodeKey) {
  const normalizedKey = String(nodeKey ?? '').trim();
  if (!normalizedKey) {
    selectionKeys.value = {};
    return;
  }
  selectionKeys.value = {
    [normalizedKey]: true
  };
  expandAncestorNodesFromKey(normalizedKey);
}

function resolveActiveWell() {
  const activeWellId = String(projectStore.activeWellId ?? '').trim();
  return (Array.isArray(projectStore.wells) ? projectStore.wells : []).find((well) => well.id === activeWellId) ?? null;
}

function syncTreeSelectionFromLockedEntity() {
  const lockedEntity = normalizeInteractionEntity(interactionStore.interaction?.lockedEntity);
  if (!lockedEntity) return;

  const domainKey = ENTITY_TYPE_TO_DOMAIN_KEY[lockedEntity.type];
  if (!domainKey) return;

  const activeWell = resolveActiveWell();
  if (!activeWell) return;

  const rows = resolveHierarchyRowsForDomain(domainKey, resolveWellDataById(activeWell.id));
  const row = rows[lockedEntity.id];
  const rowId = normalizeRowId(row?.rowId);
  if (!rowId) return;

  const nodeKey = createHierarchyItemNodeKey(activeWell.id, domainKey, rowId);
  setSelectionByKey(nodeKey);
  workspaceStore.setSelectedHierarchyRef({
    wellId: activeWell.id,
    entityType: lockedEntity.type,
    rowId
  });
}

async function selectItemNode(node) {
  const rowRef = {
    wellId: String(node?.data?.wellId ?? '').trim(),
    entityType: String(node?.data?.entityType ?? '').trim(),
    rowId: String(node?.data?.rowId ?? '').trim()
  };
  if (!rowRef.wellId || !rowRef.entityType || !rowRef.rowId) return;

  workspaceStore.setSelectedHierarchyRef(rowRef);
  workspaceStore.toggleRightDock(true);
  await selectEntityByRowRef(rowRef);
}

async function handleNodeSelect(payload) {
  const node = resolveNodePayload(payload);
  if (!node) return;

  const kind = String(node?.data?.kind ?? '').trim();
  if (kind === 'item') {
    await selectItemNode(node);
    return;
  }

  if (kind === 'well') {
    const wellId = String(node?.data?.wellId ?? '').trim();
    if (wellId) {
      projectStore.setActiveWell(wellId);
    }
  }

  workspaceStore.clearSelectedHierarchyRef();
}

function handleNodeUnselect() {
  workspaceStore.clearSelectedHierarchyRef();
  clearSelection('all');
}

function resolveWellById(wellId) {
  const normalizedWellId = String(wellId ?? '').trim();
  if (!normalizedWellId) return null;
  return toSafeArray(projectStore.wells).find((well) => String(well?.id ?? '').trim() === normalizedWellId) ?? null;
}

function resolveRowForNode(wellId, domainKey, rowId) {
  const rows = resolveHierarchyRowsForDomain(domainKey, resolveWellDataById(wellId));
  const normalizedRowId = normalizeRowId(rowId);
  return rows.find((row) => normalizeRowId(row?.rowId) === normalizedRowId) ?? null;
}

function resolveWellDataById(wellId) {
  const normalizedWellId = String(wellId ?? '').trim();
  if (!normalizedWellId) return {};

  if (normalizedWellId === String(projectStore.activeWellId ?? '').trim()) {
    return projectDataStore;
  }

  const well = resolveWellById(normalizedWellId);
  return well?.data ?? {};
}

const canRenameContextNode = computed(() => isRenamableNode(contextMenuNode.value));
const contextMenuItems = computed(() => ([
  {
    label: 'Rename',
    icon: 'pi pi-pencil',
    disabled: !canRenameContextNode.value,
    command: () => {
      startInlineRename(contextMenuNode.value);
    }
  }
]));

function handleNodeContextMenu(event, node) {
  if (!isRenamableNode(node)) return;
  setSelectionByKey(node.key);
  contextMenuNode.value = node;
  contextMenuRef.value?.show?.(event);
}

function focusRenameInput() {
  const inputElement = renameInputRef.value?.$el?.querySelector?.('input')
    ?? renameInputRef.value?.$el
    ?? renameInputRef.value;
  if (!inputElement) return;
  if (typeof inputElement.focus === 'function') inputElement.focus();
  if (typeof inputElement.select === 'function') inputElement.select();
}

function isInlineRenameNode(node) {
  return String(node?.key ?? '').trim() === String(editingNodeKey.value ?? '').trim();
}

function startInlineRename(node) {
  const targetNode = resolveNodePayload(node);
  if (!isRenamableNode(targetNode)) return;
  renameTargetNode.value = targetNode;
  renameDraft.value = resolveNodeLabel(targetNode);
  editingNodeKey.value = String(targetNode.key ?? '').trim();
  nextTick(() => {
    focusRenameInput();
  });
}

function closeInlineRename() {
  editingNodeKey.value = '';
  renameTargetNode.value = null;
  renameDraft.value = '';
}

function cancelInlineRename() {
  closeInlineRename();
}

async function submitRename() {
  const targetNode = renameTargetNode.value;
  if (!targetNode) return;

  const nextName = String(renameDraft.value ?? '').trim();
  if (!nextName) {
    closeInlineRename();
    return;
  }
  if (nextName === resolveNodeLabel(targetNode)) {
    closeInlineRename();
    return;
  }

  const kind = resolveNodeKind(targetNode);
  if (kind === 'well') {
    const wellId = String(targetNode?.data?.wellId ?? '').trim();
    if (!wellId) {
      closeInlineRename();
      return;
    }
    projectStore.renameWell(wellId, nextName);
    closeInlineRename();
    return;
  }

  if (kind !== 'item') {
    closeInlineRename();
    return;
  }

  const itemData = targetNode?.data ?? {};
  const wellId = String(itemData.wellId ?? '').trim();
  const domainKey = String(itemData.domainKey ?? '').trim();
  const rowId = String(itemData.rowId ?? '').trim();
  const entityType = String(itemData.entityType ?? '').trim();
  if (!wellId || !domainKey || !rowId || !entityType) {
    closeInlineRename();
    return;
  }

  const sourceRow = resolveRowForNode(wellId, domainKey, rowId);
  const renameField = resolveHierarchyRenameField(domainKey, sourceRow);
  ensureWellActivated(wellId);
  updateField({
    entityType,
    rowId,
    field: renameField,
    value: nextName
  });

  await focusRowRef({
    wellId,
    entityType,
    rowId
  });
  closeInlineRename();
}

const selectedNode = computed(() => findNodeByKey(treeNodes.value, getSelectedNodeKey()));
const selectedItemData = computed(() => {
  const node = selectedNode.value;
  if (!node || node?.data?.kind !== 'item') return null;
  return node.data;
});
const selectedDomainData = computed(() => {
  const node = selectedNode.value;
  if (!node || node?.data?.kind !== 'domain') return null;
  return node.data;
});
const canAddItem = computed(() => selectedItemData.value !== null || selectedDomainData.value !== null);
const canDuplicateItem = computed(() => selectedItemData.value !== null);
const canDeleteItem = computed(() => selectedItemData.value !== null);
const selectedItemRows = computed(() => {
  const item = selectedItemData.value;
  if (!item) return [];
  return resolveHierarchyRowsForDomain(item.domainKey, resolveWellDataById(item.wellId));
});
const selectedItemRowIndex = computed(() => {
  const item = selectedItemData.value;
  if (!item) return -1;
  return selectedItemRows.value.findIndex((row) => normalizeRowId(row?.rowId) === normalizeRowId(item.rowId));
});
const canMoveUp = computed(() => selectedItemRowIndex.value > 0);
const canMoveDown = computed(
  () => selectedItemRowIndex.value >= 0 && selectedItemRowIndex.value < selectedItemRows.value.length - 1
);

function resolveDomainEntityType(domainKey) {
  const domainMeta = getHierarchyDomainMeta(domainKey);
  return domainMeta?.entityType ?? domainKey;
}

function ensureWellActivated(wellId) {
  const normalizedWellId = String(wellId ?? '').trim();
  if (!normalizedWellId) return false;
  if (String(projectStore.activeWellId ?? '').trim() === normalizedWellId) return true;
  projectStore.setActiveWell(normalizedWellId);
  return true;
}

async function focusRowRef(rowRef) {
  workspaceStore.setSelectedHierarchyRef(rowRef);
  await selectEntityByRowRef(rowRef);
}

async function handleAdd() {
  const itemData = selectedItemData.value;
  const domainData = selectedDomainData.value;
  const targetWellId = itemData?.wellId ?? domainData?.wellId ?? null;
  const domainEntityType = itemData?.entityType ?? resolveDomainEntityType(domainData?.domainKey);
  if (!targetWellId || !domainEntityType) return;

  ensureWellActivated(targetWellId);
  const nextRowId = addRow({
    entityType: domainEntityType
  });
  if (!nextRowId) return;

  await focusRowRef({
    wellId: targetWellId,
    entityType: domainEntityType,
    rowId: nextRowId
  });
}

async function handleDuplicate() {
  const itemData = selectedItemData.value;
  if (!itemData) return;
  ensureWellActivated(itemData.wellId);
  const nextRowId = duplicateRow({
    entityType: itemData.entityType,
    rowId: itemData.rowId
  });
  if (!nextRowId) return;

  await focusRowRef({
    wellId: itemData.wellId,
    entityType: itemData.entityType,
    rowId: nextRowId
  });
}

function handleDelete() {
  const itemData = selectedItemData.value;
  if (!itemData) return;
  ensureWellActivated(itemData.wellId);
  const didDelete = deleteRow({
    entityType: itemData.entityType,
    rowId: itemData.rowId
  });
  if (!didDelete) return;
  workspaceStore.clearSelectedHierarchyRef();
  clearSelection('all');
}

async function handleMove(direction) {
  const itemData = selectedItemData.value;
  if (!itemData) return;

  ensureWellActivated(itemData.wellId);
  const moved = moveRow({
    entityType: itemData.entityType,
    rowId: itemData.rowId,
    direction
  });
  if (!moved) return;

  await focusRowRef({
    wellId: itemData.wellId,
    entityType: itemData.entityType,
    rowId: itemData.rowId
  });
}

watch(
  () => interactionStore.interaction?.lockedEntity,
  () => {
    syncTreeSelectionFromLockedEntity();
  },
  { deep: true }
);

watch(
  () => projectStore.activeWellId,
  () => {
    syncTreeSelectionFromLockedEntity();
  }
);

watch(
  () => workspaceStore.selectedHierarchyRef,
  (nextRef) => {
    const rowRef = nextRef && typeof nextRef === 'object' ? nextRef : null;
    if (!rowRef) return;
    const nodeKey = createHierarchyItemNodeKey(rowRef.wellId, ENTITY_TYPE_TO_DOMAIN_KEY[rowRef.entityType] ?? rowRef.entityType, rowRef.rowId);
    setSelectionByKey(nodeKey);
  },
  { deep: true }
);

watch(
  expandedKeys,
  (nextExpandedKeys) => {
    workspaceStore.setLeftTreeExpandedKeys(nextExpandedKeys);
  },
  { deep: true }
);
</script>

<template>
  <section class="left-hierarchy-dock" role="complementary">
    <header class="left-hierarchy-dock__header">
      <h3 class="left-hierarchy-dock__title">Project Hierarchy</h3>
      <LeftHierarchyDockSectionActions
        :can-add="canAddItem"
        :can-duplicate="canDuplicateItem"
        :can-delete="canDeleteItem"
        :can-move-up="canMoveUp"
        :can-move-down="canMoveDown"
        @add="handleAdd"
        @duplicate="handleDuplicate"
        @delete="handleDelete"
        @move-up="handleMove('up')"
        @move-down="handleMove('down')"
      />
    </header>

    <div class="left-hierarchy-dock__content">
      <Tree
        v-model:selectionKeys="selectionKeys"
        v-model:expandedKeys="expandedKeys"
        :value="treeNodes"
        :meta-key-selection="true"
        selection-mode="single"
        class="left-hierarchy-dock__tree"
        @node-select="handleNodeSelect"
        @node-unselect="handleNodeUnselect"
      >
        <template #default="{ node }">
          <span
            class="left-hierarchy-dock__node-label"
            @contextmenu.prevent.stop="handleNodeContextMenu($event, node)"
          >
            <InputText
              v-if="isInlineRenameNode(node)"
              ref="renameInputRef"
              v-model="renameDraft"
              class="left-hierarchy-dock__rename-input"
              @keydown.enter.prevent="submitRename"
              @keydown.esc.prevent="cancelInlineRename"
              @blur="submitRename"
            />
            <template v-else>
              {{ node.label }}
            </template>
          </span>
        </template>
      </Tree>
    </div>

    <ContextMenu ref="contextMenuRef" :model="contextMenuItems" />
  </section>
</template>

<style scoped>
.left-hierarchy-dock {
  height: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-subtle), var(--color-surface-panel));
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.left-hierarchy-dock__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: var(--spacing-md);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
}

.left-hierarchy-dock__title {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink);
}

.left-hierarchy-dock__content {
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
  overflow: auto;
  min-height: 0;
}

.left-hierarchy-dock__tree {
  min-height: 100%;
}

.left-hierarchy-dock__node-label {
  display: inline-block;
  width: 100%;
}

.left-hierarchy-dock__tree :deep([data-p-selected='true']) {
  background: color-mix(in srgb, var(--color-accent-primary) 26%, var(--color-surface-elevated));
  border: 1px solid color-mix(in srgb, var(--color-accent-primary-strong) 62%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-primary-strong) 45%, transparent);
}

.left-hierarchy-dock__tree :deep([data-p-selected='true'] [data-pc-section='nodelabel']) {
  color: var(--color-ink-strong);
  font-weight: 700;
}

.left-hierarchy-dock__rename-input {
  width: min(22rem, 100%);
}
</style>
