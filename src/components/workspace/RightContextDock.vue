<script setup>
import { computed, defineAsyncComponent } from 'vue';
import { useSelectedVisualContext } from '@/composables/useSelectedVisualContext.js';
import { useWorkspaceStore } from '@/stores/workspaceStore.js';

const VisualPropertyInspector = defineAsyncComponent(() => import('@/components/controls/VisualPropertyInspector.vue'));
const GlobalSettingsDockPanel = defineAsyncComponent(() => import('@/components/workspace/GlobalSettingsDockPanel.vue'));

const workspaceStore = useWorkspaceStore();
const { hasSelectedVisualContext } = useSelectedVisualContext();

const activePanelComponent = computed(() => (
  hasSelectedVisualContext.value ? VisualPropertyInspector : GlobalSettingsDockPanel
));

function closeDock() {
  workspaceStore.toggleRightDock(false);
}
</script>

<template>
  <section class="right-context-dock" role="complementary">
    <header class="right-context-dock__header">
      <h3 class="right-context-dock__title">
        <span v-if="hasSelectedVisualContext" data-i18n="ui.visual_inspector.title">Visual Property Inspector</span>
        <span v-else data-i18n="ui.settings.eyebrow">Global Settings</span>
      </h3>
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
      <component :is="activePanelComponent" />
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
