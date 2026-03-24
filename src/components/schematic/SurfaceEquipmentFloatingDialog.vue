<script setup>
defineOptions({ name: 'SurfaceEquipmentFloatingDialog' });

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useFloatingDialogResize } from '@/composables/useFloatingDialogResize.js';
import { buildSurfaceLayoutModel } from '@/surface/layoutModel.js';
import SurfaceFlowBand from './layers/SurfaceFlowBand.vue';

const SURFACE_DIALOG_MIN_WIDTH = 400;
const SURFACE_DIALOG_MIN_HEIGHT = 180;
const SURFACE_DIALOG_DEFAULT_WIDTH = 680;
const SURFACE_DIALOG_DEFAULT_HEIGHT = 320;

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  surfaceComponents: {
    type: Array,
    default: () => []
  },
  surfaceSummary: {
    type: Object,
    default: () => null
  }
});

const emit = defineEmits(['update:visible']);

let detachWindowResizeListener = null;

const {
  dialogSize,
  reconcileDialogSize,
  resizeDialogBy,
  startDialogResize,
  stopDialogResize
} = useFloatingDialogResize({
  minWidth: SURFACE_DIALOG_MIN_WIDTH,
  minHeight: SURFACE_DIALOG_MIN_HEIGHT,
  defaultWidth: SURFACE_DIALOG_DEFAULT_WIDTH,
  defaultHeight: SURFACE_DIALOG_DEFAULT_HEIGHT,
  maxViewportWidthRatio: 0.96,
  maxViewportHeightRatio: 0.88,
  cursorClass: 'resizing-both'
});

const dialogStyle = computed(() => ({
  width: `${dialogSize.value.width}px`,
  maxWidth: '96vw',
  maxHeight: '88vh'
}));

const surfaceLayoutModel = computed(() =>
  buildSurfaceLayoutModel({
    surfaceComponents: props.surfaceComponents,
    surfaceSummary: props.surfaceSummary
  })
);

const svgWidth = computed(() => Math.max(200, dialogSize.value.width - 32));
const svgHeight = computed(() => {
  const bandH = Number(surfaceLayoutModel.value?.bandHeight) || 0;
  return Math.max(bandH, 60);
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

watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    stopDialogResize();
  }
});

onMounted(() => {
  reconcileDialogSize();
  const handleResize = () => reconcileDialogSize();
  window.addEventListener('resize', handleResize);
  detachWindowResizeListener = () => window.removeEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  detachWindowResizeListener?.();
  detachWindowResizeListener = null;
});
</script>

<template>
  <Dialog
    :visible="visible"
    data-vue-owned="true"
    class="surface-equipment-floating-dialog"
    :modal="false"
    :draggable="true"
    :maximizable="true"
    :style="dialogStyle"
    :breakpoints="{ '960px': '96vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <span data-i18n="ui.tabs.surface_equipment">Surface Equipment</span>
    </template>

    <div class="surface-equipment-floating-dialog__body">
      <svg
        class="surface-equipment-floating-dialog__svg"
        :width="svgWidth"
        :height="svgHeight"
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        preserveAspectRatio="xMinYMin meet"
      >
        <SurfaceFlowBand
          :surface-layout="surfaceLayoutModel"
          :width="svgWidth"
        />
      </svg>

      <button
        type="button"
        class="surface-equipment-floating-dialog__resizer"
        aria-label="Resize surface equipment dialog"
        @keydown="handleResizerKeydown"
        @pointerdown="startDialogResize"
      ></button>
    </div>
  </Dialog>
</template>

<style scoped>
.surface-equipment-floating-dialog__body {
  position: relative;
  box-sizing: border-box;
  overflow: auto;
  padding-right: 18px;
  padding-bottom: 18px;
}

.surface-equipment-floating-dialog__svg {
  display: block;
}

.surface-equipment-floating-dialog__resizer {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 14px;
  height: 14px;
  border: 0;
  padding: 0;
  border-right: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-bottom: 2px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 0 0 2px 0;
  background: transparent;
  cursor: nwse-resize;
  z-index: 3;
}

:deep(.surface-equipment-floating-dialog .p-dialog-content) {
  padding-top: 0.5rem;
}
</style>
