<script setup>
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import { computed, reactive, watchEffect } from 'vue';
import { useProjectDataStore } from '@/stores/projectDataStore.js';
import { useProjectStore } from '@/stores/projectStore.js';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';
import { createSurfaceModelFromTemplate } from '@/surface/templateCatalog.js';
import { resolveAvailableSurfaceChannels } from '@/surface/channelAvailability.js';
import { toSurfaceChannelLabel } from '@/surface/model.js';
import { createRowId } from '@/utils/rowIdentity.js';
import SurfacePathLaneCard from '@/components/surface/SurfacePathLaneCard.vue';
import SurfaceTransferList from '@/components/surface/SurfaceTransferList.vue';

const props = defineProps({
  topologyResult: {
    type: Object,
    default: null
  }
});

const projectDataStore = useProjectDataStore();
const projectStore = useProjectStore();
const workspaceStore = useWorkspaceStore();
const templateSelections = reactive({});

const surfacePaths = computed(() => (
  Array.isArray(projectDataStore.surfacePaths) ? projectDataStore.surfacePaths : []
));
const surfaceTransfers = computed(() => (
  Array.isArray(projectDataStore.surfaceTransfers) ? projectDataStore.surfaceTransfers : []
));
const surfaceOutlets = computed(() => (
  Array.isArray(projectDataStore.surfaceOutlets) ? projectDataStore.surfaceOutlets : []
));
const hasSurfaceModel = computed(() => (
  surfacePaths.value.length > 0 || surfaceTransfers.value.length > 0 || surfaceOutlets.value.length > 0
));
const availableChannels = computed(() => {
  const fromProjectData = resolveAvailableSurfaceChannels(projectDataStore);
  if (fromProjectData.length > 0) return fromProjectData;
  const fromSummary = Object.keys(props.topologyResult?.surfaceSummary?.byChannel ?? {});
  return fromSummary;
});
const availableChannelOptions = computed(() => (
  availableChannels.value.map((channelKey) => ({
    channelKey,
    label: toSurfaceChannelLabel(channelKey)
  }))
));

function ensureTemplateSelections() {
  availableChannels.value.forEach((channelKey) => {
    if (!(channelKey in templateSelections)) {
      templateSelections[channelKey] = true;
    }
  });
}

watchEffect(() => {
  ensureTemplateSelections();
});

function getSelectedTemplateChannels() {
  return availableChannels.value.filter((channelKey) => templateSelections[channelKey] === true);
}

function applyTemplate() {
  const templateModel = createSurfaceModelFromTemplate({
    templateKey: 'standard-production-tree',
    availableChannels: getSelectedTemplateChannels()
  });
  projectDataStore.setSurfacePaths(templateModel.surfacePaths);
  projectDataStore.setSurfaceTransfers(templateModel.surfaceTransfers);
  projectDataStore.setSurfaceOutlets(templateModel.surfaceOutlets);
  projectDataStore.setSurfaceTemplate(templateModel.surfaceTemplate);
}

function selectEntity(entityType, rowId) {
  const wellId = String(projectStore.activeWellId ?? '').trim();
  if (!wellId || !rowId) return;
  workspaceStore.setSelectedHierarchyRef({
    wellId,
    entityType,
    rowId
  });
  workspaceStore.setRightDockEditorMode('advanced');
}

function patchSurfacePaths(mutator) {
  const nextPaths = surfacePaths.value.map((path) => ({
    ...path,
    items: Array.isArray(path?.items) ? path.items.map((item) => ({ ...item })) : []
  }));
  mutator(nextPaths);
  projectDataStore.setSurfacePaths(nextPaths);
}

function addPathItem(pathId, itemType) {
  patchSurfacePaths((nextPaths) => {
    const path = nextPaths.find((candidate) => candidate.rowId === pathId);
    if (!path) return;
    const label = itemType === 'barrier' ? 'Surface Barrier' : 'Pass-through';
    path.items.push({
      rowId: createRowId('surface-path-item'),
      itemType,
      label,
      state: itemType === 'barrier'
        ? { actuationState: 'open', integrityStatus: 'intact' }
        : undefined,
      show: true
    });
  });
}

function updateItem({ pathId, itemId, patch }) {
  patchSurfacePaths((nextPaths) => {
    const path = nextPaths.find((candidate) => candidate.rowId === pathId);
    const item = path?.items?.find((candidate) => candidate.rowId === itemId);
    if (!item) return;
    Object.assign(item, patch);
  });
}

function removeItem({ pathId, itemId }) {
  patchSurfacePaths((nextPaths) => {
    const path = nextPaths.find((candidate) => candidate.rowId === pathId);
    if (!path) return;
    path.items = path.items.filter((item) => item.rowId !== itemId);
  });
}

function moveItem({ pathId, itemId, direction }) {
  patchSurfacePaths((nextPaths) => {
    const path = nextPaths.find((candidate) => candidate.rowId === pathId);
    if (!path) return;
    const currentIndex = path.items.findIndex((item) => item.rowId === itemId);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= path.items.length) return;
    const [item] = path.items.splice(currentIndex, 1);
    path.items.splice(targetIndex, 0, item);
  });
}

