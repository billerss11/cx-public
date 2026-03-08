<script setup>
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import SurfaceAssemblyPreview from '@/components/surface-assembly/SurfaceAssemblyPreview.vue';
import { useSurfaceAssemblyStore } from '@/stores/surfaceAssemblyStore.js';
import { listSurfaceAssemblyFamilies } from '@/utils/surfaceAssemblyModel.js';

const surfaceAssemblyStore = useSurfaceAssemblyStore();
const familyOptions = listSurfaceAssemblyFamilies();

const composerVisible = computed({
  get: () => surfaceAssemblyStore.isComposerVisible === true,
  set: (visible) => {
    if (visible === true) return;
    surfaceAssemblyStore.discardDraft();
  },
});

const draftAssembly = computed(() => surfaceAssemblyStore.draftAssembly);
const selectedDraftEntity = computed(() => surfaceAssemblyStore.selectedDraftEntity);
const draftSections = computed(() => surfaceAssemblyStore.draftEditorSections);
const draftWarnings = computed(() => surfaceAssemblyStore.draftValidationWarnings);

function applyDraft() {
  surfaceAssemblyStore.applyDraft();
}

function discardDraft() {
  surfaceAssemblyStore.discardDraft();
}

function selectEntity(entityKey) {
  surfaceAssemblyStore.selectDraftEntity(entityKey);
}

function setRowType(entityKind, slotKey, value) {
  if (entityKind === 'termination') {
    surfaceAssemblyStore.setDraftTerminationType(slotKey, value);
    return;
  }
}

function setRowState(entityKind, slotKey, value) {
  if (entityKind === 'device') {
    surfaceAssemblyStore.setDraftDeviceState(slotKey, value);
    return;
  }
  if (entityKind === 'boundary') {
    surfaceAssemblyStore.setDraftBoundaryState(slotKey, value);
  }
}
</script>

