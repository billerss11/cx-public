<script setup>
import { computed, defineAsyncComponent } from 'vue';
import { useWorkspaceEditorMode } from '@/composables/useWorkspaceEditorMode.js';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

const VisualPropertyInspector = defineAsyncComponent(() => import('@/components/controls/VisualPropertyInspector.vue'));
const AdvancedEntityEditor = defineAsyncComponent(() => import('@/components/controls/AdvancedEntityEditor.vue'));
const GlobalSettingsDockPanel = defineAsyncComponent(() => import('@/components/workspace/GlobalSettingsDockPanel.vue'));

const workspaceStore = useWorkspaceStore();
const {
  activePanelKind,
  setEditorMode,
  showEditorModeSwitch,
  isCommonMode,
  isAdvancedMode
} = useWorkspaceEditorMode();

const activePanelComponent = computed(() => {
  if (activePanelKind.value === 'global') return GlobalSettingsDockPanel;
  if (activePanelKind.value === 'common-visual') return VisualPropertyInspector;
  return AdvancedEntityEditor;
});

const activePanelProps = computed(() => {
  if (activePanelKind.value === 'advanced') {
    return { mode: 'advanced' };
  }
  if (activePanelKind.value === 'common-advanced') {
    return { mode: 'common' };
  }
  return {};
});

const titleText = computed(() => {
  if (activePanelKind.value === 'global') return 'Global Settings';
  if (activePanelKind.value === 'common-visual') return 'Visual Property Inspector';
  if (isAdvancedMode.value) return 'Advanced Entity Editor';
  return 'Entity Editor';
});

function closeDock() {
  workspaceStore.toggleRightDock(false);
}

function switchToCommonMode() {
  setEditorMode('common');
}

function switchToAdvancedMode() {
  setEditorMode('advanced');
}
</script>

<template>
  <section class="right-context-dock" role="complementary">
    <header class="right-context-dock__header">
      <h3 class="right-context-dock__title">
        {{ titleText }}
      </h3>
      <div v-if="showEditorModeSwitch" class="right-context-dock__mode-switch">
        <Button
          type="button"
          size="small"
          :severity="isCommonMode ? 'info' : 'secondary'"
          :outlined="!isCommonMode"
          label="Common"
          data-testid="right-dock-mode-common"
          @click="switchToCommonMode"
        />
        <Button
          type="button"
          size="small"
          :severity="isAdvancedMode ? 'info' : 'secondary'"
          :outlined="!isAdvancedMode"
          label="Advanced"
          data-testid="right-dock-mode-advanced"
          @click="switchToAdvancedMode"
        />
      </div>
      <Button
        type="button"
        text
        rounded
        icon="pi pi-times"
        size="small"
        title="Hide floating palette"
        data-i18n-title="ui.layout.hide_palette"
        @click="closeDock"
      />
    </header>

    <div class="right-context-dock__content">
      <component :is="activePanelComponent" v-bind="activePanelProps" />
    </div>
  </section>
</template>

<style scoped>
.right-context-dock {
  height: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-subtle), var(--color-surface-panel));
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.right-context-dock__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-md) var(--spacing-sm);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 90%, transparent);
}

.right-context-dock__title {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink);
}

.right-context-dock__mode-switch {
  display: flex;
  align-items: center;
  gap: 6px;
}

.right-context-dock__content {
  padding: var(--spacing-md);
  overflow-y: auto;
  min-height: 0;
}

@media (max-width: 991px) {
  .right-context-dock {
    height: auto;
  }
}
</style>
