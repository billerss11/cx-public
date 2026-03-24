<script setup>
defineOptions({ name: 'CasingToolsDialog' });

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';
import CasingPlannerPane from '@/components/casing-tools/CasingPlannerPane.vue';
import CasingRuleExplorerPane from '@/components/casing-tools/CasingRuleExplorerPane.vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:visible']);

const CASING_TOOLS_MIN_WIDTH = 620;
const CASING_TOOLS_MIN_HEIGHT = 460;
const CASING_TOOLS_DEFAULT_WIDTH = 920;
const CASING_TOOLS_DEFAULT_HEIGHT = 680;

const activeTab = ref('planner');
let detachResizeListener = null;

const dialogVisible = computed({
  get: () => props.visible === true,
  set: (value) => emit('update:visible', value === true)
});

const {
  dialogSize,
  reconcileDialogSize,
  resizeDialogBy,
  startDialogResize,
  stopDialogResize
} = useFloatingDialogResize({
  minWidth: CASING_TOOLS_MIN_WIDTH,
  minHeight: CASING_TOOLS_MIN_HEIGHT,
  defaultWidth: CASING_TOOLS_DEFAULT_WIDTH,
  defaultHeight: CASING_TOOLS_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.96,
  maxViewportHeightRatio: 0.9,
  cursorClass: 'resizing-both'
});

const dialogStyle = computed(() => ({
  width: `${dialogSize.value.width}px`,
  height: `${dialogSize.value.height}px`,
  maxWidth: '96vw',
  maxHeight: '90vh'
}));

watch(() => props.visible, (isVisible) => {
  if (isVisible !== true) {
    stopDialogResize();
  }
});

function handleResizerKeydown(event) {
  const key = String(event?.key ?? '');
  const step = event?.shiftKey === true ? 32 : 16;

  if (key === 'ArrowRight') {
    event.preventDefault();
    resizeDialogBy(step, 0);
    return;
  }
  if (key === 'ArrowLeft') {
    event.preventDefault();
    resizeDialogBy(-step, 0);
    return;
  }
  if (key === 'ArrowDown') {
    event.preventDefault();
    resizeDialogBy(0, step);
    return;
  }
  if (key === 'ArrowUp') {
    event.preventDefault();
    resizeDialogBy(0, -step);
  }
}

onMounted(() => {
  reconcileDialogSize();
  const handleResize = () => {
    reconcileDialogSize();
  };
  window.addEventListener('resize', handleResize);
  detachResizeListener = () => {
    window.removeEventListener('resize', handleResize);
  };
});

onBeforeUnmount(() => {
  stopDialogResize();
  detachResizeListener?.();
  detachResizeListener = null;
});
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    class="casing-tools-dialog"
    :modal="false"
    :draggable="true"
    :style="dialogStyle"
    :breakpoints="{ '1200px': '96vw' }"
  >
    <template #header>
      <div class="casing-tools-dialog__header">
        <span data-i18n="ui.casing_tools.title">Casing Tools</span>
      </div>
    </template>

    <div class="casing-tools-dialog__body">
      <Tabs v-model:value="activeTab" :lazy="true">
        <TabList>
          <Tab value="planner" data-test="casing-tools-tab-planner">
            <span data-i18n="ui.casing_tools.tab.planner">Planner</span>
          </Tab>
          <Tab value="explorer" data-test="casing-tools-tab-explorer">
            <span data-i18n="ui.casing_tools.tab.explorer">Rule Explorer</span>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="planner">
            <CasingPlannerPane />
          </TabPanel>
          <TabPanel value="explorer">
            <CasingRuleExplorerPane />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <span
        class="casing-tools-dialog__resizer"
        aria-label="Resize casing tools dialog"
        tabindex="0"
        @pointerdown="startDialogResize"
        @keydown="handleResizerKeydown"
      ></span>
    </div>
  </Dialog>
</template>

<style scoped>
.casing-tools-dialog__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.casing-tools-dialog__body {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 0.75rem;
}

.casing-tools-dialog__resizer {
  position: absolute;
  right: 0.15rem;
  bottom: 0.1rem;
  width: 1rem;
  height: 1rem;
  cursor: nwse-resize;
  border-radius: 999px;
}

.casing-tools-dialog__resizer::before {
  content: '';
  position: absolute;
  right: 0.1rem;
  bottom: 0.1rem;
  width: 0.62rem;
  height: 0.62rem;
  border-right: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
}

:deep(.casing-tools-dialog .p-dialog-content) {
  padding-top: 0.35rem;
}
</style>