function addDefaultOutlet(pathId) {
  const path = surfacePaths.value.find((candidate) => candidate.rowId === pathId);
  if (!path) return;
  const label = path.channelKey === 'TUBING_INNER'
    ? 'Production Outlet'
    : `${toSurfaceChannelLabel(path.channelKey)} Outlet`;
  const anchorItemId = Array.isArray(path.items) && path.items.length > 0
    ? path.items[path.items.length - 1].rowId
    : null;
  projectDataStore.setSurfaceOutlets([
    ...surfaceOutlets.value,
    {
      rowId: createRowId('surface-outlet'),
      outletKey: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label,
      channelKey: path.channelKey,
      kind: path.channelKey === 'TUBING_INNER' ? 'production' : 'annulus',
      pathId,
      anchorItemId,
      show: true
    }
  ]);
}

function removeOutlet(outletId) {
  projectDataStore.setSurfaceOutlets(surfaceOutlets.value.filter((outlet) => outlet.rowId !== outletId));
}

function addTransfer() {
  const [firstChannel, secondChannel] = availableChannels.value;
  projectDataStore.setSurfaceTransfers([
    ...surfaceTransfers.value,
    {
      rowId: createRowId('surface-transfer'),
      transferType: 'leak',
      label: 'Surface Transfer',
      fromChannelKey: firstChannel ?? 'TUBING_INNER',
      toChannelKey: secondChannel ?? firstChannel ?? 'ANNULUS_A',
      direction: 'bidirectional',
      show: true
    }
  ]);
}

function updateTransfer({ rowId, patch }) {
  projectDataStore.setSurfaceTransfers(surfaceTransfers.value.map((transfer) => (
    transfer.rowId === rowId ? { ...transfer, ...patch } : transfer
  )));
}

function removeTransfer(rowId) {
  projectDataStore.setSurfaceTransfers(surfaceTransfers.value.filter((transfer) => transfer.rowId !== rowId));
}

const outletsByPathId = computed(() => (
  surfaceOutlets.value.reduce((byPathId, outlet) => {
    const pathId = String(outlet?.pathId ?? '').trim();
    if (!pathId) return byPathId;
    if (!byPathId[pathId]) {
      byPathId[pathId] = [];
    }
    byPathId[pathId].push(outlet);
    return byPathId;
  }, {})
));
</script>

<template>
  <section class="surface-focus-panel">
    <header class="surface-focus-panel__header">
      <div>
        <p class="surface-focus-panel__eyebrow">Surface Focus</p>
        <h2 class="surface-focus-panel__title">Single-well surface communication</h2>
      </div>
      <Button
        v-if="hasSurfaceModel"
        type="button"
        size="small"
        outlined
        label="Reset To Template"
        @click="applyTemplate"
      />
    </header>

    <section v-if="!hasSurfaceModel" class="surface-focus-panel__empty">
      <p class="surface-focus-panel__empty-title">Start from a standard production tree</p>
      <p class="surface-focus-panel__empty-body">
        Choose the channels that should be exposed at the wellhead/tree, then seed a standard surface model you can tweak.
      </p>
      <div class="surface-focus-panel__channel-grid">
        <label
          v-for="option in availableChannelOptions"
          :key="option.channelKey"
          class="surface-focus-panel__channel-option"
        >
          <Checkbox
            binary
            :model-value="templateSelections[option.channelKey] === true"
            @update:model-value="templateSelections[option.channelKey] = $event === true"
          />
          <span>{{ option.label }}</span>
        </label>
      </div>
      <Button
        type="button"
        data-testid="surface-template-use-standard"
        label="Use Standard Template"
        @click="applyTemplate"
      />
    </section>

    <template v-else>
      <div class="surface-focus-panel__paths">
        <SurfacePathLaneCard
          v-for="path in surfacePaths"
          :key="path.rowId"
          :path="path"
          :outlets="outletsByPathId[path.rowId] || []"
          @select-path="selectEntity('surfacePaths', $event)"
          @add-barrier="addPathItem($event, 'barrier')"
          @add-pass-through="addPathItem($event, 'continuation')"
          @update-item="updateItem"
          @remove-item="removeItem"
          @move-item="moveItem"
          @add-outlet="addDefaultOutlet"
          @remove-outlet="removeOutlet"
          @select-outlet="selectEntity('surfaceOutlets', $event)"
        />
      </div>

      <SurfaceTransferList
        :transfers="surfaceTransfers"
        :available-channels="availableChannels"
        @add-transfer="addTransfer"
        @update-transfer="updateTransfer"
        @remove-transfer="removeTransfer"
        @select-transfer="selectEntity('surfaceTransfers', $event)"
      />
    </template>
  </section>
</template>

<style scoped>
.surface-focus-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.surface-focus-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.surface-focus-panel__eyebrow {
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.74rem;
  color: var(--muted);
}

.surface-focus-panel__title,
.surface-focus-panel__empty-title {
  margin: 0;
  font-size: 1.05rem;
}

.surface-focus-panel__empty {
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.surface-focus-panel__empty-body {
  margin: 0;
  color: var(--muted);
}

.surface-focus-panel__channel-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.surface-focus-panel__channel-option {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--color-surface-panel);
}

.surface-focus-panel__paths {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 991px) {
  .surface-focus-panel__header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
