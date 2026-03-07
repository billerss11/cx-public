<script setup>
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import SurfaceAssemblyPreview from '@/components/surface-assembly/SurfaceAssemblyPreview.vue';
import { useSurfaceAssemblyStore } from '@/stores/surfaceAssemblyStore.js';
import { resolveSurfaceAssemblyComponentDefinition } from '@/utils/surfaceAssemblyModel.js';

const surfaceAssemblyStore = useSurfaceAssemblyStore();

const composerVisible = computed({
  get: () => surfaceAssemblyStore.isComposerVisible === true,
  set: (visible) => {
    if (visible === true) return;
    surfaceAssemblyStore.discardDraft();
  },
});

const draftAssembly = computed(() => surfaceAssemblyStore.draftAssembly);
const selectedDraftComponent = computed(() => surfaceAssemblyStore.selectedDraftComponent);

const trunkPalette = Object.freeze(['spool', 'valve']);
const rightBranchPalette = Object.freeze(['wing-valve', 'outlet']);

function resolveLabel(typeKey) {
  return resolveSurfaceAssemblyComponentDefinition(typeKey)?.label ?? typeKey;
}

function applyDraft() {
  surfaceAssemblyStore.applyDraft();
}

function discardDraft() {
  surfaceAssemblyStore.discardDraft();
}

function loadSimpleTreeTemplate() {
  surfaceAssemblyStore.setDraftTemplate('simple-tree');
}

function handleSelectComponent(componentId) {
  surfaceAssemblyStore.selectDraftComponent(componentId);
}
</script>

<template>
  <Dialog
    v-model:visible="composerVisible"
    data-vue-owned="true"
    class="surface-assembly-composer"
    :modal="true"
    :style="{ width: 'min(1080px, 94vw)' }"
  >
    <template #header>
      <div class="surface-assembly-composer__header">
        <span>Surface Assembly Composer</span>
        <small>Draft changes stay local until you click Apply.</small>
      </div>
    </template>

    <div class="surface-assembly-composer__layout">
      <aside class="surface-assembly-composer__sidebar">
        <section class="surface-assembly-composer__section">
          <h4 class="surface-assembly-composer__section-title">Templates</h4>
          <Button
            type="button"
            size="small"
            outlined
            data-testid="surface-assembly-template-simple-tree"
            @click="loadSimpleTreeTemplate"
          >
            Simple Tree
          </Button>
        </section>

        <section class="surface-assembly-composer__section">
          <h4 class="surface-assembly-composer__section-title">Trunk Blocks</h4>
          <Button
            v-for="typeKey in trunkPalette"
            :key="typeKey"
            type="button"
            size="small"
            outlined
            class="surface-assembly-composer__action"
            :data-testid="`surface-assembly-add-trunk-${typeKey}`"
            @click="surfaceAssemblyStore.appendDraftTrunkComponent(typeKey)"
          >
            Add {{ resolveLabel(typeKey) }}
          </Button>
        </section>

        <section class="surface-assembly-composer__section">
          <h4 class="surface-assembly-composer__section-title">Right Branch</h4>
          <Button
            v-for="typeKey in rightBranchPalette"
            :key="typeKey"
            type="button"
            size="small"
            outlined
            class="surface-assembly-composer__action"
            :data-testid="`surface-assembly-add-right-${typeKey}`"
            @click="surfaceAssemblyStore.appendDraftRightBranchComponent(typeKey)"
          >
            Add {{ resolveLabel(typeKey) }}
          </Button>
        </section>
      </aside>

      <section class="surface-assembly-composer__preview-panel">
        <SurfaceAssemblyPreview
          :assembly="draftAssembly"
          :interactive="true"
          :selected-component-id="surfaceAssemblyStore.selectedDraftComponentId"
          :show-labels="true"
          @select-component="handleSelectComponent"
        />
      </section>

      <aside class="surface-assembly-composer__inspector">
        <section class="surface-assembly-composer__section">
          <h4 class="surface-assembly-composer__section-title">Draft Summary</h4>
          <p class="surface-assembly-composer__summary-row">
            <strong>Template:</strong>
            <span>{{ draftAssembly?.label ?? 'None' }}</span>
          </p>
          <p class="surface-assembly-composer__summary-row">
            <strong>Components:</strong>
            <span>{{ draftAssembly?.components?.length ?? 0 }}</span>
          </p>
        </section>

        <section class="surface-assembly-composer__section">
          <h4 class="surface-assembly-composer__section-title">Selected Component</h4>
          <p class="surface-assembly-composer__summary-row">
            <strong>Label:</strong>
            <span>{{ selectedDraftComponent?.label ?? 'Select a component in the preview' }}</span>
          </p>
          <p class="surface-assembly-composer__summary-row">
            <strong>Type:</strong>
            <span>{{ selectedDraftComponent?.typeKey ?? 'None' }}</span>
          </p>
        </section>
      </aside>
    </div>

    <template #footer>
      <div class="surface-assembly-composer__footer">
        <Button
          type="button"
          text
          severity="secondary"
          @click="discardDraft"
        >
          Cancel
        </Button>
        <Button
          type="button"
          data-testid="surface-assembly-apply"
          @click="applyDraft"
        >
          Apply
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.surface-assembly-composer__header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.surface-assembly-composer__layout {
  display: grid;
  grid-template-columns: minmax(180px, 220px) minmax(0, 1fr) minmax(180px, 220px);
  gap: 16px;
  min-height: 520px;
}

.surface-assembly-composer__sidebar,
.surface-assembly-composer__inspector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.surface-assembly-composer__preview-panel {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 12px;
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
}

.surface-assembly-composer__section {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 12px;
  background: var(--color-surface-elevated);
}

.surface-assembly-composer__section-title {
  margin: 0 0 10px;
  font-size: 0.86rem;
}

.surface-assembly-composer__action {
  width: 100%;
  justify-content: flex-start;
  margin-top: 8px;
}

.surface-assembly-composer__summary-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 10px;
  font-size: 0.82rem;
}

.surface-assembly-composer__footer {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 991px) {
  .surface-assembly-composer__layout {
    grid-template-columns: 1fr;
  }
}
</style>
