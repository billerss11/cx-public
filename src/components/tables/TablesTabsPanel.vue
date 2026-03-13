<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import CasingTablePane from './panes/CasingTablePane.vue';
import TubingTablePane from './panes/TubingTablePane.vue';
import DrillStringTablePane from './panes/DrillStringTablePane.vue';
import EquipmentTablePane from './panes/EquipmentTablePane.vue';
import LinesTablePane from './panes/LinesTablePane.vue';
import PlugsTablePane from './panes/PlugsTablePane.vue';
import FluidsTablePane from './panes/FluidsTablePane.vue';
import MarkersTablePane from './panes/MarkersTablePane.vue';
import TopologyBreakoutsTablePane from './panes/TopologyBreakoutsTablePane.vue';
import BoxesTablePane from './panes/BoxesTablePane.vue';
import TrajectoryTablePane from './panes/TrajectoryTablePane.vue';
import IntervalsTablePane from './panes/IntervalsTablePane.vue';
import { activeTableTabKey, setActiveTableTabKey } from './panes/tablePaneState.js';
import { useViewConfigStore } from '@/stores/viewConfigStore.js';
import { listVisibleDomainTableEntries } from '@/workspace/domainRegistry.js';

const viewConfigStore = useViewConfigStore();
const config = viewConfigStore.config;

const tableDomainContext = computed(() => ({
  operationPhase: config.operationPhase,
  viewMode: config.viewMode
}));
const visibleTableEntries = computed(() => listVisibleDomainTableEntries(tableDomainContext.value));
const isDirectionalView = computed(() => (
  visibleTableEntries.value.some((entry) => entry?.key === 'trajectory')
));
const showTubingTable = computed(() => (
  visibleTableEntries.value.some((entry) => entry?.key === 'tubing')
));
const showDrillStringTable = computed(() => (
  visibleTableEntries.value.some((entry) => entry?.key === 'drillString')
));
const showEquipmentTable = computed(() => (
  visibleTableEntries.value.some((entry) => entry?.key === 'equipment')
));

const baseTabKeys = computed(() => {
  return visibleTableEntries.value
    .map((entry) => String(entry?.table?.tabKey ?? '').trim())
    .filter((tabKey) => tabKey.length > 0 && tabKey !== 'topologySources');
});

const tabKeys = computed(() => {
  const keys = [...baseTabKeys.value];
  if (config.showPhysicsDebug === true) {
    keys.push('physicsIntervals');
  }
  return keys;
});

const activeTabValue = computed({
  get: () => (tabKeys.value.includes(activeTableTabKey.value) ? activeTableTabKey.value : tabKeys.value[0]),
  set: (nextTabKey) => {
    if (!tabKeys.value.includes(nextTabKey)) return;
    const active = document.activeElement;
    if (active?.classList?.contains('handsontableInput')) {
      active.blur();
    }
    setActiveTableTabKey(nextTabKey);
  }
});

watch(tabKeys, (nextKeys) => {
  if (nextKeys.includes(activeTableTabKey.value)) return;
  setActiveTableTabKey(nextKeys[0]);
}, { immediate: true });

function handleFocusIn(event) {
  const target = event?.target;
  if (target?.classList?.contains('handsontableInput')) {
    target.setAttribute('aria-hidden', 'false');
  }
}

function handleFocusOut(event) {
  const target = event?.target;
  if (target?.classList?.contains('handsontableInput')) {
    target.setAttribute('aria-hidden', 'true');
  }
}

onMounted(() => {
  document.addEventListener('focusin', handleFocusIn);
  document.addEventListener('focusout', handleFocusOut);
});

onBeforeUnmount(() => {
  document.removeEventListener('focusin', handleFocusIn);
  document.removeEventListener('focusout', handleFocusOut);
});
</script>

