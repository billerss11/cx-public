<script setup>
import { computed } from 'vue';
import DesignWorkspace from '@/views/DesignWorkspace.vue';
import AnalysisWorkspace from '@/views/AnalysisWorkspace.vue';
import SettingsWorkspace from '@/views/SettingsWorkspace.vue';
import WorkspaceActivityShell from '@/components/workspace/WorkspaceActivityShell.vue';
import { ACTIVITY_TO_VIEW, useWorkspaceStore } from '@/stores/workspaceStore.js';

const workspaceStore = useWorkspaceStore();

const primaryActivities = [
  {
    id: 'design',
    icon: 'pi pi-pencil',
    label: 'Design',
    labelKey: 'ui.activity.design',
    ariaLabel: 'Design workspace'
  },
  {
    id: 'analysis',
    icon: 'pi pi-chart-line',
    label: 'Analysis',
    labelKey: 'ui.activity.analysis',
    ariaLabel: 'Analysis workspace'
  }
];

const utilityActivities = [
  {
    id: 'settings',
    icon: 'pi pi-cog',
    label: 'Settings',
    labelKey: 'ui.activity.settings',
    ariaLabel: 'Settings workspace'
  }
];

const workspaceComponents = {
  design: DesignWorkspace,
  analysis: AnalysisWorkspace,
  settings: SettingsWorkspace
};

const resolvedWorkspaceComponent = computed(() => {
  const activityId = workspaceStore.currentActivity;
  if (activityId in workspaceComponents) {
    return workspaceComponents[activityId];
  }
  return DesignWorkspace;
});

function handleSwitchActivity(activityId) {
  workspaceStore.switchActivity(activityId);
}

function isActivityActive(activityId) {
  return workspaceStore.currentActivity === activityId;
}

function resolveActivityView(activityId) {
  return ACTIVITY_TO_VIEW[activityId] ?? '';
}
</script>

<template>
  <div class="app-shell">
    <nav class="activity-bar" aria-label="Main Navigation">
      <div class="activity-bar__group">
        <Button
          v-for="activity in primaryActivities"
          :key="activity.id"
          class="activity-bar__button"
          :class="{ 'is-active': isActivityActive(activity.id) }"
          :icon="activity.icon"
          severity="secondary"
          text
          rounded
          type="button"
          :aria-current="isActivityActive(activity.id) ? 'page' : undefined"
          :aria-label="activity.ariaLabel"
          :title="activity.label"
          :data-i18n-title="activity.labelKey"
          @click="handleSwitchActivity(activity.id)"
        />
      </div>

      <div class="activity-bar__group activity-bar__group--bottom">
        <Button
          v-for="activity in utilityActivities"
          :key="activity.id"
          class="activity-bar__button"
          :class="{ 'is-active': isActivityActive(activity.id) }"
          :icon="activity.icon"
          severity="secondary"
          text
          rounded
          type="button"
          :aria-current="isActivityActive(activity.id) ? 'page' : undefined"
          :aria-label="activity.ariaLabel"
          :title="activity.label"
          :data-i18n-title="activity.labelKey"
          @click="handleSwitchActivity(activity.id)"
        />
      </div>
    </nav>

    <section class="workspace-host">
      <WorkspaceActivityShell>
        <KeepAlive :include="workspaceStore.cachedViews">
          <component
            :is="resolvedWorkspaceComponent"
            :key="resolveActivityView(workspaceStore.currentActivity)"
          />
        </KeepAlive>
      </WorkspaceActivityShell>
    </section>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  align-items: stretch;
  gap: 12px;
  min-height: calc(100vh - 36px);
}

.activity-bar {
  background: var(--color-surface-elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 6px;
}

.activity-bar__group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.activity-bar__group--bottom {
  margin-top: auto;
  border-top: 1px solid var(--line);
  padding-top: 8px;
}

.activity-bar__button {
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--p-text-muted-color, var(--muted));
  border: 1px solid transparent;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.activity-bar__button.p-button:not(.is-active):not(.p-disabled):hover {
  color: var(--color-accent-primary-strong);
  background: color-mix(in srgb, var(--color-accent-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-accent-primary) 24%, var(--line));
}

.activity-bar__button.p-button.is-active {
  color: var(--color-accent-primary-strong);
  border-color: color-mix(in srgb, var(--color-accent-primary) 38%, var(--line));
  background: color-mix(in srgb, var(--color-accent-primary) 22%, transparent);
}

.activity-bar__button.p-button:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent-primary) 26%, transparent);
}

.workspace-host {
  min-width: 0;
  min-height: 0;
}

@media (max-width: 991px) {
  .app-shell {
    grid-template-columns: 1fr;
    gap: 10px;
    min-height: auto;
  }

  .activity-bar {
    flex-direction: row;
    justify-content: flex-start;
    width: 100%;
  }

  .activity-bar__group {
    flex-direction: row;
    width: auto;
  }

  .activity-bar__group--bottom {
    margin-top: 0;
    margin-left: auto;
    border-top: 0;
    border-left: 1px solid var(--line);
    padding-top: 0;
    padding-left: 8px;
  }
}
</style>
