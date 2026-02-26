<script setup>
import { computed } from 'vue';
import { BOTTOM_DOCK_MODES, useWorkspaceStore } from '@/stores/workspaceStore.js';
import TablesTabsPanel from '@/components/tables/TablesTabsPanel.vue';

const props = defineProps({
  mode: {
    type: String,
    default: BOTTOM_DOCK_MODES.docked
  },
  showHeader: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['request-mode-change']);
const workspaceStore = useWorkspaceStore();

const isFloatingMode = computed(() => props.mode === BOTTOM_DOCK_MODES.floating);
const dockClassName = computed(() => ({
  'resizable-bottom-dock--no-header': props.showHeader !== true
}));

function closeDock() {
  workspaceStore.toggleBottomDock(false);
}

function setBottomDockMode(mode) {
  emit('request-mode-change', mode);
}
</script>

<template>
  <section class="resizable-bottom-dock" :class="dockClassName" role="region">
    <header v-if="showHeader" class="resizable-bottom-dock__header">
      <h3 class="resizable-bottom-dock__title" data-i18n="ui.sidebar.tables">Data Tables</h3>
      <div class="resizable-bottom-dock__actions">
        <Button
          v-if="isFloatingMode"
          type="button"
          text
          rounded
          icon="pi pi-window-minimize"
          size="small"
          title="Sidebar"
          data-i18n-title="ui.layout.sidebar"
          @click="setBottomDockMode(BOTTOM_DOCK_MODES.docked)"
        />
        <Button
          v-else
          type="button"
          text
          rounded
          icon="pi pi-window-maximize"
          size="small"
          title="Floating"
          data-i18n-title="ui.layout.floating"
          @click="setBottomDockMode(BOTTOM_DOCK_MODES.floating)"
        />
        <Button
          type="button"
          text
          rounded
          icon="pi pi-times"
          size="small"
          @click="closeDock"
        />
      </div>
    </header>

    <div class="resizable-bottom-dock__content">
      <TablesTabsPanel />
    </div>
  </section>
</template>

<style scoped>
.resizable-bottom-dock {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, var(--color-surface-subtle), var(--color-surface-panel));
  box-shadow: var(--shadow-soft);
  min-height: 0;
  overflow: hidden;
}

.resizable-bottom-dock--no-header {
  grid-template-rows: minmax(0, 1fr);
}

.resizable-bottom-dock__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--line);
  background: var(--color-surface-elevated);
}

.resizable-bottom-dock__title {
  margin: 0;
  font-size: 0.8rem;
  font-family: var(--font-family-display);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink);
}

.resizable-bottom-dock__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.resizable-bottom-dock__content {
  min-height: 0;
  overflow: auto;
  padding: var(--spacing-sm);
}
</style>