<template>
  <div class="tables-tabs-panel">
    <div class="tables-tabs-panel__main">
      <Tabs v-model:value="activeTabValue" :lazy="true">
        <TabList>
          <Tab value="casing">
            <span id="casing-tab" data-i18n="ui.tabs.casing">Casing</span>
          </Tab>
          <Tab v-if="showTubingTable" value="tubing">
            <span id="tubing-tab" data-i18n="ui.tabs.tubing">Tubing</span>
          </Tab>
          <Tab v-if="showEquipmentTable" value="equipment">
            <span id="equipment-tab" data-i18n="ui.tabs.equipment">Equipment</span>
          </Tab>
          <Tab v-if="showDrillStringTable" value="drillString">
            <span id="drill-string-tab" data-i18n="ui.tabs.drill_string">Drill String</span>
          </Tab>
          <Tab value="lines">
            <span id="lines-tab" data-i18n="ui.tabs.lines">Lines</span>
          </Tab>
          <Tab value="plugs">
            <span id="plugs-tab" data-i18n="ui.tabs.plugs">Plugs</span>
          </Tab>
          <Tab value="fluids">
            <span id="fluids-tab" data-i18n="ui.tabs.fluids">Fluids</span>
          </Tab>
          <Tab value="markers">
            <span id="markers-tab" data-i18n="ui.tabs.markers">Markers</span>
          </Tab>
          <Tab value="topologyBreakouts">
            <span id="topology-breakouts-tab" data-i18n="ui.tabs.topology_breakouts">Crossflow Paths</span>
          </Tab>
          <Tab value="boxes">
            <span id="boxes-tab" data-i18n="ui.tabs.boxes">Boxes</span>
          </Tab>
          <Tab v-if="isDirectionalView" value="trajectory">
            <span id="trajectory-tab" data-i18n="ui.tabs.trajectory">Well Trajectory</span>
          </Tab>
          <Tab v-if="config.showPhysicsDebug === true" value="physicsIntervals">
            <span data-i18n="ui.tabs.physics_intervals">Physics Intervals</span>
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="casing">
            <CasingTablePane />
          </TabPanel>
          <TabPanel v-if="showTubingTable" value="tubing">
            <TubingTablePane />
          </TabPanel>
          <TabPanel v-if="showEquipmentTable" value="equipment">
            <EquipmentTablePane />
          </TabPanel>
          <TabPanel v-if="showDrillStringTable" value="drillString">
            <DrillStringTablePane />
          </TabPanel>
          <TabPanel value="lines">
            <LinesTablePane />
          </TabPanel>
          <TabPanel value="plugs">
            <PlugsTablePane />
          </TabPanel>
          <TabPanel value="fluids">
            <FluidsTablePane />
          </TabPanel>
          <TabPanel value="markers">
            <MarkersTablePane />
          </TabPanel>
          <TabPanel value="topologyBreakouts">
            <TopologyBreakoutsTablePane />
          </TabPanel>
          <TabPanel value="boxes">
            <BoxesTablePane />
          </TabPanel>
          <TabPanel v-if="isDirectionalView" value="trajectory">
            <TrajectoryTablePane />
          </TabPanel>
          <TabPanel v-if="config.showPhysicsDebug === true" value="physicsIntervals">
            <IntervalsTablePane />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.tables-tabs-panel {
  min-height: 0;
}

.tables-tabs-panel__main {
  min-height: 0;
  margin-bottom: var(--spacing-md);
}

.tables-tabs-panel__main :deep(.p-tabs) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tables-tabs-panel__main :deep(.p-tablist-tab-list) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  background: var(--color-surface-muted);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
}

.tables-tabs-panel__main :deep(.p-tab) {
  margin: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-weight: 600;
  color: var(--muted);
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.tables-tabs-panel__main :deep(.p-tab.p-tab-active) {
  background: color-mix(in srgb, var(--color-accent-primary) 18%, transparent);
  border-color: color-mix(in srgb, var(--color-accent-primary-strong) 28%, transparent);
  color: var(--ink);
}

.tables-tabs-panel__main :deep(.p-tablist-active-bar) {
  display: none;
}

.tables-tabs-panel__main :deep(.p-tabpanels) {
  padding-top: var(--spacing-sm);
  min-height: 0;
  overflow: auto;
  background: transparent;
}
</style>