<template>
  <Dialog
    v-model:visible="composerVisible"
    data-vue-owned="true"
    class="surface-assembly-composer"
    :modal="true"
    :style="{ width: 'min(1180px, 96vw)' }"
  >
    <template #header>
      <div class="surface-assembly-composer__header">
        <span>Surface Configuration</span>
        <small>Choose a family, then configure the engineering slots before applying the committed model.</small>
      </div>
    </template>

    <div class="surface-assembly-composer__layout">
      <aside class="surface-assembly-composer__sidebar">
        <section class="surface-assembly-composer__section">
          <h4 class="surface-assembly-composer__section-title">Surface Family</h4>
          <Button
            v-for="family in familyOptions"
            :key="family.familyKey"
            type="button"
            size="small"
            outlined
            class="surface-assembly-composer__family-button"
            :class="{
              'surface-assembly-composer__family-button--active': draftAssembly?.familyKey === family.familyKey,
            }"
            :data-testid="`surface-assembly-family-${family.familyKey}`"
            @click="surfaceAssemblyStore.setDraftFamily(family.familyKey)"
          >
            <span>{{ family.label }}</span>
          </Button>
        </section>

        <section class="surface-assembly-composer__section">
          <h4 class="surface-assembly-composer__section-title">Validation</h4>
          <p
            v-if="draftWarnings.length === 0"
            class="surface-assembly-composer__validation-ok"
          >
            All required access chains are defined.
          </p>
          <ul
            v-else
            class="surface-assembly-composer__warning-list"
          >
            <li
              v-for="warning in draftWarnings"
              :key="`${warning.code}-${warning.slotKey}`"
              class="surface-assembly-composer__warning-item"
            >
              {{ warning.message }}
            </li>
          </ul>
        </section>
      </aside>

      <section class="surface-assembly-composer__preview-panel">
        <SurfaceAssemblyPreview
          :assembly="draftAssembly"
          :interactive="true"
          :selected-entity-key="surfaceAssemblyStore.selectedDraftEntityKey"
          :show-labels="true"
          @select-entity="selectEntity"
        />
      </section>

      <aside class="surface-assembly-composer__inspector">
        <section
          v-for="section in draftSections"
          :key="section.sectionKey"
          class="surface-assembly-composer__section"
        >
          <h4 class="surface-assembly-composer__section-title">{{ section.title }}</h4>
          <p class="surface-assembly-composer__section-description">{{ section.description }}</p>

          <div
            v-for="row in section.rows"
            :key="row.entityKey"
            class="surface-assembly-composer__row"
            :class="{
              'surface-assembly-composer__row--selected': row.entityKey === surfaceAssemblyStore.selectedDraftEntityKey,
            }"
            @click="selectEntity(row.entityKey)"
          >
            <div class="surface-assembly-composer__row-header">
              <strong>{{ row.label }}</strong>
              <small v-if="row.currentTypeLabel">{{ row.currentTypeLabel }}</small>
            </div>

            <p
              v-if="!row.editable"
              class="surface-assembly-composer__row-description"
            >
              {{ row.description }}
            </p>

            <div
              v-if="row.typeOptions.length > 1"
              class="surface-assembly-composer__button-group"
            >
              <Button
                v-for="option in row.typeOptions"
                :key="option.value"
                type="button"
                size="small"
                outlined
                class="surface-assembly-composer__action"
                :data-testid="`surface-assembly-${row.entityKind}-type-${row.slotKey}-${option.value}`"
                @click.stop="setRowType(row.entityKind, row.slotKey, option.value)"
              >
                <span>{{ option.label }}</span>
              </Button>
            </div>

            <div
              v-if="row.stateOptions.length > 0"
              class="surface-assembly-composer__button-group"
            >
              <Button
                v-for="option in row.stateOptions"
                :key="option.value"
                type="button"
                size="small"
                outlined
                class="surface-assembly-composer__action"
                :data-testid="`surface-assembly-${row.entityKind}-state-${row.slotKey}-${option.value}`"
                @click.stop="setRowState(row.entityKind, row.slotKey, option.value)"
              >
                <span>{{ option.label }}</span>
              </Button>
            </div>
          </div>
        </section>

        <section class="surface-assembly-composer__section">
          <h4 class="surface-assembly-composer__section-title">Selected Slot</h4>
          <p class="surface-assembly-composer__summary-row">
            <strong>Label:</strong>
            <span>{{ selectedDraftEntity?.label ?? 'Select a slot in the preview or inspector.' }}</span>
          </p>
          <p class="surface-assembly-composer__summary-row">
            <strong>State:</strong>
            <span>{{ selectedDraftEntity?.state ?? 'Not state-driven' }}</span>
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
  grid-template-columns: minmax(220px, 250px) minmax(0, 1fr) minmax(260px, 340px);
  gap: 16px;
  min-height: 560px;
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
  padding: 14px;
  background: linear-gradient(180deg, var(--color-surface-elevated), var(--color-surface-subtle));
}

.surface-assembly-composer__section {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 12px;
  background: var(--color-surface-elevated);
}

.surface-assembly-composer__section-title {
  margin: 0 0 8px;
  font-size: 0.86rem;
}

.surface-assembly-composer__section-description {
  margin: 0 0 10px;
  font-size: 0.76rem;
  color: var(--muted);
  line-height: 1.35;
}

.surface-assembly-composer__family-button,
.surface-assembly-composer__action {
  width: 100%;
  justify-content: flex-start;
  margin-top: 8px;
}

.surface-assembly-composer__family-button--active {
  border-color: color-mix(in srgb, var(--color-accent-primary) 55%, var(--line));
}

.surface-assembly-composer__validation-ok {
  margin: 0;
  color: var(--color-status-success-text, var(--color-ink-strong));
  font-size: 0.78rem;
}

.surface-assembly-composer__warning-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.78rem;
}

.surface-assembly-composer__warning-item {
  color: var(--color-status-warning-text, var(--color-ink-strong));
}

.surface-assembly-composer__row {
  border: 1px solid color-mix(in srgb, var(--line) 85%, transparent);
  border-radius: var(--radius-sm);
  padding: 10px;
  margin-top: 8px;
  background: color-mix(in srgb, var(--color-surface-subtle) 82%, transparent);
  cursor: pointer;
}

.surface-assembly-composer__row--selected {
  border-color: color-mix(in srgb, var(--color-accent-primary) 48%, var(--line));
}

.surface-assembly-composer__row-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.surface-assembly-composer__row-header small,
.surface-assembly-composer__row-description {
  color: var(--muted);
  font-size: 0.74rem;
  line-height: 1.35;
  margin: 0;
}

.surface-assembly-composer__button-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
